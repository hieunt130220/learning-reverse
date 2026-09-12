# Thiết Kế Xử Lý Hộp Thoại Phần Thưởng Sự Kiện & Thông Báo Trong Tự Động Câu Cá

> **Ngày lập:** 2026-09-10  
> **Trạng thái:** Chờ User Review (User Review Gate)  
> **Tài liệu liên quan:**  
> - `avatar-web/server/src/session/avatarSession.ts`  
> - `avatar-web/server/src/game/client.ts`  
> - `docs/superpowers/specs/2026-09-08-humanize-fishing-timing-anti-cheat-design.md`  

---

## 1. Mục Tiêu & Bối Cảnh (Goals & Background)

### 1.1. Bối cảnh & Vấn đề thực tế
Khi tài khoản tự động câu cá trong map công viên (Park), trong các sự kiện (event) hoặc khi đạt mốc nhận thưởng may mắn, server gửi thông báo nhận thưởng qua gói tin `CMD -40` (hộp thoại thông báo chung):
```text
8:58:57 AM server: Chúc mừng bạn đã nhận được 1 Thập Tự Ánh Sáng. Số lượng 1/50
8:58:57 AM [câu cá] lỗi khi quăng cần: Chúc mừng bạn đã nhận được 1 Thập Tự Ánh Sáng. Số lượng 1/50
```

Ngay sau đó, bot tự động câu cá bị dừng đột ngột:
- `fishingRuntime.status` chuyển thành `rejected`
- `lastError` bị gán là `"Chúc mừng bạn đã nhận được 1 Thập Tự Ánh Sáng. Số lượng 1/50"`
- Toàn bộ vòng lặp câu cá (`runFishingLoop`) bị hủy và thoát ra ngoài.

### 1.2. Nguyên nhân cốt lõi (Root Cause)
1. Trong `runFishingLoop` tại `avatar-web/server/src/session/avatarSession.ts`:
   - Sau khi gửi `client.quanCau()`, bot tạo một promise `catchPromise` để chờ `fishing-success-result` (cá cắn câu / câu thành công) hoặc `dialog` (lỗi hết mồi, hết vé, rương đầy, gãy cần).
   - Hàm lắng nghe `onCastDialog` áp dụng cơ chế lọc loại trừ sơ sài:
     ```typescript
     const onCastDialog = (reason: string) => {
       if (
         reason.trim() === PARK_ALREADY_IN_AREA_DIALOG
         || parseQuestDialogText(reason) !== null
       ) return;
       if (settled) return;
       settled = true;
       cleanup();
       resolve(reason); // Bất kỳ dialog nào khác đều bị coi là lỗi quăng cần!
     };
     ```
   - Khi server gửi thông báo nhận thưởng sự kiện (như *"Chúc mừng bạn đã nhận được 1 Thập Tự Ánh Sáng. Số lượng 1/50"*), `onCastDialog` hiểu nhầm đây là lỗi quăng cần từ server, gỡ bỏ toàn bộ listener chờ cá và trả về chuỗi thông báo.
   - Code sau đó kiểm tra từ khóa (`rương đầy`, `vé`, `mồi`, `cần câu`). Vì không khớp các lỗi trên, bot coi đây là lỗi không nhận diện được và dừng hẳn quá trình câu cá (`status = 'rejected'`).
2. Hiện tượng tương tự cũng tiềm ẩn rủi ro tại:
   - `rx45Promise` (trong bước `startFishing` TX45): nếu nhận dialog thưởng / thông báo hệ thống đúng lúc sẽ làm fail bước bắt đầu câu.
   - `dialogRejectionPromise` (trong `joinParkWithRetry`): nếu nhận dialog sự kiện / thông báo sẽ làm fail việc vào map.

