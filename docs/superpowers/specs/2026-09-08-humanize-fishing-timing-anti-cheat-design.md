# Thiết Kế Mô Phỏng Nhịp Độ Người (Humanized Timing) Chống Anti-Cheat Trong Tự Động Câu Cá

> **Ngày lập:** 2026-09-08  
> **Trạng thái:** Chờ User Review  
> **Tài liệu liên quan:**
> - `docs/superpowers/specs/2026-09-08-auto-fishing-web-integration-design.md`
> - `avatar-re/notes/fishing.md`
> - `avatar-web/server/src/session/avatarSession.ts`

---

## 1. Mục Tiêu & Bối Cảnh (Goals & Background)

### 1.1. Bối cảnh & Kết quả điều tra thực nghiệm (Root Cause)
- **Triệu chứng:** Tài khoản tự động câu cá bị ngắt kết nối (`remote-end`, server chủ động gửi cờ TCP FIN) đều đặn sau 1–3 phút, trung bình 2.3 phút rớt 1 lần (16 lần ngắt trong 37 phút câu).
- **Thực nghiệm loại trừ:**
  1. *Lỗi mạng / Socket baseline:* Khi tắt chế độ câu (`desiredMode: off`), tài khoản online liên tục **5+ phút không rớt một lần nào** (0 disconnect, 0 retry).
  2. *Lỗi handshake giao thức:* Trình tự gói `TX 45 (sit) → TX 41 (cast) → RX 79 (challenge) → TX 43 (answer) → RX 43 (result) → TX 44 (done) → RX 44` đã được đối chiếu với Frida log của client thật và là **100% chuẩn native**.
  3. *Lỗi gói thưởng không ACK:* Cả ca sống sót lẫn ca bị ngắt kết nối đều nhận gói kết thúc `RX 82 (len 0)` và `RX -87 sub 9`. Dịch ngược `ParkMsgHandler.onMessage` tại RVA `0x718f34` xác nhận client gốc của game cũng không xử lý opcode 82 (rơi thẳng vào lệnh `ret`).
- **Nguyên nhân cốt lõi (Root Cause):**
  Server AvatarHD tích hợp hệ thống **Anti-Cheat / Bot Detection** giám sát nhịp độ câu cá:
  - **Thời gian phản xạ phi nhân tính (Inhuman Reaction Time):** Bot ML giải và gửi `TX 43` chỉ sau **10ms – 130ms** (trung bình **30ms**), độ chính xác 100%. Trong khi game thiết kế `timeDelay` từ **20s đến 27s** để người chơi nhìn màn hình và thao tác bấm 6–10 phím.
  - **Nhịp độ máy móc, lặp lại cố định:** Vừa có kết quả `RX 43` là gửi `TX 44` sau đúng 1.5s cứng, rồi quăng cần ngay sau `castDelayMs` cố định không có độ biến thiên (jitter).
  - Anti-cheat phía server tích lũy điểm nghi ngờ (suspicion score) qua vài lượt câu siêu tốc và phát lệnh kick TCP FIN.

### 1.2. Mục tiêu giải pháp
1. Thêm khoảng trễ suy nghĩ & thao tác bấm phím mô phỏng người thật (**Humanized Solving Delay**) trước khi gửi `TX 43`, tỉ lệ thuận với số phím cần bấm.
2. Thêm độ lệch ngẫu nhiên (**Random Jitter**) cho các khoảng trễ:
   - Trễ xem cá & animation kéo cần (`RX 43` → `TX 44`): random `1.8s – 3.2s`.
   - Trễ nghỉ giữa các lượt quăng cần (`TX 44` → `TX 41` lượt mới): `castDelayMs + random(500, 2000)ms`.
3. Bổ sung nhịp nghỉ ngắn ngẫu nhiên (**Micro-break**): Sau mỗi 8–15 lượt câu, nghỉ 6s–12s mô phỏng người chơi nghỉ tay, uống nước, xem hòm đồ.
4. Đảm bảo toàn bộ các khoảng trễ đều có thể bị hủy lập tức (**Cancellable via AbortSignal**) khi người dùng bấm dừng câu hoặc phiên bị đóng.

---

## 2. Phạm Vi (Scope)

### 2.1. In-Scope (Trong phạm vi)
- **Backend (`avatar-web/server/src/session/avatarSession.ts`)**:
  - Tích hợp hàm sinh số ngẫu nhiên có cận (`randomBetween(min, max)`).
  - Tích hợp tính toán thời gian giải mô phỏng người chơi:
    - Trễ nhận biết (Perception delay): `600ms – 1000ms`.
    - Trễ bấm từng phím (Per-key typing delay): `320ms – 520ms` / phím.
    - Tổng thời gian giải cho chuỗi 6–9 phím: dao động tự nhiên từ **2.5s đến 5.5s** (vẫn hoàn toàn an toàn trong giới hạn 20s–27s của server).
  - Tích hợp random jitter cho thời gian chuyển tiếp `RX 43` → `TX 44` (`1800ms – 3200ms`).
  - Tích hợp random jitter cho thời gian nghỉ giữa các lần quăng cần `castDelayMs + random(600ms, 1800ms)`.
  - Tích hợp cơ chế nghỉ tay micro-break: sau mỗi 10 lượt câu (± 3 lượt jitter), nghỉ ngẫu nhiên `7s – 12s`.
  - Cập nhật log chi tiết trên giao diện Web: thông báo cho người dùng biết bot đang "bấm phím mô phỏng", "đang xem cá", hoặc "đang nghỉ tay".

