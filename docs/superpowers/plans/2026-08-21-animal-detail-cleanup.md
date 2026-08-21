# Dọn chi tiết vật nuôi — bỏ IDDB, bỏ thu hoạch/sản phẩm với loài không có sản phẩm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dòng chi tiết vật nuôi bỏ tiền tố `IDDB`; loài không có sản phẩm không hiển thị `thu hoạch %` và `sản phẩm`.

**Architecture:** Sửa JSX khối `cell-detail` trong `AnimalSection` (`AssetsPanel.tsx`), dùng `specOf(selected).hasProduct` đã có để render có điều kiện 2 chỉ số. Không đổi server/type/API.

**Tech Stack:** React, TypeScript, Vitest (chỉ chạy test hiện có).

**Spec:** `docs/superpowers/specs/2026-08-21-animal-detail-cleanup-design.md`

## Global Constraints
- Tuân thủ quy tắc GitNexus: blast radius — chỉ sửa JSX hiển thị trong `AnimalSection`, 1 caller `AccountOperationsDrawer.tsx`; risk LOW.
- Không áp dụng TDD (không tạo test files mới).
- Không đổi logic `statusText`/`timeText`/grid/highlight.

---

### Task 1: Sửa khối `cell-detail` trong `AssetsPanel.tsx`

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/AssetsPanel.tsx` (`AnimalSection`, khối `cell-detail` ~dòng 236-243)

**Interfaces:**
- Consumes: `specOf(selected).hasProduct`, `selected.index/health/harvestPer/numEggOne`.
- Produces: dòng chi tiết gọn hơn (bỏ `IDDB`; bỏ `thu hoạch`/`sản phẩm` với loài không có sản phẩm).

- [ ] **Step 1: Thay JSX chi tiết**
```tsx
{selected && (
  <div className="cell-detail">
    <b>{selected.index}</b> — {name(selected.species)} · máu {selected.health}
    {specOf(selected).hasProduct && (
      <> · thu hoạch {selected.harvestPer}% · sản phẩm {selected.numEggOne}</>
    )}
    <div className="hint">trạng thái: {statusText(selected)}</div>
    {timeText(selected) && <div className="hint">⏳ {timeText(selected)}</div>}
  </div>
)}
```

- [ ] **Step 2: Verify typecheck + test**
Run: `cd avatar-web/web && npx tsc -b --noEmit && npx vitest run`
Expected: không lỗi type; 72/72 test pass.

- [ ] **Step 3: Kiểm chứng browser**
Mở `http://localhost:5173/accounts/2`: cá chép → không còn `IDDB`/`thu hoạch`/`sản phẩm`; gà → còn `thu hoạch`/`sản phẩm`, hết `IDDB`.

- [ ] **Step 4: Commit**
`git commit -m "feat(web): dọn chi tiết vật nuôi — bỏ IDDB và thu hoạch/sản phẩm với loài không có sản phẩm"`
