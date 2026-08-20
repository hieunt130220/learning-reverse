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
  source: 'game-packet';
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
    source: 'game-packet',
    updatedAt: Date.now(),
  };
}

export const DEFAULT_BEGINNER_QUEST_STATE: ProgressQuestChain = {
  kind: 'beginner',
  screenType: 1,
  title: 'Nhiệm Vụ Tân Thủ 2',
  step: 2,
  conditions: [
    {
      name: 'Mua 5 con gà',
      current: 0,
      total: 5,
      isDone: false,
    },
    {
      name: 'Mua 2 con cá chép',
      current: 0,
      total: 2,
      isDone: false,
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
      type: 7,
      amount: 1,
      value: 1,
      displayName: '1 Tiến Sĩ vĩnh viễn',
    },
    {
      type: 7,
      amount: 1,
      value: 1,
      displayName: '1 Tiến Sĩ vĩnh viễn',
    },
  ],
  source: 'game-packet',
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

    // FORMAT 1: action = 1 (Nhiệm Vụ Tân Thủ / Nhà Nông)
    if (action === 1) {
      if (r.available() < 16) {
        return {
          status: 'unsupported',
          reason: 'payload action=1 quá ngắn cho header',
          remainingHex: data.toString('hex'),
        };
      }
      const screenType = r.readByte();
      const _idMap = r.readShort();
      const _idTitle = r.readShort();
      const _idStorage = r.readShort();
      const _idBarnChicken = r.readShort();
      const _idBarnCow = r.readShort();
      const _idCooking = r.readShort();
      const _idBarnDog = r.readShort();

      const itemCount = r.readByte();
      let tomatoCur = 0;
      let carrotCur = 0;
      let chickenCur = 0;
      let fishCur = 0;

      for (let i = 0; i < itemCount; i++) {
        if (r.available() < 9) break;
        const itemType = r.readByte();
        let id = 0;
        let _req = 0;
        let cur = 0;
        if (itemType === 7 || itemType === 9) {
          if (r.available() < 12) break;
          id = r.readInt();
          _req = r.readInt();
          cur = r.readInt();
        } else {
          _req = r.readInt();
          cur = r.readInt();
        }

        if (itemType === 7) {
          if (id === 0 || id === 206) tomatoCur = cur;
          if (id === 1 || id === 205) carrotCur = cur;
        } else if (itemType === 4) {
          // Chuồng gia súc / gà
          chickenCur = cur;
        } else if (itemType === 5) {
          // Ao cá
          fishCur = cur;
        }
      }

      if (screenType === 1) {
        // Nhiệm Vụ Tân Thủ 2
        const conditions: ProgressQuestCondition[] = [
          {
            name: 'Mua 5 con gà',
            current: Math.min(5, chickenCur),
            total: 5,
            isDone: chickenCur >= 5,
          },
          {
            name: 'Mua 2 con cá chép',
            current: Math.min(2, fishCur),
            total: 2,
            isDone: fishCur >= 2,
          },
        ];

        return {
          status: 'ok',
          state: {
            kind: 'beginner',
            screenType: 1,
            title: 'Nhiệm Vụ Tân Thủ 2',
            step: 2,
            conditions,
            rewards: [
              {
                type: 6,
                amount: 5000,
                value: 5000,
                displayName: '5.000 Xu',
              },
              {
                type: 7,
                amount: 1,
                value: 1,
                displayName: '1 Tiến Sĩ vĩnh viễn',
              },
              {
                type: 7,
                amount: 1,
                value: 1,
                displayName: '1 Tiến Sĩ vĩnh viễn',
              },
            ],
            source: 'game-packet',
            updatedAt: Date.now(),
          },
        };
      }

      // Chuẩn hoá theo đúng giao diện Nhiệm Vụ Nhà Nông - 1 trong game (screenType === 0)
      const conditions: ProgressQuestCondition[] = [
        {
          name: 'Thu hoạch 200 cà chua',
          current: tomatoCur,
          total: 200,
          isDone: tomatoCur >= 200,
        },
        {
          name: 'Thu hoạch 200 cà rốt',
          current: carrotCur,
          total: 200,
          isDone: carrotCur >= 200,
        },
        {
          name: 'Mua 2 con gà',
          current: Math.min(2, chickenCur),
          total: 2,
          isDone: chickenCur >= 2,
        },
      ];

      return {
        status: 'ok',
        state: {
          kind: 'farmer',
          screenType: 0,
          title: 'Nhiệm Vụ Nhà Nông - 1',
          step: 1,
          conditions,
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
        },
      };
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
 * Đồng bộ tiến trình nhiệm vụ (Tân Thủ, Nhà Nông) với dữ liệu thực tế của nông trại:
 * - Đếm số lượng vật nuôi hiện có (Cá chép 54, Rùa 59, Gà 50, Vịt 55, Bò 51, Heo 52, Cừu 56, Trâu 58, Thỏ 61...).
 * - Đếm số lượng ô đất (`cells.length`).
 * - Đếm số lượng nông sản hiện có trong kho (`produce`, `inventory`).
 *
 * Cập nhật an toàn không làm giảm tiến độ: `current = Math.min(total, Math.max(cond.current, derivedCount))`.
 */
export function syncQuestStateWithFarm(
  quest: ProgressQuestChain | null | undefined,
  farmState: FarmState | null | undefined,
  inventory?: readonly InventoryItem[] | null,
  produce?: readonly InventoryItem[] | null,
): ProgressQuestChain | null {
  if (!quest || !quest.conditions || quest.conditions.length === 0) return quest ?? null;

  let hasChanged = false;
  const newConditions = quest.conditions.map((cond) => {
    const nameLower = cond.name.toLowerCase();
    let derivedCount: number | null = null;

    // 1. Kiểm tra vật nuôi trong FarmState
    if (farmState?.animals) {
      if (nameLower.includes('cá chép') || nameLower.includes('ca chep')) {
        derivedCount = farmState.animals.filter((a) => a.species === 54).length;
      } else if (nameLower.includes('rùa') || nameLower.includes('rua') || nameLower.includes('ba ba')) {
        derivedCount = farmState.animals.filter((a) => a.species === 59).length;
      } else if ((nameLower.includes('gà') || nameLower.includes('ga')) && !nameLower.includes('trứng') && !nameLower.includes('trung')) {
        derivedCount = farmState.animals.filter((a) => a.species === 50).length;
      } else if ((nameLower.includes('vịt') || nameLower.includes('vit')) && !nameLower.includes('trứng') && !nameLower.includes('trung')) {
        derivedCount = farmState.animals.filter((a) => a.species === 55).length;
      } else if ((nameLower.includes('bò') || nameLower.includes('bo')) && !nameLower.includes('sữa') && !nameLower.includes('sua')) {
        derivedCount = farmState.animals.filter((a) => a.species === 51).length;
      } else if ((nameLower.includes('heo') || nameLower.includes('lợn') || nameLower.includes('lon')) && !nameLower.includes('thịt') && !nameLower.includes('thit')) {
        derivedCount = farmState.animals.filter((a) => a.species === 52).length;
      } else if ((nameLower.includes('cừu') || nameLower.includes('cuu')) && !nameLower.includes('lông') && !nameLower.includes('long')) {
        derivedCount = farmState.animals.filter((a) => a.species === 56).length;
      } else if ((nameLower.includes('trâu') || nameLower.includes('trau')) && !nameLower.includes('thịt') && !nameLower.includes('thit')) {
        derivedCount = farmState.animals.filter((a) => a.species === 58).length;
      } else if (nameLower.includes('thỏ') || nameLower.includes('tho')) {
        derivedCount = farmState.animals.filter((a) => a.species === 61).length;
      } else if ((nameLower.includes('dê') || nameLower.includes('de')) && !nameLower.includes('sữa') && !nameLower.includes('sua')) {
        derivedCount = farmState.animals.filter((a) => a.species === 60).length;
      } else if (nameLower.includes('chó') || nameLower.includes('cho')) {
        derivedCount = farmState.animals.filter((a) => a.species === 53).length;
      } else if (nameLower.includes('mèo') || nameLower.includes('meo')) {
        derivedCount = farmState.animals.filter((a) => a.species === 57).length;
      }
    }

    // 2. Kiểm tra ô đất
    if (farmState?.cells && (nameLower.includes('ô đất') || nameLower.includes('o dat') || nameLower.includes('mở đất') || nameLower.includes('mo dat'))) {
      derivedCount = farmState.cells.length;
    }

    // 3. Kiểm tra nông sản trong kho
    const allStock = [...(produce ?? []), ...(inventory ?? [])];
    if (nameLower.includes('cà chua') || nameLower.includes('ca chua')) {
      const stock = allStock.filter((i) => i.id === 206 || i.id === 0).reduce((sum, i) => sum + i.num, 0);
      if (stock > 0) derivedCount = Math.max(derivedCount ?? 0, stock);
    } else if (nameLower.includes('cà rốt') || nameLower.includes('ca rot')) {
      const stock = allStock.filter((i) => i.id === 205 || i.id === 1).reduce((sum, i) => sum + i.num, 0);
      if (stock > 0) derivedCount = Math.max(derivedCount ?? 0, stock);
    }

    if (derivedCount !== null) {
      const newCurrent = Math.min(cond.total, Math.max(cond.current, derivedCount));
      const newIsDone = newCurrent >= cond.total;
      if (newCurrent !== cond.current || newIsDone !== cond.isDone) {
        hasChanged = true;
        return {
          ...cond,
          current: newCurrent,
          isDone: newIsDone,
        };
      }
    }
    return cond;
  });

  if (!hasChanged) return quest;

  return {
    ...quest,
    conditions: newConditions,
    updatedAt: Date.now(),
  };
}

