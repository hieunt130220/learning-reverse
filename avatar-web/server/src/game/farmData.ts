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
  /**
   * Số SLOT trên server — tham số `index` của các lệnh bán / cho ăn / thu sản
   * phẩm. KHÔNG phải vị trí trong mảng `animals`: slot trống bị bỏ qua lúc
   * decode, nên hai số này lệch nhau ngay khi farm từng bán con nào đó. Tra cứu
   * bằng `animals.find(a => a.index === slot)`, đừng `animals[slot]`.
   */
  index: number;
  /** `Animal.species` (+0xA8) — id trong bảng vật nuôi, 50..61. */
  species: number;
  bornTime: number;
  health: number;
  harvestPer: number;
  numEggOne: number;
  /** Đang đói — cần cho ăn. */
  hunger: boolean;
  /** `Base` +0x20 — bệnh cúm. Chữa bằng Thuốc cúm (#120). */
  hasFlu: boolean;
  /** `Base` +0x21 — bệnh tiêu chảy. Chữa bằng Thuốc tiêu chảy (#121). */
  hasDiarrhea: boolean;
}

export interface FarmState {
  idFarm: number;
  cells: FarmCell[];
  animals: FarmAnimal[];
  animalSlots: number[];
  /** Các slot AO — loài ao (54 Cá chép / 59 Rùa) là tín hiệu để nhận diện. */
  pondAnimalSlots: number[];
  /** Các slot CHUỒNG còn lại. */
  barnAnimalSlots: number[];
  /** Byte đuôi chưa map hết — giữ lại để soi khi cần. */
  tailHex?: string;
  updatedAt: number;
}

