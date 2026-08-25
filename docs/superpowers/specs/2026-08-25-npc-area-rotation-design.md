# NPC Area Rotation for Auto Tìm NPC V1 Design

## Mục tiêu & Bối cảnh

AutoFindNpc đã có cursor và logic chuyển sang phần tử kế tiếp sau khi snapshot
không chứa NPC. Tuy nhiên production catalog hiện chỉ có một phần tử
`{ map: 5, area: 7 }`, nên cursor quay về chính khu 7 và runner chỉ nghỉ rồi
thử lại cùng khu. Đây là lý do UI không thể chuyển sang khu khác dù phần scan
đã sẵn sàng.

Mục tiêu là đưa các area đã được server quảng bá vào catalog có thứ tự để khi
khu hiện tại không có NPC, AutoFindNpc gửi native `cmd 80` cho area kế tiếp.

## Bằng chứng hiện có

- `RX 90` live của room 5 đã trả `boardCount=35`, các index UI 0..34; evidence
  redacted nằm trong `docs/protocol/npc-map-probe-evidence-2026-08-25.md`.
- `cmd 80` map 5 đã được xác minh với tọa độ native `(254,82)` và response
  `room/board=5/7`.
- Production catalog hiện cố ý chỉ bật `{ map: 5, area: 7 }`, vì trước đó các
  index RX90 khác chưa được đưa vào danh sách scan.

## Phạm vi (Scope)

### In-scope

- Mở rộng catalog production của map 5 thành thứ tự area `0..34` từ board-list
  live đã quan sát.
- Giữ nguyên native join `cmd 80`, tọa độ map 5, same-area snapshot cache và
  target-aware waiter.
- Giữ nguyên cursor hiện tại: miss ở scan tăng sang area kế tiếp; miss hợp lệ
  hai lần trong tracking bỏ tracking và chuyển sang area kế tiếp; hết một vòng
  mới backoff 30 giây.
- Cho phép xác minh bounded rằng từ area 7 runner thực sự gửi area kế tiếp.

### Out-of-scope

- Không thêm map khác, không suy diễn tên NPC từ occupancy, suffix RX80 hoặc
  packet chưa decode.
- Không đổi opcode sang `-23/-24/-21`, không thêm NPC interaction, combat,
  reward hay write command.
- Không đổi persistence/API/WS/UI contract; `total` runtime chỉ phản ánh
  catalog mới.
- Không tạo test file mới theo policy repo.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

```text
VERIFIED_NPC_MAP_CATALOG = [5/0, 5/1, ..., 5/34]
            |
            v
AutoFindNpc.scanningStep
  miss at 5/7 -> cursor = 8 -> TX80(5,8,254,82)
  miss through 5/34 -> wrap -> backoff -> scan 5/0
```

`npcMapCatalog.ts` sẽ xuất một mảng readonly theo thứ tự tăng dần area. Không
cần sửa `AutoFindNpc`: cơ chế cursor đã hỗ trợ nhiều phần tử và đã truyền
`expected map/area` vào waiter. Comment/catalog metadata phải ghi rõ các area
là **board indexes 0-based từ RX90**, còn NPC presence chỉ được kết luận từ
snapshot RX80 của từng lần join.

## Edge cases & Safety

- Snapshot `specials=[]` là miss hợp lệ và phải chuyển area, không phải lỗi.
- Same-area dialog chỉ dùng cache khi room/board khớp target; không làm lệch
  cursor.
- Timeout/decode error vẫn backoff theo logic hiện tại; không coi là NPC miss.
- Nếu server từ chối một area, runner ghi lỗi/backoff và tiếp tục vòng theo
  catalog, không tự suy đoán area hợp lệ.

## Verification Plan

1. Chạy GitNexus impact trước khi sửa catalog/import seam; risk LOW/MEDIUM phải
   được ghi nhận, HIGH/CRITICAL phải dừng để báo user.
2. Static assert catalog có đúng 35 phần tử, unique, map=5, area 0..34 và thứ
   tự tăng dần; `git diff --check`.
3. Chạy server typecheck, build và test suite hiện có; không tạo test mới.
4. Sau khi user cho phép live acceptance, chạy bounded account 2 với map 5,
   bắt đầu area 0 và quan sát một bước kế tiếp area 1. Chỉ xác nhận chuyển
   khu nếu traffic có `TX 80` target `5/1` hoặc UI runtime `probing/current`
   hiển thị `Map 5 - Khu 1`; dừng runner ngay sau bằng chứng.

## User Review Gate

Chờ user duyệt Spec và Plan trước khi sửa production catalog. Live acceptance
cần quyền rõ cho account `2`, map `5`, bắt đầu area `0` và chuyển sang area `1`
vì sẽ gửi thêm native join request.
