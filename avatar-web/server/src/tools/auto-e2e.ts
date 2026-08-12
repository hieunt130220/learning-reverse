/**
 * Chạy THẬT một vòng AutoFarm với server game rồi in nhật ký vòng đó.
 *   npx tsx --env-file=.env src/tools/auto-e2e.ts [accountId]
 *
 * Khác với test dùng FakeClient: ở đây là GameClient thật, server thật. Đây mới
 * là thứ chứng minh sửa đúng, vì test giả chỉ chứng minh AutoFarm gọi đúng hàm.
 *
 * Bán vật nuôi để TẮT (mặc định) — không đụng vào thứ không lấy lại được.
 */
import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { AutoFarm } from '../autoFarm.js';
import { loadConfig } from '../config.js';
import { parseAnimalSpec } from '../game/farmData.js';

const accountId = Number(process.argv[2] ?? 1);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const row = getAccountById(db, accountId)!;
const c = new GameClient();
c.on('log', (l: string) => console.log('   LOG', l));

await c.login({
  host: row.host,
  port: row.port,
  user: row.gameUser,
  pass: readGamePass(db, cfg.masterKey, accountId),
});
await sleep(3500);

// Bảng vật nuôi: `desc` có thể chứa tuổi thọ, thứ đang thiếu để làm nốt phần
// "bán khi gần hết thời gian sống".
const farmReady = new Promise<void>((r) => c.once('farm', () => r()));
c.enterFarm();
await farmReady;
await sleep(1000);
const treesReady = new Promise<void>((r) => c.once('trees', () => r()));
c.farm.getTreeInfo();
await Promise.race([treesReady, sleep(9000)]);
console.log('\n===== BẢNG LOÀI ĐỌC TỪ desc =====');
for (const a of c.animals) {
  const s = parseAnimalSpec(a.desc);
  console.log(
    `  #${a.id} ${a.name.padEnd(14)} lớn=${String(s.growMinutes ?? '?').padStart(5)}p ` +
      `thọ=${String(s.lifeMinutes ?? '?').padStart(6)}p sảnPhẩm=${s.hasProduct ? 'có' : 'không'}`,
  );
}

// Xem trước quyết định bán mà KHÔNG bán — bán là không lấy lại được.
console.log('\n===== XEM TRƯỚC QUYẾT ĐỊNH BÁN (không thực hiện) =====');
const specs = new Map(c.animals.map((a) => [a.id, parseAnimalSpec(a.desc)] as const));
const grownList = [52, 54, 59];
const nearList = [50, 51, 55];
for (const a of c.farmState!.animals) {
  const sp = specs.get(a.species);
  const name = c.animals.find((x) => x.id === a.species)?.name ?? '?';
  const days = (a.bornTime / 1440).toFixed(2);
  let verdict = 'giữ';
  if (sp && grownList.includes(a.species) && sp.growMinutes !== undefined && a.bornTime >= sp.growMinutes) {
    verdict = `BÁN (đã lớn: ${days} ngày >= ${(sp.growMinutes / 1440).toFixed(0)} ngày)`;
  } else if (sp && nearList.includes(a.species) && sp.lifeMinutes !== undefined) {
    const limit = sp.lifeMinutes * 0.9;
    verdict =
      a.bornTime >= limit
        ? `BÁN (gần hết đời: ${days}/${(sp.lifeMinutes / 1440).toFixed(0)} ngày)`
        : `giữ (mới ${days}/${(sp.lifeMinutes / 1440).toFixed(0)} ngày)`;
  }
  console.log(`  con ${String(a.index).padStart(2)} ${name.padEnd(10)} ${days} ngày -> ${verdict}`);
}

const auto = new AutoFarm(c);
const done = new Promise<void>((r) =>
  auto.on('state', (s: { cycle: number }) => {
    if (s.cycle > 0) r();
  }),
);
console.log('\n===== CHẠY MỘT VÒNG AUTOFARM THẬT =====');
auto.start({
  harvest: true,
  harvestAnimals: true,
  healAnimals: true,
  feedAnimals: true,
  fertilizeCells: false,
  sellAnimals: false, // không bán — không đảo ngược được
  waterItemId: undefined,
  intervalMs: 600_000,
  stepDelayMs: 900,
});
await done;
auto.stop();

const st = auto.state();
console.log(`\nvòng ${st.cycle} · lỗi: ${st.lastError ?? 'không'}`);
console.log('nhật ký vòng:');
for (const a of st.lastActions) console.log('   ', a);

c.logout();
process.exit(0);
