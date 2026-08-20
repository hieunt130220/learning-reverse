import { MyReader } from '../proto/reader.js';
import type { FarmState, InventoryItem } from './farmData.js';

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
  source: 'game-dialog' | 'game-packet' | 'default';
  updatedAt: number;
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
): ProgressQuestDecodeResult {
  try {
    const r = new MyReader(data);
    if (r.available() < 1) {
      return { status: 'unsupported', reason: 'payload rỗng', remainingHex: data.toString('hex') };
    }

    const action = r.readByte();

    // action = 1 là màn hình thông tin Nâng Cấp Nông Trại Cấp 2, không phải nhiệm vụ
    if (action === 1) {
      return { status: 'ignored', action: 1 };
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
