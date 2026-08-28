# Fishing Image Matching ML — Design Document

- **Ngày:** 2026-08-27
- **Trạng thái:** Chờ user duyệt
- **Nguồn protocol:** `avatar-re/notes/fishing.md`
- **Phạm vi tài liệu:** Thu thập, gán nhãn, huấn luyện và đánh giá offline model ghép `arrImgNew` với `arrImg` trong RX79. Chưa tự động gửi TX43.

## 1. Mục tiêu & Bối cảnh

RX79 `CAN_CAU` gửi hai tập PNG 75×75 có nền và nhiễu ngẫu nhiên:

- `arrImg`: tập ảnh mẫu của batch hiện tại.
- `arrImgNew`: chuỗi ảnh cần ghép về các mẫu trong `arrImg`.

Đây không phải bài toán nhận dạng mũi tên hay phân loại class cố định. Mỗi phần tử
`arrImgNew` phải được ghép với một phần tử `arrImg` trong cùng batch; nhiều ảnh `new` có
thể cùng khớp một ảnh mẫu. Chỉ số như `img1` không mang ý nghĩa ổn định giữa các batch.

Batch probe đã phân tích có 6 `arrImg`, 5 `arrImgNew` và ánh xạ thủ công dự kiến:

```text
new0 → img1
new1 → img4
new2 → img2
new3 → img1
new4 → img4
```

Các metric pixel thủ công cho kết quả ban đầu phù hợp nhưng chưa đủ tin cậy trước nền
nhiễu thay đổi. Mục tiêu của thay đổi này là xây pipeline Python có ground truth do người
gán nhãn, huấn luyện model metric-learning và chứng minh chất lượng bằng đánh giá offline
trước khi tích hợp vào luồng câu cá live.

## 2. Phạm vi (Scope)

### 2.1 In-scope — Giai đoạn A

- Chuẩn hóa cách lưu nguyên bản mỗi RX79 thành một batch dataset độc lập.
- Import các batch PNG đã capture mà không làm thay đổi blob nguồn.
- Công cụ Python cục bộ để người dùng gán mỗi `arrImgNew` về một `arrImg`.
- Kiểm tra schema, tính đầy đủ và tính hợp lệ của label.
- Dataset ban đầu gồm 200 batch, tối thiểu 1.000 cặp đã gán nhãn.
- Split cố định theo batch: 140 train, 30 development validation, 30 final validation.
- Baseline không học máy để có mốc so sánh.
- Shared CNN encoder huấn luyện episodic để xếp hạng mẫu trong từng batch.
- Confidence calibration và khả năng từ chối dự đoán không chắc chắn.
- Báo cáo metrics, checksum, cấu hình và artifact đủ để tái lập run.
- Định nghĩa contract cho Python inference service dùng ở giai đoạn sau.

### 2.2 Out-of-scope

- Không tự động gửi TX43 từ kết quả model.
- Không xác định trong tài liệu này phép biến đổi `imgIndex → byte TX43`.
- Không triển khai vòng lặp auto-fishing, UI hoặc persistence automation.
- Không triển khai production inference service trong Giai đoạn A.
- Không nối Python service vào `avatar-web` trong Giai đoạn A.
- Không dùng arrow OCR/classifier hoặc giả định ảnh biểu diễn hướng.
- Không dùng pseudo-label từ matcher cũ làm ground truth mặc định.
- Không viết test files trừ khi user yêu cầu trực tiếp; verification dùng scripts kiểm tra,
  báo cáo training và chạy thủ công sau production code.
- Ao cá trong nông trại (`FishFarm`, cmd 81) không thuộc hệ thống này.

### 2.3 Input, output và edge cases

**Input:** Một RX79 batch có ít nhất một PNG trong `arrImg` và một PNG trong
`arrImgNew`. Số lượng hai tập được phép khác nhau.

**Ground-truth output:** Với mỗi `newIndex`, đúng một `imgIndex` thuộc cùng batch.
Không bắt buộc mọi `imgIndex` được dùng; nhiều `newIndex` được phép dùng cùng một
`imgIndex`.

**Model output:** Với mỗi `newIndex`, trả `imgIndex` top-1, similarity, margin giữa top-1
và top-2, cùng cờ accepted/rejected.

Edge cases phải xử lý:

