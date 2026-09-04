# Fishing Matcher Phase 2 Freeze Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify operational readiness, execute and validate all 24 Phase 2 candidates sequentially, publish the immutable selection, and independently verify the selected frozen candidate without opening final data.

**Architecture:** Use the checked-in Phase 2 CLIs as a two-gate workflow: Gate R verifies repository, runtime, code, dataset, splits, and review evidence; Gate E runs only after Gate R passes and advances one canonical candidate at a time through strict artifact validation. All stages are fail-closed, preserve a fixed Git revision, write sanitized evidence, and stop at verified freeze.

**Tech Stack:** Python 3.12 virtual environment, `fishing_ml` CLI modules, PyTorch, NumPy, Pillow, scikit-image, PyYAML, Node.js, TypeScript, npm, Git, GitNexus

**Spec:** `docs/superpowers/specs/2026-09-04-fishing-phase-2-freeze-execution-design.md`

## Global Constraints

- Work from branch `main` at one fixed Git revision from readiness through freeze.
- Preserve existing user changes in `AGENTS.md` and `CLAUDE.md`; do not reset, stash, stage, or modify them.
- Python must satisfy `>=3.11,<3.13`; use `avatar-web/fishing-ml/.venv/bin/python` and prefer Python 3.12.
- Do not install or upgrade dependencies unless the user separately approves that outward/environment-changing action.
- Do not create, copy, import, label, review, or modify Phase 2 data or split files in this plan.
- Never substitute Phase A data or artifacts for Phase 2 inputs.
- Do not modify production code, candidate configuration, training semantics, selection policy, or gate policy.
- Do not run `confirm-final`, inference replay, live shadow, TX43, or `finishFishing()`.
- Final data may be checked only for required path/integrity contracts; it must not feed training, calibration, comparison, or selection.
- Run all 24 candidates sequentially in the canonical order emitted by `experiments list`; never invent run IDs.
- Reuse existing artifacts only when the checked-in strict validators accept them.
- Never delete, overwrite, force-replace, or silently repair a conflicting artifact.
- A failed candidate stops the sequence; do not skip it and do not compare an incomplete set.
- Generated model/data artifacts remain uncommitted unless the user separately approves committing them.
- Ledger content must not include images, base64 payloads, packet bytes, credentials, cookies, account identifiers, or per-user telemetry.
- Project policy forbids TDD and new tests unless explicitly requested; this plan writes no production code or test files.
- Before any commit, run `gitnexus_detect_changes({scope: "all"})` and verify no unexpected production symbols or flows changed.

## Fixed Paths and Shell Conventions

All shell commands in Tasks 1–8 run from repository root unless explicitly prefixed with `cd`.

```bash
ROOT=/Users/devios/learning-reverse
ML="$ROOT/avatar-web/fishing-ml"
SERVER="$ROOT/avatar-web/server"
PY="$ML/.venv/bin/python"
CANDIDATES="$ML/config/phase2/candidates.yaml"
DATASET_CONFIG="$ML/config/phase2/dataset.yaml"
DATASET_VERSION="$ML/data/phase2/dataset-version.json"
RAW="$ML/data/phase2/raw"
LABELS="$ML/data/phase2/labels"
SPLITS="$ML/data/phase2/splits"
REVIEWS="$ML/config/duplicate-reviews.json"
ARTIFACTS="$ML/artifacts"
SELECTION="$ML/artifacts/phase2-selection.json"
RUN_LIST=/tmp/fishing-phase2-candidates.json
BASELINE=/tmp/fishing-phase2-preflight-files.txt
RESULTS="$ROOT/docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md"
```

These variables are documentation shorthand. Each execution shell is fresh, so commands that use them must define them in the same shell invocation or use the absolute paths shown above.

---

### Task 1: Capture Repository Baseline and Fixed Revision

**Files:**
- Read: `docs/superpowers/specs/2026-09-04-fishing-phase-2-freeze-execution-design.md`
- Read: `avatar-web/fishing-ml/config/phase2/gate.yaml`
- Create during execution: `/tmp/fishing-phase2-preflight-files.txt`
- Create during execution: `docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md`

