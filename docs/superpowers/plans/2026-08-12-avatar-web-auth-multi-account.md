# Xác thực người dùng và quản lý nhiều tài khoản avatar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến `avatar-web` từ công cụ một-phiên thành ứng dụng web có tài khoản người dùng, quản lý nhiều tài khoản game avatar, mỗi tài khoản chạy auto-farm 24/7 trên server.

**Architecture:** Một process Node giữ toàn bộ: REST (Express), WebSocket (`ws`), và mọi phiên TCP tới server game. SQLite (`better-sqlite3`) lưu người dùng, phiên web, và tài khoản avatar (mật khẩu game mã hoá AES-256-GCM). `SessionManager` giữ `Map<accountId, AvatarSession>`; mỗi `AvatarSession` bọc một `GameClient` + `AutoFarm` + `MacroRunner` sẵn có. Web React chuyển sang `react-router-dom` với 4 route: `/login`, `/register`, `/accounts`, `/accounts/:id`.

**Tech Stack:** Node 22 + TypeScript (ESM, `NodeNext`), Express 4, `ws`, `better-sqlite3`, `argon2`, `tsx`, `node:test`; React 18 + Vite 6 + `react-router-dom` 6.

**Spec:** [docs/superpowers/specs/2026-08-12-avatar-web-auth-multi-account-design.md](../specs/2026-08-12-avatar-web-auth-multi-account-design.md)

## Global Constraints

- Ngôn ngữ của mọi comment, chuỗi UI, thông báo lỗi hướng tới người dùng: **tiếng Việt**. Bám sát giọng văn hiện có trong `server/src/` và `web/src/`.
- **Không sửa logic** trong `server/src/proto/`, `server/src/game/`, `server/src/autoFarm.ts`, `server/src/macro.ts`. Chỉ được đọc và bọc lại.
- **Không viết test tự động** cho `proto/` và `game/` — chúng chỉ có nghĩa khi nói chuyện với server game thật.
- **Bất biến API:** response không bao giờ chứa mật khẩu game, kể cả dạng đã mã hoá. Chỉ có cờ `hasPassword: boolean`.
- **Bất biến DB:** `web_sessions` chỉ lưu SHA-256 của session id, không bao giờ lưu id gốc.
- **Bất biến quyền:** mọi thao tác trên `:id` phải xác nhận `avatar_accounts.user_id === req.user.id`, kiểm ở REST lẫn WS subscribe.
- **Thứ tự ghi:** `auto/start` và `auto/stop` ghi DB **trước**, rồi mới tác động vào phiên.
- Server **từ chối khởi động** nếu thiếu `MASTER_KEY` hoặc `INVITE_CODE`.
- TypeScript `strict: true` đã bật — giữ nguyên, không thêm `any` để lách.
- Mọi task kết thúc bằng một commit. Chạy `npm run typecheck` trong `server/` trước mỗi commit phía server.

## Cấu trúc file

**Server — tạo mới:**

| File | Trách nhiệm |
|---|---|
| `server/src/config.ts` | đọc + kiểm tra env, hằng số server game mặc định |
| `server/src/crypto/secretBox.ts` | AES-256-GCM encrypt/decrypt với AAD |
| `server/src/db/schema.sql` | DDL |
| `server/src/db/index.ts` | mở SQLite, bật pragma, chạy schema |
| `server/src/auth/password.ts` | argon2id hash/verify + verify giả chống dò email |
| `server/src/auth/users.ts` | CRUD bảng `users` |
| `server/src/auth/sessions.ts` | tạo/tra/gia hạn/xoá phiên web |
| `server/src/auth/rateLimit.ts` | bộ đếm in-memory theo khoá |
| `server/src/auth/middleware.ts` | cookie, `requireAuth`, xác thực cho WS |
| `server/src/auth/routes.ts` | `/api/auth/*` |
| `server/src/accounts/repo.ts` | CRUD `avatar_accounts`, mã hoá nằm trong đây |
| `server/src/accounts/routes.ts` | `/api/accounts` CRUD |
| `server/src/session/avatarSession.ts` | GameClient + AutoFarm + MacroRunner + ring buffer + backoff |
| `server/src/session/manager.ts` | `Map<accountId, AvatarSession>`, bootstrap |
| `server/src/session/routes.ts` | `/api/accounts/:id/*` điều khiển phiên |
| `server/src/ws.ts` | WebSocket có xác thực, định tuyến theo accountId |
| `server/src/test-helpers.ts` | dựng DB tạm + app tạm cho test |
| `server/src/tools/gen-key.ts` | sinh `MASTER_KEY` |

**Server — sửa:** `server/src/index.ts` (viết lại, chỉ lắp ráp), `server/package.json`, `server/tsconfig.json`.
**Server — xoá:** `server/src/account.ts`.

**Web — tạo mới:** `web/src/api.ts`, `web/src/ws.ts`, `web/src/types.ts`, `web/src/auth/{useAuth.tsx,LoginPage.tsx,RegisterPage.tsx}`, `web/src/accounts/{AccountsPage.tsx,AccountDetailPage.tsx}`, `web/src/accounts/panels/{StatusPanel,AutoFarmPanel,AssetsPanel,LogPanel,DebugPanel}.tsx`.
**Web — sửa:** `web/src/main.tsx`, `web/src/styles.css`, `web/package.json`.
**Web — xoá:** `web/src/App.tsx` (nội dung chuyển vào các panel).

---

## Task 1: Bộ khung test, cấu hình, và `secretBox`

Task này gánh toàn bộ phần dựng khung (deps, script test, tsconfig) vì `secretBox` là thứ đầu tiên cần chúng.

**Files:**
- Modify: `server/package.json`
- Modify: `server/tsconfig.json`
- Create: `server/src/config.ts`
- Create: `server/src/tools/gen-key.ts`
- Create: `server/src/crypto/secretBox.ts`
- Test: `server/src/crypto/secretBox.test.ts`
- Test: `server/src/config.test.ts`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `loadConfig(env?: NodeJS.ProcessEnv): Config`
  - `interface Config { port: number; masterKey: Buffer; inviteCode: string; maxSessions: number; isProduction: boolean; dbPath: string }`
  - `DEFAULT_GAME_SERVER: { host: string; port: number }`
  - `encryptSecret(key: Buffer, aad: string, plain: string): string`
  - `decryptSecret(key: Buffer, aad: string, boxed: string): string`

- [x] **Step 1: Thêm dependency và script**

```bash
cd server
npm install better-sqlite3@^12.11.1 argon2@^0.44.0
npm install -D @types/better-sqlite3@^7.6.12
```

Cả hai là native module. Bản `better-sqlite3@11` và `argon2@0.41` **không có prebuilt
cho Node 25** nên rơi vào build bằng node-gyp, và trên máy này Python của Homebrew đang
hỏng (`pyexpat` link nhầm `libexpat` hệ thống) nên build thất bại. Hai bản trên có
prebuilt sẵn, cài xong chạy được ngay. `argon2@0.44` mang sẵn `argon2.d.cts` với
**named export** — dùng `import { argon2id, hash, verify, type Options } from 'argon2'`,
không có default export.

Sửa khối `"scripts"` trong `server/package.json` thành:

```json
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "build": "tsc -p tsconfig.json && cp src/db/schema.sql dist/db/schema.sql",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "node --import tsx --test \"src/**/*.test.ts\"",
    "gen-key": "tsx src/tools/gen-key.ts"
  },
```

- [x] **Step 2: Loại test khỏi bản build**

Thêm `"exclude"` vào `server/tsconfig.json` (giữ nguyên mọi thứ khác):

```json
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/test-helpers.ts"]
```

- [x] **Step 3: Viết test cho `config`**

`server/src/config.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { loadConfig } from './config.js';

const KEY_B64 = crypto.randomBytes(32).toString('base64');

test('loadConfig đọc đủ biến bắt buộc', () => {
  const cfg = loadConfig({ MASTER_KEY: KEY_B64, INVITE_CODE: 'moi-vao' });
  assert.equal(cfg.masterKey.length, 32);
  assert.equal(cfg.inviteCode, 'moi-vao');
  assert.equal(cfg.port, 8787);
  assert.equal(cfg.maxSessions, 20);
  assert.equal(cfg.isProduction, false);
});

test('thiếu MASTER_KEY thì ném lỗi', () => {
  assert.throws(() => loadConfig({ INVITE_CODE: 'x' }), /MASTER_KEY/);
});

test('thiếu INVITE_CODE thì ném lỗi', () => {
  assert.throws(() => loadConfig({ MASTER_KEY: KEY_B64 }), /INVITE_CODE/);
});

test('MASTER_KEY không đủ 32 byte thì ném lỗi', () => {
  const short = crypto.randomBytes(16).toString('base64');
  assert.throws(() => loadConfig({ MASTER_KEY: short, INVITE_CODE: 'x' }), /32 byte/);
});

test('NODE_ENV=production bật isProduction', () => {
  const cfg = loadConfig({ MASTER_KEY: KEY_B64, INVITE_CODE: 'x', NODE_ENV: 'production' });
  assert.equal(cfg.isProduction, true);
});
```

- [x] **Step 4: Viết test cho `secretBox`**

`server/src/crypto/secretBox.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { encryptSecret, decryptSecret } from './secretBox.js';

const key = crypto.randomBytes(32);

test('khứ hồi trả lại đúng chuỗi gốc', () => {
  const boxed = encryptSecret(key, '7', 'mat-khau-game');
  assert.notEqual(boxed, 'mat-khau-game');
  assert.equal(decryptSecret(key, '7', boxed), 'mat-khau-game');
});

test('bản mã có tiền tố phiên bản v1 và 4 phần', () => {
  const boxed = encryptSecret(key, '7', 'abc');
  const parts = boxed.split(':');
  assert.equal(parts.length, 4);
  assert.equal(parts[0], 'v1');
});

test('mỗi lần mã hoá dùng IV khác nhau', () => {
  assert.notEqual(encryptSecret(key, '7', 'abc'), encryptSecret(key, '7', 'abc'));
});

test('đổi AAD (chép bản mã sang account khác) thì giải mã thất bại', () => {
  const boxed = encryptSecret(key, '7', 'mat-khau-game');
  assert.throws(() => decryptSecret(key, '8', boxed));
});

test('sai khoá thì giải mã thất bại', () => {
  const boxed = encryptSecret(key, '7', 'mat-khau-game');
  assert.throws(() => decryptSecret(crypto.randomBytes(32), '7', boxed));
});

test('bản mã bị sửa một byte thì giải mã thất bại', () => {
  const [v, iv, tag, ct] = encryptSecret(key, '7', 'mat-khau-game').split(':');
  const buf = Buffer.from(ct, 'base64');
  buf[0] ^= 0xff;
  assert.throws(() => decryptSecret(key, '7', [v, iv, tag, buf.toString('base64')].join(':')));
});

test('định dạng lạ thì ném lỗi rõ ràng', () => {
  assert.throws(() => decryptSecret(key, '7', 'v2:a:b:c'), /không nhận ra/);
  assert.throws(() => decryptSecret(key, '7', 'rác'), /không nhận ra/);
});
```

- [x] **Step 5: Chạy test để xác nhận thất bại**

Run: `cd server && npm test`
Expected: FAIL — `Cannot find module './config.js'` và `'./secretBox.js'`.

- [x] **Step 6: Viết `config.ts`**

`server/src/config.ts`:

```ts
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
```

- [x] **Step 7: Viết `crypto/secretBox.ts`**

`server/src/crypto/secretBox.ts`:

```ts
import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const VERSION = 'v1';

/**
 * Mã hoá một bí mật ngắn (mật khẩu game) bằng AES-256-GCM.
 *
 * `aad` là id bản ghi `avatar_accounts`. Buộc nó vào bản mã để kẻ có quyền ghi
 * DB không thể chép bản mã của tài khoản này sang tài khoản khác rồi bắt ứng
 * dụng giải mã hộ.
 *
 * Định dạng: `v1:<iv_b64>:<tag_b64>:<ct_b64>` — tiền tố phiên bản để sau này
 * xoay khoá được mà vẫn đọc được bản cũ.
 */
export function encryptSecret(key: Buffer, aad: string, plain: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

/** Giải mã. Ném lỗi nếu sai khoá, sai AAD, hoặc bản mã bị sửa. */
export function decryptSecret(key: Buffer, aad: string, boxed: string): string {
  const parts = boxed.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('không nhận ra định dạng bản mã');
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
```

- [x] **Step 8: Viết `tools/gen-key.ts`**

`server/src/tools/gen-key.ts`:

```ts
import crypto from 'node:crypto';

// In ra thẳng dòng để dán vào .env.
console.log(`MASTER_KEY=${crypto.randomBytes(32).toString('base64')}`);
```

- [x] **Step 9: Chạy test để xác nhận đã pass**

Run: `cd server && npm test`
Expected: PASS — 12 test.

- [x] **Step 10: Kiểm tra `gen-key` chạy được**

Run: `cd server && npm run gen-key`
Expected: một dòng `MASTER_KEY=<44 ký tự base64>`.

- [x] **Step 11: Typecheck và commit**

```bash
cd server && npm run typecheck
git add server/package.json server/package-lock.json server/tsconfig.json server/src/config.ts server/src/config.test.ts server/src/crypto server/src/tools/gen-key.ts
git commit -m "feat(server): cấu hình từ env và mã hoá bí mật AES-256-GCM"
```

---

## Task 2: Tầng SQLite

**Files:**
- Create: `server/src/db/schema.sql`
- Create: `server/src/db/index.ts`
- Create: `server/src/test-helpers.ts`
- Test: `server/src/db/index.test.ts`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `type Db = Database.Database` (từ `better-sqlite3`)
  - `openDb(file: string): Db` — bật `foreign_keys`, chạy schema, idempotent
  - `newTestDb(): Db` — trong `test-helpers.ts`, DB `:memory:` đã migrate

- [x] **Step 1: Viết test**

`server/src/db/index.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { newTestDb } from '../test-helpers.js';

test('tạo đủ 3 bảng', () => {
  const db = newTestDb();
  const names = db
    .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((r) => r.name);
  for (const t of ['users', 'web_sessions', 'avatar_accounts']) {
    assert.ok(names.includes(t), `thiếu bảng ${t}`);
  }
  db.close();
});

test('bật ràng buộc khoá ngoại', () => {
  const db = newTestDb();
  const [{ foreign_keys: on }] = db.pragma('foreign_keys') as Array<{ foreign_keys: number }>;
  assert.equal(on, 1);
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO avatar_accounts
             (user_id, label, game_user, game_pass_enc, host, port, created_at, updated_at)
           VALUES (999, 'a', 'b', 'c', 'h', 1, 0, 0)`,
        )
        .run(),
    /FOREIGN KEY/,
  );
  db.close();
});

test('xoá user thì xoá luôn phiên web và tài khoản avatar', () => {
  const db = newTestDb();
  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (1, ?, ?, 0)').run(
    'a@b.c',
    'h',
  );
  db.prepare('INSERT INTO web_sessions (id_hash, user_id, created_at, expires_at) VALUES (?,1,0,0)').run(
    'hash',
  );
  db.prepare(
    `INSERT INTO avatar_accounts
       (user_id, label, game_user, game_pass_enc, host, port, created_at, updated_at)
     VALUES (1, 'nhãn', 'u', 'enc', 'h', 19129, 0, 0)`,
  ).run();

  db.prepare('DELETE FROM users WHERE id = 1').run();

  assert.equal(db.prepare('SELECT count(*) AS n FROM web_sessions').get<{ n: number }>()!.n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM avatar_accounts').get<{ n: number }>()!.n, 0);
  db.close();
});

test('email trùng bị chặn', () => {
  const db = newTestDb();
  const ins = db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, 0)');
  ins.run('a@b.c', 'h');
  assert.throws(() => ins.run('a@b.c', 'h2'), /UNIQUE/);
  db.close();
});

test('chạy migration hai lần không lỗi', () => {
  const db = newTestDb();
  assert.doesNotThrow(() => newTestDb());
  db.close();
});
```

- [x] **Step 2: Chạy test để xác nhận thất bại**

Run: `cd server && npm test`
Expected: FAIL — `Cannot find module '../test-helpers.js'`.

- [x] **Step 3: Viết `db/schema.sql`**

`server/src/db/schema.sql`:

```sql
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
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_avatar_accounts_user ON avatar_accounts(user_id);
```

- [x] **Step 4: Viết `db/index.ts`**

`server/src/db/index.ts`:

```ts
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
  return db;
}
```

- [x] **Step 5: Viết `test-helpers.ts`**

`server/src/test-helpers.ts`:

```ts
import crypto from 'node:crypto';

import { openDb, type Db } from './db/index.js';

/** DB trong RAM đã migrate — mỗi test một cái, không dọn dẹp gì thêm. */
export function newTestDb(): Db {
  return openDb(':memory:');
}

/** Khoá 32 byte cố định cho test không cần ngẫu nhiên. */
export const TEST_KEY = crypto.createHash('sha256').update('test-master-key').digest();
```

- [x] **Step 6: Chạy test để xác nhận pass**

Run: `cd server && npm test`
Expected: PASS — toàn bộ test của Task 1 và Task 2.

- [x] **Step 7: Typecheck và commit**

```bash
cd server && npm run typecheck
git add server/src/db server/src/test-helpers.ts
git commit -m "feat(server): schema SQLite và tầng mở DB"
```

---

## Task 3: Mật khẩu và người dùng

**Files:**
- Create: `server/src/auth/password.ts`
- Create: `server/src/auth/users.ts`
- Test: `server/src/auth/password.test.ts`
- Test: `server/src/auth/users.test.ts`

**Interfaces:**
- Consumes: `newTestDb()` từ `test-helpers.ts`, `Db` từ `db/index.ts`.
- Produces:
  - `hashPassword(plain: string): Promise<string>`
  - `verifyPassword(hash: string, plain: string): Promise<boolean>`
  - `verifyDummy(plain: string): Promise<void>`
  - `MIN_PASSWORD_LENGTH: number` (= 10)
  - `interface User { id: number; email: string; passwordHash: string; createdAt: number }`
  - `normalizeEmail(raw: string): string`
  - `createUser(db: Db, email: string, passwordHash: string, now?: number): User`
  - `findUserByEmail(db: Db, email: string): User | null`
  - `findUserById(db: Db, id: number): User | null`

- [x] **Step 1: Viết test cho `password`**

`server/src/auth/password.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { hashPassword, verifyPassword, verifyDummy, MIN_PASSWORD_LENGTH } from './password.js';

test('hash rồi verify đúng mật khẩu', async () => {
  const h = await hashPassword('mat-khau-du-dai');
  assert.ok(h.startsWith('$argon2id$'));
  assert.equal(await verifyPassword(h, 'mat-khau-du-dai'), true);
});

test('sai mật khẩu thì verify trả false', async () => {
  const h = await hashPassword('mat-khau-du-dai');
  assert.equal(await verifyPassword(h, 'mat-khau-du-daj'), false);
});

test('hash cùng một mật khẩu hai lần ra hai chuỗi khác nhau', async () => {
  assert.notEqual(await hashPassword('mat-khau-du-dai'), await hashPassword('mat-khau-du-dai'));
});

test('hash hỏng thì verify trả false chứ không ném', async () => {
  assert.equal(await verifyPassword('không-phải-hash', 'x'), false);
});

test('verifyDummy chạy được và không ném', async () => {
  await verifyDummy('bất kỳ');
});

test('độ dài tối thiểu là 10', () => {
  assert.equal(MIN_PASSWORD_LENGTH, 10);
});
```

- [x] **Step 2: Viết test cho `users`**

`server/src/auth/users.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { newTestDb } from '../test-helpers.js';
import { createUser, findUserByEmail, findUserById, normalizeEmail } from './users.js';

test('normalizeEmail hạ chữ và cắt khoảng trắng', () => {
  assert.equal(normalizeEmail('  Ai@Bee.Com  '), 'ai@bee.com');
});

test('tạo rồi tra lại được theo email và id', () => {
  const db = newTestDb();
  const u = createUser(db, 'Ai@Bee.Com', 'hash', 1000);
  assert.equal(u.email, 'ai@bee.com');
  assert.equal(u.createdAt, 1000);
  assert.deepEqual(findUserByEmail(db, ' AI@BEE.COM '), u);
  assert.deepEqual(findUserById(db, u.id), u);
  db.close();
});

test('email không tồn tại trả null', () => {
  const db = newTestDb();
  assert.equal(findUserByEmail(db, 'khong@co.com'), null);
  assert.equal(findUserById(db, 12345), null);
  db.close();
});

test('email trùng (khác hoa thường) bị chặn', () => {
  const db = newTestDb();
  createUser(db, 'ai@bee.com', 'h', 0);
  assert.throws(() => createUser(db, 'AI@BEE.COM', 'h2', 0), /UNIQUE/);
  db.close();
});
```

- [x] **Step 3: Chạy test để xác nhận thất bại**

Run: `cd server && npm test`
Expected: FAIL — `Cannot find module './password.js'` và `'./users.js'`.

- [x] **Step 4: Viết `auth/password.ts`**

`server/src/auth/password.ts`:

```ts
import argon2 from 'argon2';

/** Không đặt luật ký tự đặc biệt — độ dài là thứ thực sự có ích. */
export const MIN_PASSWORD_LENGTH = 10;

const OPTIONS: argon2.Options = { type: argon2.argon2id };

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // Hash hỏng trong DB không phải là "đăng nhập thành công".
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Verify giả trên một hash cố định, dùng khi email không tồn tại.
 *
 * Không có nó thì đường "email không tồn tại" trả về gần như tức thì còn đường
 * "sai mật khẩu" tốn cả trăm ms — chênh lệch đó đủ để dò ra email nào có thật.
 */
export async function verifyDummy(plain: string): Promise<void> {
  dummyHash ??= hashPassword('mat-khau-gia-de-can-bang-thoi-gian');
  await verifyPassword(await dummyHash, plain);
}
```

- [x] **Step 5: Viết `auth/users.ts`**

`server/src/auth/users.ts`:

```ts
import type { Db } from '../db/index.js';

export interface User {
  id: number;
  email: string;
  passwordHash: string;
  createdAt: number;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: number;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  passwordHash: r.password_hash,
  createdAt: r.created_at,
});

