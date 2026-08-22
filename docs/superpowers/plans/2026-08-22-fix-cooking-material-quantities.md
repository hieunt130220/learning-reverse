# Fix Cooking Material Quantities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Tách Cmd70 section 4 khỏi kho hạt/vật phẩm thường để UI và AutoFarm chỉ tính nguyên liệu nấu ăn từ nông sản section 3 cùng nguyên liệu đặc biệt section 4.

**Architecture:** `GameClient` giữ ba collection có ý nghĩa riêng: `inventory` cho sections 1+2, `produce` cho section 3, và `cookingMaterials` cho section 4. `AvatarSession` truyền collection mới qua snapshot; cả frontend `CookingPanel` và backend `AutoFarm` tổng hợp đúng `produce + cookingMaterials`, loại bỏ seed inventory khỏi phép tính bếp.

**Tech Stack:** TypeScript 5.7, Node.js, React 18, Vite, WebSocket runtime snapshot, GitNexus.

**Spec:** `docs/superpowers/specs/2026-08-22-fix-kitchen-cooking-chicken-phu-design.md`

## Global Constraints

- Không sửa binary layout của `decodeInventory`; decoder hiện đã chia đúng bốn section.
- Không dùng `inventory` để quyết định số lượng nguyên liệu nấu ăn.
- `inventory` tiếp tục chứa Cmd70 sections 1+2 để giữ hành vi của các consumer kho hiện hữu.
- `produce` tiếp tục chứa Cmd70 section 3.
- `cookingMaterials` chỉ chứa Cmd70 section 4.
- Field frontend `cookingMaterials` là optional để tương thích snapshot backend cũ trong rolling deploy.
- Không đổi recipe IDs, item names, hoặc fallback catalog trong change này.
- Không tạo test file mới vì user không yêu cầu trực tiếp và project cấm TDD.
- Không sửa hoặc commit các thay đổi có sẵn của user trong `AGENTS.md` và `CLAUDE.md`.
- Đã chạy GitNexus impact cho `GameClient`, `AvatarSession`, `CookingPanel`, `AutoFarm`; tất cả risk LOW.
- Trước khi commit (nếu user yêu cầu), bắt buộc chạy `gitnexus_detect_changes({scope: "all"})`.

### Task 1: Tách Cmd70 section 4 trong GameClient

**Files:**
- Modify: `avatar-web/server/src/game/client.ts:143-152,793-823`

**Interfaces:**
- Consumes: `decodeInventory()` với `seeds`, `items`, `other[0]`, `other[1]`.
- Produces: `GameClient.inventory`, `GameClient.produce`, `GameClient.cookingMaterials`.

- [x] **Step 1: Khai báo collection section 4**

Thêm property có type cụ thể và mô tả protocol:

```ts
/** Nguyên liệu/vật phẩm đặc biệt dùng cho bếp (Cmd70 section 4). */
cookingMaterials: InventoryItem[] = [];
```

- [x] **Step 2: Sửa mapping Cmd70 theo đúng section**

Thay mapping gộp bằng:

```ts
this.inventory = [...inv.seeds, ...inv.items];
this.produce = inv.other[0] ?? [];
this.cookingMaterials = inv.other[1] ?? [];
```

Cập nhật comment và log để section 4 có thể quan sát độc lập. Giữ event `inventory` và `produce`; thêm `cooking-materials` nếu cần để runtime subscriber nhận live update ngay.

- [x] **Step 3: Verify server type contract**

Run: `cd avatar-web/server && ./node_modules/.bin/tsc -p tsconfig.json --noEmit`

Expected: TypeScript exit code 0.

- [x] **Step 4: Commit**

Chỉ thực hiện nếu user yêu cầu commit:

```bash
git commit -m "fix(avatar-web): separate cooking materials from seed inventory"
```

### Task 2: Phát cookingMaterials qua runtime snapshot

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts:62-94,412-446,577-585`
- Modify: `avatar-web/web/src/types.ts:336-370`

**Interfaces:**
- Consumes: `GameClient.cookingMaterials` từ Task 1.
- Produces: `AvatarSessionSnapshot.cookingMaterials` và `SessionSnapshot.cookingMaterials?`.

- [x] **Step 1: Mở rộng backend snapshot contract**

Thêm field:

```ts
cookingMaterials: unknown[];
```

và snapshot value:

```ts
cookingMaterials: c?.cookingMaterials ?? [],
```

Nếu Task 1 phát event `cooking-materials`, forward event qua `AvatarSession.wire()` theo pattern `farm-produce`.

- [x] **Step 2: Mở rộng frontend rolling-deploy contract**

Thêm field typed:

```ts
/** Nguyên liệu đặc biệt cho bếp (Cmd70 section 4). */
cookingMaterials?: InventoryItem[];
```

- [x] **Step 3: Verify contracts**

Run:

```bash
cd avatar-web/server && ./node_modules/.bin/tsc -p tsconfig.json --noEmit
cd ../web && ./node_modules/.bin/tsc -b
```

Expected: Cả hai lệnh exit code 0.

- [x] **Step 4: Commit**

Chỉ thực hiện nếu user yêu cầu commit; gộp cùng commit cuối thay đổi.

### Task 3: Sửa nguồn số lượng trong CookingPanel

**Files:**
- Modify: `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx:102-110`
- Modify: `avatar-web/web/src/accounts/panels/CookingPanel.tsx:54-89,163-167`

**Interfaces:**
- Consumes: `snapshot.farmProduce`, `snapshot.cookingMaterials` từ Task 2.
- Produces: số lượng `countInBag` chỉ từ Cmd70 sections 3+4.

- [x] **Step 1: Thay props của CookingPanel**

Bỏ prop `inventory`; giữ một khai báo duy nhất cho `produce`; thêm:

```ts
cookingMaterials?: InventoryItem[];
```

- [x] **Step 2: Tổng hợp đúng kho nguyên liệu bếp**

Đổi map thành:

```ts
const materialCountMap = new Map<number, number>();
for (const item of [...(produce ?? []), ...(cookingMaterials ?? [])]) {
  materialCountMap.set(item.id, (materialCountMap.get(item.id) ?? 0) + item.num);
}
```

Dùng `materialCountMap` khi tạo `materialsStatus`. Không fallback sang `inventory`, vì fallback đó tái tạo lỗi seed/nông sản trùng ID.

- [x] **Step 3: Truyền snapshot fields từ drawer**

```tsx
<CookingPanel
  ...
  produce={snapshot?.farmProduce ?? []}
  cookingMaterials={snapshot?.cookingMaterials ?? []}