**Interfaces:**
- Consumes: Approved design spec and current `main` checkout.
- Produces: Fixed 40-character `BASE_REV`, baseline working-tree inventory, baseline final-artifact inventory, and initialized sanitized results ledger used by every later task.

- [ ] **Step 1: Confirm branch and capture revision**

Run:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected: branch is `main`; revision is 40 lowercase hexadecimal characters; existing `AGENTS.md` and `CLAUDE.md` modifications are recorded and left untouched. If the branch is not `main`, stop with `repository-revision-changed`.

- [ ] **Step 2: Capture the pre-execution artifact inventory**

Run:

```bash
find avatar-web/fishing-ml/artifacts -type f -print | LC_ALL=C sort > /tmp/fishing-phase2-preflight-files.txt
find avatar-web/fishing-ml/artifacts -type f \
  \( -name 'final-evaluation.lock' -o -name 'final-evaluation.json' -o -name 'gate-final.json' \) \
  -print | LC_ALL=C sort
```

Expected: only pre-existing Phase A final files may appear; record their exact paths. Do not remove or reinterpret them as Phase 2 evidence.

- [ ] **Step 3: Verify placeholder gate remains unchanged**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
import yaml
p = Path('avatar-web/fishing-ml/config/phase2/gate.yaml')
d = yaml.safe_load(p.read_text())
assert d['meta']['preAgreedPlaceholders'] is True
print('gate-policy: placeholder (unchanged)')
PY
```

Expected: prints `gate-policy: placeholder (unchanged)`. This uses system Python only if PyYAML is available; otherwise run the same snippet with the verified `$PY` after Task 2. A false value is out-of-scope drift: stop.

- [ ] **Step 4: Initialize the results ledger**

Create `docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md` with this exact structure, replacing only the revision and observed existing-change list with actual values:

```markdown
# Fishing Matcher Phase 2 Freeze Execution Results

**Status:** IN_PROGRESS
**Git revision:** `<40-hex revision>`
**Final data opened:** no
**Training started:** no

## Preserved pre-existing working-tree changes

- `AGENTS.md`
- `CLAUDE.md`

## Gate R

| Check | Status | Evidence |
|---|---|---|

## Candidate execution

| Ordinal | Run ID | Status | Evidence |
|---:|---|---|---|

## Selection and freeze

| Check | Status | Evidence |
|---|---|---|

## Blockers and failures

None.

## Safety and privacy

Pending.
```

Do not include secret environment values or raw command output.

- [ ] **Step 5: Checkpoint Task 1 without committing**

Run:

```bash
git diff --check -- docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md
git status --short
```

Expected: no whitespace errors; the results ledger is the only new execution document. Do not commit while status is `IN_PROGRESS`.

---

### Task 2: Verify Python Runtime and Code

**Files:**
- Read: `avatar-web/fishing-ml/pyproject.toml`
- Read: `avatar-web/fishing-ml/tests/test_phase2_training.py`
- Read: `avatar-web/fishing-ml/tests/test_phase2_experiments.py`
- Read: `avatar-web/fishing-ml/tests/test_phase2_gate.py`
- Read: `avatar-web/fishing-ml/tests/test_inference_size_contract.py`
- Modify: `docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md`

**Interfaces:**
- Consumes: Fixed `BASE_REV` and initialized ledger from Task 1.
- Produces: Gate R runtime/code statuses and dependency versions. Any failure terminates before dataset execution.

- [ ] **Step 1: Verify Python executable, version, source resolution, and dependencies**

Run:

```bash
ML=/Users/devios/learning-reverse/avatar-web/fishing-ml
PY="$ML/.venv/bin/python"
test -x "$PY"
"$PY" - <<'PY'
import sys, fishing_ml, torch, numpy, PIL, skimage, yaml
assert (3, 11) <= sys.version_info[:2] < (3, 13), sys.version
assert '/avatar-web/fishing-ml/src/fishing_ml/' in fishing_ml.__file__.replace('\\', '/')
print('python=' + sys.version.split()[0])
print('executable=' + sys.executable)
print('fishing_ml=' + fishing_ml.__file__)
print('torch=' + torch.__version__)
print('numpy=' + numpy.__version__)
print('Pillow=' + PIL.__version__)
print('scikit-image=' + skimage.__version__)
print('PyYAML=' + yaml.__version__)
PY
```

Expected: exit 0, Python 3.11 or 3.12, and `fishing_ml` resolves beneath this checkout. Missing `.venv` or imports are `runtime-incompatible`/`dependency-missing`: update the ledger to `BLOCKED`, set execution `NOT_STARTED`, and stop without installing anything.

- [ ] **Step 2: Run focused Python Phase 2 tests**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/fishing-ml && \
.venv/bin/python -m unittest \
  tests.test_phase2_training \
  tests.test_phase2_experiments \
  tests.test_phase2_gate \
  tests.test_inference_size_contract -v
```

