import { DEFAULT_SEED_CATALOG } from './defaultSeedCatalog.js';
import type { AnimalPlanEntry, AutoFarmConfig, AutoSellRule, KitchenPlanEntry, TreeCellPlanEntry } from '../autoFarm.js';

export type { AnimalPlanEntry, AutoSellRule, KitchenPlanEntry, TreeCellPlanEntry } from '../autoFarm.js';

export interface StoredAutoConfigState {
  revision: number;
  config: Partial<AutoFarmConfig>;
}

export interface AutoConfigProfile {
  cellIndices: number[];
  seedIds: number[];
}

type ConfigKey = keyof AutoFarmConfig;
type ConfigParser = (value: unknown, key: string) => AutoFarmConfig[ConfigKey];

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} phải là object`);
  }
  return value as Record<string, unknown>;
}

function finiteNumber(value: unknown, key: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${key} phải là số hữu hạn`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, key: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${key} phải là số nguyên không âm`);
  }
  return value;
}

function speciesList(value: unknown, key: string): number[] {
  if (!Array.isArray(value) || value.some((id) => !Number.isInteger(id))) {
    throw new Error(`${key} phải là mảng số nguyên`);
  }
  return [...value];
}

function treeCellPlan(value: unknown): TreeCellPlanEntry[] {
  if (!Array.isArray(value)) throw new Error('treeCellPlan phải là mảng');

  const entries = value.map((raw) => {
    const entry = record(raw, 'mỗi kế hoạch ô');
    const cellIndex = nonNegativeInteger(entry.cellIndex, 'cellIndex');
    if (entry.action === 'skip') {
      if (Object.keys(entry).some((key) => key !== 'cellIndex' && key !== 'action')) {
        throw new Error(`kế hoạch ô ${cellIndex} không hợp lệ`);
      }
      return { cellIndex, action: 'skip' } as const;
    }
    if (entry.action === 'seed') {
      if (Object.keys(entry).some((key) => key !== 'cellIndex' && key !== 'action' && key !== 'seedId')) {
        throw new Error(`kế hoạch ô ${cellIndex} không hợp lệ`);
      }
      return { cellIndex, action: 'seed', seedId: nonNegativeInteger(entry.seedId, 'seedId') } as const;
    }
    throw new Error(`action của ô ${cellIndex} không hợp lệ`);
  });

  entries.sort((left, right) => left.cellIndex - right.cellIndex);
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index - 1].cellIndex === entries[index].cellIndex) {
      throw new Error(`ô ${entries[index].cellIndex} bị lặp`);
    }
  }
  return entries;
}

function animalPlan(value: unknown): AnimalPlanEntry[] {
  if (!Array.isArray(value)) throw new Error('animalPlan phải là mảng');

  const entries = value.map((raw) => {
    const entry = record(raw, 'mỗi kế hoạch vật nuôi');
    const slotIndex = nonNegativeInteger(entry.slotIndex, 'slotIndex');
    if (entry.action === 'skip') {
      if (Object.keys(entry).some((key) => key !== 'slotIndex' && key !== 'action')) {
        throw new Error(`kế hoạch slot ${slotIndex} không hợp lệ`);
      }
      return { slotIndex, action: 'skip' } as const;
    }
    if (entry.action === 'breed') {
      if (Object.keys(entry).some((key) => key !== 'slotIndex' && key !== 'action' && key !== 'speciesId')) {
        throw new Error(`kế hoạch slot ${slotIndex} không hợp lệ`);
      }
      return { slotIndex, action: 'breed', speciesId: nonNegativeInteger(entry.speciesId, 'speciesId') } as const;
    }
    throw new Error(`action của slot ${slotIndex} không hợp lệ`);
  });

  entries.sort((left, right) => left.slotIndex - right.slotIndex);
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index - 1].slotIndex === entries[index].slotIndex) {
      throw new Error(`slot ${entries[index].slotIndex} bị lặp`);
    }
  }
  return entries;
}

function kitchenPlan(value: unknown): KitchenPlanEntry[] {
  if (!Array.isArray(value)) throw new Error('cookingSlotPlan phải là mảng');

  const entries = value.map((raw) => {
    const entry = record(raw, 'mỗi kế hoạch ô bếp');
    const slotIndex = nonNegativeInteger(entry.slotIndex, 'slotIndex');
    if (entry.action === 'skip') {
      if (Object.keys(entry).some((key) => key !== 'slotIndex' && key !== 'action')) {
        throw new Error(`kế hoạch ô bếp ${slotIndex} không hợp lệ`);
      }
      return { slotIndex, action: 'skip' } as const;
    }
    if (entry.action === 'cook') {
      if (Object.keys(entry).some((key) => key !== 'slotIndex' && key !== 'action' && key !== 'recipeId')) {
        throw new Error(`kế hoạch ô bếp ${slotIndex} không hợp lệ`);
      }
      return { slotIndex, action: 'cook', recipeId: nonNegativeInteger(entry.recipeId, 'recipeId') } as const;
    }
    throw new Error(`action của ô bếp ${slotIndex} không hợp lệ`);
  });

  entries.sort((left, right) => left.slotIndex - right.slotIndex);
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index - 1].slotIndex === entries[index].slotIndex) {
      throw new Error(`ô bếp ${entries[index].slotIndex} bị lặp`);
    }
  }
  return entries;
}

function autoSellRules(value: unknown): AutoSellRule[] {
  if (!Array.isArray(value)) throw new Error('autoSellRules phải là mảng');

  const seenItemIds = new Set<number>();
  const entries = value.map((raw, index) => {
    const entry = record(raw, 'mỗi quy tắc bán');
    if (Object.keys(entry).some((key) => key !== 'itemId' && key !== 'quantity' && key !== 'price')) {
      throw new Error(`quy tắc bán ${index} không hợp lệ`);
    }
    const itemId = entry.itemId;
    if (typeof itemId !== 'number' || !Number.isInteger(itemId) || itemId < 0 || itemId > 32767) {
      throw new Error(`quy tắc bán ${index}: itemId phải là số nguyên trong [0, 32767]`);
    }
    if (seenItemIds.has(itemId)) {
      throw new Error(`quy tắc bán ${index}: itemId ${itemId} bị lặp`);
    }
    seenItemIds.add(itemId);

    const quantity = entry.quantity;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0 || quantity > 2_147_483_647) {
      throw new Error(`quy tắc bán ${index}: quantity phải là số nguyên dương`);
    }

    const price = entry.price;
    if (typeof price !== 'number' || !Number.isInteger(price) || price <= 0 || price > 2_147_483_647) {
      throw new Error(`quy tắc bán ${index}: price phải là số nguyên dương`);
    }

    return { itemId, quantity, price };
  });

  return entries;
}

const parsers: Record<ConfigKey, ConfigParser> = {
  harvest: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  harvestAnimals: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  harvestBarnAnimals: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  harvestPondAnimals: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  sellAnimals: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  sellBarnAnimals: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  sellPondAnimals: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  feedAnimals: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  feedBarnAnimals: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  feedPondAnimals: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  healAnimals: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  fertilizeCells: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  autoBuy: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  seedId: nonNegativeInteger,
  waterItemId: nonNegativeInteger,
  grassItemId: nonNegativeInteger,
  wormItemId: nonNegativeInteger,
  sellWhenGrownSpecies: speciesList,
  sellNearDeathSpecies: speciesList,
  sellBarnSpecies: speciesList,
  sellPondSpecies: speciesList,
  minGrowthToSell: finiteNumber,
  nearDeathRatio: finiteNumber,
  maxSellsPerCycle: finiteNumber,
  minHealth: finiteNumber,
  minVitality: finiteNumber,
  buyBudgetXu: finiteNumber,
  maxBuyPerItem: finiteNumber,
  stepDelayMs: finiteNumber,
  intervalMs: finiteNumber,
  startDelayMs: finiteNumber,
  treeCellPlan: treeCellPlan,
  barnAnimalPlan: animalPlan,
  pondAnimalPlan: animalPlan,
  cookingSlotPlan: kitchenPlan,
  autoCook: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  autoHarvestCook: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  prioritizeCookingMissions: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  defaultRecipeId: nonNegativeInteger,
  autoClaimDailyQuests: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  logoutAfterCycle: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  autoSellProduce: (value, key) => {
    if (typeof value !== 'boolean') throw new Error(`${key} phải là boolean`);
    return value;
  },
  autoSellIntervalMs: (value, key) => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 300_000) {
      throw new Error(`${key} phải là số nguyên tối thiểu 300000 ms (5 phút)`);
    }
    return value;
  },
  autoSellRules: autoSellRules,
};

function isConfigKey(key: string): key is ConfigKey {
  return Object.prototype.hasOwnProperty.call(parsers, key);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

type V1Envelope = Record<string, unknown> & {
  version: 1;
  revision: number;
  config: Record<string, unknown>;
};

function isV1Envelope(value: Record<string, unknown>): value is V1Envelope {
  const keys = Object.keys(value);
  return keys.length === 3
    && keys.every((key) => key === 'version' || key === 'revision' || key === 'config')
    && value.version === 1
    && isNonNegativeInteger(value.revision)
    && typeof value.config === 'object'
    && value.config !== null
    && !Array.isArray(value.config);
}

export function normalizeAutoConfig(input: unknown): Partial<AutoFarmConfig> {
  const raw = record(input, 'cấu hình tự động');
  const normalized: Partial<AutoFarmConfig> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isConfigKey(key)) throw new Error(`key cấu hình ${key} không hợp lệ`);
    if (value === undefined) continue;
    Object.assign(normalized, { [key]: parsers[key](value, key) });
  }
  // Mandatory runtime policy: cooked dishes are always harvested.
  normalized.autoHarvestCook = true;
  return normalized;
}

export function readStoredAutoConfig(raw: unknown): StoredAutoConfigState {
  if (raw === null || raw === undefined) return { revision: 0, config: {} };
  const candidate = record(raw, 'cấu hình tự động đã lưu');
  if (isV1Envelope(candidate)) {
    return { revision: candidate.revision, config: normalizeAutoConfig(candidate.config) };
  }
  return { revision: 0, config: normalizeAutoConfig(candidate) };
}

export function storedAutoConfigEnvelope(state: StoredAutoConfigState): {
  version: 1;
  revision: number;
  config: Partial<AutoFarmConfig>;
} {
  if (!Number.isInteger(state.revision) || state.revision < 0) {
    throw new Error('revision phải là số nguyên không âm');
  }
  return { version: 1, revision: state.revision, config: normalizeAutoConfig(state.config) };
}

export function mergeAutoConfig(
  current: Partial<AutoFarmConfig>,
  patch: unknown,
): Partial<AutoFarmConfig> {
  return normalizeAutoConfig({ ...normalizeAutoConfig(current), ...normalizeAutoConfig(patch) });
}

export function validateAutoConfigProfile(
  config: Partial<AutoFarmConfig>,
  profile: AutoConfigProfile | null,
): void {
  if (config.treeCellPlan === undefined) return;
  const availableSeeds = new Set<number>([
    ...DEFAULT_SEED_CATALOG.map((s) => s.id),
    ...(profile?.seedIds ?? []),
  ]);
  for (const entry of config.treeCellPlan) {
    if (!Number.isInteger(entry.cellIndex) || entry.cellIndex < 0 || entry.cellIndex >= 48) {
      throw new Error(`ô ${entry.cellIndex} không hợp lệ`);
    }
    if (entry.action === 'seed' && !availableSeeds.has(entry.seedId)) {
      throw new Error(`hạt ${entry.seedId} không có trong danh mục`);
    }
  }
}
