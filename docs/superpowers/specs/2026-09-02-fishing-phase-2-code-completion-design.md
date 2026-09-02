# Fishing Matcher Phase 2 Code Completion — Design Document

- **Ngày:** 2026-09-02
- **Trạng thái:** Đã được user duyệt ngày 2026-09-02; sẵn sàng cho Implementation Plan
- **Tiền đề:** Read-only shadow matcher pipeline Tasks 1–9 đã được merge, nhưng experiment semantics, orchestration, gate adjudication, request-size contract và durable verification chưa code-complete.
- **Phạm vi:** Hoàn thiện code theo ý nghĩa thiết kế Phase 2 gốc; không chạy dataset/model/live gate, không gửi TX43 và không operationalize shadow production.
- **Spec tiền nhiệm:** `docs/superpowers/specs/2026-08-28-fishing-phase-2-design.md`

## 1. Mục tiêu & Bối cảnh

Repository đã có ba lớp Phase 2:

1. **2A — Offline improvement:** dataset namespace/provenance, error analysis và finite 24-candidate experiment matrix.
2. **2B — Inference/replay:** strict schema-v1 contract, one-frozen-candidate HTTP service và aggregate replay report.
3. **2C — Shadow observation:** Node client/adapter disabled by default, bounded, failure-isolated và image-only.

Tasks 1–9 đã tạo đầy đủ skeleton và safety boundary, nhưng code hiện tại chưa hoàn tất các cam kết kỹ thuật sau:

- `augmentation` và `hardNegative` chỉ tham gia candidate identity/provenance; chúng chưa thay đổi effective training behavior.
- Candidate gate đọc `wrongCount` và `abstentionRate` từ raw dev metrics thay vì calibrated `wrongAcceptedCount` và calibrated abstention.
- Experiment CLI chỉ hỗ trợ `list`, không có đường chính thức cho `run → compare → freeze → confirm-final`.
- `list` bỏ qua `dataset-version.json` được truyền vào và tạo version giả.
- Gate config còn là placeholder; latency/error-budget chưa có code adjudication rõ ràng.
- Replay report có p50/p95/p99 nhưng thiếu max latency cho hard ceiling.
- Contract giới hạn decoded PNG ở 960,000 bytes, trong khi service mặc định giới hạn raw JSON ở cùng con số, khiến canonical request hợp lệ tại biên decoded có thể bị từ chối trước parsing.
- Verification matrix trước đây dùng script tạm dưới `/tmp`, không tái chạy được từ repository.
- Docs/checklist đang trộn lẫn tooling/code completion với offline gate, replay gate và authorized live-shadow completion.

Mục tiêu của thay đổi này là đưa Phase 2 đến trạng thái **code-complete**: các axis có semantics thực, CLI và artifacts tạo thành state machine có thể kiểm chứng, gate trả kết quả trung thực `pass/fail/blocked`, contract/service/client thống nhất size budget, và tests bền vững khóa safety invariants.

Code-complete không tuyên bố rằng model đã đạt quality gate, checkpoint thật đã đạt replay gate hoặc authorized live shadow đã được chạy.

## 2. Phạm vi

### 2.1 In-scope

- Thêm training config schema v2 cho augmentation và hard-negative policy, đồng thời đọc được schema v1 hiện hữu.
- Cài đặt deterministic train-only augmentation với ba profile hiện có.
- Cài đặt deterministic within-episode hard-negative auxiliary margin loss cho ratio 0.25.
- Bảo đảm 24 candidate hiện hữu có 24 effective config/checksum khác nhau.
- Hoàn thiện experiment CLI với các stage `list`, `run`, `compare`, `freeze`, `confirm-final`, `adjudicate-replay`.
- Đọc dataset version thật; validate provenance và train/dev split checksum trước khi chạy matrix.
- Dùng calibrated acceptance metrics để chọn candidate.
- Tạo immutable selection, final-gate và replay-gate artifacts.
- Chặn final evaluation khi threshold config còn placeholder hoặc chưa có approval provenance hợp lệ.
- Bổ sung replay max latency và strict gate adjudication `pass/fail/blocked`.
- Tách decoded-PNG budget và canonical raw-JSON budget; dùng thống nhất trong Python contract/service/client và Node client.
- Thêm Python/TypeScript tests **sau production code**, theo yêu cầu trực tiếp của user.
- Cập nhật README, runbook, gate ledger và status vocabulary.
- Xóa hoặc hợp nhất dead Python inference-client helpers nếu impact analysis xác nhận không có caller và thay đổi phục vụ verification hiện tại.

### 2.2 Out-of-scope

