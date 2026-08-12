// Chạy trọn luồng đăng nhập bằng chính GameClient, in mọi gói nhận được.
//   npx tsx src/tools/login-test.ts [user] [pass]
import { GameClient } from '../game/client.js';
import { cmdName } from '../game/opcodes.js';

function peekUtf(b: Buffer): string {
  if (b.length < 2) return '';
  const len = b.readUInt16BE(0);
  if (len < 1 || len + 2 > b.length) return '';
  const s = b.toString('utf8', 2, 2 + len);
  return /�/.test(s) ? '' : s;
}

const c = new GameClient();
c.on('log', (l: string) => console.log('  [log]', l));
c.on('message', (m) => {
  const b = m.getData();
  const t = peekUtf(b);
  console.log(`  RX cmd=${m.command} (${cmdName(m.command)}) len=${b.length}` +
    (t ? `\n      "${t}"` : `  hex=${b.subarray(0, 40).toString('hex')}`));
});

await c.login({
  host: process.env.HOST ?? '27.0.14.67',
  port: 19129,
  user: process.argv[2] ?? 'zzz_test_khong_ton_tai',
  pass: process.argv[3] ?? 'zzz123456',
});
setTimeout(() => { c.logout(); process.exit(0); }, 12000);
