/**
 * Gom 46 ô theo bộ giá trị giống nhau để thấy ô nào khác biệt.
 *   npx tsx --env-file=.env src/tools/cells-dump.ts [accountId]
 * Chỉ đọc.
 */
import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { loadConfig } from '../config.js';

const accountId = Number(process.argv[2] ?? 1);
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
await sleep(1500);

const f = c.farmState!;
const groups = new Map<string, number[]>();
for (const x of f.cells) {
  const k = `idTree=${x.idTree} time=${x.time} vitality=${x.vitalityPer} hervestPer=${x.hervestPer} arid=${+x.isArid} grass=${+x.isGrass} worm=${+x.isWorm} level=${x.level}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k)!.push(x.index);
}
console.log(`\n===== ${f.cells.length} ô, ${groups.size} nhóm khác nhau =====`);
for (const [k, idx] of groups) {
  console.log(`  [${idx.length} ô] ${k}`);
  console.log(`        ô: ${idx.join(',')}`);
}

console.log(`\n===== đuôi gói chưa map =====\n${f.tailHex}`);
console.log(`\n===== hex gói 69 (128 byte đầu) =====\n${c.lastPacket.get(69)?.slice(0, 256)}`);

c.logout();
process.exit(0);
