/**
 * Soi thẳng byte thô của một ô trong gói 69, không qua decode.
 *   CELL=43 npx tsx --env-file=.env src/tools/raw-cell.ts [accountId]
 *
 * Bản ghi ô có hai độ dài: ô trống là 1 byte (`idTree = -1`), ô có cây là 8 byte.
 * Nếu ô đã thu hoạch thực ra là ô TRỐNG mà mình vẫn đọc 8 byte thì toàn bộ ô phía
 * sau lệch — nên phải đối chiếu byte thô trước khi tin `idTree=6`.
 */
import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { loadConfig } from '../config.js';

const accountId = Number(process.argv[2] ?? 1);
const want = Number(process.env.CELL ?? 43);
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
await sleep(4000);
const ready = new Promise<void>((r) => c.once('farm', () => r()));
c.enterFarm();
await ready;
await sleep(1500);

const hex = c.lastPacket.get(69);
if (!hex) throw new Error('chưa bắt được gói 69');
const b = Buffer.from(hex, 'hex');
console.log(`gói 69 dài ${b.length} byte`);

// Duyệt đúng như decodeFarmData: 1 byte idTree, nếu != -1 thì thêm 7 byte.
let p = 4;
const nCell = b.readInt8(p);
p += 1;
console.log(`nCell = ${nCell}\n`);
for (let i = 0; i < nCell; i++) {
  const start = p;
  const idTree = b.readInt8(p);
  p += 1;
  if (idTree !== -1) p += 7;
  if (Math.abs(i - want) <= 2) {
    console.log(
      `ô ${String(i).padStart(2)} @${String(start).padStart(4)} dài ${p - start} byte: ` +
        `${b.subarray(start, p).toString('hex')}` +
        (idTree === -1 ? '   <-- Ô TRỐNG (1 byte)' : ''),
    );
  }
}
console.log(`\nhết ô ở offset ${p}; byte còn lại = ${b.length - p}`);
const nAnimal = b.readInt8(p);
console.log(`nAnimal = ${nAnimal} (phải là 16 — sai thì decode đã lệch)`);

c.logout();
process.exit(0);
