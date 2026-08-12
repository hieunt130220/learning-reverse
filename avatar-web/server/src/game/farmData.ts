import { MyReader } from '../proto/reader.js';

/**
 * Giải mã gói dữ liệu farm tổng (`FarmMsgHandler.readFarmData` @0x639438),
 * đến trên cmd 69 (JOIN) và cmd 61. Cấu trúc lồng nhau (điều kiện + vòng lặp)
 * nên không biểu diễn được bằng schema phẳng.
 *
 * Layout theo notes/farm.md (đã xác minh tại RVA và khớp gói thật 619 byte).
 */

export interface FarmCell {
  index: number;
  /** -1 = ô trống (không có thêm dữ liệu trên wire). */
  idTree: number;
  /** Giây còn lại tới mốc kế tiếp. */
  time: number;
  vitalityPer: number;
  hervestPer: number;
  isArid: boolean;
  isWorm: boolean;
  isGrass: boolean;
  /** Cấp của ô, đọc từ mảng ở phần đuôi gói. */
  level?: number;
}

export interface FarmAnimal {
  index: number;
  /** `Animal.species` (+0xA8) — id trong bảng vật nuôi, 50..61. */
  species: number;
  bornTime: number;
  health: number;
  harvestPer: number;
  numEggOne: number;
  /** Đang đói — cần cho ăn. */
  hunger: boolean;
  /** Hai cờ ở `Base` +0x20/+0x21, chưa rõ tên. */
  flag20: boolean;
  flag21: boolean;
}

export interface FarmState {
  idFarm: number;
  cells: FarmCell[];
  animals: FarmAnimal[];
  /** Byte đuôi chưa map hết — giữ lại để soi khi cần. */
  tailHex?: string;
  updatedAt: number;
}

export function decodeFarmData(body: Buffer): FarmState {
  const r = new MyReader(body);
  const idFarm = r.readInt();
  const state: FarmState = { idFarm, cells: [], animals: [], updatedAt: Date.now() };

  // idFarm == -1 => không có dữ liệu, nhảy thẳng xuống phần đuôi.
  if (idFarm === -1) {
    state.tailHex = r.rest().toString('hex');
    return state;
  }

  const nCell = r.readByte();
  for (let i = 0; i < nCell; i++) {
    const idTree = r.readByte();
    if (idTree === -1) {
      state.cells.push({
        index: i,
        idTree: -1,
        time: 0,
        vitalityPer: 0,
        hervestPer: 0,
        isArid: false,
        isWorm: false,
        isGrass: false,
      });
      continue;
    }
    state.cells.push({
      index: i,
      idTree,
      time: r.readShort(),
      vitalityPer: r.readByte(),
      hervestPer: r.readByte(),
      isArid: r.readBoolean(),
      isWorm: r.readBoolean(),
      isGrass: r.readBoolean(),
    });
  }

  // Mỗi vật nuôi 11 byte: readFarmData đọc 1 byte lưu vào Animal.species (+0xA8)
  // RỒI mới gọi readInfoAnimal (10 byte) — y hệt cách nó đọc idTree trước readInfoCell.
  // Thiếu byte species này là lý do phần đuôi gói từng bị lệch 16 byte.
  const nAnimal = r.readByte();
  for (let i = 0; i < nAnimal; i++) {
    state.animals.push({
      index: i,
      species: r.readUnsignedByte(),
      bornTime: r.readInt(),       // +0x94
      health: r.readUnsignedByte(), // +0x98 (khai int, ghi byte)
      harvestPer: r.readUnsignedByte(), // +0xA9
      numEggOne: r.readUnsignedByte(),  // +0xB8 (khai int, ghi byte)
      hunger: r.readBoolean(),      // +0x9D
      flag20: r.readBoolean(),
      flag21: r.readBoolean(),
    });
  }

  // Đuôi theo notes/farm.md: `i8 A, i8 B, 7×i16, nCell×i8 level, …`.
  // Trước đây tưởng layout này sai (level ra 41/46/20) nhưng thực ra do bản ghi
  // vật nuôi thiếu byte species làm lệch 16 byte. Sửa xong thì khớp: 46 byte level
  // liền nhau, đúng bằng nCell.
  try {
    r.readByte();
    r.readByte();
    for (let i = 0; i < 7; i++) r.readShort();
    for (let i = 0; i < nCell; i++) {
      const level = r.readUnsignedByte();
      if (state.cells[i]) state.cells[i].level = level;
    }
  } catch {
    // dữ liệu lạ: bỏ qua, phần ô/vật nuôi ở trên đã đọc xong
  }
  state.tailHex = r.rest().toString('hex');

  return state;
}

