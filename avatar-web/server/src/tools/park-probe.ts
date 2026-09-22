import { get as httpGet } from 'node:http';

import { getAccountById, readGamePass } from '../accounts/repo.js';
import { loadConfig } from '../config.js';
import { openDb } from '../db/index.js';
import {
  GameClient,
  type ClientStatus,
} from '../game/client.js';
import { NATIVE_PARK_JOIN_POSITIONS } from '../game/parkService.js';
import type { Message } from '../proto/message.js';
import { MyReader } from '../proto/reader.js';

export interface ProbeArgs {
  accountId: number;
  map: number;
  board: number;
}

export interface ParkUser {
  id: number;
  name: string;
  x: number;
  y: number;
  dir: number;
}

export interface ParkNpc {
  id: number;
  name: string;
  x: number;
  y: number;
  type: number;
  menuIds: number[];
}

export interface ParkScanResult {
  roomId: number;
  boardId: number;
  occupancy?: number;
  totalUsers: number;
  users: ParkUser[];
  totalNpcs: number;
  npcs: ParkNpc[];
}

interface ParkBoardCatalog {
  roomId: number;
  boardCount: number;
  areas: Array<{ area: number; occupancy: number }>;
}

interface ParkJoinSnapshot {
  roomId: number;
  boardId: number;
  x: number;
  y: number;
  users: ParkUser[];
  npcs: ParkNpc[];
}

interface MapSpecialUpdate {
  mode: number;
  operation: 'upsert' | 'remove' | 'unsupported';
  id: number;
  name?: string;
  x?: number;
  y?: number;
  type?: number;
  menuIds?: number[];
}

const ALLOWED_KEYS = new Set(['--account-id', '--map', '--board']);

function parseInteger(key: string, raw: string): number {
  if (!/^-?\d+$/.test(raw)) {
    throw new Error(`${key} phải là số nguyên`);
  }
  const val = Number(raw);
  if (!Number.isSafeInteger(val)) {
    throw new Error(`${key} vượt giới hạn số nguyên an toàn`);
  }
  return val;
}

export function parseArgs(argv: string[]): ProbeArgs {
  if (argv.length % 2 !== 0) {
    throw new Error('Mỗi tùy chọn CLI phải có đúng một giá trị đi kèm');
  }

  const values = new Map<string, number>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]!;
    const raw = argv[i + 1];
    if (!ALLOWED_KEYS.has(key)) {
      throw new Error(`Tùy chọn CLI không được hỗ trợ: ${key}`);
    }
    if (values.has(key)) {
      throw new Error(`Tùy chọn CLI bị lặp lại: ${key}`);
    }
    if (raw === undefined || raw.startsWith('--')) {
      throw new Error(`Thiếu giá trị cho ${key}`);
    }
    values.set(key, parseInteger(key, raw));
  }

  if (!values.has('--account-id')) {
    throw new Error('Thiếu tùy chọn bắt buộc: --account-id <number>');
  }

  const accountId = values.get('--account-id')!;
  if (accountId <= 0) {
    throw new Error('--account-id phải là số nguyên dương');
  }

  const map = values.get('--map') ?? 0;
  const board = values.get('--board') ?? 0;

  for (const [name, val] of [['--map', map], ['--board', board]] as const) {
    if (val < -128 || val > 127) {
      throw new Error(`${name} phải nằm trong khoảng signed-byte (-128..127)`);
    }
  }

  return { accountId, map, board };
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
      finish();
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
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        client.logout();
      } finally {
        reject(new Error('Hết giờ kết nối hoặc bắt đầu đăng nhập game'));
      }
    }, timeoutMs);
  });

  try {
    const login = client.login(options);
    await Promise.race([login, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function waitUntilOnline(client: GameClient, timeoutMs: number): Promise<void> {
  if (client.status === 'online') return Promise.resolve();
  if (client.status === 'error' || client.status === 'idle') {
    return Promise.reject(new Error(`Game client không online (status=${client.status})`));
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
        reject(new Error(`Game client không online (status=${status})`));
      }
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('Hết giờ chờ game client online'));
    }, timeoutMs);
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
    client.session.on('message', onMessage);
    timer = setTimeout(() => {
      finishReject(new Error('Hết giờ chờ ACK handler Park (RX -1 [9])'));
    }, timeoutMs);
  });
}

