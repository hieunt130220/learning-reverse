# Lưới vật nuôi theo IDDB

## Mục tiêu & Bối cảnh

Phần Vật nuôi hiện dùng danh sách văn bản có thanh cuộn, khó đối chiếu từng IDDB. Chuyển sang lưới ô đồng nhất với phần cây: mỗi vật nuôi chiếm một ô và có thể chọn để xem chi tiết.

## Phạm vi

### In-scope

- Hiển thị mỗi vật nuôi trong một ô lưới theo `FarmAnimal.index` (IDDB).
- Hiển thị số IDDB và tên loài ngay trên ô.
- Phân biệt trực quan trạng thái đói, bệnh và sẵn sàng thu hoạch.
- Bấm ô để xem chi tiết máu, tiến độ thu hoạch, số sản phẩm và bệnh.
- Giữ nguyên dữ liệu và API hiện có.

### Out-of-scope

- Không thêm hành động cho ăn, chữa bệnh, thu hoạch hoặc bán.
- Không đoán tổng số slot trống khi packet chưa cung cấp capacity đáng tin cậy.
- Không thay đổi decoder farm/animal.

## Thiết kế kỹ thuật

- Sửa `AnimalSection` trong `avatar-web/web/src/accounts/panels/AssetsPanel.tsx`.
- Tái sử dụng class lưới `.grid` và cấu trúc `.cell` của phần cây để giao diện nhất quán.
- Mỗi ô dùng class trạng thái:
  - `care`: đói, cúm hoặc tiêu chảy.
  - `ready`: `harvestPer > 0` hoặc `numEggOne > 0`.
  - `sel`: ô đang được chọn.
- Chi tiết được hiển thị trong `.cell-detail` bên dưới lưới.
- Accessibility: mỗi ô là button với `title`/nội dung chứa IDDB, tên và trạng thái.

## Edge cases

- Catalog chưa tải: dùng `#species` làm tên.
- Nhiều trạng thái cùng lúc: ưu tiên class `care`, nhưng chi tiết liệt kê đầy đủ.
- Không có vật nuôi: giữ hành vi không render section.
- IDDB không liên tục: giữ đúng index từ packet, không dồn lại.

## Verification Plan

- Chạy GitNexus impact cho `AnimalSection`/`AssetsPanel` trước khi sửa.
- Chạy web build và `git diff --check`.
- Kiểm tra `/accounts/2`: 12 vật nuôi thành 12 ô, đúng IDDB và tên; bấm một ô hiển thị chi tiết.
- Chạy `gitnexus_detect_changes` để xác nhận phạm vi.
