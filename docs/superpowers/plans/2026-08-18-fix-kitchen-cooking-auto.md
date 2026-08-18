# Fix Kitchen Cooking Auto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để lỗi cài đặt món nấu ăn trong bếp nhưng auto không hoạt động, đồng bộ danh mục 35 món ăn chuẩn giữa Web và Server, và đảm bảo quy trình nấu bếp tự động hoạt động chính xác.

**Architecture:** Chuẩn hóa `DEFAULT_FOOD_CATALOG` trên Server và `FALLBACK_RECIPES` trên Web sang 35 món (ID 1..35) khớp với `KITCHEN_FOOD_CATALOG`. Sửa logic điều kiện chạy nấu ăn `(cfg.autoCook || hasKitchenPlan)` trong `AutoFarm.runCycle()`, xử lý đúng action `'skip'`, ghi nhật ký qua `note()`. Cập nhật `AutoFarmPanel.tsx` để hỗ trợ lưu và xác thực schema cho các trường cấu hình bếp.

**Tech Stack:** TypeScript, Node.js (EventEmitter, Buffer), React (Hooks, JSX), WebSocket.

**Spec:** `docs/superpowers/specs/2026-08-18-fix-kitchen-cooking-auto-design.md`

## Global Constraints
- Tuân thủ quy tắc KHÔNG thực hiện TDD (không red-green-refactor, không viết test trước code).
- Tuân thủ quy tắc GitNexus: kiểm tra impact analysis và blast radius trước khi sửa đổi, kiểm tra detect changes sau khi hoàn thành.
- Không dùng placeholder (`TODO`, `TBD`, `implement later`).
- Giữ nguyên toàn bộ logic hiện có về cây trồng và vật nuôi.

---

