# Avatar Farm Shop Market Status 0 Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa hoàn chỉnh luồng chợ cmd 103 sub1 để web đọc đủ catalog `status=0`, cho người dùng chọn từng nông sản rồi tải seller listings `status=1`, không phát sinh trailing-byte warning hoặc thao tác ghi ngoài ý muốn.

**Architecture:** Decoder tách catalog và listings thành hai protocol event có discriminator; `ShopCoordinator` giữ aggregate market state và dùng pending request context để gắn response `status=1` với đúng item người dùng chọn. REST giữ endpoint catalog hiện có, thêm endpoint browse theo item; React hiển thị hai view local catalog/detail trên cùng snapshot WebSocket.

**Tech Stack:** TypeScript, Node.js, Express, TCP game protocol, better-sqlite3, WebSocket, React, Vite, Vitest hiện hữu, GitNexus CLI/MCP.

**Spec:** `docs/superpowers/specs/2026-08-20-avatar-farm-shop-market-status0-correction-design.md`

## Global Constraints

- Triển khai tuần tự theo task và tích `- [x]` ngay sau khi từng step thật sự hoàn thành; không đánh dấu dựa trên code chưa verify.
- Không dùng TDD và không tạo/sửa test file vì user không yêu cầu. Production code được viết trước; verification dùng packet harness dùng một lần, test suite hiện hữu và live UI.
- Trước khi sửa bất kỳ symbol hiện hữu nào, chạy `gitnexus_impact({ target: "<symbol>", direction: "upstream" })`, ghi nhận direct callers và affected processes. Nếu GitNexus báo HIGH hoặc CRITICAL, dừng trước edit và báo user blast radius cụ thể.
- Trước mỗi commit, chỉ stage files thuộc task, chạy `gitnexus_detect_changes({ scope: "staged" })`, kiểm tra toàn bộ d=1 dependents và `git diff --cached --check`.
- Không stage hoặc ghi đè thay đổi sẵn có của user trong `AGENTS.md`, `CLAUDE.md` hay file ngoài danh sách task.
- Mọi request trong correction này là read-only: chỉ được gửi `openShop(1,0,-1)` hoặc `openShop(1,1,itemId)`. Không gửi sub7, không bật buy/list/withdraw/unlock, không đổi capability write.
- `priceRefresh` được lưu và hiển thị bằng nhãn trung tính; không suy diễn loại tiền và không dùng nó để cho phép paid refresh.
- `status=1` không mang `itemId` discriminator ngoài từng listing; coordinator chỉ được apply response khi pending request khớp epoch, subtype, event kind và có `marketItemId` context.
- Legacy seller listings thiếu `selectedItemId` tin cậy phải bị loại khi normalize cache; không được dùng để hiển thị hoặc mua.
- Không thay schema SQL. `market_snapshot_json` tiếp tục lưu `ShopSnapshot<MarketData>`.
- Live acceptance chỉ dùng account 2 với mọi write flag false; nút **Quay lại danh mục** phải là state local và tuyệt đối không gửi packet.

## Runtime Contracts Dùng Chung

Server và web phải dùng cùng shape:

```ts
export interface MarketCatalogItem {
  itemId: number;
  price: number;
}

export interface MarketData {
  catalog: MarketCatalogItem[];
  timeRefresh: number | null;
  priceRefresh: number | null;
  selectedItemId: number | null;
  listings: MarketListing[];
}

export type MarketProtocolEvent =
  | {
      subType: 1;
      kind: 'market-catalog';
      status: 0;
      items: MarketCatalogItem[];
      timeRefresh: number;
      priceRefresh: number;
    }
  | {
      subType: 1;
      kind: 'market-listings';
      status: 1;
      listings: MarketListing[];
    };
```

REST contract mới:

```text
POST /api/accounts/:id/shop/browse
Body: none
Result: catalog step0

POST /api/accounts/:id/shop/browse/:itemId
Body: { "expectedMarketRevision": <non-negative integer> }
Result: seller listings step1 for the selected item
```

