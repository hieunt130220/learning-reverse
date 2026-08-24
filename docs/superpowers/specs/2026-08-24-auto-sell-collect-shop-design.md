# Auto Sell Collect Shop Design

## Mục tiêu và bối cảnh

Luồng Auto Sell hiện đồng bộ sạp rồi chỉ coi slot có `itemId === -1` hoặc `quantity <= 0` là trống. Slot đã bán (`isSale === true`) và slot hết hạn (`isTimeOut === true`) vẫn chiếm chỗ, nên lượt bán có thể dừng với `no-free-slot` dù người dùng có thể thu tiền hoặc rút hàng để giải phóng slot.

Mục tiêu là bổ sung pha thu dọn sạp vào đầu mỗi lượt Auto Sell:

- thu tiền từ các slot đã bán;
- rút hàng từ các slot hết hạn về kho;
- dùng các slot vừa giải phóng để đăng đơn hàng mới;
- cho phép hàng vừa rút do hết hạn được tính lại và đăng bán ngay trong cùng lượt theo các `autoSellRules` hiện hành.

Thay đổi phải tiếp tục dùng lane, timeout, transaction, idempotency và reconciliation của `ShopCoordinator`; không để `AutoFarm` gửi trực tiếp cmd 103.

## Phạm vi

### In scope

- Chạy pha thu dọn sau khi đồng bộ own-shop ở đầu `ShopCoordinator.runAutoSellCycle()` và trước khi tính slot trống.
- Thu tất cả slot có `isSale === true`.
- Thu tất cả slot có `isTimeOut === true`.
- Không tác động đến slot còn đang bán (`isSale === false && isTimeOut === false`).
- Gửi tuần tự `takeItemBack(slot)` trong lane Auto Sell hiện tại.
- Xác nhận phản hồi cmd 103 sub-type 4 và đồng bộ lại own-shop/produce sau mỗi slot.
- Dừng an toàn khi trạng thái không chắc chắn; không tự gửi lại lệnh đã có thể tới server.
- Sau pha thu dọn, tính lại slot trống và kho từ snapshot mới nhất.
- Cho hàng rút từ slot hết hạn tham gia đăng bán lại ngay trong cùng lượt.
- Bổ sung summary và log phân biệt số slot đã bán được thu tiền và số slot hết hạn được rút hàng.
- Giữ nguyên scheduler, cấu hình và thứ tự ưu tiên `autoSellRules` hiện tại.

### Out of scope

- Rút listing còn đang bán.
- Chỉ thu khi toàn bộ sạp bán xong.
- Thêm công tắc cấu hình riêng cho hành vi thu sạp.
- Thay đổi UI cấu hình Auto Farm hoặc sạp.
- Tự mở thêm slot.
- Thay đổi giá hoặc quy tắc đăng lại hàng hết hạn.
- Tạo scheduler thu sạp độc lập với Auto Farm/Auto Sell.
- Thay đổi wire format cmd 103 hoặc decoder sub-type 4.
- Tạo test file mới khi người dùng chưa yêu cầu trực tiếp.

## Input, output và edge cases

### Input

Không thêm input cấu hình. Pha thu dọn tự động chạy khi lượt Auto Sell thực sự chạy, tức là khi:

- `autoSellProduce` đang bật;
- có ít nhất một `autoSellRule`;
- đã đến `autoSellIntervalMs`;
- policy sạp cho phép ghi;
- session đang online và lane sạp có thể chạy.

Snapshot đầu vào dùng `OwnShopSlot` hiện có:

```ts
export interface OwnShopSlot {
  slot: number;
  itemId: number;
  quantity: number;
  price: number;
  isSale: boolean;
  isTimeOut: boolean;
}
```

Phân loại:

- `isSale === true`: slot đã bán, gọi `takeItemBack(slot)` để thu tiền.
- `isSale === false && isTimeOut === true`: listing hết hạn, gọi `takeItemBack(slot)` để trả hàng về kho.
- Còn lại: không thu.

`isSale` được ưu tiên nếu dữ liệu bất thường đồng thời thể hiện cả hai cờ; một slot chỉ được xử lý một lần.

### Output một lượt Auto Sell

Mở rộng summary nội bộ theo hướng tương thích cộng thêm trường:

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

Ý nghĩa:

- `collectedSoldSlots`: số slot đã bán được xác nhận thu tiền thành công.
- `withdrawnExpiredSlots`: số slot hết hạn được xác nhận rút hàng thành công.
- `listedLots`: giữ nguyên ý nghĩa hiện tại.

Mọi nhánh return, kể cả chưa đến chu kỳ hoặc policy tắt, phải trả hai counter mới bằng `0` để contract nhất quán.

### Edge cases

