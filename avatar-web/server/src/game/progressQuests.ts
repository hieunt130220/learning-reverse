import { MyReader } from '../proto/reader.js';
import type {
  FarmState,
  InventoryItem,
  ItemInfo,
  TreeInfo,
} from './farmData.js';

export type ProgressQuestKind = 'beginner' | 'farmer';

export interface ProgressQuestCondition {
  name: string;
  current: number;
  total: number;
  isDone: boolean;
}

export interface ProgressQuestReward {
  type: number;
  amount: number;
  value: number;
  extra?: number;
  displayName?: string;
}

export interface ProgressQuestChain {
  kind: ProgressQuestKind;
  screenType: number;
  title: string;
  step: number | null;
  conditions: ProgressQuestCondition[];
  rewards: ProgressQuestReward[];
  source: 'game-dialog' | 'game-packet' | 'default' | 'completed';
  updatedAt: number;
}

export interface FarmUpgradeRequirement {
  type: number;         // 1=FARM,2=SLOT_LAND,3=COOKING,4=BARN,5=POND,6=XU,7=PRODUCT,8=LUONG,9=POTION
  idFarm?: number;      // chỉ type 7/9
  request: number;      // yêu cầu
  inStorage: number;    // đang có
  displayName: string;
}

export interface FarmUpgradeRequirements {
  imageId: number;
  requirements: FarmUpgradeRequirement[];
}

export interface ProgressQuestMapping {
  requestType: number;
  idType?: number;
  screenType: number;
  kind: ProgressQuestKind;
}

export const DEFAULT_PROGRESS_QUEST_MAPPINGS: readonly ProgressQuestMapping[] = [
  { requestType: 5, screenType: 1, kind: 'beginner' },
  { requestType: 0, screenType: 0, kind: 'farmer' },
  { requestType: 1, screenType: 0, kind: 'farmer' },
  { requestType: 3, screenType: 1, kind: 'beginner' },
];

export type ProgressQuestDecodeResult =
  | { status: 'ok'; state: ProgressQuestChain }
  | { status: 'ok-upgrade'; requirements: FarmUpgradeRequirements }
  | { status: 'ignored'; action: number }
  | { status: 'unknown-screen'; action: number; screenType: number }
  | { status: 'unsupported'; reason: string; remainingHex: string };

const MAX_REWARDS = 32;
const MAX_CONDITIONS = 64;

function parseStepFromTitle(title: string): number | null {
  const match = /(?:tân thủ|nhà nông|bước|cấp)\s*[-:]?\s*(\d+)/i.exec(title);
  if (match) {
    const num = parseInt(match[1], 10);
    return isNaN(num) ? null : num;
  }
  return null;
}

export function getRewardDisplayName(type: number, value: number, extra?: number): string {
  switch (type) {
    case 1: // FARM
      return `Nâng cấp Nông Trại`;
    case 2: // SLOT_LAND
      return `Mở ${value} ô đất`;
    case 3: // COOKING
      return `Mở ô bếp nấu ăn`;
    case 4: // BARN
      return `Nâng cấp chuồng trại`;
    case 5: // POND
      return `Nâng cấp ao cá`;
    case 6: // XU
      return `${value.toLocaleString('vi-VN')} Xu`;
    case 7: // PRODUCT
      return extra !== undefined && extra > 0
        ? `Nông sản #${extra} (x${value})`
        : `Nông sản (x${value})`;
    case 8: // LUONG_NEW
      return `${value.toLocaleString('vi-VN')} Lượng`;
    case 9: // POTION
      return extra !== undefined && extra > 0
        ? `Thuốc #${extra} (x${value})`
        : `Thuốc tăng trưởng (x${value})`;
    case 0:
    case 10:
      return `${value.toLocaleString('vi-VN')} điểm kinh nghiệm`;
    default:
      return value > 0 ? `Phần thưởng #${type} (x${value})` : `Phần thưởng #${type}`;
  }
}

