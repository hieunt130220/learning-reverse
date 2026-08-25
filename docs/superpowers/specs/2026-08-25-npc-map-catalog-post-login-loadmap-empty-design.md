# NPC Map Catalog Post-Login LoadMap Empty Design

## Mục tiêu & Bối cảnh

Các candidate `-24[0]` sau authenticated main handler và native timing vẫn
không có `RX -24`. Reverse static có caller khác: `LoadMap.doJoin` nạp
`0xFF` (`sbyte -1`) vào `GlobalService.requestCityMap`; hàm chỉ ghi body khi
`idMini >= 0`, nên wire request của caller này là `cmd -24` với body rỗng.

Candidate này ghép đúng precondition authenticated `-1[8]`, Park handler
native `-1[9]`, rồi thử duy nhất wire shape `-24 len=0` từ caller `LoadMap`.

## Phạm vi

### In-scope

- Chỉnh standalone `avatar-web/server/src/tools/npc-map-probe.ts` từ
  `-24[0]` thành `-24[]`.
- Giữ main handler, native back-to-back timing, bounded `PositionMap` decoder,
  redacted traffic/events và cleanup.
- Một invocation account 2 / map 5 / area 7.

### Out-of-scope

- Không gửi lại `-24[0]`, không gửi `80`, `-23`, `-21`, body khác, retry,
  reconnect hoặc sweep.
- Không sửa `GameClient`, server, database, production catalog/evidence.
- Không coi `RX -57`/`RX -61` là catalog.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

```text
online
  -> TX -1 [8] -> RX -1
  -> TX -1 [9]
  -> TX -24 []       // LoadMap.doJoin -> requestCityMap(-1)
  -> RX -1 / RX -24 / catalog pending
```

Traffic vẫn yêu cầu đúng các TX phase; catalog request phải có `len=0`. Chỉ
`RX -24` parse hoàn chỉnh, zero trailing bytes mới là evidence.

## Verification Plan

1. GitNexus impact cho `runProbe` và `assertExpectedTraffic`, dừng nếu HIGH/
   CRITICAL.
2. Typecheck, `git diff --check`, static scan chỉ có một `sendRaw(-24, [])`.
3. Preflight local `:8787` refused/no probe process.
4. Chạy đúng một invocation account 2 / map 5 / area 7.
5. Nếu timeout, ghi `catalog pending` và dừng live probing ở các body đã được
   static chứng minh.
