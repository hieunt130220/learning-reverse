# Fishing Model Review HTML Design

## Mục tiêu và bối cảnh

Model fishing Phase 2 đã có báo cáo final gồm 30 batch và 210 query. Báo cáo máy cho biết model chọn đúng 209/210 query trước lọc ngưỡng, nhưng chỉ chấp nhận 116/210 query sau lọc ngưỡng. Cần một giao diện trực quan để người vận hành xem ảnh gốc, đối chiếu lựa chọn của model với nhãn dataset, tự review lại đáp án và biết tỷ lệ nhận diện dựa trên kết quả review thủ công.

Mục tiêu là tạo một file HTML tự chứa có thể mở trực tiếp trong trình duyệt mà không cần server. File phải hiển thị đầy đủ dữ liệu final, lưu tiến độ review trong trình duyệt, tính lại các chỉ số ngay khi người dùng thay đổi đánh giá và cho phép xuất kết quả review ra JSON.

## Phạm vi

### In scope

- Tạo một trang review tại `avatar-web/fishing-ml/review/final-model-review.html`.
- Tạo script sinh trang tại `avatar-web/fishing-ml/scripts/build_final_review.py` để dữ liệu báo cáo và ảnh được đóng gói lặp lại, có kiểm tra đầu vào rõ ràng.
- Đọc nguồn dự đoán từ:
  `avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/final-evaluation.json`.
- Đọc danh sách batch final và metadata bất biến từ `frozen/dataset-snapshot.json`.
- Đọc ảnh tham chiếu `img/*.png` và ảnh query `new/*.png` từ `avatar-web/fishing-ml/data/phase2/raw/<batchId>/`.
- Nhúng ảnh dưới dạng data URL để HTML hoạt động độc lập khi được di chuyển.
- Hiển thị 30 batch và 210 query, cùng lựa chọn model, nhãn dataset, similarity, margin và trạng thái accepted/rejected.
- Cho phép người review chọn một trong sáu ảnh tham chiếu làm đáp án đúng hoặc chọn “không xác định”.
- Lưu kết quả review vào `localStorage` theo khóa gắn với model ID và SHA-256 của báo cáo final.
- Tính và hiển thị các chỉ số từ nhãn dataset và từ phần đã review thủ công.
- Lọc danh sách theo trạng thái review, tính đúng/sai của model, accepted/rejected và batch.
- Xuất kết quả review thành file JSON tải xuống từ trình duyệt.

### Out of scope

- Không retrain model, chạy lại inference hoặc tạo checkpoint mới.
- Không thay đổi model production, ngưỡng similarity/margin hoặc cấu hình deploy.
- Không ghi đè nhãn dataset hiện tại.
- Không gửi dữ liệu tới server hoặc dịch vụ bên ngoài.
- Không nhập JSON review ngược vào trang trong phiên bản này.
- Không tạo test file; xác minh bằng script build và kiểm tra thủ công theo chính sách của repo.

### Input và output

Input của script build:

- Báo cáo final schema version 1 với `split: "final"` và mảng `predictions`.
- Dataset snapshot có đúng các batch final tương ứng.
- Mỗi prediction có `batchId`, `newIndex`, `expectedImgIndex`, `predictedImgIndex`, `similarity`, `margin`, `accepted`.
- Mỗi batch có sáu ảnh tham chiếu và số query khớp các prediction của batch.

Output:

- Một file HTML UTF-8 tự chứa CSS, JavaScript, metadata, predictions và ảnh base64.
- Một file JSON khi người dùng bấm xuất, chứa metadata nguồn, thời điểm xuất và toàn bộ quyết định review.

### Edge cases

- Script build phải dừng với lỗi rõ ràng nếu thiếu báo cáo, snapshot, batch, ảnh hoặc prediction bắt buộc.
- Script phải dừng nếu có prediction trùng khóa `(batchId, newIndex)` hoặc dữ liệu final không đủ đúng 30 batch/210 query.
- Ảnh không đọc được hoặc không khớp SHA-256 trong snapshot làm build thất bại.
- Khi `localStorage` bị chặn hoặc đầy, trang vẫn cho review trong phiên hiện tại và hiển thị cảnh báo rằng tiến độ chưa được lưu.
- Dữ liệu `localStorage` sai schema hoặc thuộc báo cáo khác bị bỏ qua an toàn.
- Query được đánh dấu “không xác định” được tính là đã review nhưng không đưa vào mẫu số accuracy thủ công.
- Khi chưa review query nào, tỷ lệ thủ công hiển thị dấu gạch ngang thay vì `0%`.

## Thiết kế kiến trúc và giải pháp kỹ thuật

### Files và vai trò

- `avatar-web/fishing-ml/scripts/build_final_review.py`: kiểm tra nguồn dữ liệu, xác minh checksum ảnh, ghép prediction với batch, mã hóa ảnh và render HTML.
- `avatar-web/fishing-ml/review/final-model-review.html`: artifact đầu ra để người dùng mở và review; không phụ thuộc runtime Python sau khi đã sinh.
- `avatar-web/fishing-ml/artifacts/.../final-evaluation.json`: nguồn prediction và metrics chuẩn.
- `avatar-web/fishing-ml/artifacts/.../frozen/dataset-snapshot.json`: nguồn danh sách final, nhãn, manifest và checksum.
- `avatar-web/fishing-ml/data/phase2/raw/<batchId>/`: nguồn ảnh thực tế.

### Luồng build

```text
final-evaluation.json ─┐
                      ├─> build_final_review.py ─> final-model-review.html
dataset-snapshot.json ┤          │
raw PNG files ────────┘          └─ kiểm tra count, khóa và SHA-256
```

