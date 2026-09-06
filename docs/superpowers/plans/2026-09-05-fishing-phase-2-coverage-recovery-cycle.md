# Fishing Phase 2 Coverage Recovery Cycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and operate the approved `p2cr-20260905-01` recovery cycle without reusing historical final data, producing an independently frozen candidate, one-shot new final evidence, conditional replay, and conditional local-shadow evidence.

**Architecture:** Add a dependency-leaf Python cycle-contract module for acquisition, quarantine, duplicate grouping, allocation, and sealed membership; keep historical schema-v1 paths intact while introducing explicit schema-v2/v3 dispatch for new artifacts. Add a passive Node RX79 tap that only observes an already-connected session, and add a cycle orchestration path that freezes an exact 48-candidate manifest before training and advances only through immutable, no-replace stage outputs.

**Tech Stack:** Python 3.11/3.12, dataclasses, Pillow, NumPy, PyTorch, PyYAML, Node.js 22+, TypeScript 5.7, Express, existing Avatar game client/session code, GitNexus 1.6.11.

**Spec:** `docs/superpowers/specs/2026-09-05-fishing-phase-2-coverage-recovery-cycle-design.md`

## Global Constraints

- Do not edit production code until this Plan receives an explicit user approval separate from the already-approved Spec.
- Do not use TDD. Do not create or modify test files unless the user gives a separate explicit test-writing authorization during implementation.
- Before editing every existing function/class/method, rerun GitNexus upstream impact for that exact symbol. Warn and stop before any HIGH or CRITICAL edit; treat UNKNOWN as unresolved and confirm it with source/text search.
- Current GitNexus index is bound to repository `learning-reverse`, commit `1b98635c38c80d869aeaf4e40b5c8da2d5f804d3`, indexed `2026-09-05T15:12:05.699Z`, with no incomplete index reasons.
- Planning-time risk results: `parse_dataset_version` LOW/9 impacted; `apply_augmentation_profile` LOW/4; `calibrate_thresholds` LOW/5; `run_training` LOW/7; `evaluate_final_once` LOW/6; `replay_batches` LOW/2; `load_frozen_matcher` LOW/3; `runShadowMatch` LOW/4; `_parse_config_document` HIGH/20 across four execution flows; `verify_current_dataset` HIGH/6 across three flows; `verify_freeze` CRITICAL/19 across five flows.
- Preserve `verify_freeze()` schema-v1 behavior byte-for-byte. Add a schema dispatcher and a separate cycle verifier rather than weakening or broadening historical verification.
- Preserve all historical final, gate, selection, frozen, checkpoint, dataset, split, and results evidence. Never remove or overwrite a historical lock or terminal report.
- Historical immutable hashes to reverify before every operational phase:
  - parent `dataset-version.json`: `406be8ed9fc097adcdaf6c3446addd4bf94c909d3a299cca8ce1304da35b0807`;
  - parent `train.txt`: `c84889444aac26d49a17d16f0806c7992f9dc60ae4f18dc979972442c741269a`;
  - parent `dev.txt`: `e39f70573dc4a94f08947df96f42364eb0b5d69b6d0677b3ccca80391cb42d3c`;
  - parent `final.txt`: `e92e14e94b3883ecc62958b5396cd9b6d1b6edd9778a590203564083508cb045`;
  - parent duplicate reviews: `f07982192191fd48daddff77ce136bfb21e956276991b54ec8d712837e119255`;
  - historical gate policy: `a6595257ef073338cdeafadca3371ab568697e8e045fe3d696542b8584e07a83`;
  - historical candidate matrix: `6ade4b03b2c466c1c03b63092956ae1ac6e4420d3bb96ad210468eb86550982e`;
  - historical selection: `4c15e952eef67f7291a306d2eedc8277ca86601286b301538e8c03335dc71f1f`;
  - historical selected-candidate manifest: `7fc989316812272cfac40120489507189834d30f09cdbd09b3ba753044e4df1c`;
  - historical model config: `4ea5b8c74adf01253c655ff2ce66541b78abe1a7152562984eaab1e6bd8b90cb`;
  - historical training history: `e097b6a83c7de5a2eda05c7ee42f627de360cd9856d753aa6c912957c7bf8847`;
  - historical normalization: `6c11840c6e93f3abe66915fbe7c7a5da77c44469221c747bbb9481684d1cdc6e`;
  - historical dev predictions: `af7b09125536385e88c75f0d07a90a75b7bafcc64a73e410532fa0ae254058a3`;
  - historical dev metrics: `6d7b8a56616947cda45452d304b58934df98043a37a7dcb3e14b641c2521250f`;
  - historical thresholds: `27bd8f20b9de30c98466a850bee0310b201149b78b4117c5d0349b4f119bc7f6`;
  - historical environment: `37be54ab2f52a3bf89b2964933bf3df27f38d5f62c64738bc48e88a1b6f5caf4`;
  - historical checkpoint and frozen checkpoint: `6168b65abaf8ade9008c9611413167f76533d1e80926b2be852df6e7e3a67789`;
  - historical frozen model config: `4ea5b8c74adf01253c655ff2ce66541b78abe1a7152562984eaab1e6bd8b90cb`;
  - historical frozen normalization: `6c11840c6e93f3abe66915fbe7c7a5da77c44469221c747bbb9481684d1cdc6e`;
  - historical frozen thresholds: `27bd8f20b9de30c98466a850bee0310b201149b78b4117c5d0349b4f119bc7f6`;
  - historical frozen environment: `37be54ab2f52a3bf89b2964933bf3df27f38d5f62c64738bc48e88a1b6f5caf4`;
  - historical frozen dev metrics: `6d7b8a56616947cda45452d304b58934df98043a37a7dcb3e14b641c2521250f`;
  - historical freeze manifest: `ed1bbe4f9b24980c0277ace6da5d3b320b9f51a2b33f39c18c52e73beeed64ab`;
  - historical dataset snapshot: `d13ce9d4c90865fbedfeb2330d694278879f435e1c5f0ad16b72d2b96480a702`;
  - historical split checksums: `99c9cd6b33c137fde3ce95d9c41db82fb70abae99a0842de072d17b15fc25927`;
  - historical final lock: `75b6659d7d961870bcdbe3652ae532bfd2e162d6fde61af7bcb5b16b091490e6`;
  - historical final report: `3da0160a93ea6bcfd4747f696c1b5bbd1d3eef2ce599c4b405934d4f0daddc0b`;
  - historical final gate: `018c8c164f4c97b567ebba636f5004730d8dda2ec4fc9755532a6b918ce8d01d`;
  - historical final/replay results ledger: `fce0d917a7b074e38b6fa863a6347cc2d04cc55a00285c47476bb8c527866454`.
- Never read historical-final labels, predictions, per-example evaluation evidence, or error identities. Historical-final image bytes may be decoded only inside the dedicated deterministic SHA/dHash leakage detector required by Spec §5.3; that detector may emit only image digests/group commitments and may influence the cycle only by exclusion, never by sampling, training, calibration, thresholding, candidate choice, or error analysis.
- New IDs are fixed: cycle/experiment `p2cr-20260905-01`; dataset `phase2-coverage-recovery-20260905-01`; parent dataset `phase2-20260904-01`; seed `20260905`; training seed `20260827`.
- New split counts are exact: `185 train / 45 dev / 30 sealed final`; the 260-ID source commitment excludes all 30 historical-final batches.
- Pre-final code may stat/hash the sealed final path, but may not parse final IDs, labels, manifests, images, or emit final membership. Full final semantic access starts only after a durable fsynced lock exists.
- Candidate space is exactly `4 augmentation × 3 hard-negative × 2 embedding × 2 calibration = 48` candidate identities from exactly 24 training runs. No runtime candidate/gate override is accepted after experiment-manifest publication.
- Training uses CPU, workers `0`, 80 epochs, learning rate `0.001`, weight decay `0.0001`, temperature `0.05`, channels `[32,64,96,128]`, and reproducibility tolerance `0.002`.
- Final/replay quality policy remains: zero wrong accepted, accepted rate `>= 0.60`, top-1 `>= 0.98`, batch exact match `>= 0.90`, p95 `<= 100 ms`, max `< 250 ms`, errored batch rate `<= 0.01`, omitted rate `0`, one model identity.
- All generated dataset, labels, candidate runs, predictions, checkpoints, and operational reports remain untracked unless a separate publication decision selects sanitized files. Never stage the currently untracked restored `avatar-web/fishing-ml/artifacts/phase2-selection.json` accidentally.
- Every operational mutation has its own approval gate. Approval for policy, allocation, training, freeze, final, replay, shadow, commit, push, or publication does not authorize any other stage.

## File Responsibility Map

