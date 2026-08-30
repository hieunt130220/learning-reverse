# Lưu Snapshot Nhiệm Vụ & Tài Sản Khi Auto Farm Chờ Vòng Kế Tiếp — Design Spec

Ngày: 2026-08-29

## 1. Mục tiêu & Bối cảnh

### Hiện tượng

- `AutoFarm` mặc định `logoutAfterCycle = true` (`avatar-web/server/src/autoFarm.ts:269`) và khoảng chờ mặc định `DEFAULT_AUTO_INTERVAL_MS = 5` phút (`avatar-web/server/src/autoFarm.ts:251`).
- Sau mỗi vòng, `AvatarSession.onAutoCycleComplete()` (`avatar-web/server/src/session/avatarSession.ts:1343`) chủ động `teardown()` (`avatar-web/server/src/session/avatarSession.ts:1484`), làm `this.client = undefined`.
- Trong lúc chờ vòng kế tiếp, người dùng mở drawer hoặc F5 lại web:
  - Tab **Nhiệm vụ** trống/`null`.
  - Tab **Tài sản**, **Nấu ăn** trống: `farm`, `inventory`, `farmProduce`, `cookingMaterials`, `trees`, `items`, `animals`, `foods`, `cooking` đều mất.
- Trước đó UI đã nhận đủ dữ liệu khi tài khoản online, nhưng dữ liệu chỉ nằm trong RAM của `GameClient`; khi `client` bị gỡ, dữ liệu theo đó biến mất.

### Nguyên nhân gốc

`AvatarSession.snapshot()` (`avatar-web/server/src/session/avatarSession.ts:587-624`) đọc trực tiếp từ `this.client`:

```ts
farm: c?.farmState,
cooking: c?.cookingState,
foods: c?.foods ?? [],
quests: this.getQuestOverview(),
inventory: c?.inventory ?? [],
farmProduce: c?.produce ?? [],
cookingMaterials: c?.cookingMaterials ?? [],
trees: c?.trees ?? [],
items: c?.items ?? [],
animals: c?.animals ?? [],
```

Khi `teardown()` gán `this.client = undefined`, mọi field trở về `null`/`[]`.

Hiện tại chỉ có các cache sau tồn tại:

- **Metrics**: `avatar_accounts.cached_*` — đã sống sót qua logout.
- **Farm profile**: `avatar_farm_profile_cache` — chỉ lưu cell indices/slot/catalog hạt, không đủ để dựng lại tab Tài sản.
- **Shop**: `avatar_shop_cache` — đã được `ShopCoordinator` tự lưu/khôi phục.
- **Nhiệm vụ và tài sản farm**: chưa có cache bền.

### Mục tiêu

- Lưu snapshot mới nhất của **nhiệm vụ** và **tài sản farm** mỗi lần nhận dữ liệu hợp lệ từ game.
- Khi tài khoản đang chờ vòng auto tiếp theo (hoặc đang kết nối lại), `snapshot()` và `GET /api/accounts/:id/quests` trả về dữ liệu cuối cùng thay vì `null`/`[]`.
- Dữ liệu sống sót qua teardown, retry và restart server.
- Không thay đổi hành vi vòng auto, không thay đổi API/WebSocket contract, không thay đổi giao diện web (các panel đã đọc sẵn các field này).

## 2. Phạm vi (Scope)

### In-scope

1. DB schema:
   - Tạo bảng `avatar_runtime_snapshot_cache` 1-1 với `avatar_accounts`, lưu một JSON envelope versioned.
2. Cache repository:
   - Tạo `avatar-web/server/src/accounts/runtimeSnapshotRepo.ts`.
   - API đọc/ghi/xoá snapshot runtime, xử lý dữ liệu cũ/malformed an toàn.
3. Shared mapping:
   - Tạo `avatar-web/server/src/session/runtimeCache.ts`.
   - Chuyển event của game thành patch cache một cách thuần, dùng chung cho `AvatarSession` và `SessionManager`.
4. `AvatarSession`:
   - Giữ in-memory cache khởi tạo từ DB.
   - Cập nhật cache khi nhận `farm`, `inventory`, `farm-produce`, `cooking-materials`, `trees`, `cooking`, `quests`.
   - `snapshot()` fallback về cache khi không có client online.
   - `getQuestOverview()` fallback về cache khi không có client online.