Expected: 19 tests pass and exit 0. Any failure is `verification-failed`; record the failing test names only, do not change code, and stop.

- [ ] **Step 3: Compile Python package**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/fishing-ml && \
.venv/bin/python -m compileall -q src/fishing_ml
```

Expected: exit 0. Record any existing warning separately without converting a successful exit into failure.

- [ ] **Step 4: Run server tests**

Run:

```bash
npm --prefix /Users/devios/learning-reverse/avatar-web/server test
```

Expected: 270 tests pass, 0 fail. Record the pre-existing `MaxListenersExceededWarning` if emitted; do not treat it as Phase 2 failure when exit code is 0.

- [ ] **Step 5: Run server typecheck and production build**

Run:

```bash
npm --prefix /Users/devios/learning-reverse/avatar-web/server run typecheck
npm --prefix /Users/devios/learning-reverse/avatar-web/server run build
```

Expected: both commands exit 0. Any nonzero exit is `verification-failed`; stop before dataset execution.

- [ ] **Step 6: Record aggregate runtime/code evidence**

Append Gate R rows with exact versions, test counts, and command exit status. Do not paste full logs. Mark runtime and code verification `PASS` only after Steps 1–5 all pass.

- [ ] **Step 7: Reconfirm fixed revision**

Run:

```bash
test "$(git rev-parse HEAD)" = '<BASE_REV_FROM_TASK_1>'
```

Expected: exit 0. A mismatch is `repository-revision-changed`; stop.

---

### Task 3: Execute Dataset Readiness Gate Fail-Closed

**Files:**
- Read: `avatar-web/fishing-ml/config/phase2/dataset.yaml`
- Read: `avatar-web/fishing-ml/config/duplicate-reviews.json`
- Read if present: `avatar-web/fishing-ml/data/phase2/dataset-version.json`
- Read if present: `avatar-web/fishing-ml/data/phase2/splits/train.txt`
- Read if present: `avatar-web/fishing-ml/data/phase2/splits/dev.txt`
- Do not read for tuning: `avatar-web/fishing-ml/data/phase2/splits/final.txt`
- Modify: `docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md`

**Interfaces:**
- Consumes: Passing runtime/code checks and fixed `BASE_REV`.
- Produces: Overall Gate R status `PASS`, `BLOCKED`, or `FAIL`. Tasks 4–8 are forbidden unless this task produces `PASS`.

- [ ] **Step 1: Check mandatory Phase 2 paths without creating them**

Run:

```bash
ML=/Users/devios/learning-reverse/avatar-web/fishing-ml
for p in \
  "$ML/data/phase2/raw" \
  "$ML/data/phase2/labels" \
  "$ML/data/phase2/splits/train.txt" \
  "$ML/data/phase2/splits/dev.txt" \
  "$ML/data/phase2/splits/final.txt" \
  "$ML/data/phase2/dataset-version.json" \
  "$ML/config/duplicate-reviews.json"
do
  if test -e "$p"; then printf 'PASS %s\n' "$p"; else printf 'BLOCKED %s\n' "$p"; fi
