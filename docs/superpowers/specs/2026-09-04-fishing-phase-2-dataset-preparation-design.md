# Fishing Matcher Phase 2 Dataset Preparation Design

## Mục tiêu và bối cảnh

Fishing Phase 2 đã code-complete và verified trên `main`, nhưng execution freeze bị chặn tại Gate R với blocker `phase2-dataset-missing`: namespace `data/phase2/` hoàn toàn trống. Chu kỳ này chuẩn bị dataset Phase 2 hoàn chỉnh — raw, labels, splits, dataset-version — để plan freeze-execution có thể resume từ Task 3.

Nguồn dữ liệu là capture Phase A đã có sẵn: 206 raw batches trong `data/raw`, 200 có label complete. Không có capture mới qua game trong chu kỳ này. Phase A được đối xử read-only tuyệt đối; mọi dữ liệu Phase 2 là bản copy lossless trong namespace riêng.

Mục tiêu cuối:

```text
data/phase2/raw:     200 batch import lossless
data/phase2/labels:  200 label document
data/phase2/splits:  train 140 / dev 30 / final 30 (seed 20260904)
dataset-version.json: immutable provenance, verify pass
all validators:      pass, fail-closed
```

## Phạm vi

### In scope

1. Import 206 raw batches từ `data/raw` vào `data/phase2/raw` bằng `fishing-import` (lossless, verify SHA-256 từng PNG, no-replace).
2. Copy 200 label documents từ `data/labels` vào `data/phase2/labels` (chỉ label của batch có sẵn trong Phase 2 raw).
3. Tạo splits 140/30/30 bằng `fishing-split create --seed 20260904`.
4. Xử lý duplicate review fail-closed: nếu validate báo `DUPLICATE_UNREVIEWED`, dừng và trình danh sách để user review; chỉ ghi `config/duplicate-reviews.json` sau khi user duyệt từng checksum.
5. Tạo `data/phase2/dataset-version.json` bằng script one-shot dùng `write_dataset_version` hiện có.
6. Chạy full verification: namespace resolution, dataset-version verify, `fishing-validate`, `fishing-split validate`, `experiments list` count 24.
7. Ghi results ledger sanitized.

### Out of scope

1. Capture dữ liệu mới qua game client.
2. Label, sửa, hoặc tạo lại label documents.
3. Chỉnh sửa Phase A data dưới mọi hình thức (read-only tuyệt đối).
4. Chạy training, compare, freeze, final, replay.
5. Thêm CLI subcommand mới vào production code.
6. Sửa bất kỳ production code nào; script one-shot chỉ tồn tại trong plan như heredoc, không commit vào repo.
7. Auto-accept duplicate: mọi `reviewedSha256` phải có quyết định user.
8. Sửa gate policy hoặc candidate matrix.

### Input

- `data/raw` (206 batches, 200 có label) — read-only.
- `data/labels` (200 documents) — read-only.
- `config/duplicate-reviews.json` (hiện rỗng) — chỉ ghi sau user review.
- `config/phase2/dataset.yaml` — định nghĩa namespace.
- Seed split: `20260904`.

### Output

Khi thành công:

- `data/phase2/raw/` chứa 200 batch hợp lệ.
- `data/phase2/labels/` chứa 200 label documents.
- `data/phase2/splits/{train,dev,final}.txt` đúng 140/30/30, không overlap.
- `data/phase2/dataset-version.json` verify pass.
- Results ledger ghi dataset identity và checksums an toàn.

Khi fail-closed:

- Import collision, label invalid, duplicate chưa review, hoặc validate fail: dừng, giữ nguyên hiện trạng, ghi blocker vào ledger, không tự sửa dữ liệu.

## Trạng thái hiện tại

- `data/phase2/` chưa tồn tại.
- `data/raw` có 206 batch directories, mỗi batch có `manifest.json` + `img/` + `new/`.
- `data/labels` có 200 JSON documents với `status: "complete"` và matches array.
- 6 raw batches chưa có label (sẽ tự loại khỏi split vì split chỉ dùng eligible batches — batch có cả manifest và label complete).
- `config/duplicate-reviews.json` có `reviewedSha256: []`.
- `fishing-import`, `fishing-split`, `fishing-validate`, `dataset_version verify` là CLI hiện có, đã tested.
- CLI `dataset_version` không có subcommand create — tạo document bằng script one-shot trong plan.

