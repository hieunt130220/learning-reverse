# Thiết Kế — Thử Nghiệm Giao Thức Khai Thác Mỏ Đá & Mỏ Gỗ (AvatarHD 3.4.4)

> **Ngày:** 2026-09-17  
> **Chủ đề:** `probe-khai-thac-go-da`  
> **Trạng thái:** Chờ User Review (User Review Gate — Bước 1/3 theo CLAUDE.md)  
> **Tài liệu nền tảng:**
> - `docs/protocol/khu-ngoai-o-cong-map-con-evidence-2026-09-17.md`
> - `docs/superpowers/specs/2026-09-17-quet-object-dao-go-da-design.md`
> - `docs/superpowers/specs/2026-09-16-dao-go-da-khu-ngoai-o-design.md`

---

## 1. Mục Tiêu & Bối Cảnh

### 1.1 Bối Cảnh & Kết Quả Trước Đó
1. Chúng ta đã xác định và join thành công vào 2 map khai thác tài nguyên:
   - **Khu Khai Thác Đá (`roomID = 26`, `Map260.png`):** Có 4 thực thể mỏ đá `ItemMapSpecial`:
     - Object 0: `id = 2000000028`, vị trí `(260, 32)`, menu `[1207, 1220]`.
     - Object 1: `id = 2000000029`, vị trí `(198, 117)`, menu `[1207, 1220]`.
     - Object 2: `id = 2000000030`, vị trí `(403, 73)`, menu `[1207, 1220]`.
     - Object 3: `id = 2000000031`, vị trí `(487, 130)`, menu `[1207, 1220]`.
   - **Khu Khai Thác Gỗ (`roomID = 22`, `Map220.png`):** Rừng cây rậm rạp, tilemap `DataMap22` chứa các mã tile cây gỗ `172..180`.
2. Người dùng yêu cầu: **Probe khai thác gỗ và đá** để xác định chuỗi gói tin tương tác thực tế giữa client và server khi nhân vật đào đá hoặc chặt gỗ.

### 1.2 Mục Tiêu Cụ Thể
- **G1 (Probe Đào Đá tại Room 26):**
  - Gửi lệnh chạm đối tượng **`TX -59 [i32 2000000028]`** để yêu cầu server mở menu.
  - Ghi nhận gói tin menu trả về (`RX -62` hoặc `RX -101`).
  - Gửi lệnh chọn menu đào **`TX -61 [i32 2000000028, i8 1207, i8 -1]`**.
  - Ghi nhận phản hồi thực tế từ server: Hộp thoại `RX -40` (thông báo nhận đá, yêu cầu cuốc chim, năng lượng...), cập nhật trạng thái `RX 48`, hoặc thay đổi kho đồ `RX 70`.
- **G2 (Điều Tra Khu Rừng Khai Thác Gỗ tại Room 22):**
  - Quét danh sách các phòng/khu (`area 0..19`) của Room 22 để kiểm tra xem cây gỗ xuất hiện dưới dạng `ItemMapSpecial` ở các khu khác hay hoàn toàn là Tilemap tương tác.
- **G3 (An Toàn Tuyệt Đối):**
  - Giới hạn nghiêm ngặt: Tối đa 1 lần gửi `TX -59` và 1 lần `TX -61` trong toàn bộ phiên probe.
  - Cooldown ≥ 2000ms. Dừng ngay lập tức khi gặp lỗi, rate-limit, hoặc ngắt kết nối.

---

## 2. Phạm Vi (Scope)

### 2.1 In-Scope
1. **Mở rộng `mining-probe.ts`:**
   - Cập nhật danh mục `NATIVE_PARK_JOIN_POSITIONS` trong `parkService.ts` bổ sung `26: { x: 100, y: 100 }` và `22: { x: 100, y: 100 }`.
   - Sử dụng cờ `--map 26 --area 0 --open-menu 2000000028 --select-menu 1207 --observe-inventory` để kiểm tra toàn bộ luồng tương tác đào đá.
   - Sử dụng cờ `--map 22 --area 0 --area-scan 10` để quét các khu của rừng gỗ.
