# Spec — Tại sao không nấu được Gà Luộc trên tài khoản phu

> **Ngày:** 2026-08-22
> **Tác giả:** AI agent (debug session)
> **Liên quan:** `avatar-web/server`, tài khoản SQLite `avatar_accounts.id = 2` (label `phu`, game_user `0975720501`)

## 1. Mục tiêu & Bối cảnh

User báo lỗi: **tài khoản phu không nấu được Gà Luộc (recipeId 24)** dù đã cấu hình nấu món này trên toàn bộ 10 ô bếp (`cookingSlotPlan` chứa 10 entry `{slotIndex, action:'cook', recipeId:24}`).

Qua phân tích hệ thống (systematic-debugging Phase 1–3), kết luận:

- **Code nấu ăn KHÔNG sai.** Luồng `AutoFarm.runCycle()` → cooking phase (autoFarm.ts:1135–1214) hoạt động đúng.
- **Nguyên nhân thực sự:** Gà Luộc theo catalog **động từ server game (Cmd76)** yêu cầu **itemId 276 (Thịt gà sống)**, và kho của phu **không có item 276**.
- item 276 **chỉ thu được khi giết mổ gà sắp chết** (sellAnimal, Cmd53, kích hoạt khi `remainingMinutes <= 60`). Kho phu hiện có `#50x400` (trứng gà) → gà đang khỏe, chưa tới lúc giết mổ → chưa bao giờ sinh ra 276.

Do đó autoFarm báo đúng: `[bếp] ô 0 thiếu nguyên liệu để nấu "Gà Luộc"`.

### 1.1. Vấn đề phụ (UX/debugging)

Log chỉ in **tên món ăn** (`thiếu nguyên liệu để nấu "Gà Luộc"`) mà **không nói thiếu vật phẩm nào / thiếu bao nhiêu**. Người dùng không thể tự biết cần "Thịt gà #276". Cần bổ sung tên vật phẩm thiếu vào log.

### 1.2. Vấn đề sai lệch dữ liệu (fallback catalog)

Hai bảng catalog tĩnh cũ đang dùng **sai ID** cho Gà Luộc và các món thịt động vật:

| Recipe | Catalog động (Cmd76 — đúng) | Fallback cũ (SAI) |
|--------|------------------------------|-------------------|
| 24 Gà Luộc | itemId **276** (Thịt gà), 30p, level 1 | itemId **50** (Trứng gà), 120p, level 3 |
| 25 Gà bó xôi | 277+50+6 | 50+6 |
| 22 Heo quay | 282+286+6 | 52+44 |
| 28 Gà Đóng Hộp | 277×20 | 50×1 |

Fallback chỉ được dùng khi `client.foods` rỗng (autoFarm.ts:1106), nên không ảnh hưởng lần chạy của phu (phu đã load đủ 35 món). Nhưng fallback sai sẽ gây hiểu lầm khi catalog động chưa load (UI web `FALLBACK_RECIPES` cũng sai tương tự, CookingPanel.tsx:30).

## 2. Phạm vi (Scope)

### In-scope
1. Cải thiện log "thiếu nguyên liệu" trong cooking phase — in rõ vật phẩm thiếu (id + tên + thiếu bao nhiêu) thay vì chỉ tên món.
2. Cập nhật `DEFAULT_FOOD_CATALOG` (farmData.ts:1084–1491) cho 13 món thịt/động vật khớp với Cmd76 thực tế (276, 277, 282, 283, 295...).
3. Cập nhật `FALLBACK_RECIPES` (web CookingPanel.tsx:6–41) tương ứng để UI không hiển thị sai.

### Out-of-scope
- **Không** sửa logic nấu ăn (đã đúng).
- **Không** tự động giết mổ gà để lấy thịt (đây là quyết định gameplay của user; autoFarm đã có `sellAnimals` + `sellNearDeathSpecies:[50,...]` sẽ bán gà sắp chết — nhưng bán ra xu, không tích lũy thịt 276 trừ khi game trả thịt khi giết).
- **Không** thay đổi cấu hình tài khoản phu (user tự quyết định có nuôi gà để lấy thịt hay đổi sang món dùng vật phẩm có sẵn).

### Input / Output
- **Input:** snapshot tài khoản qua `GET /api/accounts/2/state` (đã xác minh: foods[24].materials=[{itemId:276,count:1}], inventory/produce không có 276).
- **Output:** log cooking phase rõ ràng hơn; fallback catalog đồng bộ với Cmd76.

### Edge cases
- Catalog động chưa load (`foodCatalogReady=false`) → vẫn dùng fallback; fallback mới sẽ khớp ID thực tế.
- Nhiều vật phẩm thiếu → log tất cả, không chỉ vật phẩm đầu tiên.

