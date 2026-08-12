/**
 * Bản port của `myWriter` (Assembly-CSharp) — clone Java DataOutputStream.
 * Đã xác minh trên native: mọi số ghi big-endian, writeUTF = [u16 BE độ dài byte][UTF-8].
 * Xem myWriter$$writeShort @0x833368, myWriter$$writeUTF @0x8335FC.
 */
export class MyWriter {
  private chunks: number[] = [];

  writeByte(v: number): this {
    this.chunks.push(v & 0xff);
    return this;
  }

  writeBoolean(v: boolean): this {
    return this.writeByte(v ? 1 : 0);
  }

  writeShort(v: number): this {
    this.chunks.push((v >> 8) & 0xff, v & 0xff);
    return this;
  }

  writeInt(v: number): this {
    this.chunks.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
    return this;
  }

  writeLong(v: bigint | number): this {
    let x = BigInt(v) & 0xffffffffffffffffn;
    const out = new Array<number>(8);
    for (let i = 7; i >= 0; i--) {
      out[i] = Number(x & 0xffn);
      x >>= 8n;
    }
    this.chunks.push(...out);
    return this;
  }

  writeUTF(s: string): this {
    const bytes = Buffer.from(s ?? '', 'utf8');
    this.writeShort(bytes.length);
    this.chunks.push(...bytes);
    return this;
  }

  writeBytes(b: Buffer): this {
    this.chunks.push(...b);
    return this;
  }

  getData(): Buffer {
    return Buffer.from(this.chunks);
  }
}
