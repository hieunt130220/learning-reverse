# Đồng bộ chợ cùng đồng bộ sạp trong Auto Farm — Design Document

- **Ngày:** 2026-08-27
- **Trạng thái:** Chờ user duyệt

## 1. Mục tiêu & Bối cảnh

Luồng tự động bán nông sản trong Auto Farm hiện mở đầu bằng việc đồng bộ sạp của tài khoản qua `ShopCoordinator.syncOwnShopInLane()`. Bước này cập nhật slot sạp và kho nông sản, nhưng không chủ động đồng bộ catalog chợ. Vì vậy dữ liệu `market` và `priceRules` mà vòng auto-sell dùng có thể chỉ là cache từ lần đồng bộ trước hoặc chưa tồn tại.

Mục tiêu của thay đổi là để action đồng bộ chợ chạy cùng action đồng bộ sạp khi bắt đầu mỗi vòng auto-sell. Hai action phải chạy tuần tự trong cùng queue/lane của `ShopCoordinator`, sau đó auto-sell tiếp tục thu tiền, rút listing hết hạn và đăng bán theo logic hiện có.

Hành vi đã được người dùng chốt: nếu đồng bộ sạp thành công nhưng đồng bộ chợ thất bại, auto-sell vẫn tiếp tục bằng snapshot sạp vừa đồng bộ và `priceRules`/cache hiện có.

## 2. Phạm vi (Scope)

### 2.1 In-scope

- Trong `ShopCoordinator.runAutoSellCycle()`, gọi đồng bộ catalog chợ ngay sau khi đồng bộ sạp thành công.
- Chạy hai request tuần tự trong cùng invocation đã được serialize bởi queue `auto-sell-cycle`.
- Giữ đồng bộ sạp là điều kiện bắt buộc: lỗi đồng bộ sạp vẫn kết thúc bước auto-sell với `stopReason: 'uncertain-state'`.
- Xử lý đồng bộ chợ theo best-effort: lỗi đồng bộ chợ không đổi stop reason và không ngăn các thao tác auto-sell sau đó.
- Giữ snapshot `market` và `priceRules` hiện có nếu request đồng bộ chợ thất bại.
- Ghi log có cấu trúc qua `GameClient` để lỗi best-effort có thể quan sát được mà không biến thành lỗi giao dịch auto-sell.
- Giữ hành vi hiện tại của từng rule: nếu không có price rule phù hợp sau bước best-effort, rule bị bỏ qua với `skippedReason: 'Không có price rule'`.

### 2.2 Out-of-scope

- Không thay đổi API route hoặc action thủ công `syncOwnShop()`, `browseMarketCatalog()` và `refreshMarket()`.
- Không thay đổi UI, WebSocket data contract, `ShopRuntimeState`, `AutoSellCycleResult` hoặc cấu hình Auto Farm.
- Không thêm retry riêng cho đồng bộ chợ.
- Không chạy đồng bộ sạp và chợ song song.
- Không thay đổi logic thu listing đã bán, rút listing hết hạn, đăng listing, idempotency hoặc reconciliation.
- Không thay đổi protocol cmd 103, decoder hay `FarmService`.
- Không tạo test file mới nếu người dùng không yêu cầu trực tiếp.

### 2.3 Input, output và edge cases

**Input:** `rules`, `runId` và `shouldStop` hiện có của `runAutoSellCycle()`; không thêm tham số.

**Output:** giữ nguyên `AutoSellCycleResult`; không thêm trạng thái mới để biểu diễn lỗi đồng bộ chợ best-effort.

**Edge cases:**

1. `writeEnabled` tắt: giữ nguyên short-circuit hiện tại; không đồng bộ sạp hoặc chợ vì auto-sell không chạy.
2. Đồng bộ sạp thất bại: trả `uncertain-state`, không thử đồng bộ chợ và không thực hiện write.
3. Đồng bộ sạp thành công, đồng bộ chợ thành công: dùng catalog/price rules mới nhất rồi tiếp tục auto-sell.
4. Đồng bộ sạp thành công, đồng bộ chợ thất bại trước khi nhận response hợp lệ: log lỗi, giữ cache hiện có và tiếp tục auto-sell.
5. Đồng bộ chợ timeout sau khi đã gửi cmd 103: cơ chế `requestForSubTypes()` có thể block shop channel để tránh ghép nhầm response. Auto-sell vẫn đi tiếp theo lựa chọn của người dùng, nhưng thao tác shop kế tiếp sẽ tự thất bại qua guard `assertShopChannelSynchronized()` và được logic hiện hữu chuyển thành `uncertain-state`; không được bỏ qua safety guard này.
6. Không có price rules trong cache: từng rule bị skip; các bước thu tiền/rút listing vẫn được phép chạy.
7. `shouldStop()` đổi thành true trong lúc hai bước đồng bộ đang chờ: request đang chạy hoàn tất theo cơ chế hiện hữu; vòng kiểm tra stop gần nhất sau đó kết thúc auto-sell với `stopped`. Không bổ sung cancellation giữa một request protocol đang pending.
8. Mất kết nối hoặc đổi connection epoch: guard hiện hữu của request phát lỗi; lỗi tại đồng bộ sạp là fatal cho cycle, lỗi tại đồng bộ chợ được xử lý best-effort, còn write tiếp theo vẫn chịu epoch/channel guards hiện hữu.

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1 Files/modules liên quan

