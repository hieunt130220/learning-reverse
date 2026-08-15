# Design Document: Logic Bán Vật Nuôi Sắp Chết Theo Chu Kỳ Sản Phẩm

- **Ngày tạo**: 2026-08-15
- **Trạng thái**: Approved
- **Phạm vi**: `avatar-web` (server backend & autoFarm logic)

---

## 1. Mục tiêu & Bối cảnh

Trước đây, hệ thống auto-farm áp dụng tỷ lệ cố định `nearDeathRatio = 0.9` (đã sống ≥ 90% tuổi thọ) để quyết định bán vật nuôi có sản phẩm (Gà, Bò, Vịt, Cừu, Dê). Cách tiếp cận này có nhược điểm:
- Không xét đến chu kỳ sản xuất thực tế của từng loài (ví dụ Gà mỗi 6h, Dê mỗi 4h, Cừu mỗi 12h).
- Có thể bán quá sớm khi con vật vẫn còn kịp cho thêm 1-2 đợt sản phẩm.
- Hoặc giữ quá muộn khiến con vật chết trước khi kịp sinh sản phẩm đợt tiếp theo.

**Yêu cầu mới**:
Thay thế ngưỡng cố định 90% bằng logic tính toán thời gian sống thực tế dựa trên chu kỳ sản phẩm:
1. **Nếu đang có sản phẩm**: Thu hoạch trước. Sau đó kiểm tra xem thời gian sống còn lại có đủ cho chu kỳ kế tiếp $+ 1\text{h}$ an toàn hay không. Nếu không đủ $\to$ bán luôn.
2. **Nếu đang không có sản phẩm**: Kiểm tra thời gian sống còn lại. Nếu còn $\le 1\text{h}$ $\to$ bán luôn để tránh chết mất xác.
3. **Loài không có sản phẩm (Heo, Cá chép, Rùa...)**: Giữ nguyên cơ chế bán khi đủ lớn (`bornTime >= growMinutes`).

---

## 2. Thiết kế chi tiết

### 2.1. Cập nhật `AnimalSpec` & `parseAnimalSpec` ([farmData.ts](../../server/src/game/farmData.ts))

Bổ sung trường `productCycleMinutes`:

```typescript
export interface AnimalSpec {
  growMinutes?: number;
  lifeMinutes?: number;
  productCycleMinutes?: number; // Chu kỳ ra sản phẩm (phút), vd 6h -> 360
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

### 2.2. Logic thực thi trong `AutoFarm.runCycle` ([autoFarm.ts](../../server/src/autoFarm.ts))

Duyệt mảng vật nuôi từ slot cao xuống thấp (`byIndexDesc`):

```typescript
// Bán cho loài có sản phẩm (Gà, Bò, Vịt, Cừu, Dê...)
const nearDeath = cfg.sellNearDeathSpecies.includes(a.species);
if (nearDeath) {
  const spec = specs.get(a.species);
  if (spec?.lifeMinutes !== undefined) {
    const remainingMinutes = spec.lifeMinutes - a.bornTime;
    const cycle = spec.productCycleMinutes ?? 360; // fallback 6h nếu không parse được

    if (hadProductBeforeHarvest) {
      // Trường hợp 1: Vừa thu sản phẩm xong ở đầu vòng
      // Kiểm tra xem có kịp đợt sản phẩm kế tiếp (cách >= 1h an toàn) không:
      if (remainingMinutes - cycle <= 60) {
        // Không kịp đợt kế tiếp -> Bán luôn
        sellAnimal(idFarm, a.index);
        did.push(`BÁN — vừa thu xong, không kịp đợt kế tiếp (còn sống ${fmtDays(remainingMinutes)} / chu kỳ ${fmtHours(cycle)})`);
      }
    } else {
      // Trường hợp 2: Hiện không có sản phẩm để thu
      // Nếu sắp chết (còn sống <= 1h) -> Bán luôn
      if (remainingMinutes <= 60) {
        sellAnimal(idFarm, a.index);
        did.push(`BÁN — sắp chết dưới 1h (còn sống ${remainingMinutes} phút)`);
      }
    }
  }
}
```

### 2.3. Thứ tự xử lý trong cùng một con vật

1. **Kiểm tra và thu sản phẩm**:
   - Ghi nhận `const hadProduct = allowHarvest && a.numEggOne > 0;`
   - Nếu `hadProduct`: Gọi `harvestAnimal(idFarm, a.index)` và ghi log `thu sản phẩm`.
2. **Kiểm tra bán**:
   - Nếu `allowSell`:
     - Nếu `whenGrown` (loài không sản phẩm): Bán khi `a.bornTime >= spec.growMinutes`.
     - Nếu `nearDeath` (loài có sản phẩm):
       - Nếu `hadProduct`: Bán nếu `(lifeMinutes - a.bornTime) - productCycleMinutes <= 60`.
       - Nếu `!hadProduct`: Bán nếu `(lifeMinutes - a.bornTime) <= 60`.
3. **Nếu không bán**: Tiếp tục chạy các bước chăm sóc (thuốc bổ, thuốc cúm/tiêu chảy, cho ăn).

---

## 3. Test Cases cần bổ sung / cập nhật

1. **`parseAnimalSpec`**:
   - Parse đúng `productCycleMinutes`:
     - Gà (20 trứng sau mỗi 6 giờ) $\to 360$ phút.
     - Dê (40 sữa sau mỗi 4 giờ) $\to 240$ phút.
     - Cừu (20 lông sau mỗi 12 giờ) $\to 720$ phút.
     - Heo (Không có sản phẩm) $\to \text{undefined}$.
2. **`AutoFarm` - Loài có sản phẩm vừa thu**:
   - Gà tuổi thọ 7 ngày (10080p), cycle 6h (360p), `bornTime = 9700p` (còn 380p). $380 - 360 = 20 \le 60\text{p} \to$ Bán ngay sau khi thu.
   - Gà `bornTime = 9000p` (còn 1080p). $1080 - 360 = 720 > 60\text{p} \to$ Giữ lại nuôi tiếp.
3. **`AutoFarm` - Loài có sản phẩm không có trứng/sữa**:
   - Gà `numEggOne = 0`, `bornTime = 10040p` (còn 40p $\le 60\text{p}$) $\to$ Bán luôn.
   - Gà `numEggOne = 0`, `bornTime = 9000p` (còn 1080p $> 60\text{p}$) $\to$ Giữ lại.