done
```

Expected in the currently observed repository: Phase 2 paths report `BLOCKED`. If any mandatory path is missing, update the ledger with `phase2-dataset-missing`, set `Training started: no`, set overall status `BLOCKED`, complete the safety checks in Task 8 Steps 1–3, then stop. Do not run Tasks 4–7 and do not create/copy the missing paths.

- [ ] **Step 2: Resolve and verify Phase 2 namespaces when all paths exist**

Run only if Step 1 reports no missing paths:

```bash
cd /Users/devios/learning-reverse/avatar-web/fishing-ml && \
.venv/bin/python -m fishing_ml.dataset_version namespace --base . --name raw && \
.venv/bin/python -m fishing_ml.dataset_version namespace --base . --name labels && \
.venv/bin/python -m fishing_ml.dataset_version namespace --base . --name splits
```

Expected: resolved paths are under `data/phase2/` and are not Phase A roots. Otherwise record `dataset-version-invalid` and stop.

- [ ] **Step 3: Verify immutable dataset version document**

Run only after Step 2 passes:

```bash
cd /Users/devios/learning-reverse/avatar-web/fishing-ml && \
.venv/bin/python -m fishing_ml.dataset_version verify data/phase2/dataset-version.json
```

Expected: exit 0 and a valid dataset identity. Record only dataset ID, parent ID if present, UTC creation timestamp, source-batch count, and file SHA-256; do not record sample content.

- [ ] **Step 4: Validate raw and labels without writing a report**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/fishing-ml && \
.venv/bin/python -m fishing_ml.validate \
  --raw-root data/phase2/raw \
  --labels-root data/phase2/labels
```

Expected: exit 0. Do not add `--report`; do not invent `--require-batches` or `--require-pairs` minima. Exit 2 is `dataset-integrity-failed`.

- [ ] **Step 5: Use matrix enumeration as the train/dev split and review preflight**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/fishing-ml && \
.venv/bin/python -m fishing_ml.experiments list \
  --candidates config/phase2/candidates.yaml \
  --splits-root data/phase2/splits \
  --dataset-version data/phase2/dataset-version.json \
  > /tmp/fishing-phase2-candidates.json
```

Expected: exit 0 without training and without opening final for evaluation. A split/review integrity error is recorded as `split-integrity-failed` or `duplicate-review-incomplete` according to the emitted validation error.

- [ ] **Step 6: Verify canonical count and unique identities**

Run:

```bash
/Users/devios/learning-reverse/avatar-web/fishing-ml/.venv/bin/python - <<'PY'
import json
from pathlib import Path
d = json.loads(Path('/tmp/fishing-phase2-candidates.json').read_text())
assert d['schemaVersion'] == 1
assert d['count'] == 24
runs = [x['runId'] for x in d['candidates']]
keys = [x['matrixKey'] for x in d['candidates']]
assert len(runs) == len(set(runs)) == 24
assert len(keys) == len(set(keys)) == 24
assert d['axes'] == {'augmentation': 3, 'hardNegative': 2, 'temperature': 2, 'embedding': 2}
print('candidate-matrix: 24 unique canonical candidates')
PY
```

Expected: exit 0. Otherwise record `candidate-matrix-invalid` and stop.

- [ ] **Step 7: Mark Gate R result**

Apply the reduction rule: any `FAIL` → `FAIL`; otherwise any `BLOCKED` → `BLOCKED`; otherwise all mandatory checks → `PASS`. Record `Training started: no`. Proceed to Task 4 only for `PASS`.

---

### Task 4: Run and Verify 24 Candidates Sequentially

**Files:**
- Read: `/tmp/fishing-phase2-candidates.json`
- Generate: `avatar-web/fishing-ml/artifacts/phase2-experiments/<run-id>.json`
- Generate: `avatar-web/fishing-ml/artifacts/<run-id>/`
- Modify after each candidate: `docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md`

**Interfaces:**
- Consumes: Gate R `PASS`, canonical ordered candidate list, fixed dataset identity, and `BASE_REV`.
- Produces: 24/24 strict-valid candidate manifests and run directories, or a single recorded stopping failure.

- [ ] **Step 1: Extract canonical ordered run IDs**

Run:

```bash
/Users/devios/learning-reverse/avatar-web/fishing-ml/.venv/bin/python - <<'PY'
import json
from pathlib import Path
d = json.loads(Path('/tmp/fishing-phase2-candidates.json').read_text())
for i, c in enumerate(d['candidates'], 1):
    print(f"{i:02d}\t{c['runId']}\t{c['matrixKey']}")
