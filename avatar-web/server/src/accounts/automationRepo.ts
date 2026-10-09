import type { Db } from '../db/index.js';
import {
  DEFAULT_FIND_NPC_CONFIG,
  DEFAULT_FISHING_CONFIG,
  DEFAULT_MAZE_CONFIG,
  DEFAULT_MINING_CONFIG,
  DEFAULT_SCHOOL_CONFIG,
  FISHING_BAITS,
  FISHING_RODS,
  idleFindNpcRuntime,
  idleFishermanQuestRuntime,
  idleFishingRuntime,
  idleMazeRuntime,
  idleMiningRuntime,
  idleSchoolRuntime,
  type AutomationLocation,
  type AutomationMode,
  type AutomationSnapshot,
  type FindNpcConfig,
  type FishingConfig,
  type LoadedAutomationIntent,
  type MazeConfig,
  type MiningConfig,
  type MiningTarget,
  type SchoolConfig,
  type SchoolSubject,
  type StoredFindNpcConfigState,
  type StoredFishingConfigState,
  type StoredMazeConfigState,
  type StoredMiningConfigState,
  type StoredSchoolConfigState,
} from '../session/automationTypes.js';

export class FindNpcConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FindNpcConfigError';
  }
  readonly code = 'invalid-find-npc-config' as const;
}

export class MiningConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MiningConfigError';
  }
  readonly code = 'invalid-mining-config' as const;
}

export class MazeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MazeConfigError';
  }
  readonly code = 'invalid-maze-config' as const;
}

export class SchoolConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchoolConfigError';
  }
  readonly code = 'invalid-school-config' as const;
}

interface AutomationRow {
  account_id: number;
  desired_mode: AutomationMode;
  find_npc_config_json: string | null;
  fishing_config_json: string | null;
  mining_config_json: string | null;
  maze_config_json: string | null;
  school_config_json: string | null;
  current_map: number | null;
  current_area: number | null;
  location_observed_at: number | null;
}

function defaultFindNpcConfig(): StoredFindNpcConfigState {
  return { revision: 0, config: DEFAULT_FIND_NPC_CONFIG };
}

/** Trim + giới hạn 1..80 Unicode code points và validate dải map/board. */
export function normalizeFindNpcConfig(input: unknown): FindNpcConfig {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new FindNpcConfigError('cấu hình tìm NPC phải là object');
  }
  const obj = input as Record<string, unknown>;
  const raw = obj.npcName;
  if (typeof raw !== 'string') throw new FindNpcConfigError('"npcName" phải là chuỗi');
  const name = raw.trim();
  const length = [...name].length;
  if (length < 1 || length > 80) {
    throw new FindNpcConfigError('"npcName" phải dài 1..80 ký tự sau khi trim');
  }
  const fromMap =
    typeof obj.fromMap === 'number' && obj.fromMap >= 0 && obj.fromMap <= 100
      ? Math.floor(obj.fromMap)
      : DEFAULT_FIND_NPC_CONFIG.fromMap;
  const toMap =
    typeof obj.toMap === 'number' && obj.toMap >= 0 && obj.toMap <= 100
      ? Math.floor(obj.toMap)
      : DEFAULT_FIND_NPC_CONFIG.toMap;
  const fromBoard =
    typeof obj.fromBoard === 'number' && obj.fromBoard >= 0 && obj.fromBoard <= 50
      ? Math.floor(obj.fromBoard)
      : DEFAULT_FIND_NPC_CONFIG.fromBoard;
  const toBoard =
    typeof obj.toBoard === 'number' && obj.toBoard >= 0 && obj.toBoard <= 50
      ? Math.floor(obj.toBoard)
      : DEFAULT_FIND_NPC_CONFIG.toBoard;
  const stopOnMaxQuantity =
    typeof obj.stopOnMaxQuantity === 'boolean'
      ? obj.stopOnMaxQuantity
      : true;
  const cycleDelaySeconds =
    typeof obj.cycleDelaySeconds === 'number' && obj.cycleDelaySeconds >= 0 && obj.cycleDelaySeconds <= 3600
      ? Math.floor(obj.cycleDelaySeconds)
      : DEFAULT_FIND_NPC_CONFIG.cycleDelaySeconds;

  return {
    npcName: name,
    fromMap,
    toMap,
    fromBoard,
    toBoard,
    stopOnMaxQuantity,
    cycleDelaySeconds,
  };
}

