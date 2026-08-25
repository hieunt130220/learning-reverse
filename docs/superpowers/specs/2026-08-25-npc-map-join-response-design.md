# Native NPC Map Join Response Design

## Mục tiêu & Bối cảnh

Candidate native-body đã đăng nhập account 2 và gửi đúng một `cmd 80` sáu
byte cho map 5 / area 7. Live traffic nhận `RX 80 len=134`; probe hiện đã
giải mã được prefix native và giữ phần hậu tố chưa xác định ở trạng thái
pending. Disassembly của
`GlobalMessageHandler.onMessage` xác nhận response `cmd 80` đọc trực tiếp
`roomID`, `boardID`, `x`, `y`, rồi các vector `listPlayer`, `mapItemType`,
`mapItem`, `animTempl` trước khi gọi `MapScr.onJoinPark`.

Mục tiêu là biến `RX 80` thành evidence redacted có thể kiểm chứng cho đúng
cặp map/area được yêu cầu, thay vì coi timeout `-34` là thất bại.

## Phạm vi (Scope)

### In-scope

- Chỉ chỉnh standalone `avatar-web/server/src/tools/npc-map-probe.ts` và tài
  liệu spec/plan của candidate.
- Giữ account `2`, `map=5`, `area=7`, body native `[i8 5, i8 7, i16 0, i16 0]`.
- Chờ một `RX 80` mới sau `TX 80`; decode prefix theo layout native đã quan sát
  (player tail 18 byte của nhánh non-tour), các vector map/animation và
  `nSpecial`/`ItemMapSpecial` khi còn đủ byte; kiểm tra `roomID=5`,
  `boardID=7`, bounds và trailing bytes.
- In metadata redacted: request, response length, tọa độ map response, số
  player/drop-part/animation và số byte hậu tố chưa decode; không in raw body,
  tên người chơi, ID tài khoản, credential, host/port hay hex.

### Out-of-scope

- Không gửi `-24`, `-23`, `-21`, NPC interaction, combat, reward, retry/fallback
  payload, hoặc sweep tọa độ.
- Không sửa `ParkService`, `GameClient`, decoder production, API/WS/UI/database
  hay dữ liệu tài khoản.
- Không gọi `RX 80` là catalog map toàn cục; chỉ gọi là direct-join evidence
  khi response room/board khớp request và cấu trúc decode hợp lệ.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

```text
online -> ACK handler Park -> arm RX80 waiter -> TX80[5,7,0,0]
       -> decode native response -> validate room/board/trailing -> redacted evidence
```

`decodeParkJoinResponse` dùng `MyReader` big-endian hiện có. Prefix native là
`i8 roomID`, `i8 boardID`, `i16 x`, `i16 y`; sau đó là `listPlayer` với state
non-tour 18 byte mỗi player, marker, map vectors, animation count và special
count theo nhánh native. Parser bounded không lưu payload thô. Ở live run
`2026-08-25T05:50:39.594Z`, response `room=5`, `board=7`, `x=0`, `y=0`,
`responseBytes=134`, `listPlayerCount=2`, `listPlayerEnd=109`, `mapMarker=0`,
`animCount=0`, `specialCount=0`, `specialSectionEnd=113`, còn
`trailingBytes=21`; vì vậy decoder trả
`park-response-prefix-pending`, không giả định hậu tố là catalog.

Một invocation được ủy quyền lặp lại lúc
`2026-08-25T06:08:54.133Z` vẫn cho cùng metadata redacted (`RX 80 len=134`,
room/board `5/7`, `listPlayerCount=2`, `specialCount=0`,
`specialSectionEnd=113`, `trailingBytes=21`). Sự lặp lại này củng cố direct
join cho cặp `5/7`, nhưng không đủ để tạo catalog toàn cục hay evidence vị trí
NPC.

Sau khi đối chiếu `LoadMap.doJoin` với `PositionMap`, probe đã thay hai short
baseline bằng tọa độ native của entry map 5 `(254,82)`. Invocation thành công
lúc `2026-08-25T06:18:02.122Z` nhận lại đúng `room/board=5/7` và
`x/y=254/82`, cùng `specialCount=0`, `specialSectionEnd=113` và
`trailingBytes=21`. Đây là evidence map-position/direct-join mạnh hơn, nhưng
catalog NPC vẫn pending vì chưa có `ItemMapSpecial` live và hậu tố chưa được
giải mã độc lập.

## Verification Plan

1. Chạy GitNexus impact cho `runProbe` và helper mới; dừng nếu HIGH/CRITICAL.
2. Typecheck, `git diff --check`, và static scan chỉ còn một `cmd 80`.
3. Chạy một invocation account 2 / map 5 / area 7; direct-join observed khi có
   `TX 80 len=6`, `RX 80`, room/board khớp và prefix decode bounded. Strict
   catalog/NPC evidence vẫn pending cho tới khi giải quyết hậu tố hoặc có
   packet enter-world tương ứng.
4. Ghi timestamp/traffic redacted vào plan; không tạo catalog từ prefix này và
   không commit ngoài user request.
