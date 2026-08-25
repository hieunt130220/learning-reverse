# Auto Tìm NPC V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm chế độ tự động Tìm NPC cho từng tài khoản: quét catalog map/khu đã live-verify, đọc `ItemMapSpecial` từ snapshot enter-world `cmd -34`, khớp chính xác tên NPC, lưu/hiển thị vị trí và bám cho đến khi NPC biến mất.

**Architecture:** Một coordinator cấp `AvatarSession` sở hữu đúng một runner tại một thời điểm (`auto_farm` hoặc `find_npc`), chuyển mode tuần tự qua `switching` với cleanup đầy đủ. Ý muốn (`desired_mode`) nằm trong bảng `avatar_automation_state` mới và là nguồn sự thật; runner Find NPC quét qua `ParkService` (cmd 80) + `waitForWorldSnapshot`, decoder enter-world strict tuần tự. Catalog production chỉ được tạo sau live probe redacted có evidence.

**Tech Stack:** TypeScript 5.7, Node.js 22, Express, better-sqlite3, EventEmitter, React 18 + Vite, `tsx`, npm scripts `typecheck`/`build`/`test`.

**Spec:** `docs/superpowers/specs/2026-08-24-auto-find-npc-design.md`

## Quyết định đã chốt (rulings cần người duyệt Plan xác nhận)

1. **Không có capture `-34` trong repo:** Spec gốc viết "chạy decoder trên body redacted đã probe trước đây"; điều tra xác nhận repository không có raw/redacted body nào (chỉ prose `special=0`). Spec §4.3 đã được sửa thành: port decoder bằng production code + static verification, còn lần xác minh đầu trên body thật nằm ở controlled live probe §4.4. Không tạo fixture giả. *(Edit Spec này đi kèm Plan — cần user xác nhận luôn lúc duyệt.)*
2. **Event tên `auto-disabled` giữ nguyên:** permanent-failure vẫn broadcast `auto-disabled` (payload `{accountId}`) để không phá frontend hiện có; ngữ nghĩa mở rộng thành "desired automation đã bị gỡ".
3. **`AvatarCredentials` giữ `autoEnabled` như field dẫn xuất** (từ `desiredMode`) thay vì xóa hẳn, để các harness/test hiện tại biên dịch mà không phải sửa; coordinator chỉ tin `desiredMode`.
4. **Find NPC không gọi `assertIdleForAutomation()` của shop lane:** cmd 80/-34 không chạm cmd 103; hai lane không tranh tài nguyên. AutoFarm giữ nguyên gate hiện có.
5. **Delivery tách bạch:** mọi task dưới đây chỉ đến *code-complete*. Chạy live probe, tạo `npcMapCatalog.ts` và bật catalog là các bước có điều kiện trong Task 13, CHỈ thực hiện khi user ủy quyền rõ ràng cho phiên live.
6. **Event `automation` KHÔNG vào `LIGHT_EVENTS`:** chỉ các panel trong drawer tiêu thụ snapshot này mà drawer luôn subscribe tài khoản đang mở; server còn đẩy lại snapshot đầy đủ ngay lúc subscribe (`ws.ts` gửi `snapshot` khi nhận `subscribe`). Vì vậy `ws.ts` giữ nguyên — `automation` đi kênh subscriber như `traffic`/`log`, tránh phát cho mọi tab danh sách không hiển thị gì thêm.
7. **Legacy `/auto/start` giữ contract; `/auto/stop` chỉ đổi sang await cleanup:** nhờ dual-write ở Task 3, `setAutoEnabled(db,id,true/false)` tự đồng bộ `desired_mode`. Start giữ normalize/merge hiện tại; stop vẫn persist off rồi disconnect, nhưng handler phải `await` runner cleanup trước khi trả.

## Global Constraints

- User đã duyệt Spec ngày 2026-08-24; production code chỉ bắt đầu sau khi user duyệt chính Plan này.
- Production-code-first: KHÔNG TDD, KHÔNG tạo test file mới. Chỉ được sửa assertion/fixture của test HIỆN CÓ khi compiler/hành vi bắt buộc, sau production code, và phải ghi rõ file đã sửa trong checklist trước khi stage.
- Baseline đã verify tại `main` `0973a54`: server 258/258 tests + build PASS; web 73/73 tests + build PASS.
- Làm việc trong worktree `/Users/devios/learning-reverse/.claude/worktrees/auto-find-npc`, branch `worktree-auto-find-npc`. Không cd ra repo gốc.
- npm luôn chạy qua prefix: `npm --prefix avatar-web/server run …`, `npm --prefix avatar-web/web run …`.
- Trước khi sửa bất kỳ function/class/method nào: chạy `gitnexus_impact({target, direction:"upstream"})` (kèm `includeTests:true`), báo risk + d=1 callers. Nếu HIGH/CRITICAL: liệt kê blast radius cho user trong ledger trước khi sửa (các symbol lifecycle chính đã được user chấp nhận rủi ro khi duyệt Plan).
- Trước mỗi commit: chạy `gitnexus_detect_changes({scope:"all"})`, xác nhận chỉ symbol/flow dự kiến bị ảnh hưởng, mọi d=1 dependent đã cập nhật. Không stage `AGENTS.md`/`CLAUDE.md`.
- Không đổi tên symbol bằng find-and-replace; dùng `gitnexus_rename` khi cần.
- Bảo mật: không bao giờ log/commit game password, encrypted password, session cookie, `MASTER_KEY` hay full credential payload. File tạm probe (`probe_npc.tmp.mts`, `probe_park.tmp.mts`, `.probe.env`, `decode34.tmp.mjs`) không được commit.
- Live probe: dừng Avatar Web server trước khi chạy; đúng một cặp map/khu mỗi invocation; không nhận range; không brute-force; không gọi dịch vụ ngoài (`4utovip`, `3x.4utovip`…); không gửi cmd `-21`, `87`, `-59`, `-61` hay bất kỳ lệnh đánh/tương tác/nhận quà nào.
- Catalog: KHÔNG tạo `npcMapCatalog.ts` trước khi có evidence live đã commit; trước đó provider trả rỗng và API start Find NPC trả `409 catalog-unverified`.
- Exact-name match: `name.normalize('NFC').trim().toLocaleLowerCase('vi')`, so toàn chuỗi, không substring.
- Tham số runner cố định: ≥2.000 ms giữa hai join; snapshot timeout 5.000 ms; backoff hết catalog 30.000 ms; backoff timeout 5s→10s→20s→cap 60s; tracking cần 2 miss hợp lệ cách nhau ≥2.000 ms.
- Sau commit code, PostToolUse hook tự chạy `npx gitnexus analyze`; kiểm tra `.gitnexus/meta.json` → nếu `stats.embeddings > 0` phải dùng `--embeddings`.

---

### Task 1: Contracts automation dùng chung

**Files:**
- Create: `avatar-web/server/src/session/automationTypes.ts`

**Interfaces:**
- Consumes: không (module lá, chỉ type thuần).
- Produces: `AutomationMode`, `AutomationTransitionState`, `AutomationLocation`, `FindNpcConfig`, `StoredFindNpcConfigState`, `LoadedAutomationIntent`, `AutoFindNpcPhase`, `AutoFindNpcState`, `NpcMapLocation`, `AutomationSnapshot`, `AutomationStartOutcome`, `AutomationApiErrorCode`, `idleFindNpcRuntime()`. Mọi task sau consume từ đây.

- [x] **Step 1: Tạo file với nội dung đầy đủ**

```ts
/**
 * Contracts automation dùng chung giữa coordinator, runner, API và WebSocket.
 * Module thuần type + helper — không import runtime gì để tránh chu kỳ phụ thuộc.
 */

export type AutomationMode = 'off' | 'auto_farm' | 'find_npc';
export type AutomationTransitionState = 'stable' | 'switching';

export interface AutomationLocation {
  map: number;
  area: number;
  observedAt: number;
}

export interface FindNpcConfig {
  npcName: string;
}

export interface StoredFindNpcConfigState {
  revision: number;
  config: FindNpcConfig;
}

/** Ý muốn đã chuẩn hóa đọc từ DB, truyền xuống session khi start/switch. */
export interface LoadedAutomationIntent {
  desiredMode: AutomationMode;
  findNpcConfig: StoredFindNpcConfigState;
  location: AutomationLocation | null;
}

export type AutoFindNpcPhase =
  | 'idle'
  | 'scanning'
  | 'scan_backoff'
  | 'tracking'
  | 'stopping';

export interface AutoFindNpcState {
  phase: AutoFindNpcPhase;
  running: boolean;
  targetName: string;
  cursor: number;
  total: number;
  current?: NpcMapLocation;
  /** Map/khu đang chờ snapshot; tồn tại cả khi phase=scanning. */
  probing?: NpcMapLocation;
  timeoutStreak: number;
  backoffUntil?: number;
  lastError?: string;
}

/** Một cặp map/khu đã được live-verify. `map`/`area` == roomID/boardID của cmd 80. */
export interface NpcMapLocation {
  map: number;
  area: number;
}

export interface AutomationSnapshot {
  desiredMode: AutomationMode;
  activeMode: AutomationMode;
  transitionState: AutomationTransitionState;
  findNpcConfig: StoredFindNpcConfigState;
  findNpcRuntime: AutoFindNpcState;
  location: AutomationLocation | null;
}

/** Kết quả một lần switch do coordinator trả về cho tầng route. */
export type AutomationStartOutcome = 'active' | 'connect-pending' | 'start-failed';

export type AutomationApiErrorCode =
  | 'invalid-automation-mode'
  | 'invalid-find-npc-config'
  | 'find-npc-name-required'
  | 'catalog-unverified'
  | 'revision-conflict'
  | 'automation-connect-pending'
  | 'automation-start-failed';

export function idleFindNpcRuntime(targetName: string): AutoFindNpcState {
  return { phase: 'idle', running: false, targetName, cursor: 0, total: 0, timeoutStreak: 0 };
}
```

- [x] **Step 2: Typecheck**

Run: `npm --prefix avatar-web/server run typecheck`
Expected: PASS (module mới chưa có consumer).

- [x] **Step 3: Commit**

Chạy `gitnexus_detect_changes({scope:"all"})` (chỉ file mới, không symbol cũ bị ảnh hưởng), rồi:

```bash
git add avatar-web/server/src/session/automationTypes.ts
git commit -m "feat(session): add shared automation contracts"
```

---

### Task 2: Bảng `avatar_automation_state` + backfill

**Files:**
- Modify: `avatar-web/server/src/db/schema.sql:88-93` (append sau index transactions)

**Interfaces:**
- Consumes: bảng `avatar_accounts` hiện có.
- Produces: bảng `avatar_automation_state` 1-1 với account, có backfill idempotent từ `auto_enabled`.

- [x] **Step 1: Append schema**

Thêm vào cuối `schema.sql`:

```sql
-- Trạng thái automation 1-1 với account: desired mode là nguồn sự thật cho
-- bootstrap sau restart. Ba cột location nguyên tố cùng nhau hoặc cùng NULL.
CREATE TABLE IF NOT EXISTS avatar_automation_state (
  account_id              INTEGER PRIMARY KEY
                          REFERENCES avatar_accounts(id) ON DELETE CASCADE,
  desired_mode            TEXT NOT NULL DEFAULT 'off'
                          CHECK (desired_mode IN ('off', 'auto_farm', 'find_npc')),
  find_npc_config_json    TEXT,
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
ON CONFLICT(account_id) DO NOTHING;
```

- [x] **Step 2: Regression DB**

Run: `npm --prefix avatar-web/server test src/db/index.test.ts`
Expected: PASS — `openDb` chạy lại schema idempotent trên DB test mới mà không lỗi.

- [x] **Step 3: Commit**

```bash
git add avatar-web/server/src/db/schema.sql
git commit -m "feat(db): add avatar_automation_state with legacy backfill"
```

---

### Task 3: AutomationRepository + đồng bộ ngược `repo.ts`

**Files:**
- Create: `avatar-web/server/src/accounts/automationRepo.ts`
- Modify: `avatar-web/server/src/accounts/repo.ts:282-295` (`setAutoEnabled`) và `:408-436` (`enableAutoWithConfigPatch`)

**Interfaces:**
- Consumes: `AutomationMode`, `AutomationLocation`, `StoredFindNpcConfigState`, `LoadedAutomationIntent`, `FindNpcConfig`, `AutomationSnapshot`, `idleFindNpcRuntime` từ `../session/automationTypes.js`.
- Produces:
  - `class FindNpcConfigError extends Error` với `code: 'invalid-find-npc-config'`.
  - `normalizeFindNpcConfig(input: unknown): FindNpcConfig`
  - `interface StoredAutomationState { desiredMode: AutomationMode; findNpcConfig: StoredFindNpcConfigState; location: AutomationLocation | null }`
  - `readAutomationState(db, accountId): StoredAutomationState`
  - `setDesiredMode(db, accountId, mode: AutomationMode, now?: number): void` — đồng bộ `auto_enabled` trong cùng transaction.
  - `saveFindNpcConfig(db, accountId, expectedRevision: number, config: FindNpcConfig, now?: number): SaveFindNpcConfigResult`
  - `saveFindNpcLocation(db, accountId, location: { map: number; area: number } | null, now?: number): void`
  - `listDesiredAutomation(db): DesiredAutomationEntry[]` với `interface DesiredAutomationEntry { accountId: number; intent: LoadedAutomationIntent }`
  - `offlineAutomationSnapshot(state: StoredAutomationState): AutomationSnapshot`

