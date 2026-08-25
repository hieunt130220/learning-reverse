# NPC Map Catalog Probe Design

## Mục tiêu & Bối cảnh

Probe hiện tại đã chứng minh login, `GET_HANDLER 9` và việc gửi trực tiếp
`cmd 80`, nhưng cặp `map 5 / area 7` trả `RX -40` thay vì enter-world
`RX -34`. Đối chiếu APK AvatarHD 3.4.4 cho thấy luồng client chính thức sau
`GET_HANDLER 9` gọi `MapScr.joinCitymap()` và phát `REQUEST_CITY_MAP (-24)`
với body một byte `[0]` trước khi người dùng chọn map/khu. Probe Node chưa có
bước catalog này, vì vậy chưa đủ bằng chứng rằng hai số người dùng cung cấp là
`roomID/boardID` của `cmd 80`.

Decoder native của nhánh RX `-24` đọc một catalog `PositionMap`: sau phần
header/tài nguyên có độ dài, có `count` entry; mỗi entry đọc `id` (i8),
`idImg` (i16), `text` (UTF), rồi `x` và `y` (i8 nhân 16). Đây là bằng chứng
tĩnh cho schema cần quan sát, không phải mapping live cho `map 5 / area 7`.

Mục tiêu thay đổi là cho phép một probe read-only lấy catalog đúng theo luồng
client hiện tại, giải mã các field an toàn và trả kết quả đủ để quyết định
bước xác minh mapping tiếp theo.

## Phạm vi

### In-scope

- Chỉ chỉnh standalone CLI probe
  `avatar-web/server/src/tools/npc-map-probe.ts`.
- Giữ nguyên CLI bắt buộc `--account-id`, `--map`, `--area`; live invocation
  mục tiêu là đúng một lần với account `2`, map `5`, area `7`.
- Sau khi login online và gửi `GET_HANDLER 9`, gửi đúng một request read-only
  `cmd -24` với body `[0]` (một signed byte `i8=0`).
- Bổ sung phase `catalog` vào traffic metadata và yêu cầu strict TX contract:
  một `TX -1 len=1` ở phase `park-context` và một `TX -24 len=1` ở phase
  `catalog`.
- Lắng nghe message `-24` trực tiếp ở session để không thay đổi
  `GameClient`; decode bằng cursor bounded theo schema native:
  `i8`, `i32 length + bytes`, `i32 length + i8 + bytes`, `i8 count`, rồi
  lặp entry `i8 id`, `i16 idImg`, `u16+UTF-8 text`, `i8 x`, `i8 y`.
- Validate mọi length/count/UTF-8 trong giới hạn hữu hạn; chỉ công bố
  `id`, `idImg`, `text`, `x`, `y`, `count`, độ dài/trailing-byte metadata và
  traffic/event metadata. Không công bố prefix bytes hoặc packet body.
- Giữ `requested: { map: 5, area: 7 }` trong JSON để đối chiếu thủ công;
  kết quả không tự động gán cặp này vào catalog.
- Nếu không nhận hoặc không decode được `-24`, trả failure redacted và giữ
  kết luận mapping chưa xác minh.

### Out-of-scope

- Không gửi `cmd 80`, `-23`, `-21`, command tương tác NPC hay bất kỳ candidate
  sweep nào trong probe catalog này.
- Không đoán field `idToMap`, `price`, `typeMoney`, `count` hoặc `handler` của
  `PositionMap` khi native branch không đọc chúng trong response này.
- Không sửa `GameClient`, `ParkService`, `AutoFindNpc`, `AvatarSession`,
  API/WS/UI, decoder enter-world hoặc production catalog.
- Không tạo `npcMapCatalog.ts`, không ghi evidence production và không tuyên
  bố `map 5 / area 7` đã verified chỉ vì catalog có một `id` trùng số.
- Không retry, reconnect, đổi account, đổi payload, hoặc chạy thêm invocation
  nếu thiếu response.
- Không in password, token, host/port, dialog text, raw body, hex, hoặc
  `TrafficEntry.hex`; không tạo test file vì user chưa yêu cầu test.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### Files/modules