export interface InventoryItem {
  id: number;
  num: number;
}

/**
 * Giải mã gói kho đồ (cmd 70) — gồm **4 section liên tiếp**, mỗi section
 * `i8 count` + count × (`i16 id`, `i32 num`), rồi 12 byte đuôi chưa map.
 *
 * Section 1 = hạt giống (id khớp bảng cây), section 2 = vật phẩm (id khớp bảng
 * vật phẩm: #123 Thuốc diệt cỏ, #124 Thuốc trừ sâu…). Section 3 và 4 chưa rõ.
 */
export function decodeInventory(body: Buffer): {
  seeds: InventoryItem[];
  items: InventoryItem[];
  other: InventoryItem[][];
  restHex: string;
} {
  const r = new MyReader(body);
  const sections: InventoryItem[][] = [];
  while (r.available() > 0) {
    const pos = r.position;
    const count = r.readByte();
    if (count <= 0 || r.available() < count * 6) {
      // hết section hợp lệ -> phần còn lại là đuôi
      return {
        seeds: sections[0] ?? [],
        items: sections[1] ?? [],
        other: sections.slice(2),
        restHex: body.subarray(pos).toString('hex'),
      };
    }
    const list: InventoryItem[] = [];
    for (let i = 0; i < count; i++) list.push({ id: r.readShort(), num: r.readInt() });
    sections.push(list);
  }
  return { seeds: sections[0] ?? [], items: sections[1] ?? [], other: sections.slice(2), restHex: '' };
}

/**
 * Cập nhật 1 ô từ gói `INFO_CELL` (cmd 100): `i8 index` + bản ghi ô y hệt trong
 * readFarmData. Server đẩy gói này sau `doUsingItem` khi trạng thái ô đổi.
 */
export function decodeInfoCell(body: Buffer): FarmCell {
  const r = new MyReader(body);
  const index = r.readUnsignedByte();
  const idTree = r.readByte();
  if (idTree === -1) {
    return { index, idTree: -1, time: 0, vitalityPer: 0, hervestPer: 0, isArid: false, isWorm: false, isGrass: false };
  }
  return {
    index,
    idTree,
    time: r.readShort(),
    vitalityPer: r.readByte(),
    hervestPer: r.readByte(),
    isArid: r.readBoolean(),
    isWorm: r.readBoolean(),
    isGrass: r.readBoolean(),
  };
}

/**
 * Cập nhật 1 con vật từ gói `INFO_ANIMAL` (cmd 101): `i8 iddb` + đúng bản ghi
 * 11 byte như trong readFarmData. Server đẩy sau khi cho ăn / chữa bệnh.
 */
export function decodeInfoAnimal(body: Buffer): FarmAnimal {
  const r = new MyReader(body);
  const index = r.readUnsignedByte();
  return {
    index,
    species: r.readUnsignedByte(),
    bornTime: r.readInt(),
    health: r.readUnsignedByte(),
    harvestPer: r.readUnsignedByte(),
    numEggOne: r.readUnsignedByte(),
    hunger: r.readBoolean(),
    flag20: r.readBoolean(),
    flag21: r.readBoolean(),
  };
}

export interface TreeInfo {
  id: number;
  name: string;
  /** Thời gian lớn, phút (Hoa Hồng 2 … Lúa 48) — khớp `time` còn lại trong gói farm. */
  growMinutes: number;
  /** Giá/sản lượng (chưa chắc tên gọi). */
  value: number;
  /** 6 id ảnh theo giai đoạn lớn. */
  stageImages: number[];
  attrsHex: string;
}