| File | Responsibility |
| --- | --- |
| `avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py` | Dependency-leaf schemas, canonical digests, dHash grouping, quarantine, eligibility, allocation, working/final membership guards, pre-final opaque verification. |
| `avatar-web/fishing-ml/src/fishing_ml/dataset_version.py` | Backward-compatible schema-v1 plus strict schema-v2 dataset-version parsing and serialization. |
| `avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py` | Cycle orchestration CLI: publish experiment, run/adjudicate candidates, select, freeze, preflight final, invoke final, replay, and terminal-state publication. |
| `avatar-web/fishing-ml/src/fishing_ml/config.py` | Preserve training-config v1/v2 and add strict cycle config v3 tokens. |
| `avatar-web/fishing-ml/src/fishing_ml/phase2_training.py` | Four exact deterministic cycle augmentation profiles and ratio `0.50` hard-negative support. |
| `avatar-web/fishing-ml/src/fishing_ml/dataset.py` | Explicit train/dev membership loaders that never validate or traverse sealed final. |
| `avatar-web/fishing-ml/src/fishing_ml/train.py` | Accept immutable working membership and record cycle provenance without opening final. |
| `avatar-web/fishing-ml/src/fishing_ml/calibrate.py` | Joint and partition-robust zero-wrong calibration primitives. |
| `avatar-web/fishing-ml/src/fishing_ml/artifacts.py` | New schema-v2 cycle freeze build/verify/dispatch while leaving schema-v1 verifier unchanged. |
| `avatar-web/fishing-ml/src/fishing_ml/evaluate.py` | New cycle-specific one-shot evaluator with lock-before-final-access ordering. |
| `avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py` | Strict cycle-aware gate-policy schema and cycle identity validation. |
| `avatar-web/fishing-ml/src/fishing_ml/replay.py` | Explicit ordered membership replay for the 260-batch successor corpus. |
| `avatar-web/fishing-ml/src/fishing_ml/inference_service.py` | Consume the freeze dispatcher; no request/response protocol change. |
| `avatar-web/fishing-ml/pyproject.toml` | Register `fishing-phase2-cycle` and `fishing-phase2-coverage-recovery`. |
| `avatar-web/fishing-ml/config/phase2/coverage-recovery-gate.yaml` | Cycle-specific immutable final/replay thresholds and approval metadata. |
| `avatar-web/server/src/fishing/rx79Capture.ts` | Passive RX79 observer, immutable batch save queue, status, abort, and no-replace inventory sealing. |
| `avatar-web/server/src/fishing/rx79CaptureRoutes.ts` | Authenticated owner-only start/status/stop endpoints against an already-connected session. |
| `avatar-web/server/src/fishing/localShadowCycle.ts` | One controller/client, process-local kill switch, six-case continuation-safe local-shadow gate, sanitized aggregation. |
| `avatar-web/server/src/tools/fishing-local-shadow-cycle.ts` | Loopback fixture server and no-replace local-shadow report CLI. |
| `avatar-web/server/src/config.ts` | Optional capture root; capture is disabled unless explicitly configured and is forbidden in production. |
| `avatar-web/server/src/index.ts` | Instantiate/mount capture registry/router; no gameplay lifecycle changes. |
| `avatar-web/server/package.json` | Register the local-shadow fixture command. |
| `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md` | Sanitized append-only implementation/operational ledger with hashes, counts, commands, approvals, and terminal state. |
| `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-handover.md` | Final sanitized handover; no final IDs, credentials, packets, images, prediction arrays, or per-example evidence. |

---

### Task 1: Add Cycle Contract and Immutable Schemas

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py`
- Modify: `avatar-web/fishing-ml/pyproject.toml:21-39`

**Interfaces:**
- Consumes: `read_json(path)`, `publish_no_replace(path, mapping)`, `sha256_file(path)`, `load_manifest(path)`, `load_label(path)` from `fishing_ml.schema`.
- Produces: `AcquisitionPolicy`, `QuarantineLedger`, `CaptureInventory`, `AcquisitionManifest`, `AllocationManifest`, `WorkingMembership`, `StageBlockedError`, `StageInvalidError`, `publish_acquisition_policy()`, `publish_quarantine()`, `publish_acquisition()`, `publish_allocation()`, `verify_cycle_dataset()`, `load_working_membership()`, `load_final_membership_after_lock()`.

- [x] **Step 1: Re-run pre-edit impact and bind the new leaf boundary**

Run:

```bash
node .gitnexus/run.cjs impact "read_json" --direction upstream --repo .
node .gitnexus/run.cjs impact "publish_no_replace" --direction upstream --repo .
```

Expected: record risk/callers/processes in the results ledger; no existing symbol is edited in this step. The new module may import only Python standard library, Pillow, and `fishing_ml.schema`; it must not import training, calibration, evaluation, inference, replay, game, or server code.

- [x] **Step 2: Define exact immutable records and canonical helpers**

Add these public records and constants with strict unknown-key rejection:

```python
CYCLE_ID = "p2cr-20260905-01"
EXPERIMENT_ID = "p2cr-20260905-01"
DATASET_ID = "phase2-coverage-recovery-20260905-01"
PARENT_DATASET_ID = "phase2-20260904-01"
ALLOCATION_SEED = "20260905"

@dataclass(frozen=True, slots=True)
class SourceCommitment:
    count: int
    sha256: str

@dataclass(frozen=True, slots=True)
class WorkingMembership:
    dataset_id: str
    train_ids: tuple[str, ...]
    dev_ids: tuple[str, ...]
    acquired_dev_ids: tuple[str, ...]
    source_commitment: SourceCommitment

class StageBlockedError(RuntimeError):
    pass

class StageInvalidError(ValueError):
    pass
```

Canonical ID commitment must be exactly:

```python
def commit_ids(batch_ids: Iterable[str]) -> SourceCommitment:
    normalized = tuple(sorted(_safe_unique_ids(batch_ids)))
    payload = ("\n".join(normalized) + "\n").encode("utf-8")
    return SourceCommitment(count=len(normalized), sha256=hashlib.sha256(payload).hexdigest())
```

All public JSON publishers must call `publish_no_replace`; byte-identical repetition is idempotent and different bytes are rejected.

- [x] **Step 3: Implement policy and quarantine commands**

Register CLI subcommands:

```text
fishing-phase2-cycle publish-policy --output PATH
fishing-phase2-cycle publish-quarantine --parent-version PATH --parent-final PATH --output PATH
fishing-phase2-cycle verify --cycle-root PATH --mode working|prefinal|final --lock PATH
```

`publish-policy` generates `activatedAt` once using `datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")`, then publishes the exact Spec §5.2 document. `publish-quarantine` reads only parent dataset-version metadata and parent `final.txt`; it must not open raw, labels, historical final reports, or predictions.

- [x] **Step 4: Register the cycle console command**

Add:

```toml
fishing-phase2-cycle = "fishing_ml.phase2_cycle:main"
```

- [x] **Step 5: Verify imports and strict publication behavior**

Run:

```bash
cd avatar-web/fishing-ml
.venv/bin/python -m compileall -q src/fishing_ml/phase2_cycle.py
.venv/bin/python - <<'PY'
from fishing_ml.phase2_cycle import commit_ids
value = commit_ids(["b", "a"])
assert value.count == 2
assert value == commit_ids(["a", "b"])
print(value.sha256)
PY
```

Expected: exit `0`; one lowercase 64-character digest; no dataset payload read.

- [ ] **Step 6: Commit after explicit commit approval**

```bash
git add avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py avatar-web/fishing-ml/pyproject.toml
git commit -m "feat: add phase2 recovery cycle contracts"
```

### Task 2: Add Passive RX79 Capture on Existing Sessions

**Files:**
- Create: `avatar-web/server/src/fishing/rx79Capture.ts`
- Create: `avatar-web/server/src/fishing/rx79CaptureRoutes.ts`
- Modify: `avatar-web/server/src/config.ts:12-82`
- Modify: `avatar-web/server/src/index.ts:17-91`

**Interfaces:**
- Consumes: `SessionManager.require(accountId).rawClient`, `GameClient.session` message events, `decodeCanCau()`, and `saveCanCauBatch()`.
- Produces: `Rx79CaptureRegistry.start()`, `Rx79CaptureRegistry.snapshot()`, `Rx79CaptureRegistry.stopAndSeal()`, `rx79CaptureRouter()` and no-replace `evidence/capture-inventory.json`.

- [x] **Step 1: Run impact for every existing Node edit**

Run:

```bash
node .gitnexus/run.cjs impact "loadConfig" --direction upstream --repo .
node .gitnexus/run.cjs impact "shutdown" --direction upstream --repo .
node .gitnexus/run.cjs impact "saveCanCauBatch" --direction upstream --repo .
```

Expected: record results. `shutdown` was LOW/1 and `saveCanCauBatch` has two known probe callers at planning time. Do not edit `saveCanCauBatch`; reuse it as the immutable batch writer.

- [x] **Step 2: Add an explicitly disabled capture configuration**

Extend `Config` with:

```typescript
fishingRx79CaptureRoot: string | null;
```

Parse `FISHING_RX79_CAPTURE_ROOT` as an absolute path only when `NODE_ENV !== 'production'`; reject the variable in production. Missing variable means `null` and all capture endpoints return `404` without touching sessions or disk.

- [x] **Step 3: Implement the passive registry**

Use these public types and methods:

