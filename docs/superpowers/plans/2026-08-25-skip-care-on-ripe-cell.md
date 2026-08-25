# Skip Care Actions on Ripe Cell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ô cây chín đi qua nhánh thu hoạch thì bỏ qua toàn bộ bước chăm sóc (tưới/nhổ cỏ/bắt sâu/bón phân) trong cùng vòng quét, thay vì bắn lệnh care vào trạng thái cũ của cây đã bị hạ.

**Architecture:** Thêm một flag cục bộ `harvested` trong vòng `for (const c of farm.cells)` thuộc GIAI ĐOẠN CÂY của `AutoFarm.runCycle`; dùng nó guard khối 4 bước care và mở rộng dòng log `[cây] ô N:` bằng hậu tố `, bỏ qua chăm sóc`. Không đổi thứ tự giai đoạn, không đổi điều kiện chín `isCellRipe`.

**Tech Stack:** TypeScript (Node.js, tsx), node:test + assert/strict, GitNexus impact/detect_changes workflow.

**Spec:** `docs/superpowers/specs/2026-08-25-skip-care-on-ripe-cell-design.md`

## Global Constraints

- KHÔNG TDD: viết production code trước, test sau (CLAUDE.md).
- `stepDelayMs` tối thiểu 300ms trong test (ràng buộc sẵn của `makeConfig`).
- Comment/log tiếng Việt, đúng mật độ và văn phong hiện có của file.
- Chỉ đụng GIAI ĐOẠN CÂY trong `runCycle` + phần test tương ứng; không đụng giai đoạn vật nuôi/bếp/nhiệm vụ/bán sạp.
- `makeConfig` ép `ALWAYS_ON_CONFIG` spread sau input nên `harvest`/`fertilizeCells` luôn `true` qua API công khai — nhánh "harvest=false" là code-level property (flag chỉ đặt bên trong `if (harvest && cellRipe(c))`, nên nếu `harvest` sai thì `harvested` luôn sai), **không viết test riêng** cho nhánh này vì không thể đạt tới qua `start()`; ghi chú trong code comment là đủ.
- GitNexus: `gitnexus_impact` trước khi sửa symbol; `gitnexus_detect_changes({scope:"staged"})` trước commit. Nếu session thực thi không có MCP tools GitNexus, dùng CLI `node .gitnexus/run.cjs status` và phụ lục phân tích thủ công ở Task 1 (blast radius đã lập sẵn).

### Blast radius đã phân tích (GitNexus fallback)