- [x] **Step 1: Impact analysis trước khi sửa repo.ts**

Run GitNexus:

```text
impact(target="setAutoEnabled", file_path="avatar-web/server/src/accounts/repo.ts", direction="upstream", includeTests=true)
impact(target="enableAutoWithConfigPatch", file_path="avatar-web/server/src/accounts/repo.ts", direction="upstream", includeTests=true)
```

Expected d=1: `manager.ts` (bootstrap/onPermanentFailure), `routes.ts` (`/auto/start`, `/auto/stop`), `accounts/routes.test.ts`, `session/manager.test.ts`, `accounts/repo.test.ts`. Ghi risk; hành vi cũ được GIỮ NGUYÊN và chỉ THÊM side-effect đồng bộ desired_mode nên risk dự kiến LOW/MEDIUM.

- [x] **Step 2: Tạo `automationRepo.ts`**

```ts
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
```

- [x] **Step 3: Đồng bộ ngược `repo.ts` (legacy writers cũng ghi desired_mode)**

Trong `setAutoEnabled` (implementation overload, dòng ~282-295), bọc trong `db.transaction` và thêm upsert sau UPDATE:

```ts
db.prepare(
  `INSERT INTO avatar_automation_state (account_id, desired_mode, updated_at)
     VALUES (?, ?, ?)
   ON CONFLICT(account_id) DO UPDATE
     SET desired_mode = excluded.desired_mode, updated_at = excluded.updated_at`,
).run(id, enabled ? 'auto_farm' : 'off', now);
```

Trong `enableAutoWithConfigPatch` (dòng ~408-436): nhánh sớm (patch rỗng) và nhánh UPDATE chính đều nằm sẵn trong `db.transaction` — thêm cùng upsert với `'auto_farm'` và `now` vào cả hai nhánh, NGAY TRƯỚC `return`.

Hành vi quan sát được của hai hàm này không đổi (test hiện có vẫn pass); chỉ thêm hàng automation tương ứng.

- [x] **Step 4: Verification**

Run:

```bash
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/server test
```

Expected: PASS toàn bộ, kể cả `repo.test.ts` và `manager.test.ts` (bootstrap vẫn thấy account `auto_enabled=1` nhờ dual-write).

- [x] **Step 5: Commit**

Chạy `gitnexus_detect_changes({scope:"all"})` — kỳ vọng: repo.ts, automationRepo.ts, schema liên quan; flow account/auto-config. Rồi:

```bash
git add avatar-web/server/src/accounts/automationRepo.ts avatar-web/server/src/accounts/repo.ts
git commit -m "feat(accounts): automation repository with legacy dual-write"
```

---

### Task 4: Decoder enter-world strict (`worldData.ts`)

**Files:**
- Create: `avatar-web/server/src/game/worldData.ts`

**Interfaces:**
- Consumes: layout static-verified trong `avatar-re/notes/login.md` + reference `avatar-re/frida_scripts/parser.ts`. Kiểm tra `avatar-web/server/src/proto/reader.ts` để khớp thứ tự byte (big-endian).
- Produces:
  - `interface MapSpecial { id: number; name: string; type: number; imageIds: number[]; menuIds: number[] }`
  - `interface EnterWorldSnapshot { playerId: number; specials: MapSpecial[]; specialSectionEnd: number; totalBytes: number; trailingBytes: number }`
  - `class WorldDataDecodeError extends Error` với `section: string`, `offset: number`.
  - `decodeEnterWorld(body: Buffer): EnterWorldSnapshot`

- [x] **Step 1: Đối chiếu endian với MyReader**

Read: `avatar-web/server/src/proto/reader.ts`. Xác nhận `readShort/readInt` dùng big-endian (Java DataInputStream). Nếu khác, `StrictReader` bên dưới phải theo đúng MyReader.

- [x] **Step 2: Tạo `worldData.ts`**

```ts
/**
 * Decoder TUẦN TỰ strict cho enter-world `cmd -34` (LOGIN_SUCESS).
 * Layout đối chiếu từ avatar-re/notes/login.md + frida parser reference:
 * header -> players -> meta i16 -> map item types -> map items -> animations
 * -> ItemMapSpecial[]. Không offset-scan, không heuristic: lệch 1 byte là lỗi.
 */

export interface MapSpecial {
  id: number;
  name: string;
  type: number;
  imageIds: number[];
  menuIds: number[];
}

export interface EnterWorldSnapshot {
  playerId: number;
  specials: MapSpecial[];
  specialSectionEnd: number;
  totalBytes: number;
  trailingBytes: number;
}

export class WorldDataDecodeError extends Error {
  constructor(
    readonly section: string,
    readonly offset: number,
    message: string,
  ) {
    super(`${section}@${offset}: ${message}`);
    this.name = 'WorldDataDecodeError';
  }
}

/** Reader có kiểm tra biên trước MỌI lần đọc; lỗi mang section + offset. */
class StrictReader {
  pos = 0;
  private section = 'header';

  constructor(private readonly buf: Buffer) {}

  in(section: string): this {
    this.section = section;
    return this;
  }

  private need(n: number): void {
    if (n < 0 || this.pos + n > this.buf.length) {
      throw new WorldDataDecodeError(
        this.section,
        this.pos,
        `cần ${n} byte nhưng chỉ còn ${Math.max(0, this.buf.length - this.pos)}`,
      );
    }
  }

  i8(): number { this.need(1); return this.buf.readInt8(this.pos++); }
  i16(): number {
    this.need(2);
    const v = this.buf.readInt16BE(this.pos);
    this.pos += 2;
    return v;
  }
  u16(): number {
    this.need(2);
    const v = this.buf.readUInt16BE(this.pos);
    this.pos += 2;
    return v;
  }
  i32(): number {
    this.need(4);
    const v = this.buf.readInt32BE(this.pos);
    this.pos += 4;
    return v;
  }
  utf(): string {
    // Java DataInputStream.readUTF/MyReader đọc prefix unsigned 16-bit.
    const len = this.u16();
    this.need(len);
    const s = this.buf.toString('utf8', this.pos, this.pos + len);
    this.pos += len;
    return s;
  }
}

function readCount(r: StrictReader, section: string): number {
  r.in(section);
  const n = r.i8();
  if (n < 0) throw new WorldDataDecodeError(section, r.pos - 1, `count âm: ${n}`);
  return n;
}

/** 15 field trạng thái player, width đã chốt trong notes/login.md. */
function readPlayerStateTail(r: StrictReader): void {
  r.in('players');
  r.i16(); r.i16(); r.i8(); r.i8(); r.i8();
  r.i16(); r.i8(); r.i8();
  r.i16(); r.i16(); r.i16();
  r.i8(); r.i16(); r.i8(); r.i8();
}

export function decodeEnterWorld(body: Buffer): EnterWorldSnapshot {
  const r = new StrictReader(body);

  r.in('header');
  r.i8(); // flag
  const playerId = r.i32();
  r.utf(); // tên nhân vật
  r.i8(); r.i8(); r.i16(); r.i16();
  if (!(playerId > 0)) {
    throw new WorldDataDecodeError('header', 5, `playerId không hợp lệ: ${playerId}`);
  }

  r.in('players');
  const nPlayer = readCount(r, 'players');
  for (let i = 0; i < nPlayer; i++) {
    r.i32(); // id
    r.utf(); // name
    const nPart = readCount(r, 'players');
    for (let p = 0; p < nPart; p++) r.i16();
    readPlayerStateTail(r);
  }

  r.in('meta');
  r.i16();

  r.in('map-item-types');
  const nType = readCount(r, 'map-item-types');
  for (let i = 0; i < nType; i++) {
    r.i8(); r.i16(); r.i8(); r.i16(); r.i16();
    const nPos = readCount(r, 'map-item-types');
    for (let p = 0; p < nPos; p++) { r.i8(); r.i8(); }
  }

  r.in('map-items');
  const nItem = readCount(r, 'map-items');
  for (let i = 0; i < nItem; i++) { r.i8(); r.i8(); r.i8(); r.i8(); }

  r.in('animations');
  const nAnim = readCount(r, 'animations');
  for (let i = 0; i < nAnim; i++) { r.i16(); r.i32(); r.i32(); }

  r.in('specials');
  const nSpecial = readCount(r, 'specials');
  const specials: MapSpecial[] = [];
  for (let i = 0; i < nSpecial; i++) {
    const id = r.i32();
    const name = r.utf();
    const type = r.i32();
    r.i32(); // c — chưa dùng cho matching nhưng phải consume đủ
    r.i8();  // d
    const nImage = readCount(r, 'specials');
    const imageIds: number[] = [];
    for (let k = 0; k < nImage; k++) imageIds.push(r.i16());
    for (let k = 0; k < 8; k++) r.i32(); // 8 int cố định
    const nMenu = readCount(r, 'specials');
    const menuIds: number[] = [];
    for (let k = 0; k < nMenu; k++) menuIds.push(r.i16());
    specials.push({ id, name, type, imageIds, menuIds });
  }

  return {
    playerId,
    specials,
    specialSectionEnd: r.pos,
    totalBytes: body.length,
    trailingBytes: body.length - r.pos,
  };
}
```

- [x] **Step 3: Typecheck**

Run: `npm --prefix avatar-web/server run typecheck`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add avatar-web/server/src/game/worldData.ts
git commit -m "feat(game): strict sequential enter-world decoder"
```

---

### Task 5: ParkService + GameClient context/world-wait

**Files:**
- Create: `avatar-web/server/src/game/parkService.ts`
- Modify: `avatar-web/server/src/game/client.ts` (exports handler ~:60, field `inFarm` ~:201, closed handler ~:229-245, `logout` ~:343-349, `setProviderAndClientType` ~:378-406, `enterFarm` ~:429-439, `onMessage` case -34 ~:578-617)

**Interfaces:**
- Consumes: `Message`, `Session` từ `../proto/*`; `decodeEnterWorld`, `EnterWorldSnapshot` từ Task 4.
- Produces:
  - `export const HANDLER_MAIN = 8; export const HANDLER_PARK = 9;` (bên cạnh `HANDLER_FARM` hiện có).
  - `class ParkService { constructor(session: Session); doJoinPark(map: number, area: number): void }`, hằng `CMD_AVATAR_JOIN_PARK = 80`.
  - `GameClient.park: ParkService`; `GameClient.currentHandlerContext: 8 | 9 | 10 | 'unknown'`;
  - `GameClient.enterParkContext(): void`; `GameClient.joinPark(map, area): void`; `GameClient.waitForWorldSnapshot(signal: AbortSignal, timeoutMs: number): Promise<EnterWorldSnapshot>`;
  - event `'world-snapshot'` (payload `EnterWorldSnapshot`) và `'world-snapshot-error'` (payload lỗi decode).

- [x] **Step 1: Impact/context trước khi sửa client**

Run GitNexus:

```text
context(name="GameClient", file_path="avatar-web/server/src/game/client.ts", include_content=false)
impact(target="enterFarm", file_path="avatar-web/server/src/game/client.ts", direction="upstream", includeTests=true)
```

Ghi risk + d=1 (`avatarSession.refreshFarmProfile`, `avatarSession.callFarm`, `autoFarm`, tests). Kỳ vọng: thay `inFarm` bool bằng `currentHandlerContext` phải giữ NGUYÊN ngữ nghĩa enterFarm (lần đầu gửi -1+10, lần sau joinFarm 69) — test `client.test.ts:140` phải vẫn pass không cần sửa.

- [x] **Step 2: Tạo `parkService.ts`**

```ts
import { Message } from '../proto/message.js';
import type { Session } from '../proto/session.js';

/** AVATAR_JOIN_PARK: i8 roomID (map), i8 boardID (khu). */
export const CMD_AVATAR_JOIN_PARK = 80;

/** V1 chỉ encode cmd 80 — không có REQUEST_JOIN_ANY/-23 hay opcode tương tác. */
export class ParkService {
  constructor(private readonly session: Session) {}