- Capture thêm dữ liệu, manual labeling, thay đổi split hoặc commit generated dataset.
- Chạy training matrix thật, freeze checkpoint thật, final evaluation thật hoặc real-checkpoint replay.
- Chốt threshold numeric bằng dữ liệu chưa có, đổi `preAgreedPlaceholders` thành approved khi chưa có approval provenance, hoặc bịa metrics.
- Authorized live shadow, live game/account/map interaction hoặc kill-switch drill live.
- Nối shadow vào normal production game/session RX79 flow.
- Deploy/lifecycle/health-check cho Python inference service.
- Thay đổi `fishing-probe.ts`, TX41/TX44/TX45 sequencing hoặc crawler scope.
- Gửi TX43, gọi `finishFishing()`, xác định answer byte hoặc tự động submit.
- Thay đổi inference endpoint authorization/allowlist hoặc external service authentication; các việc này cần operationalization spec riêng.
- Dùng final predictions/errors để tạo candidate, threshold, augmentation hay hard negatives.
- Commit dataset, PNG, labels/splits runtime, checkpoints, generated run artifacts hoặc real gate reports.

### 2.3 Inputs, outputs và edge cases

**Inputs:**

- `config/phase2/candidates.yaml` finite matrix.
- `config/phase2/gate.yaml` explicit quality/latency/error-budget policy.
- Phase 2 `dataset-version.json`, raw/labels/splits và duplicate-review record.
- Existing run manifests/checkpoints, immutable selection artifact, frozen artifact và replay report khi stage tương ứng cần chúng.

**Durable outputs:**

- Candidate run artifacts/manifests.
- `phase2-selection.json` cho đúng một selected candidate.
- Frozen candidate directory/manifest.
- One-shot `final-evaluation.json` cùng final-gate adjudication.
- Replay aggregate report và replay-gate adjudication khi operator cung cấp evidence.

**Edge cases bắt buộc:**

- Matrix thiếu/duplicate/tampered candidate.
- Dataset/split/config/Git checksum thay đổi giữa stages.
- Existing run hoàn chỉnh, existing run dở dang và conflicting run ID.
- Schema v1 artifacts/configs và schema v2 configs.
- Episode chỉ có một reference, khiến không tồn tại wrong reference để mine.
- Ratio 0.25 trên số query nhỏ; deterministic selected count phải được định nghĩa rõ.
- Calibration không tìm được candidate hoặc full abstention bị cấm.
- Placeholder/approval provenance thiếu trước final.
- Final report/lock đã tồn tại hoặc failure xảy ra trước/sau publication point.
- Replay không có label, không có request/latency sample, nhiều model identity hoặc thiếu checksum.
- Canonical request đúng tại decoded/raw boundary và overflow một byte.
- Service/client errors không được echo payload hoặc sensitive fields.

## 3. Kiến trúc & Giải pháp kỹ thuật

### 3.1 Ranh giới kiến trúc

Thay đổi chia thành bốn workstream độc lập nhưng nối bằng immutable artifacts:

1. **Experiment semantics:** config v2, deterministic augmentation và hard-negative loss.
2. **Orchestration/gate correctness:** stage CLI, calibrated selection và one-shot final safety.
3. **Contract/service consistency:** decoded/canonical budgets thống nhất.
4. **Durable verification/truthful status:** repository tests và status vocabulary tách code khỏi operational evidence.

Luồng tổng thể:

```text
dataset-version + train/dev
        │
        ▼
candidate manifests × 24
        │
        ▼
phase2-selection.json
        │
        ▼
verified frozen candidate
        ├── one-shot final → final gate report
        └── inference service → replay report → replay gate report
```

Mỗi stage chỉ tiêu thụ output đã strict-validate của stage trước. Không stage nào được overwrite artifact terminal.

### 3.2 Training config schema v1/v2

`TrainingConfig` phải đọc được hai schema:

- **Schema v1:** đúng field set hiện hữu. Compatibility defaults:
  - `augmentation_profile = legacy_combined`
  - `hard_negative_ratio = 0.0`
  - `hard_negative_margin = 0.10` (inactive vì ratio bằng 0)
- **Schema v2:** giữ các field v1 và thêm bắt buộc:
  - `augmentationProfile`: `none | photometric | photometric_plus_geom`
  - `hardNegativeRatio`: `0.0 | 0.25`
  - `hardNegativeMargin`: finite number lớn hơn 0

`legacy_combined` chỉ là internal compatibility value, không hợp lệ trong schema-v2 YAML. Nó bảo toàn behavior schema v1: train-time combined photometric/geometric transform tại điểm hiện hữu sau normalization; hard-negative off.