## 3. Thiết kế kiến trúc & Giải pháp kỹ thuật

### 3.1. Files / modules liên quan

| File | Vai trò |
|------|---------|
| `avatar-web/server/src/autoFarm.ts` (1135–1214) | Cooking phase — sửa log thiếu nguyên liệu |
| `avatar-web/server/src/game/farmData.ts` (1084–1491) | `DEFAULT_FOOD_CATALOG` — cập nhật ID thịt |
| `avatar-web/web/src/accounts/panels/CookingPanel.tsx` (6–41) | `FALLBACK_RECIPES` — cập nhật ID thịt |
| `avatar-web/server/src/game/client.ts` (1020) | `client.foods` (catalog động Cmd76) — nguồn sự thật |

### 3.2. Data contract

`FoodRecipe.materials: { itemId: number; count: number }[]` — `itemId` phải là ID thực tế từ Cmd76:
- 276 = Thịt gà, 277 = Gà luộc (sản phẩm), 282 = Thịt heo (chế biến), 283 = Cá chép (chế biến), 295 = Thịt trâu, 279 = Ba ba (chế biến), 272 = Dưa hấu cô đặc, 271 = Khoai tây, 266/289 = nguyên liệu Trà hoa cúc, 297 = Vịt (chế biến).

### 3.3. Flow xử lý (cooking phase — không đổi logic)

```
for slot in cookState.slots:
  targetRecipe = resolveRecipe(planEntry, missions, default, autoCook)
  if targetRecipe:
    missing = materials filter (availableMaterials.get(id) < count)
    if missing.empty: cook()
    else: note("[bếp] ô {slot} thiếu {tên vật phẩm} #{id} ({có}/{cần}) để nấu \"{tên món}\"")
```

### 3.4. Diagram

```
Cmd76 server → decodeFoodCatalog → client.foods (35 món, ID thực)
                                    │
                                    ├─(rỗng)→ DEFAULT_FOOD_CATALOG [CẦN SỬA ID]
                                    │
AutoFarm cooking phase ─────────────┘
   └─ availableMaterials = inventory + produce
   └─ canCook? → cook() | note("thiếu <tên vật phẩm>")
```

## 4. Verification Plan

1. **Re-run diagnostic** `src/tools/get-phu-state.ts` → xác nhận `foods[24].materials=[{itemId:276}]` (đã đúng, không đổi).
2. **Typecheck server**: `npx tsc --noEmit` trong `avatar-web/server`.
3. **Typecheck web**: `npm run typecheck` workspace `avatar-web-ui`.
4. **Unit check fallback**: so sánh `DEFAULT_FOOD_CATALOG.find(24).materials` == `[{itemId:276,count:1}]`.
5. **Manual log check**: kích hoạt 1 chu kỳ auto trên phu → log phải hiện `"thiếu Thịt gà #276 (0/1) để nấu \"Gà Luộc\""` thay vì chỉ tên món.
6. Dọn dẹp tool `src/tools/get-phu-state.ts` sau khi verify.

## 5. Bổ sung thiết kế — tách đúng các section của Cmd70

### 5.1. Bằng chứng mới và nguyên nhân gốc

Dump trực tiếp Cmd70 của tài khoản `phu` xác nhận bốn section có ý nghĩa khác nhau:

| Section | Nội dung | Ví dụ thực tế |
|---------|----------|---------------|
| 1 | Hạt giống | `#4×4` là 4 hạt Nho |
| 2 | Vật phẩm thường | `#120×1` |
| 3 | Nông sản đã thu hoạch / sản phẩm vật nuôi | `#50×400` là 400 Trứng gà |
| 4 | Nguyên liệu/vật phẩm đặc biệt dùng cho bếp | `#276×10` Gà nguyên con, `#279×4` Mai rùa may mắn |

Mapping hiện tại trong `GameClient` gộp section 1 + 2 + 4 vào `inventory`, còn section 3 vào `produce`. Vì `CookingPanel` và `AutoFarm` tiếp tục gộp `inventory + produce`, ID `#4` ở section 1 bị hiểu sai thành 4 nông sản Nho. Đây là lỗi phân loại dữ liệu, không phải lỗi catalog tên hay recipe.

### 5.2. Phạm vi bổ sung

#### In-scope

1. Giữ `inventory` đúng nghĩa kho thường gồm section 1 + 2 để không phá các consumer hiện có.
2. Thêm collection riêng `cookingMaterials` cho Cmd70 section 4.
3. Giữ `produce` là Cmd70 section 3.
4. Snapshot backend phát thêm `cookingMaterials`; web type cho phép field optional để tương thích rolling deploy.
5. `CookingPanel` tính số lượng nguyên liệu từ `farmProduce + cookingMaterials`, tuyệt đối không lấy seed inventory.
6. `AutoFarm` kiểm tra và trừ nguyên liệu ảo từ `client.produce + client.cookingMaterials`, tuyệt đối không lấy seed inventory.
7. Xóa tool chẩn đoán tạm `avatar-web/server/src/tools/chk-item4.ts` sau verification.

