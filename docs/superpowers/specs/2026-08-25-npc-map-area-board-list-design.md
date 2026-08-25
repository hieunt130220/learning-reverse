# NPC Map Area Board-List Probe Design

## Mục tiêu & Bối cảnh

Probe account 2 / map 5 / area 7 hiện đã chứng minh được direct join bằng
`cmd 80` với body native sáu byte và nhận `RX 80`, nhưng chưa có catalog area
live hoặc tên NPC. Native client có một đường UI-matched chỉ đọc:
`ParkService.doRequestBoardList(sbyte roomId)` gửi `cmd 90` với đúng một byte
`roomId`; handler native đọc phản hồi thành một mảng occupancy theo board.

Mục tiêu là thêm bước đọc board/area catalog vào standalone probe, chạy đúng
một lần cho account 2 / map 5 / area 7, và chỉ ghi nhận catalog khi phản hồi
`cmd 90` đầy đủ, hợp lệ, đã được decode theo native contract. Đây là bước thu
thập evidence, chưa mở catalog NPC production.

## Phạm vi (Scope)

### In-scope

- Chỉ chỉnh `avatar-web/server/src/tools/npc-map-probe.ts` và tài liệu
  evidence/plan liên quan.
- Một phiên account `2`, một `map=5`, một `area=7`; không nhận range và không
  retry/sweep.
- Sau login và ACK Park handler `9`, gửi đúng một `cmd 90` với body:

  ```text
  i8 roomId = 5
  ```

- Decode `RX 90` theo native handler:

  ```text
  i8 count
  count × i8 occupancy
  ```

  Chỉ chấp nhận `0 <= count <= 64` và không có trailing byte; mỗi area được
  gắn nhãn rõ là **0-based UI index**. Occupancy được giữ nguyên signed-byte
  evidence, không suy diễn tên/kích thước NPC.
- Sau khi nhận board list, giữ bước direct join hiện có: một `cmd 80` body
  `[i8 map, i8 area, i16 xJoinCasino, i16 yJoinCasino]`, rồi capture passive
  `cmd 48` trong grace window hiện có.
- In redacted metadata: traffic phase/command/length, board count và các cặp
  `{area, occupancy}`, cùng kết quả direct join/`ItemMapSpecial` nếu có.

### Out-of-scope

- Không gửi lại các candidate `-24`, `-23`, `-21` hoặc tự đoán command khác.
- Không sweep area, không reconnect/retry, không tương tác NPC, combat,
  reward, mua bán, hoặc thay đổi world state.
- Không tạo `npcMapCatalog.ts`, không bật Auto Tìm NPC production, không sửa
  API/WS/UI/database/GameClient/ParkService production.
- Không ghi raw packet body, hex, credential, cookie, token, host/port hay
  dialog text. Không gọi service bên ngoài.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

```text
login account 2
  -> TX -1 [9] / RX -1
  -> TX 90 [5] / RX 90 [count, occupancy...]
  -> TX 80 [5,7,xJoinCasino,yJoinCasino] / RX 80
  -> passive RX 48 capture (3 s)
  -> redacted evidence
```

Probe thêm phase `board-list` trước `direct-join`. Waiter `RX 90` được arm
trước khi gửi `cmd 90`, chỉ bắt response mới của phiên hiện tại. Decoder không
đọc `entry.hex` ra output; chỉ trả metadata đã chuẩn hóa. Nếu thiếu, âm, quá
lớn hoặc có trailing byte, probe báo `catalog-pending` và vẫn không tạo
production catalog. `RX 80` tiếp tục được phân loại độc lập; map namespace
(native CityMap map 5 `Công viên` so với legacy labels) vẫn phải ghi rõ là
chưa hợp nhất.

## Verification Plan

1. Đọc lại static native proof cho `doRequestBoardList`/handler `cmd 90` và
   giữ contract trong spec này.
2. Chạy GitNexus impact cho mọi symbol probe sửa; dừng và báo nếu HIGH hoặc
   CRITICAL.
3. Typecheck server, `git diff --check`, và static scan bảo đảm chỉ có một
   `cmd 90`, một `cmd 80`, không có sweep/retry/command cấm.
4. Kiểm tra preflight local Avatar Web đã tắt; chạy đúng một invocation:

   ```bash
   npx --prefix avatar-web/server tsx --env-file=avatar-web/server/.env \
     avatar-web/server/src/tools/npc-map-probe.ts \
     --account-id 2 --map 5 --area 7
   ```

5. Chỉ gọi là **area catalog observed** khi có `TX 90 len=1`, `RX 90` decode
   đầy đủ với count/occupancy hợp lệ và direct join cũng có evidence riêng.
   Nếu `RX 90` timeout/malformed hoặc không có `RX 48`, kết quả vẫn là
   pending; không được suy diễn catalog NPC từ timeout hay occupancy.
6. Không commit nếu user chưa yêu cầu; giữ nguyên các artifact dirty khác.

## User Review Gate

Phải được user duyệt spec này và implementation plan tương ứng trước khi sửa
probe production/tool source.