- `AutoFarm.runCycle`: method private, caller duy nhất là `AutoFarm.launchCycle` (nội bộ class). Không export mới, không đổi chữ ký.
- `isCellRipe`/`cellNeeds` trong `farmData.ts`: KHÔNG sửa.
- Test chịu ảnh hưởng: `autoFarm.test.ts` — các test cũ dùng ô `time=100` (< ngưỡng chín 120 phút của cây #5) hoặc `harvest:false` (bị ép true nhưng ô chưa chín nên không vào nhánh thu hoạch) → không bị ảnh hưởng bởi flag mới.
- Mức rủi ro: **LOW** (1 symbol nội bộ, 1 execution flow, có test bảo vệ).

---

### Task 1: Thêm flag `harvested` và guard khối chăm sóc trong GIAI ĐOẠN CÂY

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:875-988` (vòng `for (const c of farm.cells)` trong `runCycle`)

**Interfaces:**
- Consumes: `cellRipe`, `isCellSpent` (đã có), `cfg.harvest/waterItemId/grassItemId/wormItemId/fertilizeCells/minVitality` (đã có).
- Produces: không thêm export nào — chỉ thay đổi hành vi + log của vòng tự động.

- [ ] **Step 1: Chạy GitNexus impact trước khi sửa**

Run: `gitnexus_impact({target: "runCycle", direction: "upstream"})` (MCP) — nếu không có MCP tools thì xác nhận lại bằng đọc code: caller duy nhất `launchCycle` (dòng ~361-370).
Expected: blast radius chỉ nội bộ class, risk LOW. Nếu ra HIGH/CRITICAL thì DỪNG và báo user.

- [ ] **Step 2: Khai báo flag ngay sau khai báo `seen`/`did`/`previousTreeId`**

Tại đầu thân vòng lặp (hiện tại):

```ts
      for (const c of farm.cells) {
        if (this.aborted) return;
        const seen: string[] = [];
        const did: string[] = [];
        const previousTreeId = c.idTree;
```

Sửa thành:

```ts
      for (const c of farm.cells) {
        if (this.aborted) return;
        const seen: string[] = [];
        const did: string[] = [];
        const previousTreeId = c.idTree;
        // Ô đi qua nhánh thu hoạch thì trạng thái care (hạn/cỏ/sâu/sức sống) của
        // ảnh chụp đầu vòng thuộc về cây ĐÃ BỊ HẠ — chăm tiếp chỉ lãng phí vật
        // phẩm và bón nhầm cho cây non vừa trồng. Cây mới sẽ được duyệt lại ở
        // vòng kế tiếp với dữ liệu farm tươi.
        let harvested = false;
```

- [ ] **Step 3: Đặt flag ở CUỐI khối thu hoạch**

Khối `if (harvest && cellRipe(c))` hiện kết thúc bằng:

```ts
          this.client.enterFarm();
          await farmSynced;
          guard();
        }
```

Sửa thành (thêm 1 dòng trước dấu `}` đóng khối):

```ts
          this.client.enterFarm();
          await farmSynced;
          guard();
          // Đặt kể cả khi server im lặng ở confirm(): đã bắn lệnh thu thì trạng
          // thái care cũ không còn tin cậy để bắn tiếp lệnh useItem.
          harvested = true;
        }
```

Lưu ý: flag đặt TRONG khối `if (harvest && cellRipe(c))` — nếu `harvest` bị tắt (hiện không thể qua API nhưng giữ đúng cấu trúc) thì `harvested` luôn `false`, care chạy như cũ.

- [ ] **Step 4: Bọc 4 bước care bằng guard `if (!harvested)`**

4 khối liên tiếp từ `if (c.isArid && ...)` đến hết khối bón phân hiện là:

```ts
        if (c.isArid && waterItemId !== undefined) {
          ...
        }
        if (c.isGrass && grassItemId !== undefined) {
          ...
        }
        if (c.isWorm && wormItemId !== undefined) {
          ...
        }
        if (cfg.fertilizeCells && c.idTree !== -1 && c.vitalityPer < cfg.minVitality) {
          ...
        }
```

Sửa thành — chỉ bọc, KHÔNG đổi thân từng khối:

```ts
        if (!harvested) {
          if (c.isArid && waterItemId !== undefined) {
            ... // giữ nguyên thân gốc, thụt lề +2
          }
          if (c.isGrass && grassItemId !== undefined) {
            ...
          }
          if (c.isWorm && wormItemId !== undefined) {
            ...
          }
          if (cfg.fertilizeCells && c.idTree !== -1 && c.vitalityPer < cfg.minVitality) {
            ...
          }
        }
```

- [ ] **Step 5: Mở rộng log cuối vòng để ghi rõ việc bỏ qua care**

Note cuối vòng hiện là:

```ts
        note(
          did.length > 0
            ? `[cây] ô ${c.index}: ${seen.join(', ')} -> ${did.join(', ')}`
            : `[cây] ô ${c.index}: không có việc`,
        );
        await tick();
```

Sửa thành:

```ts
        // Có care bị chặn bởi flag hay không — nói thẳng ra log thay vì im lặng,
        // kẻo người dùng tưởng bot sót việc.
        const skippedCare = harvested
          && ((c.isArid && waterItemId !== undefined)
            || (c.isGrass && grassItemId !== undefined)
            || (c.isWorm && wormItemId !== undefined)
            || (cfg.fertilizeCells && c.idTree !== -1 && c.vitalityPer < cfg.minVitality));
        note(
          did.length > 0
            ? `[cây] ô ${c.index}: ${seen.join(', ')} -> ${did.join(', ')}${skippedCare ? ', bỏ qua chăm sóc' : ''}`
            : `[cây] ô ${c.index}: không có việc`,
        );
        await tick();
