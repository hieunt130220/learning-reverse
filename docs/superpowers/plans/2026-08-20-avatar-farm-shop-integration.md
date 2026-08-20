# Avatar Farm Shop Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp Sạp nông sản AvatarHD vào Avatar Web theo contract cmd 103 đã được reverse-engineer, có cache/audit theo tài khoản, REST/WebSocket an toàn và giao diện vận hành trong account drawer.

**Architecture:** Decoder cmd 103 là lớp thuần, không tự gửi packet; `GameClient` chỉ phát event protocol/produce; một `ShopCoordinator` sống theo `AvatarSession` chịu trách nhiệm serialize request, correlate response, reconcile transaction và cập nhật SQLite/WebSocket. REST chỉ gọi typed methods của session, còn frontend nhận snapshot/event để hiển thị và gửi thao tác qua API có idempotency.

**Tech Stack:** TypeScript, Node.js, Express, TCP game protocol, better-sqlite3, WebSocket, React, Vite, Vitest hiện hữu, GitNexus CLI/MCP.

**Spec:** `docs/superpowers/specs/2026-08-20-avatar-farm-shop-integration-design.md`

## Global Constraints

- Triển khai theo thứ tự task; không viết production code của task sau khi interface task trước chưa ổn định.
- Không dùng TDD và không tạo/sửa test file vì user chưa yêu cầu. Verification dùng inline harness tạm thời và các test suite hiện hữu sau khi production code hoàn thành.
- Trước khi sửa bất kỳ symbol hiện hữu nào, chạy `gitnexus_impact({ target: "<symbol>", direction: "upstream" })`. Dừng và báo user trước khi sửa nếu kết quả là HIGH hoặc CRITICAL mà blast radius khác với rủi ro đã nêu trong spec.
- Trước mỗi commit, chỉ stage đúng files của task, chạy `gitnexus_detect_changes({ scope: "staged" })`, kiểm tra toàn bộ d=1 dependents và `git diff --cached --check`.
- Không log raw packet trong production, credential, XOR key hoặc body chứa dữ liệu nhạy cảm. `SHOP_PROTOCOL_DEBUG_ENABLED` luôn bị ép `false` khi `NODE_ENV=production`.
- `GameClient` và decoder không được phát sinh follow-up request. Chỉ `ShopCoordinator` được điều phối chuỗi cmd 103/cmd 70.
- Toàn bộ cmd 103 phải được serialize theo tài khoản. Mọi shop command xung đột với AutoFarm/MacroRunner; việc đọc cache không xung đột.
- Không tự retry write. Mất kết nối sau khi gửi write phải kết thúc `unknown`; UI không được gợi ý retry tự động.
- Purchase gửi `idShop:i32 + verShop:i16`; không thay thế `verShop` bằng `itemId`.
- Sub7 là paid/capability-gated refresh, không được dùng trong luồng sync read-only.
- Existing clients/snapshots được nâng cấp tương thích: frontend chấp nhận snapshot cũ chưa có `shop`/`produce`, nhưng backend mới luôn phát hai field này.
- Live write chỉ chạy với account allowlist, capability tương ứng và xác nhận trực tiếp của user. Không dùng tài khoản thật để kiểm tra trong các task tự động.

## Runtime Contracts Dùng Chung

Các task dùng chung các contract sau; tên field phải giữ nguyên giữa server, REST, WebSocket và web:

```ts
type ShopTransactionKind = 'list' | 'withdraw' | 'purchase' | 'unlock' | 'refresh-market';
type ShopTransactionStatus =
  | 'queued'
  | 'sending'
  | 'awaiting_response'
  | 'reconciling'
  | 'succeeded'
  | 'failed'
  | 'unknown';

interface ShopTransaction {
  id: string;
  accountId: number;
  idempotencyKey: string;
  kind: ShopTransactionKind;
  status: ShopTransactionStatus;
  request: Record<string, unknown>;
  before: Record<string, unknown>;
  result?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

interface ProduceSnapshot {
  revision: number;
  connectionEpoch: number;
  capturedAt: number;
  items: InventoryItem[];
}

interface ShopSnapshot<T> {
  revision: number;
  connectionEpoch: number;
  capturedAt: number;
  data: T;
}

interface ShopRuntimeState {
  syncStatus: 'idle' | 'syncing' | 'ready' | 'stale' | 'error';
  own: ShopSnapshot<{ numSlot: number; canOpenSlot: boolean; slots: OwnShopSlot[] }> | null;
  market: ShopSnapshot<{ status: number; listings: MarketListing[] }> | null;
  priceRules: ShopSnapshot<ShopPriceRule[]> | null;
  activeTransaction: ShopTransaction | null;
  recentTransactions: ShopTransaction[];
  capabilities: ShopCapabilities;
  lastError?: { code: string; message: string };
}
```

Mọi REST error dùng envelope:

```ts
interface ShopApiErrorBody {
  error: {
    code:
      | 'INVALID_SHOP_REQUEST'
      | 'SHOP_CAPABILITY_DISABLED'
      | 'SESSION_OFFLINE'
      | 'STALE_STATE'
      | 'OPERATION_CONFLICT'
      | 'PRICE_OUT_OF_RANGE'
      | 'SHOP_RESPONSE_TIMEOUT'
      | 'SHOP_PROTOCOL_ERROR';
    message: string;
  };
}
```

