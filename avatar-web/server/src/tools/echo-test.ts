// Sau khi có khóa, gửi -27 ĐÃ MÃ HOÁ. Nếu server hiểu, nó trả gói khóa mới
// (đã mã hoá) -> giải bằng readKey sẽ ra cấu trúc [klen][key]. Có byte về = mã hoá đúng.
import net from 'node:net';

const probes: Array<{ name: string; cmd: number; body: Buffer }> = [
  { name: '-27 rỗng', cmd: -27, body: Buffer.alloc(0) },
  { name: '-1 [8]', cmd: -1, body: Buffer.from([8]) },
  { name: '-33 login rỗng', cmd: -33, body: Buffer.from([0, 0, 0, 0, 0, 0]) },
];

function run(p: (typeof probes)[number]): Promise<void> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: process.env.HOST ?? '27.0.14.67', port: 19129 });
    let key: Buffer | null = null;
    let curW = 0, curR = 0, got = false;
    const enc = (b: number) => { const o = (key![curW] ^ b) & 0xff; curW = (curW + 1) % key!.length; return o; };
    const dec = (b: number) => { const o = (key![curR] ^ b) & 0xff; curR = (curR + 1) % key!.length; return o; };

    sock.on('connect', () => sock.write(Buffer.from([0xe5, 0, 0])));
    sock.on('data', (d) => {
      if (!key) {
        const body = d.subarray(3, 3 + d.readUInt16BE(1));
        const k = Buffer.from(body.subarray(1, 1 + body[0]));
        for (let i = 0; i < k.length - 1; i++) k[i + 1] = (k[i + 1] ^ k[i]) & 0xff;
        key = k;
        const out = Buffer.alloc(3 + p.body.length);
        out[0] = enc(p.cmd); out[1] = enc((p.body.length >> 8) & 0xff); out[2] = enc(p.body.length & 0xff);
        for (let i = 0; i < p.body.length; i++) out[3 + i] = enc(p.body[i]);
        sock.write(out);
        return;
      }
      got = true;
      const plain = Buffer.from([...d].map(dec));
      console.log(`  ✓✓ ${p.name}: RX thô ${d.toString('hex')}`);
      console.log(`      giải mã   ${plain.toString('hex')}  -> cmd=${plain.readInt8(0)} len=${plain.readUInt16BE(1)}`);
    });
    sock.on('error', () => {});
    sock.on('close', () => { if (!got) console.log(`  –  ${p.name}: server ĐÓNG, không gửi gì`); resolve(); });
    setTimeout(() => { if (!got) console.log(`  –  ${p.name}: im lặng (kết nối vẫn mở)`); sock.destroy(); resolve(); }, 15000);
  });
}

for (const p of probes) await run(p);
process.exit(0);
