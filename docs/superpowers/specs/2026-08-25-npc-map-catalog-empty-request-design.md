# NPC Map Catalog Empty-Request Probe Design

## Mục tiêu & Bối cảnh

Probe catalog theo Spec trước đã login thành công, nhận `RX -1 len=1` sau
`GET_HANDLER 9` và gửi đúng `TX -24 len=1` với body `[0]`, nhưng server không
trả bất kỳ RX nào trong 5 giây. Vì vậy chưa có catalog/evidence live và không
được kết luận mapping `map 5 / area 7`.

APK AvatarHD 3.4.4 có caller tĩnh thứ hai của
`GlobalService.requestCityMap`: `LoadMap.doJoin @0x8CF5C0` nạp `0xFF` vào
`sbyte idMini` trước khi gọi hàm. `requestCityMap` chỉ `writeByte(idMini)` khi
`idMini >= 0`, nên caller này phát `cmd -24` với **body rỗng** để yêu cầu danh
sách city map đầy đủ. Đây là candidate có bằng chứng native độc lập, không phải
payload đoán từ số map/khu.

Mục tiêu là lặp lại probe read-only với đúng candidate body-rỗng, giữ nguyên
account `2`, requested pair `map 5 / area 7`, và chỉ tiếp tục nếu nhận được
response `-24` decode hoàn chỉnh.

## Phạm vi

### In-scope

- Chỉ chỉnh standalone CLI probe
  `avatar-web/server/src/tools/npc-map-probe.ts` để phát `cmd -24` không body
  đúng một lần trong phase `catalog-empty`.
- Giữ nguyên login, `GET_HANDLER 9`, preflight, redacted metadata, bounded
  decoder `PositionMap` và cleanup hiện có.
- Traffic contract mới: một `TX -1 len=1` ở `park-context`, một `TX -24
  len=0` ở `catalog-empty`, và response `RX -24` được decode bằng parser hiện
  có.
- Một live invocation duy nhất với account `2`, map `5`, area `7` sau khi
  Spec/Plan được duyệt.

### Out-of-scope

- Không gửi lại `-24 [0]` trong cùng invocation, không retry, reconnect hoặc
  đổi account.
- Không gửi `cmd 80`, `-23`, `-21`, command NPC, candidate sweep hoặc payload
  khác.
- Không sửa `GameClient`, `ParkService`, `AutoFindNpc`, API/WS/UI, decoder
  enter-world hoặc production catalog.
- Không tạo evidence/catalog production khi `RX -24` hoặc trailing-byte check
  chưa đạt; không suy luận mapping chỉ từ `id` trùng số.
- Không ghi body, raw bytes, hex, credential, host/port hoặc dialog text.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### Files/modules

- `avatar-web/server/src/tools/npc-map-probe.ts`: đổi phase/catalog request
  contract từ body `[0]` sang body rỗng; giữ decoder và output redacted.
- Không chỉnh module production khác.

### Request contract

```text
phase = catalog-empty
cmd = -24 (REQUEST_CITY_MAP)
body = []
traffic = TX -24 len=0
```

Trong code dùng API gửi hiện có với danh sách field rỗng:

```ts
client.sendRaw(-24, []);
```

Không dùng `sendRaw(-24, [{ t: 'i8', v: '-1' }])`: native `requestCityMap(-1)`
không ghi byte, nên wire body phải là length zero.

### Response/evidence contract

Giữ `decodeCityMapCatalog(Buffer)` bounded theo Spec trước: skip hai resource
block có length, đọc `count`, rồi `id`, `idImg`, UTF-8 `text`, `x`, `y` mỗi
`PositionMap`. Chỉ gọi kết quả `catalog observed` nếu `RX -24` tới, parse đủ,
`trailingBytes === 0` và traffic phase đúng. Nếu timeout, giữ `catalog pending`.

## Verification Plan

1. Chạy GitNexus impact trước khi sửa `assertExpectedTraffic`/`runProbe`; risk
   HIGH/CRITICAL phải dừng.
2. Chạy server typecheck và `git diff --check`.
3. Static scan xác nhận chỉ đổi request mới thành `-24` len 0, không thêm join,
   selection, retry hoặc output body.
4. Chạy `gitnexus_detect_changes(scope="all")`, giữ dirty files/untracked.
5. Preflight xác nhận localhost `:8787` refused và không có probe process.
6. Chạy đúng một invocation:

   ```bash
   node --env-file=.env --import tsx src/tools/npc-map-probe.ts \
     --account-id 2 --map 5 --area 7
   ```

   từ `avatar-web/server`; không retry nếu không có response.

## Safety & Rollback

- Đây là candidate read-only được chứng minh từ caller native; không thay đổi
  production protocol.
- Nếu body-rỗng không có response, ghi nhận cả hai candidate `-24 [0]` và
  `-24 []` đều chưa có live catalog; quay lại điều tra handler/phiên bản, không
  thử thêm payload trong cùng gate.
- Không commit/push hoặc xóa thay đổi không liên quan.

## User Review Gate

Chờ user duyệt Spec này trước khi tạo Plan và sửa probe sang body-rỗng.
