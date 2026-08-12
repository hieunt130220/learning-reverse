/**
 * Chạy trọn handshake đã mã hoá và in phản hồi server, thử lần lượt nhiều
 * chuỗi version để tìm bản server đang chấp nhận.
 *   npx tsx src/tools/version-probe.ts 3.4.4 3.4.5 3.5.0
 */
import { cmdName } from '../game/opcodes.js';
import { DEFAULT_DEVICE, GAME_MIDLET } from '../game/client.js';
import { Message } from '../proto/message.js';
import { CMD_GET_KEY, Session } from '../proto/session.js';

const HOST = process.env.HOST ?? '27.0.14.67';
const PORT = Number(process.env.PORT_GAME ?? 19129);
const versions = process.argv.slice(2);
if (versions.length === 0) versions.push(GAME_MIDLET.VERSION);

/** Rất nhiều gói dialog/lỗi mở đầu bằng 1 chuỗi UTF — thử đọc cho dễ nhìn. */
function peekUtf(body: Buffer): string {
  if (body.length < 2) return '';
  const len = body.readUInt16BE(0);
  if (len < 1 || len + 2 > body.length) return '';
  const s = body.toString('utf8', 2, 2 + len);
  return /[�]/.test(s) ? '' : s;
}

async function tryVersion(version: string): Promise<void> {
  console.log(`\n===== version "${version}" =====`);
  const s = new Session();
  const d = DEFAULT_DEVICE;

  s.on('message', (m) => {
    const b = m.getData();
    const text = peekUtf(b);
    console.log(
      `  RX cmd=${m.command} (${cmdName(m.command)}) len=${b.length}` +
        (text ? `\n     "${text}"` : `  hex=${b.subarray(0, 40).toString('hex')}`),
    );
  });
  s.on('error', (e) => console.log('  lỗi:', e.message));

  await s.connect(HOST, PORT);

  const gotKey = new Promise<boolean>((resolve) => {
    const t = setTimeout(() => resolve(false), 8000);
    s.once('key', () => {
      clearTimeout(t);
      resolve(true);
    });
  });
  s.send(Message.create(CMD_GET_KEY));
  if (!(await gotKey)) {
    console.log('  không nhận được khóa');
    s.close();
    return;
  }
  console.log('  ✓ có khóa, gửi thông tin client (đã mã hoá)');

  const handler = Message.create(-1);
  handler.writer!.writeByte(GAME_MIDLET.CLIENT_TYPE);
  s.send(handler);

  const provider = Message.create(-47);
  provider
    .writer!.writeByte(GAME_MIDLET.PROVIDER)
    .writeInt(d.memoryMb)
    .writeUTF(d.model)
    .writeInt(10000)
    .writeInt(d.screenWidth)
    .writeInt(d.screenHeight)
    .writeBoolean(true)
    .writeByte(1)
    .writeUTF(version)
    .writeUTF(d.imei)
    .writeByte(GAME_MIDLET.DEVICE);
  s.send(provider);

  const agent = Message.create(-79);
  agent.writer!.writeUTF(d.agent);
  s.send(agent);

  await new Promise((r) => setTimeout(r, 6000));
  s.close();
}

for (const v of versions) await tryVersion(v);
process.exit(0);
