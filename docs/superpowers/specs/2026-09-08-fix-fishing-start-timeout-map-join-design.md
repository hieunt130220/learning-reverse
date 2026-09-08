# Thiết Kế Khắc Phục Lỗi Timeout Bắt Đầu Câu Cá (Hết Giờ Chờ Bắt Đầu Câu) & Chuẩn Hóa Vào Map 14

> **Ngày lập:** 2026-09-08  
> **Trạng thái:** Chờ User Review (User Review Gate)  
> **Tài liệu liên quan:**
> - `docs/danh-sach-cac-map-cau-ca-AvatarHD.md`
> - `docs/superpowers/specs/2026-09-08-humanize-fishing-timing-anti-cheat-design.md`
> - `avatar-web/server/src/game/parkService.ts`
> - `avatar-web/server/src/session/avatarSession.ts`

---

## 1. Mục Tiêu & Bối Cảnh (Goals & Background)

### 1.1. Bối cảnh lỗi (Symptom)
Khi bật chế độ tự động câu cá (`auto_fishing`), hệ thống báo lỗi:
```text
11:34:19 AM [câu cá] đã vào khu vực câu cá map 14
11:34:27 AM [câu cá] server từ chối: hết giờ chờ bắt đầu câu
```

### 1.2. Kết quả điều tra nguyên nhân gốc rễ (Root Cause Analysis)
Qua đối chiếu packet traffic live và dịch ngược binary `libil2cpp.so` cũng như bot `avatar-auto.jar` (`bs_0.java`, `fp.java`):

1. **Cơ chế vào map "mù" (Blind Join) trong `avatarSession.ts`:**
   - Trong hàm `runFishingLoop` (dòng 1746–1750), bot gửi lệnh vào map `client.joinPark(map, area)` rồi ngủ cứng 2 giây (`await this.delayCancellable(2000, signal)`).
   - Bot **không hề chờ hoặc kiểm tra gói xác nhận `RX 80 (AVATAR_JOIN_PARK / world-snapshot)`** từ server.
   - Ngay sau 2 giây, bot tự ý in log giả `[câu cá] đã vào khu vực câu cá map 14` và gọi thẳng `client.startFishing()` (`TX 45`).

2. **Sai lệch tọa độ Map 14 trong `parkService.ts`:**
   - Trong `parkService.ts:48`:
     ```typescript
     14: Object.freeze({ x: 254, y: 82 }),
     ```
     Tọa độ `(254, 82)` thực chất là tọa độ của Map 5 (Công viên).
   - Trong mã nguồn bot native `bs_0.java:826-829`:
     ```java
     case 14: {
         fj.int = if[22]; // 460
         fj.byte = if[23]; // 97
         break;
     }
     ```
     Tọa độ native thực sự của Map 14 (Khu cá rô) là **`x = 460, y = 97`**.
   - Việc gửi tọa độ sai khiến server từ chối gói `TX 80` và trả về thông báo lỗi qua `RX -40`:
     `"Có lỗi khi vào khu vực. Xin thử lại sau."`

3. **Server bỏ qua gói `TX 45` do nhân vật chưa ở trong map:**
   - Vì gói `TX 80` bị server từ chối, nhân vật thực tế vẫn đứng ở map cũ (ví dụ: Nông trại hoặc Đảo khác).
   - Gói `TX 45 (START_CAU_CA)` được gửi đi nhưng server coi đây là bất thường (nhân vật không đứng cạnh ghế câu ở map câu cá) nên server **lặng lẽ bỏ qua, không trả về `RX 45`**.
   - Sau 8 giây, timer trong `rx45Promise` kích hoạt lỗi timeout:
     `"server từ chối: hết giờ chờ bắt đầu câu"`.

---

## 2. Phạm Vi Giải Pháp (Scope)

### 2.1. Trong phạm vi (In-Scope)
1. **Cập nhật tọa độ chuẩn cho Map 14 trong `parkService.ts`:**
   - Đổi tọa độ Map 14 từ `(254, 82)` thành `(460, 97)`.
2. **Loại bỏ Blind Join — Tích hợp cơ chế chờ xác thực `waitForWorldSnapshot`:**
   - Sử dụng phương thức có sẵn `client.waitForWorldSnapshot(...)` trong `client.ts` để lắng nghe xác nhận `RX 80` với timeout xác định (5000ms).
   - Chỉ khi nhận được `world-snapshot` với đúng `roomId = map` mới xác nhận đã vào map thành công.
