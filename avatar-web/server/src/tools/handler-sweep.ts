// Quét GameMidlet.CLIENT_TYPE trong GET_HANDLER(-1) và cả 2 host,
// tìm cấu hình làm server chịu trả lời LOGIN_ACC. Dùng tài khoản giả.
import net from 'node:net';
import { DEFAULT_DEVICE, GAME_MIDLET } from '../game/client.js';
import { MyWriter } from '../proto/writer.js';
import { cmdName } from '../game/opcodes.js';

const d = DEFAULT_DEVICE;
const provider = new MyWriter().writeByte(GAME_MIDLET.PROVIDER).writeInt(d.memoryMb).writeUTF(d.model)
  .writeInt(10000).writeInt(d.screenWidth).writeInt(d.screenHeight).writeBoolean(true).writeByte(1)
  .writeUTF(GAME_MIDLET.VERSION).writeUTF(d.imei).writeByte(GAME_MIDLET.DEVICE).getData();
const login = new MyWriter().writeUTF('zzz_khong_ton_tai').writeUTF('zzz123456').writeUTF(d.imei).getData();

function run(host: string, ct: number): Promise<void> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port: 19129 });
    let key: Buffer | null = null, curW = 0, curR = 0;
    let rx = Buffer.alloc(0);
    const seen: string[] = [];
    const enc = (b: number) => { const o = (key![curW] ^ b) & 0xff; curW = (curW + 1) % key!.length; return o; };
    const put = (cmd: number, b: Buffer) => {
      const out = Buffer.alloc(3 + b.length);
      out[0] = enc(cmd); out[1] = enc((b.length >> 8) & 0xff); out[2] = enc(b.length & 0xff);
      for (let i = 0; i < b.length; i++) out[3 + i] = enc(b[i]);
      sock.write(out);
    };

    sock.on('connect', () => sock.write(Buffer.from([0xe5, 0, 0])));
    sock.on('data', (data) => {
      if (!key) {
        const body = data.subarray(3, 3 + data.readUInt16BE(1));
        const k = Buffer.from(body.subarray(1, 1 + body[0]));
        for (let i = 0; i < k.length - 1; i++) k[i + 1] = (k[i + 1] ^ k[i]) & 0xff;
        key = k;
        put(-1, new MyWriter().writeByte(ct).getData());
        put(-47, provider);
        put(-79, new MyWriter().writeUTF('').getData());
        put(-87, new MyWriter().writeByte(1).getData());
        put(-33, login);
        return;
      }
      rx = Buffer.concat([rx, Buffer.from([...data].map((b) => { const o = (key![curR] ^ b) & 0xff; curR = (curR + 1) % key!.length; return o; }))]);
      while (rx.length >= 3) {
        const cmd = rx.readInt8(0), len = rx.readUInt16BE(1);
        if (rx.length < 3 + len) break;
        seen.push(`${cmd}(${cmdName(cmd)})`);
        rx = rx.subarray(3 + len);
      }
    });
    sock.on('error', () => {});
    setTimeout(() => {
      const extra = seen.filter((s) => !s.startsWith('-87'));
      console.log(`  ${host} CLIENT_TYPE=${ct}: ${seen.join(', ') || 'im lặng'}` + (extra.length ? '   <<< CÓ PHẢN HỒI KHÁC' : ''));
      sock.destroy();
      resolve();
    }, 6000);
  });
}

for (const host of ['27.0.14.67', '27.0.14.120'])
  for (const ct of [8, 1, 0, 2, 4]) await run(host, ct);
process.exit(0);
