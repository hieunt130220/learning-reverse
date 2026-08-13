# Auto-farm: nhịp nghỉ đều, thứ tự cây trước vật nuôi, log từng bước — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi ô và mỗi con vật đều tốn một nhịp nghỉ dù có việc hay không, làm hết cây rồi mới tới vật nuôi, bỏ trần lệnh mỗi vòng, và ghi một dòng nhật ký có mốc giờ cho từng đối tượng đã duyệt.

**Architecture:** `AutoFarm.runCycle()` gộp hai vòng lặp ô thành một giai đoạn cây và bốn vòng lặp vật nuôi thành một giai đoạn vật nuôi duyệt index giảm dần. Một closure `note()` đẩy mỗi dòng vào `lastActions` đồng thời phát sự kiện `log` mới; `AvatarSession.wire()` nối sự kiện đó vào `pushLog` sẵn có để dòng log có mốc giờ, vào đệm 500 dòng và chạy live qua WebSocket.

**Tech Stack:** TypeScript 5.7 strict, Node.js test runner (`node --import tsx --test`), EventEmitter.

**Spec:** [docs/superpowers/specs/2026-08-13-autofarm-nhip-thu-tu-log-design.md](../specs/2026-08-13-autofarm-nhip-thu-tu-log-design.md)

## Global Constraints

- Chỉ sửa `avatar-web/server/src/autoFarm.ts`, `avatar-web/server/src/session/avatarSession.ts` và hai file test tương ứng.
- Không đổi `avatar-web/web/`, REST API, schema SQLite hay hợp đồng WebSocket.
- Không đổi opcode, gói tin hay bất kỳ hành vi giao thức nào.
- Không đổi điều kiện quyết định: khi nào thu hoạch, khi nào bán, mua bao nhiêu.
- Không thêm jitter ngẫu nhiên; nhịp vẫn là hằng số `stepDelayMs`.
- Giữ `maxSellsPerCycle`. Chỉ bỏ `maxActionsPerCycle`.
- TypeScript `strict: true`; không thêm `any`, `@ts-ignore` hay type assertion mới.
- Mọi chuỗi log viết bằng tiếng Việt có dấu.
- `stepDelayMs` tối thiểu 300ms vẫn giữ nguyên; test phải dùng farm nhỏ để bộ test không chậm.
- Không commit file ngoài phạm vi task đang làm.

## File Structure

**Sửa:**

| File | Trách nhiệm |
|---|---|
| `avatar-web/server/src/autoFarm.ts` | Vòng chăm sóc: nhịp nghỉ, thứ tự hai giai đoạn, dòng log |
| `avatar-web/server/src/autoFarm.test.ts` | Test hành vi một vòng |
| `avatar-web/server/src/session/avatarSession.ts` | Nối sự kiện `log` của auto vào đệm nhật ký phiên |
| `avatar-web/server/src/session/avatarSession.test.ts` | Test nối dây và kiểm tra epoch |

Không tạo file mới. `autoFarm.ts` sau thay đổi ngắn hơn hiện tại vì sáu vòng lặp gộp còn hai.

---

### Task 1: Sự kiện log và đường dẫn tới nhật ký phiên

**Files:**

- Modify: `avatar-web/server/src/autoFarm.ts`
- Test: `avatar-web/server/src/autoFarm.test.ts`
- Modify: `avatar-web/server/src/session/avatarSession.ts`
- Test: `avatar-web/server/src/session/avatarSession.test.ts`

**Interfaces:**

- Produces: `AutoFarm` phát thêm sự kiện `log` với payload là một `string`. Các task sau dùng closure `note(line: string): void` bên trong `runCycle` để ghi mọi dòng.
- Consumes: `AvatarSession.pushLog(line: string)` và `AvatarSession.isCurrent(client, epoch)` đã có sẵn.

Task này **không đổi hành vi gửi lệnh**. Sau task này mọi dòng đang có (`[quét]`, `[tắt]`, `[đo]`, các dòng hành động) xuất hiện thêm ở panel Nhật ký kèm mốc giờ.

- [ ] **Step 1: Viết failing test cho sự kiện log**

Thêm vào cuối `avatar-web/server/src/autoFarm.test.ts`:

```ts
test('mỗi dòng ghi vào lastActions cũng phát ra sự kiện log', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [cell(0, { isArid: true })],
    animals: [],
    updatedAt: Date.now(),
  });
  const auto = new AutoFarm(client as unknown as GameClient);
  const logs: string[] = [];
  auto.on('log', (line: string) => logs.push(line));

  const done = new Promise<void>((resolve) =>
    auto.on('state', (s) => {
      if (s.cycle > 0) resolve();
    }),
  );
  auto.start({ waterItemId: ITEM_WATER, harvest: false, stepDelayMs: 300, startDelayMs: 0 });
  await done;
  auto.stop();

  assert.ok(logs.length > 0, 'phải phát ít nhất một dòng log');
  assert.deepEqual(logs, auto.state().lastActions, 'log và lastActions phải cùng một nguồn');
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/server
node --import tsx --test src/autoFarm.test.ts
```

Expected: FAIL — `logs.length` bằng 0 vì `AutoFarm` chưa phát sự kiện `log`.

- [ ] **Step 3: Thêm closure `note` và thay mọi `actions.push`**

Trong `avatar-web/server/src/autoFarm.ts`, ngay sau dòng `const actions: string[] = [];` ở đầu `runCycle()`, thêm:

```ts
    // Một nguồn, hai đích: panel Tự động đọc `lastActions`, còn nhật ký phiên
    // nhận sự kiện `log` để có mốc giờ thật và chạy live qua WebSocket.
    const note = (line: string): void => {
      actions.push(line);
      this.emit('log', line);
    };
```

Rồi đổi **mọi** lời gọi `actions.push(...)` trong `runCycle()` thành `note(...)`. Có 20 chỗ; kiểm tra bằng:

```bash
grep -c "actions.push(" src/autoFarm.ts
```

Expected sau khi sửa: `0`.

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `node --import tsx --test src/autoFarm.test.ts`

Expected: PASS toàn bộ file.

- [ ] **Step 5: Viết failing test cho việc nối dây ở AvatarSession**

Thêm vào cuối `avatar-web/server/src/session/avatarSession.test.ts`:

```ts
test('dòng log của auto-farm vào nhật ký phiên và ra ngoài qua onEvent', async () => {
  const h = harness({ autoEnabled: true });
  await h.session.start();

  const line = '[cây] ô 3: hạn -> tưới #100';
  h.autos[0].emit('log', line);

  assert.equal(h.session.snapshot().logs.at(-1)?.line, line);
  assert.ok(
    h.events.some((e) => e.type === 'log' && (e.payload as { line: string }).line === line),
    'phải đẩy ra ngoài qua onEvent để WebSocket thấy',
  );
});

test('dòng log từ auto của client đã bị thay thế bị bỏ qua', async () => {
  const h = harness({ autoEnabled: true });
  await h.session.start();
  const stale = h.autos[0];

  h.session.stop();
  const before = h.session.snapshot().logs.length;
  stale.emit('log', 'dòng của phiên cũ');

  assert.equal(h.session.snapshot().logs.length, before, 'epoch cũ không được ghi vào phiên mới');
});
```

- [ ] **Step 6: Chạy test để xác nhận thất bại**

Run: `node --import tsx --test src/session/avatarSession.test.ts`

Expected: FAIL ở test đầu — dòng cuối trong `logs` không phải dòng vừa phát, vì chưa ai nghe sự kiện `log` của auto.

- [ ] **Step 7: Nối sự kiện log trong `wire()`**

Trong `avatar-web/server/src/session/avatarSession.ts`, trong `wire()`, ngay dưới listener `this.auto!.on('state', ...)`, thêm:

```ts
    this.auto!.on('log', (line: string) => {
      if (this.isCurrent(client, epoch)) this.pushLog(line);
    });
```

- [ ] **Step 8: Chạy hai file test và typecheck**

Run:

```bash
node --import tsx --test src/autoFarm.test.ts src/session/avatarSession.test.ts
npm run typecheck
```

Expected: PASS cả hai.

- [ ] **Step 9: Commit**

