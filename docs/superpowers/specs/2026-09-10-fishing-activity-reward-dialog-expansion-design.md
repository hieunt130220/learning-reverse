# Thiết Kế Mở Rộng Nhận Diện Hộp Thoại Thưởng Hoạt Động & Sự Kiện Khi Câu Cá

> **Ngày lập:** 2026-09-10  
> **Trạng thái:** Chờ User Review (User Review Gate)  
> **Tài liệu liên quan:**  
> - `avatar-web/server/src/game/client.ts`  
> - `avatar-web/server/src/session/avatarSession.ts`  
> - `docs/superpowers/specs/2026-09-10-fishing-event-reward-dialog-handling-design.md`  

---

## 1. Mục Tiêu & Bối Cảnh (Goals & Background)

### 1.1. Triệu chứng & Log thực tế phát sinh
Sau khi triển khai bộ lọc phần thưởng với mẫu `"Chúc mừng bạn đã nhận được..."`, server game tiếp tục gửi một biến thể thông báo thưởng khác trong khi đang quăng cần:
```text
1:03:20 PM [câu cá] lỗi khi quăng cần: Bạn thu hoạch được 1 cuốc từ hoạt động câu cá. Số lượng 1/40
```
Hậu quả:
- Vòng lặp câu cá coi đây là lỗi quăng cần lạ không nhận diện được.
- Đổi trạng thái `status = 'rejected'`, gán `lastError` và hủy toàn bộ phiên câu cá tự động.

### 1.2. Nguyên nhân cốt lõi (Root Cause)
Hàm `isRewardDialog` trước đó chỉ kiểm tra các từ khóa:
- `"chúc mừng"`
- `"nhận được"`
- `"phần thưởng"`

Thông báo thực tế từ server:
`"Bạn thu hoạch được 1 cuốc từ hoạt động câu cá. Số lượng 1/40"`
mang các đặc điểm từ vựng khác:
- Sử dụng cụm từ `"thu hoạch được"` thay vì `"nhận được"`.
- Chứa cụm từ nguồn gốc: `"từ hoạt động câu cá"` (hoặc `"từ hoạt động"`).
- Chứa bộ đếm giới hạn vật phẩm sự kiện trong ngày: `"Số lượng 1/40"` (mẫu `Số lượng X/Y`).

Do không khớp 3 từ khóa ban đầu, hàm `isRewardDialog` trả về `false`, dẫn tới `isInformationalDialog` trả về `false`, và `onCastDialog` lập tức ngắt `catchPromise`, báo lỗi và dừng bot câu cá.

### 1.3. Mục tiêu giải pháp
1. Mở rộng toàn diện các mẫu nhận diện trong `isRewardDialog` để bao quát:
   - Các động từ nhận quà: `"thu hoạch được"`, `"nhận được"`, `"nhặt được"`, `"kiếm được"`.
   - Nguồn gốc sự kiện: `"từ hoạt động"`, `"từ hoạt động câu cá"`, `"hoạt động câu cá"`.
   - Cụm từ chúc mừng / thưởng: `"chúc mừng"`, `"phần thưởng"`.
   - Mẫu đếm giới hạn vật phẩm hàng ngày của sự kiện: Regex `/số lượng\s*\d+\s*\/\s*\d+/i`.
2. Kiểm tra điều kiện phủ định chặt chẽ: loại trừ nếu chứa từ khóa lỗi (`"không thể"`, `"không được"`, `"thất bại"`, `"chưa thể"`).
3. Khi nhận diện đúng là dialog thưởng/hoạt động:
   - Ghi log thông tin: `[câu cá] nhận phần thưởng: Bạn thu hoạch được 1 cuốc từ hoạt động câu cá. Số lượng 1/40`.
   - Giữ nguyên promise chờ cá, không gián đoạn hoặc dừng tiến trình câu cá tự động.

---

## 2. Phạm Vi (Scope)

