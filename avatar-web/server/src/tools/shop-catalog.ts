/**
 * Crawl toàn bộ dữ liệu cửa hàng farm từ server game.
 *
 *   npx tsx --env-file=.env src/tools/shop-catalog.ts [accountId]
 *
 * Đăng nhập → vào farm → gửi getTreeInfo (cmd 76) → decode & in ra JSON:
 *   - Bảng cây trồng (seeds): id, tên, thời gian lớn, giá, ảnh giai đoạn
 *   - Bảng vật phẩm (items): id, icon, type, tên, giá xu
 *   - Bảng vật nuôi (animals): id, tên, mô tả, specs (thời gian lớn/sống, có sản phẩm)
 *
 * Chỉ đọc: đăng nhập, lấy dữ liệu, in, thoát. Không mua, không trồng.
 */
import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import {
  decodeTreeInfo,
  decodeAllTreeInfo,
  decodeItemCatalog,
  decodeAnimalCatalog,
  parseAnimalSpec,
  type TreeInfo,
  type ItemInfo,
  type AnimalInfo,
} from '../game/farmData.js';
import { loadConfig } from '../config.js';

const accountId = Number(process.argv[2] ?? 1);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const row = getAccountById(db, accountId);
if (!row) throw new Error(`không có tài khoản #${accountId}`);

const c = new GameClient();
c.on('log', (l: string) => console.error('   LOG', l));

// ---- kết nối & vào farm ----

console.error(`đăng nhập tài khoản #${accountId} (${row.gameUser}) -> ${row.host}:${row.port}`);
await c.login({
  host: row.host,
  port: row.port,
  user: row.gameUser,
  pass: readGamePass(db, cfg.masterKey, accountId),
});
await sleep(4000);

if (c.status !== 'online') {
  console.error(`đăng nhập thất bại: status=${c.status} error=${c.lastError}`);
  process.exit(1);
}

console.error('vào farm...');
const farmReady = new Promise<void>((r) => c.once('farm', () => r()));
c.enterFarm();
await farmReady;
await sleep(2000);

// ---- gửi getTreeInfo (cmd 76) ----

console.error('gửi getTreeInfo (cmd 76)...');

const got76 = new Promise<Buffer>((resolve) => {
  const handler = (m: { command: number; getData(): Buffer }) => {
    if (m.command === 76) {
      c.removeListener('message', handler);
      resolve(m.getData());
    }
  };
  c.on('message', handler);
});

c.farm.getTreeInfo();
const body = await Promise.race([
  got76,
  sleep(10_000).then(() => null),
]);

if (!body) {
  console.error('TIMEOUT: không nhận được gói 76 sau 10 giây.');
  c.logout();
  process.exit(1);
}

console.error(`nhận gói 76: ${body.length} byte\n`);

// ---- decode ----

const result: {
  trees: Array<TreeInfo & { growHoursNote: string }>;
  items: ItemInfo[];
  animals: Array<AnimalInfo & { spec: ReturnType<typeof parseAnimalSpec> }>;
  raw: { totalBytes: number; treeRestBytes: number };
} = {
  trees: [],
  items: [],
  animals: [],
  raw: { totalBytes: body.length, treeRestBytes: 0 },
};

// 1. Bảng cây trồng (bao gồm cả cây xu gốc và cây cao cấp mở rộng)
try {
  const trees = decodeAllTreeInfo(body);
  const { restHex } = decodeTreeInfo(body);
  result.raw.treeRestBytes = restHex.length / 2;
  result.trees = trees.map((t) => ({
    ...t,
    growHoursNote: `${t.growMinutes} giờ = ${t.growMinutes * 60} phút`,
  }));
  console.error(`bảng cây: ${trees.length} loại (gồm ${trees.filter(t => t.category === 'xu').length} cây xu, ${trees.filter(t => t.category === 'premium').length} cây cao cấp)`);
} catch (e) {
  console.error(`decodeTreeInfo lỗi: ${(e as Error).message}`);
}

// 2. Bảng vật phẩm
try {
  result.items = decodeItemCatalog(body);
  console.error(`bảng vật phẩm: ${result.items.length} loại`);
} catch (e) {
  console.error(`decodeItemCatalog lỗi: ${(e as Error).message}`);
}

// 3. Bảng vật nuôi
try {
  const animals = decodeAnimalCatalog(body);
  result.animals = animals.map((a) => ({
    ...a,
    spec: parseAnimalSpec(a.desc),
  }));
  console.error(`bảng vật nuôi: ${result.animals.length} loại`);
} catch (e) {
  console.error(`decodeAnimalCatalog lỗi: ${(e as Error).message}`);
}

// ---- output JSON (stdout) ----

console.log(JSON.stringify(result, null, 2));

c.logout();
process.exit(0);
