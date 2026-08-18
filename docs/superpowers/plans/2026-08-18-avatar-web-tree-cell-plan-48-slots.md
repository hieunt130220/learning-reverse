# Cấu Hình Cây Trồng 48 Ô Không Cần Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi phần cấu hình cây trồng trên web luôn hiển thị cố định 48 ô và 26 loại hạt giống mặc định, cho phép lưu cấu hình mà không phụ thuộc vào dữ liệu cache farm từ game server.

**Architecture:** Định nghĩa `TREE_CELL_COUNT = 48`, `DEFAULT_TREE_CELL_SLOTS` và `DEFAULT_SEED_CATALOG` trên client; loại bỏ các điều kiện khóa editor khi `profile.cellIndices` rỗng; cập nhật validation phía server cho phép các `cellIndex` trong dải 0–47 và các loại hạt giống hợp lệ mà không đòi hỏi cache ô đất.

**Tech Stack:** React, TypeScript, Node.js / Express, SQLite, GitNexus

**Spec:** `docs/superpowers/specs/2026-08-18-avatar-web-tree-cell-plan-48-slots-design.md`

## Global Constraints
- Tuân thủ quy tắc GitNexus: chạy `gitnexus_impact` trước khi sửa symbol và `gitnexus_detect_changes` trước khi commit.
- Không thực hiện TDD (không test-first, đi thẳng vào production code).
- Giữ nguyên các thao tác chọn, click và kéo chuột (pointer drag) tô màu kế hoạch ô đất trên giao diện.

---

### Task 1: Cập nhật Web Model & Logic Kế Hoạch Cây Trồng (`treeCellPlan.ts`)

**Files:**
- Modify: `avatar-web/web/src/accounts/treeCellPlan.ts`
- Modify: `avatar-web/web/src/accounts/treeCellPlan.test.ts`

**Interfaces:**
- Consumes: `TreeCellPlanEntry`, `FarmProfileDto`, `CachedSeedDto` từ `avatar-web/web/src/types.ts`
- Produces: `TREE_CELL_COUNT`, `DEFAULT_TREE_CELL_SLOTS`, `DEFAULT_SEED_CATALOG`, `applyTreePaint`, `summarizeTreePlan`, `invalidTreePlanEntries`

- [ ] **Step 1: Cập nhật `treeCellPlan.ts`**
  - Thêm `TREE_CELL_COUNT = 48` và `DEFAULT_TREE_CELL_SLOTS = Array.from({ length: 48 }, (_, i) => i)`.
  - Thêm `DEFAULT_SEED_CATALOG: CachedSeedDto[]` gồm 26 loại hạt giống mặc định.
  - Cập nhật `summarizeTreePlan(cellIndices = DEFAULT_TREE_CELL_SLOTS, entries)`: hỗ trợ nhận mảng ô đất mặc định 48 ô.
  - Cập nhật `invalidTreePlanEntries(profile, entries, validSlots = DEFAULT_TREE_CELL_SLOTS)`: kiểm tra `cellIndex` nằm trong `validSlots` (0..47), `seedId` nằm trong `profile.seedCatalog` hoặc `DEFAULT_SEED_CATALOG`.

- [ ] **Step 2: Cập nhật unit test `treeCellPlan.test.ts`**
  - Cập nhật các test case để kiểm tra 48 ô đất và catalog fallback mặc định.

- [ ] **Step 3: Chạy test kiểm tra `treeCellPlan.test.ts`**
  Run: `npm test -- src/accounts/treeCellPlan.test.ts` (trong `avatar-web/web`)
  Expected: PASS

- [ ] **Step 4: Commit**
  `git commit -m "feat(web): thêm 48 ô mặc định và catalog hạt vào treeCellPlan"`

---

### Task 2: Cập nhật Giao Diện Web Editor (`TreeCellPlanEditor.tsx` & `AutoFarmPanel.tsx`)

**Files:**
- Modify: `avatar-web/web/src/accounts/TreeCellPlanEditor.tsx`
- Modify: `avatar-web/web/src/accounts/TreeCellPlanEditor.test.tsx`
- Modify: `avatar-web/web/src/accounts/panels/AutoFarmPanel.test.tsx`

**Interfaces:**
- Consumes: `DEFAULT_TREE_CELL_SLOTS`, `DEFAULT_SEED_CATALOG`, `applyTreePaint`, `summarizeTreePlan`, `invalidTreePlanEntries` từ `./treeCellPlan.js`
- Produces: Component `TreeCellPlanEditor` luôn render 48 ô đất và palette hạt giống.

