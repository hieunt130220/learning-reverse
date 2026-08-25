# NPC Map Join Position Correction Design

## Mục tiêu & Bối cảnh

Probe `cmd 80` sáu byte cho account 2 / map 5 / area 7 đã chứng minh request
và response direct-join khi dùng `x/y=0,0`, nhưng đó chỉ là baseline. Native
`LoadMap.doJoin` lấy `PositionMap.x/y` từ CityMap rồi ghi vào
`LoadMap.xJoinCasino/yJoinCasino` trước khi `ParkService.doJoinPark` gửi hai
`writeShort` cuối body. Asset CityMap v3.4.4 ghi entry map 5 `Công viên` tại
`(254,82)`. Candidate này kiểm tra đúng tọa độ native cho cùng cặp, không mở
catalog production.

## Phạm vi (Scope)

### In-scope

- Chỉ chỉnh standalone `avatar-web/server/src/tools/npc-map-probe.ts` và
  spec/plan của candidate.
- Giữ account `2`, map `5`, area `7`, một invocation bounded.
- Gửi đúng một `cmd 80` body `[i8 5, i8 7, i16 254, i16 82]` sau Park handler
  ACK; chờ một `RX 80` và decode prefix native hiện có.
- Ghi metadata redacted: request coordinate, response room/board/x/y, player
  count, map/animation/special counts, section end và trailing length.

### Out-of-scope

- Không gửi `-24`, `-23`, `-21`, NPC interaction/combat/reward hay sweep tọa độ.
- Không đổi `ParkService`, `GameClient`, decoder production, API/WS/UI, DB hoặc
  tạo `npcMapCatalog.ts`.
- Không in raw body/hex, tên player/NPC, credential, host/port hoặc dialog text.
- Không coi static CityMap asset hoặc một `RX 80` là global catalog nếu chưa có
  evidence live theo gate của Auto Tìm NPC V1.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

```text
online -> ACK Park -> TX 80[5,7,254,82] -> RX 80
       -> bounded native prefix decode -> redacted direct-join evidence
```

Probe dùng `sendRaw(80)` để giữ production service không đổi. Tọa độ lấy từ
entry static `PositionMap` map 5 đã ghi trong plan catalog; đây là wire-shape
correction được đối chiếu với disassembly, không phải suy đoán từ response.

## Verification Plan

1. Chạy GitNexus impact cho `runProbe`; dừng nếu HIGH/CRITICAL.
2. Typecheck, `git diff --check`, và static scan bảo đảm chỉ một `cmd 80` sáu
   byte, không có catalog/selection command.
3. Preflight Avatar Web stopped, chạy đúng một invocation account 2 / map 5 /
   area 7. Thành công chỉ có nghĩa direct join response khớp request; catalog
   và NPC evidence vẫn pending nếu `specialCount=0` hoặc trailing chưa decode.
4. Chạy GitNexus `detect_changes(scope="all")` sau source/docs update.

## User Review Gate

Candidate này được thực thi theo ủy quyền tiếp tục probe account 2 / map 5 /
area 7 trong task hiện tại; không commit và không mở production catalog.
