/**
 * Probe thử sử dụng item (Part 6383: Hộp bánh Trung Thu)
 *
 * Cú pháp:
 *   npx tsx --env-file=.env src/tools/use-item-probe.ts [accountId] [partId] [times] [chestPass]
 *   Ví dụ:
 *     npx tsx --env-file=.env src/tools/use-item-probe.ts 1 6383 5
 *     npx tsx --env-file=.env src/tools/use-item-probe.ts 1 6383 5 123456
 *   Hoặc qua biến môi trường: CHEST_PASS=123456
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
const rawPass1 = (process.argv[5] ?? process.env.CHEST_PASS ?? process.env.BAG_PASS ?? '').trim();
const rawPass2 = (process.argv[6] ?? '').trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const row = getAccountById(db, accountId);
if (!row) {
  console.error(`Không tìm thấy tài khoản #${accountId}`);
  process.exit(1);
}

const client = new GameClient();

function sendChestPass(passBag: string, passChest: string) {
  console.log(
    `>>> [TX -87] Gửi mật khẩu kiểm tra rương/giỏ (giỏ="${passBag ? '******' : '(trống)'}", rương="${passChest ? '******' : '(trống)'}")...`,
  );
  const msg = Message.create(-87);
  msg.writer!.writeByte(8);
  msg.writer!.writeByte(0);
  msg.writer!.writeUTF(passBag);
  msg.writer!.writeUTF(passChest);
  client.session.send(msg);
}

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

  if (msg.command === -87) {
    // CUSTOM_CHEST
    try {
      const r = new MyReader(data);
      const subCmd = r.readByte();
      if (subCmd === 8) {
        const subCmd2 = r.readByte();
        if (subCmd2 === 0) {
          const countBox = r.readShort();
          console.log(`\n  --- 📦 KIỂM TRA RƯƠNG ĐỒ (count: ${countBox}) ---`);
          for (let i = 0; i < countBox; i++) {
            const index = r.readShort();
            const id = r.readShort();
            const date = r.readUTF();
            const info = resolvePartInfo(id);
            console.log(
              `    [Slot ${String(index).padStart(2, ' ')}] ID: ${String(id).padStart(4, ' ')} | [${info.slot.padEnd(10, ' ')}] ${info.name.padEnd(20, ' ')} | Hạn: "${date}"`,
            );
          }
          const countInven = r.readShort();
          for (let i = 0; i < countInven; i++) {
            r.readShort(); // index
            r.readShort(); // id
            r.readUTF(); // date
          }
          r.readShort(); // discarded
          const slot = r.readShort();
          const maxSlot = r.readShort();
          console.log(`  --- ℹ️ Ô rương: ${slot}/${maxSlot} ---\n`);
        } else if (subCmd2 === 3) {
          let info = '';
          let hasPassBag = false;
          let hasPassChest = false;
          try {
            if (r.available() > 0) info = r.readUTF();
            if (r.available() > 0) hasPassBag = r.readBoolean();
            if (r.available() > 0) hasPassChest = r.readBoolean();
          } catch (e) {
            // ignore
          }

          console.log(`  🔒 RƯƠNG YÊU CẦU MẬT KHẨU! (Giỏ đồ: ${hasPassBag ? '🔐 CÓ' : '🔓 Không'}, Rương: ${hasPassChest ? '🔐 CÓ' : '🔓 Không'})`);
          if (rawPass1) {
            let finalPassBag = '';
            let finalPassChest = '';
            if (rawPass2) {
              finalPassBag = rawPass1;
              finalPassChest = rawPass2;
            } else {
              if (hasPassBag && !hasPassChest) {
                finalPassBag = rawPass1;
                finalPassChest = '';
              } else if (!hasPassBag && hasPassChest) {
                finalPassBag = '';
                finalPassChest = rawPass1;
              } else {
                finalPassBag = rawPass1;
                finalPassChest = rawPass1;
              }
            }
            sendChestPass(finalPassBag, finalPassChest);
          } else {
            console.log(`  ℹ️ Không truyền mật khẩu, bỏ qua mở rương kiểm tra.`);
          }
        } else if (subCmd2 === 4) {
          const flag = r.readByte();
          let msgText = '';
          if (flag === 1) msgText = r.readUTF();
          console.log(`  ⚠️ Phản hồi từ rương (subCmd2=4): flag=${flag} msg="${msgText}"`);
          if (flag === 0 || msgText.toLowerCase().includes('mật khẩu') || msgText.toLowerCase().includes('pass')) {
            console.log(`  ❌ Mật khẩu rương không chính xác!`);
          }
        }
      }
    } catch (err) {
      console.error('  Lỗi giải mã RX -87 (CUSTOM_CHEST):', err);
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

console.log('\n>>> [TX -87] Gửi yêu cầu kiểm tra rương đồ (subCmd=8, subCmd2=3)...');
const reqChestInfo = Message.create(-87);
reqChestInfo.writer!.writeByte(8);
reqChestInfo.writer!.writeByte(3);
client.session.send(reqChestInfo);

await sleep(2000);

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
    await sleep(150);
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