```

- [ ] **Step 6: Verify typecheck**

Run: `cd avatar-web/server && npm run typecheck`
Expected: exit 0, không lỗi TS.

---

### Task 2: Thêm test bảo vệ hành vi mới

**Files:**
- Test: `avatar-web/server/src/autoFarm.test.ts` (append cuối file; helper `cell`, `FakeClient`, import `ITEM_WATER`/`ITEM_GRASS` đã có sẵn)

**Interfaces:**
- Consumes: `FakeClient` (giả lập client, `calls` ghi mọi lệnh gửi đi), `cell()` builder, `DEFAULT_SEED_CATALOG` ngầm qua `growHours` (cây #5 Hoa Hồng lớn 2h → chín khi `time >= 120`).
- Produces: 2 test mới, không export gì.

Ghi chú kiến thức cần thiết khi viết test:
- `makeConfig` ép `fertilizeCells: true` + `minVitality mặc định 100` → ô `vitalityPer: 50` sẽ rơi vào nhánh bón phân nếu không có guard.
- Giá #123/#124/#112 không nằm trong bảng giá (`client.items` rỗng, không có trees) → auto-buy bỏ mua ("chưa biết giá"), không nhiễu assertion.
- Preload `client.inventory = [{ id: 5, num: 3 }]` để nhánh trồng lại dùng hạt sẵn có, không phát sinh lệnh `buy`.
- `FakeClient` hiện chưa có `getDailyQuest` — giai đoạn nhiệm vụ cuối vòng sẽ ném TypeError và bị `catch` nuốt (pattern y hệt các test cũ như "tưới trước cho ăn"); các assertion của ta đều thu thập TRƯỚC giai đoạn đó nên không ảnh hưởng.

- [ ] **Step 1: Append 2 test vào cuối `autoFarm.test.ts`**

```ts
test('ô chín được thu hoạch thì bỏ qua tưới/nhổ cỏ/bắt sâu/bón phân trong cùng vòng', async () => {
  // Cây #5 (Hoa Hồng, lớn 2h) chín ở time>=120; ô bẩn đầy đủ + sức sống thấp
  // để nếu guard thiếu thì CẢ 4 lệnh useItem đều bắn ra và test bắt được.
  const farmState: FarmState = {
    idFarm: 1,
    cells: [cell(0, { idTree: 5, time: 200, vitalityPer: 50, isArid: true, isGrass: true, isWorm: true })],
    animals: [],
    updatedAt: Date.now(),
  };
  const client = new FakeClient(farmState);
  client.inventory = [{ id: 5, num: 3 }];
  const auto = new AutoFarm(client);
  const done = new Promise<void>((resolve) =>
    auto.on('state', (s) => {
      if (s.cycle > 0) resolve();
    }),
  );
  auto.start({
    waterItemId: ITEM_WATER,
    grassItemId: ITEM_GRASS,
    wormItemId: 124,
    stepDelayMs: 300,
    startDelayMs: 0,
  });
  await done;
  auto.stop();

  assert.ok(client.calls.includes('harvest:0'), `phải thu hoạch ô chín: ${JSON.stringify(client.calls)}`);
  const useItems = client.calls.filter((c) => c.startsWith('useItem:'));
  assert.deepEqual(useItems, [], `không được chăm sóc ô vừa thu hoạch: ${JSON.stringify(useItems)}`);
  assert.ok(
    auto.state().lastActions.some((a) => a.includes('ô 0') && a.includes('bỏ qua chăm sóc')),
    `log phải ghi rõ việc cố ý bỏ qua chăm sóc: ${JSON.stringify(auto.state().lastActions)}`,
  );
});

