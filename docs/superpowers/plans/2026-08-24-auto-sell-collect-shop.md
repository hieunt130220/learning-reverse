# Auto Sell Collect Shop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thu tiền các slot đã bán và rút hàng các slot hết hạn trước khi Auto Sell đăng đơn mới, để slot và hàng vừa thu được tái sử dụng ngay trong cùng lượt.

**Architecture:** Giữ toàn bộ pha thu dọn trong lane độc quyền của `ShopCoordinator.runAutoSellCycle()`. Mỗi slot được xử lý bằng transaction `withdraw`, ACK cmd 103 sub-type 4 và reconciliation; sau khi hoàn tất mới tính lại slot trống/kho và chạy thuật toán listing hiện tại.

**Tech Stack:** TypeScript 5.7, Node.js 22, EventEmitter, protocol cmd 103 hiện có, ShopRepository transaction persistence, npm scripts `typecheck`/`build`/`test`.

**Spec:** `docs/superpowers/specs/2026-08-24-auto-sell-collect-shop-design.md`

## Global Constraints

- Tuân thủ production-code-first; không dùng TDD và không tạo test file mới khi người dùng chưa yêu cầu trực tiếp.
- Không thêm config, UI, route API, DB migration hoặc wire-format mới.
- Chỉ thu slot `isSale === true` hoặc `isTimeOut === true`; không rút listing còn đang bán.
- `isSale` được ưu tiên nếu snapshot bất thường có đồng thời hai cờ; mỗi slot chỉ xử lý một lần.
- Hàng hết hạn vừa rút phải được tính lại và có thể đăng theo `autoSellRules` ngay trong cùng lượt.
- Packet đã có thể tới server không được tự retry; trạng thái thiếu bằng chứng phải dừng với `uncertain-state`.
- Pha thu dọn và pha listing phải ở cùng lane Auto Sell; request thủ công không được chen giữa.
- Trước khi sửa mỗi method/function/class, chạy GitNexus impact đúng symbol/file; cảnh báo người dùng trước nếu risk HIGH hoặc CRITICAL.
- Trước commit, chạy `gitnexus_detect_changes({ scope: "all" })` và rà soát toàn bộ d=1 dependents.
- Không đưa các thay đổi index tự động trong `AGENTS.md`/`CLAUDE.md` vào feature commit nếu chúng không thuộc phạm vi được duyệt.

---

### Task 1: Mở rộng contract kết quả Auto Sell và các producer

**Files:**
- Modify: `avatar-web/server/src/session/shopCoordinator.ts:43-62,488-714`
- Modify: `avatar-web/server/src/session/avatarSession.ts:494-521`

**Interfaces:**
- Consumes: `AutoSellStopReason`, `AutoSellRuleResult`, callback `AutoFarmOptions.runAutoSellCycle` hiện có.
- Produces: `AutoSellCycleResult` có thêm `collectedSoldSlots: number` và `withdrawnExpiredSlots: number`; mọi producer trả đủ hai trường.

- [x] **Step 1: Chạy impact analysis cho các symbol sẽ sửa**

Run GitNexus:

```text
impact(target="runAutoSellCycle", direction="upstream", includeTests=true)
impact(target="connect", file_path="avatar-web/server/src/session/avatarSession.ts", direction="upstream", includeTests=true)
```

Nếu `connect` bị nhập nhằng, dùng `context(name="AvatarSession", file_path="avatar-web/server/src/session/avatarSession.ts")` để lấy UID rồi chạy impact bằng UID/name chính xác.

Expected: ghi lại risk và d=1 callers; dừng xin xác nhận nếu risk HIGH/CRITICAL.

- [x] **Step 2: Mở rộng `AutoSellCycleResult` và khởi tạo counters trong coordinator**

Sửa contract:

```ts
export interface AutoSellCycleResult {
  startedAt: number;
  completedAt: number;
  collectedSoldSlots: number;
  withdrawnExpiredSlots: number;
  listedLots: number;
  stopReason: AutoSellStopReason;
  rules: AutoSellRuleResult[];
}
```

Ở đầu callback lane trong `runAutoSellCycle`, thêm:

```ts
let collectedSoldSlots = 0;
let withdrawnExpiredSlots = 0;
```

Thêm hai field vào nhánh policy-disabled và return cuối method:

```ts
collectedSoldSlots,
withdrawnExpiredSlots,
```

- [x] **Step 3: Cập nhật result khi chưa đến chu kỳ trong `AvatarSession.connect()`**