- RX79 legacy không có `arrImgNew`: lưu raw batch nếu cần điều tra nhưng không đưa vào
  dataset huấn luyện.
- Batch rỗng, thiếu file, PNG hỏng hoặc kích thước sai: từ chối và ghi reason.
- Số lượng `arrImg`/`arrImgNew` biến đổi giữa batch.
- Chỉ có một ảnh mẫu: không có top-2 margin; chỉ áp dụng minimum similarity.
- Nhiều `new` cùng trỏ tới một mẫu: hợp lệ, không dùng Hungarian/one-to-one assignment.
- Người gán nhãn không chắc chắn: đánh dấu batch ambiguous, không đưa vào split.
- Blob trùng byte giữa các batch: báo để kiểm tra leakage, không âm thầm tiếp tục.

## 3. Kiến thức Protocol và Ràng buộc Đã Xác minh

### 3.1 RX79 CAN_CAU

```text
i32  idUser
i16  idFish
i16  timeDelay
i8   n
n × { i32 len; len byte }        // arrImg
if available() >= 1:
    i8 m
    m × { i32 len; len byte }    // arrImgNew
else:
    arrImgNew = null
```

Các blob là PNG thật được native client decode bằng `Image.createImage(byte[])`. Capture
live cho thấy ảnh 75×75 RGBA, nền/nhiễu random và whole-file hash không tái sử dụng ổn
định. Khối `arrImgNew` là optional theo wire decoder; khi có, số lượng không bắt buộc bằng
`arrImg`.

### 3.2 TX43 chưa được giải quyết

TX43 có body:

```text
bool true
i8   length
length × i8 value
```

Native analysis cho thấy `FishingScr.listKeySend` liên quan các giá trị `{50, 52, 54}`.
Tuy nhiên chưa có bằng chứng rằng kết quả `[imgIndex...]` được gửi trực tiếp, hoặc cách
mỗi ảnh mẫu ánh xạ sang byte TX43. Vì vậy Giai đoạn A kết thúc ở matching offline; không
được suy đoán và gửi TX43.

### 3.3 Bối cảnh map và vật phẩm

- Map 14, area 0, tọa độ `(254,82)` là khu cá rô đã live-verify: RX45 `iss=true`.
- Vật phẩm câu cá trong rương cá nhân cmd `-87` được game tự tính; không cần rút ra.
- Map 27 là khu bến tàu đặc biệt và yêu cầu vé riêng.

Những thông tin này phục vụ capture dataset; training không phụ thuộc map hoặc inventory.
Dataset manifest có thể lưu map/area như metadata nhưng model không được dùng chúng làm
feature.

## 4. Kiến trúc & Giải pháp Kỹ thuật

### 4.1 Thành phần và ranh giới

```text
RX79 capture
    │ raw PNG + manifest
    ▼
Dataset importer ──► Manual labeling tool
    │                     │ labels
    └──────────────┬──────┘
                   ▼
             Dataset validator
                   │ fixed train/dev/final splits
                   ▼
       Classical baselines + ML training
                   │
                   ▼
       Offline evaluator + run artifacts

Future only:
model artifact ─► Python inference service ─► avatar-web shadow mode
```

Mỗi thành phần có trách nhiệm riêng:

1. **Capture/import:** bảo toàn dữ liệu nguồn và metadata.
2. **Labeling:** chỉ thu nhận quyết định của người gán nhãn.
3. **Validation/split:** ngăn schema lỗi và data leakage.
4. **Training:** học embedding chung cho mẫu và query.
5. **Evaluation:** khóa model/threshold trước khi mở final split.
6. **Inference service:** contract được thiết kế trước, implementation để giai đoạn sau.

### 4.2 Files/modules dự kiến

Tên file cuối cùng có thể được điều chỉnh trong Implementation Plan theo cấu trúc repo,
nhưng trách nhiệm module không được trộn lẫn.

