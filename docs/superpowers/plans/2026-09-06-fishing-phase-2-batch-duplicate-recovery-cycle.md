# Fishing Phase 2 Batch-Duplicate Recovery Cycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close `p2cr-20260905-01` truthfully as `NO_DATASET`, precommit a role-aware batch-duplicate policy, capture a clean 90-batch successor corpus, and continue the existing Phase 2 train/freeze/final/replay/local-shadow gates under `p2cr2-20260906-01`.

**Architecture:** Extract duplicate detection into a dependency-leaf Python module that compares complete RX79 batches using deterministic same-role maximum-cardinality matching, then make `phase2_cycle.py` consume that module for strict schema-v2 policy, exclusion, inventory, acquisition, ruling, and allocation contracts. Harden the existing active probe so it attaches waiters before sends, never invokes inference, and seals the only valid successor inventory directly after a successful `TX45 → TX41 → RX79 save → TX44` crawl. Reuse the already-implemented experiment, freeze, final, replay, and local-shadow machinery through exact successor identities plus a two-root resolver that reads reusable parent batches from `data/phase2/raw|labels` and acquired batches from the successor cycle without copying or link-based unions.

**Tech Stack:** Python 3.11/3.12, dataclasses, Pillow, existing `fishing_ml` schema/CLI modules, Node.js 22+, TypeScript 5.7, existing Avatar game client, GitNexus 1.6.x, shell verification with `shasum`, `rg`, and existing unittest/Node suites.

**Spec:** `docs/superpowers/specs/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-design.md`

## Global Constraints

- This Plan is documentation only until the user explicitly approves it. Do not modify production code, publish successor policy, capture data, label data, train, freeze, access final, replay, run local shadow, stage, commit, push, merge, or publish externally before the corresponding gate.
- Execute inline in the current task. Do not dispatch subagents unless the user later requests delegation.
- Do not use TDD. Do not create or modify any test file unless the user gives separate explicit test-writing approval. Verification uses existing suites and deterministic inline checks after production code exists.
- Preserve every current tracked and untracked workspace change. Never reset, clean, checkout over, or delete work from `p2cr-20260905-01`.
- Before any production edit, run `node .gitnexus/run.cjs analyze --index-only` from the repository root so the index includes the current untracked implementation files. Run upstream impact for every existing function/class/method to be edited. Warn and stop for explicit approval on `HIGH` or `CRITICAL`; treat `UNKNOWN` as unresolved and confirm it with source search before editing.
- Exact successor identities are immutable: cycle/experiment `p2cr2-20260906-01`, dataset `phase2-coverage-recovery-v2-20260906-01`, parent dataset `phase2-20260904-01`, allocation seed `20260906`, training seed `20260827`.
- Exact successor roots are immutable: data `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01`; artifacts `avatar-web/fishing-ml/artifacts/cycles/p2cr2-20260906-01`.
- Parent and acquired data remain in separate immutable roots. Do not copy parent batches into the successor root and do not create symlink/hardlink union directories; downstream loaders must resolve each explicit membership ID through the unique two-root contract.
- Exact acquired allocation is `45 train / 15 dev / 30 sealed final`; exact successor totals are `185 train / 45 dev / 30 sealed final` from 260 source batches.
- The old cycle is terminal `NO_DATASET`. Its 90 real raw batches are diagnostic/exclusion evidence only and must never be labeled, trained, calibrated, evaluated, replayed, grandfathered, renamed into, or copied into the successor corpus.
- Immutable old-cycle evidence is: policy SHA-256 `cc63156b6e52262622dc16852e89e114c5169c760bf277f853beb582a6b67e8a`; quarantine SHA-256 `1e4e69a7811ab51264c119f91be4113fe4b01ba5cb7a8def37c4dcfb79186740`; inventory SHA-256 `c133238289a9d36dddc0861d4ac2c0347814b9d231fcb2c75560d33645647c53`; each file mode `0600`; inventory record count `90`.
- `diagnosticBatchCommitment` is SHA-256 of the exact UTF-8 bytes produced by existing `commit_ids()`: validate 90 unique safe IDs, sort them byte-ascending, join with `\n`, and append exactly one trailing `\n`. Do not add a BOM, blank prefix, or extra trailing newline.
- Policy `approvalEvidence` is the exact immutable string `2026-09-06 approved Fishing Phase 2 Batch-Duplicate Recovery Cycle design`.
- Publish successor policy and quarantine before the first successor capture timestamp. Any data captured earlier is ineligible and cannot be grandfathered.
- Successor acquisition allows only fishing commands `TX45`, `TX41`, and `TX44`. `TX43`, answer submission, `finishFishing()`, `maybeShadowMatch`, inference requests, prediction telemetry, and model-assisted labeling are forbidden.
- The capture order is exact: attach RX45 waiter, send `TX45`, require successful RX45, attach RX79 waiter, send `TX41`, decode/save one valid RX79 batch, send `TX44`, then delay at least 2000 ms.
- The capture probe must refuse a non-successor cycle ID, an existing inventory, a non-empty successor raw root, target other than `90`, map/area other than `14/1`, delay below `2000`, or a listening Avatar backend on local port `8787`.
- Only `reason = target-reached` with exactly 90 saved valid batches may publish inventory. Short/aborted/error runs preserve partial raw data, leave inventory absent, terminalize this successor cycle as `NO_DATASET`, and are not silently retried.
- Policy, quarantine, inventory, rulings, acquisition, allocation, split, dataset-version, prefinal, experiment, freeze, final, replay, and local-shadow publications are no-replace and fail closed on identity/digest mismatch.
- Detector thresholds are immutable after policy activation: same-role image edge is exact SHA-256 or dHash Hamming distance `≤4`; batch edge requires reference matches `≥ceil(5 × max(ref counts) / 6)` and query matches `≥ceil(4 × max(query counts) / 5)`; cross-role matching is forbidden.
- A group touching parent or diagnostic evidence auto-rejects all acquired members and cannot be overridden. An acquired-only group with more than one batch requires an exact `reject-acquired` or `allow-batch-group` ruling bound to cycle, detector digest, group ID, approver, UTC timestamp, and approval evidence.
- Manual labeling starts only after inventory sealing and follows inventory order `(capturedAt, batchId)`. A selected batch must have exactly one complete human mapping for every query and must not be informed by predictions or historical-final evidence.
- Preserve existing candidate matrix, training hyperparameters, calibration rules, gate thresholds, durable final lock ordering, replay semantics, and six-case local-shadow semantics. Identity/path propagation must not weaken any prior safety guard.
- Historical-final labels, predictions, per-example reports, error identities, and final membership remain forbidden before the durable successor final lock. Pre-final code may stat/hash sealed-final bytes but may not parse or emit final IDs.
- Reverify these immutable historical hashes before every operational phase: parent dataset version `406be8ed9fc097adcdaf6c3446addd4bf94c909d3a299cca8ce1304da35b0807`; parent train `c84889444aac26d49a17d16f0806c7992f9dc60ae4f18dc979972442c741269a`; parent dev `e39f70573dc4a94f08947df96f42364eb0b5d69b6d0677b3ccca80391cb42d3c`; parent final `e92e14e94b3883ecc62958b5396cd9b6d1b6edd9778a590203564083508cb045`; duplicate reviews `f07982192191fd48daddff77ce136bfb21e956276991b54ec8d712837e119255`; historical gate `a6595257ef073338cdeafadca3371ab568697e8e045fe3d696542b8584e07a83`; historical matrix `6ade4b03b2c466c1c03b63092956ae1ac6e4420d3bb96ad210468eb86550982e`; historical selection `4c15e952eef67f7291a306d2eedc8277ca86601286b301538e8c03335dc71f1f`; historical freeze manifest `ed1bbe4f9b24980c0277ace6da5d3b320b9f51a2b33f39c18c52e73beeed64ab`; historical final lock `75b6659d7d961870bcdbe3652ae532bfd2e162d6fde61af7bcb5b16b091490e6`; historical final report `3da0160a93ea6bcfd4747f696c1b5bbd1d3eef2ce599c4b405934d4f0daddc0b`; historical final gate `018c8c164f4c97b567ebba636f5004730d8dda2ec4fc9755532a6b918ce8d01d`; historical final/replay results `fce0d917a7b074e38b6fa863a6347cc2d04cc55a00285c47476bb8c527866454`.
- `.env` contains secrets. Never print it, copy it into evidence, or stage it. Never stage `.agents/`, generated cycle data, candidate artifacts, checkpoints, predictions, operational reports, or `avatar-web/fishing-ml/artifacts/phase2-selection.json` unless the user separately approves an exact sanitized publication set.
- Avatar backend port `8787` is currently stopped and must remain stopped during active capture. The Vite UI on port `5173` may remain running because it is not acquisition evidence.
- Every commit step below is a gate, not authorization. Before any `git add` or `git commit`, display exact paths and diff summary and wait for explicit user approval.
- Standing approval update (`2026-09-06`): the user authorizes each task-local `git add` and `git commit` after that task's required verification succeeds, limited to the exact paths and commit message specified by the task. This does not authorize push, merge, external publication, operational data publication, training, freeze, final, replay, or local-shadow execution, and it does not replace any HIGH/CRITICAL GitNexus edit approval.

## File Responsibility Map

| File | Responsibility |
| --- | --- |
| `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle.md` | Mark only truthful old-cycle terminal steps complete; leave unexecuted commit/downstream gates unchecked. |
| `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md` | Replace active/pending language with sanitized terminal `NO_DATASET` evidence. |
| `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-handover.md` | Recreate sanitized terminal handover for `p2cr-20260905-01`. |
| `avatar-web/fishing-ml/src/fishing_ml/duplicate_detector.py` | Dependency-leaf detector descriptor, image evidence, deterministic per-role maximum matching, batch edges, transitive groups, and detector digests. |
| `avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py` | Successor constants; strict v2 policy/quarantine/inventory/ruling/acquisition contracts; diagnostic exclusion; exact grouped allocation; two-root data resolver; CLI gates. |
| `avatar-web/fishing-ml/src/fishing_ml/dataset_version.py` | Preserve schema-v1 parsing while accepting only the exact successor dataset identity for recovery schema v2. |
| `avatar-web/fishing-ml/src/fishing_ml/dataset.py` | Preserve legacy single-root loaders and resolve cycle membership IDs through parent/acquired roots. |
| `avatar-web/fishing-ml/src/fishing_ml/train.py` | Thread the cycle data-root resolver through normalization and training episode loading. |
| `avatar-web/server/src/tools/fishing-probe.ts` | Active no-answer capture, waiter-before-send ordering, forbidden-command guard, sanitized counters, and no-replace inventory sealing. |
| `avatar-web/server/src/fishing/localShadowCycle.ts` | Exact successor cycle identity for later local-shadow evidence. |
| `avatar-web/server/src/tools/fishing-local-shadow-cycle.ts` | Exact successor dataset/quarantine schema identity validation for the six-case gate. |
| `avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py` | Drive experiment/freeze/final/replay with exact successor identities and the two-root resolver; candidate behavior remains unchanged. |
| `avatar-web/fishing-ml/src/fishing_ml/evaluate.py` | Resolve successor final batches only after the durable lock without changing one-shot semantics. |
| `avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py` | Verify successor identity reaches final/replay gate validation without threshold changes. |
| `avatar-web/fishing-ml/src/fishing_ml/replay.py` | Replay explicit successor membership across safe parent/acquired directory descriptors without changing gate behavior. |
| `docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-results.md` | Sanitized append-only successor implementation and operational ledger. |
| `docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-handover.md` | Final sanitized successor handover after exactly one terminal state. |

---

### Task 1: Terminalize the Old Diagnostic Cycle

**Files:**
- Modify: `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle.md:1200`
- Modify: `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md:1`
- Create: `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-handover.md`

**Interfaces:**
- Consumes: old policy/quarantine/inventory files and the approved v1 detector outcome `0/90` eligible.
- Produces: one sanitized `NO_DATASET` terminal record and a diagnostic exclusion handover consumed by Tasks 4 and 8.

- [x] **Step 1: Reverify immutable old-cycle evidence without opening labels or model artifacts**

Run:

```bash
cd /Users/hieunt/learning-reverse
shasum -a 256 \
  avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/acquisition-policy.json \
  avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/quarantine.json \
  avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/evidence/capture-inventory.json
stat -f '%Lp %N' \
  avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/acquisition-policy.json \
  avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/quarantine.json \
  avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/evidence/capture-inventory.json
```

Expected: the three hashes equal the Global Constraints values; every permission is `600`; no old label, acquisition, allocation, dataset-version, candidate, freeze, final, replay, or local-shadow artifact is read.

- [x] **Step 2: Record the exact old-cycle terminal facts**

Update the results ledger and handover with these exact aggregate facts:

```text
terminalState = NO_DATASET
capturedValidBatchCount = 90
referenceImageCount = 540
queryImageCount = 460
recoveredRx79TimeoutCount = 2
saveErrorCount = 0
exactShaOverlapCount = 0
directDhashParentMatchImageCount = 913
decodedImageCount = 1000
rejectedBatchCount = 90
labeledBatchCount = 0
downstreamArtifactCount = 0
```

State that capture was an active diagnostic deviation, v1 policy could not admit any batch, and the 90 batches are exclusion-only evidence.

- [x] **Step 3: Update only truthful old-plan checkboxes**

Mark Task 13 Step 7 and Task 19 Steps 1–4 complete after the terminal ledger/handover exists. Leave every unapproved commit step and every skipped allocation/training/freeze/final/replay/local-shadow step unchecked, with `NO_DATASET` explaining why they did not run.

- [x] **Step 4: Sanitize both old-cycle documents**

Run:

```bash
rg -n -i 'password|credential|cookie|authorization:|account.?id|username|packet|base64|prediction|final membership|batchId' \
  docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md \
  docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-handover.md
git diff --check -- \
  docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle.md \
  docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md \
  docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-handover.md
```

Expected: matches are limited to explicit redaction-policy wording; no secret, private batch ID, image content, label, prediction, or final membership is present; diff check exits `0`.

- [x] **Step 5: Commit only after explicit old-cycle documentation approval**

After displaying the exact three-path diff, request approval before running:

```bash
git add \
  docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle.md \
  docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md \
  docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-handover.md
git diff --cached --check
git commit -m "docs: close phase2 diagnostic recovery cycle"
```

### Task 2: Refresh GitNexus and Gate Every Edit

**Files:**
- Modify: `docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-results.md` after production work is approved.
- No production file is edited in this task.

**Interfaces:**
- Consumes: current working tree including untracked recovery modules.
- Produces: current index identity and per-symbol risk ledger required before Tasks 3–6.

- [x] **Step 1: Re-index the exact working tree**

Run:

```bash
cd /Users/hieunt/learning-reverse
node .gitnexus/run.cjs analyze --index-only
node .gitnexus/run.cjs list
git rev-parse --show-toplevel
git rev-parse HEAD
git branch --show-current
```

Expected: `learning-reverse` indexes successfully with no incomplete reason; repository root, branch, commit, and index time are recorded without printing `.env`.

- [x] **Step 2: Run impact for detector and cycle-contract edits**

Run upstream impact for each existing symbol before editing it:

```bash
for symbol in \
  detector_identity _image_dhash _load_image_evidence _duplicate_groups \
  parse_acquisition_policy publish_acquisition_policy \
  parse_quarantine publish_quarantine parse_capture_inventory \
  parse_duplicate_rulings parse_acquisition_manifest publish_acquisition \
  _allocation_units _solve_allocation parse_allocation_manifest \
  _dataset_version_v2_document publish_allocation _build_parser main \
  parse_dataset_version _parse_v2; do
  node .gitnexus/run.cjs impact "$symbol" --direction upstream --repo .
done
```

Expected: each result records direct callers, affected processes/modules, epistemic state, and risk. Ambiguous `main` results are rerun with the exact file path or UID returned by GitNexus.

- [x] **Step 3: Run impact for probe and downstream identity edits**

Run:

```bash
for symbol in parseArgs runProbe runCrawl waitForRx45 waitForRx79; do
  node .gitnexus/run.cjs impact "$symbol" --direction upstream --repo .
done
node .gitnexus/run.cjs impact "LocalShadowCycleController" --direction upstream --repo .
node .gitnexus/run.cjs impact "runLocalShadowCycle" --direction upstream --repo .
node .gitnexus/run.cjs impact "verify_experiment" --direction upstream --repo .
node .gitnexus/run.cjs impact "run_cycle_final" --direction upstream --repo .
node .gitnexus/run.cjs impact "run_cycle_replay" --direction upstream --repo .
node .gitnexus/run.cjs impact "_entries" --direction upstream --repo .
node .gitnexus/run.cjs impact "compute_train_normalization" --direction upstream --repo .
node .gitnexus/run.cjs impact "load_training_episodes" --direction upstream --repo .
node .gitnexus/run.cjs impact "load_dev_episodes" --direction upstream --repo .
node .gitnexus/run.cjs impact "run_training" --direction upstream --repo .
node .gitnexus/run.cjs impact "replay_batches" --direction upstream --repo .
```

Expected: identity-only consumers are separated from behavior edits. No HIGH/CRITICAL edit proceeds without a new explicit approval.

- [x] **Step 4: Resolve every UNKNOWN result before editing**

For each `UNKNOWN`, run exact source confirmation for the complete planned symbol set:

```bash
for symbol in \
  detector_identity _image_dhash _load_image_evidence _duplicate_groups \
  parse_acquisition_policy publish_acquisition_policy \
  parse_quarantine publish_quarantine parse_capture_inventory \
  parse_duplicate_rulings parse_acquisition_manifest publish_acquisition \
  _allocation_units _solve_allocation parse_allocation_manifest \
  _dataset_version_v2_document publish_allocation _build_parser main \
  parse_dataset_version _parse_v2 parseArgs runProbe runCrawl waitForRx45 waitForRx79 \
  LocalShadowCycleController runLocalShadowCycle verify_experiment \
  run_cycle_final run_cycle_replay _entries compute_train_normalization \
  load_training_episodes load_dev_episodes run_training replay_batches; do
  rg -n --fixed-strings --glob '!node_modules/**' --glob '!.git/**' "$symbol" \
    avatar-web/fishing-ml avatar-web/server || true
done
```

Record why each UNKNOWN caller set is absent or unresolved; an empty search is not treated as proof of safety for an existing symbol.

- [x] **Step 5: Stop on HIGH or CRITICAL risk**

Present the exact target, file, direct-caller count, affected processes, risk, and planned compatibility guard. Continue only after the user explicitly approves that named edit. Previous approvals for Tasks 3 or 5 of the old plan do not automatically authorize new successor edits.

- [x] **Step 6: Commit gate**

No commit is expected because this task changes no production file. If a results ledger was created after plan approval, display its diff and request approval before staging only that file.

### Task 3: Extract the Role-Aware Batch Detector

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/duplicate_detector.py`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py:126`

**Interfaces:**
- Consumes: immutable batch manifests through `load_manifest()` and `validate_batch()` from `fishing_ml.schema`.
- Produces: `DETECTOR_DESCRIPTOR`, `ImageEvidence`, `BatchEvidence`, `BatchComparison`, `BatchDuplicateGroup`, `detector_descriptor_sha256()`, `detector_implementation_sha256()`, `load_batch_evidence()`, `compare_batches()`, and `build_duplicate_groups()`.

- [x] **Step 1: Define the dependency-leaf public contract**

Create these exact public types/signatures without importing training, calibration, evaluation, inference, replay, server, or `phase2_cycle`:

```python
BatchOwner = Literal["parent", "diagnostic", "acquired"]

@dataclass(frozen=True, slots=True)
class ImageEvidence:
    index: int
    sha256: str
    dhash: int

@dataclass(frozen=True, slots=True)
class BatchEvidence:
    batch_id: str
    owner: BatchOwner
    references: tuple[ImageEvidence, ...]
    queries: tuple[ImageEvidence, ...]
    evidence_sha256: str

@dataclass(frozen=True, slots=True)
class BatchComparison:
    reference_matches: int
    reference_required: int
    query_matches: int
    query_required: int
    is_duplicate: bool

@dataclass(frozen=True, slots=True)
class BatchDuplicateGroup:
    group_id: str
    members: tuple[BatchEvidence, ...]
```

Export exactly these callables: `detector_descriptor_sha256() -> str`; `detector_implementation_sha256(path: Path | None = None) -> str`; `load_batch_evidence(owner: BatchOwner, batch_id: str, raw_root: Path) -> BatchEvidence`; `compare_batches(left: BatchEvidence, right: BatchEvidence) -> BatchComparison`; and `build_duplicate_groups(batches: Sequence[BatchEvidence]) -> tuple[BatchDuplicateGroup, ...]`.

- [x] **Step 2: Encode the exact immutable descriptor**

Use the Spec §9.2 object verbatim and derive descriptor identity from compact sorted-key UTF-8 JSON plus one trailing newline. Derive implementation identity from the exact module bytes at `Path(__file__)`; reject a missing, symlinked, or non-regular implementation path.

- [x] **Step 3: Implement strict image and batch evidence loading**

For each batch, require manifest ID equality, successful `validate_batch`, exactly six references, at least one query, unique contiguous indices, 75×75 PNGs, and matching SHA-256. Compute dHash from Pillow RGB → L → 9×8 BILINEAR and row-major left-greater-than-right bits. Compute `evidence_sha256` from the exact canonical object `{"references": [[sha256,dhashHex]], "queries": [[sha256,dhashHex]]}`, with each role list independently sorted, dHash encoded as 16-character lowercase hex, compact sorted-key JSON, and one trailing newline.

- [x] **Step 4: Implement deterministic maximum-cardinality matching**

Build independent reference/reference and query/query bipartite graphs. Add an edge only when SHA-256 matches or Hamming distance is at most four. Visit left indices, adjacency lists, and augmenting paths in ascending index order so equal inputs produce equal match pairs. Never construct cross-role edges.

Use these exact thresholds:

```python
reference_required = math.ceil(5 * max(len(left.references), len(right.references)) / 6)
query_required = math.ceil(4 * max(len(left.queries), len(right.queries)) / 5)
is_duplicate = (
    reference_matches >= reference_required
    and query_matches >= query_required
)
```

- [x] **Step 5: Build canonical transitive batch groups**

Create undirected batch edges from `compare_batches(...).is_duplicate`, compute connected components over all parent/diagnostic/acquired batches, and derive each group ID as SHA-256 of sorted unique member `evidence_sha256` strings joined with newline plus one trailing newline. Sort groups by group ID and group members by `(owner, evidence_sha256, batch_id)`.

- [x] **Step 6: Run deterministic inline checks without adding test files**

Run:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
.venv/bin/python - <<'PY'
from __future__ import annotations

import hashlib
import itertools
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image

import fishing_ml.duplicate_detector as detector_module
from fishing_ml.duplicate_detector import (
    DETECTOR_DESCRIPTOR,
    BatchEvidence,
    ImageEvidence,
    build_duplicate_groups,
    compare_batches,
    detector_descriptor_sha256,
    detector_implementation_sha256,
    load_batch_evidence,
)


