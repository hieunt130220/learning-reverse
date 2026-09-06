# Fishing Phase 2 Coverage Recovery Cycle Results

## Approval

- Plan approved for inline execution on `2026-09-06T00:40:00Z` (`2026-09-06T07:40:00+07:00`).
- Approval covers production implementation in the approved Plan. Commit, acquisition publication, manual duplicate rulings, allocation publication, candidate execution, freeze, final, replay, local shadow, push, merge, and external publication retain their separate gates.

## Workspace Baseline

- Repository: `learning-reverse`.
- Branch: `docs/fishing-phase2-transfer-bundle`.
- Baseline Git revision: `1b98635c38c80d869aeaf4e40b5c8da2d5f804d3`.
- GitNexus index: commit `1b98635c38c80d869aeaf4e40b5c8da2d5f804d3`, indexed `2026-09-05T15:12:05.699Z`, no incomplete reasons.
- Python baseline: `.venv/bin/python -m unittest discover -s tests -q` ran 37 tests, all passed.
- Server baseline: `npm test` ran 270 tests, all passed.
- Pre-existing untracked paths preserved and excluded from staging: `.agents/`, `avatar-web/fishing-ml/artifacts/phase2-selection.json`, approved Spec, approved Plan.

## Task 1 Impact Record

- `read_json`: CRITICAL, 66 impacted symbols, 23 direct callers, eight affected processes. It is consumed but not edited by Task 1.
- `publish_no_replace`: HIGH, 14 impacted symbols, four direct callers, four affected processes. It is consumed but not edited by Task 1.

## Task 1 Verification

- Added the immutable Phase 2 cycle contracts and CLI in `avatar-web/fishing-ml/src/fishing_ml/phase2_cycle.py`.
- Registered `fishing-phase2-cycle = "fishing_ml.phase2_cycle:main"` in `avatar-web/fishing-ml/pyproject.toml`.
- `.venv/bin/python -m compileall -q src/fishing_ml/phase2_cycle.py` passed on `2026-09-06`.
- Canonical `commit_ids(["b", "a"])` smoke check passed with digest `911169ddaaf146aff539f58c26c489af3b892dff0fe283c1c264c65ae5aa59a2`.
- Import-boundary inspection found only the Python standard library, Pillow, and `fishing_ml.schema`; no training, calibration, evaluation, inference, replay, game, or server imports.
- Task 1 commit step remains unapproved and unexecuted.

## Task 2 Impact Record

- Repository: `learning-reverse` (`/Users/hieunt/learning-reverse`); inline checkout on `docs/fishing-phase2-transfer-bundle`; GitNexus index is current at `1b98635c38c80d869aeaf4e40b5c8da2d5f804d3` with no incomplete reasons.
- `loadConfig`: HIGH, 19 impacted symbols, 17 direct callers, two affected probe process families. The edit is constrained to a backward-compatible nullable field whose missing-env behavior is disabled.
- `shutdown`: LOW, one direct caller, no affected process or module classification.
- `saveCanCauBatch`: LOW, four impacted symbols, two direct probe callers, two affected process families. The function remains unchanged and is reused as the immutable batch writer.
- The repository process catalog was reviewed after impact; relevant observed flows include `OnFishingMessage` and the existing probe run paths.

## Task 2 Verification

- Added `avatar-web/server/src/fishing/rx79Capture.ts` with a passive RX79-only observer, serialized immutable batch writes, socket-close/server-shutdown blocking, and exclusive inventory sealing.
- Added `avatar-web/server/src/fishing/rx79CaptureRoutes.ts` with disabled-by-default `404` behavior and owner-authenticated start/status/stop routes when configured.
- `FISHING_RX79_CAPTURE_ROOT` is nullable by default, must be absolute when enabled, and is rejected whenever supplied in production.
- `npm run typecheck` passed on `2026-09-06`.
- `npm run build` passed on `2026-09-06`.
- The forbidden source scan for `TX43`, `finishFishing`, `startFishing`, `joinPark`, and `.send(` returned no matches in the two capture modules.
- `npm test` passed all 270 server tests; the existing MaxListeners warning remained non-fatal and unchanged.
- Task 2 commit step remains unapproved and unexecuted.

## Task 3 Impact Gate

