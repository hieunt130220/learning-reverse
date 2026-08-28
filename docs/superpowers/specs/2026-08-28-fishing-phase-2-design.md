# Fishing Matcher Phase 2 — Design Document

- **Ngày:** 2026-08-28
- **Trạng thái:** Chờ user duyệt
- **Tiền đề:** Phase A đã hoàn tất pipeline offline và chạy final đúng một lần nhưng không đạt quality gate.
- **Phạm vi:** Cải thiện offline, inference service/replay và live shadow mode; không gửi TX43.

## 1. Mục tiêu & Bối cảnh

Phase A đã tạo được dataset 200 batch/1.375 labeled pairs, split 140/30/30 và frozen CNN candidate. Dev đạt 98,09%; final đạt 207/210 (98,57%), sai 3. Calibration đạt accepted accuracy 100% và accepted wrong bằng 0 nhưng abstention cao. Theo quy tắc Phase A, không được tune bằng lỗi final hoặc chạy lại final.

Phase 2 xây đường đi an toàn từ cải thiện offline đến kiểm chứng runtime:

1. **2A — Offline improvement:** mở rộng dữ liệu, phân tích lỗi và chọn candidate mới bằng dev-only tuning.
2. **2B — Inference service/replay:** phục vụ frozen candidate qua contract read-only và kiểm tra bằng captured RX79.
3. **2C — Shadow mode:** gọi service từ luồng RX79 live theo best-effort, chỉ quan sát, không điều khiển game.

Gate chính của 2A là **zero wrong accepted**. Accuracy, coverage và latency là các gate phụ phải được báo cáo và đạt ngưỡng trước khi shadow production.

## 2. Phạm vi

### 2.1 In-scope

- Dataset Phase 2 có namespace/version riêng, không ghi đè dataset hoặc artifact Phase A.
- Tiếp tục capture các batch từ map/area/account được ủy quyền.
- Manual labeling, validation, leakage review và provenance cho dữ liệu mới.
- Error analysis theo R/Q, similarity, margin, confidence và môi trường capture.
- Thử nghiệm có kiểm soát về augmentation, hard-negative sampling, loss/temperature và embedding/config.
- Freeze/evaluate một candidate Phase 2 theo quy trình dev-only tuning và final mới chạy đúng một lần.
- Inference service Python độc lập, khởi động bằng một frozen candidate cụ thể.
- Replay runner trên captured RX79 và fault matrix.
- Node.js shadow adapter có feature flag mặc định off, timeout, sampling, kill switch và sanitized telemetry.
- Verification chứng minh service/shadow không tạo TX43 hoặc side effect trên fishing flow hiện hữu.

### 2.2 Out-of-scope

- Gửi TX43, xác định mapping `imgIndex → TX43 byte`, hoặc tự động submit đáp án.
- Thay đổi `FishingService.finishFishing()`, TX41/TX44/TX45 sequencing hoặc auto-fishing behavior.
- Dùng lỗi final Phase A để tune model, threshold, architecture hoặc label; không chạy lại final Phase A.
- Pseudo-label làm ground truth; ground truth cuối cùng vẫn do người review.
- Multi-account/multi-map rollout ngoài phạm vi được ủy quyền.
- Ghi account ID, credentials, cookie, raw packet, base64 ảnh hoặc ảnh vào telemetry.
- Production guarantee từ shadow metrics; Phase 3 cần spec riêng nếu nghiên cứu TX43.
- Viết test files trừ khi user yêu cầu trực tiếp; verification dùng CLI, replay, fixture và fault injection sau production code.

## 3. Kiến trúc & Giải pháp kỹ thuật

### 3.1 Luồng tổng thể

```text
2A: crawler → import → label → validate → experiment → freeze/evaluate
                                                        │
                                                        ▼
2B: frozen candidate → inference contract → service → replay report
                                                        │
                                                        ▼
2C: live RX79 → TypeScript shadow adapter → sanitized telemetry
                         │
                         └── existing game flow unchanged; no TX43
```

### 3.2 Phase 2A — Dataset và model