/**
 * Giải mã bảng cây trồng (cmd 76).
 *
 * Phần đầu — đã xác minh khớp 11/11 cây trên gói thật 13.336 byte:
 *   `i16 count`, rồi mỗi cây: `i8 id`, `utf name`, 30 byte thuộc tính cố định.
 *
 * Thuộc tính (15 × i16): `[0]=24 (hằng)`, `[1]=phút lớn`, `[2]=-1`, `[3]=10`,
 * `[4]=1`, `[5]=giá`, `[6]=?`, `[7..12]=6 ảnh giai đoạn`, `[13]=ảnh cuối`, `[14]=0`.
 *
 * Sau bảng cây còn các khối vật nuôi / vật phẩm / món ăn (~12,9 KB) chưa map —
 * trả về `restHex` để giải mã tiếp khi cần.
 */
export function decodeTreeInfo(body: Buffer): { trees: TreeInfo[]; restHex: string } {
  const r = new MyReader(body);
  const count = r.readShort();
  const trees: TreeInfo[] = [];
  for (let i = 0; i < count; i++) {
    const id = r.readUnsignedByte();
    const name = r.readUTF();
    const attrs = r.readBytes(30);
    const s = (n: number) => attrs.readInt16BE(n * 2);
    trees.push({
      id,
      name,
      growMinutes: s(1),
      value: s(5),
      stageImages: [s(7), s(8), s(9), s(10), s(11), s(12)],
      attrsHex: attrs.toString('hex'),
    });
  }
  return { trees, restHex: r.rest().toString('hex') };
}

/** Ô cần chăm sóc gì — dùng cho macro tự động. */
export function cellNeeds(c: FarmCell): string[] {
  const n: string[] = [];
  if (c.isArid) n.push('tưới');
  if (c.isGrass) n.push('nhổ cỏ');
  if (c.isWorm) n.push('bắt sâu');
  if (c.idTree !== -1 && c.time === 0) n.push('thu hoạch');
  if (c.idTree === -1) n.push('trống');
  return n;
}

export interface ItemInfo {
  id: number;
  icon: number;
  type: number;
  name: string;
  /** Giá mua bằng xu — kiểm chứng: Thuốc diệt cỏ #123 giá 5, mua hết đúng 5 xu. */
  price: number;
}

/**
 * Rút bảng vật phẩm ra khỏi gói cmd 76.
 *
 * Gói này gồm nhiều khối (cây / vật nuôi / vật phẩm / món ăn) với layout khác
 * nhau, chưa map hết. Thay vì parse tuần tự, quét theo mẫu bản ghi vật phẩm:
 *
 *   `i16 id, i16 icon, i16 type, utf name, i16 ?, i16 0xFFFF`
 *
 * Cái `0xFFFF` chốt đuôi làm mẫu này gần như không thể khớp nhầm — đối chiếu
 * với kho thật thì 9/11 id có mặt trong kho với đúng tên (Thuốc diệt cỏ #123,
 * Thuốc trừ sâu #124, Phân bón siêu cấp #112…).
 */
export function decodeItemCatalog(body: Buffer): ItemInfo[] {
  const u16 = (o: number) => body.readUInt16BE(o);
  const items: ItemInfo[] = [];
  let q = 0;
  while (q < body.length - 12) {
    const len = u16(q + 6);
    const end = q + 8 + len;
    if (len >= 2 && len <= 60 && end + 4 <= body.length && u16(end + 2) === 0xffff) {
      const name = body.toString('utf8', q + 8, end);
      // Cần ≥50% ký tự là chữ, nếu không sẽ lọt vài chuỗi rác trùng mẫu
      // (vd "( Nho", "/01") vì mẫu 6 byte + utf + FFFF không đủ chặt.
      const letters = [...name].filter((ch) => /\p{L}/u.test(ch)).length;
      if (name.trim() && !name.includes('�') && letters >= name.length / 2) {
        items.push({ id: u16(q), icon: u16(q + 2), type: u16(q + 4), name, price: u16(end) });
        q = end + 4;
        continue;
      }
    }
    q += 1;
  }
  return items;
}

