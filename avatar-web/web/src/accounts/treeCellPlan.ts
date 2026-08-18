import type { CachedSeedDto, FarmProfileDto, TreeCellPlanEntry } from '../types.js';

export type TreePaint =
  | { kind: 'default' }
  | { kind: 'skip' }
  | { kind: 'seed'; seedId: number };

export const TREE_CELL_COUNT = 48;
export const DEFAULT_TREE_CELL_SLOTS = Array.from({ length: TREE_CELL_COUNT }, (_, i) => i);

export const DEFAULT_SEED_CATALOG: CachedSeedDto[] = [
  { id: 0, name: 'Cà chua', growMinutes: 4, value: 25 },
  { id: 1, name: 'Cà rốt', growMinutes: 6, value: 36 },
  { id: 2, name: 'Khóm', growMinutes: 10, value: 55 },
  { id: 3, name: 'Dưa Hấu', growMinutes: 8, value: 46 },
  { id: 4, name: 'Nho', growMinutes: 16, value: 80 },
  { id: 5, name: 'Hoa Hồng', growMinutes: 2, value: 15 },
  { id: 6, name: 'Lúa', growMinutes: 48, value: 240 },
  { id: 7, name: 'Xoài', growMinutes: 24, value: 120 },
  { id: 8, name: 'Thanh long', growMinutes: 12, value: 63 },
  { id: 9, name: 'Hoa hướng dương', growMinutes: 12, value: 63 },
  { id: 10, name: 'Hoa tulip', growMinutes: 6, value: 36 },
  { id: 30, name: 'Bắp', growMinutes: 24, value: 1440 },
  { id: 31, name: 'Nha đam', growMinutes: 2, value: 120 },
  { id: 43, name: 'Dưa Leo', growMinutes: 2, value: 120 },
  { id: 32, name: 'Cà tìm', growMinutes: 3, value: 180 },
  { id: 34, name: 'Tỏi', growMinutes: 4, value: 240 },
  { id: 35, name: 'Dâu Tây', growMinutes: 5, value: 300 },
  { id: 36, name: 'Chuối', growMinutes: 8, value: 480 },
  { id: 39, name: 'Cúc Chuồn Chuồn', growMinutes: 2, value: 120 },
  { id: 41, name: 'Bí Ngô', growMinutes: 2, value: 120 },
  { id: 42, name: 'Khoai Tây', growMinutes: 6, value: 360 },
  { id: 44, name: 'Ớt', growMinutes: 1, value: 60 },
  { id: 111, name: 'Ớt hiểm', growMinutes: 1, value: 60 },
  { id: 45, name: 'Cải Thảo', growMinutes: 4, value: 240 },
  { id: 46, name: 'Nhân Sâm', growMinutes: 4, value: 240 },
  { id: 47, name: 'Hoa Tam Giác Mạch', growMinutes: 3, value: 180 },
  { id: 48, name: 'Cây Dừa', growMinutes: 48, value: 2880 },
];

export function applyTreePaint(
  entries: TreeCellPlanEntry[],
  cellIndex: number,
  paint: TreePaint,
): TreeCellPlanEntry[] {
  const byCell = new Map(entries.map((entry) => [entry.cellIndex, entry]));
  if (paint.kind === 'default') {
    byCell.delete(cellIndex);
  } else if (paint.kind === 'skip') {
    byCell.set(cellIndex, { cellIndex, action: 'skip' });
  } else {
    byCell.set(cellIndex, { cellIndex, action: 'seed', seedId: paint.seedId });
  }
  return [...byCell.values()].sort((left, right) => left.cellIndex - right.cellIndex);
}

export function summarizeTreePlan(
  cellIndices: number[] = DEFAULT_TREE_CELL_SLOTS,
  entries: TreeCellPlanEntry[] = [],
): { defaults: number; skipped: number; seeds: Map<number, number> } {
  const byCell = new Map(entries.map((entry) => [entry.cellIndex, entry]));
  const seeds = new Map<number, number>();
  let defaults = 0;
  let skipped = 0;

  for (const cellIndex of cellIndices) {
    const entry = byCell.get(cellIndex);
    if (entry === undefined) {
      defaults += 1;
    } else if (entry.action === 'skip') {
      skipped += 1;
    } else {
      seeds.set(entry.seedId, (seeds.get(entry.seedId) ?? 0) + 1);
    }
  }

  return { defaults, skipped, seeds };
}

export function invalidTreePlanEntries(
  profile: FarmProfileDto,
  entries: TreeCellPlanEntry[],
  slotIndices: number[] = DEFAULT_TREE_CELL_SLOTS,
): TreeCellPlanEntry[] {
  const knownCells = new Set(slotIndices);
  const catalog = profile.seedCatalog.length > 0 ? profile.seedCatalog : DEFAULT_SEED_CATALOG;
  const knownSeeds = new Set(catalog.map((seed) => seed.id));
  return entries.filter((entry) => (
    !knownCells.has(entry.cellIndex)
    || (entry.action === 'seed' && !knownSeeds.has(entry.seedId))
  ));
}
