import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { connect as netConnect } from 'node:net';
import path from 'node:path';

import { getAccountById, readGamePass } from '../accounts/repo.js';
import { loadConfig } from '../config.js';
import { openDb } from '../db/index.js';
import {
  GameClient,
  type ClientStatus,
  type TemporaryLoginRejection,
  type TrafficEntry,
} from '../game/client.js';
import {
  decodeCanCau,
  saveCanCauBatch,
  type CanCauPayload,
  type SavedCanCauBatch,
} from '../game/fishingDecode.js';
import type { Message } from '../proto/message.js';
import { MyReader } from '../proto/reader.js';
import type { SessionCloseInfo, SessionCloseKind } from '../proto/session.js';
import { NATIVE_PARK_JOIN_POSITIONS } from '../game/parkService.js';

const SUCCESSOR_CYCLE_ID = 'p2cr2-20260906-01' as const;
const SUCCESSOR_CAPTURE_MODE = 'active-rx79-crawl-no-answer' as const;
const SUCCESSOR_TARGET = 90;
const SUCCESSOR_MAP = 14;
const SUCCESSOR_AREA = 1;
const MIN_SUCCESSOR_DELAY_MS = 2_000;
const AVATAR_WEB_PORT = 8_787;

interface SharedProbeArgs {
  accountId: number;
  map: number;
  area: number;
  outputDir: string;
  target: number;
  delayMs: number;
}

interface SingleProbeArgs extends SharedProbeArgs {
  crawl: false;
}

interface CrawlProbeArgs extends SharedProbeArgs {
  crawl: true;
  cycleId: typeof SUCCESSOR_CYCLE_ID;
  inventoryOutput: string;
}

type ProbeArgs = SingleProbeArgs | CrawlProbeArgs;

type ProbePhase = 'login' | 'park-context' | 'board-list' | 'direct-join' | 'fishing-test' | 'fishing-crawl';

interface TxRxMetadata {
  phase: ProbePhase;
  dir: 'TX' | 'RX';
  cmd: number;
  len: number;
}

interface ProbeEventMetadata {
  phase: ProbePhase;
  event: 'dialog' | 'temporary-rejection' | 'status' | 'closed';
  status?: ClientStatus;
  retryAfterMs?: number;
  closeKind?: SessionCloseKind;
  hadError?: boolean;
}

interface CrawlCounters {
  savedBatchCount: number;
  skippedBatchCount: number;
  errorCount: number;
  tx41Count: number;
  tx44Count: number;
  tx45Count: number;
  tx43Count: number;
  fatalEvidenceFailure: boolean;
}

interface CaptureInventoryRecord {
  batchId: string;
  capturedAt: string;
  manifestSha256: string;
}

type CrawlReason =
  | 'target-reached'
  | 'shutdown'
  | 'repeated-start-rejection'
  | 'too-many-errors'
  | 'fatal-evidence-failure'
  | 'aborted';

function parseInteger(key: string, raw: string): number {
  if (!/^-?\d+$/.test(raw)) {
    throw new Error(`${key} must be an integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${key} exceeds safe integer range`);
  }
  return value;
}

/** Boolean flags that take no value. */
const BOOLEAN_FLAGS = new Set(['--crawl']);
/** Keys that take a string value (not parsed as integer). */
const STRING_KEYS = new Set(['--output-dir', '--cycle-id', '--inventory-output']);
/** Keys that take an integer value. */
const INT_KEYS = new Set(['--account-id', '--map', '--area', '--target', '--delay-ms']);
const ALL_KEYS = new Set([...BOOLEAN_FLAGS, ...STRING_KEYS, ...INT_KEYS]);