  doJoinPark(map: number, area: number): void {
    const m = Message.create(CMD_AVATAR_JOIN_PARK);
    m.writer!.writeByte(map);
    m.writer!.writeByte(area);
    this.session.send(m);
  }
}
```

- [x] **Step 3: Thêm hằng handler + ParkService vào `client.ts`**

Cạnh `HANDLER_FARM`:

```ts
export const HANDLER_MAIN = 8;
export const HANDLER_PARK = 9;
```

Import đầu file:

```ts
import { ParkService } from './parkService.js';
import { decodeEnterWorld, type EnterWorldSnapshot } from './worldData.js';
```

Field trong class (thay `private inFarm = false;`):

```ts
readonly park = new ParkService(this.session);
/** Handler context hiện tại: 8 main, 9 park, 10 farm; 'unknown' khi chưa/đã đóng. */
currentHandlerContext: 8 | 9 | 10 | 'unknown' = 'unknown';
```

- [x] **Step 4: Thay mọi điểm chạm `inFarm` bằng context**

- Constructor, handler `'closed'` (~:230): `this.inFarm = false;` → `this.currentHandlerContext = 'unknown';`
- `logout()` (~:344): tương tự.
- `setProviderAndClientType()` (~:382-384): sau `this.session.send(handler);` thêm `this.currentHandlerContext = HANDLER_MAIN;`
- `enterFarm()` (~:429-439):

```ts
enterFarm(idFarm?: number): void {
  if (this.currentHandlerContext !== HANDLER_FARM) {
    this.currentHandlerContext = HANDLER_FARM;
    const m = Message.create(-1);
    m.writer!.writeByte(HANDLER_FARM);
    this.session.send(m);
  } else {
    const targetId = idFarm ?? this.farmState?.idFarm ?? this.playerId ?? 0;
    this.farm.joinFarm(targetId);
  }
}
```

Giữ nguyên comment giải thích hiện có, cập nhật chữ "inFarm" thành "context".

- [x] **Step 5: Thêm park/world API cho runner**

Đặt cạnh `enterFarm`:

```ts
/** Xin handler Park (9) đúng MỘT lần khi context khác 9; xin lại gây đóng socket. */
enterParkContext(): void {
  if (this.currentHandlerContext === HANDLER_PARK) return;
  this.currentHandlerContext = HANDLER_PARK;
  const m = Message.create(-1);
  m.writer!.writeByte(HANDLER_PARK);
  this.session.send(m);
}

joinPark(map: number, area: number): void {
  this.park.doJoinPark(map, area);
}

/** Chờ đúng MỘT snapshot enter-world mới; cleanup trọn trên resolve/timeout/abort. */
waitForWorldSnapshot(signal: AbortSignal, timeoutMs: number): Promise<EnterWorldSnapshot> {
  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | undefined;
    const onSnapshot = (snap: EnterWorldSnapshot): void => {
      cleanup();
      resolve(snap);
    };
    const onAbort = (): void => {
      cleanup();
      reject(new Error('chờ enter-world bị hủy'));
    };
    const cleanup = (): void => {
      if (timer) clearTimeout(timer);
      this.removeListener('world-snapshot', onSnapshot);
      signal.removeEventListener('abort', onAbort);
    };
    timer = setTimeout(() => {
      cleanup();
      reject(new Error('hết giờ chờ gói enter-world (-34)'));
    }, timeoutMs);
    this.once('world-snapshot', onSnapshot);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}
```

- [x] **Step 6: Decode world trong case -34 mà không đụng login**

Trong `case -34`, bên trong nhánh `if (id > 0)`, NGAY SAU khối ví (`wallet`) và TRƯỚC `this.requestYourInfo(id);` thêm:

```ts
// Decoder chạy trên body độc lập; lỗi decode KHÔNG được ảnh hưởng status online.
try {
  const snap = decodeEnterWorld(msg.getData());
  this.emit('world-snapshot', snap);
} catch (err) {
  const section = (err as { section?: string }).section ?? '?';
  const offset = (err as { offset?: number }).offset ?? -1;
  this.emit('log', `decode enter-world lỗi tại ${section}@${offset}: ${(err as Error).message}`);
  this.emit('world-snapshot-error', err);
}
```

Không đổi bất kỳ dòng nào khác của case này (flag/id/keepalive/ví/log/requestYourInfo giữ nguyên).

- [x] **Step 7: Verification**

```bash
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/server test src/game/client.test.ts src/session/avatarSession.test.ts src/autoFarm.test.ts
```

Expected: PASS — đặc biệt test `enterFarm lần đầu gửi GET_HANDLER 10, các lần sau gửi doJoinFarm cmd 69` phải pass KHÔNG sửa.

- [x] **Step 8: Commit**

Chạy `gitnexus_detect_changes({scope:"all"})`; xác nhận flow bị ảnh hưởng: farm join, login -34, client lifecycle. Rồi:

```bash
git add avatar-web/server/src/game/parkService.ts avatar-web/server/src/game/client.ts
git commit -m "feat(game): park context, join and enter-world wait"
```

---

### Task 6: Runner `AutoFindNpc`

**Files:**
- Create: `avatar-web/server/src/autoFindNpc.ts`

**Interfaces:**
- Consumes: `AutoFindNpcPhase`, `AutoFindNpcState`, `NpcMapLocation`, `AutomationLocation` từ `./session/automationTypes.js`; `EnterWorldSnapshot` từ `./game/worldData.js`.
- Produces:
  - `interface AutoFindNpcClient { enterParkContext(): void; joinPark(map: number, area: number): void; waitForWorldSnapshot(signal: AbortSignal, timeoutMs: number): Promise<EnterWorldSnapshot> }`
  - `interface AutoFindNpcOptions` (client, catalog, targetName, onState, onFound, onMissing, clock/timer injectables, các hằng khoảng cách override được).
  - `class AutoFindNpc { start(): void; stop(): Promise<void>; state(): AutoFindNpcState }`

- [x] **Step 1: Tạo `autoFindNpc.ts` với code hoàn chỉnh**

```ts
import type { EnterWorldSnapshot } from './game/worldData.js';
import {
  type AutoFindNpcPhase,
  type AutoFindNpcState,
  type AutomationLocation,
  type NpcMapLocation,
} from './session/automationTypes.js';

/** Client hẹp runner được phép dùng — không đụng farm/shop/raw. */
export interface AutoFindNpcClient {
  enterParkContext(): void;
  joinPark(map: number, area: number): void;
  waitForWorldSnapshot(signal: AbortSignal, timeoutMs: number): Promise<EnterWorldSnapshot>;
}

export interface AutoFindNpcOptions {
  client: AutoFindNpcClient;
  catalog: readonly NpcMapLocation[];
  targetName: string;
  onState: (state: AutoFindNpcState) => void;
  /** Match thành công: persist location + chuyển tracking. */
  onFound: (location: AutomationLocation) => void;
  /** Hai miss hợp lệ liên tiếp: xóa location, quay scanning. */
  onMissing: () => void;
  now?: () => number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  /** Khoảng cách tối thiểu giữa hai join. */
  scanIntervalMs?: number;
  snapshotTimeoutMs?: number;
  endOfCatalogBackoffMs?: number;
  /** Khoảng cách tối thiểu giữa hai snapshot tracking. */
  trackingIntervalMs?: number;
}

const MIN_SCAN_INTERVAL_MS = 2_000;
const SNAPSHOT_TIMEOUT_MS = 5_000;
const END_OF_CATALOG_BACKOFF_MS = 30_000;
const TRACKING_INTERVAL_MS = 2_000;
const MAX_TIMEOUT_BACKOFF_MS = 60_000;
const TIMEOUT_STREAK_BASE_MS = 5_000;
const MAX_TIMEOUT_STREAK_FOR_BACKOFF_GROWTH = 4; // 5s,10s,20s,40s -> cap 60s

/** Exact match: NFC + trim + lowercase vi, so TOÀN chuỗi. */
function normalizeNpcName(name: string): string {
  return name.normalize('NFC').trim().toLocaleLowerCase('vi');
}

export class AutoFindNpc {
  private phase: AutoFindNpcPhase = 'idle';
  private running = false;
  /** Tăng mỗi lần start; callback/continuation cũ phải bỏ cuộc khi lệch epoch. */
  private epoch = 0;
  private stopped = false;
  private settle?: () => void;
  private settled: Promise<void> = Promise.resolve();
  private cursor = 0;
  private timeoutStreak = 0;
  private backoffUntil?: number;
  private lastError?: string;
  private current?: NpcMapLocation;
  private probing?: NpcMapLocation;
  private missingCount = 0;
  private lastJoinAt = 0;
  private abortController = new AbortController();
  private pendingTimer?: NodeJS.Timeout;

  private readonly now: () => number;
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;
  private readonly scanIntervalMs: number;
  private readonly snapshotTimeoutMs: number;
  private readonly endOfCatalogBackoffMs: number;
  private readonly trackingIntervalMs: number;

  constructor(private readonly opts: AutoFindNpcOptions) {
    this.now = opts.now ?? Date.now;
    this.setTimeoutFn = opts.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = opts.clearTimeoutFn ?? clearTimeout;
    this.scanIntervalMs = Math.max(MIN_SCAN_INTERVAL_MS, opts.scanIntervalMs ?? MIN_SCAN_INTERVAL_MS);
    this.snapshotTimeoutMs = opts.snapshotTimeoutMs ?? SNAPSHOT_TIMEOUT_MS;
    this.endOfCatalogBackoffMs = opts.endOfCatalogBackoffMs ?? END_OF_CATALOG_BACKOFF_MS;
    this.trackingIntervalMs = Math.max(
      TRACKING_INTERVAL_MS,
      opts.trackingIntervalMs ?? TRACKING_INTERVAL_MS,
    );
  }

  state(): AutoFindNpcState {
    return {
      phase: this.phase,
      running: this.running,
      targetName: this.opts.targetName,
      cursor: this.cursor,
      total: this.opts.catalog.length,
      ...(this.current ? { current: this.current } : {}),
      ...(this.probing ? { probing: this.probing } : {}),
      timeoutStreak: this.timeoutStreak,
      ...(this.backoffUntil !== undefined ? { backoffUntil: this.backoffUntil } : {}),
      ...(this.lastError !== undefined ? { lastError: this.lastError } : {}),
    };
  }

  start(): void {
    if (this.running || this.stopped) return;
    if (!normalizeNpcName(this.opts.targetName)) {
      this.lastError = 'tên NPC trống';
      this.emitState();
      return;
    }
    if (this.opts.catalog.length === 0) {
      this.lastError = 'catalog rỗng';
      this.emitState();
      return;
    }
    this.running = true;
    this.stopped = false;
    this.settled = new Promise<void>((resolve) => { this.settle = resolve; });
    this.cursor = 0;
    this.timeoutStreak = 0;
    this.backoffUntil = undefined;
    this.lastError = undefined;
    this.current = undefined;
    this.probing = undefined;
    this.missingCount = 0;
    this.lastJoinAt = 0;
    this.abortController = new AbortController();
    const runEpoch = ++this.epoch;
    this.phase = 'scanning';
    this.emitState();
    // Xin context Park đúng MỘT lần trước vòng quét; mốc lastJoinAt buộc join
    // đầu tiên cách context-switch ít nhất một scanIntervalMs.
    this.opts.client.enterParkContext();
    this.lastJoinAt = this.now();
    void this.loop(runEpoch);
  }

  /** Idempotent; resolve sau khi mọi continuation cũ đã bỏ cuộc và phase = idle. */
  async stop(): Promise<void> {
    if (!this.running) return;
    if (this.stopped) {
      await this.settled;
      return;
    }
    this.stopped = true;
    this.phase = 'stopping';
    this.emitState();
    this.abortController.abort();
    if (this.pendingTimer) {
      this.clearTimeoutFn(this.pendingTimer);
      this.pendingTimer = undefined;
    }
    await this.settled;
  }

  // --- vòng quét -----------------------------------------------------------

  private async loop(runEpoch: number): Promise<void> {
    try {
      while (!this.stopped && runEpoch === this.epoch) {
        const progressed = this.phase === 'tracking'
          ? await this.trackingStep(runEpoch)
          : await this.scanningStep(runEpoch);
        if (!progressed) break;
      }
    } finally {
      this.finish(runEpoch);
    }
  }

  /** true = tiếp tục vòng kế; false = dừng (stopped hoặc lệch epoch). */
  private async scanningStep(runEpoch: number): Promise<boolean> {
    const catalog = this.opts.catalog;
    if (this.backoffUntil !== undefined) {
      const remain = this.backoffUntil - this.now();
      if (remain > 0 && !(await this.delay(Math.min(remain, 30_000)))) return false;
      this.backoffUntil = undefined;
      this.phase = 'scanning';
      this.emitState();
    }
    const target = catalog[this.cursor];
    const sinceLast = this.now() - this.lastJoinAt;
    if (this.lastJoinAt !== 0 && sinceLast < this.scanIntervalMs) {
      if (!(await this.delay(this.scanIntervalMs - sinceLast))) return false;
    }
    this.probing = target;
    this.emitState();
    let snap: EnterWorldSnapshot;
    try {
      // Gắn listener TRƯỚC khi gửi join để không bỏ lỡ -34 phản hồi tức thời.
      const pending = this.opts.client.waitForWorldSnapshot(
        this.abortController.signal,
        this.snapshotTimeoutMs,
      );
      this.opts.client.joinPark(target.map, target.area);
      this.lastJoinAt = this.now();
      snap = await pending;
    } catch (err) {
      this.probing = undefined;
      if (this.stopped || runEpoch !== this.epoch) return false;
      this.timeoutStreak += 1;
      const growth = Math.min(this.timeoutStreak, MAX_TIMEOUT_STREAK_FOR_BACKOFF_GROWTH);
      const backoff = Math.min(MAX_TIMEOUT_BACKOFF_MS, TIMEOUT_STREAK_BASE_MS * 2 ** (growth - 1));
      this.backoffUntil = this.now() + backoff;
      this.lastError = (err as Error).message;
      this.phase = 'scan_backoff';
      this.emitState();
      return true;
    }
    this.probing = undefined;
    if (this.stopped || runEpoch !== this.epoch) return false;

    this.timeoutStreak = 0;
    const wanted = normalizeNpcName(this.opts.targetName);
    const found = snap.specials.some((special) => normalizeNpcName(special.name) === wanted);
    if (found) {
      const location: AutomationLocation = { map: target.map, area: target.area, observedAt: this.now() };
      this.current = { map: target.map, area: target.area };
      this.missingCount = 0;
      this.phase = 'tracking';
      this.emitState();
      this.opts.onFound(location);
      return true;
    }
    this.cursor = (this.cursor + 1) % catalog.length;
    if (this.cursor === 0) {
      this.backoffUntil = this.now() + this.endOfCatalogBackoffMs;
      this.phase = 'scan_backoff';
      this.emitState();
    }
    return true;
  }

