/**
 * Probe giao thức Kết Bạn AvatarHD:
 * - TX -48: REQUEST_FRIENDLIST -> RX -48: danh sách bạn bè
 * - TX -95: AVATAR_REQUEST_ADD_FRIEND (gửi lời mời) -> RX -95 (nhận lời mời)
 * - TX -49: ADD_FRIEND (chấp nhận / từ chối) -> RX -49 (kết quả kết bạn)
 * - TX -50: REMOVE_FRIEND (xoá bạn bè)
 *
 * Chạy:
 *   npx tsx --env-file=.env src/tools/friend-probe.ts --list
 *   npx tsx --env-file=.env src/tools/friend-probe.ts --test-dual
 */

import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { Message } from '../proto/message.js';
import { MyReader } from '../proto/reader.js';
import { loadConfig } from '../config.js';
import { NATIVE_PARK_JOIN_POSITIONS } from '../game/parkService.js';

interface FriendEntry {
  id: number;
  name: string;
  level: number;
  parts: number[];
}

interface ParkUser {
  id: number;
  name: string;
  x: number;
  y: number;
  dir: number;
}

function readNativeCount(reader: MyReader, section: string): number {
  if (reader.available() < 1) throw new Error(`Thiếu count ${section}`);
  const raw = reader.readByte();
  return raw < 0 ? 0 : raw;
}

function readNativeUtf(reader: MyReader, section: string): string {
  if (reader.available() < 2) throw new Error(`Thiếu độ dài UTF ${section}`);
  const len = reader.readUnsignedShort();
  return reader.readBytes(len).toString('utf8');
}

function readNativeBytes(reader: MyReader, n: number, section: string): Buffer {
  if (n < 0 || reader.available() < n) {
    throw new Error(`Thiếu ${n} bytes ${section} (còn ${reader.available()})`);
  }
  return reader.readBytes(n);
}

function decodeParkUsers(body: Buffer): { roomId: number; boardId: number; users: ParkUser[] } {
  const reader = new MyReader(body);
  const roomId = reader.readByte();
  const boardId = reader.readByte();
  const x = reader.readShort();
  const y = reader.readShort();

  const users: ParkUser[] = [];
  const playerCount = readNativeCount(reader, 'listPlayer');
  for (let i = 0; i < playerCount; i += 1) {
    const id = reader.readInt();
    const name = readNativeUtf(reader, `player[${i}].name`);
    const partCount = readNativeCount(reader, `player[${i}].parts`);
    readNativeBytes(reader, partCount * 2, `player[${i}].parts`);

    const px = reader.readShort();
    const py = reader.readShort();
    const dir = reader.readByte();
    readNativeBytes(reader, 13, `player[${i}].stateTail`);

    if (id < 2_000_000_000 && id > 0) {
      users.push({ id, name, x: px, y: py, dir });
    }
  }
  return { roomId, boardId, users };
}

function formatAreaStatus(status: number): string {
  switch (status) {
    case 0:
      return 'Vắng (Xanh lá)';
    case 1:
      return 'Đầy (Đỏ)';
    case 2:
      return 'Bình thường (Vàng)';
    default:
      return `Mã ${status}`;
  }
}

function requestParkBoardList(client: GameClient, roomId: number): Promise<Array<{ area: number; status: number }>> {
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        client.session.removeListener('message', onMessage);
        resolve([]);
      }
    }, 4000);

    const onMessage = (msg: Message) => {
      if (msg.command !== 90) return;
      try {
        const reader = new MyReader(msg.getData());
        const boardCount = reader.readByte();
        const areas: Array<{ area: number; status: number }> = [];
        for (let i = 0; i < boardCount; i += 1) {
          areas.push({ area: i, status: reader.readByte() });
        }
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          client.session.removeListener('message', onMessage);
          resolve(areas);
        }
      } catch {
        // ignore
      }
    };
    client.session.on('message', onMessage);
    const m = Message.create(90);
    m.writer!.writeByte(roomId);
    client.session.send(m);
  });
}

function decodeFriendList(buf: Buffer): FriendEntry[] {
  const r = new MyReader(buf);
  const count = r.readShort();
  const friends: FriendEntry[] = [];
  for (let i = 0; i < count; i++) {
    const id = r.readInt();
    const name = r.readUTF();
    const level = r.readInt();
    const numParts = r.readByte();
    const parts: number[] = [];
    for (let j = 0; j < numParts; j++) {
      parts.push(r.readShort());
    }
    friends.push({ id, name, level, parts });
  }
  return friends;
}

