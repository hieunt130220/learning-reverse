# NPC Map Catalog Handler Ack Barrier Design

## Mục tiêu & Bối cảnh

Native roundtrip đã được tái hiện và chứng minh bằng traffic:
`TX -1 [9]` → `RX -1` → `TX -1 [9]` → `TX -24 [0]`. Server trả `RX -1` lần
hai sau request thứ hai nhưng không trả `RX -24`. Candidate này kiểm tra duy
nhất khả năng xử lý bất đồng bộ của server: chờ `RX -1` lần hai trước khi gửi
`-24`, dù native gửi hai packet cuối liên tiếp.

Đây là candidate timing cuối, không thay đổi opcode/body và không phải mapping
map/area. Nếu vẫn không có `RX -24`, dừng live probing và yêu cầu UI-matched
capture hoặc thay đổi server state/version để tiếp tục.

## Phạm vi

### In-scope

- Chỉnh standalone `avatar-web/server/src/tools/npc-map-probe.ts`.
- Giữ `TX -1 [9]` lần đầu, chờ `RX -1`, gửi `TX -1 [9]` lần hai, chờ đúng
  `RX -1` lần hai, rồi gửi `TX -24 [0]`.
- Chờ tối đa 5 giây cho catalog và ghi metadata redacted.
- Một invocation account 2 / map 5 / area 7.

### Out-of-scope

- Không đổi body, không gửi `80`, `-23`, `-21`, không retry/reconnect/sweep.
- Không sửa decoder, GameClient, server, database hoặc production catalog.
- Không gọi `RX -57` hay packet state khác là catalog.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### Flow

```text
TX -1 [9]
  -> RX -1 (barrier 1)
  -> TX -1 [9]
  -> RX -1 (barrier 2)
  -> TX -24 [0]
  -> RX -24 / pending
```

Tái sử dụng waiter handler one-shot hiện có bằng hai lần gọi tuần tự, mỗi lần
được arm trước request tương ứng. Catalog waiter được arm sau barrier thứ hai
và trước `-24`. Không gửi request nếu barrier trước đó timeout.

### Data contract

- Strict TX: hai `-1 len1`, một `-24 len1`.
- Strict RX prerequisite: hai `-1 len1`, theo thứ tự trước `-24`.
- `catalog observed` chỉ khi `RX -24` decode hoàn chỉnh và zero trailing bytes.

## Verification Plan

1. GitNexus impact cho `runProbe`, `assertExpectedTraffic`,
   `waitForHandlerResponse`.
2. Typecheck, diff check, static scan chỉ có `-1`/`-24` request.
3. Preflight local Avatar Web stopped/no probe process.
4. Chạy đúng một invocation account 2 / map 5 / area 7.
5. Nếu không có `RX -24`, ghi `catalog pending` và dừng; không tạo mapping.
