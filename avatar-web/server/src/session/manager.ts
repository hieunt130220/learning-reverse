import { getAccountById, listAutoEnabled, readGamePass, setAutoEnabled } from '../accounts/repo.js';
import type { AutoFarmConfig } from '../autoFarm.js';
import type { Db } from '../db/index.js';
import type { DeviceProfile } from '../game/client.js';
import {
  AvatarSession,
  type AvatarCredentials,
  type AvatarSessionOptions,
  type AvatarSessionSnapshot,
} from './avatarSession.js';

/** Giãn cách giữa các lần đăng nhập lúc khởi động. */
export const BOOTSTRAP_STAGGER_MS = 5_000;

export interface SessionManagerDeps {
  db: Db;
  masterKey: Buffer;
  maxSessions: number;
  broadcast(userId: number, accountId: number, type: string, payload: unknown): void;
  createSession?(opts: AvatarSessionOptions): AvatarSession;
  setTimeoutFn?: typeof setTimeout;
}

/**
 * Giữ mọi phiên đang sống trong process. Không có trạng thái nào của riêng nó
 * ngoài cái Map — nguồn sự thật vẫn là DB, nên restart rồi bootstrap lại là đủ.
 */
export class SessionManager {
  private readonly sessions = new Map<number, AvatarSession>();
  private readonly setTimeoutFn: typeof setTimeout;

  constructor(private readonly deps: SessionManagerDeps) {
    this.setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
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
    return this.sessions.get(accountId)?.snapshot() ?? null;
  }

  async connect(accountId: number): Promise<void> {
    await this.getOrCreate(accountId).start();
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
   * Bật lại mọi tài khoản có `auto_enabled = 1`, giãn cách vài giây một lần:
   * mở một loạt phiên cùng lúc từ cùng một IP là thứ dễ bị server game để ý nhất.
   */
  async bootstrap(): Promise<void> {
    const accounts = listAutoEnabled(this.deps.db);
    if (accounts.length === 0) return;

    const startAt = async (i: number): Promise<void> => {
      const acc = accounts[i];
      try {
        await this.connect(acc.id);
      } catch (err) {
        // Một tài khoản hỏng (sai khoá, vượt trần) không được chặn phần còn lại.
        console.error(`bootstrap #${acc.id} lỗi: ${(err as Error).message}`);
      }
      if (i + 1 < accounts.length) {
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

    const opts: AvatarSessionOptions = {
      accountId,
      // Đọc lại DB mỗi lần kết nối: mật khẩu hoặc cấu hình auto có thể đã đổi
      // giữa hai lần thử lại.
      loadCredentials: async (): Promise<AvatarCredentials> => {
        const row = getAccountById(db, accountId);
        if (!row) throw new Error(`không có tài khoản #${accountId}`);
        return {
          host: row.host,
          port: row.port,
          user: row.gameUser,
          pass: readGamePass(db, masterKey, accountId),
          device: row.device as Partial<DeviceProfile> | undefined,
          autoEnabled: row.autoEnabled,
          autoConfig: row.autoConfig as Partial<AutoFarmConfig> | undefined,
        };
      },
      onEvent: (type, payload) => broadcast(userId, accountId, type, payload),
      onPermanentFailure: () => {
        // DB là ý muốn của người dùng. Sai mật khẩu game thì ý muốn "chạy 24/7"
        // phải bị gỡ, nếu không restart sau đó lại lao vào vòng đăng nhập sai.
        setAutoEnabled(db, accountId, false, null);
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