5. `SessionManager`:
   - Truyền cache khởi tạo vào session mới.
   - Ghi DB trước khi broadcast các snapshot event tương ứng.
6. `repo.ts`:
   - Xoá runtime snapshot cache khi `gameUser` thay đổi, cùng transaction với việc xoá `avatar_farm_profile_cache`.

### Out-of-scope

- Không đổi vòng auto: `logoutAfterCycle = true` giữ nguyên, vẫn logout giữa các vòng.
- Không đổi `GameClient` decoder.
- Không đổi web component/API response shape: web đã render `quests`, `farm`, inventory, catalogs từ `SessionSnapshot`.
- Không cache logs, traffic, shop state, `playerId`:
  - Logs/traffic là dữ liệu phiên, không nên sống sót qua logout.
  - Shop/metadata đã có cache riêng trong `avatar_shop_cache`.
  - `foodCatalogReady` hiện chưa được web sử dụng.
- Không thay đổi `openDb` logic; chỉ thêm `CREATE TABLE IF NOT EXISTS` trong `schema.sql` (idempotent).

### Input / Output

- Input: event từ `GameClient` -> `AvatarSession`:
  - `farm` -> `farm`
  - `inventory` -> `inventory`
  - `farm-produce` -> `farmProduce`
  - `cooking-materials` -> `cookingMaterials`
  - `trees` -> `trees`, `items`, `animals`, `foods` (chỉ ghi key có trong payload)
  - `cooking` -> `cooking`
  - `quests` -> `quests`
- Output:
  - `avatar_runtime_snapshot_cache` có một row/account sau event đầu tiên.
  - `AvatarSessionSnapshot` khi offline/waiting trả dữ liệu cache thay vì rỗng.
  - `GET /api/accounts/:id/quests` trả cache quest khi session tồn tại nhưng chưa online.

### Edge cases

- Chưa từng nhận dữ liệu: cache rỗng, UI giữ hành vi cũ (`null`/`[]`).
- Dữ liệu rỗng hợp lệ (kho rỗng, farm chưa có cây): lưu `[]`/`null` như một snapshot hợp lệ, không bỏ qua.
- Event `trees` thiếu `foods` (payload cũ hoặc test fixture): chỉ ghi các key có mặt, không xoá `foods` đang có.
- `client.status !== 'online'` lúc snapshot: dùng cache; không để UI nhìn thấy màn hình "đang kết nối" bị trống.
- Event từ epoch cũ: `AvatarSession` đã guard `isCurrent(client, epoch)`, cache không bị ghi.
- DB read malformed JSON/thiếu row: trả `EMPTY_RUNTIME_SNAPSHOT`, không throw.
- DB write fail: manager không broadcast event đó (theo semantics hiện có của farm profile), nhưng `AvatarSession.emit()` nuốt lỗi nên process/session không chết; event tiếp theo sẽ ghi lại.
- Change `gameUser`: snapshot cũ thuộc nhân vật cũ nên phải xoá.
- Delete account: foreign key `ON DELETE CASCADE` xoá cache.
- Restart server: `SessionManager.getOrCreate()` đọc DB cache và truyền vào session; thông tin hiển thị ngay trong lúc chờ bootstrap/kết nối.
- `logoutAfterCycle = false`: cache vẫn được cập nhật, không gây hại.

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1. File / module liên quan

| File | Vai trò |
|---|---|
| `avatar-web/server/src/db/schema.sql` | Tạo bảng cache mới, idempotent. |
| `avatar-web/server/src/session/runtimeCache.ts` | Kiểu cache + mapping event -> patch, pure module. |
| `avatar-web/server/src/accounts/runtimeSnapshotRepo.ts` | Đọc/ghi/xoá SQLite, validate/decode JSON. |
| `avatar-web/server/src/session/avatarSession.ts` | In-memory fallback, cập nhật cache khi nhận event, dùng cache khi offline. |
| `avatar-web/server/src/session/manager.ts` | Nạp cache vào session, persist DB trước broadcast. |
| `avatar-web/server/src/accounts/repo.ts` | Xoá cache khi `gameUser` thay đổi. |

