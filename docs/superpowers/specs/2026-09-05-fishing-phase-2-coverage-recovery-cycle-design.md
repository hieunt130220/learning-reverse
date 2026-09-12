# Fishing Phase 2 Coverage Recovery Cycle Design

## 1. Mục tiêu và bối cảnh

Fishing ML Phase 2 đã hoàn thành dataset, 24-candidate CPU matrix, immutable selection/freeze, one-shot final evaluation và terminal gate publication. Candidate đã chọn là:

```text
p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01
```

Final evidence cũ là terminal và bất biến:

- dataset: `phase2-20260904-01`;
- final: 30 batch, 210 query;
- wrong accepted: `0`;
- accepted: `116/210`;
- accepted rate: `0.5523809523809524`;
- top-1 accuracy: `0.9952380952380953`;
- batch exact match: `0.9666666666666667`;
- gate result: `FAIL`, duy nhất vì `accepted_rate_below_minimum` so với ngưỡng `0.60`;
- final lock, final report và gate report đã tồn tại vĩnh viễn;
- replay và shadow không được chạy sau gate fail.

Cycle mới không sửa hoặc tiếp tục final cũ. Mục tiêu là tạo một dataset version kế nhiệm có final holdout độc lập, mở rộng hữu hạn pipeline model hiện tại bằng dữ liệu và calibration dev-only, chọn candidate bằng promotion gate có safety margin, rồi đi qua chuỗi:

```text
new data -> successor dataset -> finite candidates -> dev promotion
  -> freeze -> one-shot new final -> real replay -> local shadow
```

Cycle thành công chỉ khi kết thúc ở `READY_FOR_SEPARATE_LIVE_SHADOW_REVIEW`. Trạng thái này không phải production approval và không cấp quyền live shadow hay gameplay control.

## 2. Quyết định thiết kế đã duyệt

User đã duyệt các quyết định sau trong phiên ngày 2026-09-05:

1. Cách ly vĩnh viễn 30 batch final cũ; không đưa chúng vào bất kỳ split nào của cycle mới.
2. Kế thừa 140 train + 30 dev cũ và thu 90 batch mới.
3. Phân bổ 90 batch mới thành 45 train, 15 dev và 30 final mới.
4. Giữ model architecture hiện tại; chỉ mở rộng augmentation, hard-negative và calibration/abstention hữu hạn.
5. Giới hạn toàn bộ matrix ở tối đa 48 candidate identities.
6. Dev promotion gate có safety margin:
   - wrong accepted bằng 0;
   - accepted rate ít nhất 0.65;
   - top-1 accuracy ít nhất 0.99;
   - batch exact match ít nhất 0.95;
   - riêng 15 dev batch mới cũng phải có wrong accepted bằng 0.
7. Nếu final mới pass, cycle chạy real replay rồi local shadow; live shadow, TX43 và gameplay mutation nằm ngoài phạm vi.
8. Chọn kiến trúc dataset-version kế nhiệm + quarantine ledger thay vì copy toàn bộ dataset hoặc tạo namespace Phase 3 mới.

## 3. Nguyên tắc bất biến và chống leakage

### 3.1 Historical final là terminal evidence

Các file sau và directory run cũ là read-only tuyệt đối:

- `avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/final-evaluation.lock`;
- `avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/final-evaluation.json`;
- `avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/gate-final.json`;
- selection, freeze manifest và checkpoint của run cũ;
- approved gate policy cũ và results ledger tương ứng.

Không được:

- xóa lock hoặc chạy lại final cũ;
- sửa, ghi đè, di chuyển hoặc republish report cũ;
- dùng prediction, per-example error, confidence distribution, batch identity có lỗi, hoặc bất kỳ phân tích nào từ final cũ để chọn dữ liệu, augmentation, hard-negative, calibration, threshold, candidate hoặc gate cho cycle mới;
- hạ final gate để hợp thức hóa kết quả cũ.

Được phép dùng duy nhất aggregate terminal facts ở §1 để ghi bối cảnh và chứng minh lý do mở cycle mới. Các aggregate này không được dùng làm optimization input.

### 3.2 Quarantine final cũ

Đúng 30 batch của split final thuộc dataset `phase2-20260904-01` phải được ghi vào một immutable quarantine ledger. Ledger chỉ lấy membership từ immutable split cũ; nó không đọc ảnh, label, prediction hoặc error.

Validator phải từ chối nếu bất kỳ quarantined batch nào xuất hiện trong:

- source batch list của dataset kế nhiệm;
- train, dev hoặc final split mới;
- training input;
- calibration input;
- candidate comparison hoặc error-analysis input;
- replay/local-shadow fixture được dùng làm quality evidence cho cycle mới.

Quarantine áp dụng theo batch ID, image SHA-256 và duplicate group. Đổi tên hoặc copy byte-identical không làm dữ liệu hết bị quarantine.

### 3.3 Final mới độc lập

30 final batch mới phải:

- được thu sau khi acquisition policy đã publish;
- chưa từng xuất hiện trong 200 eligible batch của parent dataset;
- không trùng batch ID, image SHA-256 hoặc near-duplicate group với parent dataset;
- không overlap train/dev mới theo batch hoặc duplicate group;
- không bị parse bởi training, calibration, comparison hoặc error-analysis commands;
- chỉ được semantic-validate và load sau durable one-shot lock.

Final membership có thể được tạo bởi allocation authority để commit split, nhưng sau sealing không command trước-final nào được phép in hoặc parse membership, ảnh hay label. Pre-final chỉ xác minh path containment, regular-file inventory, byte count và SHA-256 của sealed files.

## 4. Phạm vi

### 4.1 In scope

1. Tạo immutable acquisition policy cho 90 eligible batch mới.
2. Thu/import và gán nhãn đủ 90 batch mới bằng capture/label contracts hiện có.
3. Tạo quarantine, acquisition và allocation manifests.
4. Tạo dataset version kế nhiệm gồm train 185, dev 45, final 30.
5. Mở rộng dataset provenance schema theo cách backward-compatible với schema v1.
6. Thêm fail-closed lineage/leakage validation cho mọi stage.
7. Publish immutable experiment manifest với tối đa 48 candidate identities.
8. Train/calibrate/evaluate trên train/dev và áp dụng dev promotion gate.
9. Select/freeze đúng một candidate nếu có candidate đủ điều kiện.
10. Chạy đúng một final invocation mới sau fresh explicit authorization.
11. Chỉ sau final PASS: chạy real replay và immutable replay adjudication.
12. Chỉ sau replay PASS: chạy local shadow trên fixture/capture local đã duyệt.
13. Ghi results ledger và handover sanitized cho mọi terminal branch.

### 4.2 Out of scope

- Sửa hoặc chạy lại final cũ.
- Dùng final cũ để train, calibrate, select, error-analyze hoặc định hướng sampling.
- Thay backbone, model architecture, loss family, image size, inference wire contract hoặc service protocol.
- Candidate search mở, Bayesian search hoặc thêm candidate sau khi thấy dev evidence.
- Điều chỉnh gate từ final evidence.
- Live shadow kết nối gameplay thật.
- Gửi TX43, gọi `finishFishing()` hoặc thay đổi TX41/TX44/TX45.
- Tự động submit câu trả lời hoặc mutate gameplay state.
- Public deployment, external bind hoặc model-registry publication.
- Commit generated dataset, checkpoint hoặc operational reports nếu user không yêu cầu riêng.

### 4.3 Inputs

- Parent dataset version `phase2-20260904-01` và immutable SHA-256 hiện có.
- Parent train 140, dev 30 và final 30 membership.
- Approved parent duplicate-review evidence.
- Existing Fishing ML data import, label, split, training, calibration, freeze, evaluate, inference, replay, gate và shadow tooling.
- 90 eligible batch mới được thu theo §5.2.

### 4.4 Outputs

- Dataset ID mới: `phase2-coverage-recovery-20260905-01`.
- Cycle ID: `p2cr-20260905-01`.
- Acquisition policy, quarantine ledger, acquisition manifest, allocation manifest và dataset-version schema v2.
- Train/dev/final counts chính xác `185/45/30`.
- Immutable experiment manifest với không quá 48 candidate identities.
- Selection + frozen artifact mới, nếu dev gate pass.
- Final lock/report/gate mới, nếu final được authorise và invoked.
- Replay report/gate mới, chỉ nếu final pass.
- Local-shadow aggregate report, chỉ nếu replay pass.
- Results ledger và handover phản ánh trung thực terminal state.

## 5. Thiết kế dataset kế nhiệm

### 5.1 Namespace và lineage

Không sửa `data/phase2/dataset-version.json` hoặc split cũ. Cycle dùng namespace riêng:

```text
avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/
├── acquisition-policy.json
├── quarantine.json
├── acquisition.json
├── allocation.json
├── dataset-version.json
├── splits/
│   ├── train.txt
│   ├── dev.txt
│   └── sealed-final.txt
└── evidence/
    └── prefinal-integrity.json
```

Raw/label payload có thể tiếp tục nằm trong Phase 2 content-addressable roots hiện có. Dataset version và allocation manifest là authority cho batch eligibility. Loader không được suy diễn membership bằng directory listing.

Dataset kế nhiệm gồm:

```text
train = 140 parent-train + 45 acquired = 185
dev   =  30 parent-dev   + 15 acquired = 45
final =   0 parent        + 30 acquired = 30
total = 170 reusable parent + 90 acquired = 260
```

30 parent-final batch không thuộc `sourceBatches` mới.

### 5.2 Acquisition policy

`acquisition-policy.json` phải được publish no-replace trước batch đầu tiên dùng cho cycle. Policy schema v1 có exact fields và contracts:

| Field | Required value / contract |
|---|---|
| `schemaVersion` | integer `1` |
| `cycleId` | exact string `p2cr-20260905-01` |
| `parentDatasetId` | exact string `phase2-20260904-01` |
| `targetEligibleBatchCount` | integer `90` |
| `selectionRule` | exact string `first-90-chronological-eligible-after-activation` |
| `captureMode` | exact string `rx79-read-only` |
| `requiresCompleteReviewerLabel` | boolean `true` |
| `forbidsPriorFinalDirectedSampling` | boolean `true` |
| `oldDatasetExclusion` | exact object `{"batchId":true,"imageSha256":true,"nearDuplicate":true}` |
| `activatedAt` | ISO-8601 UTC timestamp generated by the publication process immediately before exclusive creation |
| `approvedBy` | exact string `hieunt` |
| `approvalEvidence` | exact string `2026-09-05 approved Fishing Phase 2 Coverage Recovery Cycle design` |

`activatedAt` là output runtime của một no-replace command, không phải giá trị được operator nhập lại sau capture. Plan phải materialize exact command và record hash trước acquisition. Publication command tự tạo ISO-8601 UTC value đúng một lần.

Capture semantics:

- Chỉ quan sát/copy RX79 image batches; không trigger fishing và không gửi TX.
- Xét batch theo capture timestamp rồi batch ID tăng dần.
- Batch eligible phải có canonical manifest, ảnh hợp lệ và reviewer label complete.
- Không được xem model prediction khi accept/reject batch.
- Batch invalid, thiếu label hoặc duplicate với old dataset được ghi aggregate rejection reason và không tính quota; tiếp tục chronological stream cho tới khi có đúng 90 eligible batch hoặc user dừng acquisition.
- Nếu không đạt đủ 90, trạng thái là `NO_DATASET`; không giảm quota và không bù bằng parent-final.

### 5.3 Duplicate và near-duplicate contract

Exact duplicate dùng SHA-256 bytes như validator hiện tại. Near-duplicate screening dùng deterministic 64-bit difference hash trên ảnh đã decode RGB 75×75 và resize grayscale 9×8; hai ảnh là near duplicate khi Hamming distance không quá 4. Duplicate groups là transitive closure của exact/near-duplicate edges.

Rules:

- Bất kỳ acquired image nào cùng duplicate group với một parent image làm toàn bộ acquired batch không eligible.
- Trong 90 eligible batch mới, một duplicate group không được đi qua nhiều split.
- Mọi manual duplicate ruling phải ghi checksum/group ID và explicit user decision; không auto-accept.
- Detector version, threshold `4`, normalization mode và implementation SHA phải nằm trong acquisition/allocation evidence.

### 5.4 Quarantine ledger

`quarantine.json` schema v1 có exact fields và contracts:

| Field | Required value / contract |
|---|---|
| `schemaVersion` | integer `1` |
| `cycleId` | exact string `p2cr-20260905-01` |
| `parentDatasetId` | exact string `phase2-20260904-01` |
| `parentDatasetVersionSha256` | lowercase SHA-256 của immutable parent `dataset-version.json` |
| `parentFinalSplitSha256` | lowercase SHA-256 của immutable parent `final.txt` |
| `reason` | exact string `previous-final-exposed` |
| `batchIds` | exactly 30 sorted, unique, safe batch-ID strings parsed from immutable parent `final.txt` |

Digest values và batch IDs được lấy bằng approved generation command từ existing immutable files. Generation không đọc labels, images hoặc final reports. File được publish no-replace. Schema rejects unknown keys, duplicate IDs, count khác 30 và unsafe IDs.

### 5.5 Acquisition manifest

Sau khi có đúng 90 eligible batch, publish `acquisition.json` no-replace. Mỗi batch record chứa:

- batch ID;
- capture timestamp;
- manifest SHA-256;
- label SHA-256;
- sorted image SHA-256 list;
- duplicate-group IDs;
- acquisition policy SHA-256.

Manifest phải sorted canonical, không chứa image bytes, labels, account identity, packet bytes hoặc model outputs. Validator yêu cầu đúng 90 unique batch và chứng minh zero overlap với parent/quarantine theo §5.3.

### 5.6 Allocation manifest

Allocation seed cố định là `20260905`. Role assignment chỉ chạy sau acquisition publication và trước training. Atomic unit là duplicate group; không tách group qua roles.

Deterministic allocation contract:

1. Compute `SHA256("20260905|" + groupId)` cho mỗi group.
2. Sort group theo digest rồi group ID.
3. Tìm assignment có exact batch counts `45 train / 15 dev / 30 final`.
4. Nếu nhiều assignment hợp lệ, chọn lexicographically smallest role vector theo role order `train < dev < final` trên sorted groups.
5. Nếu không có exact assignment vì group sizes, dừng `NO_DATASET`; không phá group hoặc đổi seed.

`allocation.json` chứa cycle/dataset IDs, seed, acquisition/quarantine digests, three sorted role lists, role counts, duplicate detector identity và split SHA-256. Publication là no-replace. Sau publication, mọi thay đổi yêu cầu dataset ID và cycle ID mới.

### 5.7 Dataset-version schema v2

`dataset_version.py` phải tiếp tục parse/serialize schema v1 không thay đổi. Schema v2 thêm lineage và split commitments với exact contracts:

| Field | Required value / contract |
|---|---|
| `schemaVersion` | integer `2` |
| `datasetId` | exact string `phase2-coverage-recovery-20260905-01` |
| `parentDatasetId` | exact string `phase2-20260904-01` |
| `createdAt` | ISO-8601 UTC generated once by no-replace publication |
| `sourceCommitment` | exact object `{count: 260, sha256}` where SHA-256 commits the canonical sorted 260-ID union without exposing IDs before final |
| `lineage.parentDatasetVersionSha256` | SHA-256 of parent dataset-version |
| `lineage.acquisitionPolicySha256` | SHA-256 of acquisition policy |
| `lineage.quarantineSha256` | SHA-256 of quarantine ledger |
| `lineage.acquisitionSha256` | SHA-256 of acquisition manifest |
| `lineage.allocationSha256` | SHA-256 of allocation manifest |
| `splits.train` | exact object with `count: 185` and SHA-256 of new `train.txt` |
| `splits.dev` | exact object with `count: 45` and SHA-256 of new `dev.txt` |
| `splits.final` | exact object with `count: 30` and SHA-256 of new `sealed-final.txt` |

All SHA values are lowercase 64-character hexadecimal digests generated from actual files. Schema v1 keeps its historical `sourceBatches` list. Schema v2 replaces that field with `sourceCommitment`; train/dev IDs are exposed only through the public working allocation view, while final IDs remain only in `sealed-final.txt` until the durable lock exists. Unknown keys, count mismatch, unsafe working IDs, duplicate IDs, parent-final overlap, digest mismatch hoặc split-union commitment mismatch are invalid.

### 5.8 Sealed-final boundary

`sealed-final.txt`, final labels và final image payload are operationally sealed after allocation. Pre-final tools may check only:

- expected path names and regular-file types;
- no symlink/hardlink escape;
- exact inventory/count;
- file sizes;
- SHA-256 against allocation/dataset commitments.

They may not parse final membership, decode final image, parse final label or emit final IDs. Train/dev commands receive APIs that expose only train/dev roles. Production dataset validation must support `working` mode that semantically validates train/dev while treating final as opaque committed bytes.

Full semantic final validation occurs only after the new final lock is durably created and fsynced. Any helper that traverses all splits must be split into explicit working/final modes before operational execution.

## 6. Candidate experiment design

### 6.1 Finite experiment identity

Experiment ID is `p2cr-20260905-01`. Before training begins, publish an immutable experiment manifest containing:

- schema version, cycle ID and experiment ID;
- dataset-version path and SHA-256;
- Git revision;
- device (`cpu` unless a separately reviewed deterministic device policy is approved before publication);
- global seed `20260827`;
- complete ordered list of candidate identities;
- each effective training config and SHA-256;
- calibration policy identity;
- dev promotion gate;
- selection tie-break order;
- execution order.

Manifest must contain exactly 48 candidate identities described below. It is no-replace. Training cannot accept candidate definitions or gate overrides from CLI after publication.

### 6.2 Controlled 48-candidate matrix

The architecture, channel stack, loss family and input contract remain unchanged. Matrix dimensions are:

#### Augmentation profile — 4 values

1. `photometric_mild`: gain ±4%, offset ±0.02.
2. `photometric_plus_geom_mild`: mild photometric + shift ±1 px + scale 0.98–1.02.
3. `photometric_plus_geom_standard`: existing gain ±8%, offset ±0.04, shift ±3 px, scale 0.95–1.05.
4. `photometric_plus_geom_strong`: gain ±12%, offset ±0.06, shift ±4 px, scale 0.92–1.08.

Transforms remain deterministic via the current stable seed context and run only on training tensors before normalization. Dev/final remain unaugmented.

#### Hard-negative ratio — 3 values

- `off` = 0.0;
- `ratio_0.25` = 0.25;
- `ratio_0.50` = 0.50.

Hard-negative margin remains fixed at `0.10`; selection, hardest-negative tie behavior and deterministic seed derivation remain unchanged.

#### Embedding dimension — 2 values

- `dim_96`;
- `dim_128`.

#### Calibration policy — 2 values

1. `joint_zero_wrong`: current exhaustive similarity/margin search on all 45 dev batches; require zero wrong accepted, maximize accepted count, then higher min-similarity, then higher min-margin.
2. `partition_robust_zero_wrong`: run the same calibration independently on inherited-dev (30) and acquired-dev (15), then use componentwise maximum similarity and margin thresholds; evaluate the combined threshold on all 45 dev batches.

Both policies fail if no non-empty accepted set satisfies zero wrong accepted. They may not use final data. The full candidate identity is model-training identity × calibration policy:

```text
4 augmentation × 3 hard-negative × 2 embedding × 2 calibration = 48
```

This requires 24 model training runs and two immutable calibrated candidate records per trained model. Temperature remains fixed at `0.05`, epochs at `80`, learning rate `0.001`, weight decay `0.0001`, channels `[32,64,96,128]`, CPU workers `0` and reproducibility tolerance `0.002`. These values are committed in the experiment manifest before execution.

### 6.3 Candidate run and reuse

Training uses only 185 train batches. Dev prediction, calibration, quality metrics and error analysis use only 45 dev batches. Loaders reject final/quarantine IDs before opening payloads.

Every model run and calibration record is no-replace. Reuse requires exact match of:

- experiment manifest digest;
- dataset version and train/dev digests;
- Git revision under the reviewed provenance policy;
- effective config;
- seed/device/runtime identity;
- model/checkpoint/dev prediction/calibration checksums.

Interrupted, partial, invalid or mismatched output cannot be reused or overwritten. Reset requires explicit user adjudication before any dev result from that candidate is used.

### 6.4 Dev promotion gate

A candidate is selectable only if every condition passes on all 45 dev batches:

```text
wrongAcceptedCount == 0
acceptedRate >= 0.65
top1Accuracy >= 0.99
batchExactMatch >= 0.95
```

Additionally, on the acquired-dev subset of exactly 15 batches:

```text
wrongAcceptedCount == 0
```

Metrics must reconcile accepted + abstained = query count and use complete reviewer labels. Missing/ambiguous/incomplete labels block promotion rather than being counted as abstentions.

### 6.5 Selection policy

If no candidate passes, terminal state is `NO_CANDIDATE`; do not freeze or open final.

Among passing candidates, apply immutable tie-breakers in order:

1. higher accepted rate;
2. higher top-1 accuracy;
3. higher batch exact match;
4. lower p95 offline inference latency;
5. byte-ascending run ID.

Offline latency uses CPU, one candidate at a time, 10 warm-up batches followed by 100 timed inference calls over the deterministic repeated dev-batch order. Timing uses monotonic clock around matcher inference only. Latency is a tie-breaker, not a replacement for replay latency gate.

Selection publication must preserve original recorded provenance and include dataset ID, cycle/experiment IDs, experiment manifest SHA, candidate manifest SHA, calibration policy, dev metrics, acquired-dev wrong-accepted count and tie-break evidence. Repeated identical publication is idempotent; changed content is rejected.

## 7. Freeze and pre-final gate

Only one selected candidate may be frozen. Freeze uses a new artifact namespace derived from `p2cr-20260905-01`; it must not write into the old winner directory.

Independent freeze verification requires:

- cycle, experiment, dataset and run identities;
- experiment, selection, candidate and calibration digests;
- train/dev split digests;
- Git revision compatibility;
- exact frozen inventory;
- checkpoint, model config, stats, threshold and snapshot digests;
- no terminal final/replay/local-shadow outputs in the new namespace.

The official final/replay policy remains unchanged:

```text
requireZeroWrongAccepted = true
minAcceptedRate = 0.60
minTop1Accuracy = 0.98
minBatchExactMatch = 0.90
p95 latency <= 100 ms
max latency < 250 ms
maxErroredBatchRate <= 0.01
maxOmittedRate = 0
requireSingleModelIdentity = true
```

Before final:

1. verify all identities and opaque final commitments;
2. verify gate metadata was approved without new-final evidence;
3. verify exact output absence;
4. materialize exact absolute command and capture destinations;
5. record hashes and working-tree state;
6. stop and request fresh explicit authorization for exactly one process invocation.

Spec, Plan, dataset, experiment, selection, freeze or gate-policy approval does not authorize final execution.

## 8. One-shot final evaluation

Only the frozen selected candidate may open the 30-batch new final.

Required flow:

```text
check terminal output/lock absence
  -> validate pre-final provenance and opaque commitments
  -> load model/config without final access
  -> atomically create + fsync durable lock and parent directory
  -> semantic-validate final membership/labels/images
  -> evaluate exactly once
  -> publish final report no-replace
  -> adjudicate official final gate
  -> publish gate report no-replace
  -> retain lock permanently
```

Starting the authorized process consumes the one-shot authorization regardless of exit. Any lock creation failure must prevent final access. Once lock creation begins, partial/full lock remains fail-closed; no cleanup path removes it.

Terminal branch:

- exit `0`, gate `pass`: continue to real replay;
- exit `3`, valid gate `fail`: `FINAL_FAIL`, stop;
- exit `2`, invalid input/provenance/publication: `FINAL_BLOCKED`, stop;
- exit `4`, policy/prerequisite blocked: `FINAL_BLOCKED`, stop;
- signal/unknown status: `FINAL_BLOCKED` with uncertain evidence, preserve all files and request adjudication.

No retry, candidate replacement, threshold update or gate update is allowed after final access. New experimentation requires another dataset/cycle with a new final holdout.

## 9. Real replay

Replay is authorized by this Spec only as a conditional Plan stage after final exit `0` and final gate pass. The Plan must still enforce prerequisites and output absence.

1. Reverify freeze/checkpoint/model identity and final PASS evidence.
2. Bind inference service only to `127.0.0.1` on an approved free port.
3. Capture exact PID and sanitized logs.
4. Verify readiness/model identity before replay.
5. Replay the approved complete labeled corpus through the full local HTTP service.
6. Write report with exclusive no-clobber output.
7. Verify aggregate consistency and adjudicate once to a no-clobber gate report.
8. Stop the exact PID and confirm the port is closed even after failure.

Replay PASS requires:

```text
one model ID and one checkpoint SHA
checkpoint SHA matches freeze
unknownBatchCount == 0
unknownQueryCount == 0
omittedCount == 0
wrongAcceptedCount == 0
acceptedRate >= 0.60
labeledTop1Accuracy >= 0.98
labeledBatchExactMatch >= 0.90
erroredBatchRate <= 0.01
p95 <= 100 ms
max < 250 ms
all batch/query/request count reconciliations pass
```

Service startup, identity, schema, completeness, timeout, HTTP or publication failure is `REPLAY_BLOCKED` unless valid evidence proves a mandatory quality failure, which is `REPLAY_FAIL`. Neither proceeds to local shadow.

## 10. Local shadow

Local shadow runs only after replay PASS. It is a local integration/failure-isolation exercise, not live gameplay.

- Use server/shadow adapter with approved local fixtures or sanitized captures.
- Inference endpoint remains loopback-only.
- Production default remains shadow OFF; enablement is process-local and expires with the local run.
- Kill switch must disable new requests immediately.
- Request contains only contract image payload and no account/gameplay identity.
- Telemetry is aggregate `{shadow,status,errorCode?,predictionCount?,acceptedCount?}` only.
- Do not persist request body, PNG/base64, raw packet, prediction arrays or per-user data.
- Exercise success, timeout, unavailable service, malformed response, wrong model identity and kill-switch cases.
- In every case the simulated fishing flow continues; no exception escapes into gameplay flow.
- Source/runtime evidence must prove zero TX43, zero `finishFishing()` and zero gameplay mutation.
- Publish one sanitized aggregate local-shadow report no-replace.

Passing local shadow yields `READY_FOR_SEPARATE_LIVE_SHADOW_REVIEW`. Any live-shadow attempt requires a different reviewed Spec/Plan, explicit runtime authorization, duration and kill-switch plan.

## 11. Architecture and module boundaries

### 11.1 New dependency-leaf dataset contract module

Create the focused module `src/fishing_ml/phase2_cycle.py`, responsible only for:

- acquisition-policy schema;
- quarantine schema;
- acquisition manifest schema;
- deterministic duplicate grouping contract;
- allocation schema/algorithm;
- working/final membership guard;
- integrity-only pre-final verification.

It must not import training, evaluation, inference or game code. Higher-level commands consume its immutable parsed records.

### 11.2 Existing modules

Candidate extension points that the Plan must confirm through GitNexus impact analysis:

- `dataset_version.py`: backward-compatible schema v2 lineage/split commitments.
- `phase2_training.py`: new deterministic augmentation tokens and ratio `0.50`.
- `config.py`: strict parsing of all newly approved finite augmentation and hard-negative tokens.
- `calibrate.py`: partition-robust calibration and removal/refusal of any CLI safety override for this cycle path.
- `experiments.py`: experiment manifest, 48 candidate identities, promotion gate, selection and cycle orchestration.
- `artifacts.py`: cycle identity, sealed-final commitments and new freeze inventory.
- `evaluate.py`: reuse durable lock boundary with cycle-specific final path/identity.
- `phase2_gate.py`: reuse official thresholds; only add cycle identity validation if absent.
- `inference_service.py` and `replay.py`: reuse existing frozen contract; no protocol change.
- Node shadow modules under `avatar-web/server/src/fishing/`: local-only orchestration/evidence only if current interfaces cannot run the required fixture matrix.

A file listed here is not automatically authorized for modification. Before editing any function/class/method, the implementation Plan must run GitNexus upstream impact for the exact symbol, report callers/processes/risk and warn before HIGH/CRITICAL edits. `UNKNOWN` requires source/text confirmation.

### 11.3 Data flow

```text
parent dataset ── train/dev ───────────────┐
parent final ── quarantine ledger ──X──────┤
                                            ▼
new RX79 batches -> eligibility/duplicate screening -> 90 acquired
                                            │
                       deterministic allocation 45/15/30
                              ┌─────────────┼──────────────┐
                              ▼             ▼              ▼
                         train 185      dev 45       sealed final 30
                              │             │              │
                              └── 48 candidates ──┐        │
                                                 ▼        │
                                          dev promotion   │
                                                 │        │
                                             selection    │
                                                 │        │
                                               freeze     │
                                                 │        │
                                     authorized one-shot lock
                                                 │        │
                                                 └────── final
                                                           │ PASS
                                                           ▼
                                                     real replay
                                                           │ PASS
                                                           ▼
                                                     local shadow
                                                           │ PASS
                                                           ▼
                                      READY_FOR_SEPARATE_LIVE_SHADOW_REVIEW
```

## 12. Error model and stage transitions

Canonical stage states:

- `PASS`: all mandatory checks succeed; stage may advance.
- `FAIL`: valid evidence proves a mandatory quality gate failure; cycle stops.
- `BLOCKED`: approval/prerequisite/completeness/infrastructure requirement is absent; cycle stops.
- `INVALID`: schema, provenance, checksum, identity or publication contract is violated; cycle stops.
- `UNCERTAIN`: process signal, ambiguous partial output or unclassifiable terminal event; preserve evidence and stop.

Only `PASS` advances. Fail-closed cases include:

- quarantined/parent-final data appears anywhere in successor membership;
- acquired batch overlaps parent by ID, SHA or near-duplicate group;
- duplicate group crosses roles;
- quota is not exactly 45/15/30;
- dataset count is not exactly 185/45/30;
- immutable manifest already exists with different bytes;
- experiment matrix is not exactly the frozen 48 identities;
- candidate/gate override appears after experiment publication;
- no candidate satisfies dev promotion;
- freeze identity/inventory/hash mismatch;
- final/replay/shadow output or lock already exists;
- final access is attempted before lock;
- model/checkpoint/dataset identity changes across stages;
- final or replay gate is not PASS;
- local shadow leaks sensitive payload or affects simulated gameplay;
- privacy scan finds forbidden content in a shareable report.

No stage automatically retries, deletes, overwrites, falls back to an old artifact or weakens a gate.

## 13. Verification plan

Verification is written and run after production code, never test-first. Test files may be created or modified only after explicit user authorization in the implementation cycle.

### 13.1 Static and contract verification

- Import/compile all affected Python modules.
- Validate schema-v1 dataset documents remain backward-compatible.
- Validate strict schema-v2 round-trip and unknown-key rejection.
- Validate canonical serialization and no-replace publication.
- Run `git diff --check`.

### 13.2 Dataset and leakage verification

Synthetic/post-production tests cover:

- quarantine exactly 30 safe unique IDs;
- all quarantined IDs/SHA/groups rejected from every successor role;
- exact/near-duplicate grouping and transitive closure;
- acquired-parent overlap rejection;
- atomic duplicate-group allocation;
- deterministic seed/order and exact 45/15/30 quota;
- impossible grouped quota returns `NO_DATASET`;
- dataset union/count/digest reconciliation;
- train/dev loader cannot access final;
- working validator treats final as opaque;
- final semantic access occurs only after durable lock.

Operational verification records aggregate counts/hashes only; it must not print final membership or labels before authorization.

### 13.3 Experiment verification

- Exactly 48 unique candidate IDs/config digests in deterministic order.
- 24 training identities × 2 calibration policies.
- Augmentation deterministic and train-only.
- Hard-negative ratio 0.50 retains deterministic selection.
- Both calibration policies require zero wrong accepted and non-empty acceptance.
- No CLI can add candidate, override gate or enable wrong accepted.
- Promotion requires all four aggregate gates plus new-dev zero-wrong gate.
- No passing candidate produces `NO_CANDIDATE` and no freeze.
- Selection tie-break and publication are deterministic/idempotent.

### 13.4 Final and replay verification

- Pre-lock failures do not open final.
- Lock exists and is durable before first final semantic read.
- Lock remains after dataset/evaluation/publication/gate failure and success.
- Existing lock/report rejects repeat invocation.
- Final/replay report identity and count reconciliation.
- Gate status/exit-code mapping.
- No-replace terminal publication.
- Service model/checkpoint pinning and loopback restriction.
- Replay timeout, malformed response, size, identity and shutdown paths.

### 13.5 Local-shadow verification

- Shadow OFF by default.
- Process-local enablement and kill switch.
- Success/failure fixture matrix is isolated from simulated fishing flow.
- No TX43, `finishFishing()`, packet send or gameplay mutation.
- Sanitized aggregate telemetry/report only.
- Server tests, typecheck and production build if Node code changes.

### 13.6 Repository and operational verification

- Full Fishing ML unittest discovery.
- Focused Phase 2/cycle suites with exact pass count.
- `pip check` and Python compileall.
- Server tests/typecheck/build when relevant.
- Dataset, manifest, selection, freeze, checkpoint and terminal artifact SHA-256 checks.
- Privacy scan for credentials, cookies, account IDs, packet bytes, image/base64 payloads and per-example arrays in mutable docs/reports.
- GitNexus `detect_changes(scope="all")` before any commit; partial/truncated is not clean and must be rerun.
- Review full diff and staged paths; exclude generated dataset/checkpoint/operational artifacts.

## 14. Operational approval gates

The implementation Plan must stop for review at minimum before:

1. publishing acquisition policy;
2. accepting any manual duplicate ruling;
3. publishing allocation/dataset version;
4. starting the fixed candidate matrix;
5. resetting any interrupted artifact;
6. freezing the selected candidate;
7. starting exactly one final process;
8. starting real replay service/process;
9. enabling local shadow fixture run;
10. commit, push, merge or external publication.

Approval is scoped to the displayed action and exact command/artifacts. Approval of one gate does not imply later gates.

## 15. Terminal outcomes

The cycle ends in exactly one truthful terminal state:

- `NO_DATASET`: acquisition, labels, duplicate policy or exact allocation cannot produce the approved dataset.
- `NO_CANDIDATE`: all 48 candidates completed/adjudicated but none passes dev promotion.
- `FINAL_FAIL`: valid new-final evidence fails a mandatory quality gate.
- `FINAL_BLOCKED`: final invalid, blocked or uncertain; no replay.
- `REPLAY_FAIL`: valid replay evidence fails a mandatory gate.
- `REPLAY_BLOCKED`: replay invalid, blocked or uncertain; no local shadow.
- `LOCAL_SHADOW_FAIL`: valid local fixture evidence violates failure-isolation/safety requirements.
- `LOCAL_SHADOW_BLOCKED`: local shadow invalid, incomplete or uncertain.
- `READY_FOR_SEPARATE_LIVE_SHADOW_REVIEW`: final, replay and local shadow all pass.

