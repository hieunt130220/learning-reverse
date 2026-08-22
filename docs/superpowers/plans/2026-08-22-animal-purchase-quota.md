# Animal Purchase Quota Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Mua bù vật nuôi theo quota loài trong phần kế hoạch tương ứng sức chứa thực tế, không đối chiếu `slotIndex` logic với index vật lý của server.

**Architecture:** Giữ nguyên UI, API, DB và kiểu `AnimalPlanEntry`; chỉ thay giai đoạn mua trong `AutoFarm`. Mỗi nhóm hồ/chuồng lấy prefix kế hoạch theo capacity, gom quota theo species, trừ số con hiện có cùng species rồi gửi lệnh mua tuần tự trong số chỗ còn lại; state cục bộ chỉ cập nhật counter, không tạo animal giả với index suy đoán.

**Tech Stack:** TypeScript 5.7, Node.js 22, `EventEmitter`, Node built-in test runner, GitNexus MCP.

**Spec:** `docs/superpowers/specs/2026-08-22-animal-purchase-quota-design.md`

## Global Constraints

- Giữ nguyên UI editor, dải kế hoạch logic 20 slot chuồng / 10 slot hồ, DTO, REST API, parser config, SQLite schema và dữ liệu đã lưu.
- `AnimalPlanEntry.slotIndex` là vị trí logic; không dùng nó làm `FarmAnimal.index` hoặc tham số slot vật lý.
- Capacity hồ là `farm.pondAnimalSlots.length`; capacity chuồng là `farm.barnAnimalSlots.length`.
- Chỉ entry có `Number.isInteger(slotIndex)`, `slotIndex >= 0` và `slotIndex < capacity` nằm trong quota hiệu lực.
- `breed` tăng quota; `skip` và vị trí không có entry không tạo quota, không dồn entry phía sau lên trước.
- Loài hồ được nhận diện bằng helper domain `isPondSpecies`; các loài còn lại thuộc chuồng.
- Con dư hoặc ngoài quota vẫn chiếm capacity; không bán, thay thế hoặc sắp xếp lại trong giai đoạn mua.
- Xử lý hồ trước chuồng; trong nhóm xử lý species theo lần xuất hiện đầu tiên trong plan hiệu lực.
- Khi server từ chối hoặc timeout, dừng nhóm hiện tại và tiếp tục task AutoFarm kế tiếp.
- Sau event tiền thành công mà farm state chưa cập nhật, chỉ cập nhật counter cục bộ; không thêm `FarmAnimal` giả.
- Không tạo test file mới. Theo quy định project, viết production code trước rồi mới cập nhật test hiện có; không dùng TDD.
- Trước khi sửa mỗi symbol, bắt buộc chạy GitNexus impact upstream và báo blast radius; cảnh báo và dừng xin xác nhận nếu risk HIGH hoặc CRITICAL.
- Trước commit, bắt buộc chạy `gitnexus_detect_changes({scope: "compare", base_ref: "main"})`.
- Chỉ commit khi người dùng đã cho phép hành động commit; nếu chưa có quyền commit, đánh dấu Step Commit là chờ duyệt thay vì tự commit.

---