/>
```

- [x] **Step 4: Verify web build/typecheck**

Run: `cd avatar-web/web && ./node_modules/.bin/tsc -b`

Expected: TypeScript exit code 0, không còn duplicate `produce` prop declaration.

- [x] **Step 5: Commit**

Chỉ thực hiện nếu user yêu cầu commit; gộp cùng commit cuối thay đổi.

### Task 4: Sửa nguồn nguyên liệu của AutoFarm

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:1145-1149`

**Interfaces:**
- Consumes: `GameClient.produce`, `GameClient.cookingMaterials` từ Task 1.
- Produces: `availableMaterials` chính xác cho kiểm tra, log thiếu, và trừ nguyên liệu ảo giữa các ô bếp.

- [x] **Step 1: Thay nguồn tổng hợp**

```ts
const availableMaterials = new Map<number, number>();
for (const item of [...this.client.produce, ...this.client.cookingMaterials]) {
  availableMaterials.set(item.id, (availableMaterials.get(item.id) ?? 0) + item.num);
}
```

Cập nhật comment thành Cmd70 sections 3+4. Không thay đổi thuật toán chọn recipe, kiểm tra đủ nguyên liệu, hoặc trừ ảo.

- [x] **Step 2: Verify server**

Run: `cd avatar-web/server && ./node_modules/.bin/tsc -p tsconfig.json --noEmit`

Expected: TypeScript exit code 0.

- [x] **Step 3: Commit**

Chỉ thực hiện nếu user yêu cầu commit; gộp cùng commit cuối thay đổi.

### Task 5: Live verification và cleanup

**Files:**
- Delete: `avatar-web/server/src/tools/chk-item4.ts`
- Modify: `docs/superpowers/plans/2026-08-22-fix-cooking-material-quantities.md` (đánh dấu checkbox hoàn thành)

**Interfaces:**
- Consumes: production changes từ Tasks 1–4 và tài khoản `phu`.
- Produces: bằng chứng section mapping/count đúng và working tree không còn tool tạm.

- [x] **Step 1: Chạy full typechecks**

Run:

```bash
cd avatar-web/server && ./node_modules/.bin/tsc -p tsconfig.json --noEmit
cd ../web && ./node_modules/.bin/tsc -b
```

Expected: Cả server và web đều exit code 0.

- [x] **Step 2: Verify live Cmd70 mapping**

Dùng tool chẩn đoán hiện có trước khi xóa hoặc một lệnh one-off không lưu file để xác nhận tài khoản `phu`:

```text
inventory: có #4×4 hạt Nho
produce: không có #4, có #50×400
cookingMaterials: có #276×10 và #279×4
```

Expected cooking availability:

```text
#4 = 0
#50 = 400
#276 = 10
#279 = 4
```

- [x] **Step 3: Verify UI behavior**

Mở bảng công thức và xác nhận:

```text
Nho #4: 0/2000
Trứng gà #50: 400/<số cần>
Gà nguyên con #276: 10/1
```

- [x] **Step 4: Xóa diagnostic tool tạm**

Delete: `avatar-web/server/src/tools/chk-item4.ts`.

- [x] **Step 5: GitNexus scope verification**

Run: `gitnexus_detect_changes({scope: "all"})`

Expected:
- Changed symbols chỉ thuộc mapping Cmd70, runtime snapshot, CookingPanel props/count, và AutoFarm material aggregation.
- Không có execution flow ngoài phạm vi dự kiến.
- Tất cả d=1 dependents đã được cập nhật.

- [x] **Step 6: Review working tree**

Run: `git diff --check && git status --short`

Expected:
- Không có whitespace error.
- Không stage/sửa ngoài ý muốn các file user-owned `AGENTS.md`, `CLAUDE.md`.
- Diagnostic tool không còn tồn tại.

- [x] **Step 7: Commit**

Chỉ khi user yêu cầu:

```bash
git add avatar-web/server/src/game/client.ts \
  avatar-web/server/src/session/avatarSession.ts \
  avatar-web/server/src/autoFarm.ts \
  avatar-web/web/src/types.ts \
  avatar-web/web/src/accounts/AccountOperationsDrawer.tsx \
  avatar-web/web/src/accounts/panels/CookingPanel.tsx \
  docs/superpowers/specs/2026-08-22-fix-kitchen-cooking-chicken-phu-design.md \
  docs/superpowers/plans/2026-08-22-fix-cooking-material-quantities.md

git commit -m "fix(avatar-web): count only actual cooking materials"
```