/** Chuẩn hoá trước khi ghi VÀ trước khi tra, nếu không thì UNIQUE vô nghĩa. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function createUser(db: Db, email: string, passwordHash: string, now = Date.now()): User {
  const normalized = normalizeEmail(email);
  const info = db
    .prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
    .run(normalized, passwordHash, now);
  return { id: Number(info.lastInsertRowid), email: normalized, passwordHash, createdAt: now };
}

export function findUserByEmail(db: Db, email: string): User | null {
  const row = db
    .prepare<[string], UserRow>('SELECT * FROM users WHERE email = ?')
    .get(normalizeEmail(email));
  return row ? toUser(row) : null;
}

export function findUserById(db: Db, id: number): User | null {
  const row = db.prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?').get(id);
  return row ? toUser(row) : null;
}
```

- [x] **Step 6: Chạy test để xác nhận pass**

Run: `cd server && npm test`
Expected: PASS.

- [x] **Step 7: Typecheck và commit**

```bash
cd server && npm run typecheck
git add server/src/auth/password.ts server/src/auth/password.test.ts server/src/auth/users.ts server/src/auth/users.test.ts
git commit -m "feat(server): hash mật khẩu argon2id và CRUD người dùng"
```

---

## Task 4: Phiên web

**Files:**
- Create: `server/src/auth/sessions.ts`
- Test: `server/src/auth/sessions.test.ts`

**Interfaces:**
- Consumes: `Db`, `createUser` từ Task 3.
- Produces:
  - `SESSION_TTL_MS: number` (30 ngày)
  - `interface WebSession { userId: number; expiresAt: number }`
  - `hashSessionId(rawId: string): string`
  - `createSession(db: Db, userId: number, now?: number): string` — trả id gốc
  - `lookupSession(db: Db, rawId: string, now?: number): WebSession | null`
  - `renewSession(db: Db, rawId: string, now?: number): number | null` — trả `expiresAt` mới nếu có gia hạn
  - `destroySession(db: Db, rawId: string): void`
  - `purgeExpiredSessions(db: Db, now?: number): number`

- [x] **Step 1: Viết test**

`server/src/auth/sessions.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { newTestDb } from '../test-helpers.js';
import { createUser } from './users.js';
import {
  SESSION_TTL_MS,
  createSession,
  destroySession,
  hashSessionId,
  lookupSession,
  purgeExpiredSessions,
  renewSession,
} from './sessions.js';

function setup() {
  const db = newTestDb();
  const user = createUser(db, 'a@b.c', 'hash', 0);
  return { db, user };
}

test('tạo rồi tra lại được', () => {
  const { db, user } = setup();
  const raw = createSession(db, user.id, 1000);
  const found = lookupSession(db, raw, 2000);
  assert.deepEqual(found, { userId: user.id, expiresAt: 1000 + SESSION_TTL_MS });
  db.close();
});

test('DB chỉ chứa hash, không chứa id gốc', () => {
  const { db, user } = setup();
  const raw = createSession(db, user.id, 0);
  const rows = db.prepare<[], { id_hash: string }>('SELECT id_hash FROM web_sessions').all();
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].id_hash, raw);
  assert.equal(rows[0].id_hash, hashSessionId(raw));
  db.close();
});

test('id phiên đủ dài và là base64url', () => {
  const { db, user } = setup();
  const raw = createSession(db, user.id, 0);
  assert.ok(raw.length >= 43, `id quá ngắn: ${raw.length}`);
  assert.match(raw, /^[A-Za-z0-9_-]+$/);
  db.close();
});

test('phiên hết hạn trả null và bị xoá khỏi DB', () => {
  const { db, user } = setup();
  const raw = createSession(db, user.id, 0);
  assert.equal(lookupSession(db, raw, SESSION_TTL_MS + 1), null);
  assert.equal(db.prepare<[], { n: number }>('SELECT count(*) AS n FROM web_sessions').get()!.n, 0);
  db.close();
});

test('id không tồn tại trả null', () => {
  const { db } = setup();
  assert.equal(lookupSession(db, 'khong-co-that', 0), null);
  db.close();
});

test('gia hạn khi còn dưới nửa thời hạn', () => {
  const { db, user } = setup();
  const raw = createSession(db, user.id, 0);
  const late = SESSION_TTL_MS / 2 + 1000;
  const next = renewSession(db, raw, late);
  assert.equal(next, late + SESSION_TTL_MS);
  assert.equal(lookupSession(db, raw, late)!.expiresAt, late + SESSION_TTL_MS);
  db.close();
});

test('không gia hạn khi còn trên nửa thời hạn', () => {
  const { db, user } = setup();
  const raw = createSession(db, user.id, 0);
  assert.equal(renewSession(db, raw, 1000), null);
  assert.equal(lookupSession(db, raw, 1000)!.expiresAt, SESSION_TTL_MS);
  db.close();
});

test('xoá phiên thì tra không ra nữa', () => {
  const { db, user } = setup();
  const raw = createSession(db, user.id, 0);
  destroySession(db, raw);
  assert.equal(lookupSession(db, raw, 0), null);
  db.close();
});

test('purge dọn đúng những phiên đã hết hạn', () => {
  const { db, user } = setup();
  createSession(db, user.id, 0);
  const fresh = createSession(db, user.id, SESSION_TTL_MS);
  assert.equal(purgeExpiredSessions(db, SESSION_TTL_MS + 1), 1);
  assert.ok(lookupSession(db, fresh, SESSION_TTL_MS + 1));
  db.close();
});
```

- [x] **Step 2: Chạy test để xác nhận thất bại**

Run: `cd server && npm test`
Expected: FAIL — `Cannot find module './sessions.js'`.

- [x] **Step 3: Viết `auth/sessions.ts`**

`server/src/auth/sessions.ts`:

```ts
import crypto from 'node:crypto';

import type { Db } from '../db/index.js';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface WebSession {
  userId: number;
  expiresAt: number;
}

/**
 * DB chỉ lưu hash. Đọc trộm được bảng `web_sessions` vẫn không mạo danh được ai —
 * cùng lý do người ta không lưu mật khẩu dạng rõ.
 */
export function hashSessionId(rawId: string): string {
  return crypto.createHash('sha256').update(rawId).digest('hex');
}

export function createSession(db: Db, userId: number, now = Date.now()): string {
  const rawId = crypto.randomBytes(32).toString('base64url');
  db.prepare(
    'INSERT INTO web_sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(hashSessionId(rawId), userId, now, now + SESSION_TTL_MS);
  return rawId;
}

export function lookupSession(db: Db, rawId: string, now = Date.now()): WebSession | null {
  const idHash = hashSessionId(rawId);
  const row = db
    .prepare<[string], { user_id: number; expires_at: number }>(
      'SELECT user_id, expires_at FROM web_sessions WHERE id_hash = ?',
    )
    .get(idHash);
  if (!row) return null;
  if (row.expires_at <= now) {
    db.prepare('DELETE FROM web_sessions WHERE id_hash = ?').run(idHash);
    return null;
  }
  return { userId: row.user_id, expiresAt: row.expires_at };
}

/**
 * Gia hạn khi thời gian còn lại xuống dưới một nửa. Ghi lại cookie mỗi request
 * là thừa; để phiên chết đúng lúc người dùng đang dùng là phiền.
 */
export function renewSession(db: Db, rawId: string, now = Date.now()): number | null {
  const session = lookupSession(db, rawId, now);
  if (!session) return null;
  if (session.expiresAt - now > SESSION_TTL_MS / 2) return null;
  const expiresAt = now + SESSION_TTL_MS;
  db.prepare('UPDATE web_sessions SET expires_at = ? WHERE id_hash = ?').run(
    expiresAt,
    hashSessionId(rawId),
  );
  return expiresAt;
}

export function destroySession(db: Db, rawId: string): void {
  db.prepare('DELETE FROM web_sessions WHERE id_hash = ?').run(hashSessionId(rawId));
}

/** Dọn rác lúc khởi động — phiên hết hạn không tự biến mất. */
export function purgeExpiredSessions(db: Db, now = Date.now()): number {
  return db.prepare('DELETE FROM web_sessions WHERE expires_at <= ?').run(now).changes;
}
```

- [x] **Step 4: Chạy test để xác nhận pass**

Run: `cd server && npm test`
Expected: PASS.

- [x] **Step 5: Typecheck và commit**

```bash
cd server && npm run typecheck
git add server/src/auth/sessions.ts server/src/auth/sessions.test.ts
git commit -m "feat(server): phiên web lưu bằng hash, tự gia hạn"
```

---

## Task 5: Kho tài khoản avatar

**Files:**
- Create: `server/src/accounts/repo.ts`
- Test: `server/src/accounts/repo.test.ts`

**Interfaces:**
- Consumes: `Db`, `encryptSecret`/`decryptSecret` (Task 1), `DEFAULT_GAME_SERVER` (Task 1), `createUser` (Task 3), `TEST_KEY` (Task 2).
- Produces:
  - `interface AvatarAccount { id, userId, label, gameUser, host, port, device, autoEnabled, autoConfig, hasPassword, createdAt, updatedAt }` — **không có trường mật khẩu**
  - `interface CreateAccountInput { userId: number; label: string; gameUser: string; gamePass: string; host?: string; port?: number; device?: Partial<DeviceProfile> }`
  - `interface UpdateAccountInput { label?: string; gameUser?: string; gamePass?: string; host?: string; port?: number; device?: Partial<DeviceProfile> | null }`
  - `createAccount(db, key: Buffer, input: CreateAccountInput, now?: number): AvatarAccount`
  - `listAccounts(db, userId: number): AvatarAccount[]`
  - `getAccount(db, userId: number, id: number): AvatarAccount | null`
  - `getAccountById(db, id: number): AvatarAccount | null`
  - `listAutoEnabled(db): AvatarAccount[]`
  - `updateAccount(db, key, userId, id, patch: UpdateAccountInput, now?): AvatarAccount | null`
  - `deleteAccount(db, userId: number, id: number): boolean`
  - `setAutoEnabled(db, id: number, enabled: boolean, autoConfig: unknown | null, now?): void`
  - `readGamePass(db, key: Buffer, id: number): string`

- [x] **Step 1: Viết test**

`server/src/accounts/repo.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { newTestDb, TEST_KEY } from '../test-helpers.js';
import { createUser } from '../auth/users.js';
import { DEFAULT_GAME_SERVER } from '../config.js';
import {
  createAccount,
  deleteAccount,
  getAccount,
  getAccountById,
  listAccounts,
  listAutoEnabled,
  readGamePass,
  setAutoEnabled,
  updateAccount,
} from './repo.js';

function setup() {
  const db = newTestDb();
  const a = createUser(db, 'a@b.c', 'h', 0);
  const b = createUser(db, 'b@b.c', 'h', 0);
  return { db, a, b };
}

test('tạo tài khoản, mặc định host/port từ config', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, {
    userId: a.id,
    label: 'chính',
    gameUser: 'NguoiChoi',
    gamePass: 'bimat',
  });
  assert.equal(acc.label, 'chính');
  assert.equal(acc.gameUser, 'NguoiChoi');
  assert.equal(acc.host, DEFAULT_GAME_SERVER.host);
  assert.equal(acc.port, DEFAULT_GAME_SERVER.port);
  assert.equal(acc.autoEnabled, false);
  assert.equal(acc.hasPassword, true);
  db.close();
});

test('bản ghi trả ra không chứa mật khẩu ở bất kỳ dạng nào', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, {
    userId: a.id,
    label: 'x',
    gameUser: 'u',
    gamePass: 'bimat',
  });
  const json = JSON.stringify(acc);
  assert.ok(!json.includes('bimat'));
  assert.ok(!json.includes('v1:'));
  assert.ok(!('gamePass' in acc));
  assert.ok(!('gamePassEnc' in acc));
  db.close();
});

test('mật khẩu giải mã lại được', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, {
    userId: a.id,
    label: 'x',
    gameUser: 'u',
    gamePass: 'bimat',
  });
  assert.equal(readGamePass(db, TEST_KEY, acc.id), 'bimat');
  db.close();
});

test('AAD buộc theo id: chép bản mã sang bản ghi khác thì đọc không ra', () => {
  const { db, a } = setup();
  const one = createAccount(db, TEST_KEY, { userId: a.id, label: '1', gameUser: 'u', gamePass: 'p1' });
  const two = createAccount(db, TEST_KEY, { userId: a.id, label: '2', gameUser: 'u', gamePass: 'p2' });
  const stolen = db
    .prepare<[number], { game_pass_enc: string }>('SELECT game_pass_enc FROM avatar_accounts WHERE id = ?')
    .get(one.id)!.game_pass_enc;
  db.prepare('UPDATE avatar_accounts SET game_pass_enc = ? WHERE id = ?').run(stolen, two.id);
  assert.throws(() => readGamePass(db, TEST_KEY, two.id));
  db.close();
});

test('danh sách chỉ trả tài khoản của chính chủ', () => {
  const { db, a, b } = setup();
  createAccount(db, TEST_KEY, { userId: a.id, label: 'của A', gameUser: 'ua', gamePass: 'p' });
  createAccount(db, TEST_KEY, { userId: b.id, label: 'của B', gameUser: 'ub', gamePass: 'p' });
  assert.deepEqual(listAccounts(db, a.id).map((x) => x.label), ['của A']);
  assert.deepEqual(listAccounts(db, b.id).map((x) => x.label), ['của B']);
  db.close();
});

test('user A không đọc/sửa/xoá được tài khoản của user B', () => {
  const { db, a, b } = setup();
  const accB = createAccount(db, TEST_KEY, { userId: b.id, label: 'của B', gameUser: 'ub', gamePass: 'p' });
  assert.equal(getAccount(db, a.id, accB.id), null);
  assert.equal(updateAccount(db, TEST_KEY, a.id, accB.id, { label: 'chiếm' }), null);
  assert.equal(deleteAccount(db, a.id, accB.id), false);
  assert.equal(getAccount(db, b.id, accB.id)!.label, 'của B');
  db.close();
});

test('sửa: gửi gamePass thì đổi, bỏ trống thì giữ nguyên', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: a.id, label: 'x', gameUser: 'u', gamePass: 'cu' });
  updateAccount(db, TEST_KEY, a.id, acc.id, { label: 'mới' });
  assert.equal(getAccount(db, a.id, acc.id)!.label, 'mới');
  assert.equal(readGamePass(db, TEST_KEY, acc.id), 'cu');

  updateAccount(db, TEST_KEY, a.id, acc.id, { gamePass: 'moi' });
  assert.equal(readGamePass(db, TEST_KEY, acc.id), 'moi');
  db.close();
});

test('device lưu và đọc lại đúng', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, {
    userId: a.id,
    label: 'x',
    gameUser: 'u',
    gamePass: 'p',
    device: { agent: 'abc', model: 'Pixel' },
  });
  assert.deepEqual(getAccount(db, a.id, acc.id)!.device, { agent: 'abc', model: 'Pixel' });
  updateAccount(db, TEST_KEY, a.id, acc.id, { device: null });
  assert.equal(getAccount(db, a.id, acc.id)!.device, undefined);
  db.close();
});

test('setAutoEnabled ghi cờ và config, listAutoEnabled đọc lại đúng', () => {
  const { db, a, b } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: a.id, label: 'x', gameUser: 'u', gamePass: 'p' });
  createAccount(db, TEST_KEY, { userId: b.id, label: 'y', gameUser: 'u', gamePass: 'p' });

  setAutoEnabled(db, acc.id, true, { harvest: true, intervalMs: 60000 });
  const on = listAutoEnabled(db);
  assert.equal(on.length, 1);
  assert.equal(on[0].id, acc.id);
  assert.deepEqual(on[0].autoConfig, { harvest: true, intervalMs: 60000 });

  setAutoEnabled(db, acc.id, false, null);
  assert.equal(listAutoEnabled(db).length, 0);
  assert.equal(getAccount(db, a.id, acc.id)!.autoEnabled, false);
  db.close();
});

test('getAccountById không lọc theo user — dùng cho bootstrap', () => {
  const { db, b } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: b.id, label: 'x', gameUser: 'u', gamePass: 'p' });
  assert.equal(getAccountById(db, acc.id)!.userId, b.id);
  assert.equal(getAccountById(db, 999), null);
  db.close();
});

test('xoá rồi thì không còn trong danh sách', () => {
  const { db, a } = setup();
  const acc = createAccount(db, TEST_KEY, { userId: a.id, label: 'x', gameUser: 'u', gamePass: 'p' });
  assert.equal(deleteAccount(db, a.id, acc.id), true);
  assert.equal(listAccounts(db, a.id).length, 0);
  assert.equal(deleteAccount(db, a.id, acc.id), false);
  db.close();
});
```

- [x] **Step 2: Chạy test để xác nhận thất bại**

Run: `cd server && npm test`
Expected: FAIL — `Cannot find module './repo.js'`.

- [x] **Step 3: Viết `accounts/repo.ts`**

`server/src/accounts/repo.ts`:

```ts
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
```

- [x] **Step 4: Chạy test để xác nhận pass**

Run: `cd server && npm test`
Expected: PASS.

- [x] **Step 5: Typecheck và commit**

```bash
cd server && npm run typecheck
git add server/src/accounts/repo.ts server/src/accounts/repo.test.ts
git commit -m "feat(server): kho tài khoản avatar, mật khẩu mã hoá buộc theo id"
```

---

## Task 6: Rate limit và middleware xác thực

**Files:**
- Create: `server/src/auth/rateLimit.ts`
- Create: `server/src/auth/middleware.ts`
- Test: `server/src/auth/rateLimit.test.ts`
- Test: `server/src/auth/middleware.test.ts`

**Interfaces:**
- Consumes: `Db`, `lookupSession`/`renewSession`/`SESSION_TTL_MS` (Task 4), `findUserById` (Task 3).
- Produces:
  - `interface RateLimiter { hit(key: string, now?: number): boolean; reset(key: string): void; }`
  - `createRateLimiter(opts: { max: number; windowMs: number }): RateLimiter`
  - `SESSION_COOKIE = 'sid'`
  - `parseCookies(header: string | undefined): Record<string, string>`
  - `setSessionCookie(res: Response, rawId: string, isProduction: boolean): void`
  - `clearSessionCookie(res: Response, isProduction: boolean): void`
  - `interface AuthUser { id: number; email: string }`
  - `interface AuthedRequest extends Request { user?: AuthUser }`
  - `authenticateCookieHeader(db: Db, header: string | undefined): AuthUser | null`
  - `makeRequireAuth(db: Db, isProduction: boolean): RequestHandler`

- [x] **Step 1: Viết test cho `rateLimit`**

`server/src/auth/rateLimit.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { createRateLimiter } from './rateLimit.js';

test('cho qua đúng `max` lần rồi chặn', () => {
  const rl = createRateLimiter({ max: 3, windowMs: 1000 });
  assert.equal(rl.hit('a', 0), true);
  assert.equal(rl.hit('a', 1), true);
  assert.equal(rl.hit('a', 2), true);
  assert.equal(rl.hit('a', 3), false);
});

test('các khoá khác nhau đếm riêng', () => {
  const rl = createRateLimiter({ max: 1, windowMs: 1000 });
  assert.equal(rl.hit('a', 0), true);
  assert.equal(rl.hit('b', 0), true);
  assert.equal(rl.hit('a', 0), false);
});

test('hết cửa sổ thì đếm lại từ đầu', () => {
  const rl = createRateLimiter({ max: 1, windowMs: 1000 });
  assert.equal(rl.hit('a', 0), true);
  assert.equal(rl.hit('a', 999), false);
  assert.equal(rl.hit('a', 1000), true);
});

test('reset xoá bộ đếm (dùng sau khi đăng nhập thành công)', () => {
  const rl = createRateLimiter({ max: 1, windowMs: 1000 });
  rl.hit('a', 0);
  rl.reset('a');
  assert.equal(rl.hit('a', 0), true);
});

test('không giữ khoá đã hết hạn mãi trong RAM', () => {
  const rl = createRateLimiter({ max: 5, windowMs: 1000 });
  for (let i = 0; i < 100; i += 1) rl.hit(`ip-${i}`, 0);
  rl.hit('mới', 10_000);
  assert.equal(rl.size(), 1);
});
```

- [x] **Step 2: Viết test cho `middleware`**

`server/src/auth/middleware.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { newTestDb } from '../test-helpers.js';
import { createUser } from './users.js';
import { createSession, SESSION_TTL_MS } from './sessions.js';
import { authenticateCookieHeader, parseCookies, SESSION_COOKIE } from './middleware.js';

test('parseCookies tách đúng nhiều cookie', () => {
  assert.deepEqual(parseCookies('sid=abc; theme=dark'), { sid: 'abc', theme: 'dark' });
});

test('parseCookies giải mã giá trị và chịu được header rỗng', () => {
  assert.deepEqual(parseCookies('sid=a%2Fb'), { sid: 'a/b' });
  assert.deepEqual(parseCookies(undefined), {});
  assert.deepEqual(parseCookies(''), {});
});

test('cookie hợp lệ trả về người dùng', () => {
  const db = newTestDb();
  const u = createUser(db, 'a@b.c', 'h', 0);
  const raw = createSession(db, u.id);
  assert.deepEqual(authenticateCookieHeader(db, `${SESSION_COOKIE}=${raw}`), {
    id: u.id,
    email: 'a@b.c',
  });
  db.close();
});

test('không cookie, cookie rác, hoặc phiên hết hạn đều trả null', () => {
  const db = newTestDb();
  const u = createUser(db, 'a@b.c', 'h', 0);
  const raw = createSession(db, u.id, 0);
  assert.equal(authenticateCookieHeader(db, undefined), null);
  assert.equal(authenticateCookieHeader(db, `${SESSION_COOKIE}=rác`), null);
  assert.equal(authenticateCookieHeader(db, `${SESSION_COOKIE}=${raw}`, SESSION_TTL_MS + 1), null);
  db.close();
});

test('phiên còn sống nhưng user đã bị xoá thì trả null', () => {
  const db = newTestDb();
  const u = createUser(db, 'a@b.c', 'h', 0);
  const raw = createSession(db, u.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  assert.equal(authenticateCookieHeader(db, `${SESSION_COOKIE}=${raw}`), null);
  db.close();
});
```

- [x] **Step 3: Chạy test để xác nhận thất bại**

Run: `cd server && npm test`
Expected: FAIL — `Cannot find module './rateLimit.js'` và `'./middleware.js'`.

- [x] **Step 4: Viết `auth/rateLimit.ts`**

`server/src/auth/rateLimit.ts`:

```ts
export interface RateLimiter {
  /** Trả `true` nếu còn được phép, `false` nếu đã vượt ngưỡng. */
  hit(key: string, now?: number): boolean;
  reset(key: string): void;
  /** Số khoá đang giữ — để test khẳng định bộ nhớ có được dọn. */
  size(): number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Bộ đếm cửa sổ cố định, in-memory. Mất khi restart — chấp nhận được: nó chống
 * dò mật khẩu tự động, không phải chống kẻ tấn công biết canh lúc server khởi động.
 */
export function createRateLimiter(opts: { max: number; windowMs: number }): RateLimiter {
  const buckets = new Map<string, Bucket>();

  const sweep = (now: number) => {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  };

  return {
    hit(key, now = Date.now()) {
      sweep(now);
      const bucket = buckets.get(key);
      if (!bucket) {
        buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
        return true;
      }
      bucket.count += 1;
      return bucket.count <= opts.max;
    },
    reset(key) {
      buckets.delete(key);
    },
    size() {
      return buckets.size;
    },
  };
}
```

- [x] **Step 5: Viết `auth/middleware.ts`**

`server/src/auth/middleware.ts`:

```ts
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { Db } from '../db/index.js';
import { lookupSession, renewSession, SESSION_TTL_MS } from './sessions.js';
import { findUserById } from './users.js';

export const SESSION_COOKIE = 'sid';

export interface AuthUser {
  id: number;
  email: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

/**
 * Tự tách cookie thay vì kéo thêm `cookie-parser`: cả ứng dụng đọc đúng một
 * cookie, và WebSocket cũng cần hàm này trên `req.headers.cookie` thô.
 */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[name] = part.slice(i + 1).trim();
    }
  }
  return out;
}

export function setSessionCookie(res: Response, rawId: string, isProduction: boolean): void {
  res.cookie(SESSION_COOKIE, rawId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response, isProduction: boolean): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
  });
}

/**
 * Xác thực từ header cookie thô. Dùng chung cho REST và WebSocket — WS không đi
 * qua middleware của Express nhưng phải áp đúng một luật.
 */
export function authenticateCookieHeader(
  db: Db,
  header: string | undefined,
  now = Date.now(),
): AuthUser | null {
  const rawId = parseCookies(header)[SESSION_COOKIE];
  if (!rawId) return null;
  const session = lookupSession(db, rawId, now);
  if (!session) return null;
  const user = findUserById(db, session.userId);
  // Phiên mồ côi không nên tồn tại (khoá ngoại CASCADE), nhưng nếu có thì nó
  // không được tính là đã xác thực.
  return user ? { id: user.id, email: user.email } : null;
}