function parseArgs(argv: string[]): ProbeArgs {
  const intValues = new Map<string, number>();
  const stringValues = new Map<string, string>();
  const boolFlags = new Set<string>();

  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]!;
    if (!ALL_KEYS.has(key)) {
      throw new Error(`Key or positional argument not allowed: ${key}`);
    }

    if (BOOLEAN_FLAGS.has(key)) {
      if (boolFlags.has(key)) throw new Error(`CLI key repeated: ${key}`);
      boolFlags.add(key);
      continue;
    }

    // Key-value pair: consume next arg as value.
    const raw = argv[i + 1];
    if (raw === undefined || raw.startsWith('--')) {
      throw new Error(`Missing value for ${key}`);
    }
    i++; // advance past value

    if (STRING_KEYS.has(key)) {
      if (stringValues.has(key)) throw new Error(`CLI key repeated: ${key}`);
      stringValues.set(key, raw);
      continue;
    }

    if (intValues.has(key)) throw new Error(`CLI key repeated: ${key}`);
    intValues.set(key, parseInteger(key, raw));
  }

  // Validate required keys.
  for (const key of ['--account-id', '--map', '--area'] as const) {
    if (!intValues.has(key)) throw new Error(`Missing required key: ${key}`);
  }
  const outputDir = stringValues.get('--output-dir');
  if (outputDir === undefined) throw new Error('Missing required key: --output-dir');
  if (outputDir.length === 0) throw new Error('--output-dir must not be empty');

  const accountId = intValues.get('--account-id')!;
  const map = intValues.get('--map')!;
  const area = intValues.get('--area')!;
  if (accountId <= 0) {
    throw new Error('--account-id must be a positive integer');
  }
  for (const [key, value] of [['--map', map], ['--area', area]] as const) {
    if (value < -128 || value > 127) {
      throw new Error(`${key} must be in signed-byte range -128..127`);
    }
  }

  const crawl = boolFlags.has('--crawl');
  const target = intValues.get('--target') ?? 200;
  const delayMs = intValues.get('--delay-ms') ?? 2_000;

  if (target < 1) throw new Error('--target must be >= 1');
  if (delayMs < 1_000) throw new Error('--delay-ms must be >= 1000');

  if (!crawl) {
    for (const key of ['--target', '--delay-ms', '--cycle-id', '--inventory-output']) {
      if (intValues.has(key) || stringValues.has(key)) {
        throw new Error(`${key} is only allowed with --crawl`);
      }
    }
    return { accountId, map, area, outputDir, crawl: false, target, delayMs };
  }

  const cycleId = stringValues.get('--cycle-id');
  if (cycleId === undefined) throw new Error('Missing required key: --cycle-id');
  if (cycleId !== SUCCESSOR_CYCLE_ID) {
    throw new Error(`--cycle-id must be ${SUCCESSOR_CYCLE_ID}`);
  }
  const inventoryOutput = stringValues.get('--inventory-output');
  if (inventoryOutput === undefined) {
    throw new Error('Missing required key: --inventory-output');
  }
  if (!path.isAbsolute(inventoryOutput)) {
    throw new Error('--inventory-output must be an absolute path');
  }
  if (target !== SUCCESSOR_TARGET) {
    throw new Error(`--target must be exactly ${SUCCESSOR_TARGET} for ${SUCCESSOR_CYCLE_ID}`);
  }
  if (map !== SUCCESSOR_MAP || area !== SUCCESSOR_AREA) {
    throw new Error(
      `--map/--area must be exactly ${SUCCESSOR_MAP}/${SUCCESSOR_AREA} for ${SUCCESSOR_CYCLE_ID}`,
    );
  }
  if (delayMs < MIN_SUCCESSOR_DELAY_MS) {
    throw new Error(`--delay-ms must be >= ${MIN_SUCCESSOR_DELAY_MS} for ${SUCCESSOR_CYCLE_ID}`);
  }

  return {
    accountId,
    map,
    area,
    outputDir,
    crawl: true,
    target,
    delayMs,
    cycleId,
    inventoryOutput,
  };
}

function assertAvatarWebStopped(port: number): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT local không hợp lệ');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = netConnect({ host: '127.0.0.1', port });
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };

    socket.setTimeout(750);
    socket.once('connect', () => {
      finish(new Error('hãy dừng Avatar Web server trước khi probe'));
    });
    socket.once('timeout', () => {
      finish(new Error(`không thể xác nhận cổng localhost:${port} đã đóng`));
    });
    socket.once('error', (error: NodeJS.ErrnoException) => {
      if (settled) return;
      if (error.code === 'ECONNREFUSED') {
        finish();
        return;
      }
      finish(new Error(
        `health-check localhost thất bại (${error.code ?? 'UNKNOWN'})`,
      ));
    });
  });
}

async function assertPathAbsent(filePath: string, label: string): Promise<void> {
  try {
    await fs.lstat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`${label} đã tồn tại; từ chối ghi đè`);
}

async function prepareCrawlOutput(args: CrawlProbeArgs): Promise<void> {
  await assertPathAbsent(args.inventoryOutput, 'capture inventory');

  try {
    const stat = await fs.lstat(args.outputDir);
    if (!stat.isDirectory()) {
      throw new Error('--output-dir đã tồn tại nhưng không phải thư mục');
    }
    const entries = await fs.readdir(args.outputDir);
    if (entries.length > 0) {
      throw new Error('--output-dir phải vắng mặt hoặc rỗng trước successor crawl');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await fs.mkdir(args.outputDir, { recursive: true, mode: 0o700 });
    const entries = await fs.readdir(args.outputDir);
    if (entries.length > 0) {
      throw new Error('--output-dir bị thay đổi trong lúc chuẩn bị successor crawl');
    }
  }
}

async function loginWithTimeout(
  client: GameClient,
  options: Parameters<GameClient['login']>[0],
  timeoutMs: number,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        client.logout();
      } finally {
        reject(new Error('hết giờ kết nối hoặc bắt đầu đăng nhập game'));
      }
    }, timeoutMs);
  });

  try {
    const login = client.login(options);
    await Promise.race([login, timeout]);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('không thể kết nối hoặc bắt đầu đăng nhập game');
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function waitUntilOnline(client: GameClient, timeoutMs: number): Promise<void> {
  if (client.status === 'online') return Promise.resolve();
  if (client.status === 'error' || client.status === 'idle') {
    return Promise.reject(new Error(
      `game client không online (status=${client.status})`,
    ));
  }

  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      if (timer) clearTimeout(timer);
      client.removeListener('status', onStatus);
    };
    const onStatus = (status: ClientStatus): void => {
      if (status === 'online') {
        cleanup();
        resolve();
      } else if (status === 'error' || status === 'idle') {
        cleanup();
        reject(new Error(`game client không online (status=${status})`));
      }
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('hết giờ chờ game client online'));
    }, timeoutMs);
    client.on('status', onStatus);
  });
}

