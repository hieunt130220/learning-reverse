/**
 * Probe kiểm tra rương đồ (BoxScr / CUSTOM_CHEST) và hành trang (CONTAINER) của người chơi:
 *   npx tsx --env-file=.env src/tools/chest-probe.ts [accountId] [pass]
 *   Hoặc truyền rõ 2 pass riêng: [accountId] [passBag] [passChest]
 *   Hoặc đặt biến môi trường: CHEST_PASS=123456 / BAG_PASS=123456
 *
 * Wire protocol (giải mã từ libil2cpp.so arm64):
 *   TX -87 (CUSTOM_CHEST):
 *     i8 8, i8 3 (GlobalService.doRequestOpenChestScr @0x69E1C4)
 *   TX -87 gửi mật khẩu mở rương (GlobalService.doSendPassOpenChest @0x69E430):
 *     i8 8, i8 0, utf passBag, utf passChest
 *   RX -87:
 *     i8 subCmd (8)
 *     i8 subCmd2:
 *       0 -> Thành công, mở rương (BoxScr.setInfo @0x974C64):
 *            i16 countBox
 *            lặp countBox lần:
 *              i16 index
 *              i16 id (Part ID)
 *              utf date (hạn sử dụng)
 *            i16 countInven
 *            lặp countInven lần:
 *              i16 index
 *              i16 id
 *              utf date
 *            i16 _ (bỏ qua)
 *            i16 slot (số ô hiện tại của rương)
 *            i16 maxSlot (số ô tối đa của rương)
 *       3 -> Rương có mật khẩu, yêu cầu nhập pass (PopupShop.paintEnterChestPassScreen @0x72D12C)
 *       4 -> Thông báo lỗi / đóng pass (PopupShop.IActionChestPassClose @0x7FB4FC)
 *
 *   TX -17 (CONTAINER):
 *     i32 userId (GlobalService.doRequestContainer @0x69B154)
 *   RX -17:
 *     i16 count (GlobalMessageHandler.onMessage @0x5EA658)
 *     lặp count lần:
 *       i16 idPart
 *       i16 idIndex
 *       utf date
 *       bool isEquipped
 */

import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { Message } from '../proto/message.js';
import { MyReader } from '../proto/reader.js';
import { loadConfig } from '../config.js';
import { resolvePartInfo } from '../game/partCatalog.js';

const accountId = Number(process.argv[2] ?? 1);
const rawPass1 = (process.argv[3] ?? process.env.CHEST_PASS ?? process.env.BAG_PASS ?? '').trim();
const rawPass2 = (process.argv[4] ?? '').trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const row = getAccountById(db, accountId);
if (!row) {
  console.error(`Không tìm thấy tài khoản #${accountId} trong database.`);
  process.exit(1);
}

console.log(`[CHEST-PROBE] Đăng nhập tài khoản #${accountId} (${row.gameUser})...`);
const client = new GameClient();

function sendChestPass(passBag: string, passChest: string) {
  console.log(
    `>>> [TX -87] Gửi mật khẩu (giỏ đồ="${passBag ? '******' : '(trống)'}", rương="${passChest ? '******' : '(trống)'}") [subCmd=8, subCmd2=0]...`,
  );
  const msg = Message.create(-87);
  msg.writer!.writeByte(8);
  msg.writer!.writeByte(0);
  msg.writer!.writeUTF(passBag);
  msg.writer!.writeUTF(passChest);
  client.session.send(msg);
}

let chestReceived = false;
let containerReceived = false;

interface BoxItem {
  index: number;
  id: number;
  date: string;
}

interface ContainerItem {
  idPart: number;
  idIndex: number;
  date: string;
  isEquipped: boolean;
}

