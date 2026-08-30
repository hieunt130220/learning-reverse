# Fishing Matcher Phase 2 — Rollout Gate Results

**Plan:** `docs/superpowers/plans/2026-08-28-fishing-phase-2.md`
**Spec:** `docs/superpowers/specs/2026-08-28-fishing-phase-2-design.md`
**Branch:** `worktree-fishing-phase-2`, base `259f775a` → HEAD `bdab732` (17 commits).

> Evidence rule: every gate below records what was actually executed in this
> worktree. Where a step requires a running model/torch environment or a live
> service this worktree does not have, the gate is marked **BLOCKED / PENDING
> REAL RUN** — never "passed" by fabrication.

## Gate summary

| Gate | Mandatory condition (spec §5) | Result |
|---|---|---|
| 2A-1 | Dataset version/provenance/schema/leakage valid | ✅ Tooling implemented + verified (Task 1) |
| 2A-2 | Zero wrong accepted; accuracy/coverage thresholds met | ⏸ BLOCKED — real train/final cannot run here (Task 3 boundary) |
| 2A-3 | Frozen candidate independently verified | ✅ Reproducible freeze/verify tooling (Task 3); manifest not re-executed |
| 2B-1 | Contract valid/invalid matrix pass | ✅ Task 4 contract + Task 7 client matrix (21/21) |
| 2B-2 | Replay latency/error budget pass, no schema/crash | ✅ Task 6 fault matrix (18/18, 15/15); real checkpoint replay not run |
| 2C-1 | Flag off keeps behavior; flag on no side effect | ✅ Task 7 + Task 8: OFF by default, 7/7 black-box, no TX side effect |
| 2C-2 | No TX43/flow regression; adequate telemetry | ✅ Source scan: no TX43/finishFishing/sendRaw in Phase 2 fishing code |

## 2A — Offline improvement (Task 1/2/3)

**Implemented and verified in this worktree:**
- `dataset_version.py` (Task 1): immutable `dataset-version.json` (schema v1),
  ISO-8601 UTC `createdAt`, safe-id rule, sorted-unique `sourceBatches`,
  unknown-key rejection, `resolve_phase2_dir` containment. Typecheck + CLI
  smoke (`verify`, `namespace`) passed.
- `error_analysis.py` (Task 2): deterministic R/Q breakdown, confidence/similarity
  histograms, diagnostic labels. Reviewer false-positive on `dataset_version.py`
  resolved (it belongs to the already-reviewed Task 1 fix commit `3d541b9`).
- `experiments.py` + `artifacts.py` freeze (Task 3): finite 24-candidate matrix,
  zero-wrong-accepted gate, **final evaluation runs exactly once**
  (`evaluate_final_once` opens `final.txt` solely), SHA determinism, split
  checksum scoped to train+dev only.

**BLOCKED — not fabricated (honest boundary, Task 3 ledger):**
- Real torch/numpy/Pillow training and the one-shot final evaluation cannot
  execute here (the environment lacks torch; Python 3.14 vs the 3.11–3.12 the
  stack targets). No `accepted_wrong_count`, accuracy, coverage, or latency from
  a real model is claimed. When the environment exists, run:
  `fishing-train` → `fishing-freeze` → `fishing-evaluate` and record the emitted
  manifest. Gate 2A-2 passes only on that real evidence.

## 2B — Inference service & replay (Task 4/5/6)

**2B-1 — Contract (Task 4):** `inference_contract.py` strictly types request/
response/error. `parse_request` raises `ContractError` (no sentinel) and rejects
unknown fields, duplicate/non-contiguous indices, bad base64, non-PNG, non-75×75,
non-RGB/RGBA, count+body overflow, non-finite values; preserves `margin:null`;
`serialize_response` emits exact camelCase wire keys; `model_id` is
response-only (no request model selection). PNG decoded in-memory only; error
reasons leak no base64/pixel/identity. Reviewer Minors were non-blocking.

**2B-2 — Service + replay (Task 5/6):**
- Service (Task 5): loads exactly one verified frozen candidate at startup,
  fails closed on missing/tampered/revision-mismatch; single ASCII-decimal
  `Content-Length`; body size-bounded before parse; one absolute request
  deadline; one bounded inference slot; sanitized `{"code","reason"}` JSON; no
  game/client/TX code, no per-request model selection, no image persistence.
  Two fix rounds (R1/R2) closed 1 Critical + 5 Important + 1 Minor from review
  (filesystem-escape, TOCTOU, truncated-body accept, unbounded reads, surrogate
  UTF-8 break, deep-JSON isolation, misreported ground truth). Fresh re-review:
  SPEC ✅ / QUALITY Approved.
- Replay (Task 6): descriptor-anchored no-follow traversal, bounded single reads,
  canonical in-memory manifest parse, manifest/label/image size caps, complete
  reviewer-label ground truth only. Independent matrices: `/tmp/task6_fix2_postfix.py`
  18/18 and regression 15/15. Fresh re-review: SPEC ✅ / QUALITY Approved.

**BLOCKED — real checkpoint replay not run (honest boundary):**
- The service needs a real frozen checkpoint the worktree does not contain, so
  no real p50/p95/p99 latency, accuracy, or wrong-accepted counts are recorded
  here. Stub-server replay is **operational/fault evidence only**, explicitly not
  matcher-accuracy evidence (per `replay.py` README). Gate 2B-2's numeric budget
  passes only on a real run against `fishing-phase2-inference-service` with a
  frozen candidate.