export function makeRequireAuth(db: Db, isProduction: boolean): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.cookie;
    const user = authenticateCookieHeader(db, header);
    if (!user) return res.status(401).json({ error: 'chưa đăng nhập' });

    const rawId = parseCookies(header)[SESSION_COOKIE];
    if (renewSession(db, rawId) !== null) setSessionCookie(res, rawId, isProduction);

    (req as AuthedRequest).user = user;
    next();
  };
}
```

- [x] **Step 6: Chạy test để xác nhận pass**

Run: `cd server && npm test`
Expected: PASS.

- [x] **Step 7: Typecheck và commit**

```bash
cd server && npm run typecheck
git add server/src/auth/rateLimit.ts server/src/auth/rateLimit.test.ts server/src/auth/middleware.ts server/src/auth/middleware.test.ts
git commit -m "feat(server): middleware xác thực bằng cookie và rate limit in-memory"
```

---

## Task 7: Route `/api/auth/*`

**Files:**
- Create: `server/src/auth/routes.ts`
- Modify: `server/src/test-helpers.ts`
- Test: `server/src/auth/routes.test.ts`

**Interfaces:**
- Consumes: mọi thứ từ Task 1–6.
- Produces:
  - `interface AuthDeps { db: Db; inviteCode: string; isProduction: boolean }`
  - `authRouter(deps: AuthDeps): Router` — mount tại `/api/auth`
  - trong `test-helpers.ts`: `startTestServer(app: Express): Promise<TestServer>` với
    `interface TestServer { url: string; close(): Promise<void>; fetch(path: string, init?: RequestInit & { json?: unknown }): Promise<TestResponse> }`
    và `interface TestResponse { status: number; body: any; cookies: string[] }`

- [x] **Step 1: Bổ sung helper dựng server test**

Thêm vào cuối `server/src/test-helpers.ts`:

```ts
import http from 'node:http';
import type { Express } from 'express';

export interface TestResponse {
  status: number;
  body: any;
  /** Giá trị `set-cookie` thô, để khẳng định HttpOnly/SameSite. */
  cookies: string[];
}

export interface TestServer {
  url: string;
  close(): Promise<void>;
  /**
   * `fetch` giữ cookie giữa các lần gọi — mô phỏng một trình duyệt, vì luồng
   * đăng nhập rồi gọi API chỉ có nghĩa khi cookie được mang theo.
   */
  fetch(path: string, init?: RequestInit & { json?: unknown }): Promise<TestResponse>;
  /** Xoá cookie đang giữ — mô phỏng trình duyệt khác. */
  clearCookies(): void;
}

export async function startTestServer(app: Express): Promise<TestServer> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  const url = `http://127.0.0.1:${port}`;
  const jar = new Map<string, string>();

  return {
    url,
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    },
    clearCookies() {
      jar.clear();
    },
    async fetch(path, init = {}) {
      const headers = new Headers(init.headers);
      if (init.json !== undefined) headers.set('content-type', 'application/json');
      if (jar.size > 0) {
        headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
      }
      const res = await fetch(`${url}${path}`, {
        ...init,
        headers,
        body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      });
      const cookies = res.headers.getSetCookie();
      for (const c of cookies) {
        const [pair] = c.split(';');
        const i = pair.indexOf('=');
        const name = pair.slice(0, i).trim();
        const value = pair.slice(i + 1).trim();
        if (value === '') jar.delete(name);
        else jar.set(name, value);
      }
      const text = await res.text();
      return {
        status: res.status,
        body: text ? JSON.parse(text) : null,
        cookies,
      };
    },
  };
}
```

- [x] **Step 2: Viết test cho route auth**

`server/src/auth/routes.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { newTestDb, startTestServer } from '../test-helpers.js';
import { authRouter } from './routes.js';

const INVITE = 'ma-moi-bi-mat';
const PASSWORD = 'mat-khau-du-dai';

async function setup() {
  const db = newTestDb();
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter({ db, inviteCode: INVITE, isProduction: false }));
  const server = await startTestServer(app);
  return { db, server };
}

test('đăng ký đúng mã mời rồi /me trả về chính mình', async () => {
  const { db, server } = await setup();
  const reg = await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'Ai@Bee.Com', password: PASSWORD, inviteCode: INVITE },
  });
  assert.equal(reg.status, 200);
  assert.deepEqual(reg.body, { id: 1, email: 'ai@bee.com' });

  const me = await server.fetch('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.email, 'ai@bee.com');

  await server.close();
  db.close();
});

test('cookie phiên là HttpOnly, SameSite=Lax, không Secure khi dev', async () => {
  const { db, server } = await setup();
  const reg = await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'a@b.c', password: PASSWORD, inviteCode: INVITE },
  });
  const [cookie] = reg.cookies;
  assert.match(cookie, /^sid=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.doesNotMatch(cookie, /Secure/i);
  await server.close();
  db.close();
});

test('sai mã mời bị chặn và không tạo user', async () => {
  const { db, server } = await setup();
  const r = await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'a@b.c', password: PASSWORD, inviteCode: 'sai' },
  });
  assert.equal(r.status, 403);
  assert.equal(db.prepare<[], { n: number }>('SELECT count(*) AS n FROM users').get()!.n, 0);
  await server.close();
  db.close();
});

test('mật khẩu dưới 10 ký tự bị từ chối', async () => {
  const { db, server } = await setup();
  const r = await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'a@b.c', password: 'ngan', inviteCode: INVITE },
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /10/);
  await server.close();
  db.close();
});

test('email đã dùng bị từ chối', async () => {
  const { db, server } = await setup();
  const body = { email: 'a@b.c', password: PASSWORD, inviteCode: INVITE };
  await server.fetch('/api/auth/register', { method: 'POST', json: body });
  const again = await server.fetch('/api/auth/register', { method: 'POST', json: body });
  assert.equal(again.status, 409);
  await server.close();
  db.close();
});

test('đăng nhập đúng thì đặt cookie, sai thì 401 với thông báo mơ hồ', async () => {
  const { db, server } = await setup();
  await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'a@b.c', password: PASSWORD, inviteCode: INVITE },
  });
  server.clearCookies();

  const bad = await server.fetch('/api/auth/login', {
    method: 'POST',
    json: { email: 'a@b.c', password: 'sai-mat-khau' },
  });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.error, 'email hoặc mật khẩu không đúng');

  const nobody = await server.fetch('/api/auth/login', {
    method: 'POST',
    json: { email: 'khong@co.com', password: PASSWORD },
  });
  // Email không tồn tại và sai mật khẩu phải không phân biệt được từ ngoài.
  assert.equal(nobody.status, 401);
  assert.equal(nobody.body.error, 'email hoặc mật khẩu không đúng');

  const good = await server.fetch('/api/auth/login', {
    method: 'POST',
    json: { email: 'a@b.c', password: PASSWORD },
  });
  assert.equal(good.status, 200);
  assert.equal((await server.fetch('/api/auth/me')).status, 200);

  await server.close();
  db.close();
});

test('10 lần đăng nhập sai trong cửa sổ thì lần 11 ra 429', async () => {
  const { db, server } = await setup();
  await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'a@b.c', password: PASSWORD, inviteCode: INVITE },
  });
  server.clearCookies();

  for (let i = 0; i < 10; i += 1) {
    const r = await server.fetch('/api/auth/login', {
      method: 'POST',
      json: { email: 'a@b.c', password: 'sai-mat-khau' },
    });
    assert.equal(r.status, 401, `lần ${i + 1} phải là 401`);
  }
  const blocked = await server.fetch('/api/auth/login', {
    method: 'POST',
    json: { email: 'a@b.c', password: PASSWORD },
  });
  assert.equal(blocked.status, 429);

  await server.close();
  db.close();
});

test('logout xoá phiên trong DB và xoá cookie', async () => {
  const { db, server } = await setup();
  await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'a@b.c', password: PASSWORD, inviteCode: INVITE },
  });
  const out = await server.fetch('/api/auth/logout', { method: 'POST' });
  assert.equal(out.status, 200);
  assert.equal(db.prepare<[], { n: number }>('SELECT count(*) AS n FROM web_sessions').get()!.n, 0);
  assert.equal((await server.fetch('/api/auth/me')).status, 401);
  await server.close();
  db.close();
});

test('/me khi chưa đăng nhập trả 401', async () => {
  const { db, server } = await setup();
  assert.equal((await server.fetch('/api/auth/me')).status, 401);
  await server.close();
  db.close();
});
```

- [x] **Step 3: Chạy test để xác nhận thất bại**

Run: `cd server && npm test`
Expected: FAIL — `Cannot find module './routes.js'`.

- [x] **Step 4: Viết `auth/routes.ts`**

`server/src/auth/routes.ts`:

```ts
import crypto from 'node:crypto';
import { Router } from 'express';

import type { Db } from '../db/index.js';
import {
  clearSessionCookie,
  makeRequireAuth,
  parseCookies,
  SESSION_COOKIE,
  setSessionCookie,
  type AuthedRequest,
} from './middleware.js';
import { hashPassword, MIN_PASSWORD_LENGTH, verifyDummy, verifyPassword } from './password.js';
import { createRateLimiter } from './rateLimit.js';
import { createSession, destroySession } from './sessions.js';
import { createUser, findUserByEmail, normalizeEmail } from './users.js';

export interface AuthDeps {
  db: Db;
  inviteCode: string;
  isProduction: boolean;
}

const LOGIN_MAX = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** So sánh bằng thời gian hằng — mã mời là bí mật, đừng để lộ qua thời gian. */
function sameSecret(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function authRouter(deps: AuthDeps): Router {
  const { db, inviteCode, isProduction } = deps;
  const router = Router();
  const limiter = createRateLimiter({ max: LOGIN_MAX, windowMs: LOGIN_WINDOW_MS });
  const requireAuth = makeRequireAuth(db, isProduction);

  router.post('/register', async (req, res) => {
    const { email, password, inviteCode: sent } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof email !== 'string' || typeof password !== 'string' || typeof sent !== 'string') {
      return res.status(400).json({ error: 'thiếu email, mật khẩu hoặc mã mời' });
    }
    if (!sameSecret(sent, inviteCode)) return res.status(403).json({ error: 'mã mời không đúng' });
    if (!normalizeEmail(email).includes('@')) {
      return res.status(400).json({ error: 'email không hợp lệ' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `mật khẩu tối thiểu ${MIN_PASSWORD_LENGTH} ký tự` });
    }
    if (findUserByEmail(db, email)) return res.status(409).json({ error: 'email đã được dùng' });

    const user = createUser(db, email, await hashPassword(password));
    setSessionCookie(res, createSession(db, user.id), isProduction);
    res.json({ id: user.id, email: user.email });
  });

  router.post('/login', async (req, res) => {
    const { email, password } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'thiếu email hoặc mật khẩu' });
    }

    // Đếm theo cả IP lẫn email: chỉ theo IP thì một botnet vẫn dò được một tài
    // khoản, chỉ theo email thì một IP vẫn quét được cả danh sách email.
    const ipKey = `ip:${req.ip ?? 'unknown'}`;
    const emailKey = `email:${normalizeEmail(email)}`;
    if (!limiter.hit(ipKey) || !limiter.hit(emailKey)) {
      return res.status(429).json({ error: 'thử quá nhiều lần, đợi 15 phút' });
    }

    const user = findUserByEmail(db, email);
    if (!user) {
      // Verify giả để thời gian phản hồi không tiết lộ email nào có thật.
      await verifyDummy(password);
      return res.status(401).json({ error: 'email hoặc mật khẩu không đúng' });
    }
    if (!(await verifyPassword(user.passwordHash, password))) {
      return res.status(401).json({ error: 'email hoặc mật khẩu không đúng' });
    }

    limiter.reset(ipKey);
    limiter.reset(emailKey);
    setSessionCookie(res, createSession(db, user.id), isProduction);
    res.json({ id: user.id, email: user.email });
  });

  router.post('/logout', (req, res) => {
    const rawId = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (rawId) destroySession(db, rawId);
    clearSessionCookie(res, isProduction);
    res.json({ ok: true });
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json((req as AuthedRequest).user);
  });

  return router;
}
```

- [x] **Step 5: Chạy test để xác nhận pass**

Run: `cd server && npm test`
Expected: PASS. Test rate limit chạy ~10 lần argon2 nên có thể mất vài giây.

- [x] **Step 6: Typecheck và commit**

```bash
cd server && npm run typecheck
git add server/src/auth/routes.ts server/src/auth/routes.test.ts server/src/test-helpers.ts
git commit -m "feat(server): route đăng ký/đăng nhập/đăng xuất theo mã mời"
```

---

## Task 8: `AvatarSession`

**Files:**
- Create: `server/src/session/avatarSession.ts`
- Test: `server/src/session/avatarSession.test.ts`

**Interfaces:**
- Consumes: `GameClient`, `DeviceProfile`, `ClientStatus`, `TrafficEntry` từ `game/client.js`; `AutoFarm`, `AutoFarmConfig`, `AutoFarmState` từ `autoFarm.js`; `Macro`, `MacroRunner`, `MacroState` từ `macro.js`.
- Produces:
  - `interface AvatarCredentials { host: string; port: number; user: string; pass: string; device?: Partial<DeviceProfile>; autoEnabled: boolean; autoConfig?: Partial<AutoFarmConfig> }`
  - `interface LogLine { t: number; line: string }`
  - `interface AvatarSessionSnapshot { accountId, status, lastError, playerId, money, farm, auto, macro, inventory, trees, items, animals, logs, traffic, retries, nextRetryAt, desiredConnected }`
  - `interface AvatarSessionOptions { accountId, loadCredentials, onEvent, onPermanentFailure, createClient?, createAutoFarm?, createMacroRunner?, setTimeoutFn?, clearTimeoutFn?, random? }`
    — `createAutoFarm`/`createMacroRunner` là test seam bắt buộc: `AutoFarm.runCycle`
    dùng `setTimeout` thật với chu kỳ 5s/120s và không nhận đồng hồ từ ngoài, nên
    test dùng `AutoFarm` thật sẽ treo hàng giây và không xác định được.
  - `class AvatarSession` với `start()`, `stop()`, `startAuto(cfg)`, `stopAuto()`, `startMacro(m)`, `stopMacro()`, `callFarm(name, args)`, `sendRaw(cmd, fields)`, `enterFarm()`, `lastPacketHex(cmd)`, `snapshot()`, getter `status`, `desiredConnected`
  - `RETRY_BASE_MS = 5000`, `RETRY_MAX_MS = 300_000`

- [x] **Step 1: Viết test**

`server/src/session/avatarSession.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import type { GameClient } from '../game/client.js';
import { AvatarSession, RETRY_BASE_MS, RETRY_MAX_MS, type AvatarCredentials } from './avatarSession.js';

/** GameClient giả: đủ bề mặt để `AvatarSession` chạy, không mở socket nào. */
class FakeClient extends EventEmitter {
  status = 'idle';
  lastError: string | undefined;
  playerId: number | undefined;
  farmState: unknown;
  inventory: unknown[] = [];
  trees: unknown[] = [];
  items: unknown[] = [];
  animals: unknown[] = [];
  money: number | undefined;
  traffic: unknown[] = [];
  lastPacket = new Map<number, string>();
  readonly farm = { getInventory: () => this.calls.push('getInventory') };
  calls: string[] = [];
  loginArgs: unknown[] = [];
  loginError: Error | null = null;
  logoutCount = 0;

  async login(opts: unknown): Promise<void> {
    this.loginArgs.push(opts);
    if (this.loginError) throw this.loginError;
    this.status = 'online';
    this.emit('status', 'online');
  }
  logout(): void {
    this.logoutCount += 1;
    this.status = 'idle';
  }
  enterFarm(): void {
    this.calls.push('enterFarm');
  }
  sendRaw(cmd: number): void {
    this.calls.push(`raw:${cmd}`);
  }
  /** Mô phỏng server đá phiên. */
  drop(): void {
    this.status = 'idle';
    this.emit('status', 'idle');
  }
}

interface Harness {
  session: AvatarSession;
  clients: FakeClient[];
  timers: Array<{ at: number; fn: () => void }>;
  events: Array<{ type: string; payload: unknown }>;
  permanent: string[];
  /** Chạy timer đang chờ sớm nhất, trả về độ trễ của nó. */
  fireTimer(): number;
}