- Không có slot đã bán/hết hạn: bỏ qua pha thu dọn và tiếp tục đăng bán như hiện tại.
- Slot đã thay đổi giữa snapshot và lúc gửi: reconciliation không đủ bằng chứng thì dừng với `uncertain-state`.
- Người dùng dừng Auto Farm trước khi gửi slot kế tiếp: không bắt đầu lệnh mới và trả `stopped`.
- Người dùng dừng sau khi packet đã gửi: chờ ACK/reconciliation hoặc timeout rồi không xử lý slot tiếp theo.
- Mất kết nối, timeout, decode lỗi hoặc ACK sai slot: giao dịch chuyển `unknown` khi thích hợp, dừng lượt và không tự retry.
- ACK `result === 0` cho slot đã bán: xác nhận thu tiền; không yêu cầu produce tăng.
- ACK `result === 1` cho slot hết hạn: xác nhận đúng `itemId` và kho tăng đủ số lượng đã rút.
- ACK result không phù hợp với trạng thái slot trước lệnh: coi là trạng thái không chắc chắn và dừng lượt.
- Thu được một số slot rồi lỗi: giữ counters cho các slot đã xác nhận; không rollback các thao tác đã thành công.
- Hàng hết hạn vừa về kho nhưng không khớp rule, không đủ một lô hoặc giá rule không hợp lệ: giữ trong kho và áp dụng hành vi skip hiện tại.
- Sau khi thu dọn không còn hàng đủ rule: lượt hoàn tất với `listedLots = 0`, không phải lỗi.
- Slot đang bán không bị rút, kể cả sạp không còn slot trống sau khi thu dọn.

## Thiết kế kiến trúc và giải pháp kỹ thuật

### Hướng được chọn

Pha thu dọn nằm hoàn toàn trong lane của `ShopCoordinator.runAutoSellCycle()`. Mỗi slot được biểu diễn bằng transaction `withdraw` hiện có nhưng được thực thi bằng primitive nội bộ có thể `await`, tương tự cách Auto Sell đang thực thi transaction `list` trực tiếp trong lane.

Không gọi public `withdrawListing()` từ trong Auto Sell vì public API tự enqueue và gọi guard chống automation; làm vậy có thể tự xung đột hoặc deadlock. Không gửi packet trực tiếp từ `AutoFarm`, vì sẽ bỏ qua transaction và reconciliation của coordinator.

### Modules và vai trò

#### `avatar-web/server/src/session/shopCoordinator.ts`

- Mở rộng `AutoSellCycleResult` với hai counter thu dọn.
- Trong `runAutoSellCycle()`:
  1. đồng bộ own-shop/produce như hiện tại;
  2. chọn snapshot các slot đã bán và hết hạn theo thứ tự slot tăng dần;
  3. thu tuần tự từng slot;
  4. sau mỗi slot, reconcile và dùng snapshot mới nhất;
  5. nếu hoàn tất, tính `freeSlots` từ runtime mới nhất;
  6. chạy thuật toán đăng bán hiện tại.
- Tạo primitive nội bộ dành cho lane, ví dụ `collectAutoSellSlot(...)`, để:
  - tạo transaction `withdraw` với idempotency key xác định;
  - gửi `takeItemBack(slot)`;
  - chờ ACK sub-type 4 đúng slot;
  - đồng bộ own-shop và produce;
  - xác nhận bằng chứng theo loại slot trước lệnh;
  - transition transaction qua `sending`, `awaiting_response`, `reconciling`, `succeeded`, `failed` hoặc `unknown`.
- Giữ public `withdrawListing()` và `runWithdraw()` cho thao tác thủ công không đổi contract.
- Không xử lý một slot mới nếu `shouldStop()` đã true.

Primitive có thể dùng một input nội bộ rõ loại thao tác:

```ts
type AutoCollectCandidate =
  | { kind: 'sold'; slot: OwnShopSlot }
  | { kind: 'expired'; slot: OwnShopSlot };
```

Danh sách candidate là snapshot ở đầu pha, nhưng trước mỗi lần gửi phải kiểm tra lại slot trong `runtime.own`. Nếu slot đã trống do thay đổi được quan sát qua sync/reconciliation trước đó, bỏ qua như đã được giải phóng; nếu slot đổi sang listing khác hoặc dữ liệu mâu thuẫn, dừng `uncertain-state` thay vì thu nhầm hàng.

#### `avatar-web/server/src/autoFarm.ts`

- Không thay đổi scheduler hay config.
- Mở rộng log summary từ callback Auto Sell, ví dụ:

```text
[sạp tự động] đã thu tiền 2 ô đã bán, rút hàng 1 ô hết hạn
[sạp tự động] hoàn thành: đã đăng 3 lô. Lý do dừng: completed
```