function waitForParkHandlerResponse(
  client: GameClient,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      signal.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };
    const finishResolve = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const finishReject = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error
        ? error
        : new Error('không nhận được ACK handler Park'));
    };
    const onMessage = (msg: Message): void => {
      if (msg.command !== -1) return;
      const body = msg.getData();
      if (body.length !== 1 || body.readInt8(0) !== 9) return;
      finishResolve();
    };
    const onAbort = (): void => finishReject(new Error('chờ ACK handler bị hủy'));

    client.session.on('message', onMessage);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      finishReject(new Error('hết giờ chờ ACK handler Park'));
    }, timeoutMs);
    if (signal.aborted) onAbort();
  });
}

function waitForParkBoardList(
  client: GameClient,
  signal: AbortSignal,
  roomId: number,
  timeoutMs: number,
): Promise<{ status: 'observed' | 'pending' | 'malformed'; catalog?: any; error?: { section: string; offset: number; message: string } }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      signal.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };
    const finishResolve = (value: any): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const finishReject = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error
        ? error
        : new Error('chờ RX 90 thất bại'));
    };
    const onMessage = (msg: Message): void => {
      if (msg.command !== 90) return;
      try {
        // Simplified for fishing probe - we just need to know we got a response
        finishResolve({ status: 'observed' });
      } catch (error) {
        finishResolve({ status: 'malformed', error: { section: 'parser', offset: -1, message: error instanceof Error ? error.message : String(error) } });
      }
    };
    const onAbort = (): void => finishReject(new Error('chờ RX 90 bị hủy'));

    client.session.on('message', onMessage);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      finishResolve({
        status: 'pending',
        error: { section: 'timeout', offset: -1, message: 'hết giờ chờ RX 90 board-list' },
      });
    }, timeoutMs);
    if (signal.aborted) onAbort();
  });
}

function captureRelevantTraffic(
  metadata: TxRxMetadata[],
  phase: ProbePhase,
  entry: TrafficEntry,
): void {
  metadata.push({
    phase,
    dir: entry.dir === 'tx' ? 'TX' : 'RX',
    cmd: entry.cmd,
    len: entry.len,
  });
}

function printRedactedEvidence(
  args: ProbeArgs,
  metadata: TxRxMetadata[],
  events: ProbeEventMetadata[],
  specialData: any[],
): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    requested: { map: args.map, area: args.area },
    traffic: metadata,
    events,
    specialData,
  }, null, 2));
}

function redactedFailure(
  error: unknown,
  accountId?: number,
): { section: string; offset: number; message: string } {
  if (error instanceof Error) {
    const message = accountId === undefined
      ? error.message
      : error.message.split(String(accountId)).join('[redacted-account]');
    return {
      section: 'runtime',
      offset: -1,
      message,
    };
  }
  return {
    section: 'runtime',
    offset: -1,
    message: 'probe failed; runtime details have been redacted',
  };
}

