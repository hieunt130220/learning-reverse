# Spec: Chuẩn Hoá Giới Hạn Giá Bán Sạp Thực Tế & Cập Nhật Tên Sản Phẩm Chăn Nuôi (Cmd 103)

## Mục tiêu & Bối cảnh

### 1. Bối cảnh
- Tính năng sạp hàng cá nhân nông trại trong AvatarHD sử dụng `cmd 103` (OPEN_SHOP_FARM).
- Khi người chơi mở sạp, client gửi lệnh `cmd 103 sub 8` (`getShopItems`), server game phản hồi gói `price-rules` chứa danh sách 26 mặt hàng nông sản được phép bán kèm `minPrice` và `maxPrice`.
- Gói `cmd 103 sub 8` này chứa các trần kỹ thuật tĩnh (protocol bounds) từ phiên bản gốc:
  - Cây trồng cơ bản: 1 – 30 xu, 1 – 40 xu, 1 – 50 xu.
  - Sản phẩm chăn nuôi: Trứng gà 10 – 200 xu, Sữa bò 20 – 500 xu, Trứng vịt 30 – 500 xu, Lông cừu 10 – 300 xu, Sữa dê 60 – 600 xu.
  - Cây vụ mùa / cao cấp: Bắp 3 – 90 xu, Khoai tây 6 – 90 xu, v.v.

### 2. Vấn đề phát hiện qua thực nghiệm live
- Khi gửi lệnh đăng bán thực tế (`cmd 103 sub 3`: `addItemToShop`), server game chạy qua **2 tầng kiểm tra**:
  1. **Tầng 1 (Protocol Packet):** Giá phải nằm trong khoảng của gói `cmd 103 sub 8`.
  2. **Tầng 2 (Server Business Rule):** Server game kiểm tra theo bảng giá thị trường thực tế nghiêm ngặt hơn rất nhiều. Nếu giá vi phạm trần nghiệp vụ, server lập tức từ chối và trả về thông báo lỗi:
     ```text
     server: Đơn giá bán không hợp lệ. Đơn giá hợp lệ của [Tên] từ [MIN] - [MAX]
     ```