Candidate Phase 2 mới bắt buộc schema v2. Model config/checkpoint/freeze manifest ghi schema version và cả augmentation/hard-negative fields. `config.py` là parser canonical dùng cho YAML và model-config documents, thay cho việc duy trì một field-set parser khác trong evaluator. Evaluator và inference service strict-parse được cả v1/v2; inference không áp dụng augmentation hoặc hard-negative nhưng không được bỏ qua unknown/malformed config fields.

Không migrate, rewrite hoặc tái sinh frozen artifact v1.

### 3.3 Deterministic augmentation

Schema-v2 augmentation chạy trên RGB tensor `[0,1]` trước normalization và chỉ trên train split:

- `none`: không biến đổi pixel.
- `photometric`: deterministic multiplicative gain trong `[0.92, 1.08]` và additive offset trong `[-0.04, 0.04]`, sau đó clamp `[0,1]`.
- `photometric_plus_geom`: photometric trên cộng translation nguyên pixel trong `[-3,3]` mỗi trục và scale trong `[0.95,1.05]`, bilinear sampling và border padding, sau đó clamp `[0,1]`.

Dev/final loaders không nhận augmentation profile và không chạy transform.

Reference-order shuffle tiếp tục chạy để model không học vị trí. Mỗi transform tạo RNG riêng từ SHA-256 stable context:

```text
global seed | epoch | batch id | role(reference/query) | image index
```

Không dùng Python process hash. Kết quả không phụ thuộc filesystem traversal, worker scheduling hoặc số lần RNG được gọi cho ảnh khác.

### 3.4 Deterministic hard-negative policy

Cross-entropy hiện hữu vẫn là primary loss. Khi `hardNegativeRatio = 0.25`, mỗi train episode bổ sung auxiliary hardest-negative margin loss:

1. Tính cosine similarity matrix giữa query và references.
2. Với mỗi query có ít nhất hai references, mask correct target và lấy wrong reference có similarity cao nhất. Tie được `torch.max` giải theo reference index nhỏ nhất.
3. Xếp eligible query theo SHA-256 stable key:

```text
global seed | epoch | batch id | query index
```

4. Chọn `ceil(eligible_query_count × ratio)` query, tối thiểu 1 khi ratio > 0 và có eligible query.
5. Mỗi selected query có loss:

```text
max(0, hardNegativeMargin + hardestWrongSimilarity - correctSimilarity)
```

6. Episode loss:

```text
cross_entropy + mean(selected auxiliary losses)
```

Nếu episode chỉ có một reference hoặc không có eligible query, auxiliary loss bằng zero tensor cùng device/dtype. Policy chỉ mine trong train episode hiện tại; không đọc dev/final và không persist per-image similarity.

`hardNegativeRatio = 0.0` phải giữ exact cross-entropy path, không thay đổi loss hoặc gradient ngoài augmentation/config khác.

### 3.5 Candidate identity và matrix

`config/phase2/candidates.yaml` chuyển `baseConfig.schemaVersion` sang 2 và khai báo `hardNegativeMargin: 0.10` như fixed base field. Các axis tokens được mapper trong `experiments.py` chuyển thành exact schema-v2 values; file không dùng provenance-only tokens như thể chúng là config fields.

Matrix giữ nguyên 3 × 2 × 2 × 2 = 24 candidate:

- augmentation: `none`, `photometric`, `photometric_plus_geom`
- hard negative: `off`, `ratio_0.25`
- temperature: `0.05`, `0.07`
- embedding: `dim_96`, `dim_128`

Mapping:

- `off → hardNegativeRatio: 0.0`
- `ratio_0.25 → hardNegativeRatio: 0.25`
- mọi schema-v2 candidate dùng một fixed positive `hardNegativeMargin` từ matrix/base config; margin không phải axis mới.

Effective config checksum bao gồm mọi schema-v2 field. `run_id` tiếp tục bao gồm axis tokens cùng config/split checksums. Validation/test phải chứng minh 24 specs có 24 effective configs, config checksums và run IDs duy nhất.

### 3.6 Experiment CLI state machine

Đăng ký console command `fishing-phase2-experiment = fishing_ml.experiments:main`.

#### `list`

- Đọc và strict-parse `dataset-version.json` được truyền vào.
- Xác minh resolved dataset namespace/provenance và train/dev split checksum.
- Enumerate đúng finite matrix; không đọc `final.txt`.
- Xuất count, axes, dataset ID/parent ID và candidate run/config/split checksums.

#### `run`

