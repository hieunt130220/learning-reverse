# Hệ Thống Bếp Nấu Ăn (Cooking / Kitchen / Food / Recipe) — com.TeaM.Avatar

Tài liệu đặc tả toàn diện về hệ thống bếp nấu ăn trong Nông trại (Farm) của Avatar, được phân tích và trích xuất từ reverse engineering (IL2CPP / J2ME) và ánh xạ sang `avatar-web`.

---

## 1. Tổng quan kiến trúc (Architecture Overview)

Hệ thống Bếp nấu ăn là một phân hệ trong mini-game Nông trại (`FarmMsgHandler : IMiniGameMsgHandler`).
- **Giao diện Client**: Quản lý bởi class `CookingScr` (`avatar-re/il2cpp_out/dump.cs`), hiển thị các ô nấu (`listCooking`), danh sách công thức món ăn (`listFoodCooking`) và nhiệm vụ mở ô đặc biệt (`listMission`).
- **Catalog công thức món ăn**: Nạp từ gói dữ liệu tĩnh `FarmData.listFood` (`Food[]`).
- **Giao thức mạng**: Sử dụng **Opcode 91 (`COOKING`)** làm container phân nhánh sub-command, kết hợp với **Opcode 92 (`HARVEST_COOK` / `FLY`)** và **Opcode 93 (`NAU_NHANH`)**.

---

## 2. Giao thức mạng (Network Protocol)

### 2.1. Chiều gửi từ Client -> Server (TX)

Tất cả các method này đã được xác định RVA trong binary `libil2cpp.so` và đã được map vào `FarmService` (`avatar-web/server/src/game/farmService.ts`):

| Cmd | Sub | Tên hàm & RVA | Wire Format (Bytes trên Socket) | Chức năng |
|:---:|:---:|---|---|---|
| **91** | `0` | `FarmService.getCook`<br>(`0x5D2730`) | `[i8 sub=0]` | Mở bếp / Lấy danh sách ô nấu, thời gian đếm ngược & nhiệm vụ mở ô |
| **91** | `1` | `FarmService.doCooking`<br>(`0x5D2994`) | `[i8 sub=1, i8 num, i16 idFood]` | Chọn nấu món: `num` (vị trí ô bếp), `idFood` (ID món ăn) |
| **91** | `2` | `FarmService.doHarvestCook`<br>(`0x5D2C10`) | `[i8 sub=2, i8 slot]` | Thu hoạch món ăn đã nấu chín tại ô `slot` |
| **91** | `3` | `FarmService.doOpenSlot`<br>(`0x5D2D30`) | `[i8 sub=3]` | Mở khoá thêm 1 ô nấu ăn thường (bằng Xu/Lượng) |
| **91** | `4` | `FarmService.doFastCook`<br>(`0x5D283C`) | `[i8 sub=4, i8 step, i8 num]` | Nấu nhanh bằng Lượng: `step` (1: hỏi giá, 2: xác nhận nấu), `num` (ô bếp) |
| **91** | `5` | `FarmService.doOpenLastSlot`<br>(`0x5D2E3C`) | `[i8 sub=5]` | Mở ô nấu ăn cuối cùng đặc biệt sau khi làm xong nhiệm vụ |
| **93** | - | `FarmService.nauNhanh`<br>(`0x5D2B10`) | `[i8 step]` | Nấu nhanh toàn bộ bếp (Cmd 93 `NAU_NHANH`) |

---

### 2.2. Chiều phản hồi từ Server -> Client (RX)

Được điều hướng bởi jump-table trong `FarmMsgHandler.onMessage` (`0x634068`):

#### A. Opcode 91 (`COOKING` Container) — Đọc byte đầu tiên `sub: i8`:

- **`sub = 0` — Khởi tạo dữ liệu bếp & nhiệm vụ (`CookingScr.setInfo`)**:
  - `i8 numSlotCooking`: Số lượng ô bếp đang có / mở khoá.
  - Lặp `numSlotCooking` lần:
    - `i16 idFood`: ID món đang nấu (`-1` nếu ô trống).
    - Nếu `idFood != -1`: đọc tiếp `i32 remainTime` (thời gian còn lại tính bằng giây).
    - Khởi tạo `ItemCooking(idFood, remainTime)` lưu vào danh sách ô nấu.
  - `i8 numMission`: Số lượng nhiệm vụ mở ô cuối.
  - Lặp `numMission` lần:
    - `i16 idFood`: ID món ăn nhiệm vụ yêu cầu.
    - `i32 numCook`: Số lần người chơi đã nấu hoàn thành.
    - `i32 numNeed`: Số lần yêu cầu mục tiêu.
    - Khởi tạo `SlotMission(idFood, numCook, numNeed)`.
  - `bool isUnlocked`: Trạng thái đã mở khoá ô cuối hay chưa.
  - `bool isReadyToOpen`: Đã đủ điều kiện mở ô cuối hay chưa.

