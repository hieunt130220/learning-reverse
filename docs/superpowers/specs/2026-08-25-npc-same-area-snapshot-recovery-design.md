# NPC Same-Area Snapshot Recovery Design

## Mục tiêu & Bối cảnh

Auto Tìm NPC hiện đã gửi đúng native `cmd 80` sáu byte và giải mã được
`RX 80`. Tuy nhiên server không phát lại `RX 80` khi client đang đứng sẵn ở
cùng room/board; nó chỉ trả dialog `-40` với nội dung `Bạn đã ở trong khu vực
muốn chuyển đến`. Runner chỉ chờ snapshot mới nên ghi nhận sai thành
`hết giờ chờ gói enter-world (-34)` và tăng backoff.

Mục tiêu là biến trường hợp same-area đã được server xác nhận thành một lần
quan sát hợp lệ bằng snapshot Park RX80 gần nhất trong chính `GameClient`,
tránh timeout giả mà không suy diễn dữ liệu từ dialog.

## Phạm vi (Scope)

### In-scope

- Cache bản RX80 Park cuối cùng sau khi decoder strict thành công.
- Mở rộng waiter với target room/board tùy chọn; chỉ fallback khi:
  1. waiter đang chờ đúng request,
  2. server trả đúng dialog same-area,
  3. cache có `roomId/boardId` trùng target.
- Truyền target map/area từ `AutoFindNpc.scanningStep` và `trackingStep`.
- Giữ nguyên snapshot login `-34` và không dùng nó làm bằng chứng Park.
- Bổ sung log/metadata đủ để phân biệt RX80 mới với cache same-area trong
  runtime acceptance; không lưu raw packet hoặc credential.

### Out-of-scope

- Không gửi lại handler, không thử `-23/-24/-21`, không đổi tọa độ native.
- Không coi dialog same-area tự nó là snapshot nếu chưa có cache RX80 khớp.
- Không thêm map/area catalog, không suy đoán NPC từ suffix hoặc occupancy.
- Không thay đổi tracking/missing policy ngoài việc loại bỏ timeout giả.
- Không tạo test file mới theo policy repo; dùng test/build hiện có và probe
  bounded để xác minh.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

```text
RX80 -> decodeParkJoinWorld -> latestParkSnapshot
TX80(target) -> waitForWorldSnapshot(target)
  -> RX80 mới ----------------------> resolve snapshot (fresh)
  -> dialog -40 same-area + cache --> resolve cached snapshot (same-area)
  -> mọi trường hợp khác -----------> timeout/decode error thật
```

`GameClient` giữ `latestParkSnapshot` chỉ từ command 80 đã decode thành công.
`waitForWorldSnapshot(signal, timeoutMs, expected)` đăng ký thêm listener cho
dialog; listener chỉ chấp nhận message exact same-area và cache có
`roomId === expected.map`, `boardId === expected.area`. Khi resolve cache,
waiter trả một bản clone để caller không sửa state dùng chung. Cache không
được khởi tạo từ login `-34`, và không được resolve chỉ vì timeout.

`AutoFindNpcClient.waitForWorldSnapshot` nhận thêm target tùy chọn. Hai bước
scan/tracking truyền map/area hiện tại; các mock/client cũ vẫn tương thích vì
tham số mới là optional.

## Verification Plan

1. Chạy GitNexus impact upstream cho `GameClient.waitForWorldSnapshot`,
   `GameClient.onMessage`, `AutoFindNpc.scanningStep` và
   `AutoFindNpc.trackingStep`; dừng nếu HIGH/CRITICAL.
2. Chạy typecheck, build và test suite hiện có; không tạo test file mới.
3. Static scan xác nhận fallback chỉ nằm sau exact dialog + cache room/board,
   không có fallback opcode hay login snapshot reuse.
4. Live acceptance account 2 / map 5 / area 7: một RX80 đầu tiên phải được
   ghi nhận; lần gọi lại cùng area trả `-40` nhưng waiter phải resolve bằng
   cache, không xuất hiện `hết giờ chờ...`; `specials=[]` vẫn báo target
   pending, không claim đã tìm thấy NPC.

## User Review Gate

Spec này dựa trên live reproduction ngày 2026-08-25: RX80 đầu tiên thành công,
các TX80 lặp lại cùng 5/7 chỉ nhận dialog same-area. Chờ user duyệt Spec và
Plan trước khi sửa production code.
