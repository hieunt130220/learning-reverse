import type { KitchenPlanEntry } from '../types.js';

export type KitchenPaint =
  | { kind: 'default' }
  | { kind: 'skip' }
  | { kind: 'cook'; recipeId: number };

export interface KitchenFoodInfo {
  id: number;
  name: string;
  iconId?: number;
}

/**
 * 35 món thật trong bếp Avatar, đối chiếu với bảng 3x.4utovip.com và gói 76.
 * `id` là recipe id dùng khi gửi lệnh nấu; `iconId` là id ảnh `kitchen/N.png`.
 */
export const KITCHEN_FOOD_CATALOG: KitchenFoodInfo[] = [
  { id: 1, name: 'Bánh Trứng', iconId: 205 },
  { id: 2, name: 'Bánh sữa', iconId: 206 },
  { id: 3, name: 'Cơm', iconId: 207 },
  { id: 4, name: 'Cơm Trứng', iconId: 208 },
  { id: 5, name: 'Cơm Cà rốt', iconId: 209 },
  { id: 6, name: 'Nước ép trái cây', iconId: 210 },
  { id: 7, name: 'Gỏi Xoài', iconId: 211 },
  { id: 8, name: 'Sữa Chua', iconId: 212 },
  { id: 9, name: 'Trái cây dầm', iconId: 213 },
  { id: 10, name: 'Tinh dầu hướng dương', iconId: 214 },
  { id: 11, name: 'Nước Hoa', iconId: 216 },
  { id: 12, name: 'Sữa Chua Trái Cây', iconId: 217 },
  { id: 13, name: 'Trái cây dĩa', iconId: 218 },
  { id: 14, name: 'Kem Tươi', iconId: 262 },
  { id: 15, name: 'Trái Cây Ly', iconId: 219 },
  { id: 16, name: 'Nước ép dưa hấu', iconId: 272 },
  { id: 17, name: 'Phô Mai', iconId: 273 },
  { id: 18, name: 'Khoai Tây Chiên', iconId: 274 },
  { id: 19, name: 'Bắp Chiên Bơ', iconId: 275 },
  { id: 20, name: 'Tương Cà Chua', iconId: 281 },
  { id: 21, name: 'Tương ớt', iconId: 287 },
  { id: 22, name: 'Heo quay ngũ vị', iconId: 284 },
  { id: 23, name: 'Cá chép om dưa', iconId: 285 },
  { id: 24, name: 'Gà Luộc', iconId: 277 },
  { id: 25, name: 'Gà bó xôi', iconId: 278 },
  { id: 26, name: 'Baba om chuối', iconId: 280 },
  { id: 27, name: 'Tinh Thể Dưa Hấu', iconId: 290 },
  { id: 28, name: 'Gà Đóng Hộp', iconId: 291 },
  { id: 29, name: 'Bánh Xèo', iconId: 256 },
  { id: 30, name: 'Trà Hoa Cúc', iconId: 292 },
  { id: 31, name: 'Thịt Trâu Gác Bếp', iconId: 296 },
  { id: 32, name: 'Vịt Quay Lá Mắc Mật', iconId: 298 },
  { id: 33, name: 'Mì Ramen Thượng Hạng', iconId: 299 },
  { id: 34, name: 'Khoai tây đóng hộp', iconId: 300 },
  { id: 35, name: 'Thịt Kho Trứng', iconId: 302 },
];

/** Số ô bếp mặc định hiển thị khi chưa có dữ liệu slot thật. */
export const KITCHEN_SLOT_COUNT = 10;

export const DEFAULT_KITCHEN_SLOTS = Array.from({ length: KITCHEN_SLOT_COUNT }, (_, i) => i);

export function applyKitchenPaint(
  entries: KitchenPlanEntry[],
  slotIndex: number,
  paint: KitchenPaint,
): KitchenPlanEntry[] {
  const bySlot = new Map(entries.map((entry) => [entry.slotIndex, entry]));
  if (paint.kind === 'default') {
    bySlot.delete(slotIndex);
  } else if (paint.kind === 'skip') {
    bySlot.set(slotIndex, { slotIndex, action: 'skip' });
  } else {
    bySlot.set(slotIndex, { slotIndex, action: 'cook', recipeId: paint.recipeId });
  }
  return [...bySlot.values()].sort((left, right) => left.slotIndex - right.slotIndex);
}

export function summarizeKitchenPlan(
  slotIndices: number[],
  entries: KitchenPlanEntry[],
): { defaults: number; skipped: number; recipes: Map<number, number> } {
  const bySlot = new Map(entries.map((entry) => [entry.slotIndex, entry]));
  const recipes = new Map<number, number>();
  let defaults = 0;
  let skipped = 0;

  for (const slotIndex of slotIndices) {
    const entry = bySlot.get(slotIndex);
    if (entry === undefined) {
      defaults += 1;
    } else if (entry.action === 'skip') {
      skipped += 1;
    } else {
      recipes.set(entry.recipeId, (recipes.get(entry.recipeId) ?? 0) + 1);
    }
  }

  return { defaults, skipped, recipes };
}