- Khi cả hai counter bằng `0`, không cần thêm dòng thu dọn để tránh log nhiễu.

#### `avatar-web/server/src/session/avatarSession.ts`

- Các nhánh return khi chưa đến chu kỳ phải thêm hai counter bằng `0`.
- Không thay đổi cách tính deadline, `runId`, logout hoặc schedule vòng kế tiếp.

#### Các module không đổi

- `avatar-web/server/src/game/farmService.ts`: đã có `takeItemBack(slot)` đúng protocol.
- `avatar-web/server/src/game/shopProtocol.ts`: đã decode đủ hai kết quả sub-type 4.
- UI và API config: không thêm cấu hình hay DTO công khai.

### Data flow

```text
AutoFarm.runCycle
  -> AvatarSession callback kiểm tra autoSellIntervalMs
  -> ShopCoordinator.runAutoSellCycle chiếm lane
       -> sync own shop + produce/price rules theo luồng hiện tại
       -> snapshot candidates theo slot tăng dần
       -> slot đã bán
            -> transaction withdraw
            -> takeItemBack(slot)
            -> ACK result=0
            -> sync own shop/produce
            -> xác nhận slot đã được giải phóng
       -> slot hết hạn
            -> transaction withdraw
            -> takeItemBack(slot)
            -> ACK result=1 + đúng itemId
            -> sync own shop/produce
            -> xác nhận slot giải phóng + kho tăng
       -> tính lại freeSlots và produce
       -> đăng autoSellRules theo thuật toán hiện tại
  -> AutoFarm ghi log summary
  -> cycle-complete
```

## Thuật toán chi tiết

1. Bắt đầu lane Auto Sell và khởi tạo hai counter bằng `0`.
2. Nếu write policy tắt, trả summary rỗng như hiện tại.
3. Đồng bộ own-shop và các dữ liệu cần cho Auto Sell.
4. Tạo danh sách candidate từ snapshot own-shop, theo slot tăng dần:
   - `sold` khi `isSale` true;
   - nếu không, `expired` khi `isTimeOut` true.
5. Với mỗi candidate:
   1. Kiểm tra `shouldStop()`; nếu true, trả `stopped` và không gửi thêm.
   2. Đọc lại slot từ runtime hiện tại.
   3. Nếu slot đã trống, bỏ qua candidate.
   4. Nếu identity/trạng thái không còn khớp candidate, dừng `uncertain-state`.
   5. Tạo transaction `withdraw` và idempotency key.
   6. Gửi `takeItemBack(slot)` và chờ ACK đúng slot.
   7. Với candidate `sold`, yêu cầu `ack.result === 0`.
   8. Với candidate `expired`, yêu cầu `ack.result === 1` và `ack.itemId` khớp.
   9. Đồng bộ own-shop và produce.
   10. Xác nhận slot cũ không còn tồn tại ở trạng thái cũ.
   11. Với candidate `expired`, xác nhận produce tăng ít nhất `quantity`.
   12. Đánh transaction `succeeded` và tăng counter tương ứng.
6. Nếu một candidate rơi vào trạng thái không chắc chắn, dừng toàn lượt; không đăng listing mới.
7. Sau khi thu dọn hoàn tất, xây `freeSlots` từ `runtime.own` mới nhất.
8. Chạy thuật toán rule/listing hiện tại. `countItem(this.produce.items, rule.itemId)` tự bao gồm hàng vừa rút từ slot hết hạn.
9. Trả summary gồm counters thu dọn, listing counters và stop reason.

## Idempotency và transaction

Mỗi thao tác thu slot là một transaction `withdraw`, để giữ lịch sử cùng thao tác thủ công và cho cơ chế reconcile sau reconnect có thể nhận diện tác động.

Idempotency key đề xuất:

```text
auto-sell-collect:<accountId>:<runId>:<slot>:<kind>
```

Trong đó `kind` là `sold` hoặc `expired`. Key không dùng timestamp ngẫu nhiên và không trùng với key listing hiện tại. Nếu timeout xảy ra sau khi gửi, transaction chuyển `unknown`; lượt hiện tại không gửi lại. Cơ chế reconcile unknown hiện có tiếp tục xử lý khi có đủ bằng chứng, nhưng cần phân biệt giao dịch thu tiền với rút hàng vì giao dịch thu tiền không làm produce tăng.

Do đó reconciliation cho transaction `withdraw` phải dựa trên request có metadata loại candidate:

- `expired`: slot không còn listing cũ và produce tăng đủ quantity.
- `sold`: slot không còn trạng thái đã bán cũ; không yêu cầu produce delta.

Metadata chỉ nằm trong transaction request nội bộ, không đổi public API `WithdrawListingInput`.

## Error handling và concurrency

### Lỗi dừng toàn lượt

