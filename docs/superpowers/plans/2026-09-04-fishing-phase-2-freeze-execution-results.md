# Fishing Matcher Phase 2 Freeze Execution Results

**Status:** BLOCKED
**Git revision:** `1e6d4b39682038e03c5445e6b69e0144458eee14`
**Final data opened:** no
**Training started:** no

## Preserved pre-existing working-tree changes

The source checkout had user modifications in `AGENTS.md` and `CLAUDE.md`; execution is isolated in a worktree and does not modify those files.

## Gate R

| Check | Status | Evidence |
|---|---|---|
| Repository baseline | PASS | Isolated branch at fixed revision `1e6d4b39682038e03c5445e6b69e0144458eee14` |
| Gate policy placeholder | PASS | `preAgreedPlaceholders: true`; unchanged |
| Python runtime | PASS | Python 3.12.13; Torch 2.13.0; NumPy 2.5.2; Pillow 11.3.0; scikit-image 0.25.2; PyYAML 6.0.3 |
| Focused Python Phase 2 tests | PASS | 19/19 passed |
| Python compilation | PASS | Exit 0; pre-existing invalid-escape warning in `dataset_version.py` |
| Server tests | PASS | 270/270 passed; pre-existing `MaxListenersExceededWarning` observed |
| Server typecheck | PASS | Exit 0 |
| Server production build | PASS | Exit 0 |
| Phase 2 dataset namespace | BLOCKED | `data/phase2/raw`, `labels`, `splits`, and `dataset-version.json` are absent |
| Overall Gate R | BLOCKED | `phase2-dataset-missing`; execution stopped before training |

## Candidate execution

| Ordinal | Run ID | Status | Evidence |
|---:|---|---|---|

## Selection and freeze

| Check | Status | Evidence |
|---|---|---|

## Blockers and failures

- `phase2-dataset-missing`: the isolated Phase 2 raw, labels, splits, and immutable dataset-version inputs do not exist. Tasks 4–7 remain `NOT_STARTED`.
- Nine confirmed production defects were reported by a separate broad review of merged `main` and are recorded here as out-of-scope intake: `confirm_final_once` camelCase/snake_case metric mismatch; replay gate using global accepted rate and ignoring unknown queries; freeze verifying only `selectedRunId` without manifest-hash/provenance checks; replay counting omitted-prediction batches as exact; racy `publish_no_replace`; `run_experiment` ignoring the hashed candidate config overlay; run-reuse requiring a frozen directory; replay operational gate defaulting `erroredBatchCount`/`omittedRate`; and manifest metric coercion accepting `NaN`/`Inf`. Independent verification additionally confirmed freeze skipping the selection's manifest-hash/provenance comparison and `_positive_ms` accepting `.nan` latency thresholds so replay latency ceilings always pass. None were exercised by this run because training, compare, freeze, and final never started; all require a dedicated defect Spec → Plan before any dataset-ready execution.

## Safety and privacy

- Training started: no.
- Final data opened: no.
- New final artifacts: 0.
- Gate policy modified: no.
- No sensitive payload was added to this ledger.
- GitNexus detected no affected execution processes from this plan's document-only work; its report also surfaced the source checkout's pre-existing `AGENTS.md` and `CLAUDE.md` changes.