### Task 1: Chuẩn Hóa Danh Mục Món Ăn (Recipe Catalog)

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts:956-1070`
- Modify: `avatar-web/web/src/accounts/panels/CookingPanel.tsx:5-18`

**Interfaces:**
- Consumes: `KNOWN_FOOD_REFERENCE` trong `farmData.ts`, `KITCHEN_FOOD_CATALOG` trong `kitchenPlan.ts`.
- Produces: `DEFAULT_FOOD_CATALOG` và `FALLBACK_RECIPES` chuẩn 35 món (ID 1..35) với đầy đủ `materials`, `cookTimeMinutes`, `level`, `productID`, `iconId`.

- [x] **Step 1: Cập nhật `DEFAULT_FOOD_CATALOG` trong `farmData.ts`**
  Thay thế 10 món cũ bằng 35 món chuẩn (ID 1..35) khớp với `KNOWN_FOOD_REFERENCE`:
  - 1: Bánh Trứng (5 Lúa #6, 5 Trứng gà #50) -> cookTime: 60, level: 2, productID: 116
  - 2: Bánh sữa (5 Lúa #6, 5 Sữa bò #51) -> cookTime: 90, level: 2, productID: 119
  - 3: Cơm (5 Lúa #6) -> cookTime: 30, level: 1, productID: 118
  - 4: Cơm Trứng (5 Lúa #6, 2 Trứng gà #50) -> cookTime: 60, level: 1, productID: 117
  - 5: Cơm Cà rốt (5 Lúa #6, 5 Cà rốt #1) -> cookTime: 60, level: 1, productID: 125
  - 6: Nước ép trái cây (10 Dưa hấu #7, 5 Sữa bò #51) -> cookTime: 60, level: 1, productID: 126
  - 7: Gỏi Xoài (5 Xoài #10, 2 Ớt #44) -> cookTime: 60, level: 1, productID: 127
  - 8: Sữa Chua (5 Sữa bò #51) -> cookTime: 60, level: 1, productID: 128
  - 9: Trái cây dầm (5 Dâu tây #35, 5 Sữa bò #51) -> cookTime: 90, level: 2, productID: 129
  - 10: Tinh dầu hướng dương (10 Hướng dương #5) -> cookTime: 90, level: 2, productID: 136
  - 11: Nước Hoa (10 Hoa hồng #4, 5 Hướng dương #5) -> cookTime: 120, level: 2, productID: 137
  - 12: Sữa Chua Trái Cây (5 Sữa bò #51, 5 Dâu tây #35) -> cookTime: 120, level: 2, productID: 138
  - 13: Trái cây dĩa (5 Xoài #10, 5 Dưa hấu #7) -> cookTime: 90, level: 2, productID: 139
  - 14: Kem Tươi (5 Sữa bò #51, 5 Trứng gà #50) -> cookTime: 90, level: 2, productID: 140
  - 15: Trái Cây Ly (5 Dâu tây #35, 5 Xoài #10) -> cookTime: 90, level: 2, productID: 141
  - 16: Nước ép dưa hấu (10 Dưa hấu #7) -> cookTime: 60, level: 1, productID: 142
  - 17: Phô Mai (10 Sữa bò #51) -> cookTime: 120, level: 2, productID: 143
  - 18: Khoai Tây Chiên (10 Khoai tây #43) -> cookTime: 90, level: 2, productID: 144
  - 19: Bắp Chiên Bơ (10 Bắp #37) -> cookTime: 90, level: 2, productID: 145
  - 20: Tương Cà Chua (10 Cà chua #0) -> cookTime: 90, level: 2, productID: 146
  - 21: Tương ớt (10 Ớt #44) -> cookTime: 90, level: 2, productID: 147
  - 22: Heo quay ngũ vị (1 Heo #52, 10 Ớt #44) -> cookTime: 240, level: 4, productID: 133
  - 23: Cá chép om dưa (2 Cá chép #54, 5 Dưa leo #39) -> cookTime: 180, level: 3, productID: 132
  - 24: Gà Luộc (1 Gà #50) -> cookTime: 120, level: 3, productID: 148
  - 25: Gà bó xôi (1 Gà #50, 10 Lúa #6) -> cookTime: 180, level: 3, productID: 149
  - 26: Baba om chuối (2 Rùa/Ba ba #59, 5 Chuối #38) -> cookTime: 240, level: 4, productID: 150
  - 27: Tinh Thể Dưa Hấu (20 Dưa hấu #7) -> cookTime: 180, level: 3, productID: 151
  - 28: Gà Đóng Hộp (1 Gà #50) -> cookTime: 180, level: 3, productID: 152
  - 29: Bánh Xèo (10 Lúa #6, 5 Trứng gà #50) -> cookTime: 120, level: 3, productID: 153
  - 30: Trà Hoa Cúc (10 Cúc #8) -> cookTime: 60, level: 1, productID: 154
  - 31: Thịt Trâu Gác Bếp (1 Trâu #57, 10 Ớt #44) -> cookTime: 240, level: 4, productID: 155
  - 32: Vịt Quay Lá Mắc Mật (1 Vịt #55) -> cookTime: 180, level: 3, productID: 156
  - 33: Mì Ramen Thượng Hạng (10 Lúa #6, 2 Trứng gà #50, 1 Heo #52) -> cookTime: 240, level: 4, productID: 157
  - 34: Khoai tây đóng hộp (20 Khoai tây #43) -> cookTime: 180, level: 3, productID: 158
  - 35: Thịt Kho Trứng (1 Heo #52, 5 Trứng gà #50) -> cookTime: 240, level: 4, productID: 159

- [x] **Step 2: Cập nhật `FALLBACK_RECIPES` trong `CookingPanel.tsx`**
  Đồng bộ `FALLBACK_RECIPES` thành 35 món (ID 1..35) tương ứng để UI hiển thị đúng tên và nguyên liệu khi chưa nhận gói từ server.

---

### Task 2: Sửa Logic Nấu Ăn Tự Động Trong AutoFarm Engine

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:988-1094`

