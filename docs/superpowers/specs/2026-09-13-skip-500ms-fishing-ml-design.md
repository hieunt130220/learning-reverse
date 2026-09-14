# Bỏ Qua ML Cho Lượt Câu Cá 500ms

> **Ngày lập:** 2026-09-13  
> **Trạng thái:** Đã được user duyệt  
> **Tài liệu liên quan:** `avatar-re/notes/fishing.md`, `docs/superpowers/specs/2026-09-12-handle-instant-fishing-escape-design.md`, `docs/superpowers/specs/2026-09-12-ml-fishing-solve-rate-statistics-design.md`

## 1. Mục tiêu và bối cảnh

APK AvatarHD 3.4.4 nhận `timeDelay` trong RX79 `CAN_CAU`. Khi deadline hết,
`FishingScr.update()` tự điền key `0` cho các query chưa trả lời; khi đủ số
query, `FishingScr.setIndex()` gọi `ParkService.doFinishFishing(true, arrIndex)`
để gửi TX43. Với `timeDelay = 500ms`, mini-game chỉ xuất hiện khoảng 580ms rồi
server trả lượt câu trượt. Đây là lượt cá thoát nhanh, không phải phép đo độ
chính xác nhận diện ảnh.

Dữ liệu live-review hiện có gồm đúng 100 RX79:

- 62 batch có `timeDelayMs = 500`.
- 38 batch có `timeDelayMs = 20000`.
- Thống kê gameplay hiện ghi 37/100 lượt thành công, gần trùng hoàn toàn với
  số lượt có deadline 20 giây.
- 191 query đã review thủ công đều có Top-1 đúng.

Web hiện gọi inference cho cả hai nhóm rồi chờ humanized delay từ 2,5 đến 5,9
giây trước khi gửi TX43. Vì vậy nhóm 500ms vẫn tiêu tốn inference/capture và
kết quả trượt có thể bị ghi thành ML sai.

Mục tiêu thay đổi:

1. RX79 có `timeDelayMs === 500` không gọi model ML.
2. Web mô phỏng hành vi kết thúc lượt của APK bằng đáp án mặc định, để vòng câu
   không phải chờ timeout 35 giây.
3. Lượt 500ms không được ghi vào thống kê ML và không xuất hiện trong capture
   review ML mới.
4. Xóa bộ đếm ML lịch sử đã bị nhiễm để tỷ lệ sau triển khai bắt đầu từ dữ liệu
   hợp lệ.

## 2. Phạm vi

### 2.1. In-scope

- Thêm hằng số nội bộ nhận diện deadline thoát nhanh chính xác `500ms`.
- Trong `AvatarSession.handleFishingChallenge`, tách nhánh 500ms trước khi gọi
  `makeAutoDecision`/`ProductionInferenceClient.match`.
- Nhánh 500ms chờ theo deadline, kiểm tra lại ownership/generation/session,
  rồi gửi TX43 với một phần tử `0` cho mỗi query, giống fallback của APK.
- Không gọi `onFishingInference`, không đặt nguồn challenge là `ml`, và không
  gọi `recordMlResult` cho lượt 500ms.
- Log rõ lượt bị bỏ qua ML để có thể xác minh trên web.
- Reset các hàng trong `avatar_ml_fishing_statistics` một lần khi triển khai,
  sau khi sao lưu database, vì aggregate hiện tại không lưu `timeDelayMs` nên
  không thể trừ chính xác từng lượt cũ.

### 2.2. Out-of-scope

- Không thay đổi model, threshold, inference API hoặc checkpoint.
- Không sửa decoder RX79 hay wire format TX43.
- Không thay đổi humanized delay của các challenge 20 giây.
- Không đổi cách server game quyết định cá chạy mất hoặc bắt được cá.
- Không tạo test file mới; verification dùng build, kiểm tra tĩnh và chạy live.
- Không sửa dữ liệu capture/review lịch sử. Báo cáo cũ vẫn là bằng chứng điều
  tra; capture mới chỉ chứa những lượt thực sự gọi ML.

## 3. Thiết kế kiến trúc và giải pháp kỹ thuật

### 3.1. Files và vai trò

| File | Vai trò |
| --- | --- |
| `avatar-web/server/src/session/avatarSession.ts` | Phân nhánh deadline 500ms, gửi đáp án mặc định không qua ML, giữ nguyên luồng 20 giây |
| Database runtime của `avatar-web/server` | Sao lưu và reset aggregate `avatar_ml_fishing_statistics` một lần khi triển khai |

Không cần thay đổi frontend hoặc data contract. UI tiếp tục đọc
`mlFishingStatistics`; ý nghĩa của counter trở lại đúng là số lượt TX43 được
tạo bởi model ML.

### 3.2. Phân loại challenge

```ts
const FISHING_INSTANT_ESCAPE_DELAY_MS = 500;

function isInstantEscapeChallenge(payload: CanCauPayload): boolean {
  return payload.timeDelayMs === FISHING_INSTANT_ESCAPE_DELAY_MS;
}
```

So sánh chính xác `=== 500`, không dùng ngưỡng rộng, vì capture chỉ chứng minh
hai giá trị `500` và `20000`. Giá trị mới hoặc bất thường vẫn đi qua hành vi
hiện tại để không âm thầm bỏ ML khi chưa có bằng chứng protocol.

### 3.3. Luồng xử lý 500ms

```text
RX79 timeDelayMs=500
  → kiểm tra account/session/player/domain
  → tạo challenge generation mới
  → KHÔNG khởi tạo/gọi inference client
  → KHÔNG gọi onFishingInference
  → delayCancellable(500ms)
  → chạy Pre-Send Gate đồng bộ
  → consumedFishingChallenges.add(generation)
  → currentFishingChallengeSource = undefined
  → finishFishing(Array(queryCount).fill(0))
  → RX43/dialog từ server
  → recordMlResult không tăng counter vì source không phải ml
  → runFishingLoop reset và quăng lượt tiếp theo
```

