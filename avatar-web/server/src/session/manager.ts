import { getAccount, getAccountById, readGamePass, updateCachedMetrics } from '../accounts/repo.js';
import {
  listDesiredAutomation,
  offlineAutomationSnapshot,
  readAutomationState,
  saveFindNpcLocation,
  setDesiredMode,
} from '../accounts/automationRepo.js';
import { FishingStatisticsRepository } from '../accounts/fishingStatisticsRepo.js';
import { FishingMlStatisticsRepository } from '../accounts/fishingMlStatisticsRepo.js';
import { ShopRepository, type ProduceSnapshot, type ShopRuntimeState } from '../accounts/shopRepo.js';
import type { ShopPolicy } from '../config.js';
import { updateFarmCells } from '../accounts/farmProfileRepo.js';
import {
  readRuntimeSnapshotCache,
  saveRuntimeSnapshotCache,
} from '../accounts/runtimeSnapshotRepo.js';
import type { AutoFarmConfig } from '../autoFarm.js';
import type { Db } from '../db/index.js';
import type { DeviceProfile } from '../game/client.js';
import {
  AvatarSession,
  type AvatarCredentials,
  type AvatarSessionOptions,
  type AvatarSessionSnapshot,
} from './avatarSession.js';
import type {
  AutomationSnapshot,
  AutomationStartOutcome,
  LoadedAutomationIntent,
  NpcMapLocation,
  StoredFindNpcConfigState,
  StoredFishingConfigState,
  StoredMazeConfigState,
  StoredMiningConfigState,
  StoredSchoolConfigState,
} from './automationTypes.js';
import { FIND_NPC_DISABLED } from './featureFlags.js';
import { runtimeSnapshotPatchFromEvent } from './runtimeCache.js';
import { ShopCoordinator } from './shopCoordinator.js';
import type { CanCauPayload, InferenceResult } from '../fishing/autoDecision.js';

/** Giãn cách giữa các lần đăng nhập lúc khởi động. */
export const BOOTSTRAP_STAGGER_MS = 5_000;

export interface SessionManagerDeps {
  db: Db;
  masterKey: Buffer;
  maxSessions: number;
  broadcast(userId: number, accountId: number, type: string, payload: unknown): void;
  shopRepository?: ShopRepository;
  shopPolicy?: ShopPolicy;
  findNpcCatalog?: readonly NpcMapLocation[];
  fishingStatisticsRepository?: FishingStatisticsRepository;
  fishingMlStatisticsRepository?: FishingMlStatisticsRepository;
  onFishingInference?: (accountId: number, payload: CanCauPayload, result: InferenceResult) => void;
  createSession?(opts: AvatarSessionOptions): AvatarSession;
  setTimeoutFn?: typeof setTimeout;
}

export interface ShopView {
  shop: ShopRuntimeState;
  produce: ProduceSnapshot | null;
}

const DISABLED_SHOP_POLICY: ShopPolicy = {
  readEnabled: false,
  writeEnabled: false,
  purchaseEnabled: false,
  slotUnlockEnabled: false,
  marketRefreshEnabled: false,
  liveAccountAllowlist: new Set<number>(),
  protocolDebugEnabled: false,
};

interface FarmProfileEvent {
  idFarm: number;
  cells: Array<{ index: number }>;
  barnAnimalSlots?: number[];
  pondAnimalSlots?: number[];
  updatedAt?: number;
}

function farmProfileEvent(payload: unknown): FarmProfileEvent | null {
  if (typeof payload !== 'object' || payload === null || !('idFarm' in payload) || !('cells' in payload)) {
    return null;
  }
  const idFarm = payload.idFarm;
  const cells = payload.cells;
  const slotList = (key: string): number[] | undefined => {
    const value = (payload as Record<string, unknown>)[key];
    return Array.isArray(value)
      ? value.filter((item): item is number => typeof item === 'number' && Number.isInteger(item))
      : undefined;
  };
  const barnAnimalSlots = slotList('barnAnimalSlots');
  const pondAnimalSlots = slotList('pondAnimalSlots');
  const updatedAt = 'updatedAt' in payload ? payload.updatedAt : undefined;
  if (
    typeof idFarm !== 'number'
    || !Number.isInteger(idFarm)
    || !Array.isArray(cells)
    || cells.some((cell) => (
      typeof cell !== 'object'
      || cell === null
      || !('index' in cell)
      || typeof cell.index !== 'number'
      || !Number.isInteger(cell.index)
    ))
    || (updatedAt !== undefined && (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)))
  ) {
    return null;
  }
  return { idFarm, cells, barnAnimalSlots, pondAnimalSlots, updatedAt };
}

/**
 * Giữ mọi phiên đang sống trong process. Không có trạng thái nào của riêng nó
 * ngoài cái Map — nguồn sự thật vẫn là DB, nên restart rồi bootstrap lại là đủ.
 */
export class SessionManager {
  private readonly sessions = new Map<number, AvatarSession>();
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly shopRepository: ShopRepository;
  private readonly shopPolicy: ShopPolicy;
  private readonly fishingStatisticsRepository: FishingStatisticsRepository;
  private readonly fishingMlStatisticsRepository: FishingMlStatisticsRepository;

