// Quét thứ tự gói sau khi có khóa, tìm chuỗi làm server chịu trả lời.
import net from 'node:net';
import { DEFAULT_DEVICE, GAME_MIDLET } from '../game/client.js';
import { MyWriter } from '../proto/writer.js';
import { cmdName } from '../game/opcodes.js';

const d = DEFAULT_DEVICE;
const P = {
  handler: [-1, new MyWriter().writeByte(GAME_MIDLET.CLIENT_TYPE).getData()] as [number, Buffer],
  provider: [-47, new MyWriter().writeByte(GAME_MIDLET.PROVIDER).writeInt(d.memoryMb).writeUTF(d.model)
      .writeInt(10000).writeInt(d.screenWidth).writeInt(d.screenHeight).writeBoolean(true).writeByte(1)
      .writeUTF(GAME_MIDLET.VERSION).writeUTF(d.imei).writeByte(GAME_MIDLET.DEVICE).getData()] as [number, Buffer],
  agent: [-79, new MyWriter().writeUTF('').getData()] as [number, Buffer],
  srvInfo: [-87, new MyWriter().writeByte(1).getData()] as [number, Buffer],
  loginAcc: [-33, new MyWriter().writeUTF('zzz_test').writeUTF('zzz123456').writeUTF(GAME_MIDLET.VERSION).getData()] as [number, Buffer],
  gameType: [111, new MyWriter().writeByte(0).getData()] as [number, Buffer],
  register: [-30, new MyWriter().writeUTF('zzz_test_' + Date.now()).writeUTF('zzz123456').getData()] as [number, Buffer],
  loginImei: [-32, new MyWriter().writeUTF(d.imei).getData()] as [number, Buffer],
};

const seqs: Array<[string, Array<[number, Buffer]>]> = [
  ['srvInfo → loginAcc', [P.srvInfo, P.loginAcc]],
  ['handler → provider → agent → srvInfo → loginAcc', [P.handler, P.provider, P.agent, P.srvInfo, P.loginAcc]],
  ['handler → provider → agent → setGameType → loginAcc', [P.handler, P.provider, P.agent, P.gameType, P.loginAcc]],
  ['srvInfo → loginImei', [P.srvInfo, P.loginImei]],
  ['srvInfo → register', [P.srvInfo, P.register]],
];

function run([name, seq]: [string, Array<[number, Buffer]>]): Promise<void> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: process.env.HOST ?? '27.0.14.67', port: 19129 });
    let key: Buffer | null = null, curW = 0, curR = 0, got = false;
    let rx = Buffer.alloc(0);
    const enc = (b: number) => { const o = (key![curW] ^ b) & 0xff; curW = (curW + 1) % key!.length; return o; };

    sock.on('connect', () => sock.write(Buffer.from([0xe5, 0, 0])));
    sock.on('data', (data) => {
      if (!key) {
        const body = data.subarray(3, 3 + data.readUInt16BE(1));
        const k = Buffer.from(body.subarray(1, 1 + body[0]));
        for (let i = 0; i < k.length - 1; i++) k[i + 1] = (k[i + 1] ^ k[i]) & 0xff;
        key = k;
        for (const [cmd, b] of seq) {
          const out = Buffer.alloc(3 + b.length);
          out[0] = enc(cmd); out[1] = enc((b.length >> 8) & 0xff); out[2] = enc(b.length & 0xff);
          for (let i = 0; i < b.length; i++) out[3 + i] = enc(b[i]);
          sock.write(out);
        }
        return;
      }
      got = true;
      rx = Buffer.concat([rx, Buffer.from([...data].map((b) => { const o = (key![curR] ^ b) & 0xff; curR = (curR + 1) % key!.length; return o; }))]);
      while (rx.length >= 3) {
        const cmd = rx.readInt8(0), len = rx.readUInt16BE(1);
        if (rx.length < 3 + len) break;
        const body = rx.subarray(3, 3 + len);
        let txt = '';
        if (len >= 2) { const l = body.readUInt16BE(0); if (l > 0 && l + 2 <= len) { const s = body.toString('utf8', 2, 2 + l); if (!/�/.test(s)) txt = s; } }
        console.log(`  ✓ [${name}] cmd=${cmd} (${cmdName(cmd)}) len=${len}` + (txt ? `  "${txt}"` : `  ${body.subarray(0, 32).toString('hex')}`));
        rx = rx.subarray(3 + len);
      }
    });
    sock.on('error', () => {});
    setTimeout(() => { if (!got) console.log(`  – [${name}] im lặng`); sock.destroy(); resolve(); }, 7000);
  });
}

for (const s of seqs) await run(s);
process.exit(0);