```typescript
export interface Rx79CaptureStart {
  readonly accountId: number;
  readonly cycleId: 'p2cr-20260905-01';
  readonly map: number;
  readonly area: number;
}

export interface Rx79CaptureSnapshot {
  readonly state: 'capturing' | 'sealing' | 'sealed' | 'blocked';
  readonly savedBatchCount: number;
  readonly failedBatchCount: number;
  readonly startedAt: string;
  readonly inventoryPath?: string;
  readonly blockedReason?: string;
}

export class Rx79CaptureRegistry {
  start(client: GameClient, request: Rx79CaptureStart): Rx79CaptureSnapshot;
  snapshot(accountId: number): Rx79CaptureSnapshot | null;
  stopAndSeal(accountId: number): Promise<Rx79CaptureSnapshot>;
  abort(accountId: number, reason: string): void;
}
```

The message handler must return unless `msg.command === 79`, then decode and queue `saveCanCauBatch()` with `tag: 'p2cr'`. It must never call `login`, `joinPark`, `startFishing`, `send`, TX41/TX43/TX44/TX45, or any automation method. Attach to `client.session.on('message', handler)` and detach with `removeListener` on explicit stop, socket close, or abort.

- [x] **Step 4: Seal a sanitized inventory no-replace**

After explicit stop, wait for all queued writes, sort records by `(capturedAt, batchId)`, and exclusively create:

```typescript
const inventoryDocument = {
  schemaVersion: 1,
  cycleId: 'p2cr-20260905-01',
  startedAt: state.startedAt.toISOString(),
  stoppedAt: stoppedAt.toISOString(),
  records: records.map(({ batchId, capturedAt, manifestSha256 }) => ({
    batchId,
    capturedAt,
    manifestSha256,
  })),
};
```

Use `fs.open(path, 'wx', 0o600)`, `handle.sync()`, `handle.close()`, then fsync the parent directory. Do not include account ID, user ID, idFish, packet bytes, image bytes, cookie, credentials, or model output.

- [x] **Step 5: Add owner-authenticated control routes**

Mount these routes through `makeRequireAuth()` and `requireOwnedAccount()`:

```text
POST /api/accounts/:id/fishing-rx79-capture/start
GET  /api/accounts/:id/fishing-rx79-capture
POST /api/accounts/:id/fishing-rx79-capture/stop
```

`start` requires exact JSON keys `cycleId`, `map`, and `area`, an online `rawClient`, and no active/sealed registry entry. It only attaches the observer. `stop` is the only path that seals an inventory; socket close or server shutdown yields `blocked` and never fabricates a sealed inventory.

- [x] **Step 6: Verify read-only source shape and server compilation**

Run:

```bash
cd avatar-web/server
npm run typecheck
npm run build
rg -n "TX43|finishFishing|startFishing|joinPark|\.send\(" src/fishing/rx79Capture.ts src/fishing/rx79CaptureRoutes.ts
```

Expected: typecheck/build exit `0`; the source scan returns no match.

- [ ] **Step 7: Commit after explicit commit approval**

```bash
git add avatar-web/server/src/fishing/rx79Capture.ts avatar-web/server/src/fishing/rx79CaptureRoutes.ts avatar-web/server/src/config.ts avatar-web/server/src/index.ts
git commit -m "feat: add passive rx79 capture tap"
```

### Task 3: Add Dataset-Version v2 and Sealed Membership Guards

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/dataset_version.py:55-184`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/dataset.py:54-130`

**Interfaces:**
- Consumes: schema-v1 `DatasetVersion`, parent split files, cycle `allocation.json`, `sealed-final.txt`, durable final lock.
- Produces: `DatasetVersionV2`, `Lineage`, `SplitCommitment`, `load_working_membership()`, `load_final_membership_after_lock()`, and explicit cycle train/dev episode loading.

- [x] **Step 1: Re-run impact and stop on HIGH/CRITICAL results**

Run:

```bash
node .gitnexus/run.cjs impact "parse_dataset_version" --direction upstream --repo .
node .gitnexus/run.cjs impact "compute_train_normalization" --direction upstream --repo .
node .gitnexus/run.cjs impact "_validate_split_inputs" --direction upstream --repo .
```

Expected: `parse_dataset_version` was LOW/9 and `compute_train_normalization` LOW/10 at planning time. If `_validate_split_inputs` is UNKNOWN, inspect every textual caller before editing it.

- [x] **Step 2: Preserve schema v1 and add strict schema v2**

Represent the loaded document as a tagged union:

```python
DatasetVersionDocument = DatasetVersionV1 | DatasetVersionV2

@dataclass(frozen=True, slots=True)
class DatasetVersionV2:
    schema_version: Literal[2]
    dataset_id: str
    parent_dataset_id: str
    created_at: str
    source_commitment: SourceCommitment
    lineage: Lineage
    splits: Mapping[str, SplitCommitment]
```

Dispatch solely on integer `schemaVersion`. Schema v1 retains the exact historical key set and `sourceBatches`; schema v2 requires exactly `datasetId`, `parentDatasetId`, `createdAt`, `sourceCommitment`, `lineage`, and `splits`, with no `sourceBatches` key.

- [x] **Step 3: Enforce the working/final boundary**

Add:

```python
def load_working_membership(cycle_root: Path) -> WorkingMembership:
    # Parses allocation.json, train.txt, and dev.txt only.

def verify_prefinal_integrity(cycle_root: Path) -> PrefinalIntegrity:
    # Uses lstat/stat, regular-file containment, size, count commitment, and sha256.
    # Does not open sealed-final.txt as text.

def load_final_membership_after_lock(cycle_root: Path, lock_path: Path) -> tuple[str, ...]:
    # Requires a regular durable lock, then parses sealed-final.txt exactly once.
```

The pre-final verifier may open `sealed-final.txt` as bytes only for SHA-256 and byte-count calculation. It must not decode, split lines, print, log, or return final IDs.

- [x] **Step 4: Route cycle train/dev loaders through explicit IDs**

Add keyword-only `membership: WorkingMembership | None = None` to train/dev dataset functions. The cycle path validates and loads only `membership.train_ids` or `membership.dev_ids`; the legacy path retains existing split validation. No cycle working function may call `validate_splits()` because that helper traverses final.

- [x] **Step 5: Verify v1 round-trip and opaque-final behavior**

Run:

```bash
cd avatar-web/fishing-ml
.venv/bin/python -m fishing_ml.dataset_version verify data/phase2/dataset-version.json
.venv/bin/python -m compileall -q src/fishing_ml/dataset_version.py src/fishing_ml/dataset.py src/fishing_ml/phase2_cycle.py
```

Expected: historical v1 verification exits `0`; compile exits `0`; no new cycle final file is parsed.

- [ ] **Step 6: Commit after explicit commit approval**

```bash
git add avatar-web/fishing-ml/src/fishing_ml/dataset_version.py avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py avatar-web/fishing-ml/src/fishing_ml/dataset.py
git commit -m "feat: add sealed phase2 dataset version"
```

### Task 4: Implement Duplicate Screening, Eligibility, and Exact Allocation

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py`

**Interfaces:**
- Consumes: sealed capture inventory, complete reviewer labels, parent train/dev/final memberships, parent/acquired manifests and images through the leakage-only detector, approved manual-ruling document.
- Produces: detector identity, duplicate groups, `acquisition.json`, public `allocation.json`, `train.txt`, `dev.txt`, opaque `sealed-final.txt`, schema-v2 `dataset-version.json`, `evidence/prefinal-integrity.json`.

- [x] **Step 1: Implement the exact detector identity**

Canonical descriptor:

```python
DETECTOR_DESCRIPTOR = {
    "algorithm": "difference-hash",
    "algorithmVersion": 1,
    "decode": "Pillow RGB",
    "inputSize": [75, 75],
    "grayscale": "Pillow L",
    "resize": [9, 8],
    "hashBits": 64,
    "hammingThreshold": 4,
    "grouping": "transitive-closure",
}
```

`detectorSha256` is SHA-256 of compact sorted-key UTF-8 JSON plus one trailing newline. dHash compares adjacent pixels in each of eight rows; union-find produces transitive groups. Exact-byte SHA edges and dHash edges feed the same union-find.

- [x] **Step 2: Parse manual rulings fail-closed**

Use exact records:

```json
{
  "schemaVersion": 1,
  "cycleId": "p2cr-20260905-01",
  "detectorSha256": "lowercase sha256",
  "groups": [
    {
      "groupId": "lowercase sha256",
      "decision": "reject-acquired",
      "approvedBy": "hieunt",
      "approvedAt": "UTC ISO-8601",
      "evidence": "explicit user approval text"
    }
  ]
}
```

Allowed decisions are only `reject-acquired` and `allow-same-role`. A group touching parent or quarantine is always rejected and cannot be overridden. Missing adjudication for any acquired-only multi-image group raises `StageBlockedError`.

- [x] **Step 3: Publish exactly 90 eligible acquisitions**

Eligibility is one pass over the sealed inventory sorted by `(captureTimestamp, batchId)`. Each record must have a canonical manifest, valid 75×75 image files and SHA-256 values, complete label, policy digest match, and no parent/quarantine ID/SHA/group overlap. Invalid records add one aggregate rejection reason; incomplete or unadjudicated records block the stage rather than being skipped. Publish only when the first 90 eligible records have been established; fewer than 90 returns terminal `NO_DATASET`.

- [x] **Step 4: Solve exact grouped allocation deterministically**

Sort groups by:

```python
(hashlib.sha256(f"20260905|{group_id}".encode()).hexdigest(), group_id)
```

Use memoized depth-first search over role order `train`, `dev`, `final`, rejecting any branch above `45/15/30`. Return the first complete vector, which is the lexicographically smallest valid role vector on the sorted groups. If no exact vector exists, publish terminal `NO_DATASET`; never split a group or change the seed.

- [x] **Step 5: Publish public and sealed allocation artifacts**

Construct `train.txt` as the exact sorted union of 140 parent-train and 45 acquired-train IDs; construct `dev.txt` as the exact sorted union of 30 parent-dev and 15 acquired-dev IDs; construct `sealed-final.txt` from exactly 30 acquired-final IDs and zero parent-final IDs. `allocation.json` exposes sorted acquired train/dev IDs and final `{count, sha256, sizeBytes}` only. It includes exact role counts, acquisition/quarantine digests, detector descriptor/digest, seed, split digests, and source commitment. Write `sealed-final.txt` with mode `0600`, fsync it and the parent, then publish the public allocation and schema-v2 dataset version no-replace.

- [ ] **Step 6: Verify deterministic reconstruction without exposing final IDs**

Run:

```bash
cd avatar-web/fishing-ml
.venv/bin/python -m fishing_ml.phase2_cycle verify \
  --cycle-root data/phase2/cycles/phase2-coverage-recovery-20260905-01 \
  --mode working
