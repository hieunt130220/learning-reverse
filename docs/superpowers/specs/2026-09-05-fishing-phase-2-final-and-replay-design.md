# Fishing Phase 2 Final and Replay Design

**Date:** 2026-09-05
**Status:** Revised proposal — relocation-safe provenance amendment pending explicit user approval
**Initial approval:** Approved by user on 2026-09-05 before the relocation blocker was discovered
**Final data opened during design:** No

## 1. Mục tiêu và bối cảnh

Fishing Phase 2 đã hoàn tất code, dataset `phase2-20260904-01`, ma trận 24 candidates chạy CPU, immutable selection và verified freeze. Chu kỳ này thiết kế phần còn lại theo fail-closed: chốt gate policy chỉ từ pre-final/dev evidence; chạy final đúng một lần; lưu kết quả bất biến dù pass hay fail; và chỉ khi contract final cho phép mới chạy local replay với frozen winner.

Trusted identity cố định xuyên suốt:

- Selected run: `p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01`
- Selection SHA-256: `4c15e952eef67f7291a306d2eedc8277ca86601286b301538e8c03335dc71f1f`
- Checkpoint SHA-256: `6168b65abaf8ade9008c9611413167f76533d1e80926b2be852df6e7e3a67789`
- Freeze-manifest SHA-256: `ed1bbe4f9b24980c0277ace6da5d3b320b9f51a2b33f39c18c52e73beeed64ab`
- Dataset-version SHA-256: `406be8ed9fc097adcdaf6c3446addd4bf94c909d3a299cca8ce1304da35b0807`
- Training/freeze revision: `8ca1f93990dcd06a0b7d6ee6251100e67a155365`

## 2. Trạng thái read-only đã xác minh

### 2.1 Repository và transfer bundle

- Checkout hiện tại: branch `docs/fishing-phase2-transfer-bundle`, HEAD `aebbbe5a01affddebf7e0c7e8244e6a1e1fd3288`.
- Working tree tại lần kiểm tra ban đầu: clean.
- Bốn mục được liệt kê trong `fishing-phase2-transfer-2026-09-04/SHA256SUMS` đều hash `OK`.
- Dataset archive có 7,370 entries; artifacts archive có 552 entries.
- Không archive nào chứa `final-evaluation.lock`, `final-evaluation.json`, hoặc `gate-final.json`.
- Archive chứa macOS AppleDouble metadata (`data/._phase2`, `artifacts/._phase2-*`). Các entry này không đạt prefix policy được mô tả trong `RESTORE.md`; vì vậy restore phải fail closed hoặc loại metadata trong một extraction staging được kiểm soát, không được extract trực tiếp đè vào operational paths.
- Operational dataset/model artifacts hiện chưa có trong `avatar-web/fishing-ml/data/phase2` và `avatar-web/fishing-ml/artifacts`; không có restore/extract nào được thực hiện trong giai đoạn thiết kế.
- Archived candidate manifests hard-code `runDir` và `thresholdsPath` dưới `/Users/devios/learning-reverse/.claude/worktrees/fishing-phase2-freeze-execution/...`, trong khi operational root mới là `/Users/hieunt/learning-reverse/...`. Source hiện tại so sánh resolved path tuyệt đối, nên new-machine restore chắc chắn bị từ chối dù content hashes đúng.
- Source hiện tại cũng yêu cầu manifest/selection `gitRevision` bằng current `HEAD`; archive ghi `8ca1f939...`, còn checkout transfer là `aebbbe5a...`. Đây là blocker độc lập thứ hai.
- User đã chọn thiết kế **relocation-safe validation** thay vì sửa manifest, giả lập đường dẫn máy cũ, hoặc chỉ ghi BLOCKED.

### 2.2 Config và handover state

- `config/phase2/candidates.yaml` giữ `baseConfig.device: cpu`.
- `config/phase2/gate.yaml` giữ `meta.preAgreedPlaceholders: true` và `notTunedOnPhaseAFinal: true`.
- Final, replay và live shadow chưa chạy theo handover và archive inventory.
- GitNexus index đang chậm hơn HEAD 27 commits; kết quả graph hiện tại chỉ dùng để định vị, không được xem là bằng chứng an toàn cho production edits. Trước bất kỳ sửa function/class/method nào phải refresh index hoặc dùng CLI/MCP trên index cập nhật rồi chạy impact.

