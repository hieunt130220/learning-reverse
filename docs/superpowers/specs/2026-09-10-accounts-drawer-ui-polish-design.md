# Accounts Drawer UI Polish Design

## Mục tiêu và bối cảnh

Hoàn thiện giao diện drawer vận hành tài khoản theo sáu góp ý trực tiếp trên trang `/accounts/:id`:

1. Thay lựa chọn `Auto Farm`/`Auto Fishing` dạng checkbox bằng button để chế độ tự động nổi bật và thể hiện đúng quan hệ chọn một trong hai.
2. Sửa bố cục checkbox `Tự động bán trên sạp` bị co chữ trên màn hình hẹp.
3. Sửa bố cục checkbox và dòng mô tả mua vé trong cấu hình câu cá bị tách, lệch hàng trên màn hình hẹp.
4. Thêm khoảng cách rõ ràng giữa ba section `Nông trại`, `Kho`, `Vật nuôi`.
5. Hiển thị nông sản market ID `200` là `Ngô`, không lấy nhầm tên vật phẩm `Phân bón giảm 60 phút`.
6. Bỏ toàn bộ section mở slot trả phí trong tab `Sạp của tôi`.

Mục tiêu là cải thiện độ rõ ràng và khả năng sử dụng trên viewport mobile hiện tại mà không thay đổi API, persistence, hay luồng automation/shop phía backend.

## Phạm vi

### In scope

- `StatusPanel`: đổi bộ chọn mode thành hai button có trạng thái active/pressed và giữ nguyên logic chọn mode hiện tại.
- `AutoSellRulesEditor`: áp dụng layout checkbox có phạm vi riêng, để checkbox giữ kích thước tự nhiên và label không bị ép dòng vô lý.
- `FishingSettingsPanel`: áp dụng cùng nguyên tắc layout cho control mua vé; nhóm label và mô tả thành một khối dễ đọc, vẫn giữ cảnh báo tiêu Lượng.
- `AssetsPanel`: bọc ba card trong container dạng stack và đặt gap nhất quán.
- `ShopPanel`: ưu tiên tên nông sản theo ngữ cảnh market cho ID `200` là `Ngô`; xóa UI mở slot.
- `styles.css`: thêm các class component-scoped phục vụ các layout trên và responsive state cần thiết.

### Out of scope

- Không thay đổi logic start/stop/chuyển mode automation, payload API, revision/conflict handling hay trạng thái khóa control.
- Không thay đổi cấu hình hoặc chu kỳ auto-sell.
- Không thay đổi logic mua vé, cần câu, mồi câu hoặc quy tắc cảnh báo tiêu Lượng.
- Không sửa protocol, cache, decoder hay ID nhận từ backend.
- Không xóa API/backend capability mở slot; yêu cầu hiện tại chỉ bỏ section khỏi UI.
- Không đổi mapping `KNOWN_PRODUCE_NAME_MAP` dùng chung vì ID `200` đang xung đột theo ngữ cảnh với catalog vật phẩm; correction chỉ áp dụng cho ngữ cảnh nông sản của shop.
- Không tạo test file mới vì người dùng không yêu cầu viết test.

## Các hướng tiếp cận

### A. CSS và mapping theo phạm vi component — chọn

Thêm class có tên theo control/panel, sửa JSX vừa đủ và thêm một override tên nông sản chỉ trong shop. Cách này giới hạn blast radius, không làm thay đổi form control hoặc catalog ở màn hình khác, đồng thời giải quyết đúng sáu vị trí được đánh dấu.

### B. Chuẩn hóa checkbox và catalog toàn ứng dụng

Sửa rule `input[type='checkbox']` toàn cục và thêm ID `200` vào mapping dùng chung. Ít CSS hơn nhưng có thể thay đổi các checkbox chưa được kiểm tra và có nguy cơ gọi Ngô thành tên sai ở nơi ID `200` thực sự là item phân bón.

### C. Dùng inline style tại từng component

Giải quyết nhanh từng ảnh nhưng tiếp tục mở rộng lượng inline style đang có trong `FishingSettingsPanel`, khó giữ nhất quán responsive và khó bảo trì hơn.

## Thiết kế kiến trúc và giải pháp kỹ thuật

### 1. Bộ chọn automation bằng button

**File:** `avatar-web/web/src/accounts/panels/StatusPanel.tsx`

- Thay hai `label > input[type=checkbox]` bằng hai `button type="button"` trong một group.
- Mỗi button gọi lại `setSelectedMode('auto_farm' | 'auto_fishing')`, dùng cùng `controlsLocked` cho `disabled`.
- Dùng `aria-pressed` để công bố trạng thái chọn cho assistive technology.
- Active mode có nền/accent rõ; mode chưa chọn dùng kiểu secondary/ghost. Không tự start khi chọn mode; nút `Bắt đầu` vẫn là hành động riêng như hiện tại.

### 2. Checkbox auto-sell

**Files:**

- `avatar-web/web/src/accounts/AutoSellRulesEditor.tsx`
- `avatar-web/web/src/styles.css`

Giữ nguyên checkbox và callback. CSS riêng đặt checkbox `width: auto`, `flex: 0 0 auto`, bỏ margin/padding kế thừa không phù hợp; label có `min-width: 0`, không để text bị ép thành cột hẹp. Toàn bộ vùng label vẫn click được.

### 3. Control mua vé câu cá

**Files:**