```bash
cd /Users/devios/learning-reverse
git add avatar-web/server/src/autoFarm.ts avatar-web/server/src/autoFarm.test.ts \
  avatar-web/server/src/session/avatarSession.ts avatar-web/server/src/session/avatarSession.test.ts
git commit -m "feat(avatar-web): đẩy từng dòng hành động auto-farm sang nhật ký phiên"
```

---

### Task 2: Bỏ trần số lệnh mỗi vòng

**Files:**

- Modify: `avatar-web/server/src/autoFarm.ts`
- Test: `avatar-web/server/src/autoFarm.test.ts`

**Interfaces:**

- Consumes: closure `note()` từ Task 1.
- Produces: `AutoFarmConfig` không còn trường `maxActionsPerCycle`. Biến `sent` vẫn tồn tại trong `runCycle` nhưng chỉ để quyết định có gọi `enterFarm` làm mới cuối vòng hay không.

- [ ] **Step 1: Viết test thay cho ba test trần lệnh**

Trong `avatar-web/server/src/autoFarm.test.ts`, **xóa** ba test sau:

- `'vòng đầu tiên chỉ gửi tối đa maxActionsPerCycle lệnh dù tồn đọng nhiều ô'`
- `'không tồn đọng thì không bị trần chặn'`
- `'thu hoạch/trồng/chữa bệnh không bị việc chăm sóc ô (nhổ cỏ) chiếm hết trần lệnh'`

Thêm vào chỗ test đầu tiên vừa xóa:

```ts
test('một vòng làm hết việc tồn đọng, không còn trần lệnh', async () => {
  // 6 ô × 4 việc (tưới, nhổ cỏ, bắt sâu, bón phân) = 24 lệnh, vượt trần mặc
  // định cũ là 20. Đây là điều kiện để test ĐỎ trước khi bỏ trần: nếu dùng ít
  // lệnh hơn 20 thì test xanh sẵn và không chứng minh được gì.
  // Giá phải trả: 24 nhịp × 300ms ≈ 7 giây. Đây là test chậm nhất của file.
  const farmState: FarmState = {
    idFarm: 1,
    cells: Array.from({ length: 6 }, (_, i) =>
      cell(i, { idTree: 5, time: 100, isArid: true, isGrass: true, isWorm: true, vitalityPer: 50 }),
    ),
    animals: [],
    updatedAt: Date.now(),
  };
  const client = new FakeClient(farmState);
  const auto = new AutoFarm(client as unknown as GameClient);

  const done = new Promise<void>((resolve) =>
    auto.on('state', (s) => {
      if (s.cycle > 0) resolve();
    }),
  );
  auto.start({
    harvest: false,
    waterItemId: ITEM_WATER,
    grassItemId: ITEM_GRASS,
    wormItemId: 124,
    fertilizeCells: true,
    minVitality: 100,
    stepDelayMs: 300,
    startDelayMs: 0,
  });
  await done;
  auto.stop();

  assert.equal(
    client.calls.filter((c) => c.startsWith('useItem:')).length,
    24,
    'phải làm hết 24 việc trong một vòng, không bị cắt ở 20',
  );
  assert.equal(
    auto.state().lastActions.some((a) => a.includes('trần')),
    false,
    'không còn dòng báo đạt trần lệnh',
  );
});
```

Trong test `'stop() giữa vòng không bị trần lệnh ghi đè — vẫn dừng ngay, không có lần thử sau'`, bỏ tham số `maxActionsPerCycle: 100` khỏi lời gọi `auto.start(...)` và giảm `manyAridCells(10)` xuống `manyAridCells(4)`.

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `node --import tsx --test src/autoFarm.test.ts`

Expected: FAIL với `24 !== 20` — trần mặc định cắt ở lệnh thứ 20.

- [ ] **Step 3: Xóa trần khỏi cấu hình và vòng lặp**

Trong `avatar-web/server/src/autoFarm.ts`:

1. Xóa khối chú thích và trường `maxActionsPerCycle: number;` khỏi `interface AutoFarmConfig`.
2. Xóa `maxActionsPerCycle: 20,` khỏi `DEFAULTS`.
3. Xóa hai dòng:

```ts
      let sent = 0;
      const overBudget = () => sent >= cfg.maxActionsPerCycle;
```

thay bằng:

```ts
      // Đếm số lệnh đã gửi để biết cuối vòng có cần xin lại dữ liệu farm không.
      let sent = 0;
```

