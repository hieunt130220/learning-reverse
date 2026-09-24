import { readFileSync, existsSync } from 'node:fs';
import { MyReader } from '../proto/reader.js';

export interface PartEntry {
  id: number;
  coin: number;
  gold: number;
  follow: number;
  name: string;
  sell: number;
  zOrder: number;
  gender: number;
  level: number;
  idIcon: number;
}

export function decodeAvaPart(buf: Buffer): Map<number, PartEntry> {
  const r = new MyReader(buf);
  const count = r.readShort();
  const map = new Map<number, PartEntry>();

  for (let i = 0; i < count; i++) {
    const idPart = r.readShort();
    const coin = r.readInt();
    const gold = r.readShort();
    const follow = r.readShort();

    let name = '';
    let sell = 0;
    let zOrder = 0;
    let gender = 0;
    let level = 0;
    let idIcon = 0;

    if (follow === -1) {
      name = r.readUTF();
      sell = r.readByte();
      zOrder = r.readByte();
      gender = r.readByte();
      level = r.readByte();
      idIcon = r.readShort();
      // Bỏ qua 15 sub-elements
      for (let j = 0; j < 15; j++) {
        r.readShort();
        r.readByte();
        r.readByte();
      }
    } else if (follow === -2) {
      name = r.readUTF();
      sell = r.readByte();
      idIcon = r.readShort();
    } else {
      // PartFollow
      r.readShort(); // color
    }

    map.set(idPart, {
      id: idPart,
      coin,
      gold,
      follow,
      name,
      sell,
      zOrder,
      gender,
      level,
      idIcon,
    });
  }

  return map;
}

export function decodeSingleDynamicPart(buf: Buffer): PartEntry {
  const r = new MyReader(buf);
  const idPart = r.readShort();
  const coin = r.readInt();
  const gold = r.readShort();
  const follow = r.readShort();

  let name = '';
  let sell = 0;
  let zOrder = 0;
  let gender = 0;
  let level = 0;
  let idIcon = 0;

  if (follow === -1) {
    name = r.readUTF();
    sell = r.readByte();
    zOrder = r.readByte();
    gender = r.readByte();
    level = r.readByte();
    idIcon = r.readShort();
  } else if (follow === -2) {
    name = r.readUTF();
    sell = r.readByte();
    idIcon = r.readShort();
  }

  return {
    id: idPart,
    coin,
    gold,
    follow,
    name,
    sell,
    zOrder,
    gender,
    level,
    idIcon,
  };
}

export function getSlotName(z: number): string {
  switch (z) {
    case 10:
      return 'Tóc / Đầu';
    case 20:
      return 'Mặt / Mắt';
    case 30:
      return 'Áo';
    case 40:
      return 'Quần';
    case 50:
      return 'Cầm tay';
    case 60:
      return 'Cánh / Lưng';
    default:
      return z > 0 ? `Phụ kiện (z=${z})` : 'Chưa phân loại';
  }
}

// Bảng cache tĩnh dynamic parts đã biết
const KNOWN_DYNAMIC_PARTS: Record<number, { name: string; zOrder: number; iconId: number }> = {
  2182: { name: 'Thẻ X2 Quay Số', zOrder: 0, iconId: 393 },
  2188: { name: 'Cuốc', zOrder: 0, iconId: 1404 },
  2617: { name: 'Thẻ Quay Số Miễn Phí', zOrder: 0, iconId: 2445 },
  2764: { name: 'Cô Bé Đáng Yêu', zOrder: 10, iconId: 2973 },
  3372: { name: 'Thập Tự Ánh Sáng', zOrder: 0, iconId: 5579 },
  3658: { name: 'Học Sinh Lớp Mầm', zOrder: 60, iconId: 6629 },
  5014: { name: 'Mảnh ghép cú vọ', zOrder: 0, iconId: 10434 },
  6383: { name: 'Hộp bánh Trung Thu', zOrder: 0, iconId: 7777 },
  7695: { name: 'Huy hiệu hoa linh', zOrder: 0, iconId: 18459 },
  7696: { name: 'Huy hiệu mộc nguyệt', zOrder: 0, iconId: 18460 },
  7697: { name: 'Huy hiệu mộc diệp', zOrder: 0, iconId: 18461 },
  7698: { name: 'Huy hiệu bích lam diệp', zOrder: 0, iconId: 18462 },
};

let cachedPartMap: Map<number, PartEntry> | null = null;

export function getPartCatalog(cachePath = '/tmp/avatar-cache/sAvaPart.bin'): Map<number, PartEntry> {
  if (cachedPartMap) return cachedPartMap;
  if (existsSync(cachePath)) {
    const buf = readFileSync(cachePath);
    cachedPartMap = decodeAvaPart(buf);
    return cachedPartMap;
  }
  return new Map();
}

export function resolvePartInfo(
  idPart: number,
  catalog?: Map<number, PartEntry>,
): { id: number; name: string; slot: string; iconId: number } {
  // 1. Kiểm tra dynamic parts đã biết
  if (KNOWN_DYNAMIC_PARTS[idPart]) {
    const p = KNOWN_DYNAMIC_PARTS[idPart];
    return {
      id: idPart,
      name: p.name,
      slot: getSlotName(p.zOrder),
      iconId: p.iconId,
    };
  }

  const cat = catalog ?? getPartCatalog();
  const entry = cat.get(idPart);
  if (!entry) {
    return {
      id: idPart,
      name: `Part #${idPart}`,
      slot: 'Chưa rõ',
      iconId: 0,
    };
  }

  // Nếu là PartFollow (follow >= 0), lần ngược về Part cha để lấy tên & zOrder
  let curr: PartEntry | undefined = entry;
  const visited = new Set<number>();
  while (curr && curr.follow >= 0 && !visited.has(curr.id)) {
    visited.add(curr.id);
    curr = cat.get(curr.follow);
  }

  const name = curr?.name || entry.name || `Part #${idPart}`;
  const zOrder = curr?.zOrder || entry.zOrder;
  const iconId = entry.idIcon || curr?.idIcon || 0;

  return {
    id: idPart,
    name,
    slot: getSlotName(zOrder),
    iconId,
  };
}
