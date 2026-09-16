/**
 * maze-probe.ts — công cụ probe chuyên biệt cho Mê cung (Map 28) trong Avatar HD.
 *
 * Nhiệm vụ:
 * 1. Kiểm tra trạng thái mở cửa của Mê cung (bắt thoại RX -40 / RX -62 khi đóng cửa).
 * 2. Giải mã snapshot RX 80 và các gói RX 48 để lập danh mục các Rương kho báu (ItemMapSpecial).
 * 3. Hỗ trợ cờ tùy chọn --open-chest <id> [--action-index <N>] để gửi TX 48 [i8 3, i32 id, i8 actionIndex]
 *    và ghi lại quà tặng RX 47 / RX -62 sau khi xác thực rương tồn tại trong danh mục.
 *
 * Chạy: node --env-file=.env --import tsx src/tools/maze-probe.ts --account-id <N> [--area <A>] [--open-chest <id>] [--action-index <N>] [--output <text|json>]
 */
import { get as httpGet } from 'node:http';

import { getAccountById, readGamePass } from '../accounts/repo.js';
import { loadConfig } from '../config.js';
import { openDb } from '../db/index.js';
import {
  GameClient,
  type ClientStatus,
} from '../game/client.js';
import { findMazePath } from '../game/mazePathfinding.js';
import { NATIVE_PARK_JOIN_POSITIONS } from '../game/parkService.js';
import { decodeCustomTabPacket } from '../game/progressQuests.js';
import type { Message } from '../proto/message.js';
import { MyReader } from '../proto/reader.js';

interface ProbeArgs {
  accountId: number;
  area: number;
  openChestId?: number;
  autoNavigate: boolean;
  actionIndex: number;
  outputFormat: 'text' | 'json';
}

interface ChestObject {
  id: number;
  name: string;
  x: number;
  y: number;
  type: number;
  touch: number[];
  block: number[];
  imageCount: number;
  imageIds?: number[];
  menuIds: number[];
}

interface GiftDrop {
  subType: number;
  typeDrop?: number;
  idDrop?: number;
  idGift: number;
  idPlayer?: number;
  xDrop?: number;
  yDrop?: number;

}

interface MazeProbeResult {
  timestamp: string;
  accountId: number;
  map: number;
  area: number;
  status: 'open' | 'closed' | 'error';
  message?: string;
  chests: ChestObject[];
  allSpecials: ChestObject[];
  navigationResult?: {
    attempted: boolean;
    targetChestId?: number;
    pathLength: number;
    stepsWalked: number;
    giftsPickedUp: number[];
  };
  openResult?: {
    chestId: number;
    removed: boolean;
    attempted: boolean;
    sent: boolean;
    causality: 'unknown';
    observationStatus: 'window-ended';
    gifts: GiftDrop[];
    dialogs: string[];
  };
}

interface ParkJoinSnapshot {
  roomId: number;
  boardId: number;
  x: number;
  y: number;
  specials: ChestObject[];
}

function parseArgs(argv: string[]): ProbeArgs {
  let accountId: number | undefined;
  let area = 0;
  let openChestId: number | undefined;
  let autoNavigate = false;
  let actionIndex = 0;
  let outputFormat: 'text' | 'json' = 'text';

  const seen = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]!;
    if (seen.has(flag)) throw new Error("duplicate-cli");
    seen.add(flag);

    const getNextValue = (): string => {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        throw new Error('Cờ thiếu giá trị');
      }
      i++;
      return next;
    };

    if (flag === '--account-id') {
      const valStr = getNextValue();
      if (!/^[1-9]\d*$/.test(valStr)) {
        throw new Error('--account-id phải là số nguyên dương');
      }
      const val = Number(valStr);
      if (!Number.isSafeInteger(val) || val <= 0) {
        throw new Error('--account-id phải là số nguyên dương');
      }
      accountId = val;
    } else if (flag === '--area') {
      const valStr = getNextValue();
      if (!/^\d+$/.test(valStr)) {
        throw new Error('--area phải là số nguyên trong khoảng 0..50');
      }
      const val = Number(valStr);
      if (!Number.isSafeInteger(val) || val < 0 || val > 50) {
        throw new Error('--area phải trong khoảng 0..50');
      }
      area = val;
    } else if (flag === '--open-chest') {
      const valStr = getNextValue();
      if (!/^-?\d+$/.test(valStr)) {
        throw new Error('--open-chest phải là số nguyên 32-bit (signed i32)');
      }
      const val = Number(valStr);
      if (!Number.isSafeInteger(val) || val < -2147483648 || val > 2147483647) {
        throw new Error('--open-chest phải là số nguyên 32-bit (signed i32)');
      }
      openChestId = val;
    } else if (flag === '--auto-navigate') {
      autoNavigate = true;
    } else if (flag === '--action-index') {
      const valStr = getNextValue();
      if (!/^\d+$/.test(valStr)) {
        throw new Error('--action-index phải là số nguyên trong khoảng 0..127');
      }
      const val = Number(valStr);
      if (!Number.isSafeInteger(val) || val < 0 || val > 127) {
        throw new Error('--action-index phải là số nguyên trong khoảng 0..127');
      }
      actionIndex = val;
    } else if (flag === '--output') {
      const valStr = getNextValue();
      if (valStr !== 'text' && valStr !== 'json') {
        throw new Error('--output phải là "text" hoặc "json"');
      }
      outputFormat = valStr;
    } else {
      throw new Error('Cờ không hợp lệ');
    }
  }

  if (accountId === undefined) {
    throw new Error('--account-id là bắt buộc (phải là số nguyên dương)');
  }

  return { accountId, area, openChestId, autoNavigate, actionIndex, outputFormat };
}

