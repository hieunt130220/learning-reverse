export interface TrafficEntry {
  t: number;
  dir: 'tx' | 'rx';
  cmd: number;
  name: string;
  len: number;
  hex: string;
}

export interface FarmCell {
  index: number;
  idTree: number;
  time: number;
  vitalityPer: number;
  hervestPer: number;
  isArid: boolean;
  isWorm: boolean;
  isGrass: boolean;
  level?: number;
}

export interface FarmAnimal {
  index: number;
  species: number;
  bornTime: number;
  health: number;
  harvestPer: number;
  numEggOne: number;
  hunger: boolean;
  hasFlu: boolean;
  hasDiarrhea: boolean;
}

export interface AnimalInfo {
  id: number;
  name: string;
  desc: string;
}

export interface FarmState {
  idFarm: number;
  cells: FarmCell[];
  animals: FarmAnimal[];
  animalSlots: number[];
  pondAnimalSlots: number[];
  barnAnimalSlots: number[];
  updatedAt: number;
}

export interface TreeInfo {
  id: number;
  name: string;
  growMinutes: number;
  value: number;
}

export interface ItemInfo {
  id: number;
  name: string;
  price: number;
}

export interface AutoState {
  running: boolean;
  cycle: number;
  lastRun?: number;
  lastError?: string;
  lastActions: string[];
}

export interface InventoryItem {
  id: number;
  num: number;
}

export interface MacroState {
  running: boolean;
  name?: string;
  cycle: number;
  lastRun?: number;
  lastError?: string;
}

export interface FoodMaterial {
  itemId: number;
  count: number;
}

export interface FoodRecipe {
  id: number;
  name: string;
  productID: number;
  cookTimeMinutes: number;
  level: number;
  materials: FoodMaterial[];
  iconId?: number;
  icon?: string;
}

export interface ItemCooking {
  slot: number;
  idFood: number;
  time: number;
  remainTime: number;
  isDone: boolean;
}

export interface SlotMission {
  idFood: number;
  numCook: number;
  numNeed: number;
  isDone: boolean;
}

export interface CookingState {
  numSlot: number;
  slots: ItemCooking[];
  missions: SlotMission[];
  isUnlocked: boolean;
  isReadyToOpen: boolean;
  updatedAt: number;
}

export interface DailyMissionItem {
  idItem: number;
  name: string;
  numRequired: number;
  numCurrent: number;
  isDone: boolean;
  iconId?: number;
}

export interface DailyRewardItem {
  type: number; // 0: xu, 1: lượng, 2: lượng khoá, 3: exp, 4: item, 5: potion
  name: string;
  amount: number;
  itemId?: number;
}

export interface DailyBoxMilestone {
  milestone: number; // 20, 40, 60, 80, 100
  isClaimed: boolean;
  canClaim: boolean;
}

export interface DailyQuestState {
  score: number;
  maxScore: number;
  boxDone: number;
  boxes: DailyBoxMilestone[];
  missions: DailyMissionItem[];
  missionScoreReward?: number;
  rewards: DailyRewardItem[];
  typeMoneyChange: number;
  moneyChange: number;
  canChange: boolean;
  updatedAt: number;
}

export type ProgressQuestKind = 'beginner' | 'farmer' | 'fisherman';

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
  source: 'game-dialog' | 'game-packet' | 'default' | 'completed';
  updatedAt: number;
}

export interface FarmUpgradeRequirement {
  type: number;
  idFarm?: number;
  request: number;
  inStorage: number;
  displayName: string;
}

export interface FarmUpgradeRequirements {
  imageId: number;
  requirements: FarmUpgradeRequirement[];
}

export interface QuestOverviewState {
  daily: DailyQuestState | null;
  beginner: ProgressQuestChain | null;
  farmer: ProgressQuestChain | null;
  fisherman?: ProgressQuestChain | null;
  upgradeRequirements?: FarmUpgradeRequirements | null;
  source?: 'live' | 'cached' | 'none';
  updatedAt: number;
}

