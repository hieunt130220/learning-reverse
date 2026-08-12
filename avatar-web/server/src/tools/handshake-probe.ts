/**
 * Thử các biến thể gói mồi để tìm cái làm server chịu gửi gói khóa (-27).
 *   npx tsx src/tools/handshake-probe.ts [host] [port]
 *
 * Biến thể khác nhau ở: gửi những gói nào, và độ dài ở nhánh chưa-có-khóa
 * là big- hay little-endian (doSendMessage gọi BinaryWriter.Write(short)
 * qua vtable nên endianness chưa chốt được từ static analysis).
 */
import net from 'node:net';

import { GAME_MIDLET, DEFAULT_DEVICE } from '../game/client.js';
import { MyWriter } from '../proto/writer.js';

const host = process.argv[2] ?? '27.0.14.67';
const port = Number(process.argv[3] ?? 19129);

function frame(cmd: number, body: Buffer, be: boolean): Buffer {
  const len = be
    ? Buffer.from([(body.length >> 8) & 0xff, body.length & 0xff])
    : Buffer.from([body.length & 0xff, (body.length >> 8) & 0xff]);
  return Buffer.concat([Buffer.from([cmd & 0xff]), len, body]);
}

const d = DEFAULT_DEVICE;

const getHandler = () => new MyWriter().writeByte(GAME_MIDLET.CLIENT_TYPE).getData();

const setProvider = () =>
  new MyWriter()
    .writeByte(GAME_MIDLET.PROVIDER)
    .writeInt(d.memoryMb)
    .writeUTF(d.model)
    .writeInt(10000)
    .writeInt(d.screenWidth)
    .writeInt(d.screenHeight)
    .writeBoolean(true)
    .writeByte(1)
    .writeUTF(GAME_MIDLET.VERSION)
    .writeUTF(d.imei)
    .writeByte(GAME_MIDLET.DEVICE)
    .getData();

const setAgent = () => new MyWriter().writeUTF('').getData();

type Variant = { name: string; packets: Array<[number, Buffer]>; be: boolean };

const variants: Variant[] = [
  { name: 'full BE', be: true, packets: [[-1, getHandler()], [-47, setProvider()], [-79, setAgent()]] },
  { name: 'full LE', be: false, packets: [[-1, getHandler()], [-47, setProvider()], [-79, setAgent()]] },
  { name: 'chỉ SET_PROVIDER BE', be: true, packets: [[-47, setProvider()]] },
  { name: 'gói rỗng cmd -27 (xin khóa)', be: true, packets: [[-27, Buffer.alloc(0)]] },
  { name: 'GET_HANDLER rỗng BE', be: true, packets: [[-1, Buffer.alloc(0)]] },
];

async function run(v: Variant): Promise<void> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    sock.setNoDelay(true);
    let got = false;

    sock.on('connect', () => {
      for (const [cmd, body] of v.packets) sock.write(frame(cmd, body, v.be));
    });
    sock.on('data', (buf) => {
      got = true;
      console.log(`  ✓ ${v.name}: RX ${buf.length} byte  ${buf.subarray(0, 48).toString('hex')}`);
    });
    sock.on('error', (e) => console.log(`  ✗ ${v.name}: ${e.message}`));
    sock.on('close', () => {
      if (!got) console.log(`  – ${v.name}: server đóng, không gửi gì`);
      resolve();
    });
    setTimeout(() => {
      if (!got) console.log(`  – ${v.name}: im lặng`);
      sock.destroy();
      resolve();
    }, 8000);
  });
}

for (const v of variants) {
  console.log(`thử: ${v.name}`);
  await run(v);
}
process.exit(0);
