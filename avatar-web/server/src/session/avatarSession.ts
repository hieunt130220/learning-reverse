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
  type ClientStatus,
  type DeviceProfile,
  type TemporaryLoginRejection,
  type TrafficEntry,
} from '../game/client.js';
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
  idleFindNpcRuntime,
  type AutomationLocation,
  type AutomationMode,
  type AutomationSnapshot,
  type AutomationStartOutcome,
  type AutoFindNpcState,
  type LoadedAutomationIntent,
  type NpcMapLocation,
} from './automationTypes.js';

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
  private autoSyncKickoff?: NodeJS.Immediate;
  private readonly shop?: ShopCoordinator;
  private shopClientAttached = false;

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
    const c = this.client;
    if (typeof c?.syncProgressQuests === 'function') {
      c.syncProgressQuests();
    }
    const daily = c?.dailyQuestState ?? null;
    const beginner = c?.beginnerQuestState ?? null;
    const farmer = c?.farmerQuestState ?? null;
    const upgradeRequirements = c?.farmUpgradeRequirements ?? null;
    const updatedAt = Math.max(
      daily?.updatedAt ?? 0,
      beginner?.updatedAt ?? 0,
      farmer?.updatedAt ?? 0,
    ) || Date.now();

    return {
      daily,
      beginner,
      farmer,
      upgradeRequirements,
      updatedAt,
    };
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
      location: this.automationLocation,
    };
  }

  snapshot(): AvatarSessionSnapshot {
    const c = this.client;
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
      farm: c?.farmState,
      cooking: c?.cookingState,
      foods: c?.foods ?? [],
      foodCatalogReady: c?.foodCatalogReady ?? false,
      quests: this.getQuestOverview(),
      farmSync: this.farmSync,
      auto: this.auto?.state() ?? EMPTY_AUTO,
      automation: this.automationSnapshot(),
      macro: this.macros?.state() ?? EMPTY_MACRO,
      shop: this.shopState(),
      produce: this.shopProduceState(),
      inventory: c?.inventory ?? [],
      farmProduce: c?.produce ?? [],
      cookingMaterials: c?.cookingMaterials ?? [],
      trees: c?.trees ?? [],
      items: c?.items ?? [],
      animals: c?.animals ?? [],
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
      if (this.isCurrent(client, epoch)) this.emit('farm', state);
    });
    client.on('inventory', (inv: unknown) => {
      if (this.isCurrent(client, epoch)) this.emit('inventory', inv);
    });
    client.on('produce', (produce: unknown) => {
      if (this.isCurrent(client, epoch)) this.emit('farm-produce', produce);
    });
    client.on('cooking-materials', (materials: unknown) => {
      if (this.isCurrent(client, epoch)) this.emit('cooking-materials', materials);
    });
    client.on('trees', (t: unknown) => {
      if (this.isCurrent(client, epoch)) this.emit('trees', t);
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
      if (this.isCurrent(client, epoch)) this.emit('cooking', cook);
    });
    client.on('quests', () => {
      if (this.isCurrent(client, epoch)) this.emit('quests', this.getQuestOverview());
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
    if (this.pendingAutomationTransitions === 0) {
      void this.resumeDesiredAutomation(client, epoch);
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
      this.auto!.start(this.lastAutoConfig);
      if (
        !this.isAutomationGenerationCurrent(generation)
        || !this.isCurrent(client, epoch)
        || client.status !== 'online'
      ) return false;
      this.activeMode = 'auto_farm';
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
    if (this.autoCycleTimer || !this.wanted || this.permanentlyFailed || epoch !== this.connectionEpoch) return;
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
    this.invalidateAutomationTransitions();
    this.cancelAutoSyncKickoff();
    this.detachShop('Phiên game đã teardown');
    this.connectionEpoch += 1;
    void this.auto?.stop();
    const finder = this.findNpc;
    this.findNpc = undefined;
    if (finder) void finder.stop();
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

  private detachShop(reason: string): void {
    if (!this.shop || !this.shopClientAttached) return;
    this.shopClientAttached = false;
    this.shop.detachClient(reason);
  }
}

function defensiveDisabledShopState(): ShopRuntimeState {
  return structuredClone(DISABLED_SHOP_STATE);
}