4. Xóa mọi dòng `if (overBudget()) break;` và mọi điều kiện `&& !overBudget()` / `!overBudget()` trong vòng `while` chữa bệnh và vòng `while` mua hàng.
5. Xóa khối:

```ts
      if (overBudget()) {
        note(`đã đạt trần ${cfg.maxActionsPerCycle} lệnh/vòng — phần còn lại làm ở vòng sau`);
      }
```

Kiểm tra không còn sót:

```bash
grep -n "overBudget\|maxActionsPerCycle" src/autoFarm.ts
```

Expected: không có kết quả.

- [ ] **Step 4: Chạy test và typecheck**

Run:

```bash
node --import tsx --test src/autoFarm.test.ts
npm run typecheck
```

Expected: test PASS (24 lệnh). `npm run typecheck` PASS.

Lưu ý: `tsconfig.json` của server **loại trừ** `src/**/*.test.ts`, nên `npm run typecheck` không soi file test. Chỗ nào trong test còn truyền `maxActionsPerCycle` sẽ không báo lỗi biên dịch mà chỉ lặng lẽ bị bỏ qua lúc chạy — phải tự tìm bằng:

```bash
grep -rn "maxActionsPerCycle" src/
```

Expected: không có kết quả.

- [ ] **Step 5: Commit**

```bash
cd /Users/devios/learning-reverse
git add avatar-web/server/src/autoFarm.ts avatar-web/server/src/autoFarm.test.ts
git commit -m "feat(avatar-web): bỏ trần lệnh mỗi vòng, một vòng làm hết việc tồn đọng"
```

---

### Task 3: Giai đoạn cây — gộp hai vòng lặp ô, nhịp nghỉ cho mọi ô

**Files:**

- Modify: `avatar-web/server/src/autoFarm.ts`
- Test: `avatar-web/server/src/autoFarm.test.ts`

**Interfaces:**

- Consumes: `note()` từ Task 1; `sent` từ Task 2.
- Produces: closure `tick(): Promise<void>` dùng lại ở Task 4. Định dạng dòng log ô: `[cây] ô <index>: <trạng thái quan sát> -> <việc đã làm>` hoặc `[cây] ô <index>: không có việc`.

- [ ] **Step 1: Viết failing test cho nhịp nghỉ và dòng log của ô**

Thêm vào `avatar-web/server/src/autoFarm.test.ts`:

```ts
test('ô không có việc vẫn tốn một nhịp nghỉ', async () => {
  // 4 ô rỗng việc: cận dưới 4 × 300ms. Không đo cận trên để khỏi phụ thuộc máy.
  const client = new FakeClient({
    idFarm: 1,
    cells: [cell(0), cell(1), cell(2), cell(3)],
    animals: [],
    updatedAt: Date.now(),
  });
  const auto = new AutoFarm(client as unknown as GameClient);
  const done = new Promise<void>((resolve) =>
    auto.on('state', (s) => {
      if (s.cycle > 0) resolve();
    }),
  );

  const startedAt = Date.now();
  auto.start({ harvest: false, stepDelayMs: 300, startDelayMs: 0 });
  await done;
  auto.stop();

  assert.ok(
    Date.now() - startedAt >= 4 * 300,
    `vòng phải nghỉ ít nhất 4 nhịp, đo được ${Date.now() - startedAt}ms`,
  );
});

test('mỗi ô đã duyệt sinh đúng một dòng log, kể cả ô không có việc', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [cell(0, { isArid: true }), cell(1)],
    animals: [],
    updatedAt: Date.now(),
  });
  const auto = new AutoFarm(client as unknown as GameClient);
  const logs: string[] = [];
  auto.on('log', (line: string) => logs.push(line));
  const done = new Promise<void>((resolve) =>
    auto.on('state', (s) => {
      if (s.cycle > 0) resolve();
    }),
  );
  auto.start({ waterItemId: ITEM_WATER, harvest: false, stepDelayMs: 300, startDelayMs: 0 });
  await done;
  auto.stop();

  // Đúng một dòng cho mỗi ô cũng là bằng chứng mỗi ô chỉ được chạm một lượt:
  // hai vòng lặp ô cũ sẽ sinh hai dòng cho cùng một ô.
  const cellLines = logs.filter((l) => l.startsWith('[cây] '));
  assert.equal(cellLines.length, 2, `mỗi ô một dòng: ${JSON.stringify(cellLines)}`);
  assert.ok(cellLines[0].includes('ô 0:') && cellLines[0].includes('tưới'), cellLines[0]);
  assert.ok(cellLines[1].includes('ô 1: không có việc'), cellLines[1]);
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `node --import tsx --test src/autoFarm.test.ts`

Expected: FAIL — chưa có dòng nào bắt đầu bằng `[cây] `, và vòng trên farm rỗng việc kết thúc gần như tức thì.

- [ ] **Step 3: Thêm `tick()` và gộp hai vòng lặp ô thành giai đoạn cây**

Trong `runCycle()`, ngay dưới `let sent = 0;`, thêm:

```ts
      // Nhịp nghỉ dùng chung: sau mỗi lệnh gửi đi, và sau mỗi đối tượng đã duyệt
      // dù không gửi gì. `tick` chỉ chờ; việc dừng vòng do `this.aborted` ở đầu
      // mỗi lượt lặp lo.
      const tick = (): Promise<void> => sleep(cfg.stepDelayMs);
