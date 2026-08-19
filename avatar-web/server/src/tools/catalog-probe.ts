/**
 * Khảo sát gói 76 (GET_TREE_INFO) với server thật — trả lời hai câu:
 *
 *   1. Sau GET_HANDLER farm, server có TỰ ĐỘNG đẩy gói 76 không?
 *   2. Nếu không, gọi `getTreeInfo()` thì server trả gì — và phần đầu gói
 *      có tiền tố gì không?
 *
 * Dùng cho việc "setting cây trồng phải lấy TẤT CẢ cây có trong cửa hàng":
 * hiện mới lấy được catalog khi đang chạy auto (kèm state máy chủ).
 *   npx tsx --env-file=.env src/tools/catalog-probe.ts [accountId]
 *
 * Chỉ đọc: đăng nhập, vào farm, in log, thoát. Không mua, không trồng.
 */
import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { decodeTreeInfo, decodeItemCatalog } from '../game/farmData.js';
import { loadConfig } from '../config.js';
import { writeFileSync } from 'node:fs';

const accountId = Number(process.argv[2] ?? 1);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const row = getAccountById(db, accountId);
if (!row) throw new Error(`không có tài khoản #${accountId}`);

const c = new GameClient();
c.on('log', (l: string) => console.log('   LOG', l));
const seen76 = new Map<number, Buffer>();
c.on('message', (m: { command: number; getData(): Buffer }) => {
  const b = m.getData();
  if (m.command === 76) {
    seen76.set(Date.now(), b);
    console.log(`   RX  cmd=76 len=${b.length} prefix=${b.subarray(0, 32).toString('hex')}`);
  } else if ([-40, -36, -38].includes(m.command)) {
    // bỏ qua gói nhịp
  } else {
    console.log(`   RX  cmd=${m.command} len=${b.length} hex=${b.subarray(0, 32).toString('hex')}`);
  }
});

console.log(`đăng nhập tài khoản #${accountId} (${row.gameUser}) -> ${row.host}:${row.port}`);
await c.login({
  host: row.host,
  port: row.port,
  user: row.gameUser,
  pass: readGamePass(db, cfg.masterKey, accountId),
});
await sleep(4000);
console.log('status =', c.status, '· playerId =', c.playerId);

// Bước 1: enterFarm — quan sát server có tự đẩy gói 76 không
const farmReady = new Promise<void>((r) => c.once('farm', () => r()));
console.log('\n--- B1: enterFarm (chờ gói 69 + 76 tự động, 6s) ---');
c.enterFarm();
await farmReady;
await sleep(6000);
console.log('gói 76 tự động sau enterFarm:', seen76.size);

// Bước 2: gọi getTreeInfo thủ công
console.log('\n--- B2: getTreeInfo() thủ công ---');
c.farm.getTreeInfo();
await sleep(5000);
console.log('gói 76 sau getTreeInfo:', seen76.size);

  if (seen76.size > 0) {
    const body = [...seen76.values()][seen76.size - 1]!;
    writeFileSync('/private/tmp/avatar-cmd76-account2.hex', body.toString('hex'));
    console.log('đã lưu raw packet: /private/tmp/avatar-cmd76-account2.hex');
  console.log(`\n--- phân tích gói 76 cuối (${body.length} byte) ---`);
  // Thử decode trực tiếp
  try {
    const { trees, restHex } = decodeTreeInfo(body);
    console.log(`decodeTreeInfo: ${trees.length} cây, rest ${restHex.length / 2} byte`);
    for (const t of trees) console.log(`   #${t.id} ${t.name} grow=${t.growMinutes} value=${t.value}`);
  } catch (e) {
    console.log(`decodeTreeInfo lỗi: ${(e as Error).message}`);
  }
  // Phỏng đoán tiền tố: nhiều gói server dạng `[u16 len][utf8 title]` (vd -40).
  const n16 = body.readUInt16BE(0);
  if (n16 > 0 && n16 + 2 <= body.length) {
    const maybe = body.subarray(2, 2 + n16).toString('utf8');
    if (/[\p{L}\s]/u.test(maybe) && !maybe.includes('�')) {
      console.log(`2 byte đầu = u16 ${n16} -> có vẻ là tiêu đề UTF: "${maybe}"`);
      try {
        const { trees } = decodeTreeInfo(body.subarray(2 + n16));
        console.log(`decodeTreeInfo(sau tiêu đề): ${trees.length} cây`);
        for (const t of trees) console.log(`   #${t.id} ${t.name}`);
      } catch (e) {
        console.log(`decodeTreeInfo(sau tiêu đề) lỗi: ${(e as Error).message}`);
      }
    }
  }
  // Thử decodeItemCatalog
  try {
    const items = decodeItemCatalog(body);
    console.log(`decodeItemCatalog: ${items.length} món`);
    console.log(items.slice(0, 8).map((i) => `#${i.id} ${i.name} type=${i.type} giá=${i.price}`).join('\n   ') || '   (rỗng)');
  } catch (e) {
    console.log(`decodeItemCatalog lỗi: ${(e as Error).message}`);
  }
} else {
  console.log('\nKHÔNG nhận được gói 76 nào — giả thuyết "server tự đẩy" SAI.');
  console.log('Cần dò thêm: có thể phải gọi openShop hoặc requestPricePlant trước.');
}

c.logout();
process.exit(0);
