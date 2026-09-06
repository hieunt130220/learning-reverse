# Fishing Phase 2 Batch-Duplicate Recovery Cycle Handover

## Terminal Outcome

- Cycle: `p2cr2-20260906-01`.
- Dataset identity: `phase2-coverage-recovery-v2-20260906-01`.
- Terminal state: `NO_CANDIDATE`.
- Terminal date: `2026-09-06`.
- Capture, labeling, duplicate screening, allocation, training, calibration, and dev-only comparison completed.
- Freeze, semantic final evaluation, replay, and local shadow did not run.

## Immutable Evidence

- Acquisition policy SHA-256: `cfd0f5f092761b9c995d7cf27e6a1fb6fd5deb0fda63c9395f9b0ae34bbe1b68`.
- Quarantine SHA-256: `4f21682196111252fe46124c1bf28ad2fb232c7b62541956242083bedcaef3c0`.
- Capture inventory SHA-256: `4f7e805975c15b70907e4c8e75446b204e7441018bffe355294890f68a4a8cb6`.
- Acquisition SHA-256: `3c0fa032ec28797a19aab55ebf4bd195838931ccf9e6b3bdec1cbd6c0f51fc6b`.
- Allocation SHA-256: `3026400d7bb1e36f635514a764a6961c1c01a2309f3293fc27fc0cb5c5baf1b5`.
- Dataset-version SHA-256: `82c1667366f4f131abf0aeed254f6f068a91369a422ad207aefc9fec1ac6db73`.
- Experiment manifest SHA-256: `41d3d23de7bd1293f89e43407c06c499cdb506ae82410700a35571fb5cc7fa7a`.
- Selection SHA-256: `9e900be8607848a4f7ad821d67da3c8c37c49bca5c8d2801a4fd2cb9b7da2f31`.
- Policy, quarantine, and capture inventory retain mode `0600`.

## Aggregate Facts

```text
terminalState = NO_CANDIDATE
savedBatchCount = 90
referenceImageCount = 540
queryImageCount = 611
labeledBatchCount = 90
eligibleBatchCount = 90
sourceBatchCount = 260
trainBatchCount = 185
devBatchCount = 45
sealedFinalBatchCount = 30
completedRunCount = 24
completedCandidateCount = 48
gatePassingCandidateCount = 0
selectedCandidateCount = 0
```

## Dev Gate Evidence

- The fixed promotion gate required zero wrong accepted queries, zero acquired-dev wrong accepted queries, accepted rate at least `0.65`, top-1 accuracy at least `0.99`, and batch exact match at least `0.95`.
- All 48 candidates satisfied both zero-wrong conditions.
- Two candidates met the accepted-rate threshold and 12 met the batch exact-match threshold.
- Maximum observed top-1 accuracy was `0.987220`, so no candidate met the required `0.99` threshold and no complete gate pass existed.
- The no-replace selection record therefore published `NO_CANDIDATE` with no selected model and no latency evidence.

## Data Lineage

- `data/phase2/raw` and `data/phase2/labels` remain the authoritative immutable parent corpus for `phase2-20260904-01`.
- The 90 batches under `data/phase2/cycles/phase2-coverage-recovery-20260905-01/raw` remain diagnostic/exclusion-only evidence and were not labeled or trained.
- The successor acquired corpus is rooted only at `data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/raw` and its sibling `labels` directory.
- Dataset v2 resolves parent and acquired roots explicitly without copying or relinking corpus files.

## Stopped Stages

- Freeze cannot run because the immutable selection has no candidate.
- Final preflight and the one-shot final process were not invoked; the sealed final split was never semantically opened.
- Replay cannot run without final PASS, and local shadow cannot run without replay PASS.
- No frozen model, final lock, final report, replay report, or local-shadow result exists for this cycle.

## Next Boundary

- Any further model attempt must use a new approved experiment or cycle identity and preserve this `NO_CANDIDATE` selection unchanged.
- Do not lower thresholds, replace candidate evidence, reuse the selection path, or open the sealed final split to tune another attempt.
- The captured and labeled successor corpus may be referenced only through a newly defined immutable lineage contract.

## Final Verification

- Fresh verification ran after terminal publication.
- All `37/37` existing Python tests, dependency validation, detector smoke, diagnostic summary, and successor working/prefinal verification passed.
- Independent experiment verification confirmed `NO_CANDIDATE`, `24/24` completed runs, `48/48` completed candidates, zero rejections, and the recorded selection digest.
- All `270/270` server tests, TypeScript typecheck, and the production build passed; the existing listener warning remained non-blocking.
- Historical, diagnostic, and successor hashes matched, and no frozen/final/replay/local-shadow namespace exists.
- Privacy and whitespace checks passed; GitNexus MCP classified the three-document change set as `LOW` risk with zero affected processes and no incomplete result.

## Sanitization

This handover excludes secrets, private operational identifiers, raw protocol bytes, image content, manual labels, predictions, per-example error identities, private batch identities, and sealed split contents.