Trong callback `runAutoSellCycle`, nhánh `now - this.lastAutoSellAt < interval` phải trả:

```ts
return {
  startedAt: now,
  completedAt: now,
  collectedSoldSlots: 0,
  withdrawnExpiredSlots: 0,
  listedLots: 0,
  stopReason: 'completed',
  rules: rules.map((r) => ({
    itemId: r.itemId,
    listedLots: 0,
    listedQuantity: 0,
    skippedReason: 'Chưa đến chu kỳ kiểm tra',
  })),
};
```

- [x] **Step 4: Typecheck contract thay đổi**

Run:

```bash
cd avatar-web/server && npm run typecheck
```

Expected: PASS; không còn producer nào thiếu `collectedSoldSlots` hoặc `withdrawnExpiredSlots`.

- [x] **Step 5: Commit Task 1**

Trước commit, chạy `gitnexus_detect_changes({ scope: "all" })`, xác nhận chỉ contract Auto Sell và callback session bị ảnh hưởng. Sau đó:

```bash
git add avatar-web/server/src/session/shopCoordinator.ts avatar-web/server/src/session/avatarSession.ts
git commit -m "refactor(shop): extend auto sell cycle summary"
```

Không stage `AGENTS.md` hoặc `CLAUDE.md`.

---

### Task 2: Thu dọn slot đã bán và hết hạn trong lane Auto Sell

**Files:**
- Modify: `avatar-web/server/src/session/shopCoordinator.ts:1-20,488-714,1198-1260`

**Interfaces:**
- Consumes: `OwnShopSlot`, `ShopProtocolEvent` sub-type 4, `FarmService.takeItemBack(slot)`, `syncOwnShopInLane()`, `createTransaction()`, `transition()`, `countItem()`, `runId`, `shouldStop()`.
- Produces: private type `AutoCollectCandidate`; private awaited primitive `collectAutoSellSlot(candidate, runId): Promise<void>`; phase thu dọn cập nhật `collectedSoldSlots`/`withdrawnExpiredSlots` trước khi listing.

- [x] **Step 1: Chạy impact/context trước khi sửa coordinator internals**

Run GitNexus:

```text
context(name="runAutoSellCycle", file_path="avatar-web/server/src/session/shopCoordinator.ts", include_content=true)
impact(target="runAutoSellCycle", direction="upstream", includeTests=true)
context(name="unknownEvidence", file_path="avatar-web/server/src/session/shopCoordinator.ts", include_content=true)
impact(target="unknownEvidence", direction="upstream", includeTests=true)
```

Expected: ghi lại callers/flows; dừng xin xác nhận nếu risk HIGH/CRITICAL.

- [x] **Step 2: Khai báo candidate nội bộ và helper kiểm tra identity**

Import `OwnShopSlot` bằng type import từ `shopProtocol.js`, rồi khai báo gần các interface nội bộ:

```ts
type AutoCollectCandidate =
  | { kind: 'sold'; slot: OwnShopSlot }
  | { kind: 'expired'; slot: OwnShopSlot };

function sameOwnSlot(actual: OwnShopSlot, expected: OwnShopSlot): boolean {
  return actual.slot === expected.slot
    && actual.itemId === expected.itemId
    && actual.quantity === expected.quantity
    && actual.price === expected.price;
}
```

Helper chỉ so identity listing; cờ trạng thái được kiểm tra riêng theo `candidate.kind` để lỗi có thông báo rõ.

- [x] **Step 3: Thêm primitive `collectAutoSellSlot` có transaction và reconciliation**

Đặt private method cạnh `runListing`/`runWithdraw`:

```ts
private async collectAutoSellSlot(
  candidate: AutoCollectCandidate,
  runId: string,
): Promise<void> {
  const { slot } = candidate;
  const current = this.runtime.own?.data.slots.find((item) => item.slot === slot.slot);
  if (!current || current.itemId === -1 || current.quantity <= 0) return;
  if (!sameOwnSlot(current, slot)) {
    throw new ShopError(409, 'STALE_SHOP_STATE', `Slot ${slot.slot} đã đổi trước khi thu sạp`);
  }
  if (candidate.kind === 'sold' ? !current.isSale : current.isSale || !current.isTimeOut) {
    throw new ShopError(409, 'STALE_SHOP_STATE', `Trạng thái slot ${slot.slot} đã đổi trước khi thu sạp`);
  }

  const idempotencyKey = `auto-sell-collect:${this.accountId}:${runId}:${slot.slot}:${candidate.kind}`;
  const replay = this.findReplay(idempotencyKey);
  if (replay?.status === 'succeeded') return;
  if (replay) {
    throw new ShopError(409, 'STALE_SHOP_STATE', `Giao dịch thu slot ${slot.slot} chưa ở trạng thái an toàn`);
  }

  const beforeProduce = countItem(this.produce?.items ?? [], slot.itemId);
  const transaction = this.createTransaction(
    'withdraw',
    {
      idempotencyKey,
      slot: slot.slot,
      expectedShopRevision: this.runtime.own?.revision ?? 0,
      expectedItemId: slot.itemId,
      expectedQuantity: slot.quantity,
      expectedPrice: slot.price,
      autoCollectKind: candidate.kind,
    },
    this.captureBefore(),
  );

  try {
    this.transition(transaction.id, 'sending');
    const ack = await this.request<Extract<ShopProtocolEvent, { subType: 4 }>>(
      4,
      (farm) => {
        farm.takeItemBack(slot.slot);
        this.transition(transaction.id, 'awaiting_response');
      },
      (event) => event.slot === slot.slot,
    );

    const ackMatches = candidate.kind === 'sold'
      ? ack.result === 0
      : ack.result === 1 && ack.itemId === slot.itemId;
    if (!ackMatches) {
      throw new ShopError(500, 'SHOP_PROTOCOL_ERROR', `Phản hồi thu slot ${slot.slot} không khớp trạng thái`);
    }

    this.transition(transaction.id, 'reconciling', { result: { ack } });
    await this.syncOwnShopInLane();
    const afterSlot = this.runtime.own?.data.slots.find((item) => item.slot === slot.slot);
    const stillSame = afterSlot && sameOwnSlot(afterSlot, slot)
      && (candidate.kind === 'sold' ? afterSlot.isSale : afterSlot.isTimeOut);
    const afterProduce = countItem(this.produce?.items ?? [], slot.itemId);
    if (stillSame || (candidate.kind === 'expired' && afterProduce < beforeProduce + slot.quantity)) {
      throw new ShopError(500, 'SHOP_PROTOCOL_ERROR', `Chưa đủ bằng chứng xác nhận thu slot ${slot.slot}`);
    }

    this.transition(transaction.id, 'succeeded', {
      result: { ack, autoCollectKind: candidate.kind, own: this.runtime.own, produce: this.produce },
    });
  } catch (error) {
    const normalized = asShopError(error);
    const currentTransaction = this.repository.findTransaction(this.accountId, idempotencyKey);
    if (currentTransaction && !TERMINAL_STATUSES.has(currentTransaction.status)) {
      const sent = currentTransaction.status !== 'queued';
      this.transition(transaction.id, sent ? 'unknown' : 'failed', {
        errorCode: normalized.code,
        errorMessage: sent
          ? `${normalized.message}; không tự gửi lại giao dịch`
          : normalized.message,
      });
    }
    throw normalized;
  }
}
```

Khi triển khai, giữ nguyên idiom formatting của file. Primitive không enqueue và không gọi `assertNoAutomation()` vì caller đã giữ lane Auto Sell.

- [x] **Step 4: Chèn pha thu dọn trước khi tính `freeSlots`**

Ngay sau `syncOwnShopInLane()` thành công, thay việc tính `ownSlots/freeSlots` ngay lập tức bằng:

```ts
const collectCandidates: AutoCollectCandidate[] = (this.runtime.own?.data.slots ?? [])
  .flatMap((slot): AutoCollectCandidate[] => {
    if (slot.isSale) return [{ kind: 'sold', slot: { ...slot } }];
    if (slot.isTimeOut) return [{ kind: 'expired', slot: { ...slot } }];
    return [];
  })
  .sort((left, right) => left.slot.slot - right.slot.slot);

for (const candidate of collectCandidates) {
  if (shouldStop()) {
    stopReason = 'stopped';
    break;
  }
  try {
    await this.collectAutoSellSlot(candidate, runId);
    if (candidate.kind === 'sold') collectedSoldSlots += 1;
    else withdrawnExpiredSlots += 1;
  } catch {
    stopReason = 'uncertain-state';
    break;
  }
}

if (stopReason !== 'completed') {
  return {
    startedAt,
    completedAt: this.now(),
    collectedSoldSlots,
    withdrawnExpiredSlots,
    listedLots: totalListedLots,
    stopReason,
    rules: ruleResults,
  };
}

const ownSlots = this.runtime.own?.data.slots ?? [];
const numSlot = this.runtime.own?.data.numSlot ?? 0;
```

