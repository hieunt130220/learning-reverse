# Fishing Phase 2 Batch-Duplicate Recovery Cycle Design

## 1. Mục tiêu và bối cảnh

Cycle `p2cr-20260905-01` đã hoàn thành production implementation và đã capture 90 batch RX79 thật, nhưng không thể tạo successor dataset theo contract đã duyệt:

- policy cũ yêu cầu `captureMode = rx79-read-only`, trong khi 90 batch diagnostic được thu bằng active crawl `TX45 → TX41 → RX79 → TX44`;
- image-level dHash detector v1 coi một image edge là đủ để làm toàn bộ acquired batch chạm parent;
- không có acquired image nào trùng SHA-256 tuyệt đối với parent, nhưng 913/1000 acquired images có direct dHash Hamming distance `≤ 4` với một parent image;
- vì các icon khác màu dùng chung silhouette, grayscale dHash tạo shared-sprite edges dù chúng không phải cùng fishing event;
- toàn bộ 90 diagnostic batches vì vậy có eligibility upper bound `0` theo policy v1.

Ngày `2026-09-06`, user chọn mở một clean successor cycle thay vì grandfather dữ liệu diagnostic. Mục tiêu của thiết kế này là:

1. đóng cycle cũ trung thực ở `NO_DATASET`;
2. giữ 90 batch cũ làm private diagnostic/exclusion evidence, không label và không train;
3. precommit một batch-level, role-aware near-duplicate detector trước acquisition mới;
4. codify active crawl không submit đáp án;
5. recapture 90 batch mới sau policy activation;
6. tiếp tục allocation `45/15/30` và downstream Phase 2 workflow mà không mở historical final evidence.

## 2. Định danh successor cycle

| Contract | Exact value |
|---|---|
| Cycle ID | `p2cr2-20260906-01` |
| Experiment ID | `p2cr2-20260906-01` |
| Dataset ID | `phase2-coverage-recovery-v2-20260906-01` |
| Parent dataset ID | `phase2-20260904-01` |
| Allocation seed | `20260906` |
| Eligible acquired batches | `90` |
| Acquired train/dev/final | `45/15/30` |
| Successor train/dev/final | `185/45/30` |
| Data root | `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01` |
| Artifact root | `avatar-web/fishing-ml/artifacts/cycles/p2cr2-20260906-01` |

Mọi artifact của cycle cũ và successor cycle nằm trong namespace khác nhau. Không copy, rename hoặc overwrite artifact từ `p2cr-20260905-01` sang `p2cr2-20260906-01`.

## 3. Phạm vi

### 3.1 In scope

- Terminalize cycle cũ `p2cr-20260905-01` là `NO_DATASET` với sanitized results/handover.
- Preserve immutable diagnostic inventory SHA-256 `c133238289a9d36dddc0861d4ac2c0347814b9d231fcb2c75560d33645647c53` và 90 raw diagnostic batches.
- Tạo policy schema v2 cho successor cycle trước khi capture.
- Thay image-level duplicate grouping bằng role-aware batch-level grouping.
- Dùng active capture loop chỉ với fishing commands `TX45`, `TX41`, `TX44`; tuyệt đối không `TX43`.
- Tắt shadow inference hoàn toàn trong acquisition crawl path.
- Seal inventory trực tiếp từ successful crawl process, không dựng lại thủ công sau capture.
- Exclude parent corpus và toàn bộ diagnostic corpus khỏi successor acquisition bằng batch-level detector v2.
- Manual labeling sau inventory sealing, không xem model prediction.
- Publish acquisition, grouped allocation, dataset-version schema v2 và prefinal integrity artifacts trong successor namespace.
- Propagate successor cycle/dataset identity đến training, freeze, final, replay và local-shadow contracts hiện có.

### 3.2 Out of scope

- Reusing hoặc labeling 90 diagnostic batches của cycle cũ.
- Weakening historical-final lock, one-shot final semantics, replay gate hoặc local-shadow gate.
- Thay candidate matrix, architecture axes, calibration policies, thresholds hoặc promotion gates đã duyệt.
- Live shadow, answer submission, `TX43`, `finishFishing()` hoặc automatic gameplay answer selection.
- Dùng labels, predictions, per-example errors hoặc historical-final evidence để chọn detector threshold.
- Tạo test files mới. Verification dùng existing suites và deterministic post-production checks vì project không cho phép test-first hoặc thêm tests khi user chưa yêu cầu.
- Commit, push, merge hoặc external publication khi chưa có explicit gate tương ứng.