  /** Tracking: đứng yên map/khu, refresh snapshot, 2 miss liên tiếp mới buông. */
  private async trackingStep(runEpoch: number): Promise<boolean> {
    const here = this.current;
    if (!here) return false;
    const sinceLast = this.now() - this.lastJoinAt;
    if (sinceLast < this.trackingIntervalMs) {
      if (!(await this.delay(this.trackingIntervalMs - sinceLast))) return false;
    }
    let snap: EnterWorldSnapshot;
    try {
      const pending = this.opts.client.waitForWorldSnapshot(
        this.abortController.signal,
        this.snapshotTimeoutMs,
      );
      this.opts.client.joinPark(here.map, here.area);
      this.lastJoinAt = this.now();
      snap = await pending;
    } catch {
      if (this.stopped || runEpoch !== this.epoch) return false;
      // Tracking mất một lần refresh không đủ căn cứ rời vị trí: thử lại.
      this.lastError = 'mất snapshot khi tracking';
      this.emitState();
      return true;
    }
    if (this.stopped || runEpoch !== this.epoch) return false;

    const wanted = normalizeNpcName(this.opts.targetName);
    const stillThere = snap.specials.some((special) => normalizeNpcName(special.name) === wanted);
    if (stillThere) {
      this.missingCount = 0;
      this.opts.onFound({ map: here.map, area: here.area, observedAt: this.now() });
      return true;
    }
    this.missingCount += 1;
    if (this.missingCount >= 2) {
      const idx = this.opts.catalog.findIndex(
        (entry) => entry.map === here.map && entry.area === here.area,
      );
      this.cursor = idx >= 0 ? (idx + 1) % this.opts.catalog.length : 0;
      this.current = undefined;
      this.probing = undefined;
      this.missingCount = 0;
      this.phase = 'scanning';
      this.emitState();
      this.opts.onMissing();
    }
    return true;
  }

  private finish(runEpoch: number): void {
    if (runEpoch !== this.epoch) return;
    this.running = false;
    this.phase = 'idle';
    if (this.pendingTimer) {
      this.clearTimeoutFn(this.pendingTimer);
      this.pendingTimer = undefined;
    }
    this.abortController.abort();
    this.emitState();
    this.settle?.();
  }

  /** Delay có thể bị stop cắt ngang; resolve false nếu phải bỏ cuộc. */
  private delay(ms: number): Promise<boolean> {
    if (this.stopped) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      let done = false;
      const conclude = (value: boolean) => {
        if (done) return;
        done = true;
        if (this.pendingTimer) {
          this.clearTimeoutFn(this.pendingTimer);
          this.pendingTimer = undefined;
        }
        this.abortController.signal.removeEventListener('abort', onAbort);
        resolve(value);
      };
      const onAbort = () => conclude(false);
      this.pendingTimer = this.setTimeoutFn(() => conclude(true), ms);
      this.abortController.signal.addEventListener('abort', onAbort, { once: true });
      if (this.abortController.signal.aborted) conclude(false);
    });
  }

  private emitState(): void {
    try {
      this.opts.onState(this.state());
    } catch {
      /* callback của owner lỗi không được giết runner */
    }
  }
}
```

- [x] **Step 2: Typecheck**

Run: `npm --prefix avatar-web/server run typecheck`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add avatar-web/server/src/autoFindNpc.ts
git commit -m "feat(auto): add find-npc scan/tracking runner"
```

---

### Task 7: Coordinator một-runner trong `AvatarSession`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:1-195,240-295,413-448,481-545,645-719,731-864`

**Interfaces:**
- Consumes: `AutoFindNpc`/`AutoFindNpcOptions` từ Task 6; contracts Task 1; `GameClient` park API Task 5; catalog được inject là `readonly NpcMapLocation[]`.
- Produces:
  - `class AutomationInitializationError extends Error` với `code: 'find-npc-name-required' | 'catalog-unverified' | 'find-npc-init-failed'` để phân biệt deterministic init failure với lỗi kết nối tạm thời.
  - `AvatarCredentials.automation: LoadedAutomationIntent` và vẫn giữ `autoEnabled` dẫn xuất để tương thích harness.
  - `AvatarSessionOptions.onAutomationLocation(location: NpcMapLocation | null): void`; `findNpcCatalog?: readonly NpcMapLocation[]`; `createAutoFindNpc?(options: AutoFindNpcOptions): AutoFindNpc`.
  - `AvatarSessionSnapshot.automation: AutomationSnapshot`.
  - `automationSnapshot(): AutomationSnapshot`.
  - `switchAutomationMode(intent: LoadedAutomationIntent): Promise<AutomationStartOutcome>`.
  - `stopAutomation(): Promise<void>` — dừng runner nhưng giữ `GameClient` online.
  - `stopAuto(): Promise<void>` — legacy cleanup rồi disconnect.

- [x] **Step 1: Chạy impact/context cho toàn bộ lifecycle sẽ sửa**

Run GitNexus:

```text
context(name="AvatarSession", file_path="avatar-web/server/src/session/avatarSession.ts", include_content=false)
impact(target="startAuto", file_path="avatar-web/server/src/session/avatarSession.ts", direction="upstream", includeTests=true)
impact(target="stopAuto", file_path="avatar-web/server/src/session/avatarSession.ts", direction="upstream", includeTests=true)
impact(target="connect", file_path="avatar-web/server/src/session/avatarSession.ts", direction="upstream", includeTests=true)
impact(target="onOnline", file_path="avatar-web/server/src/session/avatarSession.ts", direction="upstream", includeTests=true)
impact(target="onDisconnected", file_path="avatar-web/server/src/session/avatarSession.ts", direction="upstream", includeTests=true)
impact(target="teardown", file_path="avatar-web/server/src/session/avatarSession.ts", direction="upstream", includeTests=true)
impact(target="snapshot", file_path="avatar-web/server/src/session/avatarSession.ts", direction="upstream", includeTests=true)
```

Expected: lifecycle session là integration surface rộng; ghi risk + mọi d=1 vào SDD ledger. Nếu HIGH/CRITICAL, warning bắt buộc đã được user chấp nhận khi duyệt Plan nhưng vẫn phải liệt kê trước edit. Không bỏ caller `manager.ts`, `routes.ts`, `avatarSession.test.ts`.

- [x] **Step 2: Thêm imports, contracts option và state coordinator**

Thêm imports và lỗi typed:

```ts
import { AutoFindNpc, type AutoFindNpcOptions } from '../autoFindNpc.js';
import {
  idleFindNpcRuntime,
  type AutomationLocation,
  type AutomationMode,
  type AutomationSnapshot,
  type AutomationStartOutcome,
  type AutoFindNpcState,
  type LoadedAutomationIntent,
  type NpcMapLocation,
} from './automationTypes.js';

export class AutomationInitializationError extends Error {
  constructor(
    readonly code: 'find-npc-name-required' | 'catalog-unverified' | 'find-npc-init-failed',
    message: string,
  ) {
    super(message);
    this.name = 'AutomationInitializationError';
  }
}
```

Mở rộng credentials/options:

```ts
export interface AvatarCredentials {
  // giữ host/port/user/pass/device/autoConfig hiện có
  /** Compatibility field dẫn xuất; coordinator không dùng làm source of truth. */
  autoEnabled: boolean;
  automation: LoadedAutomationIntent;
}

export interface AvatarSessionOptions {
  // giữ fields hiện có
  onAutomationLocation: (location: NpcMapLocation | null) => void;
  findNpcCatalog?: readonly NpcMapLocation[];
  createAutoFindNpc?: (options: AutoFindNpcOptions) => AutoFindNpc;
}
```

Thêm `automation: AutomationSnapshot` vào `AvatarSessionSnapshot`. Thay `wantAuto` bằng state:

```ts
private desiredMode: AutomationMode = 'off';
private activeMode: AutomationMode = 'off';
private transitionState: 'stable' | 'switching' = 'stable';
private findNpcConfig = { revision: 0, config: { npcName: '' } };
private automationLocation: AutomationLocation | null = null;
private findNpc?: AutoFindNpc;
private findNpcRuntime: AutoFindNpcState = idleFindNpcRuntime('');
private automationTransition: Promise<AutomationStartOutcome> = Promise.resolve('active');
```

Giữ `auto`, timers và farm config hiện có. Mọi guard trước đây đọc `wantAuto` phải đọc `desiredMode === 'auto_farm'`.

- [x] **Step 3: Thêm snapshot + event nguyên khối**

```ts
automationSnapshot(): AutomationSnapshot {
  return {
    desiredMode: this.desiredMode,
    activeMode: this.activeMode,
    transitionState: this.transitionState,
    findNpcConfig: this.findNpcConfig,
    findNpcRuntime: this.findNpcRuntime,
    location: this.automationLocation,
  };
}

private emitAutomation(): void {
  this.emit('automation', this.automationSnapshot());
}
```

Trong `snapshot()` thêm `automation: this.automationSnapshot()`.

- [x] **Step 4: Nạp intent ở mỗi `connect()` và tạo AutoFarm như cũ**

Ngay sau `const creds = await this.opts.loadCredentials()`:

```ts
this.desiredMode = creds.automation.desiredMode;
this.findNpcConfig = creds.automation.findNpcConfig;
this.automationLocation = creds.automation.location;
this.findNpcRuntime = idleFindNpcRuntime(this.findNpcConfig.config.npcName);
```

Không khởi tạo `AutoFindNpc` ở đây. Vẫn khởi tạo `AutoFarm`, MacroRunner, ShopCoordinator wiring như trước. Không tin `creds.autoEnabled` để chọn runner.

- [x] **Step 5: Thêm primitive stop/start runner; không có overlap**

Đặt cạnh `tryStartAuto()`:

```ts
private async stopActiveAutomation(): Promise<void> {
  this.cancelAutoCycleTimer();
  this.auto?.stop();
  const finder = this.findNpc;
  this.findNpc = undefined;
  if (finder) await finder.stop();
  this.activeMode = 'off';
  this.findNpcRuntime = idleFindNpcRuntime(this.findNpcConfig.config.npcName);
}

private startFindNpc(client: GameClient): void {
  const targetName = this.findNpcConfig.config.npcName;
  const catalog = this.opts.findNpcCatalog ?? [];
  if (!targetName) {
    throw new AutomationInitializationError('find-npc-name-required', 'tên NPC trống');
  }
  if (catalog.length === 0) {
    throw new AutomationInitializationError('catalog-unverified', 'catalog NPC chưa verified');
  }

  // Location persisted từ process trước là stale; xóa TRƯỚC scan đầu.
  this.automationLocation = null;
  this.opts.onAutomationLocation(null);
  let finder!: AutoFindNpc;
  const runnerOptions: AutoFindNpcOptions = {
    client,
    catalog,
    targetName,
    onState: (state) => {
      if (this.findNpc !== finder) return;
      this.findNpcRuntime = state;
      this.emitAutomation();
    },
    onFound: (location) => {
      if (this.findNpc !== finder) return;
      this.automationLocation = location;
      this.opts.onAutomationLocation({ map: location.map, area: location.area });
      this.emitAutomation();
    },
    onMissing: () => {
      if (this.findNpc !== finder) return;
      this.automationLocation = null;
      this.opts.onAutomationLocation(null);
      this.emitAutomation();
    },
    now: this.now,
    setTimeoutFn: this.setTimeoutFn,
    clearTimeoutFn: this.clearTimeoutFn,
  };
  finder = this.opts.createAutoFindNpc
    ? this.opts.createAutoFindNpc(runnerOptions)
    : new AutoFindNpc(runnerOptions);
  this.findNpc = finder;
  finder.start();
  if (!finder.state().running) {
    throw new AutomationInitializationError(
      'find-npc-init-failed',
      finder.state().lastError ?? 'runner Find NPC không khởi động',
    );
  }
  this.findNpcRuntime = finder.state();
}
```

`let finder!` nằm trước callbacks để callback identity guard tham chiếu đúng instance sau assignment. `stopActiveAutomation()` phải được `await` ở switch; hard teardown dùng synchronous abort + identity guard như Step 7.

- [x] **Step 6: Serialize `switchAutomationMode` trên promise-chain**

