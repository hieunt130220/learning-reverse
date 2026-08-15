import type { AnimalPlanEntry } from '../types.js';

export type AnimalPaint =
  | { kind: 'default' }
  | { kind: 'skip' }
  | { kind: 'breed'; speciesId: number };

export interface AnimalSpeciesInfo {
  id: number;
  name: string;
  icon?: string;
}

export const BARN_ANIMAL_CATALOG: AnimalSpeciesInfo[] = [
  { id: 50, name: 'Gà', icon: '🐔' },
  { id: 51, name: 'Bò', icon: '🐮' },
  { id: 52, name: 'Heo', icon: '🐷' },
  { id: 53, name: 'Chó', icon: '🐶' },
  { id: 55, name: 'Vịt', icon: '🦆' },
  { id: 56, name: 'Cừu', icon: '🐑' },
  { id: 57, name: 'Mèo', icon: '🐱' },
  { id: 58, name: 'Trâu', icon: '🐃' },
  { id: 60, name: 'Dê', icon: '🐐' },
  { id: 61, name: 'Thỏ', icon: '🐰' },
];

export const POND_ANIMAL_CATALOG: AnimalSpeciesInfo[] = [
  { id: 54, name: 'Cá chép', icon: '🐟' },
  { id: 59, name: 'Rùa', icon: '🐢' },
];

// So slot luon co dinh, khong lay tu server va khong can cache.
export const BARN_SLOT_COUNT = 20;
export const POND_SLOT_COUNT = 10;

export const DEFAULT_BARN_ANIMAL_SLOTS = Array.from({ length: BARN_SLOT_COUNT }, (_, i) => i);
export const DEFAULT_POND_ANIMAL_SLOTS = Array.from({ length: POND_SLOT_COUNT }, (_, i) => i);

export const DEFAULT_ANIMAL_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7];

export function applyAnimalPaint(
  entries: AnimalPlanEntry[],
  slotIndex: number,
  paint: AnimalPaint,
): AnimalPlanEntry[] {
  const bySlot = new Map(entries.map((entry) => [entry.slotIndex, entry]));
  if (paint.kind === 'default') {
    bySlot.delete(slotIndex);
  } else if (paint.kind === 'skip') {
    bySlot.set(slotIndex, { slotIndex, action: 'skip' });
  } else {
    bySlot.set(slotIndex, { slotIndex, action: 'breed', speciesId: paint.speciesId });
  }
  return [...bySlot.values()].sort((left, right) => left.slotIndex - right.slotIndex);
}

export function summarizeAnimalPlan(
  slotIndices: number[],
  entries: AnimalPlanEntry[],
): { defaults: number; skipped: number; species: Map<number, number> } {
  const bySlot = new Map(entries.map((entry) => [entry.slotIndex, entry]));
  const species = new Map<number, number>();
  let defaults = 0;
  let skipped = 0;

  for (const slotIndex of slotIndices) {
    const entry = bySlot.get(slotIndex);
    if (entry === undefined) {
      defaults += 1;
    } else if (entry.action === 'skip') {
      skipped += 1;
    } else {
      species.set(entry.speciesId, (species.get(entry.speciesId) ?? 0) + 1);
    }
  }

  return { defaults, skipped, species };
}
