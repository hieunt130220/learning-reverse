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

## Defect-report verification addendum (2026-09-04)

The 11 reported production defects were re-verified against merged `main` at `1e6d4b39` by reading the actual code paths. The report had been produced on the pre-merge checkout `b3017572`, and commit `0966d9c9` had already fixed all of them:

- `confirm_final_once` now reads snake_case metrics from the final report with strict validation before canonicalizing for `adjudicate_final` (`experiments.py:1420-1469`).
- `_cmd_freeze` now resolves the selection through `_validate_selection_for_spec` and `_validate_selection_current`, comparing `candidateManifestSha256`, provenance, and policy (`experiments.py:651-665`).
- `adjudicate_replay` quality checks now use labeled rates and block on unknown queries (`phase2_gate.py:632-648`).
- `_record_predictions` now marks a batch exact only when every query returned and correct (`replay.py:596-609`).
- `publish_no_replace` now installs artifacts via atomic exclusive `os.link` with byte-equivalence idempotence (`schema.py:453-520`).
- `run_experiment` now builds training config from the hashed `spec.config_overlay` via `_effective_config_for_spec` (`experiments.py:1273-1276`).
- `_cmd_run_reuse` no longer requires a frozen directory; it validates the complete un-frozen run (`experiments.py:1693-1711`).
- Replay operational evidence is strictly typed by `_normalize_replay_evidence`; no silent zero defaults (`phase2_gate.py:415-449`).
- Manifest metrics are parsed by `_parse_raw_dev_metrics`/`_parse_calibrated_metrics` with `_rate`/`_non_negative_int`, rejecting NaN/Inf (`experiments.py:439-456`, `1037-1059`).
- `_positive_ms` now routes through `_finite_number`, which enforces `math.isfinite`, so `.nan`/`.inf` latency thresholds are rejected (`phase2_gate.py:217-226, 331-335`).
- `_result_from_manifest` routes `devSelectionPassed` through a strict boolean check (`experiments.py:457-458`).

Verdict: no correctness defect remains from the reported intake at the verified revision. The freeze-execution BLOCKED outcome is unchanged. Remaining review notes are low-priority cleanup (duplicate helpers, per-image hashing in the no-augmentation path) tracked for a future cleanup cycle, not a defect cycle.