## Kiến trúc

### Luồng dữ liệu

```text
Phase A (read-only)                      Phase 2 namespace
data/raw/ ──────────────────────────────► data/phase2/raw/
   │        fishing-import                        │
   │                                     data/phase2/labels/
data/labels/ ─────────────── copy ─────────────┘
                                               │
                              fishing-split create --seed 20260904
                                               ▼
                                   data/phase2/splits/{train,dev,final}.txt
                                               │
                              one-shot script (write_dataset_version)
                                               ▼
                                   data/phase2/dataset-version.json
                                               │
                              verify: namespace + version + validate
                                               ▼
                                        experiments list = 24
```

### Import semantics

`fishing-import --source data/raw --raw-root data/phase2/raw`:

- Copy từng batch vào temp dir sibling, verify SHA-256 mọi PNG, atomic rename.
- Batch trùng byte-identical → `skipped`.
- Collision cùng `batchId` khác content → fatal error, dừng.
- Legacy batch thiếu `imagesNew` → `ineligible`, không copy.
- Kết quả mong đợi: 206/206 imported hoặc skipped-identical, 0 error.

### Label copy semantics

- Copy 1-1 từng file JSON, giữ nguyên bytes.
- Không ghi đè nếu đích đã tồn tại (fail-closed, dùng `cp -n` và kiểm tra).
- Chỉ copy label có batch tương ứng trong Phase 2 raw.
- Label có `status != "complete"` → không phải lỗi copy, nhưng sẽ bị split/validate từ chối sau; nếu xảy ra, dừng để điều tra.

### Split creation

`fishing-split create --raw-root data/phase2/raw --labels-root data/phase2/labels --splits-root data/phase2/splits --duplicate-reviews config/duplicate-reviews.json --train-count 140 --dev-count 30 --final-count 30 --seed 20260904`

- Chỉ eligible batches (manifest + label complete) được chia.
- Splits được ghi no-replace; chạy lại với seed khác trên splits đã tồn tại phải fail, không ghi đè.
- Sau create, chạy ngay `fishing-split validate` với cùng tham số để xác nhận `valid=true`.
- Nếu `DUPLICATE_UNREVIEWED` xuất hiện → dừng chu kỳ, trình danh sách checksum để user review.

### Duplicate review (chỉ khi bị chặn)

- Trình từng checksum: các batch chứa blob đó, split placement.
- User quyết định `accept` (blob trùng chấp nhận được, các batch ở cùng split) hoặc `remove`/`regroup` theo validator hiện có.
- Ghi `reviewedSha256` vào `config/duplicate-reviews.json` theo schema hiện có, chỉ checksum được duyệt.
- Chạy lại create (nếu chưa có splits) hoặc validate.

### Dataset version one-shot

Script trong plan (heredoc, không commit):

```python
from pathlib import Path
from datetime import datetime, timezone
from fishing_ml.dataset_version import DatasetVersion, write_dataset_version

version = DatasetVersion(
    schema_version=1,
    dataset_id="phase2-20260904-01",
    parent_dataset_id=None,
    created_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    source_batches=tuple(sorted(set(batch_ids_from_raw_dir))),
)
write_dataset_version(Path("data/phase2/dataset-version.json"), version)
```

- `sourceBatches` lấy từ directory listing `data/phase2/raw`, sorted + unique.
- File được ghi qua `atomic_write_json` — an toàn, deterministic.
- `datasetId` cố định `phase2-20260904-01` để plan freeze-execution ghi nhận đúng identity.

### Verification chain

1. `fishing-phase2-dataset-version namespace --base . --name raw|labels|splits` — resolved paths nằm trong `data/phase2/`.
2. `fishing-phase2-dataset-version verify data/phase2/dataset-version.json` — exit 0.
3. `fishing-validate --raw-root data/phase2/raw --labels-root data/phase2/labels` — exit 0.
4. `fishing-split validate ... --train-count 140 --dev-count 30 --final-count 30` — `valid=true`.
5. `fishing-phase2-experiment list --candidates config/phase2/candidates.yaml --splits-root data/phase2/splits --dataset-version data/phase2/dataset-version.json` — JSON count 24, không đọc final cho evaluation.
6. Verify Phase A untouched: checksum manifest.json của 3 batch Phase A mẫu trước/sau.

