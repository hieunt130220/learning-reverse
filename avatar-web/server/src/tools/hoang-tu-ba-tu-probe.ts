/**
 * hoang-tu-ba-tu-probe.ts — Probe giao thức Luyện Đá tại NPC Hoàng Tử Ba Tư (Map 17 - Khu Ngoại Ô).
 *
 * Spec: docs/superpowers/specs/2026-10-23-probe-luyen-da-hoang-tu-ba-tu-design.md
 * Plan: docs/superpowers/plans/2026-10-23-probe-luyen-da-hoang-tu-ba-tu.md
 *
 * Cách chạy:
 *   1. Mở menu cấp 1:
 *      set -a; source .env; set +a; npx tsx src/tools/hoang-tu-ba-tu-probe.ts --account-id 1 --open-menu
 *   2. Chọn nhánh chức năng menu:
 *      set -a; source .env; set +a; npx tsx src/tools/hoang-tu-ba-tu-probe.ts --account-id 1 --select-menu <index>
 */
import { get as httpGet } from 'node:http';

import { getAccountById, readGamePass } from '../accounts/repo.js';
import { loadConfig } from '../config.js';
import { openDb } from '../db/index.js';
import { GameClient, type ClientStatus } from '../game/client.js';
import type { Message } from '../proto/message.js';
import { MyReader } from '../proto/reader.js';

export const HOANG_TU_BA_TU_ID = 2000000090;
export const MAP_NGOAI_O = 17;

export interface ProbeArgs {
  accountId: number;
  area: number;
  openMenu: boolean;
  selectMenu?: number;
  upgradeStone?: number;
  count: number;
}

export interface NpcMenuResponse {
  uid: number;
  typeMenu: number;
  count: number;
  items: string[];
}

export interface DialogResponse {
  text: string;
}

export interface ShopUpgradeItem {
  idPart: number;
  text: string;
}

export interface ShopUpgradeResponse {
  typeShop: number;
  idShop: number;
  idBoss: number;
  nameShop: string;
  count: number;
  items: ShopUpgradeItem[];
}

export interface InstructionResponse {
  title: string;
  content: string;
}

export interface UpgradeAttemptResult {
  type: 'success' | 'fail' | 'stop' | 'unknown';
  message: string;
}

export const STONE_NAMES: Record<number, string> = {
  0: 'Đá Lục (Yêu cầu: 5 Đá Trắng + 3 Củi | Tỷ lệ: 80%)',
  1: 'Đá Lam (Yêu cầu: 5 Đá Lục + 5 Củi | Tỷ lệ: 70%)',
  2: 'Đá Hồng (Yêu cầu: 5 Đá Lam + 7 Củi | Tỷ lệ: 60%)',
  3: 'Đá Tím (Yêu cầu: 5 Đá Hồng + 9 Củi | Tỷ lệ: 40%)',
  4: 'Đá Vàng (Yêu cầu: 5 Đá Tím + 11 Củi | Tỷ lệ: 20%)',
  5: 'Đá Đỏ (Yêu cầu: 5 Đá Vàng + 13 Củi | Tỷ lệ: 10%)',
};

/**
 * Phân loại phản hồi từ server sau khi gửi lệnh nâng cấp đá TX -74.
 */
export function parseUpgradeResponse(cmd: number, body: Buffer): UpgradeAttemptResult {
  if (cmd === -40) {
    const text = decodeDialogPacket(body).text;
    const lower = text.toLowerCase();
    const isOutOfMaterial =
      lower.includes('không đủ') ||
      lower.includes('không có đủ') ||
      lower.includes('hết') ||
      lower.includes('cần ít nhất');

    if (isOutOfMaterial) {
      return { type: 'stop', message: text };
    }

    const isSuccess = lower.includes('thành công') || lower.includes('chúc mừng');
    const isFail = lower.includes('thất bại') || lower.includes('vỡ');

    return {
      type: isSuccess ? 'success' : isFail ? 'fail' : 'unknown',
      message: text,
    };
  }
  if (cmd === -78) {
    const r = new MyReader(body);
    const text = r.readUTF();
    const isSuccess = text.toLowerCase().includes('thành công');
    return {
      type: isSuccess ? 'success' : 'fail',
      message: text,
    };
  }
  if (cmd === -62) {
    const info = decodeInstructionPacket(body);
    const combined = info.title ? `${info.title}: ${info.content}` : info.content;
    const isSuccess = combined.toLowerCase().includes('thành công');
    return {
      type: isSuccess ? 'success' : 'fail',
      message: combined,
    };
  }
  return {
    type: 'unknown',
    message: `Gói tin đặc thù cmd=${cmd}, len=${body.length}, hex=${body.toString('hex')}`,
  };
}

