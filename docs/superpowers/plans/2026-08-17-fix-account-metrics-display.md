# Fix Account Metrics Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giải quyết triệt để lỗi hiển thị '—' của Xu, Lượng, Level trên AccountCard bằng cách giải mã số dư Xu từ phần đuôi gói kho (cmd 70) và đồng bộ metrics vào cache DB / runtime snapshot.

**Architecture:** Mở rộng `decodeInventory` trong `farmData.ts` để đọc số dư Xu từ 4 byte đầu của phần đuôi gói 70 (`i32 BE`). Cập nhật `GameClient` gán `this.money` và phát event `money` khi nhận gói 70. `AvatarSession` bắt event này để tự động cập nhật `cachedMetrics` vào SQLite và runtime `snapshot`. `AccountCard.tsx` hiển thị dữ liệu mượt mà từ snapshot và cache.

**Tech Stack:** TypeScript, Node.js (Buffer, EventEmitter), React, SQLite (better-sqlite3).

**Spec:** `docs/superpowers/specs/2026-08-17-fix-account-metrics-display-design.md`

## Global Constraints
- Tuân thủ quy trình Superpowers (Spec → Plan → Code).
- Không phá vỡ cấu trúc giải mã các section hiện tại của `decodeInventory` (seeds, items, produce).
- Đảm bảo tương thích ngược: nếu gói 70 không có đuôi hợp lệ, `xu` trả về `undefined` mà không gây lỗi throw.
- Toàn bộ test suite trong `server` và `web` phải pass.

---

### Task 1: Nâng cấp `decodeInventory` giải mã Xu từ phần đuôi gói cmd 70

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts:203-230`
- Modify: `avatar-web/server/src/game/farmData.test.ts`

**Interfaces:**
- Consumes: `MyReader`, `Buffer`
- Produces: `decodeInventory(body: Buffer): { seeds: InventoryItem[]; items: InventoryItem[]; other: InventoryItem[][]; xu?: number; restHex: string; }`

- [ ] **Step 1: Cập nhật hàm `decodeInventory` trong `farmData.ts`**
Thêm logic đọc 4 byte đầu của phần đuôi sau các section làm `xu` (`i32 BE`) nếu `available() >= 4` và giá trị >= 0.

- [ ] **Step 2: Viết test cho `decodeInventory` trong `farmData.test.ts`**
Kiểm thử giải mã gói 70 với 12 byte đuôi chứa số dư xu (`000737e6` = 473.574 xu).

- [ ] **Step 3: Verify**
Run: `cd avatar-web/server && npm test`
Expected: Test `decodeInventory` pass và tất cả các test hiện tại pass.

---

### Task 2: Cập nhật `GameClient` và `AvatarSession` ghi nhận Xu từ gói 70

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:477-512`
- Modify: `avatar-web/server/src/session/avatarSession.ts:390-410`
- Modify: `avatar-web/server/src/game/client.test.ts`
- Modify: `avatar-web/server/src/session/avatarSession.test.ts`

**Interfaces:**
- Consumes: `decodeInventory` từ `farmData.ts`
- Produces: `GameClient.money`, event `money`, `AvatarSession.snapshot().xu`, `updateCachedMetrics`

- [ ] **Step 1: Cập nhật `GameClient.onMessage` cho case 70**
Khi `inv.xu !== undefined`, gán `this.money = inv.xu` và `this.emit('money', { type: 1, balance: inv.xu, delta: 0 })`.

- [ ] **Step 2: Cập nhật `AvatarSession` wire handlers**
Đảm bảo khi `money` event được phát ra từ gói 70, `updateCachedMetrics` được kích hoạt và lưu vào DB.

- [ ] **Step 3: Viết test cho `GameClient` và `AvatarSession`**
Verify rằng khi nhận gói 70 có thông tin xu, client và session cập nhật đúng `money` và `cachedMetrics`.

- [ ] **Step 4: Verify**
Run: `cd avatar-web/server && npm test`
Expected: Server tests pass 100%.

---

### Task 3: Cập nhật Web UI & AccountCard Verification

**Files:**
- Modify: `avatar-web/web/src/accounts/AccountCard.tsx`
- Modify: `avatar-web/web/src/accounts/AccountCard.test.tsx`

**Interfaces:**
- Consumes: `AccountWithRuntime`
- Produces: UI component hiển thị Xu, Lượng, Level

- [ ] **Step 1: Kiểm tra và tối ưu hiển thị trên `AccountCard.tsx`**
Đảm bảo thứ tự ưu tiên `runtime?.xu ?? runtime?.money ?? cached?.xu` và fallback level chuẩn xác.

- [ ] **Step 2: Verify Web tests**
Run: `cd avatar-web/web && npm test`
Expected: Web tests pass 100%.

---

### Task 4: Chạy toàn bộ Test Suite và Kiểm tra Tổng thể

- [ ] **Step 1: Chạy toàn bộ server test và web test**
Run: `cd avatar-web/server && npm test && cd ../web && npm test`
Expected: Tất cả các test đều pass không có lỗi.