### Task 1: Protocol Models, Decoder, and Correct TX Encoding

**Files:**
- Create: `avatar-web/server/src/game/shopProtocol.ts`
- Modify: `avatar-web/server/src/game/farmService.ts:224-272`

**Interfaces:**
- Consumes: `MyReader`, `Message`, `FarmService.session.send()`.
- Produces: `ShopProtocolEvent`, `ShopProtocolWarning`, `ShopProtocolDecodeError`, `decodeShopPacket(body)`, corrected `openShop()` and `buyFromShop()` encoders.

- [x] **Step 1: Run impact analysis before existing-symbol edits**

  Run GitNexus impact for `FarmService`, `openShop`, and `buyFromShop`. Record d=1 callers. Expected: `FarmService` is low-risk but all direct callers must be checked for the renamed `verShop` parameter semantics.

- [x] **Step 2: Define the exact discriminated protocol union**

  Create exported record types and this union in `shopProtocol.ts`:

  ```ts
  export type ShopProtocolEvent =
    | { subType: 0; kind: 'own-snapshot'; slots: OwnShopSlot[]; numSlot: number; canOpenSlot: boolean }
    | { subType: 1; kind: 'market-snapshot'; status: number; listings: MarketListing[] }
    | { subType: 2; kind: 'slot-info'; state: 0; type: number; value: number }
    | { subType: 2; kind: 'slot-opened'; state: 1; type: number; value: number; numSlot: number; canOpenSlot: boolean }
    | { subType: 3; kind: 'listing-added'; slot: number; itemId: number; quantity: number; price: number }
    | { subType: 4; kind: 'listing-withdrawn'; slot: number; result: 0; value: number }
    | { subType: 4; kind: 'listing-withdrawn'; slot: number; result: 1; itemId: number; value: number }
    | { subType: 5; kind: 'purchase-ack'; itemId: number; value: number }
    | { subType: 6; kind: 'refresh' }
    | { subType: 7; kind: 'refresh' }
    | { subType: 8; kind: 'price-rules'; rules: ShopPriceRule[] };

  export interface ShopProtocolWarning {
    code: 'TRAILING_BYTES';
    remaining: number;
  }

  export interface DecodedShopPacket {
    event: ShopProtocolEvent;
    warning?: ShopProtocolWarning;
  }
  ```

  `OwnShopSlot` giữ `slot`, `itemId`, `quantity`, `price`, `isSale`, `isTimeOut`; `MarketListing` giữ `index`, `idShop`, `verShop`, `itemId`, `quantity`, `price`; `ShopPriceRule` giữ `itemId`, `minPrice`, `maxPrice`.

- [x] **Step 3: Implement a bounded, atomic decoder**

  Implement `need(reader, byteCount, field)` before every primitive read; validate all signed counts are `>= 0` and below a conservative upper bound (`own <= 127`, `market/rules <= 4096`). Decode into local variables and return only after the complete body is valid. Reject unknown subtype, invalid state/result and truncated bodies with `ShopProtocolDecodeError` carrying offset plus a bounded hex prefix; return `TRAILING_BYTES` instead of silently discarding unread data.

  Exact field order:

  ```text
  sub0: i8 count; repeat(i16 itemId,i32 num,i32 price,bool isSale,[bool isTimeOut iff !isSale]); bool canOpenSlot
  sub1: i8 status;i16 count; if status==1 repeat(i32 idShop,i16 verShop,i16 itemId,i32 num,i32 price)
  sub2: i8 state;i8 type;i32 value; if state==1 then i8 numSlot,bool canOpenSlot
  sub3: i8 slot;i16 itemId;i32 num;i32 price
  sub4: i8 slot;i8 result; result==0 => i32 value; result==1 => i16 itemId,i32 value
  sub5: i16 itemId;i32 value
  sub6/sub7: no extra fields
  sub8: i16 count; repeat(i16 itemId,i32 minPrice,i32 maxPrice)
  ```

- [x] **Step 4: Correct `FarmService` wire bodies**

  Update `openShop` so `type=0` writes one byte only, while `type=1` writes `type + step + itemId`. Reject any other type before sending. Rename `buyFromShop(idShop, idItem)` to `buyFromShop(idShop, verShop)` without changing binary widths:

  ```ts
  openShop(type: 0 | 1, step: number, itemId: number): void {
    const m = new Message(103);
    m.writer().writeByte(type);
    if (type === 1) {
      m.writer().writeByte(step);
      m.writer().writeShort(itemId);
    }
    this.session.send(m);
  }

  buyFromShop(idShop: number, verShop: number): void {
    const m = new Message(103);
    m.writer().writeByte(5);
    m.writer().writeInt(idShop);
    m.writer().writeShort(verShop);
    this.session.send(m);
  }
  ```

  Add pre-encode integer/width validation to every cmd 103 method: type/step/slot fit i8, item/version fit i16 (only the documented `-1` sentinel is allowed), idShop/quantity/price fit signed i32, quantity is positive and price is non-negative. Invalid values throw before `session.send()`.