- `parse_dataset_version`: LOW, nine impacted symbols, one direct caller, no affected process.
- `compute_train_normalization`: LOW, ten impacted symbols, two direct callers, one affected experiment process family.
- `_validate_split_inputs`: HIGH, 15 impacted symbols, three direct callers, four affected process families (`run_experiment`, `confirm_final_once`, `evaluate_run`, and `evaluate_final_once`).
- The Plan's HIGH/CRITICAL stop gate fired on `2026-09-06`; no Task 3 production file has been edited pending explicit approval to continue.

## Task 3 Approval and Verification

- User explicitly approved continuing Task 3 inline despite the HIGH impact on `_validate_split_inputs` on `2026-09-06`.
- `_validate_split_inputs` itself remains byte-for-byte unchanged; the new cycle branch bypasses it only when an explicit validated `WorkingMembership` is supplied.
- Additional edit impacts: `_load` LOW/11, `load_training_episodes` LOW/10, `load_dev_episodes` LOW/13, `DatasetVersion` LOW/1, `load_dataset_version` MEDIUM/10, `dataset_version_to_json` LOW/1, and `_main_verify` LOW/3.
- `write_dataset_version` returned UNKNOWN with zero resolved callers; repository text search found no caller outside its definition before the type-only union update.
- Added strict schema-v2 parsing/serialization with exact 260 source commitment, exact 185/45/30 split commitments, immutable split mapping, exact lineage keys, and no `sourceBatches` field.
- Preserved schema-v1 construction, parsing, serialization, and historical CLI verification behavior.
- Added explicit `WorkingMembership` paths to train normalization, training episode loading, and dev episode loading; legacy callers still run the unchanged all-split validator.
- Strengthened the durable final-lock guard to require a single-link regular file; working/prefinal paths do not semantically parse `sealed-final.txt`.
- Historical schema-v1 CLI verification and round-trip passed; synthetic schema-v2 round-trip and strict rejection checks passed.
- `.venv/bin/python -m compileall -q src/fishing_ml/dataset_version.py src/fishing_ml/dataset.py src/fishing_ml/phase2_cycle.py` passed without warnings.
- `.venv/bin/python -m unittest discover -s tests -q` passed all 37 fishing-ML tests.
- Task 3 commit step remains unapproved and unexecuted.

## Task 4 Impact Record

- `_utc`, `parse_capture_inventory`, `parse_duplicate_rulings`, `_duplicate_groups`, `parse_acquisition_manifest`, `publish_acquisition`, `AllocationManifest`, `parse_allocation_manifest`, `_dataset_version_v2_document`, `publish_allocation`, `_build_parser`, and `main` returned `UNKNOWN` because the new untracked `phase2_cycle.py` is not present in the baseline GitNexus index.
- Required source/text confirmation found no caller outside `phase2_cycle.py` other than the approved `fishing-phase2-cycle = "fishing_ml.phase2_cycle:main"` console entrypoint and Plan interface documentation.
- The Task 4 changes remain isolated to the new dependency-leaf cycle module and do not modify historical dataset, training, evaluation, replay, game, or server APIs.

## Task 4 Verification

- Preserved raw UTC timestamp strings while using parsed UTC instants for capture ordering, acquisition ordering, inventory bounds, and policy-activation comparisons.
- Manual rulings are optional unless an acquired-only multi-image group exists; parser requires `approvedBy == "hieunt"` and rejects unknown, stale singleton, and parent/quarantine-touching ruling groups.
- Complete-label validation now requires exact batch identity, `complete` status, one mapping for every `imagesNew` query, and every `imgIndex` within the manifest's reference-image range.
- Duplicate screening assigns exactly one aggregate rejection reason per rejected batch, with parent/quarantine duplicate rejection taking precedence over manual rejection.
- `allocation.json` now carries the exact detector descriptor and digest; the parser validates both against the canonical detector identity.
- Dataset-version publication reuses an existing valid UTC `createdAt`, making byte-equivalent no-replace retries stable after partial or completed publication.
- Synthetic acquisition checks passed for no-ruling success, stale-ruling rejection, parent/manual duplicate rejection accounting, and incomplete-label blocking.
- Synthetic allocation publication passed twice against the same temporary root with byte-identical allocation/dataset-version artifacts; working/prefinal summaries reported `185/45/30/260` commitments without final IDs.
- `git diff --check` and `.venv/bin/python -m compileall -q src/fishing_ml/phase2_cycle.py src/fishing_ml/dataset_version.py src/fishing_ml/dataset.py` passed on `2026-09-06`.
- `.venv/bin/python -m unittest discover -s tests -q` passed all 37 fishing-ML tests.
- Task 4 Step 6 remains deferred to Task 14 because the exact commands require separately approved operational publication. Task 4 commit remains unapproved and unexecuted.

## Task 5 Impact Gate

- `_parse_config_document`: HIGH, 20 impacted symbols, two direct callers (`load_training_config`, `load_training_config_from_document`), four affected process families (`run_experiment`, `evaluate_final_once`, `freeze_run`, `confirm_final_once`), exact GitNexus result.
- `apply_augmentation_profile`: LOW, four impacted symbols, one direct caller (`_augment_v2`), no affected process family, exact GitNexus result.
- `run_training`: LOW, seven impacted symbols, two direct callers (`run_experiment`, `main`), one affected process family (`run_experiment`), exact GitNexus result.
- The Plan's HIGH/CRITICAL stop gate fired on `2026-09-06`; the user then explicitly approved continuing Task 5 inline despite the HIGH config-parser impact. The approval is limited to Task 5 production edits and does not authorize training, commit, publication, or any later operational gate.

## Task 5 Implementation and Verification

- Added strict training-config schema v3 with exactly four coverage-recovery augmentation profiles, hard-negative ratios `0.0`, `0.25`, and `0.50`, CPU-only execution, and workers fixed at `0`; schema-v1 and schema-v2 key sets and accepted tokens remain unchanged.
- Added immutable ordered `PROFILE_PARAMETERS`; the cycle standard profile is tensor-identical to historical `photometric_plus_geom` for the same stable context, while all four cycle profiles remain deterministic and bounded to raw `[0,1]` tensors before normalization.
- Extended `run_training()` with keyword-only working membership and experiment-manifest provenance. Schema v3 cannot use legacy split traversal, and explicit membership cannot use schema v1/v2.
- Cycle training validates the lowercase experiment-manifest digest, dataset-version schema v2, dataset/source/train/dev commitments, sorted unique train/dev membership, train/dev disjointness, and acquired-dev containment before opening training payloads.
- Normalization, first-epoch training, every later training epoch, and dev loading all receive the exact immutable working membership. Cycle `environment.json` uses schema v2 with dataset/source/train/dev/experiment provenance; the legacy path retains its historical schema-v1 shape.
- `.venv/bin/python -m compileall -q src/fishing_ml/config.py src/fishing_ml/phase2_training.py src/fishing_ml/train.py` passed on `2026-09-06`.
- Inline schema, immutability, augmentation identity, deterministic profile, and synthetic metadata-only provenance checks passed on `2026-09-06`.
- `.venv/bin/python -m unittest tests.test_phase2_training -q` passed all 5 focused tests; `.venv/bin/python -m unittest discover -s tests -q` passed all 37 fishing-ML tests.
- `git diff --check` passed. Task 5 Step 6 remains unapproved and unexecuted; no training or operational publication was performed.

## Terminal State

## Task 6 Impact Record

- Repository: `learning-reverse` (`/Users/hieunt/learning-reverse`); worktree: inline checkout `/Users/hieunt/learning-reverse`; index commit: `1b98635c38c80d869aeaf4e40b5c8da2d5f804d3` on `docs/fishing-phase2-transfer-bundle`.
- `calibrate_thresholds`: LOW, five impacted symbols, one direct caller (`calibrate_run`), one affected process family (`run_experiment`), exact GitNexus result.
- `calibrate_run`: LOW, eight impacted symbols, two direct callers (`main`, `run_experiment`), one affected process family (`run_experiment`), exact GitNexus result.
- The user authorized completing all tasks regardless of impact. Legacy `calibrate_run()` and its `--allow-wrong-accepted` CLI remain unchanged; the recovery CLI does not expose that override.

## Task 6 Implementation and Verification

- Added `calibrate_partition_robust_zero_wrong()` with exact 30 inherited-dev / 15 acquired-dev partition coverage, overlap and missing-batch rejection, independent non-empty zero-wrong calibration, componentwise maximum thresholds, and all-dev zero-wrong reconciliation.
- Added immutable model/candidate identity types and deterministic enumeration of exactly 24 schema-v3 CPU model configs and 48 model × calibration candidates. IDs contain only safe ASCII components and each run ID carries the first 16 hex characters of its canonical effective-config SHA-256.
- Added the fixed orchestration CLI foundation and registered `fishing-phase2-coverage-recovery`; the recovery CLI exposes no wrong-accepted override.
- Compileall, synthetic partition rejection/acceptance checks, matrix CLI checks, and `git diff --check` passed on `2026-09-06`.
- `.venv/bin/python -m unittest discover -s tests -q` passed all 37 fishing-ML tests. Task 6 Step 6 remains deferred with the other commit gates; no operational publication or training occurred.

## Task 7 Implementation and Verification

- Added a self-reconstructing no-replace experiment manifest contract with exact dataset v2 provenance, Git revision, CPU/workers/seed, ordered 24 model configs, ordered 48 candidate identities, calibration policies, promotion gate, selection order, latency protocol, and execution order. Preview does not publish; publication requires a clean tracked worktree.
- Added manifest-derived `run-model`, strict reusable-run inventory/runtime/config/checkpoint/prediction/metric/provenance validation, and immutable `reject`/`reset` adjudication that preserves interrupted run bytes before rerun.
- Added complete-label/query-coverage validation, joint and partition-robust candidate publication, exact policy-optimum verification, embedded calibration SHA-256, dataset/train/dev/experiment/checkpoint/config/prediction provenance, and exactly two candidate records per completed model.
- Added full 48-candidate accounting, exact dev promotion gate, quality-first selection, CPU one-thread 10-warmup/100-call p95 nearest-rank latency only for three-metric ties, candidate-ID final tie-break, and idempotent `SELECTED` or `NO_CANDIDATE` publication.
- Synthetic checks covered manifest preview/publication/reload, complete run/checkpoint validation, both calibration records, unique quality selection, cross-run latency tie selection, selection verification, and `NO_CANDIDATE` publication without opening final or running training.
- Compileall, CLI command-shape checks, and `git diff --check` passed; `.venv/bin/python -m unittest discover -s tests -q` passed all 37 fishing-ML tests on `2026-09-06`. Task 7 Step 7 remains deferred with the commit gates.

## Task 8 Impact Record

- `verify_freeze`: CRITICAL, 19 impacted symbols, nine direct callers, and five affected process families (`confirm_final_once`, `evaluate_final_once`, `freeze_run`, `evaluate_run`, and the phase-2 gate `main`), exact GitNexus result.
- `evaluate._inputs`: HIGH, nine impacted symbols, three direct callers, and three affected process families (`confirm_final_once`, `evaluate_run`, `evaluate_final_once`), exact GitNexus result.
- `load_frozen_matcher`: LOW, three impacted symbols, one direct caller (`serve`), no affected process family, exact GitNexus result.
- The user authorized completing all tasks regardless of impact. The historical `verify_freeze()` and `_manifest()` bodies remain immutable; Task 8 adds a separate schema-v2 path and dispatcher.

## Task 8 Implementation and Verification

- Added immutable `CycleFreezeManifest` schema v2 plus strict schema-v2 freeze verification for exact cycle/experiment/dataset/run/candidate/Git identities, source evidence digests, six model files, dataset snapshot, split checksums, opaque final commitment, and checkpoint reconciliation.
- Added `verify_frozen_bundle()` as the active schema dispatcher while preserving the historical `verify_freeze()` and `_manifest()` bodies. Existing schema-v1 bundles continue through the original verifier; active evaluation and inference consumers accept verified schema-v1 or schema-v2 bundles.
- Added cycle freeze orchestration that validates the immutable selection, candidate, calibration, run, dataset version, working membership, and final commitment before staging, verifies the staging bundle, rejects pre-existing final/replay/local-shadow terminal artifacts, and publishes the entire `frozen/` directory no-replace.
- Synthetic cycle checks covered a complete 185-train/45-dev snapshot, opaque 30-final commitment, schema-v2 freeze creation and dispatch, active evaluator loading, tamper rejection, and rejection when a terminal-path artifact already exists. No final semantic membership was opened.
- Fresh verification on `2026-09-06` confirmed the historical frozen bundle dispatches as schema v1 with run ID `p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01`; compileall completed without output, all 37 fishing-ML tests passed, and `git diff --check` exited `0`.
- Task 8 Step 6 remains deferred with the commit gates; no commit, training, final evaluation, or operational cycle publication was performed.

## Task 9 Impact Record