### Task 1: Thay thuật toán mua theo slot bằng quota theo loài

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:4-22,646-773`
- Test: Không sửa test trong task này; xác minh production code bằng typecheck theo quy tắc no-TDD của project.

**Interfaces:**
- Consumes: `AnimalPlanEntry`, `FarmAnimal`, `FarmState.pondAnimalSlots`, `FarmState.barnAnimalSlots`, `isPondSpecies(species: number): boolean`, `AutoFarmClient.farm.buyAnimal(idAnimal: number, typeBuy: number): void`.
- Produces: Giai đoạn mua trong `AutoFarm.runCycle()` tính `Map<number, number>` quota/current theo nhóm và gửi đúng chuỗi `buyAnimal`; không tạo API hoặc export mới.

- [x] **Step 1: Chạy impact analysis trước khi sửa symbol**

Run:

```text
mcp__gitnexus__impact({
  target: "AutoFarm.runCycle",
  direction: "upstream",
  maxDepth: 3,
  relationTypes: ["CALLS", "IMPORTS"],
  includeTests: true,
  minConfidence: 0.7,
  repo: "learning-reverse"
})
```

Expected: báo risk, direct callers và affected processes. Nếu GitNexus không resolve method name, chạy lại với `target: "AutoFarm"`. Nếu risk HIGH/CRITICAL, báo người dùng và chờ xác nhận trước Step 2.

Không sửa `isPondSpecies`; helper này đã được export từ `farmData.ts` và chỉ cần import vào `autoFarm.ts`, nên không cần thay đổi symbol domain.

- [x] **Step 2: Import helper phân loại species hồ**

Trong import từ `./game/farmData.js`, thêm `isPondSpecies` cạnh các helper domain khác:

```ts
import {
  GROWN_PERCENT,
  ITEM_DIARRHEA_CURE,
  ITEM_FERTILIZER,
  ITEM_FLU_CURE,
  ITEM_TONIC,
  NEAR_DEATH_RATIO,
  SHOP_XU,
  SPECIES_SELL_NEAR_DEATH,
  SPECIES_SELL_WHEN_GROWN,
  foodForSpecies,
  isCellRipe,
  isPondSpecies,
  parseAnimalSpec,
  isCellSpent,
  DEFAULT_FOOD_CATALOG,
  // existing type imports remain unchanged
} from './game/farmData.js';
```

Không thêm bảng `[54, 59]` cục bộ và không sửa `farmData.ts`.

- [x] **Step 3: Thay cấu trúc nhóm mua bằng plan, capacity và bộ lọc current**

Thay `pondBySlot`, `barnBySlot`, `occupied` và `targets` bằng cấu trúc nhóm sau trong phần `MUA VẬT NUÔI THEO KẾ HOẠCH`:

```ts
const planGroups = [
  {
    name: 'ao',
    plan: cfg.pondAnimalPlan ?? [],
    capacity: farm.pondAnimalSlots.length,
    accepts: (animal: FarmAnimal) => isPondSpecies(animal.species),
  },
  {
    name: 'chuồng',
    plan: cfg.barnAnimalPlan ?? [],
    capacity: farm.barnAnimalSlots.length,
    accepts: (animal: FarmAnimal) => !isPondSpecies(animal.species),
  },
] as const;

