# Bỏ 2 nút Làm mới kho và Tải bảng cây trong tab Tài sản Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gỡ bỏ 2 nút "làm mới kho" và "tải bảng cây" khỏi phần hiển thị Kho trong tab Tài sản (`AssetsPanel.tsx`), dọn dẹp import và prop không còn sử dụng.

**Architecture:** Xóa khối `<div className="row">` chứa 2 nút action khỏi `KhoSection`, gỡ bỏ import `apiPost` từ `AssetsPanel.tsx`, bỏ prop `accountId` trong `KhoSection` và giữ `accountId?: number` tùy chọn trong `AssetsPanel` để đảm bảo tương thích ngược.

**Tech Stack:** React, TypeScript, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-08-remove-assets-refresh-buttons-design.md`

## Global Constraints
- Tuân thủ quy tắc GitNexus: chạy `gitnexus_impact` trước khi sửa và `gitnexus_detect_changes` trước khi commit.
- Không để lại cảnh báo TypeScript (unused imports, unused props).
- Toàn bộ test suite phải tiếp tục pass 100%.

---

### Task 1: Gỡ bỏ 2 nút trong `KhoSection` và dọn dẹp import trong `AssetsPanel.tsx`

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/AssetsPanel.tsx:1-145`

**Interfaces:**
- Consumes: `KhoSection`, `AssetsPanel`
- Produces: `AssetsPanel` tinh gọn, không còn 2 nút thủ công và không còn import `apiPost`.

- [x] **Step 1: Xóa import `apiPost` và sửa đổi `KhoSection`**
Trong `avatar-web/web/src/accounts/panels/AssetsPanel.tsx`:
1. Xóa `import { apiPost } from '../../api.js';`.
2. Trong `AssetsPanel`, thay đổi type của `accountId` thành `accountId?: number` (hoặc giữ nguyên nếu caller vẫn truyền). Khi gọi `<KhoSection ... />`, xóa `accountId={accountId}`.
3. Trong `KhoSection`, xóa `accountId` khỏi tham số và prop type:
```tsx
function KhoSection({
  inventory,
  produce,
  trees,
  items,
  animals,
}: {
  inventory: InventoryItem[];
  produce: InventoryItem[];
  trees: TreeInfo[];
  items: ItemInfo[];
  animals: AnimalInfo[];
}) {
```
4. Xóa khối nút khỏi JSX của `KhoSection`:
```tsx
// Xóa:
      <div className="row">
        <button
          className="ghost"
          onClick={() =>
            void apiPost(`/api/accounts/${accountId}/farm`, { name: 'getInventory', args: [] })
          }
        >
          làm mới kho
        </button>
        <button
          className="ghost"
          onClick={() =>
            void apiPost(`/api/accounts/${accountId}/farm`, { name: 'getTreeInfo', args: [] })
          }
        >
          tải bảng cây
        </button>
      </div>
```

- [x] **Step 2: Kiểm tra biên dịch TypeScript**
Run: `npm --prefix avatar-web/web run build`
Expected: Biên dịch Vite thành công, không có lỗi TypeScript.

- [x] **Step 3: Commit**
`git commit -m "refactor(web): remove manual inventory and tree info refresh buttons from assets panel"`

---

### Task 2: Chạy kiểm thử tự động và xác minh GitNexus

**Files:**
- Test: `avatar-web/web/src/accounts/panels/AssetsPanel.test.tsx`

**Interfaces:**
- Consumes: Test suite `AssetsPanel.test.tsx` và toàn bộ test suite web
- Produces: Báo cáo kết quả kiểm thử pass 100%.

- [x] **Step 1: Chạy test suite của `AssetsPanel` và toàn bộ web**
Run: `npm --prefix avatar-web/web test -- src/accounts/panels/AssetsPanel.test.tsx --run`
Run: `npm --prefix avatar-web/web test -- --run`
Expected: 11 test files (75 tests) đều pass.

- [x] **Step 2: Chạy GitNexus detect changes**
Run: `gitnexus_detect_changes({scope: "unstaged"})`
Expected: Chỉ ảnh hưởng các symbol mong muốn trong `AssetsPanel.tsx`.

- [x] **Step 3: Re-index GitNexus**
Run: `npx gitnexus analyze`
Expected: Index được cập nhật thành công.
