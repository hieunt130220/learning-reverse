# NPC Park Runtime Protocol-Correction Design

## Mục tiêu & Bối cảnh

Production Auto Tìm NPC đã có runner/coordinator/API nhưng runtime contract
đang lệch evidence live: `ParkService` gửi `cmd 80` chỉ có `roomID, boardID`
và runner chỉ chờ `cmd -34`. Probe account 2 / map 5 / area 7 đã chứng minh
native client gửi sáu byte (`i8 map`, `i8 area`, `i16 xJoinCasino`, `i16
yJoinCasino`) và server trả `RX 80 len=134`; phần response prefix chứa
`ItemMapSpecial[]`, còn 20 byte suffix ổn định chưa được giải mã.

Mục tiêu là sửa production path để AutoFindNpc dùng đúng native join và nhận
snapshot từ `RX 80`, đồng thời inject đúng cặp map/area duy nhất đã live-verify.
Không dùng candidate chưa được probe và không gửi fallback opcode.

## Phạm vi (Scope)

### In-scope

- `avatar-web/server/src/game/parkService.ts`: encode native six-byte join;
  map 5 dùng `(x,y)=(254,82)`, map không có position đã review thì throw trước
  khi gửi.
- `avatar-web/server/src/game/worldData.ts`: thêm decoder tuần tự cho prefix
  native `RX 80`:

  ```text
  i8 room, i8 board, i16 x, i16 y,
  listPlayer + dropParts,
  map marker/items, animations, ItemMapSpecial[]
  ```

  Decoder consume đúng tới `specialSectionEnd`, chấp nhận và ghi nhận trailing
  20-byte suffix ổn định của server build này; không offset-scan/heuristic.
- `avatar-web/server/src/game/client.ts`: khi nhận command 80, decode và emit
  cùng `world-snapshot` event mà `AutoFindNpc` đang chờ; lỗi decode chỉ reject
  waiter/log, không làm trạng thái login offline.
- Tạo `avatar-web/server/src/game/npcMapCatalog.ts` với duy nhất
  `{ map: 5, area: 7 }`, sao chép từ evidence live đã ghi.
- `avatar-web/server/src/index.ts`: truyền catalog vào `SessionManager` để
  API không còn trả `catalog-unverified` cho cặp đã verified.
- Cập nhật plan/evidence redacted; không ghi raw packet, credential hoặc
  player/NPC identifier ngoài metadata cần cho snapshot matching.

### Out-of-scope

- Không thêm map/area khác, không sweep board list, không tự sinh catalog từ
  occupancy `RX 90`; occupancy chỉ là board-state evidence.
- Không gửi `-24`, `-23`, `-21`, command NPC/combat/reward hoặc write command.
- Không đổi runner state machine, API contract, DB schema, UI, shop/farm lane
  ngoài việc cung cấp snapshot đúng event.
- Không tuyên bố end-to-end live target nếu `ItemMapSpecial` không xuất hiện.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

```text
AutoFindNpc.joinPark(5,7)
  -> ParkService.doJoinPark
  -> TX 80 [5,7,254,82]
  -> GameClient.onMessage(80)
  -> decodeParkJoinWorld(playerId)
  -> emit world-snapshot
  -> AutoFindNpc exact-name match
```

`EnterWorldSnapshot` được mở rộng bằng các field room/board/position optional;
decoder login `-34` giữ nguyên. Decoder RX80 dùng strict bounds, signed counts
không âm, UTF length bounds, drop-part records 11 byte, và native special
schema. `trailingBytes` được trả ra để quan sát nhưng không được diễn giải như
NPC data.

Catalog production chỉ có một entry vì chỉ `5/7` có direct-join evidence; các
area khác dù xuất hiện trong `RX 90` chưa được join/parse live nên vẫn out of
scope.

## Verification Plan

1. Chạy GitNexus impact upstream cho `ParkService.doJoinPark`,
   `decodeEnterWorld`/decoder mới, `GameClient.onMessage`, `SessionManager`
   construction và `index.ts`; dừng nếu HIGH/CRITICAL.
2. Typecheck và build server; chạy regression test suite hiện có (không tạo
   test file mới theo repository policy).
3. Static scan xác nhận `ParkService` chỉ gửi một native `cmd 80` sáu byte và
   không có fallback `-24/-23/-21`.
4. `gitnexus_detect_changes(scope="all")` xác nhận chỉ game/session wiring,
   catalog và docs bị ảnh hưởng.
5. Live acceptance production chỉ thực hiện khi user ủy quyền phiên game;
   nếu snapshot RX80 có `specials=[]`, báo protocol/catalog verified nhưng live
   target pending.

## User Review Gate

Spec này là protocol correction dựa trên evidence `2026-08-25T07:47:19.723Z`.
Production source chỉ được sửa sau khi user yêu cầu triển khai product code;
request hiện tại được xem là ủy quyền đó.
