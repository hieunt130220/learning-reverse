# Fishing Phase 2 Batch-Duplicate Recovery Cycle Results

## Approval Record

- The design and implementation plan were approved on `2026-09-06`.
- On `2026-09-06`, the user approved all named HIGH/CRITICAL production edits identified by the Task 2 GitNexus gate.
- On `2026-09-06`, the user granted standing approval for each task-local commit after that task's verification succeeds, limited to the exact paths and commit message specified by the plan.
- Operational publication, capture, labeling, manual duplicate rulings, allocation publication, training, freeze, final, replay, local shadow, push, merge, and external publication retain their separate gates.

## Task 1: Old-Cycle Terminalization

- The old diagnostic cycle is terminal `NO_DATASET`.
- Its policy, quarantine, and inventory hashes and file modes matched the immutable plan constraints.
- The sanitized results and handover were committed as Git revision `54774b4` with message `docs: close phase2 diagnostic recovery cycle`.
- The 90 old-cycle batches remain diagnostic and exclusion-only evidence.

## Task 2: GitNexus Edit Gate

- Repository: `learning-reverse` at `/Users/hieunt/learning-reverse`.
- Branch: `docs/fishing-phase2-transfer-bundle`.
- Indexed Git revision before production edits: `c6b9aae49e7957fe70fd105bf80515b74819a2d3`.
- GitNexus `1.6.11` indexed 949 files, 18,349 symbols, 62,931 relationships, and 658 flows.
- All planned edit symbols resolved exactly; no result had `UNKNOWN` epistemic state.
- Approved HIGH/CRITICAL symbols: `detector_identity`, `parse_acquisition_policy`, `parse_quarantine`, `parse_acquisition_manifest`, `parse_allocation_manifest`, `parse_dataset_version`, `_parse_v2`, `_entries`, `compute_train_normalization`, `load_training_episodes`, `load_dev_episodes`, and `run_training`.
- Compatibility guards are binding: preserve legacy identities and schemas, require strict successor schema-v2 identities, keep sealed-final behavior unchanged, and retain legacy single-root loaders while adding an explicit unique two-root successor resolver.
- No production file was edited during Task 2 and no Task 2 commit was required.

## Task 3: Role-Aware Batch Detector

- Added a dependency-leaf detector module with the exact schema-v2 descriptor, frozen public evidence types, strict immutable batch loading, deterministic same-role maximum-cardinality matching, and canonical transitive batch grouping.
- `phase2_cycle.detector_identity()` remains as a compatibility wrapper over the new descriptor digest.
- Descriptor SHA-256: `505326b55ab919f4b31f80e3ab805217a8ae5d8334a6e8af98e2fa226601e1d0`.
- Implementation SHA-256 before the Task 3 commit: `d8ebdcb338c17d61a9dde93064fcd3a54945069507a524ce6b02742ed5c97f0c`.
- The exact deterministic plan smoke printed `duplicate-detector-smoke: PASS`.
- Missing, symlinked, and non-regular implementation-path checks printed `duplicate-detector-path-guards: PASS`.
- Python compilation, dependency-boundary scan, no-test-file check, and diff whitespace validation passed.
- Task 3 was committed as Git revision `4853fc0` with message `feat: add role-aware batch duplicate detector`.

## Task 4: Successor Cycle Contracts

