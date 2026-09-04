# Fishing Matcher Phase 2 Freeze Execution Design

## Mục tiêu và bối cảnh

Fishing Phase 2 đã hoàn tất production code và durable verification trên `main`, nhưng chưa có bằng chứng vận hành trên dataset Phase 2 thật. Trạng thái hiện tại phải tiếp tục được mô tả là `codeComplete: true`, trong khi offline gate và replay gate vẫn blocked, live shadow chưa chạy.

Đợt công việc này đưa Phase 2 từ code-complete đến một frozen candidate đã được lựa chọn và verify bằng quy trình có thể kiểm toán. Quy trình dừng trước one-shot final. Nó không phê duyệt gate policy, không đọc final để tuning hoặc selection, không chạy replay/live shadow, và không gửi TX43 hoặc gọi `finishFishing()`.

Mục tiêu cuối cùng khi toàn bộ prerequisite sẵn sàng:

```text
readiness: pass
candidateRuns: 24/24 verified
selection: published immutable
freeze: verified
final: not-opened
```

Nếu prerequisite dữ liệu chưa sẵn sàng, kết quả hợp lệ của đợt thực hiện là readiness `BLOCKED`, một báo cáo blocker rõ ràng, và không có training nào được bắt đầu.

## Phạm vi

### In scope

1. Xác minh repository revision và working-tree safety trước vận hành.
2. Xác minh môi trường Python 3.12 tương thích với `pyproject.toml` và import được toàn bộ dependency.
3. Chạy lại focused Python Phase 2 tests và verification TypeScript/server liên quan.
4. Kiểm tra namespace, schema, provenance, integrity và split/review readiness của dataset Phase 2.
5. Liệt kê đúng ma trận 24 candidates từ cấu hình đã commit.
6. Chạy tuần tự từng candidate, strict-validate output sau mỗi run, và hỗ trợ resume từ artifact hợp lệ.
7. Compare đủ toàn bộ 24 candidates và publish selection immutable.
8. Freeze selected candidate và independently verify frozen artifact.
9. Ghi evidence vận hành, blocker/failure hoặc freeze completion vào ledger không chứa dữ liệu nhạy cảm.
10. Xác nhận không tạo final lock, final evaluation hoặc final gate report.

### Out of scope

1. Tạo, import, copy hoặc chỉnh sửa dataset Phase 2.
2. Label dữ liệu, sửa reviewer decision hoặc duplicate-review evidence.
3. Tạo hoặc thay đổi train/dev/final split.
4. Tự động dùng Phase A data làm Phase 2 data.
5. Thay đổi candidate matrix, training semantics hoặc selection policy.
6. Sửa hoặc phê duyệt `config/phase2/gate.yaml`.
7. Chạy `confirm-final` hoặc đọc final để tính metrics, thresholds hay selection.
8. Khởi động inference service cho replay thật.
9. Chạy replay, live shadow hoặc bất kỳ game-control action nào.
10. Gửi TX43 hoặc gọi `finishFishing()`.
11. Sửa production code khi gặp defect. Defect phải được điều tra và xử lý qua một chu kỳ Spec → Plan riêng.

### Input

- Checkout `main` tại một Git revision cố định.
- Python virtual environment dùng Python `>=3.11,<3.13`, ưu tiên 3.12.
- Candidate config: `avatar-web/fishing-ml/config/phase2/candidates.yaml`.
- Dataset config: `avatar-web/fishing-ml/config/phase2/dataset.yaml`.
- Duplicate reviews: `avatar-web/fishing-ml/config/duplicate-reviews.json`.
- Dataset namespace dự kiến: `avatar-web/fishing-ml/data/phase2/`.
- Artifact root: `avatar-web/fishing-ml/artifacts/`.

### Output

Khi readiness blocked hoặc fail:

- Readiness evidence ghi Git revision, runtime, checks và stable blocker/failure reason.
- Không có candidate run mới.
- Trạng thái execution là `not-started`.

Khi hoàn tất đến freeze:

- 24 candidate manifests và 24 run directories strict-valid.
- `artifacts/phase2-selection.json` immutable và verify được.
- Frozen directory của selected run có freeze manifest hợp lệ.
- Execution ledger ghi selected run ID và trusted artifact hashes.
- Không có final artifacts mới.

## Trạng thái prerequisite hiện tại

Tại thời điểm thiết kế:

- Production code và durable tests đã merge vào local `main`.
- Python project yêu cầu `>=3.11,<3.13` cùng NumPy, Pillow, scikit-image, PyYAML và Torch.
- Môi trường `.venv` Python 3.12 đã được phát hiện trong lần khảo sát và import được các dependency cần thiết; implementation plan vẫn phải verify lại bằng command thực tế trước khi dùng.
- `data/phase2/` chưa tồn tại.
- Không có 24 Phase 2 run artifacts.
- Không có `artifacts/phase2-selection.json`.
- Không có Phase 2 frozen candidate.
- Gate policy vẫn là placeholder và không thuộc phạm vi thay đổi của đợt này.

Do đó lần thực thi đầu tiên dự kiến dừng `BLOCKED` tại dataset readiness, trừ khi dataset Phase 2 được chuẩn bị độc lập trước khi plan được chạy.

## Kiến trúc và giải pháp kỹ thuật

### Tổng quan hai gate

```text
Merged main at fixed revision
          |
          v
Gate R: repository + runtime + tests + dataset readiness
          |
          +--- BLOCKED/FAIL ---> publish evidence ---> STOP
          |
          v PASS
Enumerate exactly 24 canonical candidates
          |
          v
Run candidate 01 -> strict verify -> checkpoint ledger
          |
          v
...
          |
          v
Run candidate 24 -> strict verify -> checkpoint ledger
          |
          v
Complete-set validation
          |
          v
Compare -> immutable selection
          |
          v
Freeze -> independent freeze verification
          |
          v
Publish execution evidence -> STOP before final
```

### Gate R: Repository readiness

Gate R phải xác nhận:

1. Current branch là `main`.
2. Git revision được ghi lại và giữ nguyên đến hết freeze.
3. Không có thay đổi không liên quan trong vùng Fishing Phase 2 có thể làm sai provenance.
4. Existing user changes ngoài phạm vi không bị sửa, stage hoặc xóa.
5. `git diff --check` không phát hiện whitespace errors trong phần thay đổi do đợt vận hành tạo ra.

`AGENTS.md` và `CLAUDE.md` đang có local modification tại thời điểm thiết kế. Đây là thay đổi có sẵn của user và phải được giữ nguyên. Readiness không được coi working tree hoàn toàn sạch là điều kiện tuyệt đối; thay vào đó nó phải ghi nhận các path có sẵn, xác nhận chúng không thuộc artifact/model provenance, và không chỉnh sửa chúng.

### Gate R: Runtime readiness

Các check bắt buộc:

1. Python version nằm trong `>=3.11,<3.13`.
2. Python executable resolve vào virtual environment được chọn.
3. `fishing_ml` resolve về source tree của checkout hiện tại.
4. Import thành công `torch`, `numpy`, `PIL`, `skimage`, `yaml`.
5. Ghi version runtime và dependency vào evidence.
6. Không tự động nâng cấp dependency trong execution flow.

Nếu virtual environment thiếu hoặc dependency không hợp lệ, Gate R trả `BLOCKED`. Việc tạo/cài environment chỉ được thực hiện nếu implementation plan liệt kê rõ command và user đã duyệt plan.

### Gate R: Code verification

Verification phải chạy trước dataset access có khả năng tạo artifact:

1. Focused Python Phase 2 test modules.
2. Server test suite.
3. TypeScript typecheck.
4. Production build.
5. Safety scan cho TX43 và `finishFishing()` trong Phase 2 paths.
6. Privacy/generated-artifact scan theo các rule đã có trong completion ledger.

Một test/build/safety failure trả `FAIL`; workflow dừng trước training.

### Gate R: Dataset namespace và version

Dataset Phase 2 phải dùng namespace riêng:

```text
avatar-web/fishing-ml/data/phase2/
├── raw/
├── labels/
├── splits/
│   ├── train.txt
│   ├── dev.txt
│   └── final.txt
└── dataset-version.json
```

Readiness phải:

1. Resolve raw/labels/splits bằng `fishing_ml.dataset_version namespace`.
2. Xác nhận path không trỏ sang Phase A namespace.
3. Verify `dataset-version.json` bằng CLI hiện có.
4. Chạy `fishing_ml.validate` trên raw và labels.
5. Chỉ áp dụng minima nếu chúng đã được thống nhất và cấu hình trước; plan không tự tạo threshold mới.
6. Không dùng `--report` trong read-only preflight nếu command đó tạo file ngoài ledger đã duyệt.

Nếu namespace hoặc version document thiếu, trạng thái là `BLOCKED`. Nếu tồn tại nhưng schema/provenance/integrity sai, trạng thái là `FAIL`.

### Gate R: Splits và duplicate reviews

Readiness phải xác nhận:

1. `train.txt`, `dev.txt`, `final.txt` tồn tại.
2. Train/dev data đủ để list và chạy candidate matrix.
3. Split validation không có overlap hoặc foreign IDs.
4. Duplicate-review evidence tồn tại, parse được và đầy đủ theo validator hiện có.
5. Final chỉ được kiểm tra existence/integrity bằng path/checksum contract; không được dùng label/prediction từ final cho training, calibration, compare hoặc selection.

Nếu thiếu dữ liệu/review, workflow trả `BLOCKED` và dừng. Đợt này không sửa dữ liệu tại chỗ.

## Candidate execution

### Canonical matrix

Nguồn chuẩn duy nhất là output của:

```bash
python -m fishing_ml.experiments list ...
```

Expected count là 24, tạo từ ma trận đã commit. Workflow không tự dựng `runId` bằng shell naming convention và không bổ sung candidate ngoài cấu hình.

Nếu count khác 24, có duplicate identity hoặc list không verify được dataset/splits, workflow trả `FAIL`.

### Sequential checkpoint policy

Các candidate được chạy tuần tự theo thứ tự canonical từ output `list`.

Với mỗi candidate:

1. Xác nhận Git revision chưa đổi.
2. Chạy đúng một `runId` hoặc matrix key do `list` phát ra.
3. Ghi exit code và sanitized log location.
4. Strict-validate experiment manifest.
5. Strict-validate các reusable output bắt buộc:
   - `model-config.json`
   - `normalization.json`
   - `dev-predictions.json`
   - `dev-metrics.json`
   - `thresholds.json`
   - `training-history.json`
   - `environment.json`
   - `checkpoints/best-dev.pt`
6. Ghi trạng thái candidate vào execution ledger.
7. Chỉ chuyển candidate kế tiếp khi validation pass.

Chạy tuần tự là lựa chọn bắt buộc của đợt này để tránh GPU/RAM contention, artifact publication race và log khó audit.

### Resume semantics

- Không có run artifact: chạy candidate mới.
- Có artifact đầy đủ và strict validation pass: reuse idempotently.
- Artifact thiếu, tampered, không đúng revision/dataset/config: dừng `FAIL`.
- Không xóa artifact lỗi.
- Không overwrite hoặc dùng force flag.
- Không skip candidate lỗi để compare tập thiếu.
- Sau khi nguyên nhân được xử lý trong một đợt riêng, workflow có thể resume và reuse các candidate đã verify.

### Failure behavior

Một candidate process fail hoặc output validation fail phải:

1. Dừng queue ngay.
2. Giữ nguyên artifact và logs để điều tra.
3. Ghi candidate ID, stage và stable failure reason.
4. Không chạy compare.
5. Không tự retry vô hạn.

Implementation plan có thể cho phép một lần retry thủ công sau khi xác định lỗi transient, nhưng retry phải dùng cùng revision/config/dataset và không được overwrite conflicting artifact.

## Compare và immutable selection

Compare chỉ được chạy khi:

1. Canonical matrix có đúng 24 candidates.
2. Có đúng 24 manifests tương ứng.
3. Tất cả run outputs strict-valid.
4. Dataset version, train/dev checksum, effective config và Git revision nhất quán.

Selection policy giữ nguyên từ `candidates.yaml`:

1. Zero wrongly accepted dev queries.
2. Highest accepted rate.
3. Highest raw top-1 accuracy.
4. Highest batch exact match.
5. Stable run-ID tie-break.

Workflow không được hạ zero-wrong-accepted hoặc thay tie-break order. Nếu không có eligible candidate, compare trả gate failure; execution kết thúc không có selection.

`artifacts/phase2-selection.json` được publish no-replace. Byte-identical reuse được chấp nhận; conflicting replacement là `FAIL` và không được xóa để chạy lại.

## Freeze và independent verification

Freeze chỉ được chạy khi selection:

1. Parse và verify được.
2. Trỏ đến một candidate trong canonical matrix.
3. Khớp current Git revision, dataset version và train/dev checksums.
4. Trỏ đến run outputs/checkpoint strict-valid.

Expected frozen outputs nằm dưới selected run:

```text
artifacts/<selected-run-id>/frozen/
├── best-dev.pt
├── model-config.json
├── normalization.json
├── thresholds.json
├── environment.json
├── dev-metrics.json
├── dataset-snapshot.json
├── split-checksums.json
└── freeze-manifest.json
```

Sau freeze, workflow phải chạy verifier hiện có độc lập với success exit của freeze command. Completion ledger ghi tối thiểu:

- selected run ID;
- checkpoint SHA-256 lấy từ verified freeze manifest;
- freeze-manifest SHA-256;
- dataset identity;
- Git revision.

Nếu independent verification fail, trạng thái là `freeze: failed`; selection được giữ nguyên nhưng không được tuyên bố Phase 2A freeze complete.

## Evidence và ledger

### Ưu tiên không thêm production code

Đợt này ưu tiên orchestration bằng CLI hiện có. Không tạo runner hoặc ledger publisher mới nếu không cần thiết.

Evidence có thể được ghi trong một completion document dưới:

```text
docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md
```

Nếu implementation plan yêu cầu machine-readable evidence, chỉ được tạo các file aggregate, sanitized:

- `avatar-web/fishing-ml/artifacts/phase2-readiness.json`
- `avatar-web/fishing-ml/artifacts/phase2-freeze-execution.json`

Việc tạo chúng phải dùng schema cụ thể trong plan; không sửa production code chỉ để xuất ledger.

### Nội dung evidence tối thiểu

- Schema/version của ledger.
- UTC timestamps.
- Git revision cố định.
- Python executable và dependency versions.
- Verification command IDs và exit status.
- Readiness check codes/status.
- Dataset ID và safe checksums, không chứa sample data.
- Canonical 24 run IDs và trạng thái từng run.
- Selection identity.
- Frozen artifact hashes.
- Stable blocker/failure codes.
- Xác nhận không mở final.

### Privacy

Ledger và logs không được chứa:

- image/base64 payload;
- raw/decrypted packet bytes;
- password, token, cookie hoặc credential;
- game account/user identity;
- per-user live telemetry;
- local secret environment values.

## Error model

### Status

- `PASS`: check/stage hoàn tất và evidence hợp lệ.
- `BLOCKED`: thiếu prerequisite có thể cung cấp mà không chỉ ra corruption, ví dụ dataset namespace chưa tồn tại.
- `FAIL`: integrity, provenance, safety, test hoặc artifact validation sai.
- `NOT_STARTED`: downstream stage chưa được phép chạy.

### Reduction rule

Overall readiness:

1. Có bất kỳ `FAIL` → `FAIL`.
2. Không có `FAIL`, có `BLOCKED` → `BLOCKED`.
3. Tất cả mandatory checks `PASS` → `PASS`.

Downstream candidate execution chỉ được bắt đầu khi overall readiness là `PASS`.

### Stable blocker/failure categories

Plan phải dùng các category rõ ràng, tối thiểu:

- `repository-revision-changed`
- `runtime-incompatible`
- `dependency-missing`
- `verification-failed`
- `phase2-dataset-missing`
- `dataset-version-invalid`
- `dataset-integrity-failed`
- `split-integrity-failed`
- `duplicate-review-incomplete`
- `candidate-matrix-invalid`
- `candidate-run-failed`
- `candidate-artifact-invalid`
- `candidate-set-incomplete`
- `no-eligible-candidate`
- `selection-conflict`
- `freeze-failed`
- `freeze-verification-failed`
- `privacy-or-safety-scan-failed`

## Files và modules liên quan

### Không sửa production code theo mặc định

- `avatar-web/fishing-ml/src/fishing_ml/dataset_version.py` — namespace và dataset-version verification.
- `avatar-web/fishing-ml/src/fishing_ml/validate.py` — raw/label integrity checks.
- `avatar-web/fishing-ml/src/fishing_ml/experiments.py` — list/run/compare/freeze state machine.
- `avatar-web/fishing-ml/src/fishing_ml/artifacts.py` — freeze publication và verification.
- `avatar-web/fishing-ml/src/fishing_ml/config.py` — effective training config parsing.
- `avatar-web/fishing-ml/config/phase2/candidates.yaml` — canonical matrix và selection policy.
- `avatar-web/fishing-ml/config/phase2/dataset.yaml` — Phase 2 namespace/version rules.
- `avatar-web/fishing-ml/config/duplicate-reviews.json` — duplicate evidence input.
- `avatar-web/fishing-ml/config/phase2/gate.yaml` — explicitly out of scope; phải giữ placeholder.

### Tạo tài liệu

- Create: `docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution.md` — implementation plan sau khi Spec được duyệt.
- Create during execution: `docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md` — sanitized results ledger.

### Generated artifacts

Nếu Gate R pass và execution chạy:

- `avatar-web/fishing-ml/artifacts/phase2-experiments/*.json`
- `avatar-web/fishing-ml/artifacts/<run-id>/...`
- `avatar-web/fishing-ml/artifacts/phase2-selection.json`
- `avatar-web/fishing-ml/artifacts/<selected-run-id>/frozen/...`

Generated runtime artifacts không được commit trừ khi repository policy hoặc user có phê duyệt riêng. Results document chỉ tham chiếu safe identities/hashes.

## Data flow và contracts

```text
dataset.yaml + dataset-version.json + raw/labels/splits
                       |
                       v
               readiness checks
                       |
             PASS -----+----- BLOCKED/FAIL -> results ledger
              |
              v
candidates.yaml -> list -> canonical [24 ExperimentSpec]
                              |
                              v sequential
                     train + calibrate each
                              |
                              v
                 immutable run manifests
                              |
                              v complete-set validation
                         compare/select
                              |
                              v
                    phase2-selection.json
                              |
                              v
                         freeze_run
                              |
                              v
                  verified freeze-manifest
                              |
                              v
                       results ledger
```

Key contracts:

- Dataset identity và split checksum phải giữ nguyên từ list đến freeze.
- Effective config là một phần candidate identity.
- Mỗi run manifest gắn Git revision và file hashes.
- Compare yêu cầu complete canonical set.
- Selection là immutable.
- Freeze phải khớp selection và current provenance.
- Final không tham gia bất kỳ input/output nào của flow này.

## Edge cases