| Path dự kiến | Vai trò | Giai đoạn |
|---|---|---|
| `avatar-web/fishing-ml/pyproject.toml` | Python package và dependency khóa phiên bản | A |
| `avatar-web/fishing-ml/src/fishing_ml/schema.py` | Manifest/label schema và validation | A |
| `avatar-web/fishing-ml/src/fishing_ml/import_data.py` | Import batch capture vào dataset raw | A |
| `avatar-web/fishing-ml/src/fishing_ml/label.py` | Công cụ gán nhãn thủ công cục bộ | A |
| `avatar-web/fishing-ml/src/fishing_ml/split.py` | Tạo và kiểm tra split cố định theo batch | A |
| `avatar-web/fishing-ml/src/fishing_ml/dataset.py` | Episodic dataset loader | A |
| `avatar-web/fishing-ml/src/fishing_ml/baselines.py` | Binary shape, SSIM/NCC baseline | A |
| `avatar-web/fishing-ml/src/fishing_ml/model.py` | Shared CNN encoder và similarity matrix | A |
| `avatar-web/fishing-ml/src/fishing_ml/train.py` | Training và checkpoint selection trên dev | A |
| `avatar-web/fishing-ml/src/fishing_ml/evaluate.py` | Dev/final metrics và artifact report | A |
| `avatar-web/fishing-ml/config/` | Cấu hình dataset/model/run đã version hóa | A |
| `avatar-web/fishing-ml/data/` | Raw batches, labels và split manifests; ảnh lớn không mặc định commit | A |
| `avatar-web/fishing-ml/artifacts/` | Model/report theo run; policy commit quyết định trong Plan | A |
| `avatar-web/fishing-ml/src/fishing_ml/service.py` | HTTP inference contract implementation | B |
| `avatar-web/server/src/game/` integration | Gọi service ở shadow mode | B |

Giai đoạn A không sửa hành vi production của `fishingService.ts`, `client.ts`,
`avatarSession.ts` hoặc route gửi TX43.

### 4.3 Dataset layout và contracts

```text
avatar-web/fishing-ml/data/
├── raw/
│   └── <batch-id>/
│       ├── manifest.json
│       ├── img/
│       │   ├── 0.png
│       │   └── ...
│       └── new/
│           ├── 0.png
│           └── ...
├── labels/
│   └── <batch-id>.json
└── splits/
    ├── train.txt
    ├── dev.txt
    └── final.txt
```

Manifest schema version 1:

```json
{
  "schemaVersion": 1,
  "batchId": "probe_1787812245916",
  "capturedAt": "2026-08-27T00:00:00Z",
  "idFish": 449,
  "timeDelayMs": 500,
  "map": 14,
  "area": 0,
  "images": [
    { "index": 0, "path": "img/0.png", "sha256": "..." }
  ],
  "imagesNew": [
    { "index": 0, "path": "new/0.png", "sha256": "..." }
  ]
}
```

Label schema version 1:

```json
{
  "schemaVersion": 1,
  "batchId": "probe_1787812245916",
  "matches": [
    { "newIndex": 0, "imgIndex": 1 },
    { "newIndex": 1, "imgIndex": 4 },
    { "newIndex": 2, "imgIndex": 2 },
    { "newIndex": 3, "imgIndex": 1 },
    { "newIndex": 4, "imgIndex": 4 }
  ]
}
```

Validation rules:

- `batchId` giữa manifest và label phải trùng.
- Index liên tục từ 0 theo file hiện hữu.
- Mỗi `newIndex` xuất hiện đúng một lần trong label hoàn chỉnh.
- `imgIndex` nằm trong phạm vi `images` của cùng batch.
- Mỗi file phải decode được, đúng 75×75 và checksum đúng manifest.
- Label không được chứa đáp án do baseline tự chèn mặc định.

### 4.4 Công cụ gán nhãn thủ công

Ứng dụng Python cục bộ hiển thị một batch mỗi lần:

- Hàng ảnh mẫu chứa toàn bộ `arrImg`, có chỉ số rõ ràng.
- Ảnh `arrImgNew` hiện tại được hiển thị riêng để người dùng chọn mẫu.
- Cho phép nhiều `new` chọn cùng một `img`.
- Có Previous/Next, sửa lựa chọn, tiến độ batch và trạng thái chưa hoàn tất.
- Có lựa chọn `ambiguous` để loại batch khỏi training thay vì ép nhãn.
- Chỉ ghi label hoàn chỉnh khi mọi `new` đã được chọn.
- Ghi file atomically để tránh label dở dang nếu process dừng.

Matcher cổ điển có thể được hiển thị trong chế độ phân tích riêng sau khi đã có label,
nhưng không preselect đáp án trong luồng gán nhãn ban đầu nhằm tránh confirmation bias.

