# Thiết Kế Bỏ Setting Bán Vật Nuôi Trên Web & Cố Định Quy Tắc Tự Động Bán

## Mục Tiêu & Bối Cảnh

Hiện tại trên giao diện Web (`AutoFarmPanel.tsx`), người dùng phải tự cấu hình thủ công việc bật/tắt bán vật nuôi chuồng/hồ và nhập danh sách ID loài cần bán (`sellBarnSpecies`, `sellPondSpecies`). Việc này gây bất tiện, dễ cấu hình sai khiến vật nuôi có sản phẩm (như Gà, Vịt, Bò) bị bán sớm khi vừa lớn thay vì khai thác sản phẩm lâu dài, hoặc người dùng quên bật bán khiến vật nuôi thịt bị giữ lại tốn thức ăn.

**Mục tiêu:**
1. Bỏ toàn bộ các trường setting bán vật nuôi trên Web UI (checkbox bật/tắt bán và ô nhập ID loài bán của chuồng & hồ).
2. Tự động hóa hoàn toàn quy tắc bán vật nuôi trên server:
   - **Vật nuôi có sản phẩm (Gà, Vịt, Bò, Dê, Cừu):** Luôn tự động bán khi **gần chết** (sau khi thu hoạch sản phẩm cuối và không kịp chu kỳ tiếp theo, hoặc thời gian sống còn lại $\le 1$ giờ).
   - **Vật nuôi không có sản phẩm (Heo, Cá chép, Trâu, Rùa, Thỏ):** Luôn tự động bán khi **đủ lớn** (`bornTime >= growMinutes` và `numEggOne <= 0`).
   - **Thú tiện ích (Chó, Mèo):** Không bán (giữ nhà / bắt chuột).

---

## Phạm Vi (Scope)

### In-Scope
- **Frontend (`AutoFarmPanel.tsx`):**
  - Xóa giao diện checkbox "bán vật nuôi chuồng khi lớn", ô nhập "loài bán chuồng", checkbox "bán cá/rùa khi lớn", ô nhập "loài bán hồ".
  - Xóa các state cục bộ `sellBarnAnimals`, `sellPondAnimals`, `sellBarnSpeciesStr`, `sellPondSpeciesStr` và logic hydrate liên quan.
  - Bổ sung `sellAnimals: true`, `sellBarnAnimals: true`, `sellPondAnimals: true` vào `ALWAYS_ON_AUTO_CONFIG`.
- **Backend (`farmData.ts` & `autoFarm.ts`):**
  - Cập nhật danh sách hằng số trong `farmData.ts`:
    - `SPECIES_SELL_NEAR_DEATH`: `[50, 51, 55, 56, 60]` (50: Gà, 51: Bò, 55: Vịt, 56: Cừu, 60: Dê).
    - `SPECIES_SELL_WHEN_GROWN`: `[52, 54, 58, 59, 61]` (52: Heo, 54: Cá chép, 58: Trâu, 59: Rùa, 61: Thỏ).
  - Cập nhật `ALWAYS_ON_CONFIG` và `DEFAULTS` trong `autoFarm.ts` để `sellAnimals: true`, `sellBarnAnimals: true`, `sellPondAnimals: true` luôn bật mặc định.
  - Đảm bảo logic bán trong `autoFarm.ts` phân loại chính xác theo 2 nhóm trên dựa vào `SPECIES_SELL_NEAR_DEATH` và `SPECIES_SELL_WHEN_GROWN`, không bị các thiết lập loài cũ ghi đè sai.
- **Tests hiện có:** Cập nhật các test suite hiện có trong `autoFarm.test.ts` và `AutoFarmPanel.test.tsx` để khớp với quy tắc mới.

### Out-of-Scope
- Không thay đổi chức năng kế hoạch nuôi con gì theo slot (`barnAnimalPlan`, `pondAnimalPlan`).
- Không thêm API hay bảng dữ liệu mới.
- Không tự ý viết thêm test files mới (tuân thủ quy tắc KHÔNG TDD).

---

## Phân Loại Vật Nuôi & Bảng Quy Tắc Bán

| Loài | ID | Môi trường | Có sản phẩm? | Thời điểm bán | Ghi chú |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Gà** | 50 | Chuồng | Có (Trứng / 6h) | Gần chết (còn sống $\le 1$h hoặc thu xong không kịp chu kỳ) | Giữ thu trứng suốt vòng đời |
| **Bò** | 51 | Chuồng | Có (Sữa / 6h) | Gần chết (còn sống $\le 1$h hoặc thu xong không kịp chu kỳ) | Giữ thu sữa suốt vòng đời |
| **Heo** | 52 | Chuồng | Không | Đủ lớn (`bornTime >= growMinutes`) | Nuôi lấy thịt, lớn là bán |
| **Chó** | 53 | Chuồng | Không | **Không bán** | Thú giữ nhà chống trộm |
| **Cá chép** | 54 | Hồ | Không | Đủ lớn (`bornTime >= growMinutes`) | Nuôi lấy thịt, lớn là bán |
| **Vịt** | 55 | Chuồng | Có (Trứng / 6h) | Gần chết (còn sống $\le 1$h hoặc thu xong không kịp chu kỳ) | Giữ thu trứng suốt vòng đời |
| **Cừu** | 56 | Chuồng | Có (Lông / 12h) | Gần chết (còn sống $\le 1$h hoặc thu xong không kịp chu kỳ) | Giữ thu lông suốt vòng đời |
| **Mèo** | 57 | Chuồng | Không | **Không bán** | Thú hỗ trợ tiện ích |
| **Trâu** | 58 | Chuồng | Không | Đủ lớn (`bornTime >= growMinutes`) | Nuôi lấy thịt, lớn là bán |
| **Rùa** | 59 | Hồ | Không | Đủ lớn (`bornTime >= growMinutes`) | Nuôi lấy thịt, lớn là bán |
| **Dê** | 60 | Chuồng | Có (Sữa / 4h) | Gần chết (còn sống $\le 1$h hoặc thu xong không kịp chu kỳ) | Giữ thu sữa suốt vòng đời |
| **Thỏ** | 61 | Chuồng | Không | Đủ lớn (`bornTime >= growMinutes`) | Nuôi lấy thịt, lớn là bán |

---

## Thiết Kế Kiến Trúc & Chi Tiết Kỹ Thuật

### 1. `avatar-web/server/src/game/farmData.ts`
- Cập nhật hằng số:
  ```typescript
  export const SPECIES_SELL_NEAR_DEATH = [50, 51, 55, 56, 60];
  export const SPECIES_SELL_WHEN_GROWN = [52, 54, 58, 59, 61];
  ```

### 2. `avatar-web/server/src/autoFarm.ts`
- Bổ sung `sellAnimals: true`, `sellBarnAnimals: true`, `sellPondAnimals: true` vào `ALWAYS_ON_CONFIG` và `DEFAULTS`.
- Trong hàm `makeConfig`: gán cố định `sellWhenGrownSpecies: SPECIES_SELL_WHEN_GROWN` và `sellNearDeathSpecies: SPECIES_SELL_NEAR_DEATH`.
- Trong vòng lặp xử lý vật nuôi:
  ```typescript
  const nearDeath = cfg.sellNearDeathSpecies.includes(a.species);
  const whenGrown = cfg.sellWhenGrownSpecies.includes(a.species);
  ```
  - Nếu `nearDeath`: kiểm tra `remainingMinutes <= 60` hoặc `hadProduct && remainingMinutes - cycle <= 60` $\rightarrow$ tiến hành bán.
  - Nếu `whenGrown`: kiểm tra `bornTime >= spec.growMinutes && a.numEggOne <= 0` $\rightarrow$ tiến hành bán.
  - Chó (53) và Mèo (57) không nằm trong 2 danh sách trên $\rightarrow$ an toàn, không bao giờ bị bán.

### 3. `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx`
- Cập nhật `ALWAYS_ON_AUTO_CONFIG`:
  ```typescript
  const ALWAYS_ON_AUTO_CONFIG = {
    ...
    sellAnimals: true,
    sellBarnAnimals: true,
    sellPondAnimals: true,
  };
  ```
- Loại bỏ các element UI:
  - Checkbox & input trong khối "🐓 Vật nuôi chuồng"
  - Checkbox & input trong khối "🐟 Vật nuôi hồ"
- Xóa các state thừa (`sellBarnAnimals`, `sellPondAnimals`, `sellBarnSpeciesStr`, `sellPondSpeciesStr`).

---

## Verification Plan

### Automated Checks
- Chạy unit tests hiện có:
  - `npm --prefix avatar-web/server test` (chạy `autoFarm.test.ts` và các bài test server)
  - `npm --prefix avatar-web/web test` (chạy vitest cho web UI)
- Chạy build kiểm tra typescript & bundle:
  - `npm --prefix avatar-web/server run build` (hoặc `tsc --noEmit`)
  - `npm --prefix avatar-web/web run build`

### Manual Verification
- Kiểm tra giao diện web: phần Vật nuôi chuồng và Vật nuôi hồ không còn checkbox/ô nhập bán, chỉ còn Kế hoạch nuôi theo slot.
- Lưu kế hoạch auto farm thành công và kiểm tra config gửi lên server mang các cờ bán tự động.
