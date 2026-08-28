# Fishing Image Matching ML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây pipeline Giai đoạn A có thể tái lập để capture/import, gán nhãn, validate, split, baseline, train và đánh giá offline phép ghép `arrImgNew → arrImg`, kết thúc ở final gate mà không tích hợp live hoặc gửi TX43.

**Architecture:** Tách package Python `avatar-web/fishing-ml` thành các module schema/import/label/validate/split/dataset/metrics/model/train/calibrate/artifacts/evaluate có interface rõ ràng; TypeScript chỉ bổ sung khả năng lưu RX79 thành batch immutable. Mọi tuning chỉ dùng train/dev; final chỉ mở sau khi checkpoint, thresholds, dataset snapshot và checksums đã freeze.

**Tech Stack:** Python 3.11, PyTorch 2.4+, NumPy 2.0+, Pillow 10.4+, scikit-image 0.24+, PyYAML 6.0+, Tkinter (stdlib), TypeScript 5.7/Node.js 22.

**Spec:** `docs/superpowers/specs/2026-08-26-auto-fishing-design.md`

## Global Constraints

- Chỉ thực hiện Giai đoạn A; không triển khai inference service, shadow-mode integration, auto-fishing UI/persistence hoặc production TX43.
- Không suy đoán `imgIndex → TX43 byte`; không sửa hành vi production của `FishingService.finishFishing()`, `GameClient`, `AvatarSession` hoặc routes.
- Không dùng TDD và không tạo test files; verification dùng CLI/scripts production và kiểm tra thủ công sau khi code được viết.
- Dataset gate trước khi freeze split: đúng 200 completed batches, tối thiểu 1.000 labeled `new` images; split đúng 140 train / 30 dev / 30 final với seed `20260827`.
- Final split không được dùng để chọn architecture, hyperparameters, checkpoint hoặc thresholds; evaluator final chỉ chạy một lần trên candidate đã freeze.
- PNG phải giữ nguyên bytes nguồn, decode được, đúng 75×75; credentials, cookies, password và full unrelated packet logs không được ghi vào dataset/artifacts.
- Ground truth chỉ do người gán nhãn; baseline không preselect label. Many-to-one hợp lệ, one-reference dùng similarity mà không yêu cầu margin.
- Tiêu chí pass đồng thời: final top-1 accuracy `>= 0.99` và `wrong_count == 0`; pass chỉ xác nhận feasibility, không cho phép live submit.
- Trước khi sửa mỗi symbol hiện hữu phải chạy GitNexus upstream impact; cảnh báo HIGH/CRITICAL phải báo user trước khi edit. Trước mọi commit chạy `gitnexus_detect_changes({scope: "all"})`.
- Không commit generated dataset, PNG, labels/splits chưa privacy-review, venv, checkpoints hoặc run directories; chỉ commit source/config/docs.

---

## File Map and Stable Interfaces

| Path | Responsibility |
|---|---|
| `avatar-web/server/src/game/fishingDecode.ts` | Decode RX79 và lưu batch capture nguyên bản |
| `avatar-web/server/src/tools/fishing-probe.ts` | Authorized live capture CLI, truyền map/area/output directory |
| `avatar-web/fishing-ml/pyproject.toml` | Python package, locked dependency ranges, console scripts |
| `src/fishing_ml/schema.py` | Version-1 dataclasses, JSON conversion, PNG/checksum validation, atomic JSON writes |
| `src/fishing_ml/import_data.py` | Lossless import `data/incoming → data/raw` |
| `src/fishing_ml/label.py` | Unbiased local Tkinter labeling and resume |
| `src/fishing_ml/validate.py` | Dataset validation, counts, stable issue codes, duplicate inventory |
| `src/fishing_ml/split.py` | Deterministic immutable batch-level splits and leakage checks |
| `src/fishing_ml/dataset.py` | RGB tensors, train normalization/augmentation, episodic loading |
| `src/fishing_ml/metrics.py` | Shared predictions, thresholds and metric aggregation |
| `src/fishing_ml/baselines.py` | Binary-shape, SSIM and NCC matchers |
| `src/fishing_ml/model.py` | Shared CNN encoder and cosine episode logits |
| `src/fishing_ml/config.py` | Versioned training configuration |
| `src/fishing_ml/train.py` | Train-only training and dev checkpoint selection |
| `src/fishing_ml/calibrate.py` | Dev-only similarity/margin calibration |
| `src/fishing_ml/artifacts.py` | Dataset snapshot, checksums and immutable freeze |
| `src/fishing_ml/evaluate.py` | Repeatable dev evaluation and one-shot final evaluation |

Stable schema and ML interfaces created by the tasks below:

```python
@dataclass(frozen=True, slots=True)
class ImageEntry:
    index: int
    path: str
    sha256: str

@dataclass(frozen=True, slots=True)
class BatchManifest:
    schema_version: int
    batch_id: str
    captured_at: str
    id_fish: int
    time_delay_ms: int
    map: int | None
    area: int | None
    images: tuple[ImageEntry, ...]
    images_new: tuple[ImageEntry, ...]

@dataclass(frozen=True, slots=True)
class MatchLabel:
    new_index: int
    img_index: int

@dataclass(frozen=True, slots=True)
class BatchLabel:
    schema_version: int
    batch_id: str
    status: Literal["complete", "ambiguous"]
    matches: tuple[MatchLabel, ...]

@dataclass(frozen=True, slots=True)
class FishingEpisode:
    batch_id: str
    references: Tensor       # [R, 3, 75, 75]
    queries: Tensor          # [Q, 3, 75, 75]
    targets: Tensor          # [Q]

@dataclass(frozen=True, slots=True)
class Prediction:
    batch_id: str
    new_index: int
    expected_img_index: int
    predicted_img_index: int
    similarity: float
    margin: float | None
    accepted: bool
```

## Artifact and Data Policy

Commit Python/TypeScript source, `pyproject.toml`, versioned config and artifact documentation. Ignore `avatar-web/fishing-ml/.venv/`, `data/incoming/`, `data/raw/`, `data/labels/`, `data/splits/`, generated reports and all `artifacts/<run-id>/`. A publishable external bundle contains `model.pt`, `model-config.json`, `normalization.json`, `thresholds.json`, `metrics.json`, `split-checksums.json`, `dataset-snapshot.json`, `training-history.json`, `environment.json`, `freeze-manifest.json` and SHA-256 for every file; images require separate approval.

---

### Task 1: Establish the Python Package Boundary

