# NPC Map Direct Join Post-Login Design

## Mục tiêu & Bối cảnh

City-map catalog request `-24` đã được thử theo cả hai wire shape native đã
reverse (`[0]` và body rỗng), nhưng server không trả `RX -24`. APK xác minh
độc lập `ParkService.doJoinPark` (`cmd 80`) ghi `roomID` rồi `boardID` bằng
`i8`; đây chính là contract map/area người dùng cung cấp. Probe hiện đã có
authenticated main-handler flow, nên candidate này chuyển sang evidence trực
tiếp: join `roomID=5`, `boardID=7` và đọc snapshot enter-world `-34` mới.

## Phạm vi

### In-scope

- Chỉnh standalone `avatar-web/server/src/tools/npc-map-probe.ts`.
- Sau login gửi authenticated main `-1[8]`, Park context `-1[9]`, rồi một
  `cmd 80` với `map=5`, `area=7`.
- Arm wait trước join, decode snapshot `-34` bằng decoder `GameClient` hiện có,
  output metadata redacted và tên `ItemMapSpecial`.
- Một invocation duy nhất account 2 / map 5 / area 7.

### Out-of-scope

- Không gửi `-24`, `-23`, `-21`, NPC interaction, combat, reward, retry hoặc
  candidate khác.
- Không tạo catalog production/evidence document nếu thiếu snapshot `-34` mới,
  `playerId > 0`, decode hết section special và trailing ổn định.
- Không ghi body, hex, credential, host/port hoặc dialog text.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

```text
online
  -> TX -1 [8] -> RX -1
  -> TX -1 [9] -> RX -1
  -> arm world-snapshot waiter
  -> TX 80 [5,7]
  -> RX -34 mới -> strict ItemMapSpecial decode
```

Listener snapshot được arm sau context và ngay trước `cmd 80`, nên không dùng
`LOGIN_SUCESS` ban đầu làm bằng chứng join. Traffic bắt buộc có đúng một TX
`80 len=2` và một snapshot `-34` mới; snapshot có thể có `specialCount=0` nhưng
vẫn chứng minh response của cặp map/area nếu các invariant khác đạt.

## Verification Plan

1. GitNexus impact cho `runProbe`/`assertExpectedTraffic`, dừng ở HIGH/
   CRITICAL.
2. Typecheck, diff check và static scan chỉ có một `cmd 80`, không có `-24`/
   `-23`/`-21`.
3. Preflight local `:8787` refused/no probe process.
4. Chạy đúng một invocation account 2/map 5/area 7.
5. Chỉ ghi evidence nếu snapshot mới decode đủ, `playerId > 0`, và trailing
   bytes bằng 0 (hoặc được review ổn định); nếu timeout thì giữ pending.
