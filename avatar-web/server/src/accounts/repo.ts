import { DEFAULT_GAME_SERVER } from '../config.js';
import { decryptSecret, encryptSecret } from '../crypto/secretBox.js';
import type { Db } from '../db/index.js';
import type { DeviceProfile } from '../game/client.js';

/**
 * Bản ghi tài khoản avatar như phần còn lại của ứng dụng được phép nhìn thấy.
 * Cố ý KHÔNG có trường mật khẩu, kể cả dạng đã mã hoá: chỉ `readGamePass` mới
 * chạm tới bản mã, nên không có đường nào để nó vô tình lọt vào response.
 */
export interface AvatarAccount {
  id: number;
  userId: number;
  label: string;
  gameUser: string;
  host: string;
  port: number;
  device?: Partial<DeviceProfile>;
  autoEnabled: boolean;
  autoConfig?: unknown;
  hasPassword: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAccountInput {
  userId: number;
  label: string;
  gameUser: string;
  gamePass: string;
  host?: string;
  port?: number;
  device?: Partial<DeviceProfile>;
}

export interface UpdateAccountInput {
  label?: string;
  gameUser?: string;
  /** Bỏ trống = giữ nguyên mật khẩu cũ. */
  gamePass?: string;
  host?: string;
  port?: number;
  /** `null` = xoá device, dùng lại mặc định. */
  device?: Partial<DeviceProfile> | null;
}

interface AccountRow {
  id: number;
  user_id: number;
  label: string;
  game_user: string;
  game_pass_enc: string;
  host: string;
  port: number;
  device_json: string | null;
  auto_enabled: number;
  auto_config_json: string | null;
  created_at: number;
  updated_at: number;
}

function parseJson<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function toAccount(r: AccountRow): AvatarAccount {
  return {
    id: r.id,
    userId: r.user_id,
    label: r.label,
    gameUser: r.game_user,
    host: r.host,
    port: r.port,
    device: parseJson<Partial<DeviceProfile>>(r.device_json),
    autoEnabled: r.auto_enabled === 1,
    autoConfig: parseJson<unknown>(r.auto_config_json),
    hasPassword: r.game_pass_enc.length > 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT = 'SELECT * FROM avatar_accounts';

/**
 * AAD của bản mã là id bản ghi, mà id chỉ có sau khi INSERT. Nên phải chèn với
 * chuỗi rỗng rồi UPDATE ngay trong cùng một transaction — bản ghi không bao giờ
 * được nhìn thấy ở trạng thái "có mật khẩu nhưng chưa mã hoá đúng".
 */
export function createAccount(
  db: Db,
  key: Buffer,
  input: CreateAccountInput,
  now = Date.now(),
): AvatarAccount {
  const insert = db.transaction((): number => {
    const info = db
      .prepare(
        `INSERT INTO avatar_accounts
           (user_id, label, game_user, game_pass_enc, host, port, device_json,
            auto_enabled, auto_config_json, created_at, updated_at)
         VALUES (?, ?, ?, '', ?, ?, ?, 0, NULL, ?, ?)`,
      )
      .run(
        input.userId,
        input.label,
        input.gameUser,
        input.host ?? DEFAULT_GAME_SERVER.host,
        input.port ?? DEFAULT_GAME_SERVER.port,
        input.device ? JSON.stringify(input.device) : null,
        now,
        now,
      );
    const id = Number(info.lastInsertRowid);
    db.prepare('UPDATE avatar_accounts SET game_pass_enc = ? WHERE id = ?').run(
      encryptSecret(key, String(id), input.gamePass),
      id,
    );
    return id;
  });

  return getAccountById(db, insert())!;
}

export function listAccounts(db: Db, userId: number): AvatarAccount[] {
  return db
    .prepare<[number], AccountRow>(`${SELECT} WHERE user_id = ? ORDER BY id`)
    .all(userId)
    .map(toAccount);
}

export function getAccount(db: Db, userId: number, id: number): AvatarAccount | null {
  const row = db
    .prepare<[number, number], AccountRow>(`${SELECT} WHERE id = ? AND user_id = ?`)
    .get(id, userId);
  return row ? toAccount(row) : null;
}

/** Không lọc theo user — chỉ dùng cho bootstrap và tầng phiên, đừng gọi từ route. */
export function getAccountById(db: Db, id: number): AvatarAccount | null {
  const row = db.prepare<[number], AccountRow>(`${SELECT} WHERE id = ?`).get(id);
  return row ? toAccount(row) : null;
}

export function listAutoEnabled(db: Db): AvatarAccount[] {
  return db
    .prepare<[], AccountRow>(`${SELECT} WHERE auto_enabled = 1 ORDER BY id`)
    .all()
    .map(toAccount);
}

export function updateAccount(
  db: Db,
  key: Buffer,
  userId: number,
  id: number,
  patch: UpdateAccountInput,
  now = Date.now(),
): AvatarAccount | null {
  const current = getAccount(db, userId, id);
  if (!current) return null;

  const sets: string[] = ['updated_at = ?'];
  const args: unknown[] = [now];
  const set = (col: string, value: unknown) => {
    sets.push(`${col} = ?`);
    args.push(value);
  };

  if (patch.label !== undefined) set('label', patch.label);
  if (patch.gameUser !== undefined) set('game_user', patch.gameUser);
  if (patch.host !== undefined) set('host', patch.host);
  if (patch.port !== undefined) set('port', patch.port);
  if (patch.device !== undefined) set('device_json', patch.device ? JSON.stringify(patch.device) : null);
  // Chuỗi rỗng cũng là "không đổi": form gửi lên ô mật khẩu trống chứ không phải
  // là ý muốn đặt mật khẩu rỗng.
  if (patch.gamePass) set('game_pass_enc', encryptSecret(key, String(id), patch.gamePass));

  args.push(id, userId);
  db.prepare(`UPDATE avatar_accounts SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...args);
  return getAccount(db, userId, id);
}

export function deleteAccount(db: Db, userId: number, id: number): boolean {
  return (
    db.prepare('DELETE FROM avatar_accounts WHERE id = ? AND user_id = ?').run(id, userId).changes > 0
  );
}

/**
 * Cờ `auto_enabled` là *ý muốn* của người dùng, và DB là nguồn sự thật cho
 * bootstrap sau restart. Vì thế nó được ghi tách khỏi `updateAccount`, để route
 * gọi được nó TRƯỚC khi đụng vào phiên đang chạy.
 */
export function setAutoEnabled(
  db: Db,
  id: number,
  enabled: boolean,
  autoConfig: unknown | null,
  now = Date.now(),
): void {
  db.prepare(
    'UPDATE avatar_accounts SET auto_enabled = ?, auto_config_json = ?, updated_at = ? WHERE id = ?',
  ).run(enabled ? 1 : 0, autoConfig === null ? null : JSON.stringify(autoConfig), now, id);
}

/** Đường duy nhất chạm tới mật khẩu game. Chỉ tầng phiên được gọi. */
export function readGamePass(db: Db, key: Buffer, id: number): string {
  const row = db
    .prepare<[number], { game_pass_enc: string }>('SELECT game_pass_enc FROM avatar_accounts WHERE id = ?')
    .get(id);
  if (!row) throw new Error(`không có tài khoản #${id}`);
  return decryptSecret(key, String(id), row.game_pass_enc);
}