```

Đồng thời bỏ `stepDelayMs` khỏi dòng destructuring hiện có, vì từ nay chỉ `tick()`
dùng tới nó:

```ts
      const { seedId, waterItemId, grassItemId, wormItemId, harvest, feedAnimals } = cfg;
```

`noUnusedLocals` không bật nên để lại cũng không hỏng build, nhưng đó là biến chết.

Xóa **cả hai** vòng lặp ô hiện có (vòng thu hoạch/trồng và vòng chăm sóc ô ở cuối), thay bằng một vòng duy nhất đặt ngay sau khối mua bù:

```ts
      // --- GIAI ĐOẠN CÂY ----------------------------------------------------
      // Mỗi ô chạm đúng một lần, làm hết mọi việc của ô đó rồi mới sang ô sau.
      for (const c of farm.cells) {
        if (this.aborted) return;
        const seen: string[] = [];
        const did: string[] = [];

        if (harvest && isCellRipe(c)) {
          this.client.farm.harvest(idFarm, c.index);
          sent += 1;
          seen.push(`chín ${c.hervestPer}%`);
          did.push('thu hoạch');
          await tick();
        }
        if (seedId !== undefined && c.idTree === -1) {
          this.client.farm.plantSeed(idFarm, c.index, seedId);
          sent += 1;
          seen.push('trống');
          did.push(`trồng #${seedId}`);
          await tick();
        }
        if (c.isArid && waterItemId !== undefined) {
          this.client.farm.useItem(idFarm, c.index, waterItemId);
          sent += 1;
          seen.push('hạn');
          did.push(`tưới #${waterItemId}`);
          await tick();
        }
        if (c.isGrass && grassItemId !== undefined) {
          this.client.farm.useItem(idFarm, c.index, grassItemId);
          sent += 1;
          seen.push('cỏ');
          did.push(`nhổ cỏ #${grassItemId}`);
          await tick();
        }
        if (c.isWorm && wormItemId !== undefined) {
          this.client.farm.useItem(idFarm, c.index, wormItemId);
          sent += 1;
          seen.push('sâu');
          did.push(`bắt sâu #${wormItemId}`);
          await tick();
        }
        if (cfg.fertilizeCells && c.idTree !== -1 && c.vitalityPer < cfg.minVitality) {
          this.client.farm.useItem(idFarm, c.index, ITEM_FERTILIZER);
          sent += 1;
          seen.push(`sức sống ${c.vitalityPer}`);
          did.push('bón phân');
          await tick();
        }

        note(
          did.length > 0
            ? `[cây] ô ${c.index}: ${seen.join(', ')} -> ${did.join(', ')}`
            : `[cây] ô ${c.index}: không có việc`,
        );
        await tick();
      }
