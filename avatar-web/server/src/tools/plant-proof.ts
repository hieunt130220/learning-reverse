/**
 * Kiểm chứng: ô vừa thu hoạch (time = -1) có trồng lại được không?
 *   CELL=43 SEED=6 npx tsx --env-file=.env src/tools/plant-proof.ts [accountId]
 *
 * AutoFarm đang coi "ô trống" là `idTree === -1`, nhưng ô vừa thu hoạch vẫn giữ
 * `idTree` cũ và chỉ đổi `time` thành -1. Nếu trồng vào ô đó ăn thì điều kiện
 * trống phải là `time === -1`.
 */
import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { loadConfig } from '../config.js';

const accountId = Number(process.argv[2] ?? 1);
const cellIdx = Number(process.env.CELL ?? 43);
const seedId = Number(process.env.SEED ?? 6);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const row = getAccountById(db, accountId)!;
const c = new GameClient();
const t0 = Date.now();
const ts = (): string => `+${String(Date.now() - t0).padStart(6)}ms`;
c.on('message', (m: { command: number; getData(): Buffer }) => {
  if (![-36, -38].includes(m.command)) {
    const b = m.getData();
    let extra = '';
    if (m.command === -40) {
      try {
        extra = ` "${b.subarray(2, 2 + b.readUInt16BE(0)).toString('utf8')}"`;
      } catch { /* bỏ qua */ }
    }
    console.log(`${ts()}  RX cmd=${m.command} hex=${b.subarray(0, 24).toString('hex')}${extra}`);
  }
});

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

const farm = c.farmState!;
const before = farm.cells[cellIdx]!;
console.log(
  `\nô ${cellIdx} TRƯỚC: idTree=${before.idTree} time=${before.time} vitality=${before.vitalityPer} hervestPer=${before.hervestPer}`,
);
console.log(`${ts()}  TX plantSeed(${farm.idFarm}, ô ${cellIdx}, hạt #${seedId})`);
c.farm.plantSeed(farm.idFarm, cellIdx, seedId);
await sleep(4000);

const again = new Promise<void>((r) => c.once('farm', () => r()));
c.enterFarm();
await again;
await sleep(1500);
const after = c.farmState!.cells[cellIdx]!;
console.log(
  `ô ${cellIdx} SAU  : idTree=${after.idTree} time=${after.time} vitality=${after.vitalityPer} hervestPer=${after.hervestPer}`,
);
console.log(
  after.time !== before.time || after.hervestPer !== before.hervestPer
    ? '  ==> ✓ TRỒNG ĂN (ô đã đổi trạng thái)'
    : '  ==> ✗ không đổi gì',
);

c.logout();
process.exit(0);
