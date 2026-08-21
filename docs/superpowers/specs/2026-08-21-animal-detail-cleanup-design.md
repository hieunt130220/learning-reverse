# Spec: Dọn chi tiết vật nuôi — bỏ IDDB, bỏ thu hoạch/sản phẩm với loài không có sản phẩm

## Mục tiêu & Bối cảnh
- **Bối cảnh**: Khối chi tiết (`cell-detail`) của `AnimalSection` hiện luôn hiển thị
  `IDDB {index} — {tên} · máu {health} · thu hoạch {harvestPer}% · sản phẩm {numEggOne}`.
  Với loài **không có sản phẩm** (cá, rùa, heo, trâu, thỏ), 2 chỉ số `thu hoạch %` và `sản phẩm`
  không có ý nghĩa (không có gì để thu) và gây nhiễu. Tiền tố `IDDB` cũng là thuật ngữ gây khó hiểu.
- **Mục tiêu**:
  - Bỏ tiền tố `IDDB` trong dòng chi tiết (giữ lại số index để định danh).
  - Với loài **không có sản phẩm**: bỏ `· thu hoạch {x}%` và `· sản phẩm {y}` — chỉ giữ `· máu {health}`.
  - Loài **có sản phẩm** (gà, vịt, bò, cừu, dê): giữ nguyên `· thu hoạch {x}% · sản phẩm {y}`.

## Phạm vi (Scope)
- **In-scope**:
  - `avatar-web/web/src/accounts/panels/AssetsPanel.tsx` (`AnimalSection`, khối `cell-detail`).
  - Docs spec + plan.
- **Out-of-scope**:
  - Không đổi `statusText`, `timeText`, grid, highlight, server, type, API.
  - Không viết test mới (user không yêu cầu).

## Thiết kế kiến trúc & Giải pháp kỹ thuật
Trong khối `cell-detail` của `AnimalSection`, dùng `specOf(selected).hasProduct` đã có để quyết
định hiển thị 2 chỉ số:

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

Kết quả mong đợi:
- Cá chép (không sản phẩm): `0 — Cá chép · máu 100` + trạng thái + ⏳.
- Gà (có sản phẩm): `2 — Gà · máu 100 · thu hoạch 100% · sản phẩm 0` + trạng thái + ⏳.

## Verification Plan
- Chạy `cd avatar-web/web && npx tsc -b --noEmit && npx vitest run` — không lỗi, 72/72 pass.
- Trên `http://localhost:5173/accounts/2`: click cá chép → chi tiết không còn `IDDB`, `thu hoạch`,
  `sản phẩm`; click gà → vẫn đủ `thu hoạch` + `sản phẩm`, không còn `IDDB`.
