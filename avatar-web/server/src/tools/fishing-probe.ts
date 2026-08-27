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
import { decodeCanCau, saveCanCauBatch } from '../game/fishingDecode.js';
import type { Message } from '../proto/message.js';
import { MyReader } from '../proto/reader.js';
import type { SessionCloseInfo, SessionCloseKind } from '../proto/session.js';

interface ProbeArgs {
  accountId: number;
  map: number;
  area: number;
  outputDir: string;
}

type ProbePhase = 'login' | 'park-context' | 'board-list' | 'direct-join' | 'fishing-test';

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

function parseArgs(argv: string[]): ProbeArgs {
  if (argv.length % 2 !== 0) {
    throw new Error('Each CLI key must have exactly one value');
  }

  const intValues = new Map<string, number>();
  let outputDir: string | undefined;
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]!;
    const raw = argv[i + 1];
    if (!['--account-id', '--map', '--area', '--output-dir'].includes(key)) {
      throw new Error(`Key or positional argument not allowed: ${key}`);
    }
    if (intValues.has(key) || (key === '--output-dir' && outputDir !== undefined)) {
      throw new Error(`CLI key repeated: ${key}`);
    }
    if (raw === undefined || raw.startsWith('--')) {
      throw new Error(`Missing value for ${key}`);
    }
    if (key === '--output-dir') {
      outputDir = raw;
      continue;
    }
    intValues.set(key, parseInteger(key, raw));
  }

  const requiredKeys = ['--account-id', '--map', '--area', '--output-dir'] as const;
  for (const key of requiredKeys) {
    if (key === '--output-dir') {
      if (outputDir === undefined) throw new Error(`Missing required key: ${key}`);
      continue;
    }
    if (!intValues.has(key)) {
      throw new Error(`Missing required key: ${key}`);
    }
  }

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
  return { accountId, map, area, outputDir: outputDir! };
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
    // For fishing, we'll use map 27 as specified in the notes
    // We need to find the native join position for map 27
    // Since we don't have that, we'll use a default or try to discover it
    // For now, let's use coordinates 0,0 as a placeholder
    const joinPosition = { x: 0, y: 0 }; // TODO: Determine proper coordinates for map 27

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

    // Now start fishing capture phase (Giai đoạn A: capture + save only)
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