# Thiết Kế Kỹ Thuật (Design Document): Fix Lỗi Cài Đặt Món Nấu Ăn Trong Bếp Nhưng Auto Không Hoạt Động

## 1. Mục Tiêu & Bối Cảnh (Context & Goal)
- **Bối cảnh**: Người dùng cấu hình món nấu ăn cho các ô bếp trong tab Tự động chăm sóc (`AutoFarmPanel` / `KitchenPlanEditor`) và lưu cấu hình, nhưng khi auto chạy thì hệ thống không tự động nấu ăn theo kế hoạch đã cài đặt.
- **Mục tiêu**: Khắc phục triệt để lỗi logic khiến auto không nấu, đồng bộ danh mục công thức món ăn (Recipe Catalog) giữa Web Frontend và Backend Engine, và đảm bảo quy trình nấu bếp tự động hoạt động chính xác, ổn định.

---

## 2. Phân Tích Nguyên Nhân Gốc (Root Cause Investigation)

Qua kiểm tra toàn diện codebase (`autoFarm.ts`, `autoConfig.ts`, `farmData.ts`, `kitchenPlan.ts`, `AutoFarmPanel.tsx`, `CookingPanel.tsx`), đã xác định 5 nguyên nhân gốc:

1. **Điều kiện chặn trong AutoFarm Engine (`avatar-web/server/src/autoFarm.ts`)**:
   - Ở đầu giai đoạn Bếp, engine kiểm tra `const hasKitchenPlan = Array.isArray(cfg.cookingSlotPlan) && cfg.cookingSlotPlan.length > 0; if ((cfg.autoHarvestCook || cfg.autoCook || hasKitchenPlan) && !this.aborted)` (đúng).
   - Tuy nhiên ở dòng 1016, engine lại bọc vòng lặp nấu bằng `if (cfg.autoCook) { ... }`.
   - Vì `AutoFarmPanel.tsx` chỉ gửi `cookingSlotPlan` và `autoHarvestCook` (không gửi `autoCook`), và `DEFAULTS`/`ALWAYS_ON_CONFIG` trong server không bật `autoCook: true`, nên `cfg.autoCook` luôn là `undefined` (falsy) $\rightarrow$ **toàn bộ logic nấu ăn bị bỏ qua hoàn toàn**.

2. **Lệch ID công thức món ăn (Recipe Catalog ID Mismatch)**:
   - `web/src/accounts/kitchenPlan.ts` định nghĩa `KITCHEN_FOOD_CATALOG` gồm 35 món thật với ID từ 1 đến 35 (1: Bánh Trứng, 2: Bánh sữa, 3: Cơm, 4: Cơm Trứng, 5: Cơm Cà rốt... 35: Thịt Kho Trứng).
   - `server/src/game/farmData.ts` có `KNOWN_FOOD_REFERENCE` (35 món, ID 1..35), nhưng `DEFAULT_FOOD_CATALOG` lại dùng danh sách 10 món cũ với ID từ 0 đến 9 (0: Cơm, 1: Cơm trứng, 2: Bánh trứng, 3: Bánh sữa...).
   - Khi người dùng chọn "Cơm" (ID 3 trong Web), server tra cứu ID 3 trong `DEFAULT_FOOD_CATALOG` thành "Bánh sữa" (cần Sữa bò #51 và Lúa #6) $\rightarrow$ báo thiếu nguyên liệu hoặc nấu sai món. Các món ID $\ge 10$ không tìm thấy trong catalog.
   - `CookingPanel.tsx` cũng dùng danh sách fallback cũ (ID 0..9).

3. **Lỗi xử lý action 'skip' (Không nấu) trong AutoFarm Engine**:
   - Khi một ô bếp được cài đặt `{ slotIndex: i, action: 'skip' }`, `targetRecipe` là `undefined`, nhưng mã nguồn lại rơi vào các fallback tiếp theo (`prioritizeCookingMissions` $\rightarrow$ `defaultRecipeId` $\rightarrow$ `foodCatalog[0]`) và vẫn tự ý nấu món mặc định thay vì bỏ qua ô đó.

4. **Thiếu trường cấu hình trong Frontend Schema Validation (`AutoFarmPanel.tsx`)**:
   - `AUTO_CONFIG_KEYS` và `optionalBooleanKeys` trong `AutoFarmPanel.tsx` thiếu các key: `autoCook`, `autoHarvestCook`, `prioritizeCookingMissions`, `defaultRecipeId`.
   - Điều này có thể làm hàm `isAutoConfig()` từ chối trạng thái config trả về từ máy chủ.

5. **Ghi nhật ký thời gian thực (Live Log)**:
   - Các hành động trong giai đoạn bếp dùng `actions.push(...)` trực tiếp thay vì hàm `note(...)`, khiến nhật ký bếp không được đẩy qua WebSocket (`this.emit('log', ...)`) trong thời gian thực.

---

## 3. Phạm Vi (Scope)

### Trong phạm vi (In-Scope)
- **`avatar-web/server/src/autoFarm.ts`**:
  - Sửa điều kiện kích hoạt nấu ăn: `if (cfg.autoCook || hasKitchenPlan)`.
  - Xử lý chính xác action `'skip'` (bỏ qua ô bếp khi user cấu hình không nấu).
  - Tích hợp ghi log bằng `note(...)` để đồng bộ WebSocket trực tiếp.
  - Sử dụng toàn bộ kho nguyên liệu (`inventory` + `produce` + các section nông sản).
- **`avatar-web/server/src/game/farmData.ts`**:
  - Đồng bộ `DEFAULT_FOOD_CATALOG` chuẩn gồm 35 món thật (ID 1..35) khớp hoàn toàn với `KNOWN_FOOD_REFERENCE` và `KITCHEN_FOOD_CATALOG`, đầy đủ nguyên liệu `materials`, thời gian nấu `cookTimeMinutes`, cấp độ `level`, `productID`.
- **`avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx`**:
  - Bổ sung `autoCook`, `autoHarvestCook`, `prioritizeCookingMissions`, `defaultRecipeId` vào `AUTO_CONFIG_KEYS`, `optionalBooleanKeys`, `optionalNumberKeys`.
  - Gửi `autoCook: true` và `autoHarvestCook` khi lưu kế hoạch có bếp nấu.
  - Mặc định `autoHarvestCook` là `true` để tự động dọn nồi chín, giải phóng ô cho mẻ nấu tiếp theo.
- **`avatar-web/web/src/accounts/panels/CookingPanel.tsx`**:
  - Cập nhật `FALLBACK_RECIPES` đồng bộ với 35 món chuẩn (ID 1..35).

### Ngoài phạm vi (Out-of-Scope)
- Không thay đổi logic kết nối socket hoặc giao thức mạng của game Avatar Teamobi.
- Không thay đổi các phân hệ không liên quan (cây trồng, vật nuôi chuồng/hồ).

---

## 4. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 4.1. Danh Sách Files Ảnh Hưởng

| File | Module / Layer | Vai trò & Thay đổi |
|---|---|---|
| `avatar-web/server/src/game/farmData.ts` | Backend Data Layer | Cập nhật `DEFAULT_FOOD_CATALOG` chuẩn 35 món (ID 1..35) với nguyên liệu và thời gian chính xác |
| `avatar-web/server/src/autoFarm.ts` | AutoFarm Engine | Sửa điều kiện `if (cfg.autoCook || hasKitchenPlan)`, xử lý `skip` đúng, dùng `note(...)` ghi log WebSocket |
| `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx` | Web UI / State | Bổ sung key validation `autoCook`, `autoHarvestCook`; gửi `autoCook: true`; default `autoHarvestCook: true` |
| `avatar-web/web/src/accounts/panels/CookingPanel.tsx` | Web UI | Cập nhật `FALLBACK_RECIPES` 35 món đồng bộ |

### 4.2. Luồng Xử Lý Nấu Ăn Tự Động (Execution Flow)

```
[ AutoFarm.runCycle() ]
         │
         ▼
[ Giai đoạn Cây trồng & Vật nuôi hoàn tất ]
         │
         ▼
[ GIAI ĐOẠN BẾP NẤU ĂN ]
         │
         ├─► Có config autoHarvestCook || autoCook || hasKitchenPlan?
         │         │
         │         ├─► Gửi getCook(0) & chờ confirm(91)
         │         │
         │         ├─► [1. Thu hoạch món chín]:
         │         │     Duyệt các ô: nếu isDone hoặc remainTime <= 0
         │         │     -> Gửi harvestCook(slot) -> confirm(92)
         │         │
         │         └─► [2. Nấu món cho các ô trống] (nếu autoCook || hasKitchenPlan):
         │               Duyệt từng ô trống (idFood == -1):
         │                 ├─► planEntry.action === 'skip' -> BỎ QUA (continue)
         │                 ├─► planEntry.action === 'cook' -> Lấy targetRecipe theo planEntry.recipeId
         │                 ├─► Nếu không có plan: kiểm tra prioritizeCookingMissions / defaultRecipeId / autoCook fallback
         │                 │
         │                 └─► Nếu có targetRecipe:
         │                       Kiểm tra đủ nguyên liệu trong (inventory + produce)?
         │                         ├─► ĐỦ: Trừ nguyên liệu ảo -> Gửi cook(slot, recipeId) -> confirm(91) -> note log
         │                         └─► THIẾU: note("[bếp] ô N thiếu nguyên liệu...")
         ▼
[ Hoàn thành chu kỳ Auto ]
```

---

## 5. Kế Hoạch Kiểm Tra (Verification Plan)

### Kiểm tra tự động (Automated Verification)
1. Chạy test suite `avatar-web/server/src/autoFarm.test.ts` để kiểm tra toàn bộ luồng AutoFarm, thêm ca kiểm thử cho cooking auto:
   - Test nấu ăn theo `cookingSlotPlan` với từng ô chỉ định món.
   - Test ô được đánh dấu `action: 'skip'` không bị nấu.
   - Test kiểm tra và trừ nguyên liệu chính xác giữa các ô liên tiếp.
   - Test tự động thu hoạch khi món đã chín (`autoHarvestCook`).
2. Chạy test suite `avatar-web/web/src/accounts/panels/AutoFarmPanel.test.tsx` để đảm bảo UI validation và lưu config không bị lỗi.

### Kiểm tra thủ công (Manual Verification)
- Khởi động backend và web, mở giao diện tài khoản `Tự động chăm sóc`.
- Cài đặt món cho các ô bếp (ví dụ: ô 0 nấu Cơm #3, ô 1 nấu Bánh Trứng #1, ô 2 Không nấu).
- Bấm `Lưu kế hoạch` $\rightarrow$ kiểm tra phản hồi lưu thành công.
- Theo dõi nhật ký phiên / WebSocket log: xác nhận các gói `getCook`, `cook`, `harvestCook` được gửi đúng món và ô đã cấu hình.
