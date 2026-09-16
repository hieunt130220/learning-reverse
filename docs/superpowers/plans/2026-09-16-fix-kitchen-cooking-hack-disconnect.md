# Fix Kitchen Cooking Hack Disconnect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để lỗi server ngắt kết nối và cảnh báo "Đừng hack bếp nữa bạn nhé" do gửi lệnh nấu thiếu nguyên liệu bằng cách chuẩn hóa toàn bộ 35 món trong catalog tĩnh và cải tiến logic chọn món an toàn trong AutoFarm.

**Architecture:** Cập nhật `DEFAULT_FOOD_CATALOG` (`farmData.ts`) và `FALLBACK_RECIPES` (`CookingPanel.tsx`) sang số liệu thực tế chuẩn từ gói mạng Cmd 76 (đặc biệt định mức hàng nghìn nông sản cho các món 1..21). Cải tiến `AutoFarm.runCycle()` để khi chạy chế độ `autoCook` mặc định sẽ ưu tiên chọn món nào kho thực tế có đủ nguyên liệu (`foodCatalog.find(f => hasMaterials(f))`), tránh chọn món thiếu nguyên liệu dẫn tới việc gửi lệnh nấu sai hoặc spam log.

**Tech Stack:** TypeScript 5.7, Node.js, React 18, GitNexus.

**Spec:** `docs/superpowers/specs/2026-09-16-fix-kitchen-cooking-hack-disconnect-design.md`

## Global Constraints
- Tuân thủ quy định KHÔNG thực hiện TDD (không tạo test files mới trừ khi user yêu cầu). Sửa test hiện có trong `autoFarm.test.ts` để khớp với định mức nguyên liệu mới.
- Tuân thủ quy tắc GitNexus: chạy `gitnexus_impact` trước khi sửa symbol và `gitnexus_detect_changes` trước khi hoàn tất.
- Không dùng placeholder (`TODO`, `TBD`, `implement later`).
- Giữ nguyên các luồng chăm sóc cây trồng, vật nuôi và câu cá khác.

---

### Task 1: Chuẩn Hóa 35 Món Ăn Trong `DEFAULT_FOOD_CATALOG`

**Files:**
- Modify: `avatar-web/server/src/game/farmData.ts:1120-1490`

**Interfaces:**
- Consumes: Gói Cmd 76 decode thực tế (từ snapshot cache và note cmd76-food-catalog-decode).
- Produces: `DEFAULT_FOOD_CATALOG` chuẩn 35 món với `cookTimeMinutes`, `level`, `productID`, `materials`.

