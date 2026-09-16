# Spec — Khắc Phục Lỗi "Đừng hack bếp nữa bạn nhé, nhà mình còn gì đâu" và Bị Mất Kết Nối Khi Nấu Bếp

> **Ngày:** 2026-09-16
> **Tác giả:** AI agent (Systematic Debugging)
> **Liên quan:** `avatar-web/server/src/game/farmData.ts`, `avatar-web/server/src/autoFarm.ts`, `avatar-web/web/src/accounts/panels/CookingPanel.tsx`

---

## 1. Mục tiêu & Bối cảnh

### Hiện tượng
Khi AutoFarm chạy tới giai đoạn Bếp:
```text
10:03:58 AM bếp (snapshot): 2 ô · 0 ô đang nấu · 0 ô chín
10:03:59 AM [bếp] nấu món "Bánh Trứng" ở ô 0
10:03:59 AM server: Đừng hack bếp nữa bạn nhé, nhà mình còn gì đâu :( :(
10:03:59 AM mất kết nối: remote-end 27.0.14.120:19129, sống 26399ms, rx=31992B tx=365B, trạng thái=online, im lặng 8ms
```
Game server trả hộp thoại anti-cheat: `"Đừng hack bếp nữa bạn nhé, nhà mình còn gì đâu :( :("` và ngắt kết nối socket TCP ngay lập tức.