### 1.3. Mục tiêu giải pháp
1. Xây dựng cơ chế phân loại dialog chuẩn xác: phân tách rõ **Hộp thoại thông tin/phần thưởng/sự kiện (Informational & Reward Dialogs)** với **Hộp thoại lỗi từ chối thao tác (Error Dialogs)**.
2. Khi nhận dialog phần thưởng / thông báo trong quá trình câu cá:
   - **Ghi log tích cực** lên hệ thống: ví dụ `[câu cá] Nhận phần thưởng: Chúc mừng bạn đã nhận được...` để người dùng theo dõi.
   - **Không hủy / không ngắt vòng lặp câu cá**: giữ nguyên listener chờ cá cắn câu và kết quả câu.
3. Áp dụng đồng bộ bộ lọc này vào cả 3 điểm tiếp nhận dialog: `onCastDialog` (quăng cần), `onStartDialog` (bắt đầu câu), và `joinParkWithRetry` (vào map).

---

## 2. Phạm Vi (Scope)

### 2.1. In-Scope
- Phân tích và xây dựng hàm tiện ích `isInformationalDialog(text: string): boolean` (hoặc `classifyDialog(text: string)`) để phân loại dialog từ server.
- Xử lý các mẫu thông báo phần thưởng, sự kiện, chúc mừng phổ biến trong Avatar:
  - Bắt đầu hoặc chứa `"chúc mừng"` (case-insensitive)
  - Chứa `"nhận được"` (và không chứa từ phủ định như `"không thể"`, `"thất bại"`)
  - Chứa `"phần thưởng"`
  - Thông báo hệ thống/broadcast: `"thông báo:"`, `"hệ thống:"`
  - Giữ nguyên các mẫu đã có: `PARK_ALREADY_IN_AREA_DIALOG`, `parseQuestDialogText(text) !== null`
- Cập nhật `onCastDialog` trong `avatarSession.ts`:
  - Nếu là dialog thông tin/thưởng: push log `[câu cá] Nhận phần thưởng: ...` và tiếp tục lắng nghe, không settle promise.
  - Nếu là dialog lỗi thật sự: mới settle promise để xử lý mua mồi/vé/bán cá hoặc dừng câu nếu lỗi lạ.
- Cập nhật `rx45Promise` (bắt đầu câu) và `joinParkWithRetry` (vào map) để bỏ qua các dialog thông tin này một cách an toàn.

### 2.2. Out-of-Scope
- Không thay đổi logic của mini-game câu cá (ML solver).
- Không thay đổi cơ chế mua mồi/vé tự động khi hết mồi/vé thật sự.
- Không can thiệp vào các opcode farm nông trại.

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật (Architecture & Technical Design)

### 3.1. Danh sách Modules & Files liên quan

| File | Vai trò | Thay đổi chính |
|---|---|---|
| `avatar-web/server/src/game/client.ts` hoặc `avatar-web/server/src/session/avatarSession.ts` | Phân loại & xử lý dialog | Bổ sung hàm kiểm tra `isInformationalDialog` & `isRewardDialog` |
| `avatar-web/server/src/session/avatarSession.ts` | Điều phối session & vòng lặp câu cá | Cập nhật `onCastDialog`, `onStartDialog`, `joinParkWithRetry` để bỏ qua dialog thông tin |

### 3.2. Thiết kế hàm phân loại Dialog

```typescript
/**
 * Kiểm tra xem một dialog từ server có phải là thông báo phần thưởng / sự kiện hay không.
 */
export function isRewardDialog(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (normalized.includes('chúc mừng')) return true;
  if (
    normalized.includes('nhận được')
    && !normalized.includes('không thể')
    && !normalized.includes('không được')
    && !normalized.includes('thất bại')
  ) {
    return true;
  }
  if (normalized.includes('phần thưởng')) return true;
  return false;
}

/**
 * Kiểm tra xem một dialog từ server có phải là thông báo thông tin chung cần bỏ qua
 * (không làm gián đoạn luồng di chuyển, bắt đầu câu, hay quăng cần).
 */
export function isInformationalDialog(reason: string): boolean {
  const trimmed = reason.trim();
  if (!trimmed) return true;

  // 1. Dialog "đã ở trong khu vực này rồi"
  if (trimmed === PARK_ALREADY_IN_AREA_DIALOG) return true;

  // 2. Dialog cập nhật tiến trình nhiệm vụ (Tân Thủ, Nhà Nông, Thợ Câu)
  if (parseQuestDialogText(reason) !== null) return true;

  // 3. Hộp thoại thông báo nhận thưởng sự kiện / chúc mừng
  if (isRewardDialog(trimmed)) return true;

  // 4. Hộp thoại broadcast thông báo hệ thống / bảo trì định kỳ
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('thông báo:')
    || lower.startsWith('hệ thống:')
    || lower.startsWith('server:')
  ) {
    return true;
  }

  return false;
}
```