def canonical_bytes(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8") + b"\n"


def image(token: str, index: int) -> ImageEvidence:
    return ImageEvidence(
        index=index,
        sha256=hashlib.sha256(token.encode("utf-8")).hexdigest(),
        dhash=int(hashlib.sha256(f"dhash:{token}".encode("utf-8")).hexdigest()[:16], 16),
    )


def batch(name: str, references: list[str], queries: list[str]) -> BatchEvidence:
    reference_evidence = tuple(image(token, index) for index, token in enumerate(references))
    query_evidence = tuple(image(token, index) for index, token in enumerate(queries))
    digest_document = {
        "references": sorted([[item.sha256, f"{item.dhash:016x}"] for item in reference_evidence]),
        "queries": sorted([[item.sha256, f"{item.dhash:016x}"] for item in query_evidence]),
    }
    return BatchEvidence(
        batch_id=name,
        owner="acquired",
        references=reference_evidence,
        queries=query_evidence,
        evidence_sha256=hashlib.sha256(canonical_bytes(digest_document)).hexdigest(),
    )


tokens = [f"r{index}" for index in range(20)] + [f"q{index}" for index in range(20)]
hashes = [image(token, 0).dhash for token in tokens]
assert min((left ^ right).bit_count() for left, right in itertools.combinations(hashes, 2)) > 4

base = batch("base", [f"r{index}" for index in range(6)], [f"q{index}" for index in range(5)])
renamed = batch("renamed", [f"r{index}" for index in range(6)], [f"q{index}" for index in range(5)])
assert compare_batches(base, renamed).is_duplicate

one_reference_one_query_changed = batch(
    "one-change",
    ["r0", "r1", "r2", "r3", "r4", "r6"],
    ["q0", "q1", "q2", "q3", "q5"],
)
assert compare_batches(base, one_reference_one_query_changed).is_duplicate

two_references_changed = batch(
    "two-reference-changes",
    ["r0", "r1", "r2", "r3", "r6", "r7"],
    [f"q{index}" for index in range(5)],
)
assert not compare_batches(base, two_references_changed).is_duplicate

query_only = batch(
    "query-only",
    [f"r{index}" for index in range(10, 16)],
    [f"q{index}" for index in range(5)],
)
assert not compare_batches(base, query_only).is_duplicate

reference_only = batch(
    "reference-only",
    [f"r{index}" for index in range(6)],
    [f"q{index}" for index in range(10, 15)],
)
assert not compare_batches(base, reference_only).is_duplicate

cross_role = batch(
    "cross-role",
    [f"q{index}" for index in range(5)] + ["q10"],
    [f"r{index}" for index in range(5)],
)
assert not compare_batches(base, cross_role).is_duplicate

chain_a = base
chain_b = one_reference_one_query_changed
chain_c = batch(
    "chain-c",
    ["r0", "r1", "r2", "r3", "r6", "r7"],
    ["q0", "q1", "q2", "q5", "q6"],
)
assert compare_batches(chain_a, chain_b).is_duplicate
assert compare_batches(chain_b, chain_c).is_duplicate
assert not compare_batches(chain_a, chain_c).is_duplicate
groups = build_duplicate_groups((chain_a, chain_b, chain_c))
assert len(groups) == 1 and len(groups[0].members) == 3

tampered_descriptor = dict(DETECTOR_DESCRIPTOR)
tampered_descriptor["hashBits"] = 63
assert detector_descriptor_sha256() != hashlib.sha256(canonical_bytes(tampered_descriptor)).hexdigest()

implementation_path = Path(detector_module.__file__).resolve()
with TemporaryDirectory() as temporary_directory:
    tampered_path = Path(temporary_directory) / "duplicate_detector.py"
    tampered_path.write_bytes(implementation_path.read_bytes() + b"\n# changed bytes\n")
    assert detector_implementation_sha256() != detector_implementation_sha256(tampered_path)

    raw_root = Path(temporary_directory) / "raw"
    batch_root = raw_root / "loaded-batch"
    (batch_root / "img").mkdir(parents=True)
    (batch_root / "new").mkdir()
    references = []
    queries = []
    for role, count, destination, output in (
        ("img", 6, batch_root / "img", references),
        ("new", 5, batch_root / "new", queries),
    ):
        for index in range(count):
            image_path = destination / f"{index}.png"
            Image.new("RGB", (75, 75), (index * 20, 80, 160)).save(image_path)
            output.append({
                "index": index,
                "path": f"{role}/{index}.png",
                "sha256": hashlib.sha256(image_path.read_bytes()).hexdigest(),
            })
    manifest = {
        "schemaVersion": 1,
        "batchId": "loaded-batch",
        "capturedAt": "2026-09-06T00:00:00Z",
        "map": 14,
        "area": 1,
        "idFish": 1,
        "timeDelayMs": 1,
        "images": references,
        "imagesNew": queries,
    }
    (batch_root / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    loaded = load_batch_evidence("acquired", "loaded-batch", raw_root)
    assert len(loaded.references) == 6 and len(loaded.queries) == 5

print("duplicate-detector-smoke: PASS")
PY
```

Expected: script prints only `duplicate-detector-smoke: PASS`; no file is added under `tests/`.

- [x] **Step 7: Commit only after explicit detector approval**

After displaying impact and diff, request approval before:

```bash
git add \
  avatar-web/fishing-ml/src/fishing_ml/duplicate_detector.py \
  avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py
git diff --cached --check
git commit -m "feat: add role-aware batch duplicate detector"
```

### Task 4: Implement Successor Cycle Contracts

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py:30`

**Interfaces:**
- Consumes: Task 3 detector API, parent dataset v1 metadata, old diagnostic inventory, successor capture inventory, manual labels, optional exact rulings.
- Produces: strict successor policy/quarantine/inventory/ruling/acquisition/allocation dataclasses; sanitized screening output; no-replace CLI publications.

- [x] **Step 1: Separate legacy and successor identities**

Define exact constants:

```python
LEGACY_CYCLE_ID = "p2cr-20260905-01"
CYCLE_ID = "p2cr2-20260906-01"
EXPERIMENT_ID = CYCLE_ID
DATASET_ID = "phase2-coverage-recovery-v2-20260906-01"
PARENT_DATASET_ID = "phase2-20260904-01"
ALLOCATION_SEED = "20260906"
TARGET_ELIGIBLE_BATCH_COUNT = 90
TRAIN_ACQUIRED_COUNT = 45
DEV_ACQUIRED_COUNT = 15
FINAL_ACQUIRED_COUNT = 30
PARENT_TRAIN_COUNT = 140
PARENT_DEV_COUNT = 30
PARENT_FINAL_COUNT = 30
DIAGNOSTIC_INVENTORY_SHA256 = "c133238289a9d36dddc0861d4ac2c0347814b9d231fcb2c75560d33645647c53"
```

Keep parsing needed to verify old schema-v1 evidence read-only, but make all publication commands emit only successor schema v2. Set `schema_version: Literal[2]` on successor `AcquisitionPolicy`, `QuarantineLedger`, `CaptureInventory`, `AcquisitionManifest`, and `AllocationManifest`; add `schema_version: Literal[2]` to `PrefinalIntegrity`; and require the ruling-document parser to accept only integer `schemaVersion = 2`. Keep legacy schema-v1 types and parsers separate rather than accepting both versions in one successor contract.

- [x] **Step 2: Implement strict policy and quarantine schema v2**

Policy must contain exactly the fields from Spec §7, including dataset ID, `[41,44,45]`, forbidden `[43]`, diagnostic commitment, exact detector descriptor/digest, exact detector implementation digest, activation timestamp, approver `hieunt`, and approval evidence `2026-09-06 approved Fishing Phase 2 Batch-Duplicate Recovery Cycle design`. Quarantine must contain exactly the fields from Spec §6.3, with 30 sorted parent-final IDs, 90 sorted diagnostic IDs, exact commitments, and reasons `post-policy-diagnostic` and `previous-final-exposed`.

Use exact signatures `publish_acquisition_policy(diagnostic_inventory_path: Path, output_path: Path, now: datetime | None = None) -> AcquisitionPolicy` and `publish_quarantine(parent_version_path: Path, parent_final_path: Path, diagnostic_inventory_path: Path, output_path: Path) -> QuarantineLedger`.

Reject diagnostic inventory bytes unless their SHA-256 equals the committed old hash and their exact record set commits to the stored diagnostic commitment. Compute that commitment with `commit_ids(record.batch_id for record in legacy_inventory.records)`, whose canonical payload is the sorted unique ID list joined by newline with exactly one trailing newline.

- [x] **Step 3: Implement strict capture inventory schema v2 parsing**

Add `parse_legacy_capture_inventory(value: object) -> LegacyCaptureInventory` for the committed old schema-v1 file and `parse_capture_inventory(value: object, policy: AcquisitionPolicy) -> CaptureInventory` for successor schema v2. Require exact keys `schemaVersion`, `cycleId`, `captureMode`, `startedAt`, `stoppedAt`, `requested`, `summary`, and `records`. Require successor ID, mode `active-rx79-crawl-no-answer`, request `map=14`, `area=1`, `target=90`, `delayMs>=2000`, summary reason `target-reached`, saved count `90`, record count `90`, unique safe IDs, `tx43Count=0`, sorted `(capturedAt,batchId)`, and every timestamp at or after `policy.activated_at`.

- [x] **Step 4: Replace image groups with batch groups in acquisition**

Load parent, diagnostic, and acquired evidence through `duplicate_detector.load_batch_evidence()`. Each acquired batch receives exactly one `duplicateGroupIds` entry. Reject parent-touching groups as `parent-duplicate-batch-group` and diagnostic-touching groups as `diagnostic-duplicate-batch-group`; neither path consults rulings. Require complete manual labels before selection and publish only the first 90 chronological eligible batches. The acquisition parser and publication both require exact integer `schemaVersion = 2`; schema v1 acquisition remains legacy-only and cannot satisfy successor verification.

Use exact signature `publish_acquisition(*, inventory_path: Path, policy_path: Path, quarantine_path: Path, parent_version_path: Path, parent_raw_root: Path, diagnostic_raw_root: Path, acquired_raw_root: Path, acquired_labels_root: Path, rulings_path: Path | None, output_path: Path) -> AcquisitionManifest`.

- [x] **Step 5: Add sanitized screening and exact ruling publication**

Add a read-only `diagnostic-summary` command that loads only parent and committed diagnostic raw evidence and emits the aggregate fields `parentBatchEdgeCount`, `diagnosticMultiBatchGroupCount`, `maximumReferenceMatchCount`, `maximumReferenceMatchRatio`, `maximumQueryMatchRatio`, and `maximumCombinedMatchRatio`. It must reproduce `0`, `0`, `4`, `4/6`, `50%`, and `50%` without emitting a batch ID.

Add a read-only `screen-acquisition` command that runs the same detector and validation path but publishes nothing. Its stdout contains only cycle/detector identities, total acquired count, auto-rejected counts, and acquired-only multi-batch entries `{groupId, memberCount}`; it contains no batch IDs, labels, images, predictions, or final membership.

Add `publish-rulings` with the same inventory/policy/quarantine/parent/diagnostic/acquired roots as `screen-acquisition`, repeatable `--decision` values in literal `groupId=reject-acquired` or `groupId=allow-batch-group` form, plus `--approval-evidence` and `--output`. Emit this exact canonical no-replace shape:

```json
{
  "schemaVersion": 2,
  "cycleId": "p2cr2-20260906-01",
  "detectorSha256": "lowercase sha256",
  "detectorImplementationSha256": "lowercase sha256",
  "approvedBy": "hieunt",
  "approvedAt": "UTC ISO-8601",
  "approvalEvidence": "exact user approval",
  "groups": [
    {"groupId": "lowercase sha256", "decision": "allow-batch-group"}
  ]
}
```

The command reruns screening before publication. Missing, extra, singleton, parent-touching, diagnostic-touching, stale-detector, or stale-cycle rulings fail closed.

- [x] **Step 6: Preserve exact grouped allocation and sealed-final behavior**

Keep batch duplicate groups atomic in `_allocation_units()` and `_solve_allocation()`. Use seed `20260906`, require exact acquired `45/15/30`, publish successor totals `185/45/30`, exclude all 30 parent-final and all 90 diagnostic IDs, and leave pre-final/final lock semantics unchanged. Require exact integer `schemaVersion = 2` in both `allocation.json` and `evidence/prefinal-integrity.json`; the prefinal parser must reject missing or legacy schema values before inspecting sealed-final metadata.

- [x] **Step 7: Extend the CLI with exact arguments**

The CLI surface becomes:

```text
publish-policy --diagnostic-inventory --output
publish-quarantine --parent-version --parent-final --diagnostic-inventory --output
diagnostic-summary --parent-version --parent-raw-root --diagnostic-inventory --diagnostic-raw-root
screen-acquisition --inventory --policy --quarantine --parent-version --parent-raw-root --diagnostic-raw-root --acquired-raw-root --acquired-labels-root [--rulings]
publish-rulings --inventory --policy --quarantine --parent-version --parent-raw-root --diagnostic-raw-root --acquired-raw-root --acquired-labels-root --approval-evidence --decision [--decision] --output
publish-acquisition --inventory --policy --quarantine --parent-version --parent-raw-root --diagnostic-raw-root --acquired-raw-root --acquired-labels-root [--rulings] --output
publish-allocation --acquisition --quarantine --policy --parent-version --parent-train --parent-dev --cycle-root [--check]
verify --cycle-root --mode working|prefinal|final [--lock]
```

Every command returns sanitized JSON and maps invalid input to exit `2`, blocked state to exit `4`, and success to exit `0`.

- [x] **Step 8: Commit only after explicit cycle-contract approval**

After displaying impact and diff, request approval before:

```bash
git add avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py
git diff --cached --check
git commit -m "feat: add successor recovery cycle contracts"
```

### Task 5: Harden Active Capture and Seal Inventory

**Files:**
- Modify: `avatar-web/server/src/tools/fishing-probe.ts:1`

**Interfaces:**
- Consumes: existing login/direct-join flow, `waitForRx45()`, `waitForRx79()`, and `saveCanCauBatch()`.
- Produces: successor-only active crawl and canonical schema-v2 `capture-inventory.json` with no inference path.

- [x] **Step 1: Extend and strictly validate crawl arguments**

Add required crawl strings `--cycle-id` and `--inventory-output`. In crawl mode require exact cycle `p2cr2-20260906-01`, absolute inventory path, target `90`, map `14`, area `1`, and delay at least `2000`. Reject successor-only flags outside crawl mode. Before login, require port `8787` closed, inventory absent, and output root absent or empty; create the root once and never clear it.

- [x] **Step 2: Remove all shadow inference from the probe**

Delete the `maybeShadowMatch` import and both probe/crawl invocations. Do not replace them with another inference, telemetry, prediction, or model hook. Remove account ID from persisted/structured terminal summaries; runtime authentication still consumes the CLI account ID but never writes it into inventory or shareable evidence.

- [x] **Step 3: Attach waiters before protocol sends**

Use this exact ordering inside each crawl round:

```typescript
const rx45 = waitForRx45(client, signal, 8_000);
sendCrawlCommand(client, 45, counters);
const startResult = await rx45;

const rx79 = waitForRx79(client, signal, 10_000);
sendCrawlCommand(client, 41, counters);
const payload = await rx79;
```

`sendCrawlCommand` accepts only `41 | 44 | 45`, increments per-command counters, and throws on every other numeric value. Send `44` after both successful save and RX79 timeout/reset paths.

Use one crawl counter object with exact fields `savedBatchCount`, `skippedBatchCount`, `errorCount`, `tx41Count`, `tx44Count`, `tx45Count`, `tx43Count`, and `fatalEvidenceFailure`. Increment `tx43Count` for any observed metadata entry with command `43`, regardless of direction; any positive value sets `fatalEvidenceFailure` and blocks inventory publication.

- [x] **Step 4: Capture immutable inventory records from successful saves**

For each `SavedCanCauBatch`, read the returned `manifestPath`, hash the exact bytes, and append `{batchId,capturedAt,manifestSha256}` only after the final directory exists. Use the manifest timestamp, not a later reconstructed timestamp. Save errors and malformed RX79 responses produce no record, set `fatalEvidenceFailure`, and leave no partial final batch directory.

- [x] **Step 5: Publish inventory only on exact success**

On `target-reached`, require 90 records, 90 unique valid raw directories, 90 manifest hashes, `fatalEvidenceFailure=false`, zero `TX43`, and sorted records. Emit exactly the Spec §8.4 schema with `captureMode`, `requested`, summary `reason`, saved/skipped/error counts, and `tx43Count`. Serialize compact sorted-key JSON plus newline and publish with `fs.open(path, 'wx', 0o600)`, file `sync()`, close, chmod `0600`, and parent-directory fsync. On shutdown, login failure, repeated start rejection, malformed RX79, save failure, positive `tx43Count`, or short count, leave inventory absent and preserve all partial raw evidence.

- [x] **Step 6: Verify source safety and server compilation**

Run:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/server
npm run typecheck
npm run build
rg -n 'TX43|finishFishing\(|maybeShadowMatch|InferenceClient|shadowMatcher|prediction' src/tools/fishing-probe.ts
```

Expected: typecheck/build exit `0`; forbidden scan has no executable source match; documentation text may mention the prohibition only.

- [x] **Step 7: Commit only after explicit probe approval**

After displaying impact and diff, request approval before:

```bash
git add avatar-web/server/src/tools/fishing-probe.ts
git diff --cached --check
git commit -m "feat: seal successor fishing capture inventory"
```

### Task 6: Propagate Successor Identities and Two-Root Data Resolution

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py:251`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/dataset_version.py:35`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/dataset.py:54`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/train.py:1`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/artifacts.py:461`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py:837`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/evaluate.py:373`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/replay.py:757`
- Modify: `avatar-web/server/src/fishing/localShadowCycle.ts:8`
- Modify: `avatar-web/server/src/tools/fishing-local-shadow-cycle.ts:195`
- Verify only: `avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py:1`

**Interfaces:**
- Consumes: `CYCLE_ID`, `DATASET_ID`, successor cycle root, parent roots `data/phase2/raw` and `data/phase2/labels`, acquired roots `<cycle-root>/raw` and `<cycle-root>/labels`.
- Produces: exact successor identity acceptance and a no-copy/no-symlink batch resolver used by training, calibration, final, and replay.

- [x] **Step 1: Preserve historical dataset schema behavior**

Change the recovery schema-v2 identity constant to `phase2-coverage-recovery-v2-20260906-01`. Keep schema-v1 parsing/serialization byte-compatible and reject every other recovery schema-v2 dataset ID. Do not broaden accepted IDs with prefix matching.

- [x] **Step 2: Add the exact two-root resolver contract**

Add to `phase2_cycle.py`:

```python
@dataclass(frozen=True, slots=True)
class CycleDataRoots:
    parent_raw_root: Path
    parent_labels_root: Path
    acquired_raw_root: Path
    acquired_labels_root: Path
```

Implement exact callables `CycleDataRoots.roots_for(batch_id: str) -> tuple[Path, Path]` and `resolve_cycle_data_roots(cycle_root: Path) -> CycleDataRoots`.

Require the cycle root name to equal `DATASET_ID`, its parent to be `cycles`, its grandparent to be `phase2`, and its great-grandparent to be `data`. Resolve parent roots as `<data>/raw` and `<data>/labels`; resolve acquired roots as `<cycle-root>/raw` and `<cycle-root>/labels`. Every root must be an existing real directory, not a symlink. `roots_for()` validates a safe ID, checks the manifest exists in exactly one raw root, rejects collision/missing source, and returns the matching label root without enumerating or inferring sealed-final IDs.

- [x] **Step 3: Route train/dev loading through the resolver**

Add optional keyword `cycle_data_roots: CycleDataRoots | None = None` to `_entries()`, `compute_train_normalization()`, `_load()`, `load_training_episodes()`, `load_dev_episodes()`, and `run_training()`. Legacy calls with `None` keep their existing single-root behavior. Cycle calls resolve each explicit train/dev membership ID with `cycle_data_roots.roots_for(batch_id)` before reading its manifest, images, or label.

In `coverage_recovery.run_model()`, `calibrate_model()`, candidate validation, dev shape checks, latency benchmark, and freeze verification, call `resolve_cycle_data_roots(cycle_root)` once and pass it through every dataset read, including the frozen dataset snapshot in `artifacts.py`. Keep the existing `--raw-root data/phase2/raw` and `--labels-root data/phase2/labels` arguments, but validate they equal the resolver’s parent roots; acquired roots always come from the exact cycle root.

- [x] **Step 4: Route final and replay through the same resolver**

Replace `evaluate._cycle_data_roots()` with `resolve_cycle_data_roots()`. Before the durable final lock, do not call `roots_for()` on sealed-final IDs. After lock creation and `load_final_membership_after_lock()`, resolve each final batch and load it only from the unique acquired/parent source; successor final IDs are required to resolve to the acquired root.

Extend `replay_batches()` with optional keyword `cycle_data_roots: CycleDataRoots | None = None`. When provided, open parent/acquired raw and label directory descriptors once, choose the descriptor pair for each explicit 260-ID membership entry by the same unique-source rule, and preserve the existing no-follow/size/hash/error accounting. The legacy single-root branch remains unchanged when the keyword is `None`.

- [x] **Step 5: Update local-shadow identity constants**

Set `LOCAL_SHADOW_CYCLE_ID = 'p2cr2-20260906-01'` and require replay-gate dataset ID `phase2-coverage-recovery-v2-20260906-01`. Update the quarantine validator to the exact schema-v2 key set and diagnostic commitment fields; do not expose either private ID list in the report.

- [x] **Step 6: Verify identity, root, and namespace wiring**

Run:

```bash
rg -n 'p2cr-20260905-01|phase2-coverage-recovery-20260905-01' \
  avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py \
  avatar-web/fishing-ml/src/fishing_ml/evaluate.py \
  avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py \
  avatar-web/fishing-ml/src/fishing_ml/replay.py \
  avatar-web/server/src/fishing/localShadowCycle.ts \
  avatar-web/server/src/tools/fishing-local-shadow-cycle.ts
rg -n 'resolve_cycle_data_roots|cycle_data_roots|roots_for' \
  avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py \
  avatar-web/fishing-ml/src/fishing_ml/dataset.py \
  avatar-web/fishing-ml/src/fishing_ml/train.py \
  avatar-web/fishing-ml/src/fishing_ml/artifacts.py \
  avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py \
  avatar-web/fishing-ml/src/fishing_ml/evaluate.py \
  avatar-web/fishing-ml/src/fishing_ml/replay.py
```

Expected: old IDs occur only in explicitly named legacy/diagnostic constants outside successor checks; every cycle data read uses the resolver; no copy, hardlink, symlink union, or fallback to the old cycle namespace exists.

- [x] **Step 7: Commit only after explicit identity/root approval**

After displaying impact and diff, request approval before:

```bash
git add \
  avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py \
  avatar-web/fishing-ml/src/fishing_ml/dataset_version.py \
  avatar-web/fishing-ml/src/fishing_ml/dataset.py \
  avatar-web/fishing-ml/src/fishing_ml/train.py \
  avatar-web/fishing-ml/src/fishing_ml/artifacts.py \
  avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py \
  avatar-web/fishing-ml/src/fishing_ml/evaluate.py \
  avatar-web/fishing-ml/src/fishing_ml/replay.py \
  avatar-web/server/src/fishing/localShadowCycle.ts \
  avatar-web/server/src/tools/fishing-local-shadow-cycle.ts
git diff --cached --check
git commit -m "fix: resolve successor parent and acquired data roots"
```

### Task 7: Verify Production Code Before Data Operations

**Files:**
- Create: `docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-results.md`
- Modify production files from Tasks 3–6 only when verification exposes an in-scope defect and its impact gate has been satisfied.

**Interfaces:**
- Consumes: completed successor production code and existing suites.
- Produces: fresh compile/test/static/digest/GitNexus evidence required before policy publication.

- [x] **Step 1: Run focused existing Python verification**

Run:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
.venv/bin/python -m compileall -q \
  src/fishing_ml/duplicate_detector.py \
  src/fishing_ml/phase2_cycle.py \
  src/fishing_ml/dataset_version.py \
  src/fishing_ml/dataset.py \
  src/fishing_ml/train.py \
  src/fishing_ml/coverage_recovery.py \
  src/fishing_ml/evaluate.py \
  src/fishing_ml/phase2_gate.py \
  src/fishing_ml/replay.py
.venv/bin/python -m unittest \
  tests.test_phase2_training \
  tests.test_phase2_experiments \
  tests.test_phase2_gate \
  tests.test_phase2_recovery \
  tests.test_inference_size_contract -v
```

Expected: compile exits `0`; all existing focused tests pass; no test file changes.

- [x] **Step 2: Run full existing Python verification**

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python -m compileall -q src tests
.venv/bin/python -m pip check
```

Expected: all commands exit `0`; record exact test count and `pip check` result.

- [x] **Step 3: Run full server verification**

```bash
cd /Users/hieunt/learning-reverse/avatar-web/server
npm test
npm run typecheck
npm run build
```

Expected: all commands exit `0`; record exact test count; do not fix unrelated warnings.

- [x] **Step 4: Run detector and capture safety checks**

Repeat the Task 3 deterministic detector heredoc, then run:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
.venv/bin/fishing-phase2-cycle diagnostic-summary \
  --parent-version data/phase2/dataset-version.json \
  --parent-raw-root data/phase2/raw \
  --diagnostic-inventory data/phase2/cycles/phase2-coverage-recovery-20260905-01/evidence/capture-inventory.json \
  --diagnostic-raw-root data/phase2/cycles/phase2-coverage-recovery-20260905-01/raw
rg -n 'TX43|finishFishing\(|maybeShadowMatch|InferenceClient|shadowMatcher|prediction' \
  /Users/hieunt/learning-reverse/avatar-web/server/src/tools/fishing-probe.ts
rg -n 'p2cr-20260905-01|phase2-coverage-recovery-20260905-01' \
  /Users/hieunt/learning-reverse/avatar-web/fishing-ml/src/fishing_ml \
  /Users/hieunt/learning-reverse/avatar-web/server/src/fishing/localShadowCycle.ts \
  /Users/hieunt/learning-reverse/avatar-web/server/src/tools/fishing-local-shadow-cycle.ts
```

Expected: diagnostic summary reports zero parent batch edges, zero diagnostic multi-batch groups, maximum reference overlap `4/6`, maximum query overlap `50%`, and maximum combined overlap `50%`; no forbidden executable capture call exists; old IDs occur only in explicitly named legacy/diagnostic constants and old passive capture modules, never in successor output identity checks.

- [x] **Step 5: Reverify immutable baselines and inspect diff**

Run the Global Constraints hash list, the three old-cycle evidence hashes, then:

```bash
cd /Users/hieunt/learning-reverse
git diff --check
git status --short
git diff --stat
node .gitnexus/run.cjs detect-changes --scope all --repo .
```

Expected: hashes unchanged; no whitespace errors; GitNexus result is neither partial nor truncated; generated data remains unstaged.

- [x] **Step 6: Publish a sanitized implementation checkpoint**

Record approvals, exact commands, exit codes, test counts, detector descriptor/implementation hashes, changed-symbol risks, and unresolved non-blocking warnings. Exclude secrets, account IDs, batch IDs, image bytes, labels, predictions, and final membership.

- [x] **Step 7: Commit the complete production revision only after explicit approval**

Experiment publication records a Git revision, so every imported production source must be tracked and the tracked worktree must be clean before Task 13. Display the exact combined diff and request approval before running this maximum implementation commit:

```bash
git add \
  avatar-web/fishing-ml/pyproject.toml \
  avatar-web/fishing-ml/config/phase2/coverage-recovery-gate.yaml \
  avatar-web/fishing-ml/src/fishing_ml/artifacts.py \
  avatar-web/fishing-ml/src/fishing_ml/calibrate.py \
  avatar-web/fishing-ml/src/fishing_ml/config.py \
  avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py \
  avatar-web/fishing-ml/src/fishing_ml/dataset.py \
  avatar-web/fishing-ml/src/fishing_ml/dataset_version.py \
  avatar-web/fishing-ml/src/fishing_ml/duplicate_detector.py \
  avatar-web/fishing-ml/src/fishing_ml/evaluate.py \
  avatar-web/fishing-ml/src/fishing_ml/inference_service.py \
  avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py \
  avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py \
  avatar-web/fishing-ml/src/fishing_ml/phase2_training.py \
  avatar-web/fishing-ml/src/fishing_ml/replay.py \
  avatar-web/fishing-ml/src/fishing_ml/train.py \
  avatar-web/server/package.json \
  avatar-web/server/src/config.ts \
  avatar-web/server/src/fishing/localShadowCycle.ts \
  avatar-web/server/src/fishing/rx79Capture.ts \
  avatar-web/server/src/fishing/rx79CaptureRoutes.ts \
  avatar-web/server/src/index.ts \
  avatar-web/server/src/tools/fishing-local-shadow-cycle.ts \
  avatar-web/server/src/tools/fishing-probe.ts \
  docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-results.md
git diff --cached --check
git diff --cached --stat
git commit -m "feat: implement phase2 recovery cycle contracts"
git status --porcelain=v1 --untracked-files=no
```

Expected after an approved successful commit: tracked status is empty and `git ls-files` contains every imported source above. If the user declines the commit, stop before experiment publication; policy/capture may proceed only if their separate approvals do not rely on a Git-revision-bound experiment.

### Task 8: Publish Successor Policy and Exclusion Ledger

**Files:**
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/acquisition-policy.json`
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/quarantine.json`
- Modify: `docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-results.md`

**Interfaces:**
- Consumes: verified production code, old diagnostic inventory, immutable parent dataset/final split.
- Produces: pre-capture policy activation and exact parent/diagnostic exclusion commitments.

- [x] **Step 1: Prove the successor raw root and publications are absent**

Run:

```bash
cd /Users/hieunt/learning-reverse
test ! -e avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/acquisition-policy.json
test ! -e avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/quarantine.json
test ! -d avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/raw || \
  test -z "$(find avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/raw -mindepth 1 -print -quit)"
```

Expected: no successor policy/quarantine/raw evidence exists before activation.

- [x] **Step 2: Display the exact policy/quarantine commands and stop for approval**

Commands:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
.venv/bin/fishing-phase2-cycle publish-policy \
  --diagnostic-inventory data/phase2/cycles/phase2-coverage-recovery-20260905-01/evidence/capture-inventory.json \
  --output data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/acquisition-policy.json
.venv/bin/fishing-phase2-cycle publish-quarantine \
  --parent-version data/phase2/dataset-version.json \
  --parent-final data/phase2/splits/final.txt \
  --diagnostic-inventory data/phase2/cycles/phase2-coverage-recovery-20260905-01/evidence/capture-inventory.json \
  --output data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/quarantine.json
```

Do not execute until the user explicitly approves policy publication.

- [x] **Step 3: Publish each file exactly once**

Execute the approved commands in policy-then-quarantine order. Any non-zero exit blocks capture; do not delete or overwrite a successfully published file.

- [x] **Step 4: Verify canonical identities, modes, and commitments**

Run:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
shasum -a 256 \
  data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/acquisition-policy.json \
  data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/quarantine.json
stat -f '%Lp %N' \
  data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/acquisition-policy.json \
  data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/quarantine.json
.venv/bin/python - <<'PY'
import json
from pathlib import Path

from fishing_ml.duplicate_detector import (
    DETECTOR_DESCRIPTOR,
    detector_descriptor_sha256,
    detector_implementation_sha256,
)
from fishing_ml.phase2_cycle import commit_ids, parse_acquisition_policy, parse_quarantine
from fishing_ml.schema import read_json, sha256_file

root = Path("data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01")
policy_path = root / "acquisition-policy.json"
quarantine_path = root / "quarantine.json"
diagnostic_inventory_path = Path(
    "data/phase2/cycles/phase2-coverage-recovery-20260905-01/evidence/capture-inventory.json"
)
policy_document = read_json(policy_path)
quarantine_document = read_json(quarantine_path)
diagnostic_inventory = read_json(diagnostic_inventory_path)
parse_acquisition_policy(policy_document)
parse_quarantine(quarantine_document)
assert policy_document["schemaVersion"] == 2
assert quarantine_document["schemaVersion"] == 2
assert policy_document["cycleId"] == "p2cr2-20260906-01"
assert policy_document["datasetId"] == "phase2-coverage-recovery-v2-20260906-01"
assert policy_document["approvalEvidence"] == (
    "2026-09-06 approved Fishing Phase 2 Batch-Duplicate Recovery Cycle design"
)
assert policy_document["detector"] == DETECTOR_DESCRIPTOR
assert policy_document["detectorSha256"] == detector_descriptor_sha256()
assert policy_document["detectorImplementationSha256"] == detector_implementation_sha256()
assert len(quarantine_document["parentFinalBatchIds"]) == 30
assert len(quarantine_document["diagnosticBatchIds"]) == 90
diagnostic_ids = tuple(record["batchId"] for record in diagnostic_inventory["records"])
diagnostic_commitment = commit_ids(diagnostic_ids)
assert diagnostic_commitment.count == 90
assert quarantine_document["diagnosticBatchIds"] == sorted(diagnostic_ids)
assert policy_document["diagnosticBatchCommitment"] == diagnostic_commitment.sha256
assert quarantine_document["diagnosticBatchCommitment"] == diagnostic_commitment.sha256
print(json.dumps({
    "policySha256": sha256_file(policy_path),
    "quarantineSha256": sha256_file(quarantine_path),
    "detectorSha256": policy_document["detectorSha256"],
    "detectorImplementationSha256": policy_document["detectorImplementationSha256"],
    "parentFinalBatchCount": len(quarantine_document["parentFinalBatchIds"]),
    "diagnosticBatchCount": len(quarantine_document["diagnosticBatchIds"]),
    "diagnosticBatchCommitment": quarantine_document["diagnosticBatchCommitment"],
}, sort_keys=True))
PY
```

Expected: both files mode `600`; policy and quarantine parse successfully as schema v2; exact approval evidence, identities, detector bytes, counts, and newline-terminated diagnostic commitment reconcile without requiring acquisition/allocation or printing either private ID list.

- [x] **Step 5: Record only sanitized activation evidence**

Record activation UTC, policy/quarantine SHA-256, descriptor SHA-256, implementation SHA-256, parent-final count `30`, diagnostic count `90`, and diagnostic commitment. Do not record either private ID list.

- [x] **Step 6: Commit gate**

Generated policy/quarantine remain untracked. Only the sanitized results ledger may be staged after the user approves its exact diff.

### Task 9: Capture Exactly 90 New Active Batches

**Files:**
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/raw/`
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/evidence/capture-inventory.json`
- Modify: `docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-results.md`

**Interfaces:**
- Consumes: activated policy/quarantine, one explicitly selected account credential through existing local config, stopped backend port `8787`.
- Produces: exactly 90 new immutable batches and one sealed schema-v2 inventory.

- [x] **Step 1: Reverify preconditions immediately before capture**

Run baseline hashes, then:

```bash
cd /Users/hieunt/learning-reverse
! lsof -nP -iTCP:8787 -sTCP:LISTEN
test -f avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/acquisition-policy.json
test -f avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/quarantine.json
test ! -e avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/evidence/capture-inventory.json
test ! -d avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/raw || \
  test -z "$(find avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/raw -mindepth 1 -print -quit)"
```

Expected: backend closed, policy/quarantine present, successor raw root empty, inventory absent.

- [x] **Step 2: Select the account without persisting its identity**

Ask the user for the exact numeric account to use. Keep it only in a transient shell variable populated interactively:

```bash
read -r ACCOUNT_ID
case "$ACCOUNT_ID" in
  ''|*[!0-9]*|0) echo 'invalid account id' >&2; exit 2 ;;
esac
```

Do not echo the value into results, handover, inventory, logs, or command records.

- [x] **Step 3: Display the fully materialized capture command and stop for approval**

The command structure is exact:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/server
npm run fishing:probe -- \
  --account-id "$ACCOUNT_ID" \
  --map 14 \
  --area 1 \
  --output-dir /Users/hieunt/learning-reverse/avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/raw \
  --crawl \
  --target 90 \
  --delay-ms 2000 \
  --cycle-id p2cr2-20260906-01 \
  --inventory-output /Users/hieunt/learning-reverse/avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/evidence/capture-inventory.json
```

Show the exact numeric command transiently to the user, but keep the numeric ID out of persistent docs. Execute only after explicit capture approval.

- [x] **Step 4: Run once and classify the outcome**

Success requires process exit `0`, `reason=target-reached`, exactly 90 saved records, and a published inventory. Recoverable RX45/RX79 timeouts may increment sanitized skipped/error counters before the target is reached; malformed RX79, any save failure, repeated start rejection, shutdown, login failure, or short count is fatal, leaves inventory absent, preserves partial raw evidence, terminalizes this cycle as `NO_DATASET`, and stops all later tasks.

- [x] **Step 5: Validate inventory and every raw batch**

Run:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
.venv/bin/python - <<'PY'
from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path

from fishing_ml.schema import load_manifest, sha256_file, validate_batch

CYCLE_ROOT = Path("data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01")
RAW_ROOT = CYCLE_ROOT / "raw"
POLICY_PATH = CYCLE_ROOT / "acquisition-policy.json"
INVENTORY_PATH = CYCLE_ROOT / "evidence" / "capture-inventory.json"


def utc(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


policy = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
inventory = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))
assert inventory["schemaVersion"] == 2
assert inventory["cycleId"] == "p2cr2-20260906-01"
assert inventory["captureMode"] == "active-rx79-crawl-no-answer"
assert inventory["requested"] == {"map": 14, "area": 1, "target": 90, "delayMs": 2000}
assert inventory["summary"]["reason"] == "target-reached"
assert inventory["summary"]["savedBatchCount"] == 90
assert inventory["summary"]["tx43Count"] == 0

records = inventory["records"]
assert len(records) == 90
assert records == sorted(records, key=lambda item: (item["capturedAt"], item["batchId"]))
batch_ids = [record["batchId"] for record in records]
assert len(set(batch_ids)) == 90
assert utc(inventory["startedAt"]) >= utc(policy["activatedAt"])
assert utc(inventory["stoppedAt"]) >= utc(inventory["startedAt"])

raw_entries = list(RAW_ROOT.iterdir())
assert all(path.is_dir() and not path.is_symlink() for path in raw_entries)
assert sorted(path.name for path in raw_entries) == sorted(batch_ids)

reference_count = 0
query_count = 0
for record in records:
    batch_root = RAW_ROOT / record["batchId"]
    manifest_path = batch_root / "manifest.json"
    assert sha256_file(manifest_path) == record["manifestSha256"]
    manifest = load_manifest(manifest_path)
    assert manifest.batch_id == record["batchId"]
    assert manifest.captured_at == record["capturedAt"]
    assert utc(manifest.captured_at) >= utc(policy["activatedAt"])
    assert len(manifest.images) == 6
    assert len(manifest.images_new) >= 1
    validate_batch(batch_root, manifest)
    reference_count += len(manifest.images)
    query_count += len(manifest.images_new)

print(json.dumps({
    "inventorySha256": hashlib.sha256(INVENTORY_PATH.read_bytes()).hexdigest(),
    "savedBatchCount": len(records),
    "referenceImageCount": reference_count,
    "queryImageCount": query_count,
    "tx43Count": inventory["summary"]["tx43Count"],
}, sort_keys=True))
PY
stat -f '%Lp %N' /Users/hieunt/learning-reverse/avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/evidence/capture-inventory.json
```

Expected: mode `600`, 90 records, 540 references, non-zero queries, zero `TX43`, no orphan/partial batch directory.

- [x] **Step 6: Commit gate**

Raw batches and inventory remain untracked. Only sanitized aggregate results may be staged after exact approval.

Terminal note (`2026-09-06`): the one permitted successor capture exited `1` with
`reason=fatal-evidence-failure` after two inbound `RX43` observations during direct join,
before any acquisition `TX41`, `TX44`, or `TX45`. It saved zero batches, published no
inventory, and left the raw root empty. The successor is terminal `NO_DATASET`; Tasks
10–16 are intentionally skipped and remain unchecked.

### Task 10: Label in Sealed Chronological Order

**Files:**
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/labels/`
- Modify: `docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-results.md`

**Interfaces:**
- Consumes: sealed 90-record inventory and raw batches only.
- Produces: exactly 90 complete human label documents or terminal `NO_DATASET`.

- [x] **Step 1: Prove no model-assisted input is available**

Keep inference service stopped and do not open predictions, candidate artifacts, historical final evidence, or shadow output. Record only that labeling uses `fishing-label` and inventory order.

- [x] **Step 2: Launch the existing label UI in exact inventory order**

Run this driver; each `batchId` comes directly from the current sealed record and the subprocess blocks until that UI closes:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
.venv/bin/python - <<'PY'
from __future__ import annotations

import json
import subprocess
from pathlib import Path

CYCLE_ROOT = Path("data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01")
inventory = json.loads(
    (CYCLE_ROOT / "evidence" / "capture-inventory.json").read_text(encoding="utf-8")
)
records = sorted(inventory["records"], key=lambda item: (item["capturedAt"], item["batchId"]))
assert len(records) == 90 and records == inventory["records"]

for record in records:
    subprocess.run(
        [
            ".venv/bin/fishing-label",
            "--raw-root",
            str(CYCLE_ROOT / "raw"),
            "--labels-root",
            str(CYCLE_ROOT / "labels"),
            "--batch-id",
            record["batchId"],
        ],
        check=True,
    )
PY
```

- [x] **Step 3: Require all 90 labels complete**

Run:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
.venv/bin/fishing-validate \
  --raw-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/raw \
  --labels-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/labels \
  --require-batches 90
```

Then run:

```bash
.venv/bin/python - <<'PY'
from __future__ import annotations

import json
from pathlib import Path

from fishing_ml.schema import load_label, load_manifest

CYCLE_ROOT = Path("data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01")
RAW_ROOT = CYCLE_ROOT / "raw"
LABELS_ROOT = CYCLE_ROOT / "labels"
inventory = json.loads(
    (CYCLE_ROOT / "evidence" / "capture-inventory.json").read_text(encoding="utf-8")
)
batch_ids = [record["batchId"] for record in inventory["records"]]
assert len(batch_ids) == 90 and len(set(batch_ids)) == 90
assert sorted(path.stem for path in LABELS_ROOT.glob("*.json")) == sorted(batch_ids)

total_queries = 0
for batch_id in batch_ids:
    manifest = load_manifest(RAW_ROOT / batch_id / "manifest.json")
    label = load_label(LABELS_ROOT / f"{batch_id}.json")
    assert manifest.batch_id == batch_id and label.batch_id == batch_id
    assert label.status == "complete"
    query_indices = {entry.index for entry in manifest.images_new}
    reference_indices = {entry.index for entry in manifest.images}
    labeled_queries = [match.new_index for match in label.matches]
    assert len(labeled_queries) == len(query_indices)
    assert set(labeled_queries) == query_indices
    assert all(match.img_index in reference_indices for match in label.matches)
    total_queries += len(query_indices)

print(json.dumps({
    "completeBatchCount": len(batch_ids),
    "ambiguousBatchCount": 0,
    "missingBatchCount": 0,
    "labeledQueryCount": total_queries,
}, sort_keys=True))
PY
```

Expected: 90 complete, zero ambiguous, zero missing, zero extra, zero validation issues. Any other result terminalizes `NO_DATASET` because no additional post-policy batches may be appended to this sealed 90-record inventory.

- [x] **Step 4: Record sanitized labeling aggregates**

Record complete/ambiguous/missing counts and total labeled query count only. Never record label mappings, batch IDs, per-example notes, or screenshots.

- [x] **Step 5: Commit gate**

Labels remain untracked. Only sanitized aggregate results may be staged after exact approval.

### Task 11: Screen Duplicate Groups and Collect Rulings

**Files:**
- Generate conditionally: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/evidence/duplicate-rulings.json`
- Modify: `docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-results.md`

**Interfaces:**
- Consumes: policy, quarantine, parent raw, old diagnostic raw, successor raw/labels.
- Produces: sanitized duplicate screening and, only when required, an exact immutable ruling document.

- [x] **Step 1: Run the read-only screening command**

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
.venv/bin/fishing-phase2-cycle screen-acquisition \
  --inventory data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/evidence/capture-inventory.json \
  --policy data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/acquisition-policy.json \
  --quarantine data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/quarantine.json \
  --parent-version data/phase2/dataset-version.json \
  --parent-raw-root data/phase2/raw \
  --diagnostic-raw-root data/phase2/cycles/phase2-coverage-recovery-20260905-01/raw \
  --acquired-raw-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/raw \
  --acquired-labels-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/labels
```

Expected: detector and implementation digests match policy; output contains no private batch IDs; parent/diagnostic rejection counts and acquired-only multi-batch group IDs/member counts are explicit.

- [x] **Step 2: Stop immediately if exclusion reduces eligibility below 90**

Because the sealed inventory contains exactly 90 records, any parent/diagnostic rejection, invalid batch, incomplete label, or approved `reject-acquired` decision makes fewer than 90 eligible. Record `NO_DATASET` and stop without changing thresholds, policy, seed, or inventory.

- [ ] **Step 3: Request exact acquired-only group decisions**

If acquired-only multi-batch groups exist, present each exact group ID and member count without images or batch IDs. Request one explicit decision per group: `allow-batch-group` or `reject-acquired`. Do not infer a decision from labels, visual inspection, predictions, or prior approvals.

- [ ] **Step 4: Publish the fully materialized ruling document after approval**

After the user supplies every decision, keep one persistent shell open. Set `APPROVAL_EVIDENCE` to the exact user message and construct `RULING_ARGS` with one literal pair per screened group, sorted by group ID. Then materialize this command array:

```bash
COMMAND=(
  .venv/bin/fishing-phase2-cycle publish-rulings
  --inventory data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/evidence/capture-inventory.json
  --policy data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/acquisition-policy.json
  --quarantine data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/quarantine.json
  --parent-version data/phase2/dataset-version.json
  --parent-raw-root data/phase2/raw
  --diagnostic-raw-root data/phase2/cycles/phase2-coverage-recovery-20260905-01/raw
  --acquired-raw-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/raw
  --acquired-labels-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/labels
  --approval-evidence "$APPROVAL_EVIDENCE"
  "${RULING_ARGS[@]}"
  --output data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/evidence/duplicate-rulings.json
)
printf '%q ' "${COMMAND[@]}"; printf '\n'
```

Display the fully materialized command and stop for approval before executing `"${COMMAND[@]}"`. If screening reports zero acquired-only multi-batch groups, do not create a rulings file.

- [ ] **Step 5: Re-run screening with rulings**

When the file exists, run:

```bash
.venv/bin/fishing-phase2-cycle screen-acquisition \
  --inventory data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/evidence/capture-inventory.json \
  --policy data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/acquisition-policy.json \
  --quarantine data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/quarantine.json \
  --parent-version data/phase2/dataset-version.json \
  --parent-raw-root data/phase2/raw \
  --diagnostic-raw-root data/phase2/cycles/phase2-coverage-recovery-20260905-01/raw \
  --acquired-raw-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/raw \
  --acquired-labels-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/labels \
  --rulings data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/evidence/duplicate-rulings.json
```

Expected: zero missing/stale rulings, zero parent/diagnostic override, and exactly 90 eligible batches. Otherwise terminal `NO_DATASET`.

- [x] **Step 6: Commit gate**

Rulings remain private/untracked. Only sanitized group/rejection counts and ruling-document hash may be staged after approval.

### Task 12: Publish Acquisition, Allocation, and Dataset v2

**Files:**
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/acquisition.json`
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/allocation.json`
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/dataset-version.json`
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/splits/train.txt`
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/splits/dev.txt`
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/splits/sealed-final.txt`
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/evidence/prefinal-integrity.json`

**Interfaces:**
- Consumes: exactly 90 screened eligible batches and immutable parent train/dev metadata.
- Produces: one acquisition manifest, group-atomic `45/15/30` allocation, and successor schema-v2 dataset `185/45/30`.

- [x] **Step 1: Display and approve the exact acquisition command**

Use the exact command below, adding the literal `--rulings` pair only if Task 11 published the file:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
.venv/bin/fishing-phase2-cycle publish-acquisition \
  --inventory data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/evidence/capture-inventory.json \
  --policy data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/acquisition-policy.json \
  --quarantine data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/quarantine.json \
  --parent-version data/phase2/dataset-version.json \
  --parent-raw-root data/phase2/raw \
  --diagnostic-raw-root data/phase2/cycles/phase2-coverage-recovery-20260905-01/raw \
  --acquired-raw-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/raw \
  --acquired-labels-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/labels \
  --output data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/acquisition.json
```

Execute only after explicit acquisition-publication approval. Expected: 90 eligible, no private IDs in stdout, and one no-replace file.

- [x] **Step 2: Dry-check exact group-atomic allocation**

```bash
.venv/bin/fishing-phase2-cycle publish-allocation \
  --acquisition data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/acquisition.json \
  --quarantine data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/quarantine.json \
  --policy data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/acquisition-policy.json \
  --parent-version data/phase2/dataset-version.json \
  --parent-train data/phase2/splits/train.txt \
  --parent-dev data/phase2/splits/dev.txt \
  --cycle-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01 \
  --check
```

Expected: exact acquired `45/15/30`, successor `185/45/30`, source count `260`, group atomicity, seed `20260906`. If impossible, terminal `NO_DATASET`; do not alter seed or groups.

- [x] **Step 3: Stop for allocation/dataset publication approval**

Present acquisition/policy/quarantine/detector hashes, public train/dev counts, opaque final count/hash, and proposed dataset-version digest without final IDs. Execute the same command without `--check` only after approval.

- [x] **Step 4: Verify working and prefinal contracts**

```bash
.venv/bin/python - <<'PY'
from pathlib import Path

from fishing_ml.schema import read_json

root = Path("data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01")
for relative_path in (
    "acquisition.json",
    "allocation.json",
    "dataset-version.json",
    "evidence/prefinal-integrity.json",
):
    document = read_json(root / relative_path)
    assert document["schemaVersion"] == 2, relative_path
print("successor-schema-v2-publications: PASS")
PY
.venv/bin/fishing-phase2-cycle verify \
  --cycle-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01 \
  --mode working
.venv/bin/fishing-phase2-cycle verify \
  --cycle-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01 \
  --mode prefinal
```

Expected: acquisition, allocation, dataset-version, and prefinal integrity all declare schema version `2`; exact `185/45/30`, source commitment `260`, zero parent-final/diagnostic/rejected membership, no cross-split batch group, and no final ID in output.

- [x] **Step 5: Commit gate**

All generated data remains untracked. Stage only sanitized results after exact approval.

### Task 13: Execute the Fixed Candidate Matrix

**Files:**
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr2-20260906-01/experiment/experiment-manifest.json`
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr2-20260906-01/runs/`
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr2-20260906-01/candidates/`
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr2-20260906-01/selection/selection.json` or terminal `NO_CANDIDATE`.

**Interfaces:**
- Consumes: verified successor working dataset and unchanged fixed matrix code.
- Produces: immutable 24 run records, 48 candidate records, and deterministic dev-only selection.

- [x] **Step 1: Preview the exact matrix and manifest**

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
.venv/bin/fishing-phase2-coverage-recovery matrix
.venv/bin/fishing-phase2-coverage-recovery publish-experiment \
  --cycle-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01 \
  --artifacts-root artifacts/cycles/p2cr2-20260906-01 \
  --preview
```

Expected: 24 model IDs, 48 candidate IDs, exact successor identities, no runtime override.

- [x] **Step 2: Stop for experiment/training approval**

Present manifest digest, code revision, matrix IDs/counts, CPU/workers/epochs/hyperparameters, raw/labels roots, duplicate-review hash, and artifact root. Publish and run only after explicit approval.

- [x] **Step 3: Publish the experiment once and run all manifest models**

First require the implementation revision from Task 7:

```bash
cd /Users/hieunt/learning-reverse
test -z "$(git status --porcelain=v1 --untracked-files=no)"
git ls-files --error-unmatch \
  avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py \
  avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py \
  avatar-web/fishing-ml/src/fishing_ml/duplicate_detector.py \
  avatar-web/server/src/tools/fishing-probe.ts
```

Then run:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
.venv/bin/fishing-phase2-coverage-recovery publish-experiment \
  --cycle-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01 \
  --artifacts-root artifacts/cycles/p2cr2-20260906-01
.venv/bin/python - <<'PY'
from __future__ import annotations

import json
import subprocess
from pathlib import Path

CYCLE_ROOT = "data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01"
ARTIFACTS_ROOT = "artifacts/cycles/p2cr2-20260906-01"
manifest_path = Path(ARTIFACTS_ROOT) / "experiment" / "experiment-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
run_ids = manifest["executionOrder"]["runIds"]
assert len(run_ids) == 24 and len(set(run_ids)) == 24

for run_id in run_ids:
    subprocess.run(
        [
            ".venv/bin/fishing-phase2-coverage-recovery",
            "run-model",
            "--cycle-root", CYCLE_ROOT,
            "--artifacts-root", ARTIFACTS_ROOT,
            "--raw-root", "data/phase2/raw",
            "--labels-root", "data/phase2/labels",
            "--duplicate-reviews", "config/duplicate-reviews.json",
            "--run-id", run_id,
        ],
        check=True,
    )
PY
```

Verify each command’s published run inventory/checksum before advancing. Interrupted runs stop the driver and require a separately approved literal `adjudicate-interrupted --run-id <actual-id> --decision reject|reset` command; no run directory is overwritten silently.

- [x] **Step 4: Calibrate both policies and verify completeness**

Run:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
.venv/bin/python - <<'PY'
from __future__ import annotations

import json
import subprocess
from pathlib import Path

CYCLE_ROOT = "data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01"
ARTIFACTS_ROOT = "artifacts/cycles/p2cr2-20260906-01"
artifact_path = Path(ARTIFACTS_ROOT)
manifest = json.loads(
    (artifact_path / "experiment" / "experiment-manifest.json").read_text(encoding="utf-8")
)
for run_id in manifest["executionOrder"]["runIds"]:
    if not (artifact_path / "runs" / run_id).is_dir():
        continue
    subprocess.run(
        [
            ".venv/bin/fishing-phase2-coverage-recovery",
            "calibrate-model",
            "--cycle-root", CYCLE_ROOT,
            "--artifacts-root", ARTIFACTS_ROOT,
            "--raw-root", "data/phase2/raw",
            "--labels-root", "data/phase2/labels",
            "--run-id", run_id,
        ],
        check=True,
    )
PY
.venv/bin/fishing-phase2-coverage-recovery verify-experiment \
  --cycle-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01 \
  --artifacts-root artifacts/cycles/p2cr2-20260906-01
```

Expected: every one of 24 runs and 48 candidates is completed or explicitly adjudicated; no unresolved run remains.

- [x] **Step 5: Compare candidates and publish selection**

Run:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
.venv/bin/fishing-phase2-coverage-recovery compare \
  --cycle-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01 \
  --artifacts-root artifacts/cycles/p2cr2-20260906-01 \
  --raw-root data/phase2/raw \
  --labels-root data/phase2/labels
```

If no candidate passes the unchanged dev gate, publish terminal `NO_CANDIDATE` and stop. Otherwise record selected candidate/model/run IDs and aggregate dev/latency evidence without per-example predictions.

- [x] **Step 6: Commit gate**

All experiment artifacts remain untracked. Stage only sanitized aggregate results after approval.

### Task 14: Freeze the Selected Candidate

**Files:**
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr2-20260906-01/frozen/`
- Modify: `docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-results.md`

**Interfaces:**
- Consumes: one immutable successor selection and exact dataset/final commitment.
- Produces: one independently verified schema-v2 frozen bundle.

- [ ] **Step 1: Verify experiment and materialize freeze evidence**

Run `verify-experiment`, then display selection, candidate, experiment, dataset, checkpoint, config, calibration, normalization, Git revision, and opaque final commitment hashes plus proposed frozen inventory.

- [ ] **Step 2: Stop for explicit freeze approval**

State that freeze publication is no-replace and does not authorize final access. Wait for approval before execution.

- [ ] **Step 3: Publish and independently verify freeze**

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
.venv/bin/fishing-phase2-coverage-recovery freeze-selected \
  --cycle-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01 \
  --artifacts-root artifacts/cycles/p2cr2-20260906-01 \
  --raw-root data/phase2/raw \
  --labels-root data/phase2/labels
.venv/bin/fishing-phase2-coverage-recovery verify-freeze \
  --artifacts-root artifacts/cycles/p2cr2-20260906-01
```

Expected: exact regular-file inventory and matching digests; no final/replay/local-shadow terminal artifact exists.

- [ ] **Step 4: Commit gate**

Frozen artifacts remain untracked. Stage only sanitized hashes/results after approval.

### Task 15: Invoke Exactly One Successor Final

**Files:**
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr2-20260906-01/final/final-command.json`
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr2-20260906-01/final/final-evaluation.lock`
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr2-20260906-01/final/final-evaluation.json`
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr2-20260906-01/final/gate-final.json`

**Interfaces:**
- Consumes: verified freeze and opaque final commitment.
- Produces: permanent one-shot lock and exactly one `PASS`, `FINAL_FAIL`, or `FINAL_BLOCKED` branch.

- [ ] **Step 1: Run preflight without semantic final access**

Run in one persistent PTY shell and keep that shell open through Step 3:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
PREFLIGHT_JSON=$(
  .venv/bin/fishing-phase2-coverage-recovery final-preflight \
    --cycle-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01 \
    --artifacts-root artifacts/cycles/p2cr2-20260906-01
)
FINAL_AUTHORIZATION=$(
  printf '%s' "$PREFLIGHT_JSON" | .venv/bin/python -c \
    'import json, sys; print(json.load(sys.stdin)["authorization"])'
)
FINAL_COMMAND=$(
  printf '%s' "$PREFLIGHT_JSON" | .venv/bin/python -c \
    'import json, sys; print(json.load(sys.stdin)["command"])'
)
test -n "$FINAL_AUTHORIZATION"
printf '%s\n' "$FINAL_COMMAND"
```

Expected: trusted hashes, clean required tracked state, exact output absence, freeze identity, gate identity, and a one-use authorization string; no final ID or label is emitted.

- [ ] **Step 2: Stop for fresh one-process authorization**

Display `FINAL_COMMAND`, which contains the literal authorization returned by preflight, without copying it into persistent results. Explain that process start consumes authorization regardless of exit and forbids retry, candidate replacement, threshold change, or gate change. Keep the PTY and `FINAL_AUTHORIZATION` variable alive while waiting.

- [ ] **Step 3: Invoke the exact process once**

After approval, run once in that same PTY:

```bash
.venv/bin/fishing-phase2-coverage-recovery final-run \
  --cycle-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01 \
  --artifacts-root artifacts/cycles/p2cr2-20260906-01 \
  --authorization "$FINAL_AUTHORIZATION"
FINAL_EXIT=$?
unset FINAL_AUTHORIZATION FINAL_COMMAND PREFLIGHT_JSON
exit "$FINAL_EXIT"
```

No shell retry/wrapper may invoke it twice. Preserve lock and every partial/terminal file on all exits.

- [ ] **Step 4: Classify terminal final state**

Exit `0` plus gate PASS may advance. Exit `3` becomes `FINAL_FAIL`. Exit `2`, exit `4`, signal, unknown status, or inconsistent evidence becomes `FINAL_BLOCKED`. Record sanitized aggregate metrics/hashes only.

- [ ] **Step 5: Commit gate**

Final artifacts remain untracked. Stage only sanitized terminal results after approval.

### Task 16: Run Conditional Replay and Local Shadow

**Files:**
- Generate after final PASS: `avatar-web/fishing-ml/artifacts/cycles/p2cr2-20260906-01/replay/replay.json`
- Generate after final PASS: `avatar-web/fishing-ml/artifacts/cycles/p2cr2-20260906-01/replay/gate-replay.json`
- Generate after replay PASS: `avatar-web/fishing-ml/artifacts/cycles/p2cr2-20260906-01/local-shadow/local-shadow.json`

**Interfaces:**
- Consumes: final PASS for replay; replay PASS plus approved fixture for local shadow.
- Produces: replay terminal evidence and at most `READY_FOR_SEPARATE_LIVE_SHADOW_REVIEW`.

- [ ] **Step 1: Preflight and approve replay**

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
.venv/bin/fishing-phase2-coverage-recovery replay-preflight \
  --cycle-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01 \
  --artifacts-root artifacts/cycles/p2cr2-20260906-01 \
  --port 18080
```

Present final PASS hash, 260-count commitment, freeze/model/checkpoint identity, port/PID/log/output paths, and shutdown behavior. Execute replay only after explicit approval.

- [ ] **Step 2: Run replay and guarantee service shutdown**

```bash
.venv/bin/fishing-phase2-coverage-recovery replay-run \
  --cycle-root data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01 \
  --artifacts-root artifacts/cycles/p2cr2-20260906-01 \
  --port 18080
```

Expected: exact service identity, explicit 260 membership replay, no omitted batch, report/gate no-replace, exact PID termination, and closed port in `finally`. Non-PASS becomes `REPLAY_FAIL` or `REPLAY_BLOCKED` and stops.

- [ ] **Step 3: Materialize and approve the local-shadow command**

After replay PASS, select the first chronological successor inventory record as the deterministic sanitized fixture, keep its private path out of docs, and materialize the command in one persistent PTY:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/server
REPLAY_GATE=/Users/hieunt/learning-reverse/avatar-web/fishing-ml/artifacts/cycles/p2cr2-20260906-01/replay/gate-replay.json
QUARANTINE=/Users/hieunt/learning-reverse/avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/quarantine.json
INVENTORY=/Users/hieunt/learning-reverse/avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/evidence/capture-inventory.json
RAW_ROOT=/Users/hieunt/learning-reverse/avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/raw
OUTPUT=/Users/hieunt/learning-reverse/avatar-web/fishing-ml/artifacts/cycles/p2cr2-20260906-01/local-shadow/local-shadow.json
FIXTURE_BATCH=$(
  node -e 'const fs=require("fs"); const value=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); const records=[...value.records].sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt)||a.batchId.localeCompare(b.batchId)); if(records.length!==90) process.exit(2); process.stdout.write(records[0].batchId);' "$INVENTORY"
)
FIXTURE_MANIFEST="$RAW_ROOT/$FIXTURE_BATCH/manifest.json"
REPLAY_GATE_SHA256=$(shasum -a 256 "$REPLAY_GATE" | awk '{print $1}')
QUARANTINE_SHA256=$(shasum -a 256 "$QUARANTINE" | awk '{print $1}')
FIXTURE_SHA256=$(shasum -a 256 "$FIXTURE_MANIFEST" | awk '{print $1}')
LOCAL_SHADOW_COMMAND=(
  npm run fishing:local-shadow-cycle --
  --replay-gate "$REPLAY_GATE"
  --replay-gate-sha256 "$REPLAY_GATE_SHA256"
  --quarantine "$QUARANTINE"
  --quarantine-sha256 "$QUARANTINE_SHA256"
  --fixture-manifest "$FIXTURE_MANIFEST"
  --fixture-sha256 "$FIXTURE_SHA256"
  --output "$OUTPUT"
  --port 18081
)
printf '%q ' "${LOCAL_SHADOW_COMMAND[@]}"; printf '\n'
```

Present the fixture SHA-256, replay/quarantine hashes, port, and output path; do not persist `FIXTURE_BATCH`. Wait for explicit fixture/local-shadow approval while keeping the PTY alive.

- [ ] **Step 4: Run the exact six-case local-shadow gate**

After approval, execute and clear transient fixture identity:

```bash
"${LOCAL_SHADOW_COMMAND[@]}"
LOCAL_SHADOW_EXIT=$?
unset FIXTURE_BATCH FIXTURE_MANIFEST LOCAL_SHADOW_COMMAND
exit "$LOCAL_SHADOW_EXIT"
```

Require case count `6`, continuation count `6`, HTTP count `5`, gameplay side-effect count `0`, exact statuses/error codes, successor identities, and sanitized no-replace output.

PASS yields only `READY_FOR_SEPARATE_LIVE_SHADOW_REVIEW`; valid safety failure yields `LOCAL_SHADOW_FAIL`; incomplete/uncertain evidence yields `LOCAL_SHADOW_BLOCKED`. Do not enable live shadow.

- [ ] **Step 5: Commit gate**

Replay/local-shadow artifacts remain untracked. Stage only sanitized terminal results after approval.

### Task 17: Publish Sanitized Successor Results and Handover

**Files:**
- Modify: `docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-results.md`
- Create: `docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-handover.md`
- Modify: `docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle.md:1`

**Interfaces:**
- Consumes: every approved command, verification record, hash, aggregate, and the single truthful terminal state.
- Produces: sanitized ledger/handover and accurate Plan checkboxes.

- [x] **Step 1: Record exactly one successor terminal state**

Choose exactly one: `NO_DATASET`, `NO_CANDIDATE`, `FINAL_FAIL`, `FINAL_BLOCKED`, `REPLAY_FAIL`, `REPLAY_BLOCKED`, `LOCAL_SHADOW_FAIL`, `LOCAL_SHADOW_BLOCKED`, or `READY_FOR_SEPARATE_LIVE_SHADOW_REVIEW`. Explain why later stages did not run.

- [x] **Step 2: Sanitize results and handover**

Include dates, approval evidence, exit codes, aggregate counts/metrics, IDs, digests, gate states, and unresolved risks. Exclude credentials, `.env`, account/user IDs, packet bytes, image/base64 content, private batch IDs, label mappings, final membership, predictions, and per-example error identities.

- [x] **Step 3: Mark only actually completed checkboxes**

Change `- [ ]` to `- [x]` only after the exact step completed. Leave every conditional/skipped/unapproved step unchecked and explain it in the terminal ledger.

- [x] **Step 4: Run privacy and document checks**

```bash
cd /Users/hieunt/learning-reverse
rg -n -i 'password|credential|cookie|authorization:|account.?id|username|packet|base64|batchId|final membership|prediction' \
  docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-results.md \
  docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-handover.md
git diff --check -- docs/superpowers
```

Expected: only explicit redaction-policy text matches; no private operational evidence is present; diff check exits `0`.

- [x] **Step 5: Commit gate**

Display the exact plan/results/handover diff and wait for explicit approval before staging those documents.

### Task 18: Run Final Verification and Commit Gate

**Files:**
- Verify: all production and documentation files modified by this Plan.
- Never stage: `.agents/`, `.env`, generated data/artifacts, or `avatar-web/fishing-ml/artifacts/phase2-selection.json`.

**Interfaces:**
- Consumes: completed implementation and truthful terminal documentation.
- Produces: final test/build/hash/privacy/GitNexus evidence and an optional explicitly approved commit.

- [x] **Step 1: Run the exact final verification suite**

Run:

```bash
cd /Users/hieunt/learning-reverse/avatar-web/fishing-ml
.venv/bin/python -m compileall -q src tests
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python -m pip check
.venv/bin/python - <<'PY'
import hashlib
import json

from fishing_ml.duplicate_detector import BatchEvidence, ImageEvidence, compare_batches


def item(token: str, index: int) -> ImageEvidence:
    return ImageEvidence(
        index=index,
        sha256=hashlib.sha256(token.encode()).hexdigest(),
        dhash=int(hashlib.sha256(f"dhash:{token}".encode()).hexdigest()[:16], 16),
    )


def batch(name: str, references: list[str], queries: list[str]) -> BatchEvidence:
    refs = tuple(item(token, index) for index, token in enumerate(references))
    qs = tuple(item(token, index) for index, token in enumerate(queries))
    digest_document = {
        "references": sorted([[value.sha256, f"{value.dhash:016x}"] for value in refs]),
        "queries": sorted([[value.sha256, f"{value.dhash:016x}"] for value in qs]),
    }
    digest = hashlib.sha256(
        json.dumps(digest_document, sort_keys=True, separators=(",", ":")).encode() + b"\n"
    ).hexdigest()
    return BatchEvidence(name, "acquired", refs, qs, digest)


base = batch("base", [f"r{i}" for i in range(6)], [f"q{i}" for i in range(5)])
edge = batch("edge", ["r0", "r1", "r2", "r3", "r4", "r6"], ["q0", "q1", "q2", "q3", "q5"])
ref_fail = batch("ref-fail", ["r0", "r1", "r2", "r3", "r6", "r7"], [f"q{i}" for i in range(5)])
query_fail = batch("query-fail", [f"r{i}" for i in range(6)], ["q0", "q1", "q2", "q5", "q6"])
assert compare_batches(base, edge).is_duplicate
assert not compare_batches(base, ref_fail).is_duplicate
assert not compare_batches(base, query_fail).is_duplicate
print("duplicate-detector-final-smoke: PASS")
PY
.venv/bin/fishing-phase2-cycle diagnostic-summary \
  --parent-version data/phase2/dataset-version.json \
  --parent-raw-root data/phase2/raw \
  --diagnostic-inventory data/phase2/cycles/phase2-coverage-recovery-20260905-01/evidence/capture-inventory.json \
  --diagnostic-raw-root data/phase2/cycles/phase2-coverage-recovery-20260905-01/raw

CYCLE_ROOT=data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01
if [ -f "$CYCLE_ROOT/allocation.json" ]; then
  .venv/bin/fishing-phase2-cycle verify --cycle-root "$CYCLE_ROOT" --mode working
  .venv/bin/fishing-phase2-cycle verify --cycle-root "$CYCLE_ROOT" --mode prefinal
fi
if [ -f artifacts/cycles/p2cr2-20260906-01/final/final-evaluation.lock ]; then
  .venv/bin/fishing-phase2-cycle verify \
    --cycle-root "$CYCLE_ROOT" \
    --mode final \
    --lock artifacts/cycles/p2cr2-20260906-01/final/final-evaluation.lock
fi

cd /Users/hieunt/learning-reverse/avatar-web/server
npm test
npm run typecheck
npm run build
rg -n 'TX43|finishFishing\(|maybeShadowMatch|InferenceClient|shadowMatcher|prediction' \
  src/tools/fishing-probe.ts

cd /Users/hieunt/learning-reverse
shasum -a 256 \
  avatar-web/fishing-ml/data/phase2/dataset-version.json \
  avatar-web/fishing-ml/data/phase2/splits/train.txt \
  avatar-web/fishing-ml/data/phase2/splits/dev.txt \
  avatar-web/fishing-ml/data/phase2/splits/final.txt \
  avatar-web/fishing-ml/config/duplicate-reviews.json \
  avatar-web/fishing-ml/config/phase2/gate.yaml \
  avatar-web/fishing-ml/config/phase2/candidates.yaml \
  avatar-web/fishing-ml/artifacts/phase2-selection.json \
  avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen/freeze-manifest.json \
  avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/final-evaluation.lock \
  avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/final-evaluation.json \
  avatar-web/fishing-ml/artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/gate-final.json \
  docs/superpowers/plans/2026-09-05-fishing-phase-2-final-and-replay-results.md \
  avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/acquisition-policy.json \
  avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/quarantine.json \
  avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/evidence/capture-inventory.json
```

Expected: existing suites/build pass; detector smoke passes; diagnostic aggregates remain the approved values; successor verification passes for every reached stage; historical and old-cycle hashes equal the Global Constraints values; forbidden capture calls are absent.

- [x] **Step 2: Run final Git and GitNexus checks**

```bash
cd /Users/hieunt/learning-reverse
git diff --check
node .gitnexus/run.cjs detect-changes --scope all --repo .
git status --short
git diff --stat
```

Expected: GitNexus is neither partial nor truncated; every changed symbol/process is recorded; no unrelated file is fixed; generated/private paths remain unstaged.

- [x] **Step 3: Display the exact proposed tracked commit set**

The maximum allowed tracked set is:

```text
docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle.md
docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md
docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-handover.md
docs/superpowers/specs/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-design.md
docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle.md
docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-results.md
docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle-handover.md
avatar-web/fishing-ml/src/fishing_ml/duplicate_detector.py
avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py
avatar-web/fishing-ml/src/fishing_ml/dataset_version.py
avatar-web/fishing-ml/src/fishing_ml/dataset.py
avatar-web/fishing-ml/src/fishing_ml/train.py
avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py
avatar-web/fishing-ml/src/fishing_ml/evaluate.py
avatar-web/fishing-ml/src/fishing_ml/replay.py
avatar-web/server/src/tools/fishing-probe.ts
avatar-web/server/src/fishing/localShadowCycle.ts
avatar-web/server/src/tools/fishing-local-shadow-cycle.ts
```

Existing old-cycle production files already modified in the workspace are not implicitly authorized by this list; include them only if the user approves the combined old-cycle implementation commit after reviewing the exact diff.

- [x] **Step 4: Commit only after explicit final approval**

After the user approves the exact staged set, run literal `git add` paths from that approved set, then:

```bash
git diff --cached --check
git status --short
git diff --cached --stat
git commit -m "feat: complete phase2 batch duplicate recovery cycle"
```

Do not push, merge, or publish externally without another explicit instruction.

## Review Gate

This Plan is documentation only. Do not execute Task 1 or modify production code until the user explicitly approves `docs/superpowers/plans/2026-09-06-fishing-phase-2-batch-duplicate-recovery-cycle.md`.
