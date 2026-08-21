# Spec: Tự Động Bán Món Ăn Sau Khi Thu Hoạch Từ Bếp

## 1. Mục tiêu & Bối cảnh
- **Vấn đề**: Hiện tại trong chu trình AutoFarm, khi các món ăn trong bếp nấu chín (`slot.isDone` hoặc `remainTime <= 0`), hệ thống đã tự động thu hoạch (`harvestCook`) vào kho đồ. Tuy nhiên, người chơi thường muốn quy đổi ngay các món ăn này thành tiền (xu) để xoay vòng vốn mua hạt giống, nguyên liệu hoặc tránh đầy kho.
- **Mục tiêu**: Bổ sung hành động bán ngay (`sellItem`) món ăn vừa thu hoạch xong từ bếp sang Xu trong chu trình AutoFarm.

## 2. Phạm vi (Scope)
- **In-Scope**:
  - Tự động tra cứu `productID` của món ăn vừa thu hoạch từ catalog công thức (`this.client.foods` hoặc `DEFAULT_FOOD_CATALOG`).
  - Gửi lệnh `sellItem(productID, 1)` (Cmd 67) ngay sau khi lệnh `harvestCook` hoàn tất cho mỗi ô bếp chín.
  - Cập nhật interface `ClientFarm` trong `autoFarm.ts` để hỗ trợ gọi `sellItem(idItem: number, num: number)`.
  - Bổ sung ghi log chi tiết khi bán món ăn (`[bếp] bán ngay món #${foodId} (vật phẩm #${productID})`).
  - Cập nhật test cases trong `autoFarm.test.ts` để kiểm chứng luồng thu hoạch kèm bán món ăn.
- **Out-of-Scope**:
  - Không thay đổi logic chế biến của bếp hoặc cơ chế bán thủ công trên UI.
  - Không bán các vật phẩm nguyên liệu chưa chế biến.

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1. Luồng xử lý trong AutoFarm (`autoFarm.ts`)
1. **Trong vòng lặp bếp (Cooking Phase)**:
   - Khi phát hiện ô `slot` đã chín (`slot.idFood !== -1 && (slot.isDone || slot.remainTime <= 0)`):
     - Lưu lại `harvestedFoodId = slot.idFood`.
     - Gửi lệnh `this.client.farm.harvestCook(slot.slot)`.
     - Chờ phản hồi confirm opcode 92 (`thu hoạch món ô ${slot.slot}`).
     - Tra cứu recipe trong catalog `this.client.foods` (hoặc fallback `DEFAULT_FOOD_CATALOG`) theo `harvestedFoodId`.
     - Nếu recipe có `productID > 0`:
       - Gửi lệnh `this.client.farm.sellItem(recipe.productID, 1)`.
       - Tăng biến đếm `sent += 1`.
       - Ghi log: `note(\`[bếp] bán ngay món "\${recipe.name}" (vật phẩm #\${recipe.productID})\`)`.
       - Chờ `tick()`.
     - Reset trạng thái của `slot` (`idFood = -1`, `isDone = false`, `remainTime = 0`).

### 3.2. Data Contracts & Interfaces
- **`ClientFarm` trong `autoFarm.ts`**:
  ```typescript
  farm: {
    ...
    harvestCook(id: number): void;
    sellItem(idItem: number, num: number): void;
    ...
  }
  ```

### 3.3. Test & Verification Plan
- Cập nhật `FakeClient` trong `autoFarm.test.ts` để thêm `sellItem(idItem: number, num: number)`.
- Viết / cập nhật test trong `autoFarm.test.ts`:
  - `bếp: tự động thu hoạch món đã chín và bán ngay`: Ô 0 đang nấu Cơm `#3` (productID 118) chín -> kiểm tra `client.calls` chứa cả `harvestCook:0` và `sellItem:118:1`.
- Chạy toàn bộ test suite: `npm --prefix avatar-web/server test`.