function storedFindNpcConfig(raw: string | null): StoredFindNpcConfigState {
  if (!raw) return defaultFindNpcConfig();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' && parsed !== null
      && (parsed as Record<string, unknown>).version === 1
      && typeof (parsed as Record<string, unknown>).revision === 'number'
    ) {
      const envelope = parsed as { version: 1; revision: number; config: unknown };
      return {
        revision: envelope.revision,
        config: normalizeFindNpcConfig(envelope.config),
      };
    }
  } catch {
    /* JSON hỏng -> mặc định */
  }
  return defaultFindNpcConfig();
}

export function defaultFishingConfig(): StoredFishingConfigState {
  return {
    revision: 0,
    config: { ...DEFAULT_FISHING_CONFIG },
  };
}

const VALID_ROD_IDS = new Set(FISHING_RODS.map((r) => r.id));
const VALID_BAIT_IDS = new Set(FISHING_BAITS.map((b) => b.id));

export function parseFishingConfig(input: unknown): FishingConfig {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Cấu hình câu cá phải là một object');
  }
  const obj = input as Record<string, unknown>;
  const map = typeof obj.map === 'number' && [14, 15, 16, 27].includes(obj.map) ? obj.map : 14;
  const area = typeof obj.area === 'number' && obj.area >= 0 && obj.area <= 15 ? Math.floor(obj.area) : 0;
  const castDelayMs = typeof obj.castDelayMs === 'number' && obj.castDelayMs >= 1000 && obj.castDelayMs <= 10000
    ? Math.floor(obj.castDelayMs) : 3000;
  const autoBuyTicket = typeof obj.autoBuyTicket === 'boolean' ? obj.autoBuyTicket : true;
  const rodType = typeof obj.rodType === 'number' && VALID_ROD_IDS.has(obj.rodType) ? obj.rodType : 442;
  const baitType = typeof obj.baitType === 'number' && VALID_BAIT_IDS.has(obj.baitType) ? obj.baitType : 448;
  const baitQuantity = typeof obj.baitQuantity === 'number' && obj.baitQuantity >= 1 && obj.baitQuantity <= 200
    ? Math.floor(obj.baitQuantity) : 50;

  return {
    map,
    area,
    castDelayMs,
    autoBuyTicket,
    rodType,
    baitType,
    baitQuantity,
  };
}

function storedFishingConfig(raw: string | null): StoredFishingConfigState {
  if (!raw) return defaultFishingConfig();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' && parsed !== null
      && (parsed as Record<string, unknown>).version === 1
      && typeof (parsed as Record<string, unknown>).revision === 'number'
    ) {
      const envelope = parsed as { version: 1; revision: number; config: unknown };
      return {
        revision: envelope.revision,
        config: parseFishingConfig(envelope.config),
      };
    }
  } catch {
    /* JSON hỏng -> mặc định */
  }
  return defaultFishingConfig();
}

export function defaultMiningConfig(): StoredMiningConfigState {
  return {
    revision: 0,
    config: { ...DEFAULT_MINING_CONFIG },
  };
}

export function normalizeMiningConfig(input: unknown): MiningConfig {
  if (typeof input !== 'object' || input === null) {
    throw new MiningConfigError('Cấu hình khai thác phải là một object');
  }
  const obj = input as Record<string, unknown>;
  const target: MiningTarget =
    obj.target === 'diamond' || obj.target === 'wood' || obj.target === 'patrol'
      ? obj.target
      : 'diamond';
  const startArea =
    typeof obj.startArea === 'number' && obj.startArea >= 0 && obj.startArea <= 19
      ? Math.floor(obj.startArea)
      : 0;
  const switchAreaWhenDepleted =
    typeof obj.switchAreaWhenDepleted === 'boolean'
      ? obj.switchAreaWhenDepleted
      : true;
  const maxAreasToScan =
    typeof obj.maxAreasToScan === 'number' && obj.maxAreasToScan >= 1 && obj.maxAreasToScan <= 20
      ? Math.floor(obj.maxAreasToScan)
      : 10;
  const delayBetweenActionsMs =
    typeof obj.delayBetweenActionsMs === 'number' && obj.delayBetweenActionsMs >= 1500 && obj.delayBetweenActionsMs <= 10000
      ? Math.floor(obj.delayBetweenActionsMs)
      : 3000;

  return {
    target,
    startArea,
    switchAreaWhenDepleted,
    maxAreasToScan,
    delayBetweenActionsMs,
  };
}

