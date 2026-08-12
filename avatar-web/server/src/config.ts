import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Server game mặc định — chỉ .120 xử lý đăng nhập, xem `avatar-re/notes/protocol.md`. */
export const DEFAULT_GAME_SERVER = { host: '27.0.14.120', port: 19129 };

export interface Config {
  port: number;
  /** Khoá 32 byte để mã hoá mật khẩu game. */
  masterKey: Buffer;
  inviteCode: string;
  maxSessions: number;
  isProduction: boolean;
  dbPath: string;
}

const DEFAULT_DB_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data/avatar-web.db',
);

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

  return {
    port: Number(env.PORT ?? 8787),
    masterKey,
    inviteCode,
    maxSessions: Number(env.MAX_SESSIONS ?? 20),
    isProduction: env.NODE_ENV === 'production',
    dbPath: env.DB_PATH ?? DEFAULT_DB_PATH,
  };
}