Dataset được tổ chức dưới namespace riêng, ví dụ:

```text
avatar-web/fishing-ml/data/phase2/
├── incoming/
├── raw/
├── labels/
├── splits/
└── dataset-version.json
```

Phase 2 tái sử dụng `schema.py`, `validate.py`, `split.py`, `dataset.py`, `train.py`, `calibrate.py`, `artifacts.py` và `evaluate.py`, không fork logic. Batch mới giữ manifest/hash/PNG gốc và provenance. Hard-case selection chỉ dùng ưu tiên label/review; label cuối cùng do người xác nhận.

Dữ liệu ưu tiên:

- cấu hình khó, đặc biệt R/Q khác nhau và các nhóm tương tự R=6,Q=7/8;
- query có similarity hoặc margin thấp;
- nền/nhiễu và thời điểm capture đa dạng trong phạm vi được ủy quyền.

Mỗi candidate phải ghi dataset version, split seed/member list, config, checkpoint, thresholds, dev/replay metrics, git revision và checksum. Chỉ tuning trên train/dev. Phase 2 có final split riêng; candidate được chọn phải freeze trước khi mở final đúng một lần.

**Quality gate:**

- `accepted_wrong_count == 0` là điều kiện bắt buộc;
- báo cáo raw top-1, accepted accuracy, acceptance rate, abstention, batch exact-match, breakdown R/Q và latency;
- coverage phải đạt ngưỡng được chốt trong Plan, nếu quá thấp thì candidate chưa sẵn sàng cho shadow dù zero wrong accepted.

### 3.3 Phase 2B — Inference service và replay

Service Python độc lập load duy nhất một frozen candidate khi khởi động. Service không biết opcode, account hay game session.

Request schema version 1:

```json
{
  "schemaVersion": 1,
  "references": [{"index": 0, "pngBase64": "..."}],
  "queries": [{"index": 0, "pngBase64": "..."}]
}
```

Response schema version 1:

```json
{
  "schemaVersion": 1,
  "modelId": "phase2-cnn-...",
  "predictions": [{
    "queryIndex": 0,
    "referenceIndex": 1,
    "similarity": 0.98,
    "margin": 0.12,
    "accepted": true
  }],
  "latencyMs": 18
}
```

Contract validation yêu cầu schema/index hợp lệ, PNG decode được và đúng 75×75, count/body limits, finite numeric values và không có unknown fields. Error chỉ trả code/reason ngắn, không echo ảnh.

Replay report phải gồm batch/query count, accuracy, accepted/abstained, wrong accepted, latency p50/p95/p99, timeout/error/schema failures, R/Q breakdown, model ID và checksum. Replay bao phủ R=1, R≠Q, many-to-one, thiếu `arrImgNew`, PNG lỗi, vượt limit, timeout và service unavailable. Ảnh chỉ tồn tại trong memory.

### 3.4 Phase 2C — Shadow mode

Adapter TypeScript nhận `CanCauPayload`, gọi service best-effort và chỉ phát `ShadowMatchResult`/telemetry nội bộ:

```text
RX79 → decode/state update → shadow adapter → sanitized metrics
                                      ├─ success: record observation
                                      └─ failure: record code, continue
```

Feature flag mặc định off. Khi bật, adapter có timeout ngắn, circuit breaker/backlog guard, không retry trong cùng RX79, sampling và kill switch. Service lỗi, timeout hoặc response sai schema không được làm fail fishing session.

Shadow tuyệt đối không gọi `finishFishing()`, không gửi TX43 và không thay đổi TX41/TX44/TX45. Rollout theo thứ tự replay-only → local shadow → authorized live shadow.

## 4. File/module dự kiến

### Phase 2A

- `avatar-web/fishing-ml/src/fishing_ml/dataset_version.py`: dataset namespace, version và provenance.
- `avatar-web/fishing-ml/src/fishing_ml/error_analysis.py`: phân tích lỗi/confidence/R-Q.
- `avatar-web/fishing-ml/src/fishing_ml/experiments.py`: candidate config và experiment manifest.
- `avatar-web/fishing-ml/src/fishing_ml/phase2_replay.py`: replay qua inference interface.
- `avatar-web/fishing-ml/config/phase2/`: config dataset/model/gate.
- Các module ML hiện hữu: tái sử dụng, chỉ sửa sau impact analysis.