function storedMiningConfig(raw: string | null): StoredMiningConfigState {
  if (!raw) return defaultMiningConfig();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' && parsed !== null
      && (parsed as Record<string, unknown>).version === 1
      && typeof (parsed as Record<string, unknown>).revision === 'number'
    ) {
      const envelope = parsed as { version: 1; revision: number; config: unknown };
      return {
        revision: envelope.revision,
        config: normalizeMiningConfig(envelope.config),
      };
    }
  } catch {
    /* JSON hỏng -> mặc định */
  }
  return defaultMiningConfig();
}

function defaultMazeConfig(): StoredMazeConfigState {
  return {
    revision: 0,
    config: DEFAULT_MAZE_CONFIG,
  };
}

export function defaultSchoolConfig(): StoredSchoolConfigState {
  return {
    revision: 0,
    config: DEFAULT_SCHOOL_CONFIG,
  };
}

export function normalizeSchoolConfig(input: unknown): SchoolConfig {
  if (typeof input !== 'object' || input === null) {
    throw new SchoolConfigError('Cấu hình Trường học phải là một object');
  }
  const obj = input as Record<string, unknown>;
  const subject: SchoolSubject = obj.subject === 'vi' ? 'vi' : 'en';
  const targetWins =
    typeof obj.targetWins === 'number' && obj.targetWins >= 0 && obj.targetWins <= 1000
      ? Math.floor(obj.targetWins)
      : 0;
  const returnToFarm = typeof obj.returnToFarm === 'boolean' ? obj.returnToFarm : true;

  return {
    subject,
    targetWins,
    returnToFarm,
  };
}

function storedSchoolConfig(raw: string | null): StoredSchoolConfigState {
  if (!raw) return defaultSchoolConfig();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as Record<string, unknown>).version === 1 &&
      typeof (parsed as Record<string, unknown>).revision === 'number'
    ) {
      const envelope = parsed as { version: 1; revision: number; config: unknown };
      return {
        revision: envelope.revision,
        config: normalizeSchoolConfig(envelope.config),
      };
    }
  } catch {
    /* JSON hỏng -> mặc định */
  }
  return defaultSchoolConfig();
}

export function normalizeMazeConfig(input: unknown): MazeConfig {
  if (typeof input !== 'object' || input === null) {
    throw new MazeConfigError('Cấu hình Mê cung phải là một object');
  }
  const obj = input as Record<string, unknown>;
  const startArea =
    typeof obj.startArea === 'number' && obj.startArea >= 0 && obj.startArea <= 50
      ? Math.floor(obj.startArea)
      : 0;
  const autoSwitchArea =
    typeof obj.autoSwitchArea === 'boolean' ? obj.autoSwitchArea : true;
  const maxAreasToScan =
    typeof obj.maxAreasToScan === 'number' && obj.maxAreasToScan >= 1 && obj.maxAreasToScan <= 50
      ? Math.floor(obj.maxAreasToScan)
      : 20;
  const watchRespawn =
    typeof obj.watchRespawn === 'boolean' ? obj.watchRespawn : true;
  const maxChestsPerSession =
    typeof obj.maxChestsPerSession === 'number' && obj.maxChestsPerSession >= 1 && obj.maxChestsPerSession <= 50
      ? Math.floor(obj.maxChestsPerSession)
      : 30;

  return {
    startArea,
    autoSwitchArea,
    maxAreasToScan,
    watchRespawn,
    maxChestsPerSession,
  };
}

function storedMazeConfig(raw: string | null): StoredMazeConfigState {
  if (!raw) return defaultMazeConfig();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as Record<string, unknown>).version === 1 &&
      typeof (parsed as Record<string, unknown>).revision === 'number'
    ) {
      const envelope = parsed as { version: 1; revision: number; config: unknown };
      return {
        revision: envelope.revision,
        config: normalizeMazeConfig(envelope.config),
      };
    }
  } catch {
    /* JSON hỏng -> mặc định */
  }
  return defaultMazeConfig();
}

function rowToState(row: AutomationRow) {
  const location: AutomationLocation | null =
    row.current_map !== null && row.current_area !== null && row.location_observed_at !== null
      ? { map: row.current_map, area: row.current_area, observedAt: row.location_observed_at }
      : null;
  return {
    desiredMode: row.desired_mode,
    findNpcConfig: storedFindNpcConfig(row.find_npc_config_json),
    fishingConfig: storedFishingConfig(row.fishing_config_json),
    miningConfig: storedMiningConfig(row.mining_config_json),
    mazeConfig: storedMazeConfig(row.maze_config_json),
    schoolConfig: storedSchoolConfig(row.school_config_json),
    location,
  };
}

export type StoredAutomationState = ReturnType<typeof rowToState>;

