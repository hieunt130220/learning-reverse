# Thiết Kế: Bỏ Tab Khai Thác & Thêm Popup Chọn Loại Khai Thác Khi Bật Auto

> **Ngày:** 2026-09-25  
> **Chủ đề:** `bo-tab-khai-thac-popup-chon-loai`  
> **Trạng thái:** Chờ User Review (User Review Gate — Bước 1/3 theo CLAUDE.md)

---

## 1. Mục Tiêu & Bối Cảnh

- **Vấn đề:** Hiện tại trên giao diện Web Drawer có tab riêng `⛏️ Khai thác` và sub-tab `⛏️ Khai thác` trong tab `Cài đặt` chỉ để cấu hình mục tiêu và xem thông số. Việc bố trí này gây thừa thãi tab khi người dùng vận hành nhiều tài khoản và làm phân tán luồng điều khiển.
- **Mục tiêu:**
  1. Loại bỏ hoàn toàn tab `⛏️ Khai thác` trên thanh menu điều hướng Drawer (`AccountOperationsDrawer.tsx`) và sub-tab `⛏️ Khai thác` trong tab `Cài đặt` (`SettingsPanel.tsx`).
  2. Tại bảng điều khiển `StatusPanel.tsx`: Khi người dùng chọn mode `⛏️ Khai thác gỗ/đá` và bấm nút **"Bắt đầu"**, hệ thống hiển thị popup modal hỏi người dùng muốn khai thác loại nào (Đá / Gỗ / Cả hai).
  3. Người dùng chọn loại tài nguyên và bấm xác nhận -> Client lưu cấu hình mục tiêu qua API `PUT /api/accounts/:id/automation/mining/config`, sau đó kích hoạt auto qua API `POST /api/accounts/:id/automation/start` với mode `auto_mining`.

---

## 2. Phạm Vi (Scope)

### 2.1 In-Scope
1. **Frontend Navigation & Clean-up:**
   - Xóa bỏ tab `mining` trong `PANEL_TABS`, `PANEL_GROUPS`, `DESKTOP_CONSOLE_GROUPS` và bỏ slot render `MiningPanel` trong `AccountOperationsDrawer.tsx`.
   - Cập nhật hotkey navigation của desktop console (từ 1..8 thành 1..7).
   - Xóa bỏ sub-tab `mining` trong `SettingsPanel.tsx` và xóa component `MiningSettingsPanel.tsx`, `MiningPanel.tsx`.
2. **Modal Chọn Loại Khai Thác (`MiningTargetModal.tsx`):**
   - Modal hiển thị chuẩn theo hệ thống UI (`dialog-backdrop`, `account-modal`, `useDialogFocus`, phím ESC, click ra ngoài backdrop để đóng).
   - Tải cấu hình hiện tại để pre-select target gần nhất của tài khoản.
   - Cho phép chọn 3 mục tiêu:
     - 💎 **Đá (Kim Cương Trắng)** — Mỏ đá Ngoại ô (Room 26)
     - 🪵 **Củi Khô (Gỗ)** — Rừng cây Ngoại ô (Room 22)
     - 🔄 **Cả hai (Tuần tra)** — Đào hết đá Room 26 rồi sang Room 22
   - Nút hành động: `Hủy` và `Bắt đầu khai thác`.
3. **Tích hợp vào `StatusPanel.tsx`:**
   - Khi `selectedMode === 'auto_mining'` và bấm **"Bắt đầu"**: Không gọi start ngay mà mở `MiningTargetModal`.
   - Sau khi user xác nhận trên modal: lưu cấu hình mục tiêu -> gọi start auto -> cập nhật snapshot runtime và UI.
4. **Cập nhật Unit Tests:**
   - Cập nhật test trong `StatusPanel.test.tsx` và `accountsRoutes.test.tsx` đảm bảo pass 100%.

### 2.2 Out-of-Scope
- Không thay đổi backend runner logic (`AutoMiningRunner`) hay SQLite database schema.
- Không thay đổi các mode tự động khác (`auto_farm`, `auto_fishing`, `auto_maze`, `find_npc`).

---

## 3. Thiết Kế Kiến Trúc & Giải Pháp Kỹ Thuật

### 3.1 Danh Sách Files Liên Quan

