# Fishing Phase 2 Final and Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore and validate the transferred Phase 2 artifacts, approve a dev-only gate policy, execute final exactly once, and—only after a passing final—produce immutable sanitized replay evidence from the frozen winner.

**Architecture:** Execute a fail-closed sequence of review gates: refresh code intelligence, restore through a validated staging area, add narrowly bounded relocation-safe provenance validation without mutating archived identities, obtain complete gate approval metadata, and obtain separate immediate authorization before final. Final terminal artifacts are immutable; replay is permitted only for final exit `0` and uses one localhost service bound to the trusted frozen checkpoint.

**Tech Stack:** Python 3.12, PyTorch 2.13, PyYAML, `unittest`, SHA-256, tar/gzip, GitNexus MCP/CLI, local HTTP on `127.0.0.1:8080`, Markdown evidence ledgers.

**Spec:** `docs/superpowers/specs/2026-09-05-fishing-phase-2-final-and-replay-design.md`

## Approved verification-sequencing amendment (2026-09-05)

User approved with `ok` after the Task 5 boundary question. This section supersedes conflicting pre-final verifier instructions below, including Task 7 preflight. Before the separately authorized one-shot invocation, verify dataset-version metadata, train/dev candidate provenance, exact frozen inventory and all payload hashes, and byte equality to trusted archives. Do not run the whole-dataset semantic validator or parse the frozen dataset snapshot before authorization. The historical 200 completed / 1,375 pairs / six LABEL_MISSING results remain transfer evidence until revalidated later.

After the authorized one-shot command opens final, run the deferred dataset validator and production frozen verifier once as read-only integrity checks; capture their actual exit statuses and aggregate results regardless of final pass/fail. Never rerun final, retune, or permit replay after a nonzero final result. These deferred checks remain required execution work in Task 8 and must not be presented as already completed. Policy approval and immediate final authorization remain separate gates.

## Global Constraints

- Final data stays sealed until the single authorized `confirm-final` invocation. Do not read `data/phase2/splits/final.txt`, final labels, final predictions, or final errors during restore, policy design, approval, or preflight.
- Trusted run ID is `p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01`.
- Trusted hashes are selection `4c15e952eef67f7291a306d2eedc8277ca86601286b301538e8c03335dc71f1f`, checkpoint `6168b65abaf8ade9008c9611413167f76533d1e80926b2be852df6e7e3a67789`, freeze manifest `ed1bbe4f9b24980c0277ace6da5d3b320b9f51a2b33f39c18c52e73beeed64ab`, and dataset version `406be8ed9fc097adcdaf6c3446addd4bf94c909d3a299cca8ce1304da35b0807`.
- Recorded training/freeze revision remains immutable: `8ca1f93990dcd06a0b7d6ee6251100e67a155365`. Approved compatible transfer revision is exactly `aebbbe5a01affddebf7e0c7e8244e6a1e1fd3288`; do not accept arbitrary ancestors or descendants.
- Keep `config/phase2/candidates.yaml` at `baseConfig.device: cpu`; never mix MPS/auto-device artifacts.
- Do not rewrite archived `runDir`, `thresholdsPath`, `gitRevision`, selection, freeze manifest, or any artifact identity/hash.
- `gate.requireZeroWrongAccepted: true`, `errorBudget.requireSingleModelIdentity: true`, and `errorBudget.maxOmittedRate: 0.0` are non-negotiable.
- Missing approval metadata or any failed/uncertain provenance check means BLOCKED. Never weaken a gate to make final or replay pass.
- Never delete or overwrite `final-evaluation.lock`, `final-evaluation.json`, `gate-final.json`, selection, freeze, replay report, or replay gate report.
- No TDD and no new test files unless the user explicitly authorizes tests. Production code is written first only after resolved GitNexus impact; existing tests run afterward. If existing coverage cannot verify the relocation boundary, stop and request test authorization before editing production code.
- No dependency or database-schema changes; no unrelated refactor.
- No live shadow, TX43, `finishFishing()`, gameplay mutation, external publication, push, merge, or generated dataset/checkpoint commit.
- Do not commit anything unless the user separately requests a commit. Every task's commit step is an explicit STOP/no-op unless that authorization has been received.
- Before editing a function/class/method, GitNexus impact must be resolved. `UNKNOWN` blocks edits; HIGH/CRITICAL requires warning the user and renewed approval.
- Before any authorized commit, `gitnexus_detect_changes(scope="all")` must complete without `partial` or `truncated`.

