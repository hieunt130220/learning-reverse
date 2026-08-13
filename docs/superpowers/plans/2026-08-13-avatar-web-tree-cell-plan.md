# Avatar Web Tree Cell Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm editor kế hoạch cây theo từng ô trong drawer vận hành, lưu bền vững theo tài khoản, dùng được với cache offline và áp cấu hình nguyên khối từ vòng auto-farm kế tiếp.

**Architecture:** Tách cấu hình người dùng trong `auto_config_json` khỏi farm-profile cache quan sát được trong bảng SQLite riêng. Route cấu hình dùng optimistic revision; `AvatarSession` queue cấu hình mới cho `AutoFarm`, còn `AutoFarm` chỉ swap active config tại đầu vòng và chọn seed theo `seed` / fallback / `skip`. Frontend dùng reducer thuần và component editor riêng, còn `AutoFarmPanel` chịu trách nhiệm hydrate, save và hiển thị trạng thái offline/conflict.

**Tech Stack:** TypeScript 5.7 strict, Node.js test runner + `tsx`, Express 4, SQLite `better-sqlite3`, React 18, React Router 6, Vitest, Testing Library, CSS hiện có.

**Spec:** [docs/superpowers/specs/2026-08-13-avatar-web-tree-cell-plan-design.md](../specs/2026-08-13-avatar-web-tree-cell-plan-design.md)

## Global Constraints

- Trước khi sửa mỗi function/class/method/interface, chạy GitNexus `impact({ target, direction: "upstream" })` và báo blast radius; HIGH/CRITICAL phải dừng và cảnh báo trước khi sửa.
- GitNexus MCP đang báo index chậm hơn HEAD dù analyzer nói up-to-date; mọi kết luận graph phải đối chiếu source/tests hiện tại.
- Giữ nguyên hunk chẩn đoán người dùng đang có trong `autoFarm.ts` (`REFRESH_AT_END = false`) và `avatarSession.ts` (`console.log` trong `pushLog`). Không hoàn tác, format hoặc sửa nội dung hai hunk đó.
- Giữ nguyên `.superpowers/` và mọi dirty file không thuộc task.
- Không commit; người dùng chưa yêu cầu commit.
- Không sửa opcode, packet, parser, `GameClient` hoặc `FarmService`.
- Không thêm animal/cook/shop/fishing/NPC/bulk-account logic.
- Không tự mua hạt, không bán và không thay cây đang mọc.
- Kế hoạch chỉ áp dụng khi ảnh chụp farm đầu vòng có `idTree === -1`.
- Không hard-code 48 ô; dùng đúng `cellIndex` đã cache/quan sát.
- UI và log mới dùng tiếng Việt có dấu.
- Không thêm dependency.
- TypeScript `strict: true`; không thêm `any`, `@ts-ignore` hoặc assertion để che lỗi type.
- Mỗi task đi theo TDD: test đỏ, xác nhận đúng lý do, code tối thiểu, test xanh, rồi `git diff --check` cho file task.

## File Structure

**Tạo:**

| File | Trách nhiệm |
|---|---|
| `avatar-web/server/src/accounts/autoConfig.ts` | Decode legacy/envelope, normalize config, merge patch và validate plan theo profile |
| `avatar-web/server/src/accounts/autoConfig.test.ts` | Unit test config/revision/validation |
| `avatar-web/server/src/accounts/farmProfileRepo.ts` | Kiểu dữ liệu và CRUD cache cell/catalog theo account |
| `avatar-web/server/src/accounts/farmProfileRepo.test.ts` | Unit test partial upsert, ordering, cascade |
| `avatar-web/web/src/accounts/treeCellPlan.ts` | Reducer thuần, summary và invalid-entry analysis cho editor |
| `avatar-web/web/src/accounts/treeCellPlan.test.ts` | Unit test reducer/summary |
| `avatar-web/web/src/accounts/TreeCellPlanEditor.tsx` | Palette, lưới, pointer paint và keyboard UI |
| `avatar-web/web/src/accounts/TreeCellPlanEditor.test.tsx` | Component test click/paint/keyboard/offline states |

**Sửa:**

| File | Trách nhiệm thay đổi |
|---|---|
| `avatar-web/server/src/autoFarm.ts` | Thêm `treeCellPlan`, pending config boundary và chọn seed an toàn |
| `avatar-web/server/src/autoFarm.test.ts` | Runtime tests cho seed/default/skip/inventory/pending config |
| `avatar-web/server/src/db/schema.sql` | Thêm bảng `avatar_farm_profile_cache` idempotent |
| `avatar-web/server/src/db/index.test.ts` | Kiểm tra bảng thứ tư và FK cascade |
| `avatar-web/server/src/accounts/repo.ts` | Config envelope/CAS, tách enable khỏi config, xóa cache khi đổi game user |
| `avatar-web/server/src/accounts/repo.test.ts` | Config retention, CAS và đổi game user |
| `avatar-web/server/src/session/avatarSession.ts` | Queue config, refresh profile tuần tự; giữ hunk log chẩn đoán |
| `avatar-web/server/src/session/avatarSession.test.ts` | Queue boundary và refresh timeout/listener tests |
| `avatar-web/server/src/session/manager.ts` | Persist event farm/trees trước broadcast và giữ config khi disable |
| `avatar-web/server/src/session/manager.test.ts` | Cache event/bootstrap/permanent failure tests |
| `avatar-web/server/src/session/routes.ts` | Config/profile routes và start/stop compatibility |
| `avatar-web/server/src/session/routes.test.ts` | API ownership/revision/refresh/start-stop tests |
| `avatar-web/web/src/api.ts` | `apiPut` và `ApiError.body` cho response conflict |
| `avatar-web/web/src/types.ts` | Shared frontend config/profile types |
| `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx` | Hydrate config/profile, save plan, start từ config đã lưu |
| `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx` | Dirty guard cho close/Escape/backdrop/debug link |
| `avatar-web/web/src/accounts/accountsRoutes.test.tsx` | Drawer dirty-route behavior |
| `avatar-web/web/src/styles.css` | Responsive editor/palette/grid states |

---

### Task 1: Config domain, legacy envelope và validation