### Phase 2B

- `avatar-web/fishing-ml/src/fishing_ml/inference_contract.py`: typed request/response/error.
- `avatar-web/fishing-ml/src/fishing_ml/inference_service.py`: HTTP read-only service.
- `avatar-web/fishing-ml/src/fishing_ml/inference_client.py`: client dùng cho replay/adapter.
- `avatar-web/fishing-ml/src/fishing_ml/replay.py`: replay và latency/fault report.

### Phase 2C

- `avatar-web/server/src/fishing/inferenceClient.ts`: HTTP client, timeout và schema/error handling.
- `avatar-web/server/src/fishing/shadowMatcher.ts`: payload adapter và sanitized result.
- `avatar-web/server/src/fishing/shadowConfig.ts`: feature flag, endpoint, sampling, kill switch.
- RX79 integration point hiện hữu: chỉ sửa sau `gitnexus_impact` và không đưa submit logic vào adapter.

Tên file chính xác có thể điều chỉnh trong Plan sau khi đọc source, nhưng boundary và trách nhiệm không được trộn lẫn.

## 5. Rollout gates

| Gate | Điều kiện bắt buộc | Kết quả |
|---|---|---|
| 2A-1 | Dataset version/provenance/schema/leakage hợp lệ | Cho phép train |
| 2A-2 | Zero wrong accepted; accuracy/coverage đạt ngưỡng trong Plan | Cho phép freeze |
| 2A-3 | Frozen candidate verify độc lập | Cho phép service replay |
| 2B-1 | Contract valid/invalid matrix pass | Cho phép replay batch |
| 2B-2 | Replay latency/error budget pass, không crash/output sai schema | Cho phép local shadow |
| 2C-1 | Flag off giữ nguyên behavior; flag on không side effect | Cho phép authorized shadow |
| 2C-2 | Không có TX43/flow regression và telemetry đủ | Kết thúc Phase 2; Phase 3 cần spec riêng |

Ngưỡng coverage, latency và error budget cụ thể phải được chốt trong Implementation Plan trước khi code.

## 6. Verification Plan

1. Validate dataset/split/checksum và provenance; so sánh candidate với baseline Phase A.
2. Freeze/verify checksum; final Phase 2 chạy đúng một lần cho candidate đã chọn.
3. Contract test bằng CLI/fixture: valid, R=1, R≠Q, many-to-one, missing `arrImgNew`, malformed PNG, index lỗi, body/count vượt limit.
4. Replay đo accuracy, zero wrong accepted, coverage, abstention, R/Q và p50/p95/p99 latency.
5. Fault injection service unavailable, timeout, 5xx và malformed response; xác nhận caller không crash và không block fishing.
6. Chạy shadow off/on và so sánh behavior; kiểm tra packet/process logs không có TX43 và không thay đổi TX41/TX44/TX45.
7. Privacy review telemetry: không có credentials, account identity, raw packet, base64 hoặc image payload.
8. Trước sửa symbol hiện hữu chạy GitNexus upstream impact; trước commit chạy `gitnexus_detect_changes({scope: "all"})` và xác nhận đúng flow.

## 7. Ràng buộc an toàn và vận hành

- Feature flag shadow mặc định off và có kill switch.
- Service chỉ phục vụ frozen candidate, không cho request đổi model tùy ý.
- Không retry final evaluation hoặc dùng final errors để tuning.
- Không commit dataset, PNG, labels/splits, venv, checkpoints hoặc generated run artifacts.
- Mọi live capture và shadow rollout phải có authorization rõ ràng.
- Nếu service không sẵn sàng, existing game flow là source of truth.

## 8. User Review Gate

Spec này cần được user review và duyệt trước khi tạo Implementation Plan:

`docs/superpowers/plans/2026-08-28-fishing-phase-2.md`