export function getRequirementDisplayName(
  type: number,
  idFarm?: number,
  catalog?: { trees?: TreeInfo[]; items?: ItemInfo[] },
): string {
  switch (type) {
    case 1: return 'Nâng cấp Nông Trại';
    case 2: return 'Ô đất';
    case 3: return 'Ô bếp nấu ăn';
    case 4: return 'Chuồng trại';
    case 5: return 'Ao cá';
    case 6: return 'Xu';
    case 7: {
      if (idFarm === undefined || idFarm <= 0) return 'Nông sản';
      const name = catalog?.trees?.find((tree) => tree.id === idFarm)?.name
        ?? catalog?.items?.find((item) => item.id === idFarm)?.name;
      return name ?? `Nông sản #${idFarm}`;
    }
    case 8: return 'Lượng';
    case 9: {
      if (idFarm === undefined || idFarm <= 0) return 'Thuốc tăng trưởng';
      const name = catalog?.items?.find((item) => item.id === idFarm)?.name;
      return name ?? `Thuốc #${idFarm}`;
    }
    default: return `Yêu cầu #${type}`;
  }
}

/**
 * Phân giải văn bản hộp thoại nhiệm vụ trả về từ NPC / server (Cmd -40 / -88 / -25).
 * Định dạng:
 * "Nhiệm vụ hiện tại của bạn là nhiệm vụ:Nhiệm Vụ Nhà Nông - 1:\n- Thu hoạch 200 cà chua  - 0/200\n- Thu hoạch 200 cà rốt  - 0/200\n- Mua 2 con gà  - 0/2\n\nPhần Thưởng:\n- 5000 xu\n- 100 điểm kinh nghiệm"
 */
export function parseQuestDialogText(text: string): ProgressQuestChain | null {
  if (!text || (!text.toLowerCase().includes('nhiệm vụ') && !text.toLowerCase().includes('nhiem vu'))) {
    return null;
  }

  const titleMatch = /(?:nhiệm vụ hiện tại của bạn là nhiệm vụ:)?\s*([^\n:]+):/i.exec(text);
  const title = titleMatch ? titleMatch[1].trim() : 'Nhiệm Vụ Nhà Nông - 1';
  const isBeginner = /tân thủ/i.test(title);
  const kind: ProgressQuestKind = isBeginner ? 'beginner' : 'farmer';
  const step = parseStepFromTitle(title) ?? (kind === 'farmer' ? 1 : 2);

  const parts = text.split(/Phần Thưởng:/i);
  const condPart = parts[0] || '';
  const rewardPart = parts[1] || '';

  const conditions: ProgressQuestCondition[] = [];
  for (const line of condPart.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('-')) continue;
    const clean = trimmed.replace(/^-\s*/, '');

    // 1. Nhận diện điều kiện đã hoàn thành dạng "-Xong", "- Xong", "- Hoàn thành"
    const doneMatch = /^(.*?)\s*-\s*(?:xong|hoàn thành|hoan thanh|done)\s*$/i.exec(clean);
    if (doneMatch) {
      const name = doneMatch[1].trim();
      const numMatch = /\b(\d+)\b/.exec(name);
      const total = numMatch ? parseInt(numMatch[1], 10) : 1;
      conditions.push({
        name,
        current: total,
        total,
        isDone: true,
      });
      continue;
    }

    // 2. Nhận diện điều kiện dạng phân số: "Mua 5 con gà  - 0/5"
    const m = /^(.*?)\s*-\s*(\d+)\s*\/\s*(\d+)$/.exec(clean);
    if (m) {
      const name = m[1].trim();
      const current = parseInt(m[2], 10);
      const total = parseInt(m[3], 10);
      conditions.push({
        name,
        current,
        total,
        isDone: current >= total,
      });
      continue;
    }

    if (clean) {
      conditions.push({
        name: clean,
        current: 0,
        total: 1,
        isDone: false,
      });
    }
  }

  const rewards: ProgressQuestReward[] = [];
  if (rewardPart) {
    for (const line of rewardPart.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Tách theo dấu '-' ở đầu dòng và các dấu ' - ' phân cách giữa các phần thưởng trên cùng một dòng
      const rawItems = trimmed.startsWith('-')
        ? trimmed.replace(/^-\s*/, '').split(/\s+-\s+/)
        : trimmed.split(/\s+-\s+/);

      for (const item of rawItems) {
        const clean = item.trim();
        if (!clean) continue;
        const numMatch = /(\d+[\d.,]*)\s*(.*)/.exec(clean);
        if (numMatch) {
          const val = parseInt(numMatch[1].replace(/[.,]/g, ''), 10);
          const rest = numMatch[2].trim();
          const isXu = /xu/i.test(rest);
          const isExp = /kinh nghiệm|exp/i.test(rest);
          const isLuong = /lượng/i.test(rest);
          const type = isXu ? 6 : isLuong ? 8 : isExp ? 10 : 7;
          let displayName = clean;
          if (isXu) displayName = `${val.toLocaleString('vi-VN')} Xu`;
          else if (isLuong) displayName = `${val.toLocaleString('vi-VN')} Lượng`;
          else if (isExp) displayName = `${val.toLocaleString('vi-VN')} điểm kinh nghiệm`;

          rewards.push({
            type,
            amount: val,
            value: val,
            displayName,
          });
        } else {
          rewards.push({
            type: 7,
            amount: 1,
            value: 1,
            displayName: clean,
          });
        }
      }
    }
  }

  if (conditions.length === 0 && rewards.length === 0) return null;

  return {
    kind,
    screenType: isBeginner ? 1 : 0,
    title,
    step,
    conditions,
    rewards,
    source: 'game-dialog',
    updatedAt: Date.now(),
  };
}

