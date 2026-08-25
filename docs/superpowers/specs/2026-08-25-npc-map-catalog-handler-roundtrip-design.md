# NPC Map Catalog Handler Roundtrip Design

## Mục tiêu & Bối cảnh

Candidate native-sequence trước đã gửi `TX -1 [9]` và `TX -24 [0]` nhưng vẫn
không có `RX -24`. Xref native mới cho thấy flow thật có một vòng roundtrip:
`GlobalLogicHandler.doGetHandler` nhận `RX -1`, sau đó gọi
`MapScr.joinCitymap`; `joinCitymap` lại phát `GET_HANDLER 9` lần hai rồi mới
phát `REQUEST_CITY_MAP(0)`. Probe đã bỏ qua lần `RX -1` và `TX -1` thứ hai.

Mục tiêu candidate này là tái hiện chính xác vòng roundtrip đó, sau đó chỉ
coi `RX -24` giải mã hoàn chỉnh là catalog evidence.

## Phạm vi

### In-scope

- Chỉ chỉnh `avatar-web/server/src/tools/npc-map-probe.ts`.
- Sau login, gửi context `-1 [9]` một lần qua `enterParkContext()`.
- Chờ đúng một `RX -1` handler response trong tối đa 5 giây.
- Gửi đúng một `TX -1 [9]` thứ hai để tái hiện `MapScr.joinCitymap`.
- Gửi đúng một `TX -24 [0]`, chờ tối đa 5 giây và decode catalog hiện hữu.
- Chạy một invocation account 2 / map 5 / area 7, ghi metadata redacted vào
  plan.

### Out-of-scope

- Không gửi `80`, `-23`, `-21`, `-24` với body khác, retry, reconnect hoặc
  candidate sweep.
- Không suy luận map/area từ packet khác `RX -24`.
- Không thay đổi `GameClient`, decoder catalog, production catalog, API/WS/UI,
  database hoặc server runtime.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### Static evidence

- `GlobalLogicHandler.doGetHandler @0x5E4974`, case index `9` tại
  `0x5E4D34`, gọi `ParkMsgHandler.onHandler`.
- Xref của `MapScr.joinCitymap @0x6141B8` có caller
  `GlobalLogicHandler.doGetHandler @0x5E50CC`.
- `MapScr.joinCitymap` tại `0x614A8C` gọi `getHandler(9)` và tại `0x614AC8`
  gọi `requestCityMap(0)`.
- Do đó packet-level sequence cần quan sát là:

  ```text
  TX -1 [9] -> RX -1 -> TX -1 [9] -> TX -24 [0] -> RX -24
  ```

### Flow và phase

```text
login online
  -> phase park-context; arm handler waiter
  -> enterParkContext()       // TX -1 len=1
  -> await RX -1              // server dispatches doGetHandler(9)
  -> phase catalog-native; arm catalog waiter
  -> TX -1 [9]                // MapScr.joinCitymap
  -> TX -24 [0]
  -> decode RX -24 or catalog pending
```

Listener handler phải được tháo trên resolve, reject, timeout, abort. Chỉ một
`RX -1` được dùng làm barrier; các `RX -1` ngoài phase/contract làm failure,
không được tự lặp. Catalog waiter được arm ngay sau barrier và trước hai request
thứ hai, nên có đủ một timeout 5 giây cho `RX -24`.

### Data contract

- Strict TX contract: hai `TX -1 len=1` (một ở `park-context`, một ở
  `catalog-native`) và một `TX -24 len=1` ở `catalog-native`.
- Required response contract: `RX -1` trước request thứ hai và một `RX -24`
  decode đầy đủ, zero trailing bytes.
- `requested.map` / `requested.area` vẫn chỉ là metadata; candidate này không
  khẳng định semantics của chúng.

## Verification Plan

1. Chạy GitNexus impact cho `runProbe`, `assertExpectedTraffic` và helper chờ
   handler trước khi sửa.
2. Typecheck, diff check và static scan cấm opcode ngoài `-1`/`-24`.
3. Preflight `127.0.0.1:8787` refused, không có probe process.
4. Chạy đúng một invocation:

   ```bash
   node --env-file=.env --import tsx src/tools/npc-map-probe.ts \
     --account-id 2 --map 5 --area 7
   ```

5. Chỉ gọi là `catalog observed` nếu có đầy đủ roundtrip, `RX -24`, decode hợp
   lệ và zero trailing bytes; nếu không ghi `catalog pending` và dừng.
