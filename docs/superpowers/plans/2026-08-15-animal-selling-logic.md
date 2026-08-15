# Logic Bán Vật Nuôi Sắp Chết Theo Chu Kỳ Sản Phẩm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay đổi cơ chế bán vật nuôi có sản phẩm sắp chết (Gà, Bò, Vịt, Cừu, Dê): từ tỷ lệ cố định 90% sang tính toán thực tế theo chu kỳ sinh sản phẩm và thời gian sống còn lại (bán ngay sau thu nếu không kịp đợt tiếp theo, hoặc bán khi còn sống ≤ 1h nếu hiện không có sản phẩm).

**Architecture:** Mở rộng `AnimalSpec` để parse `productCycleMinutes` từ `desc`. Cập nhật luồng xử lý `byIndexDesc` trong `AutoFarm.runCycle` để xử lý 2 trường hợp (vừa thu sản phẩm và không có sản phẩm). Cập nhật unit tests.

**Tech Stack:** TypeScript, Node.js, `node:test`, `node:assert`.

## Global Constraints

- Tuân thủ quy tắc trong CLAUDE.md: Spec → Plan → Production Code.
- Đảm bảo tất cả test hiện có và test mới trong `server` đều pass: `npm test` trong `avatar-web/server`.
- Giữ vững các guard an toàn: kiểm tra `allowSell`, `specs.get()`, duyệt `byIndexDesc`, không bán khi chưa có thông tin loài.

---

### Task 1: Mở rộng `AnimalSpec` và hàm `parseAnimalSpec` trong `farmData.ts`

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts:627-658`
- Test: `avatar-web/server/src/game/farmData.test.ts`

**Interfaces:**
- Consumes: Chuỗi `desc` trong bảng vật nuôi (cmd 76).
- Produces: `AnimalSpec.productCycleMinutes?: number` (chu kỳ sản phẩm tính theo phút).

- [ ] **Step 1: Cập nhật interface `AnimalSpec` và hàm `parseAnimalSpec`**

Trong `avatar-web/server/src/game/farmData.ts`:
```typescript
export interface AnimalSpec {
  /** Phút để lớn hẳn — `Thời gian lớn : N ngày`. */
  growMinutes?: number;
  /** Phút sống được — `Thời gian sống: N ngày`. */
  lifeMinutes?: number;
  /** Chu kỳ ra sản phẩm (phút), ví dụ: 6h -> 360 phút. */
  productCycleMinutes?: number;
  /** Có sản phẩm thu nhiều lần (trứng/sữa/lông) không. */
  hasProduct: boolean;
}

export function parseAnimalSpec(desc: string): AnimalSpec {
  const grow = /Thời gian lớn\s*:?\s*(\d+)\s*ngày/i.exec(desc);
  const life = /Thời gian sống\s*:?\s*(\d+)\s*ngày/i.exec(desc);
  const cycle = /(?:sau\s+mỗi|mỗi)\s+(\d+)\s*giờ/i.exec(desc);
  return {
    growMinutes: grow ? Number(grow[1]) * DAY_MINUTES : undefined,
    lifeMinutes: life ? Number(life[1]) * DAY_MINUTES : undefined,
    productCycleMinutes: cycle ? Number(cycle[1]) * 60 : undefined,
    hasProduct: /Sản phẩm\s*:/i.test(desc) && !/Không\s+có\s+sản phẩm/i.test(desc),
  };
}
```

- [ ] **Step 2: Thêm unit tests cho `parseAnimalSpec` trong `farmData.test.ts`**

Trong `avatar-web/server/src/game/farmData.test.ts`:
```typescript
test('parseAnimalSpec: parse đúng chu kỳ sản phẩm từ desc', () => {
  const gaDesc = 'Thời gian lớn : 1 ngày - Bán : 950 xu - Sản phẩm : 20 trứng gà sau mỗi 6 giờ - Thời gian sống: 7 ngày';
  const gaSpec = parseAnimalSpec(gaDesc);
  assert.equal(gaSpec.growMinutes, 1440);
  assert.equal(gaSpec.lifeMinutes, 10080);
  assert.equal(gaSpec.productCycleMinutes, 360);
  assert.equal(gaSpec.hasProduct, true);

  const deDesc = 'Thời gian lớn : 1 ngày - Bán : 1200 xu - Sản phẩm : 40 sữa sau mỗi 4 giờ - Thời gian sống: 10 ngày';
  const deSpec = parseAnimalSpec(deDesc);
  assert.equal(deSpec.productCycleMinutes, 240);

  const cuuDesc = 'Thời gian lớn : 2 ngày - Bán : 1500 xu - Sản phẩm : 20 lông sau mỗi 12 giờ - Thời gian sống: 10 ngày';
  const cuuSpec = parseAnimalSpec(cuuDesc);
  assert.equal(cuuSpec.productCycleMinutes, 720);

  const heoDesc = 'Thời gian lớn : 2 ngày - Bán : 800 xu - Không  có sản phẩm - Thời gian sống: 20 ngày';
  const heoSpec = parseAnimalSpec(heoDesc);
  assert.equal(heoSpec.productCycleMinutes, undefined);
  assert.equal(heoSpec.hasProduct, false);
});
```

- [ ] **Step 3: Chạy test để xác nhận**

Run: `cd avatar-web/server && npm test`
Expected: PASS

- [ ] **Step 4: Commit thay đổi**

```bash
git add avatar-web/server/src/game/farmData.ts avatar-web/server/src/game/farmData.test.ts
git commit -m "feat(avatar-web): parse productCycleMinutes in parseAnimalSpec"
```

---

### Task 2: Cập nhật logic bán vật nuôi có sản phẩm trong `AutoFarm.runCycle`

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:708-756`
- Test: `avatar-web/server/src/autoFarm.test.ts`

