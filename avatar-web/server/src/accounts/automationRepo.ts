import type { Db } from '../db/index.js';
import {
  idleFindNpcRuntime,
  type AutomationLocation,
  type AutomationMode,
  type AutomationSnapshot,
  type FindNpcConfig,
  type LoadedAutomationIntent,
  type StoredFindNpcConfigState,
} from '../session/automationTypes.js';

export class FindNpcConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FindNpcConfigError';
  }
  readonly code = 'invalid-find-npc-config' as const;
}

interface AutomationRow {
  account_id: number;
  desired_mode: AutomationMode;
  find_npc_config_json: string | null;
  current_map: number | null;
  current_area: number | null;
  location_observed_at: number | null;
}

const DEFAULT_CONFIG: StoredFindNpcConfigState = { revision: 0, config: { npcName: '' } };

/** Trim + giới hạn 1..80 Unicode code points; chỉ nhận đúng key `npcName`. */
export function normalizeFindNpcConfig(input: unknown): FindNpcConfig {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new FindNpcConfigError('cấu hình tìm NPC phải là object');
  }
  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== 'npcName') {
    throw new FindNpcConfigError('chỉ nhận trường "npcName"');
  }
  const raw = (input as { npcName: unknown }).npcName;
  if (typeof raw !== 'string') throw new FindNpcConfigError('"npcName" phải là chuỗi');
  const name = raw.trim();
  const length = [...name].length;
  if (length < 1 || length > 80) {
    throw new FindNpcConfigError('"npcName" phải dài 1..80 ký tự sau khi trim');
  }
  return { npcName: name };
}

function storedFindNpcConfig(raw: string | null): StoredFindNpcConfigState {
  if (!raw) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' && parsed !== null
      && (parsed as Record<string, unknown>).version === 1
      && typeof (parsed as Record<string, unknown>).revision === 'number'
    ) {
      const envelope = parsed as { version: 1; revision: number; config: unknown };
      const npcName = (envelope.config as Record<string, unknown> | null)?.npcName;
      if (typeof npcName === 'string') {
        return { revision: envelope.revision, config: { npcName } };
      }
    }
  } catch {
    /* JSON hỏng -> mặc định */
  }
  return DEFAULT_CONFIG;
}

function rowToState(row: AutomationRow) {
  const location: AutomationLocation | null =
    row.current_map !== null && row.current_area !== null && row.location_observed_at !== null
      ? { map: row.current_map, area: row.current_area, observedAt: row.location_observed_at }
      : null;
  return {
    desiredMode: row.desired_mode,
    findNpcConfig: storedFindNpcConfig(row.find_npc_config_json),
    location,
  };
}

export type StoredAutomationState = ReturnType<typeof rowToState>;

/** Defensive read: thiếu row vẫn trả trạng thái mặc định, không ném. */
export function readAutomationState(db: Db, accountId: number): StoredAutomationState {
  const row = db
    .prepare<[number], AutomationRow>(
      `SELECT desired_mode, find_npc_config_json, current_map, current_area, location_observed_at
         FROM avatar_automation_state WHERE account_id = ?`,
    )
    .get(accountId);
  if (!row) {
    return { desiredMode: 'off', findNpcConfig: { ...DEFAULT_CONFIG }, location: null };
  }
  return rowToState(row);
}

/**
 * Desired mode và cờ legacy `auto_enabled` phải đổi trong CÙNG transaction:
 * `auto_farm` -> 1, còn lại -> 0 để code cũ không hiểu Find NPC là AutoFarm.
 */
export function setDesiredMode(db: Db, accountId: number, mode: AutomationMode, now = Date.now()): void {
  db.transaction(() => {
    db.prepare(
      `INSERT INTO avatar_automation_state (account_id, desired_mode, updated_at)
         VALUES (?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE
         SET desired_mode = excluded.desired_mode, updated_at = excluded.updated_at`,
    ).run(accountId, mode, now);
    db.prepare(
      'UPDATE avatar_accounts SET auto_enabled = ?, updated_at = ? WHERE id = ?',
    ).run(mode === 'auto_farm' ? 1 : 0, now, accountId);
  })();
}

