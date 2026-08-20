# Thiết Kế: Sửa Lỗi Hiển Thị Tiến Trình Nhiệm Vụ Khớp 1:1 Với Hộp Thoại Game

## 1. Mục Tiêu & Bối Cảnh

### 1.1. Vấn Đề
Trên giao diện web hiện đang hiển thị:
- `✅ Mua 5 con gà: 5 / 5 (100%)`
- `✅ Mua 2 con cá chép: 2 / 2 (100%)`

Tuy nhiên, trong hộp thoại thực tế từ game Avatar HD:
- `📌 Mua 5 con gà  - 0/5` (Người chơi **chưa** mua 5 con gà cho nhiệm vụ này, tiến trình là `0/5`)
- `✅ Mua 2 con cá chép  -Xong` (Người chơi **đã** mua 2 con cá chép và hoàn thành)

### 1.2. Phân Tích Nguyên Nhân Gốc (Root Cause)
1. **Nhiệm vụ trong game là bộ đếm hành động (Action Counter), không phải số lượng tồn tại tức thời:**
   - Điều kiện *"Mua 5 con gà"* yêu cầu người chơi thực hiện hành động mua 5 con gà kể từ khi nhận nhiệm vụ Tân Thủ 2.
   - Hàm `syncQuestStateWithFarm` trước đó đã tự động đếm tổng số gà có sẵn trong chuồng (`farmState.animals.filter(a => a.species === 50).length`) và ép `current = 5`, dẫn đến hiển thị sai `5/5 (100%)` trong khi máy chủ game chỉ ghi nhận `0/5`.
2. **Nguồn chân lý dữ liệu nhiệm vụ (Single Source of Truth):**
   - Hộp thoại từ NPC Lái buôn (`Cmd -40 / -88`) và gói tiến trình `Cmd 104` chính là nguồn dữ liệu chuẩn xác nhất từ máy chủ:
     - Dòng `- Mua 5 con gà  - 0/5` -> `current: 0, total: 5, isDone: false`
     - Dòng `- Mua 2 con cá chép  -Xong` -> `current: 2, total: 2, isDone: true`
   - Không được dùng `farmState.animals` để tự ý ghi đè dữ liệu tiến độ mà máy chủ đã trả về.

---

## 2. Phạm Vi Thay Đổi (Scope)

### In-Scope:
1. **`avatar-web/server/src/game/progressQuests.ts`**:
   - Điều chỉnh `syncQuestStateWithFarm` thành passthrough (hoặc loại bỏ việc ghi đè số lượng vật nuôi lên các nhiệm vụ hành động "Mua ...").
   - Đảm bảo `parseQuestDialogText` là nguồn dữ liệu chính xác tuyệt đối:
     - Khớp regex `-Xong` / `- Xong` -> `current = total, isDone = true`.
     - Khớp regex `-\s*(\d+)\s*\/\s*(\d+)` -> `current = m[2], total = m[3], isDone = current >= total`.

2. **`avatar-web/server/src/game/client.ts`**:
   - Giữ nguyên luồng cập nhật từ `parseQuestDialogText` và `decodeProgressQuestPacket`.

### Out-of-Scope:
- Không thay đổi các giao tiếp mạng khác.

---

## 3. Thiết Kế Kỹ Thuật Chi Tiết

Trong `progressQuests.ts`:
```typescript
export function syncQuestStateWithFarm(
  quest: ProgressQuestChain | null | undefined,
  _farmState: FarmState | null | undefined,
  _inventory?: readonly InventoryItem[] | null,
  _produce?: readonly InventoryItem[] | null,
): ProgressQuestChain | null {
  if (!quest || !quest.conditions || quest.conditions.length === 0) return quest ?? null;
  // Dữ liệu tiến trình từ server (parseQuestDialogText và decodeProgressQuestPacket)
  // là nguồn chân lý chính xác nhất. Không tự ý ghi đè tiến trình hành động của server.
  return quest;
}
```

Khi nhận hộp thoại từ game:
```text
Nhiệm vụ hiện tại của bạn là nhiệm vụ:Nhiệm Vụ Tân Thủ 2:
- Mua 5 con gà  - 0/5
- Mua 2 con cá chép  -Xong

Phần Thưởng:
- 5000 xu - 1 Tiến Sĩ vĩnh viễn - 1 Tiến Sĩ vĩnh viễn
```
Kết quả bóc tách:
- Điều kiện 1: `name: "Mua 5 con gà"`, `current: 0`, `total: 5`, `isDone: false` -> Hiển thị `📌 Mua 5 con gà: 0 / 5 (0%)`.
- Điều kiện 2: `name: "Mua 2 con cá chép"`, `current: 2`, `total: 2`, `isDone: true` -> Hiển thị `✅ Mua 2 con cá chép: 2 / 2 (100%)`.
- Tiến trình tổng thể tab Tân Thủ: `1/2 điều kiện`.

---

## 4. Verification Plan

### Automated Tests:
- Chạy test case với chuỗi hộp thoại game:
  ```text
  Nhiệm vụ hiện tại của bạn là nhiệm vụ:Nhiệm Vụ Tân Thủ 2:
  - Mua 5 con gà  - 0/5
  - Mua 2 con cá chép  -Xong
  ```
  Xác minh:
  - `conditions[0]` có `name: 'Mua 5 con gà'`, `current: 0`, `total: 5`, `isDone: false`.
  - `conditions[1]` có `name: 'Mua 2 con cá chép'`, `current: 2`, `total: 2`, `isDone: true`.
- Chạy `npm test` trong `avatar-web/server` -> 100% pass.
- Chạy `npm run build` trong `avatar-web/server` và `avatar-web/web` -> 100% pass.

### Manual Verification:
- Kiểm tra giao diện web khớp 100% với ảnh trong game:
  - `Mua 5 con gà: 0 / 5 (0%)`
  - `Mua 2 con cá chép: 2 / 2 (100%)`
  - Tiêu đề phụ: `1/2 điều kiện`.
