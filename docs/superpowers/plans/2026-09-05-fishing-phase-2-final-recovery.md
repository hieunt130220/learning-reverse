# Fishing Phase 2 Final Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair transfer revision validation and preserve final one-shot evidence, then prepare one separately authorized recovery evaluation and conditional replay.

**Architecture:** A dependency-leaf provenance module provides one exact revision compatibility predicate for orchestration, evaluation and inference. Final evaluation creates its durable exclusive lock before dataset verification and retains it on every subsequent outcome.

**Tech Stack:** Python, unittest, existing fishing-ml CLI, GitNexus.

**Spec:** `docs/superpowers/specs/2026-09-05-fishing-phase-2-final-recovery-design.md`

## Global Constraints

- User approved recovery Spec and tests after production with `oke`. This Plan still requires review before implementation.
- Spec transcription correction: recorded revision is `8ca1f93990dcd06a0b7d6ee6251100e67a155365`; current revision is `aebbbe5a01affddebf7e0c7e8244e6a1e1fd3288`, verified against existing compatibility helper and Git HEAD. No extra pair is permitted.
- Keep selected run `p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01`, checkpoint, dataset, selection and gate unchanged. Gate SHA is `a6595257ef073338cdeafadca3371ab568697e8e045fe3d696542b8584e07a83`.
- Do not read final split contents, labels or predictions during implementation/preflight. Tests use synthetic fixtures only.
- Prior process invocation failed before final access. At most one additional invocation is permitted, only after a fresh explicit authorization following preflight. Starting that process consumes the authorization regardless of outcome.
- No automatic retries, lock removal, artifact overwrite, training, reselection or gate tuning.
- Keep new artifact creation checks in `train.py` and `artifacts.py` strict.
- GitNexus impact before each symbol edit; report HIGH/CRITICAL risks before edits; resolve UNKNOWN with source inspection. No TDD. Tick each step immediately after verified completion.
- No commit/push requested. Commit steps below are conditional and remain unchecked unless separately authorized; run complete GitNexus detect-changes before any commit.

### Task 1: Centralize revision compatibility

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/provenance.py`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/experiments.py`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/evaluate.py`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/inference_service.py`

**Interfaces:**
- Consumes: existing `_revision_matches_recorded(current, recorded)` and its exact allowlist.
- Produces: `revision_matches_recorded(current: str, recorded: object) -> bool` in provenance module.

- [x] **Step 1: Analyze callers before edits**
Run GitNexus impact upstream for `_revision_matches_recorded`, its four experiment callers, `evaluate_run`, `evaluate_final_once`, and `load_frozen_matcher`. Resolve ambiguous names by qualified identifiers. Report callers/processes/risk and confirm dynamic callers by source search when UNKNOWN.

- [x] **Step 2: Implement shared predicate and migrate consumers**
Move existing allowlist and full SHA validation into provenance module. Preserve argument order `(current, recorded)`. Require both values to be valid nonempty 40-character hexadecimal revisions; accept equality or the one ordered approved pair. Import predicate in experiments and replace its four calls. Replace strict frozen revision comparisons in dev/final evaluation and frozen matcher loading. Preserve recorded revision in all evidence; never rewrite manifests. Remove obsolete private helper/constant after checking references.

- [x] **Step 3: Verify imports without dataset access**
Run from `avatar-web/fishing-ml`: `.venv/bin/python -c 'from fishing_ml import provenance, experiments, evaluate, inference_service'`.
Expected: exit 0, no circular import or final data access.

- [ ] **Step 4: Commit only if separately requested**
After complete graph change analysis: `git commit -m "fix: share frozen transfer revision validation"` using only reviewed source paths.