**Interfaces:**
- Consumes: `AnimalSpec.productCycleMinutes`, `AnimalSpec.lifeMinutes`, `a.bornTime`, `a.numEggOne`.
- Produces: Quyết định bán chính xác cho loài có sản phẩm.

- [ ] **Step 1: Cập nhật logic trong `autoFarm.ts`**

Trong `avatar-web/server/src/autoFarm.ts` vòng lặp `for (const a of byIndexDesc)`:
1. Ghi nhận `const hadProduct = allowHarvest && a.numEggOne > 0;` trước khi gọi `harvestAnimal`.
2. Trong phần kiểm tra bán `allowSell`:
```typescript
        let didSell = false;
        const unconstrainedSell = cfg.maxSellsPerCycle <= 0 || !Number.isFinite(cfg.maxSellsPerCycle);
        if (allowSell && (unconstrainedSell || sold < cfg.maxSellsPerCycle)) {
          const whenGrown = sellSpeciesList.includes(a.species) || cfg.sellWhenGrownSpecies.includes(a.species);
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
                const remainingMinutes = spec.lifeMinutes - a.bornTime;
                const cycle = spec.productCycleMinutes ?? 360;
                if (hadProduct) {
                  // Vừa thu sản phẩm xong ở đầu vòng: kiểm tra có kịp đợt sản phẩm kế tiếp (cách >= 1h) không
                  if (remainingMinutes - cycle <= 60) {
                    why = `vừa thu xong, không kịp đợt kế tiếp (còn sống ${fmtDays(remainingMinutes)} / chu kỳ ${(cycle / 60).toFixed(0)}h)`;
                  }
                } else if (a.numEggOne <= 0) {
                  // Đang không có sản phẩm: bán nếu còn sống <= 1h
                  if (remainingMinutes <= 60) {
                    why = `sắp chết dưới 1h (còn sống ${Math.max(0, remainingMinutes)} phút)`;
                  }
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
```

- [ ] **Step 2: Cập nhật unit tests trong `autoFarm.test.ts`**

Thay thế / cập nhật test `loài có sản phẩm chỉ bán khi đã sống quá nearDeathRatio của tuổi thọ` thành các test case chi tiết:
1. Gà vừa thu xong, thời gian sống còn lại không đủ 1 chu kỳ + 1h $\to$ Bán ngay.
2. Gà vừa thu xong, thời gian sống còn lại đủ $\to$ Nuôi tiếp.
3. Gà không có sản phẩm, thời gian sống còn lại $\le 60$ phút $\to$ Bán luôn.
4. Gà không có sản phẩm, thời gian sống còn lại $> 60$ phút $\to$ Nuôi tiếp.

- [ ] **Step 3: Chạy test kiểm thử toàn bộ `server`**

Run: `cd avatar-web/server && npm test`
Expected: ALL PASS

- [ ] **Step 4: Commit thay đổi**

```bash
git add avatar-web/server/src/autoFarm.ts avatar-web/server/src/autoFarm.test.ts
git commit -m "feat(avatar-web): sell near-death productive animals based on product cycle and 1h threshold"
```

---

### Task 3: Build & verify kiểm thử toàn bộ hệ thống

**Files:**
- Test: Toàn bộ suite `avatar-web/server`

- [ ] **Step 1: Build TypeScript backend**

Run: `cd avatar-web/server && npm run build`
Expected: Compilation success with 0 errors

- [ ] **Step 2: Chạy toàn bộ test suites**

Run: `cd avatar-web/server && npm test`
Expected: All tests pass
