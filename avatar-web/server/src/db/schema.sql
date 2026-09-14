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

CREATE TABLE IF NOT EXISTS avatar_shop_cache (
  account_id          INTEGER PRIMARY KEY
                      REFERENCES avatar_accounts(id) ON DELETE CASCADE,
  own_snapshot_json   TEXT,
  market_snapshot_json TEXT,
  price_rules_json    TEXT,
  produce_json        TEXT,
  own_observed_at     INTEGER,
  market_observed_at  INTEGER,
  rules_observed_at   INTEGER,
  produce_observed_at INTEGER,
  updated_at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS avatar_runtime_snapshot_cache (
  account_id  INTEGER PRIMARY KEY
              REFERENCES avatar_accounts(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  captured_at  INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS avatar_shop_transactions (
  id              TEXT PRIMARY KEY,
  account_id      INTEGER NOT NULL
                  REFERENCES avatar_accounts(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  kind            TEXT NOT NULL,
  status          TEXT NOT NULL,
  request_json    TEXT NOT NULL,
  before_json     TEXT,
  result_json     TEXT,
  error_code      TEXT,
  error_message   TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  completed_at    INTEGER,
  UNIQUE(account_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_avatar_shop_transactions_account_created
  ON avatar_shop_transactions(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_avatar_shop_transactions_account_status
  ON avatar_shop_transactions(account_id, status);

-- Trạng thái automation 1-1 với account: desired mode là nguồn sự thật cho
-- bootstrap sau restart. Ba cột location nguyên tố cùng nhau hoặc cùng NULL.
CREATE TABLE IF NOT EXISTS avatar_automation_state (
  account_id              INTEGER PRIMARY KEY
                          REFERENCES avatar_accounts(id) ON DELETE CASCADE,
  desired_mode            TEXT NOT NULL DEFAULT 'off'
                          CHECK (desired_mode IN ('off', 'auto_farm', 'find_npc', 'auto_fishing', 'auto_fisherman_quest')),
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

-- Backfill idempotent: account legacy auto_enabled=1 -> desired auto_farm.
INSERT INTO avatar_automation_state (account_id, desired_mode, updated_at)
SELECT id,
       CASE WHEN auto_enabled = 1 THEN 'auto_farm' ELSE 'off' END,
       updated_at
FROM avatar_accounts
WHERE 1
ON CONFLICT(account_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS avatar_daily_fishing_statistics (
  account_id INTEGER NOT NULL REFERENCES avatar_accounts(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  fish_id INTEGER NOT NULL CHECK (fish_id >= 0),
  catch_count INTEGER NOT NULL CHECK (catch_count >= 1),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, local_date, fish_id),
  CHECK (local_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);

CREATE INDEX IF NOT EXISTS idx_avatar_daily_fishing_account_date
  ON avatar_daily_fishing_statistics(account_id, local_date);

CREATE TABLE IF NOT EXISTS avatar_ml_fishing_statistics (
  account_id INTEGER PRIMARY KEY REFERENCES avatar_accounts(id) ON DELETE CASCADE,
  total_attempts INTEGER NOT NULL DEFAULT 0 CHECK (total_attempts >= 0),
  success_catches INTEGER NOT NULL DEFAULT 0 CHECK (success_catches >= 0),
  updated_at INTEGER NOT NULL
);
