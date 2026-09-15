import type { CachedSeed } from './farmProfileRepo.js';
import { DEFAULT_TREE_CATALOG } from '../game/defaultCatalogs.js';

export const DEFAULT_SEED_CATALOG: CachedSeed[] = DEFAULT_TREE_CATALOG.map((t) => ({
  id: t.id,
  name: t.name,
  growMinutes: t.growMinutes,
  value: t.value,
}));

export const XU_SEED_IDS: ReadonlySet<number> = new Set(DEFAULT_SEED_CATALOG.map((s) => s.id));
