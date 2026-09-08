function isMoneyUpdate(value: unknown): value is { type?: number; balance: number } {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (record.type === undefined || typeof record.type === 'number')
    && typeof record.balance === 'number'
    && Number.isFinite(record.balance);
}

import { AutoFarm, DEFAULT_AUTO_INTERVAL_MS, type AutoFarmConfig, type AutoFarmState } from '../autoFarm.js';
import { AutoFindNpc, type AutoFindNpcOptions } from '../autoFindNpc.js';
import {
  GameClient,
  type CaptchaEvent,
  type ClientStatus,
  type DeviceProfile,
  type TemporaryLoginRejection,
  type TrafficEntry,
} from '../game/client.js';
import { saveCaptchaDiagnostic, savePassiveCaptcha } from '../game/captchaPassiveSaver.js';
import { type QuestOverviewState } from '../game/farmData.js';
import { MacroRunner, type Macro, type MacroState } from '../macro.js';
import type { AccountMetricsPatch, CachedAccountMetrics } from '../accounts/repo.js';
import type { ShopRepository, ProduceSnapshot, ShopRuntimeState, ShopTransaction } from '../accounts/shopRepo.js';
import type { ShopPolicy } from '../config.js';
import {
  ShopCoordinator,
  ShopError,
  type BrowseMarketItemInput,
  type CreateListingInput,
  type PurchaseListingInput,
  type RefreshMarketInput,
  type UnlockSlotInput,
  type WithdrawListingInput,
} from './shopCoordinator.js';
import {
  DEFAULT_FISHING_CONFIG,
  getFishName,
  idleFindNpcRuntime,
  idleFishingRuntime,
  type AutomationLocation,
  type AutomationMode,
  type AutomationSnapshot,
  type AutomationStartOutcome,
  type AutoFindNpcState,
  type FishingRuntimeState,
  type LoadedAutomationIntent,
  type NpcMapLocation,
} from './automationTypes.js';
import {
  emptyRuntimeSnapshot,
  runtimeSnapshotPatchFromEvent,
  type CachedRuntimeSnapshot,
} from './runtimeCache.js';
import {
  buildAnswerDomain,
  makeAutoDecision,
  type CanCauPayload,
} from '../fishing/autoDecision.js';
import { ProductionInferenceClient } from '../fishing/productionInference.js';

export function isFishingAutoTx43Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FISHING_AUTO_TX43_ENABLED === 'true';
}

export const RETRY_BASE_MS = 10_000;
export const RETRY_MAX_MS = 5 * 60 * 1000;
const AUTOMATION_INITIAL_OUTCOME_TIMEOUT_MS = 10_000;
const LOG_BUFFER = 500;
const TRAFFIC_BUFFER = 100;

export class AutomationInitializationError extends Error {
  constructor(
    readonly code: 'find-npc-name-required' | 'catalog-unverified' | 'find-npc-init-failed',
    message: string,
  ) {
    super(message);
    this.name = 'AutomationInitializationError';
  }
}

export interface AvatarCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
  device?: Partial<DeviceProfile>;
  /** Ý muốn của người dùng, đọc từ DB. */
  autoEnabled: boolean;
  /** Intent chuẩn hóa; `autoEnabled` chỉ còn là field tương thích cho harness cũ. */
  automation: LoadedAutomationIntent;
  autoConfig?: Partial<AutoFarmConfig>;
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

export interface AvatarSessionSnapshot {
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
  farm?: unknown;
  cooking?: unknown;
  foods?: unknown[];
  foodCatalogReady?: boolean;
  quests?: QuestOverviewState | null;
  farmSync: FarmSyncState;
  auto: AutoFarmState;
  automation: AutomationSnapshot;
  macro: MacroState;
  shop: ShopRuntimeState;
  produce: ProduceSnapshot | null;
  inventory: unknown[];
  farmProduce: unknown[];
  cookingMaterials: unknown[];
  trees: unknown[];
  items: unknown[];
  animals: unknown[];
  logs: LogLine[];
  traffic: TrafficEntry[];
  retries: number;
  nextRetryAt?: number;
  desiredConnected: boolean;
}

export interface AvatarSessionOptions {
  accountId: number;
  /** Đọc lại mỗi lần kết nối — mật khẩu có thể đã đổi giữa hai lần thử. */
  loadCredentials: () => Promise<AvatarCredentials>;
  onEvent: (type: string, payload: unknown) => void;
  /** Lỗi không thể tự khắc phục (sai mật khẩu game) — tầng trên ghi DB. */
  onPermanentFailure: (reason: string) => void;
  onAutomationFailure?: (reason: string) => void;
  onAutomationLocation: (location: NpcMapLocation | null) => void;
  onMetrics?: (patch: AccountMetricsPatch) => void;
  cachedMetrics?: CachedAccountMetrics;
  /** Snapshot nhiệm vụ/tài sản gần nhất để hiển thị khi chờ vòng auto kế tiếp. */
  cachedSnapshot?: CachedRuntimeSnapshot;
  /** Production luôn truyền đủ hai dependency; optional giữ tương thích cho harness cũ. */
  shopRepository?: ShopRepository;
  shopPolicy?: ShopPolicy;
  createClient?: () => GameClient;
  createAutoFarm?: (client: GameClient) => AutoFarm;
  findNpcCatalog?: readonly NpcMapLocation[];
  createAutoFindNpc?: (options: AutoFindNpcOptions) => AutoFindNpc;
  createMacroRunner?: (client: GameClient) => MacroRunner;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  now?: () => number;
  random?: () => number;
}

const EMPTY_AUTO: AutoFarmState = { running: false, cycle: 0, lastActions: [] };
const EMPTY_MACRO: MacroState = { running: false, cycle: 0 };
const EMPTY_FARM_SYNC: FarmSyncState = { status: 'idle' };
const DISABLED_SHOP_STATE: ShopRuntimeState = {
  syncStatus: 'idle',
  own: null,
  market: null,
  priceRules: null,
  activeTransaction: null,
  recentTransactions: [],
  capabilities: {
    readEnabled: false,
    writeEnabled: false,
    purchaseEnabled: false,
    slotUnlockEnabled: false,
    marketRefreshEnabled: false,
    liveAccountAllowed: false,
  },
};

export const FISHING_HUMAN_TIMING = {
  /** Trễ nhận diện ban đầu khi bảng mini-game xuất hiện (ms) */
  PERCEPTION_MIN_MS: 700,
  PERCEPTION_MAX_MS: 1200,

  /** Trễ mô phỏng bấm từng phím mũi tên (ms / phím) */
  PER_KEY_MIN_MS: 300,
  PER_KEY_MAX_MS: 520,

  /** Trễ xem thông tin cá / animation kéo cần lên trước khi gửi TX 44 (ms) */
  POST_CATCH_MIN_MS: 1800,
  POST_CATCH_MAX_MS: 3200,

  /** Jitter ngẫu nhiên cộng thêm vào castDelayMs giữa 2 lần quăng cần (ms) */
  CAST_JITTER_MIN_MS: 500,
  CAST_JITTER_MAX_MS: 2000,

  /** Khoảng số lượt câu trước khi nghỉ tay định kỳ */
  MICRO_BREAK_INTERVAL_MIN_CATCHES: 8,
  MICRO_BREAK_INTERVAL_MAX_CATCHES: 14,

  /** Thời gian nghỉ tay mô phỏng người chơi uống nước/xem đồ (ms) */
  MICRO_BREAK_MIN_MS: 6000,
  MICRO_BREAK_MAX_MS: 12000,
} as const;

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Một tài khoản avatar đang sống trên server: giữ `GameClient` + `AutoFarm` +
 * `MacroRunner`, đệm log/traffic trong RAM, và tự kết nối lại khi rớt.
 *
 * `desiredConnected` là ý muốn, `client.status` là hiện thực đang đuổi theo nó.
 * Tách hai thứ này là lý do "24/7 độc lập trình duyệt" thành thật.
 */
export class AvatarSession {
  private client?: GameClient;
  private auto?: AutoFarm;
  private macros?: MacroRunner;
  private wanted = false;
  private retries = 0;
  private nextRetryAt?: number;
  private retryTimer?: NodeJS.Timeout;
  private connectionEpoch = 0;
  private onlineEpoch?: number;
  /** Một promise điểm danh dùng chung cho mọi đường khởi động automation của epoch. */
  private attendanceEpoch?: number;
  private attendancePromise?: Promise<void>;
  private retryAfter?: { epoch: number; notBefore: number };
  private autoCycleTimer?: NodeJS.Timeout;
  private autoStartEpoch?: number;
  /** Đã nhận LOGIN_FAIL: không thử lại nữa dù rớt kết nối. */
  private permanentlyFailed = false;
  private lastAutoConfig: Partial<AutoFarmConfig> = {};
  private desiredMode: AutomationMode = 'off';
  private activeMode: AutomationMode = 'off';
  private transitionState: 'stable' | 'switching' = 'stable';
  private findNpcConfig = { revision: 0, config: { npcName: '' } };
  private automationLocation: AutomationLocation | null = null;
  private findNpc?: AutoFindNpc;
  private findNpcRuntime: AutoFindNpcState = idleFindNpcRuntime('');
  private fishingRuntime: FishingRuntimeState = idleFishingRuntime();
  private fishingAbortController?: AbortController;
  private automationTransition: Promise<AutomationStartOutcome> = Promise.resolve('active');
  private pendingAutomationTransitions = 0;
  private pendingFindNpcTransitions = 0;
  private readonly initialConnectionWaiters = new Set<() => void>();
  /** Hard teardown tăng generation để mọi continuation đang await trở thành inert. */
  private automationGeneration = 0;
  private automationTransitionSequence = 0;
  private cancelledAutomationTransitionSequence = 0;
  private autoSellRunSequence = 0;
  private farmSync: FarmSyncState = EMPTY_FARM_SYNC;
  private farmSyncPromise?: Promise<void>;
  private cachedMetrics: CachedAccountMetrics;
  private runtimeSnapshot: CachedRuntimeSnapshot;
  private autoSyncKickoff?: NodeJS.Immediate;
  private readonly shop?: ShopCoordinator;
  private shopClientAttached = false;
  private fishingChallengeGeneration = 0;
  private readonly consumedFishingChallenges = new Set<number>();
  private fishingInferenceClient?: ProductionInferenceClient;