- Nhận một `matrix-key` hoặc exact `run-id`, không mặc định chạy toàn bộ matrix.
- Re-enumerate matrix và resolve đúng một spec.
- Train/calibrate trên train/dev và ghi immutable candidate manifest.
- Nếu run directory và manifest hoàn chỉnh đã tồn tại, verify run ID, dataset/split/config/Git checksums và required files rồi trả existing result.
- Nếu directory dở dang, manifest thiếu/tampered hoặc provenance conflict, fail closed; không overwrite và không auto-delete.
- Manifest tách:
  - `rawDevMetrics`: raw top-1/batch exact/loss;
  - `calibratedMetrics`: accepted count/accuracy, wrong accepted, abstention/accepted rate;
  - exact thresholds, effective config, dataset/split/config/Git checksums.

#### `compare`

- Đọc expected 24 specs và candidate manifests từ artifacts root.
- Refuse selection nếu thiếu candidate, duplicate run ID/matrix key, checksum mismatch, invalid metrics hoặc existing conflicting selection artifact.
- Eligibility dùng calibrated `wrongAcceptedCount == 0` khi configured.
- Tie-breakers:
  1. calibrated accepted rate;
  2. raw top-1 accuracy;
  3. raw batch exact-match;
  4. stable run ID.
- Ghi immutable `phase2-selection.json` chứa selected run ID, matrix key, candidate-manifest checksum, dataset/split/config/Git provenance và selection policy.
- Existing byte-equivalent selection được verify và trả lại; conflicting selection fail closed.

#### `freeze`

- Không nhận arbitrary result object từ operator.
- Đọc `phase2-selection.json`, verify selected candidate manifest/run/checkpoint và provenance rồi gọi freeze/verify.
- Existing verified byte-equivalent frozen output được chấp nhận; existing invalid/conflicting output fail closed.

#### `confirm-final`

- Yêu cầu exact `--confirm-final-once <selected-run-id>`.
- Trước khi mở `final.txt`, verify selection, frozen candidate, current dataset, split/config/Git checksums và approved gate provenance.
- Giữ existing one-shot lock/publication boundary.
- Ghi final report dù metrics pass hay fail; report terminal ngăn rerun.
- Ghi final-gate adjudication tách biệt. Gate fail không xóa final report.
- Failure trước publication point được dọn transient lock; existing report/lock không bị overwrite.

#### `adjudicate-replay`

- Đọc strict replay report, frozen manifest/checksum và gate config.
- Không chạy service/replay; chỉ adjudicate evidence đã được operator cung cấp.
- Ghi deterministic gate report hoặc in report theo explicit CLI option trong Plan; không tự suy diễn model identity/checksum.

### 3.7 Calibrated candidate selection

`run_experiment` phải dùng:

- `thresholds.json.metrics.wrongAcceptedCount` cho primary acceptance safety gate;
- `1 - thresholds.json.metrics.abstentionRate` cho accepted rate;
- `dev-metrics.json.top1Accuracy` và `batchExactMatch` cho raw correctness tie-breakers.

Parser của raw/calibrated documents phải strict-validate schema, finite/range values, counts và denominator consistency. Không dùng `.get(..., 0)` để biến missing metric thành zero.

Candidate manifest ghi cả raw và calibrated metrics để review không nhầm hai lớp. `passedGate` chỉ có nghĩa dev-selection gate, không đồng nghĩa final/replay/live pass.

### 3.8 Gate policy và approval provenance

`config/phase2/gate.yaml` bổ sung explicit error budget:

```yaml
errorBudget:
  maxErroredBatchRate: 0.01
  maxOmittedRate: 0.0
  requireSingleModelIdentity: true
```

Giá trị `0.01` và `0.0` cũng là placeholder policy cùng coverage/latency values hiện hữu, không phải threshold đã được real data phê duyệt. Tất cả nằm dưới cùng approval state của gate document.

`meta.preAgreedPlaceholders: true` tiếp tục block final/replay overall pass. Khi threshold được duyệt trong tương lai, config phải chuyển sang:

```yaml
meta:
  preAgreedPlaceholders: false
  approvedAt: "<ISO-8601 UTC>"
  approvedBy: "<non-empty reviewer identifier>"
  evidence: "<repo-relative or external evidence reference>"
  notTunedOnPhaseAFinal: true
```

Đây là data contract; thay đổi giá trị thật không thuộc spec này. Loader reject trạng thái `false` nếu thiếu/malformed approval fields, timestamp không UTC hoặc evidence rỗng. Không tự động tạo approval.

### 3.9 Gate status model

Mọi adjudication trả một trong ba trạng thái:

- `pass`: evidence hợp lệ và mọi mandatory gate đạt.
- `fail`: evidence đủ để xác định ít nhất một mandatory threshold bị vi phạm.
- `blocked`: chưa có failure xác định nhưng thiếu evidence, identity/checksum, labels/latency samples hoặc policy còn placeholder.

