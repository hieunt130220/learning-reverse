# Tự Động Bán Món Ăn Sau Khi Thu Hoạch Từ Bếp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tự động bán ngay món ăn (vật phẩm thành phẩm `productID`) bằng lệnh `sellItem` (Cmd 67) sau khi thu hoạch món chín từ bếp trong chu trình AutoFarm.

**Architecture:** Mở rộng luồng Cooking Phase trong `autoFarm.ts`: khi `harvestCook` hoàn tất cho một ô bếp, tra cứu `productID` của món ăn đó trong catalog và lập tức gọi `this.client.farm.sellItem(productID, 1)`. Bổ sung method `sellItem` vào interface `ClientFarm` của `autoFarm.ts`, cập nhật `FakeClient` và test suite trong `autoFarm.test.ts`.

**Tech Stack:** Node.js / TypeScript, Native `node:test` & `node:assert`.

**Spec:** `docs/superpowers/specs/2026-08-21-auto-sell-cooked-dishes-design.md`

## Global Constraints
- Không làm thay đổi giao diện UI hoặc các tính năng bán đồ khác ngoài chu trình AutoFarm bếp.
- Luôn fallback tra cứu sang `DEFAULT_FOOD_CATALOG` nếu `this.client.foods` chưa có dữ liệu.
- Phải log rõ ràng `[bếp] bán ngay món "<name>" (vật phẩm #<productID>)` và tăng `sent += 1`.
- Không sử dụng TDD (không test-first), test được viết sau để kiểm chứng production code.

---

### Task 1: Mở rộng `ClientFarm` và logic bán món ăn trong `autoFarm.ts`

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:180-195` (Thêm `sellItem` vào `ClientFarm`)
- Modify: `avatar-web/server/src/autoFarm.ts:1045-1065` (Thực hiện bán món ăn ngay sau khi `harvestCook`)

**Interfaces:**
- Consumes: `FoodRecipe` và `DEFAULT_FOOD_CATALOG` từ `game/farmData.js`.
- Produces: `this.client.farm.sellItem(idItem: number, num: number): void`.

- [ ] **Step 1: Thêm `sellItem` vào interface `ClientFarm` và import `DEFAULT_FOOD_CATALOG`**
Trong `avatar-web/server/src/autoFarm.ts`:
1. Import thêm `DEFAULT_FOOD_CATALOG` từ `./game/farmData.js`.
2. Thêm `sellItem(idItem: number, num: number): void;` vào `ClientFarm` (trong interface `ClientLike`).

- [ ] **Step 2: Cập nhật luồng thu hoạch bếp để tự động bán món ăn**
Trong `avatar-web/server/src/autoFarm.ts` (phần `// 1. Tự động thu hoạch món chín`):
```typescript
if (cfg.autoHarvestCook !== false) {
  const foodCatalog: FoodRecipe[] = this.client.foods && this.client.foods.length > 0
    ? this.client.foods
    : DEFAULT_FOOD_CATALOG;
  for (const slot of cookState.slots) {
    if (this.aborted) break;
    if (slot.idFood !== -1 && (slot.isDone || slot.remainTime <= 0)) {
      const foodId = slot.idFood;
      this.client.farm.harvestCook(slot.slot);
      sent += 1;
      note(`[bếp] thu hoạch món #${foodId} ở ô ${slot.slot}`);
      slot.idFood = -1;
      slot.isDone = false;
      slot.remainTime = 0;
      await confirm(92, `thu hoạch món ô ${slot.slot}`);
      await tick();

      // Bán ngay món ăn vừa thu hoạch
      const recipe = foodCatalog.find((r) => r.id === foodId);
      if (recipe && recipe.productID > 0) {
        this.client.farm.sellItem(recipe.productID, 1);
        sent += 1;
        note(`[bếp] bán ngay món "${recipe.name}" (vật phẩm #${recipe.productID})`);
        await tick();
      }
    }
  }
}
```

---

### Task 2: Cập nhật mock `FakeClient` và kiểm chứng với Unit Tests trong `autoFarm.test.ts`

**Files:**
- Modify: `avatar-web/server/src/autoFarm.test.ts:175-185` (Thêm mock `sellItem`)
- Modify: `avatar-web/server/src/autoFarm.test.ts:1005-1033` (Cập nhật test case thu hoạch + bán ngay)

**Interfaces:**
- Consumes: `ClientFarm.sellItem`
- Produces: Test suite kiểm thử toàn diện hành vi thu hoạch và bán món ăn

- [ ] **Step 1: Thêm mock `sellItem` vào `FakeClient`**
Trong `avatar-web/server/src/autoFarm.test.ts`:
```typescript
sellItem: (idItem: number, num: number): void => {
  this.calls.push(`sellItem:${idItem}:${num}`);
  this.echo(67);
},
```

- [ ] **Step 2: Cập nhật và bổ sung test case cho luồng thu hoạch & bán ngay**
Trong `avatar-web/server/src/autoFarm.test.ts`, kiểm tra ô 0 nấu Cơm (`idFood: 3`, `productID: 118`):
```typescript
test('bếp: tự động thu hoạch món đã chín và bán ngay khi autoHarvestCook bật', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [],
    updatedAt: Date.now(),
  });
  client.cookingState = {
    numSlot: 3,
    slots: [
      { slot: 0, idFood: 3, time: 1800, remainTime: 0, isDone: true },
      { slot: 1, idFood: 1, time: 3600, remainTime: 1200, isDone: false },
      { slot: 2, idFood: -1, time: 0, remainTime: 0, isDone: false },
    ],
    missions: [],
    isUnlocked: false,
    isReadyToOpen: false,
    updatedAt: Date.now(),
  };

  await runOneCycle(client, { autoHarvestCook: true });

  assert.ok(client.calls.includes('getCook:0'), 'phải xin thông tin bếp');
  assert.ok(client.calls.includes('harvestCook:0'), 'phải thu hoạch món chín ở ô 0');
  assert.ok(client.calls.includes('sellItem:118:1'), 'phải bán ngay Cơm (productID 118) số lượng 1');
  assert.equal(client.calls.includes('harvestCook:1'), false, 'ô 1 đang nấu chưa chín không được thu');
});
```

- [ ] **Step 3: Chạy test suite và kiểm tra kết quả**
Run: `npm --prefix avatar-web/server test`
Expected: Tất cả test passed 100%.