---

### Task 1: Establish the Controlled Execution Baseline

**Files:**
- Read: `CLAUDE.md`
- Read: `AGENTS.md`
- Read: `docs/superpowers/specs/2026-09-05-fishing-phase-2-final-and-replay-design.md`
- Read: `docs/superpowers/plans/2026-09-05-fishing-phase-2-final-and-replay.md`
- Read: `fishing-phase2-transfer-2026-09-04/{HANDOVER.md,RESTORE.md,SHA256SUMS}`
- Modify: none

**Interfaces:**
- Consumes: Approved Spec, this Plan, transfer bundle commit `aebbbe5a`.
- Produces: Recorded baseline branch, HEAD, status, tool versions, and a declaration that no final content was opened.

- [x] **Step 1: Re-read mandatory instructions and record the execution root**

Run from repository root:

```bash
pwd
git branch --show-current
git rev-parse HEAD
git status --short
git log --oneline -8
```

Expected: repository is `learning-reverse`; HEAD is `aebbbe5a01affddebf7e0c7e8244e6a1e1fd3288` unless the user has explicitly approved another exact revision; only the approved Spec/Plan or known user changes appear. Any unexpected production/config change blocks execution.

- [x] **Step 2: Confirm forbidden operations remain inactive**

Run filename/config scans only; do not open final split content:

```bash
rg -n '^\s*device:' avatar-web/fishing-ml/config/phase2/candidates.yaml
rg -n 'preAgreedPlaceholders|notTunedOnPhaseAFinal|requireZeroWrongAccepted' avatar-web/fishing-ml/config/phase2/gate.yaml
```

Expected: `device: cpu`, `preAgreedPlaceholders: true`, `notTunedOnPhaseAFinal: true`, and `requireZeroWrongAccepted: true` before policy approval.

- [x] **Step 3: Record baseline evidence in the results ledger draft**

Create `docs/superpowers/plans/2026-09-05-fishing-phase-2-final-and-replay-results.md` with: UTC timestamp, branch, exact HEAD, clean/expected status, commands and exit statuses, `finalDataOpened: false`, `liveShadowRun: false`, `tx43Sent: false`, and `finishFishingCalled: false`. Do not include credentials, account IDs, packet bytes, images, base64, or per-user telemetry.

- [x] **Step 4: Commit gate**

Do not commit. If the user separately requests a commit later, defer it until Task 10 after `detect_changes` and privacy review.

---

### Task 2: Refresh GitNexus and Resolve Production-Edit Impact

**Files:**
- Read: `.gitnexus/meta.json`
- Read: `avatar-web/fishing-ml/src/fishing_ml/experiments.py:600-850`
- Modify: none

**Interfaces:**
- Consumes: Exact execution HEAD from Task 1; symbols `_validate_manifest_current_provenance`, `_validate_selection_document`, `_validate_selection_current`, and `_resolve_selected_result`.
- Produces: Current GitNexus index plus resolved upstream impact report authorizing or blocking Task 4.

- [x] **Step 1: Inspect index metadata without changing it**

Read `.gitnexus/meta.json` and record indexed commit, embeddings status, and runner. Preserve embeddings if present.

- [x] **Step 2: Refresh the stale index**

Run the project-pinned command from repository root:

```bash
node .gitnexus/run.cjs analyze --index-only
```

If `.gitnexus/run.cjs` is absent, stop and report the missing pinned runner; do not install a dependency without user approval. Expected: exit `0` and index commit equals current HEAD.

- [x] **Step 3: Run upstream impact for every production symbol to edit**

Use GitNexus MCP `impact` with `direction="upstream"`, `includeTests=true`, and `maxDepth=3` for:

```text
_validate_manifest_current_provenance
_validate_selection_document
_validate_selection_current
_resolve_selected_result
```

Expected: each symbol resolves. Record direct callers, affected processes, and risk. `UNKNOWN` blocks Task 4. HIGH/CRITICAL requires reporting the risk and obtaining renewed explicit approval before continuing.

- [x] **Step 4: Cross-check resolved direct callers in source**

Read the returned file/line locations and verify the relocation/revision rule reaches both candidate-manifest and selection validation. Do not use text search as a substitute for impact; use it only to confirm the graph result.

- [x] **Step 5: Commit gate**

Do not commit; no source change has occurred.

---

### Task 3: Restore Transfer Archives Through a Validated Staging Area