  private readonly logs: LogLine[] = [];
  private readonly traffic: TrafficEntry[] = [];

  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(private readonly opts: AvatarSessionOptions) {
    this.setTimeoutFn = opts.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = opts.clearTimeoutFn ?? clearTimeout;
    this.now = opts.now ?? Date.now;
    this.random = opts.random ?? Math.random;
    this.cachedMetrics = { ...opts.cachedMetrics };
    this.runtimeSnapshot = opts.cachedSnapshot ?? emptyRuntimeSnapshot();
    if (opts.shopRepository && opts.shopPolicy) {
      this.shop = new ShopCoordinator({
        accountId: opts.accountId,
        repository: opts.shopRepository,
        policy: opts.shopPolicy,
        emit: (type, payload) => this.emit(type, payload),
        now: this.now,
        isAutomationRunning: () => (
          (this.auto?.state().running ?? false) || (this.macros?.state().running ?? false)
        ),
      });
    }
  }

  get status(): ClientStatus {
    return this.client?.status ?? 'idle';
  }

  get desiredConnected(): boolean {
    return this.wanted;
  }

  get rawClient(): GameClient | undefined {
    return this.client;
  }

  getQuestOverview(): QuestOverviewState {
    const c = this.client?.status === 'online' ? this.client : undefined;
    if (!c) {
      return this.runtimeSnapshot.quests ?? {
        daily: null,
        beginner: null,
        farmer: null,
        updatedAt: this.now(),
      };
    }
    if (typeof c.syncProgressQuests === 'function') c.syncProgressQuests();
    const daily = c.dailyQuestState ?? null;
    const beginner = c.beginnerQuestState ?? null;
    const farmer = c.farmerQuestState ?? null;
    const overview: QuestOverviewState = {
      daily,
      beginner,
      farmer,
      upgradeRequirements: c.farmUpgradeRequirements ?? null,
      updatedAt: Math.max(
        daily?.updatedAt ?? 0,
        beginner?.updatedAt ?? 0,
        farmer?.updatedAt ?? 0,
      ) || this.now(),
    };
    this.runtimeSnapshot = {
      ...this.runtimeSnapshot,
      quests: overview,
      capturedAt: this.now(),
    };
    return overview;
  }

  private patchRuntimeSnapshot(type: string, payload: unknown): void {
    const patch = runtimeSnapshotPatchFromEvent(type, payload);
    if (patch) {
      this.runtimeSnapshot = {
        ...this.runtimeSnapshot,
        ...patch,
        capturedAt: this.now(),
      };
    }
  }

  refreshProgressQuests(): void {
    if (this.client?.status === 'online') {
      void this.client.refreshProgressQuests();
    }
  }

  private setWanted(wanted: boolean): void {
    if (this.wanted === wanted) return;
    this.wanted = wanted;
    this.emit('desired-connected', wanted);
  }

  async start(): Promise<void> {
    this.setWanted(true);
    this.permanentlyFailed = false;
    if (this.client && this.client.status === 'online') return;
    if (this.client) {
      this.cancelRetry();
      this.teardown();
    }
    await this.connect();
  }

  stop(): void {
    this.fishingChallengeGeneration += 1;
    this.setWanted(false);
    this.cancelRetry();
    this.cancelAutoCycleTimer();
    this.cancelAutoSyncKickoff();
    this.teardown();
    this.activeMode = 'off';
    this.transitionState = 'stable';
    this.emitAutomation();
    this.emit('status', 'idle');
  }

  async startAuto(cfg: Partial<AutoFarmConfig>): Promise<AutomationStartOutcome> {
    this.lastAutoConfig = cfg;
    return await this.switchAutomationMode({
      desiredMode: 'auto_farm',
      findNpcConfig: this.findNpcConfig,
      location: this.automationLocation,
    });
  }

  updateAutoConfig(cfg: Partial<AutoFarmConfig>): 'next-cycle' | 'next-start' {
    this.lastAutoConfig = cfg;
    if (this.auto?.state().running) {
      this.auto.queueConfig(cfg);
      return 'next-cycle';
    }
    return 'next-start';
  }

  async stopAutomation(): Promise<void> {
    await this.switchAutomationMode({
      desiredMode: 'off',
      findNpcConfig: this.findNpcConfig,
      location: this.automationLocation,
    });
  }

  async stopAuto(): Promise<void> {
    // Giữ cleanup legacy đồng bộ ngay cả khi caller cũ chưa await Promise mới.
    this.cancelAutoCycleTimer();
    await this.stopAutomation();
    this.stop();
  }

  switchAutomationMode(intent: LoadedAutomationIntent): Promise<AutomationStartOutcome> {
    const targetsFindNpc = intent.desiredMode === 'find_npc';
    if (targetsFindNpc) this.pendingFindNpcTransitions += 1;
    const transitionSequence = ++this.automationTransitionSequence;
    const enqueuedGeneration = this.automationGeneration;
    const run = async (): Promise<AutomationStartOutcome> => {
      if (
        transitionSequence <= this.cancelledAutomationTransitionSequence
        || !this.isAutomationGenerationCurrent(enqueuedGeneration)
      ) return 'connect-pending';
      let generation = enqueuedGeneration;
      try {
        this.desiredMode = intent.desiredMode;
        this.findNpcConfig = intent.findNpcConfig;
        this.automationLocation = intent.location;
        if (intent.desiredMode === 'find_npc') this.cancelAutoSyncKickoff();
        this.transitionState = 'switching';
        this.emitAutomation();
        if (!this.isAutomationGenerationCurrent(generation)) return 'connect-pending';

        if (!(await this.stopActiveAutomation(generation))) return 'connect-pending';
        if (intent.desiredMode === 'off') {
          this.setWanted(false);
          this.transitionState = 'stable';
          this.emitAutomation();
          return 'active';
        }

        if (this.status !== 'online') {
          const starting = this.beginAutomationConnection(generation);
          if (!starting) return 'connect-pending';
          generation = starting.generation;
          const connectionOutcome = await starting.completion;
          if (connectionOutcome === 'permanent' || this.permanentlyFailed) return 'start-failed';
          if (connectionOutcome !== 'online') return 'connect-pending';
          if (!this.isAutomationGenerationCurrent(generation)) return 'connect-pending';
        }

        // connect() reload credentials from DB; explicit serialized intent wins
        // only while this exact generation still owns the continuation.
        this.desiredMode = intent.desiredMode;
        this.findNpcConfig = intent.findNpcConfig;
        this.automationLocation = intent.location;
        this.findNpcRuntime = idleFindNpcRuntime(this.findNpcConfig.config.npcName);
        const client = this.client;
      const epoch = this.connectionEpoch;
      if (!client || client.status !== 'online') {
        if (this.retryAfter?.epoch === epoch && this.desiredMode === 'auto_farm') {
          return 'connect-pending';
        }
        this.activeMode = 'off';
        this.emitAutomation();
        return 'connect-pending';
        }
        if (!(await this.startDesiredAutomation(client, generation, epoch))) {
          return 'connect-pending';
        }
        if (
          !this.isAutomationGenerationCurrent(generation)
          || !this.isCurrent(client, epoch)
          || client.status !== 'online'
        ) return 'connect-pending';
        this.transitionState = 'stable';
        this.emitAutomation();
        return 'active';
      } catch (error) {
        if (!this.isAutomationGenerationCurrent(generation)) return 'connect-pending';
        if (!(error instanceof AutomationInitializationError) && this.status !== 'online') {
          this.activeMode = 'off';
          this.emitAutomation();
          return 'connect-pending';
        }
        if (!(await this.stopActiveAutomation(generation))) return 'connect-pending';
        this.setWanted(false);
        this.desiredMode = 'off';
        this.transitionState = 'stable';
        this.emitAutomation();
        return 'start-failed';
      }
    };
    const transition = this.enqueueAutomationTransition(run);
    if (!targetsFindNpc) return transition;
    return transition.finally(() => {
      this.pendingFindNpcTransitions -= 1;
    });
  }

  startMacro(macro: Macro): void {
    this.shop?.assertIdleForAutomation();
    this.requireClient();
    this.macros!.start(macro);
  }

  stopMacro(): void {
    this.macros?.stop();
  }

  callFarm(name: string, args: unknown[]): void {
    this.assertFarmContextAvailable();
    const client = this.requireClient();
    const fn = (client.farm as unknown as Record<string, unknown>)[name];
    if (typeof fn !== 'function') throw new Error(`không có action "${name}"`);
    (fn as (...a: unknown[]) => void).apply(client.farm, args);
  }