test('ô chưa chín vẫn được chăm sóc bình thường', async () => {
  // time=10 << 120 -> chưa chín, guard không chặn: tưới phải vẫn chạy.
  const farmState: FarmState = {
    idFarm: 1,
    cells: [cell(0, { idTree: 5, time: 10, isArid: true })],
    animals: [],
    updatedAt: Date.now(),
  };
  const client = new FakeClient(farmState);
  const auto = new AutoFarm(client);
  const done = new Promise<void>((resolve) =>
    auto.on('state', (s) => {
      if (s.cycle > 0) resolve();
    }),
  );
  auto.start({ waterItemId: ITEM_WATER, stepDelayMs: 300, startDelayMs: 0 });
  await done;
  auto.stop();

  assert.equal(client.calls.includes('harvest:0'), false, 'ô non không được thu');
  assert.ok(
    client.calls.includes(`useItem:0:${ITEM_WATER}`),
    `ô non vẫn phải được tưới: ${JSON.stringify(client.calls)}`,
  );
});
```

- [ ] **Step 2: Verify toàn bộ test suite**

Run: `cd avatar-web/server && npm test`
Expected: tất cả test pass, gồm test cũ "một vòng làm hết việc tồn đọng" (24 useItem — ô `time=100` chưa chín nên không bị flag chặn) và 2 test mới.

- [ ] **Step 3: Sửa test nếu đỏ — chỉ theo nguyên nhân thật**

Nếu test cũ vỡ: quay lại Phase 1 debugging, KHÔNG sửa assertion cho khớp một cách máy móc. Nếu test mới đỏ vì `useItems` không rỗng: kiểm tra xem ô có thật sự vào nhánh thu hoạch không (`harvest:0` phải có mặt trước đó).

---

### Task 3: Commit + cập nhật index

**Files:**
- Commit: `avatar-web/server/src/autoFarm.ts`, `avatar-web/server/src/autoFarm.test.ts`, `docs/superpowers/specs/2026-08-25-skip-care-on-ripe-cell-design.md`, `docs/superpowers/plans/2026-08-25-skip-care-on-ripe-cell.md`

- [ ] **Step 1: GitNexus detect_changes trước commit**

Run: `gitnexus_detect_changes({scope: "staged"})` (hoặc đối chiếu tay `git diff --stat` nếu không có MCP).
Expected: chỉ 2 file source/test thay đổi symbol thuộc `runCycle` + test mới; không dính file lạ.

- [ ] **Step 2: Commit**

```bash
git add avatar-web/server/src/autoFarm.ts avatar-web/server/src/autoFarm.test.ts docs/superpowers/specs/2026-08-25-skip-care-on-ripe-cell-design.md docs/superpowers/plans/2026-08-25-skip-care-on-ripe-cell.md
git commit -m "$(cat <<'EOF'
fix(auto-farm): bo qua cham soc o vua thu hoat trong cung vong

O chin di qua nhanh thu hoat thi trang thai isArid/isGrass/isWorm/
vitalityPer cua anh chop dau vong thuoc ve cay DA BI HA — bot van ban
lenh tuoi/nho co/bat sau/bon phan vao trang thai do. Them flag
`harvested` guard ca 4 buoc care va ghi ro log ", bo qua cham soc".

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Làm mới GitNexus index**

PostToolUse hook tự chạy `npx gitnexus analyze` sau commit; nếu hook không chạy thì chạy tay: `cd /Users/hieunt/learning-reverse && npx gitnexus analyze` (KHÔNG kèm `--embeddings` trừ khi `.gitnexus/meta.json` cho thấy `stats.embeddings > 0`).

---

## Verification tổng (chạy lại sau khi xong cả 3 task)

```bash
cd avatar-web/server && npm run typecheck && npm test
```

Manual trên server thật (user thực hiện):
1. Chờ ô Lúa (48h) chín rồi xem log phiên: `[cây] ô N: đủ tuổi ... -> thu hoạch, làm đất, trồng #6, bỏ qua chăm sóc`.
2. Kho không giảm phân bón/tưới tương ứng ô vừa thu.