## 4. Ràng buộc toàn vẹn

1. Policy v2 và detector descriptor/digest phải được publish trước timestamp của acquired batch đầu tiên.
2. Dữ liệu capture trước policy v2 activation không thể được grandfather vào successor acquisition.
3. Diagnostic corpus chỉ được decode trong leakage detector; không được label, train, calibrate, evaluate hoặc inspect bằng model.
4. Historical final labels, predictions, per-example reports và error identities vẫn cấm đọc.
5. Acquisition crawl không được gọi `maybeShadowMatch`, inference service hoặc bất kỳ model path nào.
6. Raw batch, inventory, policy, quarantine/exclusion, acquisition, allocation và dataset-version publication đều no-replace.
7. Batch ID, image SHA-256 hoặc batch duplicate group chạm parent/diagnostic exclusion corpus không thể được manual override.
8. Shareable results chỉ chứa aggregate counts, dates, digests, IDs và gate states; không chứa account identity, packet bytes, image bytes, labels, final membership hoặc per-example evidence.
9. Current GitNexus index không nhận diện các untracked successor implementation symbols và đã trả `UNKNOWN`; trước production edit phải re-index working tree rồi chạy impact lại. `UNKNOWN` không được coi là low risk.

## 5. Kiến trúc tổng thể

```text
close p2cr v1 as NO_DATASET
        |
        v
publish p2cr2 policy v2 + exclusion commitments
        |
        v
active crawl after activation
TX45 -> RX45 -> TX41 -> RX79 save -> TX44
        |
        v
probe seals immutable schema-v2 inventory
        |
        v
manual labels only, chronological order
        |
        v
batch-level parent/diagnostic exclusion + acquired-only rulings
        |
        v
first 90 eligible -> allocation 45/15/30
        |
        v
dataset-version v2 -> existing training/freeze/final/replay/shadow flow
```

## 6. Cycle cũ và diagnostic exclusion

### 6.1 Terminal state của cycle cũ

`p2cr-20260905-01` kết thúc ở `NO_DATASET` vì approved detector v1 cho eligibility upper bound `0/90`. Terminal record phải nói rõ:

- 90 real raw batches đã được captured và validated;
- capture là active diagnostic deviation, không phải passive evidence;
- không batch nào được label hoặc dùng cho training;
- `acquisition.json`, `allocation.json`, successor dataset-version, candidate, freeze, final, replay và local-shadow artifacts không được publish trong namespace cũ.

### 6.2 Diagnostic corpus commitment

Successor policy/quarantine records exact diagnostic evidence:

| Field | Exact contract |
|---|---|
| `diagnosticCycleId` | `p2cr-20260905-01` |
| `diagnosticInventorySha256` | `c133238289a9d36dddc0861d4ac2c0347814b9d231fcb2c75560d33645647c53` |
| `diagnosticBatchCount` | `90` |
| `diagnosticBatchCommitment` | SHA-256 của canonical sorted 90-ID list, không expose IDs trong shareable report |

Acquisition v2 loads diagnostic manifests/images only through the dedicated leakage detector. A successor batch connected to any diagnostic batch-level duplicate group is auto-rejected.

### 6.3 Quarantine/exclusion ledger schema v2

Successor `quarantine.json` is canonical, no-replace, mode `0600` and has exact fields:

```json
{
  "schemaVersion": 2,
  "cycleId": "p2cr2-20260906-01",
  "parentDatasetId": "phase2-20260904-01",
  "parentDatasetVersionSha256": "lowercase sha256",
  "parentFinalSplitSha256": "lowercase sha256",
  "parentFinalBatchIds": ["exactly 30 sorted safe IDs"],
  "diagnosticCycleId": "p2cr-20260905-01",
  "diagnosticInventorySha256": "c133238289a9d36dddc0861d4ac2c0347814b9d231fcb2c75560d33645647c53",
  "diagnosticBatchCount": 90,
  "diagnosticBatchCommitment": "lowercase sha256",
  "diagnosticBatchIds": ["exactly 90 sorted safe IDs"],
  "reasons": ["post-policy-diagnostic", "previous-final-exposed"]
}
```