```ts
switchAutomationMode(intent: LoadedAutomationIntent): Promise<AutomationStartOutcome> {
  const run = async (): Promise<AutomationStartOutcome> => {
    this.desiredMode = intent.desiredMode;
    this.findNpcConfig = intent.findNpcConfig;
    this.automationLocation = intent.location;
    this.transitionState = 'switching';
    this.emitAutomation();

    await this.stopActiveAutomation();
    if (intent.desiredMode === 'off') {
      this.transitionState = 'stable';
      this.emitAutomation();
      return 'active';
    }

    try {
      const wasOnline = this.status === 'online';
      await this.start();
      if (!wasOnline && this.status !== 'online') {
        this.activeMode = 'off';
        this.emitAutomation();
        return 'connect-pending';
      }
      await this.startDesiredAutomation(this.requireClient());
      this.transitionState = 'stable';
      this.emitAutomation();
      return 'active';
    } catch (error) {
      // Lỗi init typed luôn deterministic, kể cả socket rớt cùng thời điểm.
      if (!(error instanceof AutomationInitializationError) && this.status !== 'online') {
        this.activeMode = 'off';
        this.emitAutomation();
        return 'connect-pending';
      }
      await this.stopActiveAutomation();
      this.desiredMode = 'off';
      this.transitionState = 'stable';
      this.emitAutomation();
      return 'start-failed';
    }
  };
  const next = this.automationTransition.then(run, run);
  this.automationTransition = next.catch(() => 'start-failed');
  return next;
}
```

Thêm:

```ts
private async startDesiredAutomation(client: GameClient): Promise<void> {
  if (this.desiredMode === 'auto_farm') {
    this.shop?.assertIdleForAutomation();
    this.auto!.start(this.lastAutoConfig);
    this.activeMode = 'auto_farm';
    return;
  }
  if (this.desiredMode === 'find_npc') {
    this.startFindNpc(client);
    this.activeMode = 'find_npc';
  }
}

async stopAutomation(): Promise<void> {
  await this.switchAutomationMode({
    desiredMode: 'off',
    findNpcConfig: this.findNpcConfig,
    location: this.automationLocation,
  });
}
```

Giữ public `startAuto(cfg)` làm compatibility wrapper: cập nhật `lastAutoConfig`, tạo intent `auto_farm`, rồi `await switchAutomationMode(intent)`. `stopAuto()` đổi thành `async`: `await stopAutomation(); this.stop();` để legacy endpoint vẫn disconnect sau cleanup.

- [x] **Step 7: Chuyển lifecycle/reconnect sang một nguồn mode**

- `onOnline`: thay block `if (this.wantAuto)` bằng guard epoch rồi `void this.resumeDesiredAutomation(client, epoch)`. Helper phải enqueue vào chính `automationTransition`; bên trong kiểm tra `isCurrent(client,epoch)`, `activeMode==='off'`, `desiredMode!=='off'`, đặt switching, gọi `startDesiredAutomation(client)`, rồi stable. Lỗi typed deterministic đưa desired off + emit; lỗi socket tạm giữ desired để retry.
- `onAutoCycleComplete`, `scheduleOnlineAutoCycle`, `scheduleAutoCycle`: thay mọi `wantAuto` bằng `desiredMode === 'auto_farm'`; `activeMode` vẫn `auto_farm` trong interval kể cả client idle.
- `onDisconnected`: gọi `this.auto?.stop()` ngay; với finder lưu local ref, set `findNpc=undefined` trước rồi `void finder.stop()` để AbortController cắt wait/timer; epoch/identity guard ngăn late mutation. Set `activeMode='off'`, emit snapshot rồi reconnect policy start lại đúng desired mode.
- `failPermanently`: set `desiredMode='off'`, abort cả runner theo cùng pattern, emit automation; manager callback persist off.
- `teardown`: vì method hiện sync, abort finder bằng `void finder.stop()` sau khi clear identity; mọi đường switch mode đã `await stopActiveAutomation()` trước teardown. `stop()` là hard disconnect nên set desired connection false và không để callback muộn.
- `tryStartAuto()` chỉ còn là helper cycle AutoFarm và phải no-op nếu `desiredMode !== 'auto_farm'`.

Ruling implementation: không biến toàn bộ teardown thành async vì sẽ lan API disconnect/shutdown; cleanup có await bắt buộc nằm trong automation switch. Hard socket teardown abort đồng bộ, rồi epoch + identity guard cô lập continuation cũ.

- [x] **Step 8: Verification production-first và cập nhật harness hiện có nếu compiler bắt buộc**

Run:

```bash
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/server test src/session/avatarSession.test.ts src/game/client.test.ts src/autoFarm.test.ts
```

Expected: PASS. Nếu `AvatarSessionOptions` mới làm fixture hiện có thiếu callbacks, thêm vào chính fixture hiện hữu `onAutomationLocation: () => undefined`, `automation` mặc định trong credentials và factory fake — không tạo test mới, không thêm test case mới. Ghi file fixture/test đã sửa ở checklist này trước stage.

- [x] **Step 9: Commit**

Chạy `gitnexus_detect_changes({scope:"all"})`; xác nhận d=1 lifecycle đã cập nhật, affected flows chỉ session connect/reconnect/AutoFarm/automation. Sau đó:

```bash
git add avatar-web/server/src/session/avatarSession.ts
# Thêm đúng các fixture test hiện có nếu Step 8 bắt buộc sửa.
git commit -m "refactor(session): coordinate exclusive automation modes"
```

---

### Task 8: SessionManager persistence bridge và bootstrap automation

**Files:**
- Modify: `avatar-web/server/src/session/manager.ts:1-28,117-182,184-250`
- Modify after production only if required: `avatar-web/server/src/session/manager.test.ts:1-70,112-330`

**Interfaces:**
- Consumes: `readAutomationState`, `setDesiredMode`, `saveFindNpcLocation`, `listDesiredAutomation`, `offlineAutomationSnapshot` từ Task 3; coordinator API Task 7.
- Produces:
  - `automationSnapshot(accountId): AutomationSnapshot` — live snapshot hoặc defensive DB snapshot.
  - `switchAutomationMode(accountId, intent): Promise<AutomationStartOutcome>`.
  - `stopAutomation(accountId): Promise<void>`.
  - credentials luôn có `automation` intent; permanent failure persist `off`.

- [x] **Step 1: Impact analysis**

```text
impact(target="bootstrap", file_path="avatar-web/server/src/session/manager.ts", direction="upstream", includeTests=true)
impact(target="getOrCreate", file_path="avatar-web/server/src/session/manager.ts", direction="upstream", includeTests=true)
impact(target="snapshot", file_path="avatar-web/server/src/session/manager.ts", direction="upstream", includeTests=true)
impact(target="startAuto", file_path="avatar-web/server/src/session/manager.ts", direction="upstream", includeTests=true)
```

Expected: d=1 routes, accounts routes/WS bootstrap/tests. Ghi risk; cập nhật tất cả fake method compile-time consumers.

- [x] **Step 2: Thêm repository bridge + catalog provider**

Imports:

```ts
import {
  listDesiredAutomation,
  offlineAutomationSnapshot,
  readAutomationState,
  saveFindNpcLocation,
  setDesiredMode,
} from '../accounts/automationRepo.js';
import type {
  AutomationMode,
  AutomationSnapshot,
  AutomationStartOutcome,
  LoadedAutomationIntent,
  NpcMapLocation,
} from './automationTypes.js';
```

Mở rộng deps:

```ts
findNpcCatalog?: readonly NpcMapLocation[];
```

Trước Task 13, `index.ts` không truyền field này nên default `[]`.

- [x] **Step 3: Thêm manager API**

```ts
automationSnapshot(accountId: number): AutomationSnapshot {
  return this.sessions.get(accountId)?.automationSnapshot()
    ?? offlineAutomationSnapshot(readAutomationState(this.deps.db, accountId));
}

async switchAutomationMode(
  accountId: number,
  intent: LoadedAutomationIntent,
): Promise<AutomationStartOutcome> {
  return this.getOrCreate(accountId).switchAutomationMode(intent);
}

async stopAutomation(accountId: number): Promise<void> {
  await this.sessions.get(accountId)?.stopAutomation();
}
```

`startAuto` compatibility wrapper vẫn gọi session `startAuto(cfg)`; legacy route tiếp tục dùng nó.

- [x] **Step 4: Nạp automation vào credentials + persistence callback**

Trong `loadCredentials`:

```ts
const automation = readAutomationState(db, accountId);
return {
  // host/port/user/pass/device như cũ
  autoEnabled: automation.desiredMode === 'auto_farm',
  autoConfig: row.autoConfig as Partial<AutoFarmConfig> | undefined,
  automation,
};
```

Trong options:

```ts
findNpcCatalog: this.deps.findNpcCatalog ?? [],
onAutomationLocation: (location) => saveFindNpcLocation(db, accountId, location),
```

`onPermanentFailure` đổi từ `setAutoEnabled(false)` sang `setDesiredMode(db, accountId, 'off')`, sau đó broadcast `auto-disabled` như ruling.

- [x] **Step 5: Bootstrap cả hai mode theo intent**

Thay `listAutoEnabled` bằng `listDesiredAutomation`:

```ts
const entries = listDesiredAutomation(this.deps.db);
// Giữ nguyên startAt + BOOTSTRAP_STAGGER_MS.
const entry = entries[i];
try {
  const outcome = await this.switchAutomationMode(entry.accountId, entry.intent);
  if (outcome === 'start-failed') setDesiredMode(this.deps.db, entry.accountId, 'off');
} catch (err) {
  console.error(`bootstrap #${entry.accountId} lỗi: ${(err as Error).message}`);
}
```

Không log config/credential. Transient connect pending giữ desired mode để retry.

- [x] **Step 6: Verification; chỉ sửa fixture hiện có sau production**

Run:

```bash
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/server test src/session/manager.test.ts src/session/routes.test.ts
```

Nếu `manager.test.ts` FakeSession thiếu coordinator methods, thêm members cụ thể:

```ts
private intent: LoadedAutomationIntent = {
  desiredMode: 'off',
  findNpcConfig: { revision: 0, config: { npcName: '' } },
  location: null,
};

async switchAutomationMode(intent: LoadedAutomationIntent): Promise<AutomationStartOutcome> {
  this.intent = intent;
  this.started += 1;
  this.desiredConnected = intent.desiredMode !== 'off';
  return 'active';
}

automationSnapshot(): AutomationSnapshot {
  return {
    desiredMode: this.intent.desiredMode,
    activeMode: this.intent.desiredMode,
    transitionState: 'stable',
    findNpcConfig: this.intent.findNpcConfig,
    findNpcRuntime: idleFindNpcRuntime(this.intent.findNpcConfig.config.npcName),
    location: this.intent.location,
  };
}

