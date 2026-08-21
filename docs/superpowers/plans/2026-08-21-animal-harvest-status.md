# Sửa nhãn trạng thái "có thể thu hoạch" cho vật nuôi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chỉ hiện "có thể thu hoạch" khi vật nuôi thực sự có thứ để thu (`numEggOne > 0` với loài có sản phẩm), còn lại hiện "đã lớn" khi `bornTime >= growMinutes` (KHÔNG dùng `harvestPer` — đo thật thấy harvestPer = 100 dù chưa lớn).

**Architecture:** Sửa 2 hàm nội bộ `isReady` + `statusText` trong `AnimalSection` (`AssetsPanel.tsx`), dùng lại `specOf(animal).hasProduct` đã có; `isGrown` tính theo `bornTime >= growMinutes` (khớp `autoFarm.ts:492`). Không đổi server/type/API.

**Tech Stack:** React, TypeScript, Vitest (chỉ chạy test hiện có).

**Spec:** `docs/superpowers/specs/2026-08-21-animal-harvest-status-design.md`

## Global Constraints
- Tuân thủ quy tắc GitNexus: blast radius đã kiểm tra — chỉ sửa hàm nội bộ `AnimalSection`, 1 caller là `AccountOperationsDrawer.tsx`; risk LOW.
- Không áp dụng TDD (không tạo test files mới).
- Không đổi `animalSpec.ts`, type, server, hay dòng `timeText`.

---

### Task 1: Sửa `isReady` + `statusText` trong `AssetsPanel.tsx`

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/AssetsPanel.tsx` (`AnimalSection`, ~dòng 163-179)

**Interfaces:**
- Consumes: `specOf(animal)` (đã có), `FarmAnimal.harvestPer/numEggOne`.
- Produces: `isReady` (grid highlight), `statusText` (nhãn trạng thái + tooltip) theo ngữ nghĩa mới.

- [x] **Step 1: Thay `isReady`/`statusText`**
```ts
const isGrown = (animal: FarmAnimal) => {
  const growMinutes = specOf(animal).growMinutes;
  return growMinutes !== undefined && animal.bornTime >= growMinutes;
};
const isReady = (animal: FarmAnimal) =>
  specOf(animal).hasProduct ? animal.numEggOne > 0 : isGrown(animal);
const statusText = (animal: FarmAnimal) => {
  const statuses: string[] = [];
  if (animal.hunger) statuses.push('đói');
  if (animal.hasFlu) statuses.push('cúm');
  if (animal.hasDiarrhea) statuses.push('tiêu chảy');
  if (specOf(animal).hasProduct) {
    if (animal.numEggOne > 0) statuses.push('có thể thu hoạch');
    else if (isGrown(animal)) statuses.push('đã lớn');
  } else if (isGrown(animal)) {
    statuses.push('đã lớn');
  }
  return statuses.join(', ') || 'bình thường';
};
```

- [x] **Step 2: Verify typecheck + test**
Run: `cd avatar-web/web && npx tsc -b --noEmit && npx vitest run`
Expected: không lỗi type; toàn bộ test hiện có pass. (Đã pass: 72/72.)

- [ ] **Step 3: Commit**
`git commit -m "fix(web): trạng thái vật nuôi chỉ báo thu hoạch khi có sản phẩm"`