### 3.3. Luồng xử lý chi tiết trong `runFishingLoop`

```text
client.quanCau() (TX 41)
       │
       ▼
Chờ catchPromise:
   ├── Event 'fishing-success-result' (RX 43):
   │       └── Settle thành công (true/false)
   │
   ├── Event 'dialog' (CMD -40 / onCastDialog):
   │       ├── Kiểm tra isRewardDialog(reason)?
   │       │       ├── ĐÚNG:
   │       │       │     ├── pushLog(`[câu cá] Nhận phần thưởng: ${reason}`)
   │       │       │     └── RETURN (tiếp tục chờ cá cắn câu, KHÔNG settle promise)
   │       │       └── SAI:
   │       │             ├── Kiểm tra isInformationalDialog(reason)?
   │       │             │       ├── ĐÚNG: RETURN (bỏ qua, KHÔNG settle promise)
   │       │             │       └── SAI: Settle promise với reason (xử lý lỗi mồi/vé/rương)
   │
   └── Timeout (35s) hoặc Abort:
           └── Settle false / cleanup
```

---

## 4. Edge Cases & Error Handling

1. **Server gửi phần thưởng đúng khoảnh khắc cá cắn câu:**
   - Khi dialog thưởng đến: ghi log `[câu cá] Nhận phần thưởng: ...` và không đóng promise.
   - Khi gói `RX 43` kết quả câu đến: `onSuccess` kích hoạt bình thường và hoàn tất lượt câu.
2. **Server gửi phần thưởng nhưng sau đó trượt cá (timeout 35s):**
   - Dialog thưởng vẫn được ghi nhận trong log.
   - Sau 35s không có cá cắn: `catchPromise` timeout an toàn, bot reset phiên và quăng cần lượt tiếp theo, không bị văng trạng thái `rejected`.
3. **Dialog báo hết mồi / hết vé / rương đầy:**
   - Các dialog này không khớp `isRewardDialog` hay `isInformationalDialog`.
   - `onCastDialog` resolve lỗi như hiện tại, kích hoạt logic tự động mua vé/mồi hoặc dọn rương bán cá như bình thường.

---

## 5. Kế hoạch kiểm tra & xác minh (Verification Plan)

### 5.1. Automated Verification
- Chạy unit test kiểm tra logic hàm `isRewardDialog` và `isInformationalDialog` với các chuỗi mẫu thực tế:
  - `"Chúc mừng bạn đã nhận được 1 Thập Tự Ánh Sáng. Số lượng 1/50"` -> `true`
  - `"Chúc mừng bạn nhận được 5000 xu"` -> `true`
  - `"Bạn vừa nhận được 1 Hộp quà may mắn"` -> `true`
  - `"Bạn đã hết mồi câu"` -> `false` (phải nhận diện là lỗi)
  - `"Bạn chưa mua vé câu cá"` -> `false`
  - `"Rương của bạn đã đầy"` -> `false`
  - `"Cần câu của bạn đã hỏng"` -> `false`
- Chạy type-check: `npm run build` trong `avatar-web/server` để đảm bảo không lỗi kiểu dữ liệu.

### 5.2. Manual Verification
- Kiểm tra lại bằng log thực tế từ tài khoản câu cá khi có sự kiện diễn ra.