.venv/bin/python -m fishing_ml.phase2_cycle verify \
  --cycle-root data/phase2/cycles/phase2-coverage-recovery-20260905-01 \
  --mode prefinal
```

Expected after operational publication: aggregate output reports `train=185`, `dev=45`, `finalCommitment=30`, `sourceCommitment=260`, zero overlap, and no final batch ID.

- [ ] **Step 7: Commit after explicit commit approval**

```bash
git add avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py
git commit -m "feat: add deterministic recovery allocation"
```

### Task 5: Extend Strict Training Config and Train-Only Augmentation

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/config.py:1-210`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/phase2_training.py:34-100`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/train.py:246-360`

**Interfaces:**
- Consumes: `WorkingMembership`, exact experiment effective config, stable seed context.
- Produces: strict training config schema v3, four exact cycle profiles, ratio `0.50`, cycle-provenance training artifacts.

- [x] **Step 1: Re-run impacts and obtain approval before HIGH config edit**

Run:

```bash
node .gitnexus/run.cjs impact "_parse_config_document" --direction upstream --repo .
node .gitnexus/run.cjs impact "apply_augmentation_profile" --direction upstream --repo .
node .gitnexus/run.cjs impact "run_training" --direction upstream --repo .
```

Expected: `_parse_config_document` was HIGH/20 at planning time. Present its direct callers and four affected flows, then wait for explicit authorization before editing `config.py`.

- [x] **Step 2: Add schema v3 without changing v1/v2 acceptance**

Schema v3 accepts exactly:

```python
ALLOWED_CYCLE_AUGMENTATION_PROFILES = frozenset({
    "photometric_mild",
    "photometric_plus_geom_mild",
    "photometric_plus_geom_standard",
    "photometric_plus_geom_strong",
})
ALLOWED_CYCLE_HARD_NEGATIVE_RATIOS = frozenset({0.0, 0.25, 0.50})
```

Schema v1 and schema v2 key sets and tokens remain unchanged. Schema v3 requires the same explicit augmentation/hard-negative keys as v2 and rejects `none`, legacy tokens, unknown values, non-CPU device, or workers other than `0` on the cycle path.

- [x] **Step 3: Implement exact profile parameters**

Use an immutable profile table:

```python
PROFILE_PARAMETERS = {
    "photometric_mild": (0.04, 0.02, 0, 1.00, 1.00),
    "photometric_plus_geom_mild": (0.04, 0.02, 1, 0.98, 1.02),
    "photometric_plus_geom_standard": (0.08, 0.04, 3, 0.95, 1.05),
    "photometric_plus_geom_strong": (0.12, 0.06, 4, 0.92, 1.08),
}
```

Preserve transform-domain separation and apply transforms only to raw training tensors before normalization. Dev/final paths never call augmentation.

- [x] **Step 4: Make cycle training consume only working membership**

Add keyword-only cycle provenance to `run_training()`:

```python
def run_training(
    config_path: Path,
    raw_root: Path,
    labels_root: Path,
    splits_root: Path,
    duplicate_reviews: Path,
    artifacts_root: Path,
    run_id: str,
    *,
    working_membership: WorkingMembership | None = None,
    experiment_manifest_sha256: str | None = None,
) -> Path:
```

When `working_membership` is present, compute normalization and episodes from exact train/dev IDs, refuse every ID outside those tuples before opening payloads, and record dataset/source/split/experiment digests in `environment.json`. Legacy callers with `None` retain historical behavior.

- [x] **Step 5: Verify old configs and new finite tokens**

Run:

```bash
cd avatar-web/fishing-ml
.venv/bin/python -m compileall -q src/fishing_ml/config.py src/fishing_ml/phase2_training.py src/fishing_ml/train.py
.venv/bin/python - <<'PY'
from fishing_ml.phase2_training import PROFILE_PARAMETERS
assert tuple(PROFILE_PARAMETERS) == (
    "photometric_mild",
    "photometric_plus_geom_mild",
    "photometric_plus_geom_standard",
    "photometric_plus_geom_strong",
)
assert PROFILE_PARAMETERS["photometric_plus_geom_standard"] == (0.08, 0.04, 3, 0.95, 1.05)
PY
```

Expected: exit `0`; standard profile remains numerically identical to the existing standard transform.

- [ ] **Step 6: Commit after explicit commit approval**

```bash
git add avatar-web/fishing-ml/src/fishing_ml/config.py avatar-web/fishing-ml/src/fishing_ml/phase2_training.py avatar-web/fishing-ml/src/fishing_ml/train.py
git commit -m "feat: add finite recovery training profiles"
```

### Task 6: Add Dual Zero-Wrong Calibration Records

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/calibrate.py:89-155`
- Create: `avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py`
- Modify: `avatar-web/fishing-ml/pyproject.toml:21-39`

**Interfaces:**
- Consumes: one training run's dev predictions, inherited-dev IDs, acquired-dev IDs, immutable experiment manifest.
- Produces: exactly two no-replace calibrated candidate records per model training identity.

- [x] **Step 1: Re-run calibration impact**

Run:

```bash
node .gitnexus/run.cjs impact "calibrate_thresholds" --direction upstream --repo .
node .gitnexus/run.cjs impact "calibrate_run" --direction upstream --repo .
```

Expected: record all callers. Preserve legacy `calibrate_run()` and its CLI for historical compatibility; the recovery CLI never exposes `--allow-wrong-accepted`.

- [x] **Step 2: Add partition-robust calibration**

Add:

```python
def calibrate_partition_robust_zero_wrong(
    predictions: Sequence[Prediction],
    inherited_dev_ids: AbstractSet[str],
    acquired_dev_ids: AbstractSet[str],
) -> CalibrationResult:
```

Calibrate each partition with `require_zero_wrong_accepted=True` and `allow_full_abstention=False`; combine with componentwise maximum `minSimilarity` and `minMargin`; evaluate the combined threshold across all 45 dev batches. Reject missing batches, overlap, empty partition, non-empty wrong acceptance, or empty total acceptance.

- [x] **Step 3: Define immutable model and candidate identities**

In `coverage_recovery.py`, define 24 model identities from `(augmentation, hardNegativeRatio, embeddingDim)` and two candidate identities by appending calibration policy. IDs must use only safe ASCII components plus the first 16 hex characters of SHA-256 over compact canonical effective config. Candidate records live under:

```text
artifacts/cycles/p2cr-20260905-01/candidates/${candidateId}/candidate.json
```

Each record includes model run ID, calibration policy, thresholds, all-dev metrics, acquired-dev wrong-accepted count, prediction digest, checkpoint digest, effective-config digest, dataset/experiment digests, and Git revision.

- [x] **Step 4: Register the orchestration command**

Add:

```toml
fishing-phase2-coverage-recovery = "fishing_ml.coverage_recovery:main"
```

- [x] **Step 5: Verify the policy cross-product**

Run:

```bash
cd avatar-web/fishing-ml
.venv/bin/python -m compileall -q src/fishing_ml/calibrate.py src/fishing_ml/coverage_recovery.py
.venv/bin/python - <<'PY'
from fishing_ml.coverage_recovery import enumerate_model_specs, enumerate_candidate_specs
models = enumerate_model_specs()
candidates = enumerate_candidate_specs(models)
assert len(models) == len({item.run_id for item in models}) == 24
assert len(candidates) == len({item.candidate_id for item in candidates}) == 48
assert {item.calibration_policy for item in candidates} == {
    "joint_zero_wrong", "partition_robust_zero_wrong"
}
PY
```

Expected: exit `0`; exactly 24/48 unique identities.

- [ ] **Step 6: Commit after explicit commit approval**

```bash
git add avatar-web/fishing-ml/src/fishing_ml/calibrate.py avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py avatar-web/fishing-ml/pyproject.toml
git commit -m "feat: add recovery calibration policies"
```

### Task 7: Freeze the Experiment Manifest and Dev Promotion Selection

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py`

