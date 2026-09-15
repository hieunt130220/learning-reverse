# Desktop Operations UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi giao diện vận hành tài khoản trên Desktop từ drawer 720px cuộn 9 panel sang Desktop Focused Console (Sidebar Rail + 1 Panel Active Canvas + Sticky Telemetry Header).

**Architecture:** Tách biệt layout hiển thị theo viewport: Desktop (`!isMobile`) sử dụng bố cục Console toàn khổ với Sidebar Navigation Rail (8 mục, phím tắt 1-8), chỉ render duy nhất panel active trên Canvas rộng, có Top Telemetry Header và Bottom Ticker; Mobile (`isMobile`) giữ nguyên 100% drawer và tabbar trượt ngang hiện tại.

**Tech Stack:** React 18.3.1, TypeScript, CSS custom properties (design tokens `avatar-web`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-15-desktop-operations-ux-redesign-design.md`

## Global Constraints
- **Bảo tồn 100% Mobile**: Màn hình mobile (`< 680px`) tiếp tục dùng `drawer-tabbar` và `PANEL_GROUPS` như hiện tại, không làm hỏng trải nghiệm trên điện thoại.
- **Không phá vỡ Accessibility & Dialog Semantics**: Giữ nguyên thẻ `<aside role="dialog" aria-modal="true" aria-labelledby="drawer-title">`, `Escape` để đóng và dirty-guard (`canLeave`).
- **Không dùng Inline Styles bừa bãi**: Toàn bộ CSS mới phải sử dụng biến token từ `styles/tokens.css` và tuân thủ class naming nhất quán.
- **KHÔNG thực hiện TDD**: Không tạo test file mới; chỉ cập nhật assertions nếu cần khi layout thay đổi hợp lệ.
- **GitNexus Workflow**: Chạy `impact` trước khi sửa file logic và `detect_changes` trước mỗi commit.

---

### Task 1: CSS Layout cho Desktop Console & Wide Viewport

**Files:**
- Modify: `avatar-web/web/src/styles/components.css`

**Interfaces:**
- Consumes: Tokens từ `tokens.css` (`--bg`, `--card`, `--line`, `--accent`, `--ok`, `--warn`, `--gold`)
- Produces: Các class `.console-*`, `.desktop-rail-*`, `.mini-ticker-*` và media query mở rộng `.account-drawer` trên desktop.

- [x] **Step 1: Thêm rules cho .account-drawer mở rộng trên desktop**
Trong `avatar-web/web/src/styles/components.css`, cập nhật media query `@media (min-width: 680px)` để `.account-drawer` khi ở chế độ console (`.account-drawer--desktop` hoặc `≥ 1024px`) mở rộng toàn màn hình (`width: 100%; max-width: 100%; border-radius: 0;`), loại bỏ cảm giác bị bóp nghẹt 720px.

- [x] **Step 2: Thêm styles cho Header Telemetry, Sidebar Rail và Canvas**
Thêm các class:
- `.console-topbar`: Chiều cao 56px, flex, border-bottom, sticky ở đỉnh, hiển thị thông tin account + telemetry xu/lượng + auto toggle.
- `.console-body`: Flex 1, chia làm 2 cột: Sidebar trái cố định và Canvas phải cuộn độc lập.
- `.console-sidebar`: Chiều rộng 220px–240px, nền `--bg-raised`, danh sách 8 mục với icon, label, badge và phím tắt `1-8`.
- `.console-nav-btn`: Hover effect, active state với viền accent trái.
- `.console-canvas`: Flex 1, overflow-y tự động, padding 20px 24px.
- `.console-bottom-ticker`: Chiều cao 36px, hiển thị log gói tin mới nhất + nút mở tab Log.

- [x] **Step 3: Thêm responsive grid 2 cột cho Nông trại & Câu cá trên desktop**
Thêm class `.farm-layout-split` (Cột 1: Sơ đồ 48 ô đất; Cột 2: Chuồng nuôi & Tự động bán) và `.fishing-layout-split` (Cột 1: Cấu hình; Cột 2: Thống kê & Danh sách cá) khi màn hình `≥ 1024px`.

- [x] **Step 4: Verify CSS syntax & build**
Run: `npm run build`
Expected: Build thành công không có lỗi CSS parser.

- [x] **Step 5: Commit**
`git add src/styles/components.css && git commit -m "style(web): add desktop operations console layout classes"`

---

### Task 2: Cập nhật AccountOperationsDrawer cho Desktop Console

**Files:**
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`

**Interfaces:**
- Consumes: CSS từ Task 1, các panel hiện có (`StatusPanel`, `SettingsPanel`, `FishingPanel`, `QuestsPanel`, `CookingPanel`, `AssetsPanel`, `ShopPanel`, `LogPanel`)
- Produces: Layout console hoàn chỉnh trên Desktop, thanh điều hướng 8 mục, phím tắt 1–8, giữ nguyên mobile tabbar.

- [x] **Step 1: Định nghĩa danh sách 8 phân hệ vận hành cho Desktop**
Khai báo mảng `DESKTOP_CONSOLE_GROUPS` gồm các mục phân hệ với ID, Icon, Label và phím tắt `1-5`.

- [x] **Step 2: Cập nhật cơ chế visible panel trên Desktop**
Thay vì để `visible(id)` luôn trả về `true` trên Desktop (khiến cả 9 panel xếp chồng cuộn dọc), sửa logic để trên Desktop chỉ render phân hệ active (`(PANEL_TO_GROUP.get(id) ?? '') === activeGroup`), triệt tiêu việc cuộn 9 panel.

- [x] **Step 3: Thêm Keyboard Listener cho phím tắt 1–5**
Trong `LoadedOperations`, bổ sung `useEffect` lắng nghe sự kiện `keydown`:
Khi người dùng bấm phím `1` đến `5` và con trỏ không nằm trong thẻ `INPUT`, `SELECT`, `TEXTAREA`, chuyển ngay sang nhóm tương ứng.

- [x] **Step 4: Render Desktop Sidebar Rail & Persistent Header**
- Khi `!isMobile`, render `aside.console-sidebar` chứa các nút điều hướng tương ứng kèm phím tắt.
- Render Header cố định chứa tên tài khoản, badge trạng thái và nút đóng.
- Render Footer ticker hiển thị dòng log mới nhất.

- [x] **Step 5: Verify build & tests**
Run: `npm test`
Expected: Toàn bộ 11 test suites (gồm `accountsRoutes.test.tsx`, `AccountCard.test.tsx`) pass 100%.

- [x] **Step 6: Commit**
`git add src/accounts/AccountOperationsDrawer.tsx && git commit -m "feat(web): support desktop operations console with sidebar rail and hotkeys"`

---

### Task 3: Bố cục 2 cột trực quan cho Nông trại & Câu cá trên Desktop

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/SettingsPanel.tsx`
- Modify: `avatar-web/web/src/accounts/panels/FishingPanel.tsx`

**Interfaces:**
- Consumes: Cấu trúc component hiện hữu
- Produces: Giao diện thoáng đãng, chia cột hợp lý trên màn hình lớn mà không ảnh hưởng mobile.

- [x] **Step 1: Áp dụng split-grid cho SettingsPanel trên Desktop**
Tận dụng class `.farm-layout-split`:
- Cột bên trái: Lưới 48 ô đất `TreeCellPlanEditor`.
- Cột bên phải: Chuồng trại `AnimalPlanEditor` + Quy tắc bán `AutoSellRulesEditor`.
Trên mobile tiếp tục xếp chồng 1 cột tự nhiên.

- [x] **Step 2: Áp dụng split-grid cho FishingPanel trên Desktop**
Tận dụng class `.fishing-layout-split`:
- Cột bên trái: Thẻ cấu hình câu cá (`FishingSettingsPanel`) và nút bắt đầu/dừng.
- Cột bên phải: Thống kê số lượng cá đã câu, danh sách cá đã bắt theo loài.

- [x] **Step 3: Verify build & tests**
Run: `npm test && npm run build`
Expected: Pass 100%.

- [x] **Step 4: Commit**
`git add src/accounts/panels/SettingsPanel.tsx src/accounts/panels/FishingPanel.tsx && git commit -m "feat(web): optimize farm and fishing panels for desktop wide layouts"`
