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
