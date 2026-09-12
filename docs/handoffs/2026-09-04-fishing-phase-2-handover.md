# Fishing Phase 2 Handover

**Ngày bàn giao:** 2026-09-04
**Repository:** `learning-reverse`
**Branch:** `main`
**HEAD khi bàn giao:** `906e5e4a`
**Trạng thái tổng:** Phase 2 đã hoàn tất code, dataset, 24-candidate evaluation, immutable selection và verified freeze. Final gate, replay gate và live shadow chưa chạy.

---

## 1. Tóm tắt điều hành

Fishing Phase 2 hiện đạt mốc:

```text
codeComplete:          true
datasetStatus:         ready
candidateRuns:         24/24 trained and strict-reuse verified
selectionStatus:       immutable selection published
freezeStatus:          verified
offlineFinalGate:      not-run / blocked by placeholder gate policy
replayGateStatus:      not-run
liveShadowStatus:      not-run
TX43 automation:       out of scope
```

Frozen winner:

```text
selectedRunId:
  p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01

selectedMatrixKey:
  photometric_plus_geom|off|t0.05|dim_128
```

Trusted hashes:

```text
selection SHA-256:
  4c15e952eef67f7291a306d2eedc8277ca86601286b301538e8c03335dc71f1f

checkpoint (best-dev.pt) SHA-256:
  6168b65abaf8ade9008c9611413167f76533d1e80926b2be852df6e7e3a67789

freeze-manifest.json SHA-256:
  ed1bbe4f9b24980c0277ace6da5d3b320b9f51a2b33f39c18c52e73beeed64ab
```

**Không chạy `confirm-final` trước khi gate policy được phê duyệt bằng evidence ngoài final set.**

---

## 2. Git history và tài liệu nguồn

### Commits quan trọng

```text
906e5e4a Merge branch 'main' into worktree-fishing-phase2-freeze-execution
49b4c6ec feat(fishing): verify phase 2 candidate freeze on CPU matrix
8ca1f939 docs(fishing): record phase 2 dataset preparation
1a831cee docs(fishing): verify reported phase 2 defects against merged main
b51c2f0c docs(fishing): record phase 2 freeze execution
1e6d4b39 docs(fishing): finalize phase 2 completion ledger
0966d9c9 feat(fishing): complete phase 2 code verification
```

`main` cũng chứa các auto-farm fixes đã có trước lần merge cuối:

```text
a8b1adaf Merge branch 'worktree-autofarm-keep-running-on-error'
6f82936b fix(auto-farm): rớt kết nối giữa chu kỳ giữ running — chờ vòng kế
865d622f fix(auto-farm): mất kết nối đầu vòng không còn tắt auto — chờ vòng kế
aee77a8e refactor(auto-farm): tách phần đuôi vòng thành finishCycle
```

### Spec, plan và results ledgers

Code completion:

- `docs/superpowers/specs/2026-09-02-fishing-phase-2-code-completion-design.md`
- `docs/superpowers/plans/2026-09-02-fishing-phase-2-code-completion.md`
- `docs/superpowers/plans/2026-09-02-fishing-phase-2-code-completion-results.md`

Dataset preparation:

- `docs/superpowers/specs/2026-09-04-fishing-phase-2-dataset-preparation-design.md`
- `docs/superpowers/plans/2026-09-04-fishing-phase-2-dataset-preparation.md`
- `docs/superpowers/plans/2026-09-04-fishing-phase-2-dataset-preparation-results.md`

Freeze execution:

- `docs/superpowers/specs/2026-09-04-fishing-phase-2-freeze-execution-design.md`
- `docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution.md`
- `docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md`

Original Phase 2 design/results:

- `docs/superpowers/specs/2026-08-28-fishing-phase-2-design.md`
- `docs/superpowers/plans/2026-08-28-fishing-phase-2-results.md`

---

## 3. Python environment

Project root:

```bash
cd avatar-web/fishing-ml
```

Verified environment:

```text
Python:        3.12.13
PyTorch:       2.13.0
NumPy:         2.5.2
Pillow:        11.3.0
scikit-image:  0.25.2
PyYAML:        6.0.3
```

Project constraints from `pyproject.toml`:

```text
Python >=3.11,<3.13
```

Use:

```bash
PY=.venv/bin/python
```

Read-only environment verification:

```bash
$PY --version
$PY -c 'import sys, fishing_ml, torch, numpy, PIL, skimage, yaml; print(sys.executable); print(fishing_ml.__file__); print(torch.__version__, numpy.__version__, PIL.__version__, skimage.__version__, yaml.__version__)'
```

Focused Phase 2 tests:

```bash
$PY -m unittest \
  tests.test_phase2_training \
  tests.test_phase2_experiments \
  tests.test_phase2_gate \
  tests.test_inference_size_contract -v
```

Last verified result: **19/19 passed**.

Server verification:

```bash
npm --prefix ../server test
npm --prefix ../server run typecheck
npm --prefix ../server run build
```

Last verified results:

```text
Server tests: 270/270 passed
Typecheck:    passed
Build:        passed
```

The server test suite emitted one pre-existing `MaxListenersExceededWarning` from `FakeClient`; the suite still exited successfully.

---

## 4. Dataset Phase 2

### Location

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

The entire `data/` directory is git-ignored. Dataset files are local operational artifacts, not committed source files.

### Identity

```text
datasetId:       phase2-20260904-01
parentDatasetId: null
createdAt:       2026-09-04T03:38:44.754127Z
sourceBatches:   206
eligibleBatches: 200
labeledPairs:    1375
```

Dataset version SHA-256:

```text
406be8ed9fc097adcdaf6c3446addd4bf94c909d3a299cca8ce1304da35b0807
```

### Split

```text
train: 140
dev:    30
final:  30
seed:   20260827
```

The seed was changed from the initial design choice `20260904` to the canonical seed `20260827` by explicit user decision because `fishing_ml.split.create_splits()` hard-requires `20260827`.

Since Phase 2 uses the same 200 eligible batches and the same seed as Phase A, split membership mirrors Phase A. This was accepted intentionally.

### Source and import semantics

Source data came from Phase A:

```text
data/raw:    206 batches
data/labels: 200 complete labels
```

Import behavior:

- `fishing-import` copied all 206 raw batches.
- All 2,653 image files under `img/` and `new/` were independently verified byte-identical to Phase A.
- Imported manifests were canonicalized by the importer; all 206 were semantically equal to their Phase A manifests but not byte-identical due to deterministic JSON serialization.
- All 200 labels were copied byte-exact, no-clobber.
- Six raw batches have no label. Validator output contains exactly six `LABEL_MISSING` issues for these known batches.
- Explicit minima passed: 200/200 completed batches and 1,375/1,000 labeled pairs.
- Duplicate blobs: none detected; `accepted_duplicates=0`.

### Verify dataset

From `avatar-web/fishing-ml`:

```bash
$PY -m fishing_ml.dataset_version namespace --base . --name raw
$PY -m fishing_ml.dataset_version namespace --base . --name labels
$PY -m fishing_ml.dataset_version namespace --base . --name splits

$PY -m fishing_ml.dataset_version verify data/phase2/dataset-version.json

$PY -m fishing_ml.validate \
  --raw-root data/phase2/raw \
  --labels-root data/phase2/labels \
  --require-batches 200 \
  --require-pairs 1000

$PY -m fishing_ml.split validate \
  --raw-root data/phase2/raw \
  --labels-root data/phase2/labels \
  --splits-root data/phase2/splits \
  --duplicate-reviews config/duplicate-reviews.json \
  --train-count 140 \
  --dev-count 30 \
  --final-count 30
```

Expected:

- Namespace paths resolve strictly beneath `data/phase2/`.
- Dataset-version verify succeeds.
- Dataset validator reports 200 completed, 1,375 pairs, six known `LABEL_MISSING` issues, and exits nonzero because it treats any issue as failure. Confirm the six issue IDs match the six known unlabeled batches; do not silently add labels.
- Split validator reports `valid=true train=140 dev=30 final=30 issues=0`.

---

## 5. Candidate matrix

### Configuration

File:

```text
avatar-web/fishing-ml/config/phase2/candidates.yaml
```

Important effective choice:

```yaml
baseConfig:
  device: cpu
```

Reason: `device: auto` selected Apple MPS. Hard-negative candidates failed because MPS does not provide a deterministic implementation for the required `index_put_with_accumulate` operation while the project enables `torch.use_deterministic_algorithms(True)`.

The full 24-candidate matrix was rerun on CPU to preserve strict determinism and uniform provenance.