- [x] **Step 5: Verify protocol code after production implementation**

  Run an inline `node --import tsx --input-type=module -e "..."` harness that asserts:

  - own shop request hex is `00`;
  - market browse request hex is `0100ffff`;
  - purchase request includes supplied `verShop`;
  - valid fixtures for sub0..sub8 decode to the expected union;
  - truncated and negative-count fixtures throw without returning partial state;
  - valid packet plus one byte returns `TRAILING_BYTES`.

  Then run:

  ```bash
  cd avatar-web/server
  npm run typecheck
  npm run build
  ```

  Expected: harness exits 0; TypeScript and build exit 0.

- [x] **Step 6: Scope check and commit**

  Stage only the two task files, run `gitnexus_detect_changes({ scope: "staged" })` and `git diff --cached --check`, then commit:

  ```bash
  git commit -m "feat(shop): add cmd 103 protocol decoder"
  ```

### Task 2: Emit Shop and Produce Events from GameClient

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:122-180,519-750`

**Interfaces:**
- Consumes: `decodeShopPacket`, `ShopProtocolEvent`, decoded cmd 70 inventory sections.
- Produces: GameClient events `shop-protocol` and `produce`; `lastShopEvent` diagnostic state without side effects.

- [x] **Step 1: Run impact analysis and honor the HIGH-risk gate**

  Run GitNexus impact for `GameClient` and `onMessage`. Expected: HIGH because session/bootstrap/tools instantiate `GameClient`. Report the direct dependents before editing and ensure constructor/public method compatibility remains unchanged.

- [x] **Step 2: Add protocol event state**

  Add typed properties without changing constructor arguments:

  ```ts
  lastShopEvent: ShopProtocolEvent | null = null;
  lastShopWarning: ShopProtocolWarning | null = null;
  ```

- [x] **Step 3: Decode cmd 103 without issuing follow-up packets**

  Add `case 103` in `onMessage`: call `decodeShopPacket(message.getData())`, atomically set the two properties, emit `shop-protocol` with `{ event, warning }`, and catch `ShopProtocolDecodeError` only to emit a typed `shop-protocol-error`. Re-throw unexpected programming errors. Do not call any `FarmService` method in this branch.

- [x] **Step 4: Publish the produce section of cmd 70**

  Preserve the existing `inventory` event. After assigning `this.produce = inv.other[0] ?? []`, emit a separate `produce` event containing a copied array so listeners cannot mutate `GameClient.produce`.

- [x] **Step 5: Verify and commit**

  Run `npm run typecheck`, `npm test`, and `npm run build` in `avatar-web/server`. Expected: current test suite remains green and no constructor call sites require edits. Stage only `client.ts`, run `gitnexus_detect_changes({ scope: "staged" })` plus cached diff check, then commit:

  ```bash
  git commit -m "feat(shop): publish shop and produce game events"
  ```

### Task 3: Add SQLite Shop Cache and Transaction Repository

**Files:**
- Modify: `avatar-web/server/src/db/schema.sql:1-54`
- Create: `avatar-web/server/src/accounts/shopRepo.ts`

**Interfaces:**
- Consumes: `Db` from the existing database module and shared shop runtime/transaction types.
- Produces: `ShopRepository`, persisted cache records, idempotent transaction records, startup recovery.

- [ ] **Step 1: Run impact analysis before schema edits**

  Run GitNexus impact for `openDb` and inspect all schema consumers. Confirm schema execution is idempotent and no destructive migration is needed.

- [ ] **Step 2: Add idempotent schema objects**

  Append `CREATE TABLE IF NOT EXISTS avatar_shop_cache` with `account_id` primary/foreign key to `avatar_accounts(id)`, four JSON columns (`own_snapshot_json`, `market_snapshot_json`, `price_rules_json`, `produce_json`), `own_observed_at`, `market_observed_at`, `rules_observed_at`, `produce_observed_at` and `updated_at`.

  Append `CREATE TABLE IF NOT EXISTS avatar_shop_transactions` with:

  ```text
  id TEXT PRIMARY KEY
  account_id INTEGER NOT NULL REFERENCES avatar_accounts(id) ON DELETE CASCADE
  idempotency_key TEXT NOT NULL
  kind TEXT NOT NULL
  status TEXT NOT NULL
  request_json TEXT NOT NULL
  before_json TEXT
  result_json TEXT
  error_code TEXT
  error_message TEXT
  created_at INTEGER NOT NULL
  updated_at INTEGER NOT NULL
  completed_at INTEGER
  UNIQUE(account_id, idempotency_key)
  ```

  Add indexes on `(account_id, created_at DESC)` and `(account_id, status)`.

- [ ] **Step 3: Implement the repository contract**

  Export a concrete `ShopRepository` class with synchronous better-sqlite3 operations:

  ```ts
  loadCache(accountId: number): PersistedShopCache | null;
  saveCache(accountId: number, state: ShopRuntimeState, produce: ProduceSnapshot | null): void;
  findTransaction(accountId: number, idempotencyKey: string): ShopTransaction | null;
  insertTransaction(transaction: ShopTransaction): ShopTransaction;
  updateTransaction(id: string, patch: ShopTransactionPatch): ShopTransaction;
  listTransactions(accountId: number, limit: number): ShopTransaction[];
  recoverInterruptedTransactions(): number;
  ```

  JSON parse failures must throw an error naming only the table/column/account, never dump raw JSON. `recoverInterruptedTransactions()` maps `queued` to `failed` with an explicit restart error and maps `sending|awaiting_response|reconciling` to `unknown`.

- [ ] **Step 4: Verify repository behavior after implementation**

  Use an inline in-memory DB harness through `openDb(':memory:')` to insert/load cache, prove the per-account idempotency uniqueness, order/limit transaction history, and verify recovery mappings. Then run server typecheck/build.

- [ ] **Step 5: Scope check and commit**

  Stage schema and repository only, run `gitnexus_detect_changes({ scope: "staged" })` and cached diff check, then commit:

  ```bash
  git commit -m "feat(shop): persist cache and transaction audit"
  ```

### Task 4: Parse Shop Feature Policy from Environment

**Files:**
- Modify: `avatar-web/server/src/config.ts:5-48`

**Interfaces:**
- Consumes: `NodeJS.ProcessEnv`, `NODE_ENV`.
- Produces: `ShopPolicy` at `Config.shopPolicy`.

- [ ] **Step 1: Run impact analysis**

  Run GitNexus impact for `Config` and `loadConfig`; enumerate all config construction/use sites.

- [ ] **Step 2: Add explicit policy parsing**

  Export:

  ```ts
  export interface ShopPolicy {
    readEnabled: boolean;
    writeEnabled: boolean;
    purchaseEnabled: boolean;
    slotUnlockEnabled: boolean;
    marketRefreshEnabled: boolean;
    liveAccountAllowlist: ReadonlySet<number>;
    protocolDebugEnabled: boolean;
  }
  ```

  Parse only `1|true|yes|on` (case-insensitive) as true; all missing/other values are false. Parse `SHOP_LIVE_ACCOUNT_ALLOWLIST` as comma-separated positive integer account IDs and throw on malformed tokens. Populate from:

  ```text
  SHOP_READ_ENABLED
  SHOP_WRITE_ENABLED
  SHOP_PURCHASE_ENABLED
  SHOP_SLOT_UNLOCK_ENABLED
  SHOP_MARKET_REFRESH_ENABLED
  SHOP_LIVE_ACCOUNT_ALLOWLIST
  SHOP_PROTOCOL_DEBUG_ENABLED
  ```

  Set `protocolDebugEnabled` to `false` whenever `isProduction` is true, regardless of env.

- [ ] **Step 3: Verify and commit**

  Run an inline `loadConfig` harness for defaults, each flag, invalid allowlist and production debug override; reuse a generated 32-byte base64 key only inside the process. Run server typecheck/build. Stage `config.ts`, run `gitnexus_detect_changes({ scope: "staged" })` and cached diff check, then commit:

  ```bash
  git commit -m "feat(shop): add capability policy"
  ```

### Task 5: Implement the Per-Account ShopCoordinator

**Files:**
- Create: `avatar-web/server/src/session/shopCoordinator.ts`

**Interfaces:**
- Consumes: `GameClient` events, `FarmService`, `ShopRepository`, `ShopPolicy`, `InventoryItem`, protocol event types.
- Produces: serialized read methods, async transaction methods, cache/snapshot access, lifecycle attach/detach and operation guard.

- [ ] **Step 1: Define coordinator errors and request inputs**

  Implement `ShopError` with `status`, `code`, `message`. Export validated input types:

  ```ts
  interface CreateListingInput { slot: number; itemId: number; quantity: number; price: number; expectedShopRevision: number; expectedProduceRevision: number; idempotencyKey: string }
  interface WithdrawListingInput { slot: number; expectedShopRevision: number; expectedItemId: number; expectedQuantity: number; expectedPrice: number; idempotencyKey: string }
  interface PurchaseListingInput { idShop: number; verShop: number; expectedItemId: number; expectedQuantity: number; expectedPrice: number; expectedMarketRevision: number; idempotencyKey: string }
  interface UnlockSlotInput { type: number; expectedShopRevision: number; idempotencyKey: string }
  interface RefreshMarketInput { expectedMarketRevision: number; idempotencyKey: string }
  ```

  Validate all numeric inputs with `Number.isSafeInteger`, positive quantity/price, non-negative slot, non-empty idempotency key capped at 128 chars.

- [ ] **Step 2: Build a permanent coordinator with reconnect epochs**

  Constructor dependencies:

  ```ts
  interface ShopCoordinatorDeps {
    accountId: number;
    repository: ShopRepository;
    policy: ShopPolicy;
    emit: (type: 'shop' | 'produce', payload: unknown) => void;
    now?: () => number;
  }
  ```

  Implement `attachClient(client, connectionEpoch)` and `detachClient(reason)`. Attach exactly one listener for `shop-protocol`, `shop-protocol-error`, and `produce`; remove listeners from the previous client before attaching another. On detach, reject pending reads, mark an already-sent active transaction `unknown`, clear client references and retain last cache for viewing.

  After the first successful read sync of a new connection epoch, inspect recent `unknown` transactions and perform evidence-only reconciliation from fresh snapshots. Recovery may update status/result but must never resend the original write.

- [ ] **Step 3: Implement one serialized command lane**

  Add a private promise queue for all cmd 103 operations, one pending matcher at a time, a 10-second response timeout, queue limit 8 and minimum 300 ms between sends. Correlate using expected subtype plus optional predicate; discard stale events from older connection epochs. A timeout for read throws `SHOP_RESPONSE_TIMEOUT`; a protocol decode failure throws `SHOP_PROTOCOL_ERROR` and must not mutate state.

  The primitive must have this shape:

  ```ts
  private enqueue<T>(label: string, run: () => Promise<T>): Promise<T>;
  private request<T extends ShopProtocolEvent>(
    expectedSubType: T['subType'],
    send: (farm: FarmService) => void,
    matches?: (event: T) => boolean,
  ): Promise<T>;
  ```

- [ ] **Step 4: Implement read-only synchronization**

  `syncOwnShop()` sets `syncStatus='syncing'` and performs, in one queue entry:

  ```text
  openShop(0,-1,-1) -> await sub0
  getShopItems()     -> await sub8
  getInventory()     -> await next produce revision from cmd70
  persist cache -> set syncStatus='ready' -> emit produce -> emit shop
  ```

  `browseMarket()` performs `openShop(1,0,-1) -> await sub1`, persists market and emits shop. Neither method may call sub7. Read methods require `readEnabled` and an online client but do not require the live write allowlist.

- [ ] **Step 5: Implement the account operation guard**

  Expose `isBusy()`, `assertIdleForAutomation()` and `hasInFlightShopOperation()`. Any queued/in-flight shop command causes AutoFarm/Macro start to fail with `OPERATION_CONFLICT`; any running AutoFarm/Macro state supplied by session causes new shop commands to fail. Viewing `state()` and cached history remains available.

- [ ] **Step 6: Implement persisted transaction state transitions**

  For each write, first resolve `(accountId,idempotencyKey)` and return an existing transaction unchanged on replay. Otherwise persist `queued`, enqueue work, and return the record immediately. The background runner persists every transition:

  ```text
  queued -> sending -> awaiting_response -> reconciling -> succeeded|failed|unknown
  ```

  Transition to `failed` only for a definitive server rejection/validation failure before send; transition to `unknown` for disconnect/timeout after send. Never resubmit the write.

- [ ] **Step 7: Implement exact reconciliation per transaction kind**

  - `list`: validate expected own/produce revisions, slot, item, quantity and latest sub8 price range; send `addItemToShop`; await sub3; run own-shop plus cmd70 sync; succeed only when slot and produce delta agree.
  - `withdraw`: validate slot plus all expected listing fields; send `takeItemBack`; await sub4; run own-shop plus cmd70 sync; compare slot/inventory before succeeding.
  - `purchase`: validate listing `(idShop,verShop,expectedItemId,expectedQuantity,expectedPrice)` and expected market revision; send `buyFromShop(idShop,verShop)`; await sub5; then call `openShop(1,1,expectedItemId)`, refresh cmd70/money and reconcile listing/inventory. Do not expose quantity input.
  - `unlock`: require `slotUnlockEnabled`, allowlist and an explicitly validated type; send `unlockShopSlot(type)`; await sub2 state1; refresh own shop and confirm `numSlot` increased.
  - `refresh-market`: require `marketRefreshEnabled` and allowlist; send sub7 once; await sub6/sub7 according to the captured server response, then browse with sub1 and refresh money. Never invoke from `syncOwnShop()` or `browseMarket()`.

  Listing/withdraw require `writeEnabled` plus allowlist. Purchase requires `writeEnabled`, `purchaseEnabled` and allowlist. Unlock and paid refresh require their dedicated capability plus allowlist, and remain disabled until their live type/cost/response evidence has been approved.

- [ ] **Step 8: Provide snapshot/history access**

  Implement:

  ```ts
  state(): ShopRuntimeState;
  produceState(): ProduceSnapshot | null;
  listTransactions(limit: number): ShopTransaction[];
  syncOwnShop(): Promise<ShopRuntimeState>;
  browseMarket(): Promise<ShopRuntimeState>;
  createListing(input: CreateListingInput): ShopTransaction;
  withdrawListing(input: WithdrawListingInput): ShopTransaction;
  purchaseListing(input: PurchaseListingInput): ShopTransaction;
  unlockSlot(input: UnlockSlotInput): ShopTransaction;
  refreshMarket(input: RefreshMarketInput): ShopTransaction;
  ```

  Increment each section's `revision` on accepted state changes, stamp `connectionEpoch/capturedAt`, maintain `syncStatus`, `recentTransactions` and `lastError`, return defensive copies and persist before broadcasting.

- [ ] **Step 9: Verify coordinator with an inline fake-client harness**

  After implementation, create fakes only inside `node --import tsx --input-type=module -e`: feed protocol events, reconnect epochs and produce events; assert sequencing, queue serialization, idempotency replay, stale revision rejection, price/stock rejection, capability gates, timeout, disconnect-to-unknown and no retry. Do not add a test file. Run server typecheck/build.

- [ ] **Step 10: Scope check and commit**

  Stage only `shopCoordinator.ts`, run `gitnexus_detect_changes({ scope: "staged" })` and cached diff check, then commit:

  ```bash
  git commit -m "feat(shop): coordinate account shop operations"
  ```

### Task 6: Integrate Coordinator into AvatarSession and SessionManager

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:36-80,120-709`
- Modify: `avatar-web/server/src/session/manager.ts:1-210`