function harness(creds: Partial<AvatarCredentials> = {}, loginError?: Error): Harness {
  const clients: FakeClient[] = [];
  const timers: Array<{ at: number; fn: () => void; delay: number }> = [];
  const events: Array<{ type: string; payload: unknown }> = [];
  const permanent: string[] = [];

  const session = new AvatarSession({
    accountId: 7,
    loadCredentials: async () => ({
      host: 'h',
      port: 1,
      user: 'u',
      pass: 'p',
      autoEnabled: false,
      ...creds,
    }),
    createClient: () => {
      const c = new FakeClient();
      c.loginError = loginError ?? null;
      clients.push(c);
      return c as unknown as GameClient;
    },
    onEvent: (type, payload) => events.push({ type, payload }),
    onPermanentFailure: (reason) => permanent.push(reason),
    setTimeoutFn: ((fn: () => void, delay: number) => {
      timers.push({ at: timers.length, fn, delay });
      return timers.length as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout,
    clearTimeoutFn: (() => {}) as unknown as typeof clearTimeout,
    random: () => 0.5, // jitter = hệ số 1.0, backoff thành số tròn
  });

  return {
    session,
    clients,
    timers,
    events,
    permanent,
    fireTimer() {
      const t = timers.shift()!;
      t.fn();
      return t.delay;
    },
  };
}

test('start đăng nhập với thông tin lấy từ loadCredentials', async () => {
  const h = harness();
  await h.session.start();
  assert.equal(h.clients.length, 1);
  assert.deepEqual(h.clients[0].loginArgs, [
    { host: 'h', port: 1, user: 'u', pass: 'p', device: undefined },
  ]);
  assert.equal(h.session.status, 'online');
});

test('start hai lần không tạo client thứ hai', async () => {
  const h = harness();
  await h.session.start();
  await h.session.start();
  assert.equal(h.clients.length, 1);
});

test('autoEnabled = true thì bật AutoFarm sau khi online', async () => {
  const h = harness({ autoEnabled: true, autoConfig: { intervalMs: 60000 } });
  await h.session.start();
  assert.equal(h.session.snapshot().auto.running, true);
  h.session.stop();
});

test('rớt kết nối khi đang muốn kết nối thì hẹn thử lại với backoff luỹ thừa', async () => {
  const h = harness();
  await h.session.start();

  const delays: number[] = [];
  for (let i = 0; i < 8; i += 1) {
    h.clients[h.clients.length - 1].drop();
    delays.push(h.fireTimer());
  }
  assert.deepEqual(delays, [
    RETRY_BASE_MS,
    RETRY_BASE_MS * 2,
    RETRY_BASE_MS * 4,
    RETRY_BASE_MS * 8,
    RETRY_BASE_MS * 16,
    RETRY_BASE_MS * 32,
    RETRY_MAX_MS,
    RETRY_MAX_MS,
  ]);
});

test('kết nối lại thành công thì đặt lại bộ đếm backoff', async () => {
  const h = harness();
  await h.session.start();
  h.clients[0].drop();
  assert.equal(h.fireTimer(), RETRY_BASE_MS);
  await new Promise((r) => setImmediate(r));
  assert.equal(h.session.snapshot().retries, 0);
});

test('stop thì không thử lại nữa', async () => {
  const h = harness();
  await h.session.start();
  h.session.stop();
  h.clients[0].drop();
  assert.equal(h.timers.length, 0);
  assert.equal(h.clients[0].logoutCount, 1);
});

test('nhận LOGIN_FAIL (-35) thì dừng hẳn và báo lỗi vĩnh viễn', async () => {
  const h = harness({ autoEnabled: true });
  await h.session.start();
  h.clients[0].emit('message', { command: -35 });
  h.clients[0].drop();

  assert.equal(h.timers.length, 0, 'không được hẹn thử lại');
  assert.equal(h.session.desiredConnected, false);
  assert.equal(h.permanent.length, 1);
  assert.match(h.permanent[0], /đăng nhập/);
});

test('login ném lỗi thì start không ném ra ngoài mà hẹn thử lại', async () => {
  const h = harness({}, new Error('không nhận được gói khóa (-27) sau 10s'));
  await h.session.start();
  assert.equal(h.timers.length, 1);
  assert.equal(h.fireTimer(), RETRY_BASE_MS);
  const logs = h.session.snapshot().logs.map((l) => l.line);
  assert.ok(logs.some((l) => l.includes('kết nối lỗi')));
});

test('ring buffer log giữ tối đa 500 dòng, mới nhất ở cuối', async () => {
  const h = harness();
  await h.session.start();
  for (let i = 0; i < 600; i += 1) h.clients[0].emit('log', `dòng ${i}`);
  const logs = h.session.snapshot().logs;
  assert.equal(logs.length, 500);
  assert.equal(logs[logs.length - 1].line, 'dòng 599');
  assert.equal(logs[0].line, 'dòng 100');
});

test('ring buffer traffic giữ tối đa 100 gói', async () => {
  const h = harness();
  await h.session.start();
  for (let i = 0; i < 150; i += 1) {
    h.clients[0].emit('traffic', { t: i, dir: 'tx', cmd: i, name: 'x', len: 0, hex: '' });
  }
  assert.equal(h.session.snapshot().traffic.length, 100);
});

test('sự kiện của client được đẩy ra ngoài qua onEvent', async () => {
  const h = harness();
  await h.session.start();
  h.clients[0].emit('log', 'xin chào');
  h.clients[0].emit('money', { balance: 10 });
  const types = h.events.map((e) => e.type);
  assert.ok(types.includes('status'));
  assert.ok(types.includes('log'));
  assert.ok(types.includes('money'));
});

test('callFarm gọi đúng method, tên sai thì ném', async () => {
  const h = harness();
  await h.session.start();
  h.session.callFarm('getInventory', []);
  assert.deepEqual(h.clients[0].calls, ['getInventory']);
  assert.throws(() => h.session.callFarm('khongCo', []), /không có action/);
});

test('gọi lệnh khi chưa kết nối thì ném lỗi rõ ràng', () => {
  const h = harness();
  assert.throws(() => h.session.callFarm('getInventory', []), /chưa kết nối/);
  assert.throws(() => h.session.sendRaw(76, []), /chưa kết nối/);
  assert.throws(() => h.session.enterFarm(), /chưa kết nối/);
});

test('lỗi trong handler sự kiện không làm chết process', async () => {
  const h = harness();
  await h.session.start();
  // onEvent của thật có thể ném (vd WS đã đóng); AvatarSession phải nuốt.
  assert.doesNotThrow(() => h.clients[0].emit('log', 'x'));
});

test('snapshot có đủ trường cho UI', async () => {
  const h = harness();
  await h.session.start();
  const s = h.session.snapshot();
  for (const k of [
    'accountId',
    'status',
    'auto',
    'macro',
    'inventory',
    'trees',
    'items',
    'animals',
    'logs',
    'traffic',
    'retries',
    'desiredConnected',
  ]) {
    assert.ok(k in s, `snapshot thiếu ${k}`);
  }
  assert.equal(s.accountId, 7);
});
```

- [x] **Step 2: Chạy test để xác nhận thất bại**

Run: `cd server && npm test`
Expected: FAIL — `Cannot find module './avatarSession.js'`.

- [x] **Step 3: Viết `session/avatarSession.ts`**

`server/src/session/avatarSession.ts`:

```ts
import { AutoFarm, type AutoFarmConfig, type AutoFarmState } from '../autoFarm.js';
import { GameClient, type ClientStatus, type DeviceProfile, type TrafficEntry } from '../game/client.js';
import { MacroRunner, type Macro, type MacroState } from '../macro.js';

export const RETRY_BASE_MS = 5_000;
export const RETRY_MAX_MS = 5 * 60 * 1000;
const LOG_BUFFER = 500;
const TRAFFIC_BUFFER = 100;

export interface AvatarCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
  device?: Partial<DeviceProfile>;
  /** Ý muốn của người dùng, đọc từ DB. */
  autoEnabled: boolean;
  autoConfig?: Partial<AutoFarmConfig>;
}

export interface LogLine {
  t: number;
  line: string;
}

export interface AvatarSessionSnapshot {
  accountId: number;
  status: ClientStatus;
  lastError?: string;
  playerId?: number;
  money?: number;
  farm?: unknown;
  auto: AutoFarmState;
  macro: MacroState;
  inventory: unknown[];
  trees: unknown[];
  items: unknown[];
  animals: unknown[];
  logs: LogLine[];
  traffic: TrafficEntry[];
  retries: number;
  nextRetryAt?: number;
  desiredConnected: boolean;
}

export interface AvatarSessionOptions {
  accountId: number;
  /** Đọc lại mỗi lần kết nối — mật khẩu có thể đã đổi giữa hai lần thử. */
  loadCredentials: () => Promise<AvatarCredentials>;
  onEvent: (type: string, payload: unknown) => void;
  /** Lỗi không thể tự khắc phục (sai mật khẩu game) — tầng trên ghi DB. */
  onPermanentFailure: (reason: string) => void;
  createClient?: () => GameClient;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  random?: () => number;
}

const EMPTY_AUTO: AutoFarmState = { running: false, cycle: 0, lastActions: [] };
const EMPTY_MACRO: MacroState = { running: false, cycle: 0 };

/**
 * Một tài khoản avatar đang sống trên server: giữ `GameClient` + `AutoFarm` +
 * `MacroRunner`, đệm log/traffic trong RAM, và tự kết nối lại khi rớt.
 *
 * `desiredConnected` là ý muốn, `client.status` là hiện thực đang đuổi theo nó.
 * Tách hai thứ này là lý do "24/7 độc lập trình duyệt" thành thật.
 */
export class AvatarSession {
  private client?: GameClient;
  private auto?: AutoFarm;
  private macros?: MacroRunner;
  private wanted = false;
  private retries = 0;
  private nextRetryAt?: number;
  private retryTimer?: NodeJS.Timeout;
  /** Đã nhận LOGIN_FAIL: không thử lại nữa dù rớt kết nối. */
  private permanentlyFailed = false;
  private lastAutoConfig: Partial<AutoFarmConfig> = {};
  private wantAuto = false;

  private readonly logs: LogLine[] = [];
  private readonly traffic: TrafficEntry[] = [];

  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;
  private readonly random: () => number;

  constructor(private readonly opts: AvatarSessionOptions) {
    this.setTimeoutFn = opts.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = opts.clearTimeoutFn ?? clearTimeout;
    this.random = opts.random ?? Math.random;
  }

  get status(): ClientStatus {
    return this.client?.status ?? 'idle';
  }

  get desiredConnected(): boolean {
    return this.wanted;
  }

  async start(): Promise<void> {
    this.wanted = true;
    this.permanentlyFailed = false;
    if (this.client) return;
    await this.connect();
  }

  stop(): void {
    this.wanted = false;
    this.cancelRetry();
    this.teardown();
    this.emit('status', 'idle');
  }

  startAuto(cfg: Partial<AutoFarmConfig>): void {
    this.requireClient();
    this.wantAuto = true;
    this.lastAutoConfig = cfg;
    this.auto!.start(cfg);
  }

  stopAuto(): void {
    this.wantAuto = false;
    this.auto?.stop();
  }

  startMacro(macro: Macro): void {
    this.requireClient();
    this.macros!.start(macro);
  }

  stopMacro(): void {
    this.macros?.stop();
  }

  callFarm(name: string, args: unknown[]): void {
    const client = this.requireClient();
    const fn = (client.farm as unknown as Record<string, unknown>)[name];
    if (typeof fn !== 'function') throw new Error(`không có action "${name}"`);
    (fn as (...a: unknown[]) => void).apply(client.farm, args);
  }

  sendRaw(cmd: number, fields: Array<{ t: string; v: string }>): void {
    this.requireClient().sendRaw(cmd, fields);
  }

  enterFarm(): void {
    this.requireClient().enterFarm();
  }

  lastPacketHex(cmd: number): string | undefined {
    return this.client?.lastPacket.get(cmd);
  }

  snapshot(): AvatarSessionSnapshot {
    const c = this.client;
    return {
      accountId: this.opts.accountId,
      status: c?.status ?? 'idle',
      lastError: c?.lastError,
      playerId: c?.playerId,
      money: c?.money,
      farm: c?.farmState,
      auto: this.auto?.state() ?? EMPTY_AUTO,
      macro: this.macros?.state() ?? EMPTY_MACRO,
      inventory: c?.inventory ?? [],
      trees: c?.trees ?? [],
      items: c?.items ?? [],
      animals: c?.animals ?? [],
      logs: [...this.logs],
      traffic: [...this.traffic],
      retries: this.retries,
      nextRetryAt: this.nextRetryAt,
      desiredConnected: this.wanted,
    };
  }

  // --- nội bộ -------------------------------------------------------------

  private requireClient(): GameClient {
    if (!this.client) throw new Error('phiên chưa kết nối');
    return this.client;
  }

  /** Mọi lời gọi ra ngoài đều bọc: một WS đã đóng không được giết cả phiên. */
  private emit(type: string, payload: unknown): void {
    try {
      this.opts.onEvent(type, payload);
    } catch {
      /* bỏ qua */
    }
  }

  private pushLog(line: string): void {
    const entry = { t: Date.now(), line };
    this.logs.push(entry);
    if (this.logs.length > LOG_BUFFER) this.logs.shift();
    this.emit('log', entry);
  }

  private async connect(): Promise<void> {
    const creds = await this.opts.loadCredentials();
    this.wantAuto = creds.autoEnabled;
    this.lastAutoConfig = creds.autoConfig ?? {};

    const client = this.opts.createClient ? this.opts.createClient() : new GameClient();
    this.client = client;
    this.auto = new AutoFarm(client);
    this.macros = new MacroRunner(client);
    this.wire(client);

    try {
      await client.login({
        host: creds.host,
        port: creds.port,
        user: creds.user,
        pass: creds.pass,
        device: creds.device,
      });
    } catch (err) {
      this.pushLog(`kết nối lỗi: ${(err as Error).message}`);
      this.scheduleRetry();
      return;
    }

    this.retries = 0;
    this.nextRetryAt = undefined;
    if (this.wantAuto && client.status === 'online') this.tryStartAuto();
  }

  private wire(client: GameClient): void {
    // EventEmitter không có listener 'error' sẽ ném và giết cả process, kéo
    // theo mọi phiên khác. Đây là listener bắt buộc, không phải phòng xa.
    client.on('error', (err: Error) => this.pushLog(`lỗi client: ${err.message}`));

    client.on('status', (s: ClientStatus) => {
      this.emit('status', s);
      if (s === 'online' && this.wantAuto) this.tryStartAuto();
      if (s === 'idle' || s === 'error') this.onDisconnected();
    });

    client.on('log', (line: string) => this.pushLog(line));

    client.on('traffic', (entry: TrafficEntry) => {
      this.traffic.push(entry);
      if (this.traffic.length > TRAFFIC_BUFFER) this.traffic.shift();
      this.emit('traffic', entry);
    });

    client.on('farm', (state: unknown) => this.emit('farm', state));
    client.on('inventory', (inv: unknown) => this.emit('inventory', inv));
    client.on('trees', (t: unknown) => this.emit('trees', t));
    client.on('money', (m: unknown) => this.emit('money', m));

    client.on('message', (msg: { command: number }) => {
      // LOGIN_FAIL: sai mật khẩu hoặc tài khoản bị khoá. Thử lại là đường ngắn
      // nhất tới việc bị server game khoá thật — dừng hẳn, chờ người dùng sửa.
      if (msg.command === -35) this.failPermanently('đăng nhập thất bại — kiểm tra lại mật khẩu game');
    });

    this.auto!.on('state', (s: AutoFarmState) => this.emit('auto', s));
    this.macros!.on('state', (s: MacroState) => this.emit('macro', s));
  }

  private tryStartAuto(): void {
    try {
      this.auto!.start(this.lastAutoConfig);
    } catch (err) {
      this.pushLog(`không bật được tự động: ${(err as Error).message}`);
    }
  }

  private failPermanently(reason: string): void {
    this.permanentlyFailed = true;
    this.wanted = false;
    this.wantAuto = false;
    this.cancelRetry();
    this.pushLog(reason);
    try {
      this.opts.onPermanentFailure(reason);
    } catch {
      /* bỏ qua */
    }
  }

  private onDisconnected(): void {
    this.auto?.stop();
    this.macros?.stop();
    if (!this.wanted || this.permanentlyFailed) return;
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return;
    // 5s, 10s, 20s, 40s… trần 5 phút; jitter ±20% để nhiều phiên rớt cùng lúc
    // không đồng loạt gõ lại server game.
    const base = Math.min(RETRY_BASE_MS * 2 ** this.retries, RETRY_MAX_MS);
    const delay = Math.round(base * (0.8 + 0.4 * this.random()));
    this.retries += 1;
    this.nextRetryAt = Date.now() + delay;
    this.pushLog(`thử kết nối lại sau ${Math.round(delay / 1000)}s (lần ${this.retries})`);

    this.retryTimer = this.setTimeoutFn(() => {
      this.retryTimer = undefined;
      if (!this.wanted || this.permanentlyFailed) return;
      this.teardown();
      void this.connect().catch((err: Error) => {
        this.pushLog(`thử lại lỗi: ${err.message}`);
        this.scheduleRetry();
      });
    }, delay);
  }

  private cancelRetry(): void {
    if (this.retryTimer) this.clearTimeoutFn(this.retryTimer);
    this.retryTimer = undefined;
    this.nextRetryAt = undefined;
  }

  private teardown(): void {
    this.auto?.stop();
    this.macros?.stop();
    const client = this.client;
    this.client = undefined;
    this.auto = undefined;
    this.macros = undefined;
    if (!client) return;
    try {
      client.logout();
    } catch {
      /* bỏ qua */
    }
    client.removeAllListeners();
  }
}
```

- [x] **Step 4: Chạy test để xác nhận pass**

Run: `cd server && npm test`
Expected: PASS.

- [x] **Step 5: Typecheck và commit**

```bash
cd server && npm run typecheck
git add server/src/session/avatarSession.ts server/src/session/avatarSession.test.ts
git commit -m "feat(server): AvatarSession bọc GameClient kèm backoff và cách ly lỗi"
```

---

## Task 9: `SessionManager`

**Files:**
- Create: `server/src/session/manager.ts`
- Test: `server/src/session/manager.test.ts`

**Interfaces:**
- Consumes: `AvatarSession`, `AvatarSessionOptions`, `AvatarSessionSnapshot`, `AvatarCredentials` (Task 8); `repo` (Task 5); `Db` (Task 2).
- Produces:
  - `BOOTSTRAP_STAGGER_MS = 5000`
  - `interface SessionManagerDeps { db: Db; masterKey: Buffer; maxSessions: number; broadcast(userId: number, accountId: number, type: string, payload: unknown): void; createSession?(opts: AvatarSessionOptions): AvatarSession; setTimeoutFn?: typeof setTimeout }`
  - `class SessionManager` với `connect(accountId): Promise<void>`, `disconnect(accountId): void`, `destroy(accountId): void`, `peek(accountId): AvatarSession | undefined`, `require(accountId): AvatarSession`, `snapshot(accountId): AvatarSessionSnapshot | null`, `bootstrap(): Promise<void>`, `stopAll(): void`, `size(): number`

- [x] **Step 1: Viết test**

`server/src/session/manager.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { newTestDb, TEST_KEY } from '../test-helpers.js';
import { createUser } from '../auth/users.js';
import { createAccount, getAccountById, setAutoEnabled } from '../accounts/repo.js';
import type { AvatarSession, AvatarSessionOptions } from './avatarSession.js';
import { BOOTSTRAP_STAGGER_MS, SessionManager } from './manager.js';

/** `AvatarSession` giả — ghi lại lời gọi, không mở socket. */
class FakeSession {
  started = 0;
  stopped = 0;
  desiredConnected = false;
  constructor(readonly opts: AvatarSessionOptions) {}
  async start() {
    this.started += 1;
    this.desiredConnected = true;
  }
  stop() {
    this.stopped += 1;
    this.desiredConnected = false;
  }
  snapshot() {
    return { accountId: this.opts.accountId, status: 'online' };
  }
}

function setup(maxSessions = 20) {
  const db = newTestDb();
  const user = createUser(db, 'a@b.c', 'h', 0);
  const made: FakeSession[] = [];
  const sent: Array<{ userId: number; accountId: number; type: string }> = [];
  const timers: Array<{ fn: () => void; delay: number }> = [];

  const manager = new SessionManager({
    db,
    masterKey: TEST_KEY,
    maxSessions,
    broadcast: (userId, accountId, type) => sent.push({ userId, accountId, type }),
    createSession: (opts) => {
      const s = new FakeSession(opts);
      made.push(s);
      return s as unknown as AvatarSession;
    },
    setTimeoutFn: ((fn: () => void, delay: number) => {
      timers.push({ fn, delay });
      return 0 as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout,
  });

  const newAccount = (label: string) =>
    createAccount(db, TEST_KEY, { userId: user.id, label, gameUser: 'u', gamePass: 'p' });

  return { db, user, manager, made, sent, timers, newAccount };
}

test('connect tạo đúng một phiên và dùng lại ở lần sau', async () => {
  const { db, manager, made, newAccount } = setup();
  const acc = newAccount('x');
  await manager.connect(acc.id);
  await manager.connect(acc.id);
  assert.equal(made.length, 1);
  assert.equal(made[0].started, 2);
  assert.equal(manager.size(), 1);
  db.close();
});

test('loadCredentials đọc host/port/user và giải mã mật khẩu từ DB', async () => {
  const { db, manager, made, newAccount } = setup();
  const acc = newAccount('x');
  await manager.connect(acc.id);
  const creds = await made[0].opts.loadCredentials();
  assert.equal(creds.user, 'u');
  assert.equal(creds.pass, 'p');
  assert.equal(creds.host, acc.host);
  assert.equal(creds.port, acc.port);
  assert.equal(creds.autoEnabled, false);
  db.close();
});

test('loadCredentials đọc lại DB mỗi lần — đổi mật khẩu là có hiệu lực ngay', async () => {
  const { db, manager, made, newAccount } = setup();
  const acc = newAccount('x');
  await manager.connect(acc.id);
  setAutoEnabled(db, acc.id, true, { harvest: true });
  const creds = await made[0].opts.loadCredentials();
  assert.equal(creds.autoEnabled, true);
  assert.deepEqual(creds.autoConfig, { harvest: true });
  db.close();
});

test('vượt MAX_SESSIONS thì ném lỗi', async () => {
  const { db, manager, newAccount } = setup(2);
  await manager.connect(newAccount('1').id);
  await manager.connect(newAccount('2').id);
  await assert.rejects(() => manager.connect(newAccount('3').id), /tối đa 2/);
  db.close();
});

test('tài khoản không tồn tại thì ném lỗi', async () => {
  const { db, manager } = setup();
  await assert.rejects(() => manager.connect(999), /không có tài khoản/);
  db.close();
});

test('disconnect dừng phiên nhưng giữ lại trong map', async () => {
  const { db, manager, made, newAccount } = setup();
  const acc = newAccount('x');
  await manager.connect(acc.id);
  manager.disconnect(acc.id);
  assert.equal(made[0].stopped, 1);
  assert.equal(manager.size(), 1);
  db.close();
});

test('destroy dừng phiên và bỏ khỏi map', async () => {
  const { db, manager, made, newAccount } = setup();
  const acc = newAccount('x');
  await manager.connect(acc.id);
  manager.destroy(acc.id);
  assert.equal(made[0].stopped, 1);
  assert.equal(manager.size(), 0);
  db.close();
});

test('sự kiện của phiên được phát tới đúng chủ sở hữu', async () => {
  const { db, manager, made, sent, newAccount, user } = setup();
  const acc = newAccount('x');
  await manager.connect(acc.id);
  made[0].opts.onEvent('status', 'online');
  assert.deepEqual(sent, [{ userId: user.id, accountId: acc.id, type: 'status' }]);
  db.close();
});

test('lỗi vĩnh viễn thì tắt auto_enabled trong DB', async () => {
  const { db, manager, made, newAccount } = setup();
  const acc = newAccount('x');
  setAutoEnabled(db, acc.id, true, { harvest: true });
  await manager.connect(acc.id);
  made[0].opts.onPermanentFailure('đăng nhập thất bại');
  assert.equal(getAccountById(db, acc.id)!.autoEnabled, false);
  db.close();
});

test('bootstrap chỉ bật tài khoản có auto_enabled = 1', async () => {
  const { db, manager, made, timers, newAccount } = setup();
  const on = newAccount('bật');
  newAccount('tắt');
  setAutoEnabled(db, on.id, true, {});

  await manager.bootstrap();
  assert.equal(made.length, 1);
  assert.equal(made[0].opts.accountId, on.id);
  assert.equal(timers.length, 0, 'chỉ một tài khoản thì không cần giãn cách');
  db.close();
});

test('bootstrap giãn cách giữa các lần đăng nhập', async () => {
  const { db, manager, made, timers, newAccount } = setup();
  const ids = ['a', 'b', 'c'].map((l) => newAccount(l).id);
  for (const id of ids) setAutoEnabled(db, id, true, {});

  await manager.bootstrap();
  assert.equal(made.length, 1, 'tài khoản đầu bật ngay');
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, BOOTSTRAP_STAGGER_MS);

  await timers[0].fn();
  assert.equal(made.length, 2);
  assert.equal(timers[1].delay, BOOTSTRAP_STAGGER_MS);
  db.close();
});

test('một tài khoản lỗi lúc bootstrap không chặn các tài khoản còn lại', async () => {
  const { db, manager, made, timers, newAccount } = setup();
  const a = newAccount('a');
  const b = newAccount('b');
  setAutoEnabled(db, a.id, true, {});
  setAutoEnabled(db, b.id, true, {});
  // Xoá bản mã của `a` để `loadCredentials` sẽ hỏng — nhưng lỗi chỉ xảy ra khi
  // phiên gọi, còn `connect` phải trót lọt.
  db.prepare('UPDATE avatar_accounts SET game_pass_enc = ? WHERE id = ?').run('hỏng', a.id);

  await manager.bootstrap();
  await timers[0]?.fn();
  assert.equal(made.length, 2);
  db.close();
});

test('stopAll dừng mọi phiên', async () => {
  const { db, manager, made, newAccount } = setup();
  await manager.connect(newAccount('1').id);
  await manager.connect(newAccount('2').id);
  manager.stopAll();
  assert.deepEqual(made.map((s) => s.stopped), [1, 1]);
  assert.equal(manager.size(), 0);
  db.close();
});

test('snapshot trả null khi chưa có phiên', async () => {
  const { db, manager, newAccount } = setup();
  const acc = newAccount('x');
  assert.equal(manager.snapshot(acc.id), null);
  await manager.connect(acc.id);
  assert.equal(manager.snapshot(acc.id)!.accountId, acc.id);
  db.close();
});
```

- [x] **Step 2: Chạy test để xác nhận thất bại**

Run: `cd server && npm test`
Expected: FAIL — `Cannot find module './manager.js'`.

- [x] **Step 3: Viết `session/manager.ts`**

`server/src/session/manager.ts`:

```ts
import { getAccountById, listAutoEnabled, readGamePass, setAutoEnabled } from '../accounts/repo.js';
import type { AutoFarmConfig } from '../autoFarm.js';
import type { Db } from '../db/index.js';
import type { DeviceProfile } from '../game/client.js';
import {
  AvatarSession,
  type AvatarCredentials,
  type AvatarSessionOptions,
  type AvatarSessionSnapshot,
} from './avatarSession.js';

/** Giãn cách giữa các lần đăng nhập lúc khởi động. */
export const BOOTSTRAP_STAGGER_MS = 5_000;

export interface SessionManagerDeps {
  db: Db;
  masterKey: Buffer;
  maxSessions: number;
  broadcast(userId: number, accountId: number, type: string, payload: unknown): void;
  createSession?(opts: AvatarSessionOptions): AvatarSession;
  setTimeoutFn?: typeof setTimeout;
}

/**
 * Giữ mọi phiên đang sống trong process. Không có trạng thái nào của riêng nó
 * ngoài cái Map — nguồn sự thật vẫn là DB, nên restart rồi bootstrap lại là đủ.
 */
export class SessionManager {
  private readonly sessions = new Map<number, AvatarSession>();
  private readonly setTimeoutFn: typeof setTimeout;

  constructor(private readonly deps: SessionManagerDeps) {
    this.setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
  }

  size(): number {
    return this.sessions.size;
  }

  peek(accountId: number): AvatarSession | undefined {
    return this.sessions.get(accountId);
  }

  require(accountId: number): AvatarSession {
    const s = this.sessions.get(accountId);
    if (!s) throw new Error('phiên chưa kết nối');
    return s;
  }

  snapshot(accountId: number): AvatarSessionSnapshot | null {
    return this.sessions.get(accountId)?.snapshot() ?? null;
  }

  async connect(accountId: number): Promise<void> {
    await this.getOrCreate(accountId).start();
  }

  disconnect(accountId: number): void {
    this.sessions.get(accountId)?.stop();
  }

  destroy(accountId: number): void {
    const s = this.sessions.get(accountId);
    if (!s) return;
    s.stop();
    this.sessions.delete(accountId);
  }

  stopAll(): void {
    for (const s of this.sessions.values()) s.stop();
    this.sessions.clear();
  }

  /**
   * Bật lại mọi tài khoản có `auto_enabled = 1`, giãn cách vài giây một lần:
   * mở một loạt phiên cùng lúc từ cùng một IP là thứ dễ bị server game để ý nhất.
   */
  async bootstrap(): Promise<void> {
    const accounts = listAutoEnabled(this.deps.db);
    if (accounts.length === 0) return;

    const startAt = async (i: number): Promise<void> => {
      const acc = accounts[i];
      try {
        await this.connect(acc.id);
      } catch (err) {
        // Một tài khoản hỏng (sai khoá, vượt trần) không được chặn phần còn lại.
        console.error(`bootstrap #${acc.id} lỗi: ${(err as Error).message}`);
      }
      if (i + 1 < accounts.length) {
        this.setTimeoutFn(() => void startAt(i + 1), BOOTSTRAP_STAGGER_MS);
      }
    };

    await startAt(0);
  }

  private getOrCreate(accountId: number): AvatarSession {
    const existing = this.sessions.get(accountId);
    if (existing) return existing;

    const { db, masterKey, maxSessions, broadcast } = this.deps;
    const account = getAccountById(db, accountId);
    if (!account) throw new Error(`không có tài khoản #${accountId}`);
    if (this.sessions.size >= maxSessions) {
      throw new Error(`đã đạt tối đa ${maxSessions} phiên cùng lúc`);
    }
    const userId = account.userId;

    const opts: AvatarSessionOptions = {
      accountId,
      // Đọc lại DB mỗi lần kết nối: mật khẩu hoặc cấu hình auto có thể đã đổi
      // giữa hai lần thử lại.
      loadCredentials: async (): Promise<AvatarCredentials> => {
        const row = getAccountById(db, accountId);
        if (!row) throw new Error(`không có tài khoản #${accountId}`);
        return {
          host: row.host,
          port: row.port,
          user: row.gameUser,
          pass: readGamePass(db, masterKey, accountId),
          device: row.device as Partial<DeviceProfile> | undefined,
          autoEnabled: row.autoEnabled,
          autoConfig: row.autoConfig as Partial<AutoFarmConfig> | undefined,
        };
      },
      onEvent: (type, payload) => broadcast(userId, accountId, type, payload),
      onPermanentFailure: () => {
        // DB là ý muốn của người dùng. Sai mật khẩu game thì ý muốn "chạy 24/7"
        // phải bị gỡ, nếu không restart sau đó lại lao vào vòng đăng nhập sai.
        setAutoEnabled(db, accountId, false, null);
        broadcast(userId, accountId, 'auto-disabled', { accountId });
      },
    };

    const session = this.deps.createSession
      ? this.deps.createSession(opts)
      : new AvatarSession(opts);
    this.sessions.set(accountId, session);
    return session;
  }
}
```

- [x] **Step 4: Chạy test để xác nhận pass**

Run: `cd server && npm test`
Expected: PASS.

- [x] **Step 5: Typecheck và commit**

```bash
cd server && npm run typecheck
git add server/src/session/manager.ts server/src/session/manager.test.ts
git commit -m "feat(server): SessionManager với trần phiên và bootstrap giãn cách"
```

---

## Task 10: Route CRUD `/api/accounts`

**Files:**
- Create: `server/src/accounts/routes.ts`
- Test: `server/src/accounts/routes.test.ts`

**Interfaces:**
- Consumes: `repo` (Task 5), `makeRequireAuth`/`AuthedRequest` (Task 6), `SessionManager` (Task 9).
- Produces:
  - `interface AccountsDeps { db: Db; masterKey: Buffer; isProduction: boolean; sessions: SessionManager }`
  - `accountsRouter(deps: AccountsDeps): Router` — mount tại `/api/accounts`
  - `requireOwnedAccount(db: Db): RequestHandler` — đặt `req.account`, xuất khẩu để Task 11 dùng lại
  - `interface AccountRequest extends AuthedRequest { account?: AvatarAccount }`

- [x] **Step 1: Viết test**

`server/src/accounts/routes.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { newTestDb, startTestServer, TEST_KEY } from '../test-helpers.js';
import { authRouter } from '../auth/routes.js';
import { DEFAULT_GAME_SERVER } from '../config.js';
import { SessionManager } from '../session/manager.js';
import type { AvatarSession, AvatarSessionOptions } from '../session/avatarSession.js';
import { readGamePass } from './repo.js';
import { accountsRouter } from './routes.js';

const INVITE = 'ma-moi';
const PASSWORD = 'mat-khau-du-dai';

class FakeSession {
  stopped = 0;
  constructor(readonly opts: AvatarSessionOptions) {}
  async start() {}
  stop() {
    this.stopped += 1;
  }
  snapshot() {
    return { accountId: this.opts.accountId, status: 'online', money: 42 };
  }
}

async function setup() {
  const db = newTestDb();
  const made: FakeSession[] = [];
  const sessions = new SessionManager({
    db,
    masterKey: TEST_KEY,
    maxSessions: 20,
    broadcast: () => {},
    createSession: (opts) => {
      const s = new FakeSession(opts);
      made.push(s);
      return s as unknown as AvatarSession;
    },
  });

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter({ db, inviteCode: INVITE, isProduction: false }));
  app.use('/api/accounts', accountsRouter({ db, masterKey: TEST_KEY, isProduction: false, sessions }));
  const server = await startTestServer(app);

  const register = (email: string) =>
    server.fetch('/api/auth/register', {
      method: 'POST',
      json: { email, password: PASSWORD, inviteCode: INVITE },
    });

  return { db, server, sessions, made, register };
}

const NEW_ACCOUNT = { label: 'chính', gameUser: 'NguoiChoi', gamePass: 'bimat' };

test('chưa đăng nhập thì mọi endpoint trả 401', async () => {
  const { db, server } = await setup();
  assert.equal((await server.fetch('/api/accounts')).status, 401);
  assert.equal((await server.fetch('/api/accounts', { method: 'POST', json: NEW_ACCOUNT })).status, 401);
  assert.equal((await server.fetch('/api/accounts/1', { method: 'DELETE' })).status, 401);
  await server.close();
  db.close();
});

test('tạo tài khoản rồi thấy trong danh sách', async () => {
  const { db, server, register } = await setup();
  await register('a@b.c');
  const created = await server.fetch('/api/accounts', { method: 'POST', json: NEW_ACCOUNT });
  assert.equal(created.status, 200);
  assert.equal(created.body.label, 'chính');
  assert.equal(created.body.host, DEFAULT_GAME_SERVER.host);

  const list = await server.fetch('/api/accounts');
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].id, created.body.id);
  await server.close();
  db.close();
});