**Files:**
- Read: `fishing-phase2-transfer-2026-09-04/SHA256SUMS`
- Read: `fishing-phase2-transfer-2026-09-04/fishing-phase2-dataset.tar.gz`
- Read: `fishing-phase2-transfer-2026-09-04/fishing-phase2-artifacts.tar.gz`
- Create operational ignored paths: `avatar-web/fishing-ml/data/phase2/`, `avatar-web/fishing-ml/artifacts/phase2-*`, `avatar-web/fishing-ml/artifacts/p2-*`
- Modify tracked files: none

**Interfaces:**
- Consumes: SHA-verified archives and absent operational paths.
- Produces: Byte-preserved Phase 2 dataset/artifacts with AppleDouble metadata excluded, never merged or overwritten.

- [x] **Step 1: Verify all transfer checksums immediately before extraction**

Run:

```bash
cd fishing-phase2-transfer-2026-09-04
shasum -a 256 -c SHA256SUMS
```

Expected: all four entries report `OK`, exit `0`. Any mismatch blocks restore; do not download or regenerate replacements.

- [x] **Step 2: Assert operational targets are absent**

Use a read-only Python script with `pathlib` to check `avatar-web/fishing-ml/data/phase2`, `artifacts/phase2-selection.json`, `artifacts/phase2-experiments`, and every `artifacts/p2-*` target represented in the archive. Expected: none exists. If any exists, stop and ask the user; do not merge, delete, or overwrite.

- [x] **Step 3: Validate every tar member before extraction**

Use a Python `tarfile` script that rejects absolute member names, `..` path components, symlinks, hard links, devices, FIFOs, and non-file/non-directory members. Permit content only under `data/phase2/`, `artifacts/phase2-*`, or `artifacts/p2-*`; permit exclusion—not extraction—only for a path component whose basename starts `._`. Print member counts, excluded AppleDouble count, and zero rejected non-metadata members.

Expected: the known AppleDouble entries are excluded; every substantive member satisfies the allowed prefixes. Any other violation blocks restore.

- [x] **Step 4: Extract into new staging directories with no-clobber semantics**

Create unique staging directories under `/private/tmp` using `tempfile.mkdtemp`. Extract validated regular files/directories manually through Python `tarfile`, skip only AppleDouble entries, open destinations with exclusive creation (`mode="xb"`), and verify every resolved destination stays beneath staging. Do not call `extractall`.

Expected: staging contains `data/phase2/...` and `artifacts/...`; no `._*` entries and no overwrite.

- [x] **Step 5: Verify staged identities before placement**

Compute SHA-256 for staged `dataset-version.json`, `phase2-selection.json`, selected `freeze-manifest.json`, and selected `best-dev.pt`. Expected exact trusted hashes from Global Constraints. Count exactly 24 candidate manifests and exactly 9 files in selected frozen inventory as required by `verify_freeze` (8 payload files plus `freeze-manifest.json`).

- [x] **Step 6: Place staged roots atomically into absent operational locations**

From a Python script, reassert every target is absent immediately before `Path.rename`. Move `staging/data/phase2` to `avatar-web/fishing-ml/data/phase2`; create `avatar-web/fishing-ml/artifacts` only if absent, then move each staged artifacts child by exclusive rename. If artifacts root exists, require every individual Phase 2 child target to be absent. Never replace a target.

- [x] **Step 7: Remove only the now-empty staging directory**

Confirm staging contains no substantive file after successful moves, then remove that temporary staging directory. Do not remove operational or immutable artifacts.

- [x] **Step 8: Record restore evidence**

Append archive hashes, counts, AppleDouble exclusions, placed paths, identity hashes and exit statuses to the results ledger. Do not include raw data contents.

- [x] **Step 9: Commit gate**

Do not commit ignored dataset/model artifacts.

---