## Packet Fixtures Dùng Cho Verification

Packet catalog live từ account 2:

```text
0100000300020000000500c800000002000700000001000006190000000a
```

Expected:

```json
{
  "kind": "market-catalog",
  "status": 0,
  "items": [
    { "itemId": 2, "price": 5 },
    { "itemId": 200, "price": 2 },
    { "itemId": 7, "price": 1 }
  ],
  "timeRefresh": 1561,
  "priceRefresh": 10
}
```

Packet seller listings synthetic một record:

```text
010100010000000500c80002000000070000000a
```

Expected listing: `{idShop:5, verShop:200, itemId:2, quantity:7, price:10}` và không có trailing bytes.

### Task 1: Correct Cmd 103 Sub1 Decoder and Protocol Documentation

**Files:**
- Modify: `avatar-web/server/src/game/shopProtocol.ts`
- Modify: `docs/Phân tích kỹ thuật giao thức  — cmd 103 trong AvatarHD.md`

**Interfaces:**
- Consumes: `MyReader`, `validateCount`, cmd 103 sub1 raw body.
- Produces: `MarketCatalogItem`, discriminated `market-catalog`/`market-listings` events, accurate status0/status1 technical documentation.

- [x] **Step 1: Run GitNexus impact before decoder edits**

  Run impact for `decodeShopPacket` and inspect context for `ShopProtocolEvent`:

  ```text
  gitnexus_impact({ target: "decodeShopPacket", direction: "upstream" })
  gitnexus_context({ name: "ShopProtocolEvent" })
  ```

  Record all d=1 consumers, especially `GameClient.handleShopMessage`, `ShopCoordinator.onShopProtocol`, and any exhaustive event switches. If risk is HIGH/CRITICAL, report it before continuing.

- [x] **Step 2: Split sub1 into two exact decoder branches**

  Add `MarketCatalogItem`, replace the old `market-snapshot` union member, and implement sub1 with explicit status validation:

  ```ts
  case 1: {
    const status = readByte(reader, 'market.status', body);
    const count = readShort(reader, 'market.count', body);

    if (status === 0) {
      validateCount(count, MAX_MARKET_LISTINGS, 'market.catalog.count', reader, body, 6, 8);
      const items: MarketCatalogItem[] = [];
      for (let index = 0; index < count; index += 1) {
        items.push({
          itemId: readShort(reader, `market.catalog[${index}].itemId`, body),
          price: readInt(reader, `market.catalog[${index}].price`, body),
        });
      }
      const timeRefresh = readInt(reader, 'market.timeRefresh', body);
      const priceRefresh = readInt(reader, 'market.priceRefresh', body);
      return {
        subType: 1,
        kind: 'market-catalog',
        status: 0,
        items,
        timeRefresh,
        priceRefresh,
      };
    }

    if (status === 1) {
      validateCount(count, MAX_MARKET_LISTINGS, 'market.listings.count', reader, body, 16);
      const listings: MarketListing[] = [];
      for (let index = 0; index < count; index += 1) {
        listings.push({
          index,
          idShop: readInt(reader, `market.listings[${index}].idShop`, body),
          verShop: readShort(reader, `market.listings[${index}].verShop`, body),
          itemId: readShort(reader, `market.listings[${index}].itemId`, body),
          quantity: readInt(reader, `market.listings[${index}].quantity`, body),
          price: readInt(reader, `market.listings[${index}].price`, body),
        });
      }
      return { subType: 1, kind: 'market-listings', status: 1, listings };
    }

    throw new ShopProtocolDecodeError(
      `market.status không hỗ trợ: ${status}`,
      reader.position - 3,
      body,
    );
  }
  ```

  Reuse the existing bounded read helpers and existing listing record semantics. Do not infer `selectedItemId` inside the decoder.

