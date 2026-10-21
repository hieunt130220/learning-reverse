# Fishing Financial Statistics and Sell Fish Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thống kê chi phí mua mồi, vé, cần và doanh thu bán cá lưu tích luỹ trong SQLite, hiển thị thẻ tài chính trực quan với lợi nhuận ròng và cung cấp nút bán toàn bộ cá chủ động trên tab Câu Cá.

**Architecture:** Mở rộng SQLite lưu bảng `avatar_fishing_financial_statistics` quản lý qua `FishingFinancialStatisticsRepository`. Hook trực tiếp vào các điểm mua vật phẩm (vé, mồi, cần) và bán cá (`banca`) của `AvatarSession` để tích lũy Xu, nhúng số liệu vào `AutomationSnapshot` đồng bộ WebSocket thời gian thực lên client. Bổ sung endpoint `POST /:id/fishing/sell` và `POST /:id/fishing/finance/reset` cùng giao diện `FishingPanel.tsx` (Phương án A).

**Tech Stack:** TypeScript, Node.js (Express, better-sqlite3), React 18, CSS Custom Properties.

**Spec:** `docs/superpowers/specs/2026-10-21-fishing-financial-stats-and-sell-fish-button-design.md`

## Global Constraints
- Tuân thủ quy tắc KHÔNG TDD: không viết test trước, tập trung trực tiếp vào production code chuẩn xác.
- Tuân thủ quy tắc GitNexus: chạy impact trước khi sửa và detect-changes trước khi commit.
- Mọi giá trị tiền tệ Xu phải dùng Safe Integer (`Number.isSafeInteger`) và không âm (`>= 0`).
- Không làm gián đoạn vòng lặp câu cá tự động nếu đang chạy; khi bán cá chủ động phải thu cần an toàn nếu đang quăng/cắn câu.

---

### Task 1: Schema & Data Contracts

**Files:**
- Modify: `avatar-web/server/src/db/schema.sql`
- Modify: `avatar-web/server/src/session/automationTypes.ts`
- Modify: `avatar-web/web/src/types.ts`

**Interfaces:**
- Consumes: `AutomationSnapshot` hiện có
- Produces: `FishingFinancialStatistics`, `FISHING_TICKET_PRICES_XU`, `FISHING_ROD_PRICES_XU`, `FISHING_BAIT_PRICES_XU`

- [ ] **Step 1: Thêm bảng `avatar_fishing_financial_statistics` vào `schema.sql`**
  Thêm DDL:
  ```sql
  CREATE TABLE IF NOT EXISTS avatar_fishing_financial_statistics (
    account_id INTEGER PRIMARY KEY REFERENCES avatar_accounts(id) ON DELETE CASCADE,
    spent_bait_xu INTEGER NOT NULL DEFAULT 0 CHECK (spent_bait_xu >= 0),
    spent_ticket_xu INTEGER NOT NULL DEFAULT 0 CHECK (spent_ticket_xu >= 0),
    spent_rod_xu INTEGER NOT NULL DEFAULT 0 CHECK (spent_rod_xu >= 0),
    earned_fish_xu INTEGER NOT NULL DEFAULT 0 CHECK (earned_fish_xu >= 0),
    updated_at INTEGER NOT NULL
  );
  ```

- [ ] **Step 2: Khai báo interface và bảng giá trong `automationTypes.ts`**
  Định nghĩa:
  ```ts
  export interface FishingFinancialStatistics {
    spentBaitXu: number;
    spentTicketXu: number;
    spentRodXu: number;
    earnedFishXu: number;
    netProfitXu: number;
    updatedAt: number | null;
  }
  ```
  Và thêm trường `fishingFinancialStatistics?: FishingFinancialStatistics;` vào `AutomationSnapshot`.
  Thêm catalog giá vật phẩm:
  ```ts
  export const FISHING_TICKET_PRICES_XU: Record<number, number> = {
    14: 1000,
    15: 10000,
    27: 12000,
  };
  export const FISHING_ROD_PRICES_XU: Record<number, number> = {
    442: 10000,
    4874: 20000,
  };
  export const FISHING_BAIT_PRICES_XU: Record<number, number> = {
    443: 5,
    447: 20,
    448: 30,
    4875: 50,
  };
  ```

- [ ] **Step 3: Cập nhật `FishingFinancialStatistics` trong `avatar-web/web/src/types.ts`**
  Bổ sung `FishingFinancialStatistics` và cập nhật interface `AutomationSnapshot` phía client tương ứng.

- [ ] **Step 4: Kiểm tra build type**
  Run: `npm --prefix avatar-web/server run build && npm --prefix avatar-web/web run build`
  Expected: Build thành công không có lỗi type.

- [ ] **Step 5: Commit**
  `git commit -m "feat(fishing): add financial statistics schema and contracts"`

---

### Task 2: Repository Quản Lý Dữ Liệu Tài Chính Câu Cá

**Files:**
- Create: `avatar-web/server/src/accounts/fishingFinancialStatisticsRepo.ts`

