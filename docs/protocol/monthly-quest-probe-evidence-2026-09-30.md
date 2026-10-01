# Bằng Chứng Thực Nghiệm & Giao Thức Nhiệm Vụ Tháng (AvatarHD 3.4.4)

> **Ngày thực hiện:** 2026-09-30  
> **Server:** 27.0.14.120:19129  
> **Công cụ probe:** `avatar-web/server/src/tools/monthly-quest-probe.ts` & `src/tools/fetch-all-monthly-quests.ts`  
> **Trạng thái:** Verified 100% trên live server. Lấy thành công toàn bộ 20/20 nhiệm vụ cùng đầy đủ mục tiêu & điều kiện chi tiết.

---

## 1. Giao Thức (Protocol Specs)

### 1.1. Lấy danh sách nhiệm vụ tháng
- **NPC Giao Nhiệm Vụ:** NPC Lái buôn / Luffy trong Nông trại (`communicate(90)` $\to$ opcode `TX -59 [i32 90]`).
- **Menu ID của Nhiệm Vụ Tháng:** `userID = 20`.
- **Lấy Danh Sách Nhiệm Vụ Tháng:**
  - Gửi: `TX -61 [i32 20, i8 0, i8 1]` (Xem danh sách nhiệm vụ).
  - Nhận: `RX -81` (`QUEST_LIST`), payload 2705 bytes, định dạng `lsnhiemvu`.
  - Header: `[i16:9]"lsnhiemvu" [i16:23]"Danh Sách Nhiệm Vụ" [i32 idList=14] [i32 count=20]`
  - Danh sách 20 item: mỗi item gồm `[i16 0xffff] [i16 len]title [i16 len]reward`.

### 1.2. Lấy tiến trình nhiệm vụ đang kích hoạt (Current Quest)
- Gửi: `TX -61 [i32 20, i8 0, i8 0]` (Xem nhiệm vụ hiện tại).
- Nhận: `RX -62` (`CUSTOM_TAB`), chứa văn bản tiến trình hiện tại (ví dụ: `0/500`, `-Xong`) và phần thưởng.

### 1.3. Lấy điều kiện chi tiết của TỪNG nhiệm vụ trong danh sách (doListCustom)
- Disassembly client `ListScr.readList` @ `0x6D4384` & `ListScr.IActionReadList.perform` @ `0x841C94` $\to$ `GlobalService.doListCustom` @ `0x69d9a0`.
- Gửi: `TX -81` (`doListCustom`):
  - `writeInt(idList)`: `14` (ID danh sách Nhiệm Vụ Tháng)
  - `writeByte(page)`: `0`
  - `writeShort(selected)`: Index của nhiệm vụ (`0` đến `19`)
  - `writeByte(idmenu)`: `-1` (0xff)
- Nhận: `RX -62` (`CUSTOM_TAB`), gồm 2 chuỗi ký tự UTF-8:
  - Chuỗi 1: `"Nhiệm Vụ"` (Tiêu đề cửa sổ)
  - Chuỗi 2: Nội dung hộp thoại hiển thị tên nhiệm vụ, danh sách các dòng gạch đầu dòng (`- ...`) nêu rõ điều kiện mục tiêu cần làm và khối `Phần Thưởng:`.

---

## 2. Toàn Bộ Chi Tiết 20 Nhiệm Vụ Tháng 9 (Mục Tiêu & Phần Thưởng)

Dữ liệu JSON lưu trữ tại: `avatar-web/server/src/tools/monthly-quests-details.json`.

### Nhiệm Vụ #01: Nhiệm Vụ Tháng 9 - 1
- **Điều kiện mục tiêu:**
  - Thu hoạch 500 Thanh long
  - Câu 50 con cua
  - Thắng 15 ván lật hình
  - Đánh 20 người
- **Phần thưởng:** 5.000 Xu, 100 Điểm kinh nghiệm

### Nhiệm Vụ #02: Nhiệm Vụ Tháng 9 - 2
- **Điều kiện mục tiêu:**
  - Thu hoạch 500 trứng gà
  - Quay số 50 lần
  - Câu 30 con cua
  - Trả Lời cô giáo đúng 10 lần
- **Phần thưởng:** 5.000 Xu, 50 Điểm kinh nghiệm, 5 Thẻ Quay Số Miễn Phí vĩnh viễn

### Nhiệm Vụ #03: Nhiệm Vụ Tháng 9 - 3
- **Điều kiện mục tiêu:**
  - Thu hoạch 500 chuối
  - Thu hoạch 500 bí ngô
  - Thu hoạch 500 ớt
  - Câu 50 con cua
  - Trả Lời cô giáo đúng 30 lần