**Interfaces:**
- Consumes: `ShopCoordinator`, `ShopRepository`, `ShopPolicy`.
- Produces: snapshot fields `shop`/`produce`, typed session shop methods, lifecycle-safe reconnect behavior and AutoFarm/Macro mutual exclusion.

- [ ] **Step 1: Run HIGH-risk impact analyses**

  Run GitNexus impact for `AvatarSession`, its constructor, `connect`, `teardown`, `snapshot`, `startAuto`, `startMacro`, and `SessionManager.getOrCreate`. Report all d=1 dependents before editing; keep existing constructor call sites source-compatible by updating them in the same task.

- [ ] **Step 2: Compose one coordinator per AvatarSession**

  Extend session options with repository/policy, create the coordinator once in the `AvatarSession` constructor, and route its `shop`/`produce` events through the session’s existing account-scoped emitter. Attach the current `GameClient` with the current connection epoch during connection setup; detach before removing client listeners in every teardown/disconnect path.

- [ ] **Step 3: Extend snapshots and typed methods**

  Add `shop: ShopRuntimeState` and `produce: ProduceSnapshot | null` to `AvatarSessionSnapshot`, always populated from the coordinator (including offline cache). Add direct wrapper methods for all read/write/history operations listed in Task 5; routes must not access `FarmService` for shop operations.