**Interfaces:**
- Consumes: `Db` từ `../db/index.js`, `FishingFinancialStatistics` từ `../session/automationTypes.js`
- Produces: `FishingFinancialStatisticsRepository` với các hàm `read(accountId)`, `recordExpense(accountId, type, amountXu)`, `recordRevenue(accountId, amountXu)`, `reset(accountId)`

- [ ] **Step 1: Tạo `fishingFinancialStatisticsRepo.ts`**
  Triển khai class `FishingFinancialStatisticsRepository`:
  - `read(accountId: number): FishingFinancialStatistics`: Đọc hàng từ bảng `avatar_fishing_financial_statistics`. Nếu chưa có, trả về 0 cho tất cả các trường. Tính `netProfitXu = earnedFishXu - (spentBaitXu + spentTicketXu + spentRodXu)`.
  - `recordExpense(accountId: number, type: 'bait' | 'ticket' | 'rod', amountXu: number): FishingFinancialStatistics`: Sử dụng `INSERT INTO ... ON CONFLICT(account_id) DO UPDATE SET spent_[type]_xu = spent_[type]_xu + excluded.spent_[type]_xu, updated_at = excluded.updated_at`.
  - `recordRevenue(accountId: number, amountXu: number): FishingFinancialStatistics`: `DO UPDATE SET earned_fish_xu = earned_fish_xu + excluded.earned_fish_xu`.
  - `reset(accountId: number): FishingFinancialStatistics`: Xóa hoặc update tất cả về 0 cho account.

- [ ] **Step 2: Kiểm tra biên dịch**
  Run: `npm --prefix avatar-web/server run build`
  Expected: Build thành công.

- [ ] **Step 3: Commit**
  `git commit -m "feat(fishing): implement FishingFinancialStatisticsRepository"`

---

### Task 3: Backend Runtime & Session Tracking

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts`
- Modify: `avatar-web/server/src/session/sessionManager.ts` (hoặc nơi khởi tạo AvatarSession)

**Interfaces:**
- Consumes: `FishingFinancialStatisticsRepository` từ `../accounts/fishingFinancialStatisticsRepo.js`
- Produces: Tự động ghi chi phí khi mua mồi/vé/cần, ghi doanh thu khi bán cá; hàm `sellAllFish(signal)` trên `AvatarSession`.

- [ ] **Step 1: Truyền `fishingFinancialStatisticsRepo` vào `AvatarSession`**
  Cập nhật constructor và dependency injection của `AvatarSession` để nhận instance `FishingFinancialStatisticsRepository`.

- [ ] **Step 2: Ghi nhận chi phí khi bot mua vật phẩm trong `avatarSession.ts`**
  - Tại đoạn mua vé thành công (quanh dòng 3230): Nếu `ticket.typeMoney === 1`, tính `cost = FISHING_TICKET_PRICES_XU[cfg.map] ?? 0`, gọi `this.financeRepo.recordExpense(this.accountId, 'ticket', cost)`.
  - Tại đoạn mua cần câu thành công (quanh dòng 3315): Nếu `rod.typeMoney === 1`, tính `cost = FISHING_ROD_PRICES_XU[cfg.rodType] ?? 0`, gọi `this.financeRepo.recordExpense(this.accountId, 'rod', cost)`.
  - Tại đoạn mua mồi thành công (quanh dòng 3400): Nếu `bait.typeMoney === 1`, tính `unitCost = FISHING_BAIT_PRICES_XU[cfg.baitType] ?? 0`, `totalCost = unitCost * quantity`, gọi `this.financeRepo.recordExpense(this.accountId, 'bait', totalCost)`.
  - Sau mỗi thao tác, gọi `this.emitAutomation()` để đẩy snapshot mới lên UI.

- [ ] **Step 3: Ghi nhận doanh thu khi bán cá trong `executeSellFish`**
  Trong `executeSellFish`:
  - Khi hoàn tất bán cá và `totalXuEarned > 0`, gọi `this.financeRepo.recordRevenue(this.accountId, totalXuEarned)`.
  - Gọi `this.emitAutomation()`.

- [ ] **Step 4: Triển khai phương thức `sellAllFish(signal?: AbortSignal)` trên `AvatarSession`**
  Phương thức public cho phép gọi từ API:
  - Kiểm tra trạng thái kết nối `client.status === 'online'`.
  - Nếu đang quăng cần hoặc cắn câu (`casting` hoặc `hooked`), gọi `client.cauCaXong()`.
  - Nếu nhân vật đang không ở map công viên/hồ (13, 14, 15, 16, 27), tự động chuyển vào Khu sinh thái Map 13.
  - Chạy vòng lặp bán cá `chatPark('banca')` (tối đa 40 lượt).
  - Trả về `{ ok: true, soldCount, earnedXu }`.

- [ ] **Step 5: Đưa `fishingFinancialStatistics` vào `getAutomationSnapshot()`**
  Đọc số liệu từ `financeRepo.read(this.accountId)` và gán vào snapshot trả về.

- [ ] **Step 6: Kiểm tra biên dịch**
  Run: `npm --prefix avatar-web/server run build`
  Expected: Build thành công không có lỗi type.

- [ ] **Step 7: Commit**
  `git commit -m "feat(session): track fishing expenses, revenues and add sellAllFish action"`

---

### Task 4: API Endpoints Bán Cá & Reset Thống Kê

**Files:**
- Modify: `avatar-web/server/src/session/routes.ts`
- Modify: `avatar-web/server/src/index.ts`

**Interfaces:**
- Consumes: `sessions.get(id)`, `financeRepo`
- Produces: `POST /api/accounts/:id/fishing/sell` và `POST /api/accounts/:id/fishing/finance/reset`

- [ ] **Step 1: Khởi tạo và truyền repo vào `sessionRouter`**
  Trong `index.ts`, khởi tạo `fishingFinancialStatisticsRepo = new FishingFinancialStatisticsRepository(db)` và truyền vào `sessionRouter` cùng `sessionManager`.

- [ ] **Step 2: Thêm route `POST /:id/fishing/sell` trong `sessionRouter`**
  Xử lý:
  - Xác thực tài khoản thuộc sở hữu user (`owned`).
  - Lấy session: `const session = sessions.get(accountId)`.
  - Nếu không có session hoặc `!session.isOnline()`: trả về 400 `{ error: 'Tài khoản cần kết nối game để bán cá' }`.
  - Gọi `await session.sellAllFish()`.
  - Trả về 200 `{ ok: true, soldCount, earnedXu, message: ... }`.

- [ ] **Step 3: Thêm route `POST /:id/fishing/finance/reset` trong `sessionRouter`**
  Xử lý:
  - Reset trong repo: `const stats = financeRepo.reset(accountId)`.
  - Cập nhật session snapshot nếu đang có session: `session?.emitAutomation()`.
  - Trả về 200 `{ ok: true, statistics: stats }`.

- [ ] **Step 4: Kiểm tra biên dịch**
  Run: `npm --prefix avatar-web/server run build`
  Expected: Build thành công.

- [ ] **Step 5: Commit**
  `git commit -m "feat(api): add fishing sell and finance reset endpoints"`

---

### Task 5: Giao Diện FishingPanel (Phương Án A) & Styling

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/FishingPanel.tsx`
- Modify: `avatar-web/web/src/styles/components.css`