export interface LogLine {
  t: number;
  line: string;
}
export type FarmSyncStatus = 'idle' | 'syncing' | 'success' | 'error';
export interface FarmSyncState {
  status: FarmSyncStatus;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export type ClientStatus =
  | 'idle'
  | 'connecting'
  | 'handshaking'
  | 'logging-in'
  | 'online'
  | 'error';

/** Khớp `AvatarSessionSnapshot` phía server. */
export interface CachedAccountMetrics {
  xu?: number;
  luong?: number;
  luongKhoa?: number;
  playerLevel?: number;
  farmLevel?: number;
  syncedAt?: number;
}

export interface OwnShopSlot {
  slot: number;
  itemId: number;
  quantity: number;
  price: number;
  isSale: boolean;
  isTimeOut: boolean;
}

export interface MarketListing {
  index: number;
  idShop: number;
  verShop: number;
  itemId: number;
  quantity: number;
  price: number;
}

export interface MarketCatalogItem {
  itemId: number;
  price: number;
}

export interface MarketData {
  catalog: MarketCatalogItem[];
  timeRefresh: number | null;
  priceRefresh: number | null;
  selectedItemId: number | null;
  listings: MarketListing[];
}

export interface ShopPriceRule {
  itemId: number;
  minPrice: number;
  maxPrice: number;
}

export interface ShopSnapshot<T> {
  revision: number;
  connectionEpoch: number;
  capturedAt: number;
  data: T;
}

export interface ProduceSnapshot {
  revision: number;
  connectionEpoch: number;
  capturedAt: number;
  items: InventoryItem[];
}

export type ShopTransactionKind = 'list' | 'withdraw' | 'purchase' | 'unlock' | 'refresh-market';
export type ShopTransactionStatus =
  | 'queued'
  | 'sending'
  | 'awaiting_response'
  | 'reconciling'
  | 'succeeded'
  | 'failed'
  | 'unknown';

export interface ShopTransaction {
  id: string;
  accountId: number;
  idempotencyKey: string;
  kind: ShopTransactionKind;
  status: ShopTransactionStatus;
  request: Record<string, unknown>;
  before: Record<string, unknown>;
  result?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface ShopCapabilities {
  readEnabled: boolean;
  writeEnabled: boolean;
  purchaseEnabled: boolean;
  slotUnlockEnabled: boolean;
  marketRefreshEnabled: boolean;
  liveAccountAllowed: boolean;
}

export interface ShopRuntimeState {
  syncStatus: 'idle' | 'syncing' | 'ready' | 'stale' | 'error';
  own: ShopSnapshot<{ numSlot: number; canOpenSlot: boolean; slots: OwnShopSlot[] }> | null;
  market: ShopSnapshot<MarketData> | null;
  priceRules: ShopSnapshot<ShopPriceRule[]> | null;
  activeTransaction: ShopTransaction | null;
  recentTransactions: ShopTransaction[];
  capabilities: ShopCapabilities;
  lastError?: { code: string; message: string };
}

export type AutomationMode = 'off' | 'auto_farm' | 'find_npc' | 'auto_fishing';

export interface FishingConfig {
  readonly map: number;
  readonly area: number;
  readonly castDelayMs: number;