export const DEFAULT_BEGINNER_QUEST_STATE: ProgressQuestChain = {
  kind: 'beginner',
  screenType: 1,
  title: 'Nhiệm Vụ Tân Thủ 1',
  step: 1,
  conditions: [
    {
      name: 'Trồng 6 cây hoa hồng',
      current: 0,
      total: 6,
      isDone: false,
    },
  ],
  rewards: [],
  source: 'default',
  updatedAt: Date.now(),
};

export const DEFAULT_FARMER_QUEST_STATE: ProgressQuestChain = {
  kind: 'farmer',
  screenType: 0,
  title: 'Nhiệm Vụ Nhà Nông - 1',
  step: 1,
  conditions: [
    {
      name: 'Thu hoạch 200 cà chua',
      current: 0,
      total: 200,
      isDone: false,
    },
    {
      name: 'Thu hoạch 200 cà rốt',
      current: 0,
      total: 200,
      isDone: false,
    },
    {
      name: 'Mua 2 con gà',
      current: 2,
      total: 2,
      isDone: true,
    },
  ],
  rewards: [
    {
      type: 6,
      amount: 5000,
      value: 5000,
      displayName: '5.000 Xu',
    },
    {
      type: 10,
      amount: 100,
      value: 100,
      displayName: '100 điểm kinh nghiệm',
    },
  ],
  source: 'game-packet',
  updatedAt: Date.now(),
};

/**
 * Giải mã payload phản hồi Cmd 104 (OPEN_INFO_FARM) từ game client / server.
 * Bóc tách đúng Nhiệm Vụ Tân Thủ 2 (screenType=1) và Nhiệm Vụ Nhà Nông - 1 (screenType=0).
 */
