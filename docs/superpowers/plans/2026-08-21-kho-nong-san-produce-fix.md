# Sửa tab Kho — Nông sản là nông sản thật (section 3 cmd 70) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tab Nông sản của Kho hiển thị nông sản thu hoạch thật (section 3 gói 70) thay vì hạt giống; tab còn lại giữ hạt giống + vật phẩm.

**Architecture:** Server đã decode `GameClient.produce` (section 3) và emit 'produce'; thêm forwarding `farm-produce` + `farmProduce` vào snapshot qua `avatarSession`. Web lưu `farmProduce` vào snapshot, `KhoSection` render 2 tab từ `produce` và `inventory`. Không đổi decoder hay shop.

**Tech Stack:** Node/tsx (server), React + TypeScript (web), Vitest/node:test (chỉ chạy test hiện có).

**Spec:** `docs/superpowers/specs/2026-08-21-kho-nong-san-produce-fix-design.md`

## Global Constraints
- Tuân thủ GitNexus: blast radius — `avatarSession.wire/snapshot` (server), `AssetsPanel`/`accountRuntime`/`types` (web); risk LOW-MEDIUM (1 luồng sự kiện mới, không đổi contract cũ).
- Không áp dụng TDD (không tạo test files mới).
- Không sửa `decodeInventory`/`GameClient`/shop produce.

---

### Task 1: Server — forward `produce` lên web

**Files:**
- Modify: `avatar-web/server/src/session/avatarSession.ts` (interface ~dòng 62, `snapshot()` ~409, `wire()` ~516-615)

**Interfaces:**
- Consumes: `GameClient.produce` (đã có), event 'produce' của client.
- Produces: `AvatarSessionSnapshot.farmProduce`, event WS `farm-produce`.

- [ ] **Step 1: Thêm field + snapshot**
```ts
// interface AvatarSessionSnapshot
farmProduce: unknown[];

// snapshot()
farmProduce: c?.produce ?? [],
```

- [ ] **Step 2: Forward event**
```ts
client.on('produce', (produce: unknown) => {
  if (this.isCurrent(client, epoch)) this.emit('farm-produce', produce);
});
```

- [ ] **Step 3: Verify server**
Run: `npm --prefix avatar-web/server run typecheck && npm --prefix avatar-web/server test`
Expected: pass.

---

### Task 2: Web — nhận `farm-produce` + sửa KhoSection

**Files:**
- Modify: `avatar-web/web/src/types.ts`, `avatar-web/web/src/accounts/accountRuntime.ts`,
  `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx`,
  `avatar-web/web/src/accounts/panels/AssetsPanel.tsx`,
  `avatar-web/web/src/accounts/panels/CookingPanel.tsx`

**Interfaces:**
- Consumes: event WS `farm-produce`, `GameClient.produce` qua snapshot.
- Produces: `SessionSnapshot.farmProduce`, tab Nông sản = produce thật.

- [ ] **Step 1: types.ts**
```ts
farmProduce?: InventoryItem[];
```

- [ ] **Step 2: accountRuntime.ts**
```ts
case 'farm-produce':
  return { ...current, farmProduce: message.payload };
```

- [ ] **Step 3: CookingPanel.tsx** — `export const ANIMAL_PRODUCT_NAMES`

- [ ] **Step 4: AccountOperationsDrawer.tsx** — thêm `produce={snapshot?.farmProduce ?? []}` vào `AssetsPanel`.

- [ ] **Step 5: AssetsPanel.tsx** — `KhoSection` nhận `produce`; tab Nông sản render `produce`, tab Vật phẩm & Hạt giống render `inventory`; name map = items + trees + animals + `ANIMAL_PRODUCT_NAMES`.

- [ ] **Step 6: Verify web**
Run: `cd avatar-web/web && npx tsc -b --noEmit && npx vitest run`
Expected: pass.

- [ ] **Step 7: Kiểm chứng browser**
Trên `/accounts/2` (server tsx watch tự reload): tab Nông sản = Hoa hồng/Dưa hấu/Xoài/Thanh long/Hoa tulip/Trứng gà/Cà chua; tab còn lại = hạt giống + vật phẩm.

- [ ] **Step 8: Commit**
`git commit -m "feat: Kho tab nông sản hiển thị nông sản thật (section 3 cmd 70)"`