function sendRequestFriendList(client: GameClient) {
  const m = Message.create(-48);
  client.session.send(m);
}

function sendAddFriendRequest(client: GameClient, targetUserId: number) {
  const m = Message.create(-95);
  m.writer!.writeInt(targetUserId);
  client.session.send(m);
}

function sendAddFriendResponse(client: GameClient, fromUserId: number, accept: boolean) {
  const m = Message.create(-49);
  m.writer!.writeInt(fromUserId);
  m.writer!.writeBoolean(accept);
  client.session.send(m);
}

function sendRemoveFriend(client: GameClient, friendUserId: number) {
  const m = Message.create(-50);
  m.writer!.writeInt(friendUserId);
  client.session.send(m);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function loginClient(client: GameClient, row: any, pass: string, tag: string) {
  const onlinePromise = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${tag} Login timeout sau 12s`)), 12000);
    client.on('status', (s) => {
      if (s === 'online') {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  await client.login({
    host: row.host,
    port: row.port,
    user: row.gameUser,
    pass,
  });

  await onlinePromise;
}

function setupMessageLogging(client: GameClient, tag: string, onInvite?: (fromId: number) => void) {
  client.session.on('message', (msg: Message) => {
    const data = msg.getData();
    console.log(`[${tag}][RX] cmd=${msg.command}, len=${data.length}`);
    if (msg.command === -48) {
      console.log(`[${tag}][RX -48] Nhận FriendList raw ${data.length} bytes`);
      try {
        const list = decodeFriendList(data);
        console.log(`[${tag}][RX -48] Danh sách bạn bè (${list.length}):`, JSON.stringify(list, null, 2));
      } catch (e) {
        console.error(`[${tag}][RX -48] Lỗi decode:`, e);
      }
    } else if (msg.command === -95) {
      try {
        const r = new MyReader(data);
        const fromId = r.readInt();
        const fromName = r.readUTF();
        const text = r.readUTF();
        console.log(`[${tag}][RX -95] Lời mời kết bạn: fromId=${fromId}, fromName="${fromName}", text="${text}"`);
        if (onInvite) onInvite(fromId);
      } catch (e) {
        console.error(`[${tag}][RX -95] Lỗi decode:`, e);
      }
    } else if (msg.command === -49) {
      try {
        const r = new MyReader(data);
        const id = r.readInt();
        const name = r.readUTF();
        const status = r.readBoolean();
        const text = r.readUTF();
        console.log(`[${tag}][RX -49] Kết quả kết bạn: id=${id}, name="${name}", status=${status}, text="${text}"`);
      } catch (e) {
        console.error(`[${tag}][RX -49] Lỗi decode:`, e);
      }
    } else if (msg.command === -39 || msg.command === -40) {
      try {
        const r = new MyReader(data);
        const text = r.readUTF();
        console.log(`[${tag}][RX ${msg.command}] Thông báo server: "${text}"`);
      } catch {
        // ignore
      }
    }
  });
}

async function main() {
  const cfg = loadConfig();
  const db = openDb(cfg.dbPath);

  const args = process.argv.slice(2);
  const isDual = args.includes('--test-dual');
  const accArgIndex = args.indexOf('--account');
  const targetAcc = accArgIndex >= 0 ? Number(args[accArgIndex + 1]) : 1;
  const sendArgIndex = args.indexOf('--send');
  const targetSendId = sendArgIndex >= 0 ? Number(args[sendArgIndex + 1]) : null;
  const removeArgIndex = args.indexOf('--remove');
  const targetRemoveId = removeArgIndex >= 0 ? Number(args[removeArgIndex + 1]) : null;

  const mapArgIndex = args.indexOf('--map');
  const targetMap = mapArgIndex >= 0 ? Number(args[mapArgIndex + 1]) : 0;
  const areaArgIndex = args.indexOf('--area');
  const targetArea = areaArgIndex >= 0 ? Number(args[areaArgIndex + 1]) : null;

  const fromMapArg = args.indexOf('--from-map');
  const fromMap = fromMapArg >= 0 ? Number(args[fromMapArg + 1]) : null;
  const toMapArg = args.indexOf('--to-map');
  const toMap = toMapArg >= 0 ? Number(args[toMapArg + 1]) : null;
  const fromAreaArg = args.indexOf('--from-area');
  const fromArea = fromAreaArg >= 0 ? Number(args[fromAreaArg + 1]) : null;
  const toAreaArg = args.indexOf('--to-area');
  const toArea = toAreaArg >= 0 ? Number(args[toAreaArg + 1]) : null;
  const delayArg = args.indexOf('--delay');
  const delayMs = delayArg >= 0 ? Number(args[delayArg + 1]) : 1000;

  const isPark =
    args.includes('--park') ||
    fromMap !== null ||
    toMap !== null ||
    fromArea !== null ||
    toArea !== null ||
    mapArgIndex >= 0 ||
    areaArgIndex >= 0;

  const accountId1 = targetAcc;
  const accountId2 = 2;

  const row1 = getAccountById(db, accountId1);
  if (!row1) throw new Error(`Account #${accountId1} not found`);
  const pass1 = readGamePass(db, cfg.masterKey, accountId1);

  console.log(`=== BẮT ĐẦU PROBE KẾT BẠN ===`);
  console.log(`[Account 1] Đăng nhập: ${row1.gameUser}...`);
  const client1 = new GameClient();
  setupMessageLogging(client1, 'Client 1');

  await loginClient(client1, row1, pass1, 'Client 1');
  console.log(`[Client 1] Đăng nhập thành công! Player ID: ${client1.playerId}`);
  await sleep(1500);

  console.log(`\n--- BƯỚC 1: Kiểm tra FriendList của Client 1 ---`);
  console.log(`[Client 1] >>> Gửi TX -48 (REQUEST_FRIENDLIST)...`);
  sendRequestFriendList(client1);
  await sleep(2000);

  if (targetSendId !== null) {
    console.log(`\n--- GỬI LỜI MỜI KẾT BẠN: Client 1 tới ID ${targetSendId} ---`);
    console.log(`[Client 1] >>> Gửi TX -95 (AVATAR_REQUEST_ADD_FRIEND)...`);
    sendAddFriendRequest(client1, targetSendId);
    await sleep(3000);
  }

  if (targetRemoveId !== null) {
    console.log(`\n--- XOÁ BẠN BÈ: Client 1 xoá ID ${targetRemoveId} ---`);
    console.log(`[Client 1] >>> Gửi TX -50 (REMOVE_FRIEND)...`);
    sendRemoveFriend(client1, targetRemoveId);
    await sleep(2000);
    console.log(`[Client 1] >>> Gửi TX -48 kiểm tra lại...`);
    sendRequestFriendList(client1);
    await sleep(2000);
  }

  if (isPark) {
    console.log(`\n--- VÀO CÔNG VIÊN TÌM NGƯỜI CHƠI ONLINE & GỬI LỜI MỜI KẾT BẠN ---`);
    client1.enterParkContext();
    await sleep(1500);

    const startMap = fromMap !== null ? fromMap : targetMap;
    const endMap = toMap !== null ? toMap : (fromMap !== null ? fromMap : targetMap);
    const startArea = fromArea !== null ? fromArea : (targetArea !== null ? targetArea : 0);
    const endArea = toArea !== null ? toArea : (fromArea !== null ? fromArea : (targetArea !== null ? targetArea : 0));

    console.log(`-> Cấu hình quét: Map ${startMap} -> ${endMap}, Khu ${startArea} -> ${endArea}, Giãn cách: ${delayMs}ms`);

    if (args.includes('--status')) {
      console.log(`[Client 1] >>> Xin danh sách khu của Map ${startMap} (TX 90)...`);
      const areas = await requestParkBoardList(client1, startMap);
      console.log(
        `[Client 1] Trạng thái ${areas.length} khu của Map ${startMap}:`,
        areas.slice(0, 8).map((a) => `Khu ${a.area}: ${formatAreaStatus(a.status)}`).join(' | ') + (areas.length > 8 ? ` ... (+${areas.length - 8} khu)` : ''),
      );
    }

    const invitedUserIds = new Set<number>();
    let totalFound = 0;
    let totalInvited = 0;

    for (let m = startMap; m <= endMap; m++) {
      if (!NATIVE_PARK_JOIN_POSITIONS[m]) {
        console.log(`\n[Bỏ qua Map ${m}] Chưa hỗ trợ toạ độ native.`);
        continue;
      }

      console.log(`\n==================================================`);
      console.log(`>>> QUÉT MAP ${m} (từ Khu ${startArea} đến Khu ${endArea})`);
      console.log(`==================================================`);

      for (let a = startArea; a <= endArea; a++) {
        console.log(`\n[Client 1] >>> Vào Map ${m}, Khu ${a}...`);

        const parkJoinPromise = new Promise<{ roomId: number; boardId: number; users: ParkUser[] }>((resolve) => {
          const onMsg = (msg: Message) => {
            if (msg.command === 80) {
              client1.session.removeListener('message', onMsg);
              try {
                resolve(decodeParkUsers(msg.getData()));
              } catch (e) {
                console.error('Lỗi giải mã gói 80:', e);
                resolve({ roomId: m, boardId: a, users: [] });
              }
            }
          };
          client1.session.on('message', onMsg);
          setTimeout(() => {
            client1.session.removeListener('message', onMsg);
            resolve({ roomId: m, boardId: a, users: [] });
          }, 3500);
        });

        client1.joinPark(m, a);
        const res = await parkJoinPromise;

        const otherUsers = res.users.filter((u) => u.id !== client1.playerId);
        totalFound += otherUsers.length;
        console.log(`[Map ${m} - Khu ${a}] Tìm thấy ${res.users.length} người (${otherUsers.length} người chơi khác).`);
        for (const u of res.users) {
          const isMe = u.id === client1.playerId;
          console.log(`  - [ID: ${u.id}] Tên: "${u.name}" (toạ độ: ${u.x}, ${u.y})${isMe ? ' (TÔI)' : ''}`);
        }

        if (otherUsers.length > 0) {
          for (const u of otherUsers) {
            if (invitedUserIds.has(u.id)) {
              console.log(`  (Đã mời trước đó: "${u.name}" - ID ${u.id})`);
              continue;
            }
            invitedUserIds.add(u.id);
            totalInvited++;
            console.log(`  [TX -95] Gửi lời mời tới "${u.name}" (ID ${u.id})...`);
            sendAddFriendRequest(client1, u.id);
            await sleep(delayMs);
          }
        }

        await sleep(delayMs);
      }
    }

    console.log(`\n=== TỔNG KẾT QUÉT PARK ===`);
    console.log(`- Tổng số lượt người chơi tìm thấy: ${totalFound}`);
    console.log(`- Tổng số lời mời đã gửi (không trùng): ${totalInvited}`);
  }

  if (isDual) {
    const row2 = getAccountById(db, accountId2);
    if (!row2) throw new Error(`Account #${accountId2} not found`);
    const pass2 = readGamePass(db, cfg.masterKey, accountId2);

    console.log(`\n=== BƯỚC 2: Đăng nhập Account 2 (${row2.gameUser}) ===`);
    const client2 = new GameClient();
    setupMessageLogging(client2, 'Client 2', (fromId) => {
      console.log(`[Client 2] >>> Tự động gửi TX -49 chấp nhận kết bạn từ ID ${fromId} (accept = true)...`);
      sendAddFriendResponse(client2, fromId, true);
    });

    await loginClient(client2, row2, pass2, 'Client 2');
    console.log(`[Client 2] Đăng nhập thành công! Player ID: ${client2.playerId}`);
    await sleep(1500);

    console.log(`[Client 2] >>> Gửi TX -48 (REQUEST_FRIENDLIST)...`);
    sendRequestFriendList(client2);
    await sleep(1500);

    const id1 = client1.playerId;
    const id2 = client2.playerId;
    if (id1 && id2) {
      console.log(`\n=== BƯỚC 3: Client 1 (ID ${id1}) gửi lời mời kết bạn tới Client 2 (ID ${id2}) ===`);
      console.log(`[Client 1] >>> Gửi TX -95 (AVATAR_REQUEST_ADD_FRIEND) tới ID ${id2}...`);
      sendAddFriendRequest(client1, id2);

      console.log(`-> Chờ 4s để nhận gói tin và phản hồi...`);
      await sleep(4000);

      console.log(`\n=== BƯỚC 4: Kiểm tra lại FriendList của cả hai sau khi kết bạn ===`);
      console.log(`[Client 1] >>> Gửi TX -48...`);
      sendRequestFriendList(client1);
      await sleep(1000);
      console.log(`[Client 2] >>> Gửi TX -48...`);
      sendRequestFriendList(client2);
      await sleep(3000);

      console.log(`\n=== BƯỚC 5: Thử xoá bạn (Client 1 gửi TX -50 xoá Client 2) ===`);
      console.log(`[Client 1] >>> Gửi TX -50 (REMOVE_FRIEND) xoá ID ${id2}...`);
      sendRemoveFriend(client1, id2);
      await sleep(2000);

      console.log(`\n=== BƯỚC 6: Kiểm tra lại FriendList của Client 1 sau khi xoá bạn ===`);
      console.log(`[Client 1] >>> Gửi TX -48...`);
      sendRequestFriendList(client1);
      await sleep(2000);
    }

    client2.logout();
  }

  client1.logout();
  console.log('\n=== HOÀN THÀNH PROBE ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Lỗi probe:', err);
  process.exit(1);
});
