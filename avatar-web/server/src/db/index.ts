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
  return db;
}
