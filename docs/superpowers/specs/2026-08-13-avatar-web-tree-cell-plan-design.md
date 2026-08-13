# Thiết kế: kế hoạch cây theo từng ô cho Avatar Web

Ngày: 2026-08-13

Phạm vi: `avatar-web`, một tài khoản mỗi editor, kế hoạch cây theo từng ô trong drawer vận hành

## 1. Bối cảnh và nguồn bằng chứng

Trang tham chiếu `https://3x.4utovip.com/` được khảo sát ở chế độ chỉ đọc từ
HTML và JavaScript công khai ngày 2026-08-13. Phần client công khai cho thấy
một editor kế hoạch nông trại, các chế độ farm/câu cá/NPC, start/stop và các
payload cấu hình. Worker kết nối game, thuật toán farm và packet giao thức đều
nằm phía server, không có trong tài nguyên công khai.

Thiết kế này vì vậy **không sao chép mã, CSS, hình ảnh, API hay nhận diện của
3x**. Nó chỉ tái triển khai độc lập capability “kế hoạch cây theo ô” trên các
primitive đã có và đã kiểm chứng trong repo:

- `GameClient` đã đọc được trạng thái farm, kho và catalog cây;
- `FarmService.plantSeed` đã gửi được lệnh trồng theo `cellIndex` và `seedId`;
- `AutoFarm` đã lấy ảnh chụp farm mới ở đầu mỗi vòng và chỉ trồng ô thật sự
  trống;
- `AvatarSession`, REST và WebSocket đã có lifecycle theo từng tài khoản;
- drawer vận hành và panel Tự động đã có trong frontend.

GitNexus preflight cho `AutoFarmConfig`, `AutoFarm`, `setAutoEnabled` và
`AutoFarmPanel` trả risk **LOW**, không phát hiện caller/process. Tuy nhiên MCP
vẫn báo graph chậm 13 commit so với HEAD, nên kết quả 0 caller không được dùng
làm bằng chứng duy nhất. Đối chiếu source cho thấy blast radius thực tế gồm:

```text
AutoFarmPanel
  -> REST auto/config + auto/start|stop
  -> accounts repository / SQLite
  -> SessionManager / AvatarSession
  -> AutoFarm.runCycle
  -> FarmService.plantSeed
  -> snapshot + WebSocket + drawer
```

Trước khi sửa bất kỳ symbol nào, implementation phải chạy lại GitNexus
`impact(..., direction: "upstream")` cho đúng symbol và báo blast radius. Nếu
GitNexus vẫn stale, phải ghi rõ giới hạn và đối chiếu direct source/tests.

## 2. Mục tiêu

1. Cho phép đặt hạt riêng cho từng ô farm của một tài khoản.
2. Editor nằm trong panel Tự động của drawer vận hành, không thêm route mới.
3. Cho phép nhấp và kéo để tô nhiều ô, đồng thời vẫn thao tác được bằng bàn
   phím.
4. Giữ ba trạng thái rõ ràng cho mỗi ô:
   - dùng hạt cụ thể;
   - dùng `seedId` mặc định;
   - cố ý không trồng.
5. Lưu kế hoạch bền vững ngay cả khi auto bị tắt hoặc server khởi động lại.
6. Khi lưu trong lúc auto đang chạy, áp dụng nguyên khối từ đầu vòng kế tiếp;
   không trộn hai cấu hình trong một vòng và không ngắt phiên.
7. Cho phép xem/chỉnh offline bằng số ô và catalog hạt đã đồng bộ gần nhất.
8. Không hard-code 48 ô; lưới dùng đúng các `cellIndex` từng quan sát từ server.
9. Giữ tương thích với cấu hình cũ chỉ có một `seedId` chung.

## 3. Không thuộc phạm vi

- Kế hoạch vật nuôi theo slot.
- Kế hoạch ao cá hoặc logic câu cá.
- Kế hoạch bếp/nấu ăn; tầng hiện tại mới có sender, chưa có state decoder đủ
  để tự động an toàn.