Mảng mặc định phải có đúng `domain.queryCount` phần tử, mỗi phần tử bằng `0`.
Giá trị `0` luôn thuộc domain vì một challenge hợp lệ có ít nhất một reference.

Nhánh dùng cùng Pre-Send Gate với nhánh ML để không gửi TX43 nếu lượt đã kết
thúc, mode đã đổi, socket đã reconnect hoặc generation đã bị thay thế. Sau gate
không có `await` trước `finishFishing`.

### 3.4. Luồng xử lý challenge bình thường

RX79 có `timeDelayMs !== 500` giữ nguyên hoàn toàn:

```text
RX79 → inference → capture callback → humanized delay
     → Pre-Send Gate → TX43 source=ml/random → RX43 → statistics
```

Chỉ `decision.source === 'ml'` mới đặt `currentFishingChallengeSource = 'ml'`
và được ghi vào `avatar_ml_fishing_statistics` như hiện tại.

### 3.5. Capture review

`onFishingInference` hiện được gọi bên trong hàm `infer`. Vì nhánh 500ms thoát
trước `makeAutoDecision`, capture review mới sẽ không có batch 500ms. Điều này
là chủ ý: báo cáo review ML chỉ đo dữ liệu mà model thực sự được gọi.

### 3.6. Dữ liệu thống kê lịch sử

Bảng chỉ lưu aggregate `total_attempts` và `success_catches`, không lưu từng
attempt hoặc `timeDelayMs`. Vì vậy không thể sửa `37/100` bằng phép trừ có thể
kiểm toán. Khi triển khai:

1. Dừng server để tránh concurrent write.
2. Sao lưu file SQLite hiện tại với timestamp.
3. Xóa các hàng trong `avatar_ml_fishing_statistics`.
4. Khởi động lại server; UI hiển thị `0/0` và bắt đầu đo các lượt ML hợp lệ.

Không xóa thống kê số cá bắt được theo ngày hoặc dữ liệu account khác.

## 4. Input, output và edge cases

| Trường hợp | Hành vi |
| --- | --- |
| `timeDelayMs === 500`, domain hợp lệ | Không gọi ML; sau 500ms gửi đáp án `0` đúng số query; không ghi thống kê ML |
| `timeDelayMs === 500`, domain không hợp lệ | Giữ fail-closed hiện tại; không gửi TX43 và không gọi ML |
| Challenge bị RX43/dialog kết thúc trước 500ms | Generation đổi; Pre-Send Gate chặn TX43 mặc định |
| Mode tắt/reconnect trong 500ms | Abort/gate chặn TX43 |
| `timeDelayMs === 20000` | Giữ nguyên inference, humanized delay, TX43 và thống kê |
| Giá trị khác `500`/`20000` | Giữ hành vi hiện tại và log/capture bình thường để tiếp tục quan sát protocol |
| Inference service đang lỗi | Không liên quan nhánh 500ms; nhánh này không kết nối inference service |
| Server không trả RX43 sau đáp án mặc định | `runFishingLoop` vẫn có timeout 35 giây và cơ chế reset hiện tại |

## 5. Rủi ro và kiểm soát

- **Gửi packet lạc nhịp:** dùng lại toàn bộ generation/session Pre-Send Gate.
- **Bỏ nhầm challenge hợp lệ:** chỉ match chính xác `500` theo bằng chứng capture.
- **Làm sai thống kê do source cũ:** xóa `currentFishingChallengeSource` trước
  TX43 mặc định; đầu lượt mới vẫn có `recordMlResult(false)` như guard hiện tại.
- **Mất dữ liệu thống kê lịch sử:** sao lưu SQLite trước khi chỉ xóa bảng
  aggregate ML; các bảng khác không bị tác động.
- **Capture ít batch hơn:** đây là kết quả mong muốn vì 500ms không còn là input
  của model; progress review chỉ tăng cho challenge ML thật.

GitNexus impact CLI cho `handleFishingChallenge` hiện chưa chạy được do
`@ladybugdb/core` fail cài đặt với `spawnSync /bin/sh ENOENT`. Trước khi sửa
production code phải chạy lại impact; nếu vẫn `UNKNOWN`/fail, xác nhận phạm vi
bằng text search callers và không coi kết quả rỗng là an toàn.

## 6. Verification Plan

1. Build server: `npm run build -w avatar-web/server` phải exit 0.
2. `git diff --check` phải sạch.
3. Text search xác nhận nhánh 500ms đứng trước mọi lần gọi
   `ProductionInferenceClient.match`, `makeAutoDecision` và
   `onFishingInference`.
4. Chạy local với capture/inference instrumentation:
   - RX79 `500ms`: không có inference request, không có capture batch, có log
     bỏ qua ML, TX43 mặc định có đúng `queryCount`, counter ML không đổi.
   - RX79 `20000ms`: có đúng một inference request, có capture batch, TX43 dùng
     prediction, counter ML tăng đúng một lần khi nhận kết quả.
5. Cho auto câu ít nhất 20 lượt và kiểm tra mọi challenge 500ms đều bị loại
   khỏi mẫu thống kê ML.
6. Sau backup/reset database, UI bắt đầu từ `0/0`; tỷ lệ mới chỉ dùng các lượt
   thực sự gửi đáp án nguồn ML.
7. Chạy GitNexus `detect-changes --scope all` trước commit; kết quả partial,
   truncated hoặc UNKNOWN không được coi là clean và phải bù bằng kiểm tra text
   callers cùng diff phạm vi.
