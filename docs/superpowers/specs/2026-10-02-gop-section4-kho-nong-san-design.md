# Spec: Gộp Section 4 Vào Kho Nông Sản (Cmd 70) & Bổ Sung Danh Mục Vật Phẩm

## Mục tiêu & Bối cảnh
- **Bối cảnh**:
  - Gói tin Cmd 70 (`INVENTORY`) phản hồi từ server game chứa 4 section:
    - Section 1: Hạt giống (`seeds` / `itemMua`)
    - Section 2: Vật phẩm nông trại (`items` / `itemVP`)
    - Section 3: Nông sản và sản phẩm chăn nuôi cơ bản (`itemProduct`): lúa, sữa bò, trứng gà, xoài, cà rốt...
    - Section 4: Nông sản cao cấp và thủy hải sản/thịt tươi sống (`listFarmProduct`): dưa leo #202, bí ngô #270, ba ba/mai rùa #279, cá chép tươi sống #283, vịt tươi sống #297...
  - Đối chiếu mã nguồn IL2CPP client AvatarHD (`FarmScr.goKhoHang` @0x650428):
    - Client duyệt qua cả `itemProduct` (Section 3) và `listFarmProduct` (Section 4) rồi đổ chung vào giao diện Kho Hàng (Kho nông sản).
  - **Vấn đề**:
    - `avatar-web/server` tại `GameClient.ts` đang tách Section 4 thành `cookingMaterials` và chỉ gán Section 3 vào `produce`.
    - Hậu quả: Màn hình Kho (tab Nông sản), hệ thống bán hàng chợ (`ShopCoordinator`), và các công cụ probe bị thiếu toàn bộ nông sản Section 4 (ví dụ: thiếu 450 bí ngô, 1520 dưa leo, 10 vịt tươi sống, 18 cá chép tươi sống, 4 mai rùa).
    - `KNOWN_PRODUCE_NAME_MAP` (server) và `ANIMAL_PRODUCT_NAMES` (web) thiếu ánh xạ tên cho các ID nông sản/nguyên liệu Section 4 này.

- **Mục tiêu**:
  - Gộp cả Section 3 và Section 4 vào danh sách nông sản `produce` của `GameClient`.
  - Cập nhật bảng tên `KNOWN_PRODUCE_NAME_MAP` ở server và `ANIMAL_PRODUCT_NAMES` / catalog hiển thị ở web để giải mã đầy đủ tên nông sản Section 4.
  - Đảm bảo tính nhất quán giữa kho nông sản, bếp nấu ăn (`autoFarm.ts`, `CookingPanel.tsx`) và gian hàng chợ (`ShopCoordinator`).

## Phạm vi (Scope)

### In-scope
1. **Server**:
   - `src/game/client.ts`: Gộp `inv.other[0]` (Section 3) và `inv.other[1]` (Section 4) vào `this.produce`. Vẫn giữ `this.cookingMaterials` tham chiếu Section 4 để tương thích ngược.
   - `src/game/farmData.ts`: Bổ sung các ID nông sản/nguyên liệu Section 4 vào `KNOWN_PRODUCE_NAME_MAP` (#200, #202, #204, #249, #266, #270, #271, #272, #276, #277, #279, #282, #283, #286, #289, #295, #297).
   - `src/autoFarm.ts`: Điều chỉnh bộ tập hợp nguyên liệu nấu ăn `availableMaterials` để tránh bị cộng lặp số lượng khi `produce` đã chứa cả Section 4.
2. **Web**:
   - `web/src/accounts/panels/CookingPanel.tsx`: Cập nhật `ANIMAL_PRODUCT_NAMES` bổ sung các ID Section 4 để `AssetsPanel.tsx` hiển thị đúng tên thay vì mã số raw `#id`.

### Out-of-scope
- Không thay đổi cấu trúc gói wire protocol Cmd 70 (giữ nguyên hàm `decodeInventory`).
- Không tạo các file test mới (tuân thủ quy định KHÔNG TDD của project).

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### 1. `avatar-web/server/src/game/client.ts`
- Tại `case 70` (decode kho đồ):
  ```typescript
  const section3 = inv.other[0] ?? [];
  const section4 = inv.other[1] ?? [];
  this.produce = [...section3, ...section4];
  this.cookingMaterials = section4;
  ```
- Emit event:
  - `this.emit('produce', [...this.produce]);`
  - `this.emit('cooking-materials', [...this.cookingMaterials]);`

### 2. `avatar-web/server/src/game/farmData.ts`
- Cập nhật `KNOWN_PRODUCE_NAME_MAP` thêm các ID:
  - `200`: 'Bắp hạt'
  - `202`: 'Dưa leo'
  - `204`: 'Đậu nành'
  - `249`: 'Chuối xanh'
  - `266`: 'Hoa cúc khô'
  - `270`: 'Bí ngô'
  - `271`: 'Khoai tây cô đặc'
  - `272`: 'Dưa hấu cô đặc'
  - `276`: 'Thịt gà sống'
  - `277`: 'Gà luộc'
  - `279`: 'Mai rùa / Ba ba'
  - `282`: 'Thịt heo tươi'
  - `283`: 'Cá chép tươi sống'
  - `286`: 'Ớt xay'
  - `289`: 'Táo đỏ'
  - `295`: 'Thịt trâu tươi'
  - `297`: 'Vịt tươi sống'

### 3. `avatar-web/server/src/autoFarm.ts`
- Tại đoạn tính nguyên liệu bếp:
  ```typescript
  const availableMaterials = new Map<number, number>();
  for (const item of (this.client.produce ?? [])) {
    availableMaterials.set(item.id, (availableMaterials.get(item.id) ?? 0) + item.num);
  }
  ```
  *(Vì `produce` đã bao gồm cả Section 3 và Section 4, không cần gộp thêm `cookingMaterials` tránh đúp số lượng).*

### 4. `avatar-web/web/src/accounts/panels/CookingPanel.tsx`
- Bổ sung các ID trên vào `ANIMAL_PRODUCT_NAMES` (hoặc bảng ánh xạ phụ) để `KhoSection` trong `AssetsPanel.tsx` tra cứu tên hiển thị chuẩn xác.

## Verification Plan

### Automated Checks
- Server typecheck & build:
  `npm --prefix avatar-web/server run typecheck`
- Web typecheck & build:
  `npm --prefix avatar-web/web run typecheck` (hoặc `npx tsc -b --noEmit`)

### Manual Verification
- Chạy probe kho `inv-dump.ts` trên tài khoản thật:
  - Kiểm tra danh sách `produce` in ra có đầy đủ:
    - 450 Bí ngô (#270)
    - 1520 Dưa leo (#202)
    - 10 Vịt tươi sống (#297)
    - 18 Cá chép tươi sống (#283)
    - 4 Mai rùa (#279)
    - Cùng các nông sản cây trồng thường từ Section 3.
- Mở Web UI tab Kho nông sản:
  - Tất cả các item Section 4 hiển thị rõ tên tiếng Việt kèm số lượng, không còn hiện mã raw `#270` hay `#202`.
