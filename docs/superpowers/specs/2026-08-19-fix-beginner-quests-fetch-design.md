# Thiết Kế: Sửa Lỗi Chưa Lấy Được Nhiệm Vụ Tân Thủ

## 1. Mục Tiêu & Bối Cảnh

### 1.1. Vấn Đề
Khi người dùng vào tab **Tân Thủ** trên giao diện Nhiệm Vụ Nông Trại (`QuestsPanel.tsx`) hoặc nhấn nút "Tải Nhiệm Vụ Tân Thủ từ game", hệ thống chỉ nhận được dữ liệu **Nhiệm Vụ Nhà Nông - 1** và tab Tân Thủ vẫn hiển thị thông báo trống: *"Chưa nhận dữ liệu Nhiệm Vụ Tân Thủ từ máy chủ game"*.

Log thực tế từ người dùng:
```text
3:29:37 PM gửi yêu cầu lấy nhiệm vụ tiến trình & tương tác NPC Lái buôn...
3:29:38 PM nhận gói 104: length=249, hex=0101177800010032000a00140002000a14...
3:29:38 PM cập nhật Nhiệm Vụ Nhà Nông - 1: Thu hoạch 200 cà chua (0/200), Thu hoạch 200 cà rốt (0/200), Mua 2 con gà (2/2)
```

### 1.2. Phân Tích Nguyên Nhân Gốc (Root Causes)
Qua phân tích disassembly từ `libil2cpp.so` (`GlobalMessageHandler$$openInfoUpgradeFarm` @ `0x5fa3a4`, `UpgradeFarmLvl2Scr` @ `0x863d30`):

1. **Thiếu lệnh gửi yêu cầu Nhiệm Vụ Tân Thủ trong `client.ts`**:
   - Phương thức `refreshProgressQuests()` hiện chỉ gửi:
     - `communicate(-1)` & `doMenuOption(-1, 0, 0)`: Tương tác NPC Lái buôn (chỉ trả về Nhiệm Vụ Nhà Nông qua `Cmd -40`).
     - `getInfoUpgradeFarm(1)`: Gửi `Cmd 104 (type = 1)` (thông tin nâng cấp nông trại cấp 2).
     - `getInfoUpgradeFarm(5)`: Gửi `Cmd 104 (type = 5)` (BeeScr).
   - **Chưa từng gửi**:
     - `getInfoUpgradeFarm(3, 1)`: Gửi `Cmd 104 (type = 3, idType = 1)` — Lệnh chính thức trong IL2CPP để lấy dữ liệu **Nhiệm Vụ Tân Thủ**.
     - `getInfoUpgradeFarm(3, 0)`: Gửi `Cmd 104 (type = 3, idType = 0)` — Lệnh lấy dữ liệu **Nhiệm Vụ Nhà Nông**.

2. **Lỗi lệch Byte (Stream Desync) trong Decoder `action = 3` (`progressQuests.ts`)**:
   - Trong `decodeProgressQuestPacket` (`action = 2 | 3`), trường `idFarm` của `UpgradeInfo` bị đọc vô điều kiện (`readInt()`).
   - Nhưng theo IL2CPP disassembly: `idFarm` **chỉ tồn tại** khi `type === 7` (Nông sản) hoặc `type === 9` (Thuốc). Khi phần thưởng là Xu (`type = 6`) hoặc EXP (`type = 10`), server **không gửi** `idFarm`. Đọc thừa 4 byte làm lệch toàn bộ cấu trúc `missionCount` và các chuỗi UTF nhiệm vụ phía sau.

3. **Gán sai loại tiến trình trong Decoder `action = 1` (`progressQuests.ts`)**:
   - Khi server trả gói `action = 1`, byte thứ 2 chính là `screenType` (`1` = Tân Thủ, `0` = Nhà Nông).
   - Decoder cũ bỏ qua `screenType`, luôn ép cứng `kind: 'farmer'`, `title: 'Nhiệm Vụ Nhà Nông - 1'`, và gán danh sách điều kiện cố định (200 cà chua, 200 cà rốt, 2 gà).

---

## 2. Phạm Vi Thay Đổi (Scope)

### In-Scope:
1. **`avatar-web/server/src/game/client.ts`**:
   - Bổ sung `getInfoUpgradeFarm(3, 1)` (Tân Thủ) và `getInfoUpgradeFarm(3, 0)` (Nhà Nông) vào chu trình `refreshProgressQuests()`.
   - Đảm bảo phát sinh sự kiện `quests` và cập nhật cả `beginnerQuestState` và `farmerQuestState` khi nhận phản hồi tương ứng.
