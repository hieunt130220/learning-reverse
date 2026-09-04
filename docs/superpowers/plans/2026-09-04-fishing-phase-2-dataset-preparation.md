# Fishing Matcher Phase 2 Dataset Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Phase 2 dataset — 200 imported raw batches, 200 labels, 140/30/30 splits (seed 20260904), and a verified immutable `dataset-version.json` — inside the isolated `data/phase2/` namespace without touching Phase A.

**Architecture:** Four sequential stages reusing existing CLIs: lossless import into `data/phase2/raw`, byte-exact label copy, seeded split creation with fail-closed duplicate handling, and a one-shot provenance script. Each stage ends with its own verification gate; any failure stops the workflow before the next stage.

**Tech Stack:** Python 3.12 (`fishing_ml` venv), existing `fishing-import` / `fishing-split` / `fishing-validate` / `fishing-phase2-dataset-version` / `fishing-phase2-experiment` CLIs, shell checksums, Git

**Spec:** `docs/superpowers/specs/2026-09-04-fishing-phase-2-dataset-preparation-design.md`

## Global Constraints

- Never modify anything under `data/raw`, `data/labels`, `data/splits`, or `data/incoming` (Phase A is read-only).
- Never modify production code, `config/phase2/*` (except `config/duplicate-reviews.json` only after explicit user review of a blocked duplicate), or gate policy.
- All Phase 2 data must live under `avatar-web/fishing-ml/data/phase2/`; never create aliases to Phase A roots.
- Fail-closed at every gate: import collision, invalid label, unreviewed duplicate, existing splits, or existing dataset-version stops the workflow without overwriting anything.
- Split seed is fixed: `20260904`. Counts are fixed: train 140, dev 30, final 30.
- `datasetId` is fixed: `phase2-20260904-01`, `parentDatasetId: null`.
- The one-shot dataset-version script runs as a heredoc; it is never committed into the repository.
- Dataset files (raw, labels, splits, dataset-version.json) are generated artifacts: never `git add` them; commit only docs.
- Never run training, compare, freeze, confirm-final, replay, or any game action in this plan.
- Final split content is used only by validators, never for metrics, thresholds, or selection.
- Run all commands from `avatar-web/fishing-ml/` with the project venv: `/Users/devios/learning-reverse/avatar-web/fishing-ml/.venv/bin/python -m ...` (or the worktree-equivalent path), referenced below as `$PY -m`.
- Stop immediately and record the blocker in the results ledger whenever a step's expected outcome does not match.

## Fixed Values

```bash
ML_ROOT="avatar-web/fishing-ml"           # relative to repo root; commands run from here
PY="$ML_ROOT/.venv/bin/python"            # or the worktree's equivalent venv path
RAW_A="data/raw"
LABELS_A="data/labels"
RAW_P2="data/phase2/raw"
LABELS_P2="data/phase2/labels"
SPLITS_P2="data/phase2/splits"
VERSION_P2="data/phase2/dataset-version.json"
REVIEWS="config/duplicate-reviews.json"
SEED="20260904"
DATASET_ID="phase2-20260904-01"
```

---

### Task 1: Preflight Baseline and Phase A Protection

**Files:**
- Read: `avatar-web/fishing-ml/data/raw/`, `avatar-web/fishing-ml/data/labels/`
- Create during execution: `/tmp/fishing-phase2-dataset-preflight.txt`
- Create: `docs/superpowers/plans/2026-09-04-fishing-phase-2-dataset-preparation-results.md`

**Interfaces:**
- Consumes: Clean `main` checkout with the frozen-execution results ledger present.
- Produces: Phase A sample checksums, batch/label counts, and an initialized results ledger used by all later tasks.

- [ ] **Step 1: Confirm starting state**

Run from `avatar-web/fishing-ml`:

```bash
ls data/raw | wc -l
ls data/labels | wc -l
ls data/phase2 2>/dev/null || echo "phase2-absent"
```

Expected: `206`, `200`, `phase2-absent`. If `data/phase2` already exists with content, stop and investigate before proceeding.

- [ ] **Step 2: Capture Phase A protection baseline**

Run from `avatar-web/fishing-ml`:

```bash
{
  ls data/raw | sort | sha256sum
  ls data/labels | sort | sha256sum
  for b in $(ls data/raw | sort | head -3); do
    sha256sum "data/raw/$b/manifest.json"
  done
} > /tmp/fishing-phase2-dataset-preflight.txt
cat /tmp/fishing-phase2-dataset-preflight.txt
```

Expected: five checksum lines recorded. These are compared again in Task 5 to prove Phase A was untouched.

- [ ] **Step 3: Count eligible batches**

Run from `avatar-web/fishing-ml`:

```bash
"$PY" - <<'PY'
import json
from pathlib import Path
labels = {p.stem for p in Path("data/labels").glob("*.json")}
complete = set()
for p in Path("data/labels").glob("*.json"):
    d = json.loads(p.read_text())
    if d.get("status") == "complete" and d.get("batchId") == p.stem:
        complete.add(p.stem)
batches = {p.name for p in Path("data/raw").iterdir() if (p / "manifest.json").is_file()}
eligible = sorted(batches & complete)
print(f"raw={len(batches)} labels={len(labels)} complete={len(complete)} eligible={len(eligible)}")
assert len(eligible) >= 200, "not enough eligible batches for 140/30/30"
Path("/tmp/fishing-phase2-eligible.txt").write_text("\n".join(eligible) + "\n")
PY
```

Expected: `eligible >= 200` and no assertion failure. Observation that 6 raw batches lack labels is recorded, not an error.

- [ ] **Step 4: Initialize the results ledger**

Create `docs/superpowers/plans/2026-09-04-fishing-phase-2-dataset-preparation-results.md`:

```markdown
# Fishing Matcher Phase 2 Dataset Preparation Results

**Status:** IN_PROGRESS
**Dataset ID:** pending
**Seed:** 20260904

## Stage results

| Stage | Status | Evidence |
|---|---|---|

## Blockers

None.

## Dataset identity

Pending.
```

- [ ] **Step 5: Checkpoint**

Run: `git status --short` and confirm no dataset or config file is staged.

---

### Task 2: Import Raw Batches into Phase 2 Namespace

**Files:**
- Read: `avatar-web/fishing-ml/data/raw/**` (read-only)
- Create: `avatar-web/fishing-ml/data/phase2/raw/<batch>/...`

**Interfaces:**
- Consumes: Task 1 baseline and eligible count.
- Produces: `data/phase2/raw` containing one lossless copy per Phase A batch, verified by SHA-256.

- [ ] **Step 1: Create the phase2 namespace directories**

Run from `avatar-web/fishing-ml`:

```bash
mkdir -p data/phase2
"$PY" -m fishing_ml.dataset_version namespace --base . --name raw
"$PY" -m fishing_ml.dataset_version namespace --base . --name labels
"$PY" -m fishing_ml.dataset_version namespace --base . --name splits
```

Expected: three resolved paths printed under `data/phase2/`. Any escape/alias error stops the plan.

- [ ] **Step 2: Run the lossless importer**

Run from `avatar-web/fishing-ml`:

```bash
"$PY" -m fishing_ml.import_data --source data/raw --raw-root data/phase2/raw \
  | tee /tmp/fishing-phase2-import.log
```

Expected: per-batch lines ending with every batch `imported` or `skipped`; zero `error`. An `ineligible` line is recorded (legacy batch without `imagesNew`) but must not be one of the 200 eligible batches; any `error` line stops the plan.

- [ ] **Step 3: Verify import completeness**

Run from `avatar-web/fishing-ml`:

```bash
ls data/phase2/raw | wc -l
"$PY" - <<'PY'
from pathlib import Path
a = sorted(p.name for p in Path("data/raw").iterdir() if (p / "manifest.json").is_file())
b = sorted(p.name for p in Path("data/phase2/raw").iterdir() if (p / "manifest.json").is_file())
missing = sorted(set(a) - set(b))
assert not missing, f"batches not imported: {missing}"
print(f"imported-batches={len(b)}")
PY
```

Expected: batch count equals the eligible-or-more total from Task 1 and `imported-batches` prints with no missing list.

- [ ] **Step 4: Spot-check lossless copies**

Run from `avatar-web/fishing-ml`:

```bash
for b in $(ls data/raw | sort | head -3); do
  "$PY" - "$b" <<'PY'
import hashlib, sys
from pathlib import Path
b = sys.argv[1]
same = all(
    hashlib.sha256((Path("data/raw") / b / name).read_bytes()).hexdigest()
    == hashlib.sha256((Path("data/phase2/raw") / b / name).read_bytes()).hexdigest()
    for name in ("manifest.json", "img/0.png", "new/0.png")
)
assert same, f"copy mismatch for {b}"
print(f"lossless {b}")
PY
done
```

Expected: `lossless <batch>` for each of the three batches.

- [ ] **Step 5: Run raw/label validator against Phase 2 roots**

Run from `avatar-web/fishing-ml`:

```bash
"$PY" -m fishing_ml.validate --raw-root data/phase2/raw --labels-root data/phase2/labels
```

Expected at this point: exit 0 or a report limited to batches that have no label yet (labels are copied in Task 3). If it fails for any other reason, stop. Record the outcome in the ledger.

---

### Task 3: Copy Labels Byte-Exact

**Files:**
- Read: `avatar-web/fishing-ml/data/labels/**` (read-only)
- Create: `avatar-web/fishing-ml/data/phase2/labels/<batch>.json`

**Interfaces:**
- Consumes: Imported `data/phase2/raw` batches from Task 2.
- Produces: One byte-exact label document per eligible batch under `data/phase2/labels`.

- [ ] **Step 1: Copy labels no-clobber**

Run from `avatar-web/fishing-ml`:

```bash
"$PY" - <<'PY'
import shutil
from pathlib import Path
src_root, dst_root = Path("data/labels"), Path("data/phase2/labels")
dst_root.mkdir(parents=True, exist_ok=True)
copied = skipped = 0
for src in sorted(src_root.glob("*.json")):
    dst = dst_root / src.name
    if dst.exists():
        if dst.read_bytes() != src.read_bytes():
            raise SystemExit(f"conflicting existing label: {dst}")
        skipped += 1
    else:
        shutil.copyfile(src, dst)
        copied += 1
print(f"copied={copied} identical-existing={skipped}")
PY
```

Expected: `copied=200` (or `copied=200 identical-existing=0` on first run) with no conflict error.

- [ ] **Step 2: Verify label coverage matches imported batches**

Run from `avatar-web/fishing-ml`:

```bash
"$PY" - <<'PY'
import json
from pathlib import Path
raw = {p.name for p in Path("data/phase2/raw").iterdir() if (p / "manifest.json").is_file()}
labels = {p.stem for p in Path("data/phase2/labels").glob("*.json")}
covered = raw & labels
print(f"raw={len(raw)} labels={len(labels)} covered={len(covered)}")
assert len(covered) >= 200
for stem in sorted(covered)[:200]:
    d = json.loads((Path("data/phase2/labels") / f"{stem}.json").read_text())
    assert d.get("status") == "complete" and d.get("batchId") == stem, f"invalid label {stem}"
print("label-contract=ok")
PY
```

Expected: `covered >= 200` and `label-contract=ok`. A label with `status != complete` stops the plan per the spec error model.

- [ ] **Step 3: Validate raw+labels together**

Run from `avatar-web/fishing-ml`:

```bash
"$PY" -m fishing_ml.validate --raw-root data/phase2/raw --labels-root data/phase2/labels
```

Expected: exit 0. Any integrity issue stops the plan.

- [ ] **Step 4: Update ledger**

Record import counts, label counts, and validator status in the results ledger.

---

### Task 4: Create Splits (140/30/30, Seed 20260904) and Handle Duplicates

**Files:**
- Read: `avatar-web/fishing-ml/data/phase2/raw/`, `data/phase2/labels/`
- Create: `avatar-web/fishing-ml/data/phase2/splits/{train,dev,final}.txt`
- Modify only after user review: `avatar-web/fishing-ml/config/duplicate-reviews.json`

**Interfaces:**
- Consumes: Verified raw+labels from Task 3 and the empty `config/duplicate-reviews.json`.
- Produces: Validated 140/30/30 split files, or a blocked state listing duplicate checksums for user review.

- [ ] **Step 1: Create splits**

