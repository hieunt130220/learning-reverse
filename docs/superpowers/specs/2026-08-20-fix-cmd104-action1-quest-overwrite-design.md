# Thiết Kế: Loại Bỏ Ghi Đè Tiến Trình Nhiệm Vụ Từ Gói Nâng Cấp Nông Trại (Cmd 104 Action 1)

## 1. Mục Tiêu & Bối Cảnh

### 1.1. Vấn Đề
Trên giao diện web vẫn hiển thị sai:
- `✅ Mua 5 con gà: 5 / 5 (100%)`

### 1.2. Phân Tích Nguyên Nhân Gốc (Root Cause)
Khi bấm "Làm mới tất cả" hoặc khi vào game:
1. Hàm `refreshProgressQuests()` trong `client.ts` gửi `getInfoUpgradeFarm(1)`.
2. Máy chủ phản hồi gói `Cmd 104 (action = 1)`. Gói này thực chất là **Màn hình Nâng cấp Nông trại cấp 2** (`UpgradeFarmLv2`), chứa số lượng vật nuôi hiện có trong chuồng (`itemType = 4` -> `cur = 5` con gà).
3. Trong `progressQuests.ts`, nhánh `action === 1` của `decodeProgressQuestPacket` đang gán cứng:
   ```typescript
   if (screenType === 1) {
     const conditions: ProgressQuestCondition[] = [
       {
         name: 'Mua 5 con gà',
         current: Math.min(5, chickenCur), // chickenCur = 5 từ chuồng gà
         total: 5,
         isDone: chickenCur >= 5, // -> Bị ép thành true (5/5)!
       },
       ...
     ];
   }
   ```
4. Gói này đã ghi đè lên dữ liệu nhiệm vụ chuẩn từ hộp thoại NPC Lái buôn (`Cmd -40 / -88`), biến `Mua 5 con gà (0/5)` thành `5/5 (100%)`.

---

## 2. Phạm Vi Thay Đổi (Scope)

### In-Scope:
1. **`avatar-web/server/src/game/progressQuests.ts`**:
   - Loại bỏ việc gán cứng trạng thái nhiệm vụ giả định trong `action === 1` của `decodeProgressQuestPacket`. Nhánh `action === 1` chỉ là thông tin nâng cấp nông trại, trả về `{ status: 'ignored', action: 1 }`.
   - Giữ nguyên giải mã danh sách điều kiện động `MissionInfo` trong `action === 2` và `action === 3`.
   - Giữ nguyên bộ phân giải hộp thoại NPC (`parseQuestDialogText`).

2. **`avatar-web/server/src/game/client.ts`**:
   - Dọn dẹp `refreshProgressQuests`: không gửi `getInfoUpgradeFarm(1)` và `getInfoUpgradeFarm(5)` trong chu trình làm mới nhiệm vụ tiến trình để tránh nhận các gói nâng cấp nông trại không liên quan.

---

## 3. Thiết Kế Kỹ Thuật Chi Tiết

### 3.1. `progressQuests.ts`
Trong `decodeProgressQuestPacket`:
```typescript
// action = 1 là màn hình nâng cấp nông trại (UpgradeFarmLv2), không phải nhiệm vụ
if (action === 1) {
  return { status: 'ignored', action: 1 };
}
```

### 3.2. `client.ts`
Trong `refreshProgressQuests`:
```typescript
async refreshProgressQuests(force = false): Promise<void> {
  if (this.status !== 'online') return;
  const now = Date.now();
  if (!force && now - this.lastProgressRefreshAt < 2000) return;
  this.lastProgressRefreshAt = now;

  try {
    this.emit('log', 'gửi yêu cầu lấy nhiệm vụ tiến trình & tương tác NPC Lái buôn...');

    // 1. Gửi các gói UpgradeFarm tiến trình Tân Thủ (3, 1) và Nhà Nông (3, 0)
    this.farm.getInfoUpgradeFarm(3, 1);
    await new Promise((resolve) => setTimeout(resolve, 200));
    this.farm.getInfoUpgradeFarm(3, 0);
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 2. Tương tác với NPC Lái buôn trong nông trại để lấy hộp thoại nhiệm vụ
    this.farm.communicate(-1);
    await new Promise((resolve) => setTimeout(resolve, 300));
    this.farm.doMenuOption(-1, 0, 1); // Nhiệm Vụ Tân Thủ
    await new Promise((resolve) => setTimeout(resolve, 300));

    this.farm.communicate(-1);
    await new Promise((resolve) => setTimeout(resolve, 300));
    this.farm.doMenuOption(-1, 0, 0); // Nhiệm Vụ Nhà Nông
  } catch (err) {
    this.emit('log', `làm mới nhiệm vụ tiến trình lỗi: ${(err as Error).message}`);
  }
}
```

---

## 4. Verification Plan

### Automated Tests:
- Chạy `npm test` trong `avatar-web/server` -> 100% pass.
- Chạy `npm run build` trong `avatar-web/server` và `avatar-web/web` -> 100% pass.

### Manual Verification:
- Khởi động lại server và làm mới nhiệm vụ.
- Xác nhận trên Web:
  - `📌 Mua 5 con gà: 0 / 5 (0%)`
  - `✅ Mua 2 con cá chép: 2 / 2 (100%)`
  - Tab Tân Thủ: `1/2 điều kiện`.
