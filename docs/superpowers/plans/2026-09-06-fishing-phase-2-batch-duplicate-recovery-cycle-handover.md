# Fishing Phase 2 Batch-Duplicate Recovery Cycle Handover

## Terminal Outcome

- Cycle: `p2cr2-20260906-01`.
- Dataset identity: `phase2-coverage-recovery-v2-20260906-01`.
- Terminal state: `NO_DATASET`.
- Terminal date: `2026-09-06`.
- Successor policy was activated before the only permitted capture attempt.
- The capture process exited `1` with `fatal-evidence-failure`; no inventory was published and no successor batch was retained.

## Immutable Evidence

- Acquisition policy SHA-256: `cfd0f5f092761b9c995d7cf27e6a1fb6fd5deb0fda63c9395f9b0ae34bbe1b68`.
- Quarantine SHA-256: `4f21682196111252fe46124c1bf28ad2fb232c7b62541956242083bedcaef3c0`.
- Detector descriptor SHA-256: `505326b55ab919f4b31f80e3ab805217a8ae5d8334a6e8af98e2fa226601e1d0`.
- Detector implementation SHA-256: `d8ebdcb338c17d61a9dde93064fcd3a54945069507a524ce6b02742ed5c97f0c`.
- Diagnostic commitment: `5d6f810d1f9c9746a591a1448cc71ddf3fe9261fc2f68b43ae43a88101acec3e` over 90 legacy diagnostic batches.
- Policy and quarantine retain mode `0600`.

## Aggregate Facts

```text
terminalState = NO_DATASET
captureProcessExit = 1
captureReason = fatal-evidence-failure
observedInboundCommand43Count = 2
sentAcquisitionCommandCount = 0
savedBatchCount = 0
skippedBatchCount = 0
sanitizedErrorCount = 0
publishedInventoryCount = 0
successorRawBatchCount = 0
labeledBatchCount = 0
downstreamArtifactCount = 0
```

## Fail-Closed Classification

- Two inbound command-43 messages were observed during direct join, before any acquisition `TX41`, `TX44`, or `TX45` was sent.
- The approved guard treats command `43` in either traffic direction as a fatal evidence failure.
- The capture contract permits exactly one successful 90-batch run and forbids silently retrying an aborted or failed run.
- The resulting empty raw root and absent inventory are therefore terminal evidence, not a partially usable corpus.

## Data Lineage

- `data/phase2/raw` and `data/phase2/labels` remain the authoritative parent corpus for `phase2-20260904-01`.
- The 90 batches under `data/phase2/cycles/phase2-coverage-recovery-20260905-01/raw` remain diagnostic/exclusion-only evidence and are not reusable successor acquisition.
- `data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/raw` contains no retained successor batch.

## Skipped Stages

- Manual labeling did not run because no sealed successor inventory exists.
- Duplicate screening, acquisition, allocation, and successor dataset publication did not run.
- Candidate training, calibration, comparison, freeze, final evaluation, replay, and local shadow did not run.
- No downstream artifact from this cycle may be represented as a dataset, candidate, frozen model, final result, replay result, or local-shadow result.

## Future-Cycle Boundary

- Any further acquisition requires a separately designed and approved cycle with a new identity, new pre-capture policy, and new no-replace evidence namespace.
- Whether inbound command `43` should remain fatal or only outbound `TX43` should be prohibited is a future design decision; this completed cycle must not be reopened or weakened retroactively.

## Final Verification

- Python compilation, all 37 existing Python tests, and dependency validation passed.
- The final detector smoke and diagnostic summary reproduced the approved behavior and aggregates.
- All 270 server tests, TypeScript typecheck, and the production build passed; the pre-existing listener warning remained non-blocking.
- All 16 immutable historical and old-cycle hashes matched.
- Working/prefinal and final successor verifiers were not applicable because allocation and durable final-lock artifacts do not exist after terminal `NO_DATASET`.

## Sanitization

This handover excludes secrets, private operational identifiers, raw protocol bytes, image content, manual labels, model outputs, per-example error identities, and sealed split contents.
