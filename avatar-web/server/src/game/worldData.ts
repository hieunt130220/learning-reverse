/**
 * Decoder TUẦN TỰ strict cho enter-world `cmd -34` (LOGIN_SUCESS).
 * Layout đối chiếu từ avatar-re/notes/login.md + frida parser reference:
 * header -> players -> meta i16 -> map item types -> map items -> animations
 * -> ItemMapSpecial[]. Không offset-scan, không heuristic: lệch 1 byte là lỗi.
 */

export interface MapSpecial {
  id: number;
  name: string;
  type: number;
  imageIds: number[];
  menuIds: number[];
}

export interface EnterWorldSnapshot {
  playerId: number;
  specials: MapSpecial[];
  specialSectionEnd: number;
  totalBytes: number;
  trailingBytes: number;
}

export class WorldDataDecodeError extends Error {
  constructor(
    readonly section: string,
    readonly offset: number,
    message: string,
  ) {
    super(`${section}@${offset}: ${message}`);
    this.name = 'WorldDataDecodeError';
  }
}

/** Reader có kiểm tra biên trước MỌI lần đọc; lỗi mang section + offset. */
class StrictReader {
  pos = 0;
  private section = 'header';

  constructor(private readonly buf: Buffer) {}

  in(section: string): this {
    this.section = section;
    return this;
  }

  private need(n: number): void {
    if (n < 0 || this.pos + n > this.buf.length) {
      throw new WorldDataDecodeError(
        this.section,
        this.pos,
        `cần ${n} byte nhưng chỉ còn ${Math.max(0, this.buf.length - this.pos)}`,
      );
    }
  }

  i8(): number { this.need(1); return this.buf.readInt8(this.pos++); }
  i16(): number {
    this.need(2);
    const v = this.buf.readInt16BE(this.pos);
    this.pos += 2;
    return v;
  }
  u16(): number {
    this.need(2);
    const v = this.buf.readUInt16BE(this.pos);
    this.pos += 2;
    return v;
  }
  i32(): number {
    this.need(4);
    const v = this.buf.readInt32BE(this.pos);
    this.pos += 4;
    return v;
  }
  utf(): string {
    // Java DataInputStream.readUTF/MyReader đọc prefix unsigned 16-bit.
    const len = this.u16();
    this.need(len);
    const s = this.buf.toString('utf8', this.pos, this.pos + len);
    this.pos += len;
    return s;
  }
}

function readCount(r: StrictReader, section: string): number {
  r.in(section);
  const n = r.i8();
  if (n < 0) throw new WorldDataDecodeError(section, r.pos - 1, `count âm: ${n}`);
  return n;
}

/** 15 field trạng thái player, width đã chốt trong notes/login.md. */
function readPlayerStateTail(r: StrictReader): void {
  r.in('players');
  r.i16(); r.i16(); r.i8(); r.i8(); r.i8();
  r.i16(); r.i8(); r.i8();
  r.i16(); r.i16(); r.i16();
  r.i8(); r.i16(); r.i8(); r.i8();
}

export function decodeEnterWorld(body: Buffer): EnterWorldSnapshot {
  const r = new StrictReader(body);

  r.in('header');
  r.i8(); // flag
  const playerId = r.i32();
  r.utf(); // tên nhân vật
  r.i8(); r.i8(); r.i16(); r.i16();
  if (!(playerId > 0)) {
    throw new WorldDataDecodeError('header', 5, `playerId không hợp lệ: ${playerId}`);
  }

  r.in('players');
  const nPlayer = readCount(r, 'players');
  for (let i = 0; i < nPlayer; i++) {
    r.i32(); // id
    r.utf(); // name
    const nPart = readCount(r, 'players');
    for (let p = 0; p < nPart; p++) r.i16();
    readPlayerStateTail(r);
  }

  r.in('meta');
  r.i16();

  r.in('map-item-types');
  const nType = readCount(r, 'map-item-types');
  for (let i = 0; i < nType; i++) {
    r.i8(); r.i16(); r.i8(); r.i16(); r.i16();
    const nPos = readCount(r, 'map-item-types');
    for (let p = 0; p < nPos; p++) { r.i8(); r.i8(); }
  }

  r.in('map-items');
  const nItem = readCount(r, 'map-items');
  for (let i = 0; i < nItem; i++) { r.i8(); r.i8(); r.i8(); r.i8(); }

  r.in('animations');
  const nAnim = readCount(r, 'animations');
  for (let i = 0; i < nAnim; i++) { r.i16(); r.i32(); r.i32(); }

  r.in('specials');
  const nSpecial = readCount(r, 'specials');
  const specials: MapSpecial[] = [];
  for (let i = 0; i < nSpecial; i++) {
    const id = r.i32();
    const name = r.utf();
    const type = r.i32();
    r.i32(); // c — chưa dùng cho matching nhưng phải consume đủ
    r.i8();  // d
    const nImage = readCount(r, 'specials');
    const imageIds: number[] = [];
    for (let k = 0; k < nImage; k++) imageIds.push(r.i16());
    for (let k = 0; k < 8; k++) r.i32(); // 8 int cố định
    const nMenu = readCount(r, 'specials');
    const menuIds: number[] = [];
    for (let k = 0; k < nMenu; k++) menuIds.push(r.i16());
    specials.push({ id, name, type, imageIds, menuIds });
  }

  return {
    playerId,
    specials,
    specialSectionEnd: r.pos,
    totalBytes: body.length,
    trailingBytes: body.length - r.pos,
  };
}