### Task 4: Implement Narrow Relocation-Safe Provenance Validation

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/experiments.py:600-850`
- Test existing: `avatar-web/fishing-ml/tests/test_phase2_experiments.py`
- Create tests: none unless user separately authorizes them

**Interfaces:**
- Consumes: Resolved non-blocking impact report from Task 2; immutable manifest fields `runId`, `runDir`, `thresholdsPath`, `provenance.gitRevision`; current `artifacts_root`; current Git revision.
- Produces: Internal helpers that validate relocation by fixed `/artifacts/<runId>` suffix and revision by exact compatibility pair, used consistently by manifest and selection validation.

- [x] **Step 1: Confirm existing tests/fixtures can exercise the boundary**

Read existing `test_phase2_experiments.py` cases for manifest current provenance, selection provenance, run directory mismatch, Git revision mismatch, symlink rejection, and immutable selection. If existing fixtures cannot run a relocated valid case and reject malformed path/unapproved revision, stop and request explicit authorization to add tests. Do not edit production code while that verification gap remains.

- [x] **Step 2: Define the exact compatibility constants and helper contracts**

In `experiments.py`, add private constants for the one approved pair:

```python
_TRANSFER_COMPATIBLE_REVISIONS = {
    "aebbbe5a01affddebf7e0c7e8244e6a1e1fd3288": frozenset({
        "8ca1f93990dcd06a0b7d6ee6251100e67a155365",
    }),
}
```

Add private helper contracts:

```python
def _revision_matches_recorded(current: str, recorded: object) -> bool:
    """Accept exact equality or one explicitly approved current→recorded pair."""


def _validate_relocated_run_paths(
    result: ExperimentResult,
    *,
    artifacts_root: Path,
    run_id: str,
) -> tuple[Path, Path]:
    """Validate archived and operational paths share the exact artifacts/run suffix."""
```

The path helper must require absolute archived paths, archived `thresholdsPath == archived runDir / "thresholds.json"`, archived run directory basename equals `run_id`, archived parent basename equals `artifacts`, operational root and files are non-symlink regular paths, and current resolved paths equal `<artifacts_root>/<run_id>` and its `thresholds.json`. It must not infer trust from arbitrary common suffixes.

- [x] **Step 3: Apply revision compatibility consistently**

Replace direct current-HEAD equality in candidate manifest and selection-document validation with `_revision_matches_recorded`. Keep the recorded revision in all returned/published evidence; never rewrite it to current HEAD. Any revision outside exact equality or the approved pair raises `ValueError`.

- [x] **Step 4: Apply relocation validation to candidate resolution**

Replace only the old archived absolute-prefix equality checks with `_validate_relocated_run_paths`. Retain checks for canonical current manifest location, exact enumerated run ID/config, dataset ID/hash, train/dev split hash, output inventory, thresholds, metrics, environment checkpoint hash, symlink rejection, and frozen verification.

- [x] **Step 5: Run existing focused tests after production code**

Run from `avatar-web/fishing-ml`:

```bash
.venv/bin/python -m unittest \
  tests.test_phase2_training \
  tests.test_phase2_experiments \
  tests.test_phase2_gate \
  tests.test_inference_size_contract -v
```

Expected: all existing tests pass. If `.venv` is absent, Task 5 creates it before this verification; do not install until that task's environment step. If an existing test encodes strict equality, revise production design—not the test—unless the user explicitly authorizes a test change.

- [x] **Step 6: Run read-only negative/positive fixture checks**

Using existing fixture builders only, verify: exact same-root revision passes; trusted old-root→current-root plus approved revision pair passes; wrong run ID fails; parent not named `artifacts` fails; relative archived path fails; inconsistent thresholds path fails; unapproved revision fails; symlink and checksum mismatch fail. The check must operate on temporary fixtures, never the restored immutable artifacts.

- [x] **Step 7: Record source-change evidence**

Append changed symbol names, GitNexus risk/callers, test commands/statuses, and compatibility pair to the ledger. State explicitly that no archived manifest or hash changed.

- [x] **Step 8: Commit gate**

Do not commit without separate user authorization.

---

### Task 5: Verify Environment, Dataset, Candidate Set, Selection, and Freeze

**Files:**
- Read: `avatar-web/fishing-ml/pyproject.toml`
- Read: restored `avatar-web/fishing-ml/data/phase2/dataset-version.json`
- Read: restored aggregate candidate manifests/dev metrics/thresholds/environment only
- Read: restored selection and selected frozen metadata
- Modify: none

**Interfaces:**
- Consumes: Restored artifacts and relocation-safe validator.
- Produces: Complete pre-final verification report proving exact identity and absence of terminal final files.

- [x] **Step 1: Create/verify the approved Python environment**

If `.venv` exists, verify it without reinstalling. If absent, use Python 3.12 and the project itself only:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e .
```

Adding any dependency not already declared in `pyproject.toml` requires separate user approval. Record Python/package versions and compare with frozen environment.

- [x] **Step 2: Run the existing focused suite**

Run the exact 4-module `unittest` command from Task 4. Expected: 19 or more existing tests pass, exit `0`; report the actual count, never assume 19 if the suite changed.