Sau đó giữ thuật toán xây `freeSlots` và listing hiện tại. Vì `syncOwnShopInLane()` cập nhật produce, `countItem()` trong vòng listing sẽ thấy hàng hết hạn vừa quay lại kho.

Lưu ý: primitive trả `void` khi candidate đã trống. Để counter không tăng sai, thay signature thành `Promise<'collected' | 'already-free'>` nếu implementation cần phân biệt; khi đó chỉ tăng counter với `'collected'`. Không được ghi nhận một slot là đã thu nếu không gửi/xác nhận giao dịch trong lượt này hoặc replay `succeeded` chứng minh thao tác đã hoàn tất.

- [x] **Step 5: Mở rộng reconciliation của transaction `withdraw` tự động**

Trong `unknownEvidence()`, phân nhánh bằng `request.autoCollectKind`:

```ts
if (transaction.kind === 'withdraw') {
  const slot = Number(request.slot);
  const listing = this.runtime.own?.data.slots.find((candidate) => candidate.slot === slot);
  const oldListingGone = !listing
    || listing.itemId !== itemId
    || listing.quantity !== quantity
    || listing.price !== Number(request.expectedPrice);
  if (request.autoCollectKind === 'sold') {
    if (oldListingGone) return { ownRevision: this.runtime.own?.revision };
  } else if (oldListingGone && produceDelta >= quantity) {
    return { ownRevision: this.runtime.own?.revision, produceRevision: this.produce?.revision };
  }
}
```

Public/manual withdraw không có `autoCollectKind`, nên tiếp tục yêu cầu listing cũ biến mất và produce tăng như hành vi hiện tại.

- [x] **Step 6: Chạy typecheck và test hiện có của server**

Run:

```bash
cd avatar-web/server && npm run typecheck
cd avatar-web/server && npm test
```

Expected: cả hai PASS. Không tạo test file mới. Nếu test hiện có cần cập nhật fixture vì contract result thêm field, chỉ sửa fixture/assertion hiện có sau production code và ghi rõ file trong plan checklist trước khi stage.

- [x] **Step 7: Chạy build server**

Run:

```bash
cd avatar-web/server && npm run build
```

Expected: PASS và schema được copy vào `dist/db/schema.sql`; không stage output build nếu thư mục dist không được track.

- [x] **Step 8: Commit Task 2**

Chạy `gitnexus_detect_changes({ scope: "all" })`; xác nhận flow bị ảnh hưởng chỉ gồm Auto Sell, shop transaction/reconciliation và caller trực tiếp dự kiến. Sau đó:

```bash
git add avatar-web/server/src/session/shopCoordinator.ts
git commit -m "feat(shop): collect sold and expired auto listings"
```

Nếu phải sửa test fixture hiện có, stage chính xác file đó cùng commit. Không stage `AGENTS.md` hoặc `CLAUDE.md`.

---