- **Phần thưởng:** 5.000 Xu, 50 Điểm kinh nghiệm, 1 Mảnh ghép Cánh thiên thần trong đêm vĩnh viễn

### Nhiệm Vụ #04: Nhiệm Vụ Tháng 9 - 4
- **Điều kiện mục tiêu:**
  - Thu hoạch 500 dưa leo
  - Thu hoạch 500 ớt
  - Câu 50 con cá nóc
  - Quay số 30 lần
- **Phần thưởng:** 5.000 Xu, 100 Điểm kinh nghiệm, 10 Thẻ Quay Số Miễn Phí vĩnh viễn

### Nhiệm Vụ #05: Nhiệm Vụ Tháng 9 - 5
- **Điều kiện mục tiêu:**
  - Mua 20 con gà
  - Mua 20 con vịt
  - Mua 2 con bò
  - Câu 50 con cua
- **Phần thưởng:** 5 Lượng khóa, 100 Điểm kinh nghiệm, 1 Mảnh ghép cánh tình yêu vĩnh viễn, 20 Củi vĩnh viễn

### Nhiệm Vụ #06: Nhiệm Vụ Tháng 9 - 6
- **Điều kiện mục tiêu:**
  - Thu hoạch 200 Hoa tulip
  - Thu hoạch 500 Cà chua
  - Câu 30 con cá nóc
  - Trả Lời cô giáo đúng 20 lần
- **Phần thưởng:** 5.000 Xu, 50 Điểm kinh nghiệm, 1 Mảnh ghép Cánh thiên thần trong đêm vĩnh viễn

### Nhiệm Vụ #07: Nhiệm Vụ Tháng 9 - 7
- **Điều kiện mục tiêu:**
  - Mua 2 con bò
  - Trả Lời cô giáo đúng 30 lần
  - Thắng 25 ván lật hình
  - Nấu 15 cơm cà rốt
- **Phần thưởng:** 5.000 Xu, 50 Điểm kinh nghiệm, 10 Thẻ Quay Số Miễn Phí vĩnh viễn

### Nhiệm Vụ #08: Nhiệm Vụ Tháng 9 - 8
- **Điều kiện mục tiêu:**
  - Thu hoạch 200 Khóm
  - Thu hoạch 200 Dưa Hấu
  - Câu 10 con cá rô
  - Quay số 10 lần
- **Phần thưởng:** 5.000 Xu, 50 Điểm kinh nghiệm, 1 Mảnh ghép Cánh thiên thần trong đêm vĩnh viễn

### Nhiệm Vụ #09: Nhiệm Vụ Tháng 9 - 9
- **Điều kiện mục tiêu:**
  - Thu hoạch 200 Cà chua
  - Thu hoạch 200 Cà rốt
  - Câu 30 con cá chép vàng
  - Mua 10 tờ vé số
- **Phần thưởng:** 5.000 Xu, 50 Điểm kinh nghiệm, 5 Lượng khóa

### Nhiệm Vụ #10: Nhiệm Vụ Tháng 9 - 10
- **Điều kiện mục tiêu:**
  - Thu hoạch 500 Lúa
  - Câu 30 con cá chép vàng
  - Thắng 10 ván game lật hình
  - Được 10 người khác hôn
- **Phần thưởng:** 10.000 Xu, 100 Điểm kinh nghiệm, 15 Thẻ Quay Số Miễn Phí vĩnh viễn

### Nhiệm Vụ #11: Nhiệm Vụ Tháng 9 - 11
- **Điều kiện mục tiêu:**
  - Thu hoạch 500 Cà rốt
  - Thu hoạch 500 Khóm
  - Câu 30 con cua
  - Nấu 5 cơm
- **Phần thưởng:** 10.000 Xu, 10 Lượng khóa, 50 Củi vĩnh viễn

### Nhiệm Vụ #12: Nhiệm Vụ Tháng 9 - 12
- **Điều kiện mục tiêu:**
  - Câu 50 con cua
  - Quay số 50 lần
  - Nấu 15 nước ép trái cây
  - Thắng 25 ván lật hình
  - Thu hoạch 1000 Dưa Hấu
- **Phần thưởng:** 10.000 Xu, 100 Điểm kinh nghiệm, 50 Cuốc vĩnh viễn

### Nhiệm Vụ #13: Nhiệm Vụ Tháng 9 - 13
- **Điều kiện mục tiêu:**
  - Câu 50 con cá lóc
  - Quay số 50 lần
  - Trả Lời cô giáo đúng 20 lần
  - Nấu 15 nước ép trái cây