const ALLOWED_KEYS = new Set([
  '--account-id',
  '--area',
  '--open-menu',
  '--select-menu',
  '--upgrade-stone',
  '--count',
]);

export function parseArgs(argv: string[]): ProbeArgs {
  let accountId = 1;
  let area = 0;
  let openMenu = false;
  let selectMenu: number | undefined;
  let upgradeStone: number | undefined;
  let count = 1;

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i]!;
    if (!ALLOWED_KEYS.has(key)) {
      throw new Error(`Tùy chọn không được hỗ trợ: ${key}`);
    }
    if (key === '--open-menu') {
      openMenu = true;
      continue;
    }
    const val = argv[i + 1];
    if (val === undefined || val.startsWith('--')) {
      throw new Error(`Thiếu giá trị cho ${key}`);
    }
    i += 1;
    const num = Number(val);
    if (!Number.isSafeInteger(num)) {
      throw new Error(`Giá trị của ${key} phải là số nguyên`);
    }
    if (key === '--account-id') accountId = num;
    else if (key === '--area') area = num;
    else if (key === '--select-menu') {
      selectMenu = num;
      openMenu = true;
    } else if (key === '--upgrade-stone') {
      if (num < 0 || num > 5) {
        throw new Error(
          `Giá trị của --upgrade-stone phải nằm trong khoảng [0..5] (0: Lục, 1: Lam, 2: Hồng, 3: Tím, 4: Vàng, 5: Đỏ)`,
        );
      }
      upgradeStone = num;
      openMenu = true;
    } else if (key === '--count') {
      if (num < 1 || num > 50000) {
        throw new Error(`Giá trị của --count phải nằm trong khoảng [1..50]`);
      }
      count = num;
    }
  }

  return { accountId, area, openMenu, selectMenu, upgradeStone, count };
}

/**
 * Giải mã gói tin RX -61 (MENU_OPTION) trả về từ server khi bấm vào NPC.
 * Cấu trúc nhị phân theo Big-endian:
 * - i32 uid: Session ID của menu
 * - i8 typeMenu: Kiểu menu
 * - i8 count: Số lượng mục chọn
 * - lặp count lần:
 *     chuỗi UTF-8 tương ứng với tiêu đề mục chọn
 */
export function decodeMenuPacket(body: Buffer): NpcMenuResponse {
  const r = new MyReader(body);
  const uid = r.readInt();
  const typeMenu = r.readByte();
  const count = r.readByte();
  const items: string[] = [];
  for (let i = 0; i < count; i += 1) {
    items.push(r.readUTF());
  }
  return { uid, typeMenu, count, items };
}

export function decodeDialogPacket(body: Buffer): DialogResponse {
  try {
    const r = new MyReader(body);
    const text = r.readUTF();
    return { text };
  } catch {
    return { text: body.toString('utf8') };
  }
}

export function decodeShopUpgradePacket(body: Buffer): ShopUpgradeResponse {
  const r = new MyReader(body);
  const typeShop = r.readByte();
  const idBoss = r.readInt();
  const idShop = r.readByte();
  const nameShop = r.readUTF();
  const count = r.readShort();
  const items: ShopUpgradeItem[] = [];
  for (let i = 0; i < count; i += 1) {
    const idPart = r.readShort();
    const text = r.readUTF();
    items.push({ idPart, text });
  }
  return { typeShop, idShop, idBoss, nameShop, count, items };
}

export function decodeInstructionPacket(body: Buffer): InstructionResponse {
  const r = new MyReader(body);
  const title = r.readUTF();
  const content = r.readUTF();
  return { title, content };
}