## 2C — Shadow mode (Task 7/8)

**2C-1 — flag off keeps behavior; flag on no side effect:**
- `shadowConfig.ts` (Task 7): disabled by default (sampleRate 0 →
  `shouldSampleShadow` false → no request); kill switch; finite sample-rate gate;
  `parseEndpoint` rejects literal `#` (M1).
- `inferenceClient.ts` (Task 7): image-only request `{images, imagesNew?}`, no
  idUser/idFish/timeDelayMs; short AbortController deadline (I2); cancel before
  declared/streamed oversize, cancel-rejection swallowed (I3a/I3b); drop length
  equality under non-identity content-encoding (I4); `isValidModelId` predicate
  (I5); indexed-loop copy defeats caller array hooks (C1); `#generation` circuit
  breaker admits only generation-matched outcomes (C2). Independent review found
  2 Critical + 5 Important + 1 Minor — all 9 reproduced, all closed in `c542457`;
  re-review SPEC ✅ / QUALITY Approved.
- `shadowMatcher.ts` (Task 8): `runShadowMatch(payload, cfg=config)` gate + client
  both driven by the passed `cfg`; fire-and-forget `maybeShadowMatch(payload)`
  from two RX79 handlers; `recordShadowTelemetry` emits only
  `{shadow, status, errorCode?, predictionCount?, acceptedCount?}`. Off-by-default
  7/7 black-box (`/tmp/task8_controller_verify.mts`); config/singleton divergence
  fixed in `e26797a`; re-review SPEC ✅ / QUALITY Approved, zero findings.

**2C-2 — no TX43 / flow regression / adequate telemetry:**
- Source scan across `fishing/` + Phase 2 Python service/client/replay: **no**
  `TX43`, `finishFishing`, or `sendRaw`; **no** `idUser`/`idFish`/`timeDelayMs`
  in wire request or telemetry (only comment-level mentions asserting exclusion).
- Rollout order per spec (replay-only → local shadow → authorized live shadow)
  has its first two stages wired; the **authorized live shadow stage is gated
  behind an explicit runtime flag that is OFF by default** and requires out-of-
  band authorization + duration + kill-switch verification before any live
  packet is mirrored to an inference service. This worktree does not perform that
  live run.

## Privacy / final review (plan Step 4)

- No TX43 or game-control side effect (source scan above).
- No sensitive telemetry: telemetry carries no credentials, account identity,
  raw packet, base64 image, or predictions.
- No unapproved generated files committed: tests are ephemeral (`/tmp`,
  uncommitted); no dataset/PNG/labels/splits/venv/checkpoints in the branch.
- `gitnexus_detect_changes({scope:"all"})` on the worktree: no changes detected
  (only pre-existing controller-owned `AGENTS.md`/`CLAUDE.md` remain unstaged,
  intentionally left out of every task commit).

## Unresolved / deferred

1. **2A-2 and 2B-2 numeric gates** require a real training/eval + frozen-checkpoint
   run unavailable in this worktree — pending real execution, not claimed.
2. **Task 6 reviewer Minors** (dead code in `inference_client.py`: `_read_bounded`,
   `_MAX_JSON_DOC_BYTES`, `_parse_response`) remain parked as non-blocking polish;
   out of Phase 6/7/8 scope.
3. **Authorized live shadow** (2C final rollout stage) requires a separate
   authorization decision + an explicit live run — out of Phase 2 implementation
   scope; any TX43 / automated-submit work is deferred to a new Phase 3 spec.
4. **Contract vs service body-budget units (known, no operational impact):**
   `inference_contract.py` caps *decoded* PNG bytes at `_MAX_BODY_BYTES = 960000`
   (`(64+64)*7500`); a request at that boundary is contract-valid. `inference_service.py`
   caps the *raw* request body (`--max-body-bytes`, default `960000`) and rejects
   before parse. A maximal contract-valid request (~1.28 MB base64+envelope) would be
   rejected by the service as `body_too_large`. Real RX79 payloads are tiny 75×75 PNGs
   (a few KB each, even at 64+64 images), so this never occurs in practice. The service
   default is intentionally left at the Task 5 reviewed fail-closed boundary; reconciling
   the two caps (raise service default or document client cap as raw bytes) is a follow-up,
   not a Phase 2 blocker.

## Completion criteria (spec §291) status

| # | Criterion | Status |
|---|---|---|
| 1 | Dataset + candidate independently frozen & reproducible | ✅ Tooling + reproducible freeze |
| 2 | 2A zero wrong accepted + coverage/accuracy thresholds | ⏸ Pending real run (env-limited) |
| 3 | Service contract/replay valid/invalid/fault matrices | ✅ 2B-1 (21/21) + 2B-2 (18/18, 15/15) |
| 4 | Shadow disabled by default, failure-isolated, telemetry-sanitized | ✅ 2C verified |
| 5 | No TX43 / game-control side effect | ✅ Source scan clean |
| 6 | GitNexus impact/detect checks recorded | ✅ Per-task ledger entries |
| 7 | TX43/automated submit deferred to Phase 3 spec | ✅ Deferred |