### Task 3: Ghi log kết quả thu sạp trong Auto Farm

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:1262-1280`

**Interfaces:**
- Consumes: `AutoSellCycleResult.collectedSoldSlots`, `AutoSellCycleResult.withdrawnExpiredSlots` từ Task 1/2.
- Produces: một dòng log/`lastActions` thu dọn khi ít nhất một counter lớn hơn `0`; giữ nguyên dòng summary listing hiện tại.

- [x] **Step 1: Chạy impact analysis cho `AutoFarm.runCycle` đúng UID**

Do tên `runCycle` bị nhập nhằng, chạy:

```text
context(name="AutoFarm", file_path="avatar-web/server/src/autoFarm.ts", include_content=false)
context(name="runCycle", file_path="avatar-web/server/src/autoFarm.ts", include_content=true)
impact(target=<UID runCycle trả về>, direction="upstream", includeTests=true)
```

Expected: ghi lại risk/d=1; dừng xin xác nhận nếu HIGH/CRITICAL.

- [x] **Step 2: Thêm log thu dọn trước summary listing**

Sau khi callback trả result và trước dòng `hoàn thành`, thêm:

```ts
if (result.collectedSoldSlots > 0 || result.withdrawnExpiredSlots > 0) {
  note(
    `[sạp tự động] đã thu tiền ${result.collectedSoldSlots} ô đã bán, `
      + `rút hàng ${result.withdrawnExpiredSlots} ô hết hạn`,
  );
}
```

Giữ nguyên log từng rule và `stopReason`. Không log dòng mới khi cả hai counter bằng `0`.

- [x] **Step 3: Chạy server verification**

Run:

```bash
cd avatar-web/server && npm run typecheck
cd avatar-web/server && npm test
cd avatar-web/server && npm run build
```

Expected: PASS toàn bộ; log compile đúng và không đổi API web.

- [x] **Step 4: Commit Task 3**

Chạy `gitnexus_detect_changes({ scope: "all" })`; xác nhận chỉ Auto Farm logging/cycle flow và các thay đổi feature trước đó. Sau đó:

```bash
git add avatar-web/server/src/autoFarm.ts
git commit -m "feat(auto-farm): log collected shop slots"
```

---

### Task 4: Verification tích hợp và hoàn tất tài liệu kế hoạch

**Files:**
- Modify: `docs/superpowers/plans/2026-08-24-auto-sell-collect-shop.md` (đánh dấu checkbox đã thực hiện)
- Verify only: `docs/superpowers/specs/2026-08-24-auto-sell-collect-shop-design.md`

**Interfaces:**
- Consumes: production code từ Tasks 1-3.
- Produces: bằng chứng typecheck/test/build, báo cáo GitNexus scope và checklist manual cho phiên live.

- [x] **Step 1: Chạy toàn bộ kiểm tra server từ working tree cuối**

Run:

```bash
cd avatar-web/server && npm run typecheck
cd avatar-web/server && npm test
cd avatar-web/server && npm run build
```

Expected: PASS cả ba lệnh.

- [x] **Step 2: Xác nhận web không bị phá vỡ bởi thay đổi shared workspace**

Run:

```bash
cd avatar-web/web && npm run build
```

Expected: PASS. Không cần sửa web vì contract Auto Sell cycle là nội bộ server.

- [x] **Step 3: Rà soát diff và scope bằng GitNexus**

Run:

```bash
git diff --check
git status --short
git diff --stat main...HEAD
```

Sau đó chạy:

```text
gitnexus_detect_changes(scope="compare", base_ref="main")
```

Expected:

- không có whitespace error;
- code feature chỉ chạm `shopCoordinator.ts`, `avatarSession.ts`, `autoFarm.ts` và hai tài liệu Spec/Plan, ngoại trừ fixture test hiện có nếu compiler bắt buộc;
- affected flows khớp Auto Sell/shop reconciliation/Auto Farm cycle;
- toàn bộ d=1 dependent đã được cập nhật;
- `AGENTS.md`/`CLAUDE.md` không nằm trong feature commit nếu chỉ đổi số liệu index.

- [ ] **Step 4: Thực hiện manual verification khi có phiên game được ủy quyền**

Chuẩn bị một sạp có slot đã bán, slot hết hạn và slot đang bán; bật Auto Sell với rule khớp hàng hết hạn. Xác nhận tuần tự:

```text
1. Slot đã bán nhận ACK result=0 và được giải phóng.
2. Slot hết hạn nhận ACK result=1 đúng itemId, hàng tăng trong produce và slot được giải phóng.
3. Slot đang bán còn nguyên.
4. Hàng vừa rút được dùng để đăng listing mới trong cùng runId khi đủ quantity/price.
5. Log báo đúng collectedSoldSlots, withdrawnExpiredSlots và listedLots.
6. Transaction history có withdraw cho từng slot và list cho từng đơn mới.
```

Nếu không có môi trường live, ghi rõ manual verification là chưa chạy; không suy diễn thành công từ build/test.

- [x] **Step 5: Chạy review trước khi hoàn tất**

Invoke `superpowers:requesting-code-review` hoặc skill `code-review` trên diff cuối. Xử lý findings đã xác minh; sau mọi chỉnh sửa phải chạy lại verification liên quan và `gitnexus_detect_changes(scope="all")`.

Expected: không còn finding correctness mức blocking.

- [x] **Step 6: Cập nhật checkbox và commit tài liệu**

Đánh dấu `- [x]` cho đúng các bước thực sự hoàn tất; để nguyên `- [ ]` cho manual verification chưa chạy. Chạy lại `git diff --check`, sau đó:

```bash
git add docs/superpowers/specs/2026-08-24-auto-sell-collect-shop-design.md \
  docs/superpowers/plans/2026-08-24-auto-sell-collect-shop.md
git commit -m "docs: complete auto sell shop collection plan"
```

Không đánh dấu hoặc báo hoàn tất bước nào chưa chạy thành công.