**Files:**
- Create: `avatar-web/server/src/accounts/autoConfig.ts`
- Create: `avatar-web/server/src/accounts/autoConfig.test.ts`
- Modify: `avatar-web/server/src/autoFarm.ts` — chỉ thêm type field/re-export cần thiết, giữ nguyên hunk `REFRESH_AT_END`

**Interfaces:**
- Produces:

```ts
export type TreeCellPlanEntry =
  | { cellIndex: number; action: 'seed'; seedId: number }
  | { cellIndex: number; action: 'skip' };

export interface StoredAutoConfigState {
  revision: number;
  config: Partial<AutoFarmConfig>;
}

export interface AutoConfigProfile {
  cellIndices: number[];
  seedIds: number[];
}

export function readStoredAutoConfig(raw: unknown): StoredAutoConfigState;
export function storedAutoConfigEnvelope(state: StoredAutoConfigState): {
  version: 1;
  revision: number;
  config: Partial<AutoFarmConfig>;
};
export function normalizeAutoConfig(input: unknown): Partial<AutoFarmConfig>;
export function mergeAutoConfig(
  current: Partial<AutoFarmConfig>,
  patch: unknown,
): Partial<AutoFarmConfig>;
export function validateAutoConfigProfile(
  config: Partial<AutoFarmConfig>,
  profile: AutoConfigProfile | null,
): void;
```

- `AutoFarmConfig` gains `treeCellPlan?: TreeCellPlanEntry[]`.
- `normalizeAutoConfig` accepts only the current known keys, requires exact boolean types, finite numeric types, integer non-negative ids, integer species arrays, and sorted unique plan entries. Unknown keys and duplicate cell indices throw Vietnamese validation errors.
- Profile validation is separate from shape normalization so a stored plan remains readable after `gameUser` invalidates the old profile cache.

- [ ] **Step 1: Run GitNexus impact before symbol edits**

Run impacts for `AutoFarmConfig` and `AutoFarm`; record risk/direct callers/processes in the progress update. Do not edit if risk is HIGH/CRITICAL.

- [ ] **Step 2: Write failing config-domain tests**

Create tests equivalent to:

```ts
test('đọc JSON legacy thành revision 0', () => {
  assert.deepEqual(readStoredAutoConfig({ harvest: true, intervalMs: 60_000 }), {
    revision: 0,
    config: { harvest: true, intervalMs: 60_000 },
  });
});

test('đọc envelope v1 và chuẩn hóa plan theo cellIndex', () => {
  const state = readStoredAutoConfig({
    version: 1,
    revision: 4,
    config: {
      treeCellPlan: [
        { cellIndex: 8, action: 'skip' },
        { cellIndex: 2, action: 'seed', seedId: 6 },
      ],
    },
  });
  assert.equal(state.revision, 4);
  assert.deepEqual(state.config.treeCellPlan, [
    { cellIndex: 2, action: 'seed', seedId: 6 },
    { cellIndex: 8, action: 'skip' },
  ]);
});

test('merge patch cũ không xóa treeCellPlan', () => {
  const current = { treeCellPlan: [{ cellIndex: 2, action: 'skip' as const }] };
  assert.deepEqual(mergeAutoConfig(current, { harvest: false }), {
    harvest: false,
    treeCellPlan: [{ cellIndex: 2, action: 'skip' }],
  });
});

test('reject plan trùng index và plan ngoài profile', () => {
  assert.throws(
    () => normalizeAutoConfig({ treeCellPlan: [
      { cellIndex: 1, action: 'skip' },
      { cellIndex: 1, action: 'seed', seedId: 6 },
    ] }),
    /ô 1 bị lặp/,
  );
  assert.throws(
    () => validateAutoConfigProfile(
      normalizeAutoConfig({ treeCellPlan: [{ cellIndex: 9, action: 'seed', seedId: 99 }] }),
      { cellIndices: [0, 1], seedIds: [5, 6] },
    ),
    /ô 9|hạt 99/,
  );
});
```

- [ ] **Step 3: Run tests and confirm red state**

Run from `avatar-web/server`:

```bash
node --import tsx --test src/accounts/autoConfig.test.ts
```

Expected: FAIL because `autoConfig.ts` or its exports do not exist.

- [ ] **Step 4: Implement exact config parser/normalizer**

Implement the interfaces above. Use an explicit key-to-parser table; do not spread arbitrary request objects. `treeCellPlan: []` is a valid explicit clear. `undefined` in a patch means “not supplied”, not “clear”. The envelope reader only recognizes `{ version: 1, revision: integer >= 0, config: object }`; every other object is legacy config revision 0.

- [ ] **Step 5: Run focused tests and typecheck**

```bash
node --import tsx --test src/accounts/autoConfig.test.ts
npm run typecheck
```

Expected: both PASS.

- [ ] **Step 6: Check task diff without committing**

```bash
git diff --check -- \
  avatar-web/server/src/accounts/autoConfig.ts \
  avatar-web/server/src/accounts/autoConfig.test.ts \
  avatar-web/server/src/autoFarm.ts
```

Confirm the existing `REFRESH_AT_END = false` hunk is byte-for-byte preserved.

---

### Task 2: Config persistence and farm-profile cache

**Files:**
- Create: `avatar-web/server/src/accounts/farmProfileRepo.ts`
- Create: `avatar-web/server/src/accounts/farmProfileRepo.test.ts`
- Modify: `avatar-web/server/src/db/schema.sql`
- Modify: `avatar-web/server/src/db/index.test.ts`
- Modify: `avatar-web/server/src/accounts/repo.ts`
- Modify: `avatar-web/server/src/accounts/repo.test.ts`

**Interfaces:**
- Consumes: `StoredAutoConfigState`, `normalizeAutoConfig`, `readStoredAutoConfig`, `storedAutoConfigEnvelope` from Task 1.
- Produces:

```ts
export interface CachedSeed {
  id: number;
  name: string;
  growMinutes: number;
  value: number;
}

export interface FarmProfile {
  farmId: number | null;
  cellIndices: number[];
  seedCatalog: CachedSeed[];
  cellsObservedAt: number | null;
  seedsObservedAt: number | null;
  updatedAt: number | null;
}

export function getFarmProfile(db: Db, accountId: number): FarmProfile;
export function updateFarmCells(
  db: Db, accountId: number, farmId: number, cellIndices: number[], observedAt?: number,
): FarmProfile;
export function updateSeedCatalog(
  db: Db, accountId: number, seeds: CachedSeed[], observedAt?: number,
): FarmProfile;
export function deleteFarmProfile(db: Db, accountId: number): void;

export type SaveAutoConfigResult =
  | { status: 'saved'; state: StoredAutoConfigState }
  | { status: 'conflict'; current: StoredAutoConfigState }
  | { status: 'missing' };

export function getAutoConfig(db: Db, userId: number, id: number): StoredAutoConfigState | null;
export function saveAutoConfig(
  db: Db,
  userId: number,
  id: number,
  expectedRevision: number,
  config: Partial<AutoFarmConfig>,
  now?: number,
): SaveAutoConfigResult;
export function setAutoEnabled(db: Db, id: number, enabled: boolean, now?: number): void;
export function enableAutoWithConfigPatch(
  db: Db,
  userId: number,
  id: number,
  patch: unknown,
  profile: AutoConfigProfile | null,
  now?: number,
): SaveAutoConfigResult;
```

- `AvatarAccount` exposes normalized `autoConfig` plus `autoConfigRevision`; it never exposes the envelope raw JSON.
- For an owned account whose JSON column is null, `getAutoConfig` returns the canonical `{ revision: 0, config: {} }`; it returns `null` only when the owned account does not exist.
- `getFarmProfile` returns an empty typed profile rather than `null` when no cache row exists.

- [ ] **Step 1: Run GitNexus impact**

Run impacts for `setAutoEnabled`, `updateAccount`, `toAccount`, `openDb`, and `createAccount`; report blast radius before edits.

- [ ] **Step 2: Write failing schema/profile/config repository tests**

Add tests equivalent to:

```ts
test('schema tạo bảng cache và FK xoá theo account', () => {
  const { db, account } = setupAccount();
  const tables = db.prepare<[], { name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table'",
  ).all().map((row) => row.name);
  assert.ok(tables.includes('avatar_farm_profile_cache'));
  updateFarmCells(db, account.id, 12, [2, 7], 100);
  db.prepare('DELETE FROM avatar_accounts WHERE id = ?').run(account.id);
  assert.equal(db.prepare(
    'SELECT COUNT(*) AS n FROM avatar_farm_profile_cache WHERE account_id = ?',
  ).get(account.id).n, 0);
  assert.deepEqual(db.pragma('foreign_key_check'), []);
  db.close();
});

test('cell và catalog upsert từng phần không xóa nhau', () => {
  const { db, account } = setupAccount();
  updateFarmCells(db, account.id, 12, [7, 2, 7], 100);
  updateSeedCatalog(db, account.id, [
    { id: 6, name: 'Hoa hồng', growMinutes: 5, value: 10 },
  ], 200);
  assert.deepEqual(getFarmProfile(db, account.id), {
    farmId: 12,
    cellIndices: [2, 7],
    seedCatalog: [{ id: 6, name: 'Hoa hồng', growMinutes: 5, value: 10 }],
    cellsObservedAt: 100,
    seedsObservedAt: 200,
    updatedAt: 200,
  });
});

test('CAS config tăng revision và phát hiện xung đột', () => {
  const { db, user, account } = setupAccount();
  assert.deepEqual(getAutoConfig(db, user.id, account.id), { revision: 0, config: {} });
  const first = saveAutoConfig(db, user.id, account.id, 0, { harvest: true }, 10);
  assert.equal(first.status, 'saved');
  assert.equal(first.status === 'saved' && first.state.revision, 1);
  const stale = saveAutoConfig(db, user.id, account.id, 0, { harvest: false }, 11);
  assert.equal(stale.status, 'conflict');
});

test('tắt auto giữ config và đổi gameUser xóa riêng profile', () => {
  const { db, user, account } = setupAccount();
  saveAutoConfig(db, user.id, account.id, 0, { treeCellPlan: [{ cellIndex: 2, action: 'skip' }] });
  setAutoEnabled(db, account.id, true);
  setAutoEnabled(db, account.id, false);
  updateFarmCells(db, account.id, 1, [2]);
  updateAccount(db, TEST_KEY, user.id, account.id, { gameUser: 'nhan-vat-moi' });
  assert.deepEqual(getFarmProfile(db, account.id).cellIndices, []);
  assert.deepEqual(getAutoConfig(db, user.id, account.id)?.config.treeCellPlan,
    [{ cellIndex: 2, action: 'skip' }]);
});
```

- [ ] **Step 3: Run tests and confirm red state**

```bash
node --import tsx --test \
  src/accounts/farmProfileRepo.test.ts \
  src/accounts/repo.test.ts \
  src/db/index.test.ts
```

Expected: FAIL because table/functions do not exist and old `setAutoEnabled` clears config.

- [ ] **Step 4: Add idempotent schema and focused repositories**

Add the exact table from the spec with `account_id` FK `ON DELETE CASCADE`. Implement partial UPSERTs with `ON CONFLICT(account_id) DO UPDATE` that only mutate their own columns. Normalize cell indices to sorted unique non-negative integers; normalize catalog to unique ids sorted by Vietnamese-safe `name.localeCompare` then id.

Implement config CAS inside one SQLite transaction: read owned account, decode current state, compare revision, update `auto_config_json` with envelope revision + 1, then return decoded state. Refactor `setAutoEnabled` to update only `auto_enabled`/`updated_at`.

Implement `enableAutoWithConfigPatch` as one transaction: read/decode the
owned state, merge and normalize the non-empty legacy patch, validate the
merged config against the supplied latest profile, persist envelope revision
+ 1, and set `auto_enabled = 1`. Validation failure rolls back the entire
transaction. An empty start body uses `setAutoEnabled` and leaves revision
unchanged.

Wrap `updateAccount` SQL plus conditional `deleteFarmProfile` in one transaction when the normalized `gameUser` actually changes. Keep password encryption behavior unchanged.

- [ ] **Step 5: Run focused tests and server typecheck**

```bash
node --import tsx --test \
  src/accounts/farmProfileRepo.test.ts \
  src/accounts/repo.test.ts \
  src/db/index.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Check diff without committing**

```bash
git diff --check -- \
  avatar-web/server/src/db/schema.sql \
  avatar-web/server/src/db/index.test.ts \
  avatar-web/server/src/accounts/repo.ts \
  avatar-web/server/src/accounts/repo.test.ts \
  avatar-web/server/src/accounts/farmProfileRepo.ts \
  avatar-web/server/src/accounts/farmProfileRepo.test.ts