test('response không bao giờ chứa mật khẩu, chỉ có cờ hasPassword', async () => {
  const { db, server, register } = await setup();
  await register('a@b.c');
  const created = await server.fetch('/api/accounts', { method: 'POST', json: NEW_ACCOUNT });
  const list = await server.fetch('/api/accounts');
  for (const body of [created.body, list.body]) {
    const json = JSON.stringify(body);
    assert.ok(!json.includes('bimat'), 'lộ mật khẩu rõ');
    assert.ok(!json.includes('v1:'), 'lộ bản mã');
  }
  assert.equal(created.body.hasPassword, true);
  await server.close();
  db.close();
});

test('thiếu trường bắt buộc thì 400', async () => {
  const { db, server, register } = await setup();
  await register('a@b.c');
  const r = await server.fetch('/api/accounts', { method: 'POST', json: { label: 'x' } });
  assert.equal(r.status, 400);
  await server.close();
  db.close();
});

test('danh sách kèm trạng thái runtime của phiên đang chạy', async () => {
  const { db, server, sessions, register } = await setup();
  await register('a@b.c');
  const created = await server.fetch('/api/accounts', { method: 'POST', json: NEW_ACCOUNT });
  await sessions.connect(created.body.id);

  const list = await server.fetch('/api/accounts');
  assert.equal(list.body[0].runtime.status, 'online');
  assert.equal(list.body[0].runtime.money, 42);
  await server.close();
  db.close();
});

test('sửa: gửi gamePass thì đổi, không gửi thì giữ nguyên', async () => {
  const { db, server, register } = await setup();
  await register('a@b.c');
  const created = await server.fetch('/api/accounts', { method: 'POST', json: NEW_ACCOUNT });
  const id = created.body.id;

  await server.fetch(`/api/accounts/${id}`, { method: 'PATCH', json: { label: 'đổi tên' } });
  assert.equal(readGamePass(db, TEST_KEY, id), 'bimat');

  await server.fetch(`/api/accounts/${id}`, { method: 'PATCH', json: { gamePass: 'moi' } });
  assert.equal(readGamePass(db, TEST_KEY, id), 'moi');

  const list = await server.fetch('/api/accounts');
  assert.equal(list.body[0].label, 'đổi tên');
  await server.close();
  db.close();
});

test('xoá thì dừng phiên trước rồi mới xoá bản ghi', async () => {
  const { db, server, sessions, made, register } = await setup();
  await register('a@b.c');
  const created = await server.fetch('/api/accounts', { method: 'POST', json: NEW_ACCOUNT });
  await sessions.connect(created.body.id);

  const r = await server.fetch(`/api/accounts/${created.body.id}`, { method: 'DELETE' });
  assert.equal(r.status, 200);
  assert.equal(made[0].stopped, 1);
  assert.equal(sessions.size(), 0);
  assert.equal((await server.fetch('/api/accounts')).body.length, 0);
  await server.close();
  db.close();
});

test('không đụng được vào tài khoản của người khác', async () => {
  const { db, server, register } = await setup();
  await register('a@b.c');
  const created = await server.fetch('/api/accounts', { method: 'POST', json: NEW_ACCOUNT });
  const id = created.body.id;

  server.clearCookies();
  await register('ke-la@b.c');

  assert.equal((await server.fetch('/api/accounts')).body.length, 0);
  assert.equal(
    (await server.fetch(`/api/accounts/${id}`, { method: 'PATCH', json: { label: 'chiếm' } })).status,
    404,
  );
  assert.equal((await server.fetch(`/api/accounts/${id}`, { method: 'DELETE' })).status, 404);
  await server.close();
  db.close();
});

test('id không phải số thì 400', async () => {
  const { db, server, register } = await setup();
  await register('a@b.c');
  assert.equal((await server.fetch('/api/accounts/abc', { method: 'DELETE' })).status, 400);
  await server.close();
  db.close();
});
```

- [x] **Step 2: Chạy test để xác nhận thất bại**

Run: `cd server && npm test`
Expected: FAIL — `Cannot find module './routes.js'`.

- [x] **Step 3: Viết `accounts/routes.ts`**

`server/src/accounts/routes.ts`:

```ts
import { Router, type RequestHandler } from 'express';

import { makeRequireAuth, type AuthedRequest } from '../auth/middleware.js';
import type { Db } from '../db/index.js';
import type { DeviceProfile } from '../game/client.js';
import type { SessionManager } from '../session/manager.js';
import {
  createAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  updateAccount,
  type AvatarAccount,
} from './repo.js';

export interface AccountsDeps {
  db: Db;
  masterKey: Buffer;
  isProduction: boolean;
  sessions: SessionManager;
}

export interface AccountRequest extends AuthedRequest {
  account?: AvatarAccount;
}

/**
 * Nạp tài khoản theo `:id` VÀ theo `user_id` của người đang đăng nhập.
 *
 * Trả 404 chứ không 403 cho tài khoản của người khác: xác nhận "id này có tồn
 * tại" cũng là rò rỉ. Mọi route đụng vào `:id` phải đi qua đây.
 */
export function requireOwnedAccount(db: Db): RequestHandler {
  return (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id không hợp lệ' });
    const user = (req as AuthedRequest).user!;
    const account = getAccount(db, user.id, id);
    if (!account) return res.status(404).json({ error: 'không có tài khoản này' });
    (req as AccountRequest).account = account;
    next();
  };
}

export function accountsRouter(deps: AccountsDeps): Router {
  const { db, masterKey, isProduction, sessions } = deps;
  const router = Router();
  router.use(makeRequireAuth(db, isProduction));
  const owned = requireOwnedAccount(db);

  router.get('/', (req, res) => {
    const user = (req as AuthedRequest).user!;
    res.json(
      listAccounts(db, user.id).map((account) => ({
        ...account,
        runtime: sessions.snapshot(account.id),
      })),
    );
  });

  router.post('/', (req, res) => {
    const { label, gameUser, gamePass, host, port, device } = (req.body ?? {}) as Record<
      string,
      unknown
    >;
    if (typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: 'thiếu nhãn' });
    }
    if (typeof gameUser !== 'string' || !gameUser.trim()) {
      return res.status(400).json({ error: 'thiếu tài khoản game' });
    }
    if (typeof gamePass !== 'string' || gamePass === '') {
      return res.status(400).json({ error: 'thiếu mật khẩu game' });
    }
    const user = (req as AuthedRequest).user!;
    res.json(
      createAccount(db, masterKey, {
        userId: user.id,
        label: label.trim(),
        gameUser: gameUser.trim(),
        gamePass,
        host: typeof host === 'string' && host.trim() ? host.trim() : undefined,
        port: port === undefined || port === '' ? undefined : Number(port),
        device: (device ?? undefined) as Partial<DeviceProfile> | undefined,
      }),
    );
  });

  router.patch('/:id', owned, (req, res) => {
    const user = (req as AuthedRequest).user!;
    const { label, gameUser, gamePass, host, port, device } = (req.body ?? {}) as Record<
      string,
      unknown
    >;
    const updated = updateAccount(db, masterKey, user.id, (req as AccountRequest).account!.id, {
      label: typeof label === 'string' ? label.trim() : undefined,
      gameUser: typeof gameUser === 'string' ? gameUser.trim() : undefined,
      // Chuỗi rỗng nghĩa là "không đổi" — repo đã xử lý, nhưng nói rõ ở đây để
      // đọc route là biết hợp đồng.
      gamePass: typeof gamePass === 'string' && gamePass !== '' ? gamePass : undefined,
      host: typeof host === 'string' && host.trim() ? host.trim() : undefined,
      port: port === undefined || port === '' ? undefined : Number(port),
      device: device === null ? null : (device as Partial<DeviceProfile> | undefined),
    });
    res.json(updated);
  });

  router.delete('/:id', owned, (req, res) => {
    const user = (req as AuthedRequest).user!;
    const id = (req as AccountRequest).account!.id;
    // Dừng phiên TRƯỚC: xoá bản ghi trước sẽ để lại một socket TCP không còn
    // tài khoản nào để đọc lại mật khẩu khi cần kết nối lại.
    sessions.destroy(id);
    deleteAccount(db, user.id, id);
    res.json({ ok: true });
  });

  return router;
}
```

- [x] **Step 4: Chạy test để xác nhận pass**

Run: `cd server && npm test`
Expected: PASS.

- [x] **Step 5: Typecheck và commit**

```bash
cd server && npm run typecheck
git add server/src/accounts/routes.ts server/src/accounts/routes.test.ts
git commit -m "feat(server): route CRUD tài khoản avatar, cách ly theo người dùng"
```

---

## Task 11: Route điều khiển phiên `/api/accounts/:id/*`

**Files:**
- Create: `server/src/session/routes.ts`
- Test: `server/src/session/routes.test.ts`

**Interfaces:**
- Consumes: `requireOwnedAccount`/`AccountRequest` (Task 10), `SessionManager` (Task 9), `setAutoEnabled` (Task 5).
- Produces:
  - `interface SessionRoutesDeps { db: Db; isProduction: boolean; sessions: SessionManager }`
  - `sessionRouter(deps: SessionRoutesDeps): Router` — mount tại `/api/accounts`

- [x] **Step 1: Viết test**

`server/src/session/routes.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { newTestDb, startTestServer, TEST_KEY } from '../test-helpers.js';
import { authRouter } from '../auth/routes.js';
import { accountsRouter } from '../accounts/routes.js';
import { getAccountById } from '../accounts/repo.js';
import type { AvatarSession, AvatarSessionOptions } from './avatarSession.js';
import { SessionManager } from './manager.js';
import { sessionRouter } from './routes.js';

const INVITE = 'ma-moi';
const PASSWORD = 'mat-khau-du-dai';

class FakeSession {
  calls: Array<{ name: string; args: unknown[] }> = [];
  throwOn?: string;
  constructor(readonly opts: AvatarSessionOptions) {}
  private record(name: string, ...args: unknown[]) {
    this.calls.push({ name, args });
    if (this.throwOn === name) throw new Error(`hỏng: ${name}`);
  }
  async start() {
    this.record('start');
  }
  stop() {
    this.record('stop');
  }
  startAuto(cfg: unknown) {
    this.record('startAuto', cfg);
  }
  stopAuto() {
    this.record('stopAuto');
  }
  startMacro(m: unknown) {
    this.record('startMacro', m);
  }
  stopMacro() {
    this.record('stopMacro');
  }
  callFarm(name: string, args: unknown[]) {
    this.record('callFarm', name, args);
  }
  sendRaw(cmd: number, fields: unknown) {
    this.record('sendRaw', cmd, fields);
  }
  enterFarm() {
    this.record('enterFarm');
  }
  lastPacketHex(cmd: number) {
    return cmd === 76 ? 'deadbeef' : undefined;
  }
  snapshot() {
    return { accountId: this.opts.accountId, status: 'online', traffic: [{ cmd: 1 }, { cmd: 2 }] };
  }
}

async function setup() {
  const db = newTestDb();
  const made: FakeSession[] = [];
  const sessions = new SessionManager({
    db,
    masterKey: TEST_KEY,
    maxSessions: 20,
    broadcast: () => {},
    createSession: (opts) => {
      const s = new FakeSession(opts);
      made.push(s);
      return s as unknown as AvatarSession;
    },
  });

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter({ db, inviteCode: INVITE, isProduction: false }));
  app.use('/api/accounts', accountsRouter({ db, masterKey: TEST_KEY, isProduction: false, sessions }));
  app.use('/api/accounts', sessionRouter({ db, isProduction: false, sessions }));
  const server = await startTestServer(app);

  await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'a@b.c', password: PASSWORD, inviteCode: INVITE },
  });
  const created = await server.fetch('/api/accounts', {
    method: 'POST',
    json: { label: 'x', gameUser: 'u', gamePass: 'p' },
  });

  return { db, server, sessions, made, id: created.body.id as number };
}

test('connect tạo phiên và gọi start', async () => {
  const { db, server, made, id } = await setup();
  const r = await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
  assert.equal(r.status, 200);
  assert.deepEqual(made[0].calls.map((c) => c.name), ['start']);
  await server.close();
  db.close();
});

test('disconnect gọi stop', async () => {
  const { db, server, made, id } = await setup();
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
  const r = await server.fetch(`/api/accounts/${id}/disconnect`, { method: 'POST' });
  assert.equal(r.status, 200);
  assert.equal(made[0].calls.at(-1)!.name, 'stop');
  await server.close();
  db.close();
});

test('auto/start ghi DB trước rồi mới áp vào phiên', async () => {
  const { db, server, made, id } = await setup();
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
  const cfg = { harvest: true, intervalMs: 60000 };
  const r = await server.fetch(`/api/accounts/${id}/auto/start`, { method: 'POST', json: cfg });
  assert.equal(r.status, 200);

  const row = getAccountById(db, id)!;
  assert.equal(row.autoEnabled, true);
  assert.deepEqual(row.autoConfig, cfg);
  assert.deepEqual(made[0].calls.at(-1), { name: 'startAuto', args: [cfg] });
  await server.close();
  db.close();
});

test('auto/start khi chưa kết nối vẫn ghi được ý muốn vào DB', async () => {
  const { db, server, id } = await setup();
  const r = await server.fetch(`/api/accounts/${id}/auto/start`, {
    method: 'POST',
    json: { harvest: true },
  });
  // 409 vì phiên chưa tồn tại — nhưng ý muốn đã kịp ghi vào DB trước đó.
  assert.equal(r.status, 409);
  assert.equal(getAccountById(db, id)!.autoEnabled, true);
  await server.close();
  db.close();
});

test('phiên ném lỗi khi bật auto thì DB vẫn giữ ý muốn và trả 500', async () => {
  const { db, server, made, id } = await setup();
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
  made[0].throwOn = 'startAuto';
  const r = await server.fetch(`/api/accounts/${id}/auto/start`, {
    method: 'POST',
    json: { harvest: true },
  });
  assert.equal(r.status, 500);
  // Ý muốn đã ghi rồi: bootstrap sau restart vẫn bật lại đúng.
  assert.equal(getAccountById(db, id)!.autoEnabled, true);
  await server.close();
  db.close();
});

test('auto/stop ghi DB trước rồi mới dừng phiên', async () => {
  const { db, server, made, id } = await setup();
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
  await server.fetch(`/api/accounts/${id}/auto/start`, { method: 'POST', json: { harvest: true } });
  await server.fetch(`/api/accounts/${id}/auto/stop`, { method: 'POST' });
  assert.equal(getAccountById(db, id)!.autoEnabled, false);
  assert.equal(made[0].calls.at(-1)!.name, 'stopAuto');
  await server.close();
  db.close();
});

test('farm, raw, enter-farm, macro chuyển tiếp đúng tham số', async () => {
  const { db, server, made, id } = await setup();
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });

  await server.fetch(`/api/accounts/${id}/farm`, {
    method: 'POST',
    json: { name: 'harvest', args: [0, 3] },
  });
  await server.fetch(`/api/accounts/${id}/raw`, {
    method: 'POST',
    json: { cmd: 76, fields: [{ t: 'i32', v: '1' }] },
  });
  await server.fetch(`/api/accounts/${id}/enter-farm`, { method: 'POST' });
  await server.fetch(`/api/accounts/${id}/macro/start`, {
    method: 'POST',
    json: { name: 'm', intervalMs: 0, steps: [] },
  });
  await server.fetch(`/api/accounts/${id}/macro/stop`, { method: 'POST' });

  const names = made[0].calls.map((c) => c.name);
  assert.deepEqual(names, ['start', 'callFarm', 'sendRaw', 'enterFarm', 'startMacro', 'stopMacro']);
  assert.deepEqual(made[0].calls[1].args, ['harvest', [0, 3]]);
  assert.deepEqual(made[0].calls[2].args, [76, [{ t: 'i32', v: '1' }]]);
  await server.close();
  db.close();
});

test('gọi lệnh khi chưa có phiên thì 409', async () => {
  const { db, server, id } = await setup();
  const r = await server.fetch(`/api/accounts/${id}/farm`, {
    method: 'POST',
    json: { name: 'harvest', args: [] },
  });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /chưa kết nối/);
  await server.close();
  db.close();
});

test('state trả snapshot, traffic cắt theo n, packet trả hex', async () => {
  const { db, server, id } = await setup();
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });

  assert.equal((await server.fetch(`/api/accounts/${id}/state`)).body.status, 'online');
  assert.equal((await server.fetch(`/api/accounts/${id}/traffic?n=1`)).body.length, 1);
  assert.equal((await server.fetch(`/api/accounts/${id}/packet/76`)).body.hex, 'deadbeef');
  assert.equal((await server.fetch(`/api/accounts/${id}/packet/99`)).status, 404);
  await server.close();
  db.close();
});

test('không điều khiển được phiên của người khác', async () => {
  const { db, server, id } = await setup();
  server.clearCookies();
  await server.fetch('/api/auth/register', {
    method: 'POST',
    json: { email: 'ke-la@b.c', password: PASSWORD, inviteCode: INVITE },
  });
  for (const path of ['connect', 'disconnect', 'auto/start', 'auto/stop', 'farm', 'raw']) {
    const r = await server.fetch(`/api/accounts/${id}/${path}`, { method: 'POST', json: {} });
    assert.equal(r.status, 404, `${path} phải là 404`);
  }
  assert.equal((await server.fetch(`/api/accounts/${id}/state`)).status, 404);
  await server.close();
  db.close();
});
```

- [x] **Step 2: Chạy test để xác nhận thất bại**

Run: `cd server && npm test`
Expected: FAIL — `Cannot find module './routes.js'`.

- [x] **Step 3: Viết `session/routes.ts`**

`server/src/session/routes.ts`:

```ts
import { Router, type Response } from 'express';

import { requireOwnedAccount, type AccountRequest } from '../accounts/routes.js';
import { setAutoEnabled } from '../accounts/repo.js';
import type { AutoFarmConfig } from '../autoFarm.js';
import { makeRequireAuth } from '../auth/middleware.js';
import type { Db } from '../db/index.js';
import type { Macro } from '../macro.js';
import type { SessionManager } from './manager.js';

export interface SessionRoutesDeps {
  db: Db;
  isProduction: boolean;
  sessions: SessionManager;
}

/**
 * "Chưa kết nối" là trạng thái hợp lệ của tài nguyên, không phải lỗi máy chủ —
 * 409 để UI phân biệt được với 500 (lệnh gửi đi rồi mà hỏng).
 */
function fail(res: Response, err: unknown): void {
  const message = (err as Error).message;
  res.status(message.includes('chưa kết nối') ? 409 : 500).json({ error: message });
}

