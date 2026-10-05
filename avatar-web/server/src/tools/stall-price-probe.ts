/**
 * Probe lấy danh sách giá min/max và tên các loại nông sản đưa lên sạp bán (cmd 103 sub 8).
 *   npx tsx --env-file=.env src/tools/stall-price-probe.ts [accountId]
 */
import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { getProduceOrItemName, decodeAllTreeInfo } from '../game/farmData.js';
import { loadConfig } from '../config.js';
import {
  STALL_INNER_PRICE_LIMITS,
  resolveEffectivePriceRules,
  type ShopPriceRule,
  type DecodedShopPacket,
} from '../game/shopProtocol.js';

const accountId = Number(process.argv[2] ?? 1);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const row = getAccountById(db, accountId);
if (!row) {
  console.error(`Không tìm thấy tài khoản #${accountId}`);
  process.exit(1);
}

const c = new GameClient();
c.on('log', (msg: string) => console.log(`[LOG] ${msg}`));

console.log(`Đang đăng nhập tài khoản #${accountId} (${row.gameUser})...`);
await c.login({
  host: row.host,
  port: row.port,
  user: row.gameUser,
  pass: readGamePass(db, cfg.masterKey, accountId),
});
await sleep(3500);

if (c.status !== 'online') {
  console.error(`Đăng nhập thất bại: status=${c.status} error=${c.lastError}`);
  process.exit(1);
}

console.log('Đang vào nông trại...');
const farmReady = new Promise<void>((r) => c.once('farm', () => r()));
c.enterFarm();
await farmReady;
await sleep(1500);

console.log('Đang lấy catalog nông trại (cmd 76)...');
const treesReady = new Promise<void>((r) => c.once('trees', () => r()));
c.farm.getTreeInfo();
await Promise.race([treesReady, sleep(5000)]);
await sleep(1000);

// Nạp thêm cây premium nếu có
const raw76 = c.lastPacket.get(76);
if (raw76) {
  try {
    const allTrees = decodeAllTreeInfo(Buffer.from(raw76, 'hex'));
    if (allTrees.length > c.trees.length) {
      c.trees = allTrees;
    }
  } catch {
    /* ignore */
  }
}

console.log('Mở sạp cá nhân (cmd 103 sub 0)...');
let ownSlots: any[] = [];
const ownShopReady = new Promise<void>((resolve) => {
  const handler = (decoded: DecodedShopPacket) => {
    if (decoded.event.subType === 0) {
      c.off('shop-protocol', handler);
      ownSlots = decoded.event.slots;
      console.log('Sạp của mình:', JSON.stringify(decoded.event, null, 2));
      resolve();
    }
  };
  c.on('shop-protocol', handler);
});
c.farm.openShop(0, -1, -1);
await Promise.race([ownShopReady, sleep(5000)]);
await sleep(1000);

console.log('Lấy danh mục thị trường chợ (cmd 103 sub 1: market-catalog)...');
let marketCatalogItems: Array<{ itemId: number; price: number }> = [];
const marketReady = new Promise<void>((resolve) => {
  const handler = (decoded: DecodedShopPacket) => {
    if (decoded.event.subType === 1 && decoded.event.status === 0) {
      c.off('shop-protocol', handler);
      marketCatalogItems = decoded.event.items;
      resolve();
    }
  };
  c.on('shop-protocol', handler);
});
c.farm.openShop(1, 0, -1);
await Promise.race([marketReady, sleep(5000)]);
console.log(`Thị trường đang có ${marketCatalogItems.length} loại nông sản được bày bán.`);
if (marketCatalogItems.length > 0) {
  console.log(`  Items trên chợ: ${marketCatalogItems.map((m) => `#${m.itemId} (giá ${m.price})`).join(', ')}`);
}

console.log('Lấy danh sách giá quy định sạp (cmd 103 sub 8: getShopItems)...');
let priceRules: ShopPriceRule[] = [];
let raw103Hex = '';
const rulesReady = new Promise<void>((resolve) => {
  const msgHandler = (m: { command: number; getData(): Buffer }) => {
    if (m.command === 103) {
      const data = m.getData();
      if (data.length > 0 && data[0] === 8) {
        raw103Hex = data.toString('hex');
      }
    }
  };
  c.on('message', msgHandler);
  const handler = (decoded: DecodedShopPacket) => {
    if (decoded.event.subType === 8) {
      c.off('shop-protocol', handler);
      priceRules = decoded.event.rules;
      resolve();
    }
  };
  c.on('shop-protocol', handler);
});
c.farm.getShopItems();
await Promise.race([rulesReady, sleep(5000)]);

if (priceRules.length === 0) {
  console.log('Thử gửi lại cmd 103 sub 8 trực tiếp...');
  c.farm.getShopItems();
  await Promise.race([rulesReady, sleep(5000)]);
}

console.log(`\nRAW HEX cmd 103 sub 8: ${raw103Hex}\n`);

console.log(`\n===============================================================`);
console.log(`📊 DANH SÁCH GIÁ QUY ĐỊNH SẠP BÁN (Tổng số: ${priceRules.length} mặt hàng)`);
console.log(`===============================================================`);

// Chuẩn hoá rules theo hàm dùng chung resolveEffectivePriceRules
const effectiveRulesMap = new Map(resolveEffectivePriceRules(priceRules).map((r) => [r.itemId, r]));

const formattedRules = priceRules.map((r) => {
  const inner = STALL_INNER_PRICE_LIMITS[r.itemId];
  const eff = effectiveRulesMap.get(r.itemId);
  const name = r.itemId === 200 ? 'Bắp hạt' : getProduceOrItemName(r.itemId, c.trees, c.items);
  const isLivestock = [50, 51, 55, 56, 60].includes(r.itemId);

  return {
    itemId: r.itemId,
    name,
    category: isLivestock ? 'Chăn nuôi' : 'Cây trồng',
    protocolMin: r.minPrice,
    protocolMax: r.maxPrice,
    innerMin: inner?.innerMin ?? r.minPrice,
    innerMax: inner?.innerMax ?? r.maxPrice,
    effectiveMin: eff?.minPrice ?? r.minPrice,
    effectiveMax: eff?.maxPrice ?? r.maxPrice,
  };
});

// Sắp xếp theo itemId tăng dần
formattedRules.sort((a, b) => a.itemId - b.itemId);

console.log(
  `| ${'ID'.padStart(4)} | ${'Tên nông sản'.padEnd(20)} | ${'Nhóm'.padEnd(10)} | ${'Protocol'.padStart(10)} | ${'Inner Server'.padStart(14)} | ${'Thực tế bán được'.padStart(18)} |`,
);
console.log(`|------|----------------------|------------|------------|----------------|--------------------|`);
for (const item of formattedRules) {
  const proto = `${item.protocolMin}-${item.protocolMax}`;
  const inner = `${item.innerMin}-${item.innerMax} xu`;
  const eff = `${item.effectiveMin}-${item.effectiveMax} xu`;
  console.log(
    `| ${String(item.itemId).padStart(4)} | ${item.name.padEnd(20)} | ${item.category.padEnd(10)} | ${proto.padStart(10)} | ${inner.padStart(14)} | ${eff.padStart(18)} |`,
  );
}

// In dạng JSON thu gọn để tiện copy hoặc dùng cho config/test
console.log(`\n--- JSON DỮ LIỆU ĐẦY ĐỦ ---`);
console.log(JSON.stringify(formattedRules, null, 2));

c.logout();
process.exit(0);