let boughtThisRound = 0;
for (const group of planGroups) {
  if (group.capacity <= 0 || group.plan.length === 0) continue;

  const targetBySpecies = new Map<number, number>();
  const orderedSpecies: number[] = [];
  const effectivePlan = [...group.plan]
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .filter((entry) => Number.isInteger(entry.slotIndex)
      && entry.slotIndex >= 0
      && entry.slotIndex < group.capacity);

  for (const entry of effectivePlan) {
    if (entry.action !== 'breed') continue;
    if (!targetBySpecies.has(entry.speciesId)) orderedSpecies.push(entry.speciesId);
    targetBySpecies.set(entry.speciesId, (targetBySpecies.get(entry.speciesId) ?? 0) + 1);
  }

  const currentAnimals = farm.animals.filter(group.accepts);
  const currentBySpecies = new Map<number, number>();
  for (const animal of currentAnimals) {
    currentBySpecies.set(animal.species, (currentBySpecies.get(animal.species) ?? 0) + 1);
  }
  let remainingCapacity = Math.max(0, group.capacity - currentAnimals.length);
```

Yêu cầu:

- Không lọc plan bằng `farm.animalSlots` hoặc index của con hiện có.
- `skip` vẫn nằm trong prefix logic nhưng không tạo quota.
- Entry ngoài capacity không được dồn vào prefix.
- Species current không nằm trong quota vẫn được tính trong `currentAnimals.length`.

- [x] **Step 4: Ghi log tóm tắt quota theo tên loài**

Ngay sau khi có quota/current, tạo formatter cục bộ dùng catalog hiện có:

```ts
const speciesName = (speciesId: number): string =>
  this.client.animals.find((animal) => animal.id === speciesId)?.name
    ?? `loài #${speciesId}`;
const quotaSummary = orderedSpecies
  .map((speciesId) => `${speciesName(speciesId)} ${targetBySpecies.get(speciesId) ?? 0}`)
  .join(' / ');
note(`kế hoạch ${group.name}: sức chứa ${group.capacity}, hiện có ${currentAnimals.length}, quota ${quotaSummary || 'trống'}`);
```

Nếu `orderedSpecies.length === 0`, không gửi lệnh mua cho nhóm. Log phải nói quota trống hoặc không có quota hiệu lực; không dùng “slot N” để mô tả lần mua.

- [x] **Step 5: Lặp theo species và tính số cần mua**

Thay vòng lặp `for (const slot of targets)` bằng:

```ts
for (const speciesId of orderedSpecies) {
  if (this.aborted || remainingCapacity === 0) break;
  const target = targetBySpecies.get(speciesId) ?? 0;
  const current = currentBySpecies.get(speciesId) ?? 0;
  const missing = Math.max(0, target - current);
  const toBuy = Math.min(missing, remainingCapacity);

  for (let purchaseIndex = 0; purchaseIndex < toBuy; purchaseIndex += 1) {
    if (this.aborted) return;
    const countBeforeCommand = this.client.farmState?.animals.length ?? farm.animals.length;
```

`toBuy` phải được tính trước khi gửi lệnh cho species; sau thành công vẫn cập nhật `currentBySpecies` để summary/state nội bộ đúng, nhưng không tăng `toBuy` quá quota ban đầu.

- [x] **Step 6: Giữ cơ chế xác nhận nhưng dùng baseline, không dùng mảng farm mutable làm chuẩn**

Giữ Promise/event cleanup hiện tại, nhưng thay callback `onFarm` bằng baseline của từng command:

```ts
onFarm = () => {
  const currentCount = this.client.farmState?.animals.length ?? 0;
  if (currentCount > countBeforeCommand) {
    finish({ ok: true });
  }
};
```

Các callback còn lại giữ contract:

```ts
onMoney = (money: any) => {
  if (money && typeof money.delta === 'number' && money.delta < 0) {
    finish({ ok: true });
  }
};

onDialog = (reason: string) => {
  finish({ ok: false, reason });
};
```

Timeout vẫn là 2 giây. Cleanup phải gỡ đủ listener `money`, `dialog`, `farm` như code hiện tại.

- [x] **Step 7: Cập nhật counter sau mua, không tạo animal giả**

Sau `buyAnimal(speciesId, SHOP_XU)` và khi `buyResult.ok`:

```ts
boughtThisRound += 1;
const boughtForSpecies = (currentBySpecies.get(speciesId) ?? 0) - current + 1;
note(`mua bù vật nuôi ${group.name}: ${speciesName(speciesId)} ${boughtForSpecies}/${missing}`);
currentBySpecies.set(speciesId, (currentBySpecies.get(speciesId) ?? 0) + 1);
remainingCapacity -= 1;
await tick();
```

Xóa toàn bộ logic sau khỏi implementation cũ:

```ts
occupied.add(slot);
farm.animals.push({ index: slot, ... });
const added = ...;
for (const a of added) occupied.add(a.index);
```

Không mutate `farm.animals` sau event tiền. Nếu event `farm` đã cập nhật `client.farmState`, dữ liệu thật vẫn thuộc quyền GameClient; vòng mua hiện tại tiếp tục dựa vào counter local để tránh phụ thuộc timing.

- [x] **Step 8: Dừng nhóm khi server từ chối và log quota còn thiếu khi hết chỗ**

Dùng cờ cục bộ để thoát cả vòng species của nhóm khi một lệnh thất bại:

```ts
let groupRejected = false;
// inside failed buy branch:
const detail = buyResult.reason ? ` (${buyResult.reason})` : '';
note(`dừng mua vật nuôi ${group.name}: server từ chối khi mua ${speciesName(speciesId)}${detail} — sang task kế`);
groupRejected = true;
break;
// after inner loop:
if (groupRejected) break;
```

Sau vòng species, nếu `remainingCapacity === 0`, tính tổng thiếu còn lại từ `targetBySpecies` và `currentBySpecies`. Chỉ log nhóm đầy nếu tổng thiếu còn lớn hơn 0:

```ts
const stillMissing = orderedSpecies.reduce(
  (sum, speciesId) => sum + Math.max(
    0,
    (targetBySpecies.get(speciesId) ?? 0) - (currentBySpecies.get(speciesId) ?? 0),
  ),
  0,
);
if (!groupRejected && remainingCapacity === 0 && stillMissing > 0) {
  note(`vật nuôi ${group.name} đã đầy, còn thiếu ${stillMissing} con theo quota`);
}
```

Giữ log cuối `không cần mua bù vật nuôi theo quota` khi `boughtThisRound === 0`, nhưng không ghi “không còn slot trống theo kế hoạch” vì đó là ngữ nghĩa cũ.

- [x] **Step 9: Typecheck production code**

Run:

```bash
cd avatar-web/server && npm run typecheck
```

Expected: exit code 0, không có TypeScript error. Nếu lỗi nằm ở type inference của `planGroups`, khai báo type cục bộ rõ ràng với `plan: AnimalPlanEntry[]`, `capacity: number`, `accepts: (animal: FarmAnimal) => boolean`; không dùng `any` để né lỗi ngoài payload event đang có sẵn.

- [x] **Step 10: Review diff của Task 1**

Run:

```bash
git diff --check
git diff -- avatar-web/server/src/autoFarm.ts
```

Expected:

- Chỉ import `isPondSpecies` và thay block mua vật nuôi.
- Không có thay đổi UI/DB/API.
- Không còn `farm.animals.push` trong block mua.
- Không còn log mua theo `slot`.

- [x] **Step 11: Commit production change — gộp vào commit hoàn tất theo yêu cầu user**

Chỉ chạy nếu người dùng đã cho phép commit:

```bash
git add avatar-web/server/src/autoFarm.ts
git commit -m "fix(auto): mua bù vật nuôi theo quota"
```

Nếu chưa được phép commit, dừng tại đây và báo Task 1 đã sẵn sàng nhưng Step Commit đang chờ duyệt.

---

### Task 2: Cập nhật test hiện có cho quota, capacity và phản hồi chậm

**Files:**
- Modify: `avatar-web/server/src/autoFarm.test.ts:55-83,153-169,683-777`
- Test: `avatar-web/server/src/autoFarm.test.ts`

**Interfaces:**
- Consumes: Hành vi production từ Task 1; `FakeClient`, `animal()`, `runOneCycle()`; `FarmState.pondAnimalSlots` và `FarmState.barnAnimalSlots`.
- Produces: Regression coverage cho quota theo species, prefix capacity, `skip`, species dư chiếm chỗ, thứ tự hồ/chuồng, server từ chối và event tiền không kèm farm refresh.

- [x] **Step 1: Chạy impact analysis trước khi sửa helper test**

Run:

```text
mcp__gitnexus__impact({
  target: "FakeClient",
  direction: "upstream",
  maxDepth: 2,
  relationTypes: ["CALLS"],
  includeTests: true,
  minConfidence: 0.7,
  repo: "learning-reverse"
})
```

Expected: phạm vi chỉ trong `autoFarm.test.ts` hoặc LOW risk. Nếu GitNexus không index class test, ghi nhận tool không resolve và dùng `context({name: "FakeClient", file_path: "avatar-web/server/src/autoFarm.test.ts"})` trước khi edit.

- [x] **Step 2: Cho FakeClient mô phỏng success chỉ qua event tiền**

Thêm flag cạnh `honorBuyAnimal`:

```ts
/** Khi false, mua thành công chỉ phát money; farm state chưa kịp refresh. */
syncFarmAfterBuy = true;
```

Sửa `buyAnimal` để luôn phát money khi `honorBuyAnimal`, nhưng chỉ mutate/emit farm khi flag bật:

```ts
buyAnimal: (idAnimal: number, typeBuy: number): void => {
  this.calls.push(`buyAnimal:${idAnimal}:${typeBuy}`);
  this.echo(51);
  if (this.honorBuyAnimal) {
    if (this.syncFarmAfterBuy) {
      const slot = this.nextAnimalSlot();
      this.farmState.animals.push(animal(slot, { species: idAnimal, bornTime: 0 }));
    }
    queueMicrotask(() => {
      this.emit('money', { delta: -2000, type: 1, balance: 10000 });
      if (this.syncFarmAfterBuy) this.emit('farm', this.farmState);
    });
  } else {
    queueMicrotask(() => {
      this.emit('dialog', 'Bạn không thể mua thêm vì nông trại đã hết chỗ.');
    });
  }
},
```

Không thay đổi default `syncFarmAfterBuy = true`, để các test khác giữ hành vi hiện tại.

- [x] **Step 3: Thay test mua cũ bằng case hồ trước, chuồng sau theo quota**

Thay test tại vùng cũ `mua hết vật nuôi...` bằng case có capacity rõ ràng:

```ts
test('mua bù quota vật nuôi theo loài, ao trước chuồng sau', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [animal(0, { species: 59 }), animal(2, { species: 55 })],
    animalSlots: [0, 1, 2, 3, 4, 5],
    pondAnimalSlots: [0, 1],
    barnAnimalSlots: [2, 3, 4, 5],
    updatedAt: Date.now(),
  });
  client.animals.push(
    { id: 54, name: 'Cá chép', desc: '' },
    { id: 55, name: 'Vịt', desc: '' },
  );

  const auto = await runOneCycle(client, {
    harvest: false,
    pondAnimalPlan: [
      { slotIndex: 0, action: 'breed', speciesId: 59 },
      { slotIndex: 1, action: 'breed', speciesId: 54 },
    ],
    barnAnimalPlan: [
      { slotIndex: 0, action: 'breed', speciesId: 50 },
      { slotIndex: 1, action: 'breed', speciesId: 50 },
      { slotIndex: 2, action: 'breed', speciesId: 55 },
      { slotIndex: 3, action: 'breed', speciesId: 55 },
    ],
  }, { sleep: () => Promise.resolve() });

  assert.deepEqual(
    client.calls.filter((call) => call.startsWith('buyAnimal:')),
    ['buyAnimal:54:1', 'buyAnimal:50:1', 'buyAnimal:50:1', 'buyAnimal:55:1'],
  );
  assert.ok(auto.state().lastActions.some((line) => line.includes('kế hoạch ao: sức chứa 2')));
  assert.ok(auto.state().lastActions.some((line) => line.includes('mua bù vật nuôi chuồng: Gà')));
  assert.equal(auto.state().lastActions.some((line) => line.includes(' slot ')), false);
});
```

Case này chứng minh:

- Rùa hiện có đáp ứng quota Rùa.
- Cá chép thiếu được mua trước.
- Chuồng hiện có 1 Vịt; quota `2 Gà + 2 Vịt`; mua `2 Gà + 1 Vịt`.
- Index vật lý 2 của Vịt không cần khớp vị trí logic của Vịt trong plan.

- [x] **Step 4: Thêm regression chính `5 Gà + 5 Vịt + 5 Gà`, current 5 Vịt**

```ts
test('capacity 10 chỉ lấy prefix 5 Gà 5 Vịt và mua bù 5 Gà', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: Array.from({ length: 5 }, (_, index) => animal(index + 2, { species: 55 })),
    animalSlots: Array.from({ length: 12 }, (_, index) => index),
    pondAnimalSlots: [0, 1],
    barnAnimalSlots: Array.from({ length: 10 }, (_, index) => index + 2),
    updatedAt: Date.now(),
  });
  client.animals.push({ id: 55, name: 'Vịt', desc: '' });
  const barnAnimalPlan = [
    ...Array.from({ length: 5 }, (_, slotIndex) => ({ slotIndex, action: 'breed' as const, speciesId: 50 })),
    ...Array.from({ length: 5 }, (_, offset) => ({ slotIndex: offset + 5, action: 'breed' as const, speciesId: 55 })),
    ...Array.from({ length: 5 }, (_, offset) => ({ slotIndex: offset + 10, action: 'breed' as const, speciesId: 50 })),
  ];

  await runOneCycle(client, { harvest: false, barnAnimalPlan }, { sleep: () => Promise.resolve() });

  assert.deepEqual(
    client.calls.filter((call) => call.startsWith('buyAnimal:')),
    Array.from({ length: 5 }, () => 'buyAnimal:50:1'),
  );
});
```

Entry Gà ở logical slot 10–14 không được tính vì capacity là 10.

- [x] **Step 5: Thêm regression current `3 Gà + 1 Vịt`**

```ts
test('quota 5 Gà 5 Vịt mua bù 2 Gà rồi 4 Vịt', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [
      animal(2, { species: 50 }),
      animal(7, { species: 55 }),
      animal(9, { species: 50 }),
      animal(11, { species: 50 }),
    ],
    animalSlots: Array.from({ length: 12 }, (_, index) => index),
    pondAnimalSlots: [0, 1],
    barnAnimalSlots: Array.from({ length: 10 }, (_, index) => index + 2),
    updatedAt: Date.now(),
  });
  client.animals.push({ id: 55, name: 'Vịt', desc: '' });
  const barnAnimalPlan = [
    ...Array.from({ length: 5 }, (_, slotIndex) => ({ slotIndex, action: 'breed' as const, speciesId: 50 })),
    ...Array.from({ length: 5 }, (_, offset) => ({ slotIndex: offset + 5, action: 'breed' as const, speciesId: 55 })),
  ];

  await runOneCycle(client, { harvest: false, barnAnimalPlan }, { sleep: () => Promise.resolve() });

  assert.deepEqual(client.calls.filter((call) => call.startsWith('buyAnimal:')), [
    'buyAnimal:50:1',
    'buyAnimal:50:1',
    'buyAnimal:55:1',
    'buyAnimal:55:1',
    'buyAnimal:55:1',
    'buyAnimal:55:1',
  ]);
});
```

Các physical index cố ý không theo thứ tự logic để chứng minh thuật toán chỉ đếm species.

- [x] **Step 6: Thêm case loài dư chiếm capacity và chỉ mua đến khi đầy**

```ts
test('vật nuôi dư quota vẫn chiếm chỗ, chỉ mua đến capacity', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: Array.from({ length: 7 }, (_, index) => animal(index + 2, { species: 55 })),
    animalSlots: Array.from({ length: 12 }, (_, index) => index),
    pondAnimalSlots: [0, 1],
    barnAnimalSlots: Array.from({ length: 10 }, (_, index) => index + 2),
    updatedAt: Date.now(),
  });
  client.animals.push({ id: 55, name: 'Vịt', desc: '' });
  const barnAnimalPlan = [
    ...Array.from({ length: 5 }, (_, slotIndex) => ({ slotIndex, action: 'breed' as const, speciesId: 50 })),
    ...Array.from({ length: 5 }, (_, offset) => ({ slotIndex: offset + 5, action: 'breed' as const, speciesId: 55 })),
  ];

  const auto = await runOneCycle(client, { harvest: false, barnAnimalPlan }, { sleep: () => Promise.resolve() });

  assert.deepEqual(
    client.calls.filter((call) => call.startsWith('buyAnimal:')),
    ['buyAnimal:50:1', 'buyAnimal:50:1', 'buyAnimal:50:1'],
  );
  assert.ok(auto.state().lastActions.some((line) => line.includes('chuồng đã đầy') && line.includes('còn thiếu 2')));
});
```

Không assert lệnh bán trong test này vì logic bán là phase độc lập; các con Vịt non không thuộc điều kiện bán.

- [x] **Step 7: Cập nhật case quota đủ, skip và entry ngoài capacity**

Thay hai test cũ “mọi slot kế hoạch đã có con” và “slot skip...” bằng hai case:

```ts
test('đủ quota theo loài thì không mua dù physical index không khớp plan', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [
      animal(5, { species: 55 }),
      animal(2, { species: 50 }),
      animal(3, { species: 55 }),
      animal(4, { species: 50 }),
    ],
    animalSlots: [0, 1, 2, 3, 4, 5],
    pondAnimalSlots: [0, 1],
    barnAnimalSlots: [2, 3, 4, 5],
    updatedAt: Date.now(),
  });
  await runOneCycle(client, {
    harvest: false,
    barnAnimalPlan: [
      { slotIndex: 0, action: 'breed', speciesId: 50 },
      { slotIndex: 1, action: 'breed', speciesId: 50 },
      { slotIndex: 2, action: 'breed', speciesId: 55 },
      { slotIndex: 3, action: 'breed', speciesId: 55 },
    ],
  }, { sleep: () => Promise.resolve() });

  assert.equal(client.calls.some((call) => call.startsWith('buyAnimal:')), false);
});