async stopAutomation(): Promise<void> {
  this.intent = { ...this.intent, desiredMode: 'off' };
}
```

Import đúng types/helper Task 1. Chỉ thêm members tối thiểu production contract cần; không thêm test case mới.

Expected: toàn bộ suite nêu trên PASS và bootstrap vẫn stagger đúng.

- [x] **Step 7: Commit**

```bash
git add avatar-web/server/src/session/manager.ts
# stage manager.test.ts chỉ nếu Step 6 bắt buộc
# gitnexus_detect_changes(scope="all") trước commit
git commit -m "feat(session): bridge persisted automation intent"
```

---

### Task 9: API automation typed + backward compatibility

**Files:**
- Modify: `avatar-web/server/src/session/routes.ts:1-255`
- Modify after production only if required: `avatar-web/server/src/session/routes.test.ts:18-98`

**Interfaces:**
- Consumes: `normalizeFindNpcConfig`, `readAutomationState`, `saveFindNpcConfig`, `setDesiredMode`; manager API Task 8; `AutomationApiErrorCode`.
- Produces: GET automation, PUT Find NPC config, POST start/stop contracts từ Spec §4.6; legacy endpoints giữ body/behavior cũ.

- [x] **Step 1: Impact analysis route handler + consumers**

Trước sửa route handler, bắt buộc chạy API impact report:

```text
api_impact(route="/api/accounts/:id/automation", repo="learning-reverse")
api_impact(file="avatar-web/server/src/session/routes.ts", repo="learning-reverse")
impact(target="sessionRouter", file_path="avatar-web/server/src/session/routes.ts", direction="upstream", includeTests=true)
```

Route mới có thể chưa có graph node; report file-level phải liệt kê consumer hiện có của `/auto/*`. Nếu HIGH/CRITICAL hoặc shape mismatch, ghi warning + action vào ledger trước edit.

- [x] **Step 2: Thêm validation/error helper typed**

```ts
function automationError(
  res: Response,
  status: number,
  code: AutomationApiErrorCode,
  error: string,
  extra: Record<string, unknown> = {},
): void {
  res.status(status).json({ error, code, ...extra });
}

function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, i) => key === expected[i]);
}
```

Không gọi helper `fail()` substring-based từ route automation.

- [x] **Step 3: GET và PUT config**

```ts
router.get('/:id/automation', owned, (req, res) => {
  res.json(sessions.automationSnapshot(accountId(req)));
});

router.put('/:id/automation/find-npc/config', owned, (req, res) => {
  if (!exactObject(req.body, ['expectedRevision', 'config'])
      || !Number.isInteger(req.body.expectedRevision)
      || req.body.expectedRevision < 0) {
    return automationError(res, 400, 'invalid-find-npc-config', 'payload cấu hình tìm NPC không hợp lệ');
  }
  let config;
  try { config = normalizeFindNpcConfig(req.body.config); }
  catch (error) {
    return automationError(res, 400, 'invalid-find-npc-config', (error as Error).message);
  }
  const saved = saveFindNpcConfig(db, accountId(req), req.body.expectedRevision, config);
  if (saved.status === 'missing') return res.status(404).json({ error: 'không có tài khoản này' });
  if (saved.status === 'conflict') {
    return automationError(res, 409, 'revision-conflict', 'revision cấu hình đã thay đổi', {
      current: saved.current,
    });
  }
  res.json({ ...saved.state, application: 'next-start' });
});
```

Ownership đã được middleware đảm bảo; repo vẫn kiểm tra account tồn tại.

- [x] **Step 4: POST start có persist-first và rollback rõ ràng**

```ts
router.post('/:id/automation/start', owned, async (req, res) => {
  if (!exactObject(req.body, ['mode'])
      || (req.body.mode !== 'auto_farm' && req.body.mode !== 'find_npc')) {
    automationError(res, 400, 'invalid-automation-mode', 'mode automation không hợp lệ');
    return;
  }
  const id = accountId(req);
  const mode = req.body.mode;
  const before = readAutomationState(db, id);
  if (mode === 'find_npc') {
    if (!before.findNpcConfig.config.npcName) {
      automationError(res, 400, 'find-npc-name-required', 'hãy lưu tên NPC trước khi bắt đầu');
      return;
    }
    if (!sessions.hasVerifiedFindNpcCatalog()) {
      automationError(res, 409, 'catalog-unverified', 'catalog NPC chưa được live-verify');
      return;
    }
  }

  // Persist-first. Nếu write này lỗi thì chưa một runtime method nào được gọi.
  try {
    setDesiredMode(db, id, mode);
  } catch {
    automationError(res, 500, 'automation-start-failed', 'không lưu được mode automation');
    return;
  }

  try {
    const stored = readAutomationState(db, id);
    const intent: LoadedAutomationIntent = {
      desiredMode: mode,
      findNpcConfig: stored.findNpcConfig,
      location: stored.location,
    };
    const outcome = await sessions.switchAutomationMode(id, intent);
    const snapshot = sessions.automationSnapshot(id);
    if (outcome === 'connect-pending') {
      automationError(res, 409, 'automation-connect-pending', 'đang chờ kết nối game', { snapshot });
      return;
    }
    if (outcome === 'start-failed') {
      setDesiredMode(db, id, 'off');
      await sessions.stopAutomation(id);
      automationError(res, 500, 'automation-start-failed', 'không khởi tạo được automation', {
        snapshot: sessions.automationSnapshot(id),
      });
      return;
    }
    res.json(snapshot);
  } catch {
    // Sau persist, mọi lỗi không được để intent deterministic mắc kẹt.
    setDesiredMode(db, id, 'off');
    await sessions.stopAutomation(id);
    automationError(res, 500, 'automation-start-failed', 'không khởi tạo được automation', {
      snapshot: sessions.automationSnapshot(id),
    });
  }
});
```

Bổ sung Task 8 method chính xác:

```ts
hasVerifiedFindNpcCatalog(): boolean {
  return (this.deps.findNpcCatalog?.length ?? 0) > 0;
}
```

Nếu `setDesiredMode` ném, route để Express error middleware/outer try trả 500 nhưng KHÔNG gọi runtime. Bọc handler trong `try/catch`; lỗi persistence trả `{error, code:'automation-start-failed'}` 500 không snapshot, còn deterministic rollback theo flow trên. Không dùng biến `before` ngoài validation.

- [x] **Step 5: POST stop giữ socket online**

```ts
router.post('/:id/automation/stop', owned, async (req, res) => {
  if (!exactObject(req.body ?? {}, [])) {
    return automationError(res, 400, 'invalid-automation-mode', 'payload stop phải rỗng');
  }
  const id = accountId(req);
  setDesiredMode(db, id, 'off');
  await sessions.stopAutomation(id);
  res.json(sessions.automationSnapshot(id));
});
```

- [x] **Step 6: Giữ alias cũ, chỉ await cleanup nơi cần**

`POST /auto/start` giữ normalize/merge contract hiện tại và `setAutoEnabled` dual-write. `POST /auto/stop` phải đổi handler thành `async`, `await sessions.peek(id)?.stopAuto()`, rồi trả `{ok:true}`; vì `stopAuto()` Task 7 giờ await cleanup rồi disconnect. GET/PUT `/auto/config` không đổi.

- [x] **Step 7: Verification + cập nhật FakeSession hiện có nếu compiler bắt buộc**

Run:

```bash
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/server test src/session/routes.test.ts src/session/manager.test.ts src/accounts/repo.test.ts
```

Bổ sung methods coordinator vào `routes.test.ts` FakeSession chỉ khi TypeScript cần; không tạo test mới/case mới. Existing legacy assertions (`startAuto`, `stopAuto`, config merge) phải pass.

- [x] **Step 8: Commit**

```bash
git add avatar-web/server/src/session/routes.ts avatar-web/server/src/session/manager.ts
# stage existing test fixture files chỉ nếu Step 7 bắt buộc
# gitnexus_detect_changes(scope="all") trước commit
git commit -m "feat(api): add typed automation mode endpoints"
```

---

### Task 10: WebSocket reducer và frontend DTOs

**Files:**
- Modify: `avatar-web/web/src/types.ts:229-372`
- Modify: `avatar-web/web/src/accounts/accountRuntime.ts:27-105`
- Verify only: `avatar-web/server/src/ws.ts` (không sửa theo ruling #6)

**Interfaces:**
- Consumes: backend DTO Task 1/9.
- Produces: frontend copies của `AutomationMode`, `AutomationLocation`, `StoredFindNpcConfigState`, `AutoFindNpcState`, `AutomationSnapshot`, `AutomationApiErrorDto`; `SessionSnapshot.automation?: AutomationSnapshot`; reducer thay nguyên field khi event `automation` đến.

- [x] **Step 1: Impact analysis reducer/types**

```text
impact(target="reduceAccountRuntime", file_path="avatar-web/web/src/accounts/accountRuntime.ts", direction="upstream", includeTests=true)
```

Types không phải symbol runtime; dùng LSP `findReferences`/grep cho `SessionSnapshot` nếu GitNexus không trả type references. Expected d=1: `useAccountRuntime`, debug/drawer tests và fixture.

- [x] **Step 2: Thêm DTO frontend đầy đủ**

Trước `SessionSnapshot`:

```ts
export type AutomationMode = 'off' | 'auto_farm' | 'find_npc';
export interface AutomationLocation { map: number; area: number; observedAt: number }
export interface StoredFindNpcConfigState { revision: number; config: { npcName: string } }
export interface NpcMapLocation { map: number; area: number }
export type AutoFindNpcPhase = 'idle' | 'scanning' | 'scan_backoff' | 'tracking' | 'stopping';
export interface AutoFindNpcState {
  phase: AutoFindNpcPhase;
  running: boolean;
  targetName: string;
  cursor: number;
  total: number;
  current?: NpcMapLocation;
  /** Map/khu đang chờ snapshot; tồn tại cả khi phase=scanning. */
  probing?: NpcMapLocation;
  timeoutStreak: number;
  backoffUntil?: number;
  lastError?: string;
}
export interface AutomationSnapshot {
  desiredMode: AutomationMode;
  activeMode: AutomationMode;
  transitionState: 'stable' | 'switching';
  findNpcConfig: StoredFindNpcConfigState;
  findNpcRuntime: AutoFindNpcState;
  location: AutomationLocation | null;
}
export interface AutomationApiErrorDto {
  error: string;
  code:
    | 'invalid-automation-mode'
    | 'invalid-find-npc-config'
    | 'find-npc-name-required'
    | 'catalog-unverified'
    | 'revision-conflict'
    | 'automation-connect-pending'
    | 'automation-start-failed';
  snapshot?: AutomationSnapshot;
  current?: StoredFindNpcConfigState;
}
```

Thêm `automation?: AutomationSnapshot` vào `SessionSnapshot` để rolling deploy không buộc fixtures cũ.

- [x] **Step 3: Reducer replace nguyên khối**

Trong switch sau case `auto`:

```ts
case 'automation':
  return { ...current, automation: message.payload as AutomationSnapshot };
```

Import type tương ứng. Không thêm `automation` vào `AccountsProvider` vì card list không dùng field và event không light.

- [x] **Step 4: Verification**

```bash
npm --prefix avatar-web/web run build
npm --prefix avatar-web/web test src/accounts/accountRuntime.test.ts src/accounts/useAccountRuntime.test.tsx
```

Expected: PASS, không cần sửa fixture vì field optional.

- [x] **Step 5: Commit**

```bash
git add avatar-web/web/src/types.ts avatar-web/web/src/accounts/accountRuntime.ts
# gitnexus_detect_changes(scope="all") trước commit
git commit -m "feat(web): consume full automation snapshots"
```

---

### Task 11: UI Tìm NPC + controls mode-aware

**Files:**
- Create: `avatar-web/web/src/accounts/panels/FindNpcPanel.tsx`
- Modify: `avatar-web/web/src/accounts/panels/StatusPanel.tsx:1-162`
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx:1-197`
- Modify: `avatar-web/web/src/styles.css:522-590` (chỉ class Find NPC tối thiểu nếu utility hiện có chưa đủ)
- Modify after production only because labels/endpoints necessarily changed: `avatar-web/web/src/accounts/panels/StatusPanel.test.tsx:41-135`

**Interfaces:**
- Consumes: `AutomationSnapshot`, `StoredFindNpcConfigState`, `AutomationApiErrorDto`, `ApiError`; endpoints Task 9.
- Produces: `FindNpcPanel({accountId, automation, onDirtyChange})`; drawer tab `find_npc`; StatusPanel farm start/stop qua common automation API.

- [x] **Step 1: Impact analysis các component sẽ sửa**

```text
impact(target="StatusPanel", file_path="avatar-web/web/src/accounts/panels/StatusPanel.tsx", direction="upstream", includeTests=true)
impact(target="AccountOperationsDrawer", file_path="avatar-web/web/src/accounts/AccountOperationsDrawer.tsx", direction="upstream", includeTests=true)
```

Expected d=1: drawer/routes/UI tests. Ghi risk; labels thay đổi bắt buộc cập nhật existing assertions sau production.

- [x] **Step 2: Tạo `FindNpcPanel.tsx` production-first**

Component state/flow chính xác:

```ts
const serverName = automation?.findNpcConfig.config.npcName ?? '';
const revision = automation?.findNpcConfig.revision ?? 0;
const [draft, setDraft] = useState(serverName);
const [busy, setBusy] = useState<'save' | 'start' | 'stop' | null>(null);
const [error, setError] = useState('');
const [conflict, setConflict] = useState<StoredFindNpcConfigState | null>(null);
const trimmed = draft.trim();
const valid = [...trimmed].length >= 1 && [...trimmed].length <= 80;
const dirty = draft !== serverName;
```

- `useEffect` đồng bộ draft từ server chỉ khi `!dirty`; effect riêng gọi `onDirtyChange(dirty)` và cleanup `onDirtyChange(false)` khi unmount.
- `<label htmlFor="find-npc-name">Tên NPC chính xác</label>`; input `id`, `maxLength={80}`, `aria-invalid={Boolean(error)}`.
- Save gọi PUT exact body `{expectedRevision: revision, config:{npcName: trimmed}}`; success dùng response mới làm draft/server view; 409 `revision-conflict` đọc `(e as ApiError).body.current`, giữ draft và render nút `Tải tên từ server`.
- Reload-server button set draft/conflict current, clear conflict/error; không gọi API lần nữa.
- Start gọi POST `/automation/start` body `{mode:'find_npc'}`; stop gọi `/automation/stop` body `{}`.
- Error `catalog-unverified`: copy `Catalog vị trí NPC chưa được xác minh live; chưa thể bắt đầu.`; `automation-connect-pending`: `Đã lưu yêu cầu, đang chờ kết nối game.`; lỗi khác dùng `ApiError.message`.
- Vùng lỗi dùng `<p className="err" role="alert">`.

Runtime copy helper:

```ts
function runtimeText(automation?: AutomationSnapshot): string {
  if (!automation) return 'Chưa tải trạng thái tự động';
  if (automation.transitionState === 'switching') return 'Đang chuyển chế độ';
  if (automation.location) {
    return `Đã thấy tại Map ${automation.location.map} - Khu ${automation.location.area}`;
  }
  const runtime = automation.findNpcRuntime;
  if (runtime.phase === 'scan_backoff' && runtime.backoffUntil) {
    return `Đang nghỉ đến ${new Date(runtime.backoffUntil).toLocaleTimeString()}`;
  }
  if (runtime.phase === 'scanning' && runtime.probing) {
    return `Đang quét ${Math.min(runtime.cursor + 1, runtime.total)}/${runtime.total} · Map ${runtime.probing.map} - Khu ${runtime.probing.area}`;
  }
  if (automation.desiredMode === 'find_npc') return 'Đang chờ bắt đầu quét';
  return 'Tìm NPC đang tắt';
}
```

