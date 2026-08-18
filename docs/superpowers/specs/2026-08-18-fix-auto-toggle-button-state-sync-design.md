# Thiết kế: Khắc phục lỗi không tự cập nhật trạng thái nút Bật/Tắt Auto

- **Ngày tạo**: 2026-08-18
- **Trạng thái**: Chờ duyệt (Pending Review)
- **Phạm vi tác động**:
  - `avatar-web/server/src/session/avatarSession.ts`
  - `avatar-web/web/src/accounts/accountRuntime.ts`
  - `avatar-web/web/src/accounts/AccountsProvider.tsx`
  - `avatar-web/web/src/accounts/panels/StatusPanel.tsx`

---

## 1. Mục tiêu & Nguyên nhân gốc rễ (Root Cause)

### Vấn đề quan sát được
Khi người dùng bấm "Tắt auto" (hoặc "Bật auto") trên giao diện:
- Trạng thái button "Bật auto" / "Tắt auto" và dòng chữ trạng thái không tự cập nhật hoặc bị kẹt ở trạng thái cũ (`auto đang chờ vòng tiếp theo`, nút Bật auto bị disable dù đã tắt auto và badge hiện `chưa kết nối`).

### Nguyên nhân gốc rễ (Root Cause Analysis)
1. **Thiếu sự kiện WebSocket `desired-connected`**:
   - `autoActive` trên UI được tính bằng: `autoActive = auto.running || snap?.desiredConnected === true`.
   - Khi gọi `startAuto()` / `stopAuto()` / `connect()` / `disconnect()`, backend thay đổi biến `this.wanted` (`desiredConnected`), nhưng `AvatarSession` **chưa từng phát sự kiện `desired-connected`** qua WebSocket.
2. **Reducer `reduceAccountRuntime` ở frontend không cập nhật `desiredConnected`**:
   - `reduceAccountRuntime` chỉ xử lý các sự kiện `status`, `auto`, `farm`, `money`... mà không cập nhật `desiredConnected`. Do đó `snap.desiredConnected` bị giữ nguyên giá trị ban đầu mãi mãi trong suốt vòng đời của component.
3. **`AccountsProvider` bỏ qua sự kiện `desired-connected`**:
   - `AccountsProvider.tsx` lọc bỏ các sự kiện ngoài danh sách (`status`, `auto`, `farm-sync`, `metrics`), khiến danh sách tài khoản ngoài dashboard cũng không cập nhật được `desiredConnected`.

---

## 2. Giải pháp kỹ thuật

### 2.1. Server: Bổ sung phát sự kiện `desired-connected` trong `AvatarSession`
Tạo phương thức `setWanted(wanted: boolean)` trong `AvatarSession`:
```ts
private setWanted(wanted: boolean): void {
  if (this.wanted === wanted) return;
  this.wanted = wanted;
  this.emit('desired-connected', wanted);
}
```
Áp dụng `setWanted` tại tất cả các điểm thay đổi ý muốn kết nối:
- `start()` -> `this.setWanted(true)`
- `stop()` -> `this.setWanted(false)`
- `failPermanently()` -> `this.setWanted(false)`

### 2.2. Web Client: Cập nhật `desiredConnected` trong Reducer và Provider
1. **Trong `accountRuntime.ts` (`reduceAccountRuntime`)**:
   ```ts
   case 'desired-connected':
     return { ...current, desiredConnected: Boolean(message.payload) };
   ```
2. **Trong `AccountsProvider.tsx`**:
   - Thêm `desired-connected` vào danh sách sự kiện được lắng nghe:
   ```ts
   if (message.type === 'desired-connected') {
     return {
       ...account,
       runtime: {
         ...account.runtime,
         desiredConnected: Boolean(message.payload),
       },
     };
   }
   ```
3. **Trong `StatusPanel.tsx`**:
   - Khi `startAuto()` hoặc `stopAuto()` thành công, nếu cần có thể cập nhật ngay snapshot trả về từ server để tăng độ phản hồi tức thì (optimistic / instant response).

---

## 3. Kế hoạch kiểm thử (Verification Plan)

### Kiểm thử tự động (Unit Tests)
1. `avatarSession.test.ts`: Kiểm tra `desired-connected` được emit khi `start()`, `stop()`, `failPermanently()`.
2. `accountRuntime.test.ts`: Kiểm tra `reduceAccountRuntime` cập nhật trường `desiredConnected` khi nhận message `desired-connected`.
3. `StatusPanel.test.tsx`: Kiểm tra nút Bật/Tắt auto chuyển đổi enabled/disabled chính xác khi auto bật/tắt.

### Kiểm thử thủ công
1. Mở drawer tài khoản -> Bấm "Bật auto" -> Nút "Bật auto" chuyển sang disabled, nút "Tắt auto" chuyển sang enabled ngay lập tức.
2. Bấm "Tắt auto" -> Nút "Tắt auto" chuyển sang disabled, nút "Bật auto" chuyển sang enabled, text chuyển về `auto đang tắt`.