**Interfaces:**
- Consumes: verified working dataset v2, 24 model specs, 48 candidate specs, schema-v3 training config, calibrated candidate records.
- Produces: no-replace experiment manifest, 24 immutable run directories, 48 immutable candidate records, one no-replace selection or terminal `NO_CANDIDATE`.

- [x] **Step 1: Define the exact experiment manifest**

Publish only to:

```text
avatar-web/fishing-ml/artifacts/cycles/p2cr-20260905-01/experiment/experiment-manifest.json
```

The document contains exact cycle/experiment/dataset identities, dataset-version SHA, Git revision, `cpu`, seed `20260827`, ordered 24 model configs, ordered 48 candidate identities, both calibration policies, dev gate, latency tie-break contract, and execution order. Reject any CLI option that supplies a candidate, threshold, augmentation, embedding, seed, device, or gate value after publication.

- [x] **Step 2: Run or truthfully adjudicate each immutable model run**

Expose commands:

```text
publish-experiment
run-model --run-id EXACT_ID
adjudicate-interrupted --run-id EXACT_ID --decision reject|reset
calibrate-model --run-id EXACT_ID
compare
```

`run-model` resolves the exact config solely from the manifest. A complete reusable run must match manifest, dataset, train/dev, Git provenance, runtime identity, config, checkpoint, predictions, and calibration checksums. Any reset requires a separate approval before dev evidence is consumed.

- [x] **Step 3: Apply the exact dev promotion gate**

A candidate passes only when:

```python
passes = (
    metrics.wrong_accepted_count == 0
    and metrics.accepted_rate >= 0.65
    and metrics.top1_accuracy >= 0.99
    and metrics.batch_exact_match >= 0.95
    and acquired_dev_wrong_accepted_count == 0
)
```

Require complete labels and exact reconciliation `accepted + abstained == queryCount`. Missing/ambiguous/incomplete evidence is BLOCKED, not an abstention and not a quality FAIL.

- [x] **Step 4: Benchmark latency only for quality ties**

Set `torch.set_num_threads(1)` before timing. Run 10 warm-ups and 100 timed matcher-only calls over deterministic repeated dev order. Compute p95 as nearest-rank index `ceil(0.95 * n) - 1`, then bucket with `math.ceil(milliseconds)` to integer 1-ms buckets. Do not benchmark candidates that differ on any of the first three quality metrics.

- [x] **Step 5: Publish deterministic selection or terminal state**

Rank passing candidates by accepted rate descending, top-1 descending, batch exact match descending, latency bucket ascending, candidate ID byte ascending. Publish `selection/selection.json` no-replace with all evidence digests. If all 48 are complete/adjudicated and none passes, publish sanitized terminal `NO_CANDIDATE` and do not create a frozen directory.

- [x] **Step 6: Verify manifest and selection invariants**

Run:

```bash
cd avatar-web/fishing-ml
.venv/bin/python -m fishing_ml.coverage_recovery verify-experiment \
  --cycle-root data/phase2/cycles/phase2-coverage-recovery-20260905-01 \
  --artifacts-root artifacts/cycles/p2cr-20260905-01
```

Expected after publication: aggregate output reports exact `24 model runs`, `48 candidates`, immutable manifest digest, and either one valid selection or one truthful `NO_CANDIDATE` terminal record.

- [ ] **Step 7: Commit after explicit commit approval**

```bash
git add avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py
git commit -m "feat: orchestrate recovery candidate selection"
```

### Task 8: Add Cycle Freeze Without Weakening Historical Freeze

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/artifacts.py:33-202`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/evaluate.py:21-62`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/inference_service.py:241-292`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py`

**Interfaces:**
- Consumes: one immutable selection, selected candidate record, selected training run, working dataset, opaque final commitment.
- Produces: schema-v2 freeze bundle and `verify_frozen_bundle()` dispatcher; legacy `verify_freeze()` remains unchanged.

- [x] **Step 1: Re-run impacts and warn before freeze work**

Run:

```bash
node .gitnexus/run.cjs impact "verify_freeze" --direction upstream --repo .
node .gitnexus/run.cjs impact "_inputs" --direction upstream --repo .
node .gitnexus/run.cjs impact "load_frozen_matcher" --direction upstream --repo .
```

Expected: `verify_freeze` was CRITICAL/19 with nine direct callers and five affected processes. Present that risk and receive explicit authorization. Do not edit the body of `verify_freeze()` or `_manifest()` for schema v1.

- [x] **Step 2: Add a separate schema-v2 cycle freeze record**

Add `CycleFreezeManifest` with exact fields:

```python
@dataclass(frozen=True, slots=True)
class CycleFreezeManifest:
    schema_version: Literal[2]
    cycle_id: str
    experiment_id: str
    dataset_id: str
    run_id: str
    candidate_id: str
    git_revision: str
    experiment_manifest_sha256: str
    selection_sha256: str
    candidate_sha256: str
    calibration_sha256: str
    dataset_version_sha256: str
    files: dict[str, str]
```

`freeze_cycle_run()` copies the same six model files as historical freeze, writes schema-v2 `dataset-snapshot.json` containing train/dev batch evidence plus opaque final commitment, writes schema-v2 `split-checksums.json`, writes schema-v2 `freeze-manifest.json`, verifies staging, then publishes the entire `frozen/` directory no-replace.

- [x] **Step 3: Add an explicit dispatcher**

```python
def verify_frozen_bundle(frozen_dir: Path) -> FreezeManifest | CycleFreezeManifest:
    document = read_json(Path(frozen_dir) / "freeze-manifest.json")
    if document.get("schemaVersion") == 1:
        return verify_freeze(frozen_dir)
    if document.get("schemaVersion") == 2:
        return verify_cycle_freeze(frozen_dir)
    raise ValueError("unsupported freeze manifest schemaVersion")
```

Change new/active consumers to call `verify_frozen_bundle()`. Historical schema-v1 directories still enter `verify_freeze()` and retain their exact inventory/snapshot rules.

- [x] **Step 4: Verify no terminal artifacts exist at freeze time**

Reject any lock/report under `final/`, `replay/`, or `local-shadow/` before freeze publication. The frozen bundle must reconcile cycle/experiment/dataset/run/candidate identities, all manifest digests, Git revision compatibility, exact regular-file inventory, and checkpoint SHA.

- [x] **Step 5: Verify both historical and cycle dispatch**

Run:

```bash
cd avatar-web/fishing-ml
.venv/bin/python - <<'PY'
from pathlib import Path
from fishing_ml.artifacts import verify_frozen_bundle
old = Path("artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen")
manifest = verify_frozen_bundle(old)
assert manifest.schema_version == 1
print(manifest.run_id)
PY
.venv/bin/python -m compileall -q src/fishing_ml/artifacts.py src/fishing_ml/evaluate.py src/fishing_ml/inference_service.py src/fishing_ml/coverage_recovery.py
```

Expected: old frozen candidate still verifies and reports its historical run ID; compilation exits `0`.

- [ ] **Step 6: Commit after explicit commit approval**

```bash
git add avatar-web/fishing-ml/src/fishing_ml/artifacts.py avatar-web/fishing-ml/src/fishing_ml/evaluate.py avatar-web/fishing-ml/src/fishing_ml/inference_service.py avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py
git commit -m "feat: add cycle-scoped freeze verification"
```

### Task 9: Add Cycle Gate Policy and One-Shot Final Evaluator