Component giữ thêm `const [savedState, setSavedState] = useState<StoredFindNpcConfigState | null>(null)`. `effectiveConfig = savedState ?? automation?.findNpcConfig ?? default`; khi snapshot có revision mới hơn/equal và draft không dirty thì clear `savedState`. Save success set `savedState` từ response + set draft về tên đã lưu; nhờ đó dirty về false ngay cả khi WebSocket chưa kịp phản ánh. Conflict reload set `savedState=conflict` và draft về tên server.

Nút start disable khi busy, dirty, invalid hoặc desired đang `find_npc` stable; nút stop enable khi desired/active là `find_npc` hoặc switching. Không tạo modal.

- [x] **Step 3: Drawer tab + dirty guard tổng hợp**

Import component, thêm `['find_npc','Tìm NPC']` sau `autofarm`. Thay một boolean bằng hai source:

```ts
const [dirtySources, setDirtySources] = useState({ farm: false, findNpc: false });
const anyDirty = dirtySources.farm || dirtySources.findNpc;
const canLeave = () => !anyDirty || window.confirm('Có thay đổi chưa lưu. Bỏ thay đổi?');
```

Đổi callbacks:

```tsx
onPlanDirtyChange={(dirty) => setDirtySources((current) => ({ ...current, farm: dirty }))}
<FindNpcPanel
  accountId={account.id}
  automation={snapshot?.automation}
  onDirtyChange={(dirty) => setDirtySources((current) => ({ ...current, findNpc: dirty }))}
/>
```

`beforeunload`, backdrop close, Debug link đều dùng `anyDirty`. Thêm panel id/aria theo đúng pattern; keyboard cycle tự bao tab mới nhờ `PANEL_TABS.length`.

- [x] **Step 4: StatusPanel mode-aware**

- Nhãn `Bật auto` → `Bật chăm farm`; `Tắt auto` → `Dừng tự động`.
- Start gọi `/api/accounts/${accountId}/automation/start`, `{mode:'auto_farm'}`.
- Stop gọi `/api/accounts/${accountId}/automation/stop`, `{}`; common endpoint giữ socket online.
- `autoActive` không dùng `desiredConnected`; dùng `automation?.desiredMode !== 'off' || automation?.activeMode !== 'off' || transitionState==='switching'`, fallback legacy `auto.running` khi automation absent.
- Nút farm chỉ disable khi busy hoặc desired/active đã auto_farm stable; nếu Find NPC đang sở hữu automation, nút vẫn enable để switch.
- Text hiển thị `desired=<...> · active=<...>` và `Đang chuyển chế độ` khi switching; giữ cycle/lastRun copy khi active farm.
- Checkbox logoutAfterCycle giữ GET/PUT `/auto/config` y nguyên.

- [x] **Step 5: CSS tối thiểu theo design system hiện có**

Chỉ thêm nếu cần:

```css
.find-npc-status { display: grid; gap: 0.45rem; }
.find-npc-actions { display: flex; flex-wrap: wrap; gap: 0.55rem; }
.find-npc-conflict { border-left: 3px solid var(--accent); padding-left: 0.75rem; }
```

Không đổi palette/font/layout toàn app; không thêm gradient/modal.

- [x] **Step 6: Cập nhật existing StatusPanel assertions sau production**

Trong `StatusPanel.test.tsx`, thay tên button thành `Bật chăm farm`/`Dừng tự động`, và expected endpoints thành `/automation/start` body `{mode:'auto_farm'}`, `/automation/stop` body `{}`. Fixture snapshot không có automation vẫn phải chạy fallback legacy. Không thêm test mới.

- [x] **Step 7: Verification**

```bash
npm --prefix avatar-web/web run build
npm --prefix avatar-web/web test
```

Expected: 73 existing tests PASS sau cập nhật assertions cần thiết; FindNpcPanel typechecks; desktop/mobile không overflow theo static CSS review.

- [x] **Step 8: Commit**

```bash
git add avatar-web/web/src/accounts/panels/FindNpcPanel.tsx \
  avatar-web/web/src/accounts/panels/StatusPanel.tsx \
  avatar-web/web/src/accounts/AccountOperationsDrawer.tsx \
  avatar-web/web/src/styles.css \
  avatar-web/web/src/accounts/panels/StatusPanel.test.tsx
# gitnexus_detect_changes(scope="all") trước commit
git commit -m "feat(web): add find-npc controls and runtime status"
```

---

### Task 12: Probe tool một cặp, output redacted

**Files:**
- Create: `avatar-web/server/src/tools/npc-map-probe.ts`

**Interfaces:**
- Consumes: `loadConfig`, `openDb`, `getAccountById`, `readGamePass`, `GameClient`, Task 5 park API, Task 4 snapshot decoder event.
- Produces: CLI exact `--account-id --map --area`; local health preflight; đúng một context switch/join; redacted evidence text.

- [x] **Step 1: Tạo CLI parser không chấp nhận range/key lạ**

```ts
interface ProbeArgs { accountId: number; map: number; area: number }
const ALLOWED = new Set(['--account-id', '--map', '--area']);
```

Parse argv theo cặp key/value; reject duplicate, thiếu value, key lạ, positional arg, non-integer. `accountId` positive safe integer; map/area signed byte `-128..127`. Không có default, comma, `..`, min/max/range arg.

- [x] **Step 2: Health-check fail-fast trước mở DB/socket game**

Dùng built-in `http.get({host:'127.0.0.1', port:config.port, path:'/api/auth/me', timeout:750})`. Bất kỳ HTTP response nào nghĩa là Avatar Web server đang chạy → throw `hãy dừng Avatar Web server trước khi probe`. `ECONNREFUSED`/timeout được xem là server không chạy; cleanup request. Không gửi ra host ngoài localhost.

`loadConfig()` đọc `.env` qua command `tsx --env-file=.env` ở invocation; tool không in env/config/masterKey.

- [x] **Step 3: Probe đúng một session/cặp và listener-before-send**

Flow exact:

```ts
const config = loadConfig();
await assertAvatarWebStopped(config.port);
const db = openDb(config.dbPath);
const row = getAccountById(db, args.accountId);
if (!row) throw new Error(`không có account #${args.accountId}`);
const client = new GameClient();
const abort = new AbortController();
try {
  await client.login({
    host: row.host,
    port: row.port,
    user: row.gameUser,
    pass: readGamePass(db, config.masterKey, args.accountId),
    device: row.device,
  });
  await waitUntilOnline(client, 10_000);
  client.enterParkContext();
  await sleep(2_000);
  const pending = client.waitForWorldSnapshot(abort.signal, 5_000);
  client.joinPark(args.map, args.area);
  const snapshot = await pending;
  printRedactedEvidence(args, snapshot, txRxMetadata);
} finally {
  abort.abort();
  client.logout();
  db.close();
}
```

`waitUntilOnline` dùng event status + timeout và cleanup listener. `txRxMetadata` chỉ ghi `{dir, cmd, len}` từ traffic events; filter đúng `TX -1`, `TX 80`, `RX -34`. Không in hex, user, host, encrypted/plain password, cookie, key hay credential object.

Output gồm UTC timestamp, account id, requested map/area, TX/RX cmd+len, decode `ok`, `specialSectionEnd`, `totalBytes`, `trailingBytes`, `specialCount`, `specialNames` (chỉ tên), và `mapSpecialUpdates` khi có RX48 trong cửa sổ thụ động. Nếu decode/error, in section/offset/message không credential và exit code 1.

- [x] **Step 4: Static safety scan + typecheck (KHÔNG chạy live)**

```bash
npm --prefix avatar-web/server run typecheck
grep -nE "REQUEST_JOIN_ANY|SELECTED_MINI_MAP|AVATAR_FEEL|COMMUNICATE|MENU_OPTION|-21|\b87\b|-59|-61|4utovip|3x\.4utovip" \
  avatar-web/server/src/tools/npc-map-probe.ts
```

Expected: typecheck PASS; grep chỉ có thể hit comment safety, không có send/call. Rà lại tool chỉ gọi `enterParkContext`, `joinPark`, `waitForWorldSnapshot`, `login/logout`.

- [x] **Step 5: Commit tool chưa chạy**

```bash
git add avatar-web/server/src/tools/npc-map-probe.ts
# gitnexus_detect_changes(scope="all") trước commit
git commit -m "feat(tools): add guarded single-pair NPC map probe"
```

Không stage `.env`, DB, file temp hay output probe.

---

### Task 13: Integrated verification, live authorization gate và catalog evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-08-24-auto-find-npc.md` (checkbox đúng thực tế)
- Verify: `docs/superpowers/specs/2026-08-24-auto-find-npc-design.md`
- Conditional Create after authorized successful probe only: `docs/protocol/npc-map-probe-evidence-2026-08-24.md`
- Conditional Create after evidence commit only: `avatar-web/server/src/game/npcMapCatalog.ts`
- Conditional Modify after catalog creation only: `avatar-web/server/src/index.ts:1-36`

**Interfaces:**
- Consumes: production code Tasks 1–12.
- Produces: code-complete evidence; optionally live-ready evidence/catalog; honest delivery status.

- [x] **Step 1: Full static/regression verification**

```bash
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/server run build
npm --prefix avatar-web/server test
npm --prefix avatar-web/web run build
npm --prefix avatar-web/web test
git diff --check
git status --short
git diff --stat main...HEAD
```

Expected: server 258 existing tests and web 73 existing tests pass (counts may change only if project baseline changed independently; không thêm test mới trong feature); builds/typecheck PASS; không whitespace error; no secret/temp/dist tracked.

- [x] **Step 2: GitNexus final scope review**

```text
gitnexus_detect_changes(scope="compare", base_ref="main")
```

Expected affected flows: account automation persistence, session lifecycle/reconnect, login enter-world decode, farm/park context, automation API/WS/UI. Xác nhận mọi d=1 caller từ Tasks 3/5/7/8/9/10/11 đã update; không có HIGH/CRITICAL warning bị bỏ qua.

- [x] **Step 3: Manual non-live acceptance**

Với server local nhưng KHÔNG login game/probe:

```text
1. PUT config revision 0 -> revision 1; stale revision -> 409 revision-conflict + current.
2. Start find_npc thiếu tên -> 400 và desired mode không đổi.
3. Start find_npc khi catalog empty -> 409 catalog-unverified và desired mode không đổi.
4. GET automation không có live session trả desired/config/location từ DB, active=off, stable, runtime idle.
5. Legacy GET/PUT /auto/config contract không đổi.
6. Drawer desktop/mobile render tab Tìm NPC, labels mới, dirty guard và keyboard cycle theo static/manual browser review.
```

Không dùng credential game để thực hiện bước này.

- [x] **Step 4: Request final broad code review**

Invoke `superpowers:requesting-code-review` trên `main...HEAD`, review correctness/concurrency/protocol/security/compatibility. Fix findings đã xác minh; sau mỗi fix chạy lại verification liên quan và `gitnexus_detect_changes(scope="all")`. Expected: không còn finding blocking.

- [x] **Step 5: DỪNG tại live authorization gate nếu chưa có ủy quyền rõ ràng**

Không tự chạy probe. Báo code-complete và các bước live còn pending. Chỉ tiếp tục Step 6 khi user chỉ định rõ `account-id`, `map`, `area` và cho phép một kết nối probe tới server game. Việc duyệt Plan KHÔNG tự động là ủy quyền live.

- [x] **Step 6: Chạy đúng một probe đã được ủy quyền**

Trước hết dừng Avatar Web server. Run với cặp user đã chỉ định:

```bash
npm --prefix avatar-web/server exec -- tsx --env-file=.env src/tools/npc-map-probe.ts \
  --account-id <AUTHORIZED_ID> --map <AUTHORIZED_SIGNED_BYTE> --area <AUTHORIZED_SIGNED_BYTE>
```

Original expected `RX -34` was superseded by the native protocol-correction
spec: production sends the reviewed six-byte `TX 80` and accepts the matching
`RX 80` Park snapshot, while login `-34` remains the login-only packet. The
corrected gate still requires `playerId>0`, sequential special parsing, and a
stable reviewed trailing length. No `-23` fallback or unreviewed pair is used.

Observed 2026-08-25: account `2`, map `5`, area `7` đã được user ủy quyền cho đúng một lần probe. TCP endpoint `27.0.14.120:19129` reachable, nhưng GameClient chuyển `status=error` trước khi online; probe trả `traffic=[]`, không có `cmd 80`/`-34` evidence. Step dừng tại `protocol investigation pending`; chưa tạo evidence hoặc catalog và không thử cặp khác.

Retry observed 2026-08-25 after account logout: login đã vượt `waitUntilOnline`, probe gửi `TX -1` và `TX 80` (`map=5`, `area=7`), nhưng không nhận `RX -34` mới trong 5 giây và kết thúc `snapshot` timeout. Đây là bằng chứng login đã đi qua nhưng cặp join chưa được xác minh; vẫn không tạo evidence/catalog và không thử cặp khác.

Second candidate observed 2026-08-25: sau khi user yêu cầu tiếp tục, probe `account=2`, `map=2`, `area=6` cũng vượt login, gửi `TX -1` + `TX 80`, nhưng timeout chờ `RX -34` mới. Hai candidate external (`5/7`, `2/6`) đều không chứng minh mapping `cmd 80 → enter-world`; dừng tại protocol investigation/Spec review gate, không tạo catalog.

