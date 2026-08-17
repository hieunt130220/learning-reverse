# Tự mua hạt giống khi auto trồng mà kho hết hạt — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi auto trồng cây mà kho thiếu hạt, `AutoFarm` tự mua bù hạt bằng xu (chỉ hạt xu id 0–10) rồi trồng tiếp các ô trống trong cùng vòng.

**Architecture:** Bổ sung hạt giống vào bản đồ nhu cầu vật phẩm (`need`) của `AutoFarm.runCycle` bằng cách đếm các ô sẽ trống trong vòng (đang trống, hoặc chín và được thu hoạch khi `harvest` bật), mirror đúng điều kiện giai đoạn trồng. Vòng mua bù tra giá hạt từ bảng cây (`TreeInfo.value`) thay vì chỉ bảng vật phẩm. Sau khi mua, gọi `getInventory()` và chờ gói 70 (server không tự đẩy gói này sau `doBuyItem`) để giai đoạn trồng thấy hạt vừa mua.

**Tech Stack:** Node.js + TypeScript, `node:test` (test hiện có của server), không thêm dependency.

**Spec:** `docs/superpowers/specs/2026-08-17-avatar-web-auto-buy-seeds-design.md`

## Global Constraints

- KHÔNG TDD: không viết test trước, không tạo test file mới. Chỉ CẬP NHẬT 1 test hiện có đang khẳng định hành vi cũ để suite không đỏ.
- Không sửa protocol/opcode/DB; không đổi cấu hình hoặc UI.
- Runtime `autoBuy` luôn bật (`makeConfig` ép `true`, `buyBudgetXu` vô hạn) — hạ tầng đã sẵn, chỉ thiếu hạt trong `need`.
- Chỉ tự mua hạt xu (id 0–10, `category: 'xu'`); hạt cao cấp (30–48) không tự mua vì `typeShop = 2` chưa xác định.
- Giữ style codebase: comment tiếng Việt ngắn, không thêm comment thừa.
- GitNexus: index stale + MCP không khả dụng trong phiên này → đã cross-reference thủ công (risk LOW, spec mục 6). Trước khi commit chạy `gitnexus_detect_changes` nếu CLI chạy được.
- KHÔNG `git commit` trừ khi user yêu cầu rõ ràng.

## Task 1: Thêm hằng `XU_SEED_IDS` vào catalog hạt

**Files:**
- Modify: `avatar-web/server/src/accounts/defaultSeedCatalog.ts`

**Interfaces:**
- Consumes: không có.
- Produces: `XU_SEED_IDS: ReadonlySet<number>` — dùng bởi Task 2.

- [ ] **Step 1: Thêm export hằng số**
Thêm cuối file (sau `DEFAULT_SEED_CATALOG`):

```ts
/** 11 hạt trồng bằng xu (typeShop = 1), id 0–10. Hạt cao cấp (30–48) chưa xác
 *  định loại tiền (`typeShop = 2`) nên không tự mua. */
export const XU_SEED_IDS: ReadonlySet<number> = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
```

- [ ] **Step 2: Verify typecheck**
Run: `node --import tsx -e "import('./src/accounts/defaultSeedCatalog.ts').then(m => console.log([...m.XU_SEED_IDS].join(',')))"`
Expected: `0,1,2,3,4,5,6,7,8,9,10`, không lỗi.

## Task 2: `AutoFarm.runCycle` — nhu cầu hạt, giá hạt, làm mới kho sau khi mua

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts`

**Interfaces:**
- Consumes: `XU_SEED_IDS` (Task 1), `DEFAULT_SEED_CATALOG` (đã import), `cellRipe`/`harvest` (đã có trong scope `runCycle`).
- Produces: helper private `refreshInventory()`; `need` giờ chứa cả hạt giống.

- [ ] **Step 1: Import `XU_SEED_IDS`**
Dòng 3 hiện có:

```ts
import { DEFAULT_SEED_CATALOG } from './accounts/defaultSeedCatalog.js';
```
sửa thành:

```ts
import { DEFAULT_SEED_CATALOG, XU_SEED_IDS } from './accounts/defaultSeedCatalog.js';
```

- [ ] **Step 2: Thêm helper private `refreshInventory()`**
Thêm cạnh `fetchTreeCatalog` (sau method đó, trước `runCycle`):

```ts
/**
 * Xin lại kho (cmd 70) và chờ gói trả về. Server KHÔNG tự đẩy gói 70 sau
 * doBuyItem (chỉ trả UPDATE_MONEY + echo 68 + dialog), nên mua xong phải gọi
 * thủ công thì các giai đoạn sau (trồng/chăm sóc) mới thấy hàng vừa mua.
 */
