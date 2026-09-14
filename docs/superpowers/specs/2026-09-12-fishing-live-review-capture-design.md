# Fishing Live Review Capture Design

## Mục tiêu và bối cảnh

Trang `final-model-review.html` hiện chỉ review được tập final đóng băng gồm 30 batch và 210 query. Người dùng muốn bật Auto câu cá trên web local, thu thập dữ liệu thực tế mới trong lúc hệ thống tự câu, rồi review trực quan tỷ lệ nhận diện của model trên dữ liệu vừa phát sinh.

Mục tiêu là bổ sung một chế độ capture dành riêng cho review local. Người dùng bắt đầu và dừng capture ngay trên giao diện web. Backend ghi đúng payload RX79 và response inference đã dùng cho quyết định auto, tự dừng khi đủ 100 batch, rồi sinh một HTML tự chứa để review thủ công. Dữ liệu capture không được nhập vào train/dev/final và chức năng phải bị vô hiệu hóa trong production.

## Phạm vi

### In scope

- Thêm cụm điều khiển capture trong phần Auto câu cá của tài khoản đang chọn.
- Cho phép bắt đầu một phiên capture với giới hạn cố định 100 batch.
- Cho phép xem trạng thái và tiến độ capture.
- Cho phép dừng sớm; phiên có ít nhất một batch vẫn được đóng và sinh report.
- Ghi payload RX79 cùng response inference của chính lần auto-decision tương ứng.
- Tự dừng sau khi lưu thành công batch thứ 100.
- Lưu dữ liệu dưới một root local riêng, mặc định trong `avatar-web/server/data/fishing-review-captures/`.
- Sinh HTML tự chứa cho từng phiên và cung cấp URL local để mở từ web.
- Tái sử dụng cách hiển thị và logic review của `final-model-review.html`: ảnh query, sáu reference, model choice, similarity, margin, accepted/rejected, lựa chọn thủ công, metrics, filter, `localStorage` và export JSON.
- Chặn toàn bộ API capture khi `NODE_ENV=production`.

### Out of scope

- Không tự điều khiển Auto câu cá; người dùng tự bật tính năng hiện có.
- Không thay đổi model, checkpoint, threshold hoặc thuật toán auto-decision.
- Không gán nhãn tự động và không dùng kết quả câu thành công/thất bại làm ground truth.
- Không nhập dữ liệu capture vào corpus Phase 2 hoặc bất kỳ split train/dev/final nào.
- Không đồng bộ report lên production hoặc dịch vụ bên ngoài.
- Không hỗ trợ nhiều phiên capture đồng thời cho cùng một tài khoản.
- Không tạo test file mới vì user không yêu cầu; chỉ chạy các test hiện có và xác minh thủ công.

### Người dùng và ranh giới tài khoản

Capture gắn với account ID trong route đã được xác thực và qua `requireOwnedAccount`. Mỗi tài khoản có tối đa một phiên đang `capturing` hoặc `sealing`. Các tài khoản khác nhau có thể capture độc lập. Người dùng chỉ xem hoặc điều khiển phiên của tài khoản mình sở hữu.

## Luồng người dùng

1. Người dùng chạy backend, fishing-ml và web ở local, đăng nhập và kết nối tài khoản game.
2. Trong phần Auto câu cá, người dùng bấm **Bắt đầu thu thập**.
3. Backend tạo session ID và chuyển trạng thái sang `capturing`.
4. Người dùng bật Auto câu cá như bình thường.
5. Mỗi RX79 được auto-decision xử lý sẽ ghi thêm một review batch sau khi inference trả về.
6. Web hiển thị tiến độ `savedBatchCount/100`, số batch lỗi và thời điểm bắt đầu.
7. Khi đủ 100 batch, backend tự chuyển sang `sealing`, sinh manifest và HTML, rồi trả trạng thái `ready`.
8. Người dùng có thể bấm **Dừng và tạo trang review** trước mốc 100. Nếu chưa có batch nào, backend từ chối đóng phiên với thông báo rõ ràng.
9. Khi trạng thái `ready`, web hiển thị nút **Mở trang review**.