- Không đồng bộ được trạng thái sạp.
- Candidate thay đổi thành listing khác trước khi gửi.
- ACK sai slot hoặc result không khớp loại candidate.
- Với hàng hết hạn, ACK trả item khác hoặc produce không tăng đủ.
- Sau sync, slot cũ vẫn ở trạng thái trước lệnh.
- Timeout, mất kết nối hoặc decode protocol lỗi.
- Không xác định được packet đã tác động lên server hay chưa.

Các lỗi này đặt `stopReason = 'uncertain-state'`, không gửi candidate hoặc listing tiếp theo và không tự retry.

### Stop có chủ đích

- Kiểm tra `shouldStop()` trước mỗi candidate và trước mỗi listing.
- Packet đã gửi vẫn phải hoàn tất ACK/reconciliation hoặc timeout.
- Sau đó trả `stopped` và không bắt đầu thao tác mới.

### Khóa đồng thời

- Pha thu dọn và pha đăng bán cùng nằm trong một lane Auto Sell.
- Thao tác sạp thủ công không chen giữa hai pha.
- Auto Farm chỉ emit `cycle-complete` sau khi lane kết thúc.

## Khả năng tương thích

- Không migration DB hoặc config.
- Không thay đổi route/API công khai.
- `AutoSellCycleResult` là contract nội bộ; các nơi tạo result phải thêm default counters.
- Transaction vẫn dùng kind `withdraw`; lịch sử hiện có tiếp tục hiển thị được.
- Listing đang bán không bị ảnh hưởng.
- Tài khoản không bật Auto Sell giữ nguyên hành vi.

## Verification Plan

### Automated verification

Production code được viết trước; không dùng TDD và không tạo test file mới vì người dùng chưa yêu cầu.

1. Chạy typecheck/build server.
2. Chạy typecheck/build web nếu shared types hoặc build toàn workspace yêu cầu.
3. Chạy các test hiện có liên quan đến:
   - `ShopCoordinator` transaction và reconciliation;
   - Auto Sell cycle;
   - `AvatarSession` callback/deadline;
   - Auto Farm log/cycle completion.
4. Xác nhận mọi nhánh tạo `AutoSellCycleResult` có hai counter mới.
5. Trước khi sửa từng symbol, chạy GitNexus impact theo quy định project.
6. Trước commit, chạy `gitnexus_detect_changes({ scope: "all" })` và xác nhận chỉ các flow Auto Sell/sạp dự kiến bị ảnh hưởng.

### Manual verification

1. Chuẩn bị sạp có đồng thời:
   - ít nhất một slot đã bán;
   - ít nhất một slot hết hạn;
   - ít nhất một slot còn đang bán.
2. Bật Auto Sell với rule khớp loại hàng hết hạn và chờ đến lượt chạy.
3. Xác nhận hệ thống thu tiền slot đã bán.
4. Xác nhận hệ thống rút hàng slot hết hạn về kho.
5. Xác nhận listing đang bán không bị rút.
6. Xác nhận hai slot được giải phóng và có thể nhận đơn mới trong cùng lượt.
7. Xác nhận hàng vừa rút được tính vào kho và đăng lại ngay khi đủ quantity và giá hợp lệ.
8. Xác nhận log báo đúng số slot đã thu tiền, số slot hết hạn đã rút và số lô mới.
9. Đối chiếu transaction history: mỗi slot thu có một transaction `withdraw`, mỗi lô mới có một transaction `list`.
10. Dừng Auto Farm giữa pha thu dọn; xác nhận thao tác đã gửi hoàn tất/timeout và không có thao tác tiếp theo.
11. Mô phỏng timeout hoặc mất kết nối sau khi gửi; xác nhận `unknown`/`uncertain-state`, không tự retry và không đăng đơn mới.
12. Chạy lượt không có slot đã bán/hết hạn; xác nhận luồng đăng bán cũ vẫn hoạt động.

## Tiêu chí chấp nhận

- Mỗi lượt Auto Sell thu tất cả slot đã bán và hết hạn trước khi tính slot trống.
- Slot còn đang bán không bị tác động.
- Slot đã bán được xác nhận bằng ACK `result = 0` và được giải phóng.
- Slot hết hạn được xác nhận bằng ACK `result = 1`, hàng quay lại kho và slot được giải phóng.
- Hàng vừa rút có thể được đăng lại trong cùng lượt theo rule hiện hành.
- Không gửi thêm lệnh sau trạng thái không chắc chắn và không tự retry packet đã có thể thành công.
- Summary/log phân biệt rõ hai loại thu dọn.
- Scheduler, cấu hình, priority rules và thao tác sạp thủ công giữ nguyên contract.
- Build/typecheck và các kiểm tra hiện có được chạy, với kết quả báo trung thực.
