# Fishing Matcher Phase 2 Dataset Preparation Results

**Status:** COMPLETE — DATASET READY
**Dataset ID:** `phase2-20260904-01`
**Split seed:** `20260827` (canonical, user decision A; allocation mirrors Phase A)

## Stage results

| Stage | Status | Evidence |
|---|---|---|
| Preflight | PASS | raw=206, labels=200, eligible=200; phase2 absent; Phase A baseline checksums captured with repo-root relative paths (`/tmp/fishing-phase2-dataset-preflight.txt`); all later Phase A re-checks run from the repo root; worktree linked to the real data root via an untracked symlink (not ignored — commits stay file-explicit) |
| Import raw | PASS | 206/206 batches imported via `fishing-import` (exit 0, 0 error, 0 ineligible); every image byte-identical to Phase A (2,653 files, independently re-verified); manifests canonicalized by the importer (semantically identical 206/206, byte-form differs by design); namespace resolution strict under `data/phase2/` |
| Copy labels | PASS | 200 labels copied byte-exact, no-clobber (0 conflicts); all 200 covered labels pass contract (status=complete, batchId matches); validator: completed=200, ambiguous=0, labeled_pairs=1375, only 6 `LABEL_MISSING` issues = the known unlabeled raw batches; explicit minima gates met (batches 200/200, pairs 1375/1000) |
| Create splits | PASS | User decision A applied: canonical seed `20260827` (CLI hard-requirement) instead of the spec's 20260904; `create` → valid=true 140/30/30 issues=0 (exit 0); files disjoint 140/30/30; independent `validate` re-run pass; allocation mirrors Phase A by seed identity |
| Dataset version | PASS | One-shot no-replace creation: `datasetId=phase2-20260904-01`, `parentDatasetId=null`, `createdAt=2026-09-04T03:38:44Z`, `sourceBatches=206` (all imported batches, sorted unique); `dataset_version verify` exit 0; file SHA-256 `406be8ed9fc097adcdaf6c3446addd4bf94c909d3a299cca8ce1304da35b0807` |
| End-to-end gate | PASS | `experiments list` exit 0 with count=24, axes 3/2/2/2, datasetId matches; all 7 readiness paths PASS; Phase A postcheck diff vs preflight: identical |

## Blockers

None (resolved: split seed decision A — canonical `20260827` approved by user on 2026-09-04).

## Dataset identity

- Dataset ID: `phase2-20260904-01`
- Parent dataset ID: `null`
- Created: `2026-09-04T03:38:44.754127Z`
- Source batches: 206 (imported), 200 eligible with complete labels
- Splits: train 140 / dev 30 / final 30, seed `20260827`, validated disjoint
- Dataset-version SHA-256: `406be8ed9fc097adcdaf6c3446addd4bf94c909d3a299cca8ce1304da35b0807`
- Candidate matrix: 24 unique canonical candidates
- Training/compare/freeze/final: NOT RUN (out of scope)
- Dataset files: generated artifacts, NOT staged or committed (data/ is git-ignored)
- Phase A: untouched (baseline diff identical after all stages)
