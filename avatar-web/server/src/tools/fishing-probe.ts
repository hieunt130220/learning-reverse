import { get as httpGet } from 'node:http';

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
} from '../game/fishingDecode.js';
import { maybeShadowMatch } from '../fishing/shadowMatcher.js';
import type { Message } from '../proto/message.js';
import { MyReader } from '../proto/reader.js';
import type { SessionCloseInfo, SessionCloseKind } from '../proto/session.js';
import { NATIVE_PARK_JOIN_POSITIONS } from '../game/parkService.js';

interface ProbeArgs {
  accountId: number;
  map: number;
  area: number;
  outputDir: string;
  crawl: boolean;
  target: number;
  delayMs: number;
}

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
const STRING_KEYS = new Set(['--output-dir']);
/** Keys that take an integer value. */
const INT_KEYS = new Set(['--account-id', '--map', '--area', '--target', '--delay-ms']);
const ALL_KEYS = new Set([...BOOLEAN_FLAGS, ...STRING_KEYS, ...INT_KEYS]);

function parseArgs(argv: string[]): ProbeArgs {
  const intValues = new Map<string, number>();
  const boolFlags = new Set<string>();
  let outputDir: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]!;
    if (!ALL_KEYS.has(key)) {
      throw new Error(`Key or positional argument not allowed: ${key}`);
    }

    if (BOOLEAN_FLAGS.has(key)) {
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
      if (key === '--output-dir') {
        if (outputDir !== undefined) throw new Error(`CLI key repeated: ${key}`);
        outputDir = raw;
      }
      continue;
    }

    if (intValues.has(key)) throw new Error(`CLI key repeated: ${key}`);
    intValues.set(key, parseInteger(key, raw));
  }

  // Validate required keys.
  for (const key of ['--account-id', '--map', '--area'] as const) {
    if (!intValues.has(key)) throw new Error(`Missing required key: ${key}`);
  }
  if (outputDir === undefined) throw new Error('Missing required key: --output-dir');

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

  return { accountId, map, area, outputDir, crawl, target, delayMs };
}

function assertAvatarWebStopped(port: number): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT local không hợp lệ');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve();
    };

    const request = httpGet({
      host: '127.0.0.1',
      port,
      path: '/api/auth/me',
      timeout: 750,
    }, (response) => {
      response.resume();
      finish(new Error('hãy dừng Avatar Web server trước khi probe'));
      request.destroy();
    });

    request.once('timeout', () => {
      finish();
      request.destroy();
    });
    request.once('error', (error: NodeJS.ErrnoException) => {
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
    accountId: args.accountId,
    requested: { map: args.map, area: args.area },
    traffic: metadata,
    events,
    specialData,
  }, null, 2));
}