**Interfaces:**
- Consumes: `automation?.fishingFinancialStatistics`, `apiPost` từ `../../api.js`
- Produces: Thẻ Tài chính câu cá (4 ô chi phí/doanh thu, lợi nhuận ròng, nút bán tất cả cá, nút reset)

- [ ] **Step 1: Thêm CSS cho thẻ tài chính và badge lợi nhuận trong `components.css`**
  Bổ sung các class:
  - `.fishing-finance-card`
  - `.fishing-finance-grid`
  - `.fishing-metric-cost` (đỏ/cam nhạt)
  - `.fishing-metric-earn` (xanh lá)
  - `.fishing-profit-banner` (lợi nhuận ròng)
  - `.fishing-sell-btn` (nút bán cá)

- [ ] **Step 2: Cập nhật component `FishingPanel.tsx`**
  - Đọc `financialStats = automation?.fishingFinancialStatistics`.
  - Quản lý state `sellingFish`, `sellResult`, `resetting`.
  - Thêm handler `handleSellFish()` gọi `POST /api/accounts/${accountId}/fishing/sell`. Hiển thị thông báo kết quả hoặc lỗi.
  - Thêm handler `handleResetFinance()` gọi `POST /api/accounts/${accountId}/fishing/finance/reset` với `window.confirm`.
  - Render thẻ "Thống Kê Tài Chính Câu Cá (Tích Luỹ)" với 4 ô:
    1. Tiền mua mồi: `-X xu`
    2. Tiền mua vé: `-Y xu`
    3. Tiền mua cần: `-Z xu`
    4. Tiền bán cá: `+W xu`
  - Render thanh "Lợi nhuận ròng (Lãi / Lỗ)": `netProfitXu >= 0 ? '+...' : '...'` kèm class màu sắc tương ứng.
  - Render nút "🐟 Bán tất cả cá ngay" và "↺ Đặt lại" trên header của card.

- [ ] **Step 3: Kiểm tra biên dịch web**
  Run: `npm --prefix avatar-web/web run build`
  Expected: Build thành công không có lỗi type/JSX.

- [ ] **Step 4: Commit**
  `git commit -m "feat(web): add fishing financial stats card and sell fish button"`

---

### Task 6: Kiểm Thử Toàn Diện & Verification

**Files:**
- Toàn bộ các file đã sửa/tạo

- [ ] **Step 1: Chạy build toàn bộ dự án**
  Run: `npm --prefix avatar-web/server run build && npm --prefix avatar-web/web run build`
  Expected: Cả 2 module server và web build clean 100%.

- [ ] **Step 2: Chạy GitNexus analyze & detect-changes**
  Run: `node .gitnexus/run.cjs detect-changes --scope all --repo .`
  Expected: Graph sạch sẽ, các symbol được index đầy đủ.

- [ ] **Step 3: Dọn dẹp tài nguyên và báo cáo hoàn thành**