No outcome is named `production-ready`, `live-approved` or `gameplay-enabled`.

## 16. Files and artifact policy

### Expected new tracked files

- `docs/superpowers/specs/2026-09-05-fishing-phase-2-coverage-recovery-cycle-design.md`.
- `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle.md` after this Spec is approved.
- Results ledger/handover paths to be fixed in the implementation Plan.
- New production module/config/test paths only as justified by impact analysis and approved Plan.

### Expected generated operational files

- Cycle dataset manifests/splits under `data/phase2/cycles/phase2-coverage-recovery-20260905-01/`.
- Candidate, selection, freeze, final, replay and local-shadow artifacts in a new cycle-specific artifact namespace.

Generated raw data, labels, checkpoints, predictions and operational reports remain ignored/untracked unless a separate publication decision explicitly selects sanitized files. The restored old `artifacts/phase2-selection.json` remains an operational input and must not be accidentally staged.

### Read-only historical files

All parent dataset, old candidate, old selection/freeze/final/gate and old results ledger evidence are immutable. The implementation Plan must enumerate trusted hashes before operational work.

## 17. Completion criteria

The implementation/execution cycle is complete only when:

1. historical final/quarantine boundary is proven and preserved;
2. exact 90 new eligible batches and 45/15/30 allocation are immutable;
3. successor dataset v2 verifies at 185/45/30 with zero overlap/leakage;
4. exact 48-candidate experiment manifest is frozen before training;
5. all candidates are completed or truthfully adjudicated;
6. selection occurs only if dev promotion passes;
7. selected freeze verifies independently;
8. new final is invoked at most once after immediate authorization and terminal evidence is preserved;
9. replay/local shadow execute only on their PASS branches;
10. final terminal state from §15 is recorded in sanitized ledger/handover;
11. no final-derived tuning, TX43, `finishFishing()`, live shadow or gameplay mutation occurs;
12. verification and GitNexus requirements pass for all code actually changed.

## 18. Planning Clarifications Approved After Spec Review

Trong lúc map Spec sang implementation tasks, user đã duyệt thêm các contract vận hành sau. Các quyết định này là normative và không mở lại các ranh giới an toàn ở trên:

1. **Acquisition source:** tạo passive RX79 tap mới trên một session đã kết nối sẵn. Tap chỉ subscribe/observe/save RX79, không login/join/start fishing và không gọi bất kỳ API gửi TX nào.
2. **Intake cutoff:** passive tap tạo capture inventory; user dừng và seal inventory no-replace; chỉ sau đó mới label. Eligibility chạy đúng một lần theo `(captureTimestamp, batchId)`. Batch chưa được adjudicate tại thời điểm eligibility làm stage `BLOCKED`, không bị skip.
3. **Manual near-duplicate rulings:** một group chỉ nhận `reject-acquired` hoặc `allow-same-role`. Group chạm parent hoặc quarantine luôn bị reject và không có override.
4. **Detector identity:** SHA-256 của canonical algorithm descriptor gồm version, RGB-to-grayscale, resize 9×8, 64-bit dHash, Hamming threshold 4 và transitive closure.
5. **Latency tie-break:** CPU threads bằng 1; 10 warm-up + 100 timed calls; p95 dùng nearest-rank rồi ceil lên bucket 1 ms. Chỉ dùng latency khi ba quality metrics bằng nhau; cùng bucket chọn candidate ID byte-ascending.
6. **Replay corpus:** explicit successor membership gồm đủ 260 batch mới (`185 train + 45 dev + 30 new final`), loại hoàn toàn 30 historical final batch.
7. **Artifact layout:** `artifacts/cycles/p2cr-20260905-01/` phân tầng thành experiment manifest, 24 training runs, 48 calibrated candidates, selection, frozen, final, replay và local-shadow outputs.
8. **Gate policy:** tạo `config/phase2/coverage-recovery-gate.yaml` với cùng numeric/safety thresholds nhưng cycle identity và approval metadata riêng; historical `gate.yaml` không đổi.
9. **Local shadow:** deterministic six-case gate dùng một controller/client: success, timeout, unavailable, malformed response, wrong-model identity và post-kill-switch disabled-before-HTTP. Mọi case phải giữ continuation callback và không có gameplay side effect.
10. **Sealed source commitment:** dataset-version schema v2 không chứa danh sách 260 source IDs. Nó chứa `sourceCommitment={count:260,sha256}`; public working allocation chỉ lộ 185 train + 45 dev IDs, còn 30 final IDs chỉ tồn tại trong `sealed-final.txt` và chỉ được parse sau durable lock. Schema v1 giữ nguyên `sourceBatches`.

## 19. User Review Gate

Spec và các planning clarification trên đã được user duyệt. Implementation Plan vẫn cần một review gate riêng; không sửa production code cho tới khi Plan được user duyệt.
