# Hiển thị tên cây trồng và vật phẩm trong nhật ký AutoFarm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thế các ID dạng số (`#plannedSeedId`, `#100`, `#123`, `#food`...) bằng tên cây trồng và vật phẩm tiếng Việt trong nhật ký AutoFarm.

**Architecture:** Sử dụng `getProduceOrItemName(id, this.client.trees, this.client.items)` để phân giải ID thành tên hiển thị cho thu hoạch, gieo hạt, mua sắm và bán nông sản. Tinh giản log chăm sóc ô thành các hành động tự nhiên (`tưới`, `nhổ cỏ`, `bắt sâu`, `bón phân`). Bổ sung ID 100 và 112 vào `KNOWN_PRODUCE_NAME_MAP` làm fallback.

**Tech Stack:** TypeScript, Node.js.

**Spec:** `docs/superpowers/specs/2026-09-16-tree-item-name-in-autofarm-logs-design.md`

## Global Constraints

- Không TDD, không tạo test file mới. Chạy test suite sẵn có sau khi sửa.
- Giữ nguyên 100% logic xử lý, timing, protocol mạng.
- Chạy `gitnexus_impact` trước khi sửa, `gitnexus_detect_changes` trước khi commit.

---

### Task 1: Thêm fallback ID 100 và 112 vào `KNOWN_PRODUCE_NAME_MAP` trong `farmData.ts`

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts:1920-1925`

**Interfaces:**
- Consumes: `KNOWN_PRODUCE_NAME_MAP`
- Produces: `getProduceOrItemName(100)` trả về `'Bình nước'`, `getProduceOrItemName(112)` trả về `'Phân bón siêu cấp'`

- [x] **Step 1: Impact analysis `KNOWN_PRODUCE_NAME_MAP`.**
Run:
```bash
gitnexus_impact({target: "KNOWN_PRODUCE_NAME_MAP", direction: "upstream", repo: "learning-reverse"})
```

- [x] **Step 2: Cập nhật `KNOWN_PRODUCE_NAME_MAP`.**
Thêm ID 100 và 112 vào `KNOWN_PRODUCE_NAME_MAP` trong `farmData.ts`:
```ts
  61: 'Tôm',
  100: 'Bình nước',
  111: 'Ớt hiểm',
  112: 'Phân bón siêu cấp',
  120: 'Thuốc cúm',
```

- [x] **Step 3: Verify & Commit Task 1.**
Run:
```bash
cd avatar-web/server && npm run typecheck && node --import tsx --test src/game/farmData.test.ts
```
Expected: Typecheck pass, all tests pass.
Commit: `git commit -m "feat(farm): add water and fertilizer fallback names to KNOWN_PRODUCE_NAME_MAP"`

---

### Task 2: Ánh xạ tên cây và vật phẩm trong `autoFarm.ts`

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:855-875` (autoBuy), `:1080-1085` (harvest), `:1140-1170` (plant), `:1180-1205` (care), `:1320-1340` (animals), `:1550-1558` (produce sales)

**Interfaces:**
- Consumes: `getProduceOrItemName`, `this.client.trees`, `this.client.items`
- Produces: Nhật ký thân thiện, hiển thị tên cây trồng & vật phẩm.

- [x] **Step 1: Impact analysis `runCycle`.**
Run:
```bash
gitnexus_impact({target: "runCycle", direction: "upstream", repo: "learning-reverse"})
```

- [x] **Step 2: Thêm helper `nameOf` và cập nhật các dòng log trong `autoFarm.ts`.**
Định nghĩa helper trong `runCycle`:
```ts
const nameOf = (id: number) => getProduceOrItemName(id, this.client.trees, this.client.items);
```

Cập nhật AutoBuy:
```ts
note(`bỏ mua ${nameOf(id)}: chưa biết giá`);
note(`dừng mua ${nameOf(id)}: vượt trần ${cfg.buyBudgetXu} xu`);
note(`mua ${nameOf(id)} ×${lot} (~${lot * price} xu)`);
```

Cập nhật Pha 1 (Thu hoạch):
```ts
const treeName = c.idTree !== -1 ? nameOf(c.idTree) : '';
const harvestDesc = treeName ? `thu hoạch ${treeName}` : 'thu hoạch';
note(`[cây] ô ${c.index}: ${harvestDesc} (+${result.value.quantity}), làm đất`);
```

Cập nhật Pha 3 (Gieo hạt & Chăm sóc):
```ts
if (!knownSeeds.has(plannedSeedId)) {
  note(`[cây] ô ${entry.index}: bỏ qua hạt ${nameOf(plannedSeedId)} (#${plannedSeedId}) — không có trong catalog cây`);
  continue;
}
if ((seedInventory.get(plannedSeedId) ?? 0) <= 0) {
  note(`[cây] ô ${entry.index}: bỏ qua — thiếu hạt ${nameOf(plannedSeedId)} trong kho`);
  continue;
}
// ...
if (plantResult.status === 'confirmed') {
  seedInventory.set(plannedSeedId, (seedInventory.get(plannedSeedId) ?? 0) - 1);
  note(`[cây] ô ${entry.index}: trồng ${nameOf(plannedSeedId)}`);
  plantedIndices.add(entry.index);
} else {
  note(`[cây] ô ${entry.index}: server im lặng — trồng ${nameOf(plannedSeedId)} chưa nhận xác nhận, bỏ qua`);
}
```

Cập nhật Chăm sóc ô:
```ts
if (c.isArid && waterItemId !== undefined) {
  this.client.farm.useItem(idFarm, c.index, waterItemId);
  sent += 1;
  did.push('tưới');
  await confirm(65, `tưới ô ${c.index}`);
  await tick();
}
if (c.isGrass && grassItemId !== undefined) {
  this.client.farm.useItem(idFarm, c.index, grassItemId);
  sent += 1;
  did.push('nhổ cỏ');
  await confirm(65, `nhổ cỏ ô ${c.index}`);
  await tick();
}
if (c.isWorm && wormItemId !== undefined) {
  this.client.farm.useItem(idFarm, c.index, wormItemId);
  sent += 1;
  did.push('bắt sâu');
  await confirm(65, `bắt sâu ô ${c.index}`);
  await tick();
}
if (cfg.fertilizeCells && c.idTree !== -1 && c.vitalityPer < cfg.minVitality) {
  this.client.farm.useItem(idFarm, c.index, ITEM_FERTILIZER);
  sent += 1;
  did.push('bón phân');
  await confirm(65, `bón phân ô ${c.index}`);
  await tick();
}
```

Cập nhật Chăm sóc vật nuôi & Bán nông sản:
```ts
did.push('chữa bệnh (Thuốc cúm & Thuốc tiêu chảy)');
// ...
did.push(`cho ăn ${nameOf(food)}`);
// ...
note(`  - ${nameOf(r.itemId)}: đăng ${r.listedLots} lô (${r.listedQuantity} sản phẩm)`);
note(`  - ${nameOf(r.itemId)}: bỏ qua (${r.skippedReason})`);
```

- [x] **Step 3: Verify toàn diện & Commit Task 2.**
Run:
```bash
cd avatar-web/server && npm run typecheck && node --import tsx --test src/game/farmData.test.ts src/game/client.test.ts src/autoFarm.test.ts
```
Expected: Typecheck sạch, tất cả test cases pass.
Run: `gitnexus_detect_changes({scope: "staged"})`.
Commit: `git commit -m "feat(farm): display tree and item names in autofarm logs"`