async function runProbe(
  args: ProbeArgs,
  metadata: TxRxMetadata[],
  events: ProbeEventMetadata[],
): Promise<void> {
  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig();
  } catch {
    throw new Error('cấu hình probe không hợp lệ hoặc thiếu');
  }
  if (args.crawl) {
    if (config.port !== AVATAR_WEB_PORT) {
      throw new Error(`successor crawl yêu cầu Avatar Web local port ${AVATAR_WEB_PORT}`);
    }
    await assertAvatarWebStopped(AVATAR_WEB_PORT);
    await prepareCrawlOutput(args);
  } else {
    await assertAvatarWebStopped(config.port);
  }

  const db = openDb(config.dbPath);
  const client = new GameClient();
  const abort = new AbortController();
  const crawlCounters = args.crawl ? createCrawlCounters() : undefined;
  let phase: ProbePhase = 'login';
  const onTraffic = (entry: TrafficEntry): void => {
    captureRelevantTraffic(metadata, phase, entry);
    if (crawlCounters && entry.dir === 'tx' && entry.cmd === 43) {
      crawlCounters.tx43Count += 1;
      crawlCounters.fatalEvidenceFailure = true;
    }
  };
  const onDialog = (): void => {
    events.push({ phase, event: 'dialog' });
  };
  const onTemporaryRejection = (value: TemporaryLoginRejection): void => {
    events.push({ phase, event: 'temporary-rejection', retryAfterMs: value.retryAfterMs });
  };
  const onStatus = (status: ClientStatus): void => {
    events.push({ phase, event: 'status', status });
  };
  const onClosed = (info: SessionCloseInfo): void => {
    events.push({ phase, event: 'closed', closeKind: info.kind, hadError: info.hadError });
  };
  client.on('traffic', onTraffic);
  client.on('dialog', onDialog);
  client.on('temporary-rejection', onTemporaryRejection);
  client.on('status', onStatus);
  client.session.on('closed', onClosed);
  try {
    const row = getAccountById(db, args.accountId);
    if (!row) throw new Error('không có account đã chọn');

    await loginWithTimeout(client, {
      host: row.host,
      port: row.port,
      user: row.gameUser,
      pass: readGamePass(db, config.masterKey, args.accountId),
      device: row.device,
    }, 12_000);
    await waitUntilOnline(client, 10_000);

    phase = 'park-context';
    const handlerPending = waitForParkHandlerResponse(client, abort.signal, 5_000);
    client.enterParkContext();
    await handlerPending;

    phase = 'board-list';
    const boardListPending = waitForParkBoardList(
      client,
      abort.signal,
      args.map,
      5_000,
    );
    // Send board list request for the map
    client.sendRaw(90, [{ t: 'i8', v: String(args.map) }]);
    await boardListPending;

    phase = 'direct-join';
    const joinPosition = NATIVE_PARK_JOIN_POSITIONS[args.map] ?? { x: 254, y: 82 };

    const specialUpdates: any[] = [];
    const onSpecial = (msg: Message): void => {
      if (msg.command === 48) { // MAP_SPECIAL_UPDATE
        specialUpdates.push(msg.getData());
      }
    };
    client.session.on('message', onSpecial);

    const joinPending = new Promise<void>((resolve, reject) => {
      let settled = false;
      let timer: NodeJS.Timeout | undefined;
      const cleanup = (): void => {
        client.session.removeListener('message', onMessage);
        abort.signal.removeEventListener('abort', onAbort);
        if (timer) clearTimeout(timer);
      };
      const finishResolve = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const finishReject = (error: unknown): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error instanceof Error
          ? error
          : new Error('không nhận được RX 80'));
      };
      const onMessage = (msg: Message): void => {
        if (msg.command !== 80) return;
        finishResolve();
      };
      const onAbort = (): void => finishReject(new Error('chờ RX 80 bị hủy'));

      client.session.on('message', onMessage);
      abort.signal.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => {
        finishReject(new Error('hết giờ chờ RX 80'));
      }, 7_000);
      if (abort.signal.aborted) onAbort();

      // Send join request
      client.sendRaw(80, [
        { t: 'i8', v: String(args.map) },
        { t: 'i8', v: String(args.area) },
        { t: 'i16', v: String(joinPosition.x) },
        { t: 'i16', v: String(joinPosition.y) },
      ]);
    });

    await joinPending;

    // Wait a bit for any special updates
    await new Promise<void>((resolve) => setTimeout(resolve, 3_000));

    client.session.removeListener('message', onSpecial);

    if (args.crawl) {
      // ─── Crawl mode: loop through fishing protocol to capture many batches ───
      phase = 'fishing-crawl';
      await runCrawl(client, args, abort.signal, crawlCounters!);
    } else {
      // ─── Probe mode (original): capture exactly one batch then exit ───
      phase = 'fishing-test';

      const canCauSeen: number[] = [];
      let savedBatch: Awaited<ReturnType<typeof saveCanCauBatch>> | undefined;

      // Lắng nghe RX79 CAN_CAU; lưu đúng một batch bất biến rồi thoát.
      // KHÔNG gửi TX43 (không submit đáp án) — chỉ capture/save offline.
      const onFishingMessage = (msg: Message): void => {
        if (savedBatch) return;
        if (msg.command !== 79) return;
        try {
          const payload = decodeCanCau(msg.getData());
          canCauSeen.push(payload.idFish);
          void (async (): Promise<void> => {
            try {
              savedBatch = await saveCanCauBatch(payload, {
                outputDir: args.outputDir,
                tag: 'probe',
                map: args.map,
                area: args.area,
              });
            } catch (error) {
              console.error(JSON.stringify({
                timestamp: new Date().toISOString(),
                phase: 'fishing-test',
                decode: 'save-batch-error',
                ...redactedFailure(error, args.accountId),
              }, null, 2));
            }
          })();
        } catch (error) {
          console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            phase: 'fishing-test',
            decode: 'error',
            ...redactedFailure(error, args.accountId),
          }, null, 2));
        }
      };

      client.session.on('message', onFishingMessage);

      // Send TX45 (START_CAU_CA) to begin fishing — triggers RX79 CAN_CAU.
      client.sendRaw(45, []); // Empty body for START_CAU_CA

      // Chờ tối đa 10s để nhận đúng một batch RX79 rồi thoát (không TX43).
      const deadline = Date.now() + 10_000;
      while (!savedBatch && Date.now() < deadline) {
        await new Promise<void>((resolve) => setTimeout(resolve, 250));
      }

      client.session.removeListener('message', onFishingMessage);

      // In CHỈ metadata đã sanitize (batch/count/path) — không raw hex/account.
      if (savedBatch) {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          batchId: savedBatch.batchId,
          directory: savedBatch.directory,
          manifestPath: savedBatch.manifestPath,
          imageCount: savedBatch.imageCount,
          imageNewCount: savedBatch.imageNewCount,
          map: args.map,
          area: args.area,
          canCauSeen: canCauSeen.length,
        }, null, 2));
      } else {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          batchId: null,
          imageCount: 0,
          imageNewCount: 0,
          map: args.map,
          area: args.area,
          canCauSeen: canCauSeen.length,
          note: 'không nhận được batch RX79 (hết giờ) — không ghi data',
        }, null, 2));
      }

      printRedactedEvidence(
        args,
        metadata,
        events,
        specialUpdates,
      );
    }
  } finally {
    client.removeListener('dialog', onDialog);
    client.removeListener('temporary-rejection', onTemporaryRejection);
    client.removeListener('status', onStatus);
    client.session.removeListener('closed', onClosed);
    abort.abort();
    client.removeListener('traffic', onTraffic);
    try {
      client.logout();
    } finally {
      db.close();
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Crawler loop — automated batch collection for ML training dataset
// ═════════════════════════════════════════════════════════════════════════════

/** Graceful shutdown flag; set by SIGINT/SIGTERM. */
let shuttingDown = false;

function createCrawlCounters(): CrawlCounters {
  return {
    savedBatchCount: 0,
    skippedBatchCount: 0,
    errorCount: 0,
    tx41Count: 0,
    tx44Count: 0,
    tx45Count: 0,
    tx43Count: 0,
    fatalEvidenceFailure: false,
  };
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function sendCrawlCommand(
  client: GameClient,
  command: 41 | 44 | 45,
  counters: CrawlCounters,
): void {
  switch (command) {
    case 41:
      client.sendRaw(command, []);
      counters.tx41Count += 1;
      return;
    case 44:
      client.sendRaw(command, []);
      counters.tx44Count += 1;
      return;
    case 45:
      client.sendRaw(command, []);
      counters.tx45Count += 1;
      return;
    default:
      throw new Error(`crawl fishing command không được phép: ${String(command)}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCanonicalUtc(value: string): boolean {
  const instant = new Date(value);
  return !Number.isNaN(instant.getTime()) && instant.toISOString() === value;
}

function sha256Bytes(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}

async function readManifestRecord(
  batchId: string,
  directory: string,
  manifestPath: string,
): Promise<CaptureInventoryRecord> {
  if (batchId === '.' || batchId === '..' || /[/\\\s]/.test(batchId)) {
    throw new Error(`batchId không an toàn: ${batchId}`);
  }
  const directoryStat = await fs.lstat(directory);
  if (!directoryStat.isDirectory()) {
    throw new Error(`batch final không phải thư mục: ${batchId}`);
  }
  if (path.resolve(manifestPath) !== path.resolve(directory, 'manifest.json')) {
    throw new Error(`manifest path không thuộc batch final: ${batchId}`);
  }
  const manifestStat = await fs.lstat(manifestPath);
  if (!manifestStat.isFile()) {
    throw new Error(`manifest không phải regular file: ${batchId}`);
  }

  const manifestBytes = await fs.readFile(manifestPath);
  let manifest: unknown;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch {
    throw new Error(`manifest JSON không hợp lệ: ${batchId}`);
  }
  if (!isRecord(manifest) || manifest.batchId !== batchId) {
    throw new Error(`manifest batchId không khớp: ${batchId}`);
  }
  if (typeof manifest.capturedAt !== 'string' || !isCanonicalUtc(manifest.capturedAt)) {
    throw new Error(`manifest capturedAt không hợp lệ: ${batchId}`);
  }

  return {
    batchId,
    capturedAt: manifest.capturedAt,
    manifestSha256: sha256Bytes(manifestBytes),
  };
}

async function recordSavedBatch(
  batch: SavedCanCauBatch,
  outputDir: string,
): Promise<CaptureInventoryRecord> {
  const expectedDirectory = path.join(outputDir, batch.batchId);
  if (path.resolve(batch.directory) !== path.resolve(expectedDirectory)) {
    throw new Error(`batch final nằm ngoài output root: ${batch.batchId}`);
  }
  return readManifestRecord(batch.batchId, batch.directory, batch.manifestPath);
}

async function snapshotOutputEntries(outputDir: string): Promise<Set<string>> {
  return new Set(await fs.readdir(outputDir));
}

async function cleanupFailedSaveArtifacts(
  outputDir: string,
  entriesBeforeSave: ReadonlySet<string>,
): Promise<void> {
  const entriesAfterSave = await fs.readdir(outputDir);
  for (const entry of entriesAfterSave) {
    if (entriesBeforeSave.has(entry)) continue;
    if (!/^crawl_\d+_[0-9a-f]{6}(?:\.tmp)?$/.test(entry)) {
      throw new Error(`save lỗi để lại entry không xác định: ${entry}`);
    }
    await fs.rm(path.join(outputDir, entry), { recursive: true, force: true });
  }
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortJsonValue(item));
  if (!isRecord(value)) return value;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortJsonValue(value[key]);
  }
  return sorted;
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(sortJsonValue(value))}\n`;
}

async function syncDirectory(directory: string): Promise<void> {
  const handle = await fs.open(directory, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function assertCaptureOutputMatchesRecords(
  outputDir: string,
  records: readonly CaptureInventoryRecord[],
  target: number,
): Promise<void> {
  if (records.length !== target) {
    throw new Error(`capture record count không khớp target: ${records.length}/${target}`);
  }
  const recordIds = new Set(records.map((record) => record.batchId));
  if (recordIds.size !== target) {
    throw new Error('capture inventory có batchId trùng');
  }

  const entries = await fs.readdir(outputDir, { withFileTypes: true });
  if (entries.length !== target) {
    throw new Error(`raw root phải có đúng ${target} batch directory`);
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !recordIds.has(entry.name)) {
      throw new Error(`raw root chứa entry không hợp lệ: ${entry.name}`);
    }
  }

  for (const record of records) {
    if (!/^[0-9a-f]{64}$/.test(record.manifestSha256)) {
      throw new Error(`manifestSha256 không hợp lệ: ${record.batchId}`);
    }
    const directory = path.join(outputDir, record.batchId);
    const current = await readManifestRecord(
      record.batchId,
      directory,
      path.join(directory, 'manifest.json'),
    );
    if (
      current.capturedAt !== record.capturedAt
      || current.manifestSha256 !== record.manifestSha256
    ) {
      throw new Error(`manifest thay đổi trước khi seal: ${record.batchId}`);
    }
  }
}

async function publishCaptureInventory(
  inventoryPath: string,
  document: unknown,
  counters: CrawlCounters,
  signal: AbortSignal,
): Promise<void> {
  const directory = path.dirname(inventoryPath);
  const body = canonicalJson(document);
  const assertPublishable = (): void => {
    if (
      shuttingDown
      || signal.aborted
      || counters.fatalEvidenceFailure
      || counters.tx43Count > 0
    ) {
      throw new Error('capture inventory không còn đủ điều kiện publication');
    }
  };

  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  let created = false;
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    assertPublishable();
    handle = await fs.open(inventoryPath, 'wx', 0o600);
    created = true;
    assertPublishable();
    await handle.writeFile(body, 'utf8');
    assertPublishable();
    await handle.sync();
    assertPublishable();
    await handle.close();
    handle = undefined;
    await fs.chmod(inventoryPath, 0o600);
    assertPublishable();
    await syncDirectory(directory);
    assertPublishable();
  } catch (error) {
    if (handle) {
      try {
        await handle.close();
      } catch {
        // Preserve the original publication failure.
      }
    }
    if (created) {
      try {
        await fs.unlink(inventoryPath);
        await syncDirectory(directory);
      } catch {
        // Preserve the original publication failure.
      }
    }
    throw error;
  }
}

/**
 * Wait for RX45 START_CAU_CA response: { iss: boolean; error?: string }.
 * Returns null on timeout.
 */
function waitForRx45(
  client: GameClient,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<{ iss: boolean; error?: string } | null> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      signal.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };
    const finish = (value: { iss: boolean; error?: string } | null): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const onMessage = (msg: Message): void => {
      if (msg.command === 45) {
        try {
          const r = new MyReader(msg.getData());
          const iss = r.readBoolean();
          const error = iss ? undefined : r.readUTF();
          finish({ iss, error });
        } catch {
          finish({ iss: false, error: 'RX45 decode error' });
        }
      }
    };
    const onAbort = (): void => finish(null);

    client.session.on('message', onMessage);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => finish(null), timeoutMs);
    if (signal.aborted) onAbort();
  });
}

/**
 * Wait for RX79 CAN_CAU and decode the payload.
 * Returns null on timeout. Malformed payloads reject the waiter.
 */
function waitForRx79(
  client: GameClient,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<CanCauPayload | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      signal.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };
    const finishResolve = (value: CanCauPayload | null): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const finishReject = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onMessage = (msg: Message): void => {
      if (msg.command !== 79) return;
      try {
        const payload = decodeCanCau(msg.getData());
        if (!payload.imagesNew || payload.imagesNew.length === 0) {
          throw new Error('RX79 thiếu imagesNew');
        }
        finishResolve(payload);
      } catch (error) {
        finishReject(new Error(`RX79 malformed: ${asError(error).message}`));
      }
    };
    const onAbort = (): void => finishResolve(null);

    client.session.on('message', onMessage);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => finishResolve(null), timeoutMs);
    if (signal.aborted) onAbort();
  });
}

