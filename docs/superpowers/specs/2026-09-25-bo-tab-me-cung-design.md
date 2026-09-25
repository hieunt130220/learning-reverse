# Thiết Kế: Bỏ Tab Mê Cung Khỏi Giao Diện Web Drawer

> **Ngày:** 2026-09-25  
> **Chủ đề:** `bo-tab-me-cung`  
> **Trạng thái:** Chờ User Review (User Review Gate — Bước 1/3 theo CLAUDE.md)

---

## 1. Mục Tiêu & Bối Cảnh

- **Vấn đề:** Tính năng tự động đi Mê cung (`auto_maze`) đã có thể bật/tắt và theo dõi trạng thái tiến độ thời gian thực trực tiếp từ tab `Trạng thái` (`StatusPanel.tsx`). Việc duy trì một tab riêng `🗝️ Mê cung` trên thanh menu Drawer gây chiếm dụng không gian hiển thị không cần thiết.
- **Mục tiêu:**
  - Bỏ tab `🗝️ Mê cung` khỏi danh sách điều hướng Drawer (`AccountOperationsDrawer.tsx`).
  - Xóa component `MazePanel.tsx` không còn sử dụng.
  - Cập nhật hotkey navigation trên desktop bar từ 1..7 thành 1..6.
  - Giữ nguyên chế độ tự động `auto_maze` và hiển thị trạng thái trong `StatusPanel.tsx`.

---

## 2. Phạm Vi (Scope)

### 2.1 In-Scope
1. **Frontend Navigation Clean-up:**
   - Xóa `['maze', '🗝️ Mê cung']` khỏi `PANEL_TABS`.
   - Xóa group `maze` khỏi `PANEL_GROUPS`.
   - Xóa `maze` khỏi `DESKTOP_CONSOLE_GROUPS` và đánh số lại hotkey 1..6:
     - 1: operations (Vận hành & Cài đặt)
     - 2: farm (Nông trại & Bếp)
     - 3: fishing (🎣 Câu cá)
     - 4: find_npc (🎯 Tìm NPC)
     - 5: assets (Tài sản & Sạp)
     - 6: logs (Nhật ký Log)
   - Bỏ slot render `MazePanel` trong `AccountOperationsDrawer.tsx`.
   - Xóa file `avatar-web/web/src/accounts/panels/MazePanel.tsx`.
2. **Cập nhật Unit Tests:**
   - Đảm bảo toàn bộ test suite trong `avatar-web/web` pass 100%.

### 2.2 Out-of-Scope
- Không thay đổi backend runner logic (`AutoMazeRunner`) hay SQLite schema.
- Không thay đổi mode `auto_maze` trên `StatusPanel.tsx`.

---

## 3. Thiết Kế Chi Tiết

### 3.1 Danh Sách Files Liên Quan

| File | Vai trò | Thay đổi |
| :--- | :--- | :--- |
| `avatar-web/web/src/accounts/AccountOperationsDrawer.tsx` | Drawer Console chính | Bỏ tab `maze`, group `maze`, đánh số lại hotkey 1..6, bỏ slot render `MazePanel`. |
| `avatar-web/web/src/accounts/panels/MazePanel.tsx` | Panel Mê cung cũ | **Xóa bỏ** (dead code sau khi bỏ tab). |

---

## 4. Verification Plan

1. **Automated Tests:**
   - Chạy `cd avatar-web/web && npm test -- --run` đảm bảo 11/11 file test pass 100%.
2. **Manual Verification:**
   - Mở Drawer Vận hành trên web, xác nhận không còn tab `🗝️ Mê cung`.
   - Kiểm tra tab `Trạng thái`: Nút mode `🗝️ Mê cung` vẫn bấm chọn và bắt đầu/dừng được bình thường.