PY
```

Expected: exactly 24 lines numbered `01` through `24`. Copy these identities into the candidate ledger table in the same order, initially marked `NOT_STARTED`.

- [ ] **Step 2: Execute candidate 01 using its emitted run ID**

Run, replacing `<RUN_ID_01>` only with line 01 from Step 1:

```bash
cd /Users/devios/learning-reverse/avatar-web/fishing-ml && \
test "$(git rev-parse HEAD)" = '<BASE_REV_FROM_TASK_1>' && \
.venv/bin/python -m fishing_ml.experiments run \
  --candidates config/phase2/candidates.yaml \
  --splits-root data/phase2/splits \
  --dataset-version data/phase2/dataset-version.json \
  --raw-root data/phase2/raw \
  --labels-root data/phase2/labels \
  --duplicate-reviews config/duplicate-reviews.json \
  --artifacts-root artifacts \
  --run-id '<RUN_ID_01>'
```

Expected: exit 0. The command either creates a complete immutable run or revalidates an existing run. A nonzero exit records `candidate-run-failed` for candidate 01 and stops the task.

- [ ] **Step 3: Strictly revalidate candidate 01 via the same idempotent run command**

Run the exact Step 2 command a second time with `<RUN_ID_01>`.

Expected: exit 0 through `_cmd_run_reuse`, proving the manifest and required outputs are accepted by current strict validators. Record candidate 01 `PASS` and `reused/verified` or `created/verified` without copying predictions into the ledger.

- [ ] **Step 4: Repeat execute-then-revalidate for candidates 02–24, one at a time**

For each next line from Step 1:

1. Confirm `git rev-parse HEAD` equals `BASE_REV`.
2. Run the exact Step 2 command with that line's emitted run ID.
3. Run it once more to force strict reuse validation.
4. Mark that one row `PASS` before starting the next candidate.
5. Stop immediately on a nonzero exit with `candidate-run-failed` or `candidate-artifact-invalid`.

Expected: all 24 rows become `PASS`. Do not combine candidates into a parallel shell loop; sequential execution and per-candidate review are required.

- [ ] **Step 5: Verify manifest set corresponds exactly to the canonical list**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/fishing-ml && \
.venv/bin/python - <<'PY'
import json
from pathlib import Path
listed = json.loads(Path('/tmp/fishing-phase2-candidates.json').read_text())
expected = {c['runId'] + '.json' for c in listed['candidates']}
root = Path('artifacts/phase2-experiments')
actual = {p.name for p in root.glob('*.json') if p.is_file() and not p.is_symlink()}
missing = sorted(expected - actual)
extra = sorted(actual - expected)
assert not missing, f'missing manifests: {missing}'
assert not extra, f'foreign manifests: {extra}'
print('candidate-set: 24/24 exact manifests')
PY
```

Expected: `candidate-set: 24/24 exact manifests`. Missing or foreign manifests are `candidate-set-incomplete`; stop before compare.

---

### Task 5: Compare and Publish Immutable Selection

**Files:**
- Read: `avatar-web/fishing-ml/artifacts/phase2-experiments/*.json`
- Create or byte-identically reuse: `avatar-web/fishing-ml/artifacts/phase2-selection.json`
- Modify: `docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md`

**Interfaces:**
- Consumes: Exact 24/24 strict-valid candidate set and fixed `BASE_REV`.
- Produces: Verified immutable selection with `selectedRunId` and `selectedMatrixKey`.