### Task 2: Make final lock fail closed

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/evaluate.py`

**Interfaces:**
- Consumes: Task 1 revision predicate and existing exclusive `_create_final_lock`.
- Produces: final evaluation with persistent lock before all final dataset access.

- [x] **Step 1: Analyze lock and final boundary**
Run GitNexus impact upstream for `_create_final_lock` and `evaluate_final_once`. Trace `verify_freeze`, `_inputs`, and orchestration preflight to ensure they do not parse final examples before lock. If another final read is found, move that operation behind the same boundary before proceeding.

- [x] **Step 2: Implement persistent lock**
Keep run-id, output/lock existence, freeze/revision and schema checks before lock. Create exclusive lock immediately before `verify_current_dataset`; remove `published` bookkeeping and the failure cleanup that unlinks lock. Retain lock on success and all exceptions. Include run identity, PID and UTC timestamp in lock evidence, fsync file and parent directory before entering dataset verification. A lock creation/write/sync failure must never advance to dataset access, and any partial lock remains fail closed. Preserve no-replace publication.

- [x] **Step 3: Verify static validity**
Run `.venv/bin/python -m compileall -q src/fishing_ml/provenance.py src/fishing_ml/experiments.py src/fishing_ml/evaluate.py src/fishing_ml/inference_service.py` and `git diff --check`.
Expected: both exit 0.

- [ ] **Step 4: Commit only if separately requested**
After complete graph change analysis: `git commit -m "fix: retain final evaluation lock before dataset access"`.

### Task 3: Verify recovery with synthetic tests

**Files:**
- Create: `avatar-web/fishing-ml/tests/test_phase2_recovery.py`
- Modify if references require migration: `avatar-web/fishing-ml/tests/test_phase2_experiments.py`

**Interfaces:**
- Consumes: completed production changes from Tasks 1–2.
- Produces: regression evidence without real final split access.

- [x] **Step 1: Add tests after production**
Use unittest temporary directories and mocks. Cover exact revision, approved ordered pair, reversed pair, third revision, empty/malformed values; dev evaluation and matcher integration with mocked model/data loaders; final rejection before lock for unauthorized schema/revision; lock existence when dataset verifier begins; retained lock on dataset, evaluation and publication failures and success; repeat invocation refusal after each locked outcome. Assert no dataset access if exclusive lock creation fails. Update old helper references only after GitNexus impact on affected test methods and source checks for dynamic discovery.

- [x] **Step 2: Run focused verification**
From `avatar-web/fishing-ml`, run `.venv/bin/python -m unittest tests.test_phase2_training tests.test_phase2_experiments tests.test_phase2_gate tests.test_inference_size_contract tests.test_phase2_recovery -q`.
Expected: all pass. Record count and command exit; fix actual regressions and rerun only as needed.

- [ ] **Step 3: Commit only if separately requested**
After complete graph change analysis: `git commit -m "test: cover final recovery provenance and persistent lock"`.

### Task 4: Prepare reviewable recovery command

**Files:**
- Modify: `docs/superpowers/plans/2026-09-05-fishing-phase-2-final-and-replay-results.md`
- Modify: `docs/handoffs/2026-09-05-fishing-phase-2-final-and-replay-handover.md`

**Interfaces:**
- Consumes: passing verification and immutable identities in prior results ledger.
- Produces: exact command, preflight evidence and pending final authorization.

- [x] **Step 1: Read-only preflight**
Verify HEAD, controlled diff, approved gate hash, selected run/checkpoint/freeze identities against original ledger. Inspect validator implementations before invoking them: do not use any preflight helper that parses final split contents. Check final lock/report/gate output filenames only. Existing lock or report blocks recovery. Record source diff digest, test evidence, exact artifact hashes and any uncertainty.

- [x] **Step 2: Materialize exact command**
Resolve the command from Task 8 Step 5 of `2026-09-05-fishing-phase-2-final-and-replay.md` into absolute executable/arguments, preserving selected run and all inputs. Append command and stdout/stderr capture destinations to results ledger. Review command without launching it.

- [x] **Step 3: Obtain fresh authorization**
Present preflight and exact command for user approval to start exactly one additional final process. Stop here until explicit authorization arrives. Plan approval does not satisfy this step.

### Task 5: Execute authorized final and conditional replay

**Files:**
- Modify: results ledger and handover from Task 4.
- Generated only by authorized CLI: selected run final lock/report and gate output.

**Interfaces:**
- Consumes: Task 4 explicit one-invocation authorization.
- Produces: audited terminal result and conditional replay evidence.

- [x] **Step 1: Run exactly once**
Start the recorded command once, capture start/end UTC, exit status, stdout/stderr and hashes. Poll the same running process if necessary; never relaunch. Preserve all outputs and lock. Record whether evidence proves final boundary was entered; do not infer that absence of a report means data was unopened.

- [x] **Step 2: Follow terminal branch**
If exit is nonzero, record failure and stop evaluation/replay; mark replay NOT RUN with reason. If exit is zero, verify final/gate artifacts and identities, then execute the existing original Plan Task 9 replay instructions with their unchanged safety conditions. Do not tick skipped work as completed.

- [x] **Step 3: Update task tracking and handover**
Record all completed steps, conditionally skipped work, command results and immutable evidence. Update original Plan Task 9 only if its actual replay requirements are satisfied. Report final outcome and remaining limits to user.

- [ ] **Step 4: Commit only if separately requested**
Run nonpartial GitNexus `detect-changes --scope all`, review staged paths and exclude selection/dataset/generated artifacts, then commit only explicitly authorized files.