- Added separate legacy schema-v1 inventory parsing and strict successor schema-v2 policy, quarantine, capture inventory, ruling, acquisition, allocation, and prefinal contracts.
- Successor identities are cycle `p2cr2-20260906-01`, dataset `phase2-coverage-recovery-v2-20260906-01`, and allocation seed `20260906`.
- Policy/quarantine temp-publication verification reconciled the committed diagnostic inventory SHA-256, 90-record diagnostic commitment, exact detector descriptor digest, and detector implementation digest with mode `0600` artifacts.
- Read-only diagnostic screening reproduced `0` parent batch edges, `0` diagnostic multi-batch groups, maximum reference overlap `4/6`, maximum query overlap `50%`, and maximum combined overlap `50%` without emitting batch IDs.
- End-to-end temporary evidence verified acquired-only multi-batch groups require an exact `allow-batch-group` or `reject-acquired` ruling, diagnostic-touching groups reject all acquired members, and parent/diagnostic exclusions cannot be overridden.
- Group-atomic dry allocation produced acquired `45/15/30`, successor train/dev/final `185/45/30`, source count `260`, and strict schema-v2 prefinal rejection of legacy schema values.
- Python compile-all and all 37 existing unit tests passed. CLI help, invalid-input exit `2`, blocked-state logic, static obsolete-symbol guards, line-length checks, and `git diff --check` passed.
- GitNexus analyzed 106 changed symbols and 59 affected processes at approved `CRITICAL` risk; the CLI returned exit `0` without partial or truncated diagnostics.
- Task 4 was committed as Git revision `15d8032` with message `feat: add successor recovery cycle contracts`.
- The parent-root discrepancy was resolved in Task 6: authoritative parent data remains at `data/phase2/raw` and `data/phase2/labels`.

## Task 5: Active Capture and Inventory Sealing

- Added exact successor crawl arguments and fail-closed validation for cycle `p2cr2-20260906-01`, target `90`, map/area `14/1`, delay `>=2000`, absolute inventory output, closed local port `8787`, absent inventory, and an absent-or-empty raw root.
- Removed both probe and crawl shadow-inference calls. Structured terminal output no longer persists the selected account ID, and runtime error messages redact its exact numeric value.
- Crawl rounds now attach RX45/RX79 waiters before TX45/TX41, send only `41`, `44`, and `45` through the bounded command helper, and count any observed command `43` in either traffic direction as a fatal publication blocker.
- Successful final batch saves are re-opened from their final directories; inventory records use the manifest's own `capturedAt` and SHA-256 of the exact manifest bytes. Failed saves clean only their newly created partial crawl directories while preserving earlier valid raw evidence.
- Schema-v2 inventory publication requires exactly 90 unique raw directories and matching manifest records, writes compact recursively sorted JSON plus one newline with `wx`, mode `0600`, file fsync, chmod, and parent-directory fsync, and removes a newly created inventory on publication failure.
- TypeScript typecheck and build exited `0`; four parser fail-closed smoke cases passed without account-ID leakage; the forbidden-hook scan found only comments documenting the TX43 prohibition.
- GitNexus analyzed 63 changed symbols and 15 affected processes at approved `HIGH` risk; the CLI returned exit `0` without partial or truncated diagnostics.
- Task 5 was committed as Git revision `5d688bf` with message `feat: seal successor fishing capture inventory`.

## Task 6: Successor Identity and Two-Root Resolution

- Added `CycleDataRoots` and `resolve_cycle_data_roots()` with exact parent/acquired layout validation, real-directory checks, safe batch IDs, missing-source rejection, and cross-root collision rejection.
- Parent data resolves only from `data/phase2/raw` and `data/phase2/labels`; successor acquired data resolves only from `data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/raw` and its sibling `labels` directory.
- Training, dev normalization, calibration, candidate validation, latency benchmarking, frozen dataset snapshots, final evaluation, and replay now use the same explicit resolver without copying, symlinking, or hardlinking corpus data.
- Final membership remains unavailable until the durable final lock, and every resolved final batch must belong to the acquired root.
- Schema-v1 parent compatibility resolved all 206 declared parent members, and the two-root replay descriptor smoke resolved all 260 successor source batches.
- Python compilation and server typecheck/build passed. GitNexus returned exact `LOW` impact for snapshot/freeze paths, exact approved `HIGH` impact for replay prerequisites, and `CRITICAL` change impact over 81 symbols and 75 flows without partial or truncated diagnostics.
- Task 6 was committed as Git revision `e04f1c3` with message `fix: resolve successor parent and acquired data roots`.