```

---

### Task 3: AutoFarm plan execution and cycle-boundary config

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts`
- Modify: `avatar-web/server/src/autoFarm.test.ts`

**Interfaces:**
- Consumes: `TreeCellPlanEntry` and normalized `Partial<AutoFarmConfig>` from Task 1.
- Produces:

```ts
class AutoFarm extends EventEmitter {
  start(cfg: Partial<AutoFarmConfig>): void;
  queueConfig(cfg: Partial<AutoFarmConfig>): void;
  stop(): void;
}
```

- The constructor consumes an exported minimal `AutoFarmClient` structural
  interface containing only the state/events/farm commands the engine uses;
  production `GameClient` satisfies it and tests instantiate `FakeClient`
  without `as unknown` or another type-erasing assertion.

- `queueConfig` validates basic runtime constraints but does not stop/reset timer/cycle.
- `runCycle` swaps pending at its first synchronous line and captures one immutable `cfg` for the whole cycle.

- [ ] **Step 1: Run GitNexus impacts**

Run impacts for `AutoFarm`, `AutoFarm.start`, and `AutoFarm.runCycle`; report direct callers/processes. Preserve the user diagnostic hunk at the end of `runCycle`.

- [ ] **Step 2: Write failing runtime tests**

Extend `FakeClient` to record `plantSeed:${cellIndex}:${seedId}`, expose `trees`, and seed inventory. Add tests equivalent to:

```ts
test('override, fallback và skip chọn đúng hành động cho ô trống', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [cell(2, { idTree: -1 }), cell(7, { idTree: -1 }), cell(9, { idTree: -1 })],
    animals: [], updatedAt: 0,
  });
  client.trees = [tree(5), tree(6)];
  client.inventory = [{ id: 5, num: 2 }, { id: 6, num: 2 }];
  const auto = new AutoFarm(client);
  await runOneCycle(auto, {
    seedId: 5,
    treeCellPlan: [
      { cellIndex: 2, action: 'seed', seedId: 6 },
      { cellIndex: 7, action: 'skip' },
    ],
    startDelayMs: 0,
  });
  assert.ok(client.calls.includes('plantSeed:2:6'));
  assert.ok(!client.calls.some((call) => call.startsWith('plantSeed:7:')));
  assert.ok(client.calls.includes('plantSeed:9:5'));
});

test('không thay cây đang mọc và không trồng khi thiếu hạt', async () => {
  // Một ô có idTree != -1 và hai ô trống nhưng kho chỉ có một hạt.
  // Kỳ vọng đúng một plantSeed, không auto-buy, log ô còn lại là thiếu hạt.
});

test('config queue giữa vòng chỉ áp từ vòng kế tiếp', async () => {
  // Chặn tick sau ô đầu, gọi queueConfig(), thả tick.
  // Kỳ vọng các ô còn lại vòng 1 dùng seed cũ; vòng 2 dùng seed mới.
});

test('seed ngoài catalog bị bỏ qua và ghi lý do', async () => {
  // Override seedId 99 while catalog contains only 5/6.
  // Assert no plantSeed uses 99 and lastActions names the invalid cell/seed.
});

test('catalog rỗng được tải đúng một lần trước khi trồng', async () => {
  // Fake getTreeInfo emits a complete `trees` event; assert one request and plant.
});

test('catalog timeout không trồng mù', async () => {
  // Fake getTreeInfo emits nothing with an injected deterministic timeout seam;
  // assert no plantSeed and a timeout/unknown-catalog log.
});
```

For the two expanded tests, implement deterministic deferred promises in the fake clock; do not use arbitrary sleep durations.

- [ ] **Step 3: Run focused test and confirm red state**

```bash
node --import tsx --test src/autoFarm.test.ts
```

Expected: new tests FAIL because `treeCellPlan`/`queueConfig` do not exist or old seed selection ignores them.

- [ ] **Step 4: Implement active/pending config and safe seed selection**

Refactor config creation into one private validator used by `start` and `queueConfig`. At the first synchronous statements of `runCycle`, take pending config and assign:

```ts
if (this.pendingConfig) {
  this.activeConfig = this.pendingConfig;
  this.pendingConfig = undefined;
}
const cfg = this.activeConfig;
```

Do not reference mutable config again in that cycle.

Before plan-based planting, if a seed is configured and `client.trees` is empty, call existing `getTreeInfo`, await the existing `trees` event once with a five-second timeout, and continue only with the catalog actually received. This covers server restart where DB cache exists but the new in-memory `GameClient` has no catalog.

Build `planByCell` once per cycle. For every empty cell, resolve `skip`, override seed or default seed. Reject seed not present in `client.trees`; use a local inventory-count map, decrement immediately after each `plantSeed`, and log a Vietnamese reason for unknown/empty inventory. Do not call `buyItem` from this path.

- [ ] **Step 5: Run focused tests and typecheck**

```bash
node --import tsx --test src/autoFarm.test.ts
npm run typecheck
```

Expected: PASS. Existing auto-farm order/delay/log tests remain green.

- [ ] **Step 6: Verify diagnostic hunk preservation and diff**

```bash
git diff --check -- avatar-web/server/src/autoFarm.ts avatar-web/server/src/autoFarm.test.ts
git diff -- avatar-web/server/src/autoFarm.ts
```

Visually confirm `REFRESH_AT_END = false` and its diagnostic comment are unchanged.

---

