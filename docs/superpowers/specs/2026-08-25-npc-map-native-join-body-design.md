# Native NPC Map Join Body Design

## Mục tiêu & Bối cảnh

Probe account 2 / map 5 / area 7 đã qua đăng nhập và ACK Park nhưng không nhận
`RX -24`, vì headless Node không tạo được callback `MapScr.joinCitymap`/cache
state của native client. Một lần disassembly trực tiếp của
`ParkService.doJoinPark @0x718188` cho thấy request join không phải body 2 byte:
native ghi `roomID`, `boardID`, rồi hai `writeShort` lấy từ
`LoadMap.xJoinCasino` và `LoadMap.yJoinCasino` (static offsets `+0x128` và
`+0x12C`). Direct-join candidate trước đó vì vậy chưa wire-equivalent.

Mục tiêu của candidate này là kiểm tra đúng một lần body native 6 byte cho cặp
được ủy quyền, rồi phân loại response. Đây là probe chẩn đoán, không phải mở
catalog production.

## Phạm vi (Scope)

### In-scope

- Chỉ chỉnh standalone `avatar-web/server/src/tools/npc-map-probe.ts`.
- Account `2`, `map=5`, `area=7`, một invocation duy nhất.
- Sau login và ACK `GET_HANDLER(9)`, arm waiter snapshot rồi gửi đúng một
  `cmd 80` với body:

  ```text
  i8  roomID = 5
  i8  boardID = 7
  i16 xJoinCasino = 0
  i16 yJoinCasino = 0
  ```

- Chờ tối đa bảy giây cho snapshot `-34` mới; decode bằng decoder hiện có và
  chỉ in metadata redacted (`playerId` không in ra, chỉ kiểm tra dương, số
  special, tên NPC, kích thước/trailing).
- Ghi lại `TX 80 len=6`, các response command/length đã redact, và phân loại
  `direct-join observed` hoặc `direct-join pending`.

### Out-of-scope

- Không gửi `-24`, `-23`, `-21`, command tương tác NPC, combat, reward, hoặc
  retry/fallback.
- Không sweep các giá trị tọa độ khác; `0,0` chỉ là baseline an toàn khi chưa
  có native UI state của casino.
- Không sửa `ParkService`, `GameClient`, decoder production, API/WS/UI, database,
  catalog map, hoặc dữ liệu tài khoản.
- Không ghi raw body, hex, credential, host/port, dialog text, hay secret.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

```text
online
  -> native main handshake đã có
  -> TX -1 [9] -> RX -1 [9]
  -> arm world-snapshot waiter
  -> TX 80 [5,7,0,0] (wire length 6)
  -> RX -34 mới -> strict enter-world decode
```

Probe dùng `client.sendRaw` chỉ trong tool để giữ production `ParkService`
không đổi trước khi contract được chốt. `i16` được ghi big-endian bởi
`MyWriter`, đúng `myWriter.writeShort` native. Tọa độ `0,0` không được coi là
giá trị server đã xác minh; nếu server trả rejection hoặc không trả snapshot,
candidate chỉ ghi pending.

## Verification Plan

1. Chạy GitNexus impact cho `runProbe` và mọi symbol bị sửa; dừng nếu risk
   HIGH/CRITICAL.
2. Typecheck và `git diff --check`; static scan bảo đảm chỉ một `cmd 80` body
   sáu byte, không có `-24/-23/-21` trong candidate.
3. Preflight xác nhận local Avatar Web `:8787` đang tắt và không có probe process.
4. Chạy đúng một invocation account 2 / map 5 / area 7.
5. Chỉ gọi là evidence khi có `TX 80 len=6`, `RX -34` mới, decode strict,
   `playerId > 0`, và trailing bytes được chấp nhận; `RX -40`/timeout vẫn là
   pending.
