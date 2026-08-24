import { get as httpGet } from 'node:http';

import { getAccountById, readGamePass } from '../accounts/repo.js';
import { loadConfig } from '../config.js';
import { openDb } from '../db/index.js';
import { GameClient, type ClientStatus, type TrafficEntry } from '../game/client.js';
import {
  WorldDataDecodeError,
  type EnterWorldSnapshot,
} from '../game/worldData.js';

interface ProbeArgs {
  accountId: number;
  map: number;
  area: number;
}

interface TxRxMetadata {
  dir: 'TX' | 'RX';
  cmd: number;
  len: number;
}

const ALLOWED = new Set(['--account-id', '--map', '--area']);
const REQUIRED_KEYS = ['--account-id', '--map', '--area'] as const;

class RedactedProbeError extends Error {
  constructor(
    readonly section: string,
    message: string,
    readonly offset = -1,
  ) {
    super(message);
    this.name = 'RedactedProbeError';
  }
}

function parseInteger(key: string, raw: string): number {
  if (!/^-?\d+$/.test(raw)) {
    throw new RedactedProbeError('cli', `${key} phải là số nguyên đơn`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new RedactedProbeError('cli', `${key} vượt giới hạn số nguyên an toàn`);
  }
  return value;
}

function parseArgs(argv: string[]): ProbeArgs {
  if (argv.length % 2 !== 0) {
    throw new RedactedProbeError('cli', 'mỗi key CLI phải có đúng một value');
  }

  const values = new Map<string, number>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]!;
    const raw = argv[i + 1];
    if (!ALLOWED.has(key)) {
      throw new RedactedProbeError('cli', 'key hoặc positional arg không được phép');
    }
    if (values.has(key)) {
      throw new RedactedProbeError('cli', `key CLI bị lặp: ${key}`);
    }
    if (raw === undefined || raw.startsWith('--')) {
      throw new RedactedProbeError('cli', `thiếu value cho ${key}`);
    }
    values.set(key, parseInteger(key, raw));
  }

  for (const key of REQUIRED_KEYS) {
    if (!values.has(key)) {
      throw new RedactedProbeError('cli', `thiếu key bắt buộc: ${key}`);
    }
  }

  const accountId = values.get('--account-id')!;
  const map = values.get('--map')!;
  const area = values.get('--area')!;
  if (accountId <= 0) {
    throw new RedactedProbeError('cli', '--account-id phải là số nguyên dương');
  }
  for (const [key, value] of [['--map', map], ['--area', area]] as const) {
    if (value < -128 || value > 127) {
      throw new RedactedProbeError('cli', `${key} phải nằm trong signed-byte -128..127`);
    }
  }
  return { accountId, map, area };
}

function assertAvatarWebStopped(port: number): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new RedactedProbeError('health', 'PORT local không hợp lệ');
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
      finish(new RedactedProbeError('health', 'hãy dừng Avatar Web server trước khi probe'));
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
      finish(new RedactedProbeError(
        'health',
        `health-check localhost thất bại (${error.code ?? 'UNKNOWN'})`,
      ));
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitUntilOnline(client: GameClient, timeoutMs: number): Promise<void> {
  if (client.status === 'online') return Promise.resolve();
  if (client.status === 'error' || client.status === 'idle') {
    return Promise.reject(new RedactedProbeError(
      'login',
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
        reject(new RedactedProbeError('login', `game client không online (status=${status})`));
      }
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new RedactedProbeError('login', 'hết giờ chờ game client online'));
    }, timeoutMs);
    client.on('status', onStatus);
  });
}

function waitForDecodedSnapshot(
  client: GameClient,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<EnterWorldSnapshot> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => {
      client.removeListener('world-snapshot-error', onDecodeError);
    };
    const finishResolve = (snapshot: EnterWorldSnapshot): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(snapshot);
    };
    const finishReject = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onDecodeError = (error: unknown): void => finishReject(error);

    client.once('world-snapshot-error', onDecodeError);
    void client.waitForWorldSnapshot(signal, timeoutMs).then(
      finishResolve,
      (error: unknown) => finishReject(new RedactedProbeError(
        'snapshot',
        error instanceof Error ? error.message : 'không nhận được enter-world snapshot',
      )),
    );
  });
}