```

- [ ] **Step 4: Chạy test và typecheck**

Run:

```bash
node --import tsx --test src/autoFarm.test.ts
npm run typecheck
```

Expected: PASS. Test `'chỉ thu hoạch ô có hervestPer > 0…'` vẫn phải PASS vì điều kiện thu hoạch không đổi.

- [ ] **Step 5: Commit**

```bash
cd /Users/devios/learning-reverse
git add avatar-web/server/src/autoFarm.ts avatar-web/server/src/autoFarm.test.ts
git commit -m "feat(avatar-web): gộp việc của một ô vào một lượt, nghỉ đều cả khi ô rảnh"
```

---

### Task 4: Giai đoạn vật nuôi — một vòng lặp duyệt index giảm dần

**Files:**

- Modify: `avatar-web/server/src/autoFarm.ts`
- Test: `avatar-web/server/src/autoFarm.test.ts`

**Interfaces:**

- Consumes: `note()`, `tick()`, `sent`, `specs` (map `species -> AnimalSpec`) đã dựng sẵn ở đầu `runCycle`.
- Produces: định dạng dòng log vật nuôi `[vật nuôi] <index> (<tên loài>): <trạng thái> -> <việc>` hoặc `[vật nuôi] <index> (<tên loài>): không có việc`.

Thứ tự việc trong một con: thu sản phẩm → bán → chữa bệnh → cho ăn. Bán đặt trước chữa/cho ăn để không tốn thuốc và thức ăn cho con sắp bán. Con đã bán thì bỏ qua phần còn lại của lượt.

- [ ] **Step 1: Sửa test thứ tự thu hoạch sản phẩm cho khớp chiều duyệt mới**

Trong test `'thu hoạch sản phẩm vật nuôi khi numEggOne > 0, bỏ qua con chưa có sản phẩm'`, đổi khẳng định thành:

```ts
  // Giai đoạn vật nuôi duyệt index giảm dần để lệnh bán không trỏ nhầm con.
  assert.deepEqual(
    client.calls.filter((c) => c.startsWith('harvestAnimal:')),
    ['harvestAnimal:2', 'harvestAnimal:0'],
  );
```

- [ ] **Step 2: Viết failing test cho thứ tự hai giai đoạn và log vật nuôi**

Thêm vào `avatar-web/server/src/autoFarm.test.ts`:

```ts
test('làm hết cây rồi mới tới vật nuôi', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [cell(0, { isArid: true }), cell(1, { isArid: true })],
    animals: [animal(0, { hunger: true }), animal(1, { hunger: true })],
    updatedAt: Date.now(),
  });
  await runOneCycle(client, { harvest: false, waterItemId: ITEM_WATER, feedAnimals: true });

  const useItems = client.calls.filter((c) => c.startsWith('useItem:'));
  const lastWater = useItems.map((c) => c.endsWith(`:${ITEM_WATER}`)).lastIndexOf(true);
  const firstFood = useItems.map((c) => c.endsWith(`:${ITEM_WATER}`)).indexOf(false);
  assert.ok(lastWater >= 0 && firstFood >= 0, `thiếu lệnh: ${JSON.stringify(useItems)}`);
  assert.ok(lastWater < firstFood, `mọi lệnh cây phải đứng trước lệnh vật nuôi: ${JSON.stringify(useItems)}`);
});

test('mỗi con đã duyệt sinh đúng một dòng log, kể cả con không có việc', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [animal(0, { species: 50, hunger: true }), animal(1, { species: 50 })],
    updatedAt: Date.now(),
  });
  const auto = new AutoFarm(client as unknown as GameClient);
  const logs: string[] = [];
  auto.on('log', (line: string) => logs.push(line));
  const done = new Promise<void>((resolve) =>
    auto.on('state', (s) => {
      if (s.cycle > 0) resolve();
    }),
  );
  auto.start({ harvest: false, feedAnimals: true, stepDelayMs: 300, startDelayMs: 0 });
  await done;
  auto.stop();

  const lines = logs.filter((l) => l.startsWith('[vật nuôi] '));
  assert.equal(lines.length, 2, `mỗi con một dòng: ${JSON.stringify(lines)}`);
  assert.ok(lines[0].includes('1 (Gà): không có việc'), lines[0]);
  assert.ok(lines[1].includes('0 (Gà)') && lines[1].includes('cho ăn'), lines[1]);
});

