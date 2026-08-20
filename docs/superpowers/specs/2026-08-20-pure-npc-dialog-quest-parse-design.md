# Thiết Kế: Đồng Bộ Nhiệm Vụ Thuần Túy Từ Hộp Thoại NPC Lái Buôn (Pure NPC Dialog Parsing)

## 1. Mục Tiêu & Bối Cảnh

### 1.1. Bối Cảnh & Yêu Cầu Của Người Dùng
- **Yêu cầu nghiêm ngặt từ người dùng:**
  > *"ko đươc đếm giá trị trong nông trại, chỉ parse từ thông báo của npc thôi"*
- Không tự suy diễn hay đếm số lượng vật nuôi / cây trồng trong nông trại (`FarmState`).
- Toàn bộ tiến trình nhiệm vụ (bao gồm `current`, `total`, `isDone`, `title`, `rewards`) phải được bóc tách 100% từ thông báo hộp thoại thực tế nhận từ NPC Lái buôn (`Cmd -40 / -88 / -70 / -77`).

### 1.2. Phân Tích Nguyên Nhân
1. Khi tài khoản đăng nhập hoặc vào nông trại (`Cmd 69`), client chưa tự động gọi `refreshProgressQuests()` để gửi gói tương tác NPC Lái buôn (`Cmd -59 / -61`).
2. Biến `beginnerQuestState` bị giữ nguyên giá trị khởi tạo `DEFAULT_BEGINNER_QUEST_STATE` (trong đó `Mua 2 con cá chép` mặc định là `0/2`).
3. Khi người dùng bấm nút "Làm mới tất cả" trên giao diện Web, thời gian chờ lấy lại dữ liệu (800ms) quá ngắn so với tổng thời gian gửi các gói tin tương tác NPC (1600ms), khiến dữ liệu mới từ máy chủ chưa kịp cập nhật lên UI.

---

## 2. Phạm Vi Thay Đổi (Scope)

### In-Scope:
1. **`avatar-web/server/src/game/progressQuests.ts`**:
   - Hàm `syncQuestStateWithFarm` tuân thủ nguyên tắc không đếm/can thiệp giá trị từ nông trại, chỉ bảo toàn trạng thái đã parse từ NPC.
   - `parseQuestDialogText`: Đảm bảo parse chính xác 100% các định dạng từ NPC:
     - Điều kiện phân số: `- Mua 5 con gà  - 0/5` -> `current = 0, total = 5, isDone = false`.
     - Điều kiện hoàn thành: `- Mua 2 con cá chép  -Xong` -> `current = 2, total = 2, isDone = true`.
     - Phần thưởng đơn/đa mục: `- 5000 xu - 1 Tiến Sĩ vĩnh viễn - 1 Tiến Sĩ vĩnh viễn`.
2. **`avatar-web/server/src/game/client.ts`**:
   - Trong `onMessage` khi vào nông trại (`case 69 / case 61`): Tự động gọi `void this.refreshProgressQuests()` để tương tác NPC Lái buôn và nhận dialog nhiệm vụ từ máy chủ.
   - Tối ưu luồng `refreshProgressQuests()`: Tương tác NPC Lái buôn (Tân Thủ `subIndex = 1`, Nhà Nông `subIndex = 0`) và nhận phản hồi `Cmd -40 / -88`.
3. **`avatar-web/web/src/accounts/panels/QuestsPanel.tsx`**:
   - Cải thiện thời gian chờ hoặc cơ chế polling sau khi bấm làm mới để đảm bảo nhận đầy đủ dữ liệu sau khi server tương tác xong với NPC.

### Out-of-Scope:
- Tuyệt đối không đếm số lượng vật nuôi hay cây trồng trong `farmState` để ghi đè tiến độ nhiệm vụ.

---

## 3. Thiết Kế Kỹ Thuật

### 3.1. `progressQuests.ts`
- `syncQuestStateWithFarm(quest)`:
  ```typescript
  export function syncQuestStateWithFarm(
    quest: ProgressQuestChain | null | undefined,
  ): ProgressQuestChain | null {
    // Không can thiệp hay tự đếm nông trại, giữ nguyên dữ liệu đã parse từ thông báo NPC
    return quest ?? null;
  }
  ```

### 3.2. `client.ts`
- Khi vào farm (`case 69 / case 61`):
  ```typescript
  // Tự động tương tác với NPC Lái buôn để lấy hộp thoại nhiệm vụ tiến trình
  void this.refreshProgressQuests();
  ```
- Luồng `refreshProgressQuests()`:
  ```typescript
  // 1. Tương tác lấy Nhiệm Vụ Tân Thủ
  this.farm.communicate(-1);
  await new Promise((resolve) => setTimeout(resolve, 300));
  this.farm.doMenuOption(-1, 0, 1);
  await new Promise((resolve) => setTimeout(resolve, 400));

  // 2. Tương tác lấy Nhiệm Vụ Nhà Nông
  this.farm.communicate(-1);
  await new Promise((resolve) => setTimeout(resolve, 300));
  this.farm.doMenuOption(-1, 0, 0);
  await new Promise((resolve) => setTimeout(resolve, 400));

  // 3. Lấy nâng cấp nông trại
  this.farm.getInfoUpgradeFarm(3, 1);
  await new Promise((resolve) => setTimeout(resolve, 200));
  this.farm.getInfoUpgradeFarm(3, 0);
  ```

---

## 4. Verification Plan

### Automated Tests:
- Chạy unit tests: `npm test` trong `avatar-web/server`.
- Build web: `npm run build` trong `avatar-web/server` và `avatar-web/web`.

### Manual Verification:
- Khi NPC Lái buôn trả về dialog:
  ```text
  Nhiệm vụ hiện tại của bạn là nhiệm vụ:Nhiệm Vụ Tân Thủ 2:
  - Mua 5 con gà  - 0/5
  - Mua 2 con cá chép  -Xong

  Phần Thưởng:
  - 5000 xu - 1 Tiến Sĩ vĩnh viễn - 1 Tiến Sĩ vĩnh viễn
  ```
- Kết quả hiển thị trên UI:
  - Tab Tân Thủ:
    - `📌 Mua 5 con gà: 0 / 5 (0%)`
    - `✅ Mua 2 con cá chép: 2 / 2 (100%)`
    - Header: `1/2 điều kiện`
    - Phần thưởng: 5.000 Xu, 1 Tiến Sĩ vĩnh viễn, 1 Tiến Sĩ vĩnh viễn.