  sendRaw(cmd: number, fields: Array<{ t: string; v: string }>): void {
    this.requireClient().sendRaw(cmd, fields);
  }

  shopState(): ShopRuntimeState {
    return this.shop?.state() ?? defensiveDisabledShopState();
  }

  shopProduceState(): ProduceSnapshot | null {
    return this.shop?.produceState() ?? null;
  }

  listShopTransactions(limit: number): ShopTransaction[] {
    return this.requireShop().listTransactions(limit);
  }

  syncShop(): Promise<ShopRuntimeState> {
    return this.requireShop().syncOwnShop();
  }

  browseShopCatalog(): Promise<ShopRuntimeState> {
    return this.requireShop().browseMarketCatalog();
  }

  browseShopItem(input: BrowseMarketItemInput): Promise<ShopRuntimeState> {
    return this.requireShop().browseMarketItem(input);
  }

  createShopListing(input: CreateListingInput): ShopTransaction {
    return this.requireShop().createListing(input);
  }

  withdrawShopListing(input: WithdrawListingInput): ShopTransaction {
    return this.requireShop().withdrawListing(input);
  }

  purchaseShopListing(input: PurchaseListingInput): ShopTransaction {
    return this.requireShop().purchaseListing(input);
  }

  unlockShopSlot(input: UnlockSlotInput): ShopTransaction {
    return this.requireShop().unlockSlot(input);
  }

  refreshShopMarket(input: RefreshMarketInput): ShopTransaction {
    return this.requireShop().refreshMarket(input);
  }

  enterFarm(): void {
    this.assertFarmContextAvailable();
    this.requireClient().enterFarm();
  }

  async refreshFarmProfile(timeoutMs = 10_000, realTimer = false): Promise<void> {
    this.assertFarmContextAvailable();
    if (this.farmSyncPromise) return await this.farmSyncPromise;
    const refresh = this.performFarmRefresh(timeoutMs, realTimer);
    this.farmSyncPromise = refresh;
    try {
      await refresh;
    } finally {
      if (this.farmSyncPromise === refresh) this.farmSyncPromise = undefined;
    }
  }

  private async performFarmRefresh(timeoutMs: number, realTimer: boolean): Promise<void> {
    this.cancelAutoSyncKickoff();
    const client = this.requireClient();
    if (client.status !== 'online') throw new Error('phiên chưa online');
    const epoch = this.connectionEpoch;
    let timeout: NodeJS.Timeout | undefined;
    let rejectRefresh: ((reason: Error) => void) | undefined;
    let resolveRefresh: (() => void) | undefined;
    const clearTimeoutFn = realTimer ? clearTimeout : this.clearTimeoutFn;
    const completed = new Promise<void>((resolve, reject) => {
      resolveRefresh = resolve;
      rejectRefresh = reject;
      const setTimeoutFn = realTimer ? setTimeout : this.setTimeoutFn;
      timeout = setTimeoutFn(() => {
        reject(new Error(
          this.isCurrent(client, epoch)
            ? 'quá hạn đồng bộ farm'
            : 'phiên đã thay đổi khi đồng bộ farm',
        ));
      }, timeoutMs);
      if (realTimer) (timeout as NodeJS.Timeout).unref?.();
    });
    const onFarm = (): void => {
      if (!this.isCurrent(client, epoch)) {
        rejectRefresh?.(new Error('phiên đã thay đổi khi đồng bộ farm'));
        return;
      }
      resolveRefresh?.();
    };
    client.once('farm', onFarm);

    try {
      if (client.playerId) {
        client.requestYourInfo(client.playerId);
      }
      client.enterFarm();
      await completed;
    } finally {
      if (timeout) clearTimeoutFn(timeout);
      client.removeListener('farm', onFarm);
    }
  }

  private findNpcOwnsOrTargetsContext(): boolean {
    return this.desiredMode === 'find_npc'
      || this.activeMode === 'find_npc'
      || this.pendingFindNpcTransitions > 0;
  }

  private assertFarmContextAvailable(): void {
    if (this.findNpcOwnsOrTargetsContext()) {
      throw new Error('Find NPC đang sở hữu ngữ cảnh Park; không thể chuyển sang farm');
    }
  }

  lastPacketHex(cmd: number): string | undefined {
    return this.client?.lastPacket.get(cmd);
  }

  automationSnapshot(): AutomationSnapshot {
    return {
      desiredMode: this.desiredMode,
      activeMode: this.activeMode,
      transitionState: this.transitionState,
      findNpcConfig: this.findNpcConfig,
      findNpcRuntime: this.findNpcRuntime,
      fishingRuntime: this.fishingRuntime,
      location: this.automationLocation,
    };
  }

  snapshot(): AvatarSessionSnapshot {
    const c = this.client;
    const live = c?.status === 'online' ? c : undefined;
    return {
      accountId: this.opts.accountId,
      status: c?.status ?? 'idle',
      lastError: c?.lastError,
      playerId: c?.playerId,
      money: c?.money ?? this.cachedMetrics.xu,
      xu: c?.money ?? this.cachedMetrics.xu,
      luong: c?.luong ?? this.cachedMetrics.luong,
      luongKhoa: c?.luongKhoa ?? this.cachedMetrics.luongKhoa,
      playerLevel: c?.playerLevel ?? this.cachedMetrics.playerLevel,
      farmLevel: c?.farmLevel ?? this.cachedMetrics.farmLevel,
      metricsSyncedAt: this.cachedMetrics.syncedAt,
      farm: live?.farmState ?? this.runtimeSnapshot.farm,
      cooking: live?.cookingState ?? this.runtimeSnapshot.cooking,
      foods: live?.foods ?? this.runtimeSnapshot.foods,
      foodCatalogReady: live?.foodCatalogReady ?? false,
      quests: this.getQuestOverview(),
      farmSync: this.farmSync,
      auto: this.auto?.state() ?? EMPTY_AUTO,
      automation: this.automationSnapshot(),
      macro: this.macros?.state() ?? EMPTY_MACRO,
      shop: this.shopState(),
      produce: this.shopProduceState(),
      inventory: live?.inventory ?? this.runtimeSnapshot.inventory,
      farmProduce: live?.produce ?? this.runtimeSnapshot.farmProduce,
      cookingMaterials: live?.cookingMaterials ?? this.runtimeSnapshot.cookingMaterials,
      trees: live?.trees ?? this.runtimeSnapshot.trees,
      items: live?.items ?? this.runtimeSnapshot.items,
      animals: live?.animals ?? this.runtimeSnapshot.animals,
      logs: [...this.logs],
      traffic: [...this.traffic],
      retries: this.retries,
      nextRetryAt: this.nextRetryAt,
      desiredConnected: this.wanted,
    };
  }

  // --- nội bộ -------------------------------------------------------------

  private requireClient(): GameClient {
    if (!this.client) throw new Error('phiên chưa kết nối');
    return this.client;
  }

  private requireShop(): ShopCoordinator {
    if (!this.shop) {
      throw new ShopError(403, 'SHOP_CAPABILITY_DISABLED', 'Coordinator sạp chưa được cấu hình');
    }
    return this.shop;
  }

  /** Mọi lời gọi ra ngoài đều bọc: một WS đã đóng không được giết cả phiên. */
  private emit(type: string, payload: unknown): void {
    try {
      this.opts.onEvent(type, payload);
    } catch {
      /* bỏ qua */
    }
  }

  private emitAutomation(): void {
    this.emit('automation', this.automationSnapshot());
  }

  private pushLog(line: string): void {
    const entry = { t: Date.now(), line };
    this.logs.push(entry);
    if (this.logs.length > LOG_BUFFER) this.logs.shift();
    this.emit('log', entry);
  }

  /** Round auto mới bắt đầu: xoá log cũ ở server và báo client dọn phần tích luỹ. */
  private clearLogs(): void {
    this.logs.splice(0, this.logs.length);
    this.emit('logs-clear', null);
  }

  private async connect(generation = this.automationGeneration): Promise<void> {
    const creds = await this.opts.loadCredentials();
    if (!this.isAutomationGenerationCurrent(generation) || !this.wanted) return;
    this.desiredMode = creds.automation.desiredMode;
    this.findNpcConfig = creds.automation.findNpcConfig;
    this.automationLocation = creds.automation.location;
    this.findNpcRuntime = idleFindNpcRuntime(this.findNpcConfig.config.npcName);
    this.lastAutoConfig = creds.autoConfig ?? {};

    const epoch = ++this.connectionEpoch;
    const client = this.opts.createClient ? this.opts.createClient() : new GameClient();
    this.client = client;
    this.retryAfter = undefined;
    this.auto = this.opts.createAutoFarm
      ? this.opts.createAutoFarm(client)
      : new AutoFarm(client, {
          continuous: false,
          runAutoSellCycle: async (rules, shouldStop) => {
            this.autoSellRunSequence += 1;
            const runId = `${this.onlineEpoch ?? 0}-${this.autoSellRunSequence}`;
            const coordinator = this.requireShop();
            return await coordinator.runAutoSellCycle(rules, runId, shouldStop);
          },
        });
    this.macros = this.opts.createMacroRunner
      ? this.opts.createMacroRunner(client)
      : new MacroRunner(client);
    this.shop?.attachClient(client, epoch);
    this.shopClientAttached = this.shop !== undefined;
    if (
      !this.isAutomationGenerationCurrent(generation)
      || !this.wanted
      || this.client !== client
    ) return;
    this.wire(client, epoch);

    try {
      await client.login({
        host: creds.host,
        port: creds.port,
        user: creds.user,
        pass: creds.pass,
        device: creds.device,
      });
    } catch (err) {
      if (!this.isCurrent(client, epoch)) return;
      const retryAfterState = this.retryAfter as
        | { epoch: number; notBefore: number }
        | undefined;
      if (retryAfterState?.epoch === epoch) {
        this.pushLog(`server từ chối đăng nhập: ${(err as Error).message}`);
        return;
      }
      this.pushLog(`kết nối lỗi: ${(err as Error).message}`);
      this.scheduleRetry(epoch);
      if (client.status !== 'idle' && client.status !== 'error') client.logout();
    }
  }