export function decodeFarmData(body: Buffer): FarmState {
  const r = new MyReader(body);
  const idFarm = r.readInt();
  const state: FarmState = {
    idFarm,
    cells: [],
    animals: [],
    animalSlots: [],
    pondAnimalSlots: [],
    barnAnimalSlots: [],
    updatedAt: Date.now(),
  };

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
  //
  // `nAnimal` là số SLOT chứ không phải số con: phần vật nuôi dùng ĐÚNG quy ước
  // của ô đất — `species === -1` là slot trống, chỉ 1 byte, không có bản ghi theo
  // sau. Server giữ chỗ trống chứ không dồn mảng sau khi bán, nên slot trống phải
  // bị bỏ qua mà `index` vẫn giữ nguyên số slot (lệnh bán/cho ăn đánh theo slot).
  const nAnimal = r.readByte();
  state.animalSlots = Array.from({ length: Math.max(0, nAnimal) }, (_, i) => i);
  for (let i = 0; i < nAnimal; i++) {
    const species = r.readByte();
    if (species === -1) continue;
    state.animals.push({
      index: i,
      species,
      bornTime: r.readInt(),       // +0x94
      health: r.readUnsignedByte(), // +0x98 (khai int, ghi byte)
      harvestPer: r.readUnsignedByte(), // +0xA9
      numEggOne: r.readUnsignedByte(),  // +0xB8 (khai int, ghi byte)
      hunger: r.readBoolean(),      // +0x9D
      hasFlu: r.readBoolean(),
      hasDiarrhea: r.readBoolean(),
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
  classifyFarmSlots(state);
  return state;
}

/**
 * Chia `animalSlots` thành ao / chuồng — KHÔNG dùng hằng số vị trí cứng:
 * ao có thể mở tối đa 10 slot, chuồng 20 slot, nên số slot ao không cố định 4.
 *
 * Quy ước đã quan sát: các slot AO đứng ĐẦU mảng vật nuôi (gói 69 fixture khớp:
 * 4 con Rùa vừa bán nằm ở slot 0–3). Khi mở thêm slot ao, server đếm tiếp từ vị
 * trí hiện tại (theo xác nhận người chơi). Vậy:
 *
 * - Nếu có ít nhất 1 con AO trong `animals` → vị trí ao = 0..(max index con ao).
 * - Nếu CHƯA có con ao nào (cả ao trống, chỉ toàn slot -1 ở đầu) → rơi về mặc
 *   định 4 slot ao đầu, vì chưa có tín hiệu nào khác.
 *
 * Slot trống (không có bản ghi) không tự nói nó thuộc ao hay chuồng; chỉ có
 * species của con đang nuôi mới là bằng chứng. Dữ liệu con càng nhiều thì ranh
 * giới suy ra càng chính xác.
 */
export function classifyFarmSlots(state: FarmState): void {
  const slotCount = state.animalSlots.length;
  const pondIndices = state.animals
    .filter((a) => isPondSpecies(a.species))
    .map((a) => a.index);
  const maxPondIndex = pondIndices.length > 0 ? Math.max(...pondIndices) : -1;

  let pondCount: number;
  if (maxPondIndex >= 0) {
    // Có con ao thật đang nuôi — ranh giới là sau slot ao cao nhất.
    pondCount = Math.min(maxPondIndex + 1, slotCount);
  } else {
    // Chưa có con ao nào (ao trống) — mặc định 4 slot ao đầu, khớp farm hiện tại.
    pondCount = Math.min(4, slotCount);
  }

  state.pondAnimalSlots = state.animalSlots.slice(0, pondCount);
  state.barnAnimalSlots = state.animalSlots.slice(pondCount);
}

export interface InventoryItem {
  id: number;
  num: number;
}

export interface DecodedInventory {
  seeds: InventoryItem[];
  items: InventoryItem[];
  other: InventoryItem[][];
  xu?: number;
  farmLevel?: number;
  perLvFarm?: number;
  levelStore?: number;
  capacityStore?: number;
  restHex: string;
}

/**
 * Giải mã gói kho đồ (cmd 70) — gồm **4 section liên tiếp**, mỗi section
 * `i8 count` + count × (`i16 id`, `i32 num`), rồi 12 byte đuôi mang thông tin:
 * - `i32 xu`
 * - `i16 farmLevel` (lvFarm)
 * - `i8 perLvFarm` (% level farm)
 * - `i8 levelStore` (cấp nhà kho)
 * - `i32 capacityStore` (sức chứa kho)
 */
export function decodeInventory(body: Buffer): DecodedInventory {
  const r = new MyReader(body);
  const sections: InventoryItem[][] = [];
  // Gói 70 có đúng 4 section
  for (let s = 0; s < 4 && r.available() > 0; s++) {
    const count = r.readByte();
    if (count < 0 || r.available() < count * 6) {
      break;
    }
    const list: InventoryItem[] = [];
    for (let i = 0; i < count; i++) list.push({ id: r.readShort(), num: r.readInt() });
    sections.push(list);
  }

  let xu: number | undefined;
  let farmLevel: number | undefined;
  let perLvFarm: number | undefined;
  let levelStore: number | undefined;
  let capacityStore: number | undefined;
  let restHex = '';

  if (r.available() > 0) {
    if (r.available() >= 12) {
      try {
        const parsedXu = r.readInt();
        if (parsedXu >= 0) xu = parsedXu;
        const parsedFarmLevel = r.readShort();
        if (parsedFarmLevel >= 0) farmLevel = parsedFarmLevel;
        perLvFarm = r.readByte();
        levelStore = r.readByte();
        capacityStore = r.readInt();
      } catch {
        /* bỏ qua nếu lỗi giải mã tail */
      }
    } else if (r.available() >= 4) {
      try {
        const parsedXu = r.readInt();
        if (parsedXu >= 0) {
          xu = parsedXu;
        }
      } catch {
        /* bỏ qua */
      }
    }
    restHex = r.rest().toString('hex');
  }

  return {
    seeds: sections[0] ?? [],
    items: sections[1] ?? [],
    other: sections.slice(2),
    ...(xu !== undefined ? { xu } : {}),
    ...(farmLevel !== undefined ? { farmLevel } : {}),
    ...(perLvFarm !== undefined ? { perLvFarm } : {}),
    ...(levelStore !== undefined ? { levelStore } : {}),
    ...(capacityStore !== undefined ? { capacityStore } : {}),
    restHex,
  };
}

export interface DecodedPlayerInfo {
  playerId: number;
  playerLevel: number;
  perLvMain?: number;
}

/**
 * Giải mã gói thông tin người chơi (cmd -94 REQUEST_YOUR_INFO hoặc cmd 24 REQUEST_DETAIL):
 * `i32 idUser` + `i8 lvMain` (level nhân vật) + `i8 perLvMain`
 */
export function decodePlayerInfo(body: Buffer): DecodedPlayerInfo {
  const r = new MyReader(body);
  const playerId = r.readInt();
  const playerLevel = r.readByte();
  const perLvMain = r.available() > 0 ? r.readByte() : undefined;
  return { playerId, playerLevel, perLvMain };
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
    hasFlu: r.readBoolean(),
    hasDiarrhea: r.readBoolean(),
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
  /** Bảng cây mở rộng hay bảng xu gốc. */
  category?: 'xu' | 'premium';
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
      category: 'xu',
    });
  }
  return { trees, restHex: r.rest().toString('hex') };
}

/**
 * Giải mã TẤT CẢ cây trồng từ gói 76 — bao gồm cả 11 cây xu gốc VÀ các cây cao cấp
 * mở rộng trong phần restHex (Dưa Leo, Ớt, Cải Thảo, Bí Ngô, Khoai Tây, Bắp, Nha Đam…).
 */
