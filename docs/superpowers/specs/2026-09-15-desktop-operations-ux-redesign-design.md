# Thiết kế Lại UI/UX Vận Hành Trên Desktop (Desktop Operations Console)

## Mục tiêu & Bối cảnh

### Vấn đề hiện tại
Khi quản lý tài khoản game trên giao diện web trên Desktop (`/accounts/:id`):
1. **Lãng phí không gian màn hình lớn**: Giao diện hiển thị dưới dạng một side drawer hẹp (`width: min(720px, 100%)`) bám sát mép phải màn hình. Khoảng 60%–70% diện tích màn hình desktop phía bên trái bị che phủ bởi lớp overlay tối màu (`.dialog-backdrop--drawer`).
2. **Scroll vô tận (Endless Scrolling)**: Trên Desktop (`isMobile = false`), thanh tab điều hướng (`.drawer-tabbar`) hoàn toàn bị ẩn, và thuộc tính `visible(id)` trả về `true` cho tất cả 9 panel cùng lúc (`StatusPanel`, `SettingsPanel` gồm TreePlan 48 ô + AnimalPlan + AutoSell, `FishingPanel`, `QuestsPanel`, `CookingPanel`, `AssetsPanel`, `ShopPanel`, `LogPanel`). Toàn bộ 9 panel này bị dồn xếp chồng thẳng đứng trong một container cuộn duy nhất (`.drawer-panels`).
3. **Mất tập trung & Mệt mỏi khi thao tác**: Khi người dùng muốn tinh chỉnh kế hoạch trồng trọt hoặc kiểm tra tiến độ câu cá, họ phải cuộn hàng chục màn hình, dễ bị lạc vị trí, không thể giữ cố định thanh trạng thái điều khiển tự động (Auto toggle) hay xem telemetry.

### Mục tiêu giải pháp
Chuyển đổi trải nghiệm vận hành trên desktop (màn hình `≥ 768px`) từ mô hình **"Drawer hẹp cuộn dọc 9 panel"** sang mô hình **"Desktop Operations Console & Focused Workspace"**:
- **Tận dụng toàn bộ chiều rộng màn hình** (`100vw` hoặc container rộng chuẩn console `1200px–1440px`).
- **Thanh Navigation Rail (Sidebar) cố định bên trái**: Phân loại rõ ràng 8 phân hệ vận hành với icon, badge thông báo và phím tắt nhanh (`1` đến `8`).
- **Workspace Canvas độc lập ở giữa**: Chỉ hiển thị DUY NHẤT 1 phân hệ đang được chọn (không còn scroll hunting). Các màn hình phức tạp như Nông trại hay Câu cá được bố trí dạng 2 cột trực quan (ví dụ: lưới 48 ô đất bên trái, chuồng trại & quy tắc bán bên phải).
- **Thanh Telemetry & Điều khiển Toàn cục cố định ở đỉnh (Sticky Header)**: Luôn nhìn thấy Xu, Lượng, Level, Trạng thái kết nối và Nút Bật/Tắt Auto mà không phụ thuộc vào việc đang xem tab nào.
- **Giữ nguyên 100% trải nghiệm trên Mobile (`< 768px`)**: Tiếp tục sử dụng drawer và horizontal tabbar trượt ngang như hiện tại, không làm xáo trộn người dùng di động.

---

## Phạm vi (Scope)

### In-scope
1. **Kiến trúc Layout Desktop**:
   - Tách biệt hiển thị giữa Mobile (`< 768px`) và Desktop (`≥ 768px` / `≥ 1024px`) trong `AccountOperationsDrawer.tsx` (hoặc nâng cấp thành layout Console chuyên dụng).
   - Desktop layout gồm:
     - `TopBar`: Account name, Avatar, Connection status, Xu/Lượng metrics, Master Auto Toggle, Quick refresh/close.
     - `Sidebar Rail`: 8 mục vận hành (`Tổng quan`, `Nông trại`, `Câu cá`, `Nhiệm vụ`, `Bếp ăn`, `Tài sản`, `Sạp hàng`, `Nhật ký`).
     - `Main Canvas`: Render 1 panel active tại một thời điểm, loại bỏ hoàn toàn việc render đồng thời 9 panel xếp chồng trên desktop.
     - `Bottom Telemetry Ticker`: Thanh tóm tắt 1 dòng sự kiện gói tin/log mới nhất kèm nút mở nhanh tab Log.
2. **Keyboard Navigation**:
   - Hỗ trợ phím tắt số `1` đến `8` trên desktop để chuyển nhanh giữa các phân hệ khi không focus vào ô nhập liệu.
   - Phím `Esc` để đóng/quay về Dashboard.
3. **Tái cấu trúc bố cục bên trong các Panel trên Desktop**:
   - `Farm`: Chuyển sang 2 cột (Cột 1: Sơ đồ 48 ô đất + Palette giống; Cột 2: Chuồng trại vật nuôi + Bảng cấu hình tự động bán).
   - `Fishing`: Chuyển sang 2 cột (Cột 1: Cấu hình mồi/cần/vé/hồ; Cột 2: Thống kê phiên câu & danh sách cá).
   - `Quests`: Grid thẻ nhiệm vụ với thanh tiến độ rõ ràng, banner điểm danh nổi bật ở đầu.
4. **CSS & Styling Tokens**:
   - Sử dụng triệt để hệ thống tokens từ `avatar-web` (`--bg`, `--card`, `--line`, `--accent`, `--ok`, `--warn`, `--gold`, `--radius-*`).
   - Cập nhật breakpoint và responsive styles trong `avatar-web/web/src/styles/components.css`.

### Out-of-scope
- Không thay đổi logic backend, API endpoints (`/api/accounts/*`), websocket streaming hay các automation loops.
- Không thay đổi các data contracts hay protocol decoders (cmd 45, 41, -62, v.v.).
- Không thay đổi quy trình đăng nhập, xác thực hoặc quản lý tài khoản.
- Không viết test files trừ khi có yêu cầu bổ sung từ người dùng (tuân thủ CLAUDE.md: KHÔNG thực hiện TDD).

---

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### 1. Danh sách Files liên quan

| File | Vai trò | Thay đổi chính |
| --- | --- | --- |
| `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx` | Component container chính của trang `/accounts/:id` | Bổ sung logic render Desktop Console khi viewport `≥ 768px`, hỗ trợ sidebar rail, single-panel active canvas và keyboard navigation `1-8`. |
| `avatar-web/web/src/styles/components.css` | Hệ thống class CSS component của web | Thêm các class `.console-*` cho desktop layout (sidebar rail, canvas grid, persistent header, bottom ticker), điều chỉnh media query. |
| `avatar-web/web/src/accounts/panels/SettingsPanel.tsx` | Panel cấu hình nông trại | Cải thiện responsive grid để hiển thị 2 cột thoáng đãng trên desktop thay vì bị bóp hẹp 720px. |
| `avatar-web/web/src/accounts/panels/FishingPanel.tsx` | Panel câu cá | Tận dụng chiều rộng desktop cho bố cục split-card thống kê và cấu hình câu. |
| `opendesign/mockups/desktop-operations/index.html` | Prototype tương tác hoàn chỉnh | Được dùng để kiểm chứng thị giác và luồng UX trước khi áp dụng vào mã nguồn chính. |

### 2. Sơ đồ kiến trúc Layout trên Desktop (≥ 768px)

```
+--------------------------------------------------------------------------------------------------+
| Top Header: [🧑‍🌾 farmer_pro_99 | Online]  [Xu: 12.4M | Lượng: 320]  [⚡ Auto: BẬT]  [🔄] [✕ Đóng]  |
+-------------------+------------------------------------------------------------------------------+
| SIDEBAR RAIL      | MAIN FOCUSED WORKSPACE (Chỉ hiển thị 1 Section được chọn)                    |
| (Phím tắt 1-8)    |                                                                              |
|                   |  Ví dụ: [🌱 Nông trại & Ô đất]                                               |
| [1] ⚡ Tổng quan  |  +---------------------------------------+  +-----------------------------+  |
| [2] 🌱 Nông trại  |  | SƠ ĐỒ 48 Ô ĐẤT                        |  | CHUỒNG TRẠI (Gà, Bò)        |  |
| [3] 🎣 Câu cá     |  | [1][2][3][4][5][6][7][8]              |  | 🐔 6 Gà lấy trứng           |  |
| [4] 📜 Nhiệm vụ   |  | [9][...][16]                          |  | 🐄 4 Bò sữa                 |  |
| [5] 🍳 Bếp ăn     |  | ...                                   |  +-----------------------------+  |
| [6] 🎒 Tài sản    |  | Palette chọn giống: [Lúa][Ngô][Cà rốt]|  | QUY TẮC BÁN NÔNG SẢN        |  |
| [7] 🏪 Sạp hàng   |  +---------------------------------------+  | [Lúa: Bán hết] [Ngô: Giữ 50]|  |
| [8] 📟 Nhật ký    |                                             +-----------------------------+  |
+-------------------+------------------------------------------------------------------------------+
| Bottom Ticker: 🟢 [LIVE] 14:32:06 RX cmd 45: Thu hoạch 16 ô lúa thành công.      [Xem Log (Phím 8)]  |
+--------------------------------------------------------------------------------------------------+
```

### 3. Phân chia Phân hệ và Phím tắt (Navigation Mapping)

| Phím | Phân hệ | Icon | Panels / Nội dung hiển thị |
| :---: | :--- | :---: | :--- |
| **`1`** | **Tổng quan** | ⚡ | KPI Cards (Ô đất sắp thu, Chuồng nuôi, Cá hôm nay, Nhiệm vụ), Trạng thái Automation vòng lặp, Quick Actions (Chạy ngay, Đăng xuất sau chu kỳ). |
| **`2`** | **Nông trại** | 🌱 | Lưới 48 ô đất (`TreeCellPlanEditor`), Chuồng trại (`AnimalPlanEditor`), Bảng quy tắc tự động bán (`AutoSellRulesEditor`). |
| **`3`** | **Câu cá** | 🎣 | Cấu hình khu vực/cần/mồi/vé (`FishingSettingsPanel`), Thống kê câu cá & danh sách cá câu được (`FishingPanel`). |
| **`4`** | **Nhiệm vụ** | 📜 | Banner Điểm danh hàng ngày NPC Lái buôn, Tabbed Quests Tân thủ / Nhà nông / Thợ câu (`QuestsPanel`). |
| **`5`** | **Bếp ăn** | 🍳 | Danh sách 3 nồi nấu tự động, công thức và nguyên liệu (`CookingPanel`). |
| **`6`** | **Tài sản** | 🎒 | Kho đồ nông sản, vật phẩm và hạt giống (`AssetsPanel`). |
| **`7`** | **Sạp hàng** | 🏪 | 8 slot bán ngoài chợ, lịch sử giao dịch và nút thu xu (`ShopPanel`). |
| **`8`** | **Nhật ký** | 📟 | Live Packet Viewer (`LogPanel`), filter TX/RX/Opcode. |

---

## Verification Plan

### 1. Kiểm tra trên HTML Prototype
- Mở file `./opendesign/mockups/desktop-operations/index.html` trên trình duyệt.
- Bấm vào nút chuyển đổi giữa `🖥️ Thiết kế mới: Desktop Focused Console` và `📱 Trải nghiệm cũ: 720px Drawer` để đối chiếu trực tiếp sự khác biệt về diện tích hiển thị và thao tác cuộn.
- Bấm phím số `1` đến `8` trên bàn phím: Xác nhận workspace chuyển ngay lập tức sang phân hệ tương ứng không độ trễ.
- Kiểm tra hiển thị của lưới 48 ô đất: Tất cả các ô hiển thị rõ ràng, không bị ép nhỏ dòng.

### 2. Kiểm tra khi tích hợp vào React App (`avatar-web`)
- Khởi chạy web qua `npm run dev` trong `avatar-web/web`.
- Trên màn hình Desktop (> 1024px): Bấm vào bất kỳ tài khoản nào trong Dashboard.
  - Kỳ vọng: Hiển thị giao diện Desktop Console toàn màn hình với thanh Header cố định, Sidebar bên trái, Canvas ở giữa và Bottom ticker.
  - Kỳ vọng: Không còn tình trạng 9 panel bị dồn ứ cuộn dọc.
- Thu nhỏ cửa sổ về màn hình Mobile (< 680px):
  - Kỳ vọng: Giao diện tự động chuyển về drawer cuộn với thanh tab ngang mượt mà, không bị vỡ bố cục.
- Kiểm tra tính năng Dirty Guard: Khi chỉnh sửa ô đất hoặc cấu hình mà chưa bấm Lưu, việc chuyển tab hoặc thoát vẫn cảnh báo đầy đủ như hiện tại.
