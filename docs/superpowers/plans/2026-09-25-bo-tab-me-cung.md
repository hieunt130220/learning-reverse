# Kế Hoạch Thực Hiện: Bỏ Tab Mê Cung Khỏi Giao Diện Web Drawer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bỏ tab Mê cung khỏi Drawer console trên Web và xóa bỏ component `MazePanel.tsx` không còn sử dụng.

**Architecture:** Cập nhật `AccountOperationsDrawer.tsx` loại bỏ cấu hình tab, group và slot render của `maze`. Xóa file `MazePanel.tsx`. Cập nhật test suite đảm bảo toàn bộ tests pass 100%.

**Tech Stack:** React, TypeScript, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-25-bo-tab-me-cung-design.md`

## Global Constraints
- Không dùng TDD (không test-first, viết code trước, cập nhật test sau).
- Giữ nguyên mode `auto_maze` và hiển thị trạng thái trên `StatusPanel.tsx`.
- Chạy `gitnexus_impact` trước khi sửa code và `gitnexus_detect_changes` trước khi commit.

---

### Task 1: Cập Nhật `AccountOperationsDrawer.tsx` & Xóa `MazePanel.tsx`

**Files:**
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`
- Delete: `avatar-web/web/src/accounts/panels/MazePanel.tsx`

**Interfaces:**
- Consumes: None
- Produces: Thanh menu Drawer gọn gàng với 6 nhóm chức năng (1..6).

- [x] **Step 1: Cập nhật `AccountOperationsDrawer.tsx`**
  - Xóa `import { MazePanel } from './panels/MazePanel.js';`.
  - Xóa `['maze', '🗝️ Mê cung'],` trong `PANEL_TABS`.
  - Xóa `{ id: 'maze', label: '🗝️ Mê cung', panels: ['maze'] },` trong `PANEL_GROUPS`.
  - Xóa `{ id: 'maze', label: '🗝️ Mê cung', icon: '🗝️', hotkey: '4' },` trong `DESKTOP_CONSOLE_GROUPS` và đánh số lại hotkey 1..6:
    - 1: operations
    - 2: farm
    - 3: fishing
    - 4: find_npc
    - 5: assets
    - 6: logs
  - Xóa slot `<div id="drawer-panel-maze">...</div>`.

- [x] **Step 2: Xóa file `MazePanel.tsx`**
  - Chạy `git rm avatar-web/web/src/accounts/panels/MazePanel.tsx`.

- [x] **Step 3: Commit**
`git commit -m "refactor(web): remove maze tab and MazePanel from drawer"`

---

### Task 2: Chạy Toàn Bộ Test Suite Và Verify End-to-End

**Files:**
- Modify: `avatar-web/web/src/accounts/accountsRoutes.test.tsx` (nếu cần dọn dẹp)

- [x] **Step 1: Chạy test toàn bộ web**
Run: `cd avatar-web/web && npm test -- --run`
Expected: 11/11 test files pass 100%.

- [x] **Step 2: Verify `detect_changes`**
Run: `mcp__gitnexus__detect_changes` để phân tích đồ thị trước khi hoàn tất.

- [x] **Step 3: Commit**
`git commit -m "test(web): verify all tests pass after removing maze tab"`