export function sessionRouter(deps: SessionRoutesDeps): Router {
  const { db, isProduction, sessions } = deps;
  const router = Router();
  router.use(makeRequireAuth(db, isProduction));

  const owned = requireOwnedAccount(db);
  const accountId = (req: unknown) => (req as AccountRequest).account!.id;

  router.post('/:id/connect', owned, async (req, res) => {
    try {
      await sessions.connect(accountId(req));
      res.json(sessions.snapshot(accountId(req)));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.post('/:id/disconnect', owned, (req, res) => {
    sessions.disconnect(accountId(req));
    res.json({ ok: true });
  });

  router.post('/:id/auto/start', owned, async (req, res) => {
    const id = accountId(req);
    const cfg = (req.body ?? {}) as Partial<AutoFarmConfig>;
    // Ghi ý muốn vào DB TRƯỚC. Làm ngược lại thì restart giữa chừng là mất ý
    // muốn của người dùng, và bootstrap sẽ không bật lại tài khoản này.
    setAutoEnabled(db, id, true, cfg);
    try {
      sessions.require(id).startAuto(cfg);
      res.json(sessions.snapshot(id));
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/:id/auto/stop', owned, (req, res) => {
    const id = accountId(req);
    setAutoEnabled(db, id, false, null);
    sessions.peek(id)?.stopAuto();
    res.json({ ok: true });
  });

  router.post('/:id/farm', owned, (req, res) => {
    const { name, args } = (req.body ?? {}) as { name?: string; args?: unknown[] };
    if (typeof name !== 'string') return res.status(400).json({ error: 'thiếu tên action' });
    try {
      sessions.require(accountId(req)).callFarm(name, args ?? []);
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/:id/raw', owned, (req, res) => {
    const { cmd, fields } = (req.body ?? {}) as { cmd?: unknown; fields?: Array<{ t: string; v: string }> };
    try {
      sessions.require(accountId(req)).sendRaw(Number(cmd), fields ?? []);
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/:id/enter-farm', owned, (req, res) => {
    try {
      sessions.require(accountId(req)).enterFarm();
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/:id/macro/start', owned, (req, res) => {
    try {
      sessions.require(accountId(req)).startMacro(req.body as Macro);
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  router.post('/:id/macro/stop', owned, (req, res) => {
    sessions.peek(accountId(req))?.stopMacro();
    res.json({ ok: true });
  });

  router.get('/:id/state', owned, (req, res) => {
    res.json(sessions.snapshot(accountId(req)));
  });

  router.get('/:id/traffic', owned, (req, res) => {
    const snap = sessions.snapshot(accountId(req));
    if (!snap) return res.json([]);
    const n = Math.min(Number(req.query.n ?? 30), 500);
    res.json(snap.traffic.slice(-n));
  });

  router.get('/:id/packet/:cmd', owned, (req, res) => {
    const cmd = Number(req.params.cmd);
    const hex = sessions.peek(accountId(req))?.lastPacketHex(cmd);
    if (!hex) return res.status(404).json({ error: 'chưa nhận gói này' });
    res.json({ cmd, bytes: hex.length / 2, hex });
  });

  return router;
}
```

- [x] **Step 4: Chạy test để xác nhận pass**

Run: `cd server && npm test`
Expected: PASS.

- [x] **Step 5: Typecheck và commit**

```bash
cd server && npm run typecheck
git add server/src/session/routes.ts server/src/session/routes.test.ts
git commit -m "feat(server): route điều khiển phiên theo từng tài khoản"
```

---

## Task 12: WebSocket có xác thực

**Files:**
- Create: `server/src/ws.ts`
- Test: `server/src/ws.test.ts`

**Interfaces:**
- Consumes: `authenticateCookieHeader` (Task 6), `getAccount` (Task 5), `SessionManager` (Task 9).
- Produces:
  - `LIGHT_EVENTS: Set<string>` — sự kiện đẩy cho mọi client của chủ sở hữu
  - `interface WsHub { broadcast(userId: number, accountId: number, type: string, payload: unknown): void; clientCount(): number; close(): void }`
  - `attachWebSocket(server: http.Server, deps: { db: Db; sessions: SessionManager }): WsHub`

- [x] **Step 1: Viết test**

`server/src/ws.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { WebSocket } from 'ws';

import { newTestDb, startTestServer, TEST_KEY } from './test-helpers.js';
import { authRouter } from './auth/routes.js';
import { createAccount } from './accounts/repo.js';
import { createUser } from './auth/users.js';
import { createSession } from './auth/sessions.js';
import { SessionManager } from './session/manager.js';
import type { AvatarSession, AvatarSessionOptions } from './session/avatarSession.js';
import { attachWebSocket, type WsHub } from './ws.js';

class FakeSession {
  constructor(readonly opts: AvatarSessionOptions) {}
  async start() {}
  stop() {}
  snapshot() {
    return { accountId: this.opts.accountId, status: 'online' };
  }
}

async function setup() {
  const db = newTestDb();
  const sessions = new SessionManager({
    db,
    masterKey: TEST_KEY,
    maxSessions: 20,
    broadcast: (u, a, t, p) => hub.broadcast(u, a, t, p),
    createSession: (opts) => new FakeSession(opts) as unknown as AvatarSession,
  });

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter({ db, inviteCode: 'x', isProduction: false }));

  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as { port: number };
  const hub: WsHub = attachWebSocket(server, { db, sessions });

  const user = createUser(db, 'a@b.c', 'h', 0);
  const other = createUser(db, 'b@b.c', 'h', 0);
  const account = createAccount(db, TEST_KEY, {
    userId: user.id,
    label: 'x',
    gameUser: 'u',
    gamePass: 'p',
  });
  const sid = createSession(db, user.id);
  const otherSid = createSession(db, other.id);

  const connect = (cookie?: string) =>
    new WebSocket(`ws://127.0.0.1:${port}/ws`, cookie ? { headers: { cookie } } : undefined);

  const close = async () => {
    hub.close();
    await new Promise<void>((r) => server.close(() => r()));
    db.close();
  };

  return { db, hub, sessions, user, other, account, sid, otherSid, connect, close };
}

/** Chờ một message JSON đầu tiên khớp `type`, hoặc timeout. */
function waitMessage(ws: WebSocket, type: string, ms = 500): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`quá hạn chờ "${type}"`)), ms);
    ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.type !== type) return;
      clearTimeout(timer);
      resolve(msg);
    });
  });
}

function waitOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
}

test('không có cookie thì bị đóng ngay', async () => {
  const h = await setup();
  const ws = h.connect();
  const code = await new Promise<number>((resolve) => {
    ws.on('close', (c) => resolve(c));
    ws.on('error', () => {});
  });
  assert.equal(code, 4401);
  assert.equal(h.hub.clientCount(), 0);
  await h.close();
});

test('cookie hợp lệ thì mở được', async () => {
  const h = await setup();
  const ws = h.connect(`sid=${h.sid}`);
  await waitOpen(ws);
  assert.equal(h.hub.clientCount(), 1);
  ws.close();
  await h.close();
});

test('sự kiện nhẹ đẩy tới mọi client của chủ sở hữu, không cần subscribe', async () => {
  const h = await setup();
  const ws = h.connect(`sid=${h.sid}`);
  await waitOpen(ws);
  const got = waitMessage(ws, 'status');
  h.hub.broadcast(h.user.id, h.account.id, 'status', 'online');
  const msg = await got;
  assert.equal(msg.accountId, h.account.id);
  assert.equal(msg.payload, 'online');
  ws.close();
  await h.close();
});

test('sự kiện nhẹ KHÔNG đẩy tới client của người khác', async () => {
  const h = await setup();
  const ws = h.connect(`sid=${h.otherSid}`);
  await waitOpen(ws);
  const got = waitMessage(ws, 'status', 200);
  h.hub.broadcast(h.user.id, h.account.id, 'status', 'online');
  await assert.rejects(() => got, /quá hạn/);
  ws.close();
  await h.close();
});

test('sự kiện nặng chỉ đẩy khi đã subscribe accountId đó', async () => {
  const h = await setup();
  const ws = h.connect(`sid=${h.sid}`);
  await waitOpen(ws);

  const before = waitMessage(ws, 'traffic', 200);
  h.hub.broadcast(h.user.id, h.account.id, 'traffic', { cmd: 1 });
  await assert.rejects(() => before, /quá hạn/);

  ws.send(JSON.stringify({ op: 'subscribe', accountIds: [h.account.id] }));
  await waitMessage(ws, 'snapshot');

  const after = waitMessage(ws, 'traffic');
  h.hub.broadcast(h.user.id, h.account.id, 'traffic', { cmd: 2 });
  assert.deepEqual((await after).payload, { cmd: 2 });
  ws.close();
  await h.close();
});

test('subscribe trả về snapshot hiện tại của phiên', async () => {
  const h = await setup();
  await h.sessions.connect(h.account.id);
  const ws = h.connect(`sid=${h.sid}`);
  await waitOpen(ws);
  ws.send(JSON.stringify({ op: 'subscribe', accountIds: [h.account.id] }));
  const snap = await waitMessage(ws, 'snapshot');
  assert.equal(snap.accountId, h.account.id);
  assert.equal(snap.payload.status, 'online');
  ws.close();
  await h.close();
});

test('subscribe accountId của người khác bị bỏ qua', async () => {
  const h = await setup();
  const ws = h.connect(`sid=${h.otherSid}`);
  await waitOpen(ws);
  ws.send(JSON.stringify({ op: 'subscribe', accountIds: [h.account.id] }));

  const got = waitMessage(ws, 'traffic', 300);
  h.hub.broadcast(h.user.id, h.account.id, 'traffic', { cmd: 1 });
  await assert.rejects(() => got, /quá hạn/);
  ws.close();
  await h.close();
});

test('unsubscribe thì thôi nhận sự kiện nặng', async () => {
  const h = await setup();
  const ws = h.connect(`sid=${h.sid}`);
  await waitOpen(ws);
  ws.send(JSON.stringify({ op: 'subscribe', accountIds: [h.account.id] }));
  await waitMessage(ws, 'snapshot');
  ws.send(JSON.stringify({ op: 'subscribe', accountIds: [] }));
  await new Promise((r) => setTimeout(r, 50));

  const got = waitMessage(ws, 'traffic', 300);
  h.hub.broadcast(h.user.id, h.account.id, 'traffic', { cmd: 1 });
  await assert.rejects(() => got, /quá hạn/);
  ws.close();
  await h.close();
});

test('client đóng thì bị gỡ khỏi hub', async () => {
  const h = await setup();
  const ws = h.connect(`sid=${h.sid}`);
  await waitOpen(ws);
  await new Promise<void>((r) => {
    ws.on('close', () => r());
    ws.close();
  });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(h.hub.clientCount(), 0);
  await h.close();
});

test('tin nhắn rác không làm sập server', async () => {
  const h = await setup();
  const ws = h.connect(`sid=${h.sid}`);
  await waitOpen(ws);
  ws.send('không phải json');
  ws.send(JSON.stringify({ op: 'không-biết' }));
  ws.send(JSON.stringify({ op: 'subscribe', accountIds: 'không phải mảng' }));
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(h.hub.clientCount(), 1);
  ws.close();
  await h.close();
});
```

- [x] **Step 2: Chạy test để xác nhận thất bại**

Run: `cd server && npm test`
Expected: FAIL — `Cannot find module './ws.js'`.

- [x] **Step 3: Viết `ws.ts`**

`server/src/ws.ts`:

```ts
import type http from 'node:http';

import { WebSocket, WebSocketServer } from 'ws';

import { getAccount } from './accounts/repo.js';
import { authenticateCookieHeader } from './auth/middleware.js';
import type { Db } from './db/index.js';
import type { SessionManager } from './session/manager.js';

/**
 * Sự kiện nhẹ: đẩy cho mọi client của chủ sở hữu, kể cả khi họ đang ở trang
 * danh sách — đó là thứ làm cho bảng trạng thái tự cập nhật.
 * Mọi sự kiện khác là nặng (traffic, log, farm, inventory…) và chỉ tới client
 * đang mở trang chi tiết của đúng tài khoản đó.
 */
export const LIGHT_EVENTS = new Set(['status', 'auto', 'auto-disabled']);

export interface WsHub {
  broadcast(userId: number, accountId: number, type: string, payload: unknown): void;
  clientCount(): number;
  close(): void;
}

interface Client {
  ws: WebSocket;
  userId: number;
  subscriptions: Set<number>;
}

export function attachWebSocket(
  server: http.Server,
  deps: { db: Db; sessions: SessionManager },
): WsHub {
  const { db, sessions } = deps;
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set<Client>();

  const send = (ws: WebSocket, type: string, accountId: number, payload: unknown) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type, accountId, payload }));
    } catch {
      /* client đang đóng — bỏ qua */
    }
  };

  wss.on('connection', (ws, req) => {
    // WS không đi qua middleware Express; xác thực bằng chính cookie đó.
    const user = authenticateCookieHeader(db, req.headers.cookie);
    if (!user) return ws.close(4401, 'chưa đăng nhập');

    const client: Client = { ws, userId: user.id, subscriptions: new Set() };
    clients.add(client);

    ws.on('message', (raw) => {
      let msg: { op?: string; accountIds?: unknown };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.op !== 'subscribe' || !Array.isArray(msg.accountIds)) return;

      client.subscriptions.clear();
      for (const value of msg.accountIds) {
        const id = Number(value);
        // Kiểm quyền ở đây nữa: không dựa vào việc giao diện không hiển thị id lạ.
        if (!Number.isInteger(id) || !getAccount(db, client.userId, id)) continue;
        client.subscriptions.add(id);
        send(ws, 'snapshot', id, sessions.snapshot(id));
      }
    });

    ws.on('error', () => ws.close());
    ws.on('close', () => clients.delete(client));
  });

  return {
    broadcast(userId, accountId, type, payload) {
      const light = LIGHT_EVENTS.has(type);
      for (const c of clients) {
        if (c.userId !== userId) continue;
        if (!light && !c.subscriptions.has(accountId)) continue;
        send(c.ws, type, accountId, payload);
      }
    },
    clientCount() {
      return clients.size;
    },
    close() {
      for (const c of clients) c.ws.close();
      clients.clear();
      wss.close();
    },
  };
}
```

- [x] **Step 4: Chạy test để xác nhận pass**

Run: `cd server && npm test`
Expected: PASS.

- [x] **Step 5: Typecheck và commit**

```bash
cd server && npm run typecheck
git add server/src/ws.ts server/src/ws.test.ts
git commit -m "feat(server): WebSocket xác thực bằng cookie, định tuyến theo accountId"
```

---

## Task 13: Lắp ráp `index.ts`

Task này gỡ toàn bộ mã một-phiên: `account.ts`, `GameClient` toàn cục, khối auto-login đọc file, và các endpoint `/api/login`, `/api/logout`, `/api/farm`, `/api/raw`, `/api/macro/*`, `/api/auto/*`, `/api/state`, `/api/traffic`, `/api/packet/:cmd` cũ.

**Files:**
- Modify: `server/src/index.ts` (viết lại toàn bộ, 199 dòng → ~70 dòng)
- Delete: `server/src/account.ts`
- Create: `server/.env.example`

**Interfaces:**
- Consumes: mọi thứ từ Task 1–12.
- Produces: không có export mới — đây là điểm vào.

- [x] **Step 1: Xoá `account.ts` và gỡ tham chiếu còn sót trong `tools/`**

```bash
cd /Users/devios/learning-reverse/avatar-web
git rm server/src/account.ts
grep -rn "account.js" server/src
```

`server/src/tools/rate-test.ts` còn `import { DEFAULT_SERVER, readAccount } from '../account.js'`.
Sửa nó nhận tài khoản qua argv như `login-test.ts` vẫn làm, và lấy host/port từ
`DEFAULT_GAME_SERVER` trong `config.ts`:

```ts
/**
 * Đo xem server chịu được nhịp gửi lệnh farm bao nhanh.
 *   npx tsx src/tools/rate-test.ts <user> <pass> [delayMs] [soLenh]
 * Đăng nhập mới, vào farm, chờ ổn định, rồi tưới liên tiếp các ô đang hạn.
 */
import { DEFAULT_GAME_SERVER } from '../config.js';
import { GameClient } from '../game/client.js';
import { ITEM_WATER } from '../game/farmData.js';

const [user, pass] = process.argv.slice(2);
const delayMs = Number(process.argv[4] ?? 700);
const n = Number(process.argv[5] ?? 6);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

if (!user || !pass) throw new Error('dùng: rate-test.ts <user> <pass> [delayMs] [soLenh]');

const c = new GameClient();
let died = -1;
c.on('log', (l: string) => console.log('   ', l));

await c.login({ ...DEFAULT_GAME_SERVER, user, pass });
```

phần còn lại của file giữ nguyên.

- [x] **Step 2: Viết lại `server/src/index.ts`**

Thay toàn bộ nội dung `server/src/index.ts` bằng:

```ts
import http from 'node:http';
import express from 'express';

import { accountsRouter } from './accounts/routes.js';
import { authRouter } from './auth/routes.js';
import { purgeExpiredSessions } from './auth/sessions.js';
import { loadConfig } from './config.js';
import { openDb } from './db/index.js';
import { SessionManager } from './session/manager.js';
import { sessionRouter } from './session/routes.js';
import { attachWebSocket, type WsHub } from './ws.js';

// Ném ngay nếu thiếu MASTER_KEY / INVITE_CODE — dừng còn hơn lặng lẽ chạy bằng
// khoá mặc định rồi ghi cả DB bằng nó.
const config = loadConfig();
const db = openDb(config.dbPath);
purgeExpiredSessions(db);

const app = express();
// Rate limit đếm theo IP; sau reverse proxy thì `req.ip` phải là IP thật chứ
// không phải 127.0.0.1, nếu không cả thế giới dùng chung một bộ đếm.
app.set('trust proxy', true);
app.use(express.json());

let hub: WsHub;
const sessions = new SessionManager({
  db,
  masterKey: config.masterKey,
  maxSessions: config.maxSessions,
  broadcast: (userId, accountId, type, payload) => hub.broadcast(userId, accountId, type, payload),
});

app.use('/api/auth', authRouter({ db, inviteCode: config.inviteCode, isProduction: config.isProduction }));
app.use(
  '/api/accounts',
  accountsRouter({ db, masterKey: config.masterKey, isProduction: config.isProduction, sessions }),
);
app.use('/api/accounts', sessionRouter({ db, isProduction: config.isProduction, sessions }));

const server = http.createServer(app);
hub = attachWebSocket(server, { db, sessions });

// Một process giữ mọi phiên: một promise bị bỏ rơi ở bất kỳ đâu cũng giết cả
// server và kéo theo mọi tài khoản khác.
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
});

function shutdown(signal: string): void {
  console.log(`${signal} — đang dừng`);
  sessions.stopAll();
  hub.close();
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

server.listen(config.port, () => {
  console.log(`avatar-web server: http://localhost:${config.port}`);
  void sessions.bootstrap().catch((err: Error) => console.error(`bootstrap lỗi: ${err.message}`));
});
```

- [x] **Step 3: Viết `server/.env.example`**

`server/.env.example`:

```
# Sinh bằng `npm run gen-key`. Đổi khoá này thì mọi mật khẩu game đã lưu
# không đọc lại được nữa — phải nhập lại từng tài khoản.
MASTER_KEY=

# Mã mời để đăng ký. Không có thì không ai tạo được tài khoản.
INVITE_CODE=

PORT=8787
MAX_SESSIONS=20
# NODE_ENV=production   # bật cookie Secure, chỉ dùng khi đã có HTTPS
```

- [x] **Step 4: Xác nhận server từ chối khởi động khi thiếu khoá**

Run: `cd server && npm start`
Expected: thoát ngay với `thiếu MASTER_KEY — chạy \`npm run gen-key\` rồi đặt vào env`.

- [x] **Step 5: Xác nhận server khởi động được khi đủ khoá**

```bash
cd server
MASTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))") \
INVITE_CODE=thu-nghiem \
DB_PATH=/tmp/avatar-web-smoke.db \
node --import tsx src/index.ts &
sleep 2
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8787/api/accounts
curl -s -X POST -H 'content-type: application/json' \
  -d '{"email":"a@b.c","password":"mat-khau-du-dai","inviteCode":"sai"}' \
  http://localhost:8787/api/auth/register
kill %1
rm -f /tmp/avatar-web-smoke.db*
```

Expected: `401` cho `/api/accounts`, và `{"error":"mã mời không đúng"}` cho register.

- [x] **Step 6: Typecheck, chạy toàn bộ test, commit**

```bash
cd server && npm run typecheck && npm test
git add server/src/index.ts server/.env.example
git commit -m "refactor(server): lắp ráp lại index.ts theo nhiều phiên, gỡ mã một-phiên"
```

---

## Task 14: Nền phía web — kiểu, `api`, `ws`, router, trang đăng nhập

Phía web không có bộ test tự động (spec đã chốt: kiểm thủ công bằng tài khoản thật).
Cổng kiểm tra của mọi task web là `npm run build` (chạy `tsc -b` rồi `vite build`) cộng
với một lượt bấm tay theo đúng kịch bản ghi trong từng task.

**Files:**
- Modify: `web/package.json`
- Create: `web/src/types.ts`
- Create: `web/src/api.ts`
- Create: `web/src/ws.ts`
- Create: `web/src/auth/useAuth.tsx`
- Create: `web/src/auth/LoginPage.tsx`
- Create: `web/src/auth/RegisterPage.tsx`
- Modify: `web/src/main.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: API của Task 7, 10, 11, 12.
- Produces:
  - `types.ts`: `TrafficEntry`, `FarmCell`, `FarmAnimal`, `AnimalInfo`, `FarmState`, `TreeInfo`, `ItemInfo`, `AutoState`, `InventoryItem`, `MacroState`, `LogLine`, `ClientStatus`, `SessionSnapshot`, `AvatarAccount`, `AccountWithRuntime`, `AuthUser`
  - `api.ts`: `ApiError`, `apiGet<T>(path)`, `apiPost<T>(path, body?)`, `apiPatch<T>(path, body)`, `apiDelete<T>(path)`
  - `ws.ts`: `connectWs()`, `subscribeAccounts(ids: number[])`, `onWsMessage(fn: (m: WsMessage) => void): () => void`, `interface WsMessage { type: string; accountId: number; payload: any }`
  - `auth/useAuth.tsx`: `AuthProvider`, `useAuth(): { user, loading, login, register, logout, refresh }`, `RequireAuth`

- [ ] **Step 1: Thêm react-router-dom**

```bash
cd web && npm install react-router-dom@^6.28.0
```

- [ ] **Step 2: Viết `web/src/types.ts`**

Chuyển các interface đang nằm ở đầu `web/src/App.tsx` (dòng 5–81) sang file riêng, thêm
những kiểu mới của tầng nhiều-phiên. `web/src/types.ts`:

```ts
export interface TrafficEntry {
  t: number;
  dir: 'tx' | 'rx';
  cmd: number;
  name: string;
  len: number;
  hex: string;
}

export interface FarmCell {
  index: number;
  idTree: number;
  time: number;
  vitalityPer: number;
  hervestPer: number;
  isArid: boolean;
  isWorm: boolean;
  isGrass: boolean;
  level?: number;
}

export interface FarmAnimal {
  index: number;
  species: number;
  bornTime: number;
  health: number;
  harvestPer: number;
  numEggOne: number;
  hunger: boolean;
}

export interface AnimalInfo {
  id: number;
  name: string;
  desc: string;
}

export interface FarmState {
  idFarm: number;
  cells: FarmCell[];
  animals: FarmAnimal[];
  updatedAt: number;
}

export interface TreeInfo {
  id: number;
  name: string;
  growMinutes: number;
  value: number;
}

export interface ItemInfo {
  id: number;
  name: string;
  price: number;
}

export interface AutoState {
  running: boolean;
  cycle: number;
  lastRun?: number;
  lastError?: string;
  lastActions: string[];
}

export interface InventoryItem {
  id: number;
  num: number;
}

export interface MacroState {
  running: boolean;
  name?: string;
  cycle: number;
  lastRun?: number;
  lastError?: string;
}

export interface LogLine {
  t: number;
  line: string;
}

export type ClientStatus =
  | 'idle'
  | 'connecting'
  | 'handshaking'
  | 'logging-in'
  | 'online'
  | 'error';

/** Khớp `AvatarSessionSnapshot` phía server. */
export interface SessionSnapshot {
  accountId: number;
  status: ClientStatus;
  lastError?: string;
  playerId?: number;
  money?: number;
  farm?: FarmState;
  auto: AutoState;
  macro: MacroState;
  inventory: InventoryItem[];
  trees: TreeInfo[];
  items: ItemInfo[];
  animals: AnimalInfo[];
  logs: LogLine[];
  traffic: TrafficEntry[];
  retries: number;
  nextRetryAt?: number;
  desiredConnected: boolean;
}

export interface AvatarAccount {
  id: number;
  label: string;
  gameUser: string;
  host: string;
  port: number;
  autoEnabled: boolean;
  hasPassword: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AccountWithRuntime extends AvatarAccount {
  runtime: SessionSnapshot | null;
}

export interface AuthUser {
  id: number;
  email: string;
}
```

- [ ] **Step 3: Viết `web/src/api.ts`**

`web/src/api.ts`:

```ts
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Đường dẫn được phép trả 401 mà không đá về /login (chính là lúc dò xem đã đăng nhập chưa). */
const SILENT_401 = new Set(['/api/auth/me']);

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    // Cookie phiên là HttpOnly; không gửi kèm thì mọi request đều 401.
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (res.status === 401 && !SILENT_401.has(path)) {
    // Phiên hết hạn khi tab đang mở: đá về đăng nhập thay vì để UI trống trơn.
    if (location.pathname !== '/login') location.assign('/login');
  }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `lỗi ${res.status}`);
  return data as T;
}