### 4.5 Chia dataset

Dataset mục tiêu ban đầu:

- Train: 140 batch.
- Development validation: 30 batch.
- Final validation: 30 batch.
- Tổng tối thiểu: 200 batch và 1.000 labeled `new` images.

Split được tạo một lần với seed cố định, lưu thành file và không tái tạo mỗi run. Toàn bộ
ảnh của một batch luôn nằm cùng partition. Validator phải thất bại nếu:

- Một batch xuất hiện trong nhiều split.
- Split tham chiếu batch thiếu hoặc ambiguous.
- Checksum blob giống nhau xuất hiện xuyên partition mà chưa được review.
- Training loader cố mở final split.

Final split không được dùng để chọn architecture, hyperparameter, checkpoint hoặc
confidence threshold.

### 4.6 Tiền xử lý và augmentation

- Decode PNG thành RGB `float32`.
- Giữ input 75×75; không crop vùng cố định.
- Chuẩn hóa bằng thống kê chỉ tính từ train split.
- Augmentation chỉ áp dụng cho train: thay đổi sáng/tương phản nhỏ, nhiễu màu nhẹ,
  translation vài pixel và scale nhỏ quanh tâm.
- Không flip/rotate khi chưa chứng minh các phép này bảo toàn danh tính mẫu.
- Không bắt buộc thuật toán tách nền thủ công; encoder học đặc trưng từ dữ liệu.
- Baseline cổ điển được phép dùng grayscale, threshold hoặc connected components để làm
  mốc, nhưng preprocessing baseline không trở thành ground truth.

### 4.7 Model

Model là shared Siamese-style encoder được huấn luyện theo episode:

```text
arrImg ─────► shared CNN ─► L2-normalized reference embeddings ┐
                                                                ├► cosine similarity matrix
arrImgNew ──► shared CNN ─► L2-normalized query embeddings ─────┘
```

Baseline architecture:

- 3–4 convolution blocks.
- Batch normalization hoặc group normalization.
- Global average pooling.
- Embedding 64–128 chiều.
- Không dùng backbone lớn trước khi encoder nhỏ được đánh giá.

Với ma trận similarity `[newCount, imgCount]`, loss chính là:

```text
cross_entropy(similarity / temperature, target_img_index)
```

Các mẫu sai trong cùng batch là negative candidates tự nhiên. Objective tối ưu top-1
trong batch, không áp đặt one-to-one assignment. Episodic loader dùng mask/padding hoặc
xử lý từng episode để hỗ trợ kích thước batch biến đổi.

### 4.8 Training và model selection

Quy trình bắt buộc:

1. Chạy baseline binary-shape hiện có và ít nhất một metric chuẩn như SSIM hoặc normalized
   cross-correlation trên cùng split.
2. Train CNN baseline từ đầu bằng seed cố định.
3. Chỉ dùng train/dev để điều chỉnh embedding dimension, temperature, learning rate,
   augmentation và thresholds.
4. Chọn checkpoint theo dev metrics đã khai báo trong config.
5. Calibrate hai ngưỡng trên dev:
   - minimum top-1 similarity;
   - minimum top-1/top-2 margin.
6. Khóa code revision, checkpoint, config và thresholds.
7. Chạy final evaluation đúng một lần.

Nếu thay đổi model hoặc threshold dựa trên lỗi nhìn thấy ở final split, final split đó không
còn kín và phải được thay bằng một tập mới chưa từng dùng.

### 4.9 Metrics và tiêu chí thành công

Báo cáo gồm:

- Top-1 accuracy theo từng `new`.
- Số lỗi tuyệt đối.
- Batch exact-match rate.
- Số batch giải hoàn toàn đúng.
- Top-1 similarity distribution.
- Top-1/top-2 margin distribution.
- Abstention rate tại thresholds đã khóa.
- Accuracy trên các dự đoán accepted.
- Metrics theo số lượng `img` và `new`.
- Phân bố prediction theo `imgIndex` để phát hiện positional bias.
- So sánh trực tiếp với classical baselines.

Tiêu chí offline do user chọn:

```text
Top-1 accuracy trên final validation ≥ 99%
Số prediction sai trên final validation = 0
```

