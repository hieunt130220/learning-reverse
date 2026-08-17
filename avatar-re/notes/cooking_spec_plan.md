# Đặc Tả Kỹ Thuật (Spec) & Kế Hoạch Triển Khai (Plan): Hệ Thống Bếp Nấu Ăn (Cooking System)

Tài liệu này được xây dựng theo quy trình chuẩn **Spec → Plan → Production Code** (CLAUDE.md), phục vụ việc tích hợp hoàn chỉnh phân hệ Bếp Nấu Ăn vào dự án `avatar-web` (GameClient, Session, WebSocket, AutoFarm Engine và Web Frontend).

---

# PHẦN 1: ĐẶC TẢ KỸ THUẬT (SPECIFICATION)

## 1. Mục Tiêu & Phạm Vi (Scope)
- **Mục tiêu**: Xây dựng phân hệ Bếp nấu ăn (Kitchen/Cooking) hoàn chỉnh, kết nối liền mạch giữa Game Server (Avatar Teamobi), Server Backend (`avatar-web/server`) và Giao diện Quản lý Web (`avatar-web/web`).
- **Phạm vi chức năng**:
  1. **Giải mã giao thức nhị phân (Binary Protocol Decoder)**: Bóc tách gói tin Cmd 91 (sub 0..5), Cmd 92, Cmd 93 và catalog món ăn từ Cmd 76.
  2. **Quản lý trạng thái phiên (State & Session)**: Lưu trữ `CookingState` và `FoodRecipe[]` trên `GameClient`, tự động đồng bộ qua WebSocket tới Web UI.
  3. **Tương tác thủ công (Manual Operations via REST API)**: Hỗ trợ mở bếp, nấu món, thu hoạch món chín, mở thêm ô nấu ăn và mở ô bếp Master.
  4. **Tự động hóa (AutoFarm Engine)**: Thêm bước kiểm tra bếp (`cookPhase`) trong chu kỳ chạy tự động: tự thu hoạch món chín, tự chọn món nấu theo cấu hình ưu tiên (nhiệm vụ mở ô / thức ăn gia súc / công thức tùy chọn) khi đủ nguyên liệu trong kho.
  5. **Giao diện người dùng (Web Frontend)**: Cung cấp `CookingPanel` trực quan hiển thị danh sách nồi nấu, đồng hồ đếm ngược, danh sách công thức đối chiếu nguyên liệu trong kho, và tích hợp cài đặt vào `AutoFarmPanel`.

---

## 2. Giao Thức Mạng & Wire Formats

### 2.1. Chiều gửi Client -> Server (TX)
Gửi qua `FarmService` (`avatar-web/server/src/game/farmService.ts`):

| Opcode | Sub-type | Tên hàm | Payload Wire | Ý nghĩa nghiệp vụ |
|:---:|:---:|---|---|---|
| **91** | `0` | `getCook(step)` | `[i8 step=0]` | Lấy danh sách ô bếp, thời gian còn lại & nhiệm vụ mở ô cuối |
| **91** | `1` | `cook(num, id)` | `[i8 sub=1, i8 num, i16 id]` | Nấu món: `num` (chỉ số ô bếp), `id` (ID công thức món) |
| **91** | `2` | `harvestCook(id)` | `[i8 sub=2, i8 id]` | Thu hoạch món chín tại ô `id` |
| **91** | `3` | `openCookSlot()` | `[i8 sub=3]` | Mở thêm 1 ô bếp thường (tiêu Xu/Lượng) |
| **91** | `4` | `fastCook(step, num)` | `[i8 sub=4, i8 step, i8 num]` | Nấu nhanh bằng Lượng: `step=1` (hỏi giá), `step=2` (xác nhận) |
| **91** | `5` | `openLastCookSlot()` | `[i8 sub=5]` | Mở ô bếp Master cuối cùng sau khi hoàn thành nhiệm vụ |
| **93** | - | `nauNhanh(step)` | `[i8 step]` | Nấu nhanh toàn bộ bếp (Cmd 93 `NAU_NHANH`) |