Direct-join retry observed 2026-08-25T05:40:58.328Z with the currently
authorized account 2 / map 5 / area 7: login reached `online`, Park handler
ACK completed, then exactly one `TX 80 len=6` received `RX 80 len=134`.
Redacted prefix decode matched `room=5`, `board=7`, `x=0`, `y=0`, with two
non-tour player records, marker/animation zero, native `specialCount=0`, and 21
undecoded trailing bytes. A corrected native-list decode on
2026-08-25T05:50:39.594Z reproduced the same response length and 21-byte
suffix, with `listPlayerEnd=109` and `specialSectionEnd=113`. This verifies the
requested direct join and an empty special list only; the stable-looking
unknown suffix is not promoted to catalog data, and no production catalog or
`npcMapCatalog.ts` is created yet.

An additional authorized retry at `2026-08-25T06:08:54.133Z` reproduced the
same redacted direct-join metadata: `TX 80 len=6`, `RX 80 len=134`, response
room/board `5/7`, coordinates `0/0`, two player records, native
`specialCount=0`, `specialSectionEnd=113`, and `trailingBytes=21`. This is
repeatability evidence for the direct join only. The original Step 6 contract
requiring a fresh `RX -34` is superseded for this candidate by the native
`RX 80` parser branch; a protocol-correction review is still required before
changing the production catalog gate, so no evidence doc or catalog is
created.

#### Native PositionMap coordinate correction 2026-08-25T06:18:02.122Z

Disassembly of `LoadMap.doJoin` shows it copies the selected map's
`PositionMap.x/y` into `LoadMap.xJoinCasino/yJoinCasino` before calling native
`ParkService.doJoinPark`. For the static CityMap v3.4.4 entry `map=5` those
coordinates are `(254,82)`. After one temporary login rejection and its
bounded 10-second backoff, the authorized `2/5/7` probe sent one `TX 80 len=6`
with that position and received one `RX 80 len=134` with response
`room/board=5/7`, `x/y=254/82`, two players, `specialCount=0`,
`specialSectionEnd=113`, and `trailingBytes=21`.

This upgrades the candidate from a `0,0` baseline to native map-position
evidence for `5/7`. It still does not satisfy the original fresh `RX -34` /
complete-NPC catalog gate; no production catalog or evidence commit is made.

#### Parser alignment and repeatability 2026-08-25T06:40:44.203Z

The RX80 prefix parser was corrected from the earlier 18-byte-per-player-only
layout to consume the native drop-part count and its 11-byte records after the
player vector. The exact authorized `2/5/7` run then reproduced `RX 80 len=134`
with response `room/board=5/7`, `x/y=254/82`, two players,
`listPlayerEnd=110`, `specialCount=0`, `specialSectionEnd=114`, and
`trailingBytes=20`. The earlier 21-byte suffix was therefore a one-byte prefix
offset, not a catalog field. The native special list is still empty, so this
remains direct-join evidence only; no production catalog is created.

#### Static CityMap extraction 2026-08-25

The bundled v3.4.4 `CityMap` TextAsset was decoded independently from the APK
asset bundle. It contains seven static `PositionMap` entries in native order:
`1 Khu sinh thái (473,100, handler 9, idToMap 13)`,
`3 Khu giải trí (236,280, 9, 9)`, `4 Khu mua sắm (452,250, 9, 23)`,
`5 Công viên (254,82, 9, 11)`, `7 Nông trại (524,423, 10, 25)`,
`8 Ngoại ô (100,100, 9, 17)`, and `9 Mê cung (57,209, 9, 28)`.
This is package/static map evidence only; it does not enumerate live areas or
NPCs for account 2, and it is not promoted to `npcMapCatalog.ts`.

#### Legacy Auto Tìm NPC candidate catalog 2026-08-25

Independent inspection of the untracked legacy `avatar-auto.jar` found the
older Auto Tìm NPC class's default map string
`1,2,3,5,6,7,8,9,11,23` and its default inclusive area cursor `0..9`. The same
archive's fast-travel labels call legacy map ID `5` `Khu tài xỉu` and legacy
map ID `11` `Khu công viên`. This proves that the legacy server-map namespace
is not the same as the Unity `CityMap` node namespace: `CityMap id=5` is the
`Công viên` node whose `idToMap=11`. The legacy command writer independently
confirms `i8 map, i8 area, i16 x, i16 y` for the direct join body.

This supplies a static candidate catalog and explains why `5/7` was a valid
legacy probe target, but it does not enumerate current server areas or NPCs.
It therefore does not check Step 7 and does not justify creating
`npcMapCatalog.ts`.

#### NPC-name decoder verification 2026-08-25T06:46:53.895Z

The bounded probe now consumes the native `ItemMapSpecial` fields and emits
only `specialNames` in the redacted projection. A fresh exact `2/5/7` run
reached `online`, sent one six-byte `TX 80`, received `RX 80 len=134`, and
returned `specialCount=0`, `specialNames=[]`, `specialSectionEnd=114`, and
`trailingBytes=20`. This confirms the decoder path but still supplies no live
NPC/area catalog entry.

#### Guarded repeat 2026-08-25T07:02:31.115Z

The probe now rejects an unsupported map before opening the DB/socket instead
of silently reusing map 5's reviewed `(254,82)` position. A negative map-4
check produced no traffic/events. The authorized account `2`, map `5`, area
`7` invocation then reproduced one Park-context `TX -1 len=1`, one `TX 80
len=6`, and one `RX 80 len=134`; response metadata was `room/board=5/7`,
`x/y=254/82`, two players, `specialCount=0`, `specialNames=[]`,
`specialSectionEnd=114`, and `trailingBytes=20`. This is repeatable
direct-join evidence only; the live area/NPC catalog gate remains open.

#### Latest retry 2026-08-25T07:06:41.630Z

An initial exact retry at `07:06:20.840Z` ended at login `status=error` and
sent no `cmd 80`. The immediate retry reached `online` and reproduced one
Park-context `TX -1 len=1`, one direct-join `TX 80 len=6`, and one `RX 80
len=134`; decoded metadata again matched `room/board=5/7`, `x/y=254/82`, two
players, `specialCount=0`, `specialNames=[]`, `specialSectionEnd=114`, and
`trailingBytes=20`. This confirms repeatability after a transient login
failure but does not create a live area/NPC catalog entry.

#### Post-join event window 2026-08-25T07:16:30.494Z

The probe now keeps the socket open for `3,000 ms` after `RX 80` and records
redacted traffic from that passive window. The exact `2/5/7` run again returned
`RX 80 len=134`, `room/board=5/7`, `x/y=254/82`, `specialCount=0`,
`specialNames=[]`, and `trailingBytes=20`; no `RX 48` (`ITEM_MAP_SPECIAL`)
arrived. Only `RX -3 len=25` and `RX 85` followed, so no asynchronous NPC
evidence was found and no catalog entry was promoted.

#### Native RX48 decoder adjustment 2026-08-25T07:31:09.332Z

Native disassembly confirms that `GlobalMessageHandler.onMessage` dispatches
command `48` at `0x5EDDDC`: it reads an `i8 mode`, calls
`AvatarData.readItemDataMapSpecial @0xA0C280` for modes `0/1`, and reads an
`i32 id` for `removeItemDataMapSpecial @0xA0C704` at mode `2`. The probe now
captures RX48 during the passive post-join window and decodes the verified
upsert fields (`id`, UTF name, `x`, `y`, `type`, image/menu counts) without
retaining raw bytes. The exact `2/5/7` retry reached `online`, reproduced
`TX 80 len=6` / `RX 80 len=134`, and emitted `mapSpecialUpdates=[]`; no RX48
arrived in the three-second window. Therefore the decoder is ready for a
future live event, but Step 7 remains unchecked and no dynamic catalog entry
is justified.

#### Native board-list catalog 2026-08-25T07:47:19.723Z

Native disassembly identified the UI-matched `ParkService.doRequestBoardList`
route: `TX 90` writes one signed `roomId` byte, and the native handler decodes
`RX 90` as a signed count followed by that many signed occupancy bytes before
passing the array to `Avatar.onParkList`. The standalone probe was extended
with a strict board-list phase and redacted observation contract, then the
authorized account `2`, map `5`, area `7` invocation completed with `TX 90
len=1` / `RX 90 len=36`. The response decoded to `boardCount=35`, indexes
`0..34` (0-based UI selection), all captured occupancy values `2`; requested
area `7` was present with occupancy `2`.

The same session then sent one native-position `TX 80 len=6` and received
`RX 80 len=134` matching room/board `5/7` and `x/y=254/82`. The passive
three-second window still had no `RX 48` and `mapSpecialUpdates=[]`. This
checks the live area catalog portion of the evidence gate, but not a dynamic
NPC name/location catalog; Step 7 remains unchecked and no production
`npcMapCatalog.ts` is created.

#### Production protocol correction and catalog wiring 2026-08-25T15:06:33+07:00

The live response contract is now implemented in production. `ParkService` sends
the native six-byte join for the reviewed map 5 position `(254,82)` and refuses
maps without a reviewed position. `worldData.ts` has a bounded sequential
RX80 parser for room/board/coordinates, list players, drop parts, map sections,
animations, and `ItemMapSpecial[]`; the stable 20-byte suffix is exposed only
as `trailingBytes`. `GameClient` emits the same `world-snapshot` event for RX80
that `AutoFindNpc` already waits for, while login `-34` behavior remains
unchanged.

The production catalog now contains exactly `{map:5, area:7}` and is injected
from `index.ts` into `SessionManager`. A bounded production-path acceptance
session (account 2) sent `TX 80 len=6`, received `RX 80 len=134`, decoded
`playerId>0`, room/board `5/7`, x/y `254/82`, `specialCount=0`,
`specialSectionEnd=114`, and `trailingBytes=20`. This verifies protocol and
catalog wiring; no live NPC target was present, so end-to-end tracking remains
pending.

The correction is detailed in
`docs/superpowers/specs/2026-08-25-npc-park-runtime-correction-design.md` and
`docs/superpowers/plans/2026-08-25-npc-park-runtime-correction.md`. Because the
user did not request a commit, the evidence/catalog changes remain in the
working tree for review.

The correction supersedes the older Step 7 wording that required a commit
before creating the catalog: the catalog is now present in the working tree
because the user explicitly requested product-code implementation, while the
actual git commit remains deferred until requested.

- [ ] **Step 7: Commit redacted evidence rồi mới tạo catalog**

Evidence doc ghi timestamp/server-build nếu biết, account id, map/area, metadata cmd/len, decode offsets/count/names; không raw hex/credentials. Chạy `git diff` đọc lại để redaction sạch, `gitnexus_detect_changes(scope="all")`, rồi commit evidence riêng:

```bash
git add docs/protocol/npc-map-probe-evidence-2026-08-24.md
git commit -m "docs(protocol): record verified NPC map probe"
```

Sau commit evidence, tạo `npcMapCatalog.ts` bằng object literal chép đúng thứ tự:

```ts
import type { NpcMapLocation } from '../session/automationTypes.js';

/** Chỉ gồm entry có evidence trong docs/protocol/npc-map-probe-evidence-2026-08-24.md. */
export const VERIFIED_NPC_MAP_CATALOG: readonly NpcMapLocation[] = [
  { map: <EVIDENCE_MAP>, area: <EVIDENCE_AREA> },
];
```

`<EVIDENCE_*>` trong Plan là biến mô tả của bước live, KHÔNG được commit nguyên văn; executor thay bằng số signed-byte đã probe thành công. Import catalog trong `index.ts` và truyền `findNpcCatalog: VERIFIED_NPC_MAP_CATALOG` vào `SessionManager`. Impact trước sửa `index.ts`/manager construction, verify server typecheck/build/test, detect_changes, rồi:

```bash
git add avatar-web/server/src/game/npcMapCatalog.ts avatar-web/server/src/index.ts
git commit -m "feat(game): enable verified NPC map catalog"
```

Catalog và evidence phải cùng số entry/thứ tự. Không tạo catalog rỗng.

- [ ] **Step 8: Live API/runner/UI acceptance nếu đã live-ready**

Thực hiện tuần tự Spec §6.4–6.7: `off → auto_farm → find_npc → off`, stop idempotent giữ socket online, legacy stop disconnect, restart bootstrap, timeout/backoff/exact-name, found/location/tracking/two-miss, WS UI update. Không gửi NPC interaction/combat/reward command. Nếu NPC thật không xuất hiện trong thời gian acceptance, để bước end-to-end unchecked và báo chính xác **protocol/catalog verified; live target pending**.

- [x] **Step 9: Cập nhật Plan checkbox và commit docs**

Chỉ đánh `- [x]` cho bước đã chạy thành công; giữ Step 5–8 unchecked khi chưa authorized/đạt gate. Chạy `git diff --check` + final detect_changes rồi:

```bash
git add docs/superpowers/specs/2026-08-24-auto-find-npc-design.md \
  docs/superpowers/plans/2026-08-24-auto-find-npc.md
git commit -m "docs: complete auto find NPC implementation plan"
```

Không claim live-ready/end-to-end ngoài đúng delivery gate của Spec.
