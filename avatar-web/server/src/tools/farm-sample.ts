/**
 * Đo `time` (ô) và `bornTime` (vật nuôi) biến thiên thế nào theo thời gian thật.
 *   npx tsx --env-file=.env src/tools/farm-sample.ts [accountId] [soLan] [giãnCáchGiây]
 *
 * Chỉ đọc, không gửi lệnh farm nào. Làm trong MỘT phiên đăng nhập: đăng nhập
 * lại sẽ bị server đá phiên cũ.
 *
 * Trả lời hai câu:
 *   - `time` có đếm ngược về 0 không (điều kiện thu hoạch đang dùng `time === 0`)
 *   - `bornTime` đếm lên hay đếm xuống (cần cho "bán khi gần hết thời gian sống")
 */
import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { loadConfig } from '../config.js';

const accountId = Number(process.argv[2] ?? 1);
const times = Number(process.argv[3] ?? 3);
const gapSec = Number(process.argv[4] ?? 60);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const row = getAccountById(db, accountId);
if (!row) throw new Error(`không có tài khoản #${accountId}`);

const c = new GameClient();
c.on('log', (l: string) => console.log('   LOG', l));

await c.login({
  host: row.host,
  port: row.port,
  user: row.gameUser,
  pass: readGamePass(db, cfg.masterKey, accountId),
});
await sleep(4000);

interface Sample {
  at: number;
  cellTime: number[];
  cellPer: number[];
  born: number[];
  animalPer: number[];
}

async function snap(): Promise<Sample> {
  const ready = new Promise<void>((r) => c.once('farm', () => r()));
  c.enterFarm();
  await ready;
  await sleep(800);
  const f = c.farmState!;
  return {
    at: Date.now(),
    cellTime: f.cells.map((x) => x.time),
    cellPer: f.cells.map((x) => x.hervestPer),
    born: f.animals.map((a) => a.bornTime),
    animalPer: f.animals.map((a) => a.harvestPer),
  };
}

const samples: Sample[] = [];
for (let i = 0; i < times; i++) {
  if (i > 0) {
    console.log(`\n… chờ ${gapSec}s …`);
    await sleep(gapSec * 1000);
  }
  const s = await snap();
  samples.push(s);
  console.log(
    `\n[lần ${i + 1}] ô[0..5].time = ${s.cellTime.slice(0, 6).join(' ')} | ` +
      `hervestPer = ${s.cellPer.slice(0, 6).join(' ')}`,
  );
  console.log(
    `          con[0..5].bornTime = ${s.born.slice(0, 6).join(' ')} | ` +
      `harvestPer = ${s.animalPer.slice(0, 6).join(' ')}`,
  );
}

console.log('\n================ BIẾN THIÊN ================');
const first = samples[0]!;
const last = samples[samples.length - 1]!;
const secs = Math.round((last.at - first.at) / 1000);
console.log(`giữa lần 1 và lần ${samples.length}: ${secs}s thật`);

const dCell = last.cellTime.map((t, i) => t - first.cellTime[i]!);
const dBorn = last.born.map((t, i) => t - first.born[i]!);
const uniq = (xs: number[]) => [...new Set(xs)].join(', ');
console.log(`Δ ô.time      : ${uniq(dCell)}   -> ${dCell[0]! < 0 ? 'ĐẾM NGƯỢC' : dCell[0]! > 0 ? 'đếm lên' : 'không đổi'}`);
console.log(`Δ con.bornTime: ${uniq(dBorn)}   -> ${dBorn[0]! < 0 ? 'ĐẾM NGƯỢC' : dBorn[0]! > 0 ? 'đếm lên' : 'không đổi'}`);
console.log(`Δ ô.hervestPer: ${uniq(last.cellPer.map((p, i) => p - first.cellPer[i]!))}`);

if (dCell[0]) {
  const perSec = dCell[0]! / secs;
  console.log(`\nô.time đổi ${perSec.toFixed(3)} đơn vị/giây -> đơn vị ~ ${Math.abs(1 / perSec).toFixed(1)} giây`);
  const minLeft = Math.min(...last.cellTime.filter((_, i) => last.cellTime[i] !== undefined));
  console.log(`ô sớm chín nhất còn ${minLeft} đơn vị ≈ ${(Math.abs(minLeft / perSec) / 60).toFixed(1)} phút`);
}

c.logout();
process.exit(0);
