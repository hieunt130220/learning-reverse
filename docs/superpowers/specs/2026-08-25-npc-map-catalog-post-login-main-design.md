# NPC Map Catalog Post-Login Main Handler Design

## Mục tiêu & Bối cảnh

Disassembly cho thấy `GlobalLogicHandler.onLoginSuccess` gọi
`GlobalService.getHandler(8)` sau khi đăng nhập. Khi nhận handler 8, nhánh native
có thể gọi `MapScr.joinCitymap()`, và hàm này mới gửi chuỗi
`GET_HANDLER(9)` rồi `REQUEST_CITY_MAP(0)`. Probe hiện tại bỏ qua handler 8 sau
đăng nhập và gửi handler Park hai lần, vì vậy traffic chưa khớp call flow native
dù decoder `-24` đã được xác nhận đúng.

Candidate này kiểm tra đúng một khác biệt có căn cứ tĩnh: hoàn tất authenticated
main-handler trước, sau đó gửi đúng một handler Park và một request city-map.

## Phạm vi

### In-scope

- Chỉnh standalone `avatar-web/server/src/tools/npc-map-probe.ts`.
- Sau `LOGIN_SUCESS`, gửi `TX -1 [8]` và chờ `RX -1`.
- Gửi `TX -1 [9]`, chờ `RX -1`, rồi gửi `TX -24 [0]` và chờ catalog tối đa 5 giây.
- Một invocation account 2 / map 5 / area 7 với output metadata redacted.

### Out-of-scope

- Không gửi handler Park lần thứ hai.
- Không gửi `80`, `-23`, `-21`, không sweep body/map/area, không retry/reconnect.
- Không sửa `GameClient`, decoder, server, database hoặc tạo mapping nếu thiếu
  `RX -24` decode hoàn chỉnh.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

```text
LOGIN_SUCESS / online
  -> TX -1 [8] (authenticated main handler)
  -> RX -1 [8]
  -> TX -1 [9] (native MapScr.joinCitymap handler request)
  -> RX -1 [9]
  -> TX -24 [0] (native requestCityMap)
  -> RX -24 / catalog pending
```

Probe thêm phase `main-context` để metadata phân biệt bước authenticated
handler. Mỗi handler request được arm bằng one-shot waiter trước khi gửi; catalog
waiter được arm trước `-24`. Evidence chỉ được in khi decoder hoàn tất và không
có trailing bytes.

## Verification Plan

1. Chạy GitNexus upstream impact cho `runProbe` trước khi sửa; dừng nếu HIGH hoặc
   CRITICAL.
2. Typecheck, `git diff --check`, và static scan xác nhận chỉ có một `-1[8]`, một
   `-1[9]`, một `-24[0]` trong candidate.
3. Preflight local Avatar Web stopped/no probe process.
4. Chạy đúng một invocation account 2 / map 5 / area 7.
5. Chỉ phân loại `catalog observed` khi có `RX -24`, decode hợp lệ, và zero
   trailing bytes; nếu không thì ghi `catalog pending`, không gửi lệnh khác.