`parentFinalBatchIds` must be an exact subset of the immutable parent dataset. `diagnosticBatchIds` must equal the exact inventory record-ID set and commit to the same canonical bytes as `diagnosticBatchCommitment`. Neither list may overlap successor capture records. These private IDs are never copied into sanitized results/handover.

## 7. Acquisition policy schema v2

Policy is canonical compact sorted-key JSON plus one trailing newline and mode `0600`:

```json
{
  "schemaVersion": 2,
  "cycleId": "p2cr2-20260906-01",
  "datasetId": "phase2-coverage-recovery-v2-20260906-01",
  "parentDatasetId": "phase2-20260904-01",
  "targetEligibleBatchCount": 90,
  "selectionRule": "first-90-chronological-eligible-after-activation",
  "captureMode": "active-rx79-crawl-no-answer",
  "captureFishingCommands": [41, 44, 45],
  "forbiddenFishingCommands": [43],
  "requiresCompleteReviewerLabel": true,
  "forbidsPriorFinalDirectedSampling": true,
  "singleImageOverlapRejectsBatch": false,
  "diagnosticCycleId": "p2cr-20260905-01",
  "diagnosticInventorySha256": "c133238289a9d36dddc0861d4ac2c0347814b9d231fcb2c75560d33645647c53",
  "diagnosticBatchCommitment": "lowercase sha256",
  "detector": {},
  "detectorSha256": "lowercase sha256",
  "detectorImplementationSha256": "lowercase sha256",
  "activatedAt": "UTC ISO-8601",
  "approvedBy": "hieunt",
  "approvalEvidence": "2026-09-06 approved Fishing Phase 2 Batch-Duplicate Recovery Cycle design"
}
```

The actual `detector` field is exactly the descriptor in §9.2. Policy publication fails if the dedicated detector module bytes do not match `detectorImplementationSha256`.

## 8. Active capture và inventory sealing

### 8.1 Allowed flow

Successor capture uses the existing game login/direct-join flow followed by:

1. attach RX45 waiter;
2. send `TX45` and require successful RX45;
3. attach RX79 waiter;
4. send `TX41`;
5. decode and immutably save the RX79 batch;
6. send `TX44` to reset the fishing state;
7. wait at least 2000 ms before the next round.

Waiters must attach before their corresponding TX to avoid missing fast responses. Timeouts increment sanitized aggregate counters and do not produce partial batch directories.

### 8.2 Forbidden flow

- No `TX43`.
- No answer/pair submission.
- No `maybeShadowMatch`, inference request or telemetry carrying model output.
- No passive capture endpoint is represented as the source of active-crawl evidence.
- No account ID, username, password, device or host appears in inventory/output artifacts.

### 8.3 Crawl CLI contract

In crawl mode, `fishing-probe` adds required arguments:

```text
--cycle-id p2cr2-20260906-01
--inventory-output <absolute successor evidence/capture-inventory.json>
```

The probe refuses to start if:

- cycle ID differs;
- inventory path already exists;
- output root contains any batch directory;
- target differs from `90` for this successor cycle;
- Avatar Web backend is listening on the configured local port.

Only `reason = target-reached` with exactly 90 saved batches may publish inventory. Any shutdown, login failure, repeated start rejection, malformed RX79, save failure or short count leaves inventory absent and blocks the cycle; partial raw evidence is preserved and never silently deleted/retried.

### 8.4 Capture inventory schema v2

The probe writes the inventory with `wx`, mode `0600`, file fsync and parent-directory fsync:

```json
{
  "schemaVersion": 2,
  "cycleId": "p2cr2-20260906-01",
  "captureMode": "active-rx79-crawl-no-answer",
  "startedAt": "UTC ISO-8601",
  "stoppedAt": "UTC ISO-8601",
  "requested": {"map": 14, "area": 1, "target": 90, "delayMs": 2000},
  "summary": {
    "reason": "target-reached",
    "savedBatchCount": 90,
    "skippedBatchCount": 0,
    "errorCount": 0,
    "tx43Count": 0
  },
  "records": [
    {
      "batchId": "safe batch id",
      "capturedAt": "UTC ISO-8601",
      "manifestSha256": "lowercase sha256"
    }
  ]
}
```

