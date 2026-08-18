# Hỗ trợ Lượng Mở & Lượng Khóa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa triệt để bộ giải mã gói `UPDATE_MONEY` (cmd -3), lưu trữ và hiển thị cả 2 loại **Lượng mở** (có thể giao dịch) và **Lượng khóa** trên Web UI.

**Architecture:** 
- Nâng cấp `decodeMoney` trong `farmData.ts` để đọc đầy đủ cả 5 trường (`delta`, `type`, `xu`, `luong`, `luongKhoa`).
- Bổ sung trường `cached_luong_khoa` vào DB SQLite (`avatar_accounts`) và `repo.ts`.
- Cập nhật `GameClient`, `AvatarSession` và `AccountCard.tsx` trên Web UI để hiển thị trực quan cả lượng mở và lượng khóa.

**Tech Stack:** TypeScript, SQLite, React, Vite.

**Spec:** `docs/superpowers/specs/2026-08-18-fix-luong-mo-khoa-metrics-design.md`

## Global Constraints
- Tuân thủ quy định GitNexus (`gitnexus_impact` trước khi sửa, `gitnexus_detect_changes` trước khi commit).
- Đảm bảo tương thích ngược và fallback an toàn khi gói tin từ server có độ dài khác nhau.

---

### Task 1: Cập nhật `decodeMoney` trong `server/src/game/farmData.ts`

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts:625-645`

**Interfaces:**
- Consumes: `MyReader`
- Produces: `MoneyUpdate` với `{ delta, type, xu, luong, luongKhoa, balance }`

- [ ] **Step 1: Viết lại `decodeMoney`**
Cập nhật `decodeMoney` đọc đủ: `delta` (`i32`), `type` (`i8`), `xu` (`i32`), `luong` (`i32`), `luongKhoa` (`i32`).

- [ ] **Step 2: Test và verify unit test**
Chạy test `npm --prefix avatar-web/server test`.

---

### Task 2: Cập nhật Database & Repo cho `cached_luong_khoa`

**Files:**
- Modify: `avatar-web/server/src/db/schema.sql`
- Modify: `avatar-web/server/src/db/index.ts`
- Modify: `avatar-web/server/src/accounts/repo.ts`

**Interfaces:**
- Consumes: Cột `cached_luong_khoa INTEGER`
- Produces: `CachedAccountMetrics.luongKhoa`

- [ ] **Step 1: Thêm migration cột `cached_luong_khoa`**
Thêm `cached_luong_khoa` vào `schema.sql`, `db/index.ts`, `AccountRow`, `CachedAccountMetrics`, `updateCachedMetrics`, `toAccount`.

- [ ] **Step 2: Cập nhật repo tests**
Chạy `npm --prefix avatar-web/server test`.

---

### Task 3: Cập nhật `GameClient` và `AvatarSession`

**Files:**
- Modify: `avatar-web/server/src/game/client.ts`
- Modify: `avatar-web/server/src/session/avatarSession.ts`

**Interfaces:**
- Consumes: `MoneyUpdate` từ `decodeMoney`
- Produces: Gán `client.luong`, `client.luongKhoa`, phát event `money` và `metrics` lưu vào DB

- [ ] **Step 1: Xử lý gói -3 trong `GameClient` & `AvatarSession`**
- [ ] **Step 2: Chạy server unit tests**

---

### Task 4: Cập nhật Web UI hiển thị Lượng mở và Lượng khóa

**Files:**
- Modify: `avatar-web/web/src/types.ts`
- Modify: `avatar-web/web/src/accounts/AccountCard.tsx`

**Interfaces:**
- Consumes: `luong`, `luongKhoa`
- Produces: Hiển thị trên thẻ tài khoản: `10 (+5 khóa)` hoặc `10` nếu không có lượng khóa

- [ ] **Step 1: Cập nhật `types.ts` và `AccountCard.tsx`**
- [ ] **Step 2: Build web và server**
Chạy `npm --prefix avatar-web/web run build && npm --prefix avatar-web/server run build`.
