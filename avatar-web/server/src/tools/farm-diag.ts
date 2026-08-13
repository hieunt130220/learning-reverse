/**
 * Chẩn đoán vì sao lệnh farm gửi đi mà không có tác dụng.
 *   npx tsx src/tools/farm-diag.ts [accountId] [--do]
 *
 * Mặc định CHỈ ĐỌC: đăng nhập, vào farm, in nguyên trạng thái thật của ô và vật
 * nuôi rồi thoát. Có `--do` mới gửi lệnh thử (thu hoạch / trồng / thuốc bổ) và
 * so trạng thái trước-sau để biết lệnh có ăn không.
 *
 * KHÔNG bao giờ bán vật nuôi ở đây — bán là không lấy lại được.
 */
import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { ITEM_TONIC } from '../game/farmData.js';
import { loadConfig } from '../config.js';

const accountId = Number(process.argv[2] ?? 1);
const doWrites = process.argv.includes('--do');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const row = getAccountById(db, accountId);
if (!row) throw new Error(`không có tài khoản #${accountId}`);

const c = new GameClient();
c.on('log', (l: string) => console.log('   LOG', l));
// In MỌI gói RX kèm hex — bốn lệnh đang nghi (64/66/53/54) chưa có handler nên
// đây là cách duy nhất thấy được server có trả lời hay không.
c.on('message', (m: { command: number; getData(): Buffer }) => {
  const b = m.getData();
  console.log(`   RX  cmd=${m.command} len=${b.length} hex=${b.subarray(0, 40).toString('hex')}`);
});

console.log(`đăng nhập tài khoản #${accountId} (${row.gameUser}) -> ${row.host}:${row.port}`);
await c.login({
  host: row.host,
  port: row.port,
  user: row.gameUser,
  pass: readGamePass(db, cfg.masterKey, accountId),
});
await sleep(4000);
console.log('status =', c.status, '· playerId =', c.playerId);

const farmReady = new Promise<void>((r) => c.once('farm', () => r()));
c.enterFarm();
await farmReady;
await sleep(2000);

const farm = c.farmState;
if (!farm) throw new Error('không lấy được dữ liệu farm');

console.log('\n================ TRẠNG THÁI THẬT ================');
console.log(`idFarm = ${farm.idFarm}   playerId = ${c.playerId}   ${farm.idFarm === c.playerId ? '(BẰNG NHAU)' : '*** KHÁC NHAU ***'}`);

console.log(`\n--- ${farm.cells.length} ô ---`);
for (const x of farm.cells.slice(0, 12)) {
  console.log(
    `ô ${String(x.index).padStart(2)}  idTree=${String(x.idTree).padStart(3)} time=${String(x.time).padStart(6)} ` +
      `vitality=${String(x.vitalityPer).padStart(3)} hervestPer=${String(x.hervestPer).padStart(3)} ` +
      `arid=${+x.isArid} grass=${+x.isGrass} worm=${+x.isWorm}`,
  );
}
const ripeByTime = farm.cells.filter((x) => x.idTree !== -1 && x.time === 0);
const ripeByPer = farm.cells.filter((x) => x.idTree !== -1 && x.hervestPer >= 100);
const emptyCells = farm.cells.filter((x) => x.idTree === -1);
console.log(
  `\nchín theo time===0 : ${ripeByTime.length}  [${ripeByTime.slice(0, 10).map((x) => x.index).join(',')}]`,
);
console.log(
  `chín theo hervestPer>=100 : ${ripeByPer.length}  [${ripeByPer.slice(0, 10).map((x) => x.index).join(',')}]`,
);
console.log(`ô trống (idTree===-1) : ${emptyCells.length}  [${emptyCells.slice(0, 10).map((x) => x.index).join(',')}]`);
console.log(`time nhỏ nhất của ô có cây: ${Math.min(...farm.cells.filter((x) => x.idTree !== -1).map((x) => x.time))}`);

console.log(`\n--- ${farm.animals.length} con ---`);
for (const a of farm.animals) {
  console.log(
    `con ${String(a.index).padStart(2)}  species=${a.species} bornTime=${String(a.bornTime).padStart(8)} ` +
      `health=${String(a.health).padStart(3)} harvestPer=${String(a.harvestPer).padStart(3)} ` +
      `numEgg=${a.numEggOne} hunger=${+a.hunger} f20=${+a.flag20} f21=${+a.flag21}`,
  );
}

console.log(`\n--- kho (${c.inventory.length} loại) ---`);
console.log(c.inventory.map((i) => `#${i.id}×${i.num}`).join(' '));

if (!doWrites) {
  console.log('\n(chỉ đọc — thêm --do để thử gửi lệnh)');
  c.logout();
  process.exit(0);
}

/** Gửi 1 lệnh rồi xin lại farm, so sánh để biết lệnh có ăn không. */
async function probe(label: string, send: () => void, check: () => string): Promise<void> {
  console.log(`\n================ THỬ: ${label} ================`);
  console.log('  trước:', check());
  send();
  await sleep(2500);
  const again = new Promise<void>((r) => c.once('farm', () => r()));
  c.enterFarm();
  await again;
  await sleep(1000);
  console.log('  sau  :', check());
}

// --- thu hoạch ô đã chín ---------------------------------------------------
const target = ripeByTime[0] ?? ripeByPer[0];
if (target) {
  await probe(
    `harvest(idFarm=${farm.idFarm}, ô ${target.index})`,
    () => c.farm.harvest(farm.idFarm, target.index),
    () => {
      const x = c.farmState!.cells[target.index]!;
      return `idTree=${x.idTree} time=${x.time} hervestPer=${x.hervestPer}`;
    },
  );
  // Nếu idFarm không ăn, thử lại bằng playerId — notes ghi client thật gọi
  // doUsingItem(playerId, …), mà playerId hiện là biến chết trong GameClient.
  if (c.playerId !== undefined && c.playerId !== farm.idFarm) {
    await probe(
      `harvest(playerId=${c.playerId}, ô ${target.index})`,
      () => c.farm.harvest(c.playerId!, target.index),
      () => {
        const x = c.farmState!.cells[target.index]!;
        return `idTree=${x.idTree} time=${x.time} hervestPer=${x.hervestPer}`;
      },
    );
  }
} else {
  console.log('\n(không có ô nào chín để thử thu hoạch)');
}

// --- chữa bệnh -------------------------------------------------------------
const hurt = farm.animals.find((a) => a.health < 100);
if (hurt) {
  await probe(
    `useItem(idFarm, con ${hurt.index}, thuốc bổ)`,
    () => c.farm.useItem(farm.idFarm, hurt.index, ITEM_TONIC),
    () => `health=${c.farmState!.animals.find((a) => a.index === hurt.index)?.health}`,
  );
} else {
  console.log('\n(mọi con đều đủ 100 máu — không thử được chữa bệnh)');
}

// --- thu sản phẩm vật nuôi -------------------------------------------------
const withEgg = farm.animals.find((a) => a.numEggOne > 0);
if (withEgg) {
  await probe(
    `harvestAnimal(idFarm, con ${withEgg.index})`,
    () => c.farm.harvestAnimal(farm.idFarm, withEgg.index),
    () => `numEgg=${c.farmState!.animals.find((a) => a.index === withEgg.index)?.numEggOne}`,
  );
} else {
  console.log('\n(không con nào có sản phẩm để thu)');
}

await sleep(1500);
c.logout();
process.exit(0);
