import type { EnterWorldSnapshot } from './game/worldData.js';
import {
  type AutoFindNpcPhase,
  type AutoFindNpcState,
  type AutomationLocation,
  type NpcMapLocation,
} from './session/automationTypes.js';

/** Client hẹp runner được phép dùng — không đụng farm/shop/raw. */
export interface AutoFindNpcClient {
  enterParkContext(): void;
  joinPark(map: number, area: number): void;
  waitForWorldSnapshot(signal: AbortSignal, timeoutMs: number): Promise<EnterWorldSnapshot>;
}

export interface AutoFindNpcOptions {
  client: AutoFindNpcClient;
  catalog: readonly NpcMapLocation[];
  targetName: string;
  onState: (state: AutoFindNpcState) => void;
  /** Match thành công: persist location + chuyển tracking. */
  onFound: (location: AutomationLocation) => void;
  /** Hai miss hợp lệ liên tiếp: xóa location, quay scanning. */
  onMissing: () => void;
  /** Lỗi terminal (kể cả callback persist): owner phải rollback mode an toàn. */
  onTerminalFailure?: (error: Error) => void;
  now?: () => number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  /** Khoảng cách tối thiểu giữa hai join. */
  scanIntervalMs?: number;
  snapshotTimeoutMs?: number;
  endOfCatalogBackoffMs?: number;
  /** Khoảng cách tối thiểu giữa hai snapshot tracking. */
  trackingIntervalMs?: number;
}

const MIN_SCAN_INTERVAL_MS = 2_000;
const SNAPSHOT_TIMEOUT_MS = 5_000;
const END_OF_CATALOG_BACKOFF_MS = 30_000;
const TRACKING_INTERVAL_MS = 2_000;
const MAX_TIMEOUT_BACKOFF_MS = 60_000;
const TIMEOUT_STREAK_BASE_MS = 5_000;
const MAX_TIMEOUT_STREAK_FOR_BACKOFF_GROWTH = 5; // 5s,10s,20s,40s,60s -> cap 60s

/** Exact match: NFC + trim + lowercase vi, so TOÀN chuỗi. */
function normalizeNpcName(name: string): string {
  return name.normalize('NFC').trim().toLocaleLowerCase('vi');
}

export class AutoFindNpc {
  private phase: AutoFindNpcPhase = 'idle';
  private running = false;
  /** Tăng mỗi lần start; callback/continuation cũ phải bỏ cuộc khi lệch epoch. */
  private epoch = 0;
  private stopped = false;
  private settle?: () => void;
  private settled: Promise<void> = Promise.resolve();
  private cursor = 0;
  private timeoutStreak = 0;
  private backoffUntil?: number;
  private lastError?: string;
  private current?: NpcMapLocation;
  private probing?: NpcMapLocation;
  private missingCount = 0;
  private lastMissingObservedAt?: number;
  private lastJoinAt = 0;
  private abortController = new AbortController();
  private pendingTimer?: NodeJS.Timeout;

  private readonly now: () => number;
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;
  private readonly scanIntervalMs: number;
  private readonly snapshotTimeoutMs: number;
  private readonly endOfCatalogBackoffMs: number;
  private readonly trackingIntervalMs: number;

  constructor(private readonly opts: AutoFindNpcOptions) {
    this.now = opts.now ?? Date.now;
    this.setTimeoutFn = opts.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = opts.clearTimeoutFn ?? clearTimeout;
    this.scanIntervalMs = Math.max(MIN_SCAN_INTERVAL_MS, opts.scanIntervalMs ?? MIN_SCAN_INTERVAL_MS);
    this.snapshotTimeoutMs = opts.snapshotTimeoutMs ?? SNAPSHOT_TIMEOUT_MS;
    this.endOfCatalogBackoffMs = opts.endOfCatalogBackoffMs ?? END_OF_CATALOG_BACKOFF_MS;
    this.trackingIntervalMs = Math.max(
      TRACKING_INTERVAL_MS,
      opts.trackingIntervalMs ?? TRACKING_INTERVAL_MS,
    );
  }

  state(): AutoFindNpcState {
    return {
      phase: this.phase,
      running: this.running,
      targetName: this.opts.targetName,
      cursor: this.cursor,
      total: this.opts.catalog.length,
      ...(this.current ? { current: this.current } : {}),
      ...(this.probing ? { probing: this.probing } : {}),
      timeoutStreak: this.timeoutStreak,
      ...(this.backoffUntil !== undefined ? { backoffUntil: this.backoffUntil } : {}),
      ...(this.lastError !== undefined ? { lastError: this.lastError } : {}),
    };
  }