Priority: `fail` thắng `blocked`; chỉ `pass` khi không có failure và không có blocker.

CLI exit codes:

| Exit code | Ý nghĩa |
|---|---|
| `0` | Stage hoàn thành; adjudication pass |
| `2` | Input/schema/provenance/checksum/infrastructure không hợp lệ |
| `3` | Evidence đầy đủ cho ít nhất một mandatory gate failure |
| `4` | Gate blocked vì thiếu evidence hoặc policy chưa approved |

Các non-adjudication commands trả `0` hoặc `2`.

### 3.10 Final gate semantics

Trước final, placeholder policy hoặc missing approval provenance là `blocked` và `final.txt` không được mở.

Sau final, quality sub-gate dùng calibrated final predictions/report:

- `wrongAcceptedCount == 0` khi required;
- accepted rate ≥ `minAcceptedRate`;
- raw top-1 accuracy ≥ `minTop1Accuracy`;
- raw batch exact-match ≥ `minBatchExactMatch`.

Final report được publish trước adjudication result để pass/fail đều là terminal evidence. Final predictions không được đi vào any experiment input path.

### 3.11 Replay report và adjudication

`ReplayReport` bổ sung `latencyMaxMs`, tính trên cùng terminal client-call samples dùng cho p50/p95/p99.

#### Quality sub-gate

- Có ít nhất một labeled query và complete ground truth cho mọi query dùng để tuyên bố quality pass.
- Unknown query > 0 hoặc malformed/incomplete label khiến quality `blocked`, trừ khi đã có threshold failure xác định từ labeled evidence; khi đó status tổng vẫn `fail` theo priority.
- Wrong accepted bằng zero.
- Accepted rate, top-1 accuracy và batch exact-match phải đạt configured coverage thresholds. Replay report cần bổ sung/derive strict labeled raw correctness metrics nếu current fields chưa đủ; không suy top-1 từ accepted-only counts.

#### Operational sub-gate

- `requestCount > 0` và `latencySampleCount == requestCount`.
- Chính xác một model ID và một trusted frozen checksum; checksum phải khớp frozen manifest được truyền khi adjudicate.
- `latencyP95Ms <= p95Ms`.
- `latencyMaxMs < maxMs`; bằng hard ceiling là fail.
- `budgetMs` là soft diagnostic được report nhưng không tự fail gate.
- `erroredBatchCount / batchCount <= maxErroredBatchRate` với `batchCount > 0`.
- `omittedRate <= maxOmittedRate`.

Overall áp dụng status priority chung.

### 3.12 Request-size contract

Đổi tên/tách constants:

- `MAX_IMAGES_PER_LIST = 64`
- `MAX_DECODED_PNG_BYTES = 960_000`
- `MAX_CANONICAL_REQUEST_BYTES`: bound hữu hạn đủ cho canonical serialization của mọi request đạt decoded budget/count limits.

Python contract cung cấp pure size calculator cho canonical schema-v1 JSON. Calculator dùng exact UTF-8 byte length của deterministic compact JSON shape, không estimate bằng character count. Python/Node canonical clients:

1. validate image count/PNG và aggregate decoded bytes;
2. serialize compact canonical JSON;
3. validate exact UTF-8/raw `Buffer.byteLength` không vượt `MAX_CANONICAL_REQUEST_BYTES`;
4. gửi chính bytes/string đã validate, không serialize lại từ mutable object.

Service default `max_body_bytes` dùng `MAX_CANONICAL_REQUEST_BYTES`. Custom CLI override vẫn phải là positive bounded integer; Plan chốt upper safety cap để operator không vô tình bỏ body bound.

Cam kết compatibility áp dụng cho canonical repository clients. Custom JSON thêm whitespace có thể vượt raw-body cap dù decoded payload hợp lệ và bị từ chối có chủ đích.

Boundary requirements:

- Canonical request đạt đúng decoded limit và count limit không bị raw-body guard từ chối.
- Raw canonical body tại limit được chấp nhận về kích thước.
- Vượt decoded hoặc raw limit một byte trả stable `body_too_large`/local equivalent.
- Error không chứa body/base64/image bytes.

### 3.13 Error handling và artifact integrity