### 3.2. Data contract

`runtimeCache.ts`:

```ts
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

export function emptyRuntimeSnapshot(): CachedRuntimeSnapshot;
export function runtimeSnapshotPatchFromEvent(
  type: string,
  payload: unknown,
): RuntimeSnapshotPatch | null;
```

`runtimeSnapshotRepo.ts`:

```ts
export function readRuntimeSnapshotCache(
  db: Db,
  accountId: number,
): CachedRuntimeSnapshot;

export function saveRuntimeSnapshotCache(
  db: Db,
  accountId: number,
  patch: RuntimeSnapshotPatch,
  now?: number,
): void;

export function deleteRuntimeSnapshotCache(db: Db, accountId: number): void;
```

DB schema:

```sql
CREATE TABLE IF NOT EXISTS avatar_runtime_snapshot_cache (
  account_id  INTEGER PRIMARY KEY
              REFERENCES avatar_accounts(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  captured_at  INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
```

`payload_json` dùng một envelope để không nhân bảng/column khi thêm field:

```json
{
  "version": 1,
  "quests": { "...": "..." },
  "farm": { "...": "..." },
  "inventory": [],
  "farmProduce": [],
  "cookingMaterials": [],
  "trees": [],
  "items": [],
  "animals": [],
  "foods": [],
  "cooking": null,
  "capturedAt": 1785132000000
}
```

### 3.3. Mapping event -> cache

```text
farm              -> farm
inventory         -> inventory
farm-produce      -> farmProduce
cooking-materials -> cookingMaterials
trees             -> { trees?, items?, animals?, foods? }
cooking           -> cooking
quests            -> quests
```

Chú ý:

- Tên event farm produce là `farm-produce` (phát từ `AvatarSession.wire()`), không map `produce` của shop (`ShopCoordinator` cũng emit `produce` nhưng là `ProduceSnapshot` khác nghĩa).
- `trees` phải merge, không replace toàn bộ cache: event cũ/thiếu `foods` không được xoá catalog đã có.

### 3.4. `AvatarSession` changes

- `AvatarSessionOptions` thêm optional:

```ts
cachedSnapshot?: CachedRuntimeSnapshot;
```

- Constructor khởi tạo:

```ts
private runtimeSnapshot: CachedRuntimeSnapshot;
this.runtimeSnapshot = opts.cachedSnapshot ?? emptyRuntimeSnapshot();
```

- Các listener trong `wire()` gọi helper chung trước khi `emit`:

```ts
client.on('farm', (state: unknown) => {
  if (this.isCurrent(client, epoch)) {
    this.patchRuntimeSnapshot('farm', state);
    this.emit('farm', state);
  }
});
// tương tự inventory, farm-produce, cooking-materials, trees, cooking, quests
```

- `snapshot()` đổi nguồn dữ liệu khi không online:

```ts
const live = this.client?.status === 'online' ? this.client : undefined;
return {
  // ...
  farm: live?.farmState ?? this.runtimeSnapshot.farm,
  cooking: live?.cookingState ?? this.runtimeSnapshot.cooking,
  foods: live?.foods ?? this.runtimeSnapshot.foods,
  quests: live ? this.getQuestOverview() : this.runtimeSnapshot.quests,
  inventory: live?.inventory ?? this.runtimeSnapshot.inventory,
  farmProduce: live?.produce ?? this.runtimeSnapshot.farmProduce,
  cookingMaterials: live?.cookingMaterials ?? this.runtimeSnapshot.cookingMaterials,
  trees: live?.trees ?? this.runtimeSnapshot.trees,
  items: live?.items ?? this.runtimeSnapshot.items,
  animals: live?.animals ?? this.runtimeSnapshot.animals,
  // ...
};
```

- `getQuestOverview()`:

```ts
getQuestOverview(): QuestOverviewState {
  const c = this.client?.status === 'online' ? this.client : undefined;
  if (!c) return this.runtimeSnapshot.quests;
  // giữ logic hiện tại: syncProgressQuests + build overview
  const overview = buildQuestOverview(c);
  this.patchRuntimeSnapshot('quests', overview);
  return overview;
}
```