---

### 2.2. Chiều phản hồi Server -> Client (RX)
Xử lý trong `GameClient.onMessage` (`avatar-web/server/src/game/client.ts`):

#### A. Cmd 91 (`COOKING` Container) — Đọc `sub: i8` đầu tiên:
1. **`sub = 0` (Snapshot trạng thái bếp & nhiệm vụ)**:
   - `i8 numSlot`: Số lượng ô bếp hiện có.
   - Vòng lặp `numSlot` lần:
     - `i16 idFood`: ID món đang nấu (`-1` nếu ô trống).
     - Nếu `idFood != -1`: `i32 remainTime` (thời gian nấu còn lại tính bằng giây).
     - Khởi tạo `ItemCooking { slot: i, idFood, remainTime, isDone: remainTime <= 0 }`.
   - `i8 numMission`: Số lượng nhiệm vụ mở ô bếp Master.
   - Vòng lặp `numMission` lần:
     - `i16 idFood`: ID món yêu cầu.
     - `i32 numCook`: Số lần đã nấu thành công.
     - `i32 numNeed`: Số lần mục tiêu cần đạt.
     - Khởi tạo `SlotMission { idFood, numCook, numNeed, isDone: numCook >= numNeed }`.
   - `bool isUnlocked`: Đã mở ô Master hay chưa.
   - `bool isReadyToOpen`: Đã đủ điều kiện mở ô Master hay chưa.

2. **`sub = 1` (Bắt đầu nấu thành công)**:
   - `i8 slot`: Vị trí ô bếp.
   - `i16 idFood`: ID món ăn.
   - `i32 time`: Tổng thời gian nấu (giây).
   - Cập nhật ô `slot`: `idFood = idFood`, `remainTime = time`, `time = time`, `isDone = false`.

3. **`sub = 2` (Món ăn nấu xong)**:
   - `i8 slot`: Vị trí ô bếp vừa nấu chín.
   - `i16 idFood`: ID món ăn chín.
   - Cập nhật ô `slot`: `isDone = true`, `remainTime = 0`.

4. **`sub = 3` (Mở thêm ô bếp thành công)**:
   - `i8 numSlot`: Số lượng ô bếp mới.
   - Cập nhật `numSlot` và tự động gửi `getCook(0)` để đồng bộ.

5. **`sub = 4` (Cập nhật trạng thái slot)**:
   - `i8 status`: Nếu `status === 1` đọc tiếp `i8 slot`, `i16 idFood` -> đánh dấu ô chín `isDone = true`.

6. **`sub = 5` (Mở ô Master thành công)**:
   - Đánh dấu `isUnlocked = true`.

#### B. Cmd 92 (`HARVEST_COOK` / `FLY`):
- Server gửi thông tin item thành phẩm bay vào kho/rương.

#### C. Cmd 76 (Catalog công thức món ăn):
- Sau khối đọc `AnimalInfo[]`, nếu còn dữ liệu:
  - `i16 totalFoods`
  - Lặp `totalFoods` lần:
    - `i16 id`: ID món.
    - `utf name`: Tên món.
    - `i16 productID`: ID vật phẩm thành phẩm tạo ra.
    - `i16 cookTimeMinutes`: Thời gian nấu (phút).
    - `i16 numMaterials`: Số lượng loại nguyên liệu cần.
    - Lặp `numMaterials` lần: `[i16 materialId, i16 count]`.
    - `i8 level`: Cấp độ bếp yêu cầu.

---

## 3. Mô Hình Dữ Liệu (Data Models)

### 3.1. Backend (`avatar-web/server/src/game/farmData.ts`)