1. **`data/phase2` không tồn tại:** readiness `BLOCKED`, không train.
2. **Phase A data tồn tại:** không được copy hoặc alias tự động.
3. **Virtual environment dùng Python 3.13:** readiness `BLOCKED` do không khớp project constraint.
4. **User có uncommitted docs ngoài phạm vi:** ghi nhận và bảo toàn; không tự reset/stash.
5. **Git revision đổi giữa các runs:** dừng `FAIL`; không compare mixed-revision artifacts.
6. **Process bị ngắt sau candidate N:** resume bằng strict validation của 1..N.
7. **Run directory có nhưng manifest thiếu:** `FAIL`, không overwrite.
8. **Manifest có nhưng checkpoint hash sai:** `FAIL`, giữ evidence.
9. **Candidate output byte-identical đã tồn tại:** cho phép reuse nếu validator pass.
10. **Chỉ có 23 eligible/valid manifests:** không compare.
11. **Đủ 24 manifests nhưng không candidate nào zero-wrong-accepted:** kết thúc `no-eligible-candidate`, không đổi policy.
12. **Selection file conflicting đã tồn tại:** `selection-conflict`, không replace.
13. **Freeze directory đã tồn tại:** chỉ reuse nếu verifier chứng minh đúng selected run/current revision.
14. **Freeze command success nhưng verifier fail:** freeze không complete.
15. **Có final lock từ trước:** dừng và điều tra provenance; không xóa hoặc chạy tiếp.
16. **Safety/privacy scan fail:** không tuyên bố completion dù model artifacts hợp lệ.

## Verification plan

### Readiness verification

Chạy và lưu exit status/output aggregate của:

1. Python version/import probe.
2. Focused Python Phase 2 tests.
3. Server full test suite.
4. Server typecheck.
5. Server production build.
6. Dataset namespace resolution.
7. Dataset-version verification.
8. Raw/label validation.
9. Split và duplicate-review validation thông qua CLI/state-machine hiện có.
10. Safety/privacy scans.

Expected khi dataset chưa được cung cấp:

- Runtime/code checks pass.
- Dataset checks `BLOCKED` với `phase2-dataset-missing`.
- Không có Phase 2 candidate artifact mới.

### Candidate verification

Khi readiness pass:

1. `experiments list` trả count 24.
2. Mỗi `run` exit 0.
3. Mỗi manifest và reusable output pass strict validation trước candidate kế.
4. Git revision/dataset/split identity không đổi.
5. Sau run cuối có đúng complete canonical manifest set.

### Selection verification

1. `compare` exit 0.
2. Selection selected run nằm trong canonical matrix.
3. Selection policy order khớp checked-in config.
4. Selection file verify được và không bị replace.

### Freeze verification

1. `freeze` exit 0.
2. Independent freeze verifier pass.
3. Freeze identity khớp selected run.
4. Trusted hashes được ghi từ verified manifest.
5. Không có `final-evaluation.lock`, `final-evaluation.json` hoặc `gate-final.json` mới.

### Repository verification

Trước commit results document:

1. Chạy `gitnexus_detect_changes({scope: "all"})`.
2. Xác nhận không có production symbol bị sửa ngoài kế hoạch.
3. Chạy `git diff --check`.
4. Không stage/commit generated model artifacts nếu chưa được phê duyệt riêng.
5. Giữ nguyên local user changes có sẵn.

## Completion criteria

### Readiness-blocked completion

Đợt thực thi có thể kết thúc an toàn tại readiness nếu:

- Tất cả check có thể chạy đã có evidence.
- Blocker được phân loại rõ.
- Không training nào bắt đầu.
- Results ledger ghi `execution: NOT_STARTED`.
- Không có claim Phase 2A/model completion.

### Freeze completion

Chỉ tuyên bố hoàn tất đến freeze khi:

- Readiness `PASS`.
- Python/server/typecheck/build/safety/privacy verification pass.
- Canonical matrix đúng 24 candidates.
- 24/24 run artifacts strict-valid.
- Compare thành công.
- Immutable selection verify được.
- Selected candidate freeze và independent verification pass.
- Git revision giữ nguyên xuyên suốt.
- Results ledger đã ghi safe provenance/hashes.
- Final chưa được mở.

## Công việc tiếp theo sau Spec này

Sau verified freeze, cần một Spec/Plan riêng cho:

1. Phê duyệt gate policy bằng pre-final evidence.
2. One-shot final confirmation.
3. Real frozen-checkpoint replay và replay adjudication.
4. Live shadow có authorization, bounded duration và kill switch.
5. Bất kỳ automated TX43 behavior nào; nội dung này thuộc Phase 3 và không được suy ra từ việc Phase 2 freeze thành công.