- [x] **Step 3: Update cmd 103 analysis with verified wire evidence**

  Replace the obsolete statement “status0 has no extra data” with both schemas:

  ```text
  status=0: i16 count; repeat(i16 itemId,i32 price); i32 timeRefresh; i32 priceRefresh
  status=1: i16 count; repeat(i32 idShop,i16 verShop,i16 itemId,i32 quantity,i32 price)
  ```

  Include the live packet fixture, decoded values, native evidence at `0x637980`, and action evidence at `0x800928`. Label `priceRefresh=10` as an opaque server value, not a confirmed currency price.

- [x] **Step 4: Verify decoder after production code**

  Run a one-off TypeScript harness without creating a test file:

  ```bash
  cd avatar-web/server
  node --import tsx --input-type=module -e "import { decodeShopPacket } from './src/game/shopProtocol.ts'; const cases=['0100000300020000000500c800000002000700000001000006190000000a','010100010000000500c80002000000070000000a']; for (const hex of cases) { const decoded=decodeShopPacket(Buffer.from(hex,'hex')); if (decoded.warning) throw new Error(JSON.stringify(decoded.warning)); console.log(JSON.stringify(decoded.event)); }"
  npm run typecheck
  ```

  Expected: first event matches all three catalog records plus `1561/10`; second event contains one listing; neither event has `TRAILING_BYTES`. Also run a second inline invocation with unsupported status and truncated status0/status1 bodies and assert each throws `ShopProtocolDecodeError` before any state mutation.

- [x] **Step 5: Detect scope, mark task steps, and commit**

  Mark Task 1 steps complete in this plan, stage only Task 1 files plus this plan, run staged GitNexus change detection and diff checks, then commit:

  ```bash
  git diff --check
  git diff --cached --check
  git commit -m "fix(shop): decode market catalog packets"
  ```

### Task 2: Normalize Market State and Correlate Item-Specific Responses

**Files:**
- Modify: `avatar-web/server/src/accounts/shopRepo.ts`
- Modify: `avatar-web/server/src/session/shopCoordinator.ts`

**Interfaces:**
- Consumes: discriminated protocol events from Task 1, current connection epoch, `ShopSnapshot`, persisted `market_snapshot_json`.
- Produces: `MarketData`, legacy-cache normalization, `browseMarketCatalog()`, `browseMarketItem()`, pending request context safe for seller listings.

- [x] **Step 1: Run impact analysis for every state/coordinator symbol to edit**

  ```text
  gitnexus_impact({ target: "ShopRuntimeState", direction: "upstream" })
  gitnexus_impact({ target: "ShopRepository.loadCache", direction: "upstream" })
  gitnexus_impact({ target: "ShopCoordinator", direction: "upstream" })
  gitnexus_impact({ target: "ShopCoordinator.onShopProtocol", direction: "upstream" })
  gitnexus_impact({ target: "ShopCoordinator.applyProtocolEvent", direction: "upstream" })
  gitnexus_impact({ target: "ShopCoordinator.browseMarket", direction: "upstream" })
  ```

  Inspect each returned d=1 caller. Coordinator changes touch request correlation and transaction reconciliation, so any HIGH/CRITICAL result must be shown to the user before edit.

- [x] **Step 2: Replace legacy market shape and normalize persisted JSON**

  Define `MarketData` in `shopRepo.ts` using the shared contract. Add a bounded shape guard for `market_snapshot_json` rather than blindly casting `JSON.parse()`.

  Normalization rules must be exact:

  ```ts
  const emptyMarketData = (): MarketData => ({
    catalog: [],
    timeRefresh: null,
    priceRefresh: null,
    selectedItemId: null,
    listings: [],
  });

  // New shape: validate snapshot metadata, every catalog/listing record and nullable fields.
  // Legacy { status, listings }: preserve snapshot metadata but replace data with emptyMarketData().
  // Invalid JSON/shape: return null so untrusted cache is not emitted as ready state.
  ```

  `loadCache()` must continue loading valid own/rules snapshots independently if market cache is invalid. Reconnect continues marking cached state stale through the existing epoch path.

