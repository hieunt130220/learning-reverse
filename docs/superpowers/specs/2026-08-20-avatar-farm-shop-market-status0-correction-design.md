# Thiết Kế Sửa Luồng Chợ Sạp Nông Sản Cmd 103 Sub1 Status 0

**Ngày tạo:** 2026-08-20
**Trạng thái:** Đã duyệt (Approved)
**Spec gốc:** `docs/superpowers/specs/2026-08-20-avatar-farm-shop-integration-design.md`
**Phạm vi hệ thống:** `avatar-web` trong repository `learning-reverse`

## 1. Mục tiêu và bối cảnh

### 1.1. Vấn đề cần giải quyết

Khi người dùng bấm **Cập nhật chợ**, web gửi đúng request read-only:

```text
cmd 103 TX: 01 00 ff ff
```

Game server trả `cmd 103 / sub1 / status=0`, nhưng decoder hiện tại chỉ đọc ba trường đầu `subType + status + count`. Toàn bộ record catalog và metadata refresh bị bỏ lại, tạo log:

```text
cmd 103 sub1 còn 26 byte chưa đọc
```

Hệ quả:

- UI hiển thị chợ rỗng dù server đã trả ba nông sản.
- `timeRefresh` và `priceRefresh` không được giữ lại.
- Web chưa có bước chọn nông sản để gửi `openShop(1,1,itemId)` và lấy seller listings `status=1`.
- Snapshot/revision hiện tại gộp nhầm hai loại dữ liệu khác nhau thành một `market-snapshot`.

### 1.2. Bằng chứng runtime và native

Ba packet live liên tiếp của account 2 trước XOR:

```text
01 00 0003 0002 00000005 00c8 00000002 0007 00000001 00000708 0000000a
01 00 0003 0002 00000005 00c8 00000002 0007 00000001 00000627 0000000a
01 00 0003 0002 00000005 00c8 00000002 0007 00000001 00000619 0000000a
```

Giải mã đầy đủ:

```text
subType      = 1
status       = 0
count        = 3
items        = [{itemId:2, price:5}, {itemId:200, price:2}, {itemId:7, price:1}]
timeRefresh  = 1800 / 1575 / 1561
priceRefresh = 10
remaining    = 0
```

Native handler tại `0x637980` xác nhận nhánh `status=0` lặp `readShort + readInt`, tạo `ShopScr.ItemShop(itemId, -1, price, false, false)`, sau đó đọc hai `int` và gọi `ShopScr.setRefesh(timeRefresh, priceRefresh)`.

`ShopScr.IActionShop.perform @ 0x800928` xác nhận:

- `itemId == -1`: gửi `doOpenShop(1,0,-1)` để lấy catalog.
- `itemId != -1`: gửi `doOpenShop(1,1,itemId)` để lấy seller listings.

## 2. Phạm vi

### 2.1. In scope

- Sửa decoder RX `cmd 103 / sub1` cho cả `status=0` và `status=1`.
- Mô hình hóa riêng catalog chợ và seller listings.
- Giữ `timeRefresh` và `priceRefresh` dưới dạng metadata chỉ đọc.
- Thêm read flow `step0 -> chọn item -> step1` qua coordinator/API/UI.
- Gắn `status=1` với đúng `selectedItemId` bằng request context của coordinator, không suy đoán từ packet.
- Duy trì tương thích với cache JSON được tạo bởi implementation cũ.
- Cập nhật phân tích kỹ thuật cmd 103 bằng packet/native evidence mới.
- Xác minh live read-only trên account 2; không bật capability ghi.

### 2.2. Out of scope

- Không gửi `sub7` tự động.
- Không bật mua hàng, mở slot, đăng bán hoặc rút hàng.
- Không suy diễn `priceRefresh=10` là đơn vị tiền cụ thể khi chưa có money delta.
- Không tải seller listings cho mọi item tự động.
- Không thay schema SQL hoặc tạo bảng mới.
- Không tạo hoặc sửa test file nếu người dùng không yêu cầu riêng.

### 2.3. Input, output và edge cases

**Input:** RX cmd 103 sub1 từ game server và `itemId` người dùng chọn từ catalog hiện hành.

**Output:** Catalog cùng refresh metadata hoặc seller listings gắn với item đã chọn; UI không còn trailing-byte warning cho packet hợp lệ.

Edge cases bắt buộc:

