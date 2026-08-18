-- Migration chạy lúc khởi động. Mọi câu lệnh phải idempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,   -- đã lowercase + trim
  password_hash TEXT NOT NULL,          -- argon2id
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS web_sessions (
  id_hash    TEXT PRIMARY KEY,          -- SHA-256 của session id, không lưu id gốc
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_web_sessions_user ON web_sessions(user_id);

CREATE TABLE IF NOT EXISTS avatar_accounts (
  id               INTEGER PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label            TEXT NOT NULL,
  game_user        TEXT NOT NULL,
  game_pass_enc    TEXT NOT NULL,       -- v1:<iv>:<tag>:<ciphertext>
  host             TEXT NOT NULL,
  port             INTEGER NOT NULL,
  device_json      TEXT,                -- DeviceProfile, NULL = sinh mặc định
  auto_enabled     INTEGER NOT NULL DEFAULT 0,
  auto_config_json TEXT,                -- AutoFarmConfig
  cached_xu        INTEGER,
  cached_luong     INTEGER,
  cached_luong_khoa INTEGER,
  cached_player_level INTEGER,
  cached_farm_level INTEGER,
  cached_metrics_at INTEGER,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_avatar_accounts_user ON avatar_accounts(user_id);

CREATE TABLE IF NOT EXISTS avatar_farm_profile_cache (
  account_id        INTEGER PRIMARY KEY
                    REFERENCES avatar_accounts(id) ON DELETE CASCADE,
  farm_id           INTEGER,
  cell_indices_json TEXT NOT NULL DEFAULT '[]',
  animal_slots_json TEXT NOT NULL DEFAULT '[]',
  barn_animal_slots_json TEXT NOT NULL DEFAULT '[]',
  pond_animal_slots_json TEXT NOT NULL DEFAULT '[]',
  seed_catalog_json TEXT NOT NULL DEFAULT '[]',
  cells_observed_at INTEGER,
  seeds_observed_at INTEGER,
  updated_at        INTEGER NOT NULL
);
