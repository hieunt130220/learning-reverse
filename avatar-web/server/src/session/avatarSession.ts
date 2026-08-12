import { AutoFarm, type AutoFarmConfig, type AutoFarmState } from '../autoFarm.js';
import { GameClient, type ClientStatus, type DeviceProfile, type TrafficEntry } from '../game/client.js';
import { MacroRunner, type Macro, type MacroState } from '../macro.js';

export const RETRY_BASE_MS = 5_000;
export const RETRY_MAX_MS = 5 * 60 * 1000;
const LOG_BUFFER = 500;
const TRAFFIC_BUFFER = 100;

export interface AvatarCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
  device?: Partial<DeviceProfile>;
  /** Ý muốn của người dùng, đọc từ DB. */
  autoEnabled: boolean;
  autoConfig?: Partial<AutoFarmConfig>;
}

export interface LogLine {
  t: number;
  line: string;
}

export interface AvatarSessionSnapshot {
  accountId: number;
  status: ClientStatus;
  lastError?: string;
  playerId?: number;
  money?: number;
  farm?: unknown;
  auto: AutoFarmState;
  macro: MacroState;
  inventory: unknown[];
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
  createClient?: () => GameClient;
  createAutoFarm?: (client: GameClient) => AutoFarm;
  createMacroRunner?: (client: GameClient) => MacroRunner;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  random?: () => number;
}