```typescript
export interface FoodMaterial {
  itemId: number;
  count: number;
}

export interface FoodRecipe {
  id: number;
  name: string;
  productID: number;
  cookTimeMinutes: number;
  level: number;
  materials: FoodMaterial[];
}

export interface ItemCooking {
  slot: number;
  idFood: number;
  time: number;
  remainTime: number;
  isDone: boolean;
  cookStartedAt?: number;
}

export interface SlotMission {
  idFood: number;
  numCook: number;
  numNeed: number;
  isDone: boolean;
}

export interface CookingState {
  numSlot: number;
  slots: ItemCooking[];
  missions: SlotMission[];
  isUnlocked: boolean;
  isReadyToOpen: boolean;
  updatedAt: number;
}
```

### 3.2. Cấu hình AutoFarm (`avatar-web/server/src/autoFarm.ts`)

```typescript
export interface CookingSlotPlanEntry {
  slotIndex: number;
  action: 'auto' | 'recipe' | 'mission' | 'skip';
  recipeId?: number;
}

export interface AutoFarmCookingConfig {
  autoCook: boolean;
  autoHarvestCook: boolean;
  prioritizeMissions: boolean;
  defaultRecipeId?: number;
  slotPlan?: CookingSlotPlanEntry[];
}
```

---

## 4. Xử Lý Các Trường Hợp Biên (Edge Cases)

1. **Server không trả catalog trong Cmd 76**: Cung cấp `DEFAULT_FOOD_CATALOG` tĩnh chuẩn để hệ thống luôn có đủ danh mục công thức hiển thị trên Web.
2. **Thời gian nấu lệch hoặc âm (`remainTime <= 0`)**: Khi client offline rồi kết nối lại, nếu `remainTime <= 0` và `idFood !== -1` thì tự động coi như món đã chín (`isDone = true`).
3. **Trùng lặp nguyên liệu khi nấu nhiều ô trong cùng 1 chu kỳ AutoFarm**: Duy trì bộ đếm nguyên liệu ảo (`simulatedProduce` / `simulatedInventory`) trong suốt lượt duyệt các ô trống của `cookPhase` để không gửi lệnh nấu vượt quá số lượng nguyên liệu thực có trong kho.
4. **Kho đầy khi thu hoạch món ăn**: Khi nhận phản hồi rương đầy (Cmd -40 / dialog), ngắt bước thu hoạch cooking của chu kỳ hiện tại và ghi log cảnh báo cho người dùng.

---

# PHẦN 2: KẾ HOẠCH TRIỂN KHAI (IMPLEMENTATION PLAN)

## Danh sách tệp cần chỉnh sửa / tạo mới (Affected Files)

| STT | File Path | Vai trò | Thay đổi chính |
|:---:|---|---|---|
| 1 | `avatar-web/server/src/game/farmData.ts` | Data Layer | Khai báo interfaces, `DEFAULT_FOOD_CATALOG`, hàm `decodeCookingPacket`, `decodeFoodCatalog` |
| 2 | `avatar-web/server/src/game/client.ts` | Protocol Handler | Thêm `cookingState`, `foods`, xử lý opcode 91, 92, 93, phát event `cooking` |
| 3 | `avatar-web/server/src/session/avatarSession.ts` | Session Hub | Thêm `cooking` vào `AvatarSessionSnapshot`, chuyển tiếp event ra WebSocket |
| 4 | `avatar-web/server/src/session/routes.ts` | REST API | Thêm các endpoint `/farm/cook`, `/farm/harvest-cook`, `/farm/cook/open-slot`, `/farm/cook/refresh` |
| 5 | `avatar-web/server/src/autoFarm.ts` | Automation Engine | Mở rộng `AutoFarmConfig`, thêm `cookPhase` vào `runCycle` |
| 6 | `avatar-web/server/src/accounts/autoConfig.ts` | DTO Validation | Validate cấu hình cooking trong DTO lưu SQLite |
| 7 | `avatar-web/web/src/types.ts` | Frontend Types | Khai báo các interface `CookingState`, `ItemCooking`, `FoodRecipe`, `SlotMission` |
| 8 | `avatar-web/web/src/accounts/accountRuntime.ts` | Reducer | Bổ sung case `'cooking'` cập nhật snapshot frontend |
| 9 | `avatar-web/web/src/api.ts` | API Client | Bổ sung các phương thức gọi API Bếp nấu ăn |
| 10 | `avatar-web/web/src/accounts/panels/CookingPanel.tsx` | UI Component *(Mới)* | Bảng điều khiển Bếp: lưới nồi nấu, đếm ngược, danh mục công thức, nhiệm vụ mở ô |
| 11 | `avatar-web/web/src/accounts/panels/AutoFarmPanel.tsx` | UI Component | Thêm section cấu hình tự động nấu ăn |
| 12 | `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx` | UI Container | Tích hợp `CookingPanel` vào danh sách panel trong Drawer |