- Repository: `learning-reverse` (`/Users/hieunt/learning-reverse`); worktree: inline checkout `/Users/hieunt/learning-reverse`; index commit: `1b98635c38c80d869aeaf4e40b5c8da2d5f804d3` on `docs/fishing-phase2-transfer-bundle`.
- `load_gate_policy`: LOW, six impacted symbols, four direct callers, and two affected process families (`phase2_gate.main` and `confirm_final_once`), exact GitNexus result.
- `evaluate_final_once`: LOW, six impacted symbols, two direct callers, and one affected process family (`confirm_final_once`), exact GitNexus result. The historical function body remains unchanged.
- `adjudicate_final`: LOW, five impacted symbols, two direct callers, and two affected process families (`phase2_gate.main` and `confirm_final_once`), exact GitNexus result.
- `GatePolicy` and `GateReport`: LOW, one direct importing file each and no affected process family, exact GitNexus results.
- `coverage_recovery.main` returned UNKNOWN because the new untracked module is not present in the baseline graph. Repository text search found only its `fishing-phase2-coverage-recovery` console entrypoint plus its definition and Plan documentation.

## Task 9 Implementation and Verification

- Added the exact schema-v2 cycle gate policy with cycle/experiment/dataset identity, unchanged official numeric and safety thresholds, and the actual Plan-approval event timestamp `2026-09-06T00:39:34.785Z`. The source session shows `approve, inline` immediately before production execution began; no final evidence informed the policy.
- Extended strict gate parsing with a schema-v2 branch that requires the exact recovery identity, approved immutable metadata, `never-from-final`, and unchanged threshold/safety values. Schema-v1 parsing and positional policy construction remain compatible; cycle final reports carry schema-v2 cycle identity.
- Added immutable `final-command.json` preflight publication with absolute executable/argument/output paths, clean tracked-worktree digest, Git/freeze/policy/dataset/allocation digests, opaque final count/size/hash, and a one-use authorization string. Its exact schema cannot contain final batch IDs, and a failed early preflight no longer creates `final/` before prerequisites pass.
- Added `evaluate_cycle_final_once()` as a separate recovery evaluator. It verifies output absence and all pre-lock provenance, loads the schema-v3 frozen model without final semantic access, validates the recorded authorization, creates and fsyncs the exclusive lock, and only then calls `load_final_membership_after_lock()` before validating and evaluating exactly 30 sorted unique final batches.
- Final report and cycle gate report publish no-replace; the lock is never removed. CLI terminal mapping is PASS `0`, valid FAIL `3`, invalid/provenance/publication `2`, and policy/prerequisite blocked `4`.
- Fresh verification on `2026-09-06` passed compileall, exact v1/v2 policy parsing, static lock-before-membership source ordering, CLI command-shape checks, authorization-mismatch rejection before lock creation, and a synthetic mocked PASS path that retained the lock and published both reports without opening real final data.
- `.venv/bin/python -m unittest discover -s tests -q` passed all 37 fishing-ML tests and `git diff --check` exited `0`. Task 9 Step 7 remains deferred with the commit gates; no real final preflight, final process, final lock, final report, or gate report was created.

## Terminal State

- Current state: Task 9 Steps 1–6 complete; Task 10 production implementation is next. No commit, training, final evaluation, replay, or operational cycle publication has been performed.

## Task 10 Impact Record

- Repository: `learning-reverse` (`/Users/hieunt/learning-reverse`); worktree: inline checkout `/Users/hieunt/learning-reverse`; index commit: `1b98635c38c80d869aeaf4e40b5c8da2d5f804d3` on `docs/fishing-phase2-transfer-bundle`.
- `replay_batches`: LOW, two impacted symbols, one direct caller (`replay.main`), no affected process family, exact GitNexus result.
- `adjudicate_replay`: LOW, four impacted symbols, two direct callers (`experiments._cmd_adjudicate_replay`, `phase2_gate.main`), and one affected process family (`phase2_gate.main`), exact GitNexus result.
- `_freeze_identity`: LOW, four impacted symbols, one direct caller (`adjudicate_replay`), and one affected process family (`phase2_gate.main`), exact GitNexus result.
- The user authorized continuing all remaining implementation tasks inline regardless of impact. Task 10 itself remained LOW; no replay, final access, publication, commit, or later operational gate was authorized.

## Task 10 Implementation and Verification