**Files:**
- Create: `avatar-web/fishing-ml/config/phase2/coverage-recovery-gate.yaml`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py:255-694`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/evaluate.py:117-192`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py`

**Interfaces:**
- Consumes: verified cycle freeze, opaque final commitment, approved cycle gate, fresh exact runtime authorization.
- Produces: durable final lock, one final report, one final gate report, exit/status mapping.

- [x] **Step 1: Re-run gate/evaluator impacts**

Run:

```bash
node .gitnexus/run.cjs impact "load_gate_policy" --direction upstream --repo .
node .gitnexus/run.cjs impact "evaluate_final_once" --direction upstream --repo .
node .gitnexus/run.cjs impact "adjudicate_final" --direction upstream --repo .
```

Expected: record callers/processes and preserve historical final behavior.

- [x] **Step 2: Add strict cycle gate schema v2**

Create the schema-v2 gate from this exact mapping, where `plan_approval_utc` is copied from the explicit Plan-approval event and validated as UTC ISO-8601 before the file is written:

```python
policy_document = {
    "schemaVersion": 2,
    "cycle": {
        "cycleId": "p2cr-20260905-01",
        "experimentId": "p2cr-20260905-01",
        "datasetId": "phase2-coverage-recovery-20260905-01",
    },
    "meta": {
        "preAgreedPlaceholders": False,
        "revisitAt": "never-from-final",
        "notTunedOnPhaseAFinal": True,
        "approvedAt": plan_approval_utc,
        "approvedBy": "hieunt",
        "evidence": "2026-09-05 approved Fishing Phase 2 Coverage Recovery Cycle design and implementation plan",
    },
    "coverage": {
        "minAcceptedRate": 0.60,
        "minBatchExactMatch": 0.90,
        "minTop1Accuracy": 0.98,
    },
    "latency": {"budgetMs": 50, "p95Ms": 100, "maxMs": 250},
    "errorBudget": {
        "maxErroredBatchRate": 0.01,
        "maxOmittedRate": 0.0,
        "requireSingleModelIdentity": True,
    },
    "gate": {"requireZeroWrongAccepted": True},
}
```

Write `policy_document` using the actual Plan-approval timestamp before committing this tracked policy. Do not derive any field from final data. Parser v1 remains unchanged; parser v2 requires the exact `cycle` section and otherwise identical numeric/safety thresholds.

- [x] **Step 3: Materialize a pre-final command record without final access**

`final-preflight` verifies identities, frozen inventory, policy approval, opaque final commitment, exact absence of `final-evaluation.lock`, `final-evaluation.json`, and `gate-final.json`, then publishes a sanitized command record containing absolute executable/arguments/output paths, Git status/digest evidence, and no final IDs. It prints the exact one-process command and stops for fresh user authorization.

- [x] **Step 4: Add a cycle-specific evaluator with lock-first ordering**

Add:

```python
def evaluate_cycle_final_once(
    frozen_dir: Path,
    cycle_root: Path,
    final_output_dir: Path,
    authorization: str,
    expected_authorization: str,
) -> dict[str, object]:
```

Required order: verify pre-lock provenance and output absence; load model/config without final access; compare exact authorization; exclusively create and fsync `final-evaluation.lock` and parent; call `load_final_membership_after_lock()`; semantic-validate only the 30 final IDs; evaluate exactly once; publish report no-replace; adjudicate cycle gate; publish gate no-replace. No exception handler removes the lock.

- [x] **Step 5: Preserve exact terminal mapping**

Return process exit `0` for final gate PASS, `3` for valid gate FAIL, `2` for invalid input/provenance/publication, and `4` for policy/prerequisite block. A signal or unknown status is recorded as `FINAL_BLOCKED` with uncertain evidence. Every non-PASS branch stops before replay.

- [x] **Step 6: Verify static lock-before-access ordering**

Run:

```bash
cd avatar-web/fishing-ml
.venv/bin/python -m compileall -q src/fishing_ml/evaluate.py src/fishing_ml/phase2_gate.py src/fishing_ml/coverage_recovery.py
rg -n "_create_final_lock|load_final_membership_after_lock|evaluate_cycle_final_once" src/fishing_ml/evaluate.py
```

Expected: source order shows lock creation before final membership loading; compilation exits `0`.

- [ ] **Step 7: Commit after explicit commit approval**

```bash
git add avatar-web/fishing-ml/config/phase2/coverage-recovery-gate.yaml avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py avatar-web/fishing-ml/src/fishing_ml/evaluate.py avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py
git commit -m "feat: add one-shot recovery final gate"
```

### Task 10: Replay the Explicit Successor Corpus

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/replay.py:722-975`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py:407-694`

**Interfaces:**
- Consumes: final PASS evidence, verified cycle freeze, exact ordered 260-ID successor membership, loopback inference service.
- Produces: immutable replay report/gate and truthful `REPLAY_FAIL` or `REPLAY_BLOCKED` terminal records.

- [x] **Step 1: Re-run replay impact**

Run:

```bash
node .gitnexus/run.cjs impact "replay_batches" --direction upstream --repo .
node .gitnexus/run.cjs impact "adjudicate_replay" --direction upstream --repo .
```

Expected: record callers; preserve legacy directory-listing behavior only for legacy callers.

- [x] **Step 2: Add explicit membership to replay**

Extend the function keyword-only:

```python
def replay_batches(
    batches_root: Path,
    client: InferenceClient,
    labels_root: Path | None = None,
    *,
    model_checksums: tuple[str, ...] | None = None,
    batch_ids: tuple[str, ...] | None = None,
) -> ReplayReport:
```

When `batch_ids` is present, require 260 sorted unique safe IDs and iterate exactly those IDs; never call `os.listdir()` to infer successor membership. The cycle orchestrator forms this tuple only after final PASS from 185 train + 45 dev + 30 new final and rejects every quarantined parent-final ID.

- [x] **Step 3: Add loopback service lifecycle enforcement**

`replay-preflight` verifies PASS evidence, output absence, freeze/model/checkpoint identity, and a free approved port. `replay-run` starts exactly one service bound to `127.0.0.1`, captures PID and sanitized logs, checks readiness/model identity, runs explicit membership replay, publishes report/gate no-replace, sends termination to that PID, waits, and verifies the port is closed in a `finally` block.

- [x] **Step 4: Preserve replay quality and blocker distinctions**

Valid mandatory quality failures produce `REPLAY_FAIL`; service startup, identity, schema, completeness, timeout, HTTP, publication, or shutdown uncertainty produces `REPLAY_BLOCKED`. Neither creates local-shadow output.

- [x] **Step 5: Verify replay command shape**

Run:

```bash
cd avatar-web/fishing-ml
.venv/bin/python -m compileall -q src/fishing_ml/replay.py src/fishing_ml/coverage_recovery.py src/fishing_ml/phase2_gate.py
.venv/bin/python -m fishing_ml.coverage_recovery replay-preflight \
  --cycle-root data/phase2/cycles/phase2-coverage-recovery-20260905-01 \
  --artifacts-root artifacts/cycles/p2cr-20260905-01 \
  --port 18080
```

Expected before a final PASS: exit `4` with sanitized `REPLAY_BLOCKED` prerequisite output and no service process.

- [ ] **Step 6: Commit after explicit commit approval**

```bash
git add avatar-web/fishing-ml/src/fishing_ml/replay.py avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py
git commit -m "feat: replay explicit recovery membership"
```

### Task 11: Add Deterministic Six-Case Local Shadow Gate

**Files:**
- Create: `avatar-web/server/src/fishing/localShadowCycle.ts`
- Create: `avatar-web/server/src/tools/fishing-local-shadow-cycle.ts`
- Modify: `avatar-web/server/package.json:4-16`

**Interfaces:**
- Consumes: replay PASS evidence, approved local fixture/capture, one `InferenceClient`, one loopback fixture server.
- Produces: six case results, continuation count, request count, sanitized no-replace aggregate report, terminal shadow state.

- [x] **Step 1: Re-run shadow/client impact**

Run:

```bash
node .gitnexus/run.cjs impact "runShadowMatch" --direction upstream --repo .
node .gitnexus/run.cjs impact "InferenceClient" --direction upstream --repo .
```

Expected: `runShadowMatch` was LOW/4 at planning time. The new gate may use `InferenceClient` directly; it must not edit gameplay call sites or enable production shadow.

- [x] **Step 2: Implement one controller and process-local kill switch**

Expose:

```typescript
export class LocalShadowCycleController {
  constructor(client: InferenceClient);
  kill(): void;
  runCase(name: LocalShadowCase, payload: CanCauPayload, continuation: () => void): Promise<LocalShadowCaseResult>;
}
```

`runCase()` always invokes `continuation()` exactly once in `finally`. `kill()` flips controller-local state; every later call returns `disabled` before invoking `client.match()`.

- [x] **Step 3: Exercise exactly six deterministic cases**

Use one fixture server/port and one client/controller in this order: `success`, `timeout`, `unavailable` via deliberate socket close, `malformed_response`, `wrong_model_identity`, `post_kill_switch_disabled_before_http`. The fixture server counts HTTP requests; the final case must not increment the counter.

- [x] **Step 4: Publish a sanitized aggregate report**

Report exact keys:

```json
{
  "schemaVersion": 1,
  "cycleId": "p2cr-20260905-01",
  "replayGateSha256": "lowercase sha256",
  "fixtureSha256": "lowercase sha256",
  "caseCount": 6,
  "continuationCount": 6,
  "httpRequestCount": 5,
  "gameplaySideEffectCount": 0,
  "cases": [
    {"name": "success", "status": "ok"}
  ],
  "status": "PASS"
}
```

Each case entry contains only name, status, and approved error code. Never persist request bodies, PNG/base64, predictions, model response arrays, account/user IDs, packet bytes, cookies, or credentials.

- [x] **Step 5: Register and verify the tool**

Add:

```json
"fishing:local-shadow-cycle": "tsx src/tools/fishing-local-shadow-cycle.ts"
```

Run:

```bash
cd avatar-web/server
npm run typecheck
npm run build
rg -n "TX43|finishFishing|joinPark|startFishing|\.send\(" src/fishing/localShadowCycle.ts src/tools/fishing-local-shadow-cycle.ts
```

Expected: typecheck/build exit `0`; forbidden-call scan returns no match.

- [ ] **Step 6: Commit after explicit commit approval**

```bash
git add avatar-web/server/src/fishing/localShadowCycle.ts avatar-web/server/src/tools/fishing-local-shadow-cycle.ts avatar-web/server/package.json
git commit -m "feat: add local shadow safety gate"
```

### Task 12: Verify Production Code Before Operational Data Work

**Files:**
- Create: `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md`
- Modify: all production files from Tasks 1-11 only when verification exposes an in-scope defect.

**Interfaces:**
- Consumes: completed production implementation and existing test suites.
- Produces: fresh verification evidence and a sanitized implementation checkpoint.

- [x] **Step 1: Run focused existing Python suites without adding tests**

Run:

```bash
cd avatar-web/fishing-ml
.venv/bin/python -m unittest \
  tests.test_phase2_training \
  tests.test_phase2_experiments \
  tests.test_phase2_gate \
  tests.test_phase2_recovery \
  tests.test_inference_size_contract -v