- [ ] **Step 1: Reconfirm revision and complete candidate status**

Run:

```bash
test "$(git rev-parse HEAD)" = '<BASE_REV_FROM_TASK_1>'
```

Expected: exit 0 and all 24 ledger rows already `PASS`.

- [ ] **Step 2: Compare the complete set**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/fishing-ml && \
.venv/bin/python -m fishing_ml.experiments compare \
  --candidates config/phase2/candidates.yaml \
  --splits-root data/phase2/splits \
  --dataset-version data/phase2/dataset-version.json \
  --artifacts-root artifacts \
  --selection-path artifacts/phase2-selection.json
```

Expected: exit 0 and JSON containing selected run/matrix identities. Exit 3 is `no-eligible-candidate`; do not weaken zero-wrong-accepted. Exit 2 with existing conflicting selection is `selection-conflict`; do not delete it.

- [ ] **Step 3: Re-run compare to verify immutable idempotent reuse**

Run the exact Step 2 command again.

Expected: exit 0 with the same identities. The checked-in validator re-reads selection and all current provenance. Record selected identities and SHA-256 of `phase2-selection.json`.

- [ ] **Step 4: Verify selected run belongs to canonical matrix**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/fishing-ml && \
.venv/bin/python - <<'PY'
import hashlib, json
from pathlib import Path
listed = json.loads(Path('/tmp/fishing-phase2-candidates.json').read_text())
selection_path = Path('artifacts/phase2-selection.json')
selection = json.loads(selection_path.read_text())
run_ids = {c['runId'] for c in listed['candidates']}
assert selection['selectedRunId'] in run_ids
print('selectedRunId=' + selection['selectedRunId'])
print('selectionSha256=' + hashlib.sha256(selection_path.read_bytes()).hexdigest())
PY
```

Expected: selected run and 64-character SHA-256. Add them to the ledger.

---

### Task 6: Freeze and Independently Verify the Selected Candidate

**Files:**
- Read: `avatar-web/fishing-ml/artifacts/phase2-selection.json`
- Create or verified-reuse: `avatar-web/fishing-ml/artifacts/<selected-run-id>/frozen/`
- Modify: `docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md`

**Interfaces:**
- Consumes: Verified immutable selection, current dataset/splits, and fixed revision.
- Produces: Independently verified `FreezeManifest`, checkpoint SHA-256, freeze-manifest SHA-256, and `freeze: PASS` evidence.

- [ ] **Step 1: Run freeze through the experiment state machine**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/fishing-ml && \
test "$(git rev-parse HEAD)" = '<BASE_REV_FROM_TASK_1>' && \
.venv/bin/python -m fishing_ml.experiments freeze \
  --selection artifacts/phase2-selection.json \
  --artifacts-root artifacts \
  --candidates config/phase2/candidates.yaml \
  --dataset-version data/phase2/dataset-version.json \
  --raw-root data/phase2/raw \
  --labels-root data/phase2/labels \
  --splits-root data/phase2/splits \
  --duplicate-reviews config/duplicate-reviews.json
```

Expected: exit 0 and `frozen: <path>`; an existing freeze is accepted only as `(existing verified)`. Nonzero exit is `freeze-failed`; keep selection and artifacts unchanged.

- [ ] **Step 2: Independently call `verify_freeze` and emit safe identities**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/fishing-ml && \
.venv/bin/python - <<'PY'
import hashlib, json
from pathlib import Path
from fishing_ml.artifacts import verify_freeze
selection = json.loads(Path('artifacts/phase2-selection.json').read_text())
frozen = Path('artifacts') / selection['selectedRunId'] / 'frozen'
manifest = verify_freeze(frozen)
assert manifest.run_id == selection['selectedRunId']
print('selectedRunId=' + manifest.run_id)
print('gitRevision=' + manifest.git_revision)
print('checkpointSha256=' + manifest.files['best-dev.pt'])
print('freezeManifestSha256=' + hashlib.sha256((frozen / 'freeze-manifest.json').read_bytes()).hexdigest())
PY
```