- [ ] **Step 4: Enforce mutual exclusion at both boundaries**

  Before `startAuto()` or `startMacro()` changes desired/runtime state, call `shop.assertIdleForAutomation()`. Before every coordinator command, pass current `autoRunning || macroRunning` to the guard. Return `OPERATION_CONFLICT` without partially starting either side.

- [ ] **Step 5: Inject repository/policy from SessionManager**

  Extend `SessionManager` dependencies and `getOrCreate()` construction. Add a cache-backed `getShopView(userId, accountId)` path that preserves current ownership checks and can return persisted state when no live session exists. Recovery of interrupted transactions runs once at manager/bootstrap startup.

- [ ] **Step 6: Verify lifecycle behavior and commit**

  Run server typecheck, current tests and build. Use an inline fake session harness to confirm no duplicate listeners after reconnect and that snapshot remains readable offline. Stage the two files, run `gitnexus_detect_changes({ scope: "staged" })` and cached diff check, then commit:

  ```bash
  git commit -m "feat(shop): integrate coordinator with account sessions"
  ```

### Task 7: Add Typed Shop REST API and Close Cmd 103 Bypasses

**Files:**
- Create: `avatar-web/server/src/session/shopRoutes.ts`
- Modify: `avatar-web/server/src/session/routes.ts:1-380`
- Modify: `avatar-web/server/src/index.ts:1-67`