function readNativeCount(reader: MyReader, section: string): number {
  if (reader.available() < 1) {
    throw new Error(`Thiếu count ${section}`);
  }
  const raw = reader.readByte();
  if (raw < 0) return 0;
  if (raw > 64) {
    throw new Error(`Count ${section} vượt giới hạn cho phép: ${raw}`);
  }
  return raw;
}

function readNativeUtf(reader: MyReader, section: string): string {
  if (reader.available() < 2) {
    throw new Error(`Thiếu độ dài UTF ${section}`);
  }
  const len = reader.readUnsignedShort();
  if (len > 8_192 || reader.available() < len) {
    throw new Error(`Chuỗi UTF ${section} vượt giới hạn độ dài (${len})`);
  }
  return reader.readBytes(len).toString('utf8');
}

function readNativeBytes(reader: MyReader, n: number, section: string): Buffer {
  if (n < 0 || reader.available() < n) {
    throw new Error(`Thiếu ${n} bytes ${section} (còn ${reader.available()})`);
  }
  return reader.readBytes(n);
}

function waitForParkBoardList(
  client: GameClient,
  roomId: number,
  timeoutMs: number,
): Promise<ParkBoardCatalog> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      if (timer) clearTimeout(timer);
    };
    const finishResolve = (catalog: ParkBoardCatalog): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(catalog);
    };
    const finishReject = (err: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const onMessage = (msg: Message): void => {
      if (msg.command !== 90) return;
      try {
        const reader = new MyReader(msg.getData());
        const boardCount = reader.readByte();
        if (boardCount < 0 || boardCount > 64) {
          finishReject(new Error(`Số lượng khu ngoài phạm vi hợp lệ: ${boardCount}`));
          return;
        }
        const areas: Array<{ area: number; occupancy: number }> = [];
        for (let i = 0; i < boardCount; i += 1) {
          areas.push({ area: i, occupancy: reader.readByte() });
        }
        finishResolve({ roomId, boardCount, areas });
      } catch (err) {
        finishReject(new Error(`Lỗi giải mã RX 90: ${(err as Error).message}`));
      }
    };
    client.session.on('message', onMessage);
    timer = setTimeout(() => {
      finishReject(new Error('Hết giờ chờ danh sách khu (RX 90)'));
    }, timeoutMs);
  });
}