## Data-Lineage Ruling

- Ruling: `data/phase2/raw` plus `data/phase2/labels` is the authoritative immutable parent corpus for dataset `phase2-20260904-01`.
- Ruling: the 90 batches under `data/phase2/cycles/phase2-coverage-recovery-20260905-01/raw` remain legacy-cycle diagnostic/exclusion evidence even though their filesystem timestamps are on `2026-09-06`; that namespace has a schema-v1 policy and inventory bound to `p2cr-20260905-01`, and it has no labels.
- Ruling: those 90 batches must not be labeled, trained, copied, renamed, replayed, or grandfathered into the successor. Successor acquisition must publish policy first and then capture into `data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01/raw`.
- Cost if wrong: successor provenance, policy-before-capture ordering, and every downstream dataset/experiment commitment would be invalid, requiring the operational cycle to be discarded and recaptured. The workflow therefore fails closed.

## Task 7: Production Verification Checkpoint

- Focused Python compile and the existing focused suite passed `37/37`; the full existing Python suite also passed `37/37`; full source/test compilation exited `0`; `pip check` reported `No broken requirements found.`
- Server verification passed `270/270`; `npm run typecheck` and `npm run build` exited `0`.
- The deterministic duplicate-detector smoke printed `duplicate-detector-smoke: PASS`.
- Read-only diagnostic screening reproduced `0` parent batch edges, `0` diagnostic multi-batch groups, maximum reference overlap `4/6`, maximum query overlap `50%`, and maximum combined overlap `50%`.
- The capture safety scan found only three comments describing the `TX43` prohibition; the legacy identity scan found only the explicit Python legacy constant and the local-shadow diagnostic-cycle validation.
- All 16 immutable historical and old-cycle hashes matched, all three old-cycle evidence files retained mode `0600`, and the immutable inventory retained exactly 90 records.
- `git diff --check` passed and generated corpus data remained unstaged. GitNexus `1.6.11` analyzed the documentation checkpoint as 15 changed symbols in one file, zero affected processes, and `LOW` risk; the command exited `0` without partial or truncated diagnostics.
- Non-blocking existing warning: the server suite emitted `MaxListenersExceededWarning` for 11 listeners on `FakeClient`; no unrelated change was made.

## Task 8: Successor Policy Activation

- Preconditions proved the successor policy, quarantine, and raw evidence were absent before activation.
- The approved no-replace commands published policy first and quarantine second under `data/phase2/cycles/phase2-coverage-recovery-v2-20260906-01`.
- Activation UTC: `2026-09-06T11:43:14.185906Z`.
- Policy SHA-256: `cfd0f5f092761b9c995d7cf27e6a1fb6fd5deb0fda63c9395f9b0ae34bbe1b68`.
- Quarantine SHA-256: `4f21682196111252fe46124c1bf28ad2fb232c7b62541956242083bedcaef3c0`.
- Detector descriptor SHA-256: `505326b55ab919f4b31f80e3ab805217a8ae5d8334a6e8af98e2fa226601e1d0`.
- Detector implementation SHA-256: `d8ebdcb338c17d61a9dde93064fcd3a54945069507a524ce6b02742ed5c97f0c`.
- Parent-final count remained `30`; diagnostic count remained `90`; diagnostic batch commitment is `5d6f810d1f9c9746a591a1448cc71ddf3fe9261fc2f68b43ae43a88101acec3e`.
- Both publications parsed as strict schema v2, matched cycle `p2cr2-20260906-01` and dataset `phase2-coverage-recovery-v2-20260906-01`, and retained mode `0600`.
- Generated policy and quarantine remain ignored operational data and were not staged.

## Sanitization

This ledger excludes secrets, private account or batch identities, raw protocol bytes, image content, manual labels, per-example model output, and sealed split contents.