async function assertAvatarWebStopped(port: number): Promise<void> {
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

    const request = httpGet(
      {
        host: '127.0.0.1',
        port,
        path: '/api/auth/me',
        timeout: 750,
      },
      (response) => {
        response.resume();
        finish(
          new Error(
            `avatar-web đang chạy tại port ${port} (HTTP ${response.statusCode}); hãy dừng server trước khi probe`,
          ),
        );
        request.destroy();
      },
    );

    request.once('timeout', () => {
      request.destroy();
      finish(
        new Error(
          `Health-check tới port ${port} bị timeout (>750ms); từ chối probe`,
        ),
      );
    });

    request.once('error', (error: NodeJS.ErrnoException) => {
      if (settled) return;
      if (error.code === 'ECONNREFUSED') {
        finish();
        return;
      }
      finish(
        new Error(
          `Health-check localhost thất bại (${error.code ?? 'UNKNOWN'}); từ chối probe`,
        ),
      );
    });
  });
}

async function loginWithTimeout(
  client: GameClient,
  options: Parameters<GameClient['login']>[0],
  timeoutMs: number,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  let onAbort: () => void = () => {};
  const timeout = new Promise<never>((_, reject) => {
    onAbort = (): void => {
      if (timer) clearTimeout(timer);
      reject(new Error('aborted'));
    };
    abort.signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      reject(new Error('Hết giờ kết nối hoặc bắt đầu đăng nhập game'));
    }, timeoutMs);
  });
  try {
    if (abort.signal.aborted) {
      onAbort();
      await timeout;
      return;
    }
    const login = client.login(options);
    await Promise.race([login, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    abort.signal.removeEventListener('abort', onAbort);
  }
}

function waitUntilOnline(client: GameClient, timeoutMs: number): Promise<void> {
  if (client.status === 'online') return Promise.resolve();
  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      if (timer) clearTimeout(timer);
      abort.signal.removeEventListener('abort', onAbort);
      client.removeListener('status', onStatus);
    };
    const onStatus = (status: ClientStatus): void => {
      if (status === 'online') {
        cleanup();
        resolve();
      } else if (status === 'error' || status === 'idle') {
        cleanup();
        reject(new Error(`Game client không online (status=${status})`));
      }
    };
    timer = setTimeout(() => {
      cleanup();
      reject(new Error('Hết giờ chờ game client online'));
    }, timeoutMs);
    const onAbort = (): void => { cleanup(); reject(new Error('aborted')); };
    abort.signal.addEventListener('abort', onAbort, { once: true });
    client.on('status', onStatus);
  });
}

function waitForParkHandlerResponse(
  client: GameClient,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      abort.signal.removeEventListener('abort', onAbort);
      client.session.removeListener('message', onMessage);
      if (timer) clearTimeout(timer);
    };
    const finishResolve = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const finishReject = (err: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const onMessage = (msg: Message): void => {
      if (msg.command !== -1) return;
      const body = msg.getData();
      if (body.length === 1 && body.readInt8(0) === 9) {
        finishResolve();
      }
    };
    const onAbort = (): void => { cleanup(); reject(new Error('aborted')); };
    abort.signal.addEventListener('abort', onAbort, { once: true });
    client.session.on('message', onMessage);
    timer = setTimeout(() => {
      finishReject(new Error('Hết giờ chờ ACK handler Park (RX -1 [9])'));
    }, timeoutMs);
  });
}

