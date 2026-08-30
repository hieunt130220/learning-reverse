import type {
  AnimalInfo,
  CookingState,
  FarmState,
  FoodRecipe,
  InventoryItem,
  ItemInfo,
  QuestOverviewState,
  TreeInfo,
} from '../game/farmData.js';

export interface CachedRuntimeSnapshot {
  quests: QuestOverviewState | null;
  farm: FarmState | null;
  inventory: InventoryItem[];
  farmProduce: InventoryItem[];
  cookingMaterials: InventoryItem[];
  trees: TreeInfo[];
  items: ItemInfo[];
  animals: AnimalInfo[];
  foods: FoodRecipe[];
  cooking: CookingState | null;
  capturedAt: number | null;
}

export type RuntimeSnapshotPatch = Partial<Omit<CachedRuntimeSnapshot, 'capturedAt'>>;

export function emptyRuntimeSnapshot(): CachedRuntimeSnapshot {
  return {
    quests: null,
    farm: null,
    inventory: [],
    farmProduce: [],
    cookingMaterials: [],
    trees: [],
    items: [],
    animals: [],
    foods: [],
    cooking: null,
    capturedAt: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function runtimeSnapshotPatchFromEvent(
  type: string,
  payload: unknown,
): RuntimeSnapshotPatch | null {
  switch (type) {
    case 'farm':
      return isRecord(payload) ? { farm: payload as unknown as FarmState } : null;
    case 'inventory':
      return Array.isArray(payload) ? { inventory: payload as InventoryItem[] } : null;
    case 'farm-produce':
      return Array.isArray(payload) ? { farmProduce: payload as InventoryItem[] } : null;
    case 'cooking-materials':
      return Array.isArray(payload) ? { cookingMaterials: payload as InventoryItem[] } : null;
    case 'cooking':
      return isRecord(payload) ? { cooking: payload as unknown as CookingState } : null;
    case 'quests':
      return isRecord(payload) ? { quests: payload as unknown as QuestOverviewState } : null;
    case 'trees': {
      if (!isRecord(payload)) return null;
      const patch: RuntimeSnapshotPatch = {};
      if (Array.isArray(payload.trees)) patch.trees = payload.trees as TreeInfo[];
      if (Array.isArray(payload.items)) patch.items = payload.items as ItemInfo[];
      if (Array.isArray(payload.animals)) patch.animals = payload.animals as AnimalInfo[];
      if (Array.isArray(payload.foods)) patch.foods = payload.foods as FoodRecipe[];
      return Object.keys(patch).length > 0 ? patch : null;
    }
    default:
      return null;
  }
}