- `status` ngoài `0|1`: ném `ShopProtocolDecodeError`.
- `count < 0`, vượt giới hạn hoặc body ngắn: reject nguyên packet, không cập nhật một phần.
- `status=0`: yêu cầu chính xác tối thiểu `count * 6 + 8` byte sau header.
- `status=1`: yêu cầu chính xác tối thiểu `count * 16` byte sau header.
- `status=1` không có request context `itemId`: không gắn listings vào item bất kỳ; phát protocol error/warning có cấu trúc.
- `status=1/count=0`: giữ catalog, đặt listings rỗng cho item đã chọn, không auto-retry.
- Chọn `itemId` không còn trong catalog/revision cũ: trả `STALE_SHOP_STATE`, không gửi packet.
- Reconnect: catalog/listings cũ được đánh dấu stale; request mới phải dùng epoch hiện tại.

## 3. Thiết kế contract giao thức

### 3.1. Types

```ts
export interface MarketCatalogItem {
  itemId: number;
  price: number;
}

export type ShopProtocolEvent =
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
    }
  // các subtype hiện có giữ nguyên
```

### 3.2. Decoder `status=0`

```text
i16 count
repeat count:
  i16 itemId
  i32 price
i32 timeRefresh
i32 priceRefresh
```

Decoder phải dùng `need()` trước từng primitive, `validateCount(..., minimumRecordBytes=6, trailingBytes=8)` và chỉ trả event sau khi đọc đủ body.

### 3.3. Decoder `status=1`

```text
i16 count
repeat count:
  i32 idShop
  i16 verShop
  i16 itemId
  i32 quantity
  i32 price
```

Nhánh này giữ record 16 byte đã xác minh. `selectedItemId` không nằm trên wire và không được thêm giả vào decoder event.

## 4. State, cache và realtime contract

### 4.1. Aggregate market state

```ts
export interface MarketData {
  catalog: MarketCatalogItem[];
  timeRefresh: number | null;
  priceRefresh: number | null;
  selectedItemId: number | null;
  listings: MarketListing[];
}
```

`ShopRuntimeState.market` tiếp tục dùng `ShopSnapshot<MarketData> | null` để không thêm cột DB.

Quy tắc cập nhật:

- `market-catalog`: tăng revision, thay catalog/metadata, đặt `selectedItemId=null`, `listings=[]`.
- `market-listings`: tăng revision, giữ catalog/metadata, đặt `selectedItemId` từ request context và thay listings.
- Mọi snapshot giữ `connectionEpoch` và `capturedAt` như contract hiện tại.

### 4.2. Tương thích cache cũ

`ShopRepository.loadCache()` normalize JSON cũ:

```ts
{ status: number, listings: MarketListing[] }
```

thành:

```ts
{
  catalog: [],
  timeRefresh: null,
  priceRefresh: null,
  selectedItemId: null,
  listings: [],
}
```

Seller listings legacy không có `selectedItemId` đáng tin cậy nên không được giữ để mua hoặc hiển thị như dữ liệu hiện hành. JSON sai kiểu hoặc field số không hợp lệ không được phát ra UI như state tin cậy; cache đó được bỏ qua hoặc đánh dấu stale theo error path hiện có.

### 4.3. WebSocket

Không thêm event channel mới. Event `shop` tiếp tục gửi toàn bộ `ShopRuntimeState`; frontend DTO và reducer mirror `MarketData` mới, vẫn áp dụng epoch guard hiện có.

## 5. Coordinator và API

### 5.1. Read operations

```ts
browseMarketCatalog(): Promise<ShopRuntimeState>
browseMarketItem(input: {
  itemId: number;
  expectedMarketRevision: number;
}): Promise<ShopRuntimeState>
```

`browseMarketCatalog()`:

```text
enqueue command lane
-> openShop(1,0,-1)
-> await sub1 kind=market-catalog
-> persist + emit shop
```

`browseMarketItem()`:

```text
validate current epoch + expectedMarketRevision
-> validate itemId exists in current catalog
-> attach {marketItemId:itemId} to pending request context
-> openShop(1,1,itemId)
-> await sub1 kind=market-listings
-> apply listings with marketItemId from context
-> persist + emit shop
```

`onShopProtocol` chỉ dùng pending context khi response khớp epoch, subtype và discriminator. Unsolicited `market-listings` không được gắn vào catalog item gần nhất.

### 5.2. REST

Giữ endpoint hiện có:

```text
POST /api/accounts/:id/shop/browse
```

Endpoint này tải catalog `step0`.

Thêm endpoint:

```text
POST /api/accounts/:id/shop/browse/:itemId
Body: { expectedMarketRevision: number }
```

Validation và error mapping:

- `itemId` và revision phải là số nguyên không âm.
- Account phải thuộc user hiện tại và session online.
- `SHOP_READ_ENABLED=true` là đủ; không dùng live-write allowlist.
- Revision/item stale trả HTTP 409 `STALE_SHOP_STATE`.
- Protocol/body invalid trả HTTP 500 `SHOP_PROTOCOL_ERROR`.
- Timeout trả HTTP 504 `SHOP_RESPONSE_TIMEOUT`.

## 6. UI/UX

Tab **Chợ** có hai view nội bộ:

1. **Catalog**
   - Hiển thị tên/ID nông sản và `price` server trả.
   - Hiển thị thời gian refresh còn lại và giá refresh dưới nhãn trung tính; không khẳng định loại tiền.
   - Mỗi item có nút **Xem sạp bán**.

2. **Seller listings**
   - Tiêu đề chứa item đang chọn.
   - Hiển thị `idShop`, `quantity`, `price` và nút mua chỉ theo capability hiện có.
   - Có nút **Quay lại danh mục** chỉ đổi view local, không gửi packet.

Nút **Cập nhật chợ** luôn gọi catalog `step0`. Nó không phải paid refresh. Khu vực sub7 tiếp tục disabled và ghi rõ đây là thao tác riêng có thể tốn phí.

## 7. Files/modules liên quan

| File/module | Vai trò thay đổi |
|---|---|
| `avatar-web/server/src/game/shopProtocol.ts` | Tách decoder event status0/status1 và đọc đủ body |
| `avatar-web/server/src/session/shopCoordinator.ts` | Hai read operation, pending request context, aggregate market state |
| `avatar-web/server/src/accounts/shopRepo.ts` | Types mới và normalize cache JSON legacy |
| `avatar-web/server/src/session/avatarSession.ts` | Expose browse item method typed |
| `avatar-web/server/src/session/shopRoutes.ts` | Endpoint browse item + validation/error mapping |
| `avatar-web/web/src/types.ts` | Mirror catalog/metadata/selected item/listings |
| `avatar-web/web/src/accounts/panels/ShopPanel.tsx` | Catalog view, chọn item, seller listings view |
| `avatar-web/web/src/styles.css` | Style scoped cho catalog/detail nếu cần |
| `docs/Phân tích kỹ thuật giao thức  — cmd 103 trong AvatarHD.md` | Sửa schema sub1 bằng runtime/native evidence |
| `docs/superpowers/plans/2026-08-20-avatar-farm-shop-integration.md` | Ghi correction evidence và liên kết addendum |

## 8. Verification plan

### 8.1. Protocol harness sau production code

Dùng packet live cố định:

```text
0100000300020000000500c800000002000700000001000006190000000a
```

Expected:

- `kind=market-catalog`, `status=0`, `count=3`.
- Items `(2,5)`, `(200,2)`, `(7,1)`.
- `timeRefresh=1561`, `priceRefresh=10`.
- `warning` không tồn tại, remaining bằng 0.

Thêm one-off harness cho:

- `status=1` với nhiều seller listings.
- status không hỗ trợ.
- count/body truncated ở cả hai nhánh.
- cache legacy normalize sang shape mới.
- `status=1` thiếu pending item context không mutate market state.

Không tạo hoặc sửa test file nếu người dùng không thay đổi yêu cầu test.

### 8.2. Automated verification

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

Expected: mọi lệnh exit 0; test file không đổi.

### 8.3. Live read-only acceptance

Với account 2, `SHOP_READ_ENABLED=true` và mọi write flag false:

1. Bấm **Cập nhật chợ**.
2. Xác nhận RX status0 không còn trailing warning và UI có ba catalog item.
3. Chọn từng item; xác nhận đúng một TX `01 01 <itemId:i16>` cho mỗi click.
4. Đối chiếu RX status1 với UI seller listings và revision tăng một lần.
5. Quay lại catalog không phát packet.
6. Xác nhận không có TX sub7 và không có money/inventory mutation.

## 9. Safety gates

- Gate C/D của spec gốc tiếp tục đóng.
- Correction này chỉ mở rộng read capability hiện đã bật.
- `priceRefresh` được lưu/hiển thị nhưng không dùng để cho phép paid refresh.
- Không thao tác mua, đăng, rút hoặc mở slot trong acceptance của correction này.