function captureRelevantTraffic(metadata: TxRxMetadata[], entry: TrafficEntry): void {
  const relevant = (
    (entry.dir === 'tx' && (entry.cmd === -1 || entry.cmd === 80))
    || (entry.dir === 'rx' && entry.cmd === -34)
  );
  if (!relevant) return;
  metadata.push({
    dir: entry.dir === 'tx' ? 'TX' : 'RX',
    cmd: entry.cmd,
    len: entry.len,
  });
}

function assertExpectedTraffic(metadata: TxRxMetadata[]): void {
  const count = (dir: 'TX' | 'RX', cmd: number): number => (
    metadata.filter((entry) => entry.dir === dir && entry.cmd === cmd).length
  );
  if (count('TX', -1) !== 1 || count('TX', 80) !== 1 || count('RX', -34) !== 1) {
    throw new RedactedProbeError(
      'traffic',
      'traffic không khớp đúng một TX -1, một TX 80 và một RX -34',
    );
  }
}

function printRedactedEvidence(
  args: ProbeArgs,
  snapshot: EnterWorldSnapshot,
  metadata: TxRxMetadata[],
): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    accountId: args.accountId,
    requested: { map: args.map, area: args.area },
    traffic: metadata,
    decode: 'ok',
    specialSectionEnd: snapshot.specialSectionEnd,
    totalBytes: snapshot.totalBytes,
    trailingBytes: snapshot.trailingBytes,
    specialCount: snapshot.specials.length,
    specialNames: snapshot.specials.map((special) => special.name),
  }, null, 2));
}

function redactedFailure(error: unknown): { section: string; offset: number; message: string } {
  if (error instanceof WorldDataDecodeError || error instanceof RedactedProbeError) {
    return {
      section: error.section,
      offset: error.offset,
      message: error.message,
    };
  }
  return {
    section: 'runtime',
    offset: -1,
    message: 'probe thất bại; chi tiết runtime đã được ẩn',
  };
}

async function runProbe(args: ProbeArgs, metadata: TxRxMetadata[]): Promise<void> {
  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig();
  } catch {
    throw new RedactedProbeError('config', 'cấu hình probe không hợp lệ hoặc thiếu');
  }
  await assertAvatarWebStopped(config.port);

  const db = openDb(config.dbPath);
  const client = new GameClient();
  const abort = new AbortController();
  const onTraffic = (entry: TrafficEntry): void => captureRelevantTraffic(metadata, entry);
  try {
    const row = getAccountById(db, args.accountId);
    if (!row) throw new RedactedProbeError('account', `không có account #${args.accountId}`);

    try {
      await client.login({
        host: row.host,
        port: row.port,
        user: row.gameUser,
        pass: readGamePass(db, config.masterKey, args.accountId),
        device: row.device,
      });
    } catch {
      throw new RedactedProbeError('login', 'không thể kết nối hoặc bắt đầu đăng nhập game');
    }
    await waitUntilOnline(client, 10_000);

    client.on('traffic', onTraffic);
    client.enterParkContext();
    await sleep(2_000);
    const pending = waitForDecodedSnapshot(client, abort.signal, 5_000);
    client.joinPark(args.map, args.area);
    const snapshot = await pending;
    if (snapshot.playerId <= 0) {
      throw new RedactedProbeError('header', 'playerId trong snapshot không hợp lệ', 1);
    }
    assertExpectedTraffic(metadata);
    printRedactedEvidence(args, snapshot, metadata);
  } finally {
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
try {
  args = parseArgs(process.argv.slice(2));
  await runProbe(args, metadata);
} catch (error) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    ...(args ? {
      accountId: args.accountId,
      requested: { map: args.map, area: args.area },
    } : {}),
    traffic: metadata,
    decode: 'error',
    ...redactedFailure(error),
  }, null, 2));
  process.exitCode = 1;
}