- Extended `replay_batches()` with optional explicit membership while preserving legacy directory enumeration when `batch_ids` is absent. Explicit membership requires exactly 260 sorted unique path-safe IDs, rejects control characters, lone surrogates, and components above 255 UTF-8 bytes, never calls `os.listdir()`, and accounts for every missing/non-directory member as a replay error.
- Added replay prerequisites that require complete reconciled final PASS evidence, schema-v2 freeze/policy identity, exact successor membership reconstructed from 185 train + 45 dev + 30 final IDs, source commitment equality, and zero quarantined parent-final IDs.
- Added immutable `replay-command.json` preflight evidence, strict absolute input/output path matching, loopback-only endpoint and free-port validation, exact service/invocation vectors, and no-replace command publication.
- Added `replay-run` lifecycle enforcement with one child PID, no-replace PID/report/gate/log artifacts, sanitized lifecycle events, readiness and model identity checks, exact explicit-membership replay, termination/wait/kill fallback, and verified port closure in `finally`.
- Replay gate publication now occurs only after cleanup. Shutdown or lifecycle uncertainty is recorded as an operational blocker; valid mandatory quality failures retain `REPLAY_FAIL`, while pass-quality evidence plus operational uncertainty becomes `REPLAY_BLOCKED`. Pre-service command/schema/path failures on `replay-run` map to blocked exit `4`.
- Existing schema-v1 gate/replay behavior remains compatible. The focused historical gate suite passed all 6 tests; synthetic schema-v2 checks passed PASS, identity-blocked, and wrong-accepted failure branches.
- Synthetic explicit-membership verification processed all 260 named members with `os.listdir()` patched to fail, counted 260 missing directories, and rejected control-character, overlong, and surrogate IDs.
- Mocked lifecycle verification proved gate publication occurs after child wait, normal shutdown yields `REPLAY_PASS`, uncertain shutdown yields an operationally blocked gate, and a proven wrong-accepted failure still yields `REPLAY_FAIL` with the blocker retained.
- Fresh `.venv/bin/python -m compileall -q src/fishing_ml` and `.venv/bin/python -m unittest discover -s tests -q` verification passed all 37 fishing-ML tests on `2026-09-06`; `git diff --check` exited `0`.
- The exact pre-final-PASS `replay-preflight` command exited `4` with `{"error": "replay requires complete final PASS evidence", "status": "BLOCKED"}`. Port `18080` remained closed and no replay directory was created before or after the command.
- Task 10 Step 6 remains deferred with the commit gates; no real final membership, inference service, replay request, replay report, replay gate, training, or operational publication was performed.

## Terminal State

- Current state: Task 10 Steps 1–5 complete; Task 11 production implementation is next. No commit, training, final evaluation, replay, local-shadow run, or operational cycle publication has been performed.

## Task 11 Impact Record

- Repository: `learning-reverse` (`/Users/hieunt/learning-reverse`); worktree: inline checkout `/Users/hieunt/learning-reverse`; index commit: `1b98635c38c80d869aeaf4e40b5c8da2d5f804d3` on `docs/fishing-phase2-transfer-bundle`.
- `runShadowMatch`: LOW, four impacted symbols, one direct caller (`maybeShadowMatch`), and two affected probe process families, exact GitNexus result. No existing gameplay/shadow call site was edited.
- TypeScript `InferenceClient` in `avatar-web/server/src/fishing/inferenceClient.ts`: LOW, five impacted symbols, two direct consumers (`shadowMatcher.ts`, `getClient`), and one affected probe process family, exact GitNexus result. The existing client implementation and protocol remain unchanged.
- The user authorized continuing remaining production tasks inline regardless of impact. Task 11 remained LOW and did not authorize an operational local-shadow fixture run, commit, or production shadow enablement.

## Task 11 Implementation and Verification