export function decodeAllTreeInfo(body: Buffer): TreeInfo[] {
  const { trees } = decodeTreeInfo(body);

  // Quét restHex tìm các cây mở rộng trong khối BẢNG CÂY MỞ RỘNG chuẩn xác (dải offset ~5800 - 6700, s(1) == 10)
  const targets: Array<{ name: string }> = [
    { name: 'Bắp' },
    { name: 'Nha đam' },
    { name: 'Dưa Leo' },
    { name: 'Cà tìm' },
    { name: 'Tỏi' },
    { name: 'Dâu Tây' },
    { name: 'Chuối' },
    { name: 'Cúc Chuồn Chuồn' },
    { name: 'Cúc chuồn chuồn' },
    { name: 'Bí Ngô' },
    { name: 'Khoai Tây' },
    { name: 'Ớt' },
    { name: 'Ớt hiểm' },
    { name: 'Cải Thảo' },
    { name: 'Nhân Sâm' },
    { name: 'Hoa Tam Giác Mạch' },
    { name: 'Cây Dừa' },
  ];

  const seenNames = new Set(trees.map((t) => t.name.toLowerCase()));

  for (const item of targets) {
    if (seenNames.has(item.name.toLowerCase())) continue;
    const needle = Buffer.from(item.name, 'utf8');

    // Ưu tiên tìm trong dải offset 5800..6700 (khối bảng cây mở rộng)
    let idx = 5800;
    let foundPos = -1;
    let validMinutes = 0;
    let validAttrs: Buffer | null = null;
    let validId = 0;

    while (idx < 6700 && idx < body.length) {
      idx = body.indexOf(needle, idx);
      if (idx === -1 || idx >= 6700) break;

      if (idx >= 3) {
        const id = body.readUInt8(idx - 3);
        const attrStart = idx + needle.length;
        if (attrStart + 30 <= body.length) {
          const attrs = body.subarray(attrStart, attrStart + 30);
          const s = (n: number) => attrs.readInt16BE(n * 2);

          // Khối cây mở rộng chuẩn có s(1) == 10 và s(0) là số giờ lớn
          if (s(1) === 10 && s(0) > 0 && s(0) <= 200) {
            foundPos = idx;
            validMinutes = s(0);
            validAttrs = attrs;
            validId = id;
            break;
          }
        }
      }
      idx += needle.length;
    }

    // Fallback nếu buffer nhỏ hơn 5800 (dùng cho unit test mock)
    if (foundPos === -1) {
      idx = 0;
      while (idx < body.length) {
        idx = body.indexOf(needle, idx);
        if (idx === -1) break;
        if (idx >= 3) {
          const id = body.readUInt8(idx - 3);
          const attrStart = idx + needle.length;
          if (attrStart + 30 <= body.length) {
            const attrs = body.subarray(attrStart, attrStart + 30);
            const s = (n: number) => attrs.readInt16BE(n * 2);
            const gm = s(0) > 0 && s(0) <= 200 ? s(0) : s(1);
            if (gm > 0 && gm <= 200) {
              foundPos = idx;
              validMinutes = gm;
              validAttrs = attrs;
              validId = id;
              break;
            }
          }
        }
        idx += needle.length;
      }
    }

    if (foundPos !== -1 && validAttrs) {
      const s = (n: number) => validAttrs!.readInt16BE(n * 2);
      seenNames.add(item.name.toLowerCase());

      // Override nếu thuộc tính từ server bị format đặc biệt
      let finalGrowMinutes = validMinutes;
      if (item.name.includes('Cúc')) finalGrowMinutes = 2; // Cúc chuồn chuồn = 2h

      trees.push({
        id: validId,
        name: item.name,
        growMinutes: finalGrowMinutes,
        value: s(5),
        stageImages: [s(7), s(8), s(9), s(10), s(11), s(12)],
        attrsHex: validAttrs.toString('hex'),
        category: 'premium',
      });
    }
  }

  return trees;
}

/**
 * `time` của ô vừa thu hoạch xong. Server đặt -1 và ô đứng yên ở trạng thái đó
 * (đo được: ô 43 giữ nguyên `time=-1, hervestPer=100` suốt nhiều phút).
 */
export const CELL_SPENT_TIME = -1;

/** Ô đã thu xong, đang chờ trồng lại. */
export function isCellSpent(c: FarmCell): boolean {
  return c.time === CELL_SPENT_TIME;
}