## Thiết kế kiến trúc và giải pháp kỹ thuật

### Components và files

- `avatar-web/server/src/fishing/liveReviewCapture.ts` — quản lý vòng đời phiên, ghi batch theo hàng đợi tuần tự, đóng manifest và gọi report builder.
- `avatar-web/server/src/fishing/liveReviewCaptureRoutes.ts` — API start/status/stop/report, auth và ownership.
- `avatar-web/server/src/session/avatarSession.ts` — tại đúng callback inference của auto fishing, gửi payload và kết quả cho registry nếu account đang capture.
- `avatar-web/server/src/config.ts` — cấu hình capture root local; cấm bật trong production.
- `avatar-web/server/src/app.ts` — khởi tạo registry, mount routes và phục vụ report HTML qua route đã xác thực.
- `avatar-web/web/src/accounts/panels/LiveReviewCaptureCard.tsx` — cụm nút, progress, polling và link report.
- `avatar-web/web/src/accounts/panels/FishingPanel.tsx` — mount `LiveReviewCaptureCard` trong tab Câu cá của tài khoản đang chọn.
- `avatar-web/web/src/api.ts` — tái sử dụng các helper HTTP hiện có; chỉ sửa nếu thiếu helper GET/POST cần thiết.
- `avatar-web/fishing-ml/scripts/build_live_review.py` — đọc session manifest và sinh HTML tự chứa.
- `avatar-web/fishing-ml/scripts/build_final_review.py` — tách hoặc tái sử dụng phần render chung nếu impact analysis cho thấy việc tách không làm thay đổi report final hiện tại.

### Data flow

```text
RX79 payload
   │
   ▼
makeAutoDecision(payload) ──> ProductionInferenceClient.match(payload)
   │                                  │
   │                                  ▼
   └────────────────────────── inference response
                                      │
                                      ▼
LiveReviewCaptureRegistry.record(accountId, payload, response)
                                      │
                                      ▼
session/raw/<batchId>/{img,new}/*.png + prediction.json
                                      │
                         stop hoặc savedBatchCount == 100
                                      │
                                      ▼
manifest.json ──> build_live_review.py ──> review.html
```

Capture hook chạy sau khi inference response đã vượt qua parsing contract, nhưng trước khi payload bị mất khỏi scope. Lỗi ghi capture không được làm thất bại auto fishing; registry tăng `failedBatchCount`, lưu `lastError` đã sanitize và để luồng auto tiếp tục.

### Cấu hình

Thêm biến môi trường:

```text
FISHING_LIVE_REVIEW_CAPTURE_ROOT=/absolute/path/to/avatar-web/server/data/fishing-review-captures
```

Quy tắc:

- Biến không đặt: registry và routes ở trạng thái disabled, UI ẩn cụm capture.
- Đường dẫn phải tuyệt đối.
- Nếu `NODE_ENV=production` và biến được đặt, backend fail startup với lỗi rõ ràng.
- Root được resolve một lần khi load config.
- Không dùng `FISHING_RX79_CAPTURE_ROOT` vì biến đó thuộc cycle acquisition cũ.

### Session identity và layout

Session ID do backend tạo, không nhận từ client:

```text
live-review-YYYYMMDDTHHMMSSsssZ-<8-hex>
```

ID chỉ gồm ASCII alphanumeric và dấu gạch ngang. Layout:

```text
<capture-root>/
  sessions/
    <session-id>/
      session.json
      manifest.json
      raw/
        <batch-id>/
          manifest.json
          img/{0,1,2,3,4,5}.png
          new/<query-index>.png
          prediction.json
      review.html
```

`session.json` là trạng thái có thể cập nhật theo atomic replace. `manifest.json` và `review.html` chỉ được tạo khi seal thành công. File ảnh và prediction của một batch được ghi vào staging directory, sync, rồi rename nguyên tử sang `raw/<batch-id>`.