### 2.1. In-Scope
- Nâng cấp hàm `isRewardDialog` trong `avatar-web/server/src/game/client.ts`.
- Đảm bảo tương thích hoàn toàn với tất cả các nơi đang sử dụng `isRewardDialog` và `isInformationalDialog` (`joinParkWithRetry`, `rx45Promise`, `onCastDialog` trong `avatarSession.ts`).

### 2.2. Out-of-Scope
- Không thay đổi luồng quăng cần hay ML mini-game.
- Không can thiệp vào các dialog lỗi thực sự (hết mồi, hết vé, rương đầy, hỏng cần).

---

## 3. Thiết Kế Chi Tiết (Detailed Design)

### 3.1. Thuật toán `isRewardDialog` cải tiến

```typescript
/**
 * Kiểm tra xem một dialog từ server có phải là thông báo phần thưởng / sự kiện / hoạt động hay không.
 */
export function isRewardDialog(text: string): boolean {
  const normalized = text.trim().toLowerCase();

  // Nếu chứa từ khóa phủ định hoặc lỗi -> chắc chắn không phải nhận thưởng
  if (
    normalized.includes('không thể')
    || normalized.includes('không được')
    || normalized.includes('thất bại')
    || normalized.includes('chưa thể')
  ) {
    return false;
  }

  // 1. Chúc mừng
  if (normalized.includes('chúc mừng')) return true;

  // 2. Động từ nhận/thu hoạch vật phẩm
  if (
    normalized.includes('thu hoạch được')
    || normalized.includes('nhận được')
    || normalized.includes('nhặt được')
    || normalized.includes('kiếm được')
  ) {
    return true;
  }

  // 3. Có từ khóa phần thưởng
  if (normalized.includes('phần thưởng')) return true;

  // 4. Nhận từ hoạt động (ví dụ: "từ hoạt động câu cá")
  if (normalized.includes('từ hoạt động')) return true;

  // 5. Mẫu đếm giới hạn sự kiện trong ngày (ví dụ: "Số lượng 1/40", "Số lượng 1/50")
  if (/số lượng\s*\d+\s*\/\s*\d+/i.test(normalized)) {
    return true;
  }

  return false;
}
```

### 3.2. Đánh giá tính an toàn
- Các lỗi thật sự khi câu cá:
  - `"Bạn cần sử dụng mồi câu"` -> không chứa bất kỳ từ khóa thưởng hay regex nào -> `false`.
  - `"Bạn phải mua vé câu cá"` -> `false`.
  - `"Rương của bạn đã đầy"` -> `false`.
  - `"Không thể thực hiện lúc này"` -> chứa `"không thể"` -> `false`.
- Các thông báo thưởng thực tế:
  - `"Chúc mừng bạn đã nhận được 1 Thập Tự Ánh Sáng. Số lượng 1/50"` -> khớp `"chúc mừng"`, `"nhận được"`, regex `số lượng` -> `true`.
  - `"Bạn thu hoạch được 1 cuốc từ hoạt động câu cá. Số lượng 1/40"` -> khớp `"thu hoạch được"`, `"từ hoạt động"`, regex `số lượng` -> `true`.

---

## 4. Kế Hoạch Xác Minh (Verification Plan)

### 4.1. Automated Verification
- Kiểm tra kết quả khớp của hàm `isRewardDialog` đối với các trường hợp:
  1. `"Bạn thu hoạch được 1 cuốc từ hoạt động câu cá. Số lượng 1/40"` => `true`
  2. `"Chúc mừng bạn đã nhận được 1 Thập Tự Ánh Sáng. Số lượng 1/50"` => `true`
  3. `"Bạn đã hết mồi câu"` => `false`
  4. `"Rương của bạn đã đầy"` => `false`
- Biên dịch TypeScript: `npm --prefix avatar-web/server run build` => 0 lỗi.

### 4.2. Manual Verification
- Chạy hệ thống và theo dõi log vòng lặp câu cá khi nhận phần thưởng sự kiện.