function decodeParkJoinResponse(body: Buffer): ParkJoinSnapshot {
  const reader = new MyReader(body);

  if (reader.available() < 2) {
    throw new Error('Gói RX 80 quá ngắn (thiếu roomId, boardId)');
  }
  const roomId = reader.readByte();
  const boardId = reader.readByte();

  if (reader.available() < 4) {
    throw new Error('Gói RX 80 thiếu tọa độ vị trí');
  }
  const x = reader.readShort();
  const y = reader.readShort();

  // 1. List players (tách riêng người chơi thật và Avatar NPC như Chức Nữ / Ngưu Lang có ID >= 2_000_000_000 hoặc âm)
  const users: ParkUser[] = [];
  const npcs: ParkNpc[] = [];
  const playerCount = readNativeCount(reader, 'listPlayer');
  for (let i = 0; i < playerCount; i += 1) {
    if (reader.available() < 4) {
      throw new Error(`Thiếu ID của player[${i}]`);
    }
    const id = reader.readInt();
    const name = readNativeUtf(reader, `player[${i}].name`);
    const partCount = readNativeCount(reader, `player[${i}].parts`);
    readNativeBytes(reader, partCount * 2, `player[${i}].parts`);

    // Player state: 18 bytes (x i16, y i16, dir i8, remaining 13 bytes)
    if (reader.available() < 18) {
      throw new Error(`Thiếu state của player[${i}]`);
    }
    const px = reader.readShort();
    const py = reader.readShort();
    const dir = reader.readByte();
    readNativeBytes(reader, 13, `player[${i}].stateTail`);

    if (id >= 2_000_000_000 || id < 0) {
      npcs.push({ id, name, x: px, y: py, type: -1, menuIds: [] });
    } else {
      users.push({ id, name, x: px, y: py, dir });
    }
  }

  // 2. Drop parts
  const dropCount = readNativeCount(reader, 'dropParts');
  const dropBytes = dropCount * 11;
  readNativeBytes(reader, dropBytes, 'dropParts');

  // 3. Map markers and items
  if (reader.available() >= 2) {
    const mapMarker = reader.readShort();
    if (mapMarker >= 1) {
      if (reader.available() >= 1) {
        const itemTypeCount = readNativeCount(reader, 'mapItemType');
        for (let t = 0; t < itemTypeCount; t += 1) {
          readNativeBytes(reader, 8, `mapItemType[${t}]`);
          const notTransCount = readNativeCount(reader, `notTrans[${t}]`);
          readNativeBytes(reader, notTransCount * 2, `notTrans[${t}]`);
        }
      }
      if (reader.available() >= 1) {
        const itemCount = readNativeCount(reader, 'mapItem');
        readNativeBytes(reader, itemCount * 4, 'mapItem');
      }
    }
  }

  // 4. Animation templates
  if (reader.available() >= 1) {
    const animCount = readNativeCount(reader, 'animTempl');
    if (animCount > 0) {
      readNativeBytes(reader, animCount * 10, 'animTempl');
    }
  }

  // 5. Specials (NPCs)
  if (reader.available() >= 1) {
    const specialCount = readNativeCount(reader, 'specials');
    for (let s = 0; s < specialCount; s += 1) {
      if (reader.available() < 4) {
        throw new Error(`Thiếu ID của special[${s}]`);
      }
      const id = reader.readInt();
      const name = readNativeUtf(reader, `special[${s}].name`);
      if (reader.available() < 9) {
        throw new Error(`Thiếu tọa độ hoặc type của special[${s}]`);
      }
      const sx = reader.readInt();
      const sy = reader.readInt();
      const type = reader.readByte();

      const imageCount = readNativeCount(reader, `special[${s}].images`);
      readNativeBytes(reader, imageCount * 2, `special[${s}].images`);
      readNativeBytes(reader, 32, `special[${s}].state`);

      const menuCount = readNativeCount(reader, `special[${s}].menus`);
      const menuIds: number[] = [];
      for (let m = 0; m < menuCount; m += 1) {
        if (reader.available() < 2) {
          throw new Error(`Thiếu menu[${m}] của special[${s}]`);
        }
        menuIds.push(reader.readShort());
      }

      npcs.push({ id, name, x: sx, y: sy, type, menuIds });
    }
  }

  return { roomId, boardId, x, y, users, npcs };
}

function decodeMapSpecialUpdate(body: Buffer): MapSpecialUpdate {
  const reader = new MyReader(body);
  const mode = reader.readByte();
  if (mode === 2) {
    const id = reader.readInt();
    return {
      mode,
      operation: 'remove',
      id,
    };
  }
  if (mode < 0 || mode > 1) {
    return {
      mode,
      operation: 'unsupported',
      id: -1,
    };
  }

  const id = reader.readInt();
  const name = readNativeUtf(reader, 'special-update.name');
  const x = reader.readInt();
  const y = reader.readInt();
  const type = reader.readByte();
  const imageCount = readNativeCount(reader, 'special-update.images');
  readNativeBytes(reader, imageCount * 2, 'special-update.images');
  readNativeBytes(reader, 8 * 4, 'special-update.state');
  const menuCount = readNativeCount(reader, 'special-update.menus');
  const menuIds: number[] = [];
  for (let m = 0; m < menuCount; m += 1) {
    menuIds.push(reader.readShort());
  }
  return {
    mode,
    operation: 'upsert',
    id,
    name,
    x,
    y,
    type,
    menuIds,
  };
}

