# Thiết Kế Kỹ Thuật (Design Document): Fix Lỗi Hiển Thị Nhiệm Vụ Hàng Ngày Sai Trạng Thái Game

## 1. Mục Tiêu & Bối Cảnh (Context & Goal)
- **Bối cảnh**: Trên giao diện xem nhiệm vụ nông trại (`QuestsPanel`), tài khoản hiển thị `100 / 100 điểm · Đã hoàn thành`, toàn bộ 5 mốc rương quà năng động đều ở trạng thái `Đã nhận`, và danh sách nhiệm vụ = 0 với thông báo "Đã hoàn thành toàn bộ nhiệm vụ hôm nay". Trong khi đó thực tế trong game tài khoản chưa hoàn thành nhiệm vụ nào và chưa nhận rương nào.
- **Mục tiêu**: Điều tra chính xác nguyên nhân gốc (Root Cause) từ giao thức nhị phân đảo ngược (reverse-engineered protocol), sửa triệt để bộ phân giải gói tin mạng `cmd -87` và xử lý trạng thái `DailyQuestState`, đảm bảo hiển thị đúng 100% dữ liệu thực tế từ máy chủ game.

---

## 2. Phân Tích Nguyên Nhân Gốc (Root Cause Investigation)

Qua dịch ngược mã máy ARM64 trong `libil2cpp.so` tại các RVA liên quan (`GlobalMessageHandler.onMessage` @0x5E5FD4, switch-case opcode `-87` @0x5ED07C, jump-table `sub_type` @0x14E33D4, `DailyQuestScr.dailyQuestMessage` @0xAF7664):

1. **Sai lệch Sub-type trong Dispatcher `cmd -87` (`client.ts:532`)**:
   - Giao thức game của opcode `-87` (0xA9) có cấu trúc byte đầu tiên là `sub_type`:
     - `sub_type = 1` (@0x5ED0B4): `INFO_TEXT_BOX_SERVER` / `getServerLoginInfo` (văn bản tin nhắn hệ thống).
     - `sub_type = 2` (@0x5F18D8): `CUSTOM_CHEST` / Part data (gói dữ liệu rương đồ / trang bị gửi định kỳ khi đăng nhập hoặc đổi map).
     - `sub_type = 3` (@0x5F1368): Cập nhật thông tin avatar người chơi (`LoadMap.getAvatar`).
     - `sub_type = 4` (@0x5F1E3C): **DUY NHẤT** gọi đến `DailyQuestScr.dailyQuestMessage(msg)` để cập nhật Nhiệm vụ Hàng ngày.
   - Trong `avatar-web/server/src/game/client.ts`, điều kiện xử lý gói `-87` lại chấp nhận cả `data[0] === 2 || data[0] === 4`:
     ```typescript
     if (data.length > 0 && (data[0] === 2 || data[0] === 4)) {
       const res = decodeDailyQuestPacket(data.subarray(1), ...);
     ```
   - Khi server gửi gói `CUSTOM_CHEST` (`sub_type = 2`), client coi nhầm đó là gói DailyQuest và chuyển tiếp nội dung của `CUSTOM_CHEST` sang hàm `decodeDailyQuestPacket`.

2. **Dữ liệu giả lập mặc định trong nhánh `subAction === 2` (`farmData.ts:2081-2082`)**:
   - Byte tiếp theo trong payload của gói `CUSTOM_CHEST` ngẫu nhiên có giá trị là `2`.
   - Khi `decodeDailyQuestPacket` đọc byte đầu tiên là `subAction = 2` (vốn là mã `DAILYQUEST_DONE`), hàm này có đoạn code gán mặc định nếu chưa có `current`:
     ```typescript
     const score = current?.score && current.score > 0 ? current.score : 100;
     const boxDone = current?.boxDone ?? 0x1f; // 0x1f = 31 = nhị phân 11111 (5 rương đã mở)
     ```
   - Hậu quả: Ngay sau khi đăng nhập / vào map, gói `CUSTOM_CHEST` bị ép giải mã thành DailyQuest và ghi đè `dailyQuestState` của tài khoản thành:
     - `score`: `100` / 100 ⭐
     - `boxDone`: `0x1F` (toàn bộ 5 rương đều là "Đã nhận")
     - `missions`: `[]` (0 nhiệm vụ)
     - `rewards`: `[{ type: 2, name: 'Lượng khoá', amount: 1 }]` (đọc từ payload rương đồ)

3. **Thông điệp banner trong UI (`QuestsPanel.tsx:212`)**:
   - Khi `daily.missions.length === 0`, UI cố định hiển thị thông báo "Tài khoản đã hoàn tất nhiệm vụ hàng ngày và tích luỹ 100/100 ⭐ điểm năng động", gây hiểu lầm kể cả trong trường hợp tài khoản chưa có dữ liệu hoặc danh sách rỗng vì lý do khác.

---

## 3. Phạm Vi (Scope)

### Trong phạm vi (In-Scope)
- **`avatar-web/server/src/game/client.ts`**:
  - Sửa `case -87:` chỉ chấp nhận `data[0] === 4` cho `decodeDailyQuestPacket`.
  - Bỏ `data[0] === 2` khỏi luồng xử lý DailyQuest; phân loại đúng `data[0] === 2` là `CUSTOM_CHEST`.
  - Khi nhận phản hồi nhận thưởng (`res.action === 2`), kích hoạt `this.farm.getDailyQuest(0)` để tự động đồng bộ lại danh sách nhiệm vụ và điểm năng động mới nhất từ server.
- **`avatar-web/server/src/game/farmData.ts`**:
  - Loại bỏ việc gán giá trị giả lập `score = 100` và `boxDone = 0x1f` khi `subAction === 2`.
  - Nếu `current` chưa có hoặc `score == null`, giữ nguyên giá trị thực tế `score: 0`, `boxDone: 0`.
  - Đảm bảo giải mã đúng từng trường theo đúng cấu trúc RVA 0xAF7664.
- **`avatar-web/web/src/accounts/panels/QuestsPanel.tsx`**:
  - Sửa banner hiển thị khi `daily.missions.length === 0` để phân biệt rõ giữa "Đã đạt 100/100 điểm hôm nay" (`daily.score >= 100`) và "Chưa có nhiệm vụ / Đang tải hoặc chưa nạp nhiệm vụ mới" (`daily.score < 100`).

### Ngoài phạm vi (Out-of-Scope)
- Không can thiệp vào các opcode khác (trồng trọt, chăn nuôi, nấu ăn).
- Không thay đổi cấu trúc bảng nhiệm vụ tân thủ và nhiệm vụ chung.

---

## 4. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 4.1. Danh Sách Files Ảnh Hưởng

| File | Module / Layer | Vai trò & Thay đổi |
|---|---|---|
| `avatar-web/server/src/game/client.ts` | GameClient Protocol Routing | Chỉ chuyển tiếp `cmd -87 (sub_type == 4)` sang `decodeDailyQuestPacket`, log và bỏ qua `sub_type == 2` |
| `avatar-web/server/src/game/farmData.ts` | Protocol Decoder | Sửa `decodeDailyQuestPacket` không tự ý gán `score = 100` / `boxDone = 0x1f` |
| `avatar-web/web/src/accounts/panels/QuestsPanel.tsx` | Web UI | Cập nhật banner rỗng phù hợp theo điểm thực tế (`daily.score`) |

### 4.2. Chi Tiết Giao Thức Mạng Cmd -87 (Daily Quest)

#### Request gửi đi (`GlobalService.dailyquest` @0x6A2008):
- Opcode: `-87` (0xA9)
- Payload: `[i8 sub_type = 2, i8 action_type]`
  - `action_type = 0`: `DAILYQUEST_SHOW` (Nạp thông tin nhiệm vụ ngày)
  - `action_type = 1`: `DAILYQUEST_CHANGE` (Đổi nhiệm vụ ngày)
  - `action_type = 2`: `DAILYQUEST_DONE` (Nhận thưởng hoàn thành chuỗi nhiệm vụ)
  - `action_type = 3`: `DAILYQUEST_GETBOX` (Mở rương điểm năng động)

#### Response trả về (`GlobalMessageHandler` @0x5ED07C):
- Opcode: `-87` (0xA9)
- `data[0]`: `sub_type` (phải là `4` mới là gói DailyQuest, nếu là `1` là ServerInfo, `2` là CustomChest, `3` là AvatarInfo).
- `data[1]`: `subAction`:
  - `0`: `SHOW` (Chứa `curScore`, `boxDone`, danh sách `missions`, `rewards`, `typeMoneyChange`, `moneyChange`).
  - `2`: `DONE` (Chứa danh sách quà vừa nhận).
  - `3`: `GETBOX` (Chứa `boxDone` mới).

---

## 5. Kế Hoạch Kiểm Tra & Xác Minh (Verification Plan)

### 5.1. Kiểm Tra Phân Giải Gói Tin (Protocol Parsing Verification)
- Khởi động session game của tài khoản:
  - Gói `CUSTOM_CHEST` (`sub_type = 2`) không còn bị giải mã nhầm thành DailyQuest.
  - `client.dailyQuestState` không bị ô nhiễm với dữ liệu giả `100/100 ⭐` và `0x1f` rương.
- Khi gửi yêu cầu nạp nhiệm vụ ngày (`c.farm.getDailyQuest(0)`):
  - Server phản hồi `cmd -87 (sub_type = 4)`.
  - Giải mã chính xác điểm năng động thực tế (ví dụ: `0/100 ⭐`), trạng thái 5 rương quà chưa nhận, và các nhiệm vụ thực tế cần làm.

### 5.2. Kiểm Tra Giao Diện Người Dùng (UI Verification)
- Mở tab **Nhiệm vụ** $\rightarrow$ **Hàng ngày** trên Web:
  - Điểm năng động hiển thị đúng giá trị thực tế của tài khoản (ví dụ `0 / 100 ⭐` hoặc điểm hiện có).
  - Các mốc rương (20, 40, 60, 80, 100) hiển thị đúng trạng thái (Chưa đạt / Có thể mở / Đã nhận).
  - Danh sách nhiệm vụ liệt kê chính xác các món cần nộp cùng tiến độ từ kho.
  - Nút **Làm mới** gọi API `/api/accounts/:id/quests/daily/refresh` và cập nhật dữ liệu mượt mà.