- **Phần thưởng:** 10.000 Xu, 100 Điểm kinh nghiệm, 30 Thẻ Quay Số Miễn Phí vĩnh viễn

### Nhiệm Vụ #14: Nhiệm Vụ Tháng 9 - 14
- **Điều kiện mục tiêu:**
  - Quay số 30 lần
  - Mua 20 tờ vé số
  - Nấu 15 nước ép trái cây
  - Thu hoạch 1000 lông cừu
- **Phần thưởng:** 10.000 Xu, 50 Điểm kinh nghiệm, 1 Mảnh ghép cánh chim quyên nhiệt đới vĩnh viễn

### Nhiệm Vụ #15: Nhiệm Vụ Tháng 9 - 15
- **Điều kiện mục tiêu:**
  - Mua 20 tờ vé số
  - Thắng 25 ván lật hình
  - Nấu 15 tương cà chua
  - Nấu 15 tương ớt
  - Thu hoạch 500 sữa dê
- **Phần thưởng:** 15.000 Xu, 50 Điểm kinh nghiệm, 1 Mảnh ghép Cánh thiên thần trong đêm vĩnh viễn

### Nhiệm Vụ #16: Nhiệm Vụ Tháng 9 - 16
- **Điều kiện mục tiêu:**
  - Thu hoạch 500 cải thảo
  - Thu hoạch 500 sữa dê
  - Đánh 30 người
  - Quay số 20 lần
- **Phần thưởng:** 15.000 Xu, 10 Lượng khóa, 1 Nón Jet Jet vĩnh viễn

### Nhiệm Vụ #17: Nhiệm Vụ Tháng 9 - 17
- **Điều kiện mục tiêu:**
  - Thu hoạch 500 Thanh long
  - Thu hoạch 500 Hoa hướng dương
  - Thu hoạch 500 Hoa tulip
  - Câu 30 con cua
- **Phần thưởng:** 10.000 Xu, 100 Điểm kinh nghiệm, 30 Thẻ Quay Số Miễn Phí vĩnh viễn

### Nhiệm Vụ #18: Nhiệm Vụ Tháng 9 - 18
- **Điều kiện mục tiêu:**
  - Thu hoạch 1000 Hoa tulip
  - Thu hoạch 1000 sữa bò
  - Thu hoạch 1000 Cà chua
  - Nấu 15 cơm cà rốt
  - Trả Lời cô giáo đúng 30 lần
- **Phần thưởng:** 15.000 Xu, 100 Điểm kinh nghiệm, 1 Mảnh ghép cánh chim quyên nhiệt đới vĩnh viễn

### Nhiệm Vụ #19: Nhiệm Vụ Tháng 9 - 19
- **Điều kiện mục tiêu:**
  - Câu 30 con cua
  - Được 30 người khác hôn
  - Nấu 2 cơm
  - Nấu 2 cơm trứng
  - Quay số 50 lần
- **Phần thưởng:** 15.000 Xu, 100 Điểm kinh nghiệm, 30 Lượng khóa, 1 Đá thủy vĩnh viễn

### Nhiệm Vụ #20: Nhiệm Vụ Tháng 9 - 20
- **Điều kiện mục tiêu:**
  - Thắng 25 ván lật hình
  - Trả Lời cô giáo đúng 30 lần
  - Nấu 15 tương cà chua
  - Nấu 15 tương ớt
- **Phần thưởng:** 15.000 Xu, 100 Điểm kinh nghiệm, 20 Lượng khóa, 1 Đá Tím vĩnh viễn

---

## 3. Phân Loại Hoạt Động & Cơ Hội Tự Động Hóa

1. **Trồng trọt & Thu hoạch nông sản:** Thanh long, Cà chua, Cà rốt, Bí ngô, Chuối, Ớt, Dưa leo, Khóm, Dưa hấu, Hoa tulip, Lúa, Cải thảo, Hoa hướng dương.
2. **Chăn nuôi:** Thu hoạch trứng gà, sữa bò, sữa dê, lông cừu; Mua gà, mua vịt, mua bò.
3. **Câu cá (Hồ cá / Bến tàu):** Câu cua, cá nóc, cá rô, cá chép vàng, cá lóc.
4. **Nấu ăn (Bếp nông trại):** Cơm trắng, cơm cà rốt, cơm trứng, nước ép trái cây, tương cà chua, tương ớt.
5. **Minigame Lâu đài (Map 7):** Thắng ván game Lật hình (Minigame ID 1 qua opcode TX -90).
6. **Khu giải trí & Công viên:** Quay số trúng thưởng, Mua vé số, Trả lời cô giáo (Khu trường học / Anh văn).
7. **Tương tác xã hội:** Đánh người, Được người khác hôn.
