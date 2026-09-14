# Thiết kế Hệ thống Dữ liệu Mặc định (Default System Catalogs: Trees, Items, Animals, Foods)

## 1. Mục tiêu & Bối cảnh
- **Bối cảnh hiện tại:**
  - GameClient và AutoFarm phụ thuộc vào gói Cmd 76 (`GET_TREE_INFO`) để có thông tin về bảng cây (`TreeInfo[]`), bảng vật phẩm (`ItemInfo[]`), bảng vật nuôi (`AnimalInfo[]`), và bảng món ăn (`FoodRecipe[]`).
  - Trong logic hiện tại, mỗi khi vào farm (`cmd 69/61`), `GameClient` tự động phát lệnh `this.farm.getTreeInfo()`. Ngoài ra, mỗi khi vòng lặp auto farm bắt đầu, `AutoFarm.runCycle()` gọi `fetchTreeCatalog()`, nếu chưa có dữ liệu sẽ gửi `getTreeInfo()` và phải dừng lại chờ gói tin trả về (hoặc chờ timeout).
  - Khởi tạo ban đầu của `GameClient` và `emptyRuntimeSnapshot()` trong `runtimeCache.ts` là các mảng rỗng (`[]`). Điều này khiến giao diện web (AssetsPanel, SettingsPanel, ShopPanel) bị trống hoặc thiếu tên/thông tin các đối tượng cho đến khi server game gửi về gói 76.
  - Trên thực tế, dữ liệu catalog của game Avatar (27 loại cây trồng, 11 vật phẩm thiết yếu trong farm, 12 loài vật nuôi, 35 công thức nấu ăn) là cố định, đã được dump và xác minh đầy đủ trong `shop-catalog.json` và `farmData.ts`.
- **Mục tiêu:**
  - Lưu trữ 4 bảng (cây, vật phẩm, vật nuôi, món ăn) làm dữ liệu mặc định của hệ thống trong mã nguồn.
  - Khởi tạo sẵn 4 bảng dữ liệu này ngay khi khởi tạo `GameClient` và `emptyRuntimeSnapshot()`, đảm bảo luôn có dữ liệu đầy đủ cho AutoFarm và Web UI ngay từ giây đầu tiên.
  - Bỏ hoàn toàn các lệnh gửi `getTreeInfo()` tự động khi vào farm (`cmd 69/61`) và trong vòng lặp auto farm (`fetchTreeCatalog`), giảm thiểu network traffic và loại bỏ thời gian trễ chờ catalog.

---

## 2. Phạm vi (Scope)

### In-Scope:
1. **Tập hợp dữ liệu mặc định chuẩn:**
   - `DEFAULT_TREE_CATALOG`: 27 cây (11 cây xu + 16 cây mở rộng cao cấp) với đầy đủ `id`, `name`, `growMinutes`, `value`, `stageImages`, `attrsHex`, `category`.
   - `DEFAULT_ITEM_CATALOG`: 11 vật phẩm tiêu chuẩn trong nông trại (phân bón, thức ăn, thuốc chữa bệnh, thuốc diệt cỏ/sâu) với `id`, `icon`, `type`, `name`, `price`.
   - `DEFAULT_ANIMAL_CATALOG`: 12 vật nuôi chuẩn (id 50..61) với `id`, `name`, `desc` chứa đầy đủ thông số thời gian lớn, tuổi thọ, chu kỳ sản phẩm.
   - `DEFAULT_FOOD_CATALOG`: 35 món ăn chuẩn trong bếp Avatar (đã có trong `farmData.ts`).
2. **Module quản lý Catalog mặc định:**
   - Tạo file `avatar-web/server/src/game/defaultCatalogs.ts` chứa các hằng số typed chuẩn xác.
   - Đồng bộ `DEFAULT_SEED_CATALOG` trong `defaultSeedCatalog.ts` kế thừa từ `DEFAULT_TREE_CATALOG` để đảm bảo duy nhất một nguồn dữ liệu (Single Source of Truth).
3. **Cập nhật GameClient & RuntimeCache:**
   - `GameClient`: Gán giá trị mặc định cho `trees`, `items`, `animals`, `foods`, và đặt `foodCatalogReady = true` ngay trong constructor/property initializer.
   - `runtimeCache.ts`: `emptyRuntimeSnapshot()` gán 4 mảng mặc định thay vì `[]`.
