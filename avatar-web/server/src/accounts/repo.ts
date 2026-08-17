import { DEFAULT_GAME_SERVER } from '../config.js';
import { decryptSecret, encryptSecret } from '../crypto/secretBox.js';
import type { Db } from '../db/index.js';
import type { DeviceProfile } from '../game/client.js';
import type { AutoFarmConfig } from '../autoFarm.js';
import {
  mergeAutoConfig,
  normalizeAutoConfig,
  readStoredAutoConfig,
  storedAutoConfigEnvelope,
  type AutoConfigProfile,
  type StoredAutoConfigState,
} from './autoConfig.js';
import { deleteFarmProfile } from './farmProfileRepo.js';

/**
 * Bản ghi tài khoản avatar như phần còn lại của ứng dụng được phép nhìn thấy.
 * Cố ý KHÔNG có trường mật khẩu, kể cả dạng đã mã hoá: chỉ `readGamePass` mới
 * chạm tới bản mã, nên không có đường nào để nó vô tình lọt vào response.
 */
export interface CachedAccountMetrics {
  xu?: number;
  luong?: number;
  playerLevel?: number;
  farmLevel?: number;
  syncedAt?: number;
}

export type AccountMetricsPatch = Omit<CachedAccountMetrics, 'syncedAt'>;

