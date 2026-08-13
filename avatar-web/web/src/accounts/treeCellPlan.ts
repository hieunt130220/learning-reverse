import type { FarmProfileDto, TreeCellPlanEntry } from '../types.js';

export type TreePaint =
  | { kind: 'default' }
  | { kind: 'skip' }
  | { kind: 'seed'; seedId: number };

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
  cellIndices: number[],
  entries: TreeCellPlanEntry[],
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
): TreeCellPlanEntry[] {
  const knownCells = new Set(profile.cellIndices);
  const knownSeeds = new Set(profile.seedCatalog.map((seed) => seed.id));
  return entries.filter((entry) => (
    !knownCells.has(entry.cellIndex)
    || (entry.action === 'seed' && !knownSeeds.has(entry.seedId))
  ));
}