4. **Loại bỏ network call tự động:**
   - Bỏ gọi `this.farm.getTreeInfo()` trong handler cmd 69/61 của `client.ts`.
   - Cập nhật `fetchTreeCatalog()` trong `autoFarm.ts`: Do `trees`, `items`, `animals` đã luôn có sẵn, hàm sẽ trả về `false` ngay lập tức mà không gửi gói tin `getTreeInfo` hay chờ đợi event `trees`.
5. **Duy trì khả năng cập nhật thủ công (Manual / Backward-compatible):**
   - Vẫn giữ nguyên handler `case 76` trong `client.ts` để nếu có lệnh probe thủ công gửi `getTreeInfo`, client vẫn nhận và cập nhật dữ liệu từ wire bình thường.

### Out-of-Scope:
- Không lưu 4 bảng này vào SQLite Database vì các bảng này là tĩnh (static metadata), không thay đổi theo từng tài khoản.
- Không thay đổi các lệnh xin thông tin động theo từng tài khoản như `getCook(0)` (trạng thái nấu ăn hiện tại) hay `getDailyQuest(0)` (tiến trình nhiệm vụ ngày).

---

## 3. Thiết kế Kiến trúc & Giải pháp Kỹ thuật

### 3.1. Danh sách Files & Modules liên quan

| File | Vai trò thay đổi |
|---|---|
| `avatar-web/server/src/game/defaultCatalogs.ts` | **(Mới)** Định nghĩa `DEFAULT_TREE_CATALOG`, `DEFAULT_ITEM_CATALOG`, `DEFAULT_ANIMAL_CATALOG`. |
| `avatar-web/server/src/accounts/defaultSeedCatalog.ts` | Đồng bộ `DEFAULT_SEED_CATALOG` ánh xạ từ `DEFAULT_TREE_CATALOG`. |
| `avatar-web/server/src/game/farmData.ts` | Re-export các catalog mặc định từ `defaultCatalogs.ts` để các module khác dễ import. |
| `avatar-web/server/src/game/client.ts` | Khởi tạo `trees`, `items`, `animals`, `foods` bằng catalog mặc định; gỡ bỏ `this.farm.getTreeInfo()` trong handler `case 69/61`. |
| `avatar-web/server/src/session/runtimeCache.ts` | `emptyRuntimeSnapshot()` sử dụng các catalog mặc định cho 4 bảng. |
| `avatar-web/server/src/autoFarm.ts` | `fetchTreeCatalog()` kiểm tra dữ liệu sẵn có; tối ưu ghi log tránh báo "chờ catalog cây" khi dữ liệu đã có sẵn. |
| `avatar-web/server/src/autoFarm.test.ts` | Cập nhật FakeClient và các test case để phản ánh catalog mặc định. |

---

### 3.2. Cấu trúc Dữ liệu & Data Contracts

#### 1. Bảng Cây (`TreeInfo[]`)
27 loại cây:
- 11 cây trồng bằng Xu: Cà chua (0), Cà rốt (1), Khóm (2), Dưa Hấu (3), Nho (4), Hoa Hồng (5), Lúa (6), Xoài (7), Thanh long (8), Hoa hướng dương (9), Hoa tulip (10).
- 16 cây mở rộng: Bắp (30), Nha đam (31), Dưa Leo (43), Cà tím (32), Tỏi (34), Dâu Tây (35), Chuối (36), Cúc Chuồn Chuồn (39), Bí Ngô (41), Khoai Tây (42), Ớt (44), Ớt hiểm (111), Cải Thảo (45), Nhân Sâm (46), Hoa Tam Giác Mạch (47), Cây Dừa (48).
Mỗi cây chứa đầy đủ `id`, `name`, `growMinutes`, `value`, `stageImages`, `attrsHex`, `category`.