Matrix dimensions:

```text
augmentation:  3 (none, photometric, photometric_plus_geom)
hard-negative: 2 (off, ratio_0.25)
temperature:   2 (0.05, 0.07)
embedding:     2 (96, 128)
total:         24
```

### Verification status

```text
24/24 run exit 0
24/24 strict reuse validation exit 0
24/24 devSelectionPassed=true
24/24 wrongAcceptedCount=0
exact canonical manifest set: 24/24
```

### Enumerate matrix

```bash
$PY -m fishing_ml.experiments list \
  --candidates config/phase2/candidates.yaml \
  --splits-root data/phase2/splits \
  --dataset-version data/phase2/dataset-version.json
```

Expected:

```text
count: 24
axes: augmentation=3, hardNegative=2, temperature=2, embedding=2
datasetId: phase2-20260904-01
```

---

## 6. Artifact locations

All generated model artifacts are present in the main checkout at:

```text
avatar-web/fishing-ml/artifacts/
```

Relevant layout:

```text
artifacts/
├── phase2-selection.json
├── phase2-experiments/
│   └── <24 candidate manifests>.json
├── p2-none-off-.../
├── ... 24 run directories total ...
└── p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/
    ├── checkpoints/
    ├── dev-metrics.json
    ├── dev-predictions.json
    ├── environment.json
    ├── model-config.json
    ├── normalization.json
    ├── thresholds.json
    ├── training-history.json
    └── frozen/
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

`artifacts/*/` and `*.pt` are git-ignored. Do not assume a fresh clone contains these files. Back up the frozen bundle before moving machines or cleaning local data.

### Verify selection and freeze

From `avatar-web/fishing-ml`:

```bash
shasum -a 256 artifacts/phase2-selection.json
shasum -a 256 \
  artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen/freeze-manifest.json

$PY -m fishing_ml.artifacts verify \
  --frozen-dir artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen
```

Expected:

```text
selection:
4c15e952eef67f7291a306d2eedc8277ca86601286b301538e8c03335dc71f1f

freeze manifest:
ed1bbe4f9b24980c0277ace6da5d3b320b9f51a2b33f39c18c52e73beeed64ab

checkpoint recorded by manifest:
6168b65abaf8ade9008c9611413167f76533d1e80926b2be852df6e7e3a67789
```

Do not delete, overwrite, regenerate, or move one file independently inside the frozen directory. The freeze verifier requires exact inventory and hashes.

---

## 7. Key production entry points

Experiment orchestration:

```text
avatar-web/fishing-ml/src/fishing_ml/experiments.py
```

Important commands:

```text
list
run
compare
freeze
confirm-final
adjudicate-replay
```

Gate policy and adjudication:

```text
avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py
```

Freeze publisher/verifier:

```text
avatar-web/fishing-ml/src/fishing_ml/artifacts.py
```

Inference service:

```text
avatar-web/fishing-ml/src/fishing_ml/inference_service.py
```

Replay runner:

```text
avatar-web/fishing-ml/src/fishing_ml/replay.py
```

TypeScript client:

```text
avatar-web/server/src/fishing/inferenceClient.ts
```

---

## 8. Important rulings and lessons

### Absolute artifacts-root convention

Strict run reuse requires manifest `runDir` to be absolute. `run_training()` records `artifacts_root / run_id` verbatim, so all operational `experiments run`, `compare`, and `freeze` commands should use absolute paths for artifact/data roots.

Recommended shell setup:

```bash
cd avatar-web/fishing-ml
ROOT="$PWD"
PY="$ROOT/.venv/bin/python"
ARTIFACTS="$ROOT/artifacts"
RAW="$ROOT/data/phase2/raw"
LABELS="$ROOT/data/phase2/labels"
SPLITS="$ROOT/data/phase2/splits"
DATASET_VERSION="$ROOT/data/phase2/dataset-version.json"
```

Do not pass `--artifacts-root artifacts` for new run creation if strict reuse will be required later; use `--artifacts-root "$ARTIFACTS"`.

### MPS determinism limitation

Hard-negative training on Apple MPS failed under strict deterministic algorithms. The chosen resolution was CPU-only for all 24 candidates. Do not change `device: cpu` back to `auto` and then mix newly generated MPS artifacts with the existing CPU matrix.

### Artifact reset exceptions

During execution, two early relative-path run artifacts and four initial MPS artifacts were deleted and regenerated. These were outputs created in the same session, never selected/frozen, and reset only after explicit user decisions. The current 24-candidate set is the final valid CPU matrix.

### Reported defect review

A broad review initially reported 11 production defects on a stale checkout (`b3017572`). Re-verification against merged `main` (`1e6d4b39` plus docs commits) confirmed commit `0966d9c9` had already fixed all reported correctness defects. See:

```text
docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md
```

No new defect-fixing cycle is pending from that report.

---

## 9. Gate policy status

File:

```text
avatar-web/fishing-ml/config/phase2/gate.yaml
```

Current intentional blocker:

```yaml
meta:
  preAgreedPlaceholders: true
```

This must remain true until thresholds and approval metadata are reviewed and approved before final evaluation.

Current placeholder thresholds include:

```text
accepted rate >= 0.85
batch exact match >= 0.95
top-1 accuracy >= 0.98
replay p95 <= 100 ms
replay max < 250 ms
errored batch rate <= 0.01
omitted rate <= 0
single model identity required
zero wrong accepted required
```

These are placeholders, not an approved gate. `confirm-final` is expected to exit blocked while `preAgreedPlaceholders` remains true.

---

## 10. Next work: required sequence

The next engineer must follow project policy: **Spec → user review → Plan → implementation/execution**.

### Step A — Approve gate policy from pre-final evidence

Create a new spec/plan that:

1. Reads dev metrics for all 24 candidates and selected candidate.
2. Documents why each threshold is accepted or changed.
3. Proves thresholds were not tuned against final data.
4. Gets explicit approver identity, UTC timestamp, and out-of-band evidence reference.
5. Updates only the gate policy metadata/thresholds after user approval.
6. Runs strict policy parser tests.

Required approved metadata:

```yaml
meta:
  preAgreedPlaceholders: false
  revisitAt: "2A"
  notTunedOnPhaseAFinal: true
  approvedAt: "<UTC ISO-8601>"
  approvedBy: "<approver identity>"
  evidence: "<approval reference>"
```

Do not derive or adjust these values using the final set.

### Step B — One-shot final

Only after approved gate policy and fresh freeze verification:

```bash
cd avatar-web/fishing-ml
ROOT="$PWD"
PY="$ROOT/.venv/bin/python"
SELECTED="p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01"

$PY -m fishing_ml.experiments confirm-final \
  --selection "$ROOT/artifacts/phase2-selection.json" \
  --artifacts-root "$ROOT/artifacts" \
  --candidates "$ROOT/config/phase2/candidates.yaml" \
  --dataset-version "$ROOT/data/phase2/dataset-version.json" \
  --gate-config "$ROOT/config/phase2/gate.yaml" \
  --confirm-final-once "$SELECTED" \
  --raw-root "$ROOT/data/phase2/raw" \
  --labels-root "$ROOT/data/phase2/labels" \
  --splits-root "$ROOT/data/phase2/splits" \
  --duplicate-reviews "$ROOT/config/duplicate-reviews.json"
```

Expected terminal files beneath selected run:

```text
final-evaluation.lock
final-evaluation.json
gate-final.json
```

Exit meanings:

```text
0 = gate pass
2 = invalid input/provenance/publication conflict
3 = mandatory gate failure
4 = blocked
```

**Never rerun final to tune thresholds or choose another model.** A fail is a durable result and requires a new iteration design, not a retry-until-pass.

### Step C — Frozen-checkpoint replay

Only after final handling is complete and under its own approved plan:

Start service:

```bash
cd avatar-web/fishing-ml
ROOT="$PWD"
PY="$ROOT/.venv/bin/python"
SELECTED="p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01"

$PY -m fishing_ml.inference_service \
  --frozen-dir "$ROOT/artifacts/$SELECTED/frozen" \
  --host 127.0.0.1 \
  --port 8080 \
  --max-body-bytes 1283950 \
  --timeout-ms 5000
```

Run replay in another shell:

```bash
$PY -m fishing_ml.replay \
  --batches-root "$ROOT/data/phase2/raw" \
  --labels-root "$ROOT/data/phase2/labels" \
  --endpoint http://127.0.0.1:8080/infer \
  --timeout-ms 5000 \
  --model-checksum 6168b65abaf8ade9008c9611413167f76533d1e80926b2be852df6e7e3a67789 \
  > "$ROOT/artifacts/phase2-replay.json"
```

Adjudicate:

```bash
$PY -m fishing_ml.experiments adjudicate-replay \
  --gate-config "$ROOT/config/phase2/gate.yaml" \
  --replay-report "$ROOT/artifacts/phase2-replay.json" \
  --frozen-dir "$ROOT/artifacts/$SELECTED/frozen" \
  --output "$ROOT/artifacts/phase2-replay-gate.json" \
  --stdout
```

Replay must remain local, aggregate-only, and read-only.

### Step D — Live shadow (separate authorization)

Do not run live shadow automatically after replay. It needs:

- explicit account/environment authorization;
- bounded duration;
- kill switch verification;
- runtime flag enablement;
- log redaction and privacy checks;
- confirmation that no TX43 or gameplay mutation can occur.

---

## 11. Safety constraints

These constraints are non-negotiable:

1. **Never use final during training, calibration, candidate comparison, or threshold tuning.**
2. **Never weaken zero-wrong-accepted.**
3. **Never overwrite or delete selection/freeze/final/gate artifacts to retry.**
4. **Keep one Git revision and one candidate identity through each operational stage.**
5. **Do not mix CPU matrix artifacts with newly generated MPS/auto-device artifacts.**
6. **Replay evidence must use the trusted checkpoint checksum from the verified freeze manifest.**
7. **No credentials, cookies, account IDs, raw packet bytes, decrypted traffic, images, or base64 payloads in ledgers/reports.**
8. **No TX43 and no `finishFishing()` in Phase 2.**
9. **Live shadow remains off by default and requires separate authorization.**
10. **Generated dataset/model artifacts are git-ignored; protect them operationally because Git will not restore them.**

---

## 12. First actions for the receiving engineer

Run this checklist before changing anything:

```bash
# 1. Confirm repository state
git branch --show-current
git log --oneline -8
git status --short

# 2. Confirm config remains CPU
rg -n 'device:' avatar-web/fishing-ml/config/phase2/candidates.yaml

# 3. Verify environment and tests
cd avatar-web/fishing-ml
PY=.venv/bin/python
$PY --version
$PY -m unittest \
  tests.test_phase2_training \
  tests.test_phase2_experiments \
  tests.test_phase2_gate \
  tests.test_inference_size_contract -v

# 4. Verify dataset identity
$PY -m fishing_ml.dataset_version verify data/phase2/dataset-version.json
shasum -a 256 data/phase2/dataset-version.json

# 5. Verify selected/frozen artifact
shasum -a 256 artifacts/phase2-selection.json
$PY -m fishing_ml.artifacts verify \
  --frozen-dir artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen

# 6. Confirm final has not been opened
find artifacts -type f \
  \( -name 'final-evaluation.lock' -o -name 'final-evaluation.json' -o -name 'gate-final.json' \) \
  -print

# 7. Confirm gate policy remains blocked
rg -n 'preAgreedPlaceholders' config/phase2/gate.yaml
```

Expected:

- Branch `main` at or after `906e5e4a`.
- `device: cpu`.
- 19 focused tests pass.
- Dataset-version hash matches `406be8ed...`.
- Selection hash matches `4c15e952...`.
- Freeze verify succeeds with checkpoint hash `6168b65a...`.
- No Phase 2 final files exist.
- `preAgreedPlaceholders: true` until the policy-approval cycle is completed.

---

## 13. Known working-tree caveats

At handover time, `AGENTS.md` and `CLAUDE.md` had pre-existing local modifications belonging to the user. Do not reset, discard, stage, or overwrite them without explicit instruction.

GitNexus may report its index stale after the latest commits. Before relying on graph analysis:

```bash
npx gitnexus analyze
```

If embeddings existed previously, preserve them with `--embeddings`; check `.gitnexus/meta.json` first.

---

## 14. Definition of done for the next engineer

The next cycle is not complete merely because `confirm-final` was invoked. It is complete only when:

- gate policy is explicitly approved from pre-final evidence;
- selected freeze passes verification immediately before final;
- final runs once with durable lock/evidence;
- gate result is recorded truthfully, pass or fail;
- no threshold/model retuning occurs after final;
- replay runs against the same trusted frozen checksum;
- replay evidence and gate report are immutable and sanitized;
- live shadow remains separate unless explicitly authorized.