```

Expected: exit `0`; record the exact discovered/passed count from the command output. If new behavior lacks adequate verification, stop and request explicit permission before creating or modifying any test file.

- [x] **Step 2: Run full Python verification**

```bash
cd avatar-web/fishing-ml
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python -m compileall -q src tests
.venv/bin/python -m pip check
```

Expected: all commands exit `0`; record exact test count and package-check output.

- [x] **Step 3: Run full server verification**

```bash
cd avatar-web/server
npm test
npm run typecheck
npm run build
```

Expected: all commands exit `0`; record exact test count.

- [x] **Step 4: Reverify historical hashes and inspect diff**

Run the exact `shasum -a 256` list in Global Constraints, then:

```bash
git diff --check
git status --short
git diff -- avatar-web/fishing-ml/src avatar-web/fishing-ml/config avatar-web/fishing-ml/pyproject.toml avatar-web/server/src avatar-web/server/package.json docs/superpowers
```

Expected: all historical hashes unchanged; no generated dataset/checkpoint/operational artifact staged; no whitespace error.

- [x] **Step 5: Run privacy and forbidden-action scans**

```bash
rg -n -i "cookie|authorization:|password|credential|idUser|raw packet|base64|predictions" \
  docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md \
  avatar-web/fishing-ml/artifacts/cycles/p2cr-20260905-01 2>/dev/null || true
rg -n "TX43|finishFishing\(|startFishing\(|joinPark\(" \
  avatar-web/server/src/fishing/rx79Capture.ts \
  avatar-web/server/src/fishing/localShadowCycle.ts \
  avatar-web/server/src/tools/fishing-local-shadow-cycle.ts
```

Expected: privacy matches are only explicit redaction policy text in tracked docs; forbidden-action scan returns no source match.

- [x] **Step 6: Run GitNexus change detection**

```bash
node .gitnexus/run.cjs detect-changes --scope all --repo .
```

Expected: result is neither partial nor truncated. Record changed symbols, affected processes, and risk. Resolve only defects within this Plan.

- [ ] **Step 7: Commit the implementation checkpoint after explicit approval**

```bash
git add docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md
git commit -m "docs: record recovery implementation verification"
```

### Task 13: Publish Policy, Quarantine, Capture, and Label Intake

**Files:**
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/acquisition-policy.json`
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/quarantine.json`
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/evidence/capture-inventory.json`
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/evidence/manual-duplicate-rulings.json` only when acquired-only duplicate groups require rulings.
- Modify: `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md`

**Interfaces:**
- Consumes: approved production implementation, already-connected server session, manual reviewer labels.
- Produces: immutable acquisition policy, exact 30-ID quarantine, sealed capture inventory, completed labels, explicit duplicate rulings.

- [x] **Step 1: Reverify historical hashes and print the exact policy command**

Run hash verification first, then materialize:

```bash
cd avatar-web/fishing-ml
.venv/bin/fishing-phase2-cycle publish-policy \
  --output data/phase2/cycles/phase2-coverage-recovery-20260905-01/acquisition-policy.json
```

Stop and request approval for this exact command. Do not start capture before it exits `0` and its SHA-256 is recorded.

- [x] **Step 2: Publish quarantine from immutable metadata only**

```bash
cd avatar-web/fishing-ml
.venv/bin/fishing-phase2-cycle publish-quarantine \
  --parent-version data/phase2/dataset-version.json \
  --parent-final data/phase2/splits/final.txt \
  --output data/phase2/cycles/phase2-coverage-recovery-20260905-01/quarantine.json
```

Expected: exactly 30 sorted safe IDs and the exact parent version/final digests; no raw/label/final-report access.

- [ ] **Step 3: Select one already-online account and display exact capture command**

Query authenticated account/session status, let the user select the exact account ID and confirm its current map/area, then display the full `curl` start command with those concrete numeric values. Start is rejected unless the session already has `rawClient.status === 'online'`. Stop for explicit capture-start approval.

- [ ] **Step 4: Capture passively, then stop and seal inventory**

During capture, only RX79 saves may occur. Periodically read the status endpoint; do not trigger login, join, cast, fishing, or answer submission. On user stop, display and execute the exact stop endpoint once; record sealed inventory path, count, digest, and rejection-free write count.

- [ ] **Step 5: Label only after inventory sealing**

Use the existing manual label command on captured batch directories. Do not run model inference or inspect model predictions. When the reviewer stops, verify every candidate label state; any unlabeled/unadjudicated chronological record blocks eligibility.

- [ ] **Step 6: Gate every manual near-duplicate decision**

Generate the exact group digest/checksum summary without image bytes or final membership. For each acquired-only group requiring a ruling, request explicit `reject-acquired` or `allow-same-role`, publish the signed ruling document no-replace, and re-run duplicate validation. Parent/quarantine-touching groups are auto-rejected without an override prompt.

- [x] **Step 7: Record a truthful acquisition checkpoint**

Record aggregate captured/labeled/valid/rejected/blocked counts and file hashes. If fewer than 90 chronological eligible batches remain, publish terminal `NO_DATASET` and stop the Plan.

### Task 14: Publish Acquisition, Allocation, and Dataset v2

**Files:**
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/acquisition.json`
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/allocation.json`
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/dataset-version.json`
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/splits/train.txt`
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/splits/dev.txt`
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/splits/sealed-final.txt`
- Generate: `avatar-web/fishing-ml/data/phase2/cycles/phase2-coverage-recovery-20260905-01/evidence/prefinal-integrity.json`
- Modify: `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md`

**Interfaces:**
- Consumes: policy/quarantine/inventory/rulings/labels and exact first 90 eligible batches.
- Produces: immutable 90-batch acquisition, grouped 45/15/30 allocation, successor 185/45/30 dataset v2.

- [ ] **Step 1: Publish the exact 90-batch acquisition manifest**

Materialize and display the exact `publish-acquisition` command with all absolute roots and evidence paths. Stop for approval. Expected success output contains only count `90`, rejection aggregates, policy/detector/acquisition digests, and no image/label/model content.

- [ ] **Step 2: Dry-verify exact allocation feasibility**

Run the allocation command in read-only `--check` mode. Expected: exact grouped counts `45/15/30`, one deterministic role vector, and source count `260`. If impossible, publish `NO_DATASET`; do not change seed or split groups.

- [ ] **Step 3: Stop for allocation/dataset publication approval**

Display exact paths, acquisition/quarantine hashes, detector hash, train/dev IDs count, final opaque commitment, split hashes, and schema-v2 source commitment. Do not display final IDs. Execute the no-replace publication only after explicit approval.

- [ ] **Step 4: Run working and pre-final verification**

```bash
cd avatar-web/fishing-ml
.venv/bin/fishing-phase2-cycle verify \
  --cycle-root data/phase2/cycles/phase2-coverage-recovery-20260905-01 \
  --mode working
.venv/bin/fishing-phase2-cycle verify \
  --cycle-root data/phase2/cycles/phase2-coverage-recovery-20260905-01 \
  --mode prefinal
```

Expected: exact `185/45/30`, 260 source commitment, zero parent-final/quarantine overlap, zero duplicate group crossing, and no final ID in output.

- [ ] **Step 5: Record hashes and stop before experiments**

Record all public artifact hashes plus opaque final size/hash. Generated data remains untracked. Do not publish the experiment manifest in this task.

### Task 15: Publish and Execute the Fixed Candidate Matrix

**Files:**
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr-20260905-01/experiment/experiment-manifest.json`
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr-20260905-01/runs/${runId}/` for each of the 24 manifest run IDs.
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr-20260905-01/candidates/${candidateId}/candidate.json` for each of the 48 manifest candidate IDs.
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr-20260905-01/selection/selection.json` or terminal `NO_CANDIDATE`.
- Modify: `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md`

**Interfaces:**
- Consumes: verified working dataset, fixed code revision, exact experiment constants.
- Produces: immutable 24/48 evidence and deterministic dev selection.

- [ ] **Step 1: Materialize and approve the exact experiment manifest**

Run `publish-experiment` in preview mode, record the proposed manifest digest and all 48 IDs, verify no CLI override exists, then stop for explicit approval. Publish once with no replacement.

- [ ] **Step 2: Execute each of 24 model runs in manifest order**

Run one exact manifest-derived command at a time. After each exit, verify complete inventory/checksums or record interrupted/invalid state. Never overwrite. A reset decision is a separate explicit approval and occurs before any dev result from that run is used.

- [ ] **Step 3: Publish two candidate records per completed model**

Run joint and partition-robust calibration from the immutable dev predictions. Verify zero wrong accepted objective, non-empty acceptance, all-dev reconciliation, acquired-dev zero wrong accepted, and exact provenance before publishing each candidate record.

- [ ] **Step 4: Confirm the matrix is complete or adjudicated**

Run `verify-experiment`; require all 24 runs and 48 candidates to be completed or truthfully rejected. Any missing/unresolved candidate blocks comparison.

- [ ] **Step 5: Compare and publish selection**

Run the immutable dev gate and deterministic tie-break. If no candidate passes, publish `NO_CANDIDATE` and stop. Otherwise record selected candidate, metrics, acquired-dev wrong count, latency evidence if used, and all manifest/checkpoint/config/calibration hashes.

### Task 16: Freeze the Selected Candidate

**Files:**
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr-20260905-01/frozen/`
- Modify: `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md`