## 3. Phạm vi

### 3.1 In scope

1. Restore dataset/model artifacts từ transfer archives nếu operational paths chưa tồn tại, chỉ sau khi checksum và archive inventory hợp lệ.
2. Verify dataset, immutable selection, exact frozen inventory, hashes và provenance compatibility.
3. Tổng hợp dev-only evidence của đủ 24 candidates và winner.
4. Xin user phê duyệt từng gate threshold và đầy đủ approval provenance.
5. Thêm relocation-safe provenance validation có phạm vi hẹp để trusted transfer có thể chạy ở artifacts root và compatible source revision mới mà không sửa manifest identity/hash.
6. Sau revised Spec và Plan approval, cập nhật duy nhất gate policy đã duyệt.
7. Preflight và chạy `fishing_ml.experiments confirm-final` đúng một lần.
8. Ghi immutable results ledger trung thực theo exit status.
9. Nếu final contract cho phép, chạy inference service local từ frozen winner, replay và adjudication.
10. Ghi sanitized aggregate replay evidence và handover cuối.

### 3.2 Out of scope

- Live shadow, TX43, `finishFishing()`, hoặc gameplay mutation.
- Regenerate dataset, 24-candidate matrix, selection hoặc freeze.
- MPS/auto-device artifacts; `device: cpu` là invariant.
- Model/threshold retuning sau khi final được mở.
- Dependency, database schema hoặc unrelated refactor.
- Đọc `final.txt`, final labels, final predictions hay final errors trước gate-policy approval và one-shot final command.
- Commit/push/merge/publish nếu user chưa yêu cầu riêng.

## 4. Pre-final evidence

### 4.1 Ma trận 24 candidates

Accepted rate dưới đây là `thresholds.metrics.acceptedCount / dev-metrics.query_count`. Raw top-1 và batch exact lấy từ dev metrics; wrong accepted lấy từ calibrated dev thresholds. Tất cả là dev-only evidence trong transfer archive.

| Candidate (augmentation / hard-negative / temp / dim) | Accepted rate | Raw top-1 | Batch exact | Wrong accepted |
|---|---:|---:|---:|---:|
| none / off / 0.05 / 128 | 0.401914 | 0.980861 | 0.933333 | 0 |
| none / off / 0.05 / 96 | 0.488038 | 0.971292 | 0.900000 | 0 |
| none / off / 0.07 / 128 | 0.244019 | 0.980861 | 0.933333 | 0 |
| none / off / 0.07 / 96 | 0.234450 | 0.976077 | 0.900000 | 0 |
| none / ratio_0.25 / 0.05 / 128 | 0.344498 | 0.976077 | 0.900000 | 0 |
| none / ratio_0.25 / 0.05 / 96 | 0.358852 | 0.971292 | 0.866667 | 0 |
| none / ratio_0.25 / 0.07 / 128 | 0.454545 | 0.976077 | 0.900000 | 0 |
| none / ratio_0.25 / 0.07 / 96 | 0.119617 | 0.966507 | 0.833333 | 0 |
| photometric / off / 0.05 / 128 | 0.492823 | 0.980861 | 0.933333 | 0 |
| photometric / off / 0.05 / 96 | 0.358852 | 0.980861 | 0.933333 | 0 |
| photometric / off / 0.07 / 128 | 0.253589 | 0.976077 | 0.900000 | 0 |
| photometric / off / 0.07 / 96 | 0.196172 | 0.980861 | 0.933333 | 0 |
| photometric / ratio_0.25 / 0.05 / 128 | 0.574163 | 0.980861 | 0.933333 | 0 |
| photometric / ratio_0.25 / 0.05 / 96 | 0.263158 | 0.980861 | 0.933333 | 0 |
| photometric / ratio_0.25 / 0.07 / 128 | 0.382775 | 0.980861 | 0.933333 | 0 |
| photometric / ratio_0.25 / 0.07 / 96 | 0.186603 | 0.976077 | 0.900000 | 0 |
| photometric_plus_geom / off / 0.05 / 128 | **0.612440** | **0.980861** | **0.933333** | **0** |
| photometric_plus_geom / off / 0.05 / 96 | 0.373206 | 0.980861 | 0.933333 | 0 |
| photometric_plus_geom / off / 0.07 / 128 | 0.483254 | 0.980861 | 0.933333 | 0 |
| photometric_plus_geom / off / 0.07 / 96 | 0.301435 | 0.980861 | 0.933333 | 0 |
| photometric_plus_geom / ratio_0.25 / 0.05 / 128 | 0.306220 | 0.980861 | 0.933333 | 0 |
| photometric_plus_geom / ratio_0.25 / 0.05 / 96 | 0.334928 | 0.980861 | 0.933333 | 0 |
| photometric_plus_geom / ratio_0.25 / 0.07 / 128 | 0.401914 | 0.980861 | 0.933333 | 0 |
| photometric_plus_geom / ratio_0.25 / 0.07 / 96 | 0.521531 | 0.980861 | 0.933333 | 0 |