  private isCurrent(client: GameClient, epoch: number): boolean {
    return this.client === client && this.connectionEpoch === epoch;
  }

  private wire(client: GameClient, epoch: number): void {
    // EventEmitter không có listener 'error' sẽ ném và giết cả process, kéo
    // theo mọi phiên khác. Đây là listener bắt buộc, không phải phòng xa.
    client.on('error', (err: Error) => {
      if (!this.isCurrent(client, epoch)) return;
      this.pushLog(`lỗi client: ${err.message}`);
    });

    client.on('status', (s: ClientStatus) => {
      if (!this.isCurrent(client, epoch)) return;
      this.emit('status', s);
      if (s === 'online') this.onOnline(client, epoch);
      if (s === 'idle' || s === 'error') this.onDisconnected(epoch);
    });

    client.on('log', (line: string) => {
      if (!this.isCurrent(client, epoch)) return;
      this.pushLog(line);
    });

    client.on('traffic', (entry: TrafficEntry) => {
      if (!this.isCurrent(client, epoch)) return;
      this.traffic.push(entry);
      if (this.traffic.length > TRAFFIC_BUFFER) this.traffic.shift();
      this.emit('traffic', entry);
    });

    client.on('farm', (state: unknown) => {
      if (this.isCurrent(client, epoch)) {
        this.patchRuntimeSnapshot('farm', state);
        this.emit('farm', state);
      }
    });
    client.on('inventory', (inv: unknown) => {
      if (this.isCurrent(client, epoch)) {
        this.patchRuntimeSnapshot('inventory', inv);
        this.emit('inventory', inv);
      }
    });
    client.on('produce', (produce: unknown) => {
      if (this.isCurrent(client, epoch)) {
        this.patchRuntimeSnapshot('farm-produce', produce);
        this.emit('farm-produce', produce);
      }
    });
    client.on('cooking-materials', (materials: unknown) => {
      if (this.isCurrent(client, epoch)) {
        this.patchRuntimeSnapshot('cooking-materials', materials);
        this.emit('cooking-materials', materials);
      }
    });
    client.on('trees', (t: unknown) => {
      if (this.isCurrent(client, epoch)) {
        this.patchRuntimeSnapshot('trees', t);
        this.emit('trees', t);
      }
    });
    client.on('money', (m: unknown) => {
      if (!this.isCurrent(client, epoch)) return;
      if (isMoneyUpdate(m)) {
        const hasDetailed = typeof (m as Record<string, unknown>).xu === 'number'
          || typeof (m as Record<string, unknown>).luong === 'number'
          || typeof (m as Record<string, unknown>).luongKhoa === 'number';
        if (hasDetailed) {
          const rec = m as { xu?: number; luong?: number; luongKhoa?: number };
          this.updateCachedMetrics({
            ...(typeof rec.xu === 'number' && rec.xu >= 0 ? { xu: rec.xu } : {}),
            ...(typeof rec.luong === 'number' && rec.luong >= 0 ? { luong: rec.luong } : {}),
            ...(typeof rec.luongKhoa === 'number' && rec.luongKhoa >= 0 ? { luongKhoa: rec.luongKhoa } : {}),
          });
        } else {
          const patch = m.type === 2 ? { luong: m.balance } : { xu: m.balance };
          this.updateCachedMetrics(patch);
        }
      }
      this.emit('money', m);
    });
    client.on('cooking', (cook: unknown) => {
      if (this.isCurrent(client, epoch)) {
        this.patchRuntimeSnapshot('cooking', cook);
        this.emit('cooking', cook);
      }
    });
    client.on('quests', () => {
      if (this.isCurrent(client, epoch)) {
        this.emit('quests', this.getQuestOverview());
      }
    });
    client.on('metrics', (patch: unknown) => {
      if (!this.isCurrent(client, epoch)) return;
      if (patch && typeof patch === 'object') {
        this.updateCachedMetrics(patch as AccountMetricsPatch);
      }
    });

    client.on('message', (msg: { command: number }) => {
      if (!this.isCurrent(client, epoch)) return;
      // LOGIN_FAIL: sai mật khẩu hoặc tài khoản bị khoá. Thử lại là đường ngắn
      // nhất tới việc bị server game khoá thật — dừng hẳn, chờ người dùng sửa.
      if (msg.command === -35) this.failPermanently('đăng nhập thất bại — kiểm tra lại mật khẩu game');
    });

    client.on('temporary-rejection', (rejection: TemporaryLoginRejection) => {
      if (!this.isCurrent(client, epoch)) return;
      this.retryAfter = { epoch, notBefore: this.now() + rejection.retryAfterMs };
      this.pushLog(
        `server yêu cầu chờ ${Math.ceil(rejection.retryAfterMs / 1000)}s trước khi đăng nhập lại`,
      );
      // Một số lỗi tạm thời chỉ là thông báo (-40), server không đóng socket.
      // Đóng client ở đây để phát `idle` và đi chung nhánh scheduleRetry; nếu
      // giữ socket ở `logging-in`, nút Kết nối sẽ gọi vào client cũ rồi no-op.
      client.logout();
    });

    client.on('captcha', (ev: CaptchaEvent) => {
      if (!this.isCurrent(client, epoch)) return;
      void (async (): Promise<void> => {
        try {
          if (!ev.challenge) {
            const { fileName } = await saveCaptchaDiagnostic(
              ev.rawHex,
              ev.error?.message ?? 'unknown decode error',
              this.opts.accountId,
            );
            this.pushLog(`[captcha] lỗi decode đã lưu diagnostic ${fileName}: ${ev.error?.message}`);
            this.emit('captcha', {
              accountId: this.opts.accountId,
              targetId: null,
              menuId: null,
              prompt: '',
              inputType: null,
              format: null,
              fileName,
              sha256: null,
              receivedAt: new Date().toISOString(),
              isDiagnostic: true,
              error: ev.error?.message ?? null,
            });
            return;
          }
          const result = await savePassiveCaptcha(ev.challenge, this.opts.accountId);
          const fmt = result.format ?? (ev.decoded?.format ?? 'bin');
          const size = ev.challenge.imageBytes?.length ?? 0;
          this.pushLog(
            `[captcha] đã lưu ${result.fileName} [${fmt}, ${size} bytes, sha=${(result.sha256 ?? '').slice(0, 12)}${result.sha256 ? '...' : ''}] prompt="${ev.challenge.prompt.slice(0, 30)}"`,
          );
          this.emit('captcha', {
            accountId: this.opts.accountId,
            targetId: ev.challenge.targetId,
            menuId: ev.challenge.menuId,
            prompt: ev.challenge.prompt,
            inputType: ev.challenge.inputType,
            format: result.format,
            fileName: result.fileName,
            savedPath: result.savedPath,
            sha256: result.sha256,
            receivedAt: new Date().toISOString(),
            isDiagnostic: result.isDiagnostic,
          });
        } catch (err) {
          this.pushLog(`[captcha] lỗi lưu file: ${(err as Error).message}`);
        }
      })();
    });

    client.on('fishing-challenge', (payload: CanCauPayload) => {
      if (!this.isCurrent(client, epoch) || this.desiredMode !== 'auto_fishing') return;
      // CHỈ xử lý challenge thuộc về chính nhân vật của mình trong hồ!
      if (client.playerId === undefined || payload.idUser !== client.playerId) {
        return;
      }
      this.handleFishingChallenge(client, epoch, payload);
    });

    client.on('fishing-success-result', (ev: { idUser: number; idFish: number }) => {
      if (!this.isCurrent(client, epoch) || this.desiredMode !== 'auto_fishing') return;
      // CHỈ xử lý kết quả thuộc về chính nhân vật của mình trong hồ!
      if (client.playerId === undefined || ev.idUser !== client.playerId) {
        return;
      }
      if (ev.idFish >= 0) {
        const fishName = getFishName(ev.idFish);
        this.fishingRuntime.totalCatches += 1;
        this.fishingRuntime.lastFishId = ev.idFish;
        this.fishingRuntime.lastFishName = fishName;
        this.fishingRuntime.status = 'caught';
        this.pushLog(`[câu cá] bắt được ${fishName} (ID ${ev.idFish})! (Tổng: ${this.fishingRuntime.totalCatches})`);
      } else {
        this.pushLog(`[câu cá] giật hụt hoặc sổng cá (mã ${ev.idFish})`);
        this.fishingRuntime.status = 'rejected';
        this.fishingRuntime.lastError = `Giật hụt / sổng cá (${ev.idFish})`;
      }
      this.emitAutomation();
    });

    this.auto!.on('state', (s: AutoFarmState) => {
      if (this.isCurrent(client, epoch)) this.emit('auto', s);
    });
    // Nhật ký từng bước của auto đi chung đệm với log của client: có mốc giờ,
    // giữ 500 dòng gần nhất và chạy live qua WebSocket mà web không phải đổi gì.
    this.auto!.on('log', (line: string) => {
      if (this.isCurrent(client, epoch)) this.pushLog(line);
    });
    this.auto!.on('cycle-complete', () => {
      if (this.isCurrent(client, epoch)) this.onAutoCycleComplete(epoch);
    });
    this.macros!.on('state', (s: MacroState) => {
      if (this.isCurrent(client, epoch)) this.emit('macro', s);
    });
  }