2. **`avatar-web/server/src/game/progressQuests.ts`**:
   - Sửa lỗi decode phần thưởng trong `action = 3`: Chỉ đọc `idFarm` khi `type === 7 || type === 9`.
   - Phân giải đúng `screenType` trong `action = 1`: `screenType = 1` -> `kind: 'beginner'`, `screenType = 0` -> `kind: 'farmer'`.
   - Decode động toàn bộ 20 hạng mục yêu cầu trong `action = 1` thay vì gán tĩnh.
3. **`avatar-web/web/src/accounts/panels/QuestsPanel.tsx`**:
   - Tối ưu UX: Tự động kích hoạt tải nhiệm vụ tiến trình khi chuyển tab nếu chưa có dữ liệu.

### Out-of-Scope:
- Không thay đổi cấu trúc bảng nhiệm vụ hàng ngày (`Cmd -87 / sub 4`).
- Không can thiệp logic auto-farm / trồng cây / thu hoạch.

---

## 3. Thiết Kế Kỹ Thuật Chi Tiết

### 3.1. Sửa Lỗi Decoder trong `progressQuests.ts`

```typescript
// Trong nhánh action = 2 || action = 3:
const rewards: ProgressQuestReward[] = [];
for (let i = 0; i < rewardCount; i++) {
  const type = r.readByte();
  let idFarm = 0;
  // idFarm chỉ xuất hiện khi type là 7 (Nông sản) hoặc 9 (Thuốc)
  if (type === 7 || type === 9) {
    idFarm = r.readInt();
  }
  const request = r.readInt();
  const inStorage = r.readInt();

  rewards.push({
    type,
    amount: request,
    value: request,
    extra: idFarm,
    displayName: getRewardDisplayName(type, request, idFarm),
  });
}
```

Phân biệt `kind` và `title` theo `screenType`:
- `screenType === 1`: `kind = 'beginner'`, `title = 'Nhiệm Vụ Tân Thủ'`
- `screenType === 0`: `kind = 'farmer'`, `title = 'Nhiệm Vụ Nhà Nông'`

### 3.2. Cập Nhật Hàm Gửi Yêu Cầu `refreshProgressQuests` trong `client.ts`

```typescript
async refreshProgressQuests(force = false): Promise<void> {
  if (this.status !== 'online') {
    this.emit('log', `không thể làm mới nhiệm vụ: client ${this.status}`);
    return;
  }
  const now = Date.now();
  if (!force && now - this.lastProgressRefreshAt < 3000) {
    return;
  }
  this.lastProgressRefreshAt = now;
  try {
    this.emit('log', 'gửi yêu cầu lấy nhiệm vụ Tân Thủ & Nhà Nông...');

    // 1. Gửi yêu cầu lấy Nhiệm Vụ Tân Thủ (type 3, idType 1)
    this.farm.getInfoUpgradeFarm(3, 1);
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 2. Gửi yêu cầu lấy Nhiệm Vụ Nhà Nông (type 3, idType 0)
    this.farm.getInfoUpgradeFarm(3, 0);
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 3. Tương tác với NPC Lái buôn trong nông trại (id -1) để lấy dialog nhiệm vụ bổ sung
    this.farm.communicate(-1);
    await new Promise((resolve) => setTimeout(resolve, 200));
    this.farm.doMenuOption(-1, 0, 0);
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 4. Lấy thông tin nâng cấp nông trại cấp 2
    this.farm.getInfoUpgradeFarm(1);
  } catch (err) {
    this.emit('log', `làm mới nhiệm vụ tiến trình lỗi: ${(err as Error).message}`);
  }
}
```

---

## 4. Verification Plan

### 4.1. Kiểm Tra Giải Mã (Unit / Logic Verification)
- Chạy decode với mẫu packet hex do người dùng cung cấp (`hex=01011778000100...`), xác minh:
  - `action = 1`, `screenType = 1` được nhận diện đúng loại `beginner` (Tân Thủ).
  - Không bị crash, không bị gán đè sai sang `Nhiệm Vụ Nhà Nông`.
- Tạo payload giả lập `action = 3` với `rewardCount` gồm Xu (`type = 6`) và EXP (`type = 10`) kèm danh sách `MissionInfo` tiếng Việt UTF, kiểm tra giải mã chuẩn xác không bị lệch byte.

### 4.2. Kiểm Tra Tích Hợp Web (Integration & UI Verification)
- Khởi động backend server và frontend web.
- Vào tab **Tân Thủ** trên giao diện, bấm "Tải Nhiệm Vụ Tân Thủ từ game" (hoặc "Làm mới tất cả").
- Kiểm tra log máy chủ gửi gói `getInfoUpgradeFarm(3, 1)` và nhận phản hồi `Cmd 104`.
- Xác nhận tab **Tân Thủ** hiển thị đúng danh sách điều kiện và phần thưởng thay vì trạng thái trống.
