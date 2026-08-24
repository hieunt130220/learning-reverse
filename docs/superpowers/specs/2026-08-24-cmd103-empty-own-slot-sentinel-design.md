# Cmd 103 Empty Own-Slot Sentinel Design

## Mục tiêu và bối cảnh

Luồng Auto Sell đã gửi lệnh thu slot 0 và nhận ACK thành công từ server:

```text
RX cmd 103 subType=4 result=0 slot=0 value=8100
```

Ngay sau đó, bước reconcile gọi `openShop(0, -1, -1)` và nhận packet live:

```text
TX cmd 103: 00
RX cmd 103: 0001ffff01
```

Packet này có cấu trúc:

```text
00    subType = 0 (own shop)
01    count = 1
ffff  slot 0 itemId = -1 (slot trống)
01    canOpenSlot = true
```

Decoder hiện tại trong `shopProtocol.ts` áp dụng validation cố định
`count * 11 + 1` trước khi đọc từng slot. Với `count=1`, decoder yêu cầu tối
thiểu 12 byte sau offset 2, trong khi slot trống chỉ còn `i16 itemId=-1` và
`bool canOpenSlot`, tổng cộng 3 byte. Packet hợp lệ vì vậy bị phân loại nhầm là
`SHOP_PROTOCOL_ERROR`.

`GameClient` phát `shop-protocol-error`; `ShopCoordinator` khóa channel cmd
103 cho connection epoch hiện tại và chuyển giao dịch đã gửi thành `unknown`.
Reconnect tạo epoch mới nhưng lần sync tiếp theo nhận lại cùng snapshot slot
trống, nên decoder lại báo lỗi và channel lại bị khóa. Đây là nguyên nhân lỗi
lặp lại; reconnect không thể sửa một schema decoder sai.

Mục tiêu của thay đổi là giải mã đúng sentinel `itemId=-1` của slot trống,
khôi phục snapshot sạp và cho phép cơ chế reconcile hiện có kết luận giao dịch
`unknown` từ fresh server state mà không gửi lại lệnh thu.

## Phạm vi

### In scope

- Sửa nhánh RX cmd 103 sub-type 0 trong
  `avatar-web/server/src/game/shopProtocol.ts`.
- Xem `count` là số slot đã mở, không phải số record đầy đủ.
- Với mỗi slot, luôn đọc `i16 itemId` trước.
- Khi `itemId === -1`, không đọc `quantity`, `price`, `isSale` hoặc
  `isTimeOut`; chuẩn hóa thành một `OwnShopSlot` trống.
- Giữ schema hiện tại cho slot có hàng, gồm điều kiện chỉ đọc `isTimeOut` khi
  `isSale === false`.
- Cập nhật tài liệu protocol cmd 103 để ghi nhận sentinel slot trống dựa trên
  packet live.
- Xác minh decoder bằng one-off harness, các test hiện có, typecheck/build và
  live read-only reconciliation sau khi được phép tích hợp.

### Out of scope

- Không tự retry giao dịch `unknown` hoặc gửi lại `takeItemBack(slot)`.
- Không thêm reconnect tự động khi gặp decode error.
- Không nới lỏng toàn bộ packet ngắn thành warning hoặc bỏ qua lỗi thiếu byte.
- Không thay đổi `ShopCoordinator`, `GameClient`, REST/WebSocket contract,
  database schema hoặc UI.
- Không sửa transaction cũ trực tiếp trong SQLite.
- Không tạo hoặc sửa test file vì người dùng chưa yêu cầu viết test.
- Không thay đổi AutoFarm, rules bán, khoảng nghỉ vòng hoặc các hành động farm
  khác.

## Input, output và data contract

### Wire contract RX cmd 103 sub-type 0

```text
u8 subType = 0
i8 count
repeat count lần:
  i16 itemId
  if itemId == -1:
    không có field nào khác cho slot này
  else:
    i32 quantity
    i32 price
    bool isSale
    if isSale == false:
      bool isTimeOut
bool canOpenSlot
```

`count` tiếp tục bị giới hạn trong `[0, 127]`.