  private onOnline(client: GameClient, epoch: number): void {
    if (!this.isCurrent(client, epoch) || this.onlineEpoch === epoch) return;
    this.onlineEpoch = epoch;
    this.cancelRetry();
    this.retries = 0;
    this.retryAfter = undefined;
    this.cancelAutoSyncKickoff();
    // Mỗi LOGIN_SUCESS mở một vòng automation mới: dọn log vòng trước TRƯỚC
    // khi ghi log điểm danh, để log điểm danh và toàn bộ vòng mới cùng tồn tại.
    // Vòng không logout vẫn được dọn ở tryStartAuto().
    if (this.desiredMode === 'auto_farm') this.clearLogs();
    if (!this.findNpcOwnsOrTargetsContext()) {
      this.autoSyncKickoff = setImmediate(() => {
        this.autoSyncKickoff = undefined;
        if (this.findNpcOwnsOrTargetsContext()) return;
        const sync = this.syncFarmAfterOnline(client, epoch);
        this.farmSyncPromise = sync;
        void sync.finally(() => {
          if (this.farmSyncPromise === sync) this.farmSyncPromise = undefined;
        });
      });
    }
    // Khởi động điểm danh bất kể có transition đang pending hay không. Khi user
    // bật auto, switchAutomationMode đang chờ connect nên pending > 0 chính là
    // ca phổ biến nhất; bỏ qua ở đây sẽ khiến auto đi thẳng vào farm.
    this.ensureDailyAttendance(client, epoch);
    if (this.pendingAutomationTransitions === 0) {
      void this.attendancePromise!.finally(() => {
        if (
          this.isCurrent(client, epoch)
          && client.status === 'online'
          && this.pendingAutomationTransitions === 0
        ) {
          void this.resumeDesiredAutomation(client, epoch);
        }
      });
    }
  }

  /** Khởi động đúng một request cho mỗi epoch; mọi caller await cùng Promise. */
  private ensureDailyAttendance(client: GameClient, epoch: number): void {
    if (this.attendanceEpoch === epoch && this.attendancePromise) return;
    this.attendanceEpoch = epoch;
    this.pushLog('[điểm danh] đang gửi yêu cầu báo danh…');
    this.attendancePromise = this.runDailyAttendanceBeforeAutomation(client, epoch);
  }

  /**
   * Gửi yêu cầu báo danh đúng một lần cho mỗi connection epoch và ghi log kết
   * quả. Không bao giờ throw: điểm danh không được chặn auto farm.
   */
  private async runDailyAttendanceBeforeAutomation(
    client: GameClient,
    epoch: number,
  ): Promise<void> {
    let result;
    try {
      result = await client.claimDailyAttendance();
    } catch (err) {
      if (this.isCurrent(client, epoch)) {
        this.pushLog(`[điểm danh] lỗi: ${(err as Error).message} — vẫn tiếp tục tự động`);
      }
      return;
    }
    if (!this.isCurrent(client, epoch)) return;
    switch (result.status) {
      case 'claimed':
        // rewardSummary là chính text dialog server — đã là mô tả phần quà.
        this.pushLog(`[điểm danh] nhận thưởng thành công${result.rewardSummary ? `: ${result.rewardSummary}` : ''}`);
        break;
      case 'already-claimed':
        this.pushLog('[điểm danh] hôm nay đã nhận thưởng');
        break;
      case 'rejected':
        this.pushLog(`[điểm danh] server từ chối${result.reason ? `: ${result.reason}` : ''} — vẫn tiếp tục tự động`);
        break;
      case 'timeout':
        this.pushLog('[điểm danh] hết thời gian chờ — vẫn tiếp tục tự động');
        break;
    }
  }

  private resumeDesiredAutomation(
    client: GameClient,
    epoch: number,
  ): Promise<AutomationStartOutcome> {
    const transitionSequence = ++this.automationTransitionSequence;
    const generation = this.automationGeneration;
    const run = async (): Promise<AutomationStartOutcome> => {
      if (
        transitionSequence <= this.cancelledAutomationTransitionSequence
        || !this.isAutomationGenerationCurrent(generation)
        || !this.isCurrent(client, epoch)
        || client.status !== 'online'
      ) return 'connect-pending';
      if (this.activeMode !== 'off' || this.desiredMode === 'off') return 'active';

      this.transitionState = 'switching';
      this.emitAutomation();
      if (
        !this.isAutomationGenerationCurrent(generation)
        || !this.isCurrent(client, epoch)
      ) return 'connect-pending';
      try {
        if (!(await this.startDesiredAutomation(client, generation, epoch))) {
          return 'connect-pending';
        }
        if (
          !this.isAutomationGenerationCurrent(generation)
          || !this.isCurrent(client, epoch)
          || client.status !== 'online'
        ) return 'connect-pending';
        this.transitionState = 'stable';
        this.emitAutomation();
        return 'active';
      } catch (error) {
        if (
          !this.isAutomationGenerationCurrent(generation)
          || !this.isCurrent(client, epoch)
        ) return 'connect-pending';
        if (
          !(error instanceof AutomationInitializationError)
          && client.status !== 'online'
        ) {
          this.activeMode = 'off';
          this.emitAutomation();
          return 'connect-pending';
        }
        if (!(await this.stopActiveAutomation(generation))) return 'connect-pending';
        this.setWanted(false);
        this.desiredMode = 'off';
        this.transitionState = 'stable';
        this.emitAutomation();
        return 'start-failed';
      }
    };
    return this.enqueueAutomationTransition(run);
  }

  private enqueueAutomationTransition(
    run: () => Promise<AutomationStartOutcome>,
  ): Promise<AutomationStartOutcome> {
    this.pendingAutomationTransitions += 1;
    const next = this.automationTransition.then(run, run);
    const stabilized = next.catch((error: unknown) => {
      if (this.transitionState === 'switching') {
        this.transitionState = 'stable';
        this.emitAutomation();
      }
      throw error;
    });
    const settled = stabilized.finally(() => {
      this.pendingAutomationTransitions -= 1;
    });
    this.automationTransition = settled.catch(() => 'start-failed');
    return settled;
  }

  private isAutomationGenerationCurrent(generation: number): boolean {
    return this.automationGeneration === generation;
  }

  private invalidateAutomationTransitions(): void {
    this.automationGeneration += 1;
    this.cancelledAutomationTransitionSequence = this.automationTransitionSequence;
    this.transitionState = 'stable';
    for (const invalidate of [...this.initialConnectionWaiters]) invalidate();
  }

  private beginAutomationConnection(
    generation: number,
  ): { generation: number; completion: Promise<'online' | 'pending' | 'permanent' | 'stale'> } | undefined {
    if (!this.isAutomationGenerationCurrent(generation)) return undefined;
    this.setWanted(true);
    if (!this.isAutomationGenerationCurrent(generation) || !this.wanted) return undefined;
    this.permanentlyFailed = false;
    if (this.client?.status === 'online') {
      return { generation, completion: Promise.resolve('online') };
    }
    if (this.client) {
      this.cancelRetry();
      const beforeTeardown = this.automationGeneration;
      this.teardown();
      if (
        this.automationGeneration !== beforeTeardown + 1
        || !this.wanted
      ) return undefined;
      generation = this.automationGeneration;
      this.transitionState = 'switching';
    }
    return {
      generation,
      completion: this.connect(generation).then(() => this.waitForInitialAutomationOutcome(generation)),
    };
  }

