# Fishing Phase 2 Coverage Recovery Cycle Handover

## Terminal Outcome

- Cycle: `p2cr-20260905-01`.
- Terminal state: `NO_DATASET`.
- Terminal date: `2026-09-06`.
- The active diagnostic crawl was an approved operational deviation from the passive-only design.
- The v1 duplicate policy admitted `0/90` captured batches.

## Immutable Evidence

- Acquisition policy SHA-256: `cc63156b6e52262622dc16852e89e114c5169c760bf277f853beb582a6b67e8a`.
- Quarantine SHA-256: `1e4e69a7811ab51264c119f91be4113fe4b01ba5cb7a8def37c4dcfb79186740`.
- Capture inventory SHA-256: `c133238289a9d36dddc0861d4ac2c0347814b9d231fcb2c75560d33645647c53`.
- Each evidence file has mode `0600`.

## Aggregate Facts

```text
terminalState = NO_DATASET
capturedValidBatchCount = 90
referenceImageCount = 540
queryImageCount = 460
recoveredRx79TimeoutCount = 2
saveErrorCount = 0
exactShaOverlapCount = 0
directDhashParentMatchImageCount = 913
decodedImageCount = 1000
rejectedBatchCount = 90
labeledBatchCount = 0
downstreamArtifactCount = 0
```

## Exclusion Contract

- All 90 captured batches are diagnostic and exclusion-only evidence.
- They must never be labeled, allocated, trained, calibrated, evaluated, replayed, renamed into, copied into, or grandfathered as successor data.
- The successor must commit the complete sorted diagnostic ID set before capture and reject any group that touches this corpus.
- No downstream artifact from this cycle may be treated as a dataset, candidate, frozen model, final result, replay result, or local-shadow result.

## Successor Direction

- Use a role-aware complete-batch duplicate detector instead of the v1 image-level decision rule.
- Publish the successor policy and exclusion ledger before the first successor capture timestamp.
- Capture exactly 90 new real batches under the successor identity.
- Keep parent data, diagnostic data, and newly acquired data in distinct immutable roots.

## Sanitization

This handover excludes secrets, private operational identifiers, raw protocol bytes, image content, manual labels, per-example model output, and sealed split contents.