Cả hai điều kiện phải đồng thời đúng. Vì 30 final batches có thể chưa cung cấp sample size
đủ lớn để suy luận production reliability, pass này chỉ xác nhận feasibility. Trước khi
auto-submit, Giai đoạn B phải mở rộng đánh giá live shadow mode.

Một prediction được accepted chỉ khi vượt cả minimum similarity và, khi có ít nhất hai
mẫu, minimum margin. Batch chỉ có thể `allAccepted=true` nếu mọi `new` accepted.

### 4.10 Run artifacts và reproducibility

```text
artifacts/<run-id>/
├── model.pt
├── model-config.json
├── thresholds.json
├── metrics.json
├── split-checksums.json
└── training-history.json
```

Mỗi run phải ghi:

- Dataset snapshot/checksums.
- Nội dung split.
- Hyperparameters và seed.
- Phiên bản Python, PyTorch và dependencies.
- Git revision của training code.
- Checksum checkpoint.
- Train/dev metrics và final metrics nếu final đã được mở.

Credentials, cookie, account password và full packet logs chứa dữ liệu không liên quan
không được ghi vào dataset hoặc artifact.

## 5. Contract Python Inference Service — Giai đoạn B

Service chạy thường trú cùng avatar-web, nhưng không được triển khai trong Plan Giai đoạn
A. Contract dự kiến:

```http
POST /v1/fishing/match
Content-Type: application/json
```

Request:

```json
{
  "requestId": "rx79-unique-id",
  "images": ["<base64 PNG>"],
  "imagesNew": ["<base64 PNG>"]
}
```

Response:

```json
{
  "modelVersion": "sha256:model-checksum",
  "matches": [
    {
      "newIndex": 0,
      "imgIndex": 1,
      "similarity": 0.97,
      "margin": 0.18,
      "accepted": true
    }
  ],
  "allAccepted": true
}
```

Boundary validation:

- Từ chối tập rỗng, số ảnh vượt limit hoặc base64 không hợp lệ.
- Từ chối blob không phải PNG, sai kích thước hoặc vượt resource limit.
- Không khởi động nếu artifact/checksum/config không khớp.
- Từ chối output index ngoài phạm vi, `NaN` hoặc confidence bất thường.
- Không log base64; chỉ log request ID, counts, latency, model version và indices.

Failure behavior khi tích hợp live:

- Timeout, service error hoặc `allAccepted=false` ⇒ không tự động gửi TX43.
- Batch thất bại được lưu để gán nhãn bổ sung.
- Không fallback sang arrow classifier.
- Classical matcher chỉ được chạy để so sánh trong shadow mode.

RX79 live có thể có `timeDelay=500ms`, vì vậy Giai đoạn B phải benchmark end-to-end
latency trước khi dùng HTTP JSON/base64. Nếu không đạt ngân sách, tối ưu có đo lường bằng
multipart/binary payload, Unix domain socket hoặc export ONNX; không chọn trước khi có số
đo.

## 6. Data Flow theo Giai đoạn

### Giai đoạn A — Plan đầu tiên

```text
capture RX79 batches
  → import raw PNG + manifest
  → manual labeling
  → validate 200 completed batches
  → freeze 140/30/30 splits
  → run classical baselines
  → train/tune on train+dev
  → lock checkpoint and thresholds
  → run final evaluation once
  → publish reproducible report
```

Không có cạnh nào từ model trở lại `FishingService.finishFishing()` trong giai đoạn này.

### Giai đoạn B — Spec/Plan sau khi A đạt tiêu chí

```text
model artifact
  → resident Python inference service
  → avatar-web sends RX79 images
  → service predicts mapping
  → avatar-web logs result in shadow mode
  → compare latency/confidence/disagreement with manual labels
```

Shadow mode không gửi TX43 dựa trên model.

### Giai đoạn C — Spec/Plan riêng

- Reverse và live-verify `imgIndex → TX43 byte`.
- Chỉ submit nếu mọi prediction accepted.
- Thành công được xác nhận bằng RX43 `idFish > 0`.
- Có kill switch và fallback về không tự động, không fallback sang đoán.

## 7. Error Handling và Safety Guards

