/**
 * Đo xem server chịu được nhịp gửi lệnh farm bao nhanh.
 *   npx tsx src/tools/rate-test.ts <user> <pass> [delayMs] [soLenh]
 * Đăng nhập mới, vào farm, chờ ổn định, rồi tưới liên tiếp các ô đang hạn.
 */
import { DEFAULT_GAME_SERVER } from '../config.js';
import { GameClient } from '../game/client.js';
import { ITEM_WATER } from '../game/farmData.js';

const [user, pass] = process.argv.slice(2);
const delayMs = Number(process.argv[4] ?? 700);
const n = Number(process.argv[5] ?? 6);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

if (!user || !pass) throw new Error('dùng: rate-test.ts <user> <pass> [delayMs] [soLenh]');

const c = new GameClient();
let died = -1;
c.on('log', (l: string) => console.log('   ', l));

await c.login({ ...DEFAULT_GAME_SERVER, user, pass });
await sleep(4000);

const farmReady = new Promise<void>((r) => c.once('farm', () => r()));
c.enterFarm();
await farmReady;
await sleep(3000); // để phiên ổn định trước khi bắn

const arid = c.farmState!.cells.filter((x) => x.isArid).map((x) => x.index);
console.log(`delay=${delayMs}ms  ô hạn: ${arid.length}`);

for (let i = 0; i < Math.min(n, arid.length); i++) {
  if (c.status !== 'online') { died = i; break; }
  try {
    c.farm.useItem(c.farmState!.idFarm, arid[i], ITEM_WATER);
    console.log(`  [${i + 1}] tưới ô ${arid[i]}`);
  } catch (e) {
    died = i;
    console.log(`  [${i + 1}] GỬI HỎNG: ${(e as Error).message}`);
    break;
  }
  await sleep(delayMs);
}

await sleep(2000);
console.log(`==> delay=${delayMs}ms: ${died < 0 ? `sống sót hết ${Math.min(n, arid.length)} lệnh` : `chết ở lệnh thứ ${died + 1}`}  (status=${c.status})`);
c.logout();
process.exit(0);
