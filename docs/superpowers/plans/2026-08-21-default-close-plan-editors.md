# Mặc định đóng các khối kế hoạch nông trại (Tree, Animal, Kitchen Plan Editors) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi trạng thái mặc định của các khối kế hoạch nông trại (Cây trồng, Vật nuôi chuồng, Vật nuôi hồ, Bếp nấu ăn) sang trạng thái đóng (collapsed) khi mở trang.

**Architecture:** Cập nhật 3 component `TreeCellPlanEditor`, `AnimalPlanEditor`, và `KitchenPlanEditor` để hỗ trợ prop `defaultOpen?: boolean` với giá trị mặc định là `false`. Thẻ `<details className="tree-plan-editor">` sẽ không mang thuộc tính `open` khi `defaultOpen` là `false`, giúp trình duyệt render ở trạng thái đóng mặc định và chỉ mở khi người dùng tương tác.

**Tech Stack:** React, TypeScript, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-21-default-close-plan-editors-design.md`

## Global Constraints
- Tuân thủ quy tắc GitNexus: kiểm tra blast radius trước khi sửa và xác nhận thay đổi trước khi commit.
- Giữ nguyên mọi logic tô vẽ, xử lý dữ liệu và cấu trúc HTML/CSS hiện có.
- Không áp dụng TDD (không tạo test files mới trước khi code).

---

### Task 1: Cập nhật TreeCellPlanEditor mặc định đóng

**Files:**
- Modify: `avatar-web/web/src/accounts/TreeCellPlanEditor.tsx:22-45,140-145`

**Interfaces:**
- Consumes: `TreeCellPlanEditorProps`
- Produces: `TreeCellPlanEditor` component với `defaultOpen?: boolean` (mặc định: `false`) và `<details className="tree-plan-editor" open={defaultOpen ? true : undefined}>`

- [x] **Step 1: Thêm `defaultOpen` prop và cập nhật thẻ `<details>` trong `TreeCellPlanEditor.tsx`**
```tsx
export interface TreeCellPlanEditorProps {
  profile: FarmProfileDto;
  entries: TreeCellPlanEntry[];
  cellIndices?: number[];
  disabled?: boolean;
  refreshing?: boolean;
  defaultOpen?: boolean;
  onChange: (entries: TreeCellPlanEntry[]) => void;
  onRefresh?: () => void;
}

export function TreeCellPlanEditor({
  profile,
  entries,
  cellIndices,
  disabled = false,
  refreshing = false,
  defaultOpen = false,
  onChange,
  onRefresh,
}: TreeCellPlanEditorProps) {
  // ...
  return (
    <details className="tree-plan-editor" open={defaultOpen ? true : undefined}>
      <summary className="tree-plan-heading">Kế hoạch cây theo ô</summary>
```

- [x] **Step 2: Kiểm tra test suite**
Run: `npm --prefix avatar-web/web test src/accounts/TreeCellPlanEditor.test.tsx`
Expected: Tất cả tests trong file pass.

- [x] **Step 3: Commit**
`git commit -m "feat(web): make TreeCellPlanEditor closed by default"`

---

### Task 2: Cập nhật AnimalPlanEditor mặc định đóng

**Files:**
- Modify: `avatar-web/web/src/accounts/AnimalPlanEditor.tsx:12-50,110-115`

**Interfaces:**
- Consumes: `AnimalPlanEditorProps`
- Produces: `AnimalPlanEditor` component với `defaultOpen?: boolean` (mặc định: `false`) và `<details className="tree-plan-editor" open={defaultOpen ? true : undefined}>`

- [x] **Step 1: Thêm `defaultOpen` prop và cập nhật thẻ `<details>` trong `AnimalPlanEditor.tsx`**
```tsx
export interface AnimalPlanEditorProps {
  title: string;
  catalog: readonly AnimalCatalogItem[];
  slotIndices: readonly number[];
  entries: readonly AnimalPlanEntry[];
  disabled?: boolean;
  defaultOpen?: boolean;
  onChange: (entries: AnimalPlanEntry[]) => void;
}

export function AnimalPlanEditor({
  title,
  catalog,
  slotIndices,
  entries,
  disabled = false,
  defaultOpen = false,
  onChange,
}: AnimalPlanEditorProps) {
  // ...
  return (
    <details className="tree-plan-editor" open={defaultOpen ? true : undefined}>
      <summary className="tree-plan-heading">{title}</summary>
```

- [x] **Step 2: Kiểm tra test suite**
Run: `npm --prefix avatar-web/web test src/accounts/panels/AutoFarmPanel.test.tsx`
Expected: Tất cả tests trong file pass.

- [x] **Step 3: Commit**
`git commit -m "feat(web): make AnimalPlanEditor closed by default"`

---

### Task 3: Cập nhật KitchenPlanEditor mặc định đóng

**Files:**
- Modify: `avatar-web/web/src/accounts/KitchenPlanEditor.tsx:11-47,108-115`

**Interfaces:**
- Consumes: `KitchenPlanEditorProps`
- Produces: `KitchenPlanEditor` component với `defaultOpen?: boolean` (mặc định: `false`) và `<details className="tree-plan-editor" open={defaultOpen ? true : undefined}>`

- [x] **Step 1: Thêm `defaultOpen` prop và cập nhật thẻ `<details>` trong `KitchenPlanEditor.tsx`**
```tsx
export interface KitchenPlanEditorProps {
  title: string;
  entries: readonly KitchenPlanEntry[];
  foods: readonly FoodCookDto[];
  disabled?: boolean;
  defaultOpen?: boolean;
  onChange: (entries: KitchenPlanEntry[]) => void;
}

export function KitchenPlanEditor({
  title,
  entries,
  foods,
  disabled = false,
  defaultOpen = false,
  onChange,
}: KitchenPlanEditorProps) {
  // ...
  return (
    <details className="tree-plan-editor" open={defaultOpen ? true : undefined}>
      <summary className="tree-plan-heading">{title}</summary>
```

- [x] **Step 2: Kiểm tra toàn bộ test suite frontend**
Run: `npm --prefix avatar-web/web test`
Expected: Toàn bộ 11 test files (72 tests) pass mà không có lỗi.

- [x] **Step 3: Commit**
`git commit -m "feat(web): make KitchenPlanEditor closed by default"`