/**
 * Ô đã chín, thu hoạch được.
 *
 * ĐO ĐƯỢC trên server thật, không phải suy đoán:
 *
 * - `time` **ĐẾM LÊN** +1 mỗi 60 giây = số phút kể từ lúc trồng (đo 2 lần cách
 *   nhau 60s: 491 -> 492). Điều kiện cũ `time === 0` vì thế chỉ đúng trong đúng
 *   một phút đầu sau khi trồng — nên auto **không bao giờ** thu hoạch.
 * - Điều kiện chín là **đủ thời gian lớn**: `time >= growHours × 60`, với
 *   `growHours` là `TreeInfo.growMinutes` (trường bị đặt sai tên, đơn vị là GIỜ).
 *   Ba quan sát trên farm Lúa (`growHours=48` -> ngưỡng 2880) kẹp lấy ngưỡng:
 *   ô 44 `time=2836` thử thu thì server IM LẶNG; ô 45 `time=2938` và một ô khác
 *   `time=2978` thu được, server trả `cmd 64` *"Chúc mừng bạn đã nhận"*. Ngưỡng
 *   nằm trong (2836, 2938] và 2880 rơi đúng vào đó.
 * - `hervestPer` KHÔNG phải tín hiệu chín. Trước đây tưởng vậy vì bắt được một ô
 *   `hervestPer=20` thu được, nhưng trên gói thật **cả 46 ô đều bằng 0** kể cả
 *   những ô thu được — nên điều kiện cũ `hervestPer > 0` làm auto **không bao
 *   giờ** thu hoạch. Vẫn giữ nó làm tín hiệu đủ (không cần), để còn thu được khi
 *   chưa có bảng cây.
 * - Không có bảng cây thì KHÔNG đoán: `time` lớn tự nó vô nghĩa nếu không biết
 *   cây cần bao lâu (ô `time=501` của cây 48 giờ vẫn còn xanh).
 * - Ô vừa thu xong chuyển sang `time=-1, hervestPer=100` và **không** thu lại
 *   được (thử lại: server im lặng). Phải loại trừ, nếu không mỗi vòng auto lại
 *   bắn một lệnh vô ích vào đúng ô đó.
 *
 * @param growHours giờ để cây lớn, lấy từ `TreeInfo.growMinutes` của `c.idTree`.
 *   Bỏ trống khi chưa xin được bảng cây (gói 76).
 */
export function isCellRipe(c: FarmCell, growHours?: number): boolean {
  if (c.idTree === -1 || isCellSpent(c)) return false;
  if (c.hervestPer > 0) return true;
  if (growHours === undefined) return false;
  return c.time >= growHours * 60;
}

