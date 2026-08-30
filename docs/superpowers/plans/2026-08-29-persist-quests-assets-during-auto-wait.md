# Snapshot Nhiệm Vụ & Tài Sản Khi Auto Farm Chờ Vòng Kế Tiếp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Giữ dữ liệu nhiệm vụ và tài sản farm hiển thị trên avatar-web trong khoảng chờ giữa hai vòng auto, kể cả sau F5/restart server.

**Architecture:** Thêm bảng `avatar_runtime_snapshot_cache` lưu snapshot runtime versioned; `SessionManager` ghi DB trước khi broadcast; `AvatarSession` giữ in-memory cache và fallback khi không có client online; khi `gameUser` thay đổi thì xoá cache cũ.

**Tech Stack:** SQLite (`better-sqlite3`), TypeScript NodeNext, Express + WebSocket, GitNexus.

**Spec:** `docs/superpowers/specs/2026-08-29-persist-quests-assets-during-auto-wait-design.md`

## Global Constraints

- Không thay đổi `GameClient` decoder, API/WebSocket contract hoặc hành vi logout giữa vòng auto.
- Không viết test mới trừ khi user yêu cầu; chỉ chạy typecheck và suite hiện có.
- Không tự `git commit`; khi cần commit phải được user xác nhận.
- GitNexus hiện báo CRITICAL cho `AvatarSession.getQuestOverview()` và `AvatarSession.wire()`: mọi thay đổi chỉ là additive fallback, phải giữ nguyên output shape và chạy full server suite.
- Trước khi sửa bất kỳ symbol nào, chạy `npx gitnexus impact -r learning-reverse <symbol> -f <file> --kind <kind> -d upstream --summary-only` và ghi nhận risk.
- Mỗi task kết thúc bằng `npm run typecheck` (server/workdir `avatar-web/server`); chỉ sang task sau khi sạch.

---

### Task 1: Runtime cache contract + DB schema

**Files:**
- Create: `avatar-web/server/src/session/runtimeCache.ts`
- Modify: `avatar-web/server/src/db/schema.sql` (sau bảng `avatar_shop_cache`, dòng ~68)

**Interfaces:**
- Consumes: `FarmState`, `CookingState`, `InventoryItem`, `TreeInfo`, `ItemInfo`, `AnimalInfo`, `FoodRecipe`, `QuestOverviewState` từ `../game/farmData.js`.
- Produces: `CachedRuntimeSnapshot`, `RuntimeSnapshotPatch`, `emptyRuntimeSnapshot()`, `runtimeSnapshotPatchFromEvent()`.

- [x] **Step 1: Tạo `runtimeCache.ts`**

```ts
import type {
  AnimalInfo,
  CookingState,
  FarmState,
  FoodRecipe,
  InventoryItem,
  ItemInfo,
  QuestOverviewState,
  TreeInfo,
} from '../game/farmData.js';

export interface CachedRuntimeSnapshot {
  quests: QuestOverviewState | null;
  farm: FarmState | null;
  inventory: InventoryItem[];
  farmProduce: InventoryItem[];
  cookingMaterials: InventoryItem[];
  trees: TreeInfo[];
  items: ItemInfo[];
  animals: AnimalInfo[];
  foods: FoodRecipe[];
  cooking: CookingState | null;
  capturedAt: number | null;
}

export type RuntimeSnapshotPatch = Partial<Omit<CachedRuntimeSnapshot, 'capturedAt'>>;

export function emptyRuntimeSnapshot(): CachedRuntimeSnapshot {
  return {
    quests: null,
    farm: null,
    inventory: [],
    farmProduce: [],
    cookingMaterials: [],
    trees: [],
    items: [],
    animals: [],
    foods: [],
    cooking: null,
    capturedAt: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function runtimeSnapshotPatchFromEvent(
  type: string,
  payload: unknown,
): RuntimeSnapshotPatch | null {
  switch (type) {
    case 'farm':
      return isRecord(payload) ? { farm: payload as unknown as FarmState } : null;
    case 'inventory':
      return Array.isArray(payload) ? { inventory: payload as InventoryItem[] } : null;
    case 'farm-produce':
      return Array.isArray(payload) ? { farmProduce: payload as InventoryItem[] } : null;
    case 'cooking-materials':
      return Array.isArray(payload) ? { cookingMaterials: payload as InventoryItem[] } : null;
    case 'cooking':
      return isRecord(payload) ? { cooking: payload as unknown as CookingState } : null;
    case 'quests':
      return isRecord(payload) ? { quests: payload as unknown as QuestOverviewState } : null;
    case 'trees': {
      if (!isRecord(payload)) return null;
      const patch: RuntimeSnapshotPatch = {};
      if (Array.isArray(payload.trees)) patch.trees = payload.trees as TreeInfo[];
      if (Array.isArray(payload.items)) patch.items = payload.items as ItemInfo[];
      if (Array.isArray(payload.animals)) patch.animals = payload.animals as AnimalInfo[];
      if (Array.isArray(payload.foods)) patch.foods = payload.foods as FoodRecipe[];
      return Object.keys(patch).length > 0 ? patch : null;
    }
    default:
      return null;
  }
}
```