| File | Vai trò hiện tại | Thay đổi |
|---|---|---|
| `avatar-web/server/src/session/shopCoordinator.ts` | Serialize action shop, đồng bộ sạp/chợ và chạy auto-sell | Sửa `runAutoSellCycle()` để gọi `browseMarketCatalogInLane()` best-effort sau `syncOwnShopInLane()`; thêm helper log nội bộ nếu cần để tránh lặp cấu trúc log |
| `avatar-web/server/src/session/avatarSession.ts` | Khởi tạo `ShopCoordinator`, gắn `GameClient`, truyền callback auto-sell | Không dự kiến sửa; verify rằng callback hiện tại tiếp tục gọi cùng `runAutoSellCycle()` |
| `avatar-web/server/src/session/shopCoordinator.test.ts` | Harness kiểm tra coordinator hiện hữu | Chỉ sửa nếu người dùng yêu cầu test trực tiếp; production verification mặc định không tạo test mới |

### 3.2 Impact và ràng buộc an toàn

GitNexus impact analysis ngày 2026-08-27:

- `runAutoSellCycle`: risk **LOW**, không phát hiện consumer upstream trong graph.
- `browseMarketCatalogInLane`: risk **HIGH**, có caller trực tiếp `browseMarketCatalog()` và `runRefreshMarket()`, ảnh hưởng các flow browse/refresh chợ.

Vì vậy implementation không thay signature, return type hoặc semantics của `browseMarketCatalogInLane()`. Method này chỉ được gọi thêm từ `runAutoSellCycle()`. Việc phân loại lỗi best-effort nằm hoàn toàn tại caller mới, tránh ảnh hưởng action thủ công và transaction refresh-market.

### 3.3 Flow xử lý

```text
runAutoSellCycle(rules, runId, shouldStop)
  enqueue('auto-sell-cycle')
    nếu writeEnabled=false
      trả completed như hiện tại

    try syncOwnShopInLane()
      lỗi -> trả uncertain-state như hiện tại

    try browseMarketCatalogInLane()
      thành công -> market/priceRules/cache cập nhật qua applyProtocolEvent hiện có
      lỗi -> emit log best-effort; không gọi setRuntimeError; tiếp tục

    dựng collectCandidates từ own snapshot mới
    thu slot đã bán / rút slot hết hạn
    duyệt rules:
      price rule tồn tại và giá hợp lệ -> đăng bán như hiện tại
      không có price rule -> skip rule như hiện tại
    trả AutoSellCycleResult hiện có
```

Thứ tự bắt buộc là **sạp → chợ → thao tác auto-sell**. Không dùng `Promise.all()` vì `ShopCoordinator` chỉ cho một `pendingShop`, có minimum send interval và dùng một channel cmd 103 chung.

### 3.4 Error handling và quan sát

Lỗi đồng bộ chợ best-effort phải được normalize bằng `asShopError()` để log có `code` và `message` ổn định. Log được phát qua client hiện tại với JSON có cấu trúc, cùng pattern đang dùng cho lỗi shop protocol:

```json
{
  "scope": "auto-sell-market-sync",
  "code": "SHOP_RESPONSE_TIMEOUT",
  "message": "Hết thời gian chờ phản hồi cmd 103"
}
```

Implementation lấy client online hiện tại qua guard/helper sẵn có và gọi `client.emit('log', JSON.stringify(...))`. Nếu client đã đổi hoặc offline trong lúc xử lý lỗi, việc emit log không được làm phát sinh lỗi mới; có thể dùng client hiện tại nếu còn tồn tại hoặc bỏ log nếu không còn client hợp lệ.

Không gọi `setRuntimeError()` cho lỗi này vì method đó đặt `syncStatus: 'error'` và làm UI hiểu rằng toàn bộ state shop không dùng được, trái với quyết định tiếp tục bằng snapshot sạp/cache hiện có. Đồng thời không xóa `lastError` cũ hoặc ghi đè snapshot market/price rules khi request thất bại.

Nếu lỗi đồng bộ chợ đã khiến shop channel bị block, các write tiếp theo vẫn phải đi qua `assertShopChannelSynchronized()`. Thiết kế không cố bypass channel block dù yêu cầu là “tiếp tục”: tiếp tục nghĩa là vòng auto-sell tiến tới logic hiện hữu, còn safety guard vẫn được quyền dừng write với `uncertain-state` khi protocol không còn chắc chắn.

