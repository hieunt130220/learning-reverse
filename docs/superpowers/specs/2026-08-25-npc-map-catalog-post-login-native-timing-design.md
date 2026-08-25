# NPC Map Catalog Post-Login Native Timing Design

## Mục tiêu & Bối cảnh

Candidate trước đã tái hiện authenticated main handler `-1[8]`, Park handler
`-1[9]`, và `-24[0]`, nhưng chờ `RX -1` Park trước `-24` vẫn chỉ nhận
`RX -57`. Disassembly của `MapScr.joinCitymap` gọi `getHandler(9)` và
`requestCityMap(0)` liên tiếp trong cùng một call stack, không có barrier chờ
ACK. Candidate cuối này giữ nguyên opcode/body và chỉ bỏ barrier timing để khớp
đúng thứ tự native.

## Phạm vi

### In-scope

- Chỉnh standalone `avatar-web/server/src/tools/npc-map-probe.ts`.
- Sau authenticated `-1[8]`/`RX -1`, arm cả hai waiter rồi gửi liên tiếp
  `-1[9]` và `-24[0]`.
- Chờ tối đa 5 giây cho handler response và catalog response; chỉ decode
  `RX -24` bằng decoder bounded hiện hữu.
- Một invocation account 2 / map 5 / area 7, output redacted.

### Out-of-scope

- Không gửi opcode/body mới (`80`, `-23`, `-21`, body khác cho `-24`).
- Không retry/reconnect/sweep, không sửa GameClient/server/database/catalog.
- Không coi `RX -57`, `RX -61`, hoặc timeout là catalog evidence.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

```text
online
  -> TX -1 [8] -> RX -1
  -> arm handler + catalog waiters
  -> TX -1 [9]
  -> TX -24 [0]     // cùng synchronous native sequence
  -> RX -1 + RX -24 / catalog pending
```

Traffic TX tiếp tục gắn phase `main-context`, `park-context`,
`catalog-native`. ACK Park có thể đến sau khi phase đã chuyển sang
`catalog-native`, nên assertion dùng phase cho TX và main ACK, còn kiểm tra
đủ một ACK Park/đủ một `RX -24` theo command tổng thể; không suy diễn phase từ
thời điểm TCP callback.

## Verification Plan

1. Chạy GitNexus upstream impact cho `runProbe` trước khi sửa; dừng nếu HIGH/
   CRITICAL.
2. Typecheck, `git diff --check`, static scan chỉ còn `-1[8]`, `-1[9]`,
   `-24[0]` ngoài login nội bộ.
3. Preflight local server stopped/no probe process.
4. Chạy đúng một invocation account 2 / map 5 / area 7.
5. Chỉ `catalog observed` khi có `RX -24`, decode hoàn chỉnh, zero trailing
   bytes; nếu không ghi pending và không thử lệnh khác.