- Không silently default missing metrics/checksums/fields.
- Không chọn subset khi matrix incomplete.
- Không auto-overwrite, auto-delete hoặc auto-repair terminal artifacts.
- Existing complete artifact chỉ reusable sau full checksum/provenance verification.
- Existing incomplete/conflicting artifact trả actionable sanitized error.
- Errors không chứa credentials, account identity, raw packet, PNG bytes hoặc base64.
- Atomic file/directory publication và no-replace semantics hiện hữu tiếp tục được dùng.
- Runtime/generated artifacts nằm trong ignored data/artifact paths; test fixtures phải synthetic và nhỏ, không chứa capture thật.

## 4. File/module liên quan

### 4.1 Production Python

- `avatar-web/fishing-ml/config/phase2/candidates.yaml`
  - Chuyển candidate base config sang schema v2 và map đủ augmentation/hard-negative semantics.
- `avatar-web/fishing-ml/config/phase2/gate.yaml`
  - Bổ sung strict error budget; giữ placeholder state cho đến khi có approval provenance thật.
- `avatar-web/fishing-ml/src/fishing_ml/config.py`
  - Đọc strict schema v1/v2.
  - Cung cấp compatibility defaults và serialized effective config.
- `avatar-web/fishing-ml/src/fishing_ml/dataset.py`
  - Tách raw image load khỏi normalization.
  - Áp dụng schema-v2 train-only augmentation tại boundary trước normalization.
  - Giữ dev/final unaugmented.
- `avatar-web/fishing-ml/src/fishing_ml/phase2_training.py` (mới)
  - Deterministic stable seed derivation.
  - Augmentation profiles.
  - Hard-negative query selection và auxiliary margin loss.
- `avatar-web/fishing-ml/src/fishing_ml/train.py`
  - Truyền config/epoch/batch context vào policies.
  - Ghi schema-v2 model/checkpoint metadata.
  - Giữ schema-v1 legacy training behavior.
- `avatar-web/fishing-ml/src/fishing_ml/dataset_version.py`
  - Export/reuse strict dataset-version loader cho experiment CLI; không tạo synthetic version.
- `avatar-web/fishing-ml/src/fishing_ml/artifacts.py`
  - Preserve freeze/verify no-replace boundary; ghi/verify schema-v2 model config fields.
- `avatar-web/fishing-ml/src/fishing_ml/experiments.py`
  - Effective v2 candidate overlays.
  - Strict raw/calibrated manifest parsing.
  - CLI state machine và selection/freeze/final coordination.
- `avatar-web/fishing-ml/src/fishing_ml/calibrate.py`
  - Preserve raw dev calibration behavior; expose/reuse strict calibrated-metrics parsing contract.
- `avatar-web/fishing-ml/src/fishing_ml/evaluate.py`
  - Load model config v1/v2 qua canonical config parser.
  - One-shot final report/publication semantics.
- `avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py` (mới)
  - Strict gate/approval/replay-report parsing.
  - Final/replay `pass/fail/blocked` adjudication.
- `avatar-web/fishing-ml/src/fishing_ml/replay.py`
  - Bổ sung max latency và sufficient raw/labeled quality aggregates.
- `avatar-web/fishing-ml/src/fishing_ml/inference_contract.py`
  - Public internal constants/calculator cho decoded/canonical budgets.
- `avatar-web/fishing-ml/src/fishing_ml/inference_client.py`
  - Gửi exact canonical bytes đã size-check; hợp nhất dead bounded-response helpers nếu applicable.
- `avatar-web/fishing-ml/src/fishing_ml/inference_service.py`
  - Dùng canonical raw-body default và bounded override.
- `avatar-web/fishing-ml/pyproject.toml`
  - Đăng ký `fishing-phase2-experiment`, `fishing-phase2-replay` và `fishing-phase2-gate` entry points.

### 4.2 Production TypeScript

- `avatar-web/server/src/fishing/inferenceClient.ts`
  - Exact canonical request serialization/size guard.
  - Gửi đúng body đã validate.
  - Giữ timeout, model pinning, breaker và image-only boundary.

Không sửa `fishing-probe.ts`, shadow hook, game session, protocol/opcode hoặc deploy workflow.

### 4.3 Test files — chỉ tạo sau production code

User đã yêu cầu trực tiếp viết tests, nên ngoại lệ no-test-file của project được đáp ứng. Không dùng TDD; production code hoàn thành trước rồi mới tạo:

- `avatar-web/fishing-ml/tests/test_phase2_training.py`
- `avatar-web/fishing-ml/tests/test_phase2_experiments.py`
- `avatar-web/fishing-ml/tests/test_phase2_gate.py`
- `avatar-web/fishing-ml/tests/test_inference_size_contract.py`
- Các test helper/fixture synthetic tối thiểu dưới `avatar-web/fishing-ml/tests/` nếu Plan chứng minh cần.
- `avatar-web/server/src/fishing/inferenceClient.test.ts`
- `avatar-web/server/src/fishing/shadowMatcher.test.ts` chỉ khi cần khóa no-fetch/no-side-effect behavior mà client test không thể quan sát.