- Added `LocalShadowCycleController` with one injected `InferenceClient`, controller-local kill state, image-only request projection, allowlisted result sanitization, and exactly one swallowed continuation invocation in `finally` for every case. Calls after `kill()` return `disabled` before reading payload fields or invoking HTTP.
- Added an exact six-case local fixture runner in the required order: `success`, `timeout`, deliberate accepted-socket close for `unavailable`, `malformed_response`, `wrong_model_identity`, and `post_kill_switch_disabled_before_http`. One loopback server, one port, one client, and one controller are used; the final case cannot increment the server request counter.
- The CLI requires immutable expected SHA-256 values for the replay gate, quarantine ledger, and fixture manifest; validates cycle replay PASS, exact quarantine schema, non-quarantined fixture batch identity, exact manifest/image checksums, safe contained regular files, and 75×75 RGB/RGBA PNG headers before binding the server.
- Added exclusive no-replace `0600` aggregate report publication with exact keys only. Case entries contain only `name`, `status`, and an allowlisted `errorCode`; request bodies, base64, predictions, model IDs, gameplay/account fields, packet bytes, cookies, and credentials are never persisted.
- Registered `npm run fishing:local-shadow-cycle`. Production shadow defaults and existing gameplay/shadow call sites remain untouched; enablement is constructed only inside this process-local CLI.
- Initial synthetic execution exposed a 40 ms first-request timeout (`63 ms` observed). A direct two-timeout diagnostic confirmed 40 ms timed out while 250 ms completed in 36 ms; the deterministic fixture timeout was corrected to 250 ms, with the timeout case delaying four times that bound.
- A fresh synthetic run in `/tmp` produced `PASS` with exact counts `caseCount=6`, `continuationCount=6`, `httpRequestCount=5`, `gameplaySideEffectCount=0`, exact expected case statuses/error codes, report mode `0600`, no forbidden report tokens, and a closed port after completion. A second run against the same output returned `LOCAL_SHADOW_BLOCKED/output_exists` before rebinding.
- A quarantined synthetic fixture returned `LOCAL_SHADOW_BLOCKED/invalid_input`, created no report, and left the selected port closed, confirming rejection before HTTP.
- Fresh `npm run typecheck`, `npm run build`, `git diff --check`, and the required forbidden-call scan passed on `2026-09-06`; the scan returned no matches for the prohibited gameplay/network mutation patterns.
- Task 11 Step 6 remains deferred with the commit gates; no operational replay evidence, approved local fixture, production shadow process, gameplay request, commit, or external publication was performed.

## Terminal State

- Current state: Tasks 1–11 production implementation is complete except deferred commit/operational steps; Task 12 verification is next. No commit, training, final evaluation, real replay, operational local-shadow run, or cycle publication has been performed.

## Task 12 Verification

- Step 1 focused existing Python suites: `tests.test_phase2_training`, `tests.test_phase2_experiments`, `tests.test_phase2_gate`, `tests.test_phase2_recovery`, and `tests.test_inference_size_contract` passed 37/37 tests on `2026-09-06`.
- Step 2 full Python verification: `unittest discover` passed 37/37; `compileall -q src tests` exited `0`; `pip check` reported `No broken requirements found.`
- Step 3 full server verification: `npm test` passed 270/270; `npm run typecheck` exited `0`; `npm run build` exited `0`. The pre-existing `MaxListenersExceededWarning` remained non-fatal.
- Step 4 historical SHA-256 verification compared all 30 immutable paths listed in Global Constraints: `verified=30 mismatches=0`. The command used `shasum -a 256` only and did not open historical-final semantic contents.
- Step 4 `git diff --check` exited `0`; scoped diff contained 15 tracked files, 2,004 insertions, and 109 deletions. No staging was performed, and the forbidden untracked `.agents/` plus `avatar-web/fishing-ml/artifacts/phase2-selection.json` remained untracked and unstaged.
- Step 5 privacy scan produced one match: `docs/superpowers/plans/2026-09-05-fishing-phase-2-coverage-recovery-cycle-results.md:215`, the explicit redaction-policy sentence. The forbidden-action scan for `TX43|finishFishing\(|startFishing\(|joinPark\(` returned no source match.
- Step 6 first attempted `node .gitnexus/run.cjs detect-changes --scope all --repo .`. The selected `pnpm dlx` runner failed during `@ladybugdb/core@0.19.1` installation: its darwin-arm64 prebuilt optional package was not present, and its installer attempted to run in a nonexistent packaged source directory, producing `spawnSync /bin/sh ENOENT`.
- Step 6 fallback used the exact indexed CLI version `npx gitnexus@1.6.11 detect-changes --scope all --repo .`, which exited `0` with no `partial` and no `truncated` result.
- Step 6 GitNexus result: 15 files, 99 changed symbols, 47 affected execution flows, and risk `critical`. Named changed symbols included `_git_revision`, `_split_ids`, `build_dataset_snapshot`, `freeze_run`, `verify_current_dataset`, `calibrate_run`, `config_to_document`, `_parse_config_document`, and `replay_batches`, with 84 additional symbols omitted by the tool.
- Step 6 named affected flows included `Evaluate_run`, `Evaluate_final_once`, and `Replay_batches` paths, with 37 additional flows omitted by the tool. No production file was edited during Task 12, and no in-scope verification failure was found.

## Active Cycle State

- Current state: Task 12 Steps 1–6 are complete with fresh evidence; Task 12 Step 7 commit remains separately gated and unapproved. Task 13 acquisition is active. No terminal state is currently recorded.
- No commit, training, final evaluation, real replay, operational local-shadow run, or cycle publication has been performed.

## Task 13 Acquisition Gate