test('skip không tạo quota và entry ngoài capacity không bị dồn vào prefix', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [],
    animalSlots: [0, 1, 2, 3],
    pondAnimalSlots: [0, 1],
    barnAnimalSlots: [2, 3],
    updatedAt: Date.now(),
  });
  await runOneCycle(client, {
    harvest: false,
    barnAnimalPlan: [
      { slotIndex: 0, action: 'breed', speciesId: 50 },
      { slotIndex: 1, action: 'skip' },
      { slotIndex: 2, action: 'breed', speciesId: 55 },
    ],
  }, { sleep: () => Promise.resolve() });

  assert.deepEqual(
    client.calls.filter((call) => call.startsWith('buyAnimal:')),
    ['buyAnimal:50:1'],
  );
});
```

Capacity chuồng 2 chỉ xét logical slot 0 và 1; Vịt ở slot 2 không được kéo vào thay `skip`.

- [x] **Step 8: Giữ và điều chỉnh test server từ chối theo capacity/quota**

Cập nhật fixture test từ chối để có slot arrays và logical plan 0/1:

```ts
const client = new FakeClient({
  idFarm: 1,
  cells: [],
  animals: [],
  animalSlots: [0, 1],
  pondAnimalSlots: [],
  barnAnimalSlots: [0, 1],
  updatedAt: Date.now(),
});
client.honorBuyAnimal = false;
const auto = await runOneCycle(client, {
  harvest: false,
  barnAnimalPlan: [
    { slotIndex: 0, action: 'breed', speciesId: 52 },
    { slotIndex: 1, action: 'breed', speciesId: 55 },
  ],
}, { sleep: () => Promise.resolve() });
```

Giữ assertions:

```ts
assert.deepEqual(
  client.calls.filter((call) => call.startsWith('buyAnimal:')),
  ['buyAnimal:52:1'],
);
assert.ok(auto.state().lastActions.some(
  (line) => line.includes('dừng mua vật nuôi chuồng')
    && line.includes('Heo')
    && line.includes('hết chỗ'),
));
```

- [x] **Step 9: Thêm test success chỉ qua money event**

```ts
test('money success không có farm refresh vẫn không mua vượt quota hoặc capacity', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [],
    animalSlots: [0, 1, 2],
    pondAnimalSlots: [],
    barnAnimalSlots: [0, 1, 2],
    updatedAt: Date.now(),
  });
  client.syncFarmAfterBuy = false;

  await runOneCycle(client, {
    harvest: false,
    barnAnimalPlan: [
      { slotIndex: 0, action: 'breed', speciesId: 50 },
      { slotIndex: 1, action: 'breed', speciesId: 50 },
      { slotIndex: 2, action: 'breed', speciesId: 55 },
    ],
  }, { sleep: () => Promise.resolve() });

  assert.deepEqual(client.calls.filter((call) => call.startsWith('buyAnimal:')), [
    'buyAnimal:50:1',
    'buyAnimal:50:1',
    'buyAnimal:55:1',
  ]);
  assert.deepEqual(client.farmState.animals, [], 'test mode cố ý chưa refresh farm state');
});
```

Case này bắt buộc implementation dựa vào counter local thay vì chèn `FarmAnimal` giả hoặc chờ state refresh.

- [x] **Step 10: Chạy riêng test AutoFarm**

Run:

```bash
cd avatar-web/server && node --import tsx --test src/autoFarm.test.ts
```

Expected: toàn bộ test trong file PASS; không có timeout 2 giây ở case mua thành công; case từ chối chỉ gửi một lệnh.

- [x] **Step 11: Chạy typecheck và toàn bộ server test suite**

Run:

```bash
cd avatar-web/server && npm run typecheck && npm test
```

Expected: cả hai command exit code 0; không có regression ở farm decoder, session hoặc config tests.

- [x] **Step 12: Kiểm tra diff và phạm vi ảnh hưởng trước commit**

Run:

```bash
git diff --check
git diff -- avatar-web/server/src/autoFarm.ts avatar-web/server/src/autoFarm.test.ts
git status --short
```

Sau đó bắt buộc chạy:

```text
mcp__gitnexus__detect_changes({
  scope: "compare",
  base_ref: "main",
  repo: "learning-reverse"
})
```

Expected:

- Changed symbols chỉ thuộc thuật toán mua trong `AutoFarm` và fixture/tests liên quan.
- Affected execution flows chỉ nằm trong AutoFarm/session flow dự kiến.
- Không có UI, API route, DB schema hoặc protocol encoder bị thay đổi.

Nếu detect_changes báo scope ngoài dự kiến, dừng và điều tra trước commit.

- [x] **Step 13: Commit test — gộp vào commit hoàn tất theo yêu cầu user**

Chỉ chạy nếu người dùng đã cho phép commit:

```bash
git add avatar-web/server/src/autoFarm.test.ts
git commit -m "test(auto): kiểm tra quota mua vật nuôi"
```

Nếu Task 1 chưa commit riêng vì chưa được phép, và người dùng sau đó muốn một commit duy nhất, stage cả production + test và dùng:

```bash
git add avatar-web/server/src/autoFarm.ts avatar-web/server/src/autoFarm.test.ts
git commit -m "fix(auto): mua bù vật nuôi theo quota"
```

Không stage file ngoài Spec, Plan và hai file implementation đã nêu nếu chưa được người dùng yêu cầu.

---

## Final Verification Checklist

- [x] Spec vẫn phản ánh đúng implementation: UI/DB không đổi, quota theo prefix capacity.
- [x] `npm run typecheck` trong `avatar-web/server` PASS.
- [x] `node --import tsx --test src/autoFarm.test.ts` PASS.
- [x] `npm test` trong `avatar-web/server` PASS.
- [x] Không còn code mua dựa vào `occupied.has(slot)` hoặc chèn animal giả bằng logical slot.
- [x] Log mua dùng quota/species, không dùng physical slot.
- [x] `git diff --check` PASS.
- [x] `gitnexus_detect_changes(compare, main)` chỉ ra đúng scope dự kiến.
- [x] Không commit nếu chưa có sự cho phép của người dùng.