Run from `avatar-web/fishing-ml`:

```bash
"$PY" -m fishing_ml.split create \
  --raw-root data/phase2/raw \
  --labels-root data/phase2/labels \
  --splits-root data/phase2/splits \
  --duplicate-reviews config/duplicate-reviews.json \
  --train-count 140 --dev-count 30 --final-count 30 \
  --seed 20260904
```

Expected: `valid=true train=140 dev=30 final=30 issues=0`. If it reports `DUPLICATE_UNREVIEWED` or any issue, go to Step 2; do not retry with a different seed and do not auto-edit reviews.

- [ ] **Step 2: (Only when blocked) Present duplicates for user review**

If Step 1 failed with duplicate issues, list them exactly as printed (`DUPLICATE_*` lines with checksums and batch placements), stop the plan, and ask the user to decide per checksum: accept (record in `reviewedSha256`) or handle otherwise. Nothing is written to `config/duplicate-reviews.json` without the user's explicit per-checksum decision. After the user decides, update the JSON following its existing schema and re-run Step 1.

- [ ] **Step 3: Verify split files**

Run from `avatar-web/fishing-ml`:

```bash
wc -l data/phase2/splits/train.txt data/phase2/splits/dev.txt data/phase2/splits/final.txt
"$PY" - <<'PY'
from pathlib import Path
sets = {n: set((Path("data/phase2/splits") / f"{n}.txt").read_text().split()) for n in ("train", "dev", "final")}
assert len(sets["train"]) == 140 and len(sets["dev"]) == 30 and len(sets["final"]) == 30
assert not (sets["train"] & sets["dev"] or sets["train"] & sets["final"] or sets["dev"] & sets["final"])
print("splits=disjoint-140-30-30")
PY
```

Expected: `140`, `30`, `30` line counts (plus total) and `splits=disjoint-140-30-30`.

- [ ] **Step 4: Re-validate splits**

Run from `avatar-web/fishing-ml`:

```bash
"$PY" -m fishing_ml.split validate \
  --raw-root data/phase2/raw \
  --labels-root data/phase2/labels \
  --splits-root data/phase2/splits \
  --duplicate-reviews config/duplicate-reviews.json \
  --train-count 140 --dev-count 30 --final-count 30
```

Expected: `valid=true ... issues=0` and exit 0.

- [ ] **Step 5: Update ledger**

Record split counts, seed, and validator status.

---

### Task 5: Create Dataset Version One-Shot

**Files:**
- Read: `avatar-web/fishing-ml/data/phase2/raw/`
- Create: `avatar-web/fishing-ml/data/phase2/dataset-version.json`

**Interfaces:**
- Consumes: Imported batch IDs from Task 2 and validated splits from Task 4.
- Produces: Immutable `dataset-version.json` with `datasetId=phase2-20260904-01`, verifiable by the existing CLI.

- [ ] **Step 1: Prove Phase A untouched so far**

Run from `avatar-web/fishing-ml`:

```bash
{
  ls data/raw | sort | sha256sum
  ls data/labels | sort | sha256sum
  for b in $(ls data/raw | sort | head -3); do
    sha256sum "data/raw/$b/manifest.json"
  done
} > /tmp/fishing-phase2-dataset-postcheck.txt
diff /tmp/fishing-phase2-dataset-preflight.txt /tmp/fishing-phase2-dataset-postcheck.txt
```

Expected: no diff. Any difference stops the plan for investigation.

- [ ] **Step 2: Run the one-shot version script (no-replace)**

Run from `avatar-web/fishing-ml`:

```bash
"$PY" - <<'PY'
import os
from datetime import datetime, timezone
from pathlib import Path
from fishing_ml.dataset_version import DatasetVersion, write_dataset_version

path = Path("data/phase2/dataset-version.json")
if os.path.lexists(path):
    raise SystemExit(f"refusing to overwrite existing dataset version: {path}")
batch_ids = tuple(sorted({
    p.name for p in Path("data/phase2/raw").iterdir() if (p / "manifest.json").is_file()
}))
version = DatasetVersion(
    schema_version=1,
    dataset_id="phase2-20260904-01",
    parent_dataset_id=None,
    created_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    source_batches=batch_ids,
)
write_dataset_version(path, version)
print(f"datasetId={version.dataset_id} sourceBatches={len(version.source_batches)}")
PY
```