// Bắt các gói tin liên quan đến rương và hành trang
client.session.on('message', (msg: Message) => {
  const data = msg.getData();

  if (msg.command === -87) {
    // CUSTOM_CHEST
    console.log(`\n======================================================`);
    console.log(`[RX -87] Nhận gói CUSTOM_CHEST (${data.length} bytes): ${data.toString('hex')}`);
    try {
      const r = new MyReader(data);
      const subCmd = r.readByte();
      console.log(`  subCmd: ${subCmd}`);

      if (subCmd === 8) {
        const subCmd2 = r.readByte();
        console.log(`  subCmd2: ${subCmd2}`);

        if (subCmd2 === 0) {
          chestReceived = true;
          // Giải mã danh sách item trong rương
          const countBox = r.readShort();
          console.log(`\n  --- 📦 RƯƠNG ĐỒ TRONG NHÀ (count: ${countBox}) ---`);
          const boxItems: BoxItem[] = [];
          for (let i = 0; i < countBox; i++) {
            const index = r.readShort();
            const id = r.readShort();
            const date = r.readUTF();
            boxItems.push({ index, id, date });
            const info = resolvePartInfo(id);
            console.log(
              `    [${String(i + 1).padStart(2, ' ')}/${countBox}] Slot: ${String(index).padStart(2, ' ')} | ID: ${String(id).padStart(4, ' ')} | [${info.slot.padEnd(10, ' ')}] ${info.name.padEnd(20, ' ')} | Hạn: "${date}"`,
            );
          }

          // Giải mã danh sách item trong hành trang có thể cất vào rương
          const countInven = r.readShort();
          console.log(`\n  --- 🎒 HÀNH TRANG CÓ THỂ CẤT VÀO RƯƠNG (count: ${countInven}) ---`);
          const invenItems: BoxItem[] = [];
          for (let i = 0; i < countInven; i++) {
            const index = r.readShort();
            const id = r.readShort();
            const date = r.readUTF();
            invenItems.push({ index, id, date });
            const info = resolvePartInfo(id);
            console.log(
              `    [${String(i + 1).padStart(2, ' ')}/${countInven}] Slot: ${String(index).padStart(2, ' ')} | ID: ${String(id).padStart(4, ' ')} | [${info.slot.padEnd(10, ' ')}] ${info.name.padEnd(20, ' ')} | Hạn: "${date}"`,
            );
          }

          const discarded = r.readShort();
          const slot = r.readShort();
          const maxSlot = r.readShort();
          console.log(`\n  --- ℹ️ THÔNG TIN Ô RƯƠNG ---`);
          console.log(`    Số ô hiện tại : ${slot}`);
          console.log(`    Số ô tối đa   : ${maxSlot}`);
          console.log(`    Dữ liệu đệm   : ${discarded}`);
          if (r.available() > 0) {
            console.log(`    Byte dư thừa  : ${r.rest().toString('hex')}`);
          }
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

          console.log(`  🔒 RƯƠNG YÊU CẦU MẬT KHẨU!`);
          if (info) console.log(`     Thông tin   : "${info}"`);
          console.log(`     Khóa giỏ đồ : ${hasPassBag ? '🔐 CÓ' : '🔓 Không'}`);
          console.log(`     Khóa rương  : ${hasPassChest ? '🔐 CÓ' : '🔓 Không'}`);

          if (rawPass1) {
            let finalPassBag = '';
            let finalPassChest = '';

            if (rawPass2) {
              finalPassBag = rawPass1;
              finalPassChest = rawPass2;
            } else {
              // Tự động map thông minh theo cờ yêu cầu của Server
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
            console.log(
              `  ⚠️ Chưa cấu hình mật khẩu. Hãy truyền tham số: npx tsx --env-file=.env src/tools/chest-probe.ts ${accountId} <mat_khau>`,
            );
          }
        } else if (subCmd2 === 4) {
          const flag = r.readByte();
          let msgText = '';
          if (flag === 1) {
            msgText = r.readUTF();
          }
          console.log(`  ⚠️ Phản hồi từ rương (subCmd2=4): flag=${flag} msg="${msgText}"`);
          if (flag === 0 || msgText.toLowerCase().includes('mật khẩu') || msgText.toLowerCase().includes('pass')) {
            console.log(`  ❌ Mật khẩu không chính xác hoặc có lỗi đóng rương!`);
          }
        } else {
          console.log(`  subCmd2 chưa biết: ${subCmd2} (rest: ${r.rest().toString('hex')})`);
        }
      } else {
        console.log(`  subCmd khác: ${subCmd} (rest: ${r.rest().toString('hex')})`);
      }
    } catch (err) {
      console.error(`  Lỗi giải mã RX -87:`, err);
    }
    console.log(`======================================================\n`);
  }

  if (msg.command === -17) {
    // CONTAINER
    console.log(`\n======================================================`);
    console.log(`[RX -17] Nhận gói CONTAINER (${data.length} bytes): ${data.toString('hex')}`);
    try {
      const r = new MyReader(data);
      const countEquipped = r.readShort();
      console.log(`\n  --- 👔 TRANG BỊ ĐANG MẶC TRÊN NGƯỜI (count: ${countEquipped}) ---`);
      for (let i = 0; i < countEquipped; i++) {
        const idIndex = r.readShort();
        const idPart = r.readShort();
        const date = r.readUTF();
        const isEquipped = r.readBoolean();
        const info = resolvePartInfo(idPart);
        console.log(
          `    [${String(i + 1).padStart(2, ' ')}/${countEquipped}] Index: ${String(idIndex).padStart(2, ' ')} | ID: ${String(idPart).padStart(4, ' ')} | [${info.slot.padEnd(10, ' ')}] ${info.name.padEnd(20, ' ')} | Mặc: ${isEquipped ? '✅' : '❌'} | Hạn: "${date}"`,
        );
      }

      if (r.available() > 0) {
        const countInventory = r.readShort();
        console.log(`\n  --- 🎒 TRANG BỊ TRONG HÀNH TRANG CÁ NHÂN (count: ${countInventory}) ---`);
        for (let i = 0; i < countInventory; i++) {
          const idIndex = r.readShort();
          const idPart = r.readShort();
          const qty = r.readShort();
          const date = r.readUTF();
          const info = resolvePartInfo(idPart);
          console.log(
            `    [${String(i + 1).padStart(2, ' ')}/${countInventory}] Index: ${String(idIndex).padStart(2, ' ')} | ID: ${String(idPart).padStart(4, ' ')} | SL: ${String(qty).padStart(3, ' ')} | [${info.slot.padEnd(10, ' ')}] ${info.name.padEnd(20, ' ')} | Hạn: "${date}"`,
          );
        }
      }
      containerReceived = true;
    } catch (err) {
      console.error(`  Lỗi giải mã RX -17:`, err);
    }
    console.log(`======================================================\n`);
  }

  if (msg.command === -89) {
    console.log(`[RX -89] TRANS_PART_CHEST: ${data.toString('hex')}`);
  }

  if (msg.command === -88) {
    console.log(`[RX -88] PASS_CHEST: ${data.toString('hex')}`);
  }

  if (msg.command === -67) {
    console.log(`[RX -67] UPDATE_CONTAINER: ${data.toString('hex')}`);
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

console.log('[CHEST-PROBE] Đang chờ đăng nhập và đồng bộ...');
await sleep(4000);

console.log(`[CHEST-PROBE] Player ID: ${client.playerId}`);

// Thử yêu cầu rương đồ (CUSTOM_CHEST, subCmd 8, subCmd 3 -> lấy info rương)
console.log('\n>>> [TX -87] Gửi yêu cầu thông tin rương đồ (subCmd=8, subCmd2=3)...');
const reqChestInfo = Message.create(-87);
reqChestInfo.writer!.writeByte(8);
reqChestInfo.writer!.writeByte(3);
client.session.send(reqChestInfo);

await sleep(1500);

// Gửi yêu cầu mở danh sách item trong rương (CUSTOM_CHEST, subCmd 8, subCmd 0: doBoxContain)
if (!chestReceived && !rawPass1) {
  console.log('>>> [TX -87] Gửi yêu cầu mở danh sách item trong rương đồ (subCmd=8, subCmd2=0)...');
  const reqChestItems = Message.create(-87);
  reqChestItems.writer!.writeByte(8);
  reqChestItems.writer!.writeByte(0);
  client.session.send(reqChestItems);
}

await sleep(2500);

// Thử yêu cầu hành trang cá nhân (CONTAINER, userId)
console.log('\n>>> [TX -17] Gửi yêu cầu lấy hành trang cá nhân (CONTAINER)...');
const reqContainer = Message.create(-17);
reqContainer.writer!.writeInt(client.playerId ?? -1);
client.session.send(reqContainer);

await sleep(3500);

if (!chestReceived) {
  // Thử phương án 2: vào nhà riêng rồi mở rương đồ
  console.log('\n[CHEST-PROBE] Thử vào farm/nhà rồi gửi lại yêu cầu rương đồ...');
  client.enterFarm();
  await sleep(3000);

  console.log('>>> [TX -87] Gửi lại yêu cầu mở rương đồ từ bên trong farm/nhà...');
  const reqChest2 = Message.create(-87);
  reqChest2.writer!.writeByte(8);
  reqChest2.writer!.writeByte(3);
  client.session.send(reqChest2);

  await sleep(1500);
  await sleep(2500);
}

console.log('\n[CHEST-PROBE] Hoàn tất quá trình probe.');
client.logout();
process.exit(0);