---

## Các Giai Đoạn Triển Khai Chi Tiết (Step-by-Step Roadmap)

### Giai Đoạn 1: Protocol & Data Models (Backend)
- [ ] **Bước 1.1**: Cập nhật `farmData.ts` — định nghĩa cấu trúc dữ liệu, `DEFAULT_FOOD_CATALOG`, và các hàm decode gói nhị phân (Cmd 91, Cmd 76 foods).
- [ ] **Bước 1.2**: Cập nhật `client.ts` — thêm thuộc tính `cookingState`, tích hợp switch case opcode 91, 92, 93 và phát event `'cooking'`. Tự động gọi `getCook(0)` khi vào farm.

### Giai Đoạn 2: Session Snapshot & REST Endpoints (Backend)
- [ ] **Bước 2.1**: Cập nhật `avatarSession.ts` — đưa `cooking` và `foods` vào `AvatarSessionSnapshot`, phát qua WebSocket stream.
- [ ] **Bước 2.2**: Cập nhật `routes.ts` — tạo các endpoints POST điều khiển bếp thủ công từ giao diện Web.

### Giai Đoạn 3: Tự Động Hóa Nấu Ăn trong AutoFarm Engine (Backend)
- [ ] **Bước 3.1**: Cập nhật `autoFarm.ts` — bổ sung giai đoạn `cookPhase` trong `runCycle()`:
  - Thu hoạch các món chín qua `harvestCook(slot)`.
  - Tự động phân bổ nấu món vào ô trống nếu đủ nguyên liệu (ưu tiên nhiệm vụ hoặc công thức cấu hình).
- [ ] **Bước 3.2**: Cập nhật `autoConfig.ts` — bổ sung schema parse/serialize cho cấu hình cooking.

### Giai Đoạn 4: Xây Dựng Giao Diện Quản Lý Web (Frontend)
- [ ] **Bước 4.1**: Cập nhật `types.ts`, `accountRuntime.ts`, `api.ts` phía client web.
- [ ] **Bước 4.2**: Xây dựng component `CookingPanel.tsx` (lưới ô bếp, progress timer, modal danh mục công thức, tiến độ nhiệm vụ mở slot).
- [ ] **Bước 4.3**: Bổ sung cài đặt nấu ăn vào `AutoFarmPanel.tsx`.
- [ ] **Bước 4.4**: Nhúng `CookingPanel` vào `AccountOperationsDrawer.tsx`.

---

## Quy Tắc Kiểm Soát An Toàn (Safety & Impact Analysis)
- Trước khi chỉnh sửa bất kỳ symbol cốt lõi (`GameClient`, `AutoFarm`, `AvatarSession`), bắt buộc chạy `gitnexus_impact` để kiểm tra độ phụ thuộc.
- Chạy `gitnexus_detect_changes()` trước khi commit để đảm bảo phạm vi thay đổi chính xác.
- Viết code production trực tiếp, tuân thủ nguyên tắc không viết test trước (No TDD).