- [x] **Step 3: Verify dataset without opening final content manually**

Run production commands from `avatar-web/fishing-ml`:

```bash
PY="$PWD/.venv/bin/python"
$PY -m fishing_ml.dataset_version namespace --base . --name raw
$PY -m fishing_ml.dataset_version namespace --base . --name labels
$PY -m fishing_ml.dataset_version namespace --base . --name splits
$PY -m fishing_ml.dataset_version verify data/phase2/dataset-version.json
shasum -a 256 data/phase2/dataset-version.json
$PY -m fishing_ml.validate --raw-root data/phase2/raw --labels-root data/phase2/labels --require-batches 200 --require-pairs 1000
```

Expected: namespace paths stay under `data/phase2`; version verify exit `0`; hash is trusted; validator reports 200 completed and 1,375 pairs plus exactly the six known `LABEL_MISSING` issues. Its documented nonzero issue status is recorded, not mislabeled as command success. Do not run a validator that reads final membership/content before confirming from source that it respects the design boundary.

- [x] **Step 4: Enumerate and strictly validate 24 candidates without training**

Run `experiments list`, then invoke the strict read/reuse validation code path only after source inspection proves it cannot call `run_training`, calibrate, publish, or replace files. Use absolute roots. Expected: exactly 24 canonical CPU candidates, unique run IDs/matrix keys, 24/24 complete outputs, 24/24 zero wrong accepted. If no guaranteed read-only strict command exists, call the validated internal resolution routines from a read-only Python process; never use `experiments run`.

- [x] **Step 5: Verify immutable selection and freeze**

Run:

```bash
ROOT="$PWD"
SELECTED="p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01"
shasum -a 256 "$ROOT/artifacts/phase2-selection.json"
shasum -a 256 "$ROOT/artifacts/$SELECTED/frozen/freeze-manifest.json"
shasum -a 256 "$ROOT/artifacts/$SELECTED/frozen/best-dev.pt"
$PY -m fishing_ml.artifacts verify --frozen-dir "$ROOT/artifacts/$SELECTED/frozen"
```

Expected: exact trusted hashes, selected run ID, recorded revision `8ca1f939...`, and exact frozen inventory. Any mismatch blocks all later tasks.

- [x] **Step 6: Confirm terminal final and replay outputs are absent by filename only**

Use `Path.rglob` names without opening matched files. Require absence of `final-evaluation.lock`, `final-evaluation.json`, `gate-final.json`, `phase2-replay.json`, and `phase2-replay-gate.json`. Any existing terminal file blocks execution; never remove it.

- [x] **Step 7: Record verification evidence**

Append exact commands, statuses, candidate count, winner aggregate dev metrics, identities/hashes, environment comparison, and blockers to the ledger. Preserve `finalDataOpened: false`.

- [x] **Step 8: Commit gate**

Do not commit.

---

### Task 6: Obtain Gate-Policy Approval and Publish Only the Approved Policy

**Files:**
- Modify after explicit approval: `avatar-web/fishing-ml/config/phase2/gate.yaml:11-48`
- Read/Test existing: `avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py`
- Test existing: `avatar-web/fishing-ml/tests/test_phase2_gate.py`

**Interfaces:**
- Consumes: Verified dev evidence and user-provided `approvedAt`, `approvedBy`, `evidence`, plus explicit approval for every threshold.
- Produces: Strictly parsed official policy with `preAgreedPlaceholders: false`; or durable BLOCKED status with unchanged policy.

- [x] **Step 1: STOP and request complete approval metadata and thresholds**

Present these proposed official values verbatim:

```text
coverage.minAcceptedRate = 0.60
coverage.minBatchExactMatch = 0.90
coverage.minTop1Accuracy = 0.98
latency.budgetMs = 50
latency.p95Ms = 100
latency.maxMs = 250  (strict replay condition: actual < 250)
errorBudget.maxErroredBatchRate = 0.01
errorBudget.maxOmittedRate = 0.0
errorBudget.requireSingleModelIdentity = true
gate.requireZeroWrongAccepted = true
meta.notTunedOnPhaseAFinal = true
```

Require all three real metadata values: `approvedAt` in UTC ISO-8601, `approvedBy`, and a durable `evidence` reference. Ask the user to approve each threshold set and metadata explicitly. This step authorizes only the policy edit, not final execution.

- [x] **Step 2: Validate approval completeness before editing**

