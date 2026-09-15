# Fix Auto Buy Catalog Seeds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục lỗi AutoFarm bỏ qua trồng hạt Bí Ngô (#41) và các hạt trong catalog do thiếu hạt trong kho, bằng cách mở rộng `XU_SEED_IDS` và chuẩn hóa hàm nhận diện hạt mua bằng Xu `seedBuyableWithXu`.

**Architecture:** Mở rộng `XU_SEED_IDS` trong `defaultSeedCatalog.ts` bao hàm toàn bộ danh mục hạt giống của `DEFAULT_SEED_CATALOG` (26 loại hạt); cập nhật `seedBuyableWithXu` trong `autoFarm.ts` ưu tiên kiểm tra `XU_SEED_IDS` và thuộc tính tiền tệ `s(4) === 1` từ gói 76 thay vì loại trừ theo `category === 'premium'`.

**Tech Stack:** TypeScript, Node.js test runner, AvatarHD protocol.

**Spec:** `docs/superpowers/specs/2026-09-15-fix-auto-buy-catalog-seeds-design.md`

## Global Constraints
- Tuân thủ quy định Superpowers: không dùng TDD (không test-first, không tạo test file mới trừ khi có yêu cầu).
- Chạy GitNexus impact analysis trước khi sửa code, detect_changes trước khi commit.
- Không thay đổi wire protocol gói tin (giữ nguyên opcode và format `buyItem(id, num, SHOP_XU)`).

---

### Task 1: Mở rộng `XU_SEED_IDS` trong `defaultSeedCatalog.ts`

**Files:**
- Modify: `avatar-web/server/src/accounts/defaultSeedCatalog.ts:11-12`

**Interfaces:**
- Consumes: `DEFAULT_SEED_CATALOG` từ `../game/defaultCatalogs.js`
- Produces: `XU_SEED_IDS: ReadonlySet<number>` chứa ID của tất cả 26 hạt giống trong `DEFAULT_SEED_CATALOG`

- [x] **Step 1: Cập nhật `XU_SEED_IDS` trong `src/accounts/defaultSeedCatalog.ts`**
  Thay thế định nghĩa cũ:
  ```ts
  export const XU_SEED_IDS: ReadonlySet<number> = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  ```
  bằng:
  ```ts
  export const XU_SEED_IDS: ReadonlySet<number> = new Set(DEFAULT_SEED_CATALOG.map((s) => s.id));
  ```

- [x] **Step 2: Kiểm tra biên dịch**
  Run: `cd avatar-web/server && npm run typecheck`
  Expected: Không có lỗi TypeScript.

- [x] **Step 3: Commit**
  `git commit -m "fix(server): expand XU_SEED_IDS to include all catalog seeds"`

---

### Task 2: Chuẩn hóa `seedBuyableWithXu` trong `autoFarm.ts`

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:754-758`

**Interfaces:**
- Consumes: `XU_SEED_IDS`, `this.client.trees`
- Produces: `seedBuyableWithXu(id: number): boolean` trả về true cho hạt #41 (Bí Ngô) và tất cả hạt trong catalog hoặc có thuộc tính mua bằng xu `s(4) === 1`

- [x] **Step 1: Chạy GitNexus impact analysis**
  Run: `impact({target: "AutoFarm", direction: "upstream", repo: "learning-reverse"})`
  Expected: Xác nhận blast radius LOW.

- [x] **Step 2: Cập nhật `seedBuyableWithXu` trong `src/autoFarm.ts`**
  Tại dòng 754-758 của `avatar-web/server/src/autoFarm.ts`:
  ```ts
  const seedBuyableWithXu = (id: number): boolean => {
    if (XU_SEED_IDS.has(id)) return true;
    const tree = this.client.trees.find((t) => t.id === id);
    if (tree?.attrsHex && tree.attrsHex.length >= 20) {
      try {
        const buf = Buffer.from(tree.attrsHex, 'hex');
        return buf.readInt16BE(4 * 2) === 1;
      } catch {
        return false;
      }
    }
    return false;
  };
  ```

- [x] **Step 3: Bổ sung test case trong `src/autoFarm.test.ts`**
  Thêm test case kiểm tra mua bù và trồng hạt Bí Ngô #41:
  ```ts
  test('auto-buy mua bù hạt Bí Ngô (#41) từ catalog và trồng vào ô trống', async () => {
    const client = new FakeClient({
      idFarm: 1,
      cells: [cell(0, { idTree: -1 })],
      animals: [],
      updatedAt: 0,
    });
    client.trees = [];
    client.inventory = [];

    const auto = await runOneCycle(client, { seedId: 41, harvest: false, autoBuy: true });

    assert.ok(client.calls.includes('buy:41x1'), 'phải mua bù đúng 1 hạt #41');
    assert.ok(client.calls.includes('plantSeed:0:41'), 'phải trồng hạt #41 vào ô 0');
    assert.ok(auto.state().lastActions.some((line) => line.includes('trồng #41')));
  });
  ```

- [x] **Step 4: Chạy test suite**
  Run: `cd avatar-web/server && npx tsx --test src/autoFarm.test.ts`
  Expected: Tất cả tests pass (43/43 pass).

- [x] **Step 5: Kiểm tra GitNexus changes trước khi commit**
  Run: `detect_changes({scope: "unstaged", repo: "learning-reverse"})`
  Expected: Clean check, không có rủi ro tiềm ẩn.

- [x] **Step 6: Commit**
  `git commit -m "fix(server): allow auto-buy and replant for pumpkin seed #41 and catalog seeds"`