- [x] **Step 1: Cập nhật `DEFAULT_FOOD_CATALOG` trong `farmData.ts`**
  Thay thế 35 món trong `DEFAULT_FOOD_CATALOG` bằng thông số chuẩn từ Cmd 76:
  - 1: Bánh Trứng -> productID: 205, cookTime: 120, level: 1, materials: [{itemId: 50, count: 50}, {itemId: 6, count: 2000}]
  - 2: Bánh sữa -> productID: 206, cookTime: 120, level: 1, materials: [{itemId: 51, count: 50}, {itemId: 6, count: 2000}]
  - 3: Cơm -> productID: 207, cookTime: 120, level: 1, materials: [{itemId: 6, count: 5000}]
  - 4: Cơm Trứng -> productID: 208, cookTime: 120, level: 1, materials: [{itemId: 6, count: 2000}, {itemId: 50, count: 100}]
  - 5: Cơm Cà rốt -> productID: 209, cookTime: 120, level: 1, materials: [{itemId: 6, count: 2000}, {itemId: 1, count: 1000}]
  - 6: Nước ép trái cây -> productID: 210, cookTime: 120, level: 1, materials: [{itemId: 2, count: 2000}, {itemId: 4, count: 2000}]
  - 7: Gỏi Xoài -> productID: 211, cookTime: 180, level: 1, materials: [{itemId: 7, count: 2000}]
  - 8: Sữa Chua -> productID: 212, cookTime: 240, level: 3, materials: [{itemId: 51, count: 200}, {itemId: 50, count: 200}, {itemId: 6, count: 500}]
  - 9: Trái cây dầm -> productID: 213, cookTime: 120, level: 1, materials: [{itemId: 3, count: 2000}, {itemId: 2, count: 2000}]
  - 10: Tinh dầu hướng dương -> productID: 214, cookTime: 420, level: 1, materials: [{itemId: 9, count: 5000}, {itemId: 7, count: 1000}]
  - 11: Nước Hoa -> productID: 216, cookTime: 1440, level: 1, materials: [{itemId: 10, count: 1000}, {itemId: 5, count: 1000}, {itemId: 9, count: 1000}]
  - 12: Sữa Chua Trái Cây -> productID: 217, cookTime: 180, level: 5, materials: [{itemId: 212, count: 5}, {itemId: 0, count: 1000}, {itemId: 2, count: 1000}]
  - 13: Trái cây dĩa -> productID: 218, cookTime: 240, level: 1, materials: [{itemId: 8, count: 1000}, {itemId: 2, count: 1000}, {itemId: 3, count: 1000}]
  - 14: Kem Tươi -> productID: 262, cookTime: 120, level: 5, materials: [{itemId: 50, count: 500}, {itemId: 51, count: 400}, {itemId: 6, count: 1000}]
  - 15: Trái Cây Ly -> productID: 219, cookTime: 480, level: 5, materials: [{itemId: 0, count: 5000}, {itemId: 3, count: 5000}]
  - 16: Nước ép dưa hấu -> productID: 272, cookTime: 120, level: 1, materials: [{itemId: 3, count: 3000}]
  - 17: Phô Mai -> productID: 273, cookTime: 240, level: 1, materials: [{itemId: 51, count: 300}, {itemId: 50, count: 500}]
  - 18: Khoai Tây Chiên -> productID: 274, cookTime: 240, level: 3, materials: [{itemId: 271, count: 300}, {itemId: 50, count: 100}]
  - 19: Bắp Chiên Bơ -> productID: 275, cookTime: 240, level: 2, materials: [{itemId: 200, count: 2000}, {itemId: 50, count: 100}]
  - 20: Tương Cà Chua -> productID: 281, cookTime: 360, level: 1, materials: [{itemId: 0, count: 1000}]
  - 21: Tương ớt -> productID: 287, cookTime: 30, level: 1, materials: [{itemId: 286, count: 1000}]
  - 22: Heo quay ngũ vị -> productID: 284, cookTime: 120, level: 1, materials: [{itemId: 282, count: 3}, {itemId: 286, count: 500}, {itemId: 6, count: 2000}]
  - 23: Cá chép om dưa -> productID: 285, cookTime: 120, level: 1, materials: [{itemId: 283, count: 1}, {itemId: 286, count: 1000}, {itemId: 0, count: 5000}]
  - 24: Gà Luộc -> productID: 277, cookTime: 30, level: 1, materials: [{itemId: 276, count: 1}]
  - 25: Gà bó xôi -> productID: 278, cookTime: 90, level: 1, materials: [{itemId: 277, count: 1}, {itemId: 50, count: 500}, {itemId: 6, count: 3000}]
  - 26: Baba om chuối -> productID: 280, cookTime: 90, level: 1, materials: [{itemId: 279, count: 1}, {itemId: 249, count: 1000}, {itemId: 286, count: 1000}]
  - 27: Tinh Thể Dưa Hấu -> productID: 290, cookTime: 1440, level: 1, materials: [{itemId: 272, count: 10}]
  - 28: Gà Đóng Hộp -> productID: 291, cookTime: 1440, level: 1, materials: [{itemId: 277, count: 20}]
  - 29: Bánh Xèo -> productID: 256, cookTime: 120, level: 6, materials: [{itemId: 282, count: 10}, {itemId: 50, count: 800}, {itemId: 6, count: 3000}]
  - 30: Trà Hoa Cúc -> productID: 292, cookTime: 90, level: 1, materials: [{itemId: 266, count: 1000}, {itemId: 289, count: 500}]
  - 31: Thịt Trâu Gác Bếp -> productID: 296, cookTime: 90, level: 2, materials: [{itemId: 295, count: 3}]
  - 32: Vịt Quay Lá Mắc Mật -> productID: 298, cookTime: 120, level: 4, materials: [{itemId: 297, count: 3}, {itemId: 286, count: 500}, {itemId: 6, count: 2000}, {itemId: 204, count: 1000}]
  - 33: Mì Ramen Thượng Hạng -> productID: 299, cookTime: 120, level: 4, materials: [{itemId: 6, count: 1000}, {itemId: 50, count: 500}, {itemId: 51, count: 200}, {itemId: 282, count: 2}]
  - 34: Khoai tây đóng hộp -> productID: 300, cookTime: 1440, level: 1, materials: [{itemId: 271, count: 2000}]
  - 35: Thịt Kho Trứng -> productID: 302, cookTime: 180, level: 7, materials: [{itemId: 301, count: 1000}, {itemId: 282, count: 5}, {itemId: 50, count: 500}, {itemId: 212, count: 5}]