### Session state machine

```text
capturing ── stop/manual limit ──> sealing ── success ──> ready
    │                                  │
    └── unrecoverable setup error ─> blocked <── build/seal failure
```

State contract:

```ts
type LiveReviewCaptureState = 'capturing' | 'sealing' | 'ready' | 'blocked';

interface LiveReviewCaptureSnapshot {
  enabled: boolean;
  state?: LiveReviewCaptureState;
  sessionId?: string;
  targetBatchCount: 100;
  savedBatchCount: number;
  failedBatchCount: number;
  startedAt?: string;
  stoppedAt?: string;
  reportReady: boolean;
  lastError?: string;
}
```

Registry API:

```ts
start(accountId: number): LiveReviewCaptureSnapshot
snapshot(accountId: number): LiveReviewCaptureSnapshot
record(accountId: number, payload: FishingChallengePayload, result: InferenceResult): void
stopAndSeal(accountId: number): Promise<LiveReviewCaptureSnapshot>
reportPath(accountId: number, sessionId: string): string | null
```

`record` trả ngay và nối thao tác ghi vào `writeTail` của session. Khi batch thứ 100 được ghi thành công, registry tự gọi seal đúng một lần. Các record tới trong lúc `sealing`, `ready` hoặc `blocked` bị bỏ qua.

### Batch contract

Mỗi batch chứa:

```json
{
  "schemaVersion": 1,
  "batchId": "live-<timestamp>-<hex>",
  "capturedAt": "<ISO-8601 UTC>",
  "references": [
    {"index": 0, "path": "img/0.png", "sha256": "<64 hex>"}
  ],
  "queries": [
    {
      "newIndex": 0,
      "path": "new/0.png",
      "sha256": "<64 hex>",
      "predictedImgIndex": 3,
      "similarity": 0.98,
      "margin": 0.12,
      "accepted": true
    }
  ]
}
```

Live data chưa có ground truth, vì vậy không có `expectedImgIndex`. Người review chọn ground truth trong HTML. Accuracy thủ công chỉ dùng các query đã chọn reference 0–5; “không xác định” không nằm trong mẫu số.

### API contract

Mount dưới account routes:

```text
POST /api/accounts/:id/fishing-live-review/start
GET  /api/accounts/:id/fishing-live-review
POST /api/accounts/:id/fishing-live-review/stop
GET  /api/accounts/:id/fishing-live-review/:sessionId/report
```

Start request không cần body và target luôn là 100. Responses dùng `LiveReviewCaptureSnapshot`.

- `start`: `200` khi bắt đầu; `409` nếu account đã có session chưa kết thúc hoặc game session chưa online.
- `status`: `200` với snapshot disabled/enabled; không trả filesystem path.
- `stop`: `200` khi seal xong; `409` nếu chưa capture hoặc chưa có batch.
- `report`: trả `text/html; charset=utf-8`; `404` nếu report chưa sẵn sàng hoặc session không thuộc account.
- Tất cả route dùng auth và ownership hiện có.
- Trong production hoặc khi root không cấu hình, start/stop/report trả `404`; status trả `{enabled:false,state:"disabled"}` để UI ẩn controls.

### Web UI

Cụm capture nằm cạnh cấu hình Auto câu cá và chỉ hiện khi status có `enabled: true`.

Trạng thái UI:

- Chưa capture: nút **Bắt đầu thu thập 100 batch**.
- Capturing: progress bar, `saved/100`, failed count, nút **Dừng và tạo trang review**.
- Sealing: disable nút, hiện **Đang tạo trang review…**.
- Ready: hiện số batch, nút **Mở trang review** mở report route trong tab mới.
- Blocked: hiện lỗi sanitize và nút bắt đầu session mới chỉ sau khi backend xác nhận session cũ đã kết thúc.