Minimum-length validation của sub-type 0 đổi từ record cố định
`count * 11 + 1` sang minimum thực sự `count * 2 + 1`: mỗi slot luôn có ít
nhất `i16 itemId`, và packet luôn có boolean `canOpenSlot` cuối cùng. Các
field của slot có hàng vẫn dùng các helper `readInt`/`readBoolean` hiện tại,
nên packet bị cắt ở giữa record vẫn ném `ShopProtocolDecodeError` với offset
chính xác.

### Normalized empty slot

Sentinel `itemId=-1` được xuất thành:

```ts
{
  slot,
  itemId: -1,
  quantity: 0,
  price: 0,
  isSale: false,
  isTimeOut: false,
}
```

Không bỏ slot trống khỏi mảng. Mỗi index từ `0` đến `count - 1` vẫn có một
entry, phù hợp với các consumer hiện tại:

- `ShopPanel` hiển thị `itemId < 0` là “Trống”;
- Auto Sell coi `itemId === -1` hoặc `quantity <= 0` là slot rảnh;
- reconciliation xác định listing cũ đã biến mất bằng cách so sánh item,
  quantity và price.

Các giá trị `itemId` khác `-1` giữ nguyên hành vi decoder hiện tại; thay đổi
này không mở rộng hoặc suy đoán thêm sentinel khác.

## Thiết kế kiến trúc và giải pháp kỹ thuật

### Files và vai trò

| File | Thay đổi | Vai trò |
|---|---|---|
| `avatar-web/server/src/game/shopProtocol.ts` | Sửa validation và loop sub-type 0 | Chuyển packet wire thành `ShopProtocolEvent` |
| `docs/Phân tích kỹ thuật giao thức  — cmd 103 trong AvatarHD.md` | Bổ sung nhánh `itemId=-1` và packet evidence | Giữ tài liệu reverse-engineering khớp server live |

Tên thực tế của file tài liệu Unicode phải được resolve bằng `rg --files`
trước khi chỉnh sửa; không đổi tên file.

### Decoder flow

```text
RX cmd 103
  -> GameClient.onMessage
  -> decodeShopPacket
  -> subType 0
       -> read count
       -> validate count * 2 + trailing canOpenSlot
       -> for each slot
            -> read itemId
            -> itemId == -1: emit normalized empty slot
            -> otherwise: read quantity/price/isSale/[isTimeOut]
       -> read canOpenSlot
  -> emit shop-protocol
  -> ShopCoordinator.applyProtocolEvent
  -> persist fresh own snapshot
```

`GameClient` và `ShopCoordinator` không cần thay đổi. Cơ chế channel blocking
vẫn đúng cho packet thực sự malformed; sau sửa, packet sentinel hợp lệ không còn
đi vào error path.

### Reconciliation của giao dịch hiện tại

Giao dịch:

```text
id: 359ac82a-93af-4c91-be2d-1315395a382e
kind: withdraw
status: unknown
autoCollectKind: sold
slot: 0
```

đã có ACK `result=0, value=8100`. Sau khi decoder mới được tích hợp và tạo
connection epoch mới:

1. `syncOwnShopInLane()` nhận snapshot slot 0 trống.
2. Coordinator lấy price rules và inventory theo flow hiện tại.
3. `reconcileUnknownTransactions()` chạy một lần cho epoch.
4. Với auto-collect loại `sold`, `oldListingGone=true` vì slot 0 có
   `itemId=-1`.
5. Transaction được chuyển từ `unknown` sang `succeeded` với bằng chứng
   `reconciledAfterReconnect`.

Không gọi lại `takeItemBack(0)`; không tạo idempotency key thay thế.

## Error handling và edge cases

### Packet hợp lệ

- `count=0`: đọc trực tiếp `canOpenSlot`, trả `slots=[]`.
- Một hoặc nhiều slot đều trống: mỗi slot chỉ tiêu thụ 2 byte `itemId=-1`.
- Snapshot trộn slot trống và slot có hàng: cursor tiếp tục đúng ở slot kế tiếp.
- Slot có `isSale=true`: không đọc `isTimeOut`.
- Slot có `isSale=false`: bắt buộc đọc `isTimeOut`.

### Packet không hợp lệ

- `count < 0` hoặc `count > 127`: giữ lỗi count hiện tại.
- Thiếu một `itemId` hoặc thiếu `canOpenSlot`: ném
  `ShopProtocolDecodeError`.
- Slot có hàng nhưng thiếu quantity/price/status: helper field-level hiện tại
  ném lỗi với field và offset chính xác.