const EMPTY_AUTO: AutoFarmState = { running: false, cycle: 0, lastActions: [] };
const EMPTY_MACRO: MacroState = { running: false, cycle: 0 };

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
  /** Đã nhận LOGIN_FAIL: không thử lại nữa dù rớt kết nối. */
  private permanentlyFailed = false;
  private lastAutoConfig: Partial<AutoFarmConfig> = {};
  private wantAuto = false;

  private readonly logs: LogLine[] = [];
  private readonly traffic: TrafficEntry[] = [];

  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;
  private readonly random: () => number;

  constructor(private readonly opts: AvatarSessionOptions) {
    this.setTimeoutFn = opts.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = opts.clearTimeoutFn ?? clearTimeout;
    this.random = opts.random ?? Math.random;
  }

  get status(): ClientStatus {
    return this.client?.status ?? 'idle';
  }

  get desiredConnected(): boolean {
    return this.wanted;
  }

  async start(): Promise<void> {
    this.wanted = true;
    this.permanentlyFailed = false;
    if (this.client) return;
    await this.connect();
  }

  stop(): void {
    this.wanted = false;
    this.cancelRetry();
    this.teardown();
    this.emit('status', 'idle');
  }

  startAuto(cfg: Partial<AutoFarmConfig>): void {
    this.requireClient();
    this.wantAuto = true;
    this.lastAutoConfig = cfg;
    this.auto!.start(cfg);
  }

  stopAuto(): void {
    this.wantAuto = false;
    this.auto?.stop();
  }

  startMacro(macro: Macro): void {
    this.requireClient();
    this.macros!.start(macro);
  }

  stopMacro(): void {
    this.macros?.stop();
  }

  callFarm(name: string, args: unknown[]): void {
    const client = this.requireClient();
    const fn = (client.farm as unknown as Record<string, unknown>)[name];
    if (typeof fn !== 'function') throw new Error(`không có action "${name}"`);
    (fn as (...a: unknown[]) => void).apply(client.farm, args);
  }

  sendRaw(cmd: number, fields: Array<{ t: string; v: string }>): void {
    this.requireClient().sendRaw(cmd, fields);
  }

  enterFarm(): void {
    this.requireClient().enterFarm();
  }

  lastPacketHex(cmd: number): string | undefined {
    return this.client?.lastPacket.get(cmd);
  }

  snapshot(): AvatarSessionSnapshot {
    const c = this.client;
    return {
      accountId: this.opts.accountId,
      status: c?.status ?? 'idle',
      lastError: c?.lastError,
      playerId: c?.playerId,
      money: c?.money,
      farm: c?.farmState,
      auto: this.auto?.state() ?? EMPTY_AUTO,
      macro: this.macros?.state() ?? EMPTY_MACRO,
      inventory: c?.inventory ?? [],
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

  /** Mọi lời gọi ra ngoài đều bọc: một WS đã đóng không được giết cả phiên. */
  private emit(type: string, payload: unknown): void {
    try {
      this.opts.onEvent(type, payload);
    } catch {
      /* bỏ qua */
    }
  }

  private pushLog(line: string): void {
    const entry = { t: Date.now(), line };
    this.logs.push(entry);
    if (this.logs.length > LOG_BUFFER) this.logs.shift();
    this.emit('log', entry);
  }

  private async connect(): Promise<void> {
    const creds = await this.opts.loadCredentials();
    this.wantAuto = creds.autoEnabled;
    this.lastAutoConfig = creds.autoConfig ?? {};

    const client = this.opts.createClient ? this.opts.createClient() : new GameClient();
    this.client = client;
    this.auto = this.opts.createAutoFarm ? this.opts.createAutoFarm(client) : new AutoFarm(client);
    this.macros = this.opts.createMacroRunner
      ? this.opts.createMacroRunner(client)
      : new MacroRunner(client);
    this.wire(client);

    try {
      await client.login({
        host: creds.host,
        port: creds.port,
        user: creds.user,
        pass: creds.pass,
        device: creds.device,
      });
    } catch (err) {
      this.pushLog(`kết nối lỗi: ${(err as Error).message}`);
      this.scheduleRetry();
      return;
    }

    this.retries = 0;
    this.nextRetryAt = undefined;
    if (this.wantAuto && client.status === 'online') this.tryStartAuto();
  }

  private wire(client: GameClient): void {
    // EventEmitter không có listener 'error' sẽ ném và giết cả process, kéo
    // theo mọi phiên khác. Đây là listener bắt buộc, không phải phòng xa.
    client.on('error', (err: Error) => this.pushLog(`lỗi client: ${err.message}`));

    client.on('status', (s: ClientStatus) => {
      this.emit('status', s);
      if (s === 'online' && this.wantAuto) this.tryStartAuto();
      if (s === 'idle' || s === 'error') this.onDisconnected();
    });

    client.on('log', (line: string) => this.pushLog(line));

    client.on('traffic', (entry: TrafficEntry) => {
      this.traffic.push(entry);
      if (this.traffic.length > TRAFFIC_BUFFER) this.traffic.shift();
      this.emit('traffic', entry);
    });

    client.on('farm', (state: unknown) => this.emit('farm', state));
    client.on('inventory', (inv: unknown) => this.emit('inventory', inv));
    client.on('trees', (t: unknown) => this.emit('trees', t));
    client.on('money', (m: unknown) => this.emit('money', m));

    client.on('message', (msg: { command: number }) => {
      // LOGIN_FAIL: sai mật khẩu hoặc tài khoản bị khoá. Thử lại là đường ngắn
      // nhất tới việc bị server game khoá thật — dừng hẳn, chờ người dùng sửa.
      if (msg.command === -35) this.failPermanently('đăng nhập thất bại — kiểm tra lại mật khẩu game');
    });

    this.auto!.on('state', (s: AutoFarmState) => this.emit('auto', s));
    this.macros!.on('state', (s: MacroState) => this.emit('macro', s));
  }

  private tryStartAuto(): void {
    try {
      this.auto!.start(this.lastAutoConfig);
    } catch (err) {
      this.pushLog(`không bật được tự động: ${(err as Error).message}`);
    }
  }

  private failPermanently(reason: string): void {
    this.permanentlyFailed = true;
    this.wanted = false;
    this.wantAuto = false;
    this.cancelRetry();
    this.pushLog(reason);
    try {
      this.opts.onPermanentFailure(reason);
    } catch {
      /* bỏ qua */
    }
  }

  private onDisconnected(): void {
    this.auto?.stop();
    this.macros?.stop();
    if (!this.wanted || this.permanentlyFailed) return;
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return;
    // 5s, 10s, 20s, 40s… trần 5 phút; jitter ±20% để nhiều phiên rớt cùng lúc
    // không đồng loạt gõ lại server game.
    const base = Math.min(RETRY_BASE_MS * 2 ** this.retries, RETRY_MAX_MS);
    const delay = Math.round(base * (0.8 + 0.4 * this.random()));
    this.retries += 1;
    this.nextRetryAt = Date.now() + delay;
    this.pushLog(`thử kết nối lại sau ${Math.round(delay / 1000)}s (lần ${this.retries})`);

    this.retryTimer = this.setTimeoutFn(() => {
      this.retryTimer = undefined;
      if (!this.wanted || this.permanentlyFailed) return;
      this.teardown();
      void this.connect().catch((err: Error) => {
        this.pushLog(`thử lại lỗi: ${err.message}`);
        this.scheduleRetry();
      });
    }, delay);
  }

  private cancelRetry(): void {
    if (this.retryTimer) this.clearTimeoutFn(this.retryTimer);
    this.retryTimer = undefined;
    this.nextRetryAt = undefined;
  }

  private teardown(): void {
    this.auto?.stop();
    this.macros?.stop();
    const client = this.client;
    this.client = undefined;
    this.auto = undefined;
    this.macros = undefined;
    if (!client) return;
    try {
      client.logout();
    } catch {
      /* bỏ qua */
    }
    client.removeAllListeners();
  }
}
