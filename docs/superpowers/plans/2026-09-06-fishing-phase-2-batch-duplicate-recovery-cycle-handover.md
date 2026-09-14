# Fishing Phase 2 Batch-Duplicate Recovery Cycle Handover

## Terminal Outcome

- Cycle: `p2cr2-20260906-01`.
- Dataset identity: `phase2-coverage-recovery-v2-20260906-01`.
- Terminal state: `FINAL_FAIL`.
- Terminal date: `2026-09-07`.
- Capture, labeling, duplicate screening, allocation, training, calibration, recovery selection, freeze, and exactly one semantic final evaluation completed.
- Replay and local shadow did not run because final gate PASS was not achieved.

## Immutable Evidence

- Acquisition policy SHA-256: `cfd0f5f092761b9c995d7cf27e6a1fb6fd5deb0fda63c9395f9b0ae34bbe1b68`.
- Quarantine SHA-256: `4f21682196111252fe46124c1bf28ad2fb232c7b62541956242083bedcaef3c0`.
- Capture inventory SHA-256: `4f7e805975c15b70907e4c8e75446b204e7441018bffe355294890f68a4a8cb6`.
- Acquisition SHA-256: `3c0fa032ec28797a19aab55ebf4bd195838931ccf9e6b3bdec1cbd6c0f51fc6b`.
- Allocation SHA-256: `3026400d7bb1e36f635514a764a6961c1c01a2309f3293fc27fc0cb5c5baf1b5`.
- Dataset-version SHA-256: `82c1667366f4f131abf0aeed254f6f068a91369a422ad207aefc9fec1ac6db73`.
- Experiment manifest SHA-256: `41d3d23de7bd1293f89e43407c06c499cdb506ae82410700a35571fb5cc7fa7a`.
- Original selection SHA-256: `9e900be8607848a4f7ad821d67da3c8c37c49bca5c8d2801a4fd2cb9b7da2f31`.
- Recovery selection SHA-256: `88873d18d5964fea40eed2ef0943fdeba37807f0a1ddeddd693636e059dae5c8`.
- Freeze manifest SHA-256: `e30f2524e5dca5691909bf8224e807d5e16d78afa9f8016e2188ec7ae1ac24f3`.
- Final gate policy SHA-256: `c29a41a47e5de85b4499f71b6eeba77ca0cc52eca56e7485226d6c8d86b1b8ec`.
- Final command SHA-256: `bd73dc8820c2d06658fbfa328e1a86c3ac8f4e3a05c64034d8ba7933cea37f49`.
- Final lock SHA-256: `972a12f190a71b88ad97fcfe7a11199e57f2cc509963aee81f3a7cdfcde5e810`.
- Final report SHA-256: `76ec117d060e1c8714adac69975c69b222ec90899a96de2b7137a269adae60ed`.
- Final gate report SHA-256: `620e78da067e96650d72f5c9ac60ec8e826c17ad2484dbf4549d07a6d0039a00`.
- Policy, quarantine, and capture inventory retain mode `0600`.

## Aggregate Facts

```text
terminalState = FINAL_FAIL
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
recoveryGatePassingCandidateCount = 1
selectedCandidateCount = 1
finalQueryCount = 210
finalAcceptedCount = 129
finalAbstainedCount = 81
finalWrongAcceptedCount = 1
```

## Selection Recovery

- The immutable original selection remains `NO_CANDIDATE`; it was not deleted, renamed, or overwritten.
- The recovery gate requires zero wrong accepted queries, zero acquired-dev wrong accepted queries, accepted rate at least `0.64`, top-1 accuracy at least `0.987220`, and batch exact match at least `0.95`.
- Exactly one candidate passed with dev accepted rate `0.642173`, top-1 accuracy `0.987220`, batch exact match `0.955556`, and both wrong-accepted counts equal to zero.
- No latency tie-break was required.
- The frozen thresholds provenance records the original selection hash, recovery selection hash, original gate, and recovery gate.

## Final Gate Evidence

- The ignored operational gate YAML was corrected from the old cycle identity to the successor identity before authorization; final thresholds and safety rules were unchanged.
- The successful preflight and final process ran in one persistent PTY. The authorization was consumed exactly once and is not retained here.
- Final accepted rate `0.614286` passed `>= 0.60`.
- Final top-1 accuracy `0.985714` passed `>= 0.98`.
- Final batch exact match `0.933333` passed `>= 0.90`.
- Wrong accepted count `1` failed the mandatory zero-wrong rule.
- The final gate had no blockers and reported failure `wrong_accepted_nonzero`; process exit was `3`.

## Data Lineage

- `data/phase2/raw` and `data/phase2/labels` remain the authoritative immutable parent corpus for `phase2-20260904-01`.
- The 90 batches under `data/phase2/cycles/phase2-coverage-recovery-20260905-01/raw` remain diagnostic/exclusion-only evidence and were not labeled or trained.
- The successor acquired corpus is rooted only at `data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/raw` and its sibling `labels` directory.
- Dataset v2 resolves parent and acquired roots explicitly without copying or relinking corpus files.

## Stopped Stages

- The one-shot final lock is permanent and the final evaluation must not be retried under this cycle identity.
- Replay cannot run without final PASS, and local shadow cannot run without replay PASS.
- No replay report, replay gate report, or local-shadow result exists for this cycle.

## Next Boundary

- Preserve the original selection, recovery selection, frozen bundle, final command, final lock, final report, and final gate report unchanged.
- Do not retry final, replace the candidate, alter thresholds, or publish replay/local-shadow artifacts under this cycle identity.
- Any further model attempt requires a new approved experiment or cycle identity and must not use the opened final evidence for tuning.

## Final Verification

- All `37/37` existing Python tests, dependency validation, detector smoke, diagnostic summary, working/prefinal/final membership verification, and frozen-bundle verification passed.
- Independent experiment verification confirmed active recovery selection with `24/24` completed runs, `48/48` completed candidates, zero rejections, and both selection digests.
- All `270/270` server tests, TypeScript typecheck, and the production build passed; the existing listener warning remained non-blocking.
- Exact hashes and aggregate gate consistency confirmed terminal `FINAL_FAIL`, one wrong accepted query, no blockers, and absent replay/local-shadow namespaces.
- The final added-line privacy scan found zero authorization literals, emails, UUIDs, private user paths, account IDs, or per-example prediction/label identifiers; `git diff --check` exited `0`.
- GitNexus `1.6.11` analyzed the final three-document diff as 19 changed symbols, zero affected processes, and `LOW` risk; the command exited `0` without partial or truncated diagnostics.

## Sanitization

This handover excludes secrets, private operational identifiers, authorization, raw protocol bytes, image content, manual labels, predictions, per-example error identities, private batch identities, and sealed split contents.