interface MapSpecialCapture {
  updates: MapSpecialUpdate[];
  stop: () => void;
}

function startMapSpecialCapture(client: GameClient): MapSpecialCapture {
  const updates: MapSpecialUpdate[] = [];
  const onMessage = (msg: Message): void => {
    if (msg.command !== 48) return;
    try {
      updates.push(decodeMapSpecialUpdate(msg.getData()));
    } catch {
      // Bỏ qua nếu gói 48 không khớp cấu trúc
    }
  };
  client.session.on('message', onMessage);
  return {
    updates,
    stop: () => client.session.removeListener('message', onMessage),
  };
}

function waitForParkJoinResponse(
  client: GameClient,
  timeoutMs: number,
): Promise<ParkJoinSnapshot> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      client.session.removeListener('message', onMessage);
      if (timer) clearTimeout(timer);
    };
    const finishResolve = (snap: ParkJoinSnapshot): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(snap);
    };
    const finishReject = (err: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const onMessage = (msg: Message): void => {
      if (msg.command === 80) {
        try {
          const snapshot = decodeParkJoinResponse(msg.getData());
          finishResolve(snapshot);
        } catch (err) {
          finishReject(new Error(`Lỗi giải mã RX 80: ${(err as Error).message}`));
        }
      } else if (msg.command === -40) {
        try {
          const reader = new MyReader(msg.getData());
          const text = reader.available() >= 2 ? reader.readUTF() : msg.getData().toString('utf8');
          const lower = text.toLowerCase();
          if (lower.includes('đã đầy') || lower.includes('đóng cửa') || lower.includes('không thể vào')) {
            finishReject(new Error(`Server từ chối vào khu (-40): ${text}`));
          }
        } catch {
          // ignore
        }
      }
    };
    client.session.on('message', onMessage);
    timer = setTimeout(() => {
      finishReject(new Error('Hết giờ chờ phản hồi vào khu (RX 80)'));
    }, timeoutMs);
  });
}

export function printSummary(result: ParkScanResult, map: number, board: number): void {
  const mapTitle = map === 0 ? 'CÔNG VIÊN TRUNG TÂM' : `MAP ${map}`;
  console.log(`=== ${mapTitle} (Map ${map} - Board ${board}) ===`);
  const occText = result.occupancy !== undefined ? `${result.occupancy} người chơi` : `${result.totalUsers} người chơi`;
  console.log(`Sĩ số phòng: ${occText}\n`);

  console.log(`[Danh sách User (${result.totalUsers} người)]:`);
  if (result.users.length === 0) {
    console.log('  (Không có người chơi)');
  } else {
    for (const u of result.users) {
      console.log(`  - [${u.id}] ${u.name} (vị trí: ${u.x}, ${u.y})`);
    }
  }

  console.log(`\n[Danh sách NPC / Specials (${result.totalNpcs} đối tượng)]:`);
  if (result.npcs.length === 0) {
    console.log('  (Không có đối tượng)');
  } else {
    for (const n of result.npcs) {
      const typeLabel = n.type === -1 ? 'Avatar NPC' : `type: ${n.type}`;
      const menuLabel = n.menuIds.length > 0 ? `, menus: [${n.menuIds.join(', ')}]` : '';
      console.log(`  - [${n.id}] ${n.name} (vị trí: ${n.x}, ${n.y} - ${typeLabel}${menuLabel})`);
    }
  }
}

