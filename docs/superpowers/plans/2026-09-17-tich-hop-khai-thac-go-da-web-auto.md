# Kế Hoạch Thực Thi — Tích Hợp Chức Năng Khai Thác Gỗ / Đá Vào Web Auto (AvatarHD 3.4.4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp tính năng tự động khai thác Kim Cương (Room 26) và Củi Khô (Room 22) vào hệ thống Web Auto với đầy đủ backend runner, REST API, WebSocket realtime và giao diện điều khiển `MiningPanel`.

**Architecture:** Bổ sung mode `'auto_mining'` vào `AutomationMode`, lưu cấu hình `MiningConfig` trong SQLite DB (`mining_config_json`), triển khai `AutoMiningRunner` quản lý chuỗi gửi `TX 48 [3, objectId, menuIndex]` và xử lý `RX -40`, tích hợp vào `AvatarSession`, expose qua REST API và WebSocket, xây dựng giao diện tab `MiningPanel.tsx` trong console drawer.

**Tech Stack:** Node.js, Express, TypeScript ESM, SQLite (better-sqlite3), WebSocket, React 18, TailwindCSS.

**Spec:** `docs/superpowers/specs/2026-09-17-tich-hop-khai-thac-go-da-web-auto-design.md`

## Global Constraints
- **KHÔNG TDD, không tạo test files** (tuân thủ nguyên tắc bắt buộc trong `CLAUDE.md`).
- **Safety Guards:**
  - Whitelist TX: `-1, 80, 48` (+ `-94` ping).
  - Cooldown giữa các lượt đào tối thiểu 2500ms + Jitter ngẫu nhiên 0..500ms.
  - Khi mỏ cạn hoặc chuyển khu, cooldown giữa các lần `TX 80` ≥ 2000ms.
  - Tự động dừng an toàn khi thiếu công cụ hoặc hết năng lượng, quay về Map 17 an toàn trước khi tắt.
- Không commit git trong phiên làm việc.

---

### Task 1: Data Contracts, Database Repository & WebSocket Types

**Files:**
- Modify: `avatar-web/server/src/session/automationTypes.ts`
- Modify: `avatar-web/server/src/accounts/automationRepo.ts`
- Modify: `avatar-web/server/src/ws.ts`
- Modify: `avatar-web/web/src/types.ts`

**Interfaces:**
- Consumes: Existing `AutomationMode`, `Db`
- Produces: `MiningTarget`, `MiningConfig`, `DEFAULT_MINING_CONFIG`, `MiningStatus`, `MiningRuntimeState`, `idleMiningRuntime()`, `saveMiningConfig()`, `readMiningConfig()`.

- [x] **Step 1: Cập nhật `automationTypes.ts`**
  - Mở rộng `AutomationMode`: thêm `'auto_mining'`.
  - Khai báo types: `MiningTarget`, `MiningConfig`, `DEFAULT_MINING_CONFIG`.
  - Khai báo types: `MiningStatus`, `MiningRuntimeState`, hàm `idleMiningRuntime()`.
  - Thêm `mining` và `miningConfig` vào `AutomationSnapshot`.

- [x] **Step 2: Cập nhật `automationRepo.ts`**
  - Tự động tạo cột `mining_config_json TEXT DEFAULT NULL` trong bảng `automations` nếu chưa tồn tại.
  - Viết hàm `normalizeMiningConfig(input: unknown): MiningConfig`.
  - Viết hàm `saveMiningConfig(db: Db, accountId: number, config: MiningConfig): void`.
  - Viết hàm `readMiningConfig(db: Db, accountId: number): StoredMiningConfigState`.

- [x] **Step 3: Cập nhật `ws.ts` và `web/src/types.ts`**
  - Thêm `'mining_state_updated'` vào danh sách event type của `ws.ts`.
  - Bổ sung các định nghĩa `MiningTarget`, `MiningConfig`, `MiningRuntimeState`, `AutomationSnapshot` trong `web/src/types.ts`.