Summary: 24/24 candidates có zero wrong accepted; winner có accepted rate cao nhất. Raw top-1 của winner là 205/209 = 0.980861; batch exact là 28/30 = 0.933333. Calibrated winner accepts 128/209 = 0.612440 với accepted accuracy 1.0 và wrong accepted 0.

### 4.2 Winner thresholds và environment

- `minSimilarity`: `0.9742758274078369`
- `minMargin`: `0.007909834384918213`
- Threshold source: `dev-predictions.json`, SHA-256 `af7b09125536385e88c75f0d07a90a75b7bafcc64a73e410532fa0ae254058a3`, split `dev`.
- Python `3.12.13`; PyTorch `2.13.0`; NumPy `2.5.2`; Pillow `11.3.0`; scikit-image `0.25.2`; PyYAML `6.0.3`.
- Platform `macOS-26.2-arm64-arm-64bit`; device `cpu`; deterministic algorithms enabled; no recorded determinism limitations.
- Model: `photometric_plus_geom`, no hard negatives, temperature `0.05`, embedding `128`, seed `20260827`.

## 5. Gate-policy alternatives

### A. Giữ nguyên toàn bộ placeholders

Rejected. `minAcceptedRate=0.85` và `minBatchExactMatch=0.95` đều cao hơn winner dev evidence (`0.612440`, `0.933333`). Gọi đó là pre-agreed policy sau khi đã có dev evidence sẽ không phản ánh Gate 2A review, và coverage threshold 0.85 không có empirical support từ bất kỳ candidate nào.

### B. Đặt thresholds sát đúng winner dev metrics

Rejected. Dùng chính các số `0.612440` và `0.933333` làm minima làm gate giòn theo sample granularity và gần như encode observed winner metrics. Nó không tạo safety margin và dễ bị hiểu là optimization để pass một observed sample.

### C. Chốt conservative rounded thresholds từ dev evidence (recommended)

Recommended: hạ coverage minima có căn cứ, giữ quality và safety gates, giữ latency/error budgets như pre-final engineering contracts. Cách này không dùng final, không hạ zero-wrong-accepted, và vẫn yêu cầu final/replay chứng minh generalization.

## 6. Gate policy đề xuất để user phê duyệt

Mỗi giá trị dưới đây phải được user phê duyệt rõ ràng trước khi sửa file:

| Field | Current placeholder | Proposed official | Rationale |
|---|---:|---:|---|
| `coverage.minAcceptedRate` | 0.85 | **0.60** | Winner dev đạt 0.612440 (128/209); 0.60 là floor làm tròn, vẫn đòi coverage gần winner và không đánh đổi zero-wrong-accepted. |
| `coverage.minBatchExactMatch` | 0.95 | **0.90** | Winner raw dev đạt 28/30 = 0.933333; 0.90 là floor nguyên theo batch granularity, không encode đúng observed value. |
| `coverage.minTop1Accuracy` | 0.98 | **0.98** | Winner đạt 205/209 = 0.980861; giữ nguyên quality floor, không hạ safety gate để dễ pass. |
| `latency.budgetMs` | 50 | **50** | Không có latency evidence từ training artifacts; giữ nguyên local engineering budget, không tune từ final. |
| `latency.p95Ms` | 100 | **100** | Replay-only operational ceiling; không có bằng chứng pre-final để nới. |
| `latency.maxMs` | 250 | **250** | Hard ceiling; giữ nguyên và semantics là strict `< 250 ms`. |
| `errorBudget.maxErroredBatchRate` | 0.01 | **0.01** | Giữ fail-closed operational budget; không có lý do evidence-based để nới. |
| `errorBudget.maxOmittedRate` | 0.0 | **0.0** | Complete labeled-ground-truth replay là bắt buộc; omission không được chấp nhận. |
| `errorBudget.requireSingleModelIdentity` | true | **true** | Ngăn mixed-model evidence. |
| `gate.requireZeroWrongAccepted` | true | **true** | Non-negotiable primary safety gate. |