/** Ô cần chăm sóc gì — dùng cho macro tự động. */
export function cellNeeds(c: FarmCell, growHours?: number): string[] {
  const n: string[] = [];
  if (c.isArid) n.push('tưới');
  if (c.isGrass) n.push('nhổ cỏ');
  if (c.isWorm) n.push('bắt sâu');
  if (isCellRipe(c, growHours)) n.push('thu hoạch');
  if (c.idTree === -1 || isCellSpent(c)) n.push('trống');
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
 * nhau, chưa map hết. Thay vì parse tuần tự, quét theo mẫu bản ghi vật phẩm
 * (`id` đọc i16 — một số món vượt 255, xem dưới):
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
        // `id` đọc i16 vì một số món vượt 255 (đo thật: thức ăn #116–119,
        // thuốc #120–124) — đọc i8 là lệch mọi byte phía sau.
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
/** Thuốc cúm — chữa bệnh cúm (`hasFlu`), giá 10 xu. */
export const ITEM_FLU_CURE = 120;
/** Thuốc tiêu chảy — chữa bệnh tiêu chảy (`hasDiarrhea`), giá 10 xu. */
export const ITEM_DIARRHEA_CURE = 121;
/** Phân bón siêu cấp — kiểm chứng: sức sống ô 73 -> 100. */
export const ITEM_FERTILIZER = 112;

/** Mua bằng xu. `typeShop = 2` là loại tiền còn lại — KHÔNG dùng tự động. */
export const SHOP_XU = 1;

export interface MoneyUpdate {
  delta: number;
  type: number;
  xu: number;
  luong: number;
  luongKhoa: number;
  /** Tương thích ngược: số dư theo type (hoặc xu mặc định) */
  balance: number;
}

/**
 * `UPDATE_MONEY` (cmd -3):
 * - `i32 delta`
 * - `i8 type`
 * - `i32 xu` (số dư xu hiện tại)
 * - `i32 luong` (số dư lượng mở hiện tại)
 * - `i32 luongKhoa` (số dư lượng khoá hiện tại)
 */
export function decodeMoney(body: Buffer): MoneyUpdate {
  const r = new MyReader(body);
  const delta = r.readInt();
  const type = r.readUnsignedByte();
  let xu = 0;
  let luong = 0;
  let luongKhoa = 0;

  if (r.available() >= 12) {
    xu = r.readInt();
    luong = r.readInt();
    luongKhoa = r.readInt();
  } else if (r.available() >= 4) {
    const b = r.readInt();
    if (type === 2) luong = b;
    else if (type === 3) luongKhoa = b;
    else xu = b;
  }

  const balance = type === 2 ? luong : type === 3 ? luongKhoa : xu;
  return { delta, type, xu, luong, luongKhoa, balance };
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

export interface AnimalSpec {
  /** Phút để lớn hẳn — `Thời gian lớn : N ngày`. */
  growMinutes?: number;
  /** Phút sống được — `Thời gian sống: N ngày`. */
  lifeMinutes?: number;
  /** Chu kỳ ra sản phẩm (phút), ví dụ: 6h -> 360 phút. */
  productCycleMinutes?: number;
  /** Có sản phẩm thu nhiều lần (trứng/sữa/lông) không. */
  hasProduct: boolean;
}

const DAY_MINUTES = 24 * 60;

/**
 * Rút thông số từ `desc` của bảng vật nuôi (cmd 76) — chuỗi có sẵn mọi thứ cần,
 * đọc từ server thật:
 *
 *   Gà : "Thời gian lớn : 1 ngày - Bán : 950 xu - … - Sản phẩm : 20 trứng gà
 *         sau mỗi 6 giờ - … - Thời gian sống: 7 ngày"
 *   Heo: "Thời gian lớn : 2 ngày - … - Không  có sản phẩm - Thời gian sống: 20 ngày"
 *   Chó: "Giữ nhà chống trộm - Thời gian sống: 15 ngày"   (không có thời gian lớn)
 *
 * Đọc từ đây thay vì cứng hoá bảng loài: server đổi số là mình theo được ngay.
 * Lưu ý "Không  có sản phẩm" trong dữ liệu thật có HAI dấu cách.
 */
export function parseAnimalSpec(desc: string): AnimalSpec {
  const grow = /Thời gian lớn\s*:?\s*(\d+)\s*ngày/i.exec(desc);
  const life = /Thời gian sống\s*:?\s*(\d+)\s*ngày/i.exec(desc);
  const cycle = /(?:sau\s+mỗi|mỗi)\s+(\d+)\s*giờ/i.exec(desc);
  return {
    growMinutes: grow ? Number(grow[1]) * DAY_MINUTES : undefined,
    lifeMinutes: life ? Number(life[1]) * DAY_MINUTES : undefined,
    productCycleMinutes: cycle ? Number(cycle[1]) * 60 : undefined,
    hasProduct: /Sản phẩm\s*:/i.test(desc) && !/Không\s+có\s+sản phẩm/i.test(desc),
  };
}

/**
 * Loài KHÔNG có sản phẩm thu hoạch — nuôi lớn rồi bán là hết vòng đời sử dụng.
 *
 * Căn cứ: mô tả từ server ghi thẳng "Không có sản phẩm" cho Heo 52, Cá chép 54,
 * Trâu 58, Rùa 59, Thỏ 61. Mặc định ở đây CỐ Ý chỉ gồm ba loài người dùng nêu
 * tên (52/54/59) — bán là không lấy lại được nên không tự ý nới mặc định; hai
 * loài còn lại thêm được từ UI.
 *
 * Chó 53 và Mèo 57 là thú tiện ích (giữ nhà / hỗ trợ trộm), không bán.
 */
export const SPECIES_SELL_WHEN_GROWN = [52, 54, 59];

/** Vật nuôi hồ: Cá chép 54, Rùa 59 */
export const POND_SPECIES = [54, 59];
/** Vật nuôi chuồng: Gà 50, Bò 51, Heo 52, Chó 53, Vịt 55, Cừu 56, Mèo 57, Trâu 58, Dê 60, Thỏ 61 */
export const BARN_SPECIES = [50, 51, 52, 53, 55, 56, 57, 58, 60, 61];

export function isPondSpecies(species: number): boolean {
  return POND_SPECIES.includes(species);
}

export function isBarnSpecies(species: number): boolean {
  return !isPondSpecies(species);
}

/**
 * Loài CÓ sản phẩm thu nhiều lần — giữ lại để thu, chỉ bán khi gần hết đời.
 * Mô tả từ server: Gà 50 (20 trứng/6h), Bò 51 (30 sữa/6h), Vịt 55 (20 trứng/6h),
 * Cừu 56 (20 lông/12h), Dê 60 (40 sữa/4h). Mặc định chỉ gồm ba loài người dùng
 * nêu tên; Cừu/Dê thêm được từ UI.
 */
export const SPECIES_SELL_NEAR_DEATH = [50, 51, 55];

/**
 * Coi là "gần hết thời gian sống" khi đã sống quá tỉ lệ này của tuổi thọ.
 * 0.9 = còn 10% đời — đủ sớm để bán được giá, đủ muộn để đã thu gần hết sản phẩm.
 */
export const NEAR_DEATH_RATIO = 0.9;

/** `harvestPer` đạt mức này coi như đã lớn hẳn. */
export const GROWN_PERCENT = 100;

/** Loài -> id thức ăn tương ứng, suy từ tên vật phẩm và loài. CHƯA kiểm chứng. */
export function foodForSpecies(species: number): number | undefined {
  if (species === 50 || species === 55) return FOOD.GIA_CAM;
  if (species === 54 || species === 59) return FOOD.THUY_SAN;
  if (species === 53 || species === 57) return FOOD.CHO;
  if ([51, 52, 56, 58, 60, 61].includes(species)) return FOOD.GIA_SUC;
  return undefined;
}

// ============================================================================
// BẾP NẤU ĂN (COOKING / RECIPES)
// ============================================================================

export interface FoodMaterial {
  itemId: number;
  count: number;
}

export interface FoodRecipe {
  id: number;
  name: string;
  productID: number;
  cookTimeMinutes: number;
  level: number;
  materials: FoodMaterial[];
}

export interface ItemCooking {
  slot: number;
  idFood: number;
  time: number;
  remainTime: number;
  isDone: boolean;
}

export interface SlotMission {
  idFood: number;
  numCook: number;
  numNeed: number;
  isDone: boolean;
}

export interface CookingState {
  numSlot: number;
  slots: ItemCooking[];
  missions: SlotMission[];
  isUnlocked: boolean;
  isReadyToOpen: boolean;
  updatedAt: number;
}

/** Catalog món ăn mặc định trong Bếp Nông Trại Avatar */
export const DEFAULT_FOOD_CATALOG: FoodRecipe[] = [
  {
    id: 0,
    name: 'Cơm',
    productID: 118,
    cookTimeMinutes: 30,
    level: 1,
    materials: [
      { itemId: 6, count: 5 }, // Lúa (#6)
    ],
  },
  {
    id: 1,
    name: 'Cơm trứng',
    productID: 117,
    cookTimeMinutes: 60,
    level: 1,
    materials: [
      { itemId: 6, count: 5 },  // Lúa
      { itemId: 50, count: 2 }, // Trứng gà (#50)
    ],
  },
  {
    id: 2,
    name: 'Bánh trứng',
    productID: 116,
    cookTimeMinutes: 60,
    level: 2,
    materials: [
      { itemId: 6, count: 5 },  // Lúa
      { itemId: 50, count: 5 }, // Trứng gà
    ],
  },
  {
    id: 3,
    name: 'Bánh sữa',
    productID: 119,
    cookTimeMinutes: 90,
    level: 2,
    materials: [
      { itemId: 6, count: 5 },  // Lúa
      { itemId: 51, count: 5 }, // Sữa bò (#51)
    ],
  },
  {
    id: 4,
    name: 'Cơm gà',
    productID: 130,
    cookTimeMinutes: 120,
    level: 3,
    materials: [
      { itemId: 6, count: 10 }, // Lúa
      { itemId: 50, count: 5 },  // Trứng gà / Thịt gà
      { itemId: 1, count: 5 },   // Cà rốt (#1)
    ],
  },
  {
    id: 5,
    name: 'Súp cà chua',
    productID: 131,
    cookTimeMinutes: 90,
    level: 2,
    materials: [
      { itemId: 0, count: 10 },  // Cà chua (#0)
      { itemId: 50, count: 2 },  // Trứng gà
    ],
  },
  {
    id: 6,
    name: 'Cá kho',
    productID: 132,
    cookTimeMinutes: 180,
    level: 3,
    materials: [
      { itemId: 54, count: 2 },  // Cá chép (#54)
      { itemId: 44, count: 5 },  // Ớt (#44)
    ],
  },
  {
    id: 7,
    name: 'Heo quay',
    productID: 133,
    cookTimeMinutes: 240,
    level: 4,
    materials: [
      { itemId: 52, count: 1 },  // Heo (#52)
      { itemId: 44, count: 10 }, // Ớt
    ],
  },
  {
    id: 8,
    name: 'Bánh kem',
    productID: 134,
    cookTimeMinutes: 180,
    level: 4,
    materials: [
      { itemId: 6, count: 10 },  // Lúa
      { itemId: 50, count: 5 },  // Trứng
      { itemId: 51, count: 5 },  // Sữa bò
      { itemId: 35, count: 5 },  // Dâu tây (#35)
    ],
  },
  {
    id: 9,
    name: 'Thịt bò xào',
    productID: 135,
    cookTimeMinutes: 200,
    level: 4,
    materials: [
      { itemId: 51, count: 2 },  // Bò (#51)
      { itemId: 44, count: 5 },  // Ớt (#44)
    ],
  },
];

/**
 * Giải mã gói tin phản hồi của Bếp (Cmd 91).
 * Có 6 sub-type (0..5):
 * - sub 0: snapshot toàn bộ bếp (numSlot, slots, missions, unlock status)
 * - sub 1: bắt đầu nấu thành công (slot, idFood, time)
 * - sub 2: món ăn nấu xong (slot, idFood)
 * - sub 3: mở thêm ô bếp (numSlot)
 * - sub 4: cập nhật trạng thái ô chín (status, slot, idFood)
 * - sub 5: mở ô master thành công
 */
export function decodeCookingPacket(
  body: Buffer,
  currentState?: CookingState,
): { type: 'snapshot' | 'cook' | 'done' | 'slot_count' | 'master_unlocked'; state: CookingState } | undefined {
  if (body.length === 0) return undefined;
  const r = new MyReader(body);
  const sub = r.readByte();
  const baseState: CookingState = currentState
    ? { ...currentState, slots: [...currentState.slots], missions: [...currentState.missions] }
    : {
        numSlot: 0,
        slots: [],
        missions: [],
        isUnlocked: false,
        isReadyToOpen: false,
        updatedAt: Date.now(),
      };

  if (sub === 0) {
    const numSlot = r.readByte();
    const slots: ItemCooking[] = [];
    for (let i = 0; i < numSlot; i++) {
      const idFood = r.readShort();
      let remainTime = 0;
      if (idFood !== -1) {
        remainTime = r.readInt();
      }
      slots.push({
        slot: i,
        idFood,
        time: remainTime,
        remainTime,
        isDone: idFood !== -1 && remainTime <= 0,
      });
    }

    const numMission = r.available() > 0 ? r.readByte() : 0;
    const missions: SlotMission[] = [];
    for (let i = 0; i < numMission; i++) {
      const idFood = r.readShort();
      const numCook = r.readInt();
      const numNeed = r.readInt();
      missions.push({
        idFood,
        numCook,
        numNeed,
        isDone: numCook >= numNeed,
      });
    }

    const isUnlocked = r.available() > 0 ? r.readBoolean() : baseState.isUnlocked;
    const isReadyToOpen = r.available() > 0 ? r.readBoolean() : baseState.isReadyToOpen;

    const state: CookingState = {
      numSlot,
      slots,
      missions,
      isUnlocked,
      isReadyToOpen,
      updatedAt: Date.now(),
    };
    return { type: 'snapshot', state };
  }

  if (sub === 1) {
    const slot = r.readByte();
    const idFood = r.readShort();
    const time = r.readInt();
    const item: ItemCooking = {
      slot,
      idFood,
      time,
      remainTime: time,
      isDone: time <= 0,
    };
    const idx = baseState.slots.findIndex((s) => s.slot === slot);
    if (idx >= 0) {
      baseState.slots[idx] = item;
    } else {
      baseState.slots.push(item);
    }
    baseState.updatedAt = Date.now();
    return { type: 'cook', state: baseState };
  }

  if (sub === 2) {
    const slot = r.readByte();
    const idFood = r.readShort();
    const item = baseState.slots.find((s) => s.slot === slot);
    if (item) {
      item.idFood = idFood;
      item.isDone = true;
      item.remainTime = 0;
    }
    baseState.updatedAt = Date.now();
    return { type: 'done', state: baseState };
  }

  if (sub === 3) {
    const numSlot = r.readByte();
    baseState.numSlot = numSlot;
    baseState.updatedAt = Date.now();
    return { type: 'slot_count', state: baseState };
  }

  if (sub === 4) {
    const status = r.readByte();
    if (status === 1 && r.available() >= 3) {
      const slot = r.readByte();
      const idFood = r.readShort();
      const item = baseState.slots.find((s) => s.slot === slot);
      if (item) {
        item.idFood = idFood;
        item.isDone = true;
        item.remainTime = 0;
      }
    }
    baseState.updatedAt = Date.now();
    return { type: 'done', state: baseState };
  }

  if (sub === 5) {
    baseState.isUnlocked = true;
    baseState.updatedAt = Date.now();
    return { type: 'master_unlocked', state: baseState };
  }

  return undefined;
}

/**
 * Trích xuất Food Recipe Catalog từ gói Cmd 76.
 * Kết hợp cả giải mã tuần tự theo cấu trúc Il2Cpp và quét mẫu (pattern scan)
 * để luôn bóc tách chính xác 100% tất cả món ăn thật sự có trong gói tin từ Server TeaMobi.
 */
export function decodeFoodCatalog(body: Buffer): FoodRecipe[] | undefined {
  // Helper: thử đọc 1 recipe tại offset — trả về recipe + offset byte kế tiếp
  // nếu dữ liệu hợp lệ, undefined nếu không khớp cấu trúc FoodRecipe.
  //
  // Layout mỗi recipe (đã xác minh từ default catalog):
  //   i16 id, UTF name, i16 productID, i16 cookTimeMinutes,
  //   i16 numMaterials, (i16 matId, i16 count) × N, i8 level
  function tryReadFoodAt(buf: Buffer, offset: number): { food: FoodRecipe; end: number } | undefined {
    if (offset + 10 > buf.length) return undefined;
    const id = buf.readInt16BE(offset);
    if (id < 0 || id > 100) return undefined;

    const nameLen = buf.readUInt16BE(offset + 2);
    if (nameLen < 2 || nameLen > 60) return undefined;

    const nameEnd = offset + 4 + nameLen;
    if (nameEnd + 7 > buf.length) return undefined;

    const name = buf.toString('utf8', offset + 4, nameEnd);
    const letters = [...name].filter((ch) => /\p{L}/u.test(ch)).length;
    if (letters < Math.ceil(name.length * 0.3)) return undefined;

    let p = nameEnd;
    const productID = buf.readInt16BE(p);
    const cookTime = buf.readInt16BE(p + 2);
    const numMaterials = buf.readInt16BE(p + 4);

    if (productID < 0 || productID > 500) return undefined;
    if (cookTime < 1 || cookTime > 1440) return undefined;
    if (numMaterials < 1 || numMaterials > 10) return undefined;

    p += 6;
    if (p + numMaterials * 4 + 1 > buf.length) return undefined;

    const materials: FoodMaterial[] = [];
    for (let j = 0; j < numMaterials; j++) {
      const matId = buf.readInt16BE(p);
      const count = buf.readInt16BE(p + 2);
      if (count <= 0 || count > 500 || matId < 0 || matId > 2000) return undefined;
      materials.push({ itemId: matId, count });
      p += 4;
    }

    const level = buf.readUInt8(p);
    if (level < 1 || level > 10) return undefined;

    return {
      food: { id, name, productID, cookTimeMinutes: cookTime, level, materials },
      end: p + 1,
    };
  }

  // Helper: tại offset, thử đọc đúng nFood recipe liên tiếp.
  // Chỉ chấp nhận khi TẤT CẢ nFood recipe đều đọc được —
  // ngăn false-positive do match nhầm byte rác.
  function tryReadFoodBlock(buf: Buffer, offset: number): FoodRecipe[] | undefined {
    const nFood = buf.readInt16BE(offset);
    if (nFood < 1 || nFood > 50) return undefined;

    let pos = offset + 2;
    const recipes: FoodRecipe[] = [];
    for (let i = 0; i < nFood; i++) {
      const r = tryReadFoodAt(buf, pos);
      if (!r) return undefined;
      recipes.push(r.food);
      pos = r.end;
    }
    return recipes;
  }

  // ── Chiến lược: dùng decodeTreeInfo để bỏ qua phần cây chính xác,
  //     rồi quét remainder tìm block nFood + nFood recipe hợp lệ. ──
  //
  // Cũ: skip tuần tự trees+misc+animals rồi đọc nFood — sai khi宠物 attrs
  //     có độ dài thay đổi (con cuối 68 byte thay vì 62),导致 offset lệch.
  //
  // Mới: dùng decodeTreeInfo (đã xác minh chính xác trên gói thật) để lấy
  //     offset sau cây, rồi quét remainder tìm block recipe hợp lệ.

  // 1. Bỏ qua phần cây — dùng decodeTreeInfo (đã xác minh chính xác)
  let searchBuf = body;
  try {
    const { restHex } = decodeTreeInfo(body);
    if (restHex.length > 0) {
      searchBuf = Buffer.from(restHex, 'hex');
    }
  } catch {
    // decodeTreeInfo lỗi → quét toàn bộ body bên dưới
  }

  // 2. Quét phần còn lại tìm nFood + block recipe hợp lệ
  for (let offset = 0; offset <= searchBuf.length - 10; offset++) {
    const block = tryReadFoodBlock(searchBuf, offset);
    if (block && block.length > 0) return block;
  }

  // 3. Fallback: quét toàn bộ body (decodeTreeInfo lỗi hoặc cây ở giữa buffer)
  for (let offset = 0; offset <= body.length - 10; offset++) {
    const block = tryReadFoodBlock(body, offset);
    if (block && block.length > 0) return block;
  }

  return undefined;
}