/**
 * id truyền vào `doUsingItem`. Hai cái đầu ĐÃ kiểm chứng bằng gói thật:
 *
 * - `100` tưới nước — `useItem(farm, ô 0, 100)` làm `isArid` true -> false.
 *   Không có trong bảng vật phẩm và không tốn gì trong kho; là hằng số cứng
 *   trong `FarmScr.resetAction` @0x644674.
 * - `123` nhổ cỏ — `useItem(farm, ô 13, 123)` làm `isGrass` true -> false,
 *   server đẩy kèm `INFO_CELL`. Kho không bị trừ.
 * - `124` bắt sâu — suy từ tên 'Thuốc trừ sâu' trong bảng vật phẩm, CHƯA thử được.
 */
export const ITEM_WATER = 100;
export const ITEM_GRASS = 123;
export const ITEM_WORM = 124;
/** Thuốc bổ — kiểm chứng: máu vật nuôi 76 -> 96 (+20 mỗi liều). */
export const ITEM_TONIC = 122;
/** Phân bón siêu cấp — kiểm chứng: sức sống ô 73 -> 100. */
export const ITEM_FERTILIZER = 112;

/** Mua bằng xu. `typeShop = 2` là loại tiền còn lại — KHÔNG dùng tự động. */
export const SHOP_XU = 1;

export interface MoneyUpdate {
  delta: number;
  /** 1 = xu (loại đã kiểm chứng). */
  type: number;
  balance: number;
}

/** `UPDATE_MONEY` (cmd -3): `i32 delta`, `i8 type`, `i32 balance`. */
export function decodeMoney(body: Buffer): MoneyUpdate {
  const r = new MyReader(body);
  return { delta: r.readInt(), type: r.readUnsignedByte(), balance: r.readInt() };
}

export interface AnimalInfo {
  id: number;
  name: string;
  desc: string;
}

/**
 * Bảng vật nuôi trong gói cmd 76, nằm ngay sau bảng cây và một bảng 10 mục
 * (id 101–110) chưa rõ công dụng.
 *
 * `i16 count`, rồi mỗi con: `i8 id`, `utf name`, `utf desc`, 62 byte thuộc tính.
 * Xác minh trên gói thật: 12 con, id 50..61 (Gà, Bò, Heo, Chó, Cá chép, Vịt,
 * Cừu, Mèo Tinh Ranh, Trâu, Rùa, Dê, Thỏ).
 */
export function decodeAnimalCatalog(body: Buffer): AnimalInfo[] {
  const r = new MyReader(body);
  const nTree = r.readShort();
  for (let i = 0; i < nTree; i++) {
    r.readUnsignedByte();
    r.readUTF();
    r.readBytes(30);
  }
  const nMisc = r.readShort();
  r.readBytes(nMisc * 6);

  const n = r.readShort();
  const out: AnimalInfo[] = [];
  for (let i = 0; i < n; i++) {
    const id = r.readUnsignedByte();
    const name = r.readUTF();
    const desc = r.readUTF();
    // Con cuối (Thỏ) có khối thuộc tính 68 byte thay vì 62; chỉ đọc khi còn đủ.
    if (r.available() >= 62) r.readBytes(62);
    out.push({ id, name, desc });
  }
  return out;
}

/** Thức ăn theo loài — id lấy từ bảng vật phẩm (decodeItemCatalog). */
export const FOOD = {
  /** Thức ăn thủy sản — Cá chép, Rùa. */
  THUY_SAN: 116,
  /** Thức ăn gia cầm — Gà, Vịt. */
  GIA_CAM: 117,
  /** Thức ăn gia súc — Bò, Heo, Cừu, Trâu, Dê, Thỏ. */
  GIA_SUC: 118,
  /** Thưc ăn cho chó — Chó, Mèo. */
  CHO: 119,
};

/** Loài -> id thức ăn tương ứng, suy từ tên vật phẩm và loài. CHƯA kiểm chứng. */
export function foodForSpecies(species: number): number | undefined {
  if (species === 50 || species === 55) return FOOD.GIA_CAM;
  if (species === 54 || species === 59) return FOOD.THUY_SAN;
  if (species === 53 || species === 57) return FOOD.CHO;
  if ([51, 52, 56, 58, 60, 61].includes(species)) return FOOD.GIA_SUC;
  return undefined;
}
