# Thiết Kế — Công Cụ Probe Lấy Danh Sách Nhiệm Vụ Tháng (Monthly Quest Probe)

> **Ngày lập:** 2026-09-30  
> **Topic:** `monthly-quest-probe`  
> **Trạng thái:** Chờ User Review (Bước 1/3 theo quy trình CLAUDE.md)  
> **Tài liệu tham chiếu:**
> - `avatar-re/notes/quest-discovery.md`
> - `docs/superpowers/specs/2026-08-21-tanthu-quest-real-data-design.md`
> - `docs/superpowers/plans/2026-08-21-quest-real-mechanism.md`

---

## 1. Mục Tiêu & Bối Cảnh

### 1.1 Bối Cảnh
Trong Avatar (server private 27.0.14.120:19129), hệ thống nhiệm vụ tiến trình của NPC Lái buôn (NPC 90/91) tại Nông trại hoạt động qua cơ chế menu `doMenuOption(userID, menuIndex, subIndex)` (opcode `TX -61`).
Các điều tra trước đây (`quest-discovery.md`) đã lập bản đồ các chuỗi nhiệm vụ:
- `userID = 19`: Nhiệm Vụ Tân Thủ (`cmd -62`).
- `userID = 35`: Nhiệm Vụ Nhà Nông (`cmd -62` tiến trình hiện tại, `cmd -81` danh sách 108 nhiệm vụ).
- `userID = 38`: Nhiệm Vụ Thợ Câu (`cmd -62`).
- `userID = 20`: **Nhiệm Vụ Tháng 7** (được phát hiện vào tháng 8/2026, chưa có công cụ probe chuyên dụng).
- `userID = 46`: Nhiệm Vụ Tiền Sử.

### 1.2 Mục Tiêu
Xây dựng công cụ probe CLI `monthly-quest-probe.ts` nhằm:
1. Đăng nhập tài khoản vào live server và tiến vào Nông trại.
2. Giao tiếp với NPC Lái buôn (`TX -59 [i32 90]`) và gửi yêu cầu lấy danh sách nhiệm vụ tháng (`TX -61 [i32 uid, i8 0, i8 1]`) cũng như nhiệm vụ tháng hiện tại (`TX -61 [i32 uid, i8 0, i8 0]`).
3. Khám phá và xác định chính xác `userID` của nhiệm vụ tháng hiện tại (kiểm tra ưu tiên `uid = 20`, đồng thời hỗ trợ quét linh hoạt dải `uid` nếu server thay đổi theo tháng mới).
4. Bắt và giải mã trọn vẹn:
   - `RX -81` (Danh Sách Nhiệm Vụ): Trích xuất danh mục toàn bộ nhiệm vụ tháng (tên nhiệm vụ, phần thưởng).
   - `RX -62` (Nhiệm Vụ Hiện Tại): Trích xuất thông tin nhiệm vụ tháng đang làm, các điều kiện tiến trình (current/total, trạng thái Xong/chưa xong) và phần thưởng.
   - `RX -40`, `RX -88`, `RX -101`: Bắt mọi thông báo phụ từ server.
5. In kết quả trực quan ra console dạng bảng tổng hợp danh sách nhiệm vụ tháng.

---

## 2. Phạm Vi (Scope)

### 2.1 In-Scope
- **File probe mới:** `avatar-web/server/src/tools/monthly-quest-probe.ts`.
- **Luồng hoạt động:**
  1. `CLI Arguments`:
     - `--account-id <number>`: ID tài khoản trong SQLite DB (mặc định: `1`).
     - `--uid <number>`: Target `userID` cần probe (mặc định: `20`).
     - `--sweep`: Chế độ quét thăm dò dải `userID` nếu cần tìm chuỗi mới.
     - `--min <number>` / `--max <number>`: Giới hạn dải quét khi dùng `--sweep` (mặc định: `15..50`).
     - `--delay <number>`: Khoảng nghỉ an toàn giữa các lệnh gửi (mặc định: `400ms`).
  2. `Đăng nhập & Vào Nông Trại`:
     - Kết nối live server qua `GameClient`, đăng nhập bằng thông tin giải mã từ SQLite `avatar_accounts`.
     - Chờ vào farm (`enterFarm()`).
  3. `Tương tác NPC & Thu thập gói tin`:
     - Bắt buộc gọi `communicate(90)` trước mỗi lần `doMenuOption` (quy tắc server Avatar farm handler).
     - Gửi `doMenuOption(uid, 0, 1)` để lấy Danh sách nhiệm vụ (`RX -81`).
     - Gửi `doMenuOption(uid, 0, 0)` để lấy Nhiệm vụ hiện tại (`RX -62`).
  4. `Bộ giải mã (Decoder)`:
     - `cmd -81`: Sử dụng `parseQuestListPacket(buf)`. Nếu trả về 0 phần tử (do khác header), fallback tự động sang bộ quét chuỗi UTF-8 / i16-len raw để không bỏ sót dữ liệu.
     - `cmd -62`: Sử dụng `decodeQuestDialogStrings` kết hợp `parseQuestDialogText`.
  5. `Tổng hợp & In báo cáo`:
     - In danh sách toàn bộ nhiệm vụ tháng kèm phần thưởng.
     - In tiến trình nhiệm vụ tháng hiện tại của tài khoản.