- **`sub = 1` — Bắt đầu nấu thành công (`CookingScr.setCook`)**:
  - `i8 slot`: Vị trí ô bếp.
  - `i16 idFood`: ID món ăn.
  - `i32 time`: Tổng thời gian nấu (giây).

- **`sub = 2` — Món ăn nấu xong (`CookingScr.setCookDone`)**:
  - `i8 slot`: Vị trí ô bếp vừa chín.
  - `i16 idFood`: ID món ăn chín.

- **`sub = 3` — Cập nhật số ô bếp đã mở**:
  - `i8 numSlot`: Số lượng ô bếp mới.
  - Client tự động gửi lại `getCook(0)` để làm mới dữ liệu.

- **`sub = 4` — Cập nhật trạng thái / Thu hoạch xong**:
  - `i8 status`: `0` hoặc `1`.
  - Nếu `status == 1`: đọc tiếp `i8 slot`, `i16 idFood` -> gọi `CookingScr.setCookDone(slot, idFood)`.

- **`sub = 5` — Mở khoá slot cuối thành công**:
  - Gọi `CookingScr.unlockSuccess()`.

#### B. Opcode 92 (`HARVEST_COOK` / `FLY` @`0x635E8C`):
- Server trả về dữ liệu món ăn được thu hoạch bay vào rương / túi đồ (`FarmData.getFoodByID`).

#### C. Opcode 93 (`NAU_NHANH` @`0x635DB4`):
- `i8 step`
- `i32 xu`, `i32 luong`, `i32 luongKhoa`: Cập nhật số dư tiền tệ sau khi nấu nhanh qua `Avatar.updateMoney`.

---

## 3. Cấu trúc dữ liệu chi tiết (Data Structures)

### 3.1. Class `Food` (Định nghĩa công thức món ăn)
*File: `avatar-re/il2cpp_out/dump.cs` (Dòng 267961–267976)*
```csharp
public class Food
{
    public short ID;               // Offset 0x10: ID món ăn (recipe ID)
    public short productID;        // Offset 0x12: ID vật phẩm thành phẩm tạo ra
    public short cookTime;         // Offset 0x14: Thời gian nấu
    public short level;            // Offset 0x16: Cấp độ bếp yêu cầu
    public string text;            // Offset 0x18: Tên món ăn & mô tả công thức
    public short[] material;       // Offset 0x20: Mảng ID các nguyên liệu cần thiết
    public short[] numberMaterial; // Offset 0x28: Mảng số lượng tương ứng từng nguyên liệu
}
```

#### Quy trình nạp Catalog Food từ server (`FarmData.readTreeInfo` @`0x630480` - `0x630650`):
1. Đọc `short totalFoods`: Tổng số món ăn trong catalog.
2. Lặp từng món:
   - `readShort()` -> `Food.ID`
   - `readUTF()` -> `Food.text`
   - `readShort()` -> `Food.productID`
   - `readShort()` -> `Food.cookTime`
   - `readShort()` -> `numMaterials` (Số lượng loại nguyên liệu cần)
   - Khởi tạo mảng `material[numMaterials]` và `numberMaterial[numMaterials]`.
   - Lặp `numMaterials` lần:
     - `readShort()` -> `material[i]` (ID nông sản, cá, trứng, sữa, thịt...)
     - `readShort()` -> `numberMaterial[i]` (Số lượng cần)
   - `readByte()` -> `Food.level` (Level bếp yêu cầu)
   - Thêm vào danh sách `FarmData.listFood`.

### 3.2. Class `CookingScr.ItemCooking` (Trạng thái ô bếp)
*File: `avatar-re/il2cpp_out/dump.cs` (Dòng 277754–277769)*
```csharp
public class ItemCooking
{
    public int id;          // Offset 0x10: ID món ăn đang nấu (-1 nếu ô trống)
    public int time;        // Offset 0x14: Tổng thời gian nấu (giây)
    public int curTimeTick; // Offset 0x18: Thời gian đếm ngược còn lại
    public bool isDone;     // Offset 0x1C: Đã nấu chín chưa
    public void update();
}
```