export const apiGet = <T,>(path: string) => request<T>('GET', path);
export const apiPost = <T,>(path: string, body?: unknown) => request<T>('POST', path, body ?? {});
export const apiPatch = <T,>(path: string, body: unknown) => request<T>('PATCH', path, body);
export const apiDelete = <T,>(path: string) => request<T>('DELETE', path);
```

- [ ] **Step 4: Viết `web/src/ws.ts`**

`web/src/ws.ts`:

```ts
export interface WsMessage {
  type: string;
  accountId: number;
  payload: any;
}

type Listener = (msg: WsMessage) => void;

const listeners = new Set<Listener>();
let socket: WebSocket | null = null;
let subscribed: number[] = [];
let reconnectTimer: number | undefined;

/**
 * Một kết nối WS dùng chung cho cả ứng dụng. Mở mỗi trang một socket thì mỗi
 * lần đổi route là một lần bắt tay lại, và server phải nhân bản mọi sự kiện.
 */
export function connectWs(): void {
  if (socket && socket.readyState <= WebSocket.OPEN) return;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  socket = ws;

  ws.onopen = () => sendSubscribe();
  ws.onmessage = (ev) => {
    let msg: WsMessage;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    for (const fn of listeners) fn(msg);
  };
  ws.onclose = () => {
    socket = null;
    // Server restart hoặc mạng chớp — thử lại, đừng bắt người dùng F5.
    if (reconnectTimer === undefined) {
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined;
        connectWs();
      }, 3000);
    }
  };
}

function sendSubscribe(): void {
  if (socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ op: 'subscribe', accountIds: subscribed }));
}

/** Đặt lại danh sách tài khoản đang mở trang chi tiết. Mảng rỗng = chỉ nhận sự kiện nhẹ. */
export function subscribeAccounts(ids: number[]): void {
  subscribed = ids;
  sendSubscribe();
}

export function onWsMessage(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
```

- [ ] **Step 5: Viết `web/src/auth/useAuth.tsx`**

`web/src/auth/useAuth.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { apiGet, apiPost } from '../api.js';
import { connectWs } from '../ws.js';
import type { AuthUser } from '../types.js';

interface AuthValue {
  user: AuthUser | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string, inviteCode: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await apiGet<AuthUser>('/api/auth/me'));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // WS chỉ mở sau khi đã có phiên — server đóng ngay kết nối không xác thực.
  useEffect(() => {
    if (user) connectWs();
  }, [user]);

  const value: AuthValue = {
    user,
    loading,
    async login(email, password) {
      setUser(await apiPost<AuthUser>('/api/auth/login', { email, password }));
    },
    async register(email, password, inviteCode) {
      setUser(await apiPost<AuthUser>('/api/auth/register', { email, password, inviteCode }));
    },
    async logout() {
      await apiPost('/api/auth/logout');
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong AuthProvider');
  return ctx;
}

/** Bọc mọi route cần đăng nhập. Chưa đăng nhập thì đá về /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="hint" style={{ padding: 24 }}>đang tải…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
```

- [ ] **Step 6: Viết `web/src/auth/LoginPage.tsx`**

`web/src/auth/LoginPage.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from './useAuth.js';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (user) return <Navigate to="/accounts" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await login(email, password);
      navigate('/accounts', { replace: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <h1>Đăng nhập</h1>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Mật khẩu
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'đang vào…' : 'Đăng nhập'}
        </button>
        {err && <p className="err">{err}</p>}
        <p className="hint">
          Chưa có tài khoản? <Link to="/register">Đăng ký bằng mã mời</Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 7: Viết `web/src/auth/RegisterPage.tsx`**

`web/src/auth/RegisterPage.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from './useAuth.js';

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (user) return <Navigate to="/accounts" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await register(email, password, inviteCode);
      navigate('/accounts', { replace: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <h1>Đăng ký</h1>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Mật khẩu <span className="hint">(tối thiểu 10 ký tự)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={10}
            required
          />
        </label>
        <label>
          Mã mời
          <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'đang tạo…' : 'Đăng ký'}
        </button>
        {err && <p className="err">{err}</p>}
        <p className="hint">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 8: Viết lại `web/src/main.tsx`**

Thay toàn bộ nội dung `web/src/main.tsx` bằng:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider, RequireAuth } from './auth/useAuth.js';
import { LoginPage } from './auth/LoginPage.js';
import { RegisterPage } from './auth/RegisterPage.js';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/accounts"
            element={
              <RequireAuth>
                <p className="hint" style={{ padding: 24 }}>
                  danh sách tài khoản — sẽ có ở task sau
                </p>
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/accounts" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
```

- [ ] **Step 9: Thêm style cho trang đăng nhập**

Thêm vào cuối `web/src/styles.css`:

```css
/* --- trang đăng nhập / đăng ký --- */
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.auth-card {
  width: 100%;
  max-width: 360px;
}

.auth-card h1 {
  margin: 0 0 12px;
  font-size: 20px;
}

.auth-card button[type='submit'] {
  width: 100%;
  margin-top: 8px;
}
```

- [ ] **Step 10: Build để xác nhận không lỗi kiểu**

Run: `cd web && npm run build`
Expected: build thành công, không lỗi TypeScript.

- [ ] **Step 11: Kiểm tay luồng đăng ký/đăng nhập**

```bash
cd server
MASTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))") \
INVITE_CODE=thu-nghiem npm run dev
# tab khác:
cd web && npm run dev
```

Mở `http://localhost:5173/login`. Kiểm:
1. Vào thẳng `/accounts` khi chưa đăng nhập → bị đá về `/login`.
2. Đăng ký sai mã mời → hiện "mã mời không đúng", vẫn ở trang đăng ký.
3. Đăng ký đúng mã mời → vào `/accounts`, thấy chữ tạm.
4. F5 → vẫn ở `/accounts` (cookie còn).
5. Đăng nhập sai mật khẩu → "email hoặc mật khẩu không đúng".

- [ ] **Step 12: Commit**

```bash
git add web/package.json web/package-lock.json web/src/types.ts web/src/api.ts web/src/ws.ts web/src/auth web/src/main.tsx web/src/styles.css
git commit -m "feat(web): router, tầng api/ws, trang đăng nhập và đăng ký"
```

---

## Task 15: Trang danh sách tài khoản `/accounts`

**Files:**
- Create: `web/src/accounts/AccountsPage.tsx`
- Modify: `web/src/main.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: `apiGet`/`apiPost`/`apiDelete` (Task 14), `onWsMessage`/`subscribeAccounts` (Task 14), `AccountWithRuntime`/`ClientStatus`/`SessionSnapshot` (Task 14), `useAuth` (Task 14).
- Produces:
  - `AccountsPage()` — component route
  - `StatusBadge({ status }: { status: ClientStatus })` — xuất khẩu để trang chi tiết dùng lại
  - `statusLabel: Record<ClientStatus, string>`

- [ ] **Step 1: Viết `web/src/accounts/AccountsPage.tsx`**

`web/src/accounts/AccountsPage.tsx`:

```tsx
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { apiDelete, apiGet, apiPost } from '../api.js';
import { useAuth } from '../auth/useAuth.js';
import { onWsMessage, subscribeAccounts } from '../ws.js';
import type { AccountWithRuntime, ClientStatus } from '../types.js';

export const statusLabel: Record<ClientStatus, string> = {
  idle: 'chưa kết nối',
  connecting: 'đang kết nối',
  handshaking: 'đang bắt tay',
  'logging-in': 'đang đăng nhập',
  online: 'đang online',
  error: 'lỗi',
};

export function StatusBadge({ status }: { status: ClientStatus }) {
  return <span className={`badge badge-${status}`}>{statusLabel[status] ?? status}</span>;
}

