import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Server game mặc định — chỉ .120 xử lý đăng nhập, xem `avatar-re/notes/protocol.md`. */
export const DEFAULT_GAME_SERVER = { host: '27.0.14.120', port: 19129 };

export type LiveAccountAllowlist = ReadonlySet<number> | 'all';

export interface ShopPolicy {
  readEnabled: boolean;
  writeEnabled: boolean;
  purchaseEnabled: boolean;
  slotUnlockEnabled: boolean;
  marketRefreshEnabled: boolean;
  liveAccountAllowlist: LiveAccountAllowlist;
  protocolDebugEnabled: boolean;
}

export interface Config {
  port: number;
  /** Khoá 32 byte để mã hoá mật khẩu game. */
  masterKey: Buffer;
  inviteCode: string;
  maxSessions: number;
  isProduction: boolean;
  dbPath: string;
  fishingRx79CaptureRoot: string | null;
  shopPolicy: ShopPolicy;
}

const DEFAULT_DB_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data/avatar-web.db',
);

function envFlag(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(value?.trim() ?? '');
}

function parseAccountAllowlist(value: string | undefined): LiveAccountAllowlist {
  const raw = value?.trim();
  if (!raw) return new Set<number>();
  if (raw === '*') return 'all';
  if (raw.includes('*')) {
    throw new Error('SHOP_LIVE_ACCOUNT_ALLOWLIST không được trộn wildcard với account id');
  }
  const accountIds = raw.split(',').map((token) => {
    const normalized = token.trim();
    if (!/^[1-9]\d*$/.test(normalized)) {
      throw new Error(`SHOP_LIVE_ACCOUNT_ALLOWLIST chứa account id không hợp lệ: ${normalized || '(trống)'}`);
    }
    const accountId = Number(normalized);
    if (!Number.isSafeInteger(accountId)) {
      throw new Error(`SHOP_LIVE_ACCOUNT_ALLOWLIST chứa account id vượt giới hạn: ${normalized}`);
    }
    return accountId;
  });
  return new Set(accountIds);
}

/**
 * Đọc cấu hình từ env. Ném lỗi thay vì dùng giá trị mặc định cho bí mật:
 * chạy bằng khoá mặc định nghĩa là mọi mật khẩu game trong DB đọc được bởi
 * bất kỳ ai có bản mã nguồn.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const rawKey = env.MASTER_KEY?.trim();
  if (!rawKey) {
    throw new Error('thiếu MASTER_KEY — chạy `npm run gen-key` rồi đặt vào env');
  }
  const masterKey = Buffer.from(rawKey, 'base64');
  if (masterKey.length !== 32) {
    throw new Error(`MASTER_KEY phải là 32 byte base64, đang có ${masterKey.length} byte`);
  }

  const inviteCode = env.INVITE_CODE?.trim();
  if (!inviteCode) throw new Error('thiếu INVITE_CODE — không có mã mời thì không ai đăng ký được');
  const isProduction = env.NODE_ENV === 'production';
  const rawFishingRx79CaptureRoot = env.FISHING_RX79_CAPTURE_ROOT;
  if (isProduction && rawFishingRx79CaptureRoot !== undefined) {
    throw new Error('FISHING_RX79_CAPTURE_ROOT bị cấm trong production');
  }
  const normalizedFishingRx79CaptureRoot = rawFishingRx79CaptureRoot?.trim();
  if (normalizedFishingRx79CaptureRoot && !path.isAbsolute(normalizedFishingRx79CaptureRoot)) {
    throw new Error('FISHING_RX79_CAPTURE_ROOT phải là đường dẫn tuyệt đối');
  }

  return {
    port: Number(env.PORT ?? 8787),
    masterKey,
    inviteCode,
    maxSessions: Number(env.MAX_SESSIONS ?? 20),
    isProduction,
    dbPath: env.DB_PATH ?? DEFAULT_DB_PATH,
    fishingRx79CaptureRoot: normalizedFishingRx79CaptureRoot
      ? path.resolve(normalizedFishingRx79CaptureRoot)
      : null,
    shopPolicy: {
      readEnabled: envFlag(env.SHOP_READ_ENABLED),
      writeEnabled: envFlag(env.SHOP_WRITE_ENABLED),
      purchaseEnabled: envFlag(env.SHOP_PURCHASE_ENABLED),
      slotUnlockEnabled: envFlag(env.SHOP_SLOT_UNLOCK_ENABLED),
      marketRefreshEnabled: envFlag(env.SHOP_MARKET_REFRESH_ENABLED),
      liveAccountAllowlist: parseAccountAllowlist(env.SHOP_LIVE_ACCOUNT_ALLOWLIST),
      protocolDebugEnabled: !isProduction && envFlag(env.SHOP_PROTOCOL_DEBUG_ENABLED),
    },
  };
}
