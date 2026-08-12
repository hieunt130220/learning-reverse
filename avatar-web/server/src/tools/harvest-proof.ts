/**
 * Bằng chứng dứt điểm: thu hoạch có ăn không?
 *   npx tsx --env-file=.env src/tools/harvest-proof.ts [accountId] [soÔ]
 *
 * So kho TRƯỚC và SAU khi gửi doHervest. Thóc/nông sản vào kho là bằng chứng
 * lệnh chạy, không phụ thuộc việc server có đẩy INFO_CELL hay không.
 */
import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { loadConfig } from '../config.js';

const accountId = Number(process.argv[2] ?? 1);
const nCells = Number(process.argv[3] ?? 3);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const row = getAccountById(db, accountId);
if (!row) throw new Error(`không có tài khoản #${accountId}`);

const c = new GameClient();
const t0 = Date.now();
const ts = (): string => `+${String(Date.now() - t0).padStart(6)}ms`;
c.on('message', (m: { command: number; getData(): Buffer }) => {
  if ([64, 100, 61, -3, -40, 70].includes(m.command)) {
    console.log(`${ts()}  RX cmd=${m.command} hex=${m.getData().subarray(0, 32).toString('hex')}`);
  }
});

await c.login({
  host: row.host,
  port: row.port,
  user: row.gameUser,
  pass: readGamePass(db, cfg.masterKey, accountId),
});
await sleep(3500);

const farmReady = new Promise<void>((r) => c.once('farm', () => r()));
c.enterFarm();
await farmReady;
await sleep(1500);

async function inv(): Promise<Map<number, number>> {
  const ready = new Promise<void>((r) => c.once('inventory', () => r()));
  c.farm.getInventory();
  await Promise.race([ready, sleep(6000)]);
  return new Map(c.inventory.map((i) => [i.id, i.num]));
}

const before = await inv();
console.log(`\nkho TRƯỚC (${before.size} loại): ${[...before].map(([id, n]) => `#${id}×${n}`).join(' ')}`);

const farm = c.farmState!;
const only = Number(process.env.CELL ?? NaN);
const targets = Number.isFinite(only)
  ? farm.cells.filter((x) => x.index === only)
  : farm.cells.filter((x) => x.idTree !== -1).slice(0, nCells);
console.log(`\nthu hoạch ${targets.length} ô: ${targets.map((x) => x.index).join(', ')}`);
for (const t of targets) {
  console.log(`${ts()}  TX harvest(${farm.idFarm}, ô ${t.index})  [idTree=${t.idTree} time=${t.time} herv=${t.hervestPer}]`);
  c.farm.harvest(farm.idFarm, t.index);
  await sleep(1200);
}

await sleep(4000);
const after = await inv();
console.log(`\nkho SAU (${after.size} loại): ${[...after].map(([id, n]) => `#${id}×${n}`).join(' ')}`);

console.log('\n================ CHÊNH LỆCH KHO ================');
const ids = new Set([...before.keys(), ...after.keys()]);
let changed = false;
for (const id of ids) {
  const d = (after.get(id) ?? 0) - (before.get(id) ?? 0);
  if (d !== 0) {
    changed = true;
    console.log(`  #${id}: ${before.get(id) ?? 0} -> ${after.get(id) ?? 0}  (${d > 0 ? '+' : ''}${d})`);
  }
}
if (!changed) console.log('  (không đổi gì -> lệnh thu hoạch KHÔNG có tác dụng)');

const again = new Promise<void>((r) => c.once('farm', () => r()));
c.enterFarm();
await again;
await sleep(1200);
console.log('\n================ Ô SAU KHI THU ================');
for (const t of targets) {
  const a = c.farmState!.cells[t.index]!;
  console.log(
    `  ô ${t.index}: idTree ${t.idTree}->${a.idTree}  time ${t.time}->${a.time}  hervestPer ${t.hervestPer}->${a.hervestPer}`,
  );
}

c.logout();
process.exit(0);