export async function runParkProbe(args: ProbeArgs): Promise<ParkScanResult> {
  const config = loadConfig();
  await assertAvatarWebStopped(config.port);

  const db = openDb(config.dbPath);
  let client: GameClient | undefined;

  try {
    const account = getAccountById(db, args.accountId);
    if (!account) {
      throw new Error(`Không tìm thấy tài khoản với ID ${args.accountId} trong cơ sở dữ liệu`);
    }
    const gamePass = readGamePass(db, config.masterKey, args.accountId);
    if (!gamePass) {
      throw new Error(`Tài khoản ${account.gameUser} (ID ${args.accountId}) không có mật khẩu game`);
    }

    const position = NATIVE_PARK_JOIN_POSITIONS[args.map];
    if (!position) {
      throw new Error(`Chưa có toạ độ native cho map ${args.map}`);
    }

    client = new GameClient();

    // 1. Đăng nhập game client
    await loginWithTimeout(
      client,
      {
        host: account.host,
        port: account.port,
        user: account.gameUser,
        pass: gamePass,
        device: account.device,
      },
      12_000,
    );
    await waitUntilOnline(client, 10_000);

    // 2. Chuyển context Park và chờ ACK RX -1 [9]
    const parkAckPending = waitForParkHandlerResponse(client, 5_000);
    client.enterParkContext();
    await parkAckPending;

    // 3. Xin sĩ số khu (TX 90) và chờ RX 90
    let occupancy: number | undefined;
    try {
      const boardListPending = waitForParkBoardList(client, args.map, 5_000);
      client.sendRaw(90, [{ t: 'i8', v: String(args.map) }]);
      const catalog = await boardListPending;
      const targetArea = catalog.areas.find((a) => a.area === args.board);
      if (targetArea) {
        occupancy = targetArea.occupancy;
      }
    } catch {
      // Best-effort: nếu không lấy được catalog thì occupancy fallback sau
    }

    // 4. Lắng nghe RX 48 và gửi TX 80 vào phòng
    const specialCapture = startMapSpecialCapture(client);
    try {
      const joinPending = waitForParkJoinResponse(client, 7_000);
      client.sendRaw(80, [
        { t: 'i8', v: String(args.map) },
        { t: 'i8', v: String(args.board) },
        { t: 'i16', v: String(position.x) },
        { t: 'i16', v: String(position.y) },
      ]);
      const snapshot = await joinPending;

      // 5. Chờ 2s grace period để cập nhật NPC bổ sung (RX 48)
      await new Promise<void>((resolve) => setTimeout(resolve, 2_000));

      // 6. Tổng hợp danh sách NPC
      const npcMap = new Map<number, ParkNpc>();
      for (const npc of snapshot.npcs) {
        npcMap.set(npc.id, npc);
      }
      for (const update of specialCapture.updates) {
        if (
          update.operation === 'upsert'
          && update.name !== undefined
          && update.x !== undefined
          && update.y !== undefined
          && update.type !== undefined
        ) {
          npcMap.set(update.id, {
            id: update.id,
            name: update.name,
            x: update.x,
            y: update.y,
            type: update.type,
            menuIds: update.menuIds ?? [],
          });
        } else if (update.operation === 'remove') {
          npcMap.delete(update.id);
        }
      }

      const finalNpcs = Array.from(npcMap.values());

      return {
        roomId: snapshot.roomId,
        boardId: snapshot.boardId,
        occupancy,
        totalUsers: snapshot.users.length,
        users: snapshot.users,
        totalNpcs: finalNpcs.length,
        npcs: finalNpcs,
      };
    } finally {
      specialCapture.stop();
    }
  } finally {
    if (client) {
      try {
        client.logout();
      } catch {
        // ignore
      }
    }
    try {
      db.close();
    } catch {
      // ignore
    }
  }
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes('-h') || rawArgs.includes('--help')) {
    console.log(`Cách dùng:
  node --env-file=.env --import tsx src/tools/park-probe.ts --account-id <number> [--map <number>] [--board <number>]

Tùy chọn:
  --account-id  ID tài khoản trong database (bắt buộc)
  --map         ID bản đồ / phòng (mặc định: 0 - Công viên trung tâm)
  --board       ID khu / bàn (mặc định: 0)
`);
    process.exit(0);
  }

  const args = parseArgs(rawArgs);
  const result = await runParkProbe(args);
  printSummary(result, args.map, args.board);
}

const isDirectRun = Boolean(
  process.argv[1]
  && (process.argv[1].endsWith('park-probe.ts') || process.argv[1].endsWith('park-probe.js')),
);

if (isDirectRun) {
  main().catch((err) => {
    console.error(`[PROBE ERROR] ${(err as Error).message}`);
    process.exit(1);
  });
}