  // Cấu hình tự động mua
  readonly autoBuyTicket: boolean;
  readonly rodType: number;
  readonly baitType: number;
  readonly baitQuantity: number;
}

export const DEFAULT_FISHING_CONFIG: FishingConfig = Object.freeze({
  map: 14,
  area: 0,
  castDelayMs: 3000,
  autoBuyTicket: true,
  rodType: 442,      // Cần câu tre (10.000 xu)
  baitType: 448,     // Trứng kiến (30 xu)
  baitQuantity: 50,  // Mua 50 mồi mỗi lần
});

export interface StoredFishingConfigState {
  revision: number;
  config: FishingConfig;
}

export const FISHING_TICKETS: Readonly<Record<number, { id: number; name: string; cost: string; typeMoney: number }>> = Object.freeze({
  14: { id: 458, name: 'Vé câu cá rô', cost: '1.000 xu (hạn 3 ngày)', typeMoney: 1 },
  15: { id: 459, name: 'Vé câu cá lóc', cost: '10.000 xu (hạn 5 ngày)', typeMoney: 1 },
  16: { id: 460, name: 'Vé câu cá mập', cost: '2 Lượng (hạn 2 ngày)', typeMoney: 2 },
});

export const FISHING_RODS: readonly { id: number; name: string; cost: string; typeMoney: number }[] = Object.freeze([
  { id: 0, name: 'Không tự mua', cost: '', typeMoney: 0 },
  { id: 442, name: 'Cần câu tre', cost: '10.000 xu (hạn 7 ngày)', typeMoney: 1 },
  { id: 445, name: 'Cần câu sắt', cost: '25 Lượng', typeMoney: 2 },
  { id: 446, name: 'Cần câu VIP', cost: 'Lượng', typeMoney: 2 },
]);

export const FISHING_BAITS: readonly { id: number; name: string; cost: string; typeMoney: number }[] = Object.freeze([
  { id: 0, name: 'Không tự mua', cost: '', typeMoney: 0 },
  { id: 443, name: 'Mồi cơm', cost: '5 xu / mồi', typeMoney: 1 },
  { id: 447, name: 'Mồi trùng', cost: '20 xu / mồi', typeMoney: 1 },
  { id: 448, name: 'Trứng kiến', cost: '30 xu / mồi', typeMoney: 1 },
]);

export type FishingStatus =
  | 'idle'
  | 'moving'
  | 'buying'
  | 'selling'
  | 'starting'
  | 'casting'
  | 'hooked'
  | 'caught'
  | 'rejected'
  | 'resting';

export interface FishingRuntimeState {
  status: FishingStatus;
  totalCatches: number;
  lastFishId: number | null;
  lastFishName?: string | null;
  lastError: string | null;
  currentMap: number;
  currentArea: number;
}

export interface AutomationLocation {
  map: number;
  area: number;
  observedAt: number;
}

export interface StoredFindNpcConfigState {
  revision: number;
  config: { npcName: string };
}

export interface NpcMapLocation {
  map: number;
  area: number;
}

export type AutoFindNpcPhase = 'idle' | 'scanning' | 'scan_backoff' | 'tracking' | 'stopping';

export interface AutoFindNpcState {
  phase: AutoFindNpcPhase;
  running: boolean;
  targetName: string;
  cursor: number;
  total: number;
  current?: NpcMapLocation;
  /** Map/khu đang chờ snapshot; tồn tại cả khi phase=scanning. */
  probing?: NpcMapLocation;
  timeoutStreak: number;
  backoffUntil?: number;
  lastError?: string;
}

export interface AutomationSnapshot {
  desiredMode: AutomationMode;
  activeMode: AutomationMode;
  transitionState: 'stable' | 'switching';
  findNpcConfig: StoredFindNpcConfigState;
  findNpcRuntime: AutoFindNpcState;
  fishingConfig?: StoredFishingConfigState;
  fishingRuntime?: FishingRuntimeState;
  location: AutomationLocation | null;
}

export interface AutomationApiErrorDto {
  error: string;
  code:
    | 'invalid-automation-mode'
    | 'invalid-find-npc-config'
    | 'find-npc-name-required'
    | 'catalog-unverified'
    | 'revision-conflict'
    | 'automation-connect-pending'
    | 'automation-start-failed';
  snapshot?: AutomationSnapshot;
  current?: StoredFindNpcConfigState;
}

export interface SessionSnapshot {
  accountId: number;
  status: ClientStatus;
  lastError?: string;
  playerId?: number;
  money?: number;
  xu?: number;
  luong?: number;
  luongKhoa?: number;
  playerLevel?: number;
  farmLevel?: number;
  metricsSyncedAt?: number;
  farm?: FarmState;
  cooking?: CookingState;
  foods?: FoodRecipe[];
  foodCatalogReady?: boolean;
  quests?: QuestOverviewState | null;
  farmSync?: FarmSyncState;
  auto: AutoState;
  automation?: AutomationSnapshot;
  macro: MacroState;
  /** Optional trong rolling deploy; backend mới luôn phát đủ hai field. */
  shop?: ShopRuntimeState;
  produce?: ProduceSnapshot | null;
  /** Nông sản thu hoạch (section 3 gói kho cmd 70) — riêng với `produce` của sạp. */
  farmProduce?: InventoryItem[];
  /** Nguyên liệu đặc biệt cho bếp (section 4 gói kho cmd 70). */
  cookingMaterials?: InventoryItem[];
  inventory: InventoryItem[];
  trees: TreeInfo[];
  items: ItemInfo[];
  animals: AnimalInfo[];
  logs: LogLine[];
  traffic: TrafficEntry[];
  retries: number;
  nextRetryAt?: number;
  desiredConnected: boolean;
}

export interface AvatarAccount {
  id: number;
  label: string;
  gameUser: string;
  host: string;
  port: number;
  autoEnabled: boolean;
  hasPassword: boolean;
  createdAt: number;
  updatedAt: number;
  cachedMetrics?: CachedAccountMetrics;
}

export interface AccountWithRuntime extends AvatarAccount {
  runtime: SessionSnapshot | null;
}

export interface AuthUser {
  id: number;
  email: string;
}

export type TreeCellPlanEntry =
  | { cellIndex: number; action: 'seed'; seedId: number }
  | { cellIndex: number; action: 'skip' };

export type AnimalPlanEntry =
  | { slotIndex: number; action: 'breed'; speciesId: number }
  | { slotIndex: number; action: 'skip' };

export type KitchenPlanEntry =
  | { slotIndex: number; action: 'cook'; recipeId: number }
  | { slotIndex: number; action: 'skip' };

export interface AutoSellRuleDto {
  itemId: number;
  quantity: number;
  price: number;
}

export interface AutoFarmConfigDto {
  seedId?: number;
  waterItemId?: number;
  grassItemId?: number;
  wormItemId?: number;
  harvest: boolean;
  harvestAnimals: boolean;
  harvestBarnAnimals?: boolean;
  harvestPondAnimals?: boolean;
  sellAnimals: boolean;
  sellBarnAnimals?: boolean;
  sellPondAnimals?: boolean;
  sellWhenGrownSpecies: number[];
  sellNearDeathSpecies: number[];
  sellBarnSpecies?: number[];
  sellPondSpecies?: number[];
  minGrowthToSell: number;
  nearDeathRatio: number;
  maxSellsPerCycle: number;
  feedAnimals: boolean;
  feedBarnAnimals?: boolean;
  feedPondAnimals?: boolean;
  healAnimals: boolean;
  minHealth: number;
  fertilizeCells: boolean;
  minVitality: number;
  autoBuy: boolean;
  buyBudgetXu: number;
  maxBuyPerItem: number;
  stepDelayMs: number;
  intervalMs: number;
  startDelayMs: number;
  treeCellPlan: TreeCellPlanEntry[];
  barnAnimalPlan?: AnimalPlanEntry[];
  pondAnimalPlan?: AnimalPlanEntry[];
  cookingSlotPlan?: KitchenPlanEntry[];
  autoCook?: boolean;
  autoHarvestCook?: boolean;
  prioritizeCookingMissions?: boolean;
  defaultRecipeId?: number;
  autoClaimDailyQuests?: boolean;
  logoutAfterCycle?: boolean;
  autoSellProduce?: boolean;
  autoSellIntervalMs?: number;
  autoSellRules?: AutoSellRuleDto[];
}

export interface CachedSeedDto {
  id: number;
  name: string;
  growMinutes: number;
  value: number;
}

export interface AutoConfigStateDto {
  revision: number;
  config: Partial<AutoFarmConfigDto>;
}

export interface AutoConfigResponse extends AutoConfigStateDto {
  application?: 'next-cycle' | 'next-start';
}

export interface FarmProfileDto {
  farmId: number | null;
  cellIndices: number[];
  barnAnimalSlots: number[];
  pondAnimalSlots: number[];
  seedCatalog: CachedSeedDto[];
  cellsObservedAt: number | null;
  seedsObservedAt: number | null;
  updatedAt: number | null;
}

export type AutoConfigErrorDto =
  | {
      error: string;
      code: 'revision-conflict';
      current: AutoConfigStateDto;
    }
  | {
      error: string;
      code: 'farm-profile-required' | 'seed-catalog-required';
    }
  | {
      error: string;
      code: 'invalid-tree-cell-plan';
      invalidCellIndices: number[];
      invalidSeedIds: number[];
    };