- Step 1 pre-policy historical SHA-256 verification completed on `2026-09-06` with `verified=30 mismatches=0`.
- The exact policy command was materialized for review but not executed:
  `cd avatar-web/fishing-ml && .venv/bin/fishing-phase2-cycle publish-policy --output data/phase2/cycles/phase2-coverage-recovery-20260905-01/acquisition-policy.json`
- The initial readiness check found `.venv/bin/fishing-phase2-cycle` missing because the editable installation metadata predated the new `pyproject.toml` entrypoint. Running `.venv/bin/python -m pip install -e . --no-deps --no-build-isolation` synchronized the existing virtual environment without changing production code; `.venv/bin/fishing-phase2-cycle publish-policy --help` then exited `0`.
- User explicitly approved publishing policy and quarantine on `2026-09-06`.
- Step 1 executed: `data/phase2/cycles/phase2-coverage-recovery-20260905-01/acquisition-policy.json` published with mode `0600`, size 527 bytes, SHA-256 `cc63156b6e52262622dc16852e89e114c5169c760bf277f853beb582a6b67e8a`. Contains `activatedAt: 2026-09-06T05:15:00.519543Z`, `cycleId: p2cr-20260905-01`, `targetEligibleBatchCount: 90`.
- Step 2 executed: Initial quarantine publish failed because `_read_ids` required byte-sorted IDs, whereas the historical parent `final.txt` was not sorted. Fixed `_read_ids(..., require_sorted=False)` for parent split reads while preserving strict `require_sorted=True` for cycle splits. Verified with unit tests passing 37/37.
- Step 2 quarantine published: `data/phase2/cycles/phase2-coverage-recovery-20260905-01/quarantine.json` with mode `0600`, size 1193 bytes, SHA-256 `1e4e69a7811ab51264c119f91be4113fe4b01ba5cb7a8def37c4dcfb79186740`. Contains exactly 30 sorted batch IDs from parent `final.txt`, parent dataset version digest `406be8ed9fc097adcdaf6c3446addd4bf94c909d3a299cca8ce1304da35b0807`, and parent final split digest `e92e14e94b3883ecc62958b5396cd9b6d1b6edd9778a590203564083508cb045`.
- Tasks 13 Steps 1-2 complete.
- A premature `NO_DATASET` checkpoint was retracted on `2026-09-06` after the user resumed acquisition. The associated 90 synthetic raw directories, 90 synthetic labels, and synthetic capture inventory were removed; the immutable policy and quarantine hashes remained unchanged.
- User selected operational option `1`: acquire 90 real batches with the existing active crawler. The crawler sends `TX45`, `TX41`, and `TX44`, never `TX43`. This is recorded as an explicit deviation from the approved passive-only capture procedure and must not be represented as passive capture evidence.
- A non-crawl one-batch probe previously joined the requested map/area and observed RX79 traffic but saved no batch; that invocation omitted `--crawl`, so it is not evidence that the crawler save path fails. Temporary login rate limiting was observed afterward and must be allowed to clear before the real crawl.
- Active crawl completed on `2026-09-06`: one smoke batch plus 89 continuation batches produced exactly 90 unique real raw batches, 540 reference images, and 460 query images. All 90 manifests and referenced PNG SHA-256 values validated, all captures occurred after policy activation, and the crawler reported two recovered RX79 timeouts with zero save errors.
- Capture inventory was sealed no-replace at `data/phase2/cycles/phase2-coverage-recovery-20260905-01/evidence/capture-inventory.json`: exactly 90 chronological records, mode `0600`, SHA-256 `c133238289a9d36dddc0861d4ac2c0347814b9d231fcb2c75560d33645647c53`.
- Pre-label duplicate screening found zero exact SHA-256 overlap with parent images, but every acquired batch has at least one direct 64-bit dHash match within the specified Hamming threshold `4`. The current Spec therefore classifies all 90 batches as parent-duplicate batches and yields an eligibility upper bound of `0` before manual rulings.
- Parent data uses map/area `14/0`; the acquired data uses `14/1`, confirming a different board still shares the same visual asset pool. A bounded smoke on native map `5/0` received repeated fishing-start rejection and saved zero batches, so it does not provide an alternate fishing asset pool.
- Task 13 Steps 3-7 remain incomplete pending a decision whether to amend the near-duplicate eligibility contract or preserve it and terminate `NO_DATASET`. Task 19 Steps 1-4 remain incomplete, and no terminal handover is active.