**Interfaces:**
- Consumes: authenticated account ownership middleware/pattern, `SessionManager`, `ShopError`, `ShopPolicy`.
- Produces: typed `/api/accounts/:id/shop` endpoints and explicit denial of generic cmd 103 access.

- [ ] **Step 1: Run impact analysis**

  Run GitNexus impact for `sessionRouter`, `SessionManager`, and server bootstrap in `index.ts`. Confirm auth/ownership lookup behavior used by existing account routes.

- [ ] **Step 2: Implement request parsing and error mapping**

  `shopRoutes.ts` must parse integer account/slot/body fields without coercing decimals or NaN, cap transaction history limit to `1..100`, and map `ShopError` status/code into `ShopApiErrorBody`. Unexpected errors log stack server-side without request body and return `SHOP_PROTOCOL_ERROR`.

- [ ] **Step 3: Add read endpoints**

  Implement:

  ```text
  GET  /:id/shop
  POST /:id/shop/sync
  POST /:id/shop/browse
  GET  /:id/shop/transactions?limit=50
  ```

  GET returns live state or persisted cache after ownership verification. Sync/browse require an online session and return the updated `ShopRuntimeState`.

- [ ] **Step 4: Add write endpoints returning 202**

  Implement:

  ```text
  POST /:id/shop/listings
  POST /:id/shop/listings/:slot/withdraw
  POST /:id/shop/purchases
  POST /:id/shop/slots/unlock
  POST /:id/shop/market/refresh
  ```

  All write bodies require `idempotencyKey`; a newly accepted write returns HTTP 202 and the persisted `ShopTransaction`. A replay returns the same record without resending, using 202 while non-terminal and 200 when already terminal.

- [ ] **Step 5: Deny generic bypasses**

  In `/:id/farm`, reject these action names with `SHOP_CAPABILITY_DISABLED`: `openShop`, `unlockShopSlot`, `addItemToShop`, `takeItemBack`, `buyFromShop`, `refreshShop`, `getShopItems`. In `/:id/raw`, reject `cmd === 103` unless non-production protocol debug is explicitly enabled; even debug mode must still require account ownership and must not be exposed in production.