Approval metadata bắt buộc phải có giá trị thật, không để trống:

```yaml
meta:
  preAgreedPlaceholders: false
  revisitAt: "2A"
  notTunedOnPhaseAFinal: true
  approvedAt: "<UTC ISO-8601 do user cung cấp/phê duyệt>"
  approvedBy: "<approver identity do user cung cấp/phê duyệt>"
  evidence: "<durable approval reference do user cung cấp/phê duyệt>"
```

Nếu thiếu bất kỳ metadata hoặc threshold approval nào, trạng thái là **BLOCKED**, giữ `preAgreedPlaceholders: true`, và không chạy `confirm-final`.

## 7. Kiến trúc và execution flow

### Stage R — Restore và verify

1. Re-verify `SHA256SUMS` trước extraction.
2. Inspect every archive member. Reject absolute paths, `..`, links/devices và mọi non-metadata entry ngoài allowed prefixes.
3. Vì có AppleDouble entries ngoài documented prefixes, Plan phải dùng staging directory mới; extract không-overwrite, loại duy nhất `._*` metadata, rồi verify expected content trước atomic placement vào operational paths. Nếu operational path tồn tại hoặc có conflict, stop và hỏi user; không merge.
4. Verify Python environment, dataset-version, namespaces, validator contract, split counts/checksums mà không đọc nội dung final split.
5. Verify selection hash, exact 24 canonical manifests, frozen inventory (9 files), freeze-manifest hash và checkpoint hash.
6. Confirm no existing final terminal artifacts by filename scan only.

### Stage V — Relocation-safe provenance validation

Production change is narrowly limited to trusted-artifact relocation and compatible-source verification:

1. Keep immutable archive documents byte-exact. Never rewrite `runDir`, `thresholdsPath`, `gitRevision`, selection, freeze manifest, or hashes.
2. Replace equality against archived absolute paths with a content-bound relocation rule: the current candidate manifest must live at `<current artifacts root>/phase2-experiments/<runId>.json`; operational run files must live at `<current artifacts root>/<runId>/`; the archived `runDir` and `thresholdsPath` must be absolute, internally consistent with that same `runId`, and may differ only in the prefix preceding `/artifacts/`. Reject basename changes, traversal, symlinks, non-regular files, or inconsistent archived paths.
3. Preserve recorded training revision as immutable provenance. Permit a newer current revision only through an explicit, machine-verifiable compatibility allowlist in source/config that maps current revision `aebbbe5a01affddebf7e0c7e8244e6a1e1fd3288` to trusted training revision `8ca1f93990dcd06a0b7d6ee6251100e67a155365`; no arbitrary ancestor or dirty-tree acceptance. The allowlist records that intervening relevant Phase 2 production code is compatible; any other HEAD remains invalid.
4. Require a clean working tree for production files before final. The approved gate config and execution ledgers are expected controlled changes and must be explicitly accounted for; unreviewed source/config changes block final.
5. Apply the same revision compatibility decision consistently to candidate manifest and selection validation. Freeze verification continues to bind the recorded revision and every frozen file checksum.
6. Add tests only if the user explicitly authorizes them, per repository policy. Without new tests, verify using existing focused suites plus read-only CLI checks covering original path, relocated path, unapproved revision, malformed path and hash mismatch fixtures already available; if existing fixtures cannot cover these cases, stop and ask for test authorization before production edit.
7. GitNexus impact is mandatory immediately before editing. Current stale-index attempt returned `risk: UNKNOWN` for `_validate_manifest_current_provenance` and `_validate_selection_document`; execution must refresh the index and obtain a resolved impact result. HIGH/CRITICAL requires a user warning and renewed approval before edits; UNKNOWN remains blocked.

### Stage G — Approval và policy publication

