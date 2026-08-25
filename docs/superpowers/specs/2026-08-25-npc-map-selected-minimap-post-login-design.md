# NPC Map Selected Mini-Map Post-Login Design

## Mục tiêu & Bối cảnh

Direct `cmd 80[5,7]` sau authenticated context trả dialog `-40`, không có
enter-world `-34`; vì vậy cặp số chưa được chứng minh là `roomID/boardID`.
Native đã xác minh `GlobalService.doSelectedMiniMap` (`cmd -23`) ghi hai
`i8`: `idCityMap` và `id`. Tài liệu reverse giữ hai semantics này là khả năng
thứ hai của “map 5 / area 7”. Candidate này thử đúng `-23[5,7]` sau main/Park
context và chỉ coi snapshot `-34` mới là evidence.

## Phạm vi

### In-scope

- Chỉnh standalone probe để gửi một `cmd -23` với `i8 map`, `i8 area`.
- Giữ authenticated `-1[8]`, Park `-1[9]`, wait snapshot và decoder
  `ItemMapSpecial` hiện có.
- Một invocation account 2 / map 5 / area 7, metadata redacted.

### Out-of-scope

- Không gửi `80`, `-24`, `-21`, body khác, retry/reconnect/candidate sweep.
- Không gọi NPC interaction/reward; không tạo catalog production nếu thiếu
  `RX -34` strict evidence.
- Không in body/hex/credentials/host/port/dialog text.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

```text
online
  -> TX -1 [8] -> RX -1
  -> TX -1 [9] -> RX -1
  -> arm world-snapshot waiter
  -> TX -23 [5,7]
  -> RX -34 mới / pending
```

The snapshot waiter is armed after context and before `-23`, so login
`-34` cannot be reused. Evidence requires exactly one `TX -23 len=2`, a new
`RX -34`, `playerId > 0`, and strict decode through `ItemMapSpecial`.

## Verification Plan

1. GitNexus impact `runProbe`/`assertExpectedTraffic`, stop on HIGH/CRITICAL.
2. Typecheck/diff check/static scan only one `-23`, no `80`/`-24`/`-21`.
3. Preflight local `:8787` refused/no probe process.
4. Run exactly account 2 / map 5 / area 7 once.
5. If no `RX -34`, record pending; do not infer mapping from dialog/state.
