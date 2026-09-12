# Bỏ nút Debug chuyên sâu khỏi Drawer Vận hành Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gỡ bỏ nút/link "Debug chuyên sâu →" khỏi Drawer Vận hành tài khoản trên giao diện Web mà vẫn giữ nguyên route và trang Debug riêng biệt.

**Architecture:** Xóa thẻ Link, handler `openDebug`, prop `onOpenDebug` và kiểu `MouseEvent` không dùng trong `AccountOperationsDrawer.tsx`, dọn dẹp CSS class `.drawer-debug-link` trong `styles.css`, và cập nhật test dirty-guard trong `accountsRoutes.test.tsx`.

**Tech Stack:** React, TypeScript, React Router, Vite, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-08-remove-deep-debug-button-design.md`

## Global Constraints
- Tuân thủ quy tắc GitNexus: chạy `gitnexus_impact` trước khi sửa và `gitnexus_detect_changes` trước khi commit.
- Không xóa `AccountDebugPage.tsx`, `DebugPanel.tsx`, hoặc route `/accounts/:id/debug`.
- Không để lại cảnh báo TypeScript (unused imports, unused props).

---

### Task 1: Gỡ bỏ Link "Debug chuyên sâu →", handler và CSS liên quan

**Files:**
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx:1-290`
- Modify: `avatar-web/web/src/styles.css:561`

**Interfaces:**
- Consumes: `AccountOperationsDrawer`, `LoadedOperations`
- Produces: `AccountOperationsDrawer` gọn gàng, không còn link debug và prop thừa.

- [x] **Step 1: Xóa Link debug, handler `openDebug`, prop `onOpenDebug` và import `MouseEvent`**
Trong `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`:
1. Bỏ `type MouseEvent` khỏi dòng import React:
```tsx
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
```
2. Xóa hàm `openDebug`:
```tsx
// Xóa:
const openDebug = (event: MouseEvent<HTMLAnchorElement>) => {
  event.preventDefault();
  if (canLeave()) navigate(`/accounts/${accountId}/debug`);
};
```
3. Xóa prop `onOpenDebug={openDebug}` tại `<LoadedOperations ... />`.
4. Xóa `onOpenDebug` khỏi danh sách destructured props và interface type của `LoadedOperations`.
5. Xóa thẻ `<Link className="btn-link drawer-debug-link" ...>Debug chuyên sâu →</Link>` khỏi JSX cuối `LoadedOperations`.

- [x] **Step 2: Xóa CSS class `.drawer-debug-link`**
Trong `avatar-web/web/src/styles.css`:
Xóa dòng 561:
```css
.drawer-debug-link { justify-self: start; margin-bottom: 20px; }
```

- [x] **Step 3: Kiểm tra biên dịch TypeScript**
Run: `npm --prefix avatar-web/web run build`
Expected: Biên dịch Vite thành công, không có lỗi type error.

- [x] **Step 4: Commit**
`git commit -m "refactor(web): remove deep debug link from operations drawer"`

---

### Task 2: Cập nhật test suite và xác minh toàn diện

**Files:**
- Modify: `avatar-web/web/src/accounts/accountsRoutes.test.tsx:150-170`

**Interfaces:**
- Consumes: Test suite `accountsRoutes.test.tsx`
- Produces: Test suite bao phủ hành vi drawer mà không còn kỳ vọng link debug.

- [x] **Step 1: Cập nhật `test.each` trong `accountsRoutes.test.tsx`**
Trong `avatar-web/web/src/accounts/accountsRoutes.test.tsx`:
Bỏ phần tử `['link Debug', ...]` khỏi danh sách `test.each`:
```tsx
test.each([
  ['nút Đóng', async () => userEvent.click(screen.getByRole('button', { name: 'Đóng' }))],
  ['backdrop', async () => {
    const backdrop = screen.getByRole('dialog', { name: 'Vận hành Farm chính' }).parentElement!;
    fireEvent.mouseDown(backdrop);
  }],
] as const)('%s dùng cùng dirty guard và thực hiện đúng đích sau khi chấp nhận', async (kind, leave) => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  renderRoute('/accounts/1');
  await makePlanDirty();

  await leave();
  expect(screen.getByTestId('location')).toHaveTextContent('/accounts/1');
  expect(confirm).toHaveBeenLastCalledWith('Có thay đổi chưa lưu. Bỏ thay đổi?');

  await leave();
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/accounts'));
});
```

- [x] **Step 2: Chạy test kiểm thử**
Run: `npm --prefix avatar-web/web test -- src/accounts/accountsRoutes.test.tsx`
Expected: Toàn bộ tests pass (bao gồm test `/accounts/:id/debug hiển thị Debug riêng và link về Vận hành`).

- [x] **Step 3: Kiểm tra GitNexus detect changes**
Run: `gitnexus_detect_changes({scope: "unstaged"})`
Expected: Chỉ ảnh hưởng các symbol mong muốn trong `AccountOperationsDrawer.tsx` và `accountsRoutes.test.tsx`.

- [x] **Step 4: Commit**
`git commit -m "test(web): update drawer routes test to remove deep debug link assertion"`