  start(): void {
    if (this.running || this.stopped) return;
    if (!normalizeNpcName(this.opts.targetName)) {
      this.lastError = 'tên NPC trống';
      this.emitState();
      return;
    }
    if (this.opts.catalog.length === 0) {
      this.lastError = 'catalog rỗng';
      this.emitState();
      return;
    }
    this.running = true;
    this.stopped = false;
    this.settled = new Promise<void>((resolve) => { this.settle = resolve; });
    this.cursor = 0;
    this.timeoutStreak = 0;
    this.backoffUntil = undefined;
    this.lastError = undefined;
    this.current = undefined;
    this.probing = undefined;
    this.missingCount = 0;
    this.lastMissingObservedAt = undefined;
    this.lastJoinAt = 0;
    this.abortController = new AbortController();
    const runEpoch = ++this.epoch;
    this.phase = 'scanning';
    this.emitState();
    // Xin context Park đúng MỘT lần trước vòng quét; mốc lastJoinAt buộc join
    // đầu tiên cách context-switch ít nhất một scanIntervalMs.
    try {
      this.opts.client.enterParkContext();
      this.lastJoinAt = this.now();
    } catch (error) {
      const failure = asError(error);
      this.lastError = failure.message;
      this.finish(runEpoch);
      this.notifyTerminalFailure(failure);
      throw failure;
    }
    void this.loop(runEpoch);
  }

  /** Idempotent; resolve sau khi mọi continuation cũ đã bỏ cuộc và phase = idle. */
  async stop(): Promise<void> {
    if (!this.running) return;
    if (this.stopped) {
      await this.settled;
      return;
    }
    this.stopped = true;
    this.phase = 'stopping';
    this.emitState();
    this.abortController.abort();
    if (this.pendingTimer) {
      this.clearTimeoutFn(this.pendingTimer);
      this.pendingTimer = undefined;
    }
    await this.settled;
  }

  // --- vòng quét -----------------------------------------------------------

  private async loop(runEpoch: number): Promise<void> {
    let failure: Error | undefined;
    try {
      while (!this.stopped && runEpoch === this.epoch) {
        const progressed = this.current
          ? await this.trackingStep(runEpoch)
          : await this.scanningStep(runEpoch);
        if (!progressed) break;
      }
    } catch (error) {
      if (!this.stopped && runEpoch === this.epoch) {
        failure = asError(error);
        this.lastError = failure.message;
      }
    } finally {
      this.finish(runEpoch);
    }
    if (failure) this.notifyTerminalFailure(failure);
  }

  /** true = tiếp tục vòng kế; false = dừng (stopped hoặc lệch epoch). */
  private async scanningStep(runEpoch: number): Promise<boolean> {
    const catalog = this.opts.catalog;
    if (this.backoffUntil !== undefined) {
      const remain = this.backoffUntil - this.now();
      if (remain > 0 && !(await this.delay(remain))) return false;
      this.backoffUntil = undefined;
      this.phase = 'scanning';
      this.emitState();
    }
    const target = catalog[this.cursor];
    const sinceLast = this.now() - this.lastJoinAt;
    if (this.lastJoinAt !== 0 && sinceLast < this.scanIntervalMs) {
      if (!(await this.delay(this.scanIntervalMs - sinceLast))) return false;
    }
    this.probing = target;
    this.emitState();
    let snap: EnterWorldSnapshot;
    try {
      // Gắn listener TRƯỚC khi gửi join để không bỏ lỡ -34 phản hồi tức thời.
      const pending = this.opts.client.waitForWorldSnapshot(
        this.abortController.signal,
        this.snapshotTimeoutMs,
      );
      this.opts.client.joinPark(target.map, target.area);
      this.lastJoinAt = this.now();
      snap = await pending;
    } catch (err) {
      this.probing = undefined;
      if (this.stopped || runEpoch !== this.epoch) return false;
      this.recordSnapshotFailure(asError(err));
      return true;
    }
    this.probing = undefined;
    if (this.stopped || runEpoch !== this.epoch) return false;

    this.timeoutStreak = 0;
    const wanted = normalizeNpcName(this.opts.targetName);
    const found = snap.specials.some((special) => normalizeNpcName(special.name) === wanted);
    if (found) {
      const location: AutomationLocation = { map: target.map, area: target.area, observedAt: this.now() };
      this.current = { map: target.map, area: target.area };
      this.missingCount = 0;
      this.lastMissingObservedAt = undefined;
      this.phase = 'tracking';
      this.emitState();
      this.opts.onFound(location);
      return true;
    }
    this.cursor = (this.cursor + 1) % catalog.length;
    if (this.cursor === 0) {
      this.backoffUntil = this.now() + this.endOfCatalogBackoffMs;
      this.phase = 'scan_backoff';
      this.emitState();
    }
    return true;
  }