- [x] **Step 3: Add typed pending request context without changing unrelated requests**

  Extend the existing pending request record and request helpers with an optional fourth argument:

  ```ts
  interface ShopRequestContext {
    marketItemId?: number;
  }

  interface PendingShopResponse<T extends ShopProtocolEvent = ShopProtocolEvent> {
    epoch: number;
    expectedSubTypes: ReadonlySet<ShopProtocolEvent['subType']>;
    matches?: (event: ShopProtocolEvent) => event is T;
    context: ShopRequestContext;
    // existing resolve/reject/timer fields remain unchanged
  }

  private request<T extends ShopProtocolEvent>(
    expectedSubType: ShopProtocolEvent['subType'],
    send: () => void,
    matches?: (event: ShopProtocolEvent) => event is T,
    context: ShopRequestContext = {},
  ): Promise<T>;
  ```

  Preserve every existing call by keeping matcher and context optional. Do not store `lastSelectedItemId` as implicit global correlation state.

- [x] **Step 4: Implement catalog and item browse operations**

  Replace the public market read seam with:

  ```ts
  export interface BrowseMarketItemInput {
    itemId: number;
    expectedMarketRevision: number;
  }

  browseMarketCatalog(): Promise<ShopRuntimeState>;
  browseMarketItem(input: BrowseMarketItemInput): Promise<ShopRuntimeState>;
  ```

  `browseMarketCatalog()` serializes in the existing command lane, sends `farm.openShop(1, 0, -1)`, and matches only `event.kind === 'market-catalog'`.

  `browseMarketItem()` must, before TX:

  1. enforce the existing read capability, online/idle state and current connection epoch;
  2. require a current market snapshot whose revision equals `expectedMarketRevision`;
  3. require `itemId` to exist in `market.data.catalog`;
  4. send `farm.openShop(1, 1, itemId)` once;
  5. await only `market-listings` with `{ marketItemId: itemId }` as pending context.

  Stale revision/item must throw the existing `STALE_SHOP_STATE` error before any packet is sent.

- [x] **Step 5: Apply protocol events atomically with verified context**

  In `onShopProtocol`, resolve current pending request and compute epoch/subtype/discriminator match before calling `applyProtocolEvent`. Pass context only for a fully matching pending response.

  Apply state using these transitions:

  ```ts
  case 'market-catalog':
    next.market = snapshot({
      catalog: event.items,
      timeRefresh: event.timeRefresh,
      priceRefresh: event.priceRefresh,
      selectedItemId: null,
      listings: [],
    });
    break;

  case 'market-listings': {
    const selectedItemId = context?.marketItemId;
    if (selectedItemId === undefined) {
      throw new ShopError('SHOP_PROTOCOL_ERROR', 'Seller listings thiếu market item context');
    }
    const previous = next.market?.data ?? emptyMarketData();
    next.market = snapshot({ ...previous, selectedItemId, listings: event.listings });
    break;
  }
  ```

  An unsolicited/mismatched listings event must not persist, increment revision or emit a trusted market snapshot. It must produce the existing structured protocol error/log path without rejecting an unrelated pending subtype.

- [x] **Step 6: Update purchase and paid-refresh reconciliation to the aggregate**

  All code that reads `market.data.listings` must also require `market.data.selectedItemId === expectedItemId` before using a listing. Purchase reconciliation step1 must request `openShop(1,1,expectedItemId)` with matching context. Paid refresh step0 must match `market-catalog`; it remains capability-gated and disabled by default. Unknown-outcome evidence must never use legacy/unselected listings.

- [x] **Step 7: Verify server state/coordinator production code**

  Run:

  ```bash
  cd avatar-web/server
  npm run typecheck
  npm run build
  npm test
  ```

  Expected: exit 0, no test file changes, no remaining `market-snapshot` discriminator or direct `{ status, listings }` construction. Inspect with:

  ```bash
  rg -n "market-snapshot|market\.data\.status|status: number; listings" src
  ```

  Expected: no production match. Use a one-off inline repository harness against a temporary SQLite database to insert one legacy market snapshot, call `loadCache()`, and assert its normalized data equals empty `MarketData`; do not add the harness to Git.

