import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

export type Db = Database.Database;

const SCHEMA_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');

/**
 * Mở DB và chạy migration. Migration là một file SQL toàn `IF NOT EXISTS`, chạy
 * mỗi lần khởi động — đủ cho một schema ba bảng, không cần bảng version.
 */
export function openDb(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  // Không có ràng buộc khoá ngoại thì xoá user vẫn để lại tài khoản avatar mồ côi,
  // mà chúng lại chứa bản mã mật khẩu game.
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const addColumn = (sql: string): void => {
    try {
      db.exec(sql);
    } catch {
      // Cột đã tồn tại
    }
  };
  addColumn("ALTER TABLE avatar_farm_profile_cache ADD COLUMN barn_animal_slots_json TEXT NOT NULL DEFAULT '[]'");
  addColumn("ALTER TABLE avatar_farm_profile_cache ADD COLUMN pond_animal_slots_json TEXT NOT NULL DEFAULT '[]'");
  addColumn("ALTER TABLE avatar_farm_profile_cache ADD COLUMN animal_slots_json TEXT NOT NULL DEFAULT '[]'");
  addColumn('ALTER TABLE avatar_accounts ADD COLUMN cached_xu INTEGER');
  addColumn('ALTER TABLE avatar_accounts ADD COLUMN cached_luong INTEGER');
  addColumn('ALTER TABLE avatar_accounts ADD COLUMN cached_luong_khoa INTEGER');
  addColumn('ALTER TABLE avatar_accounts ADD COLUMN cached_player_level INTEGER');
  addColumn('ALTER TABLE avatar_accounts ADD COLUMN cached_farm_level INTEGER');
  addColumn('ALTER TABLE avatar_accounts ADD COLUMN cached_metrics_at INTEGER');
  addColumn('ALTER TABLE avatar_automation_state ADD COLUMN fishing_config_json TEXT');

  // Nâng cấp CHECK constraint cho avatar_automation_state nếu chưa hỗ trợ auto_fishing
  const stateTable = db
    .prepare<[string], { sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name = ?",
    )
    .get('avatar_automation_state');
  if (stateTable && !stateTable.sql.includes('auto_fishing')) {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`
        ALTER TABLE avatar_automation_state RENAME TO _avatar_automation_state_old;
        CREATE TABLE avatar_automation_state (
          account_id              INTEGER PRIMARY KEY
                                  REFERENCES avatar_accounts(id) ON DELETE CASCADE,
          desired_mode            TEXT NOT NULL DEFAULT 'off'
                                  CHECK (desired_mode IN ('off', 'auto_farm', 'find_npc', 'auto_fishing')),
          find_npc_config_json    TEXT,
          fishing_config_json     TEXT,
          current_map             INTEGER,
          current_area            INTEGER,
          location_observed_at    INTEGER,
          updated_at              INTEGER NOT NULL,
          CHECK (
            (current_map IS NULL AND current_area IS NULL AND location_observed_at IS NULL)
            OR
            (current_map IS NOT NULL AND current_area IS NOT NULL AND location_observed_at IS NOT NULL)
          )
        );
        INSERT INTO avatar_automation_state SELECT * FROM _avatar_automation_state_old;
        DROP TABLE _avatar_automation_state_old;
      `);
    })();
    db.pragma('foreign_keys = ON');
  }

  return db;
}
