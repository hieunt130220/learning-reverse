# Tạm ẩn tab Nâng Cấp — Design Spec

## Mục tiêu & Bối cảnh

Tạm thời không hiển thị tab `🚜 Nâng Cấp` trong `QuestsPanel` vì trải nghiệm hiện tại chưa cần
cho người dùng. Dữ liệu upgrade và decoder server vẫn được giữ nguyên để không mất công sức đã
triển khai và có thể bật lại sau.

## Phạm vi

- In-scope: ẩn nút tab `upgrade` khỏi giao diện và ngăn tab này được chọn qua UI.
- Out-of-scope: xóa decoder, API field, state server hoặc dữ liệu requirements.
- Edge case: nếu state cũ đang là `upgrade`, component tự chuyển về tab mặc định `daily`.

## Thiết kế kỹ thuật

- Modify `avatar-web/web/src/accounts/panels/QuestsPanel.tsx`.
- Dùng hằng số UI nội bộ `SHOW_UPGRADE_TAB = false`.
- Chỉ render tab button và nội dung upgrade khi flag bật; giữ type/state để dễ bật lại.

## Verification Plan

- Chạy TypeScript build web.
- Mở `/accounts/2`, xác nhận không còn tab `🚜 Nâng Cấp` và các tab khác hoạt động bình thường.