### 3.3. Class `CookingScr.SlotMission` (Nhiệm vụ mở ô bếp Master)
*File: `avatar-re/il2cpp_out/dump.cs` (Dòng 277772–277788)*
```csharp
public class SlotMission
{
    public short id;        // Offset 0x10: ID món ăn cần nấu cho nhiệm vụ
    private Food food;      // Offset 0x18: Đối tượng Food tương ứng
    public int numCook;     // Offset 0x20: Số lần đã nấu hoàn thành
    public int numNeed;     // Offset 0x24: Số lần mục tiêu cần đạt
    public bool isDone;     // Offset 0x28: Nhiệm vụ hoàn thành hay chưa
}
```

### 3.4. Class `CookingScr` (Màn hình quản lý Bếp)
*File: `avatar-re/il2cpp_out/dump.cs` (Dòng 277791–277886)*
- Quản lý danh sách ô bếp (`listCooking`), danh sách món có thể nấu (`listFoodCooking`), danh sách nhiệm vụ mở ô cuối (`listMission`).
- `public int numSlot`: Số lượng ô bếp hiện có của nông trại.
- `public bool isUnlocked`, `isReadyToOpen`: Trạng thái mở khoá ô cuối cùng.
- Hành vi hỗ trợ: Nấu món (`IActionCooking`), Nấu nhanh bằng Lượng (`IActionFastCooking`), Huỷ nấu (`IActionCancelCooking`), Thu hoạch món chín (`IActionCookDone`).

---

## 4. Vòng đời hoạt động của Bếp (Cooking Lifecycle)

```
       [ Client ]                                          [ Server ]
           |                                                   |
           | ----- 1. Cmd 91 (sub 0) getCook ----------------> |
           | <---- 2. Cmd 91 (sub 0) [slots, missions] ------- |
           |                                                   |
           | ----- 3. Cmd 91 (sub 1, slot, idFood) cook -----> |
           | <---- 4. Cmd 91 (sub 1, slot, idFood, time) ----- |
           |                                                   |
     [ Đếm ngược time ]                                        |
           |                                                   |
           | <---- 5. Cmd 91 (sub 2, slot, idFood) done ------ | (hoặc hết time)
           |                                                   |
           | ----- 6. Cmd 91 (sub 2, slot) harvestCook ------> |
           | <---- 7. Cmd 92 (FLY / item added to bag) ------- |
```

---

## 5. Danh sách việc cần làm để tích hợp Web & AutoFarm (Roadmap)

1. **Parser & State Decode (GameClient / FarmData)**:
   - Viết hàm giải mã gói `cmd 91` (sub 0..5), cập nhật `CookingState` cho từng tài khoản: danh sách slot (`ItemCooking[]`), thời gian chín dự kiến (`finishAt`), và tiến độ nhiệm vụ mở ô (`SlotMission[]`).
2. **Catalog Recipes (`listFood`)**:
   - Thêm parser cho `cmd 76` phần món ăn, hoặc tạo hằng số catalog danh mục món ăn mặc định (`DEFAULT_FOOD_CATALOG`) gồm ID món, thời gian nấu, ID thành phẩm và mảng nguyên liệu `material[]` + `numberMaterial[]`.
3. **AutoFarm Cooking Logic**:
   - Định kỳ kiểm tra trạng thái bếp:
     - Nếu có ô đã chín (`isDone` hoặc `remainTime <= 0`): gửi `harvestCook(slot)`.
     - Nếu có ô trống (`idFood == -1`): kiểm tra nguyên liệu trong kho, tự động chọn món ưu tiên (thức ăn gia súc, món nhiệm vụ, hoặc món theo cấu hình user) và gửi `cook(slot, idFood)`.
4. **Giao diện Web (`CookingPanel.tsx`)**:
   - Hiển thị danh sách ô bếp trực quan (icon món đang nấu, progress bar thời gian còn lại, nút Thu hoạch / Nấu nhanh).
   - Danh sách công thức nấu ăn, báo đỏ các nguyên liệu còn thiếu trong kho.
   - Tiến độ nhiệm vụ mở ô bếp đặc biệt.