## Error model

- `import-collision`: cùng batchId khác content — dừng.
- `import-ineligible`: batch legacy thiếu imagesNew — ghi nhận, không phải lỗi dừng.
- `label-missing`: batch raw không có label — ghi nhận, tự loại khỏi split.
- `label-invalid`: label status != complete hoặc schema sai — dừng để điều tra.
- `duplicate-unreviewed`: validate báo duplicate blob chưa review — dừng, chờ user review.
- `split-conflict`: splits đã tồn tại khi create — dừng, không ghi đè.
- `dataset-version-conflict`: file đã tồn tại khi one-shot chạy — dừng, không ghi đè.
- `verification-failed`: bất kỳ bước verify nào fail — dừng.

## Files

### Tạo mới

- `avatar-web/fishing-ml/data/phase2/raw/<batch>/...` — 200+ batch directories.
- `avatar-web/fishing-ml/data/phase2/labels/<batch>.json` — 200 files.
- `avatar-web/fishing-ml/data/phase2/splits/{train,dev,final}.txt`.
- `avatar-web/fishing-ml/data/phase2/dataset-version.json`.
- `docs/superpowers/specs/2026-09-04-fishing-phase-2-dataset-preparation-design.md` (chính tài liệu này).
- `docs/superpowers/plans/2026-09-04-fishing-phase-2-dataset-preparation.md`.
- `docs/superpowers/plans/2026-09-04-fishing-phase-2-dataset-preparation-results.md`.

### Có thể sửa (chỉ sau user review)

- `avatar-web/fishing-ml/config/duplicate-reviews.json` — thêm `reviewedSha256`.

### Read-only

- `avatar-web/fishing-ml/data/raw/**`
- `avatar-web/fishing-ml/data/labels/**`
- Toàn bộ production code.

### Commit policy

- Dữ liệu dataset (raw/labels/splits/dataset-version) là generated artifacts: KHÔNG commit tự động; user quyết định riêng.
- Commit docs (spec/plan/results) theo quy trình hiện có.

## Edge cases

1. Import gặp batch Phase A thiếu `imagesNew` → ineligible, ghi nhận, tiếp tục.
2. Số batch import < 200 do ineligible → nếu label tương ứng không đủ 200 eligible, split create sẽ fail counts → dừng.
3. Duplicate blob chưa review → dừng trước khi tạo dataset-version.
4. `data/phase2/dataset-version.json` tồn tại sẵn → one-shot script phải check lexists trước và dừng, không ghi đè.
5. Phase A bị modify trong quá trình chạy → checksum sample thay đổi → dừng toàn bộ và điều tra.
6. Disk đầy giữa import → temp dir còn sót → import lần sau skip batch đã xong, temp dir dọn thủ công theo hướng dẫn.

## Verification plan

### Sau import

- Đếm số batch directories trong `data/phase2/raw` = số batch Phase A eligible.
- Spot-check SHA-256 của 3 batch ngẫu nhiên khớp Phase A.
- `fishing-validate` exit 0.

### Sau split

- `wc -l` từng split file: 140/30/30.
- `fishing-split validate` → `valid=true`.
- Không batch nào xuất hiện ở 2 split (validator đảm bảo SPLIT_OVERLAP).

### Sau dataset-version

- `dataset_version verify` exit 0.
- `experiments list` → count 24, datasetId khớp `phase2-20260904-01`.

### Sau cùng

- Checksum 3 sample Phase A unchanged.
- Results ledger ghi các identity/checksum an toàn.
- `git status` không stage bất kỳ dataset file nào.

## Completion criteria

- 200 eligible batch import thành công.
- Splits 140/30/30 valid.
- `dataset-version.json` verify pass.
- `experiments list` count 24.
- Phase A untouched (checksum sample pass).
- Results ledger ghi `dataset: ready` và các identity.
- Không commit dataset files.