test('không tốn thuốc và thức ăn cho con sắp bán', async () => {
  const client = new FakeClient({
    idFarm: 1,
    cells: [],
    animals: [animal(0, { species: 59, bornTime: 99999, health: 20, hunger: true })],
    updatedAt: Date.now(),
  });
  await runOneCycle(client, {
    harvest: false,
    sellAnimals: true,
    healAnimals: true,
    feedAnimals: true,
    minHealth: 100,
  });

  assert.ok(client.calls.includes('sellAnimal:0'), 'phải bán con đã quá tuổi lớn');
  assert.equal(
    client.calls.some((c) => c.startsWith('useItem:')),
    false,
    'con đã bán thì không chữa bệnh, không cho ăn',
  );
});
```

- [ ] **Step 3: Chạy test để xác nhận thất bại**

Run: `node --import tsx --test src/autoFarm.test.ts`

Expected: FAIL — chưa có dòng `[vật nuôi] `, và con sắp bán vẫn bị chữa bệnh/cho ăn vì bốn vòng lặp hiện tại chạy độc lập.

- [ ] **Step 4: Gộp bốn vòng lặp vật nuôi thành một giai đoạn**

Xóa **cả bốn** khối hiện có: vòng `harvestAnimals`, khối `sellAnimals`, vòng `healAnimals`, vòng `feedAnimals`. Thay bằng một khối duy nhất đặt **sau** giai đoạn cây và **trước** bước làm mới cuối vòng:

```ts
      // --- GIAI ĐOẠN VẬT NUÔI ------------------------------------------------
      // `index` là vị trí trong mảng `animals`: bán một con làm mọi con index cao
      // hơn tụt xuống 1. Duyệt từ index CAO xuống THẤP thì việc bỏ phần tử phía
      // sau không xê dịch phần tử phía trước, nên index đọc từ ảnh chụp đầu vòng
      // luôn còn đúng — kể cả khi server để lại chỗ trống thay vì dồn mảng.
      const byIndexDesc = [...farm.animals].sort((x, y) => y.index - x.index);
      let sold = 0;
      let noSpec = 0;

      for (const a of byIndexDesc) {
        if (this.aborted) return;
        const name = this.client.animals.find((x) => x.id === a.species)?.name ?? `loài ${a.species}`;
        const seen: string[] = [];
        const did: string[] = [];

        if (cfg.harvestAnimals && a.numEggOne > 0) {
          this.client.farm.harvestAnimal(idFarm, a.index);
          sent += 1;
          seen.push(`${a.numEggOne} sản phẩm`);
          did.push('thu sản phẩm');
          await tick();
        }

        // Bán trước chữa/cho ăn: không đổ thuốc và thức ăn vào con sắp bán.
        // Con còn sản phẩm chưa lấy thì để vòng sau, xét trên ảnh chụp đầu vòng.
        let didSell = false;
        if (cfg.sellAnimals && sold < cfg.maxSellsPerCycle && a.numEggOne <= 0) {
          const whenGrown = cfg.sellWhenGrownSpecies.includes(a.species);
          const nearDeath = cfg.sellNearDeathSpecies.includes(a.species);
          if (whenGrown || nearDeath) {
            const spec = specs.get(a.species);
            if (!spec) {
              noSpec += 1;
            } else {
              let why: string | undefined;
              if (whenGrown && spec.growMinutes !== undefined && a.bornTime >= spec.growMinutes) {
                why = `đã lớn (${fmtDays(a.bornTime)}/${fmtDays(spec.growMinutes)} tuổi lớn)`;
              } else if (nearDeath && spec.lifeMinutes !== undefined) {
                const limit = spec.lifeMinutes * cfg.nearDeathRatio;
                if (a.bornTime >= limit) {
                  why = `gần hết đời (${fmtDays(a.bornTime)}/${fmtDays(spec.lifeMinutes)} tuổi thọ)`;
                }
              }
              if (why) {
                this.client.farm.sellAnimal(idFarm, a.index);
                sent += 1;
                sold += 1;
                didSell = true;
                did.push(`BÁN — ${why}`);
                await tick();
              }
            }
          }
        }

        if (!didSell) {
          if (cfg.healAnimals && a.health < cfg.minHealth) {
            // Thuốc bổ +20 máu mỗi liều (đo được 76 -> 96).
            let hp = a.health;
            let doses = 0;
            while (hp < cfg.minHealth && doses < 10) {
              this.client.farm.useItem(idFarm, a.index, ITEM_TONIC);
              sent += 1;
              hp += 20;
              doses += 1;
              await tick();
            }
            seen.push(`máu ${a.health}`);
            did.push(`${doses} liều thuốc bổ (->~${hp})`);
          }
          if (feedAnimals && a.hunger) {
            const food = foodForSpecies(a.species);
            if (food !== undefined) {
              this.client.farm.useItem(idFarm, a.index, food);
              sent += 1;
              seen.push('đói');
              did.push(`cho ăn #${food}`);
              await tick();
            }
          }
        }

        note(
          did.length > 0
            ? `[vật nuôi] ${a.index} (${name}): ${seen.length > 0 ? `${seen.join(', ')} -> ` : ''}${did.join(', ')}`
            : `[vật nuôi] ${a.index} (${name}): không có việc`,
        );
        await tick();
      }

      if (sold >= cfg.maxSellsPerCycle) {
        note(`đã đạt trần ${cfg.maxSellsPerCycle} con bán/vòng`);
      }
      if (noSpec > 0) {
        note(`bỏ qua bán ${noSpec} con: chưa có bảng vật nuôi để biết tuổi lớn/tuổi thọ`);
      }