### Task 4: Session lifecycle, profile observation and refresh

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`
- Modify: `avatar-web/server/src/session/avatarSession.test.ts`
- Modify: `avatar-web/server/src/session/manager.ts`
- Modify: `avatar-web/server/src/session/manager.test.ts`

**Interfaces:**
- Consumes: `AutoFarm.queueConfig` from Task 3; profile/config repositories from Task 2.
- Produces:

```ts
class AvatarSession {
  updateAutoConfig(cfg: Partial<AutoFarmConfig>): 'next-cycle' | 'next-start';
  refreshFarmProfile(timeoutMs?: number): Promise<void>;
}
```

- `updateAutoConfig` always updates `lastAutoConfig`; if auto is running it calls `queueConfig` and returns `next-cycle`, otherwise `next-start`.
- `SessionManager` persists `farm` and `trees` payloads synchronously before broadcasting the same event.

- [ ] **Step 1: Run GitNexus impacts**

Run impacts for `AvatarSession`, `AvatarSession.startAuto`, `AvatarSession.wire`, `SessionManager`, and `SessionManager.getOrCreate`. Report blast radius. Do not alter the `pushLog` diagnostic line.

- [ ] **Step 2: Write failing session/manager tests**

Add exact behavioral tests:

```ts
test('update config khi auto chạy queue cho vòng kế tiếp, không start lại', async () => {
  const h = harness({ autoEnabled: true, autoConfig: { seedId: 5 } });
  await h.session.start();
  assert.equal(h.session.updateAutoConfig({ seedId: 6 }), 'next-cycle');
  assert.equal(h.autos[0].startCount, 1);
  assert.deepEqual(h.autos[0].queued.at(-1), { seedId: 6 });
});

test('refresh chờ farm trước rồi mới xin catalog và cleanup listener', async () => {
  const h = harness();
  await h.session.start();
  const refresh = h.session.refreshFarmProfile(1_000);
  assert.deepEqual(h.clients[0].calls, ['enterFarm']);
  h.clients[0].emit('farm', { idFarm: 1, cells: [], animals: [], updatedAt: 1 });
  assert.deepEqual(h.clients[0].calls, ['enterFarm', 'getTreeInfo']);
  h.clients[0].emit('trees', { trees: [], items: [], animals: [] });
  await refresh;
  assert.equal(h.clients[0].listenerCount('farm'), 1); // listener wire chính còn lại
});

test('manager ghi cache trước khi broadcast farm và trees', async () => {
  // Emit qua opts.onEvent của FakeSession; callback broadcast đọc DB và phải
  // thấy cache mới trong cùng call stack.
});

test('permanent failure chỉ tắt cờ, giữ config envelope', async () => {
  // Lưu config, kích onPermanentFailure, kiểm tra autoEnabled false và config còn.
});

test('bootstrap unwrap envelope và giữ nguyên treeCellPlan khi start auto', async () => {
  // Persist an enabled version-1 envelope, bootstrap manager, then assert the
  // created session receives config.treeCellPlan rather than the envelope/raw JSON.
});
```

The timeout test uses injected `setTimeoutFn`/`clearTimeoutFn`; it asserts rejection includes `quá hạn đồng bộ farm` and that only refresh-owned listeners are removed.

- [ ] **Step 3: Run tests and confirm red state**

```bash
node --import tsx --test \
  src/session/avatarSession.test.ts \
  src/session/manager.test.ts
```

Expected: FAIL because queue/refresh/cache persistence and config-retention behavior do not exist.

- [ ] **Step 4: Implement session boundary and synchronous cache hook**

Add `FakeAuto.queueConfig` in tests and real `AutoFarm.queueConfig` usage in session. `refreshFarmProfile` must:

1. require current online client;
2. register only its own `once` listeners before sending;
3. call `enterFarm` and wait for `farm`;
4. call `client.farm.getTreeInfo` and wait for `trees`;
5. reject on one bounded timeout;
6. clear only its timer/listeners in `finally`;
7. reject if the session client/epoch changes mid-refresh.

In `SessionManager.getOrCreate`, wrap `onEvent` so `farm` calls `updateFarmCells`, `trees` calls `updateSeedCatalog`, and only then invokes `broadcast`. Project only the typed fields from payload; ignore malformed payload without crashing the session.

Change permanent failure to `setAutoEnabled(db, accountId, false)` only. Credentials continue to unwrap stored config state for bootstrap/reconnect.

- [ ] **Step 5: Run tests and typecheck**

```bash
node --import tsx --test \
  src/session/avatarSession.test.ts \
  src/session/manager.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Verify diagnostic hunk and diff**

```bash
git diff --check -- \
  avatar-web/server/src/session/avatarSession.ts \
  avatar-web/server/src/session/avatarSession.test.ts \
  avatar-web/server/src/session/manager.ts \
  avatar-web/server/src/session/manager.test.ts
git diff -- avatar-web/server/src/session/avatarSession.ts
```

Confirm the existing `console.log` inside `pushLog` remains unchanged.

---

### Task 5: Authenticated config/profile routes and start/stop compatibility

**Files:**
- Modify: `avatar-web/server/src/session/routes.ts`
- Modify: `avatar-web/server/src/session/routes.test.ts`

**Interfaces:**
- Consumes: config/profile repositories, validation and `AvatarSession.updateAutoConfig`/`refreshFarmProfile`.
- Produces HTTP contracts from the spec:

```text
GET  /api/accounts/:id/auto/config
PUT  /api/accounts/:id/auto/config
GET  /api/accounts/:id/farm/profile
POST /api/accounts/:id/farm/profile/refresh
POST /api/accounts/:id/auto/start
POST /api/accounts/:id/auto/stop
```

- [ ] **Step 1: Run GitNexus impacts**

Run impact for `sessionRouter`, `fail`, `requireOwnedAccount`, and API impact for each affected route prefix if GitNexus route data is available. Report risk/consumers.

- [ ] **Step 2: Write failing route tests**

Extend `FakeSession` with `updateAutoConfig`, `refreshFarmProfile`, and a configurable snapshot auto state. Add tests:

```ts
test('GET/PUT config dùng revision và queue sau khi DB đã ghi', async () => {
  const { db, server, made, id } = await setup();
  const empty = await server.fetch(`/api/accounts/${id}/auto/config`);
  assert.deepEqual(empty.body, { revision: 0, config: {} });
  await seedProfile(db, id);
  await server.fetch(`/api/accounts/${id}/connect`, { method: 'POST' });
  const put = await server.fetch(`/api/accounts/${id}/auto/config`, {
    method: 'PUT',
    json: { expectedRevision: 0, config: {
      treeCellPlan: [{ cellIndex: 2, action: 'seed', seedId: 6 }],
    } },
  });
  assert.equal(put.status, 200);
  assert.equal(put.body.application, 'next-cycle');
  assert.deepEqual(made[0].calls.at(-1)?.name, 'updateAutoConfig');
  assert.equal((await server.fetch(`/api/accounts/${id}/auto/config`)).body.revision, 1);
});

test('revision cũ trả 409 kèm current, không queue runtime', async () => {
  // Save revision 1, then PUT expectedRevision 0 and assert
  // code='revision-conflict', current.revision=1, and no runtime queue.
});

test('start body cũ merge không xóa plan, stop giữ config', async () => {
  // Save plan at revision 1, POST start { harvest:false } atomically creates
  // revision 2, POST stop, GET config keeps both. A PUT with expectedRevision 1
  // then returns 409 current.revision === 2 and does not queue runtime.
});

test('payload config sai trả 400 và không mutate DB/runtime', async () => {
  // Cover malformed expectedRevision and unknown config key.
});

test('plan thiếu profile trả 409, plan lệch profile trả danh sách lỗi 400', async () => {
  // Exercise both PUT and legacy start. No cell cache + nonempty plan => 409
  // code=farm-profile-required. Cells but no catalog accepts skip-only/empty
  // plans but rejects seed entries with 409 code=seed-catalog-required.
  // Existing complete cache with invalid cell/seed => 400
  // code=invalid-tree-cell-plan plus exact invalidCellIndices/invalidSeedIds.
  // In every rejected case assert DB config/revision/autoEnabled and runtime
  // calls remain unchanged.
});

test('refresh offline 409, timeout 504, online trả profile vừa persist', async () => {
  // Exercise three FakeSession outcomes without mutation endpoint shortcuts.
});
```

Extend the existing “không điều khiển được phiên của người khác” loop to cover all four new routes with correct GET/PUT/POST methods.

- [ ] **Step 3: Run route tests and confirm red state**

```bash
node --import tsx --test src/session/routes.test.ts
```

Expected: FAIL with 404/missing methods and old stop clearing config.

- [ ] **Step 4: Implement routes in ownership-safe order**

For PUT config:

1. parse integer `expectedRevision` and normalize the full config;
2. read latest farm profile and validate plan;
3. execute CAS save;
4. on conflict return `409 { error, code: 'revision-conflict', current }`;
5. after successful DB write call `sessions.peek(id)?.updateAutoConfig(state.config)`;
6. return `application = next-cycle` only if session reported it, otherwise `next-start`.

For profile refresh, call session and map “chưa kết nối” to 409 and timeout marker to 504; then read the cache after promise resolves. Map malformed `expectedRevision` and invalid config shape to 400 without mutating DB/runtime. For either PUT or legacy start, a nonempty plan without cell indices returns `409 { code: 'farm-profile-required' }`; with cells but no catalog, skip-only or empty plans are valid while any seed entry returns `409 { code: 'seed-catalog-required' }`; with a complete profile, bad cells/seeds return `400 { code: 'invalid-tree-cell-plan', invalidCellIndices, invalidSeedIds }`. For legacy start, distinguish empty body from patch body: a non-empty patch reads the latest profile and uses the repository transaction that validates the merged config, persists envelope revision + 1 and enables auto atomically; an empty body only enables and does not bump revision. Then start runtime with the resulting stored config. `auto/stop` toggles only enable state.

- [ ] **Step 5: Run focused backend suite and typecheck**

```bash
node --import tsx --test \
  src/accounts/autoConfig.test.ts \
  src/accounts/farmProfileRepo.test.ts \
  src/accounts/repo.test.ts \
  src/db/index.test.ts \
  src/session/avatarSession.test.ts \
  src/session/manager.test.ts \
  src/session/routes.test.ts \
  src/autoFarm.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Check diff without committing**

```bash
git diff --check -- avatar-web/server/src/session/routes.ts avatar-web/server/src/session/routes.test.ts
```

---

### Task 6: Frontend API/types and pure editor state

**Files:**
- Modify: `avatar-web/web/src/api.ts`
- Modify: `avatar-web/web/src/types.ts`
- Create: `avatar-web/web/src/accounts/treeCellPlan.ts`
- Create: `avatar-web/web/src/accounts/treeCellPlan.test.ts`

**Interfaces:**
- Produces:

```ts
export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly body?: unknown);
}
export const apiPut: <T>(path: string, body: unknown) => Promise<T>;

export type TreeCellPlanEntry =
  | { cellIndex: number; action: 'seed'; seedId: number }
  | { cellIndex: number; action: 'skip' };
export interface AutoFarmConfigDto {
  seedId?: number;
  waterItemId?: number;
  grassItemId?: number;
  wormItemId?: number;
  harvest: boolean;
  harvestAnimals: boolean;
  sellAnimals: boolean;
  sellWhenGrownSpecies: number[];
  sellNearDeathSpecies: number[];
  minGrowthToSell: number;
  nearDeathRatio: number;
  maxSellsPerCycle: number;
  feedAnimals: boolean;
  healAnimals: boolean;
  minHealth: number;
  fertilizeCells: boolean;
  minVitality: number;
  autoBuy: boolean;
  buyBudgetXu: number;
  maxBuyPerItem: number;
  stepDelayMs: number;
  intervalMs: number;
  startDelayMs: number;
  treeCellPlan: TreeCellPlanEntry[];
}
export interface CachedSeedDto {
  id: number;
  name: string;
  growMinutes: number;
  value: number;
}
export interface AutoConfigResponse { revision: number; config: Partial<AutoFarmConfigDto>; application?: 'next-cycle' | 'next-start' }
export interface FarmProfileDto { farmId: number | null; cellIndices: number[]; seedCatalog: CachedSeedDto[]; cellsObservedAt: number | null; seedsObservedAt: number | null; updatedAt: number | null }

