# Spec: Sửa tab Kho — Nông sản phải là nông sản thật (section 3 của gói 70)

## Mục tiêu & Bối cảnh
- **Bối cảnh**: Gói kho cmd 70 có 4 section: **1 = hạt giống**, **2 = vật phẩm**, **3 = nông sản
  thu hoạch** (đo thật: `#6×2813 lúa, #50×530 trứng gà, #51×202 sữa bò`), 4 = chưa rõ. Server
  (`GameClient`) chỉ ghép section 1+2 vào `inventory` (nên Kho tab "Nông sản" của web hiện liệt kê
  **hạt giống**: Xoài × 6, Thanh long × 6, Hoa tulip × 84, Nho × 4) và **bỏ mất section 3**.
- **Mục tiêu**:
  - Forward **nông sản thật** (section 3) từ server lên web qua event mới `farm-produce` và đưa
    vào `SessionSnapshot.farmProduce`.
  - Tab **Nông sản** của Kho hiển thị `farmProduce` (đúng là nông sản dùng trong công thức nấu ăn);
    tab **Vật phẩm & Hạt giống** hiển thị `inventory` (hạt giống + vật phẩm).
  - Kết quả trên tài khoản thật: Nông sản = `#5 Hoa hồng ×966, #3 Dưa hấu ×552, #7 Xoài ×480,
    #8 Thanh long ×252, #10 Hoa tulip ×329, #50 Trứng gà ×400, #0 Cà chua ×392`; hạt giống
    (Xoài/Thanh long/Hoa tulip/Nho) dời sang tab còn lại.

## Phạm vi (Scope)
- **In-scope**:
  - Server: `avatar-web/server/src/session/avatarSession.ts` — thêm `farmProduce` vào snapshot +
    forward event `farm-produce` từ `GameClient` 'produce'.
  - Web: `types.ts` (SessionSnapshot.farmProduce), `accountRuntime.ts` (case 'farm-produce'),
    `AccountOperationsDrawer.tsx` (truyền prop), `AssetsPanel.tsx` (KhoSection: tab Nông sản =
    produce), `CookingPanel.tsx` (export `ANIMAL_PRODUCT_NAMES` để đặt tên trứng/sữa).
  - Docs spec + plan.
- **Out-of-scope**:
  - Không sửa `decodeInventory`, `GameClient.inventory/produce`, shop produce (`ShopCoordinator`).
  - Không sửa lỗi đếm nguyên liệu trong `CookingPanel` (đang đếm cả hạt giống) — ghi chú follow-up.
  - Không viết test mới (user không yêu cầu).

## Thiết kế kiến trúc & Giải pháp kỹ thuật
### 1. Server `avatarSession.ts`
- `AvatarSessionSnapshot`: thêm `farmProduce: unknown[]` (cạnh `inventory`).
- `snapshot()`: `farmProduce: c?.produce ?? []` (`GameClient.produce` = section 3, đã decode sẵn).
- `wire()`: thêm handler
  ```ts
  client.on('produce', (produce: unknown) => {
    if (this.isCurrent(client, epoch)) this.emit('farm-produce', produce);
  });
  ```

### 2. Web
- `types.ts`: `SessionSnapshot` thêm `farmProduce?: InventoryItem[]` (optional — rolling deploy).
- `accountRuntime.ts`: `case 'farm-produce': return { ...current, farmProduce: message.payload };`
- `CookingPanel.tsx`: `export const ANIMAL_PRODUCT_NAMES` (đã có, chỉ thêm export).
- `AccountOperationsDrawer.tsx`: truyền `produce={snapshot?.farmProduce ?? []}` vào `AssetsPanel`.
- `AssetsPanel.tsx` `KhoSection`:
  - Props: `{ accountId, inventory, produce, trees, items, animals }`.
  - Tên hiển thị dùng map như `CookingPanel`: items + trees + animals + `ANIMAL_PRODUCT_NAMES`
    (để `#50` hiện "Trứng gà", `#51` "Sữa bò"...).
  - Tab **Nông sản**: render `produce`.
  - Tab **Vật phẩm & Hạt giống**: render `inventory` (hạt giống + vật phẩm).
  - Bỏ phân loại cũ `isProduce` (theo bảng cây).

## Verification Plan
- Server: `npm --prefix avatar-web/server run typecheck && npm --prefix avatar-web/server test`.
- Web: `cd avatar-web/web && npx tsc -b --noEmit && npx vitest run`.
- Trên `http://localhost:5173/accounts/2` (server `tsx watch` tự reload):
  - Tab Nông sản: `Hoa hồng × 966, Dưa hấu × 552, Xoài × 480, Thanh long × 252, Hoa tulip × 329,
    Trứng gà × 400, Cà chua × 392`.
  - Tab Vật phẩm & Hạt giống: `Nho × 4, Xoài × 6, Thanh long × 6, Hoa tulip × 84, Thuốc tiêu chảy × 1`.