Require UTC timestamp parse success, non-empty bounded approver/evidence strings, every threshold explicitly accepted, and confirmation that no final evidence informed the decision. If any field is missing or ambiguous, append BLOCKED to the ledger, leave `preAgreedPlaceholders: true`, and stop.

- [x] **Step 3: Update only the approved gate fields**

Edit `gate.yaml` to set the exact approved numeric/boolean values and:

```yaml
meta:
  preAgreedPlaceholders: false
  revisitAt: "2A"
  notTunedOnPhaseAFinal: true
  approvedAt: "<exact approved UTC value>"
  approvedBy: "<exact approved identity>"
  evidence: "<exact approved durable reference>"
```

Do not alter candidates, model thresholds, selection, manifests, or frozen files.

- [x] **Step 4: Parse policy through production code**

Run a Python one-liner importing `load_gate_policy` against the absolute gate path and print only its normalized fields. Expected: exact equality with the user approval, placeholders false, final-not-tuned true, zero-wrong true, single identity true, omitted rate zero.

- [x] **Step 5: Run existing gate tests after the config edit**

Run:

```bash
.venv/bin/python -m unittest tests.test_phase2_gate -v
```

Expected: all existing tests pass, exit `0`.

- [x] **Step 6: Record approval provenance without secrets**

Append the approved values, approver identity, UTC timestamp, durable evidence reference, gate-policy SHA-256, parser status, and `notTunedOnPhaseAFinal: true` to the ledger.

- [x] **Step 7: Commit gate**

Do not commit without separate user authorization.

---

### Task 7: Run Final Preflight and Obtain Immediate One-Shot Authorization

**Files:**
- Read: approved `avatar-web/fishing-ml/config/phase2/gate.yaml`
- Read: trusted selection/frozen metadata and hashes
- Read filename existence only: selected run terminal artifacts
- Modify: none

**Interfaces:**
- Consumes: Passing Tasks 1–6 and approved gate policy.
- Produces: A single timestamped preflight packet and explicit user authorization for exactly one final command.

- [x] **Step 1: Reassert exact revision and controlled diff**

Run `git rev-parse HEAD`, `git status --short`, and a scoped diff review. Expected: exact approved transfer revision plus only reviewed relocation-safe source, gate config, Spec/Plan/ledger changes. Any other production/config change blocks final.

- [x] **Step 2: Re-run all immutable identity checks immediately before final**

Recompute dataset-version, selection, freeze-manifest, and checkpoint SHA-256; run exact freeze inventory verification; resolve selected candidate through relocation-safe validation; assert `device: cpu`. Every value must match Global Constraints.

- [x] **Step 3: Re-run strict gate parser checks**

Require `preAgreedPlaceholders: false`, complete approval provenance, `notTunedOnPhaseAFinal: true`, official thresholds, single model identity, zero omission, and zero wrong accepted.

- [x] **Step 4: Prove no previous final terminal artifact exists**

Check filenames only under the selected run for `final-evaluation.lock`, `final-evaluation.json`, and `gate-final.json`. Expected: none. If any exists, stop permanently for this plan and preserve it.

- [x] **Step 5: Materialize the exact absolute-path command without running it**

Display:

```bash
ROOT="/Users/hieunt/learning-reverse/avatar-web/fishing-ml"
PY="$ROOT/.venv/bin/python"
SELECTED="p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01"

"$PY" -m fishing_ml.experiments confirm-final \
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

Validate `--confirm-final-once` byte-for-byte equals the selected run ID.

- [x] **Step 6: STOP and request immediate irreversible-action approval**

Report all preflight commands/statuses/hashes and ask the user to authorize exactly the displayed one-shot command. Do not infer authorization from Spec, Plan, or gate-policy approval. Do not proceed without a new explicit yes.

- [x] **Step 7: Commit gate**

Do not commit before final.

---

### Task 8: Execute and Record One-Shot Final Exactly Once

**Files:**
- Create immutable by production command: selected run `final-evaluation.lock`, `final-evaluation.json`, `gate-final.json`
- Modify: `docs/superpowers/plans/2026-09-05-fishing-phase-2-final-and-replay-results.md`

**Interfaces:**
- Consumes: Exact command and immediate authorization from Task 7.
- Produces: One immutable final result with truthful exit classification; replay authorization only for exit `0`.

- [x] **Step 1: Record start time and invoke exactly once**

Record UTC start time, then run the exact Task 7 command once through a wrapper that captures its exit code without retrying. Do not use shell constructs that rerun on failure.

- [x] **Step 2: Record end time, raw exit status, and terminal filenames**

Interpret exactly:

```text
0 = pass
2 = invalid input/provenance/publication conflict
3 = mandatory gate fail
4 = blocked
other/signal = uncertain and blocked pending user adjudication
```

List created terminal filenames and hashes without deleting, moving, or overwriting them.

- [x] **Step 3: Append immutable aggregate final outcome to the ledger**

Record command, timestamps, exit status, selected run/hash identities, gate status, aggregate metrics/check names and terminal artifact hashes. Do not copy per-example predictions/errors or use the result to alter policy/model/selection.

- [x] **Step 4: Apply the post-final branch**

- Exit `0`: mark final PASS and continue to Task 9.
- Exit `3`: mark durable FAIL and stop; replay is not authorized independently by this Plan.
- Exit `2` or `4`: mark invalid/BLOCKED and stop; do not rerun.
- Other/signal: mark UNCERTAIN/BLOCKED, preserve every file, and stop for user adjudication.

- [x] **Step 5: Commit gate**

Do not commit. Never rerun final to prepare a commit.

---

### Task 9: Run Frozen Local Replay and Immutable Adjudication After Final Pass

**Files:**
- Read: selected frozen directory
- Create no-clobber: `avatar-web/fishing-ml/artifacts/phase2-replay.json`
- Create no-clobber: `avatar-web/fishing-ml/artifacts/phase2-replay-gate.json`
- Modify: results ledger

**Interfaces:**
- Consumes: Final exit `0`, trusted checkpoint checksum, local endpoint `http://127.0.0.1:8080/infer`, complete labeled Phase 2 batches.
- Produces: Aggregate replay report and immutable gate report from one model identity; stopped local service.

- [ ] **Step 1: Reverify replay prerequisites and output absence**

Require final exit `0`; rerun frozen verification and checkpoint hash; confirm replay output paths do not exist; confirm port 8080 is free. Any failure blocks replay without deleting anything.

- [ ] **Step 2: Start the service locally from the frozen winner**

Run in a controlled background process with logs redirected to a temporary local file:

```bash
"$PY" -m fishing_ml.inference_service \
  --frozen-dir "$ROOT/artifacts/$SELECTED/frozen" \
  --host 127.0.0.1 \
  --port 8080 \
  --max-body-bytes 1283950 \
  --timeout-ms 5000
```

Capture PID. Never bind to a non-loopback host.

- [ ] **Step 3: Verify readiness and identity before replay**

Use the service's existing health/identity endpoint as defined in source. Require selected run ID, checkpoint checksum `6168...`, one model identity, and loopback endpoint. If the service exposes no identity-bearing readiness response, perform one bounded contract request using non-sensitive local fixture data and confirm response model identity/checksum. Identity mismatch stops replay and proceeds directly to service shutdown.

- [ ] **Step 4: Run one replay with no-clobber output capture**

Open the output using shell noclobber or an exclusive Python file descriptor, then run:

```bash
"$PY" -m fishing_ml.replay \
  --batches-root "$ROOT/data/phase2/raw" \
  --labels-root "$ROOT/data/phase2/labels" \
  --endpoint http://127.0.0.1:8080/infer \
  --timeout-ms 5000 \
  --model-checksum 6168b65abaf8ade9008c9611413167f76533d1e80926b2be852df6e7e3a67789
```

Write stdout exclusively to `$ROOT/artifacts/phase2-replay.json`. Record exit status; do not retry or overwrite on any outcome.

- [ ] **Step 5: Verify replay evidence consistency before adjudication**

Using production parser/adjudicator and a separate read-only summary script, require:

```text
modelIdentity has exactly one run ID and one checksum
checkpoint checksum equals freeze manifest
unknownBatchCount = 0
unknownQueryCount = 0
labeledBatchCount = batchCount
labeledQueryCount = queryCount
omittedCount = 0
requestCount = number of clientLatencyMs samples
successfulBatchCount + erroredBatchCount = batchCount
acceptedCount + abstainedCount + omittedCount = queryCount
wrongAcceptedCount = 0
```

Also verify accepted rate `>= 0.60`, labeled top-1 `>= 0.98`, labeled batch exact `>= 0.90`, p95 `<= 100 ms`, max `< 250 ms`, errored batch rate `<= 0.01`, and every request/error count reconciliation enforced by `phase2_gate.py`. Any schema/completeness mismatch is BLOCKED, not silently coerced.

