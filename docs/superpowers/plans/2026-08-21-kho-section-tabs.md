# Tách section Kho riêng với 2 tab — Nông sản / Vật phẩm & Hạt giống Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bỏ dòng kho khỏi panel Nông trại; thêm section Kho riêng có 2 tab (Nông sản / Vật phẩm & Hạt giống).

**Architecture:** Thêm component `KhoSection` trong `AssetsPanel.tsx` phân loại inventory theo id có/không nằm trong bảng cây; truyền thêm catalog `items` từ `AccountOperationsDrawer`. Không đổi server/type/API.

**Tech Stack:** React, TypeScript, Vitest (chỉ chạy test hiện có).

**Spec:** `docs/superpowers/specs/2026-08-21-kho-section-tabs-design.md`

## Global Constraints
- Tuân thủ quy tắc GitNexus: blast radius — `AssetsPanel` chỉ có 1 caller là `AccountOperationsDrawer.tsx`; risk LOW.
- Không áp dụng TDD (không tạo test files mới).
- Không đổi lưới ô / `AnimalSection` / logic farm.

---

### Task 1: Thêm `KhoSection` + bỏ dòng kho khỏi `FarmSection` trong `AssetsPanel.tsx`

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/AssetsPanel.tsx`

**Interfaces:**
- Consumes: `InventoryItem`, `TreeInfo`, `ItemInfo`, `apiPost`, state tab.
- Produces: `KhoSection` (section.card "Kho" với 2 tab + nút làm mới/tải bảng cây).

- [ ] **Step 1: Bỏ khối inventory khỏi `FarmSection`**
Xoá prop `inventory` khỏi `FarmSection` và xoá block `{inventory.length > 0 && (<div className="row">…kho…</div>)}`.

- [ ] **Step 2: Thêm `KhoSection` + cập nhật `AssetsPanel`**
```tsx
import type { AnimalInfo, FarmAnimal, FarmCell, FarmState, InventoryItem, ItemInfo, TreeInfo } from '../../types.js';

type KhoTab = 'nong-san' | 'vat-pham';

function KhoSection({ accountId, inventory, trees, items }: {
  accountId: number;
  inventory: InventoryItem[];
  trees: TreeInfo[];
  items: ItemInfo[];
}) { /* như spec */ }
```
`AssetsPanel` nhận thêm `items: ItemInfo[]`, render `<FarmSection … /> <KhoSection … /> <AnimalSection … />`.

- [ ] **Step 3: Verify typecheck + test**
Run: `cd avatar-web/web && npx tsc -b --noEmit && npx vitest run`
Expected: không lỗi; 72/72 pass.

---

### Task 2: Truyền `items` từ `AccountOperationsDrawer`

**Files:**
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx:105`

**Interfaces:**
- Consumes: `snapshot.items`.
- Produces: `AssetsPanel` nhận `items`.

- [ ] **Step 1: Thêm prop**
`<AssetsPanel accountId={account.id} farm={snapshot?.farm ?? null} inventory={snapshot?.inventory ?? []} trees={snapshot?.trees ?? []} animals={snapshot?.animals ?? []} items={snapshot?.items ?? []} />`

- [ ] **Step 2: Kiểm chứng browser**
Mở `http://localhost:5173/accounts/2`: Nông trại hết dòng kho; card Kho có 2 tab đúng nội dung.

- [ ] **Step 3: Commit**
`git commit -m "feat(web): tách section Kho với 2 tab nông sản / vật phẩm hạt giống"`
