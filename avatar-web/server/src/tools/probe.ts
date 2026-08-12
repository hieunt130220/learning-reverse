/**
 * Kiểm chứng framing + trao khóa với server thật, không gửi tài khoản.
 *   npx tsx src/tools/probe.ts [host] [port]
 * Nếu in ra "✓ NHẬN ĐƯỢC KHÓA" nghĩa là khung gói và thuật toán XOR đúng.
 */
import { cmdName } from '../game/opcodes.js';
import { Message } from '../proto/message.js';
import { CMD_GET_KEY, Session } from '../proto/session.js';

const host = process.argv[2] ?? '27.0.14.67';
const port = Number(process.argv[3] ?? 19129);

const s = new Session();
s.on('key', () => console.log('✓ NHẬN ĐƯỢC KHÓA — parse gói -27 thành công'));
s.on('message', (m) => {
  const b = m.getData();
  console.log(
    `RX cmd=${m.command} (${cmdName(m.command)}) len=${b.length} hex=${b.subarray(0, 48).toString('hex')}`,
  );
});
s.on('error', (e) => console.log('lỗi:', e.message));
s.on('closed', () => console.log('đóng kết nối'));

await s.connect(host, port);
console.log(`đã kết nối ${host}:${port}, xin khóa...`);
s.send(Message.create(CMD_GET_KEY));
setTimeout(() => {
  s.close();
  process.exit(0);
}, 6000);