- [ ] **Step 6: Wire bootstrap dependencies**

  Instantiate one `ShopRepository`, call recovery, pass repository/policy into `SessionManager`, mount `shopRouter` under `/api/accounts`, and pass policy into `sessionRouter` for raw-command gating. Do not change WebSocket subscription isolation.

- [ ] **Step 7: Verify routes and commit**

  Run server typecheck/tests/build. With an ephemeral DB and fake manager in an inline harness, verify validation/error status, idempotent replay status and cmd103 bypass denial. Stage only the three files, run `gitnexus_detect_changes({ scope: "staged" })` and cached diff check, then commit:

  ```bash
  git commit -m "feat(shop): expose guarded shop APIs"
  ```

### Task 8: Add Frontend Shop DTOs and Realtime Reducer Support

**Files:**
- Modify: `avatar-web/web/src/types.ts:1-376`
- Modify: `avatar-web/web/src/accounts/accountRuntime.ts:1-85`

**Interfaces:**
- Consumes: server `ShopRuntimeState`, `ProduceSnapshot`, `ShopTransaction` JSON and WebSocket envelopes.
- Produces: frontend DTOs and reducer handling for `shop`/`produce`.

- [ ] **Step 1: Run impact analysis**

  Run GitNexus impact for `SessionSnapshot` and `reduceAccountRuntimeEvent`. Inspect all fixture/object-literal callers so the migration does not force edits to existing test files.

- [ ] **Step 2: Mirror server DTOs exactly**

  Add TypeScript interfaces for own slots, market listings, price rules, capabilities, produce, runtime state and transactions. Add `shop?: ShopRuntimeState` and `produce?: ProduceSnapshot | null` to `SessionSnapshot` for rolling compatibility; backend is still required to populate them. Use `connectionEpoch` throughout, matching the server contract.

- [ ] **Step 3: Reduce realtime events atomically**

  Add:

  ```ts
  case 'shop':
    return { ...snapshot, shop: event.payload as ShopRuntimeState };
  case 'produce':
    return { ...snapshot, produce: event.payload as ProduceSnapshot };
  ```

  Preserve all unrelated snapshot fields. For `produce`, reject an older `connectionEpoch` directly; for a full `shop` event, compare the maximum epoch present in `own`, `market` and `priceRules` against the current shop state before replacement.

- [ ] **Step 4: Verify and commit**

  Run `npm test` and `npm run build` in `avatar-web/web`. Stage the two files, run `gitnexus_detect_changes({ scope: "staged" })` and cached diff check, then commit:

  ```bash
  git commit -m "feat(shop): add web shop runtime state"
  ```

### Task 9: Build the ShopPanel Interaction UI

**Files:**
- Create: `avatar-web/web/src/accounts/panels/ShopPanel.tsx`

**Interfaces:**
- Consumes: `apiGet`, `apiPost`, account/session snapshot, item catalogs, shop capabilities.
- Produces: read-only views, confirmation forms and typed REST mutations; no direct WebSocket or game protocol access.

- [ ] **Step 1: Define component inputs and safe defaults**

  Accept account id/name, online state, `shop`, `produce`, and existing tree/animal/item/food catalogs. If shop data is absent, render a cache-empty state and a capability-aware sync button. Resolve names by catalog IDs/product IDs; unknown values render `#<itemId>` rather than a guessed Vietnamese name.

- [ ] **Step 2: Implement three tabs**

  - `Sạp của tôi`: slot, item, quantity, price, sale/timeout state, `canOpenSlot`, eligible produce and latest revision/time.
  - `Chợ`: listing identity, item, quantity, price, refresh/browse controls and stale timestamp.
  - `Giao dịch`: newest-first transaction status, kind, timestamps and error; `unknown` is visually explicit and has no retry button.

- [ ] **Step 3: Implement read actions**

  Sync calls `POST /shop/sync`; browse calls `POST /shop/browse`; history calls `GET /shop/transactions?limit=50`. Disable concurrent buttons locally and rely on WebSocket as the authoritative subsequent state.

- [ ] **Step 4: Implement listing modal and validation**

  The item dropdown is the intersection of latest produce and latest price-rule item IDs. Quantity may not exceed produce quantity. Price must be within inclusive min/max. Submit body includes `slot`, `expectedShopRevision`, `expectedProduceRevision` and `crypto.randomUUID()` as `idempotencyKey`.

- [ ] **Step 5: Implement destructive confirmations**

  Withdraw confirmation submits `expectedShopRevision`, `expectedItemId`, `expectedQuantity` and `expectedPrice`. Purchase confirmation includes listing/item/quantity/price but no editable quantity input, and submits exact `idShop`, `verShop`, `expectedItemId`, `expectedQuantity`, `expectedPrice`, `expectedMarketRevision`. Unlock and paid refresh show separate cost/capability warnings and never share the read-only browse button.