Dùng `unittest` và `node:test`; không thêm framework mới.

### 4.4 Documentation

- `avatar-web/fishing-ml/README.md`
  - Sửa introduction không còn phủ nhận service layer.
  - Document config v2, stage CLI, gate statuses và exact run commands.
- `docs/superpowers/plans/2026-08-28-fishing-phase-2-results.md`
  - Giữ historical evidence nhưng thêm correction/current-status section; không rewrite lịch sử như thể real gate đã chạy.
- `docs/superpowers/plans/2026-09-02-fishing-phase-2-code-completion-results.md` (runtime evidence template hoặc kết quả code verification, nếu Plan chọn tạo)
  - Tách code verification khỏi real operational evidence.
- Spec/Plan hiện hành dùng status fields:
  - `codeComplete`
  - `offlineGateStatus`
  - `replayGateStatus`
  - `liveShadowStatus`

## 5. Interfaces và Data Contracts

### 5.1 Effective training config

Internal `TrainingConfig` bổ sung:

```python
augmentation_profile: str
hard_negative_ratio: float
hard_negative_margin: float
```

Serializer phải round-trip schema version và exact fields. Checkpoint `config` và `model-config.json` dùng cùng canonical serializer.

### 5.2 Candidate manifest

Candidate manifest schema mới phải chứa tối thiểu:

```json
{
  "schemaVersion": 2,
  "stage": "train-dev-selection",
  "runId": "...",
  "matrixKey": "...",
  "provenance": {
    "datasetId": "...",
    "parentDatasetId": null,
    "datasetVersionSha256": "...",
    "splitSha256": "...",
    "configSha256": "...",
    "gitRevision": "..."
  },
  "effectiveConfig": {},
  "thresholds": {},
  "rawDevMetrics": {},
  "calibratedMetrics": {
    "acceptedCount": 0,
    "acceptedAccuracy": null,
    "acceptedRate": 0.0,
    "abstentionRate": 1.0,
    "wrongAcceptedCount": 0
  },
  "devSelectionPassed": false
}
```

Exact numeric ranges/count consistency được strict-validate trong implementation.

### 5.3 Selection artifact

```json
{
  "schemaVersion": 1,
  "stage": "phase2-selection",
  "selectedRunId": "...",
  "selectedMatrixKey": "...",
  "candidateManifestSha256": "...",
  "provenance": {},
  "policy": {
    "requireZeroWrongAccepted": true,
    "tieBreakers": ["acceptedRate", "top1Accuracy", "batchExactMatch", "runId"]
  }
}
```

### 5.4 Gate report

```json
{
  "schemaVersion": 1,
  "gate": "final|replay",
  "status": "pass|fail|blocked",
  "policySha256": "...",
  "evidenceSha256": "...",
  "checks": [
    {"name": "...", "status": "pass|fail|blocked", "actual": 0, "expected": "..."}
  ],
  "failures": ["stable_code"],
  "blockers": ["stable_code"]
}
```

Report không chứa per-image predictions, image/base64, account/session data hoặc raw packets.

## 6. Verification Plan

### 6.1 Python automated verification

Sau production code:

```bash
cd avatar-web/fishing-ml
python3.11 -m unittest discover -s tests -p 'test_*.py'
```

Test coverage bắt buộc:

1. Schema v1 giữ legacy behavior; schema v2 strict-parse và reject unknown/missing/range-invalid fields.
2. Schema-v1 artifacts load qua evaluator/service; schema-v2 artifacts round-trip đầy đủ.
3. 24 candidate tạo 24 effective configs/checksums/run IDs khác nhau.
4. Augmentation deterministic theo context; profile khác nhau tạo behavior khác; dev/final không augmentation.
5. Hard-negative off giữ exact loss; ratio 0.25 chọn đúng deterministic query count/order và margin loss; R=1 safe zero auxiliary loss.
6. `list` đọc dataset-version thật và không đọc final.
7. `run` existing-complete reuse, incomplete/conflicting fail closed.
8. Selection dùng calibrated wrong-accepted/accepted rate và raw correctness tie-breakers.
9. `compare` reject incomplete/duplicate/tampered matrix.
10. Freeze chỉ nhận selected run.
11. Placeholder/missing approval block trước final read/lock.
12. Final pass/fail report terminal không thể chạy lại; pre-publication failure dọn transient lock.
13. Replay quality/operational/overall statuses áp dụng đúng fail-over-blocked priority.
14. Replay max latency nearest observed maximum và sample consistency.
15. Decoded/canonical request exact boundary và overflow one byte.
16. Service/client errors không chứa payload/sensitive material.