- [x] **Step 4: Kiểm tra Typecheck**
  Run: `cd avatar-web/server && npm run typecheck`
  Run: `cd avatar-web/web && npm run build`
  Expected: Cả hai đều biên dịch thành công 0 lỗi.

---

### Task 2: Xây Dựng Core Mining Runner (`AutoMiningRunner`)

**Files:**
- Create: `avatar-web/server/src/mining/autoMining.ts`

**Interfaces:**
- Consumes: `GameClient`, `MiningConfig`, `MiningRuntimeState`, `Message`, `MyReader`
- Produces: Lớp `AutoMiningRunner` với các phương thức `start()`, `stop()`, `getRuntimeState()`.

- [x] **Step 1: Khởi tạo module `autoMining.ts` và lớp `AutoMiningRunner`**
  - Quản lý trạng thái nội bộ `MiningRuntimeState`.
  - Xử lý điều hướng ban đầu: Chuyển handler 9 (`TX -1 [9]`), chọn map mục tiêu theo cấu hình (Room 26 cho `diamond`, Room 22 cho `wood`).
  - Gửi `TX 80` với tọa độ chuẩn:
    - Room 26: `(250, 45)`
    - Room 22: `(100, 100)`

- [x] **Step 2: Tích hợp logic quét đối tượng khai thác và gửi lệnh `TX 48`**
  - Bắt gói `RX 80`, lọc các đối tượng `ItemMapSpecial` loại `type = 2` có menu `[1207, 1220]`.
  - Chọn đối tượng mục tiêu:
    - Gửi `TX 48 [i8 3, i32 objectId, i8 0]`.
    - Lắng nghe `RX -40`:
      - Trích xuất tên đối tượng và sản lượng (`X/Y`).
      - Cập nhật `remainingCapacity = X`, `maxCapacity = Y`.
      - Nếu $X = 0$: đánh dấu đối tượng cạn, chuyển sang đối tượng tiếp theo.
      - Nếu gặp thông báo lỗi:
        - `"cuốc"` / `"rìu"` / `"hỏng"` $\rightarrow$ chuyển sang `paused_no_tool`, dừng loop.
        - `"sức khỏe"` / `"năng lượng"` / `"nghỉ ngơi"` $\rightarrow$ chuyển sang `paused_low_energy`, dừng loop.
  - Lắng nghe `RX 70`: ghi nhận cập nhật kho đồ.
  - Thêm jitter ngẫu nhiên `delayBetweenActionsMs + (0..500ms)`.

- [x] **Step 3: Xử lý chuyển khu (Area Hopping) và dừng an toàn**
  - Khi tất cả mỏ trong khu hiện tại cạn:
    - Nếu `switchAreaWhenDepleted = true`: Tự động tăng `area = (area + 1) % maxAreasToScan` (với Room 22 bỏ qua khu 0).
    - Gửi `TX 80`, nghỉ 2000ms rồi tiếp tục quét.
  - Khi dừng (`stop()`): Gửi `TX 80 [17, 0, 100, 100]` đưa nhân vật về Map 17 an toàn trước khi kết thúc.

- [x] **Step 4: Kiểm tra Typecheck**
  Run: `cd avatar-web/server && npm run typecheck`
  Expected: Pass.

---