- [x] **Step 8: Detect scope, mark task steps, and commit**

  Mark Task 2 complete only after all checks pass. Stage `shopRepo.ts`, `shopCoordinator.ts` and this plan; run `gitnexus_detect_changes({ scope: "staged" })`, review d=1 processes, then:

  ```bash
  git diff --cached --check
  git commit -m "fix(shop): correlate catalog and seller listings"
  ```

### Task 3: Expose Item-Specific Browse Through Session and REST

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`
- Modify: `avatar-web/server/src/session/shopRoutes.ts`
- Modify: `avatar-web/web/src/types.ts`

**Interfaces:**
- Consumes: coordinator operations and `MarketData` from Task 2.
- Produces: typed session methods, `POST /shop/browse/:itemId`, matching frontend DTO.

- [x] **Step 1: Run impact analysis for session, route, and frontend DTO symbols**

  ```text
  gitnexus_impact({ target: "AvatarSession.browseShop", direction: "upstream" })
  gitnexus_impact({ target: "shopRouter", direction: "upstream" })
  gitnexus_impact({ target: "ShopRuntimeState", direction: "upstream" })
  ```

  Inspect direct consumers before edits and report HIGH/CRITICAL risk if returned.

- [x] **Step 2: Add explicit session methods**

  Expose coordinator methods without protocol logic in `AvatarSession`:

  ```ts
  browseShopCatalog(): Promise<ShopRuntimeState> {
    return this.requireShop().browseMarketCatalog();
  }

  browseShopItem(input: BrowseMarketItemInput): Promise<ShopRuntimeState> {
    return this.requireShop().browseMarketItem(input);
  }
  ```

  Update the existing catalog route caller from `browseShop()` to `browseShopCatalog()`; remove the ambiguous method only after all d=1 callers are migrated.

- [x] **Step 3: Add and validate the item browse endpoint**

  Keep `POST /:id/shop/browse` unchanged externally. Add:

  ```ts
  router.post('/:id/shop/browse/:itemId', owned, async (req, res) => {
    try {
      const itemId = routeItemId(req.params.itemId);
      const body = bodyObject(req.body);
      const expectedMarketRevision = integerField(body, 'expectedMarketRevision');
      const session = requireLiveSession(sessions, accountId(req));
      const shop = await session.browseShopItem({ itemId, expectedMarketRevision });
      res.json({ shop, produce: session.shopProduceState() });
    } catch (error) {
      apiError(res, error);
    }
  });
  ```

  Implement `routeItemId()` beside `routeSlot()` using decimal-only parsing and range `[0, 32_767]`. Reuse the route's existing account ownership/session lookup and `apiError()` rather than introducing parallel mapping. Reject negative/out-of-range item IDs and negative revision as `INVALID_SHOP_REQUEST`; stale coordinator errors must retain HTTP 409 mapping.

- [x] **Step 4: Mirror the aggregate DTO in web types**

  Add `MarketCatalogItem` and `MarketData` to `avatar-web/web/src/types.ts`, then change only:

  ```ts
  market: ShopSnapshot<MarketData> | null;
  ```

  Keep every other shop/transaction/capability field binary-compatible with current WebSocket snapshots.

- [x] **Step 5: Verify API and type contracts**

  ```bash
  cd avatar-web/server
  npm run typecheck
  npm run build
  cd ../web
  npm run build
  ```

  Expected: exit 0. Inspect the route table/source to confirm catalog and item endpoints coexist, both use ownership middleware, and neither uses live-write capability checks.

- [x] **Step 6: Detect scope, mark task steps, and commit**

  Mark Task 3 complete, stage only the three production files plus this plan, run staged GitNexus change detection, then:

  ```bash
  git diff --cached --check
  git commit -m "fix(shop): expose item specific market browse"
  ```

### Task 4: Build the Two-Stage Market Browser UI

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/ShopPanel.tsx`
- Modify: `avatar-web/web/src/styles.css` (only if existing utility/shop classes cannot express the layout)