Expected: `datasetId=phase2-20260904-01 sourceBatches=200` (or the actual imported count recorded as eligible) with no overwrite error.

- [ ] **Step 3: Verify the document**

Run from `avatar-web/fishing-ml`:

```bash
"$PY" -m fishing_ml.dataset_version verify data/phase2/dataset-version.json
```

Expected: exit 0 and a printed, verified identity.

- [ ] **Step 4: Update ledger**

Record dataset ID, source-batch count, creation timestamp, and the file's SHA-256 (safe identity only).

---

### Task 6: End-to-End Verification Gate

**Files:**
- Read: all Phase 2 dataset files
- Modify: `docs/superpowers/plans/2026-09-04-fishing-phase-2-dataset-preparation-results.md`

**Interfaces:**
- Consumes: All prior stages.
- Produces: The `dataset: ready` verdict that unblocks freeze-execution Task 3.

- [ ] **Step 1: Enumerate the candidate matrix without training**

Run from `avatar-web/fishing-ml`:

```bash
"$PY" -m fishing_ml.experiments list \
  --candidates config/phase2/candidates.yaml \
  --splits-root data/phase2/splits \
  --dataset-version data/phase2/dataset-version.json \
  > /tmp/fishing-phase2-candidates.json
"$PY" - <<'PY'
import json
from pathlib import Path
d = json.loads(Path("/tmp/fishing-phase2-candidates.json").read_text())
assert d["schemaVersion"] == 1 and d["count"] == 24, d.get("count")
assert d["dataset"]["datasetId"] == "phase2-20260904-01"
print("matrix=24 dataset-id=ok")
PY
```

Expected: `matrix=24 dataset-id=ok`. This command reads only train/dev for checksums and never opens final for evaluation.

- [ ] **Step 2: Full Phase A protection re-check**

Repeat Task 5 Step 1's diff (`preflight` vs a fresh postcheck). Expected: no diff.

- [ ] **Step 3: Confirm the freeze-execution readiness path now passes its dataset checks**

Run from `avatar-web/fishing-ml`:

```bash
for p in data/phase2/raw data/phase2/labels data/phase2/splits/train.txt data/phase2/splits/dev.txt data/phase2/splits/final.txt data/phase2/dataset-version.json config/duplicate-reviews.json; do
  test -e "$p" && printf 'PASS %s\n' "$p" || printf 'BLOCKED %s\n' "$p"
done
```

Expected: every line `PASS`. Any `BLOCKED` line is a plan failure.

- [ ] **Step 4: Record dataset readiness in the ledger**

Set `Status: COMPLETE — DATASET READY` and fill the Dataset identity section: dataset ID, seed, counts (raw/labels/train/dev/final), dataset-version SHA-256, and the matrix count 24. Note explicitly that no training/compare/freeze/final was run and no dataset file is staged.

- [ ] **Step 5: Commit only documentation**

Run from repo root:

```bash
git add \
  docs/superpowers/specs/2026-09-04-fishing-phase-2-dataset-preparation-design.md \
  docs/superpowers/plans/2026-09-04-fishing-phase-2-dataset-preparation.md \
  docs/superpowers/plans/2026-09-04-fishing-phase-2-dataset-preparation-results.md
git diff --cached --check
git commit -m "docs(fishing): record phase 2 dataset preparation

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

Expected: the commit contains only the three documents. Never stage `data/phase2/**`, `data/raw/**`, or `config/duplicate-reviews.json`.

## Stop Conditions

1. Any Phase A checksum differs from its baseline.
2. Import reports an `error` line or a batch-collision.
3. Any label has `status != "complete"` or a mismatched `batchId`.
4. Split create reports any issue other than `DUPLICATE_*` awaiting review.
5. `dataset-version.json` or `data/phase2/splits` already exists when creation is attempted.
6. `experiments list` returns a count other than 24 or a different dataset ID.
7. Any verification command exits nonzero.
8. Any step would write outside `data/phase2/`, the results ledger, or (with user approval) `config/duplicate-reviews.json`.
