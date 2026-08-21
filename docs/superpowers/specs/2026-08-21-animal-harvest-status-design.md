# Spec: Sửa nhãn trạng thái "có thể thu hoạch" cho vật nuôi cho đúng ngữ nghĩa

## Mục tiêu & Bối cảnh
- **Bối cảnh**: Trong `AnimalSection` (`AssetsPanel.tsx`), nhãn trạng thái hiện tính bằng
  `isReady = harvestPer > 0 || numEggOne > 0`, nên **bất kỳ con vật nào mới sinh (harvestPer > 0,
  dù chỉ 1%) cũng bị gắn nhãn "có thể thu hoạch"** — gây hiểu nhầm, đặc biệt với loài có sản phẩm:
  con Gà `harvestPer 100%` nhưng `sản phẩm 0` vẫn hiện "có thể thu hoạch" dù chẳng có gì để thu
  (sản phẩm mới là thứ thu được, `numEggOne`).
- **Mục tiêu**: Chỉ hiện "có thể thu hoạch" khi thực sự có thứ để thu:
  - Loài **có sản phẩm** (gà, vịt, bò, cừu, dê): "có thể thu hoạch" ⇔ `numEggOne > 0`; khi đã lớn
    hẳn mà chưa có sản phẩm thì hiện "đã lớn".
  - Loài **không có sản phẩm** (cá, rùa, heo, trâu, thỏ): không còn nhãn "có thể thu hoạch" —
    chúng được "bán" khi lớn chứ không thu sản phẩm; khi đã lớn thì hiện "đã lớn".

### Phát hiện khi kiểm chứng trên dữ liệu thật (bổ sung)
- `harvestPer` **KHÔNG đáng tin** để xác định "đã lớn": trên tài khoản thật, cá chép có
  `harvestPer = 100%` nhưng `bornTime` vẫn còn cách `growMinutes` 23 giờ 38 phút
  (UI hiện "đã lớn" trong khi dòng ⏳ báo "còn 23 giờ 38 phút đến lúc lớn").
- Vì vậy "đã lớn" phải tính theo thời gian: `bornTime >= growMinutes` (khớp logic bán
  `sellWhenGrownSpecies` trong `autoFarm.ts`), chỉ fallback mặc định là **chưa lớn** khi
  `desc` không có `Thời gian lớn` (ví dụ chó/mèo).

## Phạm vi (Scope)
- **In-scope**:
  - `avatar-web/web/src/accounts/panels/AssetsPanel.tsx` (`AnimalSection`):
    - Thêm hằng `GROWN_PERCENT = 100` (khớp server `farmData.ts:973`).
    - Sửa `isReady` và `statusText` theo ngữ nghĩa mới (dùng `specOf(animal).hasProduct`).
  - Tạo docs spec + plan.
- **Out-of-scope**:
  - Không đổi server, type, API, hay helper `animalSpec.ts`.
  - Không đổi `timeText` (dòng `⏳ ...` đã đúng: loài có sản phẩm → còn sống; loài không có sản
    phẩm → còn X đến lúc lớn / đã lớn).
  - Không viết test mới (user không yêu cầu).

## Thiết kế kiến trúc & Giải pháp kỹ thuật
Trong `AnimalSection`:

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

- `specOf` đã có sẵn (parse `desc` của catalog) — dùng lại, không đổi `animalSpec.ts`.
- Grid highlight (`class 'ready'`) dùng chung `isReady` → chỉ highlight con thực sự có thứ để thu.
- `title` của nút grid dùng `statusText` → tự đồng bộ.

## Verification Plan
- Chạy typecheck + test frontend: `cd avatar-web/web && npx tsc -b --noEmit && npx vitest run`.
- Mở `http://localhost:5173/accounts/2`:
  - Gà `harvestPer 100%`, `sản phẩm 0` → trạng thái "đã lớn" (không còn "có thể thu hoạch").
  - Gà `sản phẩm > 0` → "có thể thu hoạch".
  - Cá/heo chưa đủ tuổi lớn (`bornTime < growMinutes`) → KHÔNG highlight, trạng thái không
    còn "đã lớn"; chỉ highlight + "đã lớn" khi `bornTime >= growMinutes`.