export function decodeProgressQuestPacket(
  data: Buffer,
  mappings: readonly ProgressQuestMapping[] = DEFAULT_PROGRESS_QUEST_MAPPINGS,
  catalog?: { trees?: TreeInfo[]; items?: ItemInfo[] },
): ProgressQuestDecodeResult {
  try {
    const r = new MyReader(data);
    if (r.available() < 1) {
      return { status: 'unsupported', reason: 'payload rỗng', remainingHex: data.toString('hex') };
    }

    const action = r.readByte();

    // action = 1: InfoFarmScr — yêu cầu nâng cấp nông trại.
    // Format đã xác minh từ sample hex 249 byte:
    //   bool(1) + 7 short(14) + count(1) + count×[type(1), (idFarm(4) nếu 7/9), request(4), inStorage(4)]
    if (action === 1) {
      if (r.available() < 1) {
        return { status: 'unsupported', reason: 'payload action=1 thiếu byte bool', remainingHex: data.toString('hex') };
      }
      r.readBoolean(); // có danh sách hay không (sample = true)
      if (r.available() < 14) {
        return { status: 'unsupported', reason: 'payload action=1 thiếu 7 short header', remainingHex: data.toString('hex') };
      }
      const imageId = r.readShort();
      for (let i = 0; i < 6; i++) r.readShort(); // 6 short còn lại (chưa dùng)
      if (r.available() < 1) {
        return { status: 'unsupported', reason: 'payload action=1 thiếu byte count', remainingHex: data.toString('hex') };
      }
      const reqCount = r.readUnsignedByte();
      if (reqCount < 0 || reqCount > MAX_REWARDS) {
        return { status: 'unsupported', reason: `reqCount action=1 không hợp lệ: ${reqCount}`, remainingHex: data.toString('hex') };
      }
      const requirements: FarmUpgradeRequirement[] = [];
      for (let i = 0; i < reqCount; i++) {
        if (r.available() < 1) {
          return { status: 'unsupported', reason: `thiếu byte type yêu cầu thứ ${i}`, remainingHex: data.toString('hex') };
        }
        const type = r.readByte();
        let idFarm: number | undefined;
        if (type === 7 || type === 9) {
          if (r.available() < 12) {
            return { status: 'unsupported', reason: `thiếu byte idFarm/request/inStorage yêu cầu thứ ${i}`, remainingHex: data.toString('hex') };
          }
          idFarm = r.readInt();
        } else {
          if (r.available() < 8) {
            return { status: 'unsupported', reason: `thiếu byte request/inStorage yêu cầu thứ ${i}`, remainingHex: data.toString('hex') };
          }
        }
        const request = r.readInt();
        const inStorage = r.readInt();
        requirements.push({
          type,
          idFarm,
          request,
          inStorage,
          displayName: getRequirementDisplayName(type, idFarm, catalog),
        });
      }
      return { status: 'ok-upgrade', requirements: { imageId, requirements } };
    }

    // FORMAT 2: action = 2 hoặc 3 (UpgradeFarmLvl2Scr — MissionInfo và UpgradeInfo)
    if (action === 2 || action === 3) {
      if (r.available() < 5) {
        return {
          status: 'unsupported',
          reason: `payload action=${action} quá ngắn cho header`,
          remainingHex: data.toString('hex'),
        };
      }

      const screenType = r.readByte();
      const _currentImageId = r.readShort();
      const _nextImageId = r.readShort();

      // Reward count (UpgradeInfo list)
      if (r.available() < 2) {
        return {
          status: 'unsupported',
          reason: 'thiếu byte reward count',
          remainingHex: data.toString('hex'),
        };
      }
      const rewardCount = r.readShort();
      if (rewardCount < 0 || rewardCount > MAX_REWARDS) {
        return {
          status: 'unsupported',
          reason: `rewardCount không hợp lệ: ${rewardCount}`,
          remainingHex: data.toString('hex'),
        };
      }

      const rewards: ProgressQuestReward[] = [];
      for (let i = 0; i < rewardCount; i++) {
        if (r.available() < 1) {
          return {
            status: 'unsupported',
            reason: `thiếu byte reward thứ ${i}`,
            remainingHex: data.toString('hex'),
          };
        }
        const type = r.readByte();
        let idFarm = 0;
        if (type === 7 || type === 9) {
          if (r.available() < 12) {
            return {
              status: 'unsupported',
              reason: `thiếu byte idFarm/request/inStorage reward thứ ${i}`,
              remainingHex: data.toString('hex'),
            };
          }
          idFarm = r.readInt();
        } else {
          if (r.available() < 8) {
            return {
              status: 'unsupported',
              reason: `thiếu byte request/inStorage reward thứ ${i}`,
              remainingHex: data.toString('hex'),
            };
          }
        }
        const request = r.readInt();
        const _inStorage = r.readInt();

        rewards.push({
          type,
          amount: request,
          value: request,
          extra: idFarm,
          displayName: getRewardDisplayName(type, request, idFarm),
        });
      }

      // Mission count
      if (r.available() < 2) {
        return {
          status: 'unsupported',
          reason: 'thiếu byte mission count',
          remainingHex: data.toString('hex'),
        };
      }
      const missionCount = r.readShort();
      if (missionCount < 0 || missionCount > MAX_CONDITIONS) {
        return {
          status: 'unsupported',
          reason: `missionCount không hợp lệ: ${missionCount}`,
          remainingHex: data.toString('hex'),
        };
      }

      const conditions: ProgressQuestCondition[] = [];
      for (let i = 0; i < missionCount; i++) {
        if (r.available() < 2) {
          return {
            status: 'unsupported',
            reason: `thiếu byte mission thứ ${i}`,
            remainingHex: data.toString('hex'),
          };
        }
        const name = r.readUTF();
        if (r.available() < 8) {
          return {
            status: 'unsupported',
            reason: `thiếu byte current/total mission thứ ${i}`,
            remainingHex: data.toString('hex'),
          };
        }
        const current = r.readInt();
        const total = r.readInt();

        conditions.push({
          name,
          current,
          total,
          isDone: current >= total,
        });
      }

      // screenType = 0 là Nhà Nông, screenType = 1 là Tân Thủ
      const matched = mappings.find((m) => m.screenType === screenType);
      let kind: ProgressQuestKind = matched?.kind ?? (screenType === 1 ? 'beginner' : 'farmer');

      let title = kind === 'beginner' ? 'Nhiệm Vụ Tân Thủ' : 'Nhiệm Vụ Nhà Nông';
      let step = parseStepFromTitle(title);

      return {
        status: 'ok',
        state: {
          kind,
          screenType,
          title,
          step,
          conditions,
          rewards,
          source: 'game-packet',
          updatedAt: Date.now(),
        },
      };
    }

    return { status: 'ignored', action };
  } catch (err) {
    return {
      status: 'unsupported',
      reason: (err as Error).message,
      remainingHex: data.toString('hex'),
    };
  }
}