### 2.2 Out-of-Scope
- Chưa tích hợp tab UI vào web frontend trong lượt probe này (sẽ làm ở task sau khi đã có dữ liệu và cấu trúc verified).
- Không tự động nhận hoặc trả nhiệm vụ tháng.
- Không viết unit test file (tuân thủ nguyên tắc **KHÔNG TDD** của dự án).

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 3.1 Danh Sách Module & File Liên Quan

| File | Vai trò |
|---|---|
| `avatar-web/server/src/tools/monthly-quest-probe.ts` | File probe CLI chính cần tạo mới. |
| `avatar-web/server/src/game/client.ts` | Hạ tầng kết nối live server `GameClient`. |
| `avatar-web/server/src/game/farmService.ts` | Cung cấp `communicate(90)` và `doMenuOption(uid, 0, sub)`. |
| `avatar-web/server/src/game/progressQuests.ts` | Cung cấp hàm giải mã `parseQuestListPacket`, `decodeQuestDialogStrings`, `parseQuestDialogText`. |
| `avatar-web/server/src/accounts/repo.ts` | Đọc thông tin tài khoản và giải mã game pass qua `readGamePass`. |

### 3.2 Giao Thức & Cấu Trúc Packet

#### 1. Lệnh gửi đi (Client $\to$ Server)
- Mở NPC Lái buôn:
  ```
  TX -59 [i32 90]
  ```
- Chọn menu Nhiệm Vụ (Danh Sách Nhiệm Vụ):
  ```
  TX -61 [i32 uid, i8 0, i8 1]
  ```
- Chọn menu Nhiệm Vụ (Nhiệm Vụ Hiện Tại):
  ```
  TX -61 [i32 uid, i8 0, i8 0]
  ```

#### 2. Phản hồi từ Server (Server $\to$ Client)
- **`RX -81` (QUEST_LIST):**
  - Cấu trúc chuẩn:
    `[i16 len]"lsnhiemvu" [i16 len]"Danh Sách Nhiệm Vụ" [i32=15] [i32 count] ff ff`
    sau đó lặp `count` lần: `[i16 len]title + [i16 len]reward + ff ff`.
- **`RX -62` (QUEST_CURRENT / DIALOG):**
  - Cấu trúc: `byte0 = 0x00`, tiếp theo là chuỗi lặp `[i16 len][utf8]`.
  - Chứa chuỗi `"nhiệm vụ hiện tại của bạn là nhiệm vụ:<Tên Nhiệm Vụ>:\n- Điều kiện 1\n...\nPhần Thưởng:\n..."`.
- **`RX -40` / `RX -88`:**
  - Hộp thoại văn bản thông báo kết quả hoặc lý do không mở được nhiệm vụ.

---

## 4. Kế Hoạch Kiểm Tra & Verification Plan

### 4.1 Lệnh Thực Thi
1. **Kiểm tra target `uid = 20` (Nhiệm vụ tháng đã biết):**
   ```bash
   cd avatar-web/server && npx tsx --env-file=.env src/tools/monthly-quest-probe.ts --account-id 1
   ```
2. **Kiểm tra quét dải `uid` (nếu `uid = 20` không có hoặc server đổi uid):**
   ```bash
   cd avatar-web/server && npx tsx --env-file=.env src/tools/monthly-quest-probe.ts --account-id 1 --sweep --min 15 --max 50
   ```

### 4.2 Tiêu Chí Đánh Giá Thành Công (Success Criteria)
1. Kết nối và đăng nhập thành công vào nông trại của tài khoản.
2. Bắt được phản hồi `cmd -81` hoặc `cmd -62` từ server đối với nhiệm vụ tháng.
3. Giải mã và in ra danh sách nhiệm vụ tháng (Tên nhiệm vụ, điều kiện/mục tiêu, phần thưởng).
4. Đăng xuất an toàn, không để lại tiến trình treo hay ảnh hưởng đến phiên web.