**Interfaces:**
- Consumes: `ShopRuntimeState.market.data.catalog`, refresh metadata, selected item/listings, catalog/item REST endpoints.
- Produces: catalog view, user-triggered seller detail view, packet-free local back navigation.

- [x] **Step 1: Run impact analysis before editing the panel**

  ```text
  gitnexus_impact({ target: "ShopPanel", direction: "upstream" })
  ```

  Review account-drawer consumers and report HIGH/CRITICAL risk before edit.

- [x] **Step 2: Make read actions return success and accept an optional body**

  Refine the existing helper without changing write helpers:

  ```ts
  async function runRead(
    label: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<boolean> {
    setBusy(label);
    setError(null);
    try {
      await apiPost<ShopViewResponse>(path, body);
      return true;
    } catch (caught) {
      setError(errorDetails(caught));
      return false;
    } finally {
      setBusy(null);
    }
  }
  ```

  Existing no-body read calls must continue working.

- [x] **Step 3: Add explicit local catalog/detail navigation**

  Add state and handlers scoped to the Chợ tab:

  ```ts
  const [marketView, setMarketView] = useState<'catalog' | 'listings'>('catalog');

  async function browseCatalog(): Promise<void> {
    if (await runRead('browse-market', shopPath('browse'))) {
      setMarketView('catalog');
    }
  }

  async function browseItem(itemId: number): Promise<void> {
    const revision = shop?.market?.revision;
    if (revision === undefined) return;
    if (await runRead(`browse-market-${itemId}`, shopPath(`browse/${itemId}`), {
      expectedMarketRevision: revision,
    })) {
      setMarketView('listings');
    }
  }
  ```

  Wire **Cập nhật chợ** to `browseCatalog()`. **Quay lại danh mục** must only call `setMarketView('catalog')`; it must not call REST or alter the server snapshot.

- [x] **Step 4: Render catalog and seller listings from the new aggregate**

  Catalog view requirements:

  - one row/card per `catalog` record;
  - display known produce name with `#itemId` fallback for unknown item `200`;
  - display `price` as **Giá server**, not purchase price/currency;
  - display `timeRefresh` as seconds remaining and `priceRefresh` as **Giá làm mới server (chưa xác định loại tiền)**;
  - each row has enabled **Xem sạp bán** only while no read action is pending.

  Detail view requirements:

  - heading identifies `selectedItemId` and product name;
  - rows retain current `idShop`, `quantity`, `price` columns;
  - existing buy button remains governed by purchase capability and current state;
  - empty status1 response shows “Chưa có sạp bán nông sản này”; it does not fall back to another item's listings;
  - **Quay lại danh mục** remains available without TX.

  Preserve the disabled paid sub7 area and explanatory text. Use scoped CSS only if needed; do not change drawer backdrop/z-index behavior unrelated to the shop panel.

- [x] **Step 5: Verify web production code and visible DOM**

  ```bash
  cd avatar-web/web
  npm run build
  npm test
  ```

  Expected: exit 0, no test file changes. With a populated state, inspect the DOM to confirm all catalog controls are real enabled `button` elements, no invisible overlay intercepts pointer events, and busy state disables only the active read action rather than the whole shop panel.

- [x] **Step 6: Detect scope, mark task steps, and commit**

  Mark Task 4 complete, stage the panel, scoped CSS if changed, and this plan; run staged GitNexus change detection, then:

  ```bash
  git diff --cached --check
  git commit -m "fix(shop): add two stage market browser"
  ```

### Task 5: Full Regression, Live Read-Only Acceptance, and Documentation Closure