Script lấy model ID từ tên thư mục run và tính SHA-256 của `final-evaluation.json`. Nó chỉ chọn các snapshot batch có `split == "final"`, lập chỉ mục bằng `batchId`, sau đó ghép từng prediction bằng `(batchId, newIndex)`. Ảnh được kiểm tra theo checksum trong snapshot trước khi chuyển sang data URL `data:image/png;base64,...`.

Dữ liệu nhúng trong HTML là JSON đã escape an toàn để không đóng thẻ script ngoài ý muốn. HTML không fetch file cục bộ và không cần quyền CORS.

### Giao diện review

Phần đầu trang hiển thị model ID, dấu vân tay báo cáo, tiến độ review và các thẻ metric. Danh sách phía dưới nhóm theo batch. Mỗi query card gồm:

- Ảnh query ở kích thước lớn.
- Sáu ảnh tham chiếu được đánh số 0–5.
- Viền riêng cho lựa chọn của model, nhãn dataset và lựa chọn thủ công.
- Các badge `model đúng/sai`, `accepted/rejected`.
- Giá trị similarity và margin.
- Nút chọn ảnh tham chiếu, “không xác định” và “xóa review”.

Màu sắc sử dụng kèm chữ và biểu tượng để trạng thái không phụ thuộc riêng vào màu. Trang hỗ trợ màn hình desktop và co về một cột trên màn hình hẹp.

### Data contract của review

Mỗi quyết định review trong trình duyệt có dạng:

```json
{
  "batchId": "crawl_...",
  "newIndex": 0,
  "reviewedImgIndex": 3,
  "reviewedAt": "2026-09-12T12:00:00.000Z"
}
```

`reviewedImgIndex` nhận số nguyên 0–5 hoặc `null` cho “không xác định”. Khóa định danh query là chuỗi ghép `batchId:newIndex`. Payload xuất JSON gồm:

```json
{
  "schemaVersion": 1,
  "modelId": "p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01",
  "sourceReportSha256": "<64 hex>",
  "exportedAt": "<ISO-8601>",
  "summary": {},
  "reviews": []
}
```

### Cách tính chỉ số

- `Dataset top-1 accuracy` = số prediction có `predictedImgIndex == expectedImgIndex` / 210.
- `Dataset batch exact match` = số batch mà mọi prediction đều khớp `expectedImgIndex` / 30.
- `Acceptance rate` = số prediction có `accepted == true` / 210.
- `Accepted accuracy theo dataset` = số prediction accepted và khớp nhãn / tổng prediction accepted.
- `Manual reviewed` = số query có bản ghi review, gồm cả “không xác định”.
- `Manual comparable` = số query có `reviewedImgIndex` là 0–5.
- `Manual top-1 accuracy` = số query comparable mà `predictedImgIndex == reviewedImgIndex` / manual comparable.
- `Manual accepted accuracy` = số query comparable và accepted mà model khớp review / tổng query comparable và accepted.
- `Label disagreement` = số query comparable mà `reviewedImgIndex != expectedImgIndex`.

Trang phải ghi rõ mẫu số cạnh từng tỷ lệ để tránh hiểu nhầm tỷ lệ trên phần đã review là tỷ lệ của toàn bộ 210 query.

### Lưu trạng thái

Khóa `localStorage` có dạng:

```text
fishing-model-review:v1:<modelId>:<sourceReportSha256>
```

Mỗi thay đổi được lưu ngay. Nút “xóa toàn bộ review” phải yêu cầu xác nhận trong giao diện vì thao tác này làm mất tiến độ trong trình duyệt. Nút xuất JSON không thay đổi dữ liệu nguồn.

## Verification Plan

### Build verification

Chạy:

```bash
cd avatar-web/fishing-ml
.venv/bin/python scripts/build_final_review.py
```

Kỳ vọng:

- Exit code `0`.
- Báo `30 batches`, `210 queries`, `209 correct`, `116 accepted`.
- File `review/final-model-review.html` được tạo và không chứa placeholder.
- Tất cả ảnh đã được xác minh checksum trước khi nhúng.

### Static verification

- Kiểm tra HTML chứa đúng model ID và SHA-256 nguồn.
- Kiểm tra dữ liệu nhúng có 30 batch, 210 query và sáu reference trên mỗi batch.
- Kiểm tra không có URL mạng ngoài hoặc yêu cầu fetch dữ liệu cục bộ.
- Kiểm tra dataset metrics render thành 99,52% top-1, 96,67% batch exact và 55,24% acceptance.

### Manual browser verification

- Mở HTML trực tiếp và xác nhận toàn bộ ảnh hiển thị.
- Chọn đáp án cho một query và xác nhận tiến độ cùng tỷ lệ manual cập nhật ngay.
- Reload trang và xác nhận quyết định được khôi phục.
- Thử các bộ lọc chưa review, sai, rejected và theo batch.
- Đánh dấu “không xác định” và xác nhận query không nằm trong mẫu số manual accuracy.
- Xuất JSON và xác nhận metadata, summary và reviews khớp giao diện.
- Xóa một review và xóa toàn bộ review để xác nhận bộ đếm cập nhật đúng.

## Tiêu chí hoàn thành

- Người dùng mở được một file HTML duy nhất và review đủ 210 query bằng ảnh thực tế.
- Các chỉ số ban đầu khớp chính xác báo cáo final hiện có.
- Kết quả review thủ công được lưu, khôi phục và xuất JSON.
- Trang không sửa model, nhãn dataset hay artifact đánh giá nguồn.
