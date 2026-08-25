# NPC Map Catalog Native Sequence Design

## Mục tiêu & Bối cảnh

Hai lần probe account 2 / map 5 / area 7 đã gửi `-24` nhưng không nhận được
`RX -24`: một lần với body `[0]` sau khoảng chờ và một lần với body rỗng.
Disassembly của APK cho thấy `MapScr.joinCitymap` gọi `GET_HANDLER 9` rồi
`GlobalService.requestCityMap(0)` liên tiếp, nên probe hiện tại chưa tái hiện
đúng thứ tự native.

Mục tiêu của candidate này là tái hiện đúng chuỗi native tối thiểu và chỉ xác
định catalog khi có `RX -24` giải mã đầy đủ. Một `RX -61` không được coi là
catalog.

## Phạm vi

### In-scope

- Chỉnh một flow trong `avatar-web/server/src/tools/npc-map-probe.ts` để:
  - bắt listener catalog trước khi bắt đầu context;
  - gửi `-1` từ `enterParkContext()`;
  - ngay sau đó gửi đúng một `-24` với body `[0]`;
  - chờ tối đa 5 giây cho `RX -24` và kiểm tra trailing bytes.
- Chạy đúng một invocation với account 2, map 5, area 7.
- Ghi traffic/event metadata đã redaction vào plan; không ghi body, hex, mật
  khẩu, token hoặc host/port.

### Out-of-scope

- Không gửi `80`, `-23`, `-21`, retry, sweep map/area, hoặc request bổ sung.
- Không suy luận catalog từ `RX -61` hay từ tên opcode trong source.
- Không tạo production mapping/NPC catalog nếu thiếu `RX -24` và decode hợp lệ.
- Không thay đổi decoder, database, login contract, hoặc server runtime.

### Input / Output / Edge cases

- Input CLI giữ nguyên: `--account-id 2 --map 5 --area 7`.
- Output thành công chỉ có `decode: "ok"`, catalog entries, và metadata redacted.
- Nếu không có `RX -24`, timeout trả `catalog pending` ở plan thông qua JSON lỗi.
- Nếu có `RX -24` nhưng decode lỗi hoặc còn trailing bytes, không tạo mapping.
- `-1` và `-24` phải được ghi ở các phase tương ứng; listener phải được cài
  trước khi gửi context để không bỏ lỡ phản hồi nhanh.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### Files và vai trò

- `avatar-web/server/src/tools/npc-map-probe.ts`: runner hiện hữu; chỉ sửa
  phase và thứ tự phát request.
- `docs/superpowers/specs/2026-08-25-npc-map-catalog-native-sequence-design.md`:
  tài liệu candidate này.
- `docs/superpowers/plans/2026-08-25-npc-map-catalog-native-sequence.md`:
  checklist triển khai và bằng chứng live.

### Flow

```text
login online
  -> arm waitForCityMapCatalog()
  -> enterParkContext()       // TX -1 len=1
  -> sendRaw(-24, [0])        // TX -24 len=1, không delay
  -> RX -24                   // decode catalog hoặc pending
  -> assert traffic + print redacted evidence
```

`enterParkContext()` vẫn được ghi phase `park-context`; phase chuyển sang
`catalog-native` ngay sau khi lời gọi synchronous này hoàn tất và trước khi
gửi `-24`. Vì vậy `TX -1` không bị gắn nhầm phase, trong khi listener đã sẵn
sàng cho phản hồi mạng.

### Data contract

- Expected request contract: exactly one `TX -1 len=1` followed by exactly one
  `TX -24 len=1`.
- Expected response contract: exactly one decodable `RX -24` with zero trailing
  bytes.
- `requested.map` và `requested.area` chỉ là metadata định danh phiên probe;
  candidate này không khẳng định chúng là field của request city-map.

## Verification Plan

1. Chạy GitNexus impact cho `runProbe` và `assertExpectedTraffic` trước khi sửa.
2. Chạy `npm --prefix avatar-web/server run typecheck` và `git diff --check`.
3. Static scan xác nhận chỉ có `sendRaw(-24, [0])` trong candidate và không có
   `80`, `-23`, `-21`, body/hex/token/password trong output.
4. Preflight xác nhận `127.0.0.1:8787` refused và không có probe process.
5. Chạy đúng một lần:

   ```bash
   node --env-file=.env --import tsx src/tools/npc-map-probe.ts \
     --account-id 2 --map 5 --area 7
   ```

6. Chỉ gọi là `catalog observed` khi request/response contract và decoder đều
   đạt; nếu không, ghi `catalog pending` và dừng candidate.
