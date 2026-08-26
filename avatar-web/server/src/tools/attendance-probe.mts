/**
 * Probe 2: xác định chính xác (userID, menuIndex, subIndex) của "Báo danh hàng ngày"
 * và gói phản hồi already-claimed.
 *   cd avatar-web/server && npx tsx --env-file=.env src/tools/attendance-probe.mts [accountId]
 *
 * Lần 1 đã thấy server trả lời "báo danh lần đầu tiên trong ngày thành công" khi quét
 * uid 1..25 — nghĩa là một uid nào đó trong khoảng đó là menu Báo danh và sub 0 = CLAIM.
 * Hôm nay tài khoản đã báo danh nên chạy lại sẽ nhận phản hồi "đã báo danh" — đó là
 * marker already-claimed cần tìm. Ghi từng dialog -40 theo đúng uid để truy vết.
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
const c = new GameClient();

// Đóng gói mọi -40 (dialog server) theo thời điểm để đối chiếu uid vừa gửi
let lastTxUid = -1;
const dialogs: Array<{ at: number; uid: number; text: string }> = [];
const seen = new Map<number, number>();
c.on('message', (msg: any) => {
  const cmd = msg.command as number;
  seen.set(cmd, (seen.get(cmd) ?? 0) + 1);
  if (cmd === -40) {
    try {
      const text = msg.reader!.readUTF();
      dialogs.push({ at: Date.now(), uid: lastTxUid, text });
      console.log(`[dialog sau uid=${lastTxUid}] ${text}`);
    } catch { /* bỏ qua lỗi decode */ }
  }
});
c.on('log', (l: string) => console.log('   ', l));

await c.login({
  host: row.host,
  port: row.port,
  user: row.gameUser,
  pass: readGamePass(db, cfg.masterKey, accountId),
});
console.log('== đăng nhập xong ==');
await sleep(3000);
const ready = new Promise<void>((r) => c.once('farm', () => r()));
c.enterFarm();
await ready;
await sleep(1500);

for (let uid = 1; uid <= 30; uid++) {
  if (c.status !== 'online') { console.log('MẤT KẾT NỐI tại uid', uid); break; }
  try {
    c.farm.communicate(90);
    await sleep(250);
    lastTxUid = uid;
    c.farm.doMenuOption(uid, 0, 0);
    await sleep(350);
  } catch (e) {
    console.log(`uid ${uid} gửi hỏng: ${(e as Error).message}`);
    break;
  }
}
await sleep(1500);
console.log('== tổng kết ==');
console.log('cmds:', [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([k, n]) => `${k}:${n}`).join(' '));
c.logout();
process.exit(0);