Web poll status mỗi 2 giây khi state là `capturing` hoặc `sealing`; dừng polling ở `ready`, `blocked`, khi component unmount hoặc khi đổi account.

### HTML live review

HTML dùng layout và interaction của final report nhưng thay metrics cố định bằng:

- `Captured`: số batch và query.
- `Accepted rate`: accepted / tổng query.
- `Review progress`: query đã review / tổng query.
- `Manual top-1 accuracy`: model choice khớp lựa chọn thủ công / query comparable.
- `Manual accepted accuracy`: model choice khớp lựa chọn thủ công trong nhóm accepted / accepted comparable.
- `Rejected but correct`: query rejected nhưng model khớp lựa chọn thủ công.

Filter gồm chưa review, đã review, accepted, rejected, model đúng theo review, model sai theo review và batch. Review được lưu bằng `localStorage` gắn với session ID và manifest SHA-256. Export JSON chứa session metadata, metrics và decisions, không chứa base64 ảnh.

## Error handling và an toàn dữ liệu

- Capture là local-only và fail-closed trong production.
- Account ID và session ID không được dùng trực tiếp làm filesystem path nếu chưa validate.
- Không trả absolute path qua API hoặc log browser.
- Mỗi batch được publish nguyên tử; batch ghi dở không được tính vào `savedBatchCount`.
- Lỗi inference giữ nguyên hành vi auto hiện tại và không tạo batch prediction không đầy đủ.
- Lỗi disk chỉ ảnh hưởng capture, không dừng auto fishing.
- Seal chờ toàn bộ `writeTail` hoàn tất trước khi tạo manifest.
- Builder kiểm tra count, uniqueness, index range, file existence và SHA-256 của mọi PNG.
- Report route chỉ phục vụ file `review.html` đã resolve bên trong session thuộc account.

## Verification Plan

### Static và automated verification

- Chạy impact analysis trên `makeAutoDecision`, callback inference trong `AvatarSession`, app route mounting và component Auto câu cá trước khi sửa.
- Chạy TypeScript typecheck và test suite server hiện có.
- Chạy frontend test suite/typecheck hiện có mà không tạo test file mới.
- Chạy Python compile cho builder và sinh report từ một session capture thực tế.
- Chạy `git diff --check`.
- Chạy GitNexus `detect_changes(scope="all")`; kết quả không được partial/truncated và mọi HIGH/CRITICAL risk phải được xử lý trước commit.

### Manual local verification

1. Chạy local với `FISHING_LIVE_REVIEW_CAPTURE_ROOT` là đường dẫn tuyệt đối trong `server/data`.
2. Kết nối một account và bấm **Bắt đầu thu thập 100 batch**.
3. Bật Auto câu cá và xác nhận progress tăng theo RX79 đã inference.
4. Xác nhận auto fishing vẫn tiếp tục nếu cố tình làm capture root không ghi được trong một phiên kiểm tra riêng.
5. Dừng sớm sau ít nhất một batch; xác nhận state chuyển `sealing` rồi `ready`.
6. Mở report từ web; xác nhận ảnh, prediction, accepted/rejected và metrics hiển thị.
7. Chọn reference cho một query, reload và xác nhận review được khôi phục.
8. Bắt đầu phiên mới, để đạt 100 batch và xác nhận tự dừng đúng mốc.
9. Chạy với `NODE_ENV=production` và capture env được đặt; xác nhận startup bị từ chối.

## Tiêu chí hoàn thành

- Người dùng điều khiển capture từ web local mà không cần gọi API hoặc lệnh riêng.
- Capture ghi đúng payload và response model của tối đa 100 auto-fishing batch.
- Dữ liệu nằm ngoài corpus Phase 2 và không ảnh hưởng runtime auto fishing khi ghi thất bại.
- Phiên dừng sớm hoặc đạt giới hạn đều tạo được HTML tự chứa để review.
- Metrics thủ công phản ánh lựa chọn của người review trên dữ liệu live chưa có nhãn.
- Production không thể bật chức năng capture.