export function AccountsPage() {
  const { user, logout } = useAuth();
  const [accounts, setAccounts] = useState<AccountWithRuntime[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const reload = useCallback(async () => {
    try {
      setAccounts(await apiGet<AccountWithRuntime[]>('/api/accounts'));
      setErr('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Trang danh sách không mở chi tiết tài khoản nào: bỏ mọi subscribe để khỏi
  // nhận gói tin và log của phiên đang chạy.
  useEffect(() => {
    subscribeAccounts([]);
  }, []);

  // `status` và `auto` là sự kiện nhẹ, server đẩy về không cần subscribe — đủ
  // để bảng tự cập nhật mà không phải hỏi lại API.
  useEffect(
    () =>
      onWsMessage((msg) => {
        if (msg.type === 'status') {
          setAccounts((list) =>
            list.map((a) =>
              a.id === msg.accountId && a.runtime
                ? { ...a, runtime: { ...a.runtime, status: msg.payload } }
                : a,
            ),
          );
        } else if (msg.type === 'auto') {
          setAccounts((list) =>
            list.map((a) =>
              a.id === msg.accountId && a.runtime
                ? { ...a, runtime: { ...a.runtime, auto: msg.payload } }
                : a,
            ),
          );
        } else if (msg.type === 'auto-disabled' || msg.type === 'snapshot') {
          // Server tự tắt auto (sai mật khẩu game) — trạng thái DB đã đổi, hỏi lại.
          void reload();
        }
      }),
    [reload],
  );

  async function toggleAuto(acc: AccountWithRuntime) {
    setErr('');
    try {
      if (acc.autoEnabled) await apiPost(`/api/accounts/${acc.id}/auto/stop`);
      else await apiPost(`/api/accounts/${acc.id}/auto/start`, acc.runtime?.auto ?? {});
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function connect(acc: AccountWithRuntime) {
    setErr('');
    try {
      const online = acc.runtime?.status === 'online';
      await apiPost(`/api/accounts/${acc.id}/${online ? 'disconnect' : 'connect'}`);
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function remove(acc: AccountWithRuntime) {
    if (!confirm(`Xoá tài khoản "${acc.label}"? Phiên đang chạy sẽ bị dừng.`)) return;
    setErr('');
    try {
      await apiDelete(`/api/accounts/${acc.id}`);
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Tài khoản avatar</h1>
        <span className="hint">{user?.email}</span>
        <button className="ghost" onClick={() => void logout()}>
          Đăng xuất
        </button>
      </header>

      {err && <p className="err">{err}</p>}

      <section className="card">
        {loading && <p className="hint">đang tải…</p>}
        {!loading && accounts.length === 0 && (
          <p className="hint">Chưa có tài khoản nào. Thêm một cái ở dưới.</p>
        )}
        {accounts.length > 0 && (
          <table className="accounts">
            <thead>
              <tr>
                <th>Nhãn</th>
                <th>Tài khoản game</th>
                <th>Trạng thái</th>
                <th>Tự động</th>
                <th>Xu</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link to={`/accounts/${a.id}`}>{a.label}</Link>
                  </td>
                  <td>{a.gameUser}</td>
                  <td>
                    <StatusBadge status={a.runtime?.status ?? 'idle'} />
                    {a.runtime?.lastError && <div className="hint">{a.runtime.lastError}</div>}
                  </td>
                  <td>
                    <label className="inline">
                      <input
                        type="checkbox"
                        checked={a.autoEnabled}
                        onChange={() => void toggleAuto(a)}
                        style={{ width: 'auto' }}
                      />
                      {a.runtime?.auto.running ? `vòng ${a.runtime.auto.cycle}` : 'tắt'}
                    </label>
                  </td>
                  <td>{a.runtime?.money ?? '—'}</td>
                  <td className="row">
                    <button className="ghost" onClick={() => void connect(a)}>
                      {a.runtime?.status === 'online' ? 'Ngắt' : 'Kết nối'}
                    </button>
                    <Link className="btn-link" to={`/accounts/${a.id}`}>
                      Chi tiết
                    </Link>
                    <button className="ghost" onClick={() => void remove(a)}>
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <AddAccountForm onAdded={reload} />
    </div>
  );
}

function AddAccountForm({ onAdded }: { onAdded: () => Promise<void> }) {
  const [label, setLabel] = useState('');
  const [gameUser, setGameUser] = useState('');
  const [gamePass, setGamePass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await apiPost('/api/accounts', { label, gameUser, gamePass });
      setLabel('');
      setGameUser('');
      setGamePass('');
      await onAdded();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Thêm tài khoản</h2>
      <p className="hint">
        Mật khẩu game được mã hoá trước khi lưu và không bao giờ hiện lại trên giao diện.
      </p>
      <div className="row">
        <label className="inline">
          Nhãn
          <input value={label} onChange={(e) => setLabel(e.target.value)} required />
        </label>
        <label className="inline">
          Tài khoản game
          <input
            value={gameUser}
            onChange={(e) => setGameUser(e.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <label className="inline">
          Mật khẩu game
          <input
            type="password"
            value={gamePass}
            onChange={(e) => setGamePass(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
      </div>
      <div className="row">
        <button type="submit" disabled={busy}>
          {busy ? 'đang thêm…' : 'Thêm'}
        </button>
      </div>
      {err && <p className="err">{err}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Nối route thật vào `main.tsx`**

Trong `web/src/main.tsx`, thêm import:

```tsx
import { AccountsPage } from './accounts/AccountsPage.js';
```

và thay khối `<Route path="/accounts" …>` tạm bằng:

```tsx
          <Route
            path="/accounts"
            element={
              <RequireAuth>
                <AccountsPage />
              </RequireAuth>
            }
          />
```

- [ ] **Step 3: Thêm style cho bảng**

Thêm vào cuối `web/src/styles.css`:

```css
/* --- bảng danh sách tài khoản --- */
table.accounts {
  width: 100%;
  border-collapse: collapse;
}

table.accounts th,
table.accounts td {
  padding: 8px 6px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid #23262d;
}

table.accounts th {
  font-size: 12px;
  font-weight: 600;
  color: #8b93a1;
}

table.accounts td.row {
  display: flex;
  gap: 6px;
  align-items: center;
  border-bottom: 1px solid #23262d;
}

.btn-link {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid #2c3038;
  text-decoration: none;
  font-size: 13px;
}

header .hint {
  margin-left: auto;
}
```

- [ ] **Step 4: Build để xác nhận không lỗi kiểu**

Run: `cd web && npm run build`
Expected: build thành công.

- [ ] **Step 5: Kiểm tay**

Chạy cả hai server như Task 14, đăng nhập, rồi kiểm:
1. Thêm tài khoản → xuất hiện trong bảng, badge "chưa kết nối".
2. Response của `/api/accounts` trong tab Network **không chứa mật khẩu game** — mở ra xem tận mắt.
3. Bấm "Kết nối" → badge chuyển sang "đang kết nối" rồi "đang online" (hoặc "lỗi") **mà không cần F5** — đây là kiểm chứng đường WS sự kiện nhẹ.
4. Bật công tắc "Tự động" → F5 vẫn thấy bật.
5. Xoá tài khoản → biến khỏi bảng.

- [ ] **Step 6: Commit**

```bash
git add web/src/accounts/AccountsPage.tsx web/src/main.tsx web/src/styles.css
git commit -m "feat(web): trang danh sách tài khoản, cập nhật trực tiếp qua WS"
```

---

## Task 16: Trang chi tiết `/accounts/:id` — tab Vận hành

`App.tsx` là component 715 dòng viết cho đúng một phiên. Trang chi tiết dựng từ chính
file này, nên tách nó ra là điều kiện cần chứ không phải refactor thừa. Task này lấy
phần "vận hành"; Task 17 lấy phần "debug" rồi xoá `App.tsx`.

**Files:**
- Create: `web/src/accounts/AccountDetailPage.tsx`
- Create: `web/src/accounts/panels/StatusPanel.tsx`
- Create: `web/src/accounts/panels/AutoFarmPanel.tsx`
- Create: `web/src/accounts/panels/AssetsPanel.tsx`
- Create: `web/src/accounts/panels/LogPanel.tsx`
- Modify: `web/src/main.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: `api.ts`, `ws.ts`, `types.ts` (Task 14), `StatusBadge` (Task 15).
- Produces:
  - `AccountDetailPage()`
  - `StatusPanel({ accountId, snap, gameUser, onChanged })`
  - `AutoFarmPanel({ accountId, auto, items })`
  - `AssetsPanel({ accountId, farm, inventory, trees, animals })`
  - `LogPanel({ logs })`
  - `cellNeeds(c: FarmCell): string[]` (xuất khẩu từ `AssetsPanel.tsx`)

- [ ] **Step 1: Viết `panels/LogPanel.tsx`**

`web/src/accounts/panels/LogPanel.tsx`:

```tsx
import { useEffect, useRef } from 'react';

import type { LogLine } from '../../types.js';

export function LogPanel({ logs }: { logs: LogLine[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [logs.length]);

  return (
    <section className="card">
      <h2>Nhật ký</h2>
      <p className="hint">
        Giữ 500 dòng gần nhất trong RAM của server — restart server là mất.
      </p>
      <div className="log">
        {logs.length === 0 && <p className="hint">chưa có gì</p>}
        {logs.map((l, i) => (
          <div key={i}>
            <span className="ts">{new Date(l.t).toLocaleTimeString()}</span> {l.line}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Viết `panels/StatusPanel.tsx`**

`web/src/accounts/panels/StatusPanel.tsx`:

```tsx
import { useState } from 'react';

import { apiPost } from '../../api.js';
import { StatusBadge } from '../AccountsPage.js';
import type { SessionSnapshot } from '../../types.js';

export function StatusPanel({
  accountId,
  snap,
  gameUser,
  onChanged,
}: {
  accountId: number;
  snap: SessionSnapshot | null;
  gameUser: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const online = snap?.status === 'online';

  async function toggle() {
    setBusy(true);
    setErr('');
    try {
      await apiPost(`/api/accounts/${accountId}/${online ? 'disconnect' : 'connect'}`);
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Trạng thái</h2>
      <div className="row">
        <StatusBadge status={snap?.status ?? 'idle'} />
        <span className="hint">tài khoản game: {gameUser}</span>
        {snap?.playerId !== undefined && <span className="hint">id nhân vật: {snap.playerId}</span>}
        {snap?.money !== undefined && <span className="chip">{snap.money} xu</span>}
      </div>
      <div className="row">
        <button onClick={() => void toggle()} disabled={busy}>
          {online ? 'Ngắt' : 'Kết nối'}
        </button>
        <button className="ghost" onClick={() => void apiPost(`/api/accounts/${accountId}/enter-farm`)} disabled={!online}>
          Vào nông trại / làm mới
        </button>
      </div>
      {/* Đang đếm ngược để thử lại: cho người dùng biết server chưa bỏ cuộc. */}
      {snap?.nextRetryAt && (
        <p className="hint">
          thử kết nối lại lần {snap.retries} lúc {new Date(snap.nextRetryAt).toLocaleTimeString()}
        </p>
      )}
      {(err || snap?.lastError) && <p className="err">{err || snap?.lastError}</p>}
    </section>
  );
}
```

- [ ] **Step 3: Viết `panels/AutoFarmPanel.tsx`**

Chuyển `AutoPanel` từ `web/src/App.tsx` dòng 276–415 sang file mới, đổi đúng những chỗ sau:

- Đổi tên component `AutoPanel` → `AutoFarmPanel`, thêm `export`.
- Props đổi thành `{ accountId, auto, items }: { accountId: number; auto: AutoState; items: ItemInfo[] }`.
- `post('/api/auto/start', {...})` → `apiPost(\`/api/accounts/${accountId}/auto/start\`, {...})`, bọc trong `try/catch` bắt `(e as Error).message` vào `setErr` (API mới ném lỗi thay vì trả `{error}`).
- `post('/api/auto/stop', {})` → `void apiPost(\`/api/accounts/${accountId}/auto/stop\`)`.
- Import `apiPost` từ `'../../api.js'`, `AutoState`/`ItemInfo` từ `'../../types.js'`.

`web/src/accounts/panels/AutoFarmPanel.tsx` — phần đầu và phần cuối phải thành:

```tsx
import { useState } from 'react';

import { apiPost } from '../../api.js';
import type { AutoState, ItemInfo } from '../../types.js';

export function AutoFarmPanel({
  accountId,
  auto,
  items,
}: {
  accountId: number;
  auto: AutoState;
  items: ItemInfo[];
}) {
  const [seedId, setSeedId] = useState('');
  // 123/124 đối chiếu khớp giữa bảng vật phẩm và kho; 100 là hằng số cứng trong
  // FarmScr.resetAction, chưa kiểm chứng nên để trống mặc định.
  const [waterItemId, setWaterItemId] = useState('100');
  const [grassItemId, setGrassItemId] = useState('123');
  const [wormItemId, setWormItemId] = useState('124');
  const [harvest, setHarvest] = useState(true);
  const [feedAnimals, setFeedAnimals] = useState(true);
  const [healAnimals, setHealAnimals] = useState(true);
  const [fertilizeCells, setFertilizeCells] = useState(true);
  const [autoBuy, setAutoBuy] = useState(false);
  const [buyBudgetXu, setBuyBudgetXu] = useState(5000);
  const [intervalSec, setIntervalSec] = useState(120);
  const [stepDelayMs, setStepDelayMs] = useState(700);
  const [err, setErr] = useState('');

  const num = (s: string) => (s.trim() === '' ? undefined : Number(s));

  async function start() {
    setErr('');
    try {
      await apiPost(`/api/accounts/${accountId}/auto/start`, {
        seedId: num(seedId),
        waterItemId: num(waterItemId),
        grassItemId: num(grassItemId),
        wormItemId: num(wormItemId),
        harvest,
        feedAnimals,
        healAnimals,
        fertilizeCells,
        autoBuy,
        buyBudgetXu,
        intervalMs: intervalSec * 1000,
        stepDelayMs,
      });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function stop() {
    setErr('');
    try {
      await apiPost(`/api/accounts/${accountId}/auto/stop`);
    } catch (e) {
      setErr((e as Error).message);
    }
  }
```

Phần JSX giữa (`return (` … `);`) chép nguyên từ `App.tsx` dòng 314–413, chỉ đổi
`onClick={() => post('/api/auto/stop', {})}` thành `onClick={() => void stop()}` và
`onClick={start}` thành `onClick={() => void start()}`.

Bổ sung một dòng vào phần chú thích của panel, ngay sau đoạn `<p className="hint">` sẵn có:

```tsx
      <p className="hint">
        Bật ở đây là ghi vào cơ sở dữ liệu: server tự bật lại tài khoản này sau khi khởi
        động lại, không cần mở trình duyệt.
      </p>
```

- [ ] **Step 4: Viết `panels/AssetsPanel.tsx`**

Gộp `FarmPanel` (`App.tsx` 417–502) và `AnimalPanel` (`App.tsx` 252–274) cùng hàm
`cellNeeds` (242–250) vào một file. Đổi:

- `cellNeeds` thêm `export`.
- Bỏ nút "Vào nông trại / làm mới" khỏi `FarmPanel` (đã chuyển sang `StatusPanel`); giữ lại dòng `<span className="hint">` tóm tắt.
- `post('/api/farm', { name: 'getInventory', args: [] })` → `void apiPost(\`/api/accounts/${accountId}/farm\`, { name: 'getInventory', args: [] })`; tương tự cho `getTreeInfo`.
- Component ngoài cùng là `AssetsPanel`, render lần lượt phần nông trại rồi phần vật nuôi.

`web/src/accounts/panels/AssetsPanel.tsx` — khung file:

```tsx
import { useState } from 'react';

import { apiPost } from '../../api.js';
import type { AnimalInfo, FarmCell, FarmState, InventoryItem, TreeInfo } from '../../types.js';

export function cellNeeds(c: FarmCell): string[] {
  if (c.idTree === -1) return ['trống'];
  const n: string[] = [];
  if (c.isArid) n.push('tưới');
  if (c.isGrass) n.push('cỏ');
  if (c.isWorm) n.push('sâu');
  if (c.time === 0) n.push('thu hoạch');
  return n;
}

export function AssetsPanel({
  accountId,
  farm,
  inventory,
  trees,
  animals,
}: {
  accountId: number;
  farm: FarmState | null;
  inventory: InventoryItem[];
  trees: TreeInfo[];
  animals: AnimalInfo[];
}) {
  return (
    <>
      <FarmSection accountId={accountId} farm={farm} inventory={inventory} trees={trees} />
      <AnimalSection farm={farm} catalog={animals} />
    </>
  );
}

function FarmSection({
  accountId,
  farm,
  inventory,
  trees,
}: {
  accountId: number;
  farm: FarmState | null;
  inventory: InventoryItem[];
  trees: TreeInfo[];
}) {
  // ... thân hàm chép từ App.tsx dòng 426–501, áp các thay đổi liệt kê ở trên
}

function AnimalSection({ farm, catalog }: { farm: FarmState | null; catalog: AnimalInfo[] }) {
  // ... thân hàm chép từ App.tsx dòng 253–273, không đổi gì
}
```

Cụ thể, `FarmSection` sau khi sửa bắt đầu bằng:

```tsx
  const [sel, setSel] = useState<FarmCell | null>(null);
  const treeName = (id: number) => trees.find((t) => t.id === id)?.name ?? `#${id}`;

  const planted = farm?.cells.filter((c) => c.idTree !== -1).length ?? 0;
  const ready = farm?.cells.filter((c) => c.idTree !== -1 && c.time === 0).length ?? 0;
  const care = farm?.cells.filter((c) => c.isArid || c.isGrass || c.isWorm).length ?? 0;

  return (
    <section className="card">
      <h2>Nông trại</h2>
      {farm ? (
        <p className="hint">
          farm #{farm.idFarm} · {farm.cells.length} ô · {planted} có cây · {ready} chờ thu ·{' '}
          {care} cần chăm
        </p>
      ) : (
        <p className="hint">Bấm "Vào nông trại / làm mới" ở khung Trạng thái sau khi đã kết nối.</p>
      )}

      {inventory.length > 0 && (
        <div className="row">
          <span className="hint">kho:</span>
          {inventory.map((it) => (
            <span key={it.id} className="chip">
              {treeName(it.id)} × {it.num}
            </span>
          ))}
          <button
            className="ghost"
            onClick={() =>
              void apiPost(`/api/accounts/${accountId}/farm`, { name: 'getInventory', args: [] })
            }
          >
            làm mới kho
          </button>
          <button
            className="ghost"
            onClick={() =>
              void apiPost(`/api/accounts/${accountId}/farm`, { name: 'getTreeInfo', args: [] })
            }
          >
            tải bảng cây
          </button>
        </div>
      )}
```

phần còn lại (lưới ô và khối `sel`) chép nguyên từ `App.tsx` dòng 465–501.

- [ ] **Step 5: Viết `AccountDetailPage.tsx`**

`web/src/accounts/AccountDetailPage.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { apiGet } from '../api.js';
import { onWsMessage, subscribeAccounts } from '../ws.js';
import type { AccountWithRuntime, SessionSnapshot } from '../types.js';
import { StatusBadge } from './AccountsPage.js';
import { AssetsPanel } from './panels/AssetsPanel.js';
import { AutoFarmPanel } from './panels/AutoFarmPanel.js';
import { LogPanel } from './panels/LogPanel.js';
import { StatusPanel } from './panels/StatusPanel.js';

type Tab = 'van-hanh' | 'debug';

export function AccountDetailPage() {
  const accountId = Number(useParams().id);
  const [account, setAccount] = useState<AccountWithRuntime | null>(null);
  const [snap, setSnap] = useState<SessionSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>('van-hanh');
  const [err, setErr] = useState('');

  const reload = useCallback(async () => {
    try {
      const list = await apiGet<AccountWithRuntime[]>('/api/accounts');
      const found = list.find((a) => a.id === accountId) ?? null;
      setAccount(found);
      setSnap(found?.runtime ?? null);
      setErr(found ? '' : 'không có tài khoản này');
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [accountId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Trang chi tiết là nơi duy nhất cần sự kiện nặng (log, gói tin, farm). Đăng ký
  // khi vào, huỷ khi rời — nếu không thì mở một tab là mọi tab đều gánh traffic.
  useEffect(() => {
    if (!Number.isInteger(accountId)) return;
    subscribeAccounts([accountId]);
    return () => subscribeAccounts([]);
  }, [accountId]);

  useEffect(
    () =>
      onWsMessage((msg) => {
        if (msg.accountId !== accountId) return;
        if (msg.type === 'snapshot') return setSnap(msg.payload);
        setSnap((s) => {
          if (!s) return s;
          switch (msg.type) {
            case 'status':
              return { ...s, status: msg.payload };
            case 'auto':
              return { ...s, auto: msg.payload };
            case 'macro':
              return { ...s, macro: msg.payload };
            case 'farm':
              return { ...s, farm: msg.payload };
            case 'inventory':
              return { ...s, inventory: msg.payload };
            case 'money':
              return { ...s, money: msg.payload.balance ?? s.money };
            case 'trees':
              return {
                ...s,
                trees: msg.payload.trees ?? [],
                items: msg.payload.items ?? [],
                animals: msg.payload.animals ?? [],
              };
            case 'log':
              return { ...s, logs: [...s.logs.slice(-499), msg.payload] };
            case 'traffic':
              return { ...s, traffic: [...s.traffic.slice(-299), msg.payload] };
            default:
              return s;
          }
        });
      }),
    [accountId],
  );

  if (err) {
    return (
      <div className="app">
        <p className="err">{err}</p>
        <Link to="/accounts">← về danh sách</Link>
      </div>
    );
  }
  if (!account) return <p className="hint" style={{ padding: 24 }}>đang tải…</p>;

  return (
    <div className="app">
      <header>
        <Link to="/accounts">←</Link>
        <h1>{account.label}</h1>
        <StatusBadge status={snap?.status ?? 'idle'} />
      </header>

      <div className="tabs">
        <button
          className={tab === 'van-hanh' ? 'tab active' : 'tab'}
          onClick={() => setTab('van-hanh')}
        >
          Vận hành
        </button>
        <button className={tab === 'debug' ? 'tab active' : 'tab'} onClick={() => setTab('debug')}>
          Debug
        </button>
      </div>

      {tab === 'van-hanh' && (
        <div className="cols">
          <div className="col">
            <StatusPanel
              accountId={accountId}
              snap={snap}
              gameUser={account.gameUser}
              onChanged={() => void reload()}
            />
            <AutoFarmPanel
              accountId={accountId}
              auto={snap?.auto ?? { running: false, cycle: 0, lastActions: [] }}
              items={snap?.items ?? []}
            />
          </div>
          <div className="col">
            <AssetsPanel
              accountId={accountId}
              farm={snap?.farm ?? null}
              inventory={snap?.inventory ?? []}
              trees={snap?.trees ?? []}
              animals={snap?.animals ?? []}
            />
            <LogPanel logs={snap?.logs ?? []} />
          </div>
        </div>
      )}

      {tab === 'debug' && <p className="hint">tab Debug — sẽ có ở task sau</p>}
    </div>
  );
}
```

- [ ] **Step 6: Nối route vào `main.tsx`**

Thêm import `import { AccountDetailPage } from './accounts/AccountDetailPage.js';` và
thêm route ngay sau route `/accounts`:

```tsx
          <Route
            path="/accounts/:id"
            element={
              <RequireAuth>
                <AccountDetailPage />
              </RequireAuth>
            }
          />
```

- [ ] **Step 7: Style cho header có nút quay lại**

Thêm vào cuối `web/src/styles.css`:

```css
header a {
  font-size: 18px;
  text-decoration: none;
  margin-right: 4px;
}

.app > .tabs {
  margin-bottom: 12px;
}
```

- [ ] **Step 8: Build**

Run: `cd web && npm run build`
Expected: build thành công.

- [ ] **Step 9: Kiểm tay**

1. Từ danh sách bấm vào một tài khoản → vào `/accounts/:id`, thấy tab Vận hành.
2. Bấm "Kết nối" rồi "Vào nông trại" → lưới ô và kho hiện ra **không cần F5**.
3. Nhật ký chạy dòng theo thời gian thực.
4. Bấm nút quay lại rồi vào lại → dữ liệu nạp lại đúng (kiểm chứng `subscribe` gửi lại snapshot).
5. Mở hai tab cùng một tài khoản → cả hai cùng cập nhật.

- [ ] **Step 10: Commit**

```bash
git add web/src/accounts web/src/main.tsx web/src/styles.css
git commit -m "feat(web): trang chi tiết tài khoản, tab Vận hành"
```

---

## Task 17: Tab Debug và xoá `App.tsx`

**Files:**
- Create: `web/src/accounts/panels/DebugPanel.tsx`
- Modify: `web/src/accounts/AccountDetailPage.tsx`
- Delete: `web/src/App.tsx`

**Interfaces:**
- Consumes: `ACTIONS`/`GROUPS`/`ActionDef` từ `web/src/actions.ts` (không đổi), `apiPost` (Task 14).
- Produces: `DebugPanel({ accountId, macro, traffic }: { accountId: number; macro: MacroState; traffic: TrafficEntry[] })`

- [ ] **Step 1: Viết `panels/DebugPanel.tsx`**

Gộp bốn component từ `App.tsx` vào một file: `ActionPanel` (504–523), `ActionRow`
(525–558), `MacroPanel` (560–609), `RawPanel` (611–668), `TrafficPanel` (686–715).
Mỗi cái nhận thêm `accountId` và đổi lời gọi API:

| Chỗ cũ trong `App.tsx` | Chỗ mới |
|---|---|
| `post('/api/farm', { name: def.action, args })` | `apiPost(\`/api/accounts/${accountId}/farm\`, { name: def.action, args })` |
| `post('/api/raw', { cmd, fields })` | `apiPost(\`/api/accounts/${accountId}/raw\`, { cmd, fields })` |
| `post('/api/macro/start', JSON.parse(json))` | `apiPost(\`/api/accounts/${accountId}/macro/start\`, JSON.parse(json))` |
| `post('/api/macro/stop', {})` | `apiPost(\`/api/accounts/${accountId}/macro/stop\`)` |

`post()` cũ trả `{ error }`; `apiPost` **ném** `ApiError`. Nên mọi chỗ đọc `r.error`
phải đổi sang `try/catch`. Cụ thể `ActionRow.run` và `RawPanel.send` thành:

```tsx
  async function run() {
    try {
      await apiPost(`/api/accounts/${accountId}/farm`, { name: def.action, args });
      setFlash('đã gửi');
    } catch (e) {
      setFlash((e as Error).message);
    }
    setTimeout(() => setFlash(''), 1500);
  }
```

`web/src/accounts/panels/DebugPanel.tsx` — khung file:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';

import { apiPost } from '../../api.js';
import { ACTIONS, GROUPS, type ActionDef } from '../../actions.js';
import type { MacroState, TrafficEntry } from '../../types.js';

const FIELD_TYPES = ['i8', 'i16', 'i32', 'i64', 'bool', 'utf', 'hex'];

export function DebugPanel({
  accountId,
  macro,
  traffic,
}: {
  accountId: number;
  macro: MacroState;
  traffic: TrafficEntry[];
}) {
  return (
    <div className="cols">
      <div className="col">
        <ActionPanel accountId={accountId} />
        <MacroPanel accountId={accountId} macro={macro} />
      </div>
      <div className="col">
        <RawPanel accountId={accountId} />
        <TrafficPanel traffic={traffic} />
      </div>
    </div>
  );
}

function ActionPanel({ accountId }: { accountId: number }) {
  // thân chép từ App.tsx 505–522, `<ActionRow key={a.action} def={a} />`
  // đổi thành `<ActionRow key={a.action} def={a} accountId={accountId} />`
}

function ActionRow({ def, accountId }: { def: ActionDef; accountId: number }) {
  // thân chép từ App.tsx 526–557, hàm `run` thay bằng bản try/catch ở trên
}

function MacroPanel({ accountId, macro }: { accountId: number; macro: MacroState }) {
  // thân chép từ App.tsx 561–608; `start()` bọc try/catch quanh apiPost,
  // nút Dừng đổi thành onClick={() => void apiPost(`/api/accounts/${accountId}/macro/stop`)}
}

function RawPanel({ accountId }: { accountId: number }) {
  // thân chép từ App.tsx 614–667, hàm `send` thay bằng bản try/catch
}

function TrafficPanel({ traffic }: { traffic: TrafficEntry[] }) {
  // thân chép nguyên từ App.tsx 687–714, không đổi gì
}
```

Thêm một dòng chú thích ở đầu `ActionPanel`, ngay dưới `<h2>Hành động</h2>`:

```tsx
      <p className="hint">
        Gọi thẳng method của <code>FarmService</code> trên phiên của tài khoản này. Dùng để
        dò tiếp opcode; delay quá thấp dễ bị server từ chối.
      </p>
```

- [ ] **Step 2: Nối `DebugPanel` vào trang chi tiết**

Trong `web/src/accounts/AccountDetailPage.tsx`, thêm import:

```tsx
import { DebugPanel } from './panels/DebugPanel.js';
```

và thay dòng tạm bằng:

```tsx
      {tab === 'debug' && (
        <DebugPanel
          accountId={accountId}
          macro={snap?.macro ?? { running: false, cycle: 0 }}
          traffic={snap?.traffic ?? []}
        />
      )}
```

- [ ] **Step 3: Xoá `App.tsx`**

Mọi phần của nó đã có nhà mới. Không còn chỗ nào import nó (`main.tsx` đã viết lại ở Task 14).

```bash
cd /Users/devios/learning-reverse/avatar-web
grep -rn "App.js\|from './App'" web/src || echo "không còn tham chiếu"
git rm web/src/App.tsx
```

- [ ] **Step 4: Build**

Run: `cd web && npm run build`
Expected: build thành công, không cảnh báo về `App.tsx`.

- [ ] **Step 5: Kiểm tay**

1. Mở tab Debug của một tài khoản đang online.
2. Bấm một action bất kỳ (vd `getInventory`) → hiện "đã gửi", log gói tin xuất hiện dòng TX mới.
3. Gửi gói raw cmd 76 → log gói tin có cả TX và RX.
4. Chạy một macro một-lần → panel báo "đang chạy" rồi về "đang dừng".
5. Ngắt kết nối rồi bấm action → hiện lỗi "phiên chưa kết nối", không sập trang.

- [ ] **Step 6: Commit**

```bash
git add web/src/accounts/panels/DebugPanel.tsx web/src/accounts/AccountDetailPage.tsx
git commit -m "feat(web): tab Debug, xoá App.tsx một-phiên"
```

---

## Task 18: Dọn dẹp và tài liệu

**Files:**
- Modify: `avatar-web/README.md`
- Delete: `avatar-web/account`

**Interfaces:**
- Consumes: toàn bộ hệ thống đã xong.
- Produces: không có mã mới.

- [ ] **Step 1: Xác nhận không còn tham chiếu tới mã một-phiên**

```bash
cd /Users/devios/learning-reverse/avatar-web
grep -rn "readAccount\|DEFAULT_SERVER\|AUTO_LOGIN" server/src web/src || echo "sạch"
```

Expected: `sạch`. (`DEFAULT_GAME_SERVER` trong `config.ts` là tên khác, không khớp.)

- [ ] **Step 2: Chạy toàn bộ cổng kiểm tra**

```bash
cd server && npm run typecheck && npm test
cd ../web && npm run build
```

Expected: typecheck sạch, mọi test PASS, web build thành công.

- [ ] **Step 3: Cập nhật `README.md`**

Trong `avatar-web/README.md`:

- Thay khối "## Chạy" bằng:

```markdown
## Chạy

```bash
cd server && npm install
npm run gen-key          # in ra MASTER_KEY, dán vào .env
cp .env.example .env     # rồi điền MASTER_KEY và INVITE_CODE
npm run dev              # cổng 8787

cd web && npm install && npm run dev     # cổng 5173, đã proxy /api và /ws
```

Server **từ chối khởi động** nếu thiếu `MASTER_KEY` hoặc `INVITE_CODE`.

| Biến | Ý nghĩa |
|---|---|
| `MASTER_KEY` | 32 byte base64, khoá mã hoá mật khẩu game. Bắt buộc. |
| `INVITE_CODE` | mã mời để đăng ký. Bắt buộc. |
| `PORT` | mặc định 8787 |
| `MAX_SESSIONS` | trần số phiên game cùng lúc, mặc định 20 |
| `NODE_ENV` | `production` bật cookie `Secure` |
```

- Thay bảng "## API" bằng bảng endpoint mới (giống mục 8 của spec).
- Thay cây "## Cấu trúc" bằng cây thư mục mới (giống mục 4.1 và 4.2 của spec).
- Thêm mục mới sau "## Lưu ý":

```markdown
## Mật khẩu game được lưu thế nào

Mã hoá AES-256-GCM, khoá đọc từ `MASTER_KEY` trong môi trường của service, AAD buộc
theo id bản ghi nên không chép bản mã từ tài khoản này sang tài khoản khác được.

Auto chạy 24/7 buộc server phải tự đọc lại được mật khẩu khi khởi động lại mà không
cần người dùng có mặt — nên khoá phải nằm trong env chứ không dẫn xuất được từ mật
khẩu đăng nhập. Ai chiếm được VPS thì có cả khoá lẫn DB. Đó là giới hạn cố hữu của
yêu cầu 24/7, không phải sơ suất.

Mất `MASTER_KEY` = mất toàn bộ mật khẩu game đã lưu, phải nhập lại từng tài khoản.
```

- Trong bảng "## Trạng thái", đổi dòng `Web UI (action, macro, log gói tin)` thành
  `Web UI nhiều tài khoản (đăng nhập, danh sách, chi tiết, Debug)` và thêm dòng
  `Auto-farm 24/7 trên server | ✅ bật lại sau restart theo `auto_enabled``.

- [ ] **Step 4: Nhập lại tài khoản qua UI rồi xoá file `account`**

Cố ý không viết code import: viết mã dùng-một-lần cho đúng một bản ghi là thừa.

```bash
cd /Users/devios/learning-reverse/avatar-web
cat account          # xem user/pass lần cuối
```

Thêm tài khoản này qua form "Thêm tài khoản" trên `/accounts`, bấm Kết nối, xác nhận
đăng nhập được. Sau đó:

```bash
rm avatar-web/account
```

(`account` đã nằm trong `.gitignore` nên không có gì để `git rm`.)

- [ ] **Step 5: Kiểm chứng bootstrap 24/7 — đây là lời hứa chính của cả bản thiết kế**

1. Bật auto cho một tài khoản, xác nhận nó đang chạy.
2. Dừng server (`Ctrl-C`).
3. Chạy lại `npm run dev` **mà không mở trình duyệt**.
4. Xem log server: phải thấy phiên tự đăng nhập lại.
5. Mở `/accounts` → tài khoản đó đang online, auto đang chạy, số vòng tiếp tục tăng.

Nếu có từ hai tài khoản bật auto: xác nhận log cho thấy chúng đăng nhập **cách nhau
khoảng 5 giây** chứ không cùng lúc.

- [ ] **Step 6: Kiểm chứng dừng hẳn khi sai mật khẩu game**

1. Sửa mật khẩu game của một tài khoản thành sai (`PATCH` qua form Sửa hoặc trực tiếp trên UI).
2. Bấm Kết nối.
3. Xác nhận: nhật ký ghi "đăng nhập thất bại — kiểm tra lại mật khẩu game", **không có
   dòng "thử kết nối lại sau …s"**, và công tắc auto trên danh sách tự tắt.

Đây là hàng rào quan trọng nhất: vòng lặp đăng nhập sai liên tục là đường ngắn nhất
tới việc bị server game khoá tài khoản.

- [ ] **Step 7: Commit**

```bash
git add avatar-web/README.md
git commit -m "docs: cập nhật README cho kiến trúc nhiều tài khoản"
```

---

## Kiểm tra sau khi xong

Chạy một lượt cuối để chắc không có gì rơi rớt:

```bash
cd avatar-web/server && npm run typecheck && npm test
cd ../web && npm run build
cd .. && grep -rn "readAccount\|/api/login\|/api/logout\b" server/src web/src || echo "sạch"
```

Và đối chiếu lại với spec:

| Yêu cầu spec | Task |
|---|---|
| Đăng ký/đăng nhập email + mật khẩu | 3, 4, 6, 7, 14 |
| Mã mời bắt buộc, so bằng `timingSafeEqual` | 7 |
| Chống dò email bằng verify giả | 3, 7 |
| Rate limit 10 lần/15 phút theo IP và email | 6, 7 |
| Phiên lưu bằng SHA-256, tự gia hạn, cookie HttpOnly | 4, 6 |
| Mã hoá AES-256-GCM với AAD = id bản ghi | 1, 5 |
| Không bao giờ trả mật khẩu game ra API | 5, 10 |
| Cách ly theo `user_id` ở REST và WS | 5, 10, 11, 12 |
| Trang danh sách nhiều tài khoản, thêm/xoá | 10, 15 |
| Trang chi tiết hai tab Vận hành / Debug | 16, 17 |
| Auto 24/7, bootstrap giãn cách sau restart | 9, 13, 18 |
| Backoff luỹ thừa có jitter, trần 5 phút | 8 |
| `-35` thì dừng hẳn và tắt `auto_enabled` | 8, 9 |
| Ghi DB trước khi tác động vào phiên | 5, 11 |
| Cách ly lỗi: listener `error`, `unhandledRejection` | 8, 13 |
| Trần `MAX_SESSIONS` | 9 |
| Server từ chối khởi động khi thiếu khoá | 1, 13 |
| `proto/`, `game/`, `autoFarm.ts`, `macro.ts` không đổi | mọi task |