Expected: exit 0; run ID matches selection; Git revision matches `BASE_REV`; hashes are 64 lowercase hexadecimal characters. Failure is `freeze-verification-failed`.

- [ ] **Step 3: Verify frozen directory inventory**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/fishing-ml && \
.venv/bin/python - <<'PY'
import json
from pathlib import Path
selection = json.loads(Path('artifacts/phase2-selection.json').read_text())
frozen = Path('artifacts') / selection['selectedRunId'] / 'frozen'
expected = {
 'best-dev.pt','model-config.json','normalization.json','thresholds.json',
 'environment.json','dev-metrics.json','dataset-snapshot.json',
 'split-checksums.json','freeze-manifest.json'
}
actual = {p.name for p in frozen.iterdir() if p.is_file()}
assert actual == expected, (sorted(expected), sorted(actual))
print('freeze-inventory: exact')
PY
```

Expected: `freeze-inventory: exact`.

- [ ] **Step 4: Record freeze evidence**

Add the selected run ID, fixed revision, checkpoint hash, freeze-manifest hash, exact inventory status, and verifier exit status to the ledger. Do not include dataset snapshot content.

---

### Task 7: Prove Final Was Not Opened by This Execution

**Files:**
- Read: `/tmp/fishing-phase2-preflight-files.txt`
- Read generated artifact path inventory only.
- Modify: `docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md`

**Interfaces:**
- Consumes: Baseline inventory and completed freeze.
- Produces: Explicit evidence that no new Phase 2 final lock/evaluation/gate files were created.

- [ ] **Step 1: Compare final-artifact inventory against baseline**

Run:

```bash
find avatar-web/fishing-ml/artifacts -type f \
  \( -name 'final-evaluation.lock' -o -name 'final-evaluation.json' -o -name 'gate-final.json' \) \
  -print | LC_ALL=C sort > /tmp/fishing-phase2-post-final-files.txt
python3 - <<'PY'
from pathlib import Path
before = set(Path('/tmp/fishing-phase2-preflight-files.txt').read_text().splitlines())
after = set(Path('/tmp/fishing-phase2-post-final-files.txt').read_text().splitlines())
new_final = sorted(after - before)
assert not new_final, f'new final artifacts: {new_final}'
print('final-artifacts-created: 0')
PY
```

Expected: `final-artifacts-created: 0`. Any new file is a safety violation; record `privacy-or-safety-scan-failed` and do not claim freeze completion.

- [ ] **Step 2: Reconfirm gate policy is still placeholder**

Run:

```bash
cd /Users/devios/learning-reverse/avatar-web/fishing-ml && \
.venv/bin/python - <<'PY'
from pathlib import Path
import yaml
d = yaml.safe_load(Path('config/phase2/gate.yaml').read_text())
assert d['meta']['preAgreedPlaceholders'] is True
print('gate-policy-modified: no')
PY
```

Expected: `gate-policy-modified: no`.

- [ ] **Step 3: Record final boundary evidence**

Set `Final data opened: no` and record `final-artifacts-created: 0`. Do not invoke `confirm-final` even as a probe.

---

### Task 8: Safety, Privacy, GitNexus, and Completion Ledger

**Files:**
- Modify: `docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md`
- Do not modify: `AGENTS.md`, `CLAUDE.md`
- Do not commit generated files beneath `avatar-web/fishing-ml/artifacts/`

**Interfaces:**
- Consumes: Either Gate R `BLOCKED`/`FAIL`, a stopped candidate/selection/freeze failure, or successful verified freeze.
- Produces: Truthful terminal ledger state and pre-commit scope evidence.

- [ ] **Step 1: Scan executable Phase 2 paths for prohibited game action**

Run:

```bash
rg -n 'TX43|finishFishing\(' \
  avatar-web/fishing-ml/src \
  avatar-web/server/src/fishing
