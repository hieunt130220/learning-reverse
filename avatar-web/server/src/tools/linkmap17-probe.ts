/**
 * linkmap17-probe.ts — capture LinkMap17 dest roomIDs (3 cổng Khu ngoại ô).
 *
 * Spec: docs/superpowers/specs/2026-09-17-maplink-gates-design.md
 * User approve: "ok" live-capture LinkMap17 (2026-09-17).
 *
 * Flow (read-only, 1 phiên):
 *   login → park context → TX 90[17] → TX 80 join hub 17 →
 *   thu RX body trong POST_JOIN_CAPTURE_MS, parse LinkMap format đã decode
 *   (i32 w,h,count + count*(i16 dest, i32 gx,gy,dx,dy)) → logout.
 *
 * Whitelist TX sau login: -1, 90, 80 (+ -94 nội bộ client). Không sweep room.
 *
 * Chạy: npx tsx src/tools/linkmap17-probe.ts --account-id 3 --area 0
 */
import { get as httpGet } from 'node:http';
import { writeFileSync } from 'node:fs';

import { getAccountById, readGamePass } from '../accounts/repo.js';
import { loadConfig } from '../config.js';
import { openDb } from '../db/index.js';
import {
  GameClient,
  type ClientStatus,
  type TemporaryLoginRejection,
  type TrafficEntry,
} from '../game/client.js';
import type { Message } from '../proto/message.js';
import { NATIVE_PARK_JOIN_POSITIONS } from '../game/parkService.js';
import type { SessionCloseInfo } from '../proto/session.js';

interface ProbeArgs {
  accountId: number;
  area: number;
  /** Nếu =1: sau join hub, gửi 1 TX -22 REQUEST_TILE_MAP [i16 mapId] (shape mirror J2ME er_0.do(short)). */
  requestTileMap: 0 | 1;
}

type ProbePhase = 'login' | 'park-context' | 'board-list' | 'hub-join' | 'post-join-capture';

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
  closeKind?: SessionCloseInfo['kind'];
  hadError?: boolean;
}

interface LinkMapPortal {
  destMap: number;
  gateX: number;
  gateY: number;
  arriveX: number;
  arriveY: number;
}

interface LinkMapCandidate {
  cmd: number;
  len: number;
  w: number;
  h: number;
  count: number;
  portals: LinkMapPortal[];
  offset?: number;
  staticGateHits?: number;
}

const HUB_MAP = 17;
const ALLOWED = new Set(['--account-id', '--area', '--request-tile-map']);
const JOIN_TIMEOUT_MS = 7_000;
const BOARD_WAIT_MS = 1_500;
const POST_JOIN_CAPTURE_MS = 8_000;
/** Opcodes có tên tile/link/download trong bảng Unity + size LinkMap hay gặp. */
const CANDIDATE_CMDS = new Set([-20, -22, -73, -51, -12, -11, -10, -57]);
const LINKMAP_RECORD = 18;

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
  const values = new Map<string, number>();
  let i = 0;
  while (i < argv.length) {
    const key = argv[i]!;
    if (!ALLOWED.has(key)) {
      throw new RedactedProbeError('cli', 'key hoặc positional arg không được phép');
    }
    if (values.has(key)) {
      throw new RedactedProbeError('cli', `key CLI bị lặp: ${key}`);
    }
    const raw = argv[i + 1];
    if (raw === undefined || raw.startsWith('--')) {
      throw new RedactedProbeError('cli', `thiếu value cho ${key}`);
    }
    values.set(key, parseInteger(key, raw));
    i += 2;
  }
  for (const key of ['--account-id', '--area'] as const) {
    if (!values.has(key)) {
      throw new RedactedProbeError('cli', `thiếu key bắt buộc: ${key}`);
    }
  }
  const accountId = values.get('--account-id')!;
  const area = values.get('--area')!;
  const requestTileMap = (values.get('--request-tile-map') ?? 0) as 0 | 1;
  if (accountId <= 0) {
    throw new RedactedProbeError('cli', '--account-id phải là số nguyên dương');
  }
  if (area < -128 || area > 127) {
    throw new RedactedProbeError('cli', '--area phải nằm trong signed-byte -128..127');
  }
  if (requestTileMap !== 0 && requestTileMap !== 1) {
    throw new RedactedProbeError('cli', '--request-tile-map phải là 0 hoặc 1');
  }
  if (NATIVE_PARK_JOIN_POSITIONS[HUB_MAP] === undefined) {
    throw new RedactedProbeError('cli', `thiếu tọa độ native đã verify cho hub ${HUB_MAP}`);
  }
  return { accountId, area, requestTileMap };
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
    const request = httpGet(
      { host: '127.0.0.1', port, path: '/api/auth/me', timeout: 750 },
      (response) => {
        response.resume();
        finish(new RedactedProbeError('health', 'hãy dừng Avatar Web server trước khi probe'));
        request.destroy();
      },
    );
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
      finish(new RedactedProbeError('health', `health-check localhost thất bại (${error.code ?? 'UNKNOWN'})`));
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
        reject(new RedactedProbeError('login', 'hết giờ kết nối hoặc bắt đầu đăng nhập game'));
      }
    }, timeoutMs);
  });
  try {
    await Promise.race([client.login(options), timeout]);
  } catch (error) {
    if (error instanceof RedactedProbeError) throw error;
    throw new RedactedProbeError('login', 'không thể kết nối hoặc bắt đầu đăng nhập game');
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function waitUntilOnline(client: GameClient, timeoutMs: number): Promise<void> {
  if (client.status === 'online') return Promise.resolve();
  if (client.status === 'error' || client.status === 'idle') {
    return Promise.reject(
      new RedactedProbeError('login', `game client không online (status=${client.status})`),
    );
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
      reject(error instanceof RedactedProbeError ? error : new RedactedProbeError('handler', 'không nhận được ACK handler Park'));
    };
    const onMessage = (msg: Message): void => {
      if (msg.command !== -1) return;
      const body = msg.getData();
      if (body.length !== 1 || body.readInt8(0) !== 9) return;
      finishResolve();
    };
    const onAbort = (): void => finishReject(new RedactedProbeError('handler', 'chờ ACK handler bị hủy'));
    client.session.on('message', onMessage);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      finishReject(new RedactedProbeError('handler', 'hết giờ chờ ACK handler Park'));
    }, timeoutMs);
    if (signal.aborted) onAbort();
  });
}

