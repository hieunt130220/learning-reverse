# Khắc phục lỗi không tự cập nhật trạng thái nút Bật/Tắt Auto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đồng bộ hoá sự kiện `desired-connected` qua WebSocket giữa server và client để nút Bật auto/Tắt auto và trạng thái hiển thị tự động cập nhật ngay lập tức khi người dùng thao tác.

**Architecture:** Bổ sung phát sự kiện `desired-connected` khi `wanted` thay đổi trong `AvatarSession`, và xử lý sự kiện này trong `reduceAccountRuntime` và `AccountsProvider` ở web client.

**Tech Stack:** TypeScript, React, WebSocket, Node.js

**Spec:** `docs/superpowers/specs/2026-08-18-fix-auto-toggle-button-state-sync-design.md`

## Global Constraints
- Tuân thủ quy tắc Không TDD theo AGENTS.md.
- Đảm bảo tất cả test cases hiện có của server và web đều tiếp tục pass 100%.

---

### Task 1: Server - Phát sự kiện `desired-connected` trong `AvatarSession`

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:110-140, 200-220, 620-640`

**Interfaces:**
- Produces: WebSocket event `desired-connected` (payload: `boolean`).

- [x] **Step 1: Thêm `setWanted` và cập nhật `start`, `stop`, `failPermanently` trong `avatarSession.ts`**
```ts
  private setWanted(wanted: boolean): void {
    if (this.wanted === wanted) return;
    this.wanted = wanted;
    this.emit('desired-connected', wanted);
  }
```
Gọi `this.setWanted(true)` trong `start()` và `this.setWanted(false)` trong `stop()`, `failPermanently()`.

- [x] **Step 2: Chạy test server `avatarSession.test.ts`**
Run: `npm test` trong thư mục `avatar-web/server`
Expected: PASS

- [x] **Step 3: Commit**
`git commit -m "fix(server): emit desired-connected event when session wanted state changes"`

---

### Task 2: Client - Xử lý sự kiện `desired-connected` trong `accountRuntime` & `AccountsProvider`

**Files:**
- Modify: `avatar-web/web/src/accounts/accountRuntime.ts:18-35`
- Modify: `avatar-web/web/src/accounts/AccountsProvider.tsx:50-70`

**Interfaces:**
- Consumes: WebSocket event `desired-connected` (payload: `boolean`).

- [x] **Step 1: Thêm `case 'desired-connected'` vào `reduceAccountRuntime` trong `accountRuntime.ts`**
```ts
    case 'desired-connected':
      return { ...current, desiredConnected: Boolean(message.payload) };
```

- [x] **Step 2: Cập nhật `AccountsProvider.tsx` để lắng nghe và cập nhật `desired-connected`**
Thêm `message.type !== 'desired-connected'` vào điều kiện lọc và gộp vào `runtime.desiredConnected`.

- [x] **Step 3: Chạy test web `npm test`**
Run: `npm test` trong thư mục `avatar-web/web`
Expected: PASS

- [x] **Step 4: Commit**
`git commit -m "fix(web): handle desired-connected event in runtime reducer and accounts provider"`

---

### Task 3: Build & Kiểm thử Toàn diện

**Files:**
- Modify: Không có

- [x] **Step 1: Build server và web**
Run: `npm run build` ở cả `avatar-web/server` và `avatar-web/web`
Expected: Build thành công không có lỗi type hoặc compile.

- [x] **Step 2: Commit và tổng kết**
`git status` sạch sẽ và sẵn sàng.