2. **Ghi nhận Evidence:**
   - Cập nhật chi tiết kết quả thử nghiệm vào `docs/protocol/khu-ngoai-o-dao-go-da-evidence-2026-09-17.md` hoặc tài liệu evidence liên quan.

### 2.2 Out-of-Scope
- Không chạy auto loop liên tục (chỉ chạy 1 lần đơn lẻ có kiểm soát).
- Không tự động mua cuốc hoặc vật phẩm từ Shop.
- Không viết test files (tuân thủ nguyên tắc KHÔNG TDD).
- Không commit git trong phiên.

---

## 3. Thiết Kế Kỹ Thuật

### 3.1 Chuỗi Gói Tin Khai Thác Mỏ Đá (Room 26)

| Bước | Chiều | Opcode | Chi tiết Payload | Mục đích |
| :---: | :---: | :---: | :--- | :--- |
| 1 | **TX** | **`-1`** | `[i8 9]` | Vào ngữ cảnh Park (Handler 9) |
| 2 | **TX** | **`80`** | `[i8 26][i8 0][i16 100][i16 100]` | Tham gia Room 26 khu 0 |
| 3 | **RX** | **`80`** | `[snapshot...]` | Nhận danh sách 4 mỏ đá |
| 4 | **TX** | **`-59`** | `[i32 2000000028]` | Chạm mỏ đá 1 (`doCommunicate`) |
| 5 | **RX** | **`-62`** | `[menu list...]` | Server trả về danh sách menu của mỏ đá |
| 6 | **TX** | **`-61`** | `[i32 2000000028][i8 1207][i8 -1]` | Chọn menu đào đá (`doMenuOption`) |
| 7 | **RX** | **`-40 / 48 / 70`** | `[...]` | Thông báo kết quả đào / vật phẩm nhận được |
| 8 | **TX** | **`80`** | `[i8 17][i8 0][i16 100][i16 100]` | Rời về hub Map 17 an toàn và logout |

### 3.2 Chuỗi Gói Tin Quét Khu Vực Rừng Gỗ (Room 22)

- Gửi `TX 90 [i8 22]` để lấy danh sách các khu vực (`boardCount`).
- Duyệt tuần tự qua các khu `area = 0..9` (mỗi khu cách nhau ≥ 2000ms) để chụp snapshot `RX 80`.
- Kiểm tra xem khu nào có `specialCount > 0` hoặc các đối tượng cây gỗ động.

### 3.3 Safety Guards
1. **Whitelist TX:** Chỉ cho phép `-1, 90, 80, -59, -61, 70` (+ `-94` ping).
2. **Hard-cap:** Tối đa 1 lượt tương tác menu trong 1 phiên probe.
3. **Dừng an toàn:** Tự động bắt sự kiện `dialog`, `temporary-rejection`, `closed` và ngắt kết nối sạch.

---

## 4. Verification Plan

1. **Kiểm tra biên dịch & Typecheck:**
   ```bash
   cd avatar-web/server && npm run typecheck
   ```
2. **Kiểm tra tương tác đào đá Room 26:**
   - Chạy lệnh probe tương tác mỏ đá:
     ```bash
     cd avatar-web/server && npx tsx src/tools/mining-probe.ts --account-id 3 --map 26 --area 0 --open-menu 2000000028 --select-menu 1207 --observe-inventory
     ```
   - Kết quả mong đợi: Thu thập được nội dung menu trả về và thông điệp server phản hồi khi đào đá.
3. **Kiểm tra quét các khu Room 22:**
   - Chạy lệnh quét 10 khu của Room 22:
     ```bash
     cd avatar-web/server && npx tsx src/tools/mining-probe.ts --account-id 3 --map 22 --area 0 --area-scan 10
     ```
   - Kết quả mong đợi: Xác định rõ cơ chế phân bổ cây gỗ trên các khu của Room 22.