  private waitForInitialAutomationOutcome(
    generation: number,
  ): Promise<'online' | 'pending' | 'permanent' | 'stale'> {
    if (!this.isAutomationGenerationCurrent(generation)) return Promise.resolve('stale');
    if (this.permanentlyFailed) return Promise.resolve('permanent');
    const client = this.client;
    const epoch = this.connectionEpoch;
    if (!client) return Promise.resolve('pending');
    if (client.status === 'online') return Promise.resolve('online');
    if (client.status === 'idle' || client.status === 'error') return Promise.resolve('pending');

    return new Promise((resolve) => {
      let timeout: NodeJS.Timeout | undefined;
      let settled = false;
      const cleanup = (): void => {
        if (timeout) this.clearTimeoutFn(timeout);
        this.initialConnectionWaiters.delete(onInvalidated);
        client.removeListener('status', onStatus);
        client.removeListener('message', onMessage);
        client.removeListener('temporary-rejection', onTemporaryRejection);
      };
      const finish = (outcome: 'online' | 'pending' | 'permanent' | 'stale'): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(outcome);
      };
      const currentOutcome = (): 'permanent' | 'stale' | undefined => {
        if (this.permanentlyFailed) return 'permanent';
        if (
          !this.wanted
          || !this.isAutomationGenerationCurrent(generation)
          || !this.isCurrent(client, epoch)
        ) return 'stale';
        return undefined;
      };
      const onInvalidated = (): void => finish(currentOutcome() ?? 'stale');
      const onStatus = (status: ClientStatus): void => {
        const terminal = currentOutcome();
        if (terminal) return finish(terminal);
        if (status === 'online') finish('online');
        else if (status === 'idle' || status === 'error') finish('pending');
      };
      const onMessage = (message: { command?: number }): void => {
        if (message.command === -35) finish('permanent');
      };
      const onTemporaryRejection = (): void => finish('pending');

      client.on('status', onStatus);
      client.on('message', onMessage);
      client.on('temporary-rejection', onTemporaryRejection);
      this.initialConnectionWaiters.add(onInvalidated);
      timeout = this.setTimeoutFn(() => finish(currentOutcome() ?? 'pending'), AUTOMATION_INITIAL_OUTCOME_TIMEOUT_MS);
      timeout.unref?.();
    });
  }

  private cancelAutoSyncKickoff(): void {
    if (!this.autoSyncKickoff) return;
    clearImmediate(this.autoSyncKickoff);
    this.autoSyncKickoff = undefined;
  }

  private async syncFarmAfterOnline(client: GameClient, epoch: number): Promise<void> {
    const startedAt = this.now();
    this.farmSync = { status: 'syncing', startedAt };
    this.emit('farm-sync', this.farmSync);
    try {
      await this.refreshFarmProfile(10_000, true);
      if (!this.isCurrent(client, epoch) || client.status !== 'online') return;
      this.farmSync = {
        status: 'success',
        startedAt,
        completedAt: this.now(),
      };
      this.emit('farm-sync', this.farmSync);
      this.pushLog('đã tự động đồng bộ dữ liệu nông trại');
    } catch (err) {
      if (!this.isCurrent(client, epoch) || client.status !== 'online') return;
      const message = err instanceof Error ? err.message : String(err);
      this.farmSync = {
        status: 'error',
        startedAt,
        completedAt: this.now(),
        error: message,
      };
      this.emit('farm-sync', this.farmSync);
      this.pushLog("tự động đồng bộ farm lỗi: " + message);
    }
  }

  private async stopActiveAutomation(generation: number): Promise<boolean> {
    this.cancelAutoCycleTimer();
    await this.auto?.stop();
    const finder = this.findNpc;
    this.findNpc = undefined;
    if (finder) await finder.stop();
    if (this.fishingAbortController) {
      this.fishingAbortController.abort();
      this.fishingAbortController = undefined;
    }
    if (this.activeMode === 'auto_fishing') {
      if (this.client && this.client.status === 'online') {
        try {
          this.client.cauCaXong();
        } catch {
          /* bỏ qua */
        }
      }
      this.pushLog('[câu cá] đã dừng tự động câu cá.');
    }
    this.fishingRuntime.status = 'idle';
    if (!this.isAutomationGenerationCurrent(generation)) return false;
    this.activeMode = 'off';
    this.findNpcRuntime = idleFindNpcRuntime(this.findNpcConfig.config.npcName);
    return true;
  }

  private async startFindNpc(client: GameClient, generation: number, epoch: number): Promise<boolean> {
    const targetName = this.findNpcConfig.config.npcName;
    const catalog = this.opts.findNpcCatalog ?? [];
    if (!targetName) {
      throw new AutomationInitializationError('find-npc-name-required', 'tên NPC trống');
    }
    if (catalog.length === 0) {
      throw new AutomationInitializationError('catalog-unverified', 'catalog NPC chưa verified');
    }

    const farmSync = this.farmSyncPromise;
    if (farmSync) await farmSync;
    if (
      !this.isAutomationGenerationCurrent(generation)
      || !this.isCurrent(client, epoch)
      || client.status !== 'online'
    ) return false;

    this.automationLocation = null;
    this.opts.onAutomationLocation(null);
    if (
      !this.isAutomationGenerationCurrent(generation)
      || !this.isCurrent(client, epoch)
      || client.status !== 'online'
    ) return false;
    let finder!: AutoFindNpc;
    const runnerOptions: AutoFindNpcOptions = {
      client,
      catalog,
      targetName,
      onState: (state) => {
        if (this.findNpc !== finder) return;
        this.findNpcRuntime = state;
        this.emitAutomation();
      },
      onFound: (location) => {
        if (this.findNpc !== finder) return;
        this.automationLocation = location;
        this.opts.onAutomationLocation({ map: location.map, area: location.area });
        this.emitAutomation();
      },
      onMissing: () => {
        if (this.findNpc !== finder) return;
        this.automationLocation = null;
        this.opts.onAutomationLocation(null);
        this.emitAutomation();
      },
      onTerminalFailure: (error) => {
        if (
          this.findNpc !== finder
          || !this.isAutomationGenerationCurrent(generation)
          || !this.isCurrent(client, epoch)
        ) return;
        this.findNpc = undefined;
        this.findNpcRuntime = finder.state();
        this.activeMode = 'off';
        this.desiredMode = 'off';
        this.transitionState = 'stable';
        this.automationLocation = null;
        this.emitAutomation();
        this.pushLog(`Find NPC đã dừng do lỗi: ${error.message}`);
        try {
          this.opts.onAutomationLocation(null);
        } catch {
          /* tiếp tục persist mode off ngay cả khi xóa location lỗi */
        }
        try {
          this.opts.onAutomationFailure?.(error.message);
        } catch {
          /* callback persistence không được tạo unhandled rejection */
        }
      },
      now: this.now,
      setTimeoutFn: this.setTimeoutFn,
      clearTimeoutFn: this.clearTimeoutFn,
    };
    finder = this.opts.createAutoFindNpc
      ? this.opts.createAutoFindNpc(runnerOptions)
      : new AutoFindNpc(runnerOptions);
    this.findNpc = finder;
    finder.start();
    if (
      !this.isAutomationGenerationCurrent(generation)
      || !this.isCurrent(client, epoch)
      || client.status !== 'online'
      || this.findNpc !== finder
    ) {
      if (this.findNpc === finder) this.findNpc = undefined;
      void finder.stop();
      return false;
    }
    if (!finder.state().running) {
      throw new AutomationInitializationError(
        'find-npc-init-failed',
        finder.state().lastError ?? 'runner Find NPC không khởi động',
      );
    }
    this.findNpcRuntime = finder.state();
    return true;
  }

  private async startDesiredAutomation(
    client: GameClient,
    generation: number,
    epoch: number,
  ): Promise<boolean> {
    if (this.desiredMode === 'auto_farm') {
      this.shop?.assertIdleForAutomation();
      if (
        !this.isAutomationGenerationCurrent(generation)
        || !this.isCurrent(client, epoch)
        || client.status !== 'online'
      ) return false;
      // Mọi đường start (onOnline tự resume lẫn switchAutomationMode đang
      // pending trong lúc connect) đều phải chờ cùng attendance Promise.
      this.ensureDailyAttendance(client, epoch);
      await this.attendancePromise;
      if (
        !this.isAutomationGenerationCurrent(generation)
        || !this.isCurrent(client, epoch)
        || client.status !== 'online'
      ) return false;
      // KHÔNG clearLogs ở đây: xoá bây giờ sẽ làm mất dòng [điểm danh] vừa ghi.
      this.auto!.start(this.lastAutoConfig);
      if (
        !this.isAutomationGenerationCurrent(generation)
        || !this.isCurrent(client, epoch)
        || client.status !== 'online'
      ) return false;
      this.activeMode = 'auto_farm';
      return true;
    }
    if (this.desiredMode === 'auto_fishing') {
      if (
        !this.isAutomationGenerationCurrent(generation)
        || !this.isCurrent(client, epoch)
        || client.status !== 'online'
      ) return false;
      this.ensureDailyAttendance(client, epoch);
      await this.attendancePromise;
      if (
        !this.isAutomationGenerationCurrent(generation)
        || !this.isCurrent(client, epoch)
        || client.status !== 'online'
      ) return false;
      this.activeMode = 'auto_fishing';
      this.startFishingLoop(client, generation, epoch);
      return true;
    }
    if (this.desiredMode === 'find_npc') {
      if (!(await this.startFindNpc(client, generation, epoch))) return false;
      this.activeMode = 'find_npc';
      return true;
    }
    return true;
  }

  private tryStartAuto(): void {
    if (this.desiredMode !== 'auto_farm') return;
    try {
      this.shop?.assertIdleForAutomation();
      this.clearLogs();
      this.auto!.start(this.lastAutoConfig);
    } catch (err) {
      this.pushLog(`không bật được tự động: ${(err as Error).message}`);
    }
  }

  private updateCachedMetrics(patch: AccountMetricsPatch): void {
    const valid = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)),
    ) as AccountMetricsPatch;
    if (Object.keys(valid).length === 0) return;
    this.cachedMetrics = { ...this.cachedMetrics, ...valid, syncedAt: this.now() };
    this.opts.onMetrics?.(valid);
    this.emit('metrics', this.cachedMetrics);
  }

  private onAutoCycleComplete(epoch: number): void {
    if (
      epoch !== this.connectionEpoch
      || this.desiredMode !== 'auto_farm'
      || this.status !== 'online'
    ) return;
    const rawInterval = this.lastAutoConfig.intervalMs;
    const intervalMs = typeof rawInterval === 'number' && Number.isFinite(rawInterval)
      ? Math.max(0, rawInterval)
      : DEFAULT_AUTO_INTERVAL_MS;
    const shouldLogout = this.lastAutoConfig.logoutAfterCycle ?? true;

    void this.auto?.stop();
    if (shouldLogout) {
      this.scheduleAutoCycle(intervalMs);
      this.cancelAutoSyncKickoff();
      // Phải reset activeMode về 'off' trước teardown, tương tự onDisconnected:
      // nếu giữ 'auto_farm', lần đăng nhập lại ở vòng kế sẽ bị resumeDesiredAutomation
      // chặn tại điều kiện `activeMode !== 'off'` và không bao giờ khởi động lại auto.
      this.activeMode = 'off';
      this.emitAutomation();
      this.teardown();
      this.emit('status', 'idle');
    } else {
      this.scheduleOnlineAutoCycle(intervalMs);
    }
  }

  private scheduleOnlineAutoCycle(delayMs: number): void {
    this.cancelAutoCycleTimer();
    this.autoCycleTimer = this.setTimeoutFn(() => {
      this.autoCycleTimer = undefined;
      if (this.desiredMode !== 'auto_farm' || this.permanentlyFailed) return;
      if (this.status === 'online') {
        this.tryStartAuto();
      } else {
        this.pushLog('phiên bị ngắt trong lúc chờ, đang kết nối lại cho vòng kế tiếp...');
        void this.start().catch((err: Error) => {
          this.pushLog('kết nối lại cho vòng auto kế tiếp lỗi: ' + err.message);
          this.scheduleRetry(this.connectionEpoch);
        });
      }
    }, delayMs);
  }

  private scheduleAutoCycle(delayMs: number): void {
    this.cancelAutoCycleTimer();
    this.autoCycleTimer = this.setTimeoutFn(() => {
      this.autoCycleTimer = undefined;
      if (this.desiredMode !== 'auto_farm' || this.permanentlyFailed) return;
      const keepAuto = this.desiredMode === 'auto_farm';
      this.autoStartEpoch = undefined;
      void this.start().then(() => {
        if (!keepAuto || this.permanentlyFailed) return;
        this.desiredMode = 'auto_farm';
        if (this.status === 'online' && this.autoStartEpoch !== this.connectionEpoch) {
          this.tryStartAuto();
        }
      }).catch((err: Error) => {
        this.pushLog('đăng nhập cho vòng auto kế tiếp lỗi: ' + err.message);
        this.scheduleRetry(this.connectionEpoch);
      });
    }, delayMs);
  }

  private cancelAutoCycleTimer(): void {
    if (this.autoCycleTimer) this.clearTimeoutFn(this.autoCycleTimer);
    this.autoCycleTimer = undefined;
  }

  private failPermanently(reason: string): void {
    this.permanentlyFailed = true;
    this.invalidateAutomationTransitions();
    this.setWanted(false);
    this.desiredMode = 'off';
    this.activeMode = 'off';
    this.transitionState = 'stable';
    this.cancelRetry();
    this.cancelAutoCycleTimer();
    void this.auto?.stop();
    const finder = this.findNpc;
    this.findNpc = undefined;
    if (finder) void finder.stop();
    this.findNpcRuntime = idleFindNpcRuntime(this.findNpcConfig.config.npcName);
    this.emitAutomation();
    this.pushLog(reason);
    try {
      this.opts.onPermanentFailure(reason);
    } catch {
      /* bỏ qua */
    }
  }

  private onDisconnected(epoch: number): void {
    this.cancelAutoSyncKickoff();
    this.detachShop('Phiên game đã ngắt kết nối');
    void this.auto?.stop();
    const finder = this.findNpc;
    this.findNpc = undefined;
    if (finder) void finder.stop();
    this.activeMode = 'off';
    this.findNpcRuntime = idleFindNpcRuntime(this.findNpcConfig.config.npcName);
    this.emitAutomation();
    this.macros?.stop();
    if (!this.wanted || this.permanentlyFailed || epoch !== this.connectionEpoch) return;

    const rejection = this.retryAfter?.epoch === epoch ? this.retryAfter : undefined;
    if (this.desiredMode === 'auto_farm' && rejection) {
      const rawInterval = this.lastAutoConfig.intervalMs;
      const intervalMs = typeof rawInterval === 'number' && Number.isFinite(rawInterval)
        ? Math.max(0, rawInterval)
        : DEFAULT_AUTO_INTERVAL_MS;
      const waitMs = Math.max(intervalMs, Math.max(0, rejection.notBefore - this.now()));
      this.scheduleAutoCycle(waitMs);
      this.pushLog(
        `bỏ qua vòng auto hiện tại vì lỗi đăng nhập tạm thời; đặt lịch vòng mới sau ${Math.round(waitMs / 1000)}s`,
      );
      return;
    }

    if (this.autoCycleTimer) return;
    this.scheduleRetry(epoch);
  }

  private scheduleRetry(epoch: number): void {
    if (this.retryTimer || epoch !== this.connectionEpoch) return;
    // 10s, 20s, 40s, 80s… trần 5 phút; jitter ±20% để nhiều phiên rớt cùng lúc
    // không đồng loạt gõ lại server game.
    const base = Math.min(RETRY_BASE_MS * 2 ** this.retries, RETRY_MAX_MS);
    const jittered = Math.round(base * (0.8 + 0.4 * this.random()));
    const serverDelay =
      this.retryAfter?.epoch === epoch
        ? Math.max(0, this.retryAfter.notBefore - this.now())
        : 0;
    const delay = Math.max(jittered, serverDelay);
    this.retries += 1;
    this.nextRetryAt = this.now() + delay;
    this.pushLog(`thử kết nối lại sau ${Math.round(delay / 1000)}s (lần ${this.retries})`);

    this.retryTimer = this.setTimeoutFn(() => {
      this.retryTimer = undefined;
      this.nextRetryAt = undefined;
      if (!this.wanted || this.permanentlyFailed || epoch !== this.connectionEpoch) return;
      this.teardown();
      void this.connect().catch((err: Error) => {
        this.pushLog(`thử lại lỗi: ${err.message}`);
        this.scheduleRetry(this.connectionEpoch);
      });
    }, delay);
  }

  private cancelRetry(): void {
    if (this.retryTimer) this.clearTimeoutFn(this.retryTimer);
    this.retryTimer = undefined;
    this.nextRetryAt = undefined;
  }

  private teardown(): void {
    this.fishingChallengeGeneration += 1;
    this.invalidateAutomationTransitions();
    this.cancelAutoSyncKickoff();
    this.detachShop('Phiên game đã teardown');
    this.connectionEpoch += 1;
    void this.auto?.stop();
    const finder = this.findNpc;
    this.findNpc = undefined;
    if (finder) void finder.stop();
    if (this.fishingAbortController) {
      this.fishingAbortController.abort();
      this.fishingAbortController = undefined;
    }
    this.fishingRuntime.status = 'idle';
    this.findNpcRuntime = idleFindNpcRuntime(this.findNpcConfig.config.npcName);
    this.macros?.stop();
    const client = this.client;
    this.client = undefined;
    this.auto = undefined;
    this.macros = undefined;
    if (!client) return;
    client.removeAllListeners();
    try {
      client.logout();
    } catch {
      /* bỏ qua */
    }
  }

  private startFishingLoop(client: GameClient, generation: number, epoch: number): void {
    if (this.fishingAbortController) {
      this.fishingAbortController.abort();
    }
    const abort = new AbortController();
    this.fishingAbortController = abort;

    void (async () => {
      try {
        await this.runFishingLoop(client, generation, epoch, abort.signal);
      } catch (err) {
        if (!abort.signal.aborted && this.isAutomationGenerationCurrent(generation)) {
          this.pushLog(`[câu cá] lỗi vòng lặp: ${(err as Error).message}`);
        }
      } finally {
        if (this.fishingAbortController === abort) {
          this.fishingAbortController = undefined;
        }
      }
    })();
  }

  private async runFishingLoop(
    client: GameClient,
    generation: number,
    epoch: number,
    signal: AbortSignal,
  ): Promise<void> {
    const config = DEFAULT_FISHING_CONFIG;
    const map = config.map; // 14: Khu cá rô mặc định
    const area = config.area; // 0

    this.pushLog(`[câu cá] đang di chuyển vào map ${map} (khu vực ${area})…`);
    this.fishingRuntime.status = 'moving';
    this.fishingRuntime.currentMap = map;
    this.fishingRuntime.currentArea = area;
    this.emitAutomation();

    client.enterParkContext();
    await this.delayCancellable(1000, signal);

    if (signal.aborted || !this.isCurrent(client, epoch) || this.desiredMode !== 'auto_fishing') return;

    client.joinPark(map, area);
    await this.delayCancellable(2000, signal);

    if (signal.aborted || !this.isCurrent(client, epoch) || this.desiredMode !== 'auto_fishing') return;
    this.pushLog(`[câu cá] đã vào khu vực câu cá map ${map}`);

    try {
      this.fishingRuntime.status = 'starting';
      this.emitAutomation();

      const rx45Promise = new Promise<{ iss: boolean; error?: string }>((resolve) => {
        let settled = false;
        let timer: NodeJS.Timeout | undefined;
        const cleanup = () => {
          client.removeListener('fishing-start-result', onStartResult);
          signal.removeEventListener('abort', onAbort);
          if (timer) clearTimeout(timer);
        };
        const onStartResult = (res: { iss: boolean; error?: string }) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(res);
        };
        const onAbort = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve({ iss: false, error: 'bị hủy' });
        };
        client.on('fishing-start-result', onStartResult);
        signal.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve({ iss: false, error: 'hết giờ chờ bắt đầu câu' });
        }, 8000);
      });

      client.startFishing();
      const startResult = await rx45Promise;

      if (signal.aborted || this.desiredMode !== 'auto_fishing') return;

      if (!startResult.iss) {
        const reason = startResult.error ?? 'server từ chối bắt đầu câu';
        this.fishingRuntime.status = 'rejected';
        this.fishingRuntime.lastError = reason;
        this.pushLog(`[câu cá] server từ chối: ${reason}`);
        this.emitAutomation();
        return;
      }

      this.fishingRuntime.lastError = null;

      let catchesSinceBreak = 0;
      let nextBreakThreshold = randomBetween(
        FISHING_HUMAN_TIMING.MICRO_BREAK_INTERVAL_MIN_CATCHES,
        FISHING_HUMAN_TIMING.MICRO_BREAK_INTERVAL_MAX_CATCHES,
      );

      // Vòng lặp quăng cần liên tục (giữ nguyên vị trí ngồi câu, KHÔNG gọi cauCaXong giữa các lượt)
      while (
        !signal.aborted
        && this.isCurrent(client, epoch)
        && this.isAutomationGenerationCurrent(generation)
        && this.desiredMode === 'auto_fishing'
        && client.status === 'online'
      ) {
        this.fishingRuntime.status = 'casting';
        this.pushLog('[câu cá] đang quăng cần…');
        this.emitAutomation();

        client.quanCau();

        // Chờ cá cắn câu và câu thành công (hoặc timeout 35s)
        const catchPromise = new Promise<boolean>((resolve) => {
          let settled = false;
          let timer: NodeJS.Timeout | undefined;
          const cleanup = () => {
            client.removeListener('fishing-success-result', onSuccess);
            signal.removeEventListener('abort', onAbort);
            if (timer) clearTimeout(timer);
          };
          const onSuccess = (ev: { idUser: number; idFish: number }) => {
            // Bỏ qua kết quả của người chơi khác trong hồ!
            if (client.playerId === undefined || ev.idUser !== client.playerId) return;
            if (settled) return;
            settled = true;
            cleanup();
            resolve(ev.idFish >= 0);
          };
          const onAbort = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(false);
          };
          client.on('fishing-success-result', onSuccess);
          signal.addEventListener('abort', onAbort, { once: true });
          timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(false);
          }, 35000);
        });

        await catchPromise;

        if (signal.aborted || this.desiredMode !== 'auto_fishing') break;

        // Chờ mô phỏng animation kéo cá lên và người chơi xem phần thưởng cá
        const postCatchDelay = randomBetween(
          FISHING_HUMAN_TIMING.POST_CATCH_MIN_MS,
          FISHING_HUMAN_TIMING.POST_CATCH_MAX_MS,
        );
        await this.delayCancellable(postCatchDelay, signal);
        if (signal.aborted || this.desiredMode !== 'auto_fishing') break;

        // Bắt buộc gửi TX 44 (doCauCaXong) để server chốt kết quả và chuyển cá vào giỏ
        const donePromise = new Promise<void>((resolve) => {
          let settled = false;
          let timer: NodeJS.Timeout | undefined;
          const cleanup = () => {
            client.removeListener('fishing-done', onDone);
            signal.removeEventListener('abort', onAbort);
            if (timer) clearTimeout(timer);
          };
          const onDone = (ev: { idUser: number }) => {
            if (client.playerId === undefined || ev.idUser !== client.playerId) return;
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
          };
          const onAbort = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
          };
          client.on('fishing-done', onDone);
          signal.addEventListener('abort', onAbort, { once: true });
          timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
          }, 5000);
        });

        client.cauCaXong();
        await donePromise;

        if (signal.aborted || this.desiredMode !== 'auto_fishing') break;

        catchesSinceBreak++;
        if (catchesSinceBreak >= nextBreakThreshold) {
          const breakMs = randomBetween(
            FISHING_HUMAN_TIMING.MICRO_BREAK_MIN_MS,
            FISHING_HUMAN_TIMING.MICRO_BREAK_MAX_MS,
          );
          this.pushLog(`[câu cá] nghỉ tay ${(breakMs / 1000).toFixed(1)}s mô phỏng người chơi…`);
          this.fishingRuntime.status = 'resting';
          this.emitAutomation();
          await this.delayCancellable(breakMs, signal);
          catchesSinceBreak = 0;
          nextBreakThreshold = randomBetween(
            FISHING_HUMAN_TIMING.MICRO_BREAK_INTERVAL_MIN_CATCHES,
            FISHING_HUMAN_TIMING.MICRO_BREAK_INTERVAL_MAX_CATCHES,
          );
        }

        if (signal.aborted || this.desiredMode !== 'auto_fishing') break;

        // Nghỉ giữa các lượt câu trước khi quăng cần lượt mới (kèm jitter ngẫu nhiên)
        this.fishingRuntime.status = 'resting';
        this.emitAutomation();
        const restJitter = randomBetween(
          FISHING_HUMAN_TIMING.CAST_JITTER_MIN_MS,
          FISHING_HUMAN_TIMING.CAST_JITTER_MAX_MS,
        );
        await this.delayCancellable(config.castDelayMs + restJitter, signal);
      }
    } finally {
      if (this.isCurrent(client, epoch) && client.status === 'online') {
        try {
          client.cauCaXong();
        } catch {
          /* bỏ qua */
        }
      }
      this.fishingRuntime.status = 'idle';
      this.emitAutomation();
    }
  }

  private delayCancellable(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal.aborted) { resolve(); return; }
      let timer: NodeJS.Timeout | undefined;
      const onAbort = () => {
        if (timer) clearTimeout(timer);
        resolve();
      };
      signal.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
    });
  }

  private handleFishingChallenge(
    client: GameClient,
    epoch: number,
    payload: CanCauPayload,
  ): void {
    if (
      !this.isCurrent(client, epoch)
      || client.status !== 'online'
      || !this.wanted
      || this.desiredMode !== 'auto_fishing'
      || client.playerId === undefined
      || payload.idUser !== client.playerId
    ) {
      return;
    }

    this.fishingRuntime.status = 'hooked';
    this.emitAutomation();

    const domain = buildAnswerDomain(payload);
    if (!domain) {
      this.pushLog('fishing: challenge không hợp lệ hoặc vượt ngưỡng reference (suppressed_invalid_domain)');
      return;
    }

    const challengeGen = ++this.fishingChallengeGeneration;
    const autoGen = this.automationGeneration;

    const inferenceClient = this.fishingInferenceClient ??= new ProductionInferenceClient({
      endpoint: process.env.FISHING_INFERENCE_URL || 'http://127.0.0.1:8000/match',
      timeoutMs: Number(process.env.FISHING_INFERENCE_TIMEOUT_MS) || 5000,
    });

    void makeAutoDecision(payload, domain, (p) => inferenceClient.match(p))
      .then(async (decision) => {
        if (decision.status !== 'answer') {
          this.pushLog('fishing: không xác định được đáp án hợp lệ');
          return;
        }

        // Mô phỏng thời gian con người nhìn màn hình và bấm phím mũi tên
        const perception = randomBetween(
          FISHING_HUMAN_TIMING.PERCEPTION_MIN_MS,
          FISHING_HUMAN_TIMING.PERCEPTION_MAX_MS,
        );
        const perKey = randomBetween(
          FISHING_HUMAN_TIMING.PER_KEY_MIN_MS,
          FISHING_HUMAN_TIMING.PER_KEY_MAX_MS,
        );
        const totalSolvingDelay = perception + decision.answer.length * perKey;

        const abortSignal = this.fishingAbortController?.signal ?? new AbortController().signal;
        await this.delayCancellable(totalSolvingDelay, abortSignal);

        // Critical Pre-Send Gate (Strictly Synchronous, No Await after re-check)
        if (this.consumedFishingChallenges.has(challengeGen)) return;
        if (this.fishingChallengeGeneration !== challengeGen) return;
        if (this.automationGeneration !== autoGen) return;
        if (this.connectionEpoch !== epoch) return;
        if (this.client !== client) return;
        if (!this.isCurrent(client, epoch)) return;
        if (!this.wanted) return;
        if (this.desiredMode !== 'auto_fishing') return;
        if (client.status !== 'online') return;

        // Verify answer matches domain
        if (
          !Array.isArray(decision.answer)
          || decision.answer.length !== domain.queryCount
          || !decision.answer.every((val, idx) => domain.validValuesByQuery[idx]!.includes(val))
        ) {
          this.pushLog('fishing: answer vi phạm domain');
          return;
        }

        // Fail-closed environment kill switch checked immediately before send
        if (!isFishingAutoTx43Enabled()) {
          this.pushLog('fishing: TX43 bị chặn bởi FISHING_AUTO_TX43_ENABLED !== true');
          return;
        }

        // Mark consumed immediately before synchronous send
        this.consumedFishingChallenges.add(challengeGen);

        try {
          client.finishFishing(decision.answer);
          this.pushLog(`fishing: đã gửi TX43 (${decision.source}) sau ${(totalSolvingDelay / 1000).toFixed(2)}s`);
        } catch (sendErr) {
          this.pushLog(`fishing: gửi TX43 lỗi: ${(sendErr as Error).message}`);
        }
      })
      .catch((err) => {
        this.pushLog(`fishing: lỗi xử lý challenge: ${(err as Error).message}`);
      });
  }

  private detachShop(reason: string): void {
    if (!this.shop || !this.shopClientAttached) return;
    this.shopClientAttached = false;
    this.shop.detachClient(reason);
  }
}

function defensiveDisabledShopState(): ShopRuntimeState {
  return structuredClone(DISABLED_SHOP_STATE);
}