1. Present Section 6 values and request explicit approval plus `approvedAt`, `approvedBy`, `evidence`.
2. Only after Spec and Plan approval plus complete metadata, run GitNexus impact if production symbols need changes. Expected work is config/docs only; no function/class/method edit is planned.
3. Modify only `config/phase2/gate.yaml` values approved by user.
4. Strictly parse the policy and verify `preAgreedPlaceholders: false`, `notTunedOnPhaseAFinal: true`, zero wrong accepted and exact approved metadata.
5. Stop and ask again immediately before one-shot final, as required by the authorization boundary.

### Stage F — One-shot final

Preflight must all pass in the same operational checkout:

- Git/provenance compatibility with recorded training revision; any compatibility exception must be explained and approved before final.
- Dataset-version, selection, freeze-manifest and checkpoint hashes exactly match trusted values.
- Exact frozen inventory passes verifier.
- Gate parser passes and policy is no longer placeholder.
- No `final-evaluation.lock`, `final-evaluation.json`, or `gate-final.json` exists.
- `--confirm-final-once` exactly equals selected run ID.
- Command uses absolute paths from the handover.

Then invoke `fishing_ml.experiments confirm-final` once. Capture command, start/end UTC, exit status and generated immutable filenames. Interpret exactly: 0 pass; 2 invalid input/provenance/publication conflict; 3 mandatory gate fail; 4 blocked. Never delete, overwrite or rerun terminal artifacts.

### Stage P — Post-final branching

- Exit 0: final contract passed; replay may proceed after recording final result and re-verifying frozen identity.
- Exit 3: record durable fail and stop replay. Replay is not authorized as independent evidence in this design after a mandatory quality failure.
- Exit 2 or 4: record invalid/blocked state and stop. Do not rerun. Any recovery requires a new Spec/Plan and must preserve existing terminal artifacts.
- Unexpected termination/status: treat as blocked/uncertain, preserve all files, and stop for user adjudication.

### Stage I/R — Local service, replay và adjudication

Only after final exit 0:

1. Re-verify checkpoint checksum from freeze manifest and start service bound only to `127.0.0.1:8080` from frozen directory.
2. Health/identity check must prove the one selected run/checkpoint; mismatch stops execution.
3. Replay only labeled batches against `/infer`, using trusted checksum `6168...`; no live traffic and no game actions.
4. Write replay report with no-clobber semantics. If target exists, stop; never overwrite.
5. Verify labeled-ground-truth completeness; request count equals latency sample count plus explicitly accounted errors; no omissions; single model identity; zero wrong accepted; accepted rate, raw top-1, batch exact, p95, strict max latency and error budgets.
6. Adjudicate to a new no-clobber gate report; record exact command and exit status.
7. Stop local service and confirm port/process termination.

## 8. Data contracts và privacy

Allowed ledgers/reports: run/checkpoint IDs and hashes, aggregate counts/rates, aggregate grouped dimensions without user/account identity, latency aggregates/sample counts, timestamps, command/exit status, sanitized error categories.

Forbidden: images/base64, raw or decrypted packet bytes, tokens/passwords/cookies/credentials, game account/user IDs, per-user live telemetry, and final per-example predictions/errors in documentation. A privacy scan must run before any results ledger is considered complete.

## 9. Files/modules liên quan

- `config/phase2/gate.yaml`: only planned production-config modification after approval.
- `config/phase2/candidates.yaml`: read-only invariant (`device: cpu`).
- `src/fishing_ml/experiments.py`: narrowly scoped relocation-safe path and revision compatibility validation, plus existing `confirm-final` and `adjudicate-replay`.
- `src/fishing_ml/phase2_gate.py`: existing parser/gates; no code edit planned.
- `src/fishing_ml/artifacts.py`: exact frozen inventory verification; no code edit planned.
- `src/fishing_ml/inference_service.py`: local frozen inference service; no code edit planned.
- `src/fishing_ml/replay.py`: local replay; no code edit planned.
- `artifacts/phase2-selection.json` and selected `frozen/`: immutable operational inputs.
- Selected-run final/replay artifacts: immutable/no-clobber outputs.
- `docs/superpowers/plans/2026-09-05-fishing-phase-2-final-and-replay-results.md`: planned sanitized results ledger.
- `docs/handoffs/2026-09-05-fishing-phase-2-final-and-replay-handover.md`: planned final handover.

## 10. Edge cases và fail-closed rulings