### Nguyên nhân gốc rễ (Root Cause)
1. **Sai lệch nghiêm trọng số lượng nguyên liệu trong catalog tĩnh (`DEFAULT_FOOD_CATALOG` và `FALLBACK_RECIPES`)**:
   - Các món từ ID 1 đến 21 đang chứa số liệu giả (dummy data) từ bản thiết kế cũ (ví dụ: Bánh Trứng chỉ cần **5** Lúa #6 và **5** Trứng gà #50).
   - Trong khi đó, dữ liệu thật từ gói mạng `Cmd 76` của server game Avatar quy định:
     - **Món 1 (Bánh Trứng)** yêu cầu: **2000 Lúa (#6)** và **50 Trứng gà (#50)** (cookTime: 120 phút, level: 1, productID: 205).
     - **Món 2 (Bánh sữa)** yêu cầu: **2000 Lúa (#6)** và **50 Sữa bò (#51)**.
     - **Món 3 (Cơm)** yêu cầu: **5000 Lúa (#6)**.
     - **Món 4 (Cơm Trứng)** yêu cầu: **2000 Lúa (#6)** và **100 Trứng gà (#50)**.
     - (Tất cả 21 món đầu tiên đều dùng cấp số 1000–5000 nông sản, không phải 5 hay 10).
2. **Kho không đủ nhưng AutoFarm tưởng đủ nên gửi lệnh `cook`**:
   - Tài khoản có 485 Lúa (#6) và 800 Trứng gà (#50).
   - Do catalog tĩnh ghi Bánh Trứng cần 5 Lúa, phép kiểm tra `485 >= 5` và `800 >= 5` trả về `true` (`canCook = true`).
   - AutoFarm gửi gói `cook(slot: 0, foodId: 1)` (Cmd 91 sub 1).
   - Server game kiểm tra cơ sở dữ liệu thấy tài khoản chỉ có 485 Lúa mà cần tới 2000 Lúa -> phát hiện client gian lận (hack vượt rào kiểm tra phía client) -> ngắt kết nối với thông báo cảnh cáo "Đừng hack bếp nữa".
3. **Cơ chế chọn món mặc định khi bật `autoCook`**:
   - Khi không cài đặt món riêng và không có món nhiệm vụ hợp lệ, AutoFarm gán cứng `targetRecipe = foodCatalog[0]` thay vì tìm kiếm món nào người chơi **thực sự đủ nguyên liệu** để nấu.

---

## 2. Phạm vi (Scope)

### In-scope
1. **Chuẩn hóa toàn diện 35 món ăn trong `DEFAULT_FOOD_CATALOG` (`farmData.ts`)**: Cập nhật toàn bộ các trường `cookTimeMinutes`, `level`, `productID` và mảng `materials` (`itemId`, `count`) khớp 100% với gói mạng `Cmd 76` thực tế.
2. **Đồng bộ `FALLBACK_RECIPES` (`CookingPanel.tsx`)**: Đảm bảo giao diện người dùng hiển thị đúng định mức nguyên liệu thực tế (hàng nghìn nông sản) thay vì con số 5..10 gây hiểu lầm.
3. **Cải tiến thuật toán chọn món trong `AutoFarm.ts`**:
   - Khi chạy chế độ `autoCook` mặc định, tìm món đầu tiên mà kho đủ nguyên liệu (`foodCatalog.find(f => hasMaterials(f))`).
   - Nếu không có bất kỳ món nào đủ nguyên liệu, fallback về món đầu tiên để in log giải thích rõ thiếu bao nhiêu vật phẩm và **tuyệt đối không gửi lệnh `cook` lên server**.
4. **Cập nhật unit tests trong `autoFarm.test.ts`**: Cập nhật số lượng nông sản trong test cases để tương thích với định mức mới.

### Out-of-scope
- Không thay đổi cấu trúc binary packet Cmd 91, Cmd 92, Cmd 93.
- Không can thiệp vào các logic trồng trọt, câu cá, chăn nuôi khác.

---

## 3. Thiết kế kỹ thuật & Dữ liệu chi tiết

### 3.1. Danh mục 35 món ăn chuẩn từ Cmd 76 (Nguồn sự thật)

| ID | Tên món | Thành phẩm | Thời gian | Level | Nguyên liệu yêu cầu (`itemId`, `count`) |
|:---:|---|:---:|:---:|:---:|---|
| 1 | Bánh Trứng | 205 | 120p | 1 | Trứng #50 × 50, Lúa #6 × 2000 |
| 2 | Bánh sữa | 206 | 120p | 1 | Sữa #51 × 50, Lúa #6 × 2000 |
| 3 | Cơm | 207 | 120p | 1 | Lúa #6 × 5000 |
| 4 | Cơm Trứng | 208 | 120p | 1 | Lúa #6 × 2000, Trứng #50 × 100 |
| 5 | Cơm Cà rốt | 209 | 120p | 1 | Lúa #6 × 2000, Cà rốt #1 × 1000 |
| 6 | Nước ép trái cây | 210 | 120p | 1 | Cà chua #2 × 2000, Nho #4 × 2000 |
| 7 | Gỏi Xoài | 211 | 180p | 1 | Dưa hấu #7 × 2000 |
| 8 | Sữa Chua | 212 | 240p | 3 | Sữa #51 × 200, Trứng #50 × 200, Lúa #6 × 500 |
| 9 | Trái cây dầm | 213 | 120p | 1 | Dưa leo #3 × 2000, Cà chua #2 × 2000 |
| 10 | Tinh dầu hướng dương | 214 | 420p | 1 | Hướng dương #9 × 5000, Dưa hấu #7 × 1000 |
| 11 | Nước Hoa | 216 | 1440p | 1 | Xoài #10 × 1000, Hoa hồng #5 × 1000, Hướng dương #9 × 1000 |
| 12 | Sữa Chua Trái Cây | 217 | 180p | 5 | Sữa chua #212 × 5, Khoai tây #0 × 1000, Cà chua #2 × 1000 |
| 13 | Trái cây dĩa | 218 | 240p | 1 | Cúc #8 × 1000, Cà chua #2 × 1000, Dưa leo #3 × 1000 |
| 14 | Kem Tươi | 262 | 120p | 5 | Trứng #50 × 500, Sữa #51 × 400, Lúa #6 × 1000 |
| 15 | Trái Cây Ly | 219 | 480p | 5 | Khoai tây #0 × 5000, Dưa leo #3 × 5000 |
| 16 | Nước ép dưa hấu | 272 | 120p | 1 | Dưa leo #3 × 3000 |
| 17 | Phô Mai | 273 | 240p | 1 | Sữa #51 × 300, Trứng #50 × 500 |
| 18 | Khoai Tây Chiên | 274 | 240p | 3 | Khoai tây #271 × 300, Trứng #50 × 100 |
| 19 | Bắp Chiên Bơ | 275 | 240p | 2 | Bắp #200 × 2000, Trứng #50 × 100 |
| 20 | Tương Cà Chua | 281 | 360p | 1 | Khoai tây #0 × 1000 |
| 21 | Tương ớt | 287 | 30p | 1 | Ớt #286 × 1000 |
| 22 | Heo quay ngũ vị | 284 | 120p | 1 | Thịt heo #282 × 3, Ớt #286 × 500, Lúa #6 × 2000 |
| 23 | Cá chép om dưa | 285 | 120p | 1 | Cá chép #283 × 1, Ớt #286 × 1000, Khoai tây #0 × 5000 |
| 24 | Gà Luộc | 277 | 30p | 1 | Thịt gà #276 × 1 |
| 25 | Gà bó xôi | 278 | 90p | 1 | Gà luộc #277 × 1, Trứng #50 × 500, Lúa #6 × 3000 |
| 26 | Baba om chuối | 280 | 90p | 1 | Ba ba #279 × 1, Chuối #249 × 1000, Ớt #286 × 1000 |
| 27 | Tinh Thể Dưa Hấu | 290 | 1440p | 1 | Tinh thể #272 × 10 |
| 28 | Gà Đóng Hộp | 291 | 1440p | 1 | Gà luộc #277 × 20 |
| 29 | Bánh Xèo | 256 | 120p | 6 | Thịt heo #282 × 10, Trứng #50 × 800, Lúa #6 × 3000 |
| 30 | Trà Hoa Cúc | 292 | 90p | 1 | Hoa cúc #266 × 1000, Cỏ mật #289 × 500 |
| 31 | Thịt Trâu Gác Bếp | 296 | 90p | 2 | Thịt trâu #295 × 3 |
| 32 | Vịt Quay Lá Mắc Mật | 298 | 120p | 4 | Vịt #297 × 3, Ớt #286 × 500, Lúa #6 × 2000, Khế #204 × 1000 |
| 33 | Mì Ramen Thượng Hạng | 299 | 120p | 4 | Lúa #6 × 1000, Trứng #50 × 500, Sữa #51 × 200, Thịt heo #282 × 2 |
| 34 | Khoai tây đóng hộp | 300 | 1440p | 1 | Khoai tây #271 × 2000 |
| 35 | Thịt Kho Trứng | 302 | 180p | 7 | Thịt kho #301 × 1000, Thịt heo #282 × 5, Trứng #50 × 500, Sữa chua #212 × 5 |

### 3.2. Logic AutoFarm Kitchen Selection

```ts
// Xác định món cần nấu:
let targetRecipe: FoodRecipe | undefined;

// 1. Theo kế hoạch từng slot (nếu có):
if (planEntry && planEntry.action === 'cook') {
  targetRecipe = foodCatalog.find((f) => f.id === planEntry.recipeId);
}

// 2. Ưu tiên nhiệm vụ mở ô bếp Master (nếu bật):
if (!targetRecipe && cfg.prioritizeCookingMissions && cookState.missions.length > 0) {
  for (const mission of cookState.missions) {
    if (mission.isDone || mission.numCook >= mission.numNeed) continue;
    const recipe = foodCatalog.find((food) => food.id === mission.idFood);
    if (!recipe || !hasMaterials(recipe)) continue;
    targetRecipe = recipe;
    break;
  }
}

// 3. Theo món mặc định cấu hình:
if (!targetRecipe && cfg.defaultRecipeId !== undefined) {
  targetRecipe = foodCatalog.find((f) => f.id === cfg.defaultRecipeId);
}

// 4. Mặc định khi bật autoCook chung:
// Ưu tiên chọn món ĐỦ NGUYÊN LIỆU để nấu. Nếu không có món nào đủ, fallback món đầu tiên để báo thiếu.
if (!targetRecipe && cfg.autoCook && foodCatalog.length > 0) {
  targetRecipe = foodCatalog.find((f) => hasMaterials(f)) ?? foodCatalog[0];
}
```

---

## 4. Kế Hoạch Kiểm Thử (Verification Plan)

1. **Automated Tests**:
   - Cập nhật test cases trong `avatar-web/server/src/autoFarm.test.ts`.
   - Chạy `npm test` trong `avatar-web/server`.
2. **Typecheck & Build**:
   - `npm run build` hoặc `tsc --noEmit` trong cả server và web.
3. **Live Simulation Verification**:
   - Chạy kiểm tra với tài khoản Account 3: có 485 Lúa và 800 Trứng gà.
   - Bánh Trứng cần 2000 Lúa: `canCook` phải trả về `false`.
   - AutoFarm không được gửi packet `cook(0, 1)`.
   - Thay vào đó, nếu bật autoCook, tìm được món đủ nguyên liệu (hoặc in log thiếu nguyên liệu rõ ràng `Lúa #6 (có 485/2000)`).
   - Server không disconnect và không gửi thông báo "Đừng hack bếp nữa".