`skippedBatchCount` and `errorCount` may be non-zero when the final reason is still `target-reached`; `savedBatchCount`, record count and unique valid raw directories must remain exactly 90. Records sort by `(capturedAt, batchId)` and every capture timestamp must be at or after policy activation.

## 9. Role-aware batch duplicate detector v2

### 9.1 Leakage unit

The leakage unit is one complete RX79 fishing event/batch, not one individual icon. Shared icon silhouette or color family across independent events is allowed. A renamed/copied/replayed or substantially identical event remains excluded.

### 9.2 Canonical detector descriptor

```json
{
  "algorithm": "role-aware-batch-difference-hash",
  "algorithmVersion": 2,
  "decode": "Pillow RGB",
  "inputSize": [75, 75],
  "grayscale": "Pillow L",
  "resize": [9, 8],
  "hashBits": 64,
  "imageHammingThreshold": 4,
  "pairing": "maximum-cardinality-bipartite-per-role",
  "crossRolePairing": false,
  "referenceMinimumRatio": {"numerator": 5, "denominator": 6, "rounding": "ceiling"},
  "queryMinimumRatio": {"numerator": 4, "denominator": 5, "rounding": "ceiling"},
  "batchEdge": "reference-and-query-thresholds",
  "singleImageOverlapRejectsBatch": false,
  "grouping": "transitive-closure-of-batch-edges"
}
```

Descriptor identity is SHA-256 of compact sorted-key UTF-8 JSON plus one trailing newline. Implementation identity is SHA-256 of the exact dedicated detector module bytes.

### 9.3 Per-role matching

For two valid batches `A` and `B`:

1. Build a reference-reference bipartite graph.
2. Build a query-query bipartite graph.
3. An image pair edge exists when SHA-256 bytes are equal **or** dHash Hamming distance is `≤ 4`.
4. Cross-role edges are forbidden.
5. Compute maximum-cardinality matching independently for each role using sorted image indices.
6. `referenceRequired = ceil(5 × max(referenceCountA, referenceCountB) / 6)`.
7. `queryRequired = ceil(4 × max(queryCountA, queryCountB) / 5)`.
8. Create a batch duplicate edge only when both role match counts meet their required values.

Every eligible batch must contain exactly six reference images and at least one query image before detector evaluation. One shared image never rejects a batch by itself.

### 9.4 Batch groups

Duplicate groups are the transitive closure of batch duplicate edges across:

- parent corpus;
- old diagnostic corpus;
- new acquired corpus.

For each batch, compute a canonical batch evidence digest from sorted per-role tuples `(sha256, dhashHex)`. A group ID is SHA-256 of the sorted unique member evidence digests plus a trailing newline. Batch IDs are not used to derive group identity, so renaming a copied batch does not avoid grouping.

Each acquisition batch keeps the existing `duplicateGroupIds` list field for downstream compatibility, but it must contain exactly one batch-group ID.

### 9.5 Rejection and rulings

- A group touching parent causes every acquired member to be rejected as `parent-duplicate-batch-group`.
- A group touching old diagnostic data causes every acquired member to be rejected as `diagnostic-duplicate-batch-group`.
- Neither rejection can be overridden.
- An acquired-only group with more than one batch requires explicit user decision `reject-acquired` or `allow-batch-group`.
- Rulings bind cycle ID, detector digest, group ID, approver, UTC time and exact approval evidence.
- Missing/stale rulings block publication; they are never auto-generated from labels or model output.

### 9.6 Precommitted evidence boundary

Read-only design analysis on the old diagnostic corpus found:

- best parent reference overlap: maximum `4/6`;
- best parent query overlap: maximum `50%`;
- best combined overlap: maximum `50%`;
- proposed `5/6 + 80%` rule creates zero diagnostic-parent batch edges;
- proposed rule creates zero diagnostic-diagnostic multi-batch groups.

These aggregate facts justify that v1 was matching shared silhouettes rather than replayed events. They do not make old diagnostic batches eligible. After policy v2 activation, thresholds are immutable and cannot be retuned from new data, labels, predictions or final results.

## 10. Acquisition, allocation và dataset publication

### 10.1 Eligibility order

Process sealed records chronologically by `(capturedAt, batchId)`. A record is eligible only when:

- policy, inventory and detector identities match;
- batch ID is absent from parent, diagnostic and quarantine identities;
- manifest and every PNG validate against SHA-256;
- reference count is exactly six and queries are non-empty;
- complete reviewer label covers every query exactly once;
- its batch group touches neither parent nor diagnostic corpus;
- every acquired-only multi-batch group has an explicit valid ruling.

Publish only the first 90 eligible records. Fewer than 90 yields `NO_DATASET`; no quota reduction, parent-final substitution or policy retry is allowed.

### 10.2 Allocation

Allocation remains deterministic `45/15/30` using seed `20260906`. Atomic units are batch duplicate groups. The solver must not split a group or change the seed. If exact quotas are impossible, terminate `NO_DATASET`.

### 10.3 Successor dataset

- Train: 140 reusable parent-train + 45 acquired = 185.
- Dev: 30 reusable parent-dev + 15 acquired = 45.
- Final: 30 acquired only.
- Parent-final 30, old diagnostic 90 and rejected new batches never enter any successor role.
- Working train/dev membership remains public; final membership remains sealed and opaque until the durable final lock.
- Dataset-version remains schema v2, but exact dataset/cycle IDs and detector/acquisition lineage point to the successor namespace.

## 11. Downstream identity propagation

Training architecture, candidate count, calibration, freeze, final, replay and local-shadow semantics remain unchanged. The implementation updates only exact cycle/dataset identity checks and paths required for `p2cr2-20260906-01`.

No artifact from the old cycle can satisfy successor identity checks. All final/replay/local-shadow outputs publish only under `artifacts/cycles/p2cr2-20260906-01`.

## 12. Files và module responsibilities

| File/module | Responsibility |
|---|---|
| `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle.md` | Mark only truthful terminal completion for old cycle. |
| `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md` | Record old `NO_DATASET`, diagnostic counts/hash and zero downstream publication. |
| `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-handover.md` | Recreate sanitized terminal handover for old cycle. |
| `avatar-web/fishing-ml/src/fishing_ml/duplicate_detector.py` | New dependency-leaf dHash, per-role matching, batch grouping and detector identity. |
| `avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py` | Successor constants, policy v2, diagnostic exclusion, inventory v2 parsing, acquisition/allocation publication. |
| `avatar-web/fishing-ml/src/fishing_ml/dataset_version.py` | Accept exact successor dataset ID while preserving historical schema-v1 behavior. |
| `avatar-web/server/src/tools/fishing-probe.ts` | Active no-answer capture, no-shadow path, protocol counters and no-replace inventory sealing. |
| `avatar-web/server/src/fishing/localShadowCycle.ts` | Exact successor cycle identity for later local-shadow evidence. |
| `avatar-web/server/src/tools/fishing-local-shadow-cycle.ts` | Exact successor dataset identity validation. |
| `avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py` | Consume successor constants; candidate architecture and gates remain unchanged. |
| `avatar-web/fishing-ml/src/fishing_ml/evaluate.py` | Consume successor identity/path contracts without changing one-shot final semantics. |
| `avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py` | Consume successor identity without changing gate thresholds. |
| `avatar-web/fishing-ml/src/fishing_ml/replay.py` | No behavioral change; verify successor freeze/membership through existing contracts. |
| New successor data/artifact directories | Hold policy, exclusion, capture, labels, acquisition, allocation, dataset, training and terminal outputs. |

The existing passive `rx79Capture.ts` route remains bound to the old cycle and is not used or represented as evidence for successor active acquisition.

## 13. Failure semantics và edge cases

| Condition | Required outcome |
|---|---|
| Policy published after first capture | Block successor cycle; captured data cannot be reused. |
| Old diagnostic batch appears in successor inventory | Invalid/block, not manual review. |
| Probe observes or sends `TX43` | Block and preserve evidence; no inventory publication. |
| Shadow matcher invoked during acquisition | Block; data cannot be promoted. |
| Inventory already exists | Refuse start; never overwrite. |
| Raw root non-empty before capture | Refuse start. |
| Crawl exits before 90 saved | Preserve partial raw evidence, leave inventory absent, terminal `NO_DATASET`. |
| RX79 malformed or image write fails | Count sanitized error; no partial record. |
| Exact/near image overlap below both batch thresholds | Allowed; shared sprite alone is not leakage. |
| Only one role meets threshold | No batch duplicate edge. |
| Parent or diagnostic batch group touched | Auto-reject entire acquired group. |
| Acquired-only multi-batch group lacks ruling | Block publication. |
| Reviewer label missing/ambiguous | Record incomplete; not eligible. |
| Fewer than 90 eligible | Terminal `NO_DATASET`. |
| Group-safe `45/15/30` impossible | Terminal `NO_DATASET`. |
| Any final semantic access before durable lock | Block/fail under unchanged final contract. |