### 3.5 Data contracts

Không có interface hoặc schema mới. Các contract giữ nguyên:

```ts
async runAutoSellCycle(
  rules: readonly AutoSellRule[],
  runId: string,
  shouldStop: () => boolean,
): Promise<AutoSellCycleResult>;

private async syncOwnShopInLane(): Promise<void>;
private async browseMarketCatalogInLane(): Promise<void>;
```

Không thêm field lỗi market sync vào `AutoSellCycleResult`, vì lỗi đã được quan sát qua log và người dùng đã chọn tiếp tục bằng cache. Điều này giữ consumer `AutoFarm` và UI không phải thay đổi.

## 4. Các phương án đã cân nhắc

### 4.1 Khuyến nghị: gọi tuần tự trong cùng auto-sell lane

Ưu điểm:

- Tái sử dụng primitive protocol hiện có.
- Không enqueue lồng nhau.
- Tuân thủ single pending response, rate limit và channel synchronization.
- Thay đổi tập trung trong một orchestration method.

Nhược điểm: mỗi vòng auto-sell thêm một round-trip cmd 103 và có thể chờ tới timeout nếu server không phản hồi.

### 4.2 Gọi public actions từ `AvatarSession`

Không chọn vì `syncOwnShop()` và `browseMarketCatalog()` tự enqueue. Điều phối từ `AvatarSession` làm phân tán trách nhiệm và có nguy cơ tạo khoảng trống để action khác chen vào giữa hai bước.

### 4.3 Chạy song song

Không chọn vì hai action dùng chung `pendingShop`, queue và cmd 103. Chạy song song có thể gây `OPERATION_CONFLICT` hoặc ghép response sai request.

## 5. Verification Plan

Không thực hiện TDD và không tạo test file mới nếu người dùng không yêu cầu. Sau khi production code hoàn thành:

1. **Static verification**
   - Chạy typecheck/build theo script hiện có của `avatar-web`.
   - Expected: không có lỗi TypeScript hoặc build mới.

2. **Existing automated checks**
   - Chạy test suite hiện có liên quan đến `ShopCoordinator` nếu repository đã cung cấp lệnh phù hợp.
   - Expected: các test hiện hữu pass; không thay đổi behavior của browse/refresh thủ công.

3. **Kiểm tra flow thành công bằng harness hiện có hoặc quan sát live có kiểm soát**
   - Bật Auto Farm với `autoSellProduce` và ít nhất một rule hợp lệ.
   - Expected traffic đầu auto-sell: chuỗi đồng bộ sạp hoàn tất, tiếp theo request catalog chợ, rồi mới có thao tác collect/list nếu cần.
   - Expected state: `market`/`priceRules` có revision/capturedAt mới; auto-sell dùng rule mới.

4. **Kiểm tra flow lỗi chợ best-effort**
   - Dùng khả năng mock/harness hiện có để cho `syncOwnShopInLane()` thành công và `browseMarketCatalogInLane()` reject; nếu harness không hỗ trợ injection ở mức này, kiểm tra thủ công bằng server/protocol sandbox thay vì thêm test file.
   - Expected: có log scope `auto-sell-market-sync`; cycle không trả `uncertain-state` chỉ vì lỗi browse; collect/list tiếp tục dựa trên cache.
   - Nếu channel bị block do timeout sau-send, expected: vòng vẫn tiến tới bước tiếp theo nhưng write guard kết thúc an toàn với `uncertain-state`, không bypass channel block.

5. **Regression thủ công**
   - Action “Đồng bộ sạp” vẫn chỉ đồng bộ sạp như trước.
   - Action “Đồng bộ chợ” vẫn đồng bộ catalog và đặt state ready như trước.
   - Refresh market trả phí vẫn browse lại catalog và reconcile như trước.

6. **GitNexus trước commit**
   - Chạy `detect_changes({ scope: "compare", base_ref: "main" })`.
   - Expected: thay đổi production chỉ tác động orchestration auto-sell trong `ShopCoordinator`; không xuất hiện API/UI/data-contract flow ngoài phạm vi.

## 6. Tiêu chí hoàn thành

- Mỗi vòng auto-sell đồng bộ sạp rồi đồng bộ catalog chợ theo đúng thứ tự trong cùng lane.
- Lỗi đồng bộ sạp vẫn dừng auto-sell với `uncertain-state`.
- Lỗi đồng bộ chợ được log nhưng không tự nó dừng auto-sell hoặc xóa cache.
- Price rules mới được dùng khi browse thành công; cache cũ được dùng khi browse thất bại; thiếu rule thì skip rule.
- Không bypass shop-channel safety guards.
- Không thay đổi API, UI, config hoặc DTO.
- Static verification và checks hiện có đều pass.
