# Spec: Hiển thị thời gian lớn / thời gian sống còn lại cho vật nuôi

## Mục tiêu & Bối cảnh
- **Bối cảnh**: Trong panel **Vật nuôi** (`AnimalSection` của `AssetsPanel`), khối chi tiết
  (`cell-detail`) của từng con chỉ hiển thị: `IDDB {index} — {tên} · máu {health} · thu hoạch
  {harvestPer}% · sản phẩm {numEggOne}` + `trạng thái: ...`. Người dùng không biết con vật còn
  bao lâu thì lớn (để bán) hay còn bao lâu thì hết thời gian sống (với loài có sản phẩm thu nhiều
  lần như gà, vịt, bò, cừu, dê).
- **Mục tiêu**: Bổ sung hiển thị thời gian còn lại cho từng con vật:
  - Loài **không có sản phẩm** (cá chép, rùa, heo, trâu, thỏ): hiển thị **thời gian đến lúc lớn**
    (ví dụ `còn 1 ngày 12 giờ đến lúc lớn`), khi đã lớn thì hiển thị `đã lớn`.
  - Loài **có sản phẩm** (gà, vịt, bò, cừu, dê): hiển thị **thời gian sống còn lại**
    (ví dụ `còn sống 4 ngày 6 giờ`).

## Phạm vi (Scope)
- **In-scope**:
  - Tạo helper mới `avatar-web/web/src/accounts/animalSpec.ts`:
    - `parseAnimalSpec(desc: string)` — rút `growMinutes`, `lifeMinutes`, `productCycleMinutes`,
      `hasProduct` từ chuỗi `desc` của bảng vật nuôi (giữ logic khớp với
      `parseAnimalSpec` bên `avatar-web/server/src/game/farmData.ts`).
    - `fmtDuration(minutes: number)` — định dạng phút thành chuỗi tiếng Việt gọn
      (`X ngày Y giờ`, `Y giờ`, `Z phút`, `0 phút`).
  - Cập nhật `avatar-web/web/src/accounts/panels/AssetsPanel.tsx`:
    - Thêm hàm `timeText(animal)` dựa trên `bornTime` (phút kể từ lúc sinh, đếm lên) + spec.
    - Hiển thị thời gian trong khối `cell-detail` của `AnimalSection`.
- **Out-of-scope**:
  - Không đổi type `FarmAnimal` / `AnimalInfo` / `FarmState` (web & server).
  - Không đổi API, proto decoder, hay dữ liệu gửi từ server.
  - Không thêm countdown realtime — chỉ hiển thị theo snapshot `farm` mới nhất.
  - Không viết test (user không yêu cầu; dự án cấm TDD).

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### 1. Helper `animalSpec.ts` (module mới, pure functions)
```ts
export interface AnimalSpec {
  growMinutes?: number;
  lifeMinutes?: number;
  productCycleMinutes?: number;
  hasProduct: boolean;
}

export function parseAnimalSpec(desc: string): AnimalSpec {
  const grow = /Thời gian lớn\s*:?\s*(\d+)\s*ngày/i.exec(desc);
  const life = /Thời gian sống\s*:?\s*(\d+)\s*ngày/i.exec(desc);
  const cycle = /(?:sau\s+mỗi|mỗi)\s+(\d+)\s*giờ/i.exec(desc);
  return {
    growMinutes: grow ? Number(grow[1]) * 24 * 60 : undefined,
    lifeMinutes: life ? Number(life[1]) * 24 * 60 : undefined,
    productCycleMinutes: cycle ? Number(cycle[1]) * 60 : undefined,
    hasProduct: /Sản phẩm\s*:/i.test(desc) && !/Không\s+có\s+sản phẩm/i.test(desc),
  };
}

export function fmtDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const days = Math.floor(m / (24 * 60));
  const hours = Math.floor((m % (24 * 60)) / 60);
  const mins = m % 60;
  if (days > 0) return hours > 0 ? `${days} ngày ${hours} giờ` : `${days} ngày`;
  if (hours > 0) return mins > 0 ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
  return `${mins} phút`;
}
```
- Lưu ý: regex `Thời gian lớn\s*:?\s*(\d+)\s*ngày` khớp với dữ liệu thật
  `"Thời gian lớn : 1 ngày"`, `"Thời gian sống: 7 ngày"`; chuỗi `"Không  có sản phẩm"`
  (HAI dấu cách) cũng bị loại khỏi `hasProduct` nhờ nhịp regex `Không\s+có\s+sản phẩm`.

### 2. Cập nhật `AssetsPanel.tsx` — `AnimalSection`
- Trong `AnimalSection`, thêm:
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
    return remaining > 0
      ? `còn ${fmtDuration(remaining)} đến lúc lớn`
      : 'đã lớn';
  }
  if (s.lifeMinutes !== undefined) return `còn sống ${fmtDuration(s.lifeMinutes - animal.bornTime)}`;
  return undefined;
};
```
- Khối `cell-detail` của con đang chọn: thêm dòng hint thứ hai (hoặc nối vào dòng
  `trạng thái:` hiện có) ví dụ:
```tsx
<div className="hint">trạng thái: {statusText(selected)}</div>
{timeText(selected) && <div className="hint">⏳ {timeText(selected)}</div>}
```
- Giữ nguyên mọi thứ khác (grid, statusText, isReady, needsCare).

### 3. Dữ liệu đầu vào
- `bornTime` (phút, đếm lên từ lúc sinh) — đã có sẵn trong `FarmAnimal` (xác nhận trong
  `autoFarm.ts`: "bornTime ĐẾM LÊN +1 mỗi 60 giây").
- `growMinutes`/`lifeMinutes` — suy từ `desc` của `AnimalInfo` mà web đã nhận qua event
  `trees` (`message.payload.animals`), nên **không cần đổi server**.

## Verification Plan
- Chạy typecheck + build web: `npm --prefix avatar-web/web run build` (hoặc lệnh tương đương trong
  `package.json` của web).
- Mở `http://localhost:5173/accounts/2` (browser), vào tab Nông trại → panel **Vật nuôi**:
  - Chọn gà/vịt/bò/cừu/dê → thấy `còn sống X ngày Y giờ`.
  - Chọn cá/rùa/heo/trâu/thỏ chưa lớn → thấy `còn X đến lúc lớn`; đã lớn → `đã lớn`.
- Chạy test suite frontend hiện có (không thêm test mới): `npm --prefix avatar-web/web test`.