export type TreePaint = { kind: 'default' } | { kind: 'skip' } | { kind: 'seed'; seedId: number };
export function applyTreePaint(entries: TreeCellPlanEntry[], cellIndex: number, paint: TreePaint): TreeCellPlanEntry[];
export function summarizeTreePlan(cellIndices: number[], entries: TreeCellPlanEntry[]): { defaults: number; skipped: number; seeds: Map<number, number> };
export function invalidTreePlanEntries(profile: FarmProfileDto, entries: TreeCellPlanEntry[]): TreeCellPlanEntry[];
```

- [ ] **Step 1: Run GitNexus impacts**

Run impact for `ApiError`, `request`, and frontend `AutoFarmPanel`; record call sites before extending API/type contracts.

- [ ] **Step 2: Write failing reducer/API tests**

Add reducer tests:

```ts
test('default xóa override, skip và seed thay thế đúng một cell', () => {
  let plan: TreeCellPlanEntry[] = [];
  plan = applyTreePaint(plan, 7, { kind: 'seed', seedId: 6 });
  plan = applyTreePaint(plan, 7, { kind: 'skip' });
  expect(plan).toEqual([{ cellIndex: 7, action: 'skip' }]);
  plan = applyTreePaint(plan, 7, { kind: 'default' });
  expect(plan).toEqual([]);
});

test('summary dùng cell index thật, kể cả không liên tục', () => {
  const result = summarizeTreePlan(
    [2, 7, 9],
    [{ cellIndex: 2, action: 'seed', seedId: 6 }, { cellIndex: 7, action: 'skip' }],
  );
  expect(result.defaults).toBe(1);
  expect(result.skipped).toBe(1);
  expect([...result.seeds]).toEqual([[6, 1]]);
});
```

Add or extend an API unit test if one exists; otherwise exercise `ApiError.body` through the component conflict test in Task 7 and keep Task 6 focused on compile + reducer.

- [ ] **Step 3: Run tests and confirm red state**

```bash
npm test -- --run src/accounts/treeCellPlan.test.ts
```

Expected: FAIL because module/functions do not exist.

- [ ] **Step 4: Implement DTOs, `apiPut`, and immutable reducer**

Pass parsed response data into `new ApiError(status, message, data)`. Implement `applyTreePaint` with a `Map` internally and return sorted entries. Summary only counts indices present in `cellIndices`; invalid analysis marks unknown cell index or seed id absent from catalog and never silently rewrites the plan.

- [ ] **Step 5: Run focused tests and web build type stage**

```bash
npm test -- --run src/accounts/treeCellPlan.test.ts
npx tsc -b --pretty false
```

Expected: PASS.

- [ ] **Step 6: Check diff without committing**

```bash
git diff --check -- \
  avatar-web/web/src/api.ts \
  avatar-web/web/src/types.ts \
  avatar-web/web/src/accounts/treeCellPlan.ts \
  avatar-web/web/src/accounts/treeCellPlan.test.ts
```

---

### Task 7: Tree plan editor, AutoFarm hydration and drawer dirty guard

**Files:**
- Create: `avatar-web/web/src/accounts/TreeCellPlanEditor.tsx`
- Create: `avatar-web/web/src/accounts/TreeCellPlanEditor.test.tsx`
- Modify: `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx`
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`
- Modify: `avatar-web/web/src/accounts/accountsRoutes.test.tsx`
- Modify: `avatar-web/web/src/styles.css`

**Interfaces:**
- Consumes: DTOs/API/reducer from Task 6.
- Produces:

```ts
interface TreeCellPlanEditorProps {
  profile: FarmProfileDto;
  entries: TreeCellPlanEntry[];
  disabled: boolean;
  refreshing: boolean;
  onChange(entries: TreeCellPlanEntry[]): void;
  onRefresh(): void;
}

interface AutoFarmPanelProps {
  accountId: number;
  auto: AutoState;
  items: ItemInfo[];
  onPlanDirtyChange?(dirty: boolean): void;
}
```

- [ ] **Step 1: Run GitNexus impacts**

Run impact for `AutoFarmPanel`, `AccountOperationsDrawer`, `LoadedOperations`, and `useDialogFocus`. Report blast radius before editing.

- [ ] **Step 2: Write failing editor interaction tests**

Create component tests equivalent to:

```tsx
test('click và keyboard áp palette đang chọn', async () => {
  const onChange = vi.fn();
  render(<TreeCellPlanEditor profile={profile([2, 7])} entries={[]} disabled={false}
    refreshing={false} onChange={onChange} onRefresh={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: /Hoa hồng/ }));
  await userEvent.click(screen.getByRole('button', { name: /Ô 2/ }));
  expect(onChange).toHaveBeenLastCalledWith([{ cellIndex: 2, action: 'seed', seedId: 6 }]);
  screen.getByRole('button', { name: /Ô 7/ }).focus();
  await userEvent.keyboard('{Enter}');
  expect(onChange).toHaveBeenLastCalledWith([{ cellIndex: 7, action: 'seed', seedId: 6 }]);
});

test('pointer paint tô nhiều ô và Không trồng tạo skip', () => {
  // pointerDown ô 2, pointerOver ô 7/9, pointerUp; rerender controlled value;
  // expect sorted three entries with the selected paint.
});

test('không có profile khóa editor; cache đủ cho phép sửa offline và hiện timestamp', () => {
  // Empty cellIndices => disabled guidance. Cells with empty catalog still
  // allow Default/Skip but expose no enabled seed choice. Complete cache enables all.
});
```

Extend route tests to mock config/profile GET calls and verify dirty close:

```tsx
test('Escape hỏi xác nhận khi plan bẩn và chỉ đóng khi đồng ý', async () => {
  vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  renderRoute('/accounts/1');
  // select skip + click a cell, press Escape twice;
  // first remains /accounts/1, second becomes /accounts.
});

test('mọi lối thoát drawer cùng chặn plan bẩn', async () => {
  // Table-driven rerenders for close button, backdrop and Debug link:
  // confirm false keeps /accounts/1; confirm true performs the requested exit.
});

test('plan bẩn đăng ký beforeunload và plan sạch gỡ listener', async () => {
  // Dispatch cancelable beforeunload: dirty event is prevented/sets returnValue;
  // save or restore clean state, dispatch again and assert it is not prevented.
});

test('409 được phân loại theo code và luôn giữ draft local', async () => {
  // revision-conflict with body.current offers Tải bản máy chủ;
  // farm-profile-required shows Kết nối và đồng bộ farm;
  // seed-catalog-required explains catalog must be refreshed and offers refresh.
  // Neither profile/catalog case reads a missing current or replaces the draft.
});
```

- [ ] **Step 3: Run component tests and confirm red state**

```bash
npm test -- --run \
  src/accounts/TreeCellPlanEditor.test.tsx \
  src/accounts/accountsRoutes.test.tsx
```