Tests dùng synthetic PNG/manifest/config/metrics; không dùng capture thật hoặc checkpoint thật. Torch-dependent unit tests dùng small CPU tensors/models, không cần train full matrix.

### 6.2 TypeScript automated verification

```bash
cd avatar-web/server
npm test
npm run typecheck
npm run build
```

Test coverage bắt buộc:

- Disabled/kill-switch/sample-zero tạo zero fetch.
- Node canonical serialization dùng đúng bytes đã size-check.
- Decoded và raw-body exact boundaries/overflow.
- Timeout, service unavailable, malformed/oversized response vẫn trả bounded result và không throw vào caller.
- Model identity pinning và circuit-breaker generation không regression.
- Request document chỉ chứa schema/images; không có account/fish/timing fields.
- Telemetry/no-side-effect test nếu adapter cần coverage riêng; không mock/send game opcode.

### 6.3 Static/manual verification

- Run experiment `list` trên synthetic fixture và kiểm tra count 24/provenance.
- Run gate adjudication fixtures cho pass/fail/blocked và kiểm tra exit codes 0/3/4.
- Source scan production Phase 2 files xác nhận không có TX43, `finishFishing()` hoặc new game send path.
- Privacy scan gate reports/logging xác nhận không có image/base64/account/credentials/raw packets.
- `git status` xác nhận không có generated runtime artifacts ngoài intended source/docs/tests.

### 6.4 GitNexus workflow

Trước khi sửa bất kỳ function/class/method hiện hữu:

- chạy upstream impact cho symbol cụ thể;
- nếu HIGH/CRITICAL, cảnh báo user trước edits;
- nếu UNKNOWN, xác minh text call sites trước khi tiếp tục.

Trước mỗi commit:

- chạy `gitnexus_detect_changes({scope: "all"})`;
- `partial: true` hoặc `truncated: true` không được coi là clean;
- review affected processes/modules, đặc biệt training, one-shot final, inference request và shadow flows.

## 7. Ràng buộc an toàn và vận hành

- Không TX43 hoặc automated answer submission.
- Không live capture/shadow, game account use hoặc external game endpoint interaction trong implementation/verification này.
- Không thay đổi shadow off-by-default, kill switch, timeout, circuit breaker hoặc failure-isolation semantics ngoài testability/size consistency.
- Service vẫn load đúng một verified frozen candidate; request không chọn model.
- Không ghi ảnh/base64/account/session/raw packet vào logs, manifests hoặc gate reports.
- Final split chỉ mở tại one-shot final path sau all preconditions.
- Không tune bằng Phase A final hoặc Phase 2 final.
- Không commit generated data/checkpoint/run reports.
- Gate policy placeholder là blocker có chủ đích; code completion không tự phê duyệt numeric policy.
- Tests viết sau production code, không theo TDD.

## 8. Completion Criteria

Spec được implement xong khi tất cả điều kiện sau đúng:

1. Cả bốn experiment axes có semantics thực, finite và reproducible.
2. Config/artifact v1 vẫn load đúng; candidate mới dùng strict schema v2.
3. CLI hỗ trợ đầy đủ `list → run → compare → freeze → confirm-final` và `adjudicate-replay`.
4. Selection dùng calibrated acceptance metrics và yêu cầu đủ 24 candidate hợp lệ.
5. Freeze chỉ nhận immutable selected candidate.
6. Final không mở khi gate còn placeholder/missing approval và terminal report không thể rerun.
7. Replay adjudication trả trung thực `pass/fail/blocked`, có max latency và error budget.
8. Python contract/service/client và Node client thống nhất decoded/canonical request budgets.
9. Python/TypeScript tests mới pass cùng typecheck/build.
10. Docs phân biệt `codeComplete`, `offlineGateStatus`, `replayGateStatus`, `liveShadowStatus`.
11. Không thêm TX43, live capture, deployment hoặc normal-session shadow wiring.
12. Không commit generated data, checkpoints hoặc fabricated operational metrics.

Trạng thái dự kiến ngay sau implementation trong môi trường không có real dataset/checkpoint:

```text
codeComplete: true
offlineGateStatus: blocked
replayGateStatus: blocked
liveShadowStatus: not-run
```

## 9. User Review Gate

Spec này phải được user review và duyệt trước khi tạo Implementation Plan tại:

`docs/superpowers/plans/2026-09-02-fishing-phase-2-code-completion.md`

Không sửa production code trước khi Plan tiếp theo cũng được user duyệt.