- `avatar-web/server/src/tools/npc-map-probe.ts`: sở hữu phase `catalog`, gửi
  `-24` bằng API gửi raw hiện có, bounded decoder, listener lifecycle và JSON
  output redacted.
- `avatar-web/server/src/game/client.ts`: chỉ dùng các API/event hiện có;
  không sửa implementation.
- `avatar-web/server/src/proto/session.ts`: chỉ dùng event `message` hiện có;
  không sửa implementation.

### Data contracts

Mở rộng phase nội bộ:

```ts
type ProbePhase = 'login' | 'park-context' | 'catalog';
```

Catalog output tối thiểu:

```ts
interface CityMapCatalogEntry {
  id: number;
  idImg: number;
  text: string;
  x: number;
  y: number;
}

interface CityMapCatalog {
  count: number;
  entries: CityMapCatalogEntry[];
  trailingBytes: number;
}
```

`text` chỉ là nhãn catalog đã decode; giới hạn độ dài và không kèm packet
source. Prefix tài nguyên được parse/skip để tới `count` nhưng không đưa vào
output.

### Event flow

```text
preflight localhost
  -> attach redacted listeners
  -> login + wait online
  -> phase park-context: GET_HANDLER 9; wait hiện có
  -> phase catalog: TX -24 [0]
  -> RX -24: bounded decode PositionMap catalog
  -> success JSON: catalog + metadata + requested pair
  -> failure/timeout: redacted traffic/events + reason section
  -> remove listeners; abort; logout; close DB
```

Request `-24` được phát đúng một lần sau khi context park đã được yêu cầu.
Probe không phát lệnh join sau catalog; việc chuyển một `PositionMap` thành
`(idCityMap, id)` hoặc `(roomID, boardID)` sẽ là một Spec/Plan và live gate
riêng sau khi đọc được catalog thật.

### Safety limits

- Giới hạn count entry, từng length byte-array và UTF-8 text trước khi cấp
  phát/skip; số âm hoặc vượt giới hạn trả lỗi decode.
- Chỉ chấp nhận entry đầy đủ và trailing-byte count; không xuất partial catalog
  như valid.
- Tháo listener `session.message` trước `logout()` để local cleanup không bị
  ghi nhận là catalog/rejection event.

## Verification Plan

1. Chạy GitNexus impact cho các symbol sẽ sửa (`runProbe`,
   `captureRelevantTraffic`, `assertExpectedTraffic` hoặc helper mới); dừng và
   báo nếu risk HIGH/CRITICAL.
2. Chạy `npm --prefix avatar-web/server run typecheck` và `git diff --check`.
3. Static scan xác nhận probe không serialize `entry.hex`, body, raw packet,
   password, token, host/port hoặc dialog text; chỉ có opcode `-24` mới được
   thêm và không có `80`, `-23`, `-21` trong flow mới.
4. Chạy `gitnexus_detect_changes(scope="all")`; phạm vi code chỉ là probe và
   spec/plan liên quan, không thay đổi production game client.
5. Sau khi Spec và Plan được user duyệt, chạy đúng một live invocation:

   ```text
   node --env-file=.env --import tsx src/tools/npc-map-probe.ts \
     --account-id 2 --map 5 --area 7
   ```

   Preflight phải xác nhận Avatar Web đang dừng. Kết quả chỉ được gọi là
   `catalog observed` khi có `TX -24 len=1`, `RX -24` và decode hoàn chỉnh;
   mapping map/khu vẫn `unverified` cho tới khi có command chọn/vào khu được
   chứng minh riêng.

## Safety & Rollback

- Đây là thay đổi read-only trong CLI chẩn đoán; không ảnh hưởng runner
  production nếu probe không được gọi.
- Nếu response không khớp schema, không đoán offset hoặc fallback heuristic;
  dừng ở `catalog decode pending` và quay lại Spec review.
- Không commit/push hoặc xóa dirty files/untracked hiện có; rollback chỉ cần
  bỏ phần thay đổi riêng của probe/spec/plan sau khi kiểm tra status.

## User Review Gate

Chờ user duyệt Spec này trước khi tạo Plan và chỉnh code production probe.
