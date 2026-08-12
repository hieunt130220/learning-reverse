/**
 * Thử nhiều cách làm ô đã thu hoạch (`time = -1`) trồng lại được.
 *   CELL=43 npx tsx --env-file=.env src/tools/plant-variants.ts [accountId]
 *
 * Ô 43 kẹt ở `idTree=6 time=-1 hervestPer=100` hơn 7 giờ, không tự về trạng thái
 * trống, và `doPlantSeed` vào đó bị server bỏ qua im lặng. Thử lần lượt vài
 * chuỗi lệnh dạo đầu xem cái nào làm server chịu trả lời.
 *
 * Mỗi biến thể in MỌI gói RX trong 3 giây sau đó — im lặng = bị từ chối.
 */
import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { loadConfig } from '../config.js';

const accountId = Number(process.argv[2] ?? 1);
const cellIdx = Number(process.env.CELL ?? 43);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const row = getAccountById(db, accountId)!;
const c = new GameClient();

let watching = false;
const seen: string[] = [];
c.on('message', (m: { command: number; getData(): Buffer }) => {
  if (!watching || [-36, -38].includes(m.command)) return;
  const b = m.getData();
  let extra = '';
  if (m.command === -40) {
    try {
      extra = ` "${b.subarray(2, 2 + b.readUInt16BE(0)).toString('utf8')}"`;
    } catch { /* bỏ qua */ }
  }
  seen.push(`cmd=${m.command}${extra} hex=${b.subarray(0, 20).toString('hex')}`);
});

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
await sleep(2000);

const idFarm = c.farmState!.idFarm;
const before = c.farmState!.cells[cellIdx]!;
console.log(`ô ${cellIdx}: idTree=${before.idTree} time=${before.time} hervestPer=${before.hervestPer}\n`);

async function tryIt(label: string, run: () => void): Promise<void> {
  seen.length = 0;
  watching = true;
  console.log(`--- ${label}`);
  run();
  await sleep(3000);
  watching = false;
  console.log(seen.length ? seen.map((s) => `      RX ${s}`).join('\n') : '      (im lặng)');

  const again = new Promise<void>((r) => c.once('farm', () => r()));
  c.enterFarm();
  await again;
  await sleep(800);
  const x = c.farmState!.cells[cellIdx]!;
  console.log(`      -> idTree=${x.idTree} time=${x.time} hervestPer=${x.hervestPer}`);
  await sleep(1200);
}

// 1. Xin báo giá trồng trước (client thật hiện hộp thoại giá trước khi trồng).
await tryIt('requestPricePlant(idFarm) rồi plantSeed(#6)', () => {
  c.farm.requestPricePlant(idFarm);
  setTimeout(() => c.farm.plantSeed(idFarm, cellIdx, 6), 1200);
});

// 2. Thu hoạch lần nữa rồi trồng ngay (biết đâu phải "chốt" ô trước).
await tryIt('harvest rồi plantSeed(#6)', () => {
  c.farm.harvest(idFarm, cellIdx);
  setTimeout(() => c.farm.plantSeed(idFarm, cellIdx, 6), 1200);
});

// 3. Hạt rẻ nhất, phòng khi #6 (Lúa) có điều kiện riêng.
await tryIt('plantSeed(#5 Hoa Hồng)', () => c.farm.plantSeed(idFarm, cellIdx, 5));

// 4. Gói cmd 66 nhưng idSeed rộng i16 — phòng khi width i8 đọc sai.
await tryIt('cmd 66 thủ công: i32 idFarm, i8 cell, i16 seed', () =>
  c.sendRaw(66, [
    { t: 'i32', v: String(idFarm) },
    { t: 'i8', v: String(cellIdx) },
    { t: 'i16', v: '6' },
  ]),
);

// 5. Ô đang mọc bình thường — đối chứng: server có phản hồi khác không?
const growing = c.farmState!.cells.find((x) => x.idTree !== -1 && x.time > 0)!;
await tryIt(`đối chứng: plantSeed vào ô ${growing.index} đang mọc (time=${growing.time})`, () =>
  c.farm.plantSeed(idFarm, growing.index, 6),
);

c.logout();
process.exit(0);