| File | Vai trò | Thay đổi |
| :--- | :--- | :--- |
| `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx` | Drawer Console chính | Bỏ tab `mining`, bỏ group `mining`, đánh lại hotkey 1..7, bỏ import/slot `MiningPanel`. |
| `avatar-web/web/src/accounts/panels/SettingsPanel.tsx` | Tab Cài đặt | Bỏ sub-tab `mining` và slot render `MiningSettingsPanel`. |
| `avatar-web/web/src/accounts/MiningTargetModal.tsx` | **Tạo mới** | Modal popup chọn loại khai thác trước khi bật auto_mining. |
| `avatar-web/web/src/accounts/panels/StatusPanel.tsx` | Điều khiển start/stop auto | Chặn `startAuto` khi mode là `auto_mining` để mở `MiningTargetModal`. |
| `avatar-web/web/src/accounts/panels/MiningPanel.tsx` | Bảng điều khiển cũ | **Xóa bỏ** (dead code sau khi bỏ tab). |
| `avatar-web/web/src/accounts/panels/MiningSettingsPanel.tsx` | Bảng cài đặt cũ | **Xóa bỏ** (dead code sau khi bỏ sub-tab). |
| `avatar-web/web/src/accounts/panels/StatusPanel.test.tsx` | Test StatusPanel | Thêm test case mở popup và kích hoạt auto khai thác qua modal. |

---

### 3.2 Luồng Xử Lý (Sequence Flow)

```
User               StatusPanel           MiningTargetModal          Backend API
 |                      |                        |                       |
 |--- Click "Bắt đầu"-->|                        |                       |
 |  (mode=auto_mining)  |--- showModal = true -->|                       |
 |                      |                        |--- GET mining/config->| (Lấy revision & target cũ)
 |                      |                        |<-- { revision, target}|
 |                      |<-- Render Modal -------|                       |
 |                      |                        |                       |
 |--- Chọn "Đá" / "Gỗ"->|                        |                       |
 |--- Click "Bắt đầu" ->|                        |--- PUT mining/config->| (Lưu target mới)
 |                      |                        |<-- { revision: N+1 } -|
 |                      |                        |--- POST auto/start -->| (mode: 'auto_mining')
 |                      |                        |<-- AutomationSnapshot-|
 |                      |<-- onStartSuccess -----|                       |
 |                      |--- Đóng Modal ---------|                       |
 |<-- Cập nhật chạy auto|                        |                       |
```

---

### 3.3 Chi Tiết Component `MiningTargetModal`

```typescript
export interface MiningTargetModalProps {
  open: boolean;
  accountId: number;
  onClose(): void;
  onSuccess(snapshot: AutomationSnapshot): void;
}
```
- **State quản lý:**
  - `target: MiningTarget`: Mặc định lấy từ cấu hình hiện tại hoặc `'diamond'`.
  - `revision: number`: Lấy từ `GET /api/accounts/:id/automation/mining/config` để tránh xung đột optimistic lock.
  - `busy: boolean`: Trạng thái khi đang lưu config và gọi start auto.
  - `error: string`: Hiển thị lỗi nếu request thất bại.
- **Xử lý submit:**
  1. Gửi `PUT /api/accounts/:id/automation/mining/config` cập nhật `{ target, ...currentConfig }`.
  2. Gửi `POST /api/accounts/:id/automation/start` với `{ mode: 'auto_mining' }`.
  3. Kích hoạt `onSuccess(snapshot)` và `onClose()`.

---

## 4. Verification Plan

### 4.1 Automated Tests
- Chạy `npm test -- --run` tại `avatar-web/web`:
  - `StatusPanel.test.tsx`:
    1. Kiểm tra khi chọn `auto_mining` và bấm `Bắt đầu`, modal popup xuất hiện với tiêu đề "Chọn loại khai thác".
    2. Kiểm tra khi bấm hủy thì không có request API nào được gửi đi và modal đóng.
    3. Kiểm tra khi chọn loại (ví dụ: `Củi Khô`) và bấm `Bắt đầu khai thác`, gọi đúng `PUT mining/config` với target tương ứng và `POST automation/start`.
  - `accountsRoutes.test.tsx`: Đảm bảo toàn bộ routes render thành công không còn lỗi `API ngoài dự kiến: /api/accounts/1/automation/mining/config`.

### 4.2 Manual Verification
- Chạy dev server web (`npm run dev` trong `avatar-web/web`).
- Mở Drawer Vận hành:
  - Xác nhận không còn tab `⛏️ Khai thác` trên thanh bên / desktop bar.
  - Mở tab `Cài đặt`, xác nhận chỉ còn 2 sub-tab `🌾 Nông trại` và `🎣 Câu cá`.
- Mở tab `Trạng thái`:
  - Bấm chọn button mode `⛏️ Khai thác gỗ/đá`.
  - Bấm **"Bắt đầu"**: Xác nhận popup modal hiện lên với 3 tùy chọn: Đá, Gỗ, Cả hai.
  - Chọn một loại và bấm **"Bắt đầu khai thác"**: Xác nhận auto chuyển sang trạng thái đang chạy và hiển thị tiến độ trên dòng trạng thái.
