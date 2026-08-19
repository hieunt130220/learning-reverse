# Hiển thị nhiệm vụ NPC Lái buôn từ game

## Mục tiêu & Bối cảnh

Mục “Tân thủ” hiện hiển thị danh sách dựng cứng trong server. Asset gốc `HD_Newbie` xác nhận nhiệm vụ tại NPC Lái buôn là “nhiệm vụ hàng ngày”, và APK xử lý bằng `DailyQuestScr` qua `Cmd -87/sub 4`. Mục tiêu là bỏ các danh sách giả và chỉ hiển thị toàn bộ nhiệm vụ Lái buôn mà game trả về.

## Phạm vi

### In-scope

- Dùng decoder `Cmd -87/sub 4` đã được xác minh cho nhiệm vụ NPC Lái buôn.
- Ngừng tạo danh sách `beginner` và `general` giả trong session.
- Hiển thị toàn bộ `daily.missions` theo đúng thứ tự và số lượng server trả về.
- Hiển thị tất cả nhiệm vụ mà packet cung cấp, gồm nhiệm vụ đang làm và đã hoàn thành.

### Out-of-scope

- Tự động nhận thưởng hoặc tự động thực hiện nhiệm vụ.
- Thay đổi logic nhiệm vụ hàng ngày và nhiệm vụ chung.
- Đoán/bổ sung nhiệm vụ không có trong packet thật.

## Thiết kế kỹ thuật

1. **Bằng chứng protocol**
   - `HD_Newbie`: “Làm nhiệm vụ hàng ngày tại Lái buôn trong Nông trại”.
   - `GlobalService.dailyquest` gửi `Cmd -87/sub 4`; `DailyQuestScr.dailyQuestMessage` đọc danh sách.
   - Packet account 2 trả 4 nhiệm vụ, không có packet “tân thủ” riêng.

2. **Decoder**
   - Giữ `decodeDailyQuestPacket`; không tạo decoder cho một packet không tồn tại.
   - Không giới hạn số nhiệm vụ ở UI.

3. **Session & UI**
   - `avatarSession.ts` giữ hợp đồng API nhưng trả `beginner/general` rỗng.
   - `QuestsPanel.tsx` chỉ hiển thị danh sách nhiệm vụ Lái buôn từ `daily`.
   - Khi chưa có packet, UI báo chưa nhận được dữ liệu.

## Hợp đồng dữ liệu

```ts
interface BeginnerQuestState {
  quests: BeginnerQuest[];
  source: 'game-packet' | 'unavailable';
  updatedAt: number;
}
```

`QuestOverviewState.beginner` sẽ lấy từ `BeginnerQuestState.quests`; `source` dùng để UI phân biệt dữ liệu thật và trạng thái chưa tải được.

## Edge cases

- Packet có số nhiệm vụ bằng 0.
- Nhiệm vụ thiếu text hoặc phần thưởng.
- ID trùng hoặc thứ tự không liên tục.
- Nhiều packet cập nhật một phần.
- Account cũ không được server hỗ trợ payload tân thủ.

## Verification Plan

- Lưu một raw packet từ account thật và kiểm tra decoder đọc đúng toàn bộ số lượng, ID và tiến độ.
- Chạy typecheck/build server và web.
- Mở `/accounts/2`, xác nhận tab Tân thủ hiển thị toàn bộ số nhiệm vụ packet trả về, không còn cố định `3/5` hoặc danh sách 5 mục.
- Kiểm tra packet nhiệm vụ ngày vẫn đi qua decoder cũ, không bị nhận nhầm.
- Chạy `git diff --check` và `gitnexus_detect_changes` trước khi kết thúc.