```

Expected: no executable Phase 2 action reference. Documentation/comments must be classified explicitly rather than treated as execution. Any executable reference is `privacy-or-safety-scan-failed`.

- [ ] **Step 2: Scan the results ledger for sensitive payload indicators**

Run:

```bash
rg -n -i 'password|authorization:|cookie:|set-cookie|bearer |base64|raw packet|decrypted packet|gameuser|accountid' \
  docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md
```

Expected: no match. If a heading or explanatory sentence causes a benign match, rewrite it without sensitive values and rerun until no match.

- [ ] **Step 3: Set truthful terminal status in the ledger**

Use exactly one outcome:

- Readiness missing prerequisite: `Status: BLOCKED`, `Training started: no`, downstream `NOT_STARTED`, with stable blocker category.
- Verification/integrity/artifact failure: `Status: FAIL`, record the failed stage and stable category, and do not claim downstream completion.
- Verified freeze: `Status: PASS — VERIFIED FREEZE`, `candidateRuns: 24/24 verified`, immutable selection identity/hash, verified freeze identity/hashes, `Final data opened: no`.

Replace `Pending` sections with observed aggregate evidence. Never convert BLOCKED into FAIL merely because Phase 2 data is absent.

- [ ] **Step 4: Run GitNexus change detection before any commit**

Run the MCP operation:

```text
gitnexus_detect_changes({scope: "all", repo: "learning-reverse"})
```

Expected: no production symbol changes caused by this execution. Generated artifacts may appear as untracked/ignored runtime files; the plan/spec/results documents are the only intended repository documents. If unexpected production symbols changed, stop and report them.

- [ ] **Step 5: Verify diff and preserve existing user changes**

Run:

```bash
git diff --check
git status --short
git diff -- AGENTS.md CLAUDE.md
```

Expected: `git diff --check` exits 0; `AGENTS.md` and `CLAUDE.md` remain exactly the pre-existing user modifications. Review status to ensure no generated model artifact is staged.

- [ ] **Step 6: Commit only approved documentation, if the user requests a commit**

Do not commit automatically. If the user explicitly requests it, stage only:

```bash
git add \
  docs/superpowers/specs/2026-09-04-fishing-phase-2-freeze-execution-design.md \
  docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution.md \
  docs/superpowers/plans/2026-09-04-fishing-phase-2-freeze-execution-results.md
git diff --cached --check
git commit -m "docs(fishing): record phase 2 freeze execution

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

Expected: commit includes only the three approved documents. Omit the results file if execution has not yet produced a truthful terminal status. Never stage `AGENTS.md`, `CLAUDE.md`, dataset files, checkpoints, manifests, selection, or frozen artifacts without separate approval.

## Execution Stop Conditions

Stop immediately and report rather than proceeding when any of these occurs:

1. Branch is not `main` or `HEAD` changes after baseline.
2. Runtime is absent/incompatible or dependencies are missing.
3. Focused Python tests, server tests, typecheck, build, or safety checks fail.
4. `data/phase2/` or any mandatory dataset input is absent: record `BLOCKED`, not `FAIL`.
5. Dataset version, raw/labels, splits, or review evidence is invalid.
6. Matrix does not contain exactly 24 unique canonical candidates.
7. Any candidate run or strict reuse validation fails.
8. Candidate manifest set differs from the canonical 24.
9. No candidate passes zero-wrong-accepted or selection conflicts.
10. Freeze or independent freeze verification fails.
11. A new final lock/evaluation/gate artifact appears.
12. Any unexpected production code change is detected.

## Expected First Execution Outcome

Given the repository state observed while writing this plan, `avatar-web/fishing-ml/data/phase2/` is absent. Therefore the expected first execution is:

```text
runtime/code verification: PASS
Gate R dataset readiness: BLOCKED (phase2-dataset-missing)
training started: no
candidate execution: NOT_STARTED
selection: NOT_STARTED
freeze: NOT_STARTED
final opened: no
```

That is a successful fail-closed readiness assessment, not Phase 2A completion. Preparing the separate Phase 2 dataset requires its own approved Spec → Plan cycle before this plan can be resumed at Task 3.