function redactedFailure(error: unknown): { section: string; offset: number; message: string } {
  if (error instanceof Error) {
    return {
      section: 'runtime',
      offset: -1,
      message: error.message,
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
  await assertAvatarWebStopped(config.port);

  const db = openDb(config.dbPath);
  const client = new GameClient();
  const abort = new AbortController();
  let phase: ProbePhase = 'login';
  const onTraffic = (entry: TrafficEntry): void => captureRelevantTraffic(metadata, phase, entry);
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
    if (!row) throw new Error(`không có account #${args.accountId}`);

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
      await runCrawl(client, args, abort.signal);
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
          maybeShadowMatch(payload); // fire-and-forget, read-only, no gameplay effect
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
                ...redactedFailure(error),
              }, null, 2));
            }
          })();
        } catch (error) {
          console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            phase: 'fishing-test',
            decode: 'error',
            ...redactedFailure(error),
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
 * Returns null on timeout or if imagesNew is missing/empty.
 */
function waitForRx79(
  client: GameClient,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<CanCauPayload | null> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      signal.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };
    const finish = (value: CanCauPayload | null): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const onMessage = (msg: Message): void => {
      if (msg.command !== 79) return;
      try {
        const payload = decodeCanCau(msg.getData());
        finish(payload);
      } catch {
        finish(null);
      }
    };
    const onAbort = (): void => finish(null);

    client.session.on('message', onMessage);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => finish(null), timeoutMs);
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
  args: ProbeArgs,
  signal: AbortSignal,
): Promise<void> {
  const { target, delayMs, outputDir, map, area } = args;
  const startTime = Date.now();

  let saved = 0;
  let skipped = 0;
  let errors = 0;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 50;
  const MAX_START_REJECTS = 10;
  let startRejects = 0;

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: 'crawl-start',
    target,
    delayMs,
    outputDir,
    map,
    area,
  }, null, 2));

  while (
    saved < target
    && consecutiveErrors < MAX_CONSECUTIVE_ERRORS
    && !shuttingDown
    && !signal.aborted
  ) {
    const roundStart = Date.now();

    // ── Step 1: TX45 (doStartFishing) → wait RX45 ──
    client.sendRaw(45, []);
    const startResult = await waitForRx45(client, signal, 8_000);

    if (!startResult || !startResult.iss) {
      const reason = startResult?.error ?? 'timeout chờ RX45';
      crawlLog(saved, target, `start rejected: ${reason}`);
      errors++;
      consecutiveErrors++;
      startRejects++;
      if (startRejects >= MAX_START_REJECTS) {
        console.error(`Đã bị reject start ${startRejects} lần liên tiếp — abort.`);
        break;
      }
      await delayCancellable(5_000, signal);
      continue;
    }
    startRejects = 0;

    // ── Step 2: TX41 (doQuanCau) — quăng cần ──
    client.sendRaw(41, []);

    // ── Step 3: Wait for RX79 CAN_CAU ──
    const payload = await waitForRx79(client, signal, 10_000);

    if (!payload || !payload.imagesNew || payload.imagesNew.length === 0) {
      crawlLog(saved, target, 'skip: RX79 timeout hoặc thiếu imagesNew');
      // TX44 để reset server state dù không có batch.
      client.sendRaw(44, []);
      skipped++;
      errors++;
      consecutiveErrors++;
      await delayCancellable(delayMs, signal);
      continue;
    }

    maybeShadowMatch(payload); // fire-and-forget, read-only, no gameplay effect

    // ── Step 4: Save batch (immutable, atomic) ──
    try {
      const batch = await saveCanCauBatch(payload, {
        outputDir,
        tag: 'crawl',
        map,
        area,
      });
      saved++;
      consecutiveErrors = 0;
      const elapsed = ((Date.now() - roundStart) / 1000).toFixed(1);
      crawlLog(
        saved, target,
        `${batch.batchId} img=${batch.imageCount} new=${batch.imageNewCount} (${elapsed}s)`,
      );
    } catch (error) {
      errors++;
      consecutiveErrors++;
      crawlLog(
        saved, target,
        `save error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // ── Step 5: TX44 (doCauCaXong) — đóng màn câu cá ──
    // Bắt buộc gửi để server reset state cho vòng sau.
    client.sendRaw(44, []);

    // ── Step 6: Delay before next round ──
    await delayCancellable(delayMs, signal);
  }

  // ── Summary ──
  const totalElapsedMs = Date.now() - startTime;
  const summary = {
    timestamp: new Date().toISOString(),
    event: 'crawl-done',
    reason: shuttingDown
      ? 'shutdown'
      : saved >= target
        ? 'target-reached'
        : consecutiveErrors >= MAX_CONSECUTIVE_ERRORS
          ? 'too-many-errors'
          : 'aborted',
    totalSaved: saved,
    totalSkipped: skipped,
    totalErrors: errors,
    totalElapsedMs,
    avgBatchMs: saved > 0 ? Math.round(totalElapsedMs / saved) : 0,
    map,
    area,
    outputDir,
  };
  console.log(JSON.stringify(summary, null, 2));
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
      accountId: args.accountId,
      requested: { map: args.map, area: args.area },
    } : {}),
    traffic: metadata,
    events,
    decode: 'error',
    ...redactedFailure(error),
  }, null, 2));
  process.exitCode = 1;
}