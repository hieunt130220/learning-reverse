# Tích Hợp Chế Độ "Mê Cung" Vào Web Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp chế độ tự động "Mê cung" (`auto_maze`) vào hệ thống `avatar-web` (cả Backend và Web Frontend), cho phép người dùng cấu hình, bật/tắt, tự động tìm và mở rương, tự chuyển khu và dừng an toàn khi đạt giới hạn 30 hộp quà/ngày.

**Architecture:** Mở rộng schema database SQLite và các kiểu `AutomationMode`. Xây dựng module runner `AutoMazeRunner` độc lập trong `src/maze/autoMaze.ts` tích hợp thuật toán tìm đường A* né tường. Gắn kết runner vào vòng đời `AvatarSession`, cung cấp API cấu hình `/api/accounts/:id/automation/maze/config`. Phía Web xây dựng component `MazePanel.tsx` và gắn nút điều khiển trên `StatusPanel` và thanh tab.

**Tech Stack:** TypeScript, Node.js, Express, SQLite (`better-sqlite3`), React, Vite, Tailwind CSS / vanilla CSS.

**Spec:** `docs/superpowers/specs/2026-09-22-tich-hop-me-cung-web-auto-design.md`

## Global Constraints
- Tuân thủ quy tắc KHÔNG TDD theo `CLAUDE.md`: Không tạo test files, không viết test trước.
- Không sửa đổi logic của các chế độ Nông trại, Câu cá, Khai thác đá/gỗ.
- Tuân thủ quy tắc GitNexus (`gitnexus_impact` trước khi sửa symbol quan trọng, `gitnexus_detect_changes` trước khi commit).

---

### Task 1: Database Migration & Kiểu Dữ Liệu Backend

**Files:**
- Modify: `avatar-web/server/src/db/schema.sql:100-120`
- Modify: `avatar-web/server/src/db/index.ts:40-75`
- Modify: `avatar-web/server/src/session/automationTypes.ts:6-20`, `180-230`
- Modify: `avatar-web/server/src/accounts/automationRepo.ts:440-470`

**Interfaces:**
- Consumes: `avatar_automation_state`, `AutomationMode`
- Produces: `MazeConfig`, `DEFAULT_MAZE_CONFIG`, `StoredMazeConfigState`, `MazeStatus`, `MazeRuntimeState`, `idleMazeRuntime()`, migration `maze_config_json`

- [x] **Step 1: Cập nhật `schema.sql` và migration trong `index.ts`**
  - Thêm `'auto_maze'` vào `CHECK (desired_mode IN (...))` trong `schema.sql`.
  - Thêm cột `maze_config_json TEXT` trong `schema.sql`.
  - Trong `src/db/index.ts`, thêm `addColumn("ALTER TABLE avatar_automation_state ADD COLUMN maze_config_json TEXT")`.
  - Cập nhật khối migration nâng cấp bảng nếu chưa có `'auto_maze'`.

- [x] **Step 2: Khai báo types trong `automationTypes.ts`**
  - Bổ sung `'auto_maze'` vào kiểu `AutomationMode`.
  - Định nghĩa interface `MazeConfig`, hằng số `DEFAULT_MAZE_CONFIG`, `StoredMazeConfigState`.
  - Định nghĩa `MazeStatus`, `MazeRuntimeState`, và hàm khởi tạo `idleMazeRuntime()`.

- [x] **Step 3: Cập nhật `automationRepo.ts`**
  - Thêm `'auto_maze'` vào các câu query danh sách tài khoản cần bootstrap automation.
  - Cập nhật logic đọc/ghi `maze_config_json`.

- [x] **Step 4: Kiểm tra biên dịch**
  Run: `npm --prefix avatar-web/server run typecheck`
  Expected: Exit code 0.

---

### Task 2: Xây Dựng Bộ Điều Phối Mê Cung `AutoMazeRunner`

**Files:**
- Create: `avatar-web/server/src/maze/autoMaze.ts`

**Interfaces:**
- Consumes: `GameClient`, `findMazePath`, `MazeConfig`, `MazeRuntimeState`
- Produces: Class `AutoMazeRunner` với các phương thức `start(config)`, `stop()`, `updateConfig(config)`

- [x] **Step 1: Tạo cấu trúc class `AutoMazeRunner`**
  - Quản lý trạng thái nội bộ: `running`, `abortController`, `state: MazeRuntimeState`, `currentSpecials: Map<number, ChestObject>`.
  - Hỗ trợ callback `onStateChange` và `onRequestStop` (để tự động tắt mode sang `'off'`).

- [x] **Step 2: Triển khai luồng vào Mê Cung & xử lý khi đóng cửa**
  - Gửi `TX -1 [9]` (Park context) -> `TX 90 [28]` -> `TX 80 [28, area, 57, 209]`.
  - Bắt gói `RX -40`: Nếu chứa thông báo đóng cửa Mê cung -> cập nhật status `'stopped'`, ghi thông báo, gọi `onRequestStop('closed')`.

- [x] **Step 3: Triển khai thuật toán mở rương tuần tự**
  - Lọc rương trống `name === ""` từ snapshot `RX 80`.
  - Dùng `findMazePath` tìm đường né tường A* tới rương gần nhất.
  - Bước từng bước qua `TX 84` (delay 250ms giữa các bước).
  - Khi tiếp cận cự ly $\le 36\text{px}$, gửi `TX 48 [3, chestId, 0]`.
  - Lắng nghe phản hồi:
    - Nếu nhận được thông báo `"Bạn đã nhận đủ 30 hộp quà..."` -> cập nhật `dailyLimitReached = true`, status `'daily_limit_reached'`, gọi `onRequestStop('daily_limit')`.
    - Nếu nhận quà -> tăng `sessionChestsOpened`, ghi nhận log.

- [x] **Step 4: Triển khai cơ chế tự động chuyển khu**
  - Khi khu hiện tại hết rương trống (`name === ""`):
    - Nếu `autoSwitchArea = true` và `currentArea + 1 <= maxAreasToScan`:
      - Cập nhật status `'switching_area'`, chuyển sang khu tiếp theo `currentArea + 1`.
    - Nếu đã duyệt hết các khu:
      - Nếu `watchRespawn = true`: chuyển status `'waiting_respawn'`, lắng nghe `RX -38` / `RX 80`.
      - Nếu không: gọi `onRequestStop('depleted')`.

- [x] **Step 5: Kiểm tra biên dịch**
  Run: `npm --prefix avatar-web/server run typecheck`
  Expected: Exit code 0.

---

### Task 3: Tích Hợp Runner Vào Vòng Đời `AvatarSession` & REST API

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`
- Modify: `avatar-web/server/src/session/routes.ts`

**Interfaces:**
- Consumes: `AutoMazeRunner`, `MazeConfig`
- Produces: API endpoints cho Mê cung, snapshot WebSocket phát sóng `mazeRuntime`

- [x] **Step 1: Tích hợp `mazeRunner` vào `AvatarSession`**
  - Thêm trường `mazeRunner: AutoMazeRunner | null = null`.
  - Thêm trường `mazeRuntime: MazeRuntimeState = idleMazeRuntime()`.
  - Trong `setDesiredMode`: Khi chuyển sang `'auto_maze'`, khởi tạo và chạy `mazeRunner`. Khi rời `'auto_maze'`, gọi `stop()`.
  - Bổ sung `mazeRuntime` vào runtime snapshot gửi qua WebSocket.

- [x] **Step 2: Bổ sung API endpoints trong `routes.ts`**
  - Cập nhật `PUT /api/accounts/:id/automation/mode`: chấp nhận mode `'auto_maze'`.
  - Thêm `GET /api/accounts/:id/automation/maze/config`: trả về `StoredMazeConfigState`.
  - Thêm `PUT /api/accounts/:id/automation/maze/config`: xác thực và lưu `MazeConfig`.

- [x] **Step 3: Kiểm tra biên dịch & Build Server**
  Run: `npm --prefix avatar-web/server run typecheck && npm --prefix avatar-web/server run build`
  Expected: Exit code 0.

---

### Task 4: Xây Dựng Giao Diện Người Dùng Web (`MazePanel`)

**Files:**
- Modify: `avatar-web/web/src/types.ts`
- Modify: `avatar-web/web/src/accounts/AccountStatus.tsx`
- Modify: `avatar-web/web/src/accounts/panels/StatusPanel.tsx`
- Create: `avatar-web/web/src/accounts/panels/MazePanel.tsx`
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`

**Interfaces:**
- Consumes: `AutomationSnapshot.mazeRuntime`, `MazeConfig`
- Produces: Component `MazePanel`, Tab `🗝️ Mê cung`, nút chọn mode "🗝️ Mê cung"

- [x] **Step 1: Cập nhật các kiểu dữ liệu trong `web/src/types.ts`**
  - Thêm `'auto_maze'` vào `AutomationMode`.
  - Thêm `MazeConfig`, `StoredMazeConfigState`, `MazeStatus`, `MazeRuntimeState`.
  - Bổ sung `mazeRuntime?: MazeRuntimeState` vào `AutomationSnapshot`.

- [x] **Step 2: Cập nhật `AccountStatus.tsx` và `StatusPanel.tsx`**
  - Thêm nhãn `auto_maze: 'Mê cung'` trong `AccountStatus.tsx`.
  - Trong `StatusPanel.tsx`: Thêm nút mode `🗝️ Mê cung` trên thanh chọn mode.
  - Hiển thị banner trạng thái hoạt động của Mê cung khi đang ở mode `auto_maze`.

- [x] **Step 3: Tạo component `MazePanel.tsx`**
  - Hiển thị trạng thái kết nối thời gian thực: Khu vực, Trạng thái (Đang vào, Đang nhặt rương, Đang chuyển khu, Chạm giới hạn ngày 30 rương).
  - Bảng form cài đặt: Khu vực xuất phát (0..50), Tự động chuyển khu, Số khu tối đa, Chờ rương hồi sinh.
  - Nút Bật/Tắt chế độ Mê cung nhanh.

- [x] **Step 4: Gắn `MazePanel` vào `AccountOperationsDrawer.tsx`**
  - Bổ sung tab `['maze', '🗝️ Mê cung']` vào `PANEL_TABS` và `PANEL_GROUPS`.
  - Mount slot `<MazePanel>` trong drawer.

- [x] **Step 5: Kiểm tra biên dịch Web**
  Run: `npm --prefix avatar-web/web run build`
  Expected: Exit code 0.

---

### Task 5: Kiểm Thử Live & Tạo Commit

**Files:**
- Verify: Toàn bộ hệ thống backend & frontend

- [x] **Step 1: Khởi động server backend và frontend**
  Run: `cd avatar-web/server && npm run build`
  Run: `cd avatar-web/web && npm run build`

- [x] **Step 2: Kiểm thử gọi API**
  Kiểm tra lấy và cập nhật cấu hình Mê cung qua REST API bằng curl.
  Expected: HTTP 200 OK với cấu hình hợp lệ.

- [x] **Step 3: Kiểm tra Git diff & Tạo Commit**
  Run: `git status`
  Run: `git commit -m "feat(maze): integrate auto maze mode into web automation"`