function waitForParkBoardList(
  client: GameClient,
  area: number,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      abort.signal.removeEventListener('abort', onAbort);
      client.session.removeListener('message', onMessage);
      if (timer) clearTimeout(timer);
    };
    const finishResolve = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const finishReject = (err: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const onMessage = (msg: Message): void => {
      if (msg.command === 90) {
        const body = msg.getData();
        if (!body.length || body.readInt8(0) < 0 || body.length !== 1 + body.readInt8(0)) {
          finishReject(new Error('invalid-board-list')); return;
        }
        if (area >= body.readInt8(0)) {
          finishReject(new Error('requested-area-unavailable')); return;
        }
        finishResolve();
      }
    };
    const onAbort = (): void => { cleanup(); reject(new Error('aborted')); };
    abort.signal.addEventListener('abort', onAbort, { once: true });
    client.session.on('message', onMessage);
    timer = setTimeout(() => {
      finishReject(new Error('Hết giờ chờ danh sách khu (RX 90)'));
    }, timeoutMs);
  });
}

function readNativeCount(reader: MyReader): number {
  if (reader.available() < 1) throw new Error('Thiếu count');
  const raw = reader.readByte();
  return raw < 0 ? 0 : raw;
}

function readNativeUtf(reader: MyReader): string {
  if (reader.available() < 2) throw new Error('Thiếu UTF');
  const len = reader.readUnsignedShort();
  if (len > 8192 || reader.available() < len) throw new Error('UTF không hợp lệ');
  return reader.readBytes(len).toString('utf8');
}

function isMazeClosureMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('mê cung') && lower.includes('đóng cửa')
  );
}

function readItemMapSpecial(reader: MyReader): ChestObject | null {
  if (reader.available() < 4) return null;
  const id = reader.readInt();
  const name = readNativeUtf(reader);
  if (reader.available() < 8) return null;
  const x = reader.readInt();
  const y = reader.readInt();
  if (reader.available() < 1) return null;
  const type = reader.readByte();
  if (reader.available() < 1) return null;
  const imgCount = readNativeCount(reader);
  if (imgCount < 0 || imgCount > 64 || reader.available() < imgCount * 2) return null;
  const imageIds: number[] = [];
  for (let i = 0; i < imgCount; i++) {
    imageIds.push(reader.readShort());
  }
  if (reader.available() < 8 * 4) return null;
  const touch = Array.from({ length: 4 }, () => reader.readInt());
  const block = Array.from({ length: 4 }, () => reader.readInt());
  if (reader.available() < 1) return null;
  const menuCount = readNativeCount(reader);
  if (menuCount < 0 || menuCount > 64 || reader.available() < menuCount * 2) return null;
  const menuIds: number[] = [];
  for (let m = 0; m < menuCount; m++) {
    menuIds.push(reader.readShort());
  }
  return { id, name, x, y, type, touch, block, imageCount: imgCount, imageIds, menuIds };
}

function decodeParkJoinSnapshot(body: Buffer): ParkJoinSnapshot | null {
  try {
    const r = new MyReader(body);
    if (r.available() < 2) return null;
    const roomId = r.readByte();
    const boardId = r.readByte();
    if (r.available() < 4) return null;
    const x = r.readShort();
    const y = r.readShort();

    // List player
    const playerCount = readNativeCount(r);
    for (let p = 0; p < playerCount; p++) {
      if (r.available() < 4) return null;
      r.readBytes(4); // id
      readNativeUtf(r); // name
      const parts = readNativeCount(r);
      if (r.available() < parts * 2) return null;
      r.readBytes(parts * 2);
      if (r.available() < 18) return null;
      r.readBytes(18); // state
    }

    // Drop parts
    const dropCount = readNativeCount(r);
    if (r.available() < dropCount * 11) return null;
    r.readBytes(dropCount * 11);

    // Map marker + items (Match mining-probe.ts:768-784 and worldData.ts:255-285)
    if (r.available() >= 2) {
      const mapMarker = r.readShort();
      if (mapMarker >= 1) {
        if (r.available() >= 1) {
          const itemTypeCount = readNativeCount(r);
          for (let t = 0; t < itemTypeCount; t++) {
            if (r.available() < 8) return null;
            r.readBytes(8);
            const notTrans = readNativeCount(r);
            if (r.available() < notTrans * 2) return null;
            r.readBytes(notTrans * 2);
          }
        }
        if (r.available() >= 1) {
          const itemCount = readNativeCount(r);
          if (r.available() < itemCount * 4) return null;
          r.readBytes(itemCount * 4);
        }
      }
    }

    // Anim templates
    if (r.available() >= 1) {
      const animCount = readNativeCount(r);
      if (animCount > 0) {
        if (r.available() < animCount * 10) return null;
        r.readBytes(animCount * 10);
      }
    }

    // ItemMapSpecial (Specials / Chests)
    const specials: ChestObject[] = [];
    if (r.available() >= 1) {
      const specialCount = readNativeCount(r);
      for (let s = 0; s < specialCount; s++) {
        const obj = readItemMapSpecial(r);
        if (!obj) return null;
        specials.push(obj);
      }
    }

    return { roomId, boardId, x, y, specials };
  } catch {
    return null;
  }
}

