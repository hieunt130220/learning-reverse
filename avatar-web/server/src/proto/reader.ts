/** Bản port của `myReader` — đối xứng với MyWriter, big-endian. */
export class MyReader {
  private pos = 0;

  constructor(private readonly buf: Buffer) {}

  get position(): number {
    return this.pos;
  }

  available(): number {
    return this.buf.length - this.pos;
  }

  readByte(): number {
    return this.buf.readInt8(this.pos++);
  }

  readUnsignedByte(): number {
    return this.buf.readUInt8(this.pos++);
  }

  readBoolean(): boolean {
    return this.readUnsignedByte() !== 0;
  }

  readShort(): number {
    const v = this.buf.readInt16BE(this.pos);
    this.pos += 2;
    return v;
  }

  readUnsignedShort(): number {
    const v = this.buf.readUInt16BE(this.pos);
    this.pos += 2;
    return v;
  }

  readInt(): number {
    const v = this.buf.readInt32BE(this.pos);
    this.pos += 4;
    return v;
  }

  readLong(): bigint {
    const v = this.buf.readBigInt64BE(this.pos);
    this.pos += 8;
    return v;
  }

  readUTF(): string {
    const len = this.readUnsignedShort();
    const s = this.buf.toString('utf8', this.pos, this.pos + len);
    this.pos += len;
    return s;
  }

  readBytes(n: number): Buffer {
    const b = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return b;
  }

  rest(): Buffer {
    return this.buf.subarray(this.pos);
  }
}
