/**
 * Probe thử sử dụng item (Part 6383: Hộp bánh Trung Thu)
 *
 * Cú pháp:
 *   npx tsx --env-file=.env src/tools/use-item-probe.ts [accountId] [partId] [times]
 *   Ví dụ:
 *     npx tsx --env-file=.env src/tools/use-item-probe.ts 1 6383 5
 *
 * Wire protocol TX -18 (USING_PART / GlobalService.doUsingItem @0x69B264):
 *   i16 idIndex (vị trí trong hành trang / container)
 *   i16 idPart  (Part ID, ví dụ 6383)
 *   bool type   (true = sử dụng/mặc, false = tháo ra)
 */

import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { Message } from '../proto/message.js';
import { MyReader } from '../proto/reader.js';
import { loadConfig } from '../config.js';
import { resolvePartInfo } from '../game/partCatalog.js';

const accountId = Number(process.argv[2] ?? 1);
const targetPartId = Number(process.argv[3] ?? 6383);
const requestedTimes = Number(process.argv[4] ?? 1);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const row = getAccountById(db, accountId);
if (!row) {
  console.error(`Không tìm thấy tài khoản #${accountId}`);
  process.exit(1);
}

const client = new GameClient();
let targetIndex = -1;
let targetQty = 0;
const rewards: string[] = [];

client.session.on('message', (msg: Message) => {
  const data = msg.getData();

  // Bắt mọi gói tin phản hồi
  if (msg.command === -18) {
    console.log(`\n🎉 [RX -18] USING_PART: ${data.toString('hex')}`);
    try {
      const r = new MyReader(data);
      const idUser = r.readInt();
      const idP = r.readShort();
      console.log(`  idUser: ${idUser}, idPart: ${idP}`);
    } catch (e) {
      console.error('  Lỗi giải mã RX -18:', e);
    }
  }

  if (msg.command === -40) {
    // Thông báo dialog từ server
    try {
      const r = new MyReader(data);
      const text = r.readUTF();
      rewards.push(text);
      console.log(`\n💬 [RX -40] Dialog: "${text}"`);
    } catch { /* ignore */ }
  }

  if (msg.command === -38) {
    // Thông báo chat server / popup
    try {
      const r = new MyReader(data);
      const text = r.readUTF();
      if (text.trim()) console.log(`\n📢 [RX -38] Server notice: "${text}"`);
    } catch { /* ignore */ }
  }

  if (msg.command === -67) {
    // UPDATE_CONTAINER
    console.log(`\n🔄 [RX -67] UPDATE_CONTAINER: ${data.toString('hex')}`);
    try {
      const r = new MyReader(data);
      const type = r.readByte();
      const text = r.readUTF();
      console.log(`  type: ${type}, text: "${text}"`);
    } catch (e) {
      console.error('  Lỗi giải mã RX -67:', e);
    }
  }

  if (msg.command === -17) {
    // CONTAINER
    try {
      const r = new MyReader(data);
      const countEquipped = r.readShort();
      for (let i = 0; i < countEquipped; i++) {
        const idIndex = r.readShort();
        const idPart = r.readShort();
        r.readUTF(); // date
        r.readBoolean(); // isEquipped
        if (idPart === targetPartId) {
          targetIndex = idIndex;
          targetQty = 1;
        }
      }

      if (r.available() > 0) {
        const countInventory = r.readShort();
        for (let i = 0; i < countInventory; i++) {
          const idIndex = r.readShort();
          const idPart = r.readShort();
          const qty = r.readShort();
          r.readUTF(); // date
          if (idPart === targetPartId) {
            targetIndex = idIndex;
            targetQty = qty;
          }
        }
      }
    } catch { /* ignore */ }
  }
});

client.on('log', (txt: string) => {
  console.log(`[GAME] ${txt}`);
});

await client.login({
  host: row.host,
  port: row.port,
  user: row.gameUser,
  pass: readGamePass(db, cfg.masterKey, accountId),
});

console.log('[PROBE] Chờ login hoàn tất...');
await sleep(3000);

console.log(`>>> [TX -17] Yêu cầu CONTAINER để xác định slot của Part ${targetPartId}...`);
const reqContainer = Message.create(-17);
reqContainer.writer!.writeInt(client.playerId ?? -1);
client.session.send(reqContainer);

await sleep(2000);

const partInfo = resolvePartInfo(targetPartId);
console.log(`\nThông tin mục tiêu: ID ${targetPartId} - "${partInfo.name}" (${partInfo.slot})`);
console.log(`Tìm thấy tại Index: ${targetIndex}, Số lượng: ${targetQty}`);

if (targetIndex >= 0) {
  const loopCount = Math.min(requestedTimes, targetQty > 0 ? targetQty : requestedTimes);
  console.log(`\n>>> Chuẩn bị sử dụng ${loopCount} lần (yêu cầu: ${requestedTimes}, tồn: ${targetQty})...`);

  let successCount = 0;
  for (let i = 0; i < loopCount; i++) {
    console.log(`\n[Lần ${i + 1}/${loopCount}] >>> [TX -18] Gửi lệnh sử dụng Part ${targetPartId} (index=${targetIndex})...`);
    const msgUse = Message.create(-18);
    msgUse.writer!.writeShort(targetIndex);
    msgUse.writer!.writeShort(targetPartId);
    msgUse.writer!.writeBoolean(true);
    client.session.send(msgUse);
    successCount++;
    await sleep(1500);
  }

  await sleep(1500);
  console.log(`\n======================================================`);
  console.log(`=== 🎁 TỔNG KẾT SAU ${successCount} LẦN SỬ DỤNG ===`);
  console.log(`  Số lần đã gửi: ${successCount}`);
  if (rewards.length > 0) {
    console.log(`  Danh sách phần thưởng nhận được (${rewards.length}):`);
    rewards.forEach((r, idx) => console.log(`    ${idx + 1}. ${r}`));
  }
  console.log(`======================================================\n`);
} else {
  console.log(`\n⚠️ Không tìm thấy Part ${targetPartId} trong hành trang!`);
}

client.logout();
process.exit(0);