- Sạp mua/bán, tự mua hạt hoặc bất kỳ giao dịch không dễ hoàn tác nào.
- Chăm farm hàng loạt nhiều tài khoản.
- Thay packet, opcode, parser hoặc logic đăng nhập game.
- Thay cây đang mọc; kế hoạch chỉ được xét khi ảnh chụp đầu vòng xác nhận ô
  đang trống.
- Sao chép tài nguyên hoặc gọi API nội bộ của trang 3x.

## 4. Quyết định kiến trúc

### 4.1. Tách ý muốn khỏi dữ liệu quan sát

Có hai loại dữ liệu khác bản chất và phải được lưu riêng:

1. **Cấu hình auto** là ý muốn của người dùng. `treeCellPlan` nằm trong
   `auto_config_json` và được giữ lại khi auto tắt.
2. **Farm profile cache** là dữ liệu server game từng trả về: farm id, danh sách
   index ô thật và catalog hạt. Cache có mốc quan sát và không được coi là lệnh
   điều khiển.

Không lưu kế hoạch trong `localStorage`: server cần dùng nó khi chạy nền sau
restart và nhiều trình duyệt phải thấy cùng một nguồn sự thật.

### 4.2. Không gắn lưu cấu hình với Bật/Tắt

Hiện tại `POST auto/start` vừa lưu config vừa bật engine, còn `POST auto/stop`
ghi `auto_config_json = NULL`. Hành vi này phải được tách:

- lưu kế hoạch/config là một thao tác riêng;
- bật auto dùng cấu hình đã lưu;
- tắt auto chỉ đổi cờ `auto_enabled`, không xóa config.

Frontend cũ gửi config trong body `auto/start` vẫn được hỗ trợ trong giai đoạn
chuyển tiếp: server chuẩn hóa, merge với config đang lưu và không được làm mất
`treeCellPlan` chỉ vì client cũ không biết field đó.

Body legacy không rỗng là một config mutation đầy đủ: server đọc state hiện
tại, merge patch, ghi envelope với `revision + 1` và bật `auto_enabled` trong
cùng transaction trước khi gọi runtime. Vì vậy một editor vẫn giữ revision cũ
sẽ nhận 409 ở lần PUT kế tiếp, không thể ghi đè im lặng config vừa đổi qua
`auto/start`. Body rỗng chỉ bật lại config hiện có và không tăng revision.

### 4.3. Cập nhật tại ranh giới vòng

`AutoFarm` giữ hai cấu hình:

- cấu hình active bất biến trong vòng đang chạy;
- cấu hình pending đã validate để nhận ở đầu vòng tiếp theo.

Lưu config không gọi lại `start()` và không reset cycle/timer. Ở dòng đầu của
`runCycle`, engine hoán đổi nguyên khối pending thành active, sau đó dùng một
snapshot config duy nhất cho toàn bộ vòng. Nếu auto đang tắt, config mới được
dùng ngay lần bật tiếp theo.

## 5. Mô hình dữ liệu

### 5.1. Kế hoạch cây

`AutoFarmConfig` có thêm:

```ts
type TreeCellPlanEntry =
  | { cellIndex: number; action: 'seed'; seedId: number }
  | { cellIndex: number; action: 'skip' };

interface AutoFarmConfig {
  seedId?: number;
  treeCellPlan?: TreeCellPlanEntry[];
  // các field hiện có giữ nguyên
}
```

JSON chỉ lưu override và được chuẩn hóa theo `cellIndex` tăng dần:

- không có entry: dùng `seedId` mặc định;
- `action: "seed"`: dùng `seedId` của entry;
- `action: "skip"`: không trồng ô đó;
- nếu không có entry và `seedId` mặc định cũng trống: giữ hành vi cũ là không
  trồng.

Mỗi index chỉ có tối đa một entry. Server không tin thứ tự hoặc uniqueness từ
client; nó validate, dedupe theo quy tắc “trùng index là lỗi” và serialize lại
dạng chuẩn hóa.

### 5.2. Envelope và revision của cấu hình

Không cần thêm cột revision vào bảng hiện tại. `auto_config_json` chuyển sang
envelope có version:

```ts
interface StoredAutoConfigEnvelope {
  version: 1;
  revision: number;
  config: Partial<AutoFarmConfig>;
}
```

Một JSON cũ không có envelope được đọc như `revision = 0` và `config = raw`.
Lần lưu kế tiếp ghi envelope version 1. Cách này tránh migration cột SQLite và
vẫn cho bootstrap đọc cấu hình cũ.

Nếu account chưa từng có `auto_config_json`, trạng thái chuẩn hóa cũng là
`{ revision: 0, config: {} }`; GET cấu hình không trả `null` cho account hợp
lệ. Nhờ vậy frontend luôn hydrate bằng một contract duy nhất.

Client gửi `expectedRevision` khi lưu. Nếu revision đã đổi, server trả `409`
kèm config/revision hiện tại; server không last-write-wins im lặng.

### 5.3. Farm profile cache

Thêm bảng idempotent:

```sql
CREATE TABLE IF NOT EXISTS avatar_farm_profile_cache (
  account_id        INTEGER PRIMARY KEY
                    REFERENCES avatar_accounts(id) ON DELETE CASCADE,
  farm_id           INTEGER,
  cell_indices_json TEXT NOT NULL DEFAULT '[]',
  seed_catalog_json TEXT NOT NULL DEFAULT '[]',
  cells_observed_at INTEGER,
  seeds_observed_at INTEGER,
  updated_at        INTEGER NOT NULL
);
```

Catalog cache chỉ chứa dữ liệu hiển thị và validate tối thiểu:

```ts
interface CachedSeed {
  id: number;
  name: string;
  growMinutes: number;
  value: number;
}
```

Không lưu mật khẩu, token, traffic, packet hoặc inventory vào bảng này.
`cell_indices_json` là danh sách số nguyên không âm, unique và tăng dần.

Cache được cập nhật từng phần:

- event `farm` cập nhật `farmId`, danh sách cell index và `cellsObservedAt`;
- event `trees` cập nhật catalog và `seedsObservedAt`;
- cập nhật một phần không được xóa phần còn lại đang hợp lệ.

Khi `gameUser` của account đổi, cache bị xóa trong cùng transaction cập nhật
account để không dùng nhầm farm/catalog của nhân vật cũ. Kế hoạch vẫn được giữ,
nhưng editor khóa lưu cho đến khi profile của nhân vật mới được đồng bộ; người
dùng có thể rà rồi ghi đè kế hoạch sau đó.

## 6. Hợp đồng API

Tất cả route đi qua auth và `requireOwnedAccount` hiện có.

### 6.1. Đọc/lưu cấu hình

```text
GET /api/accounts/:id/auto/config
200 { revision, config }

PUT /api/accounts/:id/auto/config
body { expectedRevision, config }
200 { revision, config, application }
409 { error, code: "revision-conflict", current: { revision, config } }
```

`application` là:

- `"next-cycle"` nếu auto đang chạy;
- `"next-start"` nếu auto đang tắt hoặc chưa có session.

PUT validate toàn bộ payload trước khi ghi DB. Sau khi DB commit, nó queue
config đã chuẩn hóa cho session hiện tại nếu có. Validation và queue dùng cùng
một hàm chuẩn hóa để không có trạng thái “DB nhận nhưng runtime từ chối”.

### 6.2. Đọc/đồng bộ farm profile

```text
GET  /api/accounts/:id/farm/profile
200 { farmId, cellIndices, seedCatalog, cellsObservedAt, seedsObservedAt }

POST /api/accounts/:id/farm/profile/refresh
200 { farmId, cellIndices, seedCatalog, cellsObservedAt, seedsObservedAt }
```

Refresh chỉ gọi các primitive hiện có theo thứ tự an toàn: vào farm, chờ farm
state, rồi xin catalog cây. Kết quả thật đi qua event và được server ghi cache;
route chờ hai bước hoàn tất trong thời hạn hữu hạn rồi trả profile vừa lưu,
không tạo polling hoặc job state mới. Refresh yêu cầu session online; nếu chưa
online trả `409`, nếu quá hạn trả `504`; cả hai trường hợp đều giữ cache cũ.

Client không có API ghi farm profile trực tiếp.

### 6.3. Bật/tắt tương thích

```text
POST /api/accounts/:id/auto/start
POST /api/accounts/:id/auto/stop
```

- Body rỗng của `start` dùng config đã lưu.
- Body config kiểu cũ được merge và lưu như một update tương thích, không xóa
  field mới mà body không gửi.
- `stop` chỉ đặt `auto_enabled = 0`; config và revision giữ nguyên.

## 7. Luồng runtime

Ở đầu mỗi vòng:

1. Nhận config pending, nếu có.
2. Chụp config active cho vòng hiện tại.
3. Xin farm state và inventory mới như hiện tại.
4. Với mỗi ô, chỉ xét kế hoạch nếu `idTree === -1`.
5. Chọn hành động:
   - entry `skip` -> ghi log “giữ trống”, không gửi lệnh;
   - entry `seed` -> chọn seed của entry;
   - không có entry -> chọn `seedId` mặc định;
   - không có seed -> không trồng.
6. Seed id không còn trong catalog/profile active bị bỏ qua và ghi log cảnh
   báo; không fallback âm thầm sang loại khác.
7. Nếu inventory mới cho thấy không còn hạt đã chọn, bỏ qua ô và ghi log “thiếu
   hạt”; không tự mua. Bộ đếm inventory cục bộ giảm sau mỗi lệnh trồng để một
   vòng không giả định cùng một hạt còn vô hạn.
8. Lệnh hợp lệ dùng `FarmService.plantSeed` hiện có và giữ nguyên nhịp nghỉ,
   thứ tự cùng lifecycle của vòng.

Kế hoạch không tác động ô đang có cây, kể cả loại cây khác với plan. Không nhổ,
không thay và không bán gì.

Nếu profile mới có index/catalog khác cache cũ:

- runtime chỉ dùng index thật trong ảnh chụp hiện tại;
- entry cho index không tồn tại bị bỏ qua và log;
- seed id không có trong catalog hiện tại bị bỏ qua và log;
- server không tự xóa entry khỏi kế hoạch; editor hiển thị vấn đề để người dùng
  chủ động sửa và lưu revision mới.

## 8. UI trong drawer phương án A

Khối **Kế hoạch cây theo ô** nằm trong `AutoFarmPanel`, mặc định thu gọn để
không làm panel hiện tại quá dài.

### 8.1. Tải dữ liệu

Khi drawer mở, frontend tải song song:

- config/revision đã lưu;
- farm profile cache;
- runtime state hiện có tiếp tục đến qua provider/WebSocket.

Form auto hiện tại phải hydrate từ config đã lưu thay vì luôn khởi tạo bằng các
default cứng. Đây là điều kiện để mở lại drawer không vô tình ghi đè kế hoạch
hoặc các field auto khác.

### 8.2. Palette và lưới

Palette theo thứ tự:

1. **Mặc định** — không tạo entry;
2. **Không trồng** — tạo `skip`;
3. các hạt từ catalog cache, sắp theo tên rồi id.

Lưới dùng chính `cellIndices` cache, không tạo 48 ô giả. Desktop dùng 8 cột;
mobile giảm số cột để nút vẫn đọc và bấm được. Mỗi ô hiển thị index và trạng
thái kế hoạch, không giả vờ phản ánh cây đang mọc.

Người dùng chọn một mục trong palette rồi:

- click một ô để gán;
- giữ chuột/chạm và kéo qua nhiều ô để tô;
- dùng bàn phím focus ô và nhấn Enter/Space để gán mục đang chọn.

Không dùng drag-and-drop HTML5; pointer painting dễ dùng hơn trên mobile và
không mang payload qua vùng khác.

### 8.3. Trạng thái editor

Editor hiển thị:

- tổng số ô theo từng seed;
- số ô dùng mặc định;
- số ô cố ý không trồng;
- mốc đồng bộ cell/catalog gần nhất;
- cảnh báo entry không còn hợp lệ;
- dirty state và trạng thái đang lưu.

Nút **Lưu kế hoạch** tách khỏi **Bật/Tắt**. Khi auto đang chạy, lưu thành công
hiển thị “Sẽ áp dụng từ vòng kế tiếp”. Khi auto tắt, hiển thị “Đã lưu cho lần
bật tiếp theo”.

Nếu đóng drawer hoặc chuyển route khi dirty, UI hỏi xác nhận bỏ thay đổi. Nếu
server trả 409, editor giữ bản local, hiển thị config mới nhất từ server và cho
người dùng chọn tải lại trước khi tiếp tục; không tự merge theo từng ô.

### 8.4. Offline và cache thiếu

- Có cả cell indices và seed catalog cache: editor hoạt động offline và ghi rõ
  thời điểm đồng bộ cuối.
- Có cell indices nhưng chưa có catalog: cho xem lưới, nhưng khóa các thay đổi
  seed mới; các override cũ vẫn hiển thị bằng id.
- Chưa từng có cell indices: khóa editor và hiện nút **Kết nối và đồng bộ farm**.
- Cache stale không được trình bày như dữ liệu hiện tại; luôn hiển thị timestamp.

## 9. Validation và bảo vệ

Server áp các giới hạn sau trước khi lưu:

- payload JSON tối đa theo body limit hiện có; `treeCellPlan` không được dài hơn
  số cell index trong profile;
- `cellIndex` là số nguyên không âm và phải thuộc profile cache của account;
- mỗi index chỉ xuất hiện một lần;
- `seedId` là số nguyên không âm và phải có trong catalog cache;
- `action` chỉ là `seed` hoặc `skip`;
- revision phải khớp;
- account ownership phải khớp user đăng nhập.

Không log toàn body config. Log runtime chỉ chứa account id, cell index, seed id
và kết quả; không bao giờ chứa game password.

## 10. Error handling

- Không có cell indices: `PUT auto/config` hoặc legacy `POST auto/start` chứa
  plan khác rỗng trả `409 { error, code: "farm-profile-required" }` với hướng
  dẫn đồng bộ thay vì đoán số ô; DB, cờ auto và runtime không đổi. Nếu đã có
  cell indices nhưng chưa có seed catalog, plan chỉ gồm `skip` vẫn hợp lệ;
  entry `seed` trả `409 { error, code: "seed-catalog-required" }`. Plan rỗng
  luôn là thao tác xóa override hợp lệ.
- Session offline khi refresh: trả `409`, giữ cache cũ.
- Timeout khi refresh: trả `504`, không xóa cache cũ.
- Catalog/cell profile đổi giữa lúc editor mở và lưu: revision config vẫn được
  kiểm tra, sau đó validation theo profile mới nhất; trả
  `400 { error, code: "invalid-tree-cell-plan", invalidCellIndices,
  invalidSeedIds }` để UI đánh dấu. Contract này áp dụng cho cả PUT config và
  legacy start có body chứa plan.
- DB save lỗi: runtime không nhận pending config.
- Runtime/session không tồn tại sau khi DB save: lưu vẫn thành công với
  `application = "next-start"`.
- Mất kết nối giữa vòng giữ hành vi dừng auto hiện có; config đã lưu không mất.

## 11. Kiểm thử

### 11.1. Backend unit/repository

1. Đọc JSON config cũ thành revision 0 và ghi lại envelope version 1.
2. Tắt auto giữ nguyên config/revision.
3. Start body kiểu cũ merge mà không xóa `treeCellPlan`.
4. Farm profile cache cập nhật cell và catalog từng phần, không xóa phần còn
   lại.
5. Đổi `gameUser` xóa cache nhưng không lộ/xóa password hoặc config.
6. Chuẩn hóa plan theo index; reject duplicate, index ngoài profile, seed ngoài
   catalog và revision conflict.

### 11.2. AutoFarm

1. Ô có override seed dùng đúng seed.
2. Ô không có entry dùng `seedId` fallback.
3. Ô `skip` không gửi `plantSeed`.
4. Ô đang có cây không bị thay dù plan khác.
5. Thiếu seed trong inventory bỏ qua và log, không tự mua.
6. Config lưu giữa vòng không đổi các ô còn lại của vòng đó.
7. Vòng kế tiếp dùng toàn bộ config pending.
8. Entry không hợp lệ theo farm/catalog hiện tại bị bỏ qua và log.

### 11.3. Route/session

1. Ownership cho config/profile routes.
2. GET/PUT config và response `next-cycle`/`next-start`.
3. 409 revision conflict trả current state.
4. Refresh profile online gọi đúng thứ tự; offline trả 409.
5. DB được validate/ghi trước khi queue runtime.
6. Stop chỉ tắt flag, không xóa config.

### 11.4. Frontend

1. Form hydrate toàn bộ config đã lưu.
2. Palette tạo đúng default/skip/seed entry.
3. Click, pointer paint và keyboard đều cập nhật cùng reducer thuần.
4. Summary đếm đúng trạng thái.
5. Dirty close cảnh báo; save thành công reset dirty.
6. Auto đang chạy hiển thị “vòng kế tiếp”.
7. Profile cache đầy đủ, thiếu catalog và chưa có profile có đúng ba trạng thái
   UI.
8. 409 giữ bản local và hiện conflict thay vì ghi đè.

### 11.5. Verification cuối

- focused backend tests;
- focused frontend tests;
- toàn bộ `npm test` và typecheck của server/web;
- web production build;
- `git diff --check`;
- GitNexus `detect_changes(scope: "all")`, hoặc compare với `main` khi review
  regression;
- QA thủ công drawer desktop/mobile, offline cache và lưu khi auto đang chạy.

Test/build không được trình bày như bằng chứng runtime game thật. Việc trồng
theo plan trên server game cần một smoke test có tài khoản thử và ô trống; không
được dùng tài khoản/dữ liệu thật ngoài phạm vi người dùng cho phép.

## 12. Trình tự triển khai dự kiến

1. Pure types, normalization và config envelope.
2. Repository farm profile cache và migration table.
3. Config/profile REST routes cùng optimistic revision.
4. Session profile observation/refresh và pending config boundary.
5. `AutoFarm` seed selection theo plan.
6. Frontend API/types, config hydration và reducer editor.
7. Drawer UI pointer painting, dirty/conflict/offline states.
8. Regression, build, GitNexus change detection và manual QA.

## 13. Tiêu chí hoàn thành

- Người dùng mở drawer một tài khoản và tô kế hoạch trên đúng số ô đã đồng bộ.
- Ba trạng thái seed/default/skip được lưu, tải lại và hiển thị đúng.
- Tắt auto không xóa kế hoạch.
- Restart server vẫn dùng kế hoạch đã lưu.
- Lưu khi auto chạy không ngắt phiên và chỉ có hiệu lực từ vòng kế tiếp.
- Một vòng không trộn config cũ/mới.
- Ô có cây không bị thay; ô `skip` giữ trống; thiếu hạt không tự mua.
- Editor offline dùng profile/catalog gần nhất và ghi rõ timestamp.
- Không có animal/cook/shop/bulk logic lọt vào phạm vi.
- Không sửa giao thức game hoặc sao chép code/tài nguyên từ trang tham chiếu.