- [x] **Step 2: Thêm bảng vào `schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS avatar_runtime_snapshot_cache (
  account_id  INTEGER PRIMARY KEY
              REFERENCES avatar_accounts(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  captured_at  INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
```

- [x] **Step 3: Verify**

Run: `npm run typecheck` (workdir `avatar-web/server`)
Expected: Typecheck sạch.

---

### Task 2: Runtime snapshot repository

**Files:**
- Create: `avatar-web/server/src/accounts/runtimeSnapshotRepo.ts`

**Interfaces:**
- Consumes: `Db`, `emptyRuntimeSnapshot`, `CachedRuntimeSnapshot`, `RuntimeSnapshotPatch`.
- Produces: `readRuntimeSnapshotCache`, `saveRuntimeSnapshotCache`, `deleteRuntimeSnapshotCache`.

- [x] **Step 1: Tạo repository**

```ts
import type { Db } from '../db/index.js';
import {
  emptyRuntimeSnapshot,
  type CachedRuntimeSnapshot,
  type RuntimeSnapshotPatch,
} from '../session/runtimeCache.js';

const CACHE_VERSION = 1;

interface CacheRow {
  payload_json: string | null;
  captured_at: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readRuntimeSnapshotCache(
  db: Db,
  accountId: number,
): CachedRuntimeSnapshot {
  const row = db
    .prepare<[number], CacheRow>(
      `SELECT payload_json, captured_at
         FROM avatar_runtime_snapshot_cache
        WHERE account_id = ?`,
    )
    .get(accountId);
  if (!row || !row.payload_json) return emptyRuntimeSnapshot();

  try {
    const value = JSON.parse(row.payload_json) as unknown;
    if (!isRecord(value) || value.version !== CACHE_VERSION) return emptyRuntimeSnapshot();
    const cache = emptyRuntimeSnapshot();
    const data = value as Record<string, unknown>;
    if (isRecord(data.quests) || data.quests === null) {
      cache.quests = data.quests as CachedRuntimeSnapshot['quests'];
    }
    if (isRecord(data.farm) || data.farm === null) {
      cache.farm = data.farm as CachedRuntimeSnapshot['farm'];
    }
    if (Array.isArray(data.inventory)) cache.inventory = data.inventory as CachedRuntimeSnapshot['inventory'];
    if (Array.isArray(data.farmProduce)) cache.farmProduce = data.farmProduce as CachedRuntimeSnapshot['farmProduce'];
    if (Array.isArray(data.cookingMaterials)) cache.cookingMaterials = data.cookingMaterials as CachedRuntimeSnapshot['cookingMaterials'];
    if (Array.isArray(data.trees)) cache.trees = data.trees as CachedRuntimeSnapshot['trees'];
    if (Array.isArray(data.items)) cache.items = data.items as CachedRuntimeSnapshot['items'];
    if (Array.isArray(data.animals)) cache.animals = data.animals as CachedRuntimeSnapshot['animals'];
    if (Array.isArray(data.foods)) cache.foods = data.foods as CachedRuntimeSnapshot['foods'];
    if (isRecord(data.cooking) || data.cooking === null) {
      cache.cooking = data.cooking as CachedRuntimeSnapshot['cooking'];
    }
    cache.capturedAt = typeof data.capturedAt === 'number' && Number.isFinite(data.capturedAt)
      ? data.capturedAt
      : row.captured_at;
    return cache;
  } catch {
    return emptyRuntimeSnapshot();
  }
}

export function saveRuntimeSnapshotCache(
  db: Db,
  accountId: number,
  patch: RuntimeSnapshotPatch,
  now = Date.now(),
): void {
  db.transaction(() => {
    const current = readRuntimeSnapshotCache(db, accountId);
    const next: CachedRuntimeSnapshot = { ...current, ...patch, capturedAt: now };
    db.prepare(
      `INSERT INTO avatar_runtime_snapshot_cache
          (account_id, payload_json, captured_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET
         payload_json = excluded.payload_json,
         captured_at = excluded.captured_at,
         updated_at = excluded.updated_at`,
    ).run(accountId, JSON.stringify({ version: CACHE_VERSION, ...next }), now, now);
  })();
}

export function deleteRuntimeSnapshotCache(db: Db, accountId: number): void {
  db.prepare('DELETE FROM avatar_runtime_snapshot_cache WHERE account_id = ?').run(accountId);
}
```

- [x] **Step 2: Verify**

Run: `npm run typecheck` (workdir `avatar-web/server`)
Expected: Typecheck sạch; không thêm test file.

---

### Task 3: AvatarSession in-memory fallback

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`
  - Options: dòng ~124-147
  - Constructor: dòng ~226-241
  - `getQuestOverview()`: dòng ~258-280
  - `snapshot()`: dòng ~587-624
  - `wire()` handlers farm/inventory/produce/cooking-materials/trees/cooking/quests: dòng ~749-789

**Interfaces:**
- Consumes: `CachedRuntimeSnapshot`, `RuntimeSnapshotPatch`, `emptyRuntimeSnapshot`, `runtimeSnapshotPatchFromEvent`.
- Produces: `AvatarSessionOptions.cachedSnapshot`, `AvatarSession.runtimeSnapshot`, method `patchRuntimeSnapshot`, snapshot fields luôn có fallback.

**Impact guard (đã chạy):**
`wire`: **CRITICAL**, 9 dependents/6 flows. `getQuestOverview`: **CRITICAL**, 6 dependents/5 flows. Cả hai chỉ thêm cache update, giữ nguyên shape.

- [x] **Step 1: Import + option**

```ts
import {
  emptyRuntimeSnapshot,
  runtimeSnapshotPatchFromEvent,
  type CachedRuntimeSnapshot,
} from './runtimeCache.js';
```

```ts
export interface AvatarSessionOptions {
  // ...các field hiện có giữ nguyên
  cachedSnapshot?: CachedRuntimeSnapshot;
}
```

- [x] **Step 2: Field + constructor**

```ts
private runtimeSnapshot: CachedRuntimeSnapshot;
```

```ts
this.runtimeSnapshot = opts.cachedSnapshot ?? emptyRuntimeSnapshot();
```

- [x] **Step 3: Helper**

```ts
private patchRuntimeSnapshot(type: string, payload: unknown): void {
  const patch = runtimeSnapshotPatchFromEvent(type, payload);
  if (patch) {
    this.runtimeSnapshot = {
      ...this.runtimeSnapshot,
      ...patch,
      capturedAt: this.now(),
    };
  }
}
```

- [x] **Step 4: `getQuestOverview()`**

```ts
getQuestOverview(): QuestOverviewState {
  const c = this.client?.status === 'online' ? this.client : undefined;
  if (!c) {
    return this.runtimeSnapshot.quests ?? {
      daily: null,
      beginner: null,
      farmer: null,
      updatedAt: this.now(),
    };
  }
  if (typeof c.syncProgressQuests === 'function') c.syncProgressQuests();
  const overview: QuestOverviewState = {
    daily: c.dailyQuestState ?? null,
    beginner: c.beginnerQuestState ?? null,
    farmer: c.farmerQuestState ?? null,
    upgradeRequirements: c.farmUpgradeRequirements ?? null,
    updatedAt: Math.max(
      c.dailyQuestState?.updatedAt ?? 0,
      c.beginnerQuestState?.updatedAt ?? 0,
      c.farmerQuestState?.updatedAt ?? 0,
    ) || this.now(),
  };
  this.runtimeSnapshot = {
    ...this.runtimeSnapshot,
    quests: overview,
    capturedAt: this.now(),
  };
  return overview;
}
```

- [x] **Step 5: `snapshot()`**

```ts
const live = this.client?.status === 'online' ? this.client : undefined;
```

Thay các field tài sản/nhiệm vụ:

```ts
farm: live?.farmState ?? this.runtimeSnapshot.farm,
cooking: live?.cookingState ?? this.runtimeSnapshot.cooking,
foods: live?.foods ?? this.runtimeSnapshot.foods,
quests: this.getQuestOverview(),
farmProduce: live?.produce ?? this.runtimeSnapshot.farmProduce,
cookingMaterials: live?.cookingMaterials ?? this.runtimeSnapshot.cookingMaterials,
inventory: live?.inventory ?? this.runtimeSnapshot.inventory,
trees: live?.trees ?? this.runtimeSnapshot.trees,
items: live?.items ?? this.runtimeSnapshot.items,
animals: live?.animals ?? this.runtimeSnapshot.animals,
```

Không đổi `status`, `auto`, `automation`, `macro`, `shop`, `logs`, `traffic`, metrics.

- [x] **Step 6: Cập nhật `wire()` handlers**

```ts
client.on('farm', (state: unknown) => {
  if (this.isCurrent(client, epoch)) {
    this.patchRuntimeSnapshot('farm', state);
    this.emit('farm', state);
  }
});
client.on('inventory', (inv: unknown) => {
  if (this.isCurrent(client, epoch)) {
    this.patchRuntimeSnapshot('inventory', inv);
    this.emit('inventory', inv);
  }
});
client.on('produce', (produce: unknown) => {
  if (this.isCurrent(client, epoch)) {
    this.patchRuntimeSnapshot('farm-produce', produce);
    this.emit('farm-produce', produce);
  }
});
client.on('cooking-materials', (materials: unknown) => {
  if (this.isCurrent(client, epoch)) {
    this.patchRuntimeSnapshot('cooking-materials', materials);
    this.emit('cooking-materials', materials);
  }
});
client.on('trees', (t: unknown) => {
  if (this.isCurrent(client, epoch)) {
    this.patchRuntimeSnapshot('trees', t);
    this.emit('trees', t);
  }
});
client.on('cooking', (cook: unknown) => {
  if (this.isCurrent(client, epoch)) {
    this.patchRuntimeSnapshot('cooking', cook);
    this.emit('cooking', cook);
  }
});
client.on('quests', () => {
  if (this.isCurrent(client, epoch)) {
    const overview = this.getQuestOverview();
    this.emit('quests', overview);
  }
});
```

- [x] **Step 7: Verify**

Run: `npm run typecheck && npm test` (workdir `avatar-web/server`)
Expected: typecheck sạch; suite hiện có pass.

---

### Task 4: SessionManager đọc/ghi cache

**Files:**
- Modify: `avatar-web/server/src/session/manager.ts`
  - Imports: đầu file
  - `getOrCreate()`: dòng ~238-313
  - `onEvent` closure: dòng ~279-298

**Interfaces:**
- Consumes: `readRuntimeSnapshotCache`, `saveRuntimeSnapshotCache`, `runtimeSnapshotPatchFromEvent`.
- Produces: session được hydrate từ DB; snapshot events được persist trước broadcast.

**Impact guard:**
`SessionManager.getOrCreate()`: **LOW**, 5 dependents. `SessionManager.snapshot()`: UNKNOWN qua class reference; xác nhận caller bằng `rg` (`SessionManager.snapshot`).

- [x] **Step 1: Import**

```ts
import {
  readRuntimeSnapshotCache,
  saveRuntimeSnapshotCache,
} from '../accounts/runtimeSnapshotRepo.js';
import { runtimeSnapshotPatchFromEvent } from './runtimeCache.js';
```

- [x] **Step 2: Hydrate session**

Trong `const opts: AvatarSessionOptions = { ... }`:

```ts
cachedSnapshot: readRuntimeSnapshotCache(db, accountId),
```

- [x] **Step 3: Persist trước broadcast**

Trong `onEvent`, sau block `if (type === 'farm')` và trước `broadcast(...)`:

```ts
const cachePatch = runtimeSnapshotPatchFromEvent(type, payload);
if (cachePatch) {
  saveRuntimeSnapshotCache(db, accountId, cachePatch);
}
```

Không bọc `try/catch` để giữ semantics hiện có: nếu DB write fail, broadcast không chạy và `AvatarSession.emit()` nuốt lỗi, session không chết.

- [x] **Step 4: Verify**

Run: `npm run typecheck && npm test` (workdir `avatar-web/server`)
Expected: typecheck sạch; suite hiện có pass.

---

### Task 5: Xoá cache khi đổi gameUser

**Files:**
- Modify: `avatar-web/server/src/accounts/repo.ts`
  - Import đầu file
  - `updateAccount()`: dòng ~203-237

**Interfaces:**
- Consumes: `deleteRuntimeSnapshotCache`.
- Produces: cache bị xoá khi nhân vật game thay đổi.

**Impact guard:**
`repo.updateAccount()`: **LOW**, 2 dependents.

- [x] **Step 1: Import**

```ts
import { deleteRuntimeSnapshotCache } from './runtimeSnapshotRepo.js';
```

- [x] **Step 2: Xoá cache cùng farm profile**

```ts
if (normalizedGameUser !== undefined && normalizedGameUser !== current.gameUser.trim()) {
  deleteFarmProfile(db, id);
  deleteRuntimeSnapshotCache(db, id);
}
```

- [x] **Step 3: Verify**

Run: `npm run typecheck && npm test` (workdir `avatar-web/server`)
Expected: typecheck sạch; suite hiện có pass.

---

### Task 6: Verification tổng + GitNexus

**Files:** không sửa — chỉ kiểm chứng.

- [x] **Step 1: Server typecheck + tests**

Run: `npm run typecheck && npm test` (workdir `avatar-web/server`)
Expected: sạch, suite pass.

- [x] **Step 2: Web typecheck + tests**

Run: `npx tsc -b && npm test` (workdir `avatar-web/web`)
Expected: sạch, suite pass.

- [x] **Step 3: GitNexus detect changes**

Run: `npx gitnexus detect-changes -r learning-reverse --scope all`
Expected: chỉ chạm `runtimeCache.ts`, `runtimeSnapshotRepo.ts`, `schema.sql`, `avatarSession.ts`, `manager.ts`, `repo.ts` và 2 file docs; nếu có file ngoài scope thì dừng và xem lại.

- [x] **Step 4: Làm mới index**

Run: `npx gitnexus analyze`
Giải thích: `.gitnexus/meta.json` `stats.embeddings = 0`, nên không cần `--embeddings`.
Expected: GitNexus `status` trả `✅ up-to-date`.

- [x] **Step 5: Checkpoint commit (chỉ khi user yêu cầu)**

Nếu user đồng ý:

```bash
git add avatar-web/server/src/session/runtimeCache.ts \
        avatar-web/server/src/accounts/runtimeSnapshotRepo.ts \
        avatar-web/server/src/db/schema.sql \
        avatar-web/server/src/session/avatarSession.ts \
        avatar-web/server/src/session/manager.ts \
        avatar-web/server/src/accounts/repo.ts \
        docs/superpowers/specs/2026-08-29-persist-quests-assets-during-auto-wait-design.md \
        docs/superpowers/plans/2026-08-29-persist-quests-assets-during-auto-wait.md
git commit -m "feat(snapshot): cache quests/assets during auto wait"
```
