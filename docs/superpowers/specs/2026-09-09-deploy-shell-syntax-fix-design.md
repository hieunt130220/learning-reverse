# Deploy Shell Syntax Fix Design

## Mục tiêu & Bối cảnh

Workflow `Deploy to Production VPS` thất bại sau bước cài đặt `fishing-ml` với lỗi `bash: line 168: syntax error near unexpected token '('`. Commit `05ef605` đã xóa nội dung dependency check Python nhưng để lại comment, log và phần mở của lệnh `python -c` tại `.github/workflows/deploy.yml:196-198`. Dấu nháy kép không được đóng khiến Bash phân tích phần còn lại của deployment script như một chuỗi chưa hoàn chỉnh.

Mục tiêu là khôi phục cú pháp hợp lệ cho remote deployment script để workflow có thể tiếp tục từ bước cài đặt `fishing-ml` sang khởi động service.

## Phạm vi (Scope)

### In scope

- Xóa toàn bộ ba dòng dependency-check còn sót tại `.github/workflows/deploy.yml`: comment, dòng log và lệnh `python -c` không hoàn chỉnh.
- Giữ nguyên quá trình cài dependencies hiện có bằng `pip install -e "$FISHING_ROOT"`.
- Kiểm tra cú pháp YAML và cú pháp Bash của nội dung `script: |` được gửi tới VPS.

### Out of scope

- Không thay đổi dependency Python, phiên bản package, PM2 configuration hoặc health-check policy.
- Không thay đổi Captcha Solver, backend, frontend hoặc cấu hình VPS.
- Không thêm test file; việc xác minh dùng static syntax checks theo yêu cầu repository.
- Không trigger deployment production trong phạm vi thay đổi local này.

### Input, output và edge cases

- Input: workflow `.github/workflows/deploy.yml` trên nhánh được deploy.
- Output: remote Bash script parse thành công và tiếp tục thực thi `cd "$FISHING_ROOT"` sau khi cài package.
- Việc cài package thất bại vẫn dừng deployment nhờ `set -e` trong remote script.
- Việc khởi động hoặc health check service thất bại vẫn dùng error handling hiện có; không bị thay đổi bởi bản sửa.

## Thiết kế kiến trúc & Giải pháp kỹ thuật

### File liên quan

- `.github/workflows/deploy.yml`: workflow duy nhất cần chỉnh sửa; xóa đoạn lệnh mồ côi tại bước triển khai Fishing ML.

### Data contract và flow xử lý

Flow hiện tại bị lỗi:

```text
pip install fishing-ml
  -> mở lệnh python -c với dấu quote
  -> phần còn lại bị Bash đọc sai
  -> syntax error trước khi fishing-ml được khởi động
```

Flow sau sửa:

```text
pip install fishing-ml
  -> cd vào FISHING_ROOT
  -> PM2 khởi động fishing-ml
  -> health check
  -> tiếp tục deploy backend/frontend
```

Không cần thay thế dependency check: chính commit gây regression có chủ đích loại bỏ check này, và `pip install` đã là command có exit status được bảo vệ bởi `set -e`.

## Verification Plan

1. Parse `.github/workflows/deploy.yml` bằng YAML parser để xác nhận cấu trúc workflow hợp lệ.
2. Trích nguyên nội dung `with.script` của bước SSH deployment, lưu vào temporary file và chạy `bash -n` để tái hiện/kiểm tra đúng lớp cú pháp đã thất bại trên VPS.
3. Kiểm tra diff để xác nhận chỉ đoạn dependency-check mồ côi bị xóa khỏi production workflow.
4. Trước commit, chạy GitNexus change detection theo quy định repository để xác nhận blast radius chỉ nằm trong deployment workflow và tài liệu quy trình.
5. Sau khi merge/push, rerun workflow `Deploy to Production VPS`; kết quả mong đợi là không còn lỗi cú pháp tại dòng 168 và workflow tiến tới bước khởi động Fishing ML.

## Rủi ro và rollback

Rủi ro thấp vì không thay đổi runtime behavior ngoài việc loại bỏ lệnh vốn đã không thể thực thi. Nếu phát sinh regression, rollback commit sửa workflow sẽ khôi phục đúng trạng thái trước thay đổi, dù trạng thái đó vẫn chứa lỗi cú pháp đã biết.