/** Delay that can be interrupted by abort signal or shuttingDown flag. */
function delayCancellable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted || shuttingDown) { resolve(); return; }
    let timer: NodeJS.Timeout | undefined;
    const onAbort = (): void => {
      if (timer) clearTimeout(timer);
      resolve();
    };
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
  });
}

function crawlLog(round: number, target: number, msg: string): void {
  console.log(`[${round}/${target}] ${new Date().toISOString()} ${msg}`);
}

/**
 * Main crawler loop. Follows the verified fishing protocol:
 *   TX45 → RX45(iss) → TX41 → RX79(capture) → save → TX44 → delay → repeat
 *
 * KHÔNG gửi TX43 (không submit đáp án) — chỉ capture/save offline (Giai đoạn A).
 */
async function runCrawl(
  client: GameClient,
  args: CrawlProbeArgs,
  signal: AbortSignal,
  counters: CrawlCounters,
): Promise<void> {
  const {
    target,
    delayMs,
    outputDir,
    map,
    area,
    cycleId,
    inventoryOutput,
  } = args;
  const startTime = Date.now();
  const startedAt = new Date();
  const records: CaptureInventoryRecord[] = [];
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 50;
  const MAX_START_REJECTS = 10;
  let startRejects = 0;
  let terminalReason: CrawlReason | undefined;
  let terminalError: Error | undefined;

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: 'crawl-start',
    cycleId,
    target,
    delayMs,
    outputDir,
    map,
    area,
  }, null, 2));

  while (
    counters.savedBatchCount < target
    && consecutiveErrors < MAX_CONSECUTIVE_ERRORS
    && !counters.fatalEvidenceFailure
    && !shuttingDown
    && !signal.aborted
  ) {
    const roundStart = Date.now();

    // ── Step 1: TX45 (doStartFishing) → wait RX45 ──
    const rx45 = waitForRx45(client, signal, 8_000);
    try {
      sendCrawlCommand(client, 45, counters);
    } catch (error) {
      counters.errorCount += 1;
      counters.fatalEvidenceFailure = true;
      terminalReason = 'fatal-evidence-failure';
      terminalError = asError(error);
      break;
    }
    const startResult = await rx45;

    if (counters.fatalEvidenceFailure) {
      if (startResult?.iss) {
        try {
          sendCrawlCommand(client, 44, counters);
        } catch (error) {
          counters.errorCount += 1;
          terminalError ??= asError(error);
        }
      }
      terminalReason = 'fatal-evidence-failure';
      terminalError ??= new Error('đã quan sát command 43 trong capture traffic');
      break;
    }

    if (!startResult || !startResult.iss) {
      const reason = startResult?.error ?? 'timeout chờ RX45';
      crawlLog(counters.savedBatchCount, target, `start rejected: ${reason}`);
      counters.errorCount += 1;
      consecutiveErrors += 1;
      startRejects += 1;
      if (startRejects >= MAX_START_REJECTS) {
        terminalReason = 'repeated-start-rejection';
        terminalError = new Error(`đã bị reject start ${startRejects} lần liên tiếp`);
        break;
      }
      await delayCancellable(5_000, signal);
      continue;
    }
    startRejects = 0;

    // ── Step 2: TX41 (doQuanCau) — quăng cần ──
    const rx79 = waitForRx79(client, signal, 10_000);
    try {
      sendCrawlCommand(client, 41, counters);
    } catch (error) {
      counters.errorCount += 1;
      counters.fatalEvidenceFailure = true;
      terminalReason = 'fatal-evidence-failure';
      terminalError = asError(error);
      break;
    }

    // ── Step 3: Wait for RX79 CAN_CAU ──
    let payload: CanCauPayload | null;
    try {
      payload = await rx79;
    } catch (error) {
      counters.errorCount += 1;
      counters.fatalEvidenceFailure = true;
      terminalReason = 'fatal-evidence-failure';
      terminalError = asError(error);
      try {
        sendCrawlCommand(client, 44, counters);
      } catch (resetError) {
        counters.errorCount += 1;
        terminalError = new Error(
          `${terminalError.message}; TX44 reset failed: ${asError(resetError).message}`,
        );
      }
      break;
    }

    if (counters.fatalEvidenceFailure) {
      try {
        sendCrawlCommand(client, 44, counters);
      } catch (error) {
        counters.errorCount += 1;
        terminalError = asError(error);
      }
      terminalReason = 'fatal-evidence-failure';
      terminalError ??= new Error('đã quan sát command 43 trong capture traffic');
      break;
    }

    if (!payload) {
      crawlLog(counters.savedBatchCount, target, 'skip: RX79 timeout');
      counters.skippedBatchCount += 1;
      counters.errorCount += 1;
      consecutiveErrors += 1;
      try {
        sendCrawlCommand(client, 44, counters);
      } catch (error) {
        counters.errorCount += 1;
        counters.fatalEvidenceFailure = true;
        terminalReason = 'fatal-evidence-failure';
        terminalError = asError(error);
        break;
      }
      await delayCancellable(delayMs, signal);
      continue;
    }

    // ── Step 4: Save batch (immutable, atomic) ──
    const entriesBeforeSave = await snapshotOutputEntries(outputDir);
    let batch: SavedCanCauBatch;
    try {
      batch = await saveCanCauBatch(payload, {
        outputDir,
        tag: 'crawl',
        map,
        area,
      });
    } catch (error) {
      counters.errorCount += 1;
      counters.fatalEvidenceFailure = true;
      terminalReason = 'fatal-evidence-failure';
      terminalError = asError(error);
      try {
        await cleanupFailedSaveArtifacts(outputDir, entriesBeforeSave);
      } catch (cleanupError) {
        terminalError = new Error(
          `${terminalError.message}; partial-save cleanup failed: ${asError(cleanupError).message}`,
        );
      }
      try {
        sendCrawlCommand(client, 44, counters);
      } catch (resetError) {
        counters.errorCount += 1;
        terminalError = new Error(
          `${terminalError.message}; TX44 reset failed: ${asError(resetError).message}`,
        );
      }
      break;
    }

    try {
      const record = await recordSavedBatch(batch, outputDir);
      records.push(record);
      counters.savedBatchCount += 1;
      consecutiveErrors = 0;
      const elapsed = ((Date.now() - roundStart) / 1000).toFixed(1);
      crawlLog(
        counters.savedBatchCount,
        target,
        `${batch.batchId} img=${batch.imageCount} new=${batch.imageNewCount} (${elapsed}s)`,
      );
    } catch (error) {
      counters.errorCount += 1;
      counters.fatalEvidenceFailure = true;
      terminalReason = 'fatal-evidence-failure';
      terminalError = asError(error);
    }

    // ── Step 5: TX44 (doCauCaXong) — đóng màn câu cá ──
    // Bắt buộc gửi để server reset state cho vòng sau.
    try {
      sendCrawlCommand(client, 44, counters);
    } catch (error) {
      counters.errorCount += 1;
      counters.fatalEvidenceFailure = true;
      terminalReason = 'fatal-evidence-failure';
      terminalError ??= asError(error);
    }

    if (counters.fatalEvidenceFailure) break;

    // ── Step 6: Delay before next round ──
    await delayCancellable(delayMs, signal);
  }

  let reason: CrawlReason = terminalReason
    ?? (shuttingDown
      ? 'shutdown'
      : counters.fatalEvidenceFailure
        ? 'fatal-evidence-failure'
        : counters.savedBatchCount >= target
          ? 'target-reached'
          : consecutiveErrors >= MAX_CONSECUTIVE_ERRORS
            ? 'too-many-errors'
            : 'aborted');
  const sortedRecords = [...records].sort((left, right) => (
    left.capturedAt.localeCompare(right.capturedAt)
    || left.batchId.localeCompare(right.batchId)
  ));

  if (reason === 'target-reached') {
    try {
      if (counters.tx43Count !== 0 || counters.fatalEvidenceFailure) {
        throw new Error('capture traffic không đủ điều kiện seal');
      }
      await assertCaptureOutputMatchesRecords(outputDir, sortedRecords, target);
    } catch (error) {
      counters.errorCount += 1;
      counters.fatalEvidenceFailure = true;
      reason = 'fatal-evidence-failure';
      terminalError = asError(error);
    }
  }

  const stoppedAt = new Date();
  if (reason === 'target-reached') {
    const inventoryDocument = {
      schemaVersion: 2,
      cycleId,
      captureMode: SUCCESSOR_CAPTURE_MODE,
      startedAt: startedAt.toISOString(),
      stoppedAt: stoppedAt.toISOString(),
      requested: { map, area, target, delayMs },
      summary: {
        reason,
        savedBatchCount: counters.savedBatchCount,
        skippedBatchCount: counters.skippedBatchCount,
        errorCount: counters.errorCount,
        tx43Count: counters.tx43Count,
      },
      records: sortedRecords,
    };
    try {
      await publishCaptureInventory(inventoryOutput, inventoryDocument, counters, signal);
    } catch (error) {
      counters.errorCount += 1;
      counters.fatalEvidenceFailure = true;
      reason = 'fatal-evidence-failure';
      terminalError = asError(error);
    }
  }

  const totalElapsedMs = Date.now() - startTime;
  const summary = {
    timestamp: new Date().toISOString(),
    event: 'crawl-done',
    reason,
    ...counters,
    totalElapsedMs,
    avgBatchMs: counters.savedBatchCount > 0
      ? Math.round(totalElapsedMs / counters.savedBatchCount)
      : 0,
    map,
    area,
    outputDir,
    inventoryOutput: reason === 'target-reached' ? inventoryOutput : null,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (reason !== 'target-reached') {
    throw terminalError ?? new Error(`crawl kết thúc mà không seal inventory: ${reason}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Entry point
// ═════════════════════════════════════════════════════════════════════════════

process.on('SIGINT', () => { shuttingDown = true; });
process.on('SIGTERM', () => { shuttingDown = true; });

let args: ProbeArgs | undefined;
const metadata: TxRxMetadata[] = [];
const events: ProbeEventMetadata[] = [];
try {
  args = parseArgs(process.argv.slice(2));
  await runProbe(args, metadata, events);
} catch (error) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    ...(args ? {
      requested: { map: args.map, area: args.area },
    } : {}),
    traffic: metadata,
    events,
    decode: 'error',
    ...redactedFailure(error, args?.accountId),
  }, null, 2));
  process.exitCode = 1;
}
