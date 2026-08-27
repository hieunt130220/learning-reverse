# Auto Farm Shop Market Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Đồng bộ catalog chợ ngay sau đồng bộ sạp trong mỗi vòng auto-sell, đồng thời tiếp tục bằng cache hiện có khi riêng bước đồng bộ chợ thất bại.

**Architecture:** Tập trung thay đổi trong orchestration `ShopCoordinator.runAutoSellCycle()`: giữ `syncOwnShopInLane()` là bước bắt buộc, rồi gọi tuần tự `browseMarketCatalogInLane()` theo best-effort trong cùng queue `auto-sell-cycle`. Không đổi primitive đồng bộ chợ, API, DTO hoặc safety guard; lỗi chợ được normalize và phát log có cấu trúc qua client hiện tại trước khi logic auto-sell tiếp tục.

**Tech Stack:** TypeScript 5.7, Node.js EventEmitter, Node test runner/tsx, GitNexus MCP

**Spec:** `docs/superpowers/specs/2026-08-27-auto-farm-shop-market-sync-design.md`

## Global Constraints

- Tuân thủ quy trình Spec → Plan → Production Code; chỉ implement sau khi user duyệt plan này.
- Không thực hiện TDD và không tạo hoặc sửa test file trừ khi user yêu cầu trực tiếp.
- Chỉ sửa `avatar-web/server/src/session/shopCoordinator.ts`; không sửa API, UI, config, protocol decoder, DTO hoặc `AvatarSession`.
- Thứ tự bắt buộc trong auto-sell là đồng bộ sạp → đồng bộ catalog chợ → collect/list; không dùng `Promise.all()`.
- Không đổi signature, return type hoặc semantics của `browseMarketCatalogInLane()` vì GitNexus đánh giá symbol này HIGH risk.
- Lỗi đồng bộ sạp vẫn trả `stopReason: 'uncertain-state'`; lỗi đồng bộ chợ không tự nó đổi stop reason, không gọi `setRuntimeError()` và không xóa cache.
- Không bypass `assertShopChannelSynchronized()` hoặc bất kỳ epoch/pending-response guard hiện hữu nào.
- Mọi symbol phải được GitNexus impact-analyze trước khi edit; phải chạy `detect_changes({ scope: "compare", base_ref: "main" })` trước commit.
- Không commit nếu user chưa yêu cầu; bước commit trong plan chỉ được thực hiện khi có yêu cầu commit rõ ràng.

---

### Task 1: Ghép đồng bộ chợ best-effort vào vòng auto-sell

**Files:**
- Modify: `avatar-web/server/src/session/shopCoordinator.ts:504-546`
- Verify only: `avatar-web/server/src/session/avatarSession.ts:664-687`
- Existing checks only: `avatar-web/server/src/session/shopCoordinator.test.ts`

**Interfaces:**
- Consumes: `private async syncOwnShopInLane(): Promise<void>`
- Consumes: `private async browseMarketCatalogInLane(): Promise<void>`
- Consumes: `function asShopError(error: unknown): ShopError`
- Consumes: `private client: GameClient | null`
- Preserves: `async runAutoSellCycle(rules: readonly AutoSellRule[], runId: string, shouldStop: () => boolean): Promise<AutoSellCycleResult>`
- Produces: không có interface mới; chỉ thay đổi thứ tự orchestration nội bộ của `runAutoSellCycle()`

- [x] **Step 1: Xác nhận impact ngay trước khi sửa production symbol**

Run GitNexus:

```text
impact({
  target: "runAutoSellCycle",
  direction: "upstream",
  maxDepth: 3,
  relationTypes: ["CALLS"],
  includeTests: true,
  minConfidence: 0.7,
  repo: "learning-reverse"
})

impact({
  target: "browseMarketCatalogInLane",
  direction: "upstream",
  maxDepth: 3,
  relationTypes: ["CALLS"],
  includeTests: true,
  minConfidence: 0.7,
  repo: "learning-reverse"
})
```

Expected:

- `runAutoSellCycle` không có cảnh báo HIGH/CRITICAL mới ngoài phạm vi đã duyệt.
- `browseMarketCatalogInLane` có thể vẫn là HIGH do `browseMarketCatalog()` và `runRefreshMarket()`; không sửa method này. Nếu caller/risk khác kết quả trong spec, dừng và báo user trước khi edit.

- [x] **Step 2: Thêm bước đồng bộ catalog chợ tuần tự và best-effort**

Trong `runAutoSellCycle()`, giữ nguyên block `syncOwnShopInLane()` bắt buộc. Chèn block sau ngay sau catch trả `uncertain-state` của đồng bộ sạp và trước khi dựng `collectCandidates`:

```ts
        try {
          await this.browseMarketCatalogInLane();
        } catch (error) {
          const normalized = asShopError(error);
          try {
            this.client?.emit('log', JSON.stringify({
              scope: 'auto-sell-market-sync',
              code: normalized.code,
              message: normalized.message,
            }));
          } catch {
            /* log best-effort không được làm hỏng vòng auto-sell */
          }
        }
```

Yêu cầu chính xác:

- Dùng `await`, không dùng `Promise.all()` hoặc enqueue public action `browseMarketCatalog()`.
- Không `return`, không đổi `stopReason` và không gọi `setRuntimeError()` trong catch mới.
- Không gán lại `runtime.market` hoặc `runtime.priceRules`; request thành công tự cập nhật qua `applyProtocolEvent()`, request thất bại giữ state hiện có.
- Giữ toàn bộ collect/list logic sau block không đổi để price rule cache tiếp tục được dùng và rule thiếu price rule vẫn có `skippedReason: 'Không có price rule'`.
- Không sửa `browseMarketCatalogInLane()`; thay đổi duy nhất là thêm caller mới.

- [x] **Step 3: Review diff cục bộ để loại thay đổi ngoài phạm vi**

Run:

```bash
git diff -- avatar-web/server/src/session/shopCoordinator.ts
```

Expected:

- Chỉ có block `try/catch` đồng bộ catalog chợ được thêm trong `runAutoSellCycle()`.
- Không có thay đổi signature, public API, transaction logic, queue implementation hoặc protocol methods.
- Không có chỉnh sửa vô tình vào các thay đổi user đang có trong workspace.

- [x] **Step 4: Chạy static verification của server**

Run:

```bash
npm --prefix avatar-web/server run typecheck
npm --prefix avatar-web/server run build
```

Expected:

- Cả hai lệnh exit code `0`.
- Không có lỗi TypeScript liên quan đến `this.client`, `emit`, `normalized.code` hoặc `normalized.message`.

- [x] **Step 5: Chạy test suite hiện có sau production code**

Run:

```bash
npm --prefix avatar-web/server test
```

Expected:

- Test suite hiện có exit code `0`.
- Không tạo hoặc sửa test file. Nếu test thất bại, báo đúng test/output và phân biệt regression do thay đổi với failure có sẵn trước khi sửa thêm.

- [x] **Step 6: Kiểm tra các invariants của flow bằng source và diff**

Xác nhận lần lượt trong `avatar-web/server/src/session/shopCoordinator.ts`:

```text
writeEnabled=false
  -> return trước cả syncOwnShopInLane và browseMarketCatalogInLane

syncOwnShopInLane reject
  -> return uncertain-state trước browseMarketCatalogInLane

syncOwnShopInLane resolve
  -> await browseMarketCatalogInLane

browseMarketCatalogInLane reject
  -> emit log scope auto-sell-market-sync
  -> tiếp tục dựng collectCandidates

channel bị block bởi timeout
  -> request write tiếp theo vẫn đi qua assertShopChannelSynchronized
  -> logic catch hiện hữu chuyển cycle sang uncertain-state
```

Expected: cả năm invariant đúng, không có branch mới bypass safety guard.

- [x] **Step 7: Phân tích scope thay đổi bằng GitNexus trước commit**

Run GitNexus:

```text
detect_changes({
  scope: "compare",
  base_ref: "main",
  repo: "learning-reverse"
})
```

Expected:

- Production impact tập trung vào `ShopCoordinator.runAutoSellCycle()` và auto-sell execution flow.
- Không xuất hiện thay đổi API route, UI, DTO, protocol decoder hoặc config do task này.
- Vì workspace đã có thay đổi user tại `avatar-re/notes/fishing.md` và spec auto-fishing, đọc kết quả theo từng file; không quy các file đó vào task này và không stage chúng.

- [x] **Step 8: Không commit — user chưa yêu cầu commit**

Run only after explicit commit approval:

```bash
git add avatar-web/server/src/session/shopCoordinator.ts \
  docs/superpowers/specs/2026-08-27-auto-farm-shop-market-sync-design.md \
  docs/superpowers/plans/2026-08-27-auto-farm-shop-market-sync.md
git commit -m "feat: sync market during auto sell

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Expected:

- Commit chỉ chứa production file và hai tài liệu của feature này.
- Không stage `avatar-re/notes/fishing.md` hoặc `docs/superpowers/specs/2026-08-26-auto-fishing-design.md`.
- Nếu user không yêu cầu commit, đánh dấu step này là skipped với lý do “chưa được yêu cầu commit”, không tự commit.