function assertAvatarWebStopped(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve();
    };

    const req = httpGet(
      { host: '127.0.0.1', port, path: '/api/auth/me', timeout: 750 },
      (res) => {
        res.resume();
        finish(new Error(`avatar-web đang chạy tại port ${port}; hãy dừng server trước khi probe`));
        req.destroy();
      },
    );
    req.once('timeout', () => { req.destroy(); finish(); });
    req.once('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      if (err.code === 'ECONNREFUSED') { finish(); return; }
      finish(new Error(`Health-check localhost thất bại (${err.code ?? 'UNKNOWN'})`));
    });
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  await assertAvatarWebStopped(config.port);

  const db = openDb(config.dbPath);
  const account = getAccountById(db, args.accountId);
  if (!account) {
    throw new Error(`Không tìm thấy tài khoản với id=${args.accountId}`);
  }
  const password = readGamePass(db, config.masterKey, args.accountId);

  console.log(`=== Probe Hoàng Tử Ba Tư (Map ${MAP_NGOAI_O} - Khu Ngoại Ô) ===`);
  console.log(`Tài khoản #${account.id} (${account.gameUser}) -> Server: ${account.host}:${account.port}`);

  const client = new GameClient();
  const rawPackets: Array<{ cmd: number; len: number; hex: string }> = [];

  client.on('log', (msg) => console.log(`  [client] ${msg}`));

  try {
    console.log('\n--- Bước 1: Đăng nhập game ---');
    await client.login({
      host: account.host,
      port: account.port,
      user: account.gameUser,
      pass: password,
    });

    console.log('--- Bước 2: Chuyển ngữ cảnh Park (Handler 9) ---');
    const parkAck = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Hết giờ chờ Handler Park (RX -1 [9])')), 5000);
      const onMsg = (msg: Message) => {
        if (msg.command === -1 && msg.getData().length === 1 && msg.getData().readInt8(0) === 9) {
          clearTimeout(timer);
          client.session.removeListener('message', onMsg);
          resolve();
        }
      };
      client.session.on('message', onMsg);
    });
    client.enterParkContext();
    await parkAck;

    console.log(`--- Bước 3: Tham gia Map ${MAP_NGOAI_O} (Khu Ngoại Ô - Board ${args.area}) ---`);
    const joinAck = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Hết giờ chờ snapshot Map 17 (RX 80)')), 7000);
      const onMsg = (msg: Message) => {
        if (msg.command === 80) {
          clearTimeout(timer);
          client.session.removeListener('message', onMsg);
          resolve();
        }
      };
      client.session.on('message', onMsg);
    });
    client.sendRaw(80, [
      { t: 'i8', v: String(MAP_NGOAI_O) },
      { t: 'i8', v: String(args.area) },
      { t: 'i16', v: '100' },
      { t: 'i16', v: '100' },
    ]);
    await joinAck;
    console.log(`  -> Đã vào Map ${MAP_NGOAI_O} Board ${args.area} thành công.`);

    if (!args.openMenu) {
      console.log('Chế độ chỉ join map xong. Kết thúc.');
      return;
    }

    console.log(`\n--- Bước 4: Tương tác thoại NPC Hoàng Tử Ba Tư (TX -59 [${HOANG_TU_BA_TU_ID}]) ---`);
    const menuPromise = new Promise<{ menu?: NpcMenuResponse; dialog?: DialogResponse }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Hết giờ chờ phản hồi menu từ NPC (RX -61 / RX -40)')), 7000);
      const onMsg = (msg: Message) => {
        const cmd = msg.command;
        const b = msg.getData();
        if (cmd === -61) {
          clearTimeout(timer);
          client.session.removeListener('message', onMsg);
          resolve({ menu: decodeMenuPacket(b) });
        } else if (cmd === -40) {
          clearTimeout(timer);
          client.session.removeListener('message', onMsg);
          resolve({ dialog: decodeDialogPacket(b) });
        } else {
          rawPackets.push({ cmd, len: b.length, hex: b.subarray(0, 32).toString('hex') });
        }
      };
      client.session.on('message', onMsg);
    });

    client.sendRaw(-59, [{ t: 'i32', v: String(HOANG_TU_BA_TU_ID) }]);
    const firstResp = await menuPromise;

    if (firstResp.dialog) {
      console.log(`  💬 Hộp thoại từ NPC: "${firstResp.dialog.text}"`);
    }

    if (firstResp.menu) {
      const { uid, typeMenu, count, items } = firstResp.menu;
      console.log(`  📋 Nhận Menu RX -61: session uid=${uid}, typeMenu=${typeMenu}, số mục=${count}`);
      items.forEach((item, idx) => {
        console.log(`     [${idx}] ${item}`);
      });

      if (args.upgradeStone !== undefined) {
        const stoneIdx = args.upgradeStone;
        console.log(`\n--- Bước 5: Mở Menu Luyện Đá (TX -61 [uid=${uid}, 0, 1]) ---`);
        const openUpgradePromise = new Promise<ShopUpgradeResponse>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Hết giờ chờ giao diện Shop nâng cấp (RX -74)')), 7000);
          const onMsg = (msg: Message) => {
            if (msg.command === -74) {
              clearTimeout(timer);
              client.session.removeListener('message', onMsg);
              resolve(decodeShopUpgradePacket(msg.getData()));
            }
          };
          client.session.on('message', onMsg);
        });

        client.sendRaw(-61, [
          { t: 'i32', v: String(uid) },
          { t: 'i8', v: '0' },
          { t: 'i8', v: '1' }, // Option 1: "Luyện đá"
        ]);
        const shop = await openUpgradePromise;
        const selectedRecipe = shop.items[stoneIdx];
        console.log(`  🏪 Đã mở "${shop.nameShop}".`);
        console.log(`  🎯 Mục tiêu luyện: [${stoneIdx}] ${selectedRecipe ? selectedRecipe.text : STONE_NAMES[stoneIdx]}`);

        console.log(`\n--- Bước 6: Tiến hành Luyện Đá (${args.count} lượt) ---`);
        let successCount = 0;
        let failCount = 0;
        let stopReason: string | undefined;

        for (let turn = 1; turn <= args.count; turn += 1) {
          console.log(`\n  >> [Lượt ${turn}/${args.count}] Gửi TX -74 [idBoss=${shop.idBoss}, idShop=${shop.idShop}, item=${stoneIdx}]...`);
          const attemptPromise = new Promise<UpgradeAttemptResult>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Hết giờ chờ kết quả luyện đá lượt ${turn}`)), 7000);
            const onMsg = (msg: Message) => {
              const cmd = msg.command;
              const b = msg.getData();
              console.log(`     [RX] cmd=${cmd}, len=${b.length}, hex=${b.subarray(0, 32).toString('hex')}`);
              if (cmd === -40 || cmd === -78 || cmd === -62 || cmd === -77 || cmd === -74 || cmd === -19) {
                clearTimeout(timer);
                client.session.removeListener('message', onMsg);
                resolve(parseUpgradeResponse(cmd, b));
              }
            };
            client.session.on('message', onMsg);
          });

          // TX -74: [i32 idBoss1, i8 idShop, i16 ii]
          client.sendRaw(-74, [
            { t: 'i32', v: String(shop.idBoss) },
            { t: 'i8', v: String(shop.idShop) },
            { t: 'i16', v: String(stoneIdx) },
          ]);

          const res = await attemptPromise;
          console.log(`     Kết quả: [${res.type.toUpperCase()}] ${res.message}`);

          if (res.type === 'success') {
            successCount += 1;
          } else if (res.type === 'fail') {
            failCount += 1;
          } else if (res.type === 'stop') {
            stopReason = res.message;
            console.log(`  🛑 Nhận tín hiệu dừng từ server: "${res.message}". Hủy các lượt còn lại.`);
            break;
          }

          if (turn < args.count) {
            await new Promise((r) => setTimeout(r, 1200));
          }
        }

        console.log(`\n================ BẢNG THỐNG KÊ LUYỆN ĐÁ ================`);
        console.log(`  Vật phẩm: ${STONE_NAMES[stoneIdx]}`);
        console.log(`  Tổng số lượt yêu cầu: ${args.count}`);
        console.log(`  Số lượt đã thực hiện: ${successCount + failCount + (stopReason ? 1 : 0)}`);
        console.log(`  Thành công: ${successCount} | Thất bại: ${failCount}`);
        if (successCount + failCount > 0) {
          const rate = ((successCount / (successCount + failCount)) * 100).toFixed(1);
          console.log(`  Tỷ lệ thành công thực tế: ${rate}%`);
        }
        if (stopReason) {
          console.log(`  Lý do dừng sớm: ${stopReason}`);
        }
        console.log(`========================================================`);
      } else if (args.selectMenu !== undefined) {
        const targetIdx = args.selectMenu;
        if (targetIdx < 0 || targetIdx >= count) {
          console.log(`  ⚠️ Chỉ số menu --select-menu ${targetIdx} vượt ngoài phạm vi [0..${count - 1}]`);
        } else {
          console.log(`\n--- Bước 5: Chọn mục menu [${targetIdx}] "${items[targetIdx]}" (TX -61) ---`);
          const selectPromise = new Promise<{
            menu?: NpcMenuResponse;
            dialog?: DialogResponse;
            shop?: ShopUpgradeResponse;
            instruction?: InstructionResponse;
            raw?: { cmd: number; hex: string };
          }>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Hết giờ chờ phản hồi sau khi chọn menu')), 7000);
            const onMsg = (msg: Message) => {
              const cmd = msg.command;
              const b = msg.getData();
              clearTimeout(timer);
              client.session.removeListener('message', onMsg);
              if (cmd === -61) {
                resolve({ menu: decodeMenuPacket(b) });
              } else if (cmd === -40) {
                resolve({ dialog: decodeDialogPacket(b) });
              } else if (cmd === -74) {
                resolve({ shop: decodeShopUpgradePacket(b) });
              } else if (cmd === -62) {
                resolve({ instruction: decodeInstructionPacket(b) });
              } else {
                resolve({ raw: { cmd, hex: b.toString('hex') } });
              }
            };
            client.session.on('message', onMsg);
          });

          // TX -61: [i32 uid, i8 menuIndex=0, i8 subIndex=targetIdx]
          client.sendRaw(-61, [
            { t: 'i32', v: String(uid) },
            { t: 'i8', v: '0' },
            { t: 'i8', v: String(targetIdx) },
          ]);

          const selResp = await selectPromise;
          if (selResp.dialog) {
            console.log(`  💬 Phản hồi hộp thoại: "${selResp.dialog.text}"`);
          } else if (selResp.menu) {
            console.log(`  📋 Menu cấp 2 (uid=${selResp.menu.uid}, count=${selResp.menu.count}):`);
            selResp.menu.items.forEach((it, i) => console.log(`     [${i}] ${it}`));
          } else if (selResp.shop) {
            console.log(`  🏪 Giao diện nâng cấp/luyện đá: "${selResp.shop.nameShop}" (type=${selResp.shop.typeShop}, idBoss=${selResp.shop.idBoss}, số công thức=${selResp.shop.count}):`);
            selResp.shop.items.forEach((it, i) => {
              console.log(`     [${i}] (Icon Part ${it.idPart}):`);
              console.log(`         "${it.text}"`);
            });
          } else if (selResp.instruction) {
            console.log(`  📖 Hướng dẫn chi tiết: "${selResp.instruction.title}"`);
            console.log(`-----------------------------------------------------------------`);
            console.log(selResp.instruction.content);
            console.log(`-----------------------------------------------------------------`);
          } else if (selResp.raw) {
            console.log(`  📦 Phản hồi gói đặc thù cmd=${selResp.raw.cmd}: hex=${selResp.raw.hex}`);
          }
        }
      }
    }
  } finally {
    console.log('\n--- Bước 6: Đăng xuất an toàn ---');
    try {
      client.logout();
    } catch {
      /* ignore */
    }
    console.log('Hoàn thành phiên probe.');
  }
}

if (process.argv[1]?.endsWith('hoang-tu-ba-tu-probe.ts')) {
  main().catch((err) => {
    console.error('Lỗi probe:', (err as Error).message);
    process.exit(1);
  });
}
