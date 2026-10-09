# Bằng Chứng Thực Nghiệm Protocol Cô Giáo Tiếng Anh / Tiếng Việt (Map 6)

**Ngày thực nghiệm:** 2026-10-09  
**Mục tiêu:** Reverse engineering và live-probe cơ chế hỏi - trả lời của Cô Giáo Tiếng Anh & Tiếng Việt tại Trường học (Map 6) trong AvatarHD.

---

## 1. Bản Đồ & Định Danh NPC

- **Map ID:** `6` (`LoadMap.T_PARK_6 = 6`, Trường học).
- **Tọa độ Native Spawn:** `(x: 264, y: 157)`.
- **Phân chia phòng học theo Board ID (Khu):**
  - **Board chẵn (`board % 2 == 0`):** Lớp Tiếng Anh.
    - **NPC:** `Cô Giáo Tiếng Anh`
    - **ID NPC:** `2000000336`
  - **Board lẻ (`board % 2 == 1`):** Lớp Tiếng Việt.
    - **NPC:** `Cô Giáo Tiếng Việt`
    - **ID NPC:** `2000000337`

---

## 2. Wire Protocol & Giao Thức Mạng

Cơ chế trả lời cô giáo hoàn toàn không sử dụng opcode tương tác riêng biệt hay menu thoại NPC mà diễn ra 100% qua kênh chat phòng công cộng (`PARK_CHAT` - Opcode `85`).

### 2.1. Nhận Câu Hỏi, Đếm Ngược & Đáp Án (Downlink)
- **Opcode:** `RX 85` (`CMD_PARK_CHAT`)
- **Cấu trúc gói:**
  - `i32 idUser`: `2000000336` (Cô Tiếng Anh) hoặc `2000000337` (Cô Tiếng Việt).
  - `utf text`: Nội dung tin nhắn chat của cô giáo.
  - `i8 style`: Kiểu hiển thị (thường là `0`).

### 2.2. Gửi Câu Trả Lời (Uplink)
- **Opcode:** `TX 85` (`CMD_PARK_CHAT`)
- **Cấu trúc gói:**
  - `utf text`: Nội dung đáp án (chữ thường hoặc chữ hoa, không phân biệt).
  - `i8 style`: `0`.

---

## 3. Định Dạng Câu Hỏi & Chu Kỳ Hoạt Động

### 3.1. Chu Kỳ (Timing Cadence)
- Chu kỳ mỗi vòng: **30 giây / câu hỏi**.
- Tiến trình 1 vòng:
  1. `T + 0s`: Cô giáo phát sóng câu hỏi mới qua `RX 85`.
  2. `T + 15s`: Cô giáo bắt đầu đếm ngược: `10`, `9`, ..., `1`.
  3. `T + 25s`: Cô giáo công bố người chiến thắng: `Chúc mừng bạn [Tên] đã trả lời đúng trong thời gian ngắn nhất!`.
  4. `T + 27s`: Cô giáo công bố đáp án: `Đáp án của câu hỏi [X] là [Y]`.
  5. `T + 30s`: Chuyển sang câu hỏi kế tiếp.

### 3.2. Lớp Tiếng Anh (`Cô Giáo Tiếng Anh` - ID `2000000336`)
- **Cấu trúc câu hỏi:** `<Từ tiếng Việt>  - Tiếng anh là gì ?` (phân tách bởi chuỗi `" - "`).
- **Xử lý:** Lấy vế trước `" - "`, trim khoảng trắng và chuyển chữ thường.
- **Nguồn từ điển:** Khớp 100% với Google Translate (Anh - Việt) từ vựng cơ bản / trung cấp.
- **Ví dụ đã verify live:**
  - `"thợ máy"` -> `"mechanic"`
  - `"mì ống"` -> `"pasta"`
  - `"sóc chuột"` -> `"chipmunk"`
  - `"san hô"` -> `"coral"`
  - `"hướng đông"` -> `"east"`

### 3.3. Lớp Tiếng Việt (`Cô Giáo Tiếng Việt` - ID `2000000337`)
- **Cấu trúc câu hỏi:** Câu điền từ khuyết vào thành ngữ, ca dao, tục ngữ chứa dấu `"..."`.
- **Ví dụ:** `"Đi một ngày đàng học một ... khôn"`, `"Đói cho sạch rách cho ..."`
- **Xử lý:** Khớp chuỗi tiền tố/hậu tố qua bộ cơ sở dữ liệu ca dao tục ngữ hoặc nạp động từ đáp án cô giáo công bố.

---

## 4. Cơ Chế Tự Động Học (Passive Auto-Learning)

- Khi cô giáo phát sóng tin nhắn dạng:
  ```
  Đáp án của câu hỏi <X> là <Y>
  ```
- Regex bóc tách:
  ```ts
  const matchAns = text.match(/Đáp án của câu hỏi\s+(.+?)\s+là\s+([a-zA-Z\s]+)/i);
  ```
- Bot lưu trữ cặp `<X>` -> `<Y>` vào tệp từ điển cục bộ (`data/teacher-dict-en.json`).
- Nhờ cơ chế này, bot tự tích lũy kho từ vựng đầy đủ sau vài giờ cắm máy mà không phụ thuộc API bên ngoài.