Expected: FAIL because editor/API calls/dirty guard do not exist.

- [ ] **Step 4: Implement accessible pointer editor**

Use `<details>` inside the current card. Palette entries and cells are native buttons with `aria-pressed`/descriptive labels. Pointer painting uses one component-level `painting` flag plus bubbling `onPointerOver` on the grid; `window.pointerup`/`pointercancel` ends painting. Normal `onClick` applies paint for keyboard and single-click users. Prevent duplicate `onChange` if a cell already has the chosen state.

Render exact cache states:

- no `cellIndices`: locked guidance + refresh button;
- cells but no catalog: show plan/id values, enable Default/Skip, disable new seed choices;
- complete cache: full palette/editor;
- invalid entries: visible warning and per-cell invalid class;
- always show observed timestamps as cached, never “live”.

- [ ] **Step 5: Hydrate/save in `AutoFarmPanel`**

On account change, fetch config and profile in parallel. Use a request generation/ref cleanup so a late response from the previous account cannot overwrite the new drawer.

Hydrate every existing form control from stored config with the same current defaults when a field is absent. Keep `storedConfig`, `revision`, and `draftPlan` separately. Dirty means only `draftPlan` differs structurally from `storedConfig.treeCellPlan`.

**Lưu kế hoạch** PUTs:

```ts
{
  expectedRevision: revision,
  config: { ...storedConfig, treeCellPlan: draftPlan },
}
```

On success replace stored config/revision and clear dirty; show the server `application` message. On `ApiError.status === 409`, always keep the draft and branch on `body.code`: only `revision-conflict` stores/displays `body.current` and offers a **Tải bản máy chủ** button; `farm-profile-required` shows **Kết nối và đồng bộ farm** guidance; `seed-catalog-required` explains that catalog must be refreshed and offers the existing refresh action. Never read `body.current` for the two profile/cache errors, and never replace the draft automatically.

`Bật` sends the current legacy form patch to `auto/start`; server merge preserves the saved plan. `Tắt` sends no config. Refresh calls the profile endpoint and replaces the displayed cache with its response.

- [ ] **Step 6: Implement drawer dirty guard**

Lift dirty state to `AccountOperationsDrawer`. Route every drawer-controlled exit through:

```ts
const canLeave = () => !planDirty || window.confirm('Kế hoạch cây chưa lưu. Bỏ thay đổi?');
```

Use it for close button, backdrop, Escape callback and Debug link. Add `beforeunload` while dirty for tab close/reload. Preserve existing focus trap and focus return. Do not refactor routing architecture.

- [ ] **Step 7: Add responsive styles**

Add root-scoped classes `.tree-plan-*`. Desktop grid uses 8 columns; at the existing mobile breakpoint reduce to 4 columns. Selected/default/skip/invalid states pair color with text/icon and focus outline; do not rely on color alone. Keep the drawer at its existing width and avoid horizontal scrolling.

- [ ] **Step 8: Run focused web tests and build**

```bash
npm test -- --run \
  src/accounts/treeCellPlan.test.ts \
  src/accounts/TreeCellPlanEditor.test.tsx \
  src/accounts/accountsRoutes.test.tsx
npm test
npm run build
```

Expected: all PASS and Vite production build succeeds.

- [ ] **Step 9: Check frontend diff without committing**

```bash
git diff --check -- avatar-web/web
```

---

### Task 8: Full regression, change detection and runtime-limited QA

**Files:**
- Review all task files; modify only to fix verified failures.
- Do not commit.

**Interfaces:**
- Consumes the complete feature.
- Produces evidence for every completion criterion; no new behavior.

- [ ] **Step 1: Read verification skill before completion claims**

Invoke `superpowers:verification-before-completion` and follow it exactly.

- [ ] **Step 2: Run full server verification**

From `avatar-web/server`:

```bash
node --import tsx --test \
  src/accounts/autoConfig.test.ts \
  src/accounts/farmProfileRepo.test.ts \
  src/accounts/repo.test.ts \
  src/db/index.test.ts \
  src/session/manager.test.ts \
  src/session/avatarSession.test.ts \
  src/session/routes.test.ts \
  src/autoFarm.test.ts
npm test
npm run typecheck
npm run build
```

Record counts and exit codes. A build-only pass is not a test pass.

- [ ] **Step 3: Run full web verification**

From `avatar-web/web`:

```bash
npm test
npm run build
```

Record Vitest counts and build exit code separately.

- [ ] **Step 4: Static hygiene and scope audit**

From repo root:

```bash
git diff --check
git status --short
git diff --stat
rg -n 'TBD|TODO|FIXME|@ts-ignore|\bany\b' \
  avatar-web/server/src/accounts/autoConfig.ts \
  avatar-web/server/src/accounts/farmProfileRepo.ts \
  avatar-web/web/src/accounts/treeCellPlan.ts \
  avatar-web/web/src/accounts/TreeCellPlanEditor.tsx
```

Review the complete diff against the spec. Confirm no animal/cook/shop/fish/NPC/bulk code, no password/log leakage, no hard-coded 48, and no accidental changes to dirty diagnostic hunks.

- [ ] **Step 5: Run GitNexus change detection**

Run:

```text
detect_changes({ repo: "learning-reverse", scope: "all" })
```

Compare affected symbols/processes with the expected route → repo → session → AutoFarm → drawer flow. If HIGH/CRITICAL or unexpected flows appear, investigate before completion.

- [ ] **Step 6: Browser QA if a local browser is available**

Start server/web with writable cache/environment and verify:

1. account with no cache shows locked editor;
2. refresh populates real cell count/catalog;
3. click, keyboard and pointer paint work at desktop and mobile widths;
4. save while auto off says next start;
5. save while auto on says next cycle without resetting cycle/session;
6. Escape/backdrop/Debug link warn when dirty;
7. reload restores plan and cache timestamps;
8. conflict between two tabs preserves local draft.

If Browser remains unavailable, report UI/runtime QA as unverified; do not infer it from unit tests.

- [ ] **Step 7: Completion audit against spec**

Build a requirement-by-requirement checklist from spec sections 2, 3, 7, 8, 9, 11 and 13. Point each achieved item to current code and a test/command/manual observation. Anything without direct evidence remains incomplete and must be fixed or reported, not silently accepted.