- `avatar-web/web/src/accounts/panels/FishingSettingsPanel.tsx`
- `avatar-web/web/src/styles.css`

Thay inline layout của khối đầu tiên bằng class có cấu trúc rõ ràng: một hàng checkbox + nhãn và một dòng hint bên dưới, thụt theo nội dung chữ. Checkbox có kích thước tự nhiên; text được phép wrap theo chiều rộng còn lại. Màu vàng cho hồ cá mập và trạng thái disabled khi đang câu vẫn giữ nguyên.

### 4. Spacing các section tài sản

**Files:**

- `avatar-web/web/src/accounts/panels/AssetsPanel.tsx`
- `avatar-web/web/src/styles.css`

Thay fragment gốc bằng container `assets-panel-stack`, dùng `display: grid` và gap `16px`. Ba section con giữ nguyên card, dữ liệu và hành vi; `AnimalSection` vẫn có thể không render khi không có vật nuôi mà không để khoảng trống dư.

### 5. Tên nông sản market ID 200

**File:** `avatar-web/web/src/accounts/panels/ShopPanel.tsx`

Định nghĩa mapping tên có phạm vi shop cho market produce ID `200` → `Ngô`. Hàm `itemName` ưu tiên mapping theo ngữ cảnh market trước map catalog tổng hợp hiện tại, do catalog `items` có thể dùng cùng ID `200` cho `Phân bón giảm 60 phút`. Sự thay đổi áp dụng nhất quán cho danh mục chợ, tiêu đề listings và các chỗ gọi `itemName` trong `ShopPanel`, không sửa dữ liệu nguồn.

### 6. Bỏ section mở slot

**File:** `avatar-web/web/src/accounts/panels/ShopPanel.tsx`

- Xóa JSX `shop-paid-action` chứa `Loại mở slot`, nút `Mở slot` và hint capability.
- Xóa state, validation và handler frontend chỉ còn được sử dụng bởi section này nếu không còn tham chiếu.
- Giữ nguyên type transaction `unlock`, API/backend và capability để tránh mở rộng phạm vi sang protocol.

## Data contracts và luồng xử lý

- Automation mode tiếp tục là union `'auto_farm' | 'auto_fishing'`; chỉ presentation control thay đổi.
- Auto-sell và fishing checkbox tiếp tục phát boolean hiện tại, không đổi shape payload.
- `AssetsPanel` tiếp tục nhận cùng props và render cùng các component con.
- Shop runtime tiếp tục giữ nguyên `itemId: number`; tên `Ngô` là phép chiếu UI theo ngữ cảnh, không mutate snapshot/cache.
- Khi section mở slot bị bỏ, frontend không còn phát request unlock từ drawer nhưng backend contract không đổi.

## Accessibility và responsive

- Mode buttons có `type="button"`, `aria-pressed`, focus-visible và disabled state rõ ràng.
- Checkbox vẫn dùng native input nằm trong label để giữ keyboard/click semantics.
- Không đặt width cứng cho phần text; layout hoạt động từ viewport mobile trong ảnh (656 px) xuống breakpoint hiện tại.
- Gap giữa asset cards được áp dụng ở container, không dùng margin phụ thuộc thứ tự hoặc `:nth-child`.

## Edge cases

- Khi automation đang chạy/chuyển trạng thái, hai mode button đều tuân theo khóa hiện tại.
- Label dài của vé event hoặc bản địa hóa dài hơn vẫn wrap dưới dạng câu, không thành cột một từ.
- Khi `AnimalSection` trả về `null`, stack chỉ tạo khoảng cách giữa các card thực sự render.
- Khi catalog item ID `200` có tên vật phẩm phân bón, chỉ `ShopPanel` đổi sang `Ngô`; các màn hình vật phẩm ngoài shop vẫn giữ tên catalog.
- Xóa section mở slot không ảnh hưởng hiển thị slot hiện có hay hành động rút/đăng bán.

## Verification Plan

Không tạo test mới. Sau khi production code được duyệt và triển khai:

1. Chạy typecheck/build frontend hiện có của `avatar-web/web` trên source đã đổi.
2. Chạy `git diff --check`.
3. Dùng GitNexus impact trước khi sửa từng symbol và `gitnexus_detect_changes` sau khi sửa để xác nhận phạm vi.
4. Browser smoke tại `/accounts/3` với viewport mobile tương đương 656×1250:
   - `Auto Farm` và `Auto Fishing` là button, active state rõ, chọn mode không tự start.
   - Auto-sell label nằm một hàng khi đủ chỗ và wrap tự nhiên khi hẹp.
   - Control mua vé có checkbox, label và hint thẳng hàng, không chồng/cắt chữ.
   - `Nông trại`, `Kho`, `Vật nuôi` có gap 16 px.
   - Market ID `200` hiện `Ngô` ở danh mục/listing liên quan.
   - Section `Loại mở slot` không còn trong `Sạp của tôi`.
5. Smoke thêm ở desktop breakpoint ≥ 680 px để bảo đảm layout không thoái lui.

## Tiêu chí hoàn thành

- Sáu góp ý được phản ánh đúng trên UI mobile.
- Không thay đổi API/backend/protocol hoặc dữ liệu persisted ngoài phạm vi đã nêu.
- Build/typecheck và diff check đạt; browser smoke ghi nhận rõ các mục đã xác minh.
- Không stage hoặc commit file nếu chưa có yêu cầu rõ ràng từ người dùng.