## 14. Verification plan

### 14.1 Before production edits

1. Re-index the current working tree so GitNexus includes untracked cycle implementation files.
2. Run upstream impact for every function/class to be modified.
3. Report repository, checkout, index identity, direct callers, affected processes and risk.
4. Stop for explicit approval on HIGH/CRITICAL and treat UNKNOWN as unresolved.

### 14.2 Static verification

- Compile/import modified Python modules.
- Run TypeScript typecheck and build.
- Scan acquisition crawl source for `TX43`, `finishFishing`, `maybeShadowMatch` and inference calls.
- Verify exact IDs and paths contain no old-cycle substitution in successor contracts.
- Run `git diff --check`.

### 14.3 Detector verification without new test files

Use deterministic in-memory/post-production checks:

- renamed byte-identical batch creates a duplicate edge;
- one changed reference and at most 20% changed queries still creates an edge;
- two changed references fail the `5/6` threshold;
- query-only or reference-only high overlap does not create an edge;
- cross-role matches never count;
- transitive batch edges form one group;
- parent/diagnostic groups reject and cannot be overridden;
- acquired-only group requires exact ruling;
- descriptor and implementation digest tampering fail closed;
- diagnostic aggregate reproduces zero v2 parent edges without exposing batch IDs.

### 14.4 Operational acquisition verification

- Policy v2 SHA and activation precede every inventory record.
- Inventory has mode `0600`, exactly 90 chronological records and `tx43Count = 0`.
- 90 manifests and all PNG SHA-256 values validate.
- No account identity, packet bytes or model output appears in artifacts/logs.
- Labels are complete manual reviewer outputs for every selected batch.
- Acquisition reports exact eligible/rejected/blocked aggregates and detector digests.

### 14.5 Dataset/downstream verification

- Allocation is exactly acquired `45/15/30` with group atomicity.
- Successor train/dev/final totals are exactly `185/45/30`.
- Parent-final and diagnostic batches have zero successor membership.
- Existing Python suite remains green.
- Existing server suite, typecheck and build remain green.
- Historical immutable SHA-256 baseline remains unchanged.
- Final membership remains opaque until durable lock.
- GitNexus `detect_changes --scope all` is not partial/truncated before any commit gate.

## 15. Alternatives rejected

### 15.1 Grandfather current 90 diagnostic batches

Rejected because detector/capture policy would be changed after observing the data, policy v1 says `rx79-read-only`, and the active diagnostic path invoked the disabled shadow hook. This weakens precommitment and auditability.

### 15.2 Exact SHA-only exclusion

Rejected because renamed/re-encoded/replayed events could evade exclusion.

### 15.3 Color-aware image-level threshold

Rejected because choosing a new color distance introduces another tunable image-level threshold and still treats a shared icon as the leakage unit. Batch/event identity is the semantically correct boundary for this matching task.

### 15.4 Keep image-level dHash and capture another board/map

Rejected because map `14/0` parent and `14/1` diagnostic data share the same visual pool, while native map `5/0` rejected fishing starts. More capture under detector v1 cannot produce 90 eligible batches.

## 16. Review và execution gates

1. User approves this Spec.
2. Write a separate bite-sized Implementation Plan at `docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle.md`.
3. User approves that Plan.
4. Re-index GitNexus and run pre-edit impact.
5. Implement production code task-by-task, inline unless user requests delegation.
6. Close old cycle terminal evidence before publishing successor policy.
7. Stop for explicit policy publication approval.
8. Publish policy v2, then recapture 90 new real batches.
9. Stop for manual duplicate rulings if any.
10. Stop at allocation, training, freeze, final, replay, local-shadow and commit gates defined by the successor Plan.
