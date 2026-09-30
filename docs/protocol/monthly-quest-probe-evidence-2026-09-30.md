# Bằng Chứng Thực Nghiệm & Giao Thức Nhiệm Vụ Tháng (AvatarHD 3.4.4)

> **Ngày thực hiện:** 2026-09-30  
> **Server:** 27.0.14.120:19129  
> **Công cụ probe:** `avatar-web/server/src/tools/monthly-quest-probe.ts`  
> **Trạng thái:** Verified 100% trên cả 2 tài khoản live.

---

## 1. Giao Thức (Protocol Specs)

- **NPC Giao Nhiệm Vụ:** NPC Lái buôn / Luffy trong Nông trại (`communicate(90)` $\to$ opcode `TX -59 [i32 90]`).
- **Menu ID của Nhiệm Vụ Tháng:** `userID = 20`.
- **Lấy Danh Sách Nhiệm Vụ Tháng:**
  - Gửi: `TX -61 [i32 20, i8 0, i8 1]` (Xem danh sách nhiệm vụ).
  - Nhận: `RX -81` (`QUEST_LIST`), payload 2705 bytes, định dạng `lsnhiemvu`.
  - Kết quả: **20 nhiệm vụ trong tháng** (`Nhiệm Vụ Tháng 9 - 1` đến `Nhiệm Vụ Tháng 9 - 20`).
- **Lấy Tiến Trình Nhiệm Vụ Tháng Hiện Tại:**
  - Gửi: `TX -61 [i32 20, i8 0, i8 0]` (Xem nhiệm vụ hiện tại).
  - Nhận: `RX -62` (`QUEST_CURRENT`), chứa văn bản hộp thoại gồm tiêu đề, điều kiện tiến trình (current/total, trạng thái Xong) và phần thưởng.

---

## 2. Tiến Trình Nhiệm Vụ Tháng Hiện Tại (Nhiệm Vụ Tháng 9 - 1)

### Tài khoản 1 (`0975720501` - ID 136826058)
- **Tiêu đề:** `Nhiệm Vụ Tháng 9 - 1`
- **Điều kiện:**
  - Thu hoạch 500 Thanh long: `0/500` [CHƯA XONG]
  - Câu 50 con cua: `0/50` [CHƯA XONG]
  - Thắng 15 ván lật hình: `6/15` [CHƯA XONG]
  - Đánh 20 người: `0/20` [CHƯA XONG]
- **Phần thưởng:** 5.000 Xu, 100 Điểm kinh nghiệm

### Tài khoản 2 (`0979198175` - ID 1005161)
- **Tiêu đề:** `Nhiệm Vụ Tháng 9 - 1`
- **Điều kiện:**
  - Thu hoạch 500 Thanh long: `0/500` [CHƯA XONG]
  - Câu 50 con cua: `50/50` [XONG]
  - Thắng 15 ván lật hình: `1/15` [CHƯA XONG]
  - Đánh 20 người: `0/20` [CHƯA XONG]
- **Phần thưởng:** 5.000 Xu, 100 Điểm kinh nghiệm

---

## 3. Toàn Bộ Danh Sách 20 Nhiệm Vụ Tháng 9 & Phần Thưởng

| # | Tên Nhiệm Vụ | Phần Thưởng |
|---|---|---|
| 01 | **Nhiệm Vụ Tháng 9 - 1** | 5.000 Xu - 100 Điểm kinh nghiệm |
| 02 | **Nhiệm Vụ Tháng 9 - 2** | 5.000 Xu - 50 Điểm kinh nghiệm - 5 Thẻ Quay Số Miễn Phí vĩnh viễn |
| 03 | **Nhiệm Vụ Tháng 9 - 3** | 5.000 Xu - 50 Điểm kinh nghiệm - 1 Mảnh ghép Cánh thiên thần trong đêm vĩnh viễn |
| 04 | **Nhiệm Vụ Tháng 9 - 4** | 5.000 Xu - 100 Điểm kinh nghiệm - 10 Thẻ Quay Số Miễn Phí vĩnh viễn |
| 05 | **Nhiệm Vụ Tháng 9 - 5** | 5 Lượng khóa - 100 Điểm kinh nghiệm - 1 Mảnh ghép cánh tình yêu vĩnh viễn - 20 Củi vĩnh viễn |
| 06 | **Nhiệm Vụ Tháng 9 - 6** | 5.000 Xu - 50 Điểm kinh nghiệm - 1 Mảnh ghép Cánh thiên thần trong đêm vĩnh viễn |
| 07 | **Nhiệm Vụ Tháng 9 - 7** | 5.000 Xu - 50 Điểm kinh nghiệm - 10 Thẻ Quay Số Miễn Phí vĩnh viễn |
| 08 | **Nhiệm Vụ Tháng 9 - 8** | 5.000 Xu - 50 Điểm kinh nghiệm - 1 Mảnh ghép Cánh thiên thần trong đêm vĩnh viễn |
| 09 | **Nhiệm Vụ Tháng 9 - 9** | 5.000 Xu - 50 Điểm kinh nghiệm - 5 Lượng khóa |
| 10 | **Nhiệm Vụ Tháng 9 - 10** | 10.000 Xu - 100 Điểm kinh nghiệm - 15 Thẻ Quay Số Miễn Phí vĩnh viễn |
| 11 | **Nhiệm Vụ Tháng 9 - 11** | 10.000 Xu - 10 Lượng khóa - 50 Củi vĩnh viễn |
| 12 | **Nhiệm Vụ Tháng 9 - 12** | 10.000 Xu - 100 Điểm kinh nghiệm - 50 Cuốc vĩnh viễn |
| 13 | **Nhiệm Vụ Tháng 9 - 13** | 10.000 Xu - 100 Điểm kinh nghiệm - 30 Thẻ Quay Số Miễn Phí vĩnh viễn |
| 14 | **Nhiệm Vụ Tháng 9 - 14** | 10.000 Xu - 50 Điểm kinh nghiệm - 1 Mảnh ghép cánh chim quyên nhiệt đới vĩnh viễn |
| 15 | **Nhiệm Vụ Tháng 9 - 15** | 15.000 Xu - 50 Điểm kinh nghiệm - 1 Mảnh ghép Cánh thiên thần trong đêm vĩnh viễn |
| 16 | **Nhiệm Vụ Tháng 9 - 16** | 15.000 Xu - 10 Lượng khóa - 1 Nón Jet Jet vĩnh viễn |
| 17 | **Nhiệm Vụ Tháng 9 - 17** | 10.000 Xu - 100 Điểm kinh nghiệm - 30 Thẻ Quay Số Miễn Phí vĩnh viễn |
| 18 | **Nhiệm Vụ Tháng 9 - 18** | 15.000 Xu - 100 Điểm kinh nghiệm - 1 Mảnh ghép cánh chim quyên nhiệt đới vĩnh viễn |
| 19 | **Nhiệm Vụ Tháng 9 - 19** | 15.000 Xu - 100 Điểm kinh nghiệm - 30 Lượng khóa - 1 Đá thủy vĩnh viễn |
| 20 | **Nhiệm Vụ Tháng 9 - 20** | 15.000 Xu - 100 Điểm kinh nghiệm - 20 Lượng khóa - 1 Đá Tím vĩnh viễn |