- [ ] **Step 6: Enforce capability and online UX**

  Hide or disable write controls based on backend capabilities, online state and active transaction; never infer permission solely from frontend env. Surface structured API error code/message and keep cached tables visible on error/offline.

- [ ] **Step 7: Verify and commit**

  Run web tests/build. Perform a static DOM review of empty, offline-cache, active, failed and unknown states using the existing dev environment if available; do not send live writes. Stage `ShopPanel.tsx`, run `gitnexus_detect_changes({ scope: "staged" })` and cached diff check, then commit:

  ```bash
  git commit -m "feat(shop): add farm shop operations panel"
  ```

### Task 10: Mount the Panel, Style It, and Run End-to-End Verification

**Files:**
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx:1-111`
- Modify: `avatar-web/web/src/styles.css:1-1238`
- Modify: `docs/superpowers/plans/2026-08-20-avatar-farm-shop-integration.md` (checkbox tracking only)

**Interfaces:**
- Consumes: `ShopPanel`, current account runtime snapshot/catalog props.
- Produces: visible integrated shop UI and final verification evidence.

- [ ] **Step 1: Run impact analysis**

  Run GitNexus impact for `AccountOperationsDrawer`; confirm its LOW-risk direct callers and prop flow. Inspect style naming collisions before adding selectors.

- [ ] **Step 2: Mount ShopPanel in the drawer**

  Import and render `ShopPanel` immediately after `AssetsPanel`, passing only current-account snapshot/catalog data. Keep existing panel order and behavior unchanged.

- [ ] **Step 3: Add scoped responsive styles**

  Add `.shop-panel`, `.shop-tabs`, `.shop-table`, `.shop-status-*`, `.shop-actions` and `.shop-modal` selectors. Reuse existing color/spacing variables; tables must scroll horizontally on narrow viewports, focus states remain visible, and failed/unknown/succeeded states cannot be distinguished by color alone.

- [ ] **Step 4: Run complete automated verification**

  From repository root:

  ```bash
  cd avatar-web/server
  npm run typecheck
  npm test
  npm run build

  cd ../web
  npm test
  npm run build

  cd ../..
  git diff --check
  ```

  Expected: all commands exit 0; no new or modified test file; generated build artifacts are not staged.

- [ ] **Step 5: Perform controlled read-only runtime acceptance**

  With `SHOP_READ_ENABLED=true` and every write flag false, start the existing server/web stack and verify in browser:

  - unauthenticated/cross-owner access remains denied;
  - own shop sync executes sub0 -> sub8 -> cmd70 and updates UI once per response;
  - market browse executes sub1 and does not send sub7;
  - reconnect does not duplicate events;
  - offline drawer shows persisted cache and observed timestamps;
  - raw/farm cmd103 bypasses are denied.

  If no controlled account/server is available, record these checks as not executed rather than claiming success.

- [ ] **Step 6: Run live-write acceptance only after explicit user authorization**

  Enable one capability at a time for a single allowlisted account. Capture transaction rows and UI state for list, withdraw, purchase, unlock and paid refresh; deliberately test disconnect-after-send only in an approved disposable scenario. Confirm `unknown` never triggers a retry. Disable flags again after verification.

- [ ] **Step 7: Final GitNexus scope check and commit**

  Stage only drawer/styles plus checkbox updates, run `gitnexus_detect_changes({ scope: "staged" })`, inspect every affected execution flow, run `git diff --cached --check`, then commit:

  ```bash
  git commit -m "feat(shop): integrate farm shop into account drawer"
  ```

- [ ] **Step 8: Refresh the GitNexus index after the final commit**

  Inspect `.gitnexus/meta.json` first. If `stats.embeddings > 0`, run `npx gitnexus analyze --embeddings`; otherwise run `npx gitnexus analyze`. Expected: index reports current commit and no stale warning.

## Delivery Gates

- [ ] **Gate A — P0:** Task 1-2 complete; cmd103 decoder and corrected wire encoding verified.
- [ ] **Gate B — P1:** Task 3-8 read path complete; cache, session, REST, WebSocket and frontend state work with all write flags false.
- [ ] **Gate C — P2:** Listing/withdraw enabled only after read-only live evidence and explicit user approval.
- [ ] **Gate D — P3:** Purchase/unlock/paid refresh enabled independently, each with allowlist and explicit user approval.
- [ ] **Gate E — P4:** Full build/tests, route bypass denial, reconnect recovery, transaction audit and rate/operation guards verified.

## Plan Review Checklist

- [ ] Every cmd103 TX/RX field width and conditional body matches the approved spec.
- [ ] Decoder and GameClient are side-effect free with respect to follow-up requests.
- [ ] One coordinator serializes cmd103 per account and owns reconciliation.
- [ ] Produce uses cmd70 section 3 and includes revision/epoch/timestamp.
- [ ] Write transactions are idempotent and never auto-retried.
- [ ] AutoFarm/Macro and shop operations are mutually exclusive at both entry boundaries.
- [ ] Generic farm/raw routes cannot bypass shop safety.
- [ ] UI never sends secrets, never exposes purchase quantity and clearly represents `unknown`.
- [ ] No test file is created or modified unless the user later changes the requirement.
- [ ] Implementation does not begin until the user approves this plan.