- Packet còn byte sau event hợp lệ: giữ warning `TRAILING_BYTES`; không biến
  thành success im lặng.

### Channel safety

- Decode error thật vẫn khóa channel cho epoch hiện tại.
- Pending request vẫn bị reject khi packet tương ứng malformed.
- Không tự reconnect hoặc tự retry sau lỗi, tránh gửi lặp giao dịch có thể đã
  thành công ở server.

## Verification plan

### 1. Source contract

Xác nhận sub-type 0:

- minimum record bytes là 2 và trailing bytes là 1;
- có branch `itemId === -1`;
- empty slot được normalize đủ sáu field;
- slot có hàng giữ conditional `isTimeOut`.

### 2. One-off decoder harness, không tạo test file

Chạy harness bằng runtime TypeScript hiện có và assert:

| Fixture | Expected |
|---|---|
| `0001ffff01` | một slot trống, `numSlot=1`, `canOpenSlot=true`, không warning |
| `000001` | không slot, `canOpenSlot=true` |
| `0002ffff000300000384000000090101` | slot 0 trống, slot 1 item 3/900/9 đã bán |
| `000100030000038400000009000101` | slot có hàng, `isSale=false`, `isTimeOut=true` |
| `0001ffff` | lỗi minimum-length của `own.count` tại offset 2, không trả snapshot |

Harness chỉ đọc source/runtime và in kết quả; không kết nối game, không sửa DB.

### 3. Regression verification

Trong `avatar-web/server`:

```bash
npm run typecheck
npm test
npm run build
```

Trong `avatar-web/web`:

```bash
npm test
npm run build
```

Chạy `git diff --check`. Trước commit phải chạy
`gitnexus_detect_changes(scope: "staged")` và xác nhận chỉ các symbol/flow
decoder dự kiến bị ảnh hưởng.

### 4. Live acceptance có kiểm soát

Checkout `main` hiện được backend watch và tài khoản 2 đang bật AutoFarm. Vì
merge/reload sẽ tạo epoch mới và kích hoạt sync, phải xin xác nhận riêng ngay
trước khi tích hợp production code vào checkout này.

Sau khi được phép:

1. Chụp read-only baseline của transaction, own snapshot và auto state.
2. Tích hợp code và quan sát backend reload; không bấm Rút và không gửi raw cmd
   103.
3. Xác nhận packet `0001ffff01` decode thành own snapshot revision mới có slot
   0 trống.
4. Xác nhận channel không còn `SHOP_PROTOCOL_ERROR` cho packet này.
5. Xác nhận transaction
   `359ac82a-93af-4c91-be2d-1315395a382e` được reconcile thành
   `succeeded`, không có transaction withdraw thay thế.
6. Nếu ACK/state không đủ bằng chứng, giữ transaction `unknown`; tuyệt đối
   không retry hay sửa DB trực tiếp.

## Rủi ro và kiểm soát

- **Rủi ro đọc lệch mixed snapshot:** fixture trộn empty/occupied bắt buộc chứng
  minh cursor.
- **Rủi ro che packet bị cắt:** chỉ sentinel `-1` được rút gọn; các field khác
  vẫn fail closed.
- **Rủi ro gửi lặp giao dịch:** không thay coordinator/no-retry contract; live
  acceptance chỉ quan sát reconciliation.
- **Rủi ro hot reload khi AutoFarm đang bật:** tách static verification khỏi
  integration và xin xác nhận riêng trước khi chạm checkout được watch.
- **Rủi ro ảnh hưởng consumer:** giữ nguyên `OwnShopSlot` interface và chuẩn
  hóa slot trống theo convention consumer đang dùng.

## Tiêu chí hoàn tất

- Packet live `0001ffff01` decode thành snapshot hợp lệ, không block cmd 103.
- Snapshot hỗn hợp empty/occupied không lệch cursor.
- Packet malformed vẫn báo lỗi field/offset và vẫn kích hoạt safety block.
- Không thay đổi public API, DB schema, UI hoặc no-retry transaction contract.
- Toàn bộ verification tĩnh pass.
- Live acceptance, khi được cho phép, chứng minh transaction cũ được reconcile
  từ fresh state mà không có lệnh thu hoặc transaction thay thế.
