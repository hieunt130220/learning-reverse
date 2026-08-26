/**
 * E2E verify điểm danh qua đường production thật: AvatarSession → onOnline →
 * claimDailyAttendance → log, rồi auto farm bắt đầu.
 *   cd avatar-web/server && npx tsx --env-file=.env src/tools/attendance-e2e.mts [accountId]
 *
 * Kỳ vọng (tài khoản đã báo danh hôm nay): log "[điểm danh] ..." dạng already/rejected
 * xuất hiện TRƯỚC log auto farm đầu tiên; AutoFarm vẫn start bình thường.
 */
import { openDb } from '../db/index.js';
import { getAccountById, readGamePass } from '../accounts/repo.js';
import { GameClient } from '../game/client.js';
import { loadConfig } from '../config.js';

const accountId = Number(process.argv[2] ?? 2);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const row = getAccountById(db, accountId)!;

// Dùng GameClient trực tiếp + gọi API production claimDailyAttendance (cùng tầng
// được AvatarSession.onOnline dùng), đo thứ tự so với vòng farm đầu.
const c = new GameClient();
const lines: string[] = [];
c.on('log', (l: string) => {
  lines.push(l);
  console.log('   ', l);
});

await c.login({ host: row.host, port: row.port, user: row.gameUser, pass: readGamePass(db, cfg.masterKey, accountId) });
await sleep(3000);

console.log('\n== gọi claimDailyAttendance (API production) ==');
const t0 = Date.now();
const result = await c.claimDailyAttendance();
console.log(`result (${Date.now() - t0}ms):`, JSON.stringify(result));

console.log('\n== vào farm để chứng minh phiên còn dùng được ==');
const ready = new Promise<void>((r) => c.once('farm', () => r()));
c.enterFarm();
await ready;
await sleep(1000);
console.log(`farm OK: ${c.farmState?.cells.length ?? 0} ô, status=${c.status}`);

await c.logout();
process.exit(0);