- Kết quả quét kiểm chứng trực tiếp trên server live cho thấy:
  - **Toàn bộ 11 loại cây trồng cơ bản** bị chặn cứng tối đa **10 xu** (1 – 10 xu).
  - **Cây vụ mùa / cao cấp:** Bắp (#200) & Nha đam (#201) tối đa 20 xu; Khoai tây (#271) tối đa 30 xu; các loại khác tối đa 10 xu.
  - **Sản phẩm chăn nuôi:**
    - `#50` Trứng gà: Server báo 8 – 30 xu (Giao với protocol min 10 -> Thực tế: **10 – 30 xu**).
    - `#51` Sữa bò: Server báo 16 – 40 xu (Giao với protocol min 20 -> Thực tế: **20 – 40 xu**).
    - `#55` Trứng vịt: Server báo 8 – 30 xu (Giao với protocol min 30 -> Thực tế: **đúng 30 xu**).
    - `#56` Lông cừu: Server báo 72 – 110 xu (Thực tế: **72 – 110 xu**).
    - `#60` Sữa dê: Server báo 48 – 80 xu (Giao với protocol min 60 -> Thực tế: **60 – 80 xu**).
- Hiện tại, `ShopCoordinator` trong `avatar-web` lưu nguyên xi dữ liệu thô từ protocol. Do đó:
  - Người dùng nhập giá trên web hoặc cấu hình auto bán giá > 10 xu cho cây trồng (hoặc > 40 xu cho sữa bò) sẽ bị server từ chối đăng hàng mà hệ thống không cảnh báo trước.
  - Tên vật phẩm `#60` đang bị định danh sai thành "Cua" trong `farmData.ts` (thực tế đây là **"Sữa dê"** từ vật nuôi Dê #60).

### 3. Mục tiêu
1. Chuẩn hóa bảng giá sạp ngay từ tầng nhận gói tin `price-rules` trong `ShopCoordinator` để đảm bảo:
   - `effectiveMin = Math.max(protocolMin, innerMin)`
   - `effectiveMax = Math.min(protocolMax, innerMax)`
2. Toàn bộ các luồng kiểm tra thủ công (`listListing`), tự động (`autoListStall`), API backend và UI web (`ShopPanel`, `AutoSellRulesEditor`) tự động thừa hưởng khoảng giá bán được thực tế mà không cần sửa đổi giao diện frontend.
3. Cập nhật tên `#60` thành "Sữa dê" trong danh mục nông sản `farmData.ts` và `CookingPanel.tsx`.

---

## Phạm vi (Scope)

### In-scope
1. **`avatar-web/server/src/game/shopProtocol.ts`**:
   - Định nghĩa hằng số bảng giới hạn nghiệp vụ đã kiểm chứng: `STALL_INNER_PRICE_LIMITS`.
   - Bổ sung hàm chuẩn hóa `resolveEffectivePriceRules(rules: ShopPriceRule[]): ShopPriceRule[]`.
2. **`avatar-web/server/src/session/shopCoordinator.ts`**:
   - Tại `onShopPacket` nhánh `event.kind === 'price-rules'`: chuẩn hóa danh sách rules qua `resolveEffectivePriceRules` trước khi lưu vào `next.priceRules`.
3. **`avatar-web/server/src/game/farmData.ts`**:
   - Cập nhật `#60: 'Sữa dê'` trong `KNOWN_PRODUCE_NAME_MAP`.
4. **`avatar-web/web/src/accounts/panels/CookingPanel.tsx`**:
   - Cập nhật `#60: 'Sữa dê'` trong `ANIMAL_PRODUCT_NAMES`.

### Out-of-scope
- Không thay đổi binary parser gốc của `decodeShopPacket` (vẫn decode chính xác dữ liệu server gửi trong gói sub 8).
- Không tạo test file mới (tuân thủ quy định KHÔNG TDD).

---

## Thiết kế kiến trúc & Bảng dữ liệu quy chuẩn

### 1. Bảng giới hạn giá thực tế (Live Verified)

```typescript
export interface StallInnerLimit {
  innerMin: number;
  innerMax: number;
}

export const STALL_INNER_PRICE_LIMITS: Readonly<Record<number, StallInnerLimit>> = {
  // Cây trồng cơ bản
  0: { innerMin: 1, innerMax: 10 },   // Cà chua
  1: { innerMin: 1, innerMax: 10 },   // Cà rốt
  2: { innerMin: 1, innerMax: 10 },   // Khóm (Dứa)
  3: { innerMin: 1, innerMax: 10 },   // Dưa Hấu
  4: { innerMin: 1, innerMax: 10 },   // Nho
  5: { innerMin: 1, innerMax: 10 },   // Hoa Hồng
  6: { innerMin: 1, innerMax: 10 },   // Lúa
  7: { innerMin: 1, innerMax: 10 },   // Xoài
  8: { innerMin: 1, innerMax: 10 },   // Thanh long
  9: { innerMin: 1, innerMax: 10 },   // Hoa hướng dương
  10: { innerMin: 1, innerMax: 10 },  // Hoa tulip

  // Sản phẩm chăn nuôi
  50: { innerMin: 8, innerMax: 30 },  // Trứng Gà
  51: { innerMin: 16, innerMax: 40 }, // Sữa Bò
  55: { innerMin: 8, innerMax: 30 },  // Trứng Vịt
  56: { innerMin: 72, innerMax: 110 },// Lông Cừu
  60: { innerMin: 48, innerMax: 80 }, // Sữa Dê

  // Cây vụ mùa / cao cấp
  200: { innerMin: 1, innerMax: 20 }, // Bắp
  201: { innerMin: 1, innerMax: 20 }, // Nha đam
  202: { innerMin: 1, innerMax: 10 }, // Dưa Leo
  204: { innerMin: 1, innerMax: 10 }, // Tỏi
  248: { innerMin: 1, innerMax: 10 }, // Dâu Tây
  249: { innerMin: 1, innerMax: 10 }, // Chuối
  270: { innerMin: 1, innerMax: 10 }, // Bí Ngô
  271: { innerMin: 3, innerMax: 30 }, // Khoai Tây
  286: { innerMin: 1, innerMax: 10 }, // Ớt hiểm
  288: { innerMin: 1, innerMax: 10 }, // Cải Thảo
};
```

### 2. Thuật toán tính khoảng giá hiệu lực (`resolveEffectivePriceRules`)

```typescript
export function resolveEffectivePriceRules(rules: readonly ShopPriceRule[]): ShopPriceRule[] {
  return rules.map((rule) => {
    const inner = STALL_INNER_PRICE_LIMITS[rule.itemId];
    if (!inner) return { ...rule };

    const minPrice = Math.max(rule.minPrice, inner.innerMin);
    const maxPrice = Math.min(rule.maxPrice, inner.innerMax);

    // Guard an toàn nếu server có biến động khiến minPrice > maxPrice
    return {
      itemId: rule.itemId,
      minPrice: Math.min(minPrice, maxPrice),
      maxPrice: Math.max(minPrice, maxPrice),
    };
  });
}
```

### 3. Tích hợp vào `ShopCoordinator`

Trong `src/session/shopCoordinator.ts`:
```typescript
} else if (event.kind === 'price-rules') {
  const effectiveRules = resolveEffectivePriceRules(event.rules);
  next = {
    ...next,
    priceRules: {
      revision: (next.priceRules?.revision ?? 0) + 1,
      connectionEpoch: epoch,
      capturedAt,
      data: effectiveRules,
    },
  };
}
```

### 4. Bảng tổng hợp khoảng giá có hiệu lực sau khi chuẩn hóa

| ID | Tên | Nhóm | Protocol Raw | Inner Server | Hiệu lực thực tế (`minPrice - maxPrice`) |
|---|---|---|---|---|---|
| 0 | Cà chua | Cây trồng | 1 – 30 | 1 – 10 | **1 – 10 xu** |
| 1 | Cà rốt | Cây trồng | 1 – 30 | 1 – 10 | **1 – 10 xu** |
| 2 | Khóm | Cây trồng | 1 – 30 | 1 – 10 | **1 – 10 xu** |
| 3 | Dưa Hấu | Cây trồng | 1 – 30 | 1 – 10 | **1 – 10 xu** |
| 4 | Nho | Cây trồng | 1 – 40 | 1 – 10 | **1 – 10 xu** |
| 5 | Hoa Hồng | Cây trồng | 1 – 30 | 1 – 10 | **1 – 10 xu** |
| 6 | Lúa | Cây trồng | 1 – 50 | 1 – 10 | **1 – 10 xu** |
| 7 | Xoài | Cây trồng | 1 – 40 | 1 – 10 | **1 – 10 xu** |
| 8 | Thanh long | Cây trồng | 1 – 30 | 1 – 10 | **1 – 10 xu** |
| 9 | Hoa hướng dương | Cây trồng | 1 – 30 | 1 – 10 | **1 – 10 xu** |
| 10 | Hoa tulip | Cây trồng | 1 – 30 | 1 – 10 | **1 – 10 xu** |
| 50 | Trứng Gà | Chăn nuôi | 10 – 200 | 8 – 30 | **10 – 30 xu** |
| 51 | Sữa Bò | Chăn nuôi | 20 – 500 | 16 – 40 | **20 – 40 xu** |
| 55 | Trứng Vịt | Chăn nuôi | 30 – 500 | 8 – 30 | **30 – 30 xu** |
| 56 | Lông Cừu | Chăn nuôi | 10 – 300 | 72 – 110 | **72 – 110 xu** |
| 60 | Sữa Dê | Chăn nuôi | 60 – 600 | 48 – 80 | **60 – 80 xu** |
| 200 | Bắp | Cây trồng | 3 – 90 | 1 – 20 | **3 – 20 xu** |
| 201 | Nha đam | Cây trồng | 3 – 90 | 1 – 20 | **3 – 20 xu** |
| 202 | Dưa Leo | Cây trồng | 2 – 30 | 1 – 10 | **2 – 10 xu** |
| 204 | Tỏi | Cây trồng | 2 – 30 | 1 – 10 | **2 – 10 xu** |
| 248 | Dâu Tây | Cây trồng | 2 – 30 | 1 – 10 | **2 – 10 xu** |
| 249 | Chuối | Cây trồng | 2 – 30 | 1 – 10 | **2 – 10 xu** |
| 270 | Bí Ngô | Cây trồng | 2 – 30 | 1 – 10 | **2 – 10 xu** |
| 271 | Khoai Tây | Cây trồng | 6 – 90 | 3 – 30 | **6 – 30 xu** |
| 286 | Ớt hiểm | Cây trồng | 1 – 30 | 1 – 10 | **1 – 10 xu** |
| 288 | Cải Thảo | Cây trồng | 3 – 30 | 1 – 10 | **3 – 10 xu** |

---

## Verification Plan

1. **Kiểm tra biên dịch & static check**:
   - `npm --prefix avatar-web/server run typecheck`
   - `npm --prefix avatar-web/web run typecheck` (hoặc build)
2. **Kiểm tra toàn bộ test suite hiện có**:
   - `npm --prefix avatar-web/server run test`
3. **Kiểm tra probe live**:
   - Chạy lại `npx tsx --env-file=.env src/tools/stall-price-probe.ts 1` kiểm tra bảng giá output hiển thị đồng bộ.