- Missing/mismatched archive hash: do not extract or regenerate.
- Existing partial operational paths: do not merge/overwrite; stop for user decision.
- AppleDouble metadata: exclude only through reviewed staging logic; never relax allowed paths generally.
- Missing candidate evidence or metrics denominator mismatch: policy remains blocked.
- Approval metadata incomplete/non-UTC/non-durable: policy remains blocked.
- Any pre-existing final artifact: do not invoke final.
- Hash, non-allowlisted revision, malformed relocation path, model identity, inventory or parser mismatch: block final/replay.
- Relocation logic that would accept a different run ID, non-`artifacts/` suffix, dirty/unapproved production source, or arbitrary revision ancestry: reject; never broaden the trust boundary to make execution pass.
- Port 8080 occupied or endpoint identity mismatch: stop without replay.
- Incomplete labels, omission, sample-count inconsistency or privacy violation: replay gate fails/blocks; preserve evidence.
- Any request for live shadow remains a separate authorization cycle with bounded duration and kill switch.

## 11. Verification plan

### Before gate update

- Verify branch/HEAD/status and transfer hashes.
- Verify archive member policy in staging design.
- Restore only into absent operational paths.
- Run environment and existing focused Phase 2 tests; no new tests are requested or planned.
- Verify dataset identity/hash, namespaces, expected six known missing-label issues, and 140/30/30 split contract without opening final contents.
- Refresh GitNexus index, run upstream impact for every production symbol to edit, and block on UNKNOWN; warn/reconfirm on HIGH or CRITICAL.
- Verify relocation-safe validation accepts only the exact trusted old-root → current-root mapping and explicit `aebbbe5a...` → `8ca1f939...` compatibility pair; malformed paths, arbitrary revisions, dirty production source and hash changes fail.
- Verify 24/24 manifests and strict reuse-equivalent read-only validation; never invoke a command path that can retrain or rewrite artifacts during restore verification. Verify winner and all trusted hashes.

### After approved gate update

- Parse gate config through production parser.
- Compare serialized values byte-for-value/field-for-field with explicit user approval.
- Assert placeholders false, `notTunedOnPhaseAFinal` true, single identity true, omission zero, zero wrong accepted true.

### Before and after final

- Run complete preflight immediately before command.
- Record exact one invocation and exit status.
- Verify terminal files appear consistently; never inspect final evidence for retuning.
- Privacy-scan sanitized ledger.

### Replay

- Verify service identity/checksum and localhost binding.
- Verify replay aggregate schema, completeness, model identity, checksum, gate calculations and latency sample consistency.
- Confirm no-clobber outputs and service shutdown.

### Before any requested commit

- Run `gitnexus_detect_changes(scope="all")`; partial/truncated is not acceptable.
- Review diff and ensure generated dataset/checkpoints are neither staged nor committed.
- Commit only if user explicitly requests it.

## 12. Approval gates

1. **Revised Spec approval:** the initial Spec was approved, but the absolute-path/revision blocker changed architecture. User must approve this relocation-safe revision before Plan creation.
2. **Plan approval:** user approves the implementation plan before restore/code/config/execution.
3. **Gate-policy approval:** user explicitly approves every threshold and supplies/approves `approvedAt`, `approvedBy`, `evidence` before policy edit.
4. **Final execution authorization:** after successful preflight, stop and obtain explicit approval immediately before the irreversible one-shot command.
5. **Live shadow:** excluded; requires separate authorization and design.


## Approved verification-sequencing amendment (2026-09-05)

User approved with `ok` after the Task 5 boundary question. This section supersedes conflicting pre-final verifier instructions below, including Task 7 preflight. Before the separately authorized one-shot invocation, verify dataset-version metadata, train/dev candidate provenance, exact frozen inventory and all payload hashes, and byte equality to trusted archives. Do not run the whole-dataset semantic validator or parse the frozen dataset snapshot before authorization. The historical 200 completed / 1,375 pairs / six LABEL_MISSING results remain transfer evidence until revalidated later.

After the authorized one-shot command opens final, run the deferred dataset validator and production frozen verifier once as read-only integrity checks; capture their actual exit statuses and aggregate results regardless of final pass/fail. Never rerun final, retune, or permit replay after a nonzero final result. These deferred checks remain required execution work in Task 8 and must not be presented as already completed. Policy approval and immediate final authorization remain separate gates.