#### Out-of-scope

- Không thay đổi binary decoder `decodeInventory`; decoder đã trả đúng `seeds`, `items`, và `other`.
- Không đổi ID hoặc tên recipe/catalog.
- Không thay đổi cách hiển thị toàn bộ kho trong `AssetsPanel`; màn này vẫn được phép nhận `inventory` và `farmProduce` riêng.
- Không tạo test file mới nếu user không yêu cầu trực tiếp, theo quy định no-TDD của project.

### 5.3. Data contract mới

```ts
GameClient.inventory        = [...inv.seeds, ...inv.items] // Cmd70 sections 1 + 2
GameClient.produce          = inv.other[0] ?? []           // Cmd70 section 3
GameClient.cookingMaterials = inv.other[1] ?? []           // Cmd70 section 4
```

Snapshot runtime:

```ts
interface AvatarSessionSnapshot {
  inventory: InventoryItem[];
  farmProduce: InventoryItem[];
  cookingMaterials: InventoryItem[];
}
```

Web rolling-deploy contract:

```ts
interface SessionSnapshot {
  inventory: InventoryItem[];
  farmProduce?: InventoryItem[];
  cookingMaterials?: InventoryItem[];
}
```

Nguồn số lượng dành riêng cho bếp:

```ts
const availableCookingMaterials = [...farmProduce, ...cookingMaterials];
```

Không dùng:

```ts
[...inventory, ...farmProduce]
```

### 5.4. Files/modules bổ sung

| File | Thay đổi |
|------|----------|
| `avatar-web/server/src/game/client.ts` | Tách Cmd70 section 4 thành `cookingMaterials`; bỏ section 4 khỏi `inventory` |
| `avatar-web/server/src/session/avatarSession.ts` | Phát `cookingMaterials` trong snapshot |
| `avatar-web/server/src/autoFarm.ts` | Tính nguyên liệu bếp từ section 3 + 4 |
| `avatar-web/web/src/types.ts` | Khai báo `SessionSnapshot.cookingMaterials?` |
| `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx` | Truyền `farmProduce` và `cookingMaterials` vào `CookingPanel` |
| `avatar-web/web/src/accounts/panels/CookingPanel.tsx` | Bỏ `inventory` khỏi contract/count của bếp; sửa khai báo `produce` đang bị lặp |

### 5.5. Flow sau khi sửa

```text
Cmd70 → decodeInventory
          ├─ section 1 + 2 → inventory (hạt + vật phẩm thường)
          ├─ section 3     → produce (nông sản/sản phẩm vật nuôi)
          └─ section 4     → cookingMaterials (nguyên liệu đặc biệt)

produce + cookingMaterials
          ├─ AutoFarm: kiểm tra đủ nguyên liệu trước Cmd91
          └─ CookingPanel: hiển thị số lượng có/cần
```

### 5.6. Verification Plan bổ sung

1. Typecheck server bằng local TypeScript binary.
2. Typecheck web workspace.
3. Chạy diagnostic/live snapshot cho tài khoản `phu` và xác nhận:
   - `inventory` có `#4×4` nhưng không ảnh hưởng số lượng bếp.
   - `farmProduce` có `#50×400`.
   - `cookingMaterials` có `#276×10` và `#279×4`.
4. Kiểm tra UI:
   - Nho `#4` hiển thị `0/2000` khi chỉ có 4 hạt và không có nông sản Nho.
   - Trứng gà `#50` vẫn hiển thị `400/<số cần>`.
   - Gà nguyên con `#276` vẫn hiển thị `10/1`.
5. Kiểm tra AutoFarm dùng cùng nguồn section 3 + 4, không nấu dựa trên số lượng hạt giống.
6. Chạy `gitnexus_detect_changes({scope: "all"})` trước khi hoàn tất/commit.

## 6. GitNexus impact report

Phân tích trước thay đổi ngày 2026-08-22:

- `GameClient`: **LOW**, 1 direct import được graph ghi nhận, không có process bị ảnh hưởng.
- `AvatarSession`: **LOW**, không có upstream impact được graph ghi nhận.
- `CookingPanel`: **LOW**, không có upstream impact được graph ghi nhận.
- `AutoFarm`: **LOW**, không có upstream impact được graph ghi nhận.

Không có cảnh báo HIGH/CRITICAL.

## 7. User Review Gate

Chờ user duyệt phần bổ sung Spec về việc tách Cmd70 section 3/4 trước khi tạo Implementation Plan và thực thi production code.