function decodeGiftPacket(body: Buffer): GiftDrop {
  const r = new MyReader(body);
  const subType = r.available() >= 1 ? r.readByte() : -1;


  if (subType === 0) {
    // Ground drop: [i8 0][i8 typeDrop][i16 idDrop][i32 idGift][i32 idPlayer][i16 xDrop][i16 yDrop]
    const typeDrop = r.available() >= 1 ? r.readByte() : undefined;
    const idDrop = r.available() >= 2 ? r.readShort() : undefined;
    const idGift = r.available() >= 4 ? r.readInt() : -1;
    const idPlayer = r.available() >= 4 ? r.readInt() : undefined;
    const xDrop = r.available() >= 2 ? r.readShort() : undefined;
    const yDrop = r.available() >= 2 ? r.readShort() : undefined;
    return { subType, typeDrop, idDrop, idGift, idPlayer, xDrop, yDrop };
  }

  if (subType === 10) {
    // Direct award: [i8 10][i8 type][i16 idImg][i32 idGift][i32 idPlayer]
    const typeDrop = r.available() >= 1 ? r.readByte() : undefined;
    const idDrop = r.available() >= 2 ? r.readShort() : undefined; // idImg
    const idGift = r.available() >= 4 ? r.readInt() : -1;
    const idPlayer = r.available() >= 4 ? r.readInt() : undefined;
    return { subType, typeDrop, idDrop, idGift, idPlayer };
  }

  // Fallback decode for subType != 0 && != 10: idGift i32, idPlayer i32
  const idGift = r.available() >= 4 ? r.readInt() : -1;
  const idPlayer = r.available() >= 4 ? r.readInt() : undefined;
  return { subType, idGift, idPlayer };
}

function waitForParkJoinOrClosure(
  client: GameClient,
  area: number,
  timeoutMs: number,
): Promise<{ status: 'open' | 'closed'; snapshot?: ParkJoinSnapshot; closedMessage?: string }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;

    const cleanup = (): void => {
      abort.signal.removeEventListener('abort', onAbort);
      client.session.removeListener('message', onMessage);
      if (timer) clearTimeout(timer);
    };

    const finishResolve = (val: { status: 'open' | 'closed'; snapshot?: ParkJoinSnapshot; closedMessage?: string }): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(val);
    };

    const finishReject = (err: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const onMessage = (msg: Message): void => {
      const body = Buffer.from(msg.getData());

      if (msg.command === 80) {
        const snapshot = decodeParkJoinSnapshot(body);
        if (snapshot && snapshot.roomId === 28 && snapshot.boardId === area) {
          finishResolve({ status: 'open', snapshot });
        }
      } else if (msg.command === -40) {
        try {
          const r = new MyReader(body);
          const text = readNativeUtf(r);
          if (text && isMazeClosureMessage(text)) {
            finishResolve({ status: 'closed', closedMessage: text });
          }
        } catch {}
      } else if (msg.command === -62) {
        try {
          const tab = decodeCustomTabPacket(body);
          const text = [tab.title, tab.content].filter(Boolean).join(': ');
          if (text && isMazeClosureMessage(text)) {
            finishResolve({ status: 'closed', closedMessage: text });
          }
        } catch {}
      }
    };

    const onAbort = (): void => { cleanup(); reject(new Error('aborted')); };
    abort.signal.addEventListener('abort', onAbort, { once: true });
    client.session.on('message', onMessage);
    timer = setTimeout(() => {
      finishReject(new Error('Hết giờ chờ phản hồi vào Mê cung (RX 80 / RX -40)'));
    }, timeoutMs);
  });
}