3. **Bắt và hiển thị lỗi tức thì từ Server (`RX -40` / Server Dialog):**
   - Nếu server trả về dialog lỗi (như *"Có lỗi khi vào khu vực"*, *"Bạn cần vé câu cá rô"*, *"Không có cần câu"*), bot phải bắt ngay lập tức và dừng loop với thông báo chính xác cho người dùng, không để treo 8 giây rồi báo timeout mơ hồ.
4. **Kiểm tra trạng thái trước khi gửi `TX 45`:**
   - Chỉ gửi `client.startFishing()` khi đã chắc chắn nhân vật đang ở map câu cá.

### 2.2. Ngoài phạm vi (Out-of-Scope)
- Không thay đổi model ML giải mini-game (Phase 2 / Phase 3).
- Không can thiệp vào các logic auto-farm hoặc auto-attendance.

---

## 3. Thiết Kế Kiến Trúc & Chi Tiết Kỹ Thuật

### 3.1. Danh sách file thay đổi
1. `avatar-web/server/src/game/parkService.ts`:
   - Cập nhật `NATIVE_PARK_JOIN_POSITIONS[14]` thành `{ x: 460, y: 97 }`.
2. `avatar-web/server/src/session/avatarSession.ts`:
   - Sửa luồng di chuyển trong `runFishingLoop`:
     ```typescript
     // Lắng nghe lỗi server hoặc xác nhận vào map
     const snapshotPromise = client.waitForWorldSnapshot(signal, 6000, { map, area });
     client.joinPark(map, area);
     const snap = await snapshotPromise;
     ```
   - Bổ sung listener lắng nghe lỗi dialog `server-error` / `server-dialog` trong quá trình join map để reject nhanh nếu server từ chối.

### 3.2. Data Flow chi tiết khi chuyển sang Auto Fishing

```text
[User Start Auto Fishing]
           │
           ▼
[enterParkContext() (TX -1 [09])]
           │
           ▼ (delay 800ms)
[arm waitForWorldSnapshot({ map: 14, area: 0 }, 6000ms)]
[arm errorDialogListener (-40)]
           │
           ▼
[client.joinPark(14, 0) (TX 80: x=460, y=97)]
           │
      ┌────┴──────────────────────────┐
      ▼                               ▼
[RX 80 (AVATAR_JOIN_PARK)]      [RX -40 (Error Dialog)]
      │                               │
      ▼                               ▼
[Snapshot confirmed!]           [Reject instantly: "server: Có lỗi khi vào khu vực..."]
      │                               │
      ▼                               ▼
[pushLog: "đã vào map 14"]      [Set status: 'rejected', dừng loop]
      │
      ▼
[client.startFishing() (TX 45)]
      │
      ▼
[RX 45 (START_CAU_CA) -> vào chu kỳ quăng cần TX 41]
```

---

## 4. Kế Hoạch Xác Minh (Verification Plan)

### 4.1. Automated Verification
- Chạy typecheck và build:
  ```bash
  npm run build -w avatar-web/server
  ```
- Kiểm tra không có lỗi cú pháp hoặc hồi quy type.

### 4.2. Live Verification trên Tài Khoản 3
1. Kiểm tra gửi lệnh `joinPark(14, 0)` với tọa độ mới `(460, 97)` qua packet probe.
2. Kiểm tra xem server có trả về `RX 80` với snapshot của Map 14 hay không.
3. Kích hoạt `auto_fishing` qua API:
   ```bash
   POST /api/accounts/3/automation/start {"mode": "auto_fishing"}
   ```
4. Quan sát log trên server:
   - Bot phải ghi nhận đúng: `[câu cá] đang di chuyển vào map 14 (khu vực 0)…`
   - Nhận `RX 80` và ghi nhận: `[câu cá] đã vào khu vực câu cá map 14`.
   - Gửi `TX 45` và nhận được phản hồi `RX 45` ngay lập tức (không còn timeout 8 giây `hết giờ chờ bắt đầu câu`).
   - Tiến hành quăng cần (`TX 41`) và nhận diện cá cắn câu bình thường.

---

## 5. User Review Gate

Vui lòng xem qua thiết kế Spec trên. Nếu bạn duyệt (approve), tôi sẽ chuyển sang **Bước 2: Viết Implementation Plan** chi tiết theo đúng quy trình bắt buộc của [CLAUDE.md](CLAUDE.md).