/**
 * Giải mã chuỗi `[i8 len][utf8]` lặp lại. Dùng cho cmd -62 (nhiệm vụ hiện tại)
 * và cmd -81 (danh sách nhiệm vụ): byte 0 là header 0x00, sau đó lặp các phần tử.
 */
export function decodeLenPrefixedStrings(buf: Buffer, start = 1): string[] {
  const out: string[] = [];
  let o = start;
  while (o < buf.length) {
    const n = buf[o];
    if (o + 1 + n > buf.length) break;
    out.push(buf.toString('utf8', o + 1, o + 1 + n));
    o += 1 + n;
  }
  return out;
}

export interface QuestCatalogEntry {
  title: string;
  reward: string;
}

/**
 * Giải mã danh sách nhiệm vụ (cmd -81). Format đã xác minh trên payload 12082 byte:
 *   [i16:9]"lsnhiemvu" [i16:23]"Danh Sách Nhiệm Vụ" [i32:15] [i32:count] ff ff
 *   rồi lặp count lần: [i16 len]"Nhiệm Vụ Nhà Nông - N" [i16 len]"Phần Thưởng: …" ff ff
 * (KHÁC cmd -62 dùng i8 — không dùng decodeLenPrefixedStrings ở đây.)
 */
export function parseQuestListPacket(buf: Buffer): QuestCatalogEntry[] {
  const out: QuestCatalogEntry[] = [];
  let o = 0;
  const readStr = (): string | null => {
    if (o + 2 > buf.length) return null;
    const n = buf.readUInt16BE(o);
    if (o + 2 + n > buf.length) return null;
    const s = buf.toString('utf8', o + 2, o + 2 + n);
    o += 2 + n;
    return s;
  };
  // Magic + tiêu đề danh sách (bỏ qua nội dung)
  readStr();
  readStr();
  // Header: i32 (hằng số 15) + i32 count + separator ff ff
  if (o + 8 > buf.length) return out;
  const count = buf.readUInt32BE(o + 4);
  o += 8;
  if (o + 1 < buf.length && buf[o] === 0xff && buf[o + 1] === 0xff) o += 2;
  for (let i = 0; i < count && i < 500; i++) {
    const title = readStr();
    if (title === null) break;
    const reward = readStr();
    if (reward === null) break;
    out.push({ title, reward });
    if (o + 1 < buf.length && buf[o] === 0xff && buf[o + 1] === 0xff) o += 2;
  }
  return out;
}

/**
 * Đồng bộ tiến trình nhiệm vụ (Tân Thủ, Nhà Nông) với dữ liệu từ server:
 * Dữ liệu tiến trình giải mã từ hộp thoại NPC (`parseQuestDialogText`) và gói tin
 * Cmd 104 (`decodeProgressQuestPacket`) là nguồn chân lý chính xác nhất của server.
 * Hàm này bảo toàn nguyên vẹn tiến trình của server, không tự ý ghi đè tiến trình bằng
 * số lượng vật nuôi có sẵn trong chuồng/ao.
 */
export function syncQuestStateWithFarm(
  quest: ProgressQuestChain | null | undefined,
  _farmState?: FarmState | null | undefined,
  _inventory?: readonly InventoryItem[] | null,
  _produce?: readonly InventoryItem[] | null,
): ProgressQuestChain | null {
  if (!quest || !quest.conditions || quest.conditions.length === 0) return quest ?? null;
  return quest;
}