**Interfaces:**
- Consumes: `cfg.cookingSlotPlan`, `cfg.autoHarvestCook`, `cfg.autoCook`, `client.cookingState`, `client.foods`, `client.inventory`, `client.produce`.
- Produces: Gửi `harvestCook` và `cook` chính xác, ghi log qua `note()`.

- [x] **Step 1: Sửa điều kiện kích hoạt nấu bếp**
  Thay thế `if (cfg.autoCook)` bằng `if (cfg.autoCook || hasKitchenPlan)`.
  Khi có `cookingSlotPlan` được cài đặt, tự động thực thi nấu cho từng ô bếp theo kế hoạch.

- [x] **Step 2: Xử lý action `'skip'` và thứ tự ưu tiên**
  - Kiểm tra `if (planEntry?.action === 'skip') continue;` để bỏ qua ô bếp khi user cài đặt "⛔ Không nấu".
  - Nếu `planEntry?.action === 'cook'`, lấy recipe theo `planEntry.recipeId`.
  - Nếu không có plan cho ô này:
    - Nếu bật `cfg.prioritizeCookingMissions`: ưu tiên món nhiệm vụ.
    - Nếu có `cfg.defaultRecipeId`: ưu tiên món mặc định.
    - Nếu bật `cfg.autoCook` chung: fallback sang `foodCatalog[0]`.

- [x] **Step 3: Ghi log thời gian thực bằng `note()`**
  Thay thế tất cả các lời gọi `actions.push(...)` trong giai đoạn bếp bằng `note(...)` để phát sự kiện `log` thời gian thực qua WebSocket.

---

### Task 3: Cập Nhật Web UI & Schema Validation

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx:82-166, 195-360`

**Interfaces:**
- Consumes: API `/api/accounts/:id/auto/config`.
- Produces: Gửi `autoCook: true`, `autoHarvestCook: boolean`, và hỗ trợ lưu/load `cookingSlotPlan` chính xác.

- [x] **Step 1: Bổ sung validation keys trong `AutoFarmPanel.tsx`**
  - Thêm `'autoCook'`, `'autoHarvestCook'`, `'prioritizeCookingMissions'`, `'defaultRecipeId'` vào `AUTO_CONFIG_KEYS`.
  - Thêm `'autoCook'`, `'autoHarvestCook'`, `'prioritizeCookingMissions'` vào `optionalBooleanKeys`.
  - Thêm `'defaultRecipeId'` vào `optionalNumberKeys`.

- [x] **Step 2: Gửi cấu hình bếp khi lưu kế hoạch**
  - Trong `savePlan()`, gửi kèm `autoCook: true` và `autoHarvestCook`.
  - Khởi tạo mặc định `autoHarvestCook` là `true` (hoặc `config.autoHarvestCook ?? true`) để tự động thu hoạch món chín.

---

### Task 4: Kiểm Tra Toàn Diện & Verification

**Files:**
- Modify: `avatar-web/server/src/autoFarm.test.ts` (thêm test cases kiểm tra auto cooking)

- [x] **Step 1: Thêm unit test kiểm tra cooking auto trong `autoFarm.test.ts`**
  - Test case 1: Auto tự động gửi `harvestCook` khi có ô bếp nấu chín (`isDone: true` hoặc `remainTime <= 0`).
  - Test case 2: Auto tự động gửi `cook` theo đúng món trong `cookingSlotPlan` cho các ô trống khi đủ nguyên liệu trong kho.
  - Test case 3: Auto bỏ qua ô có `action: 'skip'`.
  - Test case 4: Auto trừ nguyên liệu ảo chính xác giữa các ô để không gửi lệnh nấu vượt quá nguyên liệu trong kho.

- [x] **Step 2: Chạy toàn bộ test suites**
  - Chạy `npm test` trong `avatar-web/server`.
