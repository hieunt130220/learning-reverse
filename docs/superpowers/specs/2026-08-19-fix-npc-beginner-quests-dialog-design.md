# Thiết Kế: Sửa Lỗi Hiển Thị Nhiệm Vụ Tân Thủ Từ NPC Lái Buôn

## 1. Mục Tiêu & Bối Cảnh

### 1.1. Bối Cảnh
Người dùng cung cấp ảnh chụp trực tiếp từ game Avatar HD:
Khi tương tác với NPC **Lái buôn** (`xinkn01`, `Lái buôn`) trong nông trại, máy chủ trả về hộp thoại:
```text
Nhiệm vụ hiện tại của bạn là nhiệm vụ:Nhiệm Vụ Tân Thủ 2:
- Mua 5 con gà  - 0/5
- Mua 2 con cá chép  - 0/2

Phần Thưởng:
- 5000 xu - 1 Tiến Sĩ vĩnh viễn - 1 Tiến Sĩ vĩnh viễn
```

Mục tiêu: Đảm bảo khi người dùng tải nhiệm vụ hoặc xem tab **Tân Thủ**, web avatar-web nhận được đúng hộp thoại này và hiển thị chính xác:
- Tiêu đề: **Nhiệm Vụ Tân Thủ 2** (Bước 2)
- Điều kiện:
  1. Mua 5 con gà (0/5)
  2. Mua 2 con cá chép (0/2)
- Phần thưởng:
  1. 5.000 Xu
  2. 1 Tiến Sĩ vĩnh viễn
  3. 1 Tiến Sĩ vĩnh viễn

### 1.2. Phân Tích Nguyên Nhân & Giải Pháp
1. **Lệnh gửi menu option NPC Lái buôn trong `client.ts`**:
   - `client.ts` trong `refreshProgressQuests()` hiện gửi:
     - `communicate(-1)` (tương tác NPC Lái buôn)
     - `doMenuOption(-1, 0, 0)` (`menuIndex = 0, subIndex = 0` -> Menu option 0: Nhiệm vụ Nhà Nông)
     - `doMenuOption(-1, 1, 0)` (`menuIndex = 1, subIndex = 0` -> SAI menuIndex, server bỏ qua vì NPC Lái buôn chỉ có menu 0)
   - Menu của NPC Lái buôn có nhiều tùy chọn trong menu `0`:
     - Tùy chọn 0: Nhiệm vụ Nhà Nông (`subIndex = 0`)
     - Tùy chọn 1: Nhiệm vụ Tân Thủ (`subIndex = 1`) -> Server trả về `Nhiệm Vụ Tân Thủ 2` qua `Cmd -40`!
     - Tùy chọn 2: Cửa hàng (`subIndex = 2`)
   - Cần sửa trong `refreshProgressQuests()` gửi đầy đủ các tùy chọn của menu `0`: `doMenuOption(-1, 0, 0)`, `doMenuOption(-1, 0, 1)`, `doMenuOption(-1, 0, 2)`.

2. **Parser phần thưởng đa mục trên cùng 1 dòng trong `progressQuests.ts`**:
   - Phần thưởng từ dialog game: `- 5000 xu - 1 Tiến Sĩ vĩnh viễn - 1 Tiến Sĩ vĩnh viễn` chứa 3 phần thưởng trên cùng 1 dòng cách nhau bởi ` - `.
   - Parser cũ chỉ split theo dòng `\n`, dẫn đến gộp cả 3 phần thưởng vào 1 mục duy nhất.
   - Cần cập nhật `parseQuestDialogText` để tách các phần thưởng phân tách bởi ` - ` trên cùng một dòng.

3. **Bảo Toàn Nhiệm Vụ Nhà Nông (`Cmd 104`)**:
   - Giữ nguyên 100% logic `action = 1` của `decodeProgressQuestPacket` cho **Nhiệm Vụ Nhà Nông - 1** (không động chạm hay đổi kind sang beginner).

---

## 2. Phạm Vi Thay Đổi (Scope)

### In-Scope:
1. `avatar-web/server/src/game/progressQuests.ts`:
   - Nâng cấp `parseQuestDialogText` để hỗ trợ tách nhiều phần thưởng phân tách bởi ` - ` trên cùng một dòng hoặc nhiều dòng.
   - Giữ nguyên toàn bộ logic decode `action = 1` của Nhiệm Vụ Nhà Nông.
2. `avatar-web/server/src/game/client.ts`:
   - Cập nhật `refreshProgressQuests()` gửi tương tác NPC Lái buôn với các option: `doMenuOption(-1, 0, 0)` và `doMenuOption(-1, 0, 1)` và `doMenuOption(-1, 0, 2)`.
   - Khi nhận `Cmd -40` hoặc `Cmd -88`, `parseQuestDialogText` tự động cập nhật `beginnerQuestState` (khi dialog chứa Tân Thủ) và `farmerQuestState` (khi dialog chứa Nhà Nông).
3. `avatar-web/web/src/accounts/panels/QuestsPanel.tsx`:
   - Đảm bảo hiển thị đúng rewards và checklist điều kiện của `beginnerQuestState`.

### Out-of-Scope:
- Không thay đổi logic auto-farm, auto-harvest, auto-cooking.

---

## 3. Verification Plan
- Chạy unit script với chuỗi dialog thực tế:
  ```text
  Nhiệm vụ hiện tại của bạn là nhiệm vụ:Nhiệm Vụ Tân Thủ 2:
  - Mua 5 con gà  - 0/5
  - Mua 2 con cá chép  - 0/2

  Phần Thưởng:
  - 5000 xu - 1 Tiến Sĩ vĩnh viễn - 1 Tiến Sĩ vĩnh viễn
  ```
  Xác minh kết quả:
  - `kind: 'beginner'`, `title: 'Nhiệm Vụ Tân Thủ 2'`, `step: 2`
  - 2 điều kiện: `Mua 5 con gà (0/5)`, `Mua 2 con cá chép (0/2)`
  - 3 phần thưởng: `5.000 Xu`, `1 Tiến Sĩ vĩnh viễn`, `1 Tiến Sĩ vĩnh viễn`
- Build TypeScript server & web.