**Files:**
- Modify: `docs/superpowers/plans/2026-08-20-avatar-farm-shop-integration.md`
- Modify: `docs/superpowers/plans/2026-08-20-avatar-farm-shop-market-status0-correction.md`
- Modify: `docs/superpowers/specs/2026-08-20-avatar-farm-shop-market-status0-correction-design.md` only if verification evidence requires a factual correction.

**Interfaces:**
- Consumes: complete server/web correction from Tasks 1-4 and live account 2 read flow.
- Produces: full verification evidence, corrected parent-plan record, completed checkbox ledger.

- [x] **Step 1: Run the complete existing automated verification matrix**

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

  Expected: every command exits 0. Run `git diff --name-only -- avatar-web | rg '(^|/)(__tests__|tests?/|[^/]+\.(test|spec)\.)'` and expect no output, confirming no test file was created or modified.

  **Result (2026-08-20):** Passed: server typecheck exit 0, 254/254 server tests, server build exit 0, 72/72 web tests, web build exit 0 and `git diff --check` clean. No test file changed. Production search found no remaining `market-snapshot`, `market.data.status` or legacy market-shape match. The positive decoder fixture, unsupported/truncated negative harness, cache/coordinator safety harnesses and DOM one-off harness also passed; these harnesses are not live account evidence.

- [x] **Step 2: Perform live account 2 catalog acceptance**

  With `SHOP_READ_ENABLED=true` and all write flags false:

  1. open `/accounts/2` and tab **Chợ**;
  2. click **Cập nhật chợ** once;
  3. confirm exactly one TX body `01 00 ff ff`;
  4. confirm RX decodes three catalog rows `(2,5)`, `(200,2)`, `(7,1)`, `timeRefresh`, `priceRefresh`;
  5. confirm runtime log has no `cmd 103 sub1 còn ... byte chưa đọc` for this valid packet;
  6. confirm all three **Xem sạp bán** buttons are clickable.

  **Result (2026-08-20):** Live account 2 sent exactly one TX `01 00 ff ff` at 13:36:12 and received `0100000300320000000300c800000003003700000002000007080000000a`. The current server-dynamic catalog decoded as `(50,3)`, `(200,3)`, `(55,2)`, `timeRefresh=1800`, `priceRefresh=10`; the historical `(2,5)`, `(200,2)`, `(7,1)` fixture remains decoder evidence rather than a fixed catalog invariant. DOM showed three enabled **Xem sạp bán** buttons with `#200` fallback, and runtime UI contained zero trailing-byte/protocol-error warnings.

- [x] **Step 3: Perform live item-selection and local-back acceptance**

  For each catalog item, click **Xem sạp bán** and confirm exactly one corresponding TX:

  ```text
  item 2   -> 01 01 00 02
  item 200 -> 01 01 00 c8
  item 7   -> 01 01 00 07
  ```

  Confirm each status1 response updates `selectedItemId` and only that item's listings. Click **Quay lại danh mục** and verify no new cmd 103 TX occurs. A zero-listing response must render the correct empty detail state.

  **Result (2026-08-20):** The current catalog produced exactly one TX/RX pair per selection: item 50 -> TX `01 01 00 32`, three listings, revision 5; item 200 -> TX `01 01 00 c8`, three listings, revision 6; item 55 -> TX `01 01 00 37`, two listings, revision 7. Each detail heading and every returned listing matched the selected item. Three local-back clicks restored the same catalog without TX: final traffic remained four cmd103 TX and four RX total (one catalog plus three item requests). The existing DOM harness covers the zero-listing detail message.