function waitForJoinPrefix(
  client: GameClient,
  signal: AbortSignal,
  expectedRoom: number,
  expectedBoard: number,
  timeoutMs: number,
): Promise<{ status: 'joined' | 'timeout' | 'mismatch'; roomId: number | null; boardId: number | null; x: number | null; y: number | null; responseBytes: number | null }> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      signal.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
    };
    const finish = (value: { status: 'joined' | 'timeout' | 'mismatch'; roomId: number | null; boardId: number | null; x: number | null; y: number | null; responseBytes: number | null }): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const onMessage = (msg: Message): void => {
      if (msg.command !== 80) return;
      const body = msg.getData();
      if (body.length < 6) {
        finish({ status: 'mismatch', roomId: null, boardId: null, x: null, y: null, responseBytes: body.length });
        return;
      }
      const roomId = body.readInt8(0);
      const boardId = body.readInt8(1);
      const x = body.readInt16BE(2);
      const y = body.readInt16BE(4);
      finish({
        status: roomId === expectedRoom && boardId === expectedBoard ? 'joined' : 'mismatch',
        roomId,
        boardId,
        x,
        y,
        responseBytes: body.length,
      });
    };
    const onAbort = (): void => {
      finish({ status: 'timeout', roomId: null, boardId: null, x: null, y: null, responseBytes: null });
    };
    client.session.on('message', onMessage);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      finish({ status: 'timeout', roomId: null, boardId: null, x: null, y: null, responseBytes: null });
    }, timeoutMs);
    if (signal.aborted) onAbort();
  });
}

/**
 * LinkMap format đã verify trên 8 asset LinkMap* trong APK:
 *   i32 w, i32 h, i32 count, count * (i16 destMap, i32 gateX, i32 gateY, i32 arriveX, i32 arriveY)
 */
function tryParseLinkMap(buf: Buffer): Omit<LinkMapCandidate, 'cmd' | 'len'> | null {
  if (buf.length < 12) return null;
  const w = buf.readInt32BE(0);
  const h = buf.readInt32BE(4);
  const count = buf.readInt32BE(8);
  if (!Number.isFinite(w) || !Number.isFinite(h) || !Number.isFinite(count)) return null;
  if (w <= 0 || w > 2000 || h <= 0 || h > 2000) return null;
  if (count < 0 || count > 32) return null;
  if (buf.length !== 12 + count * LINKMAP_RECORD) return null;
  const portals: LinkMapPortal[] = [];
  for (let i = 0; i < count; i++) {
    const off = 12 + i * LINKMAP_RECORD;
    const destMap = buf.readInt16BE(off);
    const gateX = buf.readInt32BE(off + 2);
    const gateY = buf.readInt32BE(off + 6);
    const arriveX = buf.readInt32BE(off + 10);
    const arriveY = buf.readInt32BE(off + 14);
    if (destMap < -128 || destMap > 255) return null;
    portals.push({ destMap, gateX, gateY, arriveX, arriveY });
  }
  return { w, h, count, portals };
}

