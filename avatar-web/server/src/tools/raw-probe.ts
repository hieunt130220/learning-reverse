/**
 * Probe mức byte: in mọi byte server gửi về, có/không gửi gói mồi trước.
 *   npx tsx src/tools/raw-probe.ts <host> <port> [none|handler-be|handler-le]
 *
 * Dùng để chốt: server chủ động gửi key, hay client phải gửi gói đầu tiên?
 * Và nếu phải gửi thì độ dài trong gói pre-key là big- hay little-endian
 * (doSendMessage nhánh chưa có khóa gọi BinaryWriter.Write(short) qua vtable).
 */
import net from 'node:net';

const host = process.argv[2] ?? '27.0.14.67';
const port = Number(process.argv[3] ?? 19129);
const mode = process.argv[4] ?? 'none';

const sock = net.createConnection({ host, port });
sock.setNoDelay(true);

sock.on('connect', () => {
  console.log(`kết nối ${host}:${port}  mode=${mode}`);
  if (mode === 'none') return;

  // GET_HANDLER (-1) + body 1 byte = GameMidlet.CLIENT_TYPE (8)
  const body = Buffer.from([8]);
  const len =
    mode === 'handler-le'
      ? Buffer.from([body.length & 0xff, (body.length >> 8) & 0xff])
      : Buffer.from([(body.length >> 8) & 0xff, body.length & 0xff]);
  const pkt = Buffer.concat([Buffer.from([0xff]), len, body]);
  console.log('TX', pkt.toString('hex'));
  sock.write(pkt);
});

sock.on('data', (d) => {
  console.log(`RX ${d.length} byte:`, d.subarray(0, 64).toString('hex'));
});
sock.on('error', (e) => console.log('lỗi:', e.message));
sock.on('close', () => console.log('đóng'));

setTimeout(() => {
  sock.destroy();
  process.exit(0);
}, 20000);