const abort = new AbortController();
function bounded<T>(work: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const onAbort = (): void => { cleanup(); reject(new Error('aborted')); };
    const cleanup = (): void => abort.signal.removeEventListener('abort', onAbort);
    abort.signal.addEventListener('abort', onAbort, { once: true });
    work.then((value) => { cleanup(); resolve(value); }, () => { cleanup(); reject(new Error('stage-failed')); });
    if (abort.signal.aborted) onAbort();
  });
}
function observeFor(timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      clearTimeout(timer);
      abort.signal.removeEventListener('abort', onAbort);
    };
    const onAbort = (): void => { cleanup(); reject(new Error('aborted')); };
    const timer = setTimeout(() => { cleanup(); resolve(); }, timeoutMs);
    abort.signal.addEventListener('abort', onAbort, { once: true });
    if (abort.signal.aborted) onAbort();
  });
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  await assertAvatarWebStopped(config.port);

  let db: ReturnType<typeof openDb> | undefined;
  let client: GameClient | undefined;

  const dialogMessages: string[] = [];
  const capturedGifts: GiftDrop[] = [];
  const currentSpecials = new Map<number, ChestObject>();
  const state: {
    status: 'open' | 'closed' | 'error';
    closedMessage?: string;
    removedChestIds: Set<number>;
    hasSentOpenChest: boolean;
    isJoinPending: boolean;
  } = {
    status: 'error',
    removedChestIds: new Set<number>(),
    hasSentOpenChest: false,
    isJoinPending: false,
  };

  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    abort.abort();
    try { client?.logout(); } catch {}
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  let phase = 'login';
  let permit: { command: number; body: Buffer } | undefined;
  try {
    db = openDb(config.dbPath);
    const account = getAccountById(db, args.accountId);
    if (!account) throw new Error(`Không tìm thấy account ID ${args.accountId}`);
    const pass = readGamePass(db, config.masterKey, args.accountId);

    client = new GameClient();
    client.session.on('closed', stop);
    client.session.on('error', stop);
    const nativeSend = client.session.send.bind(client.session);
    const loginCommands = new Set([-27, -1, -47, -79, -87, -33, -94]);
    client.session.send = (message: Message): void => {
      const body = message.getData();
      let allowed = false;
      if (phase === 'login' && loginCommands.has(message.command)) {
        allowed = message.command !== -1 || body.equals(Buffer.from([8]));
        if (message.command === -87) allowed = body.equals(Buffer.from([1]));
        if (message.command === -27) allowed = body.length === 0;
        if (message.command === -94) {
          allowed = body.length === 4 && client?.playerId !== undefined
            && body.readInt32BE(0) === client.playerId;
        }
        loginCommands.delete(message.command);
      } else if (phase === 'navigate' && message.command === 84 && body.length === 5) {
        allowed = true;
      } else if (phase === 'navigate' && message.command === 47 && body.length === 5 && body.readInt8(0) === 11) {
        allowed = true;
      } else if (permit && permit.command === message.command && permit.body.equals(body)) {
        allowed = true;
        permit = undefined;
      }
      if (!allowed || abort.signal.aborted) { stop(); return; }
      nativeSend(message);
    };

    client.session.on('message', (msg: Message) => {
      const body = Buffer.from(msg.getData());

      if (msg.command === -40) {
        try {
          const r = new MyReader(body);
          const text = readNativeUtf(r);
          if (text) {
            if (state.hasSentOpenChest && state.status === 'open') dialogMessages.push(text);
            if (state.isJoinPending && isMazeClosureMessage(text)) {
              state.status = 'closed';
              state.closedMessage = text;
              state.isJoinPending = false;
            }
          }
        } catch {}
      } else if (msg.command === -62) {
        try {
          const tab = decodeCustomTabPacket(body);
          const text = [tab.title, tab.content].filter(Boolean).join(': ');
          if (text) {
            if (state.hasSentOpenChest && state.status === 'open') dialogMessages.push(text);
            if (state.isJoinPending && isMazeClosureMessage(text)) {
              state.status = 'closed';
              state.closedMessage = text;
              state.isJoinPending = false;
            }
          }
        } catch {}
      } else if (msg.command === 80) {
        const snapshot = decodeParkJoinSnapshot(body);
        if (state.status === 'open') { currentSpecials.clear(); state.status = 'error'; stop(); return; }
        if (snapshot && snapshot.roomId === 28 && snapshot.boardId === args.area) {
          if (!state.isJoinPending) return;
          state.status = 'open';
          state.isJoinPending = false;
          currentSpecials.clear();
          for (const s of snapshot.specials) {
            currentSpecials.set(s.id, s);
          }
        }
      } else if (msg.command === 48 && state.status === 'open') {
        try {
          const r = new MyReader(body);
          if (r.available() >= 1) {
            const mode = r.readByte();
            if (mode === 2 && r.available() >= 4) {
              const removedId = r.readInt();
              currentSpecials.delete(removedId);
              state.removedChestIds.add(removedId);
            } else if (mode === 0 || mode === 1) {
              const obj = readItemMapSpecial(r);
              if (obj) {
                currentSpecials.set(obj.id, obj);
                state.removedChestIds.delete(obj.id);
              }
            }
          }
        } catch {}
      } else if (msg.command === 47 && (state.hasSentOpenChest || args.autoNavigate) && state.status === 'open') {
        try {
          capturedGifts.push(decodeGiftPacket(body));
        } catch {}
      }
    });

    if (args.outputFormat === 'text') {
      console.log(`[AUTH] Kết nối và đăng nhập account ID: ${args.accountId}...`);
    }
    await bounded(loginWithTimeout(
      client,
      {
        host: account.host,
        port: account.port,
        user: account.gameUser,
        pass,
        device: account.device,
      },
      25_000,
    ));
    await bounded(waitUntilOnline(client, 20_000));
    phase = 'park';
    permit = { command: -1, body: Buffer.from([9]) };

    if (args.outputFormat === 'text') {
      console.log('[PARK] Chuyển context Park (client.enterParkContext())...');
    }
    const handlerPending = waitForParkHandlerResponse(client, 5_000);
    client.enterParkContext();
    await handlerPending;

    if (args.outputFormat === 'text') {
      console.log('[PARK] Yêu cầu danh sách khu Mê cung (TX 90 [i8 28])...');
    }
    const boardListPending = waitForParkBoardList(client, args.area, 5_000);
    permit = { command: 90, body: Buffer.from([28]) };
    client.sendRaw(90, [{ t: 'i8', v: '28' }]);
    await boardListPending;

    const pos = NATIVE_PARK_JOIN_POSITIONS[28] ?? { x: 57, y: 209 };
    if (args.outputFormat === 'text') {
      console.log(`[MAZE] Vào Mê cung Map 28 khu ${args.area} tọa độ (${pos.x}, ${pos.y}) [TX 80]...`);
    }
    state.isJoinPending = true;
    const joinPending = waitForParkJoinOrClosure(client, args.area, 7_000);
    const joinBody = Buffer.alloc(6);
    joinBody.writeInt8(28); joinBody.writeInt8(args.area, 1);
    joinBody.writeInt16BE(pos.x, 2); joinBody.writeInt16BE(pos.y, 4);
    permit = { command: 80, body: joinBody };
    client.sendRaw(80, [
      { t: 'i8', v: '28' },
      { t: 'i8', v: String(args.area) },
      { t: 'i16', v: String(pos.x) },
      { t: 'i16', v: String(pos.y) },
    ]);

    let currentAvatarPos = { x: pos.x, y: pos.y };
    try {
      const joinResult = await joinPending;
      state.isJoinPending = false;
      if (joinResult.status === 'closed') {
        state.status = 'closed';
        state.closedMessage = joinResult.closedMessage;
      } else if (joinResult.status === 'open' && joinResult.snapshot) {
        state.status = 'open';
        if (joinResult.snapshot.x && joinResult.snapshot.y) {
          currentAvatarPos = { x: joinResult.snapshot.x, y: joinResult.snapshot.y };
        }
        await observeFor(1000);
      }
    } catch (joinErr) {
      state.isJoinPending = false;
      if (state.status !== 'closed') {
        state.status = 'error';
        state.closedMessage = (joinErr as Error).message;
      }
    }

    const allSpecials = Array.from(currentSpecials.values());
    const chests = allSpecials.filter(
      (s) =>
        s.name.toLowerCase().includes('rương') ||
        s.name.toLowerCase().includes('kho báu'),
    );

    let navigationResultDetails: MazeProbeResult['navigationResult'];
    let openResultDetails: MazeProbeResult['openResult'];

    if (args.autoNavigate && state.status === 'open') {
      let targetChest: ChestObject | undefined;
      if (args.openChestId !== undefined) {
        targetChest = currentSpecials.get(args.openChestId);
      } else if (chests.length > 0) {
        targetChest = chests.slice().sort((a, b) => {
          const distA = Math.hypot(a.x - currentAvatarPos.x, a.y - currentAvatarPos.y);
          const distB = Math.hypot(b.x - currentAvatarPos.x, b.y - currentAvatarPos.y);
          return distA - distB;
        })[0];
      }

      if (!targetChest || !chests.some((c) => c.id === targetChest!.id) || state.removedChestIds.has(targetChest.id)) {
        if (args.outputFormat === 'text') {
          console.warn('[NAV] Không tìm thấy rương khả dụng trong khu để điều hướng.');
        }
      } else {
        if (args.outputFormat === 'text') {
          console.log(
            `[NAV] Tìm đường từ (${currentAvatarPos.x}, ${currentAvatarPos.y}) tới rương ID ${targetChest.id} tại (${targetChest.x}, ${targetChest.y})...`,
          );
        }
        const path = findMazePath(
          currentAvatarPos,
          { x: targetChest.x, y: targetChest.y },
          (tx, ty) => {
            if (tx < 0 || ty < 0 || tx > 120 || ty > 120) return true;
            const px = tx * 24 + 12;
            const py = ty * 24 + 12;
            for (const c of chests) {
              if (c.id === targetChest!.id) continue;
              if (c.block && c.block.length >= 4) {
                const [bx = 0, by = 0, bw = 0, bh = 0] = c.block;
                if (px >= bx && px <= bx + bw && py >= by && py <= by + bh) {
                  return true;
                }
              }
            }
            return false;
          },
        );

        let stepsWalked = 0;
        phase = 'navigate';
        if (!path.reachable) {
          if (args.outputFormat === 'text') {
            console.warn(`[NAV] Không tìm thấy đường tới rương ID ${targetChest.id} (bị chặn hoàn toàn).`);
          }
        } else {
          if (args.outputFormat === 'text') {
            console.log(`[NAV] Đã tìm thấy lộ trình ${path.waypoints.length} bước. Bắt đầu di chuyển tới rương...`);
          }
          for (const wp of path.waypoints) {
            if (abort.signal.aborted) break;
            client.sendRaw(84, [
              { t: 'i16', v: String(wp.x) },
              { t: 'i16', v: String(wp.y) },
              { t: 'i8', v: String(wp.direct) },
            ]);
            currentAvatarPos = { x: wp.x, y: wp.y };
            stepsWalked++;
            await observeFor(250);
          }
        }

        // Mở rương khi đã tiếp cận gần (< 36px)
        const distToChest = Math.hypot(currentAvatarPos.x - targetChest.x, currentAvatarPos.y - targetChest.y);
        if (distToChest <= 36 && !state.hasSentOpenChest && !state.removedChestIds.has(targetChest.id)) {
          dialogMessages.length = 0;
          capturedGifts.length = 0;
          state.hasSentOpenChest = true;
          if (args.outputFormat === 'text') {
            console.log(
              `[CHEST] Đã tiếp cận rương! Gửi lệnh mở rương ID ${targetChest.id} (TX 48 [i8 3, i32 ${targetChest.id}, i8 ${args.actionIndex}])...`,
            );
          }
          const openBody = Buffer.alloc(6);
          openBody.writeInt8(3);
          openBody.writeInt32BE(targetChest.id, 1);
          openBody.writeInt8(args.actionIndex, 5);
          permit = { command: 48, body: openBody };
          client.sendRaw(48, [
            { t: 'i8', v: '3' },
            { t: 'i32', v: String(targetChest.id) },
            { t: 'i8', v: String(args.actionIndex) },
          ]);
          await observeFor(3000);
        }

        // Tự động nhặt quà rơi sàn nếu có
        const pickedGifts: number[] = [];
        const groundGifts = capturedGifts.filter(
          (g) => g.subType === 0 && g.xDrop !== undefined && g.yDrop !== undefined && g.idGift > 0,
        );
        for (const g of groundGifts) {
          if (abort.signal.aborted) break;
          if (args.outputFormat === 'text') {
            console.log(`[GIFT] Phát hiện quà rơi sàn ID ${g.idGift} tại (${g.xDrop}, ${g.yDrop}). Di chuyển tới nhặt...`);
          }
          const giftPath = findMazePath(
            currentAvatarPos,
            { x: g.xDrop!, y: g.yDrop! },
            (tx, ty) => tx < 0 || ty < 0 || tx > 120 || ty > 120,
          );
          if (giftPath.reachable) {
            for (const wp of giftPath.waypoints) {
              if (abort.signal.aborted) break;
              client.sendRaw(84, [
                { t: 'i16', v: String(wp.x) },
                { t: 'i16', v: String(wp.y) },
                { t: 'i8', v: String(wp.direct) },
              ]);
              currentAvatarPos = { x: wp.x, y: wp.y };
              await observeFor(250);
            }
          }
          if (args.outputFormat === 'text') {
            console.log(`[GIFT] Gửi lệnh nhặt quà ID ${g.idGift} (TX 47 [i8 11, i32 ${g.idGift}])...`);
          }
          client.sendRaw(47, [
            { t: 'i8', v: '11' },
            { t: 'i32', v: String(g.idGift) },
          ]);
          pickedGifts.push(g.idGift);
          await observeFor(1000);
        }

        navigationResultDetails = {
          attempted: true,
          targetChestId: targetChest.id,
          pathLength: path.waypoints.length,
          stepsWalked,
          giftsPickedUp: pickedGifts,
        };

        openResultDetails = {
          attempted: true,
          sent: state.hasSentOpenChest,
          causality: 'unknown',
          observationStatus: 'window-ended',
          chestId: targetChest.id,
          removed: state.hasSentOpenChest && state.removedChestIds.has(targetChest.id),
          gifts: capturedGifts,
          dialogs: dialogMessages,
        };
      }
    } else if (args.openChestId !== undefined) {
      if (state.status === 'open') {
        const targetChest = currentSpecials.get(args.openChestId);
        if (!targetChest || !chests.some((chest) => chest.id === targetChest.id)
          || args.actionIndex >= targetChest.menuIds.length
          || state.removedChestIds.has(args.openChestId)) {
          if (args.outputFormat === 'text') {
            console.warn(
              `[CHEST] Rương ID ${args.openChestId} không tồn tại trong danh mục khu hiện tại (hoặc đã bị xóa); bỏ qua lệnh mở rương.`,
            );
          }
        } else if (!state.hasSentOpenChest) {
          dialogMessages.length = 0;
          capturedGifts.length = 0;
          state.hasSentOpenChest = true;
          if (args.outputFormat === 'text') {
            console.log(
              `[CHEST] Gửi lệnh mở rương ID ${args.openChestId} (TX 48 [i8 3, i32 ${args.openChestId}, i8 ${args.actionIndex}])...`,
            );
          }
          const openBody = Buffer.alloc(6);
          openBody.writeInt8(3); openBody.writeInt32BE(args.openChestId, 1);
          openBody.writeInt8(args.actionIndex, 5);
          permit = { command: 48, body: openBody };
          client.sendRaw(48, [
            { t: 'i8', v: '3' },
            { t: 'i32', v: String(args.openChestId) },
            { t: 'i8', v: String(args.actionIndex) },
          ]);
          await observeFor(3000);
        }
      }

      openResultDetails = {
        attempted: true,
        sent: state.hasSentOpenChest,
        causality: 'unknown',
        observationStatus: 'window-ended',
        chestId: args.openChestId,
        removed: state.hasSentOpenChest && state.removedChestIds.has(args.openChestId),
        gifts: capturedGifts,
        dialogs: dialogMessages,
      };
    }

    if (abort.signal.aborted || state.status === 'error') throw new Error('probe-failed');
    const result: MazeProbeResult = {
      timestamp: new Date().toISOString(),
      accountId: args.accountId,
      map: 28,
      area: args.area,
      status: state.status,
      message: state.closedMessage,
      chests: Array.from(currentSpecials.values()).filter((s) =>
        s.name.toLowerCase().includes('rương') || s.name.toLowerCase().includes('kho báu')),
      allSpecials: Array.from(currentSpecials.values()),
      navigationResult: navigationResultDetails,
      openResult: openResultDetails,
    };

    const sanitize = (text: string): string => {
      let safe = text;
      for (const secret of [account.gameUser, pass, config.masterKey.toString('hex'), config.masterKey.toString('base64')]) {
        if (secret) safe = safe.split(secret).join('[REDACTED]');
      }
      return safe.slice(0, 2048).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');
    };
    result.message = result.message ? sanitize(result.message) : undefined;
    for (const special of result.allSpecials) special.name = sanitize(special.name);
    if (result.openResult) result.openResult.dialogs = result.openResult.dialogs.map(sanitize);
    if (args.outputFormat === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('\n=================== KẾT QUẢ PROBE MÊ CUNG ===================');
      console.log(`Trạng thái: ${state.status.toUpperCase()}`);
      if (state.closedMessage) {
        console.log(`Thông báo server: "${result.message}"`);
      }
      console.log(`Số lượng ItemMapSpecial tìm thấy: ${allSpecials.length}`);
      console.log(`Số lượng Rương kho báu: ${chests.length}`);
      for (const chest of chests) {
        console.log(
          `  - Rương ID ${chest.id}: "${chest.name}" tại (${chest.x}, ${chest.y}), Type: ${chest.type}, Menu: [${chest.menuIds.join(', ')}]`,
        );
      }
      if (result.navigationResult) {
        console.log('\nKết quả điều hướng tự động:');
        console.log(`  - Rương mục tiêu: ID ${result.navigationResult.targetChestId ?? 'N/A'}`);
        console.log(
          `  - Lộ trình: ${result.navigationResult.pathLength} bước (đã đi ${result.navigationResult.stepsWalked} bước)`,
        );
        console.log(
          `  - Quà đã nhặt trên sàn: [${result.navigationResult.giftsPickedUp.join(', ')}]`,
        );
      }
      if (result.openResult) {
        console.log(`\nKết quả mở rương ID ${result.openResult.chestId}:`);
        console.log(`  - Xóa rương trên bản đồ: ${result.openResult.removed ? 'CÓ' : 'CHƯA'}`);
        console.log(`  - Số broadcast RX 47 quan sát được (quan hệ nhân quả chưa rõ): ${result.openResult.gifts.length}`);
        for (const gift of result.openResult.gifts) {
          console.log(`    + Quà ID: ${gift.idGift} (subType: ${gift.subType})`);
        }
      }
      console.log('============================================================\n');
    }
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    client?.session.removeListener('closed', stop);
    client?.session.removeListener('error', stop);
    stop();
    if (db) {
      try {
        db.close();
      } catch {}
    }
  }
}

run().catch(() => {
  const failure = { status: 'error', code: 'probe-refused-or-failed', message: 'Probe did not complete safely; no success inferred.' };
  if (process.argv.includes('json')) console.log(JSON.stringify(failure));
  else console.error('[PROBE ERROR]', failure.code);
  process.exitCode = 1;
});
