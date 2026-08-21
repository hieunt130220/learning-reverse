# Hiển thị thời gian lớn / thời gian sống còn lại cho vật nuôi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị thời gian đến lúc lớn (loài không có sản phẩm) và thời gian sống còn lại (loài có sản phẩm) trong khối chi tiết vật nuôi của `AssetsPanel`.

**Architecture:** Thêm module pure `animalSpec.ts` (parse `desc` của bảng vật nuôi → `growMinutes`/`lifeMinutes`/`hasProduct`, kèm `fmtDuration`) rồi dùng `bornTime` của `FarmAnimal` để tính thời gian còn lại và render thêm 1 dòng hint trong `AnimalSection`. Không đổi server, type hay API.

**Tech Stack:** React, TypeScript, Vitest (chỉ chạy test hiện có, không thêm test mới).

**Spec:** `docs/superpowers/specs/2026-08-21-animal-time-status-design.md`

## Global Constraints
- Tuân thủ quy tắc GitNexus: kiểm tra blast radius trước khi sửa và xác nhận thay đổi trước khi commit.
- Không áp dụng TDD (không tạo test files mới — user không yêu cầu).
- Không đổi type `FarmAnimal`/`AnimalInfo`/`FarmState`; không đổi server/proto.
- Giữ nguyên mọi logic hiện có của `AnimalSection` (grid, statusText, isReady, needsCare).
- Blast radius đã kiểm tra: `AssetsPanel` chỉ có 1 caller là `AccountOperationsDrawer.tsx:8`; `AnimalSection` là hàm nội bộ; thay đổi additive (chỉ thêm text) → risk **LOW**.

---

### Task 1: Tạo helper `animalSpec.ts`

**Files:**
- Create: `avatar-web/web/src/accounts/animalSpec.ts`

**Interfaces:**
- Consumes: không (pure functions, không import).
- Produces: `AnimalSpec`, `parseAnimalSpec(desc: string): AnimalSpec`, `fmtDuration(minutes: number): string` — dùng cho `AssetsPanel`.

- [ ] **Step 1: Viết module `animalSpec.ts`**
```ts
export interface AnimalSpec {
  growMinutes?: number;
  lifeMinutes?: number;
  productCycleMinutes?: number;
  hasProduct: boolean;
}

const DAY_MINUTES = 24 * 60;

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

export function fmtDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const days = Math.floor(m / DAY_MINUTES);
  const hours = Math.floor((m % DAY_MINUTES) / 60);
  const mins = m % 60;
  if (days > 0) return hours > 0 ? `${days} ngày ${hours} giờ` : `${days} ngày`;
  if (hours > 0) return mins > 0 ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
  return `${mins} phút`;
}
```

- [ ] **Step 2: Verify typecheck**
Run: `npm --prefix avatar-web/web exec tsc -- --noEmit` (hoặc lệnh typecheck trong `web/package.json`)
Expected: không lỗi.

---

### Task 2: Hiển thị thời gian trong `AnimalSection`

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/AssetsPanel.tsx:160-230` (hàm `AnimalSection`)

**Interfaces:**
- Consumes: `parseAnimalSpec`, `fmtDuration` từ `./animalSpec.js`; `FarmAnimal.bornTime`; `catalog[].desc`.
- Produces: dòng hint thời gian trong khối `cell-detail` của con vật đang chọn.

- [ ] **Step 1: Thêm import + helper `timeText`**
```ts
import { fmtDuration, parseAnimalSpec } from '../animalSpec.js';
```
Trong `AnimalSection`, sau `statusText`:
```ts
const specOf = (animal: FarmAnimal) =>
  parseAnimalSpec(catalog.find((a) => a.id === animal.species)?.desc ?? '');
const timeText = (animal: FarmAnimal): string | undefined => {
  const s = specOf(animal);
  if (s.hasProduct && s.lifeMinutes !== undefined) {
    return `còn sống ${fmtDuration(s.lifeMinutes - animal.bornTime)}`;
  }
  if (!s.hasProduct && s.growMinutes !== undefined) {
    const remaining = s.growMinutes - animal.bornTime;
    return remaining > 0 ? `còn ${fmtDuration(remaining)} đến lúc lớn` : 'đã lớn';
  }
  if (s.lifeMinutes !== undefined) return `còn sống ${fmtDuration(s.lifeMinutes - animal.bornTime)}`;
  return undefined;
};
```

- [ ] **Step 2: Render dòng thời gian trong `cell-detail`**
```tsx
<div className="hint">trạng thái: {statusText(selected)}</div>
{timeText(selected) && <div className="hint">⏳ {timeText(selected)}</div>}
```

- [ ] **Step 3: Verify bằng build + test hiện có**
Run: `npm --prefix avatar-web/web test`
Expected: toàn bộ test frontend hiện có pass (không thêm test mới).

- [ ] **Step 4: Commit**
`git commit -m "feat(web): hiển thị thời gian lớn / sống còn lại cho vật nuôi"`
