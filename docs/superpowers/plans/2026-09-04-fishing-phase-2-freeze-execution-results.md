# Fishing Matcher Phase 2 Freeze Execution Results

**Status:** PASS — VERIFIED FREEZE
**Git revision:** `8ca1f93990dcd06a0b7d6ee6251100e67a155365` (re-anchored; production code identical to `1e6d4b39`, plus three approved docs commits)
**Final data opened:** no
**Training started:** yes — completed 24/24 on CPU

## Preserved pre-existing working-tree changes

The source checkout had user modifications in `AGENTS.md` and `CLAUDE.md`; execution is isolated in a worktree and does not modify those files.

## Gate R

| Check | Status | Evidence |
|---|---|---|
| Repository baseline | PASS | Isolated worktree at fixed revision (see header); re-anchored after approved docs commits |
| Gate policy placeholder | PASS | `preAgreedPlaceholders: true`; unchanged through execution (re-verified post-freeze) |
| Python runtime | PASS | Python 3.12.13; Torch 2.13.0; NumPy 2.5.2; Pillow 11.3.0; scikit-image 0.25.2; PyYAML 6.0.3 |
| Focused Python Phase 2 tests | PASS | 19/19 passed |
| Python compilation | PASS | Exit 0; pre-existing invalid-escape warning in `dataset_version.py` |
| Server tests | PASS | 270/270 passed; pre-existing `MaxListenersExceededWarning` observed |
| Server typecheck | PASS | Exit 0 |
| Server production build | PASS | Exit 0 |
| Phase 2 dataset namespace | PASS | `data/phase2/raw|labels|splits` resolve strictly under `data/phase2/`; dataset-version verify exit 0 (`phase2-20260904-01`, sha256 `406be8ed9fc097adcdaf6c3446addd4bf94c909d3a299cca8ce1304da35b0807`) |
| Raw/labels validation | PASS | completed=200, ambiguous=0, labeled_pairs=1375; minima gates met (200/200 batches, 1375/1000 pairs); only the 6 known `LABEL_MISSING` on unlabeled raw batches |
| Candidate matrix | PASS | `experiments list` exit 0: count=24, unique run IDs/matrix keys, axes 3/2/2/2 |
| Overall Gate R | PASS | Resumed 2026-09-04 after dataset preparation commit `8ca1f939` |

## Candidate execution

| Stage | Status | Evidence |
|---|---|---|
| Sequential runs (MPS attempt) | RESET | 01–04 trained on MPS then candidate 05 failed (MPS lacks deterministic `index_put` kernel); user decision A reran the whole matrix on CPU; MPS artifacts deleted under the user-approved reset exception, never compared/frozen |
| Matrix change | APPROVED | `candidates.yaml` baseConfig `device: auto → cpu` (user decision A); uniform identity across all 24 candidates; new run IDs |
| Sequential runs (CPU) | PASS | 24/24 `run` exit 0 with absolute-path roots; 24/24 strict `reuse` revalidation exit 0; zero failures; zsh runner re-derived run IDs from `experiments list` |
| Set verification | PASS | Exact 24/24 manifests match canonical CPU matrix; all 24 `devSelectionPassed=true`, `wrongAcceptedCount=0` |

## Selection and freeze

| Check | Status | Evidence |
|---|---|---|
| Compare | PASS | exit 0; idempotent re-run exit 0, same identity |
| Selected candidate | PASS | `selectedRunId=p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01` (`photometric_plus_geom\|off\|t0.05\|dim_128`); inside canonical matrix |
| Selection artifact | PASS | `artifacts/phase2-selection.json` sha256 `4c15e952eef67f7291a306d2eedc8277ca86601286b301538e8c03335dc71f1f` |
| Freeze | PASS | exit 0; `artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen/` |
| Independent freeze verification | PASS | `verify_freeze` exit 0; runId matches selection; gitRevision matches header; inventory exact (9 files) |
| Checkpoint SHA-256 | PASS | `6168b65abaf8ade9008c9611413167f76533d1e80926b2be852df6e7e3a67789` |
| Freeze-manifest SHA-256 | PASS | `ed1bbe4f9b24980c0277ace6da5d3b320b9f51a2b33f39c18c52e73beeed64ab` |

## Final boundary

- `confirm-final` never invoked; final split only touched by validators' path/checksum contracts.
- New final artifacts: 0 (post-freeze scan equals preflight baseline).
- Gate policy modified: no.

## Safety and privacy

- Training executed offline on the local dataset; no game client, no network play, no TX43, no `finishFishing()` (scan: only the documentation-only metadata line in `dataset_version.py`).
- Results ledger privacy scan: clean.
- GitNexus `detect_changes(scope=all)`: risk low, affected processes 0; only the pre-existing `AGENTS.md`/`CLAUDE.md` user edits appear — no production symbols changed by this execution.
- Generated artifacts (run dirs, manifests, selection, frozen) are git-ignored and NOT staged; only docs and the approved `candidates.yaml` device change are candidates for commit.

## Blockers and failures

None active. Historical (all resolved with recorded rulings): `phase2-dataset-missing` → dataset-preparation cycle; 11 reported production defects → verified already fixed in merged main; MPS deterministic-kernel failure → user-approved CPU matrix rerun; relative-runDir reuse rejection → absolute-path execution convention; two artifact resets under the user-approved exception.

## Rulings ledger (summary)

1. Fixed revision re-anchored `1e6d4b39 → 8ca1f939` (docs-only commits, production code identical).
2. Execution cwd/absolute-path convention: all `experiments` commands pass absolute roots so the manifest `runDir` is absolute (strict reuse requirement).
3. Two artifact resets (candidate 01/02 relative-runDir outputs) under user decision 1 — own unverified intermediates only.
4. User decision A: whole matrix on CPU via `candidates.yaml` `device: cpu`; MPS artifacts reset; determinism contract preserved; config edit to be committed with these results upon approval.

## Dataset identity

- Dataset: `phase2-20260904-01` (dataset-version sha256 `406be8ed…`), 206 imported batches / 200 eligible, splits 140/30/30 seed `20260827`.
