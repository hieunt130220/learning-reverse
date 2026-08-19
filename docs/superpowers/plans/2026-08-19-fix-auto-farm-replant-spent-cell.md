# Fix Auto Farm Replant Spent Cell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tự động trồng lại cây vừa thu hoạch theo loại cây trước đó khi chưa có cấu hình seedId riêng, đồng thời hiển thị đúng trạng thái ô vừa thu hoạch trên giao diện.

**Architecture:** Bảo toàn `previousTreeId` trước khi thu hoạch trong `AutoFarm.runCycle`, fallback chọn hạt trồng sang `previousTreeId` khi không có `plan`/`seedId`, và cập nhật `cellNeeds` cùng class ô trên `AssetsPanel.tsx` nhận diện `time === -1` là ô trống cần trồng lại.

**Tech Stack:** TypeScript, React, Vite, Node test runner, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-fix-auto-farm-replant-spent-cell-design.md`

## Global Constraints
- Tuân thủ quy trình Superpowers (Spec -> Plan -> Production Code).
- Không thực hiện TDD, không tạo test file mới trừ khi có yêu cầu.
- Giữ nguyên các định dạng gói tin mạng và các chức năng auto khác.

---

### Task 1: AutoFarm Backend - Tự động trồng lại cây sau khi thu hoạch

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:430-840`

**Interfaces:**
- Consumes: `FarmCell`, `isCellSpent`, `isCellRipe`, `DEFAULT_SEED_CATALOG`.
- Produces: `plantSeed` gửi cho ô vừa thu hoạch với loại cây cũ (`previousTreeId`) nếu không chỉ định `seedId`.

- [x] **Step 1: Cập nhật logic thu hoạch và chọn hạt trồng trong `autoFarm.ts`**
  - Không gán đè `c.idTree = -1` trước khi đọc thông tin cây; lưu `const previousTreeId = c.idTree`.
  - Khi xác định `plannedSeedId`:
    ```typescript
    const plan = planByCell.get(c.index);
    const plannedSeedId = plan?.action === 'seed'
      ? plan.seedId
      : (seedId ?? (previousTreeId !== -1 && knownSeeds.has(previousTreeId) ? previousTreeId : undefined));
    ```
  - Cập nhật `plannedSeedsToStock` cho giai đoạn `autoBuy`:
    ```typescript
    for (const c of farm.cells) {
      const plan = planByCell.get(c.index);
      const plannedSeedId = plan?.action === 'seed'
        ? plan.seedId
        : (seedId ?? (c.idTree !== -1 && knownSeeds.has(c.idTree) ? c.idTree : undefined));
      if (plan?.action === 'skip') continue;
      if (plannedSeedId === undefined || !knownSeeds.has(plannedSeedId)) continue;
      if (!seedBuyableWithXu(plannedSeedId)) continue;
      const willBeEmpty = c.idTree === -1 || isCellSpent(c) || (harvest && cellRipe(c));
      if (willBeEmpty) plannedSeedsToStock.add(plannedSeedId);
    }
    ```
  - Cập nhật `plantingConfigured`:
    ```typescript
    const plantingConfigured = cfg.seedId !== undefined
      || cfg.treeCellPlan?.some((entry) => entry.action === 'seed') === true
      || farm.cells.some((c) => c.idTree !== -1 && knownSeeds.has(c.idTree));
    ```

- [x] **Step 2: Kiểm tra test suite backend**
  Run: `cd avatar-web/server && node --import tsx --test src/autoFarm.test.ts`
  Expected: Các ca test liên quan đến thu hoạch và trồng cây đều pass (36/36 pass).

- [x] **Step 3: Commit**
  `git commit -m "fix(server): auto replant harvested tree when seedId is not specified"`

---

### Task 2: Frontend AssetsPanel - Sửa hiển thị ô vừa thu hoạch

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/AssetsPanel.tsx:24-150`
- Modify: `avatar-web/web/src/accounts/panels/AssetsPanel.test.tsx:30-55`

**Interfaces:**
- Consumes: `FarmCell`, `TreeInfo`, `cellNeeds`.
- Produces: `cellNeeds` trả về `['trống']` khi `c.idTree === -1 || c.time === -1`.

- [x] **Step 1: Cập nhật `AssetsPanel.tsx`**
  - Cập nhật `cellNeeds`:
    ```typescript
    export function cellNeeds(c: FarmCell, trees: TreeInfo[]): string[] {
      if (c.idTree === -1 || c.time === -1) return ['trống'];
      const n: string[] = [];
      if (c.isArid) n.push('tưới');
      if (c.isGrass) n.push('cỏ');
      if (c.isWorm) n.push('sâu');
      if (isCellRipe(c, trees)) n.push('thu hoạch');
      return n;
    }
    ```
  - Cập nhật ô lưới class `empty`:
    ```typescript
    const isEmpty = c.idTree === -1 || c.time === -1;
    const cls = [
      'cell',
      isEmpty ? 'empty' : '',
      isCellRipe(c, trees) ? 'ready' : '',
      c.isArid || c.isGrass || c.isWorm ? 'care' : '',
      sel?.index === c.index ? 'sel' : '',
    ].filter(Boolean).join(' ');
    ```
  - Cập nhật phần chi tiết ô khi `sel.time === -1`:
    ```typescript
    {sel && (
      <div className="cell-detail">
        <b>Ô {sel.index}</b> — {sel.idTree === -1 || sel.time === -1 ? 'trống' : treeName(sel.idTree)}
        {sel.idTree !== -1 && sel.time !== -1 && (
          <>
            {' '}· đã trồng {sel.time} phút
            {(() => {
              const need = trees.find((t) => t.id === sel.idTree)?.growMinutes;
              return need === undefined ? '' : `/${need * 60}`;
            })()}
            {' '}· sức sống {sel.vitalityPer}% · thu hoạch {sel.hervestPer}%
            {sel.level !== undefined && ` · level ${sel.level}`}
          </>
        )}
        {sel.time === -1 && sel.idTree !== -1 && (
          <span> (vừa thu hoạch {treeName(sel.idTree)})</span>
        )}
        <div className="hint">cần: {cellNeeds(sel, trees).join(', ') || 'không'}</div>
      </div>
    )}
    ```

- [x] **Step 2: Cập nhật `AssetsPanel.test.tsx` và chạy test**
  Run: `cd avatar-web/web && npx vitest run src/accounts/panels/AssetsPanel.test.tsx`
  Expected: PASS (5/5 pass)

- [x] **Step 3: Commit**
  `git commit -m "fix(web): display spent cell as empty and requiring replant in AssetsPanel"`