private async refreshInventory(): Promise<void> {
  const fresh = new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 5000);
    this.client.once('inventory', () => {
      clearTimeout(t);
      resolve();
    });
  });
  this.client.farm.getInventory();
  await fresh;
}
```

- [ ] **Step 3: Dùng helper ở đầu vòng thay đoạn lặp inline**
Thay khối `invFresh` (khoảng dòng 385–394) bằng:

```ts
// Kho PHẢI mới trước khi tính nhu cầu: nếu đọc kho rỗng (vd server vừa
// khởi động lại, chưa có gói 70 nào) thì auto-buy sẽ tưởng đang có 0 và
// mua thừa toàn bộ. Xin lại kho và chờ phản hồi.
await this.refreshInventory();
```

- [ ] **Step 4: Hoist `planByCell` + `knownSeeds` lên bước tính nhu cầu**
Trong khối `// --- Tính nhu cầu vật phẩm cho vòng này ---`, trước `const need`:

```ts
const planByCell = new Map(cfg.treeCellPlan?.map((entry) => [entry.cellIndex, entry]));
const knownSeeds = new Set<number>([
  ...DEFAULT_SEED_CATALOG.map((s) => s.id),
  ...this.client.trees.map((tree) => tree.id),
]);
```

Sau đó XÓA hai khai báo trùng `const planByCell = ...` và `const knownSeeds = ...` ở giai đoạn cây (khoảng dòng 706–709), chỉ giữ `const seedInventory = ...`.

- [ ] **Step 5: Bổ sung nhu cầu hạt giống**
Ngay sau khối `for (const c of farm.cells) { ... want(grassItemId) ... want(wormItemId) }` thêm:

```ts
// Hạt giống cho các ô sẽ trống trong vòng này: ô đang trống, hoặc ô chín được
// thu hoạch khi bật `harvest`. Chỉ đếm hạt giai đoạn trồng thật sự dùng (plan
// skip / hạt ngoài catalog / hạt cao cấp thì không), để auto-buy mua đúng số
// thiếu thay vì bỏ qua như trước.
const seedBuyableWithXu = (id: number): boolean => {
  const tree = this.client.trees.find((t) => t.id === id);
  if (tree !== undefined) return tree.category !== 'premium';
  return XU_SEED_IDS.has(id);
};
for (const c of farm.cells) {
  const plan = planByCell.get(c.index);
  const plannedSeedId = plan?.action === 'seed' ? plan.seedId : seedId;
  if (plan?.action === 'skip') continue;
  if (plannedSeedId === undefined || !knownSeeds.has(plannedSeedId)) continue;
  if (!seedBuyableWithXu(plannedSeedId)) continue;
  const willBeEmpty = c.idTree === -1 || (harvest && cellRipe(c));
  if (willBeEmpty) want(plannedSeedId);
}
```

- [ ] **Step 6: Tra giá hạt trong vòng mua bù**
Thay dòng:

```ts
const price = this.client.items.find((i) => i.id === id)?.price;
```
bằng:

```ts
// Hạt không nằm trong bảng vật phẩm (chỉ có 11 món tiêu dùng 111–124) — giá
// hạt lấy từ bảng cây (`value` = giá xu), fallback DEFAULT_SEED_CATALOG khi
// chưa có bảng cây.
const price = this.client.items.find((i) => i.id === id)?.price
  ?? this.client.trees.find((t) => t.id === id)?.value
  ?? DEFAULT_SEED_CATALOG.find((s) => s.id === id)?.value;
```

- [ ] **Step 7: Làm mới kho sau khi mua**
Thay cuối vòng mua:

```ts
if (spent > 0) await tick();
```
bằng:

```ts
if (spent > 0) {
  await tick();
  // Server không tự đẩy gói 70 sau khi mua — làm mới kho để giai đoạn trồng
  // cùng vòng thấy hạt vừa mua.
  await this.refreshInventory();
}
```

- [ ] **Step 8: Verify — test tập trung + typecheck**
Run: `timeout 240 node --import tsx --test src/autoFarm.test.ts 2>&1 | tail -12`
Expected: 1 test fail duy nhất là test đang khẳng định hành vi cũ (sẽ cập nhật ở Task 3), phần còn lại xanh; `tsc --noEmit` sạch.

## Task 3: Cập nhật test hiện có cho khớp hành vi mới

**Files:**
- Modify: `avatar-web/server/src/autoFarm.test.ts` (test `'không thay cây đang mọc và không trồng khi kho chỉ còn một hạt'` + `FakeClient.buyItem`)

**Interfaces:**
- Consumes: hành vi mới của `runCycle` (Task 2).
- Produces: suite xanh, có regression coverage cho luồng "thiếu hạt → mua bù → trồng tiếp".

- [ ] **Step 1: `FakeClient.buyItem` mô phỏng server cấp hàng**
Thay thân hiện tại:

```ts
buyItem: (id: number, num: number, typeShop: number): void => {
  this.calls.push(`buy:${id}x${num}`);
  this.echo(68);
  // Mô phỏng server cấp hàng: lần getInventory sau đó phải thấy hàng vừa mua.
  const existing = this.inventory.find((i) => i.id === id);
  if (existing) existing.num += num;
  else this.inventory.push({ id, num });
},
```

- [ ] **Step 2: Cập nhật test `'không thay cây đang mọc...'`**
Đổi tên và assertion: `autoBuy: true` + kho còn 1 hạt + 2 ô trống → phải mua bù `buy:5x1` rồi trồng cả 2 ô (7, 9); ô 2 đang mọc không bị thay:

```ts
test('không thay cây đang mọc; auto-buy mua bù hạt thiếu rồi trồng tiếp ô trống', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [cell(2, { idTree: 5 }), cell(7, { idTree: -1 }), cell(9, { idTree: -1 })],
    animals: [],
    updatedAt: 0,
  });
  client.trees = [tree(5)];
  client.inventory = [{ id: 5, num: 1 }];

  const auto = await runOneCycle(client, { seedId: 5, harvest: false, autoBuy: true });

  assert.deepEqual(
    client.calls.filter((call) => call.startsWith('plantSeed:')),
    ['plantSeed:7:5', 'plantSeed:9:5'],
  );
  assert.ok(client.calls.includes('buy:5x1'), 'phải mua bù đúng 1 hạt thiếu');
  assert.ok(auto.state().lastActions.some((line) => line.includes('mua #5')));
});
```

- [ ] **Step 3: Verify — chạy toàn bộ autoFarm tests**
Run: `timeout 240 node --import tsx --test src/autoFarm.test.ts 2>&1 | tail -12`
Expected: `pass 33`, `fail 0`.

## Task 4: Regression tổng thể

**Files:**
- Không đổi file; chạy verify toàn repo server.

- [ ] **Step 1: Chạy toàn bộ test server**
Run: `cd avatar-web/server && npm test > /tmp/server-test.log 2>&1; echo "EXIT:$?"; tail -20 /tmp/server-test.log`
Expected: `EXIT:0`, không fail.

- [ ] **Step 2: Typecheck + diff check**
Run: `cd avatar-web/server && npx tsc --noEmit` và `cd /Users/hieunt/learning-reverse && git diff --check`
Expected: sạch, không báo lỗi.

- [ ] **Step 3: GitNexus change detection (nếu CLI chạy được)**
Run: `npx gitnexus detect_changes` (hoặc ghi rõ giới hạn nếu network bị chặn)
Expected: thay đổi chỉ nằm trong `autoFarm.ts`, `defaultSeedCatalog.ts`, `autoFarm.test.ts`, spec/plan docs.

- [ ] **Step 4: Commit (chỉ khi user yêu cầu)**
`git add -A && git commit -m "fix(avatar-web): auto-buy mua bù hạt giống khi auto trồng hết hạt"`
Lưu ý: bỏ qua bước này nếu user không yêu cầu commit.
