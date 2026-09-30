# Minigame Trúc Xanh Map 7: Chiến Thuật P2 Luôn Thua (Feeder Bot)

> **Ngày lập:** 2026-09-30  
> **Topic:** `trucxanh-p2-feeder`  
> **Trạng thái:** Chờ User Review  

---

## 1. Mục Tiêu & Bối Cảnh

Khi chạy probe Minigame Trúc Xanh Map 7 với 2 tài khoản (`--two-players` hoặc `--account-id-2`), người dùng yêu cầu:
- **Tài khoản chính (Account 1 / P1):** Luôn luôn **CHIẾN THẮNG** với điểm số tối đa (hướng tới 12 - 0) và nhận hộp quà phần thưởng cuối trận.
- **Tài khoản phụ (Account 2 / P2):** Luôn luôn **THUA** (điểm số 0 hoặc tối thiểu), đóng vai trò "Feeder/Scout" mở bài thăm dò để nhường toàn bộ điểm số và quyền ăn thẻ cho Account 1.

---

## 2. Phạm Vi (Scope)

### In-Scope
- **File tác động:** `avatar-web/server/src/tools/trucxanh-probe.ts`.
- **Cơ chế chiến thuật cho P2 (Feeder / Loser Mode):**
  1. **Tuyệt đối không ăn điểm (No Match):**
     - P2 không bao giờ chủ động mở 2 lá bài cùng hình ảnh (`findKnownPair` bị vô hiệu hóa trên P2).
     - Khi mở lá thứ 1 (thẻ chưa biết hình `card1`): P2 lưu ảnh vào `sharedMemory` để P1 cùng biết.
     - Khi mở lá thứ 2: P2 chủ động chọn một thẻ `card2` **đã biết có hình ảnh khác** (`img2 !== img1`) trên bàn cờ. Điều này đảm bảo xác suất ghép trúng cặp là **0%** (`isMatch === false`).
     - Ngay sau đó, lượt chơi kết thúc và chuyển ngay về P1. Nếu `card1` vừa mở tạo thành cặp với một thẻ trước đó, P1 sẽ lập tức thu hoạch cặp này ngay khi đến lượt.
  2. **Xử lý các tình huống biên (Edge Cases):**
     - *Đầu ván khi chưa có thẻ nào được biết hình:* P2 mở `card1` thăm dò, sau đó mở `card2` thăm dò (xác suất trùng ngẫu nhiên chỉ 1/23). Nếu không trùng, bàn cờ lập tức có 2 thẻ khác hình đã biết cho các lượt tiếp theo.
     - *Cuối ván khi các thẻ còn lại đều thuộc các cặp đã biết:* P2 chủ động mở chéo 2 thẻ thuộc 2 cặp khác nhau (ví dụ: thẻ A của Cặp 1 và thẻ B của Cặp 2) để cố tình không khớp, chuyển lượt cho P1 ăn sạch toàn bộ.
  3. **Tham số dòng lệnh:**
     - Tự động kích hoạt khi có 2 tài khoản (`--two-players` hoặc `--account-id-2`).
     - Tùy chọn `--p2-mode <feeder|normal>` (mặc định: `feeder`).

### Out-of-Scope
- Không thay đổi logic của tài khoản P1 (P1 vẫn dùng thuật toán Perfect Memory tối ưu để ăn điểm tối đa).
- Không can thiệp vào các minigame khác (Cờ caro, Aincrad).

---

## 3. Thiết Kế Kỹ Thuật

### 3.1 Cấu Trúc Vai Trò Runner (`runnerRole`)

Trong `TrucXanhGameRunner`, thêm thuộc tính `role: 'winner' | 'feeder'`:
- `P1`: `role = 'winner'` (mặc định).
- `P2`: `role = 'feeder'` (khi chạy 2 tài khoản).

### 3.2 Thuật Toán Feeder Của P2 (`executeFeederTurn`)

Khi đến lượt P2:
```
1. Thẻ thứ 1:
   - Chọn 1 thẻ chưa mở và chưa từng biết hình: card1 = memory.pickUnknownCard()
   - Nếu toàn bộ thẻ đều đã biết hình: chọn 1 thẻ còn lại bất kỳ.
   - Gửi lật card1 -> Nhận img1 từ server (lưu vào sharedMemory).

2. Thẻ thứ 2 (Mục tiêu: ĐẢM BẢO KHÔNG TRÙNG):
   - Tìm trong các thẻ chưa bị loại bỏ (removed) một thẻ card2 có hình KHÁC img1:
     card2 = memory.findKnownDifferentCard(card1, img1)
   - Nếu tìm thấy card2 khác hình:
     -> Lật card2! Kết quả 100% MISMATCH.
     -> Lượt P2 kết thúc, chuyển lượt cho P1. P2 không có điểm.
   - Nếu chưa có thẻ nào khác hình được biết (chỉ xảy ra ở lượt 1 đầu game):
     -> Chọn 1 thẻ chưa biết khác làm card2.
```

Hàm hỗ trợ mới trong `TrucXanhMemory`:
```typescript
/** Tìm một thẻ đã biết hình nhưng hình khác với img */
findKnownDifferentCard(excludeCardId: number, diffImg: number): number | null {
  for (const [cId, img] of this.cardImages.entries()) {
    if (cId !== excludeCardId && img !== diffImg && !this.isRemoved(cId)) {
      return cId;
    }
  }
  return null;
}
```

### 3.3 Flow Phối Hợp Giữa P1 và P2

```
P2 (Feeder)                                          P1 (Winner)
    |                                                     |
    |-- Lật Ô #0 (Hình #5001)                             |
    |-- Lật Ô #1 (Đã biết là #5002, cố tình lệch)        |
    |-- Mismatch -> Đổi lượt ---------------------------->|
    |                                                     |-- Phát hiện Ô #0 (#5001) khớp với Ô #10 (#5001)
    |                                                     |-- P1 lật #0 & #10 -> Ăn điểm 1!
    |                                                     |-- Tiếp tục chuỗi ăn điểm...
```

---

## 4. Verification Plan

1. **Khởi chạy probe 2 tài khoản với P2 Feeder:**
   ```bash
   npx --prefix avatar-web/server tsx --env-file=avatar-web/server/.env avatar-web/server/src/tools/trucxanh-probe.ts --two-players
   ```
2. **Kiểm tra kết quả trên console:**
   - P2 không bao giờ mở các cặp đã nhớ.
   - Khi P2 lật thẻ 2, luôn chọn thẻ lệch hình để trượt lượt.
   - Điểm số của P2 kết thúc ván: `0` (hoặc tối đa 1 do ngẫu nhiên lượt 1).
   - Điểm số của P1 kết thúc ván: `11` hoặc `12`.
   - Kết quả tổng kết: P1 `CHIẾN THẮNG`, P2 `THẤT BẠI`.
   - Hộp quà phần thưởng rơi về tài khoản P1.
