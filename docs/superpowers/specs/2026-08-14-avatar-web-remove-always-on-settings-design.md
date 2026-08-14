# Loại bỏ setting cho thao tác chăm sóc mặc định — Design Spec

## 1. Mục tiêu

Rút gọn drawer Vận hành của `avatar-web` bằng cách bỏ các control mà người
dùng không cần cấu hình vì thao tác phải luôn được thực hiện. Hành vi tương
ứng vẫn phải chạy với các tài khoản đã lưu cấu hình cũ, kể cả khi cấu hình đó
đang chứa `false` hoặc thiếu item ID.

Phạm vi chỉ gồm phần cấu hình auto farm trong frontend và điểm hợp nhất cấu
hình runtime ở server. Không thay đổi REST/WebSocket contract, kế hoạch cây
theo ô, kế hoạch vật nuôi theo slot, bán vật nuôi, tự mua, chu kỳ hoặc các thao
tác Bật/Tắt.

## 2. Phạm vi UI

### Bỏ khỏi `AutoFarmPanel`

- Toàn bộ section `🌱 Cây trồng`, gồm các input `seedId`, `waterItemId`,
  `grassItemId`, `wormItemId` và checkbox thu hoạch ô/bón phân.
- Dòng checkbox của vật nuôi chuồng: thu hoạch sản phẩm, cho ăn và thuốc bổ.
- Hai checkbox của vật nuôi hồ: thu hoạch sản phẩm và cho ăn.

### Giữ lại

- Bật/Tắt auto và trạng thái vòng chạy.
- Bán vật nuôi chuồng/hồ, danh sách loài bán và giới hạn bán.
- Kế hoạch vật nuôi chuồng/hồ theo slot.
- Kế hoạch cây theo ô và thao tác đồng bộ farm profile/catalog hạt.
- Tự mua, ngân sách, trần bán, chu kỳ và thời gian nghỉ.
- Log, lỗi, danh sách vật phẩm và các thông báo hiện có.

Các input bị bỏ không được thay bằng control disabled hoặc control ẩn; chúng
không còn là lựa chọn của user trong giao diện.

## 3. Hành vi luôn bật

Các field sau được coi là policy cố định khi auto farm chạy:

```ts
{
  harvest: true,
  harvestAnimals: true,
  harvestBarnAnimals: true,
  harvestPondAnimals: true,
  feedAnimals: true,
  feedBarnAnimals: true,
  feedPondAnimals: true,
  healAnimals: true,
  fertilizeCells: true,
  waterItemId: 100,
  grassItemId: 123,
  wormItemId: 124,
}
```

Frontend không hydrate hoặc gửi các giá trị này từ control đã bị xóa. Khi gửi
request Bật hoặc cập nhật runtime, frontend dùng policy cố định để không tiếp
tục phát tán giá trị `false` từ state UI cũ.

Server hợp nhất policy ở `makeConfig` sau khi áp dụng input. Vì vậy:

- cấu hình lưu từ phiên bản cũ có `false` vẫn chạy đúng policy mới;
- auto được bật lại sau restart vẫn dùng policy mới;
- request cũ hoặc caller khác gửi `false` cũng không thể tắt các hành động này;
- item ID cũ bị thiếu hoặc khác giá trị sẽ dùng `100/123/124`.

`seedId` không nằm trong policy cố định: việc trồng lại ưu tiên
`treeCellPlan`; nếu một cấu hình cũ vẫn có `seedId` thì server tiếp tục giữ nó
như fallback tương thích. User không còn chỉnh fallback này trong drawer.

`DEFAULTS` phía server được cập nhật cho cùng policy để các đường khởi tạo mới
có giá trị đúng ngay cả trước khi nhận input.

## 4. Data flow và tương thích

```text
GET auto/config
  -> AutoFarmPanel chỉ hydrate các setting còn là lựa chọn
  -> Bật / queueConfig / updateAutoConfig
  -> makeConfig(merged input)
  -> policy luôn bật được áp dụng
  -> AutoFarm chạy với cùng hành vi cho config mới và config cũ
```

Không cần migration dữ liệu SQLite. Các key cũ vẫn được parser chấp nhận để
đọc dữ liệu và giữ tương thích API; chúng chỉ không còn có quyền tắt policy
luôn bật ở runtime.

## 5. Ranh giới file và trách nhiệm

- `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx`
  - bỏ JSX và state setter của các control luôn bật;
  - dùng các hằng số policy khi tạo payload Bật/cấu hình;
  - giữ `seedId` chỉ như dữ liệu fallback nội bộ nếu cần tương thích config cũ;
  - không thay đổi logic kế hoạch cây/vật nuôi hoặc các thao tác bán.
- `avatar-web/server/src/autoFarm.ts`
  - cập nhật `DEFAULTS`;
  - áp dụng policy sau input trong `makeConfig` để mọi caller có cùng hành vi.
- Không sửa route, schema SQLite, DTO contract hoặc file test trong phạm vi
  này. Theo quy định project, không tạo test mới khi user chưa yêu cầu.

## 6. Lỗi và edge cases

- Nếu config cũ chứa `false`, UI không hiển thị checkbox và runtime vẫn bật
  hành động tương ứng.
- Nếu config cũ thiếu `waterItemId`, `grassItemId` hoặc `wormItemId`, runtime
  dùng ID cố định.
- Nếu config cũ có `seedId`, không làm mất giá trị khi save kế hoạch; nếu không
  có, kế hoạch cây theo ô vẫn là nguồn chọn hạt hiện hành.
- Các setting nguy hiểm hoặc có tính phá huỷ (`sell*`) vẫn là opt-in và không
  bị ảnh hưởng bởi policy này.
- Không xóa các key cũ khỏi `AUTO_CONFIG_KEYS`/parser vì điều đó có thể làm
  request hoặc dữ liệu lịch sử mất tương thích.

## 7. Kiểm chứng chấp nhận

- `npm run build` trong `avatar-web/web` thành công.
- Mở `/accounts/1`, xác nhận ba nhóm control bị yêu cầu bỏ không còn hiển thị;
  các kế hoạch slot/cây, bán, tự mua và Bật/Tắt vẫn hiển thị.
- Khi config API trả các field luôn bật là `false`, payload Bật vẫn mang policy
  cố định và server runtime không nhận trạng thái tắt.
- Khi config API thiếu các item ID, payload/runtime dùng `100/123/124`.
- Không có thay đổi ngoài các file thuộc phạm vi; giữ nguyên dirty files có
  sẵn trong worktree.