export type SaveFindNpcConfigResult =
  | { status: 'saved'; state: StoredFindNpcConfigState }
  | { status: 'conflict'; current: StoredFindNpcConfigState }
  | { status: 'missing' };

export function saveFindNpcConfig(
  db: Db,
  accountId: number,
  expectedRevision: number,
  config: FindNpcConfig,
  now = Date.now(),
): SaveFindNpcConfigResult {
  return db.transaction((): SaveFindNpcConfigResult => {
    const owned = db
      .prepare<[number], { user_id: number }>(
        'SELECT user_id FROM avatar_accounts WHERE id = ?',
      )
      .get(accountId);
    if (!owned) return { status: 'missing' };

    const current = readAutomationState(db, accountId).findNpcConfig;
    if (current.revision === expectedRevision && current.revision === 0
        && !db.prepare<[number], { account_id: number }>(
          'SELECT account_id FROM avatar_automation_state WHERE account_id = ?',
        ).get(accountId)) {
      // Row chưa tồn tại (chưa từng ghi): revision 0 là hợp lệ, tạo row trước khi lưu.
      db.prepare(
        `INSERT INTO avatar_automation_state (account_id, desired_mode, updated_at)
           VALUES (?, 'off', ?)`,
      ).run(accountId, now);
    }
    if (current.revision !== expectedRevision) {
      return { status: 'conflict', current };
    }
    const state: StoredFindNpcConfigState = { revision: current.revision + 1, config };
    db.prepare(
      `UPDATE avatar_automation_state
          SET find_npc_config_json = ?, updated_at = ?
        WHERE account_id = ?`,
    ).run(JSON.stringify({ version: 1, revision: state.revision, config }), now, accountId);
    return { status: 'saved', state };
  })();
}

/** Ghi/xóa location nguyên tử: cả ba cột cùng giá trị hoặc cùng NULL. */
export function saveFindNpcLocation(
  db: Db,
  accountId: number,
  location: { map: number; area: number } | null,
  now = Date.now(),
): void {
  const map = location?.map ?? null;
  const area = location?.area ?? null;
  const observedAt = location ? now : null;
  db.prepare(
    `UPDATE avatar_automation_state
        SET current_map = ?, current_area = ?, location_observed_at = ?, updated_at = ?
      WHERE account_id = ?`,
  ).run(map, area, observedAt, now, accountId);
}

export interface DesiredAutomationEntry {
  accountId: number;
  intent: LoadedAutomationIntent;
}

/** Bootstrap đọc từ đây thay vì `listAutoEnabled`. */
export function listDesiredAutomation(db: Db): DesiredAutomationEntry[] {
  const rows = db
    .prepare<[], AutomationRow>(
      `SELECT account_id, desired_mode, find_npc_config_json,
              current_map, current_area, location_observed_at
         FROM avatar_automation_state
        WHERE desired_mode IN ('auto_farm', 'find_npc')
        ORDER BY account_id`,
    )
    .all();
  return rows.map((row) => {
    const state = rowToState(row);
    return {
      accountId: row.account_id,
      intent: {
        desiredMode: state.desiredMode,
        findNpcConfig: state.findNpcConfig,
        location: state.location,
      },
    };
  });
}

/** View offline cho GET /automation khi chưa có session sống. */
export function offlineAutomationSnapshot(state: StoredAutomationState): AutomationSnapshot {
  return {
    desiredMode: state.desiredMode,
    activeMode: 'off',
    transitionState: 'stable',
    findNpcConfig: state.findNpcConfig,
    findNpcRuntime: idleFindNpcRuntime(state.findNpcConfig.config.npcName),
    location: state.location,
  };
}