/** Defensive read: thiếu row vẫn trả trạng thái mặc định, không ném. */
export function readAutomationState(db: Db, accountId: number): StoredAutomationState {
  const row = db
    .prepare<[number], AutomationRow>(
      `SELECT desired_mode, find_npc_config_json, fishing_config_json, mining_config_json, maze_config_json, school_config_json, current_map, current_area, location_observed_at
         FROM avatar_automation_state WHERE account_id = ?`,
    )
    .get(accountId);
  if (!row) {
    return {
      desiredMode: 'off',
      findNpcConfig: defaultFindNpcConfig(),
      fishingConfig: defaultFishingConfig(),
      miningConfig: defaultMiningConfig(),
      mazeConfig: defaultMazeConfig(),
      schoolConfig: defaultSchoolConfig(),
      location: null,
    };
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

export type SaveFishingConfigResult =
  | { status: 'saved'; state: StoredFishingConfigState }
  | { status: 'conflict'; current: StoredFishingConfigState }
  | { status: 'missing' };

export function saveFishingConfig(
  db: Db,
  accountId: number,
  expectedRevision: number,
  config: FishingConfig,
  now = Date.now(),
): SaveFishingConfigResult {
  return db.transaction((): SaveFishingConfigResult => {
    const owned = db
      .prepare<[number], { user_id: number }>('SELECT user_id FROM avatar_accounts WHERE id = ?')
      .get(accountId);
    if (!owned) return { status: 'missing' };

    const current = readAutomationState(db, accountId).fishingConfig;
    if (current.revision === expectedRevision && current.revision === 0
        && !db.prepare<[number], { account_id: number }>(
          'SELECT account_id FROM avatar_automation_state WHERE account_id = ?',
        ).get(accountId)) {
      db.prepare(
        `INSERT INTO avatar_automation_state (account_id, desired_mode, updated_at)
           VALUES (?, 'off', ?)`,
      ).run(accountId, now);
    } else if (current.revision !== expectedRevision) {
      return { status: 'conflict', current };
    }

    const nextRevision = current.revision + 1;
    const json = JSON.stringify({
      version: 1,
      revision: nextRevision,
      config,
    });

    db.prepare(
      `UPDATE avatar_automation_state
         SET fishing_config_json = ?, updated_at = ?
       WHERE account_id = ?`,
    ).run(json, now, accountId);

    return { status: 'saved', state: { revision: nextRevision, config } };
  })();
}

export type SaveMiningConfigResult =
  | { status: 'saved'; state: StoredMiningConfigState }
  | { status: 'conflict'; current: StoredMiningConfigState }
  | { status: 'missing' };

export function saveMiningConfig(
  db: Db,
  accountId: number,
  expectedRevision: number,
  config: MiningConfig,
  now = Date.now(),
): SaveMiningConfigResult {
  return db.transaction((): SaveMiningConfigResult => {
    const owned = db
      .prepare<[number], { user_id: number }>('SELECT user_id FROM avatar_accounts WHERE id = ?')
      .get(accountId);
    if (!owned) return { status: 'missing' };

    const current = readAutomationState(db, accountId).miningConfig;
    if (
      current.revision === expectedRevision &&
      current.revision === 0 &&
      !db.prepare<[number], { account_id: number }>(
        'SELECT account_id FROM avatar_automation_state WHERE account_id = ?',
      ).get(accountId)
    ) {
      db.prepare(
        `INSERT INTO avatar_automation_state (account_id, desired_mode, updated_at)
           VALUES (?, 'off', ?)`,
      ).run(accountId, now);
    } else if (current.revision !== expectedRevision) {
      return { status: 'conflict', current };
    }

    const nextRevision = current.revision + 1;
    const json = JSON.stringify({
      version: 1,
      revision: nextRevision,
      config,
    });

    db.prepare(
      `UPDATE avatar_automation_state
         SET mining_config_json = ?, updated_at = ?
       WHERE account_id = ?`,
    ).run(json, now, accountId);

    return { status: 'saved', state: { revision: nextRevision, config } };
  })();
}

export type SaveMazeConfigResult =
  | { status: 'saved'; state: StoredMazeConfigState }
  | { status: 'conflict'; current: StoredMazeConfigState }
  | { status: 'missing' };

export function saveMazeConfig(
  db: Db,
  accountId: number,
  expectedRevision: number,
  config: MazeConfig,
  now = Date.now(),
): SaveMazeConfigResult {
  return db.transaction((): SaveMazeConfigResult => {
    const owned = db
      .prepare<[number], { user_id: number }>('SELECT user_id FROM avatar_accounts WHERE id = ?')
      .get(accountId);
    if (!owned) return { status: 'missing' };

    const current = readAutomationState(db, accountId).mazeConfig;
    if (
      current.revision === expectedRevision &&
      current.revision === 0 &&
      !db.prepare<[number], { account_id: number }>(
        'SELECT account_id FROM avatar_automation_state WHERE account_id = ?',
      ).get(accountId)
    ) {
      db.prepare(
        `INSERT INTO avatar_automation_state (account_id, desired_mode, updated_at)
           VALUES (?, 'off', ?)`,
      ).run(accountId, now);
    } else if (current.revision !== expectedRevision) {
      return { status: 'conflict', current };
    }

    const nextRevision = current.revision + 1;
    const json = JSON.stringify({
      version: 1,
      revision: nextRevision,
      config,
    });

    db.prepare(
      `UPDATE avatar_automation_state
         SET maze_config_json = ?, updated_at = ?
       WHERE account_id = ?`,
    ).run(json, now, accountId);

    return { status: 'saved', state: { revision: nextRevision, config } };
  })();
}

export type SaveSchoolConfigResult =
  | { status: 'saved'; state: StoredSchoolConfigState }
  | { status: 'conflict'; current: StoredSchoolConfigState }
  | { status: 'missing' };

export function saveSchoolConfig(
  db: Db,
  accountId: number,
  expectedRevision: number,
  config: SchoolConfig,
  now = Date.now(),
): SaveSchoolConfigResult {
  return db.transaction((): SaveSchoolConfigResult => {
    const owned = db
      .prepare<[number], { user_id: number }>('SELECT user_id FROM avatar_accounts WHERE id = ?')
      .get(accountId);
    if (!owned) return { status: 'missing' };

    const current = readAutomationState(db, accountId).schoolConfig;
    if (
      current.revision === expectedRevision &&
      current.revision === 0 &&
      !db.prepare<[number], { account_id: number }>(
        'SELECT account_id FROM avatar_automation_state WHERE account_id = ?',
      ).get(accountId)
    ) {
      db.prepare(
        `INSERT INTO avatar_automation_state (account_id, desired_mode, updated_at)
           VALUES (?, 'off', ?)`,
      ).run(accountId, now);
    } else if (current.revision !== expectedRevision) {
      return { status: 'conflict', current };
    }

    const nextRevision = current.revision + 1;
    const json = JSON.stringify({
      version: 1,
      revision: nextRevision,
      config,
    });

    db.prepare(
      `UPDATE avatar_automation_state
         SET school_config_json = ?, updated_at = ?
       WHERE account_id = ?`,
    ).run(json, now, accountId);

    return { status: 'saved', state: { revision: nextRevision, config } };
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
    `INSERT INTO avatar_automation_state
        (account_id, desired_mode, current_map, current_area, location_observed_at, updated_at)
     VALUES (?, 'off', ?, ?, ?, ?)
     ON CONFLICT(account_id) DO UPDATE
       SET current_map = excluded.current_map,
           current_area = excluded.current_area,
           location_observed_at = excluded.location_observed_at,
           updated_at = excluded.updated_at`,
  ).run(accountId, map, area, observedAt, now);
}

export interface DesiredAutomationEntry {
  accountId: number;
  intent: LoadedAutomationIntent;
}

/** Bootstrap đọc từ đây thay vì `listAutoEnabled`. */
export function listDesiredAutomation(db: Db): DesiredAutomationEntry[] {
  const rows = db
    .prepare<[], AutomationRow>(
      `SELECT account_id, desired_mode, find_npc_config_json, fishing_config_json,
              mining_config_json, maze_config_json, school_config_json,
              current_map, current_area, location_observed_at
         FROM avatar_automation_state
        WHERE desired_mode IN ('auto_farm', 'find_npc', 'auto_fishing', 'auto_fisherman_quest', 'auto_mining', 'auto_maze', 'auto_school')
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
        fishingConfig: state.fishingConfig,
        miningConfig: state.miningConfig,
        mazeConfig: state.mazeConfig,
        schoolConfig: state.schoolConfig,
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
    fishingConfig: state.fishingConfig,
    fishingRuntime: idleFishingRuntime(),
    fishermanQuestRuntime: idleFishermanQuestRuntime(),
    miningConfig: state.miningConfig,
    miningRuntime: idleMiningRuntime(),
    mazeConfig: state.mazeConfig,
    mazeRuntime: idleMazeRuntime(),
    schoolConfig: state.schoolConfig,
    schoolRuntime: idleSchoolRuntime(),
    location: state.location,
  };
}