**Interfaces:**
- Consumes: one immutable selection and selected candidate/run evidence.
- Produces: one independently verified schema-v2 frozen bundle.

- [ ] **Step 1: Materialize freeze inventory and stop for approval**

Display exact selection/candidate/experiment/dataset/checkpoint/calibration digests, proposed frozen inventory, Git revision compatibility, opaque final commitment, and terminal-output absence. Stop for explicit freeze approval.

- [ ] **Step 2: Publish the freeze directory no-replace**

Execute `freeze-selected` once. Any staging or verification failure removes only unpublished staging; it never replaces a published frozen directory.

- [ ] **Step 3: Independently verify freeze and record hashes**

Run `verify-freeze`, compare every file digest, verify exact regular-file inventory, verify no final/replay/local-shadow terminal output, and record the bundle hash inventory without parsing final membership.

- [ ] **Step 4: Stop before final preflight**

Freeze approval is not final authorization. Do not create a final lock or start a final process in this task.

### Task 17: Preflight and Invoke Exactly One New Final

**Files:**
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr-20260905-01/final/final-command.json`
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr-20260905-01/final/final-evaluation.lock`
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr-20260905-01/final/final-evaluation.json`
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr-20260905-01/final/gate-final.json`
- Modify: `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md`

**Interfaces:**
- Consumes: verified freeze, opaque final commitment, approved gate, exact fresh process authorization.
- Produces: terminal final PASS/FAIL/BLOCKED evidence and permanent lock.

- [ ] **Step 1: Run preflight without final semantic access**

Verify trusted hashes, working tree, freeze identities, opaque final bytes, gate metadata, exact output absence, and absolute command/destinations. Publish the command record and display the exact command plus one-use authorization string.

- [ ] **Step 2: Request fresh authorization for exactly one process invocation**

State explicitly that starting the process consumes authorization regardless of exit and that no retry/candidate replacement/threshold update/gate update is allowed after final access. Wait for explicit approval of the displayed command.

- [ ] **Step 3: Invoke one process and preserve every terminal file**

Run the exact command once. Do not wrap it in shell retry logic. Capture exit code/signal and sanitized stdout/stderr. Never remove the lock or partial evidence.

- [ ] **Step 4: Classify the terminal branch**

Exit `0` plus gate PASS may advance. Exit `3` becomes `FINAL_FAIL`; exits `2`/`4`, signal, unknown status, or inconsistent evidence become `FINAL_BLOCKED`. Record hashes and stop on every non-PASS branch.

### Task 18: Run Conditional Replay and Local Shadow

**Files:**
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr-20260905-01/replay/replay.json`
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr-20260905-01/replay/gate-replay.json`
- Generate: `avatar-web/fishing-ml/artifacts/cycles/p2cr-20260905-01/local-shadow/local-shadow.json`
- Modify: `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md`

**Interfaces:**
- Consumes: final PASS for replay; replay PASS for local shadow.
- Produces: replay terminal evidence and, only after replay PASS, local-shadow terminal evidence.

- [ ] **Step 1: Stop for exact replay process approval**

Display final PASS hash, explicit 260-count commitment, freeze/checkpoint/model identity, loopback port, PID/log destinations, report/gate destinations, and shutdown command. Execute only after approval.

- [ ] **Step 2: Run replay and guarantee service shutdown**

Start the loopback service, verify readiness/identity, replay exact successor membership, publish report/gate, terminate exact PID, and verify the port is closed even on failure. Classify `REPLAY_FAIL` versus `REPLAY_BLOCKED` and stop unless PASS.

- [ ] **Step 3: Stop for local-shadow fixture approval**

After replay PASS, display exact approved fixture hash, command, process-local environment, loopback endpoint, output path, and the six expected cases. Execute only after approval.

- [ ] **Step 4: Run the six-case gate and classify terminal state**

Require case count `6`, continuation count `6`, HTTP count `5`, zero gameplay side effects, expected statuses/error codes, and sanitized report schema. PASS yields only `READY_FOR_SEPARATE_LIVE_SHADOW_REVIEW`; valid safety failure yields `LOCAL_SHADOW_FAIL`; incomplete/uncertain evidence yields `LOCAL_SHADOW_BLOCKED`.

### Task 19: Publish Sanitized Results and Handover

**Files:**
- Modify: `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md`
- Create: `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-handover.md`
- Modify: `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle.md`

**Interfaces:**
- Consumes: every implementation/operational verification record and the single truthful terminal state.
- Produces: sanitized ledger, sanitized handover, completed plan checkboxes, final GitNexus/diff evidence.

- [x] **Step 1: Record exactly one terminal state**

Choose exactly one of `NO_DATASET`, `NO_CANDIDATE`, `FINAL_FAIL`, `FINAL_BLOCKED`, `REPLAY_FAIL`, `REPLAY_BLOCKED`, `LOCAL_SHADOW_FAIL`, `LOCAL_SHADOW_BLOCKED`, or `READY_FOR_SEPARATE_LIVE_SHADOW_REVIEW`. Record why later stages did not run.

- [x] **Step 2: Sanitize results and handover**

Include dates, approved commands, exit codes, aggregate counts/metrics, hashes, model/cycle/dataset IDs, gate results, and unresolved risks. Exclude credentials, cookies, account/user IDs, packet bytes, image/base64 content, final membership, labels, per-example predictions, and error identities.

- [x] **Step 3: Run full final verification**

Repeat Task 12 tests/build/compile/package/hash/privacy checks and:

```bash
git diff --check
node .gitnexus/run.cjs detect-changes --scope all --repo .
git status --short
git diff --stat
```

Expected: fresh successful verification for all applicable commands; GitNexus output not partial/truncated; generated artifacts remain unstaged; historical hashes unchanged.

- [x] **Step 4: Check every completed Plan step**

Change only actually completed checkboxes from `- [ ]` to `- [x]`. Leave conditional/skipped steps unchecked and explain them in the terminal-state ledger.

- [ ] **Step 5: Commit only after explicit final commit approval**

Display exact staged paths and diff summary first. Exclude `.agents/`, restored `avatar-web/fishing-ml/artifacts/phase2-selection.json`, generated cycle data, candidate artifacts, checkpoints, predictions, and operational reports unless separately approved.

```bash
git add \
  docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle.md \
  docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md \
  docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-handover.md \
  avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py \
  avatar-web/fishing-ml/src/fishing_ml/dataset_version.py \
  avatar-web/fishing-ml/src/fishing_ml/coverage_recovery.py \
  avatar-web/fishing-ml/src/fishing_ml/config.py \
  avatar-web/fishing-ml/src/fishing_ml/phase2_training.py \
  avatar-web/fishing-ml/src/fishing_ml/dataset.py \
  avatar-web/fishing-ml/src/fishing_ml/train.py \
  avatar-web/fishing-ml/src/fishing_ml/calibrate.py \
  avatar-web/fishing-ml/src/fishing_ml/artifacts.py \
  avatar-web/fishing-ml/src/fishing_ml/evaluate.py \
  avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py \
  avatar-web/fishing-ml/src/fishing_ml/replay.py \
  avatar-web/fishing-ml/src/fishing_ml/inference_service.py \
  avatar-web/fishing-ml/config/phase2/coverage-recovery-gate.yaml \
  avatar-web/fishing-ml/pyproject.toml \
  avatar-web/server/src/fishing/rx79Capture.ts \
  avatar-web/server/src/fishing/rx79CaptureRoutes.ts \
  avatar-web/server/src/fishing/localShadowCycle.ts \
  avatar-web/server/src/tools/fishing-local-shadow-cycle.ts \
  avatar-web/server/src/config.ts \
  avatar-web/server/src/index.ts \
  avatar-web/server/package.json
git diff --cached --check
git status --short
git commit -m "feat: complete phase2 coverage recovery cycle"
```

## Review Gate

This Plan is documentation only. Do not execute Task 1 or modify production code until the user explicitly approves `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle.md`.