**Files:**
- Create: `avatar-web/fishing-ml/pyproject.toml`
- Create: `avatar-web/fishing-ml/src/fishing_ml/__init__.py`
- Create: `avatar-web/fishing-ml/artifacts/README.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: approved spec and repository Python/Node conventions.
- Produces: importable `fishing_ml` package and console commands `fishing-import`, `fishing-label`, `fishing-validate`, `fishing-split`, `fishing-baseline`, `fishing-train`, `fishing-freeze`, `fishing-evaluate`.

- [x] **Step 1: Run pre-edit impact checks**

No existing code symbol is modified in this task. Record that `.gitignore` is configuration-only and new Python files have no upstream callers.

- [x] **Step 2: Define package metadata and dependencies**

Set `requires-python = ">=3.11,<3.13"`; dependencies `numpy>=2.0,<3`, `Pillow>=10.4,<12`, `scikit-image>=0.24,<0.26`, `PyYAML>=6.0,<7`, `torch>=2.4,<3`; use setuptools with `src` layout. Map each console command to the matching module `main` function. Do not add web frameworks because service implementation is out of scope.

- [x] **Step 3: Add precise ignore and artifact policy**

Add repository-root rules for `avatar-web/fishing-ml/.venv/`, `data/`, `artifacts/*/`, `*.pt`, `.pytest_cache/`; unignore `avatar-web/fishing-ml/artifacts/README.md`. Document external bundle contents and privacy gate in the README.

- [x] **Step 4: Install and verify**

Run:
```bash
cd avatar-web/fishing-ml
python3.11 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e .
.venv/bin/python -c "import fishing_ml; print(fishing_ml.__file__)"
```
Expected: editable install and import succeed; no dataset/artifact generated.

- [x] **Step 5: Detect changes and commit**

Run GitNexus detect-changes, confirm only package/config/docs are affected, then:
```bash
git add .gitignore avatar-web/fishing-ml
git commit -m "feat: scaffold fishing image matching pipeline"
```

### Task 2: Capture RX79 as an Immutable Batch

**Files:**
- Modify: `avatar-web/server/src/game/fishingDecode.ts:70-105`
- Modify: `avatar-web/server/src/tools/fishing-probe.ts:16-91,333-545`
- Modify: `avatar-web/server/package.json:5-13`

**Interfaces:**
- Consumes: `CanCauPayload`, probe map/area and `--output-dir`.
- Produces: `saveCanCauBatch(payload: CanCauPayload, options: { outputDir: string; tag: string; map: number; area: number; capturedAt?: Date }): Promise<SavedCanCauBatch>` where result contains `batchId`, `directory`, `manifestPath`, `imageCount`, `imageNewCount`.

- [x] **Step 1: Analyze blast radius**

Run upstream GitNexus impact for `saveCanCauImages`, `decodeCanCau`, `parseArgs`, and `runProbe`. Report risk/direct callers; stop for user confirmation if HIGH/CRITICAL.

- [x] **Step 2: Replace flat dump with batch writer**

Generate `probe_<UTC milliseconds>_<6 random hex>` without account identity. Create a temporary sibling directory, write exact Buffer bytes to `img/<index>.png` and `new/<index>.png`, compute SHA-256, write schema-v1 manifest with `capturedAt`, `idFish`, `timeDelayMs`, map/area and indexed paths, then atomically rename directory. Reject empty `images`, absent/empty `imagesNew`, collision and partial writes; do not silently swallow errors.

- [x] **Step 3: Wire strict probe arguments and RX79 listener**

Extend `ProbeArgs` with `outputDir: string`, accept each known key exactly once, and reject positional/unknown args. Decode RX79 with `decodeCanCau`, save exactly one batch, print only sanitized batch/count/path metadata, then exit without TX43. Do not retain raw packet hex or account ID in manifest.

- [x] **Step 4: Add scripts and typecheck**

Add `fishing:probe` and `fishing:png-analyze` scripts pointing to existing tools. Run:
```bash
cd avatar-web/server
npm run typecheck
```
Expected: exit 0.

- [x] **Step 5: Authorized live verification**

With Avatar Web stopped:
```bash
npm run fishing:probe -- --account-id 1 --map 14 --area 0 --output-dir ../fishing-ml/data/incoming
```
Expected known sample: manifest, six `img/*.png`, five `new/*.png`, map 14/area 0, no TX43. If no authorized account is available, record live verification as skipped rather than claiming success.

- [x] **Step 6: Detect changes and commit**

Run detect-changes and verify no production auto-fishing flow changed, then commit the three files with `feat: capture fishing images as immutable batches`.

### Task 3: Implement Versioned Schemas and Lossless Import

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/schema.py`
- Create: `avatar-web/fishing-ml/src/fishing_ml/import_data.py`

**Interfaces:**
- Produces: schema dataclasses above plus `load_manifest(path: Path)`, `load_label(path: Path)`, `validate_batch(batch_dir: Path, manifest: BatchManifest)`, `sha256_file(path: Path)`, `atomic_write_json(path: Path, value: Mapping[str, object])`, `import_batch(source: Path, raw_root: Path) -> ImportResult`, `main(argv=None) -> int`.

- [x] **Step 1: Implement strict JSON conversion**

Accept exactly schema version 1 and required camelCase JSON keys; reject unknown/missing fields, non-contiguous indices, unsafe relative paths, duplicate indices, non-UTC timestamps and batchId mismatch. Serialize deterministic UTF-8 JSON with sorted keys and trailing newline.

- [x] **Step 2: Implement image and atomic-write guards**

Verify PNG signature, Pillow decode, format PNG, RGB/RGBA-convertibility, exact `(75, 75)`, file existence and SHA-256. Write JSON to same-directory temp file, fsync, then `os.replace`.

- [x] **Step 3: Implement immutable importer**

Validate source before copy; copy into destination sibling temp directory; verify copied hashes; atomically rename. Existing byte-identical batch is `skipped`; same batchId with different manifest/blob is fatal. Legacy missing `imagesNew` is reported `ineligible` and never copied into training raw root.

- [x] **Step 4: Verify known sample and idempotency**

```bash
.venv/bin/fishing-import --source data/incoming --raw-root data/raw
.venv/bin/fishing-import --source data/incoming --raw-root data/raw
shasum -a 256 data/incoming/*/{img,new}/*.png data/raw/*/{img,new}/*.png
```
Expected: first import reports `6/5`; second skips unchanged batch; corresponding hashes match.

- [x] **Step 5: Detect and commit**

Run detect-changes; commit source only with `feat: import immutable fishing batches`.

### Task 4: Implement Unbiased Manual Labeling

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/label.py`

**Interfaces:**
- Consumes: `BatchManifest` and raw images.
- Produces: `LabelSession(manifest, existing=None)`, `select(new_index, img_index)`, `previous()`, `next()`, `mark_ambiguous()`, `to_label() -> BatchLabel`; CLI atomically writes complete or ambiguous labels.

- [x] **Step 1: Implement session state rules**

Restore existing choices; permit repeated `imgIndex`; reject out-of-range indices; require every query exactly once before complete-save; ambiguous label has `matches=[]` and clears selections.

- [x] **Step 2: Build Tkinter UI**

Show all indexed references, one current query, explicit selected state, Previous/Next, corrected selection, completed/total progress, Save Complete and Mark Ambiguous. Do not calculate or preselect a baseline result.

- [x] **Step 3: Verify mapping, resume and correction**

Run `fishing-label --raw-root data/raw --labels-root data/labels --batch-id <id>`, enter `[1,4,2,1,4]`, close/reopen, correct one choice and reopen again. Expected: five unique new indices, repeated references accepted, state persists atomically.

- [x] **Step 4: Verify ambiguous handling**

Mark a disposable batch ambiguous. Expected JSON status `ambiguous`, empty matches, no partial complete label.

- [x] **Step 5: Detect and commit**

Run detect-changes and commit `feat: add manual fishing image labeling`.

### Task 5: Validate Dataset Integrity and Collection Gate

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/validate.py`

**Interfaces:**
- Produces `ValidationIssue(code, batch_id, detail)`, `ValidationReport(completed_batches, ambiguous_batches, labeled_pairs, issues, duplicate_blobs)`, `validate_dataset(...)`, CLI exit 0 valid / exit 2 invalid.

- [x] **Step 1: Implement stable validation codes**

Cover `MANIFEST_SCHEMA`, `MISSING_FILE`, `PNG_DECODE`, `PNG_SIZE`, `CHECKSUM_MISMATCH`, `INDEX_GAP`, `LABEL_MISSING`, `LABEL_INCOMPLETE`, `LABEL_DUPLICATE_NEW`, `LABEL_RANGE`, `BATCH_ID_MISMATCH`, `DUPLICATE_BLOB`. Sort issues deterministically.

- [x] **Step 2: Implement counts and duplicate inventory**

Count only complete valid labels toward gates; report ambiguous separately. Inventory every PNG SHA-256 with batch/role/index and flag cross-batch duplicates for later split review.

- [x] **Step 3: Verify valid and negative paths**

Validate canonical data and write `artifacts/dataset-validation.json`. In an isolated temporary root exercise missing file, changed checksum, corrupt PNG, out-of-range reference and missing query label. Expected each exits 2 with the corresponding code and canonical data remains unchanged.

- [x] **Step 4: Enforce collection gate**

```bash
.venv/bin/fishing-validate --raw-root data/raw --labels-root data/labels --require-batches 200 --require-pairs 1000
```
Expected before completion: exit 2 with observed/required counts; at completion: exactly 200+ eligible batches and at least 1,000 pairs.

- [x] **Step 5: Detect and commit**

Commit source after detect-changes with `feat: validate fishing image dataset`.

### Task 6: Freeze Leakage-Safe Batch Splits

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/split.py`
- Create: `avatar-web/fishing-ml/config/duplicate-reviews.json`

**Interfaces:**
- Produces `create_splits(..., seed, train_count, dev_count, final_count)`, `validate_splits(...) -> SplitValidation`, immutable `train.txt`, `dev.txt`, `final.txt`.

- [x] **Step 1: Define duplicate review schema**

Create schemaVersion 1 with `reviewedSha256: []`; future entries require checksum, affected batches, reviewer, ISO date, rationale and resolution (`remove`, `regroup`, `accepted`). Acceptance must be explicit and never silent.

- [x] **Step 2: Create deterministic split once**

Use local `random.Random(seed)`, sorted eligible batch IDs, then shuffle. Require exactly 200 eligible batches and counts 140/30/30; refuse existing split files and write all three atomically.

- [x] **Step 3: Validate integrity/leakage**

Require pairwise-empty intersections, every ID present/valid/complete/non-ambiguous, no extras, and no unreviewed duplicate checksum across partitions. Training entry points call this validation before reading episodes.

- [x] **Step 4: Freeze and verify**

Run `fishing-split create ... --seed 20260827 --train-count 140 --dev-count 30 --final-count 30`, then `fishing-split validate ... --duplicate-reviews config/duplicate-reviews.json`. Expected exact counts and no unreviewed leakage. Re-running create must refuse overwrite.

- [x] **Step 5: Detect and commit**

Commit code/config only, not local split files, with `feat: freeze fishing dataset splits`.

### Task 7: Load Variable-Size Episodes with Train-Only Augmentation

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/dataset.py`

**Interfaces:**
- Produces `NormalizationStats`, `compute_train_normalization(...)`, `load_training_episodes(...)`, `load_dev_episodes(...)`, private final loader callable only by evaluator, and `FishingEpisode` above.

- [x] **Step 1: Implement decode/normalization**

Decode to RGB float32 CHW at original 75×75. Calculate channel mean/std using train references and queries only; persist stats and reject non-finite/zero std.

- [x] **Step 2: Implement constrained augmentation**

Train only: small brightness/contrast/color noise, translation up to 3 px and center scale 0.95–1.05. Never flip/rotate/crop fixed regions. Dev/final are deterministic.

- [x] **Step 3: Preserve episodic semantics**

Return one variable-sized episode per batch; randomly permute references during train and remap every target correctly. Do not apply Hungarian/one-to-one matching. Public generic loader rejects `final`.

- [x] **Step 4: Verify diagnostics**

Run `python -m fishing_ml.dataset ... --split train --limit 5`. Expected shapes `[R,3,75,75]`, `[Q,3,75,75]`, `[Q]`, finite tensors and at least one variable R/Q sample. `--split final` must refuse and point to locked evaluator.

- [x] **Step 5: Detect and commit**

Commit `feat: load episodic fishing dataset` after detect-changes.

### Task 8: Implement Shared Metrics and Classical Baselines

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/metrics.py`
- Create: `avatar-web/fishing-ml/src/fishing_ml/baselines.py`

**Interfaces:**
- Produces `Prediction`; `MetricSummary` with top1 accuracy, wrong count, batch exact-match, accepted accuracy/count, abstention, score/margin distributions, R/Q grouped metrics and index histogram; `summarize_predictions`; baseline methods `binary_shape`, `ssim`, `ncc`.

- [x] **Step 1: Implement metric aggregation**

For each query record top-1, top-2 margin (`None` for one reference), expected index and accepted flag. Batch exact-match requires every query correct; `allAccepted` requires every query accepted.

- [x] **Step 2: Implement three independent rankers**

Binary-shape may grayscale/threshold/components; SSIM uses scikit-image; NCC uses normalized grayscale arrays. Rank each query independently and never write labels or use one-to-one assignment.

- [x] **Step 3: Run dev baselines**

Run three `fishing-baseline --method ... --split dev` commands with explicit output files. Expected all requested metrics and prediction lists over identical dev queries. CLI must reject final.

- [x] **Step 4: Detect and commit**

Commit `feat: add fishing image baselines and metrics` after detect-changes.

### Task 9: Implement CNN and Versioned Training Config

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/model.py`
- Create: `avatar-web/fishing-ml/src/fishing_ml/config.py`
- Create: `avatar-web/fishing-ml/config/train-baseline.yaml`

**Interfaces:**
- Produces `FishingEncoder(embedding_dim=96, channels=(32,64,96,128))`, `cosine_similarity_matrix`, `episode_logits(..., temperature)`, `episode_loss`; frozen `TrainingConfig` and `load_training_config`.

- [x] **Step 1: Implement shared encoder**

Use four Conv2d → GroupNorm → ReLU → MaxPool blocks, adaptive global average pooling, linear projection and `F.normalize(p=2, dim=1)`. No pretrained backbone.

- [x] **Step 2: Implement episode objective**

Cosine matrix shape `[query_count, reference_count]`; logits divide by positive temperature; loss is cross entropy against per-query reference indices.

- [x] **Step 3: Lock baseline config**

Use schema 1, seed 20260827, epochs 100, LR 0.001, weight decay 0.0001, temperature 0.07, embedding 96, channels `[32,64,96,128]`, checkpoint metric `dev_top1_accuracy`, device `auto`, workers 0, reproducibility tolerance 0.002. Reject unsupported/invalid values and unknown keys.

- [x] **Step 4: Smoke verify**

Run a random 6-reference/5-query forward pass. Expected shape `(5, 6)`, finite logits, normalized embeddings.

- [x] **Step 5: Detect and commit**

Commit `feat: add fishing metric learning model` after detect-changes.

### Task 10: Train Using Train and Select Using Dev

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/train.py`

**Interfaces:**
- Produces `set_reproducible_seed`, `train_epoch`, `predict_episodes`, `run_training`; run artifacts `checkpoints/best-dev.pt`, `model-config.json`, `normalization.json`, `dev-predictions.json`, `dev-metrics.json`, `environment.json`, `training-history.json`.

- [x] **Step 1: Enforce partition boundary**

Load/validate train and dev only; no API or CLI parameter accepts final. Fail before training on split leakage, invalid dataset or missing normalization.

- [x] **Step 2: Implement deterministic episodic training**

Seed Python/NumPy/Torch; enable deterministic algorithms when supported and record backend limitations. Train each variable episode with within-batch negatives and finite-value checks.

- [x] **Step 3: Select and record checkpoint**

After every epoch evaluate dev. Select lexicographically by highest dev accuracy, lowest wrong count, lowest dev loss, earliest epoch. Atomically write artifacts, dependency/platform versions and Git revision.

- [x] **Step 4: Run baseline training and reproducibility run**

Run `fishing-train` twice with identical config/snapshot and distinct run IDs. Expected complete artifacts, no final access, dev accuracy difference <=0.002; when deterministic backend is complete, prediction indices match. Record differences honestly.

- [x] **Step 5: Detect and commit**

Commit source/config only with `feat: train fishing image matcher` after detect-changes.

### Task 11: Implement Dev Calibration and Immutable Candidate Freeze

**Current status:** Source files exist only as placeholders that print `not yet implemented`; this task remains entirely unimplemented.

**Files:**
- Replace: `avatar-web/fishing-ml/src/fishing_ml/calibrate.py:1-13`
- Replace: `avatar-web/fishing-ml/src/fishing_ml/artifacts.py:1-13`
- Modify: `avatar-web/fishing-ml/pyproject.toml:20-28`
- Modify: `avatar-web/fishing-ml/README.md:3-23`

**Interfaces:**
- Consumes: `dev-predictions.json`, `model-config.json`, `normalization.json`, `checkpoints/best-dev.pt`, validated raw/label/split roots and the current Git revision.
- Produces: `Thresholds(min_similarity: float, min_margin: float)`, `CalibrationResult`, `apply_thresholds(...)`, `calibrate_thresholds(...)`, `calibrate_run(run_dir: Path, require_zero_wrong_accepted: bool) -> CalibrationResult`, `FreezeManifest`, `build_dataset_snapshot(...)`, `checksum_split_files(...)`, `freeze_run(...) -> FreezeManifest`, `verify_freeze(frozen_dir: Path) -> FreezeManifest`.
- CLI contract: `python -m fishing_ml.calibrate ...` performs calibration; `fishing-freeze ...` maps to `fishing_ml.artifacts:main` and performs freezing.

- [x] **Step 1: Run pre-edit impact checks**

Run GitNexus upstream impact for `main` in `calibrate.py`, `main` in `artifacts.py`, and the `fishing-freeze` console entry point. Report direct callers, affected processes and risk; stop for approval if risk is HIGH/CRITICAL. Completed 2026-08-28: LOW risk; only the offline evaluator imports these modules.

- [x] **Step 2: Implement dev-only threshold calibration**

Parse the stored dev predictions rather than loading final data. Generate candidate cutoffs from observed top-1 similarities and non-`None` margins, evaluate every pair, and choose the candidate with the largest accepted count subject to zero wrong accepted predictions when `--require-zero-wrong-accepted` is set. Break ties by higher minimum similarity and then higher minimum margin. For one-reference episodes, acceptance depends only on similarity. Atomically write schema-v1 `thresholds.json` containing thresholds, source prediction checksum, calibration objective, accepted count, accepted accuracy, abstention rate and timestamp.

- [x] **Step 3: Implement complete immutable snapshot and freeze**

`build_dataset_snapshot` must enumerate every split member and record canonical manifest JSON, label JSON, split membership and every PNG SHA-256. `checksum_split_files` must hash `train.txt`, `dev.txt` and `final.txt`. `freeze_run` must validate the dataset and splits, require all run inputs, create a sibling temporary `frozen` directory, copy `model-config.json`, `normalization.json`, `thresholds.json`, `environment.json` and `checkpoints/best-dev.pt`, write `dataset-snapshot.json`, `split-checksums.json` and `freeze-manifest.json`, fsync, then rename atomically. It must refuse an existing destination.

- [x] **Step 4: Implement independent freeze verification**

`verify_freeze` must parse schema version 1, reject missing/extra declared files, recompute every frozen file checksum and the freeze-manifest checksum inventory, and return the typed manifest only after all checks pass. It must not trust mutable files outside `frozen/`.

- [x] **Step 5: Correct CLI wiring and package documentation**

Change `fishing-freeze = "fishing_ml.calibrate:main"` to `fishing-freeze = "fishing_ml.artifacts:main"`. Update the README command table and remove the obsolete statement that all commands are placeholders. Document the exact calibration/freeze separation and that no command performs live inference or TX43 submission.

- [x] **Step 6: Verify calibration, freeze, tamper and overwrite guards**

Verified 2026-08-28 (synthetic, project venv `.venv/bin/python`): dev calibration selected two accepted predictions with `accepted_wrong_count==0`; a weak fixture containing one wrong-accepted prediction correctly raised `ValueError: no calibration candidate satisfies the acceptance objective` when `require_zero_wrong_accepted=True`; valid synthetic frozen inventory verified; non-hex `gitRevision` rejected with `invalid freeze manifest`; tampered `best-dev.pt` hash rejected with `frozen checksum mismatch`. Full freeze against the canonical 200-batch dataset remains blocked on Task 13 data.

Run:
```bash
.venv/bin/python -m fishing_ml.calibrate \
  --run-dir artifacts/cnn-baseline-20260827-01 \
  --require-zero-wrong-accepted
.venv/bin/fishing-freeze \
  --run-dir artifacts/cnn-baseline-20260827-01 \
  --raw-root data/raw --labels-root data/labels --splits-root data/splits
.venv/bin/python -m fishing_ml.artifacts verify \
  --frozen-dir artifacts/cnn-baseline-20260827-01/frozen
```
Expected: thresholds use only dev predictions; freeze contains every declared file and verifies successfully. Copy the frozen directory to a temporary root, modify one copied byte and expect verify exit 2 with a checksum mismatch. Re-run freeze against the original run and expect exit 2 without changing the existing frozen candidate.

- [ ] **Step 7: Detect changes and commit**

PENDING — no commit made. `gitnexus_detect_changes({scope: "all"})` returned CRITICAL when the ML edits were combined with the concurrent `fishing-probe.ts` crawler changes (separate spec `docs/superpowers/specs/2026-08-28-fishing-data-crawler-design.md`, not yet approved). Per the user instruction to "Gộp cả hai scope", the combined change set is under review; commit is held until the user decides the crawler scope. Confirm only calibration/artifact/package documentation flows changed in the ML half, then commit source/config/docs with `feat: freeze calibrated fishing matcher`.

### Task 12: Harden Locked Dev and One-Shot Final Evaluation

**Current status:** The evaluator source exists, but it verifies `run_dir/frozen` while loading mutable inputs from `run_dir`, and writes final predictions/report as two independent files. The checked implementation claims from the earlier draft are therefore reopened until these invariants are fixed.

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/evaluate.py:26-105`

**Interfaces:**
- Consumes: only the verified copies under `run_dir/frozen`, plus raw/label/split roots whose current checksums must match the frozen snapshot.
- Produces: `evaluate_run(..., split_name: Literal["dev"])`, `evaluate_final_once(...)`; repeatable `evaluation-dev.json`; one atomic terminal `final-evaluation.json` containing predictions and metrics. No separate `final-predictions.json` is required because predictions are embedded in the terminal report.

- [x] **Step 1: Run pre-edit impact checks**

Run upstream GitNexus impact for `_inputs`, `evaluate_run`, `evaluate_final_once` and `main`. Report risk/direct callers/affected evaluation flows; stop for approval if HIGH/CRITICAL. Completed 2026-08-28: LOW risk, limited to the package's dev/final evaluation flows.

- [x] **Step 2: Load exactly the verified frozen candidate**

Make `_inputs` accept `frozen_dir` and load `model-config.json`, `normalization.json`, `thresholds.json` and `best-dev.pt` only from that directory. Call `verify_freeze(frozen_dir)` before reading them. Recompute current raw manifests, labels, PNG hashes and split-file hashes and compare them to `dataset-snapshot.json` and `split-checksums.json` before loading any episode.

- [x] **Step 3: Preserve repeatable dev evaluation**

Evaluate dev with the frozen model and thresholds, include correct/incorrect plus accepted/abstained predictions and all spec metrics, compare top-1 accuracy to stored dev metrics within `reproducibilityTolerance`, and atomically replace only `evaluation-dev.json`. The public evaluator must continue to reject `final`.

- [x] **Step 4: Make final publication all-or-nothing**

Require exact `--confirm-final-once <run-id>`, matching frozen Git revision, valid current dataset/splits and absence of both the terminal report and an evaluation lock. Create an exclusive `final-evaluation.lock` before opening final episodes. Write one self-contained `final-evaluation.json` atomically with predictions, CNN metrics, all three baseline metrics and pass/fail; remove the lock only after successful publication. On a runtime failure, leave the lock as evidence and require explicit human review rather than silently retrying. Do not write a separate predictions file that can become orphaned.

- [x] **Step 5: Enforce final exit semantics**

Exit 0 only when `top1Accuracy >= 0.99` and `wrongCount == 0`; exit 3 when evaluation completed but failed the gate; exit 2 for validation/runtime refusal without a terminal report. Any subsequent final command must refuse once either a final report or unresolved lock exists.

- [x] **Step 6: Verify negative paths without opening the real final split**

Verified 2026-08-28 (synthetic, project venv): a pre-existing `final-evaluation.lock` was rejected before freeze verification or dataset loading (`FileExistsError: final evaluation report or unresolved lock already exists`); tampered `best-dev.pt` inside `frozen/` was rejected by `verify_freeze` checksum verification before model load; non-hex `gitRevision` in `freeze-manifest.json` was rejected with `invalid freeze manifest`. The frozen-input contract (only `run_dir/frozen` is read) is enforced by `_inputs`/`evaluate_final_once` calling `verify_freeze(frozen_dir)` first and the `FileExistsError` guard for lock/report. Full modified split/PNG/checkpoint/threshold matrix remains blocked on a complete disposable 140/30/30 dataset snapshot.

- [ ] **Step 7: Detect changes and commit**

PENDING — no commit made. Part of the combined CRITICAL scope with the crawler changes; held for the user's scope decision. Run `gitnexus_detect_changes({scope: "all"})`, confirm no TypeScript production integration and only evaluator/freeze flows changed in the ML half, then commit with `fix: bind fishing evaluation to frozen inputs`.

### Task 13: Execute the Dataset, Training and Final Operational Gate

**Current status:** Blocked on real data. The repository contains no committed/generated `data/` tree, baseline report, trained run, frozen candidate or final report. Earlier checked manual-verification boxes are historical bookkeeping, not retained evidence of this gate.

**Files:**
- Generate locally (ignored): `avatar-web/fishing-ml/data/incoming/`, `data/raw/`, `data/labels/`, `data/splits/`
- Generate locally (ignored): `avatar-web/fishing-ml/artifacts/baselines/`, `artifacts/<run-id>/`
- Modify after execution: `docs/superpowers/plans/2026-08-27-fishing-image-matching-ml.md` (checkboxes and factual run result only)

**Interfaces:**
- Consumes: completed Tasks 1–12, authorized RX79 captures, manual ground truth and untouched final split.
- Produces: validated 200-batch dataset, 140/30/30 frozen split, baseline reports, two reproducibility runs, one calibrated/frozen candidate and at most one final report.

- [ ] **Step 1: Collect, import and label the required dataset**

Capture only authorized accounts until validation reports exactly 200 complete non-ambiguous batches and at least 1,000 labeled queries. Import losslessly, label manually without baseline preselection, and review every ambiguous or duplicate-blob finding. Never commit images, labels, account identifiers or packet logs.

- [ ] **Step 2: Freeze and validate the split**

Create the split once with seed `20260827` and exact counts 140/30/30. Validate pairwise-empty intersections, complete labels, no ambiguous IDs and no unreviewed duplicate checksum crossing partitions. Preserve the generated split files unchanged for the entire candidate run.

- [ ] **Step 3: Establish all dev baselines**

Run binary-shape, SSIM and NCC over the same dev episodes and retain each report under `artifacts/baselines/`. Confirm query counts and batch IDs are identical across reports and no baseline writes labels.

- [ ] **Step 4: Train twice and select without final access**

Run `fishing-train` twice using `config/train-baseline.yaml`, identical snapshot/splits and distinct run IDs. Confirm both runs produce the required artifacts, neither opens final, dev top-1 difference is `<= 0.002`, and prediction indices match when the recorded backend is deterministic. Select the candidate using only the configured dev ordering and record the reason.

- [ ] **Step 5: Calibrate, freeze and reproduce dev**

Calibrate for zero wrong accepted dev predictions, freeze the selected candidate, verify every checksum, then run the locked dev evaluator. Confirm the reproduced dev metric is within configured tolerance and all required accepted/abstained metrics and baseline comparisons are present.

- [ ] **Step 6: Record the pre-final decision**

Before opening final, record candidate run ID, checkpoint SHA-256, config SHA-256, threshold SHA-256, dataset snapshot SHA-256, split checksums, Git revision, dev metrics and the explicit statement that no architecture/hyperparameter/checkpoint/threshold decision remains. If any item is unresolved, stop without running final.

- [ ] **Step 7: Run final exactly once**

Run the final command once with the exact run ID. Expected coverage: all 30 final batches and every labeled query exactly once, including accepted and abstained predictions plus CNN/binary-shape/SSIM/NCC metrics. Preserve the terminal report whether the gate passes or fails.

- [ ] **Step 8: Apply the outcome gate**

Mark Giai đoạn A passed only if final top-1 is at least 0.99 and `wrongCount == 0`. On failure, do not tune from final errors, do not retry the same final split and do not integrate live. A replacement untouched final set and another candidate require a newly approved spec/plan. On pass, still do not implement service, shadow mode or TX43; start a separate Giai đoạn B spec.

- [ ] **Step 9: Update plan evidence and commit docs only**

Run `gitnexus_detect_changes({scope: "all"})`, add the exact run IDs/checksums/metrics and mark only actually executed checkboxes. Commit the plan/result documentation without adding ignored data or artifacts, using `docs: record fishing matcher phase A result`.

---

## Completion Status as of 2026-08-28 (checkpoint after Tasks 11–12 inline execution)

- Production source for Tasks 1–10 is present in local `main` through commit `eddf41a8`; evaluator source was added through `9838c5b4`.
- **Task 11 is now implemented and synthetically verified.** `calibrate.py` and `artifacts.py` are fully written (no longer placeholders); `fishing-freeze` is mapped to `fishing_ml.artifacts:main`; README documents the calibration/freeze separation. Verification confirmed: zero-wrong-accepted objective, weak-candidate refusal, frozen inventory acceptance, non-hex git revision rejection, tampered checkpoint rejection.
- **Task 12 is now hardened and synthetically verified.** `evaluate.py` loads only `run_dir/frozen`, calls `verify_freeze` first, enforces frozen Git-revision match in both dev and final paths, embeds predictions in the terminal `final-evaluation.json`, and makes publication all-or-nothing (lock removed only on failure). Verification confirmed: pre-existing lock refusal, tampered-checkpoint rejection, non-hex manifest rejection.
- **Code-review findings fixed (8 total):** zero-wrong-accepted default-on in `calibrate` CLI; hex/40-hex validation of `gitRevision`/file hashes in `artifacts._manifest`; brittle dict-equality replaced by hash compare in `verify_current_dataset`; `evaluate_run` reads stored dev accuracy via `frozen_dir/dev-metrics.json` and checks frozen revision; `evaluate_final_once` removes the lock on any failure; `main` adds `FileExistsError` to the refusal tuple; `metrics.MetricSummary` carries `accepted_wrong_count`; added `freeze_revision`/`_manifest` helpers.
- **Not committed.** The ML edits are clean and isolated. However `gitnexus_detect_changes({scope: "all"})` returned **CRITICAL** because the working tree also contains the concurrent crawler changes in `avatar-web/server/src/tools/fishing-probe.ts` (from the not-yet-approved spec `docs/superpowers/specs/2026-08-28-fishing-data-crawler-design.md`). Per the user's "Gộp cả hai scope" instruction, the combined set is under review and commit is held.
- Task 13 has not been executed: no local dataset/run/freeze/final evidence exists; it remains blocked on real authorized data collection.
- Checked boxes in Tasks 1–10 record source-task completion from prior work; data-dependent claims must be re-established and retained under Task 13 before declaring Giai đoạn A complete.

## End-to-End Verification Sequence

Run from `avatar-web/fishing-ml` only after Tasks 11–12 are complete and collection reaches the gate:

```bash
.venv/bin/fishing-import --source data/incoming --raw-root data/raw
.venv/bin/fishing-label --raw-root data/raw --labels-root data/labels
.venv/bin/fishing-validate --raw-root data/raw --labels-root data/labels --require-batches 200 --require-pairs 1000 --report artifacts/dataset-validation.json
.venv/bin/fishing-split create --raw-root data/raw --labels-root data/labels --splits-root data/splits --seed 20260827 --train-count 140 --dev-count 30 --final-count 30
.venv/bin/fishing-split validate --raw-root data/raw --labels-root data/labels --splits-root data/splits --duplicate-reviews config/duplicate-reviews.json
.venv/bin/fishing-baseline --method binary-shape --split dev --raw-root data/raw --labels-root data/labels --splits-root data/splits --output artifacts/baselines/binary-shape-dev.json
.venv/bin/fishing-baseline --method ssim --split dev --raw-root data/raw --labels-root data/labels --splits-root data/splits --output artifacts/baselines/ssim-dev.json
.venv/bin/fishing-baseline --method ncc --split dev --raw-root data/raw --labels-root data/labels --splits-root data/splits --output artifacts/baselines/ncc-dev.json
.venv/bin/fishing-train --config config/train-baseline.yaml --raw-root data/raw --labels-root data/labels --splits-root data/splits --artifacts-root artifacts --run-id cnn-baseline-20260827-01
.venv/bin/python -m fishing_ml.calibrate --run-dir artifacts/cnn-baseline-20260827-01 --require-zero-wrong-accepted
.venv/bin/fishing-freeze --run-dir artifacts/cnn-baseline-20260827-01 --raw-root data/raw --labels-root data/labels --splits-root data/splits
.venv/bin/fishing-evaluate dev --run-dir artifacts/cnn-baseline-20260827-01 --raw-root data/raw --labels-root data/labels --splits-root data/splits
.venv/bin/fishing-evaluate final --run-dir artifacts/cnn-baseline-20260827-01 --raw-root data/raw --labels-root data/labels --splits-root data/splits --confirm-final-once cnn-baseline-20260827-01
```

Giai đoạn A chỉ hoàn tất khi artifacts tái lập được, final report được tạo đúng một lần từ freeze hợp lệ, top-1 >=99% và số prediction sai bằng 0. Kết quả này không cho phép triển khai inference service, shadow-mode integration hoặc gửi TX43; các việc đó cần spec/plan Giai đoạn B/C riêng.