  constructor(private readonly deps: SessionManagerDeps) {
    this.setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
    this.shopRepository = deps.shopRepository ?? new ShopRepository(deps.db);
    this.shopPolicy = deps.shopPolicy ?? DISABLED_SHOP_POLICY;
    this.fishingStatisticsRepository = deps.fishingStatisticsRepository
      ?? new FishingStatisticsRepository(deps.db);
    this.fishingMlStatisticsRepository = deps.fishingMlStatisticsRepository
      ?? new FishingMlStatisticsRepository(deps.db);
    this.shopRepository.recoverInterruptedTransactions();
  }

  size(): number {
    return this.sessions.size;
  }

  peek(accountId: number): AvatarSession | undefined {
    return this.sessions.get(accountId);
  }

  require(accountId: number): AvatarSession {
    const s = this.sessions.get(accountId);
    if (!s) throw new Error('phiên chưa kết nối');
    return s;
  }

  snapshot(accountId: number): AvatarSessionSnapshot | null {
    const snapshot = this.sessions.get(accountId)?.snapshot();
    if (!snapshot) return null;
    return {
      ...snapshot,
      automation: {
        ...snapshot.automation,
        dailyFishingStatistics: this.fishingStatisticsRepository.readToday(accountId),
        mlFishingStatistics: this.fishingMlStatisticsRepository.read(accountId),
      },
    };
  }

  automationSnapshot(accountId: number): AutomationSnapshot {
    const persisted = readAutomationState(this.deps.db, accountId);
    const live = this.sessions.get(accountId)?.automationSnapshot();
    const dailyFishingStatistics = this.fishingStatisticsRepository.readToday(accountId);
    const mlFishingStatistics = this.fishingMlStatisticsRepository.read(accountId);
    return {
      ...(live ?? offlineAutomationSnapshot(persisted)),
      ...(live ? {
        findNpcConfig: persisted.findNpcConfig,
        fishingConfig: persisted.fishingConfig,
      } : {}),
      dailyFishingStatistics,
      mlFishingStatistics,
    };
  }

  hasVerifiedFindNpcCatalog(): boolean {
    return (this.deps.findNpcCatalog?.length ?? 0) > 0;
  }

  getShopView(userId: number, accountId: number): ShopView | null {
    if (!getAccount(this.deps.db, userId, accountId)) return null;
    const live = this.sessions.get(accountId);
    if (live) {
      return { shop: live.shopState(), produce: live.shopProduceState() };
    }
    const cached = new ShopCoordinator({
      accountId,
      repository: this.shopRepository,
      policy: this.shopPolicy,
      emit: () => undefined,
    });
    return { shop: cached.state(), produce: cached.produceState() };
  }

  async connect(accountId: number): Promise<void> {
    await this.getOrCreate(accountId).start();
  }

  async startAuto(accountId: number, cfg: Partial<AutoFarmConfig>): Promise<AutomationStartOutcome> {
    return await this.getOrCreate(accountId).startAuto(cfg);
  }

  async switchAutomationMode(
    accountId: number,
    intent: LoadedAutomationIntent,
  ): Promise<AutomationStartOutcome> {
    return this.getOrCreate(accountId).switchAutomationMode(intent);
  }

  updateFindNpcConfig(accountId: number, state: StoredFindNpcConfigState): void {
    this.sessions.get(accountId)?.setFindNpcConfig?.(state);
  }

  updateFishingConfig(accountId: number, state: StoredFishingConfigState): void {
    this.sessions.get(accountId)?.setFishingConfig?.(state);
  }

  updateMiningConfig(accountId: number, state: StoredMiningConfigState): void {
    this.sessions.get(accountId)?.setMiningConfig?.(state);
  }

  updateMazeConfig(accountId: number, state: StoredMazeConfigState): void {
    this.sessions.get(accountId)?.setMazeConfig?.(state);
  }

  updateSchoolConfig(accountId: number, state: StoredSchoolConfigState): void {
    this.sessions.get(accountId)?.setSchoolConfig?.(state);
  }

  async stopAutomation(accountId: number): Promise<void> {
    await this.sessions.get(accountId)?.stopAutomation();
  }

  disconnect(accountId: number): void {
    this.sessions.get(accountId)?.stop();
  }

  destroy(accountId: number): void {
    const s = this.sessions.get(accountId);
    if (!s) return;
    s.stop();
    this.sessions.delete(accountId);
  }

  stopAll(): void {
    for (const s of this.sessions.values()) s.stop();
    this.sessions.clear();
  }