  /** Tracking: đứng yên map/khu, refresh snapshot, 2 miss liên tiếp mới buông. */
  private async trackingStep(runEpoch: number): Promise<boolean> {
    const here = this.current;
    if (!here) return false;
    if (this.backoffUntil !== undefined) {
      const remain = this.backoffUntil - this.now();
      if (remain > 0 && !(await this.delay(remain))) return false;
      this.backoffUntil = undefined;
      this.phase = 'tracking';
      this.emitState();
    }
    const sinceLast = this.now() - this.lastJoinAt;
    if (sinceLast < this.trackingIntervalMs) {
      if (!(await this.delay(this.trackingIntervalMs - sinceLast))) return false;
    }
    let snap: EnterWorldSnapshot;
    try {
      const pending = this.opts.client.waitForWorldSnapshot(
        this.abortController.signal,
        this.snapshotTimeoutMs,
      );
      this.opts.client.joinPark(here.map, here.area);
      this.lastJoinAt = this.now();
      snap = await pending;
    } catch (error) {
      if (this.stopped || runEpoch !== this.epoch) return false;
      // Tracking mất snapshot/decode không phải miss hợp lệ; áp cùng backoff có trần.
      this.recordSnapshotFailure(asError(error));
      return true;
    }
    if (this.stopped || runEpoch !== this.epoch) return false;

    this.timeoutStreak = 0;
    this.backoffUntil = undefined;
    this.lastError = undefined;
    this.phase = 'tracking';
    this.emitState();
    const wanted = normalizeNpcName(this.opts.targetName);
    const stillThere = snap.specials.some((special) => normalizeNpcName(special.name) === wanted);
    if (stillThere) {
      this.missingCount = 0;
      this.lastMissingObservedAt = undefined;
      this.opts.onFound({ map: here.map, area: here.area, observedAt: this.now() });
      return true;
    }
    const observedAt = this.now();
    if (this.lastMissingObservedAt === undefined) {
      this.missingCount = 1;
      this.lastMissingObservedAt = observedAt;
    } else if (observedAt - this.lastMissingObservedAt >= this.trackingIntervalMs) {
      this.missingCount += 1;
    }
    if (this.missingCount >= 2) {
      const idx = this.opts.catalog.findIndex(
        (entry) => entry.map === here.map && entry.area === here.area,
      );
      this.cursor = idx >= 0 ? (idx + 1) % this.opts.catalog.length : 0;
      this.current = undefined;
      this.probing = undefined;
      this.missingCount = 0;
      this.lastMissingObservedAt = undefined;
      this.phase = 'scanning';
      this.emitState();
      this.opts.onMissing();
    }
    return true;
  }

  private finish(runEpoch: number): void {
    if (runEpoch !== this.epoch) return;
    this.running = false;
    this.phase = 'idle';
    if (this.pendingTimer) {
      this.clearTimeoutFn(this.pendingTimer);
      this.pendingTimer = undefined;
    }
    this.abortController.abort();
    this.emitState();
    const settle = this.settle;
    this.settle = undefined;
    settle?.();
  }

  private recordSnapshotFailure(error: Error): void {
    this.timeoutStreak += 1;
    const growth = Math.min(this.timeoutStreak, MAX_TIMEOUT_STREAK_FOR_BACKOFF_GROWTH);
    const backoff = Math.min(MAX_TIMEOUT_BACKOFF_MS, TIMEOUT_STREAK_BASE_MS * 2 ** (growth - 1));
    this.backoffUntil = this.now() + backoff;
    this.lastError = error.message;
    this.phase = 'scan_backoff';
    this.emitState();
  }

  private notifyTerminalFailure(error: Error): void {
    try {
      this.opts.onTerminalFailure?.(error);
    } catch {
      /* owner đã nhận terminal state; callback persistence không được tạo rejection */
    }
  }

  /** Delay có thể bị stop cắt ngang; resolve false nếu phải bỏ cuộc. */
  private delay(ms: number): Promise<boolean> {
    if (this.stopped) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      let done = false;
      const conclude = (value: boolean) => {
        if (done) return;
        done = true;
        if (this.pendingTimer) {
          this.clearTimeoutFn(this.pendingTimer);
          this.pendingTimer = undefined;
        }
        this.abortController.signal.removeEventListener('abort', onAbort);
        resolve(value);
      };
      const onAbort = () => conclude(false);
      this.pendingTimer = this.setTimeoutFn(() => conclude(true), ms);
      this.abortController.signal.addEventListener('abort', onAbort, { once: true });
      if (this.abortController.signal.aborted) conclude(false);
    });
  }

  private emitState(): void {
    try {
      this.opts.onState(this.state());
    } catch {
      /* callback của owner lỗi không được giết runner */
    }
  }
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
