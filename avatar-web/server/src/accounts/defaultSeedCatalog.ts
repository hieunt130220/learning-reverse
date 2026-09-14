import type { CachedSeed } from './farmProfileRepo.js';
import { DEFAULT_TREE_CATALOG } from '../game/defaultCatalogs.js';

export const DEFAULT_SEED_CATALOG: CachedSeed[] = DEFAULT_TREE_CATALOG.map((t) => ({
  id: t.id,
  name: t.name,
  growMinutes: t.growMinutes,
  value: t.value,
}));

export const XU_SEED_IDS: ReadonlySet<number> = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