### Task 3: Tích Hợp Runner vào `AvatarSession` & REST API

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`
- Modify: `avatar-web/server/src/session/routes.ts`

**Interfaces:**
- Consumes: `AutoMiningRunner`, `MiningConfig`, `saveMiningConfig`
- Produces: API endpoints điều khiển và cấu hình khai thác.

- [x] **Step 1: Tích hợp `AutoMiningRunner` vào `AvatarSession`**
  - Khởi tạo instance `AutoMiningRunner` trong `AvatarSession`.
  - Trong `applyAutomationMode`: Khi mode là `'auto_mining'`, kích hoạt `miningRunner.start(config)`.
  - Khi chuyển sang mode khác hoặc disconnect: Gọi `miningRunner.stop()`.
  - Đăng ký sự kiện cập nhật trạng thái từ runner để broadcast qua WebSocket `mining_state_updated`.
  - Cập nhật `getAutomationSnapshot` trả về thông tin mining.

- [x] **Step 2: Mở rộng REST API routes trong `session/routes.ts`**
  - Cập nhật `POST /automation/mode`: Chấp nhận `'auto_mining'`.
  - Thêm endpoint `GET /automation/mining/config`: Trả về `MiningConfig`.
  - Thêm endpoint `PUT /automation/mining/config`: Validate và lưu `MiningConfig` mới vào DB, đồng thời cập nhật runtime nếu đang chạy.

- [x] **Step 3: Kiểm tra Typecheck**
  Run: `cd avatar-web/server && npm run typecheck`
  Expected: Pass 0 lỗi.

---

### Task 4: Xây Dựng Giao Diện Điều Khiển (`MiningPanel.tsx`)

**Files:**
- Create: `avatar-web/web/src/accounts/panels/MiningPanel.tsx`
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`

**Interfaces:**
- Consumes: `AccountWithRuntime`, `apiGet`, `apiPut`, `apiPost`
- Produces: React Component `MiningPanel` hiển thị trong drawer console.

- [x] **Step 1: Viết Component `MiningPanel.tsx`**
  - **Header Switch:** Bật/Tắt chế độ Auto Khai Thác.
  - **Status Card:**
    - Huy hiệu màu theo trạng thái (`Đang đào`, `Đang chuyển khu`, `Thiếu cuốc`, `Hết sức`, `Đã dừng`).
    - Vị trí: Map & Khu hiện tại.
    - Thanh Progress Bar: Tỷ lệ trữ lượng mỏ còn lại (`X / Y` đơn vị).
    - Bộ đếm lượt khai thác thành công trong phiên.
    - Textbox hiển thị thông điệp cuối cùng nhận được từ game.
  - **Cài Đặt:**
    - Lựa chọn mục tiêu: Radio buttons `💎 Kim Cương Trắng (Room 26)`, `🪵 Củi Khô (Room 22)`, `🔄 Tuần Tra Cả Hai`.
    - Checkbox: `Tự động chuyển khu khi mỏ cạn`.
    - Dropdown: `Khu vực bắt đầu (0..9)`.
    - Nút "Lưu Cài Đặt".

- [x] **Step 2: Đăng ký Tab `MiningPanel` vào `AccountOperationsDrawer.tsx`**
  - Thêm `['mining', '⛏️ Khai thác']` vào `PANEL_TABS`.
  - Thêm `mining` vào nhóm `PANEL_GROUPS` (nhóm `operations` hoặc `assets`).
  - Render `<MiningPanel />` khi tab `mining` được chọn.

- [x] **Step 3: Kiểm tra Build Frontend**
  Run: `cd avatar-web/web && npm run build`
  Expected: Build thành công không có cảnh báo hoặc lỗi.

---

### Task 5: Kiểm Tra Hoạt Động Toàn Diện (End-to-End Verification)

**Files:**
- Test & Verify: Toàn bộ hệ thống backend và frontend.

- [x] **Step 1: Khởi động Avatar Web Server và kiểm tra REST API qua curl**
  - Test lấy cấu hình: `GET /api/accounts/3/session/automation`
  - Test cập nhật cấu hình: `PUT /api/accounts/3/session/automation/mining/config`
  - Test kích hoạt mode: `POST /api/accounts/3/session/automation/start` với `mode: "auto_mining"`

- [x] **Step 2: Kiểm tra live bot tự động khai thác**
  - Xác nhận bot tự động join Room 26 khu 0.
  - Xác nhận bot gửi `TX 48` và nhận `RX -40`.
  - Xác nhận sự kiện `mining_state_updated` cập nhật realtime lên giao diện web.
  - Tắt auto và xác nhận bot quay về Map 17 an toàn.