- [x] **Step 4: Verify safety invariants and persisted/realtime state**

  Confirm:

  - no TX sub7 and no cmd 103 write subtype during acceptance;
  - no money/inventory delta caused by catalog/detail reads;
  - SQLite `market_snapshot_json` contains the new aggregate shape;
  - WebSocket/DOM revision advances once per accepted catalog/listings response;
  - unsolicited listings without pending item context are rejected and do not mutate the persisted snapshot;
  - reconnect marks the last aggregate stale until the next valid read.

  **Result (2026-08-20):** Debug traffic contained only `0100ffff`, `01010032`, `010100c8` and `01010037`; no sub7 or cmd103 write subtype was sent. Cached balances stayed `xu=4705`, `luong=0`, `luongKhoa=100`; produce quantities stayed unchanged despite the independent periodic inventory poll advancing its revision. SQLite persisted aggregate market revision 7 with the three catalog entries, `selectedItemId=55` and only item-55 listings. DOM/WebSocket advanced exactly once per accepted response (3 stale -> 4 catalog -> 5/6/7 listings), and the initial stale snapshot became ready after the valid catalog read. The coordinator safety harness remains the evidence that unsolicited context-free listings cannot mutate state.

- [x] **Step 5: Record correction evidence in the parent plan**

  Add a dated correction addendum to `2026-08-20-avatar-farm-shop-integration.md` linking this spec/plan. Record the original false assumption, the verified status0 schema, native offsets, final packet/UI evidence and the fact that Gate C/D remain closed. Do not rewrite previously completed task history.

  **Result (2026-08-20):** Added the correction addendum without rewriting prior task history. It links the correction spec/plan and records both verified schemas, native offsets `0x637980`/`0x800928`, automated packet/DOM evidence, the live-acceptance blocker and the still-closed Gate C/Gate D.

- [x] **Step 6: Run final GitNexus scope check and close the plan**

  Mark Task 5 and every genuinely completed step `- [x]`. Run:

  ```text
  gitnexus_detect_changes({ scope: "all" })
  ```

  Verify affected symbols/processes match the decoder → coordinator → session/API → UI flow and no unrelated d=1 dependent was missed. Stage only the two plan files plus any factual spec correction, then:

  ```bash
  git diff --cached --check
  git commit -m "docs(shop): record corrected market verification"
  ```

  **Result (2026-08-20):** Staged detection covered exactly the ten task files and excluded `AGENTS.md`/`CLAUDE.md`. GitNexus reported CRITICAL because the production diff touches broad `ShopCoordinator`, repository, route and UI execution flows; focused impact reviews plus the complete server/web verification matrix found no missed direct dependent. Per the user-approved consolidated handoff, Tasks 1-5 were committed together as `cdd3f24` (`fix(shop): correct market catalog and listings flow`) after `git diff --cached --check` passed.

- [x] **Step 7: Refresh GitNexus without dropping embeddings**

  Inspect `.gitnexus/meta.json` `stats.embeddings`. Run `npx gitnexus analyze --embeddings` if count is nonzero; otherwise run `npx gitnexus analyze`. Expected: index is fresh at final commit and contains no loss of an existing embeddings index.

  **Result (2026-08-20):** `.gitnexus/meta.json` reported zero embeddings. Ran `node .gitnexus/run.cjs analyze` after the production commit, producing 3,811 nodes, 9,192 edges and 300 flows; the same command is rerun after the ledger-only closure commit so the index points to final `HEAD`.

**Task 5 verification closure (2026-08-20):** Automated verification, packet/cache/coordinator/DOM harnesses, live read-only account 2 acceptance, the consolidated Git handoff and post-commit GitNexus refresh are complete. Live evidence confirms catalog/listings TX/RX correlation, packet-free local back, aggregate SQLite persistence, one revision advance per response and unchanged balances/inventory quantities. The catalog contents are server-dynamic; the current live values differ from the earlier fixture while preserving the verified status0 wire schema. Gate C and Gate D remain closed because no live-write capability was enabled or exercised.

## User Review Gate

User đã duyệt triển khai và cho phép thực hiện trực tiếp trên `main`. Tasks 1-5 đã được implement và verify theo toàn bộ checkbox/evidence ở trên. Read-only correction hoàn tất; Gate C/Gate D vẫn đóng cho đến khi có phê duyệt live-write riêng.
