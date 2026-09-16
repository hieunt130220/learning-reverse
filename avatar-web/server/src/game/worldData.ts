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
  /** Tọa độ native nếu snapshot Park cung cấp; login snapshot cũ có thể thiếu. */
  x?: number;
  y?: number;
}

export interface EnterWorldSnapshot {
  playerId: number;
  specials: MapSpecial[];
  specialSectionEnd: number;
  totalBytes: number;
  trailingBytes: number;
  roomId?: number;
  boardId?: number;
  x?: number;
  y?: number;
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

  rem(): number {
    return Math.max(0, this.buf.length - this.pos);
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
  skip(n: number, section = this.section): void {
    this.section = section;
    this.need(n);
    this.pos += n;
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

/**
 * 11 field trạng thái player trong readListPlayer @0x5F8DE8:
 * - x: i16, y: i16, dir: i8, blogNews: i8, rankClan: i8
 * - idVIP: i16, isWedding: i8, hungerPet: i8, idImg: i16, idWedding: i16
 * - idTitle: i16 (nếu còn >= 2 byte)
 * Tổng: 15 byte cơ bản + 2 byte idTitle = 17 bytes (thay vì 22 bytes hallucinated).
 */
function readPlayerStateTail(r: StrictReader): void {
  r.in('players');
  r.i16(); // x
  r.i16(); // y
  r.i8();  // dir
  r.i8();  // blogNews
  r.i8();  // rankClan
  r.i16(); // idVIP
  r.i8();  // isWedding
  r.i8();  // hungerPet
  r.i16(); // idImg
  r.i16(); // idWedding
  if (r.rem() >= 2) {
    r.i16(); // idTitle
  }
}

/**
 * @deprecated Gói LOGIN_SUCESS (cmd -34) không mang map snapshot; luồng map/Park chuẩn
 * sử dụng `decodeParkJoinWorld` (cmd 80).
 */
export function decodeEnterWorld(body: Buffer): EnterWorldSnapshot {
  const r = new StrictReader(body);

  r.in('header');
  r.i8(); // flag
  const playerId = r.i32();
  r.utf(); // tên nhân vật
  r.i8(); r.i8(); r.i16(); r.i16();

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

/**
 * Decode the native response to AVATAR_JOIN_PARK (cmd 80).
 *
 * This is intentionally a separate parser from LOGIN_SUCESS (-34): the live
 * server sends room/board/coordinates first, then the Park list-player shape
 * (18-byte state + drop-part vector), followed by map sections and specials.
 * The current build appends a stable 20-byte suffix after the special list;
 * callers receive its length but never interpret it as NPC data.
 */
export function decodeParkJoinWorld(body: Buffer, playerId: number): EnterWorldSnapshot {
  const r = new StrictReader(body);
  if (!Number.isInteger(playerId) || playerId <= 0) {
    throw new WorldDataDecodeError('header', 0, 'playerId không hợp lệ cho Park snapshot');
  }

  const parkCount = (section: string): number => {
    r.in(section);
    if (r.rem() < 1) return 0;
    const count = r.i8();
    if (count === -1 || count === 0) return 0;
    if (count < 0 || count > 64) {
      throw new WorldDataDecodeError(section, r.pos - 1, `count ngoài bounds: ${count}`);
    }
    return count;
  };

  r.in('park-header');
  const roomId = r.i8();
  const boardId = r.i8();
  const x = r.i16();
  const y = r.i16();

  r.in('park-players');
  try {
    const playerCount = parkCount('park-players');
    for (let i = 0; i < playerCount; i += 1) {
      r.in(`park-players[${i}]`);
      r.i32();
      r.utf();
      const partCount = parkCount(`park-players[${i}].parts`);
      r.skip(partCount * 2, `park-players[${i}].parts`);
      // Native ParkService / readListPlayer state tail is 17 bytes (11 fields).
      readPlayerStateTail(r);
    }
  } catch {
    // Không để lỗi giải mã danh sách người chơi phụ làm gián đoạn việc vào phòng/map
  }

  const specials: MapSpecial[] = [];

  // Các khối map, animation và special phía sau là tùy chọn / best-effort:
  try {
    if (r.rem() >= 2) {
      r.in('park-map-marker');
      const mapMarker = r.i16();
      if (mapMarker >= 1) {
        const typeCount = parkCount('park-map-item-types');
        for (let i = 0; i < typeCount; i += 1) {
          r.skip(8, `park-map-item-types[${i}]`);
          const notTransCount = parkCount(`park-map-item-types[${i}].notTrans`);
          r.skip(notTransCount * 2, `park-map-item-types[${i}].notTrans`);
        }
        const itemCount = parkCount('park-map-items');
        r.skip(itemCount * 4, 'park-map-items');
      }
    }

    if (r.rem() >= 1) {
      r.in('park-animations');
      const animationCount = parkCount('park-animations');
      if (animationCount > 0) {
        r.skip(animationCount * 10, 'park-animations');
      }
    }

    if (r.rem() >= 1) {
      r.in('park-specials');
      const specialCount = parkCount('park-specials');
      for (let i = 0; i < specialCount; i += 1) {
        r.in(`park-specials[${i}]`);
        const id = r.i32();
        const name = r.utf();
        const specialX = r.i32();
        const specialY = r.i32();
        const type = r.i8();
        const imageCount = parkCount(`park-specials[${i}].images`);
        const imageIds: number[] = [];
        for (let image = 0; image < imageCount; image += 1) imageIds.push(r.i16());
        r.skip(8 * 4, `park-specials[${i}].state`);
        const menuCount = parkCount(`park-specials[${i}].menus`);
        const menuIds: number[] = [];
        for (let menu = 0; menu < menuCount; menu += 1) menuIds.push(r.i16());
        specials.push({
          id,
          name,
          type,
          imageIds,
          menuIds,
          x: specialX,
          y: specialY,
        });
      }
    }
  } catch {
    // Không làm sập parser nếu trailing metadata của map khác phiên bản
  }

  return {
    playerId,
    specials,
    specialSectionEnd: r.pos,
    totalBytes: body.length,
    trailingBytes: body.length - r.pos,
    roomId,
    boardId,
    x,
    y,
  };
}