  /**
   * Bật lại mọi tài khoản có automation intent, giãn cách vài giây một lần:
   * mở một loạt phiên cùng lúc từ cùng một IP là thứ dễ bị server game để ý nhất.
   */
  async bootstrap(): Promise<void> {
    const desired = listDesiredAutomation(this.deps.db);
    const entries = FIND_NPC_DISABLED
      ? desired.filter((entry) => entry.intent.desiredMode !== 'find_npc')
      : desired;
    if (entries.length !== desired.length) {
      const skippedIds = desired
        .filter((entry) => entry.intent.desiredMode === 'find_npc')
        .map((entry) => entry.accountId)
        .join(', #');
      console.warn(`bootstrap bỏ qua find_npc (tạm đóng): #${skippedIds}`);
    }
    if (entries.length === 0) return;

    const startAt = async (i: number): Promise<void> => {
      const entry = entries[i];
      try {
        const outcome = await this.switchAutomationMode(entry.accountId, entry.intent);
        if (outcome === 'start-failed') {
          setDesiredMode(this.deps.db, entry.accountId, 'off');
        }
      } catch (err) {
        // Một tài khoản hỏng (sai khoá, vượt trần) không được chặn phần còn lại.
        console.error(`bootstrap #${entry.accountId} lỗi: ${(err as Error).message}`);
      }
      if (i + 1 < entries.length) {
        this.setTimeoutFn(() => void startAt(i + 1), BOOTSTRAP_STAGGER_MS);
      }
    };

    await startAt(0);
  }

  private getOrCreate(accountId: number): AvatarSession {
    const existing = this.sessions.get(accountId);
    if (existing) return existing;

    const { db, masterKey, maxSessions, broadcast } = this.deps;
    const account = getAccountById(db, accountId);
    if (!account) throw new Error(`không có tài khoản #${accountId}`);
    if (this.sessions.size >= maxSessions) {
      throw new Error(`đã đạt tối đa ${maxSessions} phiên cùng lúc`);
    }
    const userId = account.userId;
    const initialDailyFishingStatistics = this.fishingStatisticsRepository.readToday(accountId);
    const initialMlFishingStatistics = this.fishingMlStatisticsRepository.read(accountId);

    const opts: AvatarSessionOptions = {
      accountId,
      shopRepository: this.shopRepository,
      shopPolicy: this.shopPolicy,
      findNpcCatalog: this.deps.findNpcCatalog ?? [],
      cachedMetrics: account.cachedMetrics,
      cachedSnapshot: readRuntimeSnapshotCache(db, accountId),
      initialDailyFishingStatistics,
      initialMlFishingStatistics,
      onFishingCatch: (fishId, caughtAt) => (
        this.fishingStatisticsRepository.recordCatch(accountId, fishId, caughtAt)
      ),
      onMlFishingResult: (isSuccess, updatedAt) => (
        this.fishingMlStatisticsRepository.recordResult(accountId, isSuccess, updatedAt)
      ),
      onFishingInference: (payload, result) => (
        this.deps.onFishingInference?.(accountId, payload, result)
      ),
      onMetrics: (patch) => updateCachedMetrics(db, accountId, patch),
      onAutomationLocation: (location) => saveFindNpcLocation(db, accountId, location),
      onDesiredModeChange: (mode) => {
        try {
          setDesiredMode(db, accountId, mode);
        } catch {
          /* bỏ qua lỗi persist */
        }
      },
      onAutomationFailure: () => {
        setDesiredMode(db, accountId, 'off');
        broadcast(userId, accountId, 'auto-disabled', { accountId });
      },
      // Đọc lại DB mỗi lần kết nối: mật khẩu hoặc cấu hình auto có thể đã đổi
      // giữa hai lần thử lại.
      loadCredentials: async (): Promise<AvatarCredentials> => {
        const row = getAccountById(db, accountId);
        if (!row) throw new Error(`không có tài khoản #${accountId}`);
        const automation = readAutomationState(db, accountId);
        return {
          host: row.host,
          port: row.port,
          user: row.gameUser,
          pass: readGamePass(db, masterKey, accountId),
          device: row.device as Partial<DeviceProfile> | undefined,
          autoEnabled: automation.desiredMode === 'auto_farm',
          autoConfig: row.autoConfig as Partial<AutoFarmConfig> | undefined,
          automation,
        };
      },
      onEvent: (type, payload) => {
        if (type === 'farm') {
          const farm = farmProfileEvent(payload);
          if (farm) {
            try {
              updateFarmCells(
                db,
                accountId,
                farm.idFarm,
                farm.cells.map((cell) => cell.index),
                farm.barnAnimalSlots ?? [],
                farm.pondAnimalSlots ?? [],
                farm.updatedAt,
              );
            } catch {
              return;
            }
          }
        }
        const cachePatch = runtimeSnapshotPatchFromEvent(type, payload);
        if (cachePatch) {
          saveRuntimeSnapshotCache(db, accountId, cachePatch);
        }
        broadcast(userId, accountId, type, payload);
      },
      onPermanentFailure: () => {
        // DB là ý muốn của người dùng. Sai mật khẩu game thì ý muốn "chạy 24/7"
        // phải bị gỡ, nếu không restart sau đó lại lao vào vòng đăng nhập sai.
        setDesiredMode(db, accountId, 'off');
        broadcast(userId, accountId, 'auto-disabled', { accountId });
      },
    };

    const session = this.deps.createSession
      ? this.deps.createSession(opts)
      : new AvatarSession(opts);
    this.sessions.set(accountId, session);
    return session;
  }
}