- [ ] **Step 6: Adjudicate once to a no-clobber gate report**

Run only if the output target is absent:

```bash
"$PY" -m fishing_ml.experiments adjudicate-replay \
  --gate-config "$ROOT/config/phase2/gate.yaml" \
  --replay-report "$ROOT/artifacts/phase2-replay.json" \
  --frozen-dir "$ROOT/artifacts/$SELECTED/frozen" \
  --output "$ROOT/artifacts/phase2-replay-gate.json" \
  --stdout
```

Capture status exactly; never overwrite or rerun to obtain a different result.

- [ ] **Step 7: Stop and verify the local service**

Send the normal termination signal to the captured PID, wait with a bounded timeout, escalate only to terminate that exact PID if needed, and confirm PID exited and `127.0.0.1:8080` no longer accepts connections. Preserve service logs until privacy scan completes.

- [ ] **Step 8: Record sanitized aggregate replay evidence**

Append commands/statuses, report/gate hashes, model/checkpoint identities, aggregate quality/coverage/latency/error counts, consistency checks and gate result. Do not include request payloads, images/base64, packet bytes, credentials, account IDs, or per-user telemetry.

- [ ] **Step 9: Commit gate**

Do not commit ignored replay artifacts.

---

### Task 10: Privacy Review, GitNexus Change Analysis, and Final Handover

**Files:**
- Modify: `docs/superpowers/plans/2026-09-05-fishing-phase-2-final-and-replay-results.md`
- Create: `docs/handoffs/2026-09-05-fishing-phase-2-final-and-replay-handover.md`
- Read: all tracked changes and aggregate generated reports

**Interfaces:**
- Consumes: Actual terminal state from Tasks 1–9, including early BLOCKED/FAIL branches.
- Produces: Truthful sanitized results ledger, handover, reviewed graph change report, and optional commit only after separate authorization.

- [x] **Step 1: Complete the results ledger for the actual branch taken**

Record every stage as PASS/FAIL/BLOCKED/NOT RUN with exact commands, exits, identities/hashes, files created/modified, and remaining uncertainty. If final did not exit `0`, mark replay NOT RUN and state why. Never claim completion for a skipped stage.

- [x] **Step 2: Run safety/privacy scans**

Scan tracked ledger/handover and aggregate replay/gate reports for credential/token/cookie/password keys, account/user IDs, packet/decrypted/raw byte fields, image/base64/data-URI payloads, and per-example prediction/error arrays. Manually review every match. Remove sensitive content only from mutable documentation drafts; never modify immutable operational reports. If an immutable report contains forbidden content, quarantine by permissions/location without deletion, mark BLOCKED, and ask the user before any external sharing.

- [x] **Step 3: Write the final handover**

Include repository revision/status; approved gate metadata and SHA; trusted identities; restore provenance; relocation compatibility pair and code changes; final invocation count/status/artifact hashes; replay status/report hashes; safety/privacy scan result; `liveShadowStatus: not-run`; and exact next actions. If any stage failed, preserve that failure prominently.

- [x] **Step 4: Run GitNexus change analysis before any possible commit**

Use MCP:

```text
detect_changes(scope="all", repo="learning-reverse")
```

Expected: `partial=false`, `truncated=false`. Review every changed symbol and affected process, especially candidate selection/final confirmation. Re-run after refreshing the index if partial/truncated. Record risk and processes in the ledger.

- [x] **Step 5: Review Git diff and ignored artifact boundaries**

Run `git diff --check`, `git status --short`, and inspect the complete tracked diff. Verify no dataset, checkpoint, final/replay generated artifact, credential, or unrelated change is staged. Do not reset user-owned changes.

- [x] **Step 6: Report completion truthfully and stop live scope**

Report each stage with `✅`, `❌`, `⛔`, or `—`; include command, exit status, identity/hash, blocker, and file path. Explicitly state that live shadow, TX43, `finishFishing()`, and gameplay mutation were not run.

- [x] **Step 7: Optional commit only after separate explicit authorization**

If—and only if—the user now requests a commit, stage only reviewed tracked source/config/docs files and commit with a message ending in:

```text
Co-Authored-By: Claude Code <noreply@anthropic.com>
```

Do not commit generated dataset, checkpoints, selection/freeze, final, replay, service logs, or quarantined evidence. Do not push, merge, or publish without separate explicit authorization.