- [ ] **Step 1: Cập nhật `TreeCellPlanEditor.tsx`**
  - Thêm prop optional `cellIndices?: number[]` với giá trị mặc định là `DEFAULT_TREE_CELL_SLOTS`.
  - Thay thế `seeds` bằng `profile.seedCatalog.length > 0 ? profile.seedCatalog : DEFAULT_SEED_CATALOG`.
  - Bỏ biến `hasCells` và bỏ điều kiện khóa `editorLocked = disabled || !hasCells` -> `editorLocked = disabled`.
  - Xóa bỏ khối thông báo *"Chưa có cache ô farm..."* và *"Catalog hạt chưa có trong cache..."*.
  - Render danh sách `cellIndices` (48 ô: Ô 0 -> Ô 47) trên lưới `tree-plan-grid`.
  - Tóm tắt `summarizeTreePlan(cellIndices, entries)`.

- [ ] **Step 2: Cập nhật unit test `TreeCellPlanEditor.test.tsx` & `AutoFarmPanel.test.tsx`**
  - Cập nhật các assertion kiểm tra 48 ô đất luôn hiển thị kể cả khi `profile.cellIndices` rỗng `[]`.

- [ ] **Step 3: Chạy test web**
  Run: `npm test` (trong `avatar-web/web`)
  Expected: Toàn bộ tests của `avatar-web/web` PASS.

- [ ] **Step 4: Commit**
  `git commit -m "feat(web): hiển thị 48 ô cây trồng không phụ thuộc cache profile"`

---

### Task 3: Cập nhật Server Validation Cho Phép 48 Ô Không Bắt Buộc Cache (`routes.ts`, `repo.ts`, `autoConfig.ts`)

**Files:**
- Modify: `avatar-web/server/src/session/routes.ts`
- Modify: `avatar-web/server/src/accounts/repo.ts`
- Modify: `avatar-web/server/src/accounts/autoConfig.ts`
- Modify: `avatar-web/server/src/session/routes.test.ts`
- Modify: `avatar-web/server/src/accounts/repo.test.ts`
- Modify: `avatar-web/server/src/accounts/autoConfig.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_SEED_CATALOG` từ `../accounts/defaultSeedCatalog.js`
- Produces: `validateProfile`, `validateAutoConfigProfile`

- [ ] **Step 1: Cập nhật `server/src/session/routes.ts` & `server/src/accounts/repo.ts`**
  - Trong `validateProfile(config, profile)`:
    - Bỏ kiểm tra ném lỗi `farm-profile-required` và `seed-catalog-required`.
    - Danh sách ô hợp lệ là 0 <= `cellIndex` < 48 (hoặc kiểm tra `cellIndex >= 0 && cellIndex < 48`).
    - Danh sách hạt giống hợp lệ gồm `DEFAULT_SEED_CATALOG` + các hạt từ `profile.seedIds` (nếu có).
    - Chỉ báo lỗi `invalid-tree-cell-plan` khi có `cellIndex < 0 || cellIndex >= 48` hoặc `seedId` không nằm trong danh mục hạt hợp lệ.

- [ ] **Step 2: Cập nhật `server/src/accounts/autoConfig.ts`**
  - Cập nhật `validateAutoConfigProfile(config, profile)`: chấp nhận các ô 0..47 và hạt trong `DEFAULT_SEED_CATALOG` / `profile.seedIds`.

- [ ] **Step 3: Cập nhật server unit tests**
  - Cập nhật `routes.test.ts`, `repo.test.ts`, `autoConfig.test.ts` để kiểm tra việc lưu plan 48 ô khi `profile.cellIndices` rỗng vẫn thành công.

- [ ] **Step 4: Chạy test server**
  Run: `npm test` (trong `avatar-web/server`)
  Expected: Toàn bộ tests của `avatar-web/server` PASS.

- [ ] **Step 5: Commit**
  `git commit -m "feat(server): cho phép lưu kế hoạch cây trồng 48 ô không cần cache profile"`

---

### Task 4: Kiểm tra Tổng thể & Verification

**Files:**
- Toàn bộ files đã sửa ở Task 1, Task 2, Task 3.

- [ ] **Step 1: Chạy toàn bộ test suite dự án**
  - Server: `npm test` trong `avatar-web/server`
  - Web: `npm test` trong `avatar-web/web`

- [ ] **Step 2: Kiểm tra build sản phẩm**
  - Web: `npm run build` trong `avatar-web/web`
  - Server: `npm run build` trong `avatar-web/server`

- [ ] **Step 3: Commit cuối hoặc hoàn tất**
  `git commit -m "chore: hoàn tất cấu hình cây trồng 48 ô không phụ thuộc cache"`