#### 2. Bảng Vật phẩm (`ItemInfo[]`)
11 vật phẩm nông trại thiết yếu:
- Phân bón trung cấp (#111, giá 7 xu), Phân bón siêu cấp (#112, giá 10 xu).
- Thức ăn: Thủy sản (#116, 1 xu), Gia cầm (#117, 1 xu), Gia súc (#118, 1 xu), Cho chó (#119, 1 xu).
- Thuốc: Thuốc cúm (#120, 10 xu), Thuốc tiêu chảy (#121, 10 xu), Thuốc bổ (#122, 25 xu), Thuốc diệt cỏ (#123, 5 xu), Thuốc trừ sâu (#124, 5 xu).

#### 3. Bảng Vật nuôi (`AnimalInfo[]`)
12 loài vật nuôi (id 50..61):
- Gà (#50), Bò (#51), Heo (#52), Chó (#53), Cá chép (#54), Vịt (#55), Cừu (#56), Mèo Tinh Ranh (#57), Trâu (#58), Rùa (#59), Dê (#60), Thỏ (#61).
- Mang chuỗi `desc` chuẩn mực của server thật, tương thích với hàm `parseAnimalSpec(desc)` để bóc tách `growMinutes`, `lifeMinutes`, `hasProduct`.

#### 4. Bảng Món ăn (`FoodRecipe[]`)
- 35 công thức nấu ăn chuẩn trong `DEFAULT_FOOD_CATALOG` (`farmData.ts`), đầy đủ `materials`, `cookTimeMinutes`, `level`, `productID`, `iconId`.

---

### 3.3. Luồng Xử lý (Flow)

```
[Khởi động phiên AvatarSession / GameClient]
           │
           ▼
[GameClient được tạo]
 ├── trees = DEFAULT_TREE_CATALOG (27 cây)
 ├── items = DEFAULT_ITEM_CATALOG (11 vật phẩm)
 ├── animals = DEFAULT_ANIMAL_CATALOG (12 vật nuôi)
 ├── foods = DEFAULT_FOOD_CATALOG (35 món ăn)
 └── foodCatalogReady = true
           │
           ▼
[Vào farm (Cmd 69/61)]
 ├── decodeFarmData(body)
 ├── KHÔNG gửi getTreeInfo() nữa (tiết kiệm băng thông & tránh spam gói)
 ├── Vẫn gửi getCook(0) & getDailyQuest(0) (dữ liệu động cá nhân)
 └── syncProgressQuests() & emit('farm')
           │
           ▼
[AutoFarm chạy runCycle()]
 ├── fetchTreeCatalog():
 │     Kiểm tra client.trees/items/animals > 0 => TRUE ngay lập tức
 │     => return false (không delay, không gửi request Cmd 76)
 └── Thực thi ngay các bước thu hoạch / chăm sóc / trồng cây / vật nuôi
```

---

## 4. Verification Plan

### 4.1. Automated Unit Tests
- Chạy toàn bộ test suite hiện có: `npm test --prefix avatar-web/server`.
- Kiểm tra các test case liên quan đến `AutoFarm`:
  - Test case nhận diện hạt và giờ lớn từ catalog mặc định.
  - Test case tính toán chu kỳ bán/thu hoạch vật nuôi khi đã có sẵn `DEFAULT_ANIMAL_CATALOG`.
  - Đảm bảo 274+ bài test hiện tại đều pass mà không bị break.
- Bổ sung unit test kiểm tra tính nhất quán:
  - `DEFAULT_TREE_CATALOG` có đủ 27 phần tử, không trùng ID.
  - `DEFAULT_ITEM_CATALOG` có đủ 11 phần tử, giá và type hợp lệ.
  - `DEFAULT_ANIMAL_CATALOG` có đủ 12 phần tử, `parseAnimalSpec` parse được spec cho các loài quan trọng.
  - `DEFAULT_SEED_CATALOG` đồng bộ hoàn toàn với `DEFAULT_TREE_CATALOG`.
  - `emptyRuntimeSnapshot()` chứa 4 catalog mặc định.

### 4.2. TypeScript Build & Type Checking
- Chạy `npm run build --prefix avatar-web/server` để đảm bảo strict type checking không có lỗi.
- Chạy `npm run build --prefix avatar-web/web` để đảm bảo frontend build thành công.

### 4.3. GitNexus Graph Analysis
- Chạy `gitnexus_impact` trên các symbol được sửa đổi trước khi edit.
- Chạy `gitnexus_detect_changes` trước khi commit.