### 3.5. `SessionManager` changes

- `getOrCreate()` đọc cache và truyền vào options:

```ts
cachedSnapshot: readRuntimeSnapshotCache(db, accountId),
```

- `onEvent` trước khi broadcast:

```ts
const cachePatch = runtimeSnapshotPatchFromEvent(type, payload);
if (cachePatch) {
  saveRuntimeSnapshotCache(db, accountId, cachePatch);
}
```

Giữ thứ tự nhất quán với farm profile hiện có: ghi DB trước, broadcast sau.

### 3.6. `repo.ts` changes

Trong `updateAccount()`, khi `gameUser` thay đổi:

```ts
if (normalizedGameUser !== undefined && normalizedGameUser !== current.gameUser.trim()) {
  deleteFarmProfile(db, id);
  deleteRuntimeSnapshotCache(db, id);
}
```

### 3.7. Flow

```text
Game packet
  -> GameClient decode + emit
  -> AvatarSession wire listener
     -> patch in-memory runtimeSnapshot
     -> emit tới onEvent
  -> SessionManager
     -> saveRuntimeSnapshotCache(DB)
     -> broadcast WebSocket

Auto cycle complete
  -> AvatarSession.onAutoCycleComplete
  -> teardown(), client = undefined
  -> snapshot() uses runtimeSnapshot
  -> Web drawer tabs vẫn hiển thị nhiệm vụ/tài sản

Server restart
  -> SessionManager.getOrCreate()
  -> readRuntimeSnapshotCache(DB)
  -> AvatarSession khởi tạo với cache
```

## 4. Verification Plan

### Automated

```bash
cd avatar-web/server
npm run typecheck
npm test

cd ../web
npx tsc -b
npm test
```

Expected:

- Typecheck sạch.
- Toàn bộ test hiện có pass.
- Không thêm test file mới trừ khi user yêu cầu.

### Manual

1. Bật auto farm cho tài khoản, giữ `logoutAfterCycle = true` và `intervalMs` nhỏ (ví dụ 60s).
2. Chờ vòng đầu hoàn thành, server chuyển `status = idle`, `automation.activeMode = off`, `desiredMode = auto_farm`.
3. Mở drawer và F5:
   - Tab **Nhiệm vụ**: vẫn hiển thị daily/beginner/farmer cuối cùng.
   - Tab **Tài sản**: `farm`, `inventory`, `farmProduce`, `trees`, `animals`, `items` vẫn hiển thị.
   - Tab **Nấu ăn**: `cooking`, `foods`, `cookingMaterials` vẫn hiển thị.
4. `GET /api/accounts/:id/quests` trả dữ liệu quest cache thay vì all `null`.
5. Đợi vòng kế tiếp: dữ liệu mới được ghi đè, UI cập nhật như cũ.
6. Restart server giữa lúc chờ: reload web, cache vẫn hiển thị.
7. Sửa `gameUser`: cache bị xoá; tài khoản mới không hiển thị tài sản của nhân vật cũ.
8. Kiểm tra DB:

```bash
sqlite3 avatar-web/server/data/avatar-web.db \
  "SELECT account_id, captured_at, length(payload_json)
     FROM avatar_runtime_snapshot_cache;"
```

## 5. Rủi ro / Impact analysis

- `AvatarSession.getQuestOverview()`: GitNexus báo **CRITICAL**, 6 dependents, 5 execution flows (`snapshot`, `wire`, `onAutoCycleComplete`, ...). Thay đổi chỉ bổ sung fallback, **giữ nguyên shape và luồng online**; phải chạy full server suite trước khi deploy.
- `AvatarSession.snapshot()`: GitNexus không resolve được caller qua class reference, nhưng thực tế được gọi từ `SessionManager.snapshot()`, routes và WebSocket; không đổi contract.
- `SessionManager.getOrCreate()`: **LOW**, 5 dependents chủ yếu trong module Session.
- `repo.updateAccount()`: **LOW**, 2 dependents.
- `openDb` không đổi code; chỉ thêm `CREATE TABLE IF NOT EXISTS` nên không gây thêm guarded migration.
- Không có embedding trong index, `gitnexus analyze --embeddings` không cần thiết.