| Tình huống | Hành vi bắt buộc |
|---|---|
| PNG hỏng/sai kích thước | Loại batch, ghi reason; không sửa ảnh âm thầm |
| Label thiếu/trùng `newIndex` | Validator fail |
| Label chỉ tới `imgIndex` ngoài phạm vi | Validator fail |
| Batch ambiguous | Loại khỏi splits |
| Leakage giữa split | Dừng training |
| Final split bị dùng trong tuning | Run không hợp lệ |
| Similarity/margin thấp | Abstain |
| Service timeout/lỗi | Không gửi TX43 |
| Model/checksum mismatch | Service không healthy |
| Chưa biết encoding TX43 | Không suy đoán từ `imgIndex` |

## 8. Verification Plan

Project không dùng TDD và không tạo test files nếu user không yêu cầu. Sau khi production
code của Giai đoạn A được viết, verification thực hiện bằng các command/script chức năng
được mô tả trong Implementation Plan.

### 8.1 Dataset và labeling

- Import batch probe hiện tại và xác nhận manifest có 6 `img`, 5 `new`.
- Gán mapping `[1,4,2,1,4]`, đóng/mở lại tool và xác nhận label giữ nguyên.
- Gán hai `new` về cùng một `img` để xác nhận many-to-one hợp lệ.
- Thử label thiếu, index ngoài phạm vi, PNG hỏng và checksum sai; validator phải fail.
- Đánh dấu ambiguous; batch không được xuất hiện trong split.

### 8.2 Split integrity

- Dataset đạt đúng 200 completed batches và tối thiểu 1.000 labeled pairs trước khi freeze.
- Xác nhận counts 140/30/30.
- Xác nhận intersection giữa ba tập rỗng.
- Xác nhận toàn bộ file của một batch thuộc cùng split.
- Kiểm tra duplicate checksum xuyên split và review mọi cảnh báo.

### 8.3 Training

- Chạy classical baselines và lưu metrics.
- Chạy CNN bằng seed/config cố định, sinh đủ run artifacts.
- Chạy lại cùng snapshot/config để xác nhận kết quả nằm trong dung sai xác định trong Plan.
- Kiểm tra loader xử lý được batch có số `img/new` khác nhau.
- Kiểm tra prediction distribution không biểu hiện bias bất thường theo `imgIndex`.

### 8.4 Final gate

Trước khi mở final split, ghi và checksum:

- model checkpoint;
- model config;
- thresholds;
- split manifests;
- code revision.

Final evaluator chạy một lần và phải báo đầy đủ cả accepted lẫn abstained predictions.
Giai đoạn A đạt khi top-1 ≥99% và không có prediction sai trên final validation. Nếu điều
kiện không đạt, không tích hợp live; quay lại thu thập/gán nhãn và tạo final split mới theo
quy tắc không leakage.

## 9. Rủi ro và Biện pháp

| Rủi ro | Ảnh hưởng | Biện pháp |
|---|---|---|
| Ground truth sai | Model học mapping sai | Gán nhãn thủ công, cho phép ambiguous, review batch khó |
| Pseudo-label bias | Model chỉ sao chép lỗi metric | Không preselect bằng baseline trong labeling flow |
| Dataset nhỏ | Overfit, 99% không tổng quát | Encoder nhỏ, split theo batch, shadow mode trước production |
| Leakage cùng batch/nền | Accuracy ảo | Split theo batch, checksum duplicate guard |
| Positional bias | Model học `imgIndex` thay vì hình | Randomize reference order trong train và báo cáo bias |
| Nhiễu live khác train | Confidence giả | Abstention thresholds và active collection ở Giai đoạn B |
| HTTP vượt 500ms | Lỡ thời hạn mini-game | Benchmark; tối ưu transport chỉ dựa trên số đo |
| Mapping image→TX43 chưa biết | Submit sai dù matcher đúng | Tách thành Giai đoạn C, yêu cầu live verification |
| Zero-error trên mẫu nhỏ | Đánh giá quá lạc quan | Xem là feasibility pass, bắt buộc shadow mode mở rộng |

## 10. User Review Gate

Sau khi user duyệt file Spec này mới tạo:

```text
docs/superpowers/plans/2026-08-27-fishing-image-matching-ml.md
```

Plan đầu tiên chỉ bao phủ Giai đoạn A. Giai đoạn B và C cần Spec/Plan riêng sau khi có kết
quả đo thực tế; không được ghép production auto-submit vào implementation hiện tại.

