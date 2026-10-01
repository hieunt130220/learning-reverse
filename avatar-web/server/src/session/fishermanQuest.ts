/**
 * Logic thuần resolve nhiệm vụ Thợ Câu → mục tiêu câu cá.
 * Module thuần (chỉ import type) — không import runtime để tránh chu kỳ phụ thuộc.
 */
import type { FishermanQuestFishMapping } from './automationTypes.js';
import type { ProgressQuestCondition } from '../game/progressQuests.js';

/**
 * Bảng ánh xạ tên cá (key đã chuẩn hóa: lowercase + bỏ dấu + trim)
 * → map hồ câu + vé tương ứng. Cá chim (454) thuộc Map 16.
 */
export const FISHERMAN_QUEST_FISH_MAP: Readonly<Record<string, FishermanQuestFishMapping>> =
  Object.freeze({
    'ca ro': { fishId: 444, map: 14, ticketId: 458 },
    'ca long tong': { fishId: 449, map: 14, ticketId: 458 },
    'long tong': { fishId: 449, map: 14, ticketId: 458 },
    'ca chep vang': { fishId: 450, map: 14, ticketId: 458 },
    'chep vang': { fishId: 450, map: 14, ticketId: 458 },
    'ca loc': { fishId: 451, map: 15, ticketId: 459 },
    'ca noc': { fishId: 452, map: 15, ticketId: 459 },
    noc: { fishId: 452, map: 15, ticketId: 459 },
    'con cua': { fishId: 453, map: 15, ticketId: 459 },
    cua: { fishId: 453, map: 15, ticketId: 459 },
    'ca duoi': { fishId: 455, map: 16, ticketId: 460 },
    duoi: { fishId: 455, map: 16, ticketId: 460 },
    'ca ngua': { fishId: 456, map: 16, ticketId: 460 },
    ngua: { fishId: 456, map: 16, ticketId: 460 },
    'ca chim': { fishId: 454, map: 16, ticketId: 460 },
    chim: { fishId: 454, map: 16, ticketId: 460 },
    'ca map': { fishId: 457, map: 16, ticketId: 460 },
    // Map 27: Bến tàu / Biển Hawai (Vé câu bến tàu 4876)
    'ca lia thia': { fishId: 4504, map: 27, ticketId: 4876 },
    'lia thia': { fishId: 4504, map: 27, ticketId: 4876 },
    'ca chep': { fishId: 4505, map: 27, ticketId: 4876 },
    'ca he': { fishId: 4506, map: 27, ticketId: 4876 },
    he: { fishId: 4506, map: 27, ticketId: 4876 },
    'ca vang': { fishId: 4507, map: 27, ticketId: 4876 },
    nhai: { fishId: 4508, map: 27, ticketId: 4876 },
    'chang hiu': { fishId: 4509, map: 27, ticketId: 4876 },
    ech: { fishId: 4510, map: 27, ticketId: 4876 },
    sua: { fishId: 4511, map: 27, ticketId: 4876 },
    'ca heo': { fishId: 4515, map: 27, ticketId: 4876 },
    muc: { fishId: 4516, map: 27, ticketId: 4876 },
  });

/** Lowercase + bỏ dấu tiếng Việt + trim + gộp khoảng trắng. */
export function normalizeFishName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Resolve tên condition quest (vd "Thu hoạch 5 con cá rô - 0/5" hoặc "Cá rô")
 * thành mục tiêu câu. Match substring theo key dài trước để tên đầy đủ
 * thắng tên rút gọn. Không match → ok:false, caller dừng an toàn.
 */
export function resolveFishQuestTarget(
  condName: string,
): { ok: true; fishId: number; map: number; ticketId: number } | { ok: false; unknownName: string } {
  const norm = normalizeFishName(condName);
  const keys = Object.keys(FISHERMAN_QUEST_FISH_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (norm.includes(key)) {
      const m = FISHERMAN_QUEST_FISH_MAP[key];
      return { ok: true, fishId: m.fishId, map: m.map, ticketId: m.ticketId };
    }
  }
  return { ok: false, unknownName: condName.trim() };
}

/** Condition `!isDone` đầu tiên (làm tuần tự); `null` = xong hết. */
export function pickNextFishTarget(
  conditions: readonly ProgressQuestCondition[],
): ProgressQuestCondition | null {
  return conditions.find((c) => !c.isDone) ?? null;
}