export interface AvatarAccount {
  id: number;
  userId: number;
  label: string;
  gameUser: string;
  host: string;
  port: number;
  device?: Partial<DeviceProfile>;
  autoEnabled: boolean;
  autoConfig: Partial<AutoFarmConfig>;
  autoConfigRevision: number;
  hasPassword: boolean;
  createdAt: number;
  updatedAt: number;
  cachedMetrics?: CachedAccountMetrics;
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
  cached_xu: number | null;
  cached_luong: number | null;
  cached_player_level: number | null;
  cached_farm_level: number | null;
  cached_metrics_at: number | null;
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
  const stored = readStoredAutoConfig(parseJson<unknown>(r.auto_config_json));
  const cachedMetrics: CachedAccountMetrics = {
    ...(r.cached_xu === null ? {} : { xu: r.cached_xu }),
    ...(r.cached_luong === null ? {} : { luong: r.cached_luong }),
    ...(r.cached_player_level === null ? {} : { playerLevel: r.cached_player_level }),
    ...(r.cached_farm_level === null ? {} : { farmLevel: r.cached_farm_level }),
    ...(r.cached_metrics_at === null ? {} : { syncedAt: r.cached_metrics_at }),
  };
  return {
    id: r.id,
    userId: r.user_id,
    label: r.label,
    gameUser: r.game_user,
    host: r.host,
    port: r.port,
    device: parseJson<Partial<DeviceProfile>>(r.device_json),
    autoEnabled: r.auto_enabled === 1,
    autoConfig: stored.config,
    autoConfigRevision: stored.revision,
    hasPassword: r.game_pass_enc.length > 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ...(Object.keys(cachedMetrics).length > 0 ? { cachedMetrics } : {}),
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
  return db.transaction((): AvatarAccount | null => {
    const current = getAccount(db, userId, id);
    if (!current) return null;

    const sets: string[] = ['updated_at = ?'];
    const args: unknown[] = [now];
    const set = (col: string, value: unknown) => {
      sets.push(`${col} = ?`);
      args.push(value);
    };

    if (patch.label !== undefined) set('label', patch.label);
    const normalizedGameUser = patch.gameUser?.trim();
    if (normalizedGameUser !== undefined) set('game_user', normalizedGameUser);
    if (patch.host !== undefined) set('host', patch.host);
    if (patch.port !== undefined) set('port', patch.port);
    if (patch.device !== undefined) {
      set('device_json', patch.device ? JSON.stringify(patch.device) : null);
    }
    // Chuỗi rỗng cũng là "không đổi": form gửi lên ô mật khẩu trống chứ không phải
    // là ý muốn đặt mật khẩu rỗng.
    if (patch.gamePass) set('game_pass_enc', encryptSecret(key, String(id), patch.gamePass));

    args.push(id, userId);
    db.prepare(`UPDATE avatar_accounts SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...args);
    if (normalizedGameUser !== undefined && normalizedGameUser !== current.gameUser.trim()) {
      deleteFarmProfile(db, id);
    }
    return getAccount(db, userId, id);
  })();
}

export function updateCachedMetrics(
  db: Db,
  id: number,
  patch: AccountMetricsPatch,
  now = Date.now(),
): void {
  const sets: string[] = [];
  const args: unknown[] = [];
  const set = (column: string, value: number | undefined) => {
    if (value === undefined || !Number.isFinite(value)) return;
    sets.push(column + ' = ?');
    args.push(Math.trunc(value));
  };
  set('cached_xu', patch.xu);
  set('cached_luong', patch.luong);
  set('cached_player_level', patch.playerLevel);
  set('cached_farm_level', patch.farmLevel);
  if (sets.length === 0) return;
  sets.push('cached_metrics_at = ?', 'updated_at = ?');
  args.push(now, now, id);
  db.prepare('UPDATE avatar_accounts SET ' + sets.join(', ') + ' WHERE id = ?').run(...args);
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
export function setAutoEnabled(db: Db, id: number, enabled: boolean, now?: number): void;
/** @deprecated Config được lưu riêng; overload này chỉ giữ caller cũ biên dịch trong lúc chuyển tiếp. */
export function setAutoEnabled(
  db: Db,
  id: number,
  enabled: boolean,
  ignoredLegacyConfig: unknown | null,
  now?: number,
): void;
export function setAutoEnabled(
  db: Db,
  id: number,
  enabled: boolean,
  nowOrIgnoredConfig: number | unknown | null = Date.now(),
  legacyNow = Date.now(),
): void {
  const now = typeof nowOrIgnoredConfig === 'number' ? nowOrIgnoredConfig : legacyNow;
  db.prepare('UPDATE avatar_accounts SET auto_enabled = ?, updated_at = ? WHERE id = ?').run(
    enabled ? 1 : 0,
    now,
    id,
  );
}

interface AutoConfigRow {
  auto_config_json: string | null;
}

export type SaveAutoConfigResult =
  | { status: 'saved'; state: StoredAutoConfigState }
  | { status: 'conflict'; current: StoredAutoConfigState }
  | { status: 'missing' };

export type AutoConfigProfileErrorCode =
  | 'farm-profile-required'
  | 'seed-catalog-required'
  | 'invalid-tree-cell-plan';

export class AutoConfigProfileError extends Error {
  readonly code: AutoConfigProfileErrorCode;
  readonly invalidCellIndices: number[];
  readonly invalidSeedIds: number[];

  constructor(
    code: AutoConfigProfileErrorCode,
    message: string,
    invalidCellIndices: number[] = [],
    invalidSeedIds: number[] = [],
  ) {
    super(message);
    this.name = 'AutoConfigProfileError';
    this.code = code;
    this.invalidCellIndices = invalidCellIndices;
    this.invalidSeedIds = invalidSeedIds;
  }
}

function ownedAutoConfigRow(db: Db, userId: number, id: number): AutoConfigRow | undefined {
  return db
    .prepare<[number, number], AutoConfigRow>(
      'SELECT auto_config_json FROM avatar_accounts WHERE id = ? AND user_id = ?',
    )
    .get(id, userId);
}

function storedState(row: AutoConfigRow): StoredAutoConfigState {
  return readStoredAutoConfig(parseJson<unknown>(row.auto_config_json));
}

function validateProfile(
  config: Partial<AutoFarmConfig>,
  profile: AutoConfigProfile | null,
): void {
  const plan = config.treeCellPlan;
  if (plan === undefined || plan.length === 0) return;
  if (profile === null || profile.cellIndices.length === 0) {
    throw new AutoConfigProfileError(
      'farm-profile-required',
      'cần đồng bộ farm profile trước khi lưu kế hoạch',
    );
  }

  const seedEntries = plan.filter((entry) => entry.action === 'seed');
  if (profile.seedIds.length === 0 && seedEntries.length > 0) {
    throw new AutoConfigProfileError(
      'seed-catalog-required',
      'cần đồng bộ seed catalog trước khi lưu kế hoạch trồng',
    );
  }

  const knownCells = new Set(profile.cellIndices);
  const knownSeeds = new Set(profile.seedIds);
  const invalidCellIndices = [...new Set(
    plan.filter((entry) => !knownCells.has(entry.cellIndex)).map((entry) => entry.cellIndex),
  )].sort((left, right) => left - right);
  const invalidSeedIds = [...new Set(
    seedEntries.filter((entry) => !knownSeeds.has(entry.seedId)).map((entry) => entry.seedId),
  )].sort((left, right) => left - right);
  if (invalidCellIndices.length > 0 || invalidSeedIds.length > 0) {
    throw new AutoConfigProfileError(
      'invalid-tree-cell-plan',
      'kế hoạch cây không khớp farm profile hiện tại',
      invalidCellIndices,
      invalidSeedIds,
    );
  }
}

export function getAutoConfig(
  db: Db,
  userId: number,
  id: number,
): StoredAutoConfigState | null {
  const row = ownedAutoConfigRow(db, userId, id);
  return row ? storedState(row) : null;
}

export function saveAutoConfig(
  db: Db,
  userId: number,
  id: number,
  expectedRevision: number,
  config: Partial<AutoFarmConfig>,
  now = Date.now(),
): SaveAutoConfigResult {
  return db.transaction((): SaveAutoConfigResult => {
    const row = ownedAutoConfigRow(db, userId, id);
    if (!row) return { status: 'missing' };
    const current = storedState(row);
    if (current.revision !== expectedRevision) return { status: 'conflict', current };

    const state: StoredAutoConfigState = {
      revision: current.revision + 1,
      config: normalizeAutoConfig(config),
    };
    db.prepare(
      `UPDATE avatar_accounts
          SET auto_config_json = ?, updated_at = ?
        WHERE id = ? AND user_id = ?`,
    ).run(JSON.stringify(storedAutoConfigEnvelope(state)), now, id, userId);
    return { status: 'saved', state: storedState(ownedAutoConfigRow(db, userId, id)!) };
  })();
}

export function enableAutoWithConfigPatch(
  db: Db,
  userId: number,
  id: number,
  patch: unknown,
  profile: AutoConfigProfile | null,
  now = Date.now(),
): SaveAutoConfigResult {
  return db.transaction((): SaveAutoConfigResult => {
    const row = ownedAutoConfigRow(db, userId, id);
    if (!row) return { status: 'missing' };
    const current = storedState(row);
    const normalizedPatch = normalizeAutoConfig(patch);
    if (Object.keys(normalizedPatch).length === 0) {
      setAutoEnabled(db, id, true, now);
      return { status: 'saved', state: current };
    }

    const config = mergeAutoConfig(current.config, normalizedPatch);
    validateProfile(config, profile);
    const state: StoredAutoConfigState = { revision: current.revision + 1, config };
    db.prepare(
      `UPDATE avatar_accounts
          SET auto_config_json = ?, auto_enabled = 1, updated_at = ?
        WHERE id = ? AND user_id = ?`,
    ).run(JSON.stringify(storedAutoConfigEnvelope(state)), now, id, userId);
    return { status: 'saved', state };
  })();
}

/** Đường duy nhất chạm tới mật khẩu game. Chỉ tầng phiên được gọi. */
export function readGamePass(db: Db, key: Buffer, id: number): string {
  const row = db
    .prepare<[number], { game_pass_enc: string }>('SELECT game_pass_enc FROM avatar_accounts WHERE id = ?')
    .get(id);
  if (!row) throw new Error(`không có tài khoản #${id}`);
  return decryptSecret(key, String(id), row.game_pass_enc);
}