- [x] **Step 2: Typecheck server**
  Run: `cd avatar-web/server && ./node_modules/.bin/tsc -p tsconfig.json --noEmit`
  Expected: TypeScript exit code 0.

---

### Task 2: Đồng Bộ `FALLBACK_RECIPES` Trong `CookingPanel.tsx`

**Files:**
- Modify: `avatar-web/web/src/accounts/panels/CookingPanel.tsx:6-42`

**Interfaces:**
- Consumes: Cùng bộ 35 công thức từ Task 1.
- Produces: `FALLBACK_RECIPES` trên web frontend.

- [x] **Step 1: Cập nhật `FALLBACK_RECIPES` trong `CookingPanel.tsx`**
  Đồng bộ 35 món trong `FALLBACK_RECIPES` để hiển thị đúng nguyên liệu và số lượng thật.

- [x] **Step 2: Typecheck web**
  Run: `cd avatar-web/web && ./node_modules/.bin/tsc -b`
  Expected: TypeScript exit code 0.

---

### Task 3: Cải Tiến Thuật Toán Chọn Món Bếp Trong `AutoFarm.ts`

**Files:**
- Modify: `avatar-web/server/src/autoFarm.ts:1365-1375`

**Interfaces:**
- Consumes: `foodCatalog`, `hasMaterials(recipe)`, `availableMaterials`.
- Produces: `targetRecipe` hợp lệ mà kho đủ nguyên liệu nấu, hoặc fallback báo thiếu an toàn.

- [x] **Step 1: Cải tiến logic chọn món mặc định khi bật `autoCook`**
  Thay thế đoạn gán cứng `targetRecipe = foodCatalog[0]` bằng:
  ```ts
  // Mặc định khi bật autoCook chung:
  // Ưu tiên chọn món ĐỦ NGUYÊN LIỆU để nấu. Nếu không có món nào đủ, fallback món đầu tiên để báo thiếu.
  if (!targetRecipe && cfg.autoCook && foodCatalog.length > 0) {
    targetRecipe = foodCatalog.find((f) => hasMaterials(f)) ?? foodCatalog[0];
  }
  ```

- [x] **Step 2: Verify server typecheck**
  Run: `cd avatar-web/server && ./node_modules/.bin/tsc -p tsconfig.json --noEmit`
  Expected: TypeScript exit code 0.

---

### Task 4: Cập Nhật Unit Tests & Rebuild

**Files:**
- Modify: `avatar-web/server/src/autoFarm.test.ts:1230-1282`

**Interfaces:**
- Consumes: `DEFAULT_FOOD_CATALOG` mới (Cơm #3 cần 5000 Lúa #6; Bánh Trứng #1 cần 2000 Lúa #6 và 50 Trứng #50).
- Produces: Unit tests test cooking pass với số liệu nguyên liệu chuẩn.

- [x] **Step 1: Cập nhật test cases cooking trong `autoFarm.test.ts`**
  - Cập nhật số lượng lúa/trứng trong test case thành công: Cơm cần 5000 Lúa, Bánh Trứng cần 2000 Lúa + 50 Trứng.
  - Cập nhật test case thiếu nguyên liệu: kho có 2000 Lúa (thiếu để nấu Cơm cần 5000 Lúa).

- [x] **Step 2: Chạy unit test suites**
  Run: `cd avatar-web/server && npm test`
  Expected: Tất cả test suites pass 100%.

- [x] **Step 3: Rebuild dist**
  Run: `cd avatar-web/server && npm run build`
  Expected: Rebuild `dist/` thành công.