```

- [ ] **Step 5: Chạy toàn bộ test của server và typecheck**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/server
npm test
npm run typecheck
```

Expected: PASS toàn bộ. Nếu test `'bán loài không sản phẩm khi đã quá tuổi lớn, giữ con chưa lớn'` hỏng thì kiểm tra lại thứ tự `byIndexDesc`; khẳng định đúng vẫn là `['sellAnimal:3', 'sellAnimal:0']`.

- [ ] **Step 6: Commit**

```bash
cd /Users/devios/learning-reverse
git add avatar-web/server/src/autoFarm.ts avatar-web/server/src/autoFarm.test.ts
git commit -m "feat(avatar-web): gộp việc của một con vào một lượt, duyệt giảm dần, bán trước khi chăm"
```

---

### Task 5: Xác minh trên phiên thật và bàn giao

**Files:** không sửa file nào.

- [ ] **Step 1: Chạy toàn bộ xác minh**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/server
npm test
npm run typecheck
cd /Users/devios/learning-reverse
git diff --check
git status --short
```

Expected: test PASS, typecheck PASS, `git diff --check` không có output, không có file nào của `avatar-web/web/` bị đổi.

- [ ] **Step 2: Kiểm tra phạm vi bằng GitNexus**

Chạy `detect_changes({ repo: "learning-reverse", scope: "all" })`.

Expected: thay đổi chỉ nằm ở khu vực auto-farm và vòng đời phiên; không chạm luồng đăng nhập, giao thức hay web.

- [ ] **Step 3: Quan sát một vòng thật**

Khởi động lại server, kết nối tài khoản, bật auto, rồi mở panel Nhật ký và kiểm tra:

1. Mỗi ô có đúng một dòng `[cây] ô N: …`, kể cả dòng `không có việc`.
2. Mọi dòng `[cây]` đứng trước mọi dòng `[vật nuôi]`.
3. Dòng vật nuôi đi từ index cao xuống thấp.
4. Khoảng cách mốc giờ giữa hai dòng liên tiếp xấp xỉ `stepDelayMs`, và cách xa hơn khi ô đó có gửi lệnh.
5. Không còn dòng `đã đạt trần … lệnh/vòng`.

Không đánh dấu bước này pass nếu chỉ có test xanh mà chưa xem nhật ký thật.

- [ ] **Step 4: Bàn giao**

Báo rõ: lệnh nào đã pass, đã quan sát được gì trên phiên thật, thời lượng một vòng đo được, và phần nào chưa xác minh.

Nếu phiên vẫn rớt trong lúc quan sát, ghi lại **dòng nhật ký cuối cùng trước khi mất kết nối** kèm dòng `mất kết nối: …`. Đó chính là dữ liệu mà nhánh điều tra rớt kết nối đang thiếu — đối tượng ngay sau dòng cuối cùng đó trong thứ tự duyệt là nghi can.
