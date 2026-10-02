/**
 * In CẢ 4 section của gói kho (cmd 70) + trạng thái ô đang theo dõi.
 *   npx tsx --env-file=.env src/tools/inv-dump.ts [accountId] [cellIdx]
 *
 * `GameClient.inventory` chỉ ghép section 1 (hạt) + 2 (vật phẩm) rồi bỏ section
 * 3/4 — nông sản thu được nhiều khả năng nằm ở đó, nên "kho không đổi" sau khi
 * thu hoạch có thể chỉ là do mình không nhìn tới.
 */
import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { decodeInventory, getProduceOrItemName } from '../game/farmData.js';
import { loadConfig } from '../config.js';

const accountId = Number(process.argv[2] ?? 1);
const cellIdx = Number(process.argv[3] ?? 0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const row = getAccountById(db, accountId)!;
const c = new GameClient();

await c.login({
  host: row.host,
  port: row.port,
  user: row.gameUser,
  pass: readGamePass(db, cfg.masterKey, accountId),
});
await sleep(3500);
const ready = new Promise<void>((r) => c.once('farm', () => r()));
c.enterFarm();
await ready;
await sleep(1200);

const invReady = new Promise<void>((r) => c.once('inventory', () => r()));
c.farm.getInventory();
await Promise.race([invReady, sleep(6000)]);

const raw = c.lastPacket.get(70);
if (raw) {
  const d = decodeInventory(Buffer.from(raw, 'hex'));
  console.log(`\nsection 1 (hạt)     : ${d.seeds.map((i) => `#${i.id}×${i.num}`).join(' ')}`);
  console.log(`section 2 (vật phẩm): ${d.items.map((i) => `#${i.id}×${i.num}`).join(' ')}`);
  d.other.forEach((s, n) => {
    console.log(`section ${n + 3} (?)       : ${s.map((i) => `#${i.id}×${i.num}`).join(' ')}`);
  });
  console.log(`đuôi chưa map        : ${d.restHex}`);
}

console.log('\n--- 🌾 KHO NÔNG SẢN TỔNG HỢP (GameClient.produce = Section 3 + 4) ---');
c.produce.forEach((i, idx) => {
  console.log(`  #${String(idx + 1).padStart(2, ' ')}: ${getProduceOrItemName(i.id)} (#${i.id}) × ${i.num}`);
});

const cell = c.farmState?.cells[cellIdx];
if (cell) {
  console.log(
    `\nô ${cellIdx}: idTree=${cell.idTree} time=${cell.time} vitality=${cell.vitalityPer} hervestPer=${cell.hervestPer}`,
  );
}

c.logout();
process.exit(0);