### 2.2. Out-of-Scope (Ngoài phạm vi)
- Không thay đổi model ML hoặc logic inference của Phase 2 / Phase 3.
- Không thay đổi cấu trúc gói tin `TX 43` (vẫn gửi đúng identity mapping đã xác minh).
- Không can thiệp vào các chế độ tự động khác (`auto_farm`, `find_npc`).

---

## 3. Thiết Kế Chi Tiết & Thuật Toán (Detailed Design)

### 3.1. Các hằng số thời gian mô phỏng người (Humanized Timing Constants)

```typescript
export const FISHING_HUMAN_TIMING = {
  // Trễ nhận diện hình ảnh ban đầu (mắt nhìn thấy phao chìm & bảng hiện lên)
  PERCEPTION_MIN_MS: 700,
  PERCEPTION_MAX_MS: 1200,

  // Trễ bấm từng phím mũi tên trên bàn phím ảo
  PER_KEY_MIN_MS: 300,
  PER_KEY_MAX_MS: 520,

  // Trễ ngắm cá / hoạt ảnh giật cá lên mặt nước trước khi thu cần (TX 44)
  POST_CATCH_MIN_MS: 1800,
  POST_CATCH_MAX_MS: 3200,

  // Jitter cộng thêm vào castDelayMs giữa 2 lần quăng cần
  CAST_JITTER_MIN_MS: 500,
  CAST_JITTER_MAX_MS: 2000,

  // Nghỉ tay định kỳ (Micro-break)
  MICRO_BREAK_INTERVAL_MIN_CATCHES: 8,
  MICRO_BREAK_INTERVAL_MAX_CATCHES: 14,
  MICRO_BREAK_MIN_MS: 6000,
  MICRO_BREAK_MAX_MS: 12000,
};
```

### 3.2. Luồng xử lý thời gian chi tiết (Timing Workflow)

#### A. Khi nhận challenge `RX 79 (CAN_CAU)`:
1. Nhận gói `RX 79`, ML client gọi model để suy luận ra mảng đáp án `answer` trong ~10-20ms.
2. Tính toán tổng delay mô phỏng người:
   $$\text{delay} = \text{random}(700, 1200) + (\text{answer.length} \times \text{random}(300, 520))$$
   *Ví dụ:* 6 phím $\rightarrow$ delay $\approx 2.5\text{s} - 4.3\text{s}$.
3. Chờ `delayCancellable(delay, signal)`.
4. Nếu chưa bị abort: Gửi `TX 43 (doFinishFishing(answer))`.

#### B. Khi nhận kết quả `RX 43 (onFinish)`:
1. Server trả về kết quả cá bắt được (hoặc sổng cá).
2. Chờ thời gian hoạt ảnh kéo cá lên mặt nước và xem thông tin:
   $$\text{catchDelay} = \text{random}(1800, 3200)\text{ ms}$$
3. Chờ `delayCancellable(catchDelay, signal)`.
4. Gửi `TX 44 (doCauCaXong)` và chờ server xác nhận `RX 44`.

#### C. Chuẩn bị lượt quăng cần kế tiếp:
1. Kiểm tra bộ đếm `catchesSinceBreak`:
   - Nếu đạt ngưỡng ngẫu nhiên `nextBreakThreshold` (8–14 lượt):
     - Chuyển trạng thái `resting`, log: `"[câu cá] nghỉ tay 8s mô phỏng người chơi..."`.
     - Chờ `delayCancellable(random(6000, 12000), signal)`.
     - Reset bộ đếm và chọn ngưỡng mới.
2. Nghỉ tiêu chuẩn giữa các lượt quăng:
   $$\text{restDelay} = \text{config.castDelayMs} + \text{random}(500, 2000)\text{ ms}$$
3. Chờ `delayCancellable(restDelay, signal)`.
4. Gửi `TX 41 (doQuanCau)` bắt đầu lượt mới.

---

## 4. Kế Hoạch Kiểm Tra & Xác Minh (Verification Plan)

### 4.1. Automated Verification
- Kiểm tra typecheck và build của toàn bộ repository:
  ```bash
  npm run build -w avatar-web/server
  npm run build -w avatar-web/web
  ```

### 4.2. Live Testing trên Game Thật
1. Khởi động tài khoản 3 ở chế độ `auto_fishing` tại Map 14.
2. Theo dõi traffic log qua API `/api/accounts/3/traffic`:
   - Đo khoảng thời gian giữa `RX 79` và `TX 43`: phải đạt từ **2.5s – 5.5s** (không còn 0.03s như trước).
   - Đo khoảng thời gian giữa `RX 43` và `TX 44`: phải đạt từ **1.8s – 3.2s** và thay đổi ngẫu nhiên từng vòng.
3. Đo thời gian duy trì kết nối liên tục:
   - Mục tiêu: Phiên câu cá hoạt động ổn định liên tục qua nhiều vòng câu (> 10 phút, > 10 con cá) mà **không bị server ngắt kết nối (`remote-end`)**.

---

## 5. User Review Gate

Vui lòng xem qua thiết kế trên. Nếu bạn đồng ý với Spec này, tôi sẽ chuyển sang **Bước 2: Viết Implementation Plan** theo đúng quy trình trong [CLAUDE.md](CLAUDE.md).