/** Gợi ý size LinkMap hợp lệ kể cả khi prefix khác 12-byte header. */
function looksLikeLinkMapLength(len: number): boolean {
  if (len < 12) return false;
  return (len - 12) % LINKMAP_RECORD === 0 && (len - 12) / LINKMAP_RECORD <= 32;
}

function redactedFailure(error: unknown): { section: string; offset: number; message: string } {
  if (error instanceof RedactedProbeError) {
    return { section: error.section, offset: error.offset, message: error.message };
  }
  return { section: 'runtime', offset: -1, message: 'probe thất bại; chi tiết runtime đã được ẩn' };
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
    throw new RedactedProbeError('config', 'cấu hình probe không hợp lệ hoặc thiếu');
  }
  await assertAvatarWebStopped(config.port);

  const hubPos = NATIVE_PARK_JOIN_POSITIONS[HUB_MAP]!;
  const db = openDb(config.dbPath);
  const client = new GameClient();
  const abort = new AbortController();
  let phase: ProbePhase = 'login';
  const candidates: LinkMapCandidate[] = [];
  const rxAfterJoin: Array<{
    cmd: number;
    len: number;
    parsed: boolean;
    beI32?: number[];
    beI16?: number[];
  }> = [];

  const onTraffic = (entry: TrafficEntry): void => {
    metadata.push({ phase, dir: entry.dir === 'tx' ? 'TX' : 'RX', cmd: entry.cmd, len: entry.len });
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

  const onRxCapture = (msg: Message): void => {
    if (phase !== 'hub-join' && phase !== 'post-join-capture') return;
    const body = Buffer.from(msg.getData());
    const cmd = msg.command;
    const isCandidateCmd = CANDIDATE_CMDS.has(cmd) || looksLikeLinkMapLength(body.length);
    if (!isCandidateCmd) return;
    const parsed = tryParseLinkMap(body);
    /** Chỉ int/BE — không string/credential. Dùng để chẩn đoán shape. */
    const beI32 = Array.from({ length: Math.floor(body.length / 4) }, (_, i) => body.readInt32BE(i * 4));
    const beI16 = Array.from({ length: Math.floor(body.length / 2) }, (_, i) => body.readInt16BE(i * 2));
    rxAfterJoin.push({
      cmd,
      len: body.length,
      parsed: parsed !== null,
      beI32: beI32.slice(0, 24),
      beI16: beI16.slice(0, 24),
    });
    if (parsed) {
      candidates.push({ cmd, len: body.length, ...parsed });
    }
    // Lưu body RX -22 để phân tích offline (map tile, không credential).
    if (cmd === -22 && body.length > 64) {
      try {
        writeFileSync(`/tmp/rx22-map17-${Date.now()}.bin`, body);
      } catch {
        /* best-effort */
      }
    }
    // Sliding-window search: LinkMap header có thể nằm sau prefix tile-map.
    for (let off = 0; off + 12 <= body.length; off++) {
      const w = body.readInt32BE(off);
      const h = body.readInt32BE(off + 4);
      const count = body.readInt32BE(off + 8);
      if (w < 50 || w > 800 || h < 30 || h > 200 || count < 1 || count > 8) continue;
      if (off + 12 + count * LINKMAP_RECORD > body.length) continue;
      const portals: LinkMapPortal[] = [];
      let ok = true;
      for (let i = 0; i < count; i++) {
        const p = off + 12 + i * LINKMAP_RECORD;
        const destMap = body.readInt16BE(p);
        const gateX = body.readInt32BE(p + 2);
        const gateY = body.readInt32BE(p + 6);
        const arriveX = body.readInt32BE(p + 10);
        const arriveY = body.readInt32BE(p + 14);
        if (destMap < 0 || destMap > 200 || gateX < 0 || gateX > w || gateY < 0 || gateY > h + 20) {
          ok = false;
          break;
        }
        portals.push({ destMap, gateX, gateY, arriveX, arriveY });
      }
      if (!ok) continue;
      // Ưu tiên match cổng map 17 đã static: gate y≈70, x∈{120,130,140}
      const hitsStatic = portals.filter(
        (p) => Math.abs(p.gateY - 70) <= 10 && [120, 130, 140].some((gx) => Math.abs(p.gateX - gx) <= 10),
      ).length;
      candidates.push({
        cmd,
        len: body.length,
        w,
        h,
        count,
        portals,
        offset: off,
        staticGateHits: hitsStatic,
      });
      break; // lấy window đầu tiên match
    }
  };

  client.on('traffic', onTraffic);
  client.on('dialog', onDialog);
  client.on('temporary-rejection', onTemporaryRejection);
  client.on('status', onStatus);
  client.session.on('closed', onClosed);
  client.session.on('message', onRxCapture);

  try {
    const row = getAccountById(db, args.accountId);
    if (!row) throw new RedactedProbeError('account', `không có account #${args.accountId}`);

    await loginWithTimeout(
      client,
      {
        host: row.host,
        port: row.port,
        user: row.gameUser,
        pass: readGamePass(db, config.masterKey, args.accountId),
        device: row.device,
      },
      25_000,
    );
    await waitUntilOnline(client, 20_000);

    phase = 'park-context';
    const handlerPending = waitForParkHandlerResponse(client, abort.signal, 5_000);
    client.enterParkContext();
    await handlerPending;

    phase = 'board-list';
    client.sendRaw(90, [{ t: 'i8', v: String(HUB_MAP) }]);
    await new Promise<void>((resolve) => setTimeout(resolve, BOARD_WAIT_MS));

    phase = 'hub-join';
    const joinPending = waitForJoinPrefix(client, abort.signal, HUB_MAP, args.area, JOIN_TIMEOUT_MS);
    client.sendRaw(80, [
      { t: 'i8', v: String(HUB_MAP) },
      { t: 'i8', v: String(args.area) },
      { t: 'i16', v: String(hubPos.x) },
      { t: 'i16', v: String(hubPos.y) },
    ]);
    const hubJoin = await joinPending;
    if (hubJoin.status !== 'joined') {
      throw new RedactedProbeError('hub-join', `join hub 17 thất bại (status=${hubJoin.status})`);
    }

    let tileMapRequest: { sent: boolean; cmd: number; mapId: number } = { sent: false, cmd: -22, mapId: HUB_MAP };
    if (args.requestTileMap === 1) {
      // Mirror J2ME er_0.do(short): cmd -22 REQUEST_TILE_MAP + i16 mapId.
      // Đúng 1 TX, không retry.
      phase = 'post-join-capture';
      client.sendRaw(-22, [{ t: 'i16', v: String(HUB_MAP) }]);
      tileMapRequest = { sent: true, cmd: -22, mapId: HUB_MAP };
    }

    phase = 'post-join-capture';
    await new Promise<void>((resolve) => setTimeout(resolve, POST_JOIN_CAPTURE_MS));

    for (const entry of metadata) {
      if (entry.phase === 'login') continue;
      if (
        entry.dir === 'TX' &&
        entry.cmd !== -1 &&
        entry.cmd !== 90 &&
        entry.cmd !== 80 &&
        entry.cmd !== -94 &&
        !(args.requestTileMap === 1 && entry.cmd === -22)
      ) {
        throw new RedactedProbeError('traffic', `phát hiện TX ngoài whitelist: ${entry.cmd}`);
      }
    }
    const tx80 = metadata.filter((e) => e.phase === 'hub-join' && e.dir === 'TX' && e.cmd === 80).length;
    if (tx80 !== 1) {
      throw new RedactedProbeError('traffic', `số TX 80 hub-join phải đúng 1 (thấy ${tx80})`);
    }

    console.log(
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          accountId: args.accountId,
          mode: 'capture-linkmap17',
          hubJoin: {
            status: hubJoin.status,
            roomId: hubJoin.roomId,
            boardId: hubJoin.boardId,
            x: hubJoin.x,
            y: hubJoin.y,
            responseBytes: hubJoin.responseBytes,
          },
          tileMapRequest,
          rxAfterJoinCandidates: rxAfterJoin,
          linkMaps: candidates,
          traffic: metadata,
          events,
          decode:
            candidates.length > 0
              ? 'linkmap-parsed'
              : rxAfterJoin.length > 0
                ? 'rx-captured-no-linkmap-shape'
                : 'no-candidate-rx',
        },
        null,
        2,
      ),
    );
  } finally {
    client.session.removeListener('message', onRxCapture);
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
  console.error(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        ...(args ? { accountId: args.accountId, requested: { area: args.area } } : {}),
        traffic: metadata,
        events,
        decode: 'error',
        ...redactedFailure(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
