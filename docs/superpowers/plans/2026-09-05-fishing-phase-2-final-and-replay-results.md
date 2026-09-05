# Fishing Phase 2 Final and Replay Results

Recorded at: 2026-09-05T02:02:19.616120+00:00

## Task 1 — PASS

- Root: `/Users/hieunt/learning-reverse`
- Branch: `docs/fishing-phase2-transfer-bundle`
- HEAD: `aebbbe5a01affddebf7e0c7e8244e6a1e1fd3288`
- Baseline status: only the untracked approved Spec and Plan; no production/config changes.
- Read AGENTS.md, CLAUDE.md, Spec, Plan, transfer HANDOVER.md, RESTORE.md and SHA256SUMS.
- `pwd`, `git branch --show-current`, `git rev-parse HEAD`, `git status --short`, `git log --oneline -8`: exit 0.
- Config `rg` checks: exit 0; device cpu; placeholders, notTunedOnPhaseAFinal and requireZeroWrongAccepted true.
- `node --version`: v24.19.0, exit 0. `python3 --version`: 3.14.2, exit 0; approved project Python environment not yet verified.
- finalDataOpened: false
- liveShadowRun: false
- tx43Sent: false
- finishFishingCalled: false
- Commit gate: no-op as required; no commit authorization.

## Task 2 — PASS

- Initial index commit: `3903d33356c845c56feaf7b69972c65f321abcf2`.
- Embeddings: 0.
- Runner: `.gitnexus/run.cjs` exists; CLI 1.6.10.
- Initial default invocation exited 1: pnpm bootstrap failed in @ladybugdb/core with spawnSync /bin/sh ENOENT. The wrapper had attempted package-cache installation; no project dependency declaration was changed.
- Reused existing installed runner with `PATH="/Users/hieunt/.npm/_npx/e46929201c1128dd/node_modules/.bin:$PATH" node .gitnexus/run.cjs analyze --index-only`: exit 0, CLI 1.6.11, 103.8 seconds. Index HEAD now equals approved HEAD; 17,289 nodes, 60,369 edges, 577 flows, embeddings 0.
- Applied GitNexus CLI/impact skills. Existing checkout retained because the approved operational plan fixes this root and revision; no new worktree or branch created.
- Four `impact SYMBOL --direction upstream --repo . --include-tests --depth 3` commands through the same installed-runner PATH: each exit 0, risk LOW, epistemic exact.

| Symbol | Direct callers | Total impacted |
| --- | --- | ---: |
| _validate_manifest_current_provenance | _current_candidate_result, _resolve_selected_result | 7 |
| _validate_selection_document | _validate_selection_current, _validate_selection_for_spec | 9 |
| _validate_selection_current | _resolve_and_validate_selection, _resolve_selected_result, _validate_selection_artifact_after_publish | 7 |
| _resolve_selected_result | _resolve_selected_result_from_args | 4 |

- Graph reports one affected Fishing_ml module and zero named processes for each symbol. Whole-index process enumeration emitted truncation warnings, so zero named processes is not evidence of no affected workflow. Source cross-check confirms reuse/compare/freeze/final callers; all direct call sites read and confirmed.
- Commit gate: no-op; no commit.

## Task 3 — PASS

Transfer checksum command: `shasum -a 256 -c SHA256SUMS`, exit 0, all four entries OK. Exclusive staging restore script: exit 0. All 27 operational targets were absent before placement; no merge or overwrite. Validated member type/path policy; zero rejected substantive entries.

- fishing-phase2-dataset.tar.gz: 7370 members, 3685 AppleDouble exclusions; archive SHA-256 `def1e5d845ea7386de8bf2e5a16488080416b3545fa3c487c60a3aa3046a4e99`.
- fishing-phase2-artifacts.tar.gz: 552 members, 276 AppleDouble exclusions; archive SHA-256 `519992aa0b165f7012c4b53059c2dbb0ad71c146b5c44cd93cb106bb70779838`.
- `data/phase2/dataset-version.json`: SHA-256 `406be8ed9fc097adcdaf6c3446addd4bf94c909d3a299cca8ce1304da35b0807` verified before placement.
- `artifacts/phase2-selection.json`: SHA-256 `4c15e952eef67f7291a306d2eedc8277ca86601286b301538e8c03335dc71f1f` verified before placement.
- `artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen/freeze-manifest.json`: SHA-256 `ed1bbe4f9b24980c0277ace6da5d3b320b9f51a2b33f39c18c52e73beeed64ab` verified before placement.
- `artifacts/p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01/frozen/best-dev.pt`: SHA-256 `6168b65abaf8ade9008c9611413167f76533d1e80926b2be852df6e7e3a67789` verified before placement.
- 24 candidate manifests; 9 selected frozen files. Staged roots renamed into operational locations; only empty staging directories removed.
- finalDataOpened: false (archive bytes copied without interpreting final content).
- No commit; generated artifacts remain operational.

## Task 4 — Initial coverage blocker (resolved by subsequent user approval)

- Read all of `tests/test_phase2_experiments.py` and searched existing tests for relocation/current-provenance/symlink fixtures. The four cases cover matrix enumeration, ordering, manifest parser tampering and immutable selection publication.
- `result_for` uses `/synthetic/<runId>` and `manifest_for` builds metadata only. There is no complete operational run-output fixture or relocated end-to-end validation fixture; existing cases do not exercise the requested revision/path boundary.
- Task 4 Step 1 explicitly requires test authorization for this gap. Proposed bounded addition to the existing test module, after production implementation: complete temporary run fixture; same-root and approved transfer positive cases; wrong run ID, non-artifacts parent, relative/traversal path, inconsistent thresholds, unapproved revision, symlink and checksum rejection; immutable archived document verification.
- No production or test file changed. No TDD performed. Step 1 remains unchecked because its acceptance condition is not met.

## Tasks 5–9 — Initial state before resumption

Blocked on Task 4 coverage authorization. Environment, focused suite, strict candidate validation and production freeze verifier have not yet run. Gate policy remains unchanged and unapproved; final invocation count 0; replay NOT RUN. No final terminal outputs were present in restored archive inventory.

## Task 10 — PARTIAL handover at authorization boundary

- Restored `artifacts/phase2-selection.json` is untracked, not ignored by the current repository rules. It is immutable operational input and must never be staged/committed. No ignore rule changed.
- No live shadow, TX43, finishFishing, gameplay mutation, commit, push, merge or publication executed.

- `detect-changes --scope all --repo .`: exit 0, No changes detected (no tracked source edits; untracked documentation is not covered by this result). No partial/truncated result was returned.
- `git diff --check`, tracked diff stat and staged diff stat: exit 0, empty.
- Mutable ledger/handover privacy scan: zero matches; manually reviewed aggregate-only content.
- Task 10 remains partial: final operational handover will be refreshed after execution resumes.

## Resume after explicit test authorization

User replied `ok` to the bounded test-addition request. Tests may be added to the existing module after production code; no TDD. Task 4 resumed. Task 5 environment setup is pulled forward as explicitly permitted by Task 4 Step 5 because .venv is absent.

## Task 4 — PASS after authorization

- User explicitly authorized additional tests with `ok`; production written before new tests. Eleven synthetic tests added to the existing test module, covering complete run outputs, both resolvers, malformed archived paths, traversal, canonical manifest, exact/directional revision pair, mixed selection/frozen revisions, all operational symlink levels, checksum failures, immutable evidence and selection publication/idempotence. Original tests remain unchanged.
- Exact allowlist: current `aebbbe5a01affddebf7e0c7e8244e6a1e1fd3288` → recorded `8ca1f93990dcd06a0b7d6ee6251100e67a155365`. Exact equality remains valid. No arbitrary ancestry accepted.
- Runtime-only copies replace run/threshold paths after validation; archived documents and recorded revision remain unchanged.
- Additional necessary integration: `_current_candidate_result` returns operational paths; `_validate_frozen_identity` uses the same compatibility rule while retaining exact candidate/freeze revision equality; `write_selection` validates compatibility before publication and publishes the recorded candidate revision.
- GitNexus upstream impacts before edits: manifest validator LOW/7, selection document LOW/9, selected resolver LOW/4, current candidate resolver LOW/4, frozen identity LOW/2, relocated helper LOW/8, selection writer LOW/1 (caller `_cmd_compare`). Source callers cross-checked. `_cmd_compare` itself returned UNKNOWN and was not edited.
- Independent review identified the publication issue; corrected in `write_selection` and verified new publication, repeated publication, and rejection without creating a file. Reviewer otherwise found relocation validation sound.
- Focused command: `.venv/bin/python -m unittest tests.test_phase2_training tests.test_phase2_experiments tests.test_phase2_gate tests.test_inference_size_contract -q`: 30 tests, exit 0 (0.431s). Earlier baseline 19 and intermediate 29 tests also passed. A temporary inherited test class caused one 40-test run; removed duplication before final 30-test run.
- Full opaque archive comparison: 3,063 dataset files and 226 artifact files (3,289 total) byte-identical to the SHA-verified transfer archives. No archived identity or hash changed; no dataset/snapshot content interpreted.
- No commit.

## Task 5 — PARTIAL / blocked by contradictory pre-final requirements

- Environment created with Python 3.12.13 using the plan commands. Editable install initially selected torch 2.14.0 under declared bounds; installed declared torch at exact approved 2.13.0 before verification. No dependency declaration changed.
- Runtime packages match frozen primary versions: torch 2.13.0, numpy 2.5.2, Pillow 11.3.0, scikit-image 0.25.2, PyYAML 6.0.3. Runtime macOS 26.4 arm64 versus frozen macOS 26.2 arm64; device remains CPU.
- Namespace commands raw/labels/splits: exit 0, all beneath data/phase2. Dataset-version production verify: exit 0; source batch list suppressed from output. `experiments list`: exit 0, exactly 24 canonical candidates.
- Strict read-only internal `_validate_current_candidate` for all 24 plus `_resolve_selected_result`: exit 0. 24/24 CPU, 24/24 zero wrong accepted; complete enumerated manifest set, full existing output validation.
- Winner: `p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01`; recorded revision unchanged; accepted rate 0.6124401913875598, top-1 0.9808612440191388, batch exact 0.9333333333333333.
- Four trusted hashes reverified unchanged; all 8 frozen payload hashes and exact 9-file regular inventory verified without parsing dataset snapshot. Terminal filename scan empty.
- NOT RUN: production dataset validator. Source `validate_dataset` visits every raw batch and `_label` loads every label, including final labels. No split exclusion exists.
- NOT RUN on restored artifacts: production `verify_freeze`. Source parses `dataset-snapshot.json`, which contains final membership and labels. It was exercised only on synthetic test fixtures.
- These commands conflict with the Global Constraint that final labels/content remain sealed until the authorized one-shot invocation. Opaque hash checks are evidence of byte integrity, not a claim that full semantic validation ran. Task 5 Steps 3 and 5 remain unchecked.

### Proposed boundary amendment — pending user approval

Keep final content sealed. Before final, use exact inventory and all trusted payload hashes, plus byte equality of every restored file to the verified archives; validate dataset-version schema and all 24 candidates on train/dev as already performed. Defer full dataset semantic validation and snapshot parsing to the separately authorized one-shot stage. Do not claim the 200/1,375/six-issue validator result was re-run before final; retain it as transfer evidence only. All policy and immediate one-shot authorization gates remain required. This amendment changes verification sequencing, not gate thresholds or artifact trust.

## Tasks 6–9 — NOT RUN after resumption

Policy remains placeholder and lacks explicit threshold/metadata approval. Final invocation count 0; replay and local service NOT RUN. No live shadow, TX43, finishFishing or gameplay mutation. No commit/push/merge/publication.

Latest verification: 30 tests pass (0.574s), pip check exit 0, no broken requirements. GitNexus index refreshed after source/test edits (exit 0). Mutable ledger/handover privacy scan zero matches. Staged diff empty; no commit.

## Task 5 — PASS under approved sequencing amendment

User approved the proposed boundary amendment with `ok`. Spec and Plan now record its precedence over pre-final semantic verifier instructions. Task 5 Steps 3/5 checked for the approved pre-final scope; deferred semantic validation remains explicitly required in Task 8.

Fresh read-only verification exited 0: exact HEAD, 24 strict candidate validations, zero wrong accepted for all, selected resolution, four trusted hashes, exact 9-file frozen inventory/all payload hashes, and absent terminal outputs. No snapshot parsed; finalDataOpened remains false. Prior full archive byte comparison remains recorded evidence; no operational writes since it ran.

## Task 6 — WAITING for explicit policy approval

All proposed values are unchanged from the approved plan. User must approve every threshold and supply/approve real approvedAt (UTC ISO-8601), approvedBy and durable evidence reference, confirming no final evidence informed the decision. gate.yaml remains unchanged and preAgreedPlaceholders true. This request does not authorize final execution.

## Task 6 — IN PROGRESS after complete approval

- User first approved all proposed thresholds with `oke`, then explicitly confirmed the exact metadata: `approvedAt=2026-09-05T04:33:21Z`, `approvedBy=hieunt`, and evidence `Codex task 01a06f4b-932b-71c0-861d-a4a5cbba1e2c — explicit user approval`; user also confirmed that final evidence did not inform the thresholds.
- Updated only the approved fields in `config/phase2/gate.yaml`: placeholders false, coverage 0.60/0.90/0.98, unchanged latency 50/100/250, unchanged error budgets and safety booleans, plus exact approval metadata.
- Production `load_gate_policy` parsed every normalized field and explicit assertions passed. Gate-policy SHA-256: `a6595257ef073338cdeafadca3371ab568697e8e045fe3d696542b8584e07a83`.
- `tests.test_phase2_gate` ran 6 tests: 5 passed and 1 failed. The failing test is `test_checked_in_policy_is_placeholder_and_not_tuned_on_final`, which hard-codes the superseded pre-approval condition `pre_agreed_placeholders == True`. Production parsing and the five behavior/immutability tests passed.
- Task 6 Step 5 remains incomplete. The earlier test authorization was explicitly limited to relocation/provenance coverage, so the existing gate test has not been changed without separate authorization. No final command was run.

## Task 6 — PASS

- User explicitly authorized updating the superseded gate test with `oke`. GitNexus reported `UNKNOWN` because unittest discovery is dynamic; source search found the method only at its definition and confirmed the production policy consumers separately. The test now asserts the exact approved policy and metadata.
- `tests.test_phase2_gate -v`: 6 tests passed, exit 0. Full focused suite: 30 tests passed, exit 0. `pip check`: exit 0, no broken requirements. `git diff --check`: exit 0.
- Gate-policy SHA-256 remains `a6595257ef073338cdeafadca3371ab568697e8e045fe3d696542b8584e07a83`.
- Task 6 is complete and checked in the Plan. No commit and no final invocation.

## Task 7 — PREFLIGHT PASS; awaiting immediate one-shot authorization

- HEAD remains exactly `aebbbe5a01affddebf7e0c7e8244e6a1e1fd3288` on `docs/fishing-phase2-transfer-bundle`.
- Controlled tracked changes are limited to reviewed relocation-safe `experiments.py`, authorized relocation/gate tests, and approved `gate.yaml`. Untracked documents are the approved Spec/Plan, this ledger and handover; untracked `artifacts/phase2-selection.json` is the restored immutable operational input and must not be staged. No staged files and no commit.
- Immediate preflight script exited 0. Trusted hashes: dataset `406be8ed9fc097adcdaf6c3446addd4bf94c909d3a299cca8ce1304da35b0807`; selection `4c15e952eef67f7291a306d2eedc8277ca86601286b301538e8c03335dc71f1f`; freeze manifest `ed1bbe4f9b24980c0277ace6da5d3b320b9f51a2b33f39c18c52e73beeed64ab`; checkpoint `6168b65abaf8ade9008c9611413167f76533d1e80926b2be852df6e7e3a67789`; gate policy `a6595257ef073338cdeafadca3371ab568697e8e045fe3d696542b8584e07a83`.
- Selection resolved through relocation-safe validation to the trusted run. Recorded revision remains `8ca1f93990dcd06a0b7d6ee6251100e67a155365`, accepted only through the exact approved pair. Candidate device is CPU.
- Exact frozen inventory has 9 regular files and all 8 payload hashes match. Per the approved sequencing amendment, the dataset snapshot was not parsed and production `verify_freeze` remains deferred until after the authorized one-shot opens final.
- Gate parser confirms placeholders false, complete approval metadata, exact official thresholds, final-not-tuned true, zero omission, single model identity and zero wrong accepted.
- Selected-run filename-only scan found no `final-evaluation.lock`, `final-evaluation.json`, or `gate-final.json`. Confirmation token is byte-for-byte the selected run ID. `finalDataOpened: false`; final invocation count remains 0.
- Exact command was materialized but not run. Task 7 Step 6 remains unchecked pending a new explicit authorization for exactly one invocation.

## Task 7 — PASS

- User explicitly authorized the displayed command with the exact response `phê duyệt chạy final đúng một lần`.
- Immediate post-authorization preflight exited 0: all five trusted/policy hashes, selected ID, CPU device, approved gate metadata and terminal-file absence revalidated. Final remained unopened at completion of preflight.
- Task 7 Step 6 and the task are checked complete. Authorization covers exactly one invocation and no retry.

## Task 8 — INVALID / durable stop after exactly one invocation

- Authorized command invocation count: exactly 1. Start `2026-09-05T05:47:58.763773+00:00`; end `2026-09-05T05:48:07.144193+00:00`; raw exit status `2`.
- Classification: invalid input/provenance. Sanitized stderr: `error: frozen Git revision does not match current revision`. Stdout was empty.
- Root cause location confirmed read-only in `evaluate.evaluate_final_once`: it calls `verify_freeze`, then requires frozen revision to equal current HEAD before dataset validation or opening the final split. The relocation compatibility added to `experiments.py` did not reach this evaluator check.
- Because the error occurs before `verify_current_dataset`, `final.txt` and final labels were not opened. `finalDataOpened: false` remains true based on source control flow and empty terminal inventory.
- Created terminal files: none. Filename scan confirms `final-evaluation.lock`, `final-evaluation.json`, and `gate-final.json` are all absent, so there are no terminal artifact hashes.
- Wrapper metadata SHA-256 `0e480b0decce1edd7c8bba14516f2751e9a27108ea7329a9e17231f8ae446f3b`; empty stdout SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; stderr SHA-256 `50e24093bd921af1af496bd4c71c7bcfc9ee343ac2b9bed7656ead4b1a328641`. Temporary files remain under `/private/tmp/fishing-phase2-final-rmfcl2d1/` for local adjudication and are not repository artifacts.
- Per Task 8 exit-2 branch: final is INVALID/BLOCKED, no rerun is permitted, and replay is not authorized. Deferred semantic dataset/freeze checks were not run because the one-shot stopped before opening final; running them now would violate the sealed-final boundary.
- Task 8 is complete for the actual invalid branch and checked in the Plan. No commit.

## Task 9 — NOT RUN

- Replay prerequisites require final exit 0. Actual final exit is 2, so inference service, replay, adjudication and replay outputs were not run or created.

## Task 10 — PASS for final INVALID branch

- Ledger records Tasks 1–7 PASS, Task 8 INVALID/BLOCKED after one invocation, and Task 9 NOT RUN. No skipped stage is represented as successful.
- Privacy scan covered this ledger, final handover, and the temporary metadata/stdout/stderr evidence. It found no credential/token/cookie/password keys, account/user identifiers, packet/decrypted byte fields, image/base64/data-URI payloads, or per-example prediction/error arrays. Manual review confirms the only stderr is the sanitized revision mismatch and stdout is empty.
- Final handover records revision/status, approved gate metadata/hash, trusted artifact identities, restore provenance, compatibility change, invocation count/status, absence of terminal artifacts, replay status and exact recovery constraint.
- Final GitNexus `detect-changes --scope all --repo .`: exit 0; 4 files and 33 symbols changed; risk LOW; zero named affected processes; output did not report partial or truncated analysis. The relevant candidate selection/final resolution symbols were reviewed. The uncovered strict evaluator check is unchanged and prominently recorded as the reason for the invalid outcome.
- `git diff --check`: exit 0. Complete tracked diff reviewed: gate config, relocation-safe experiment validation, authorized existing test modules only. Staged diff is empty. Restored dataset/checkpoint/run roots remain ignored; untracked immutable selection JSON is explicitly excluded from any future staging. No generated final/replay artifact exists.
- No commit was authorized, so the optional commit step is a checked no-op. No push, merge or publication.
- Live scope stopped: `liveShadowStatus: not-run`; TX43 not sent; `finishFishing()` not called; gameplay not mutated.
- Task 10 is complete for the actual early-stop branch and checked in the Plan.

## Recovery cycle — implementation and preflight

- Recovery Spec and Plan were explicitly approved by user with `oke` and `duyệt`. User also authorized focused tests after production code. No final invocation authorization is implied by either approval.
- Correct immutable revision pair, verified against Git HEAD, existing selection/freeze evidence and the prior implementation: current `aebbbe5a01affddebf7e0c7e8244e6a1e1fd3288` → recorded `8ca1f93990dcd06a0b7d6ee6251100e67a155365`.
- Added shared `provenance.revision_matches_recorded`; experiment orchestration, dev/final evaluation and frozen inference loading now use the same exact ordered pair. `train.py` and new-freeze creation remain strict.
- Final evaluation now creates and fsyncs an exclusive lock, then fsyncs its parent directory, before `verify_current_dataset` can inspect final data. The lock records run ID, PID and UTC start time and is retained on success or any later failure.
- GitNexus impact from the recovery investigation identified two direct callers of `evaluate_final_once` and one caller of `load_frozen_matcher`; affected scope is evaluation/orchestration/service, risk MEDIUM with no HIGH/CRITICAL result. A repeat CLI attempt was blocked by GitNexus native dependency bootstrap (`spawnSync /bin/sh ENOENT`), so the already collected graph result was source-cross-checked before edits.
- Static imports, compileall and `git diff --check`: exit 0. Focused unittest command ran 37 tests in 0.381 seconds: exit 0, all pass.
- Preflight HEAD is unchanged. Controlled tracked diff SHA-256 from `git diff --binary` is `0904369d6bca3e4d685a3ff19ab36b03ce11a1c0c50912bfff3f56613d7d0f70`; it includes previously approved gate/provenance/test changes plus this recovery source work. Staged diff remains empty. Untracked selection JSON remains immutable and excluded from staging.
- Trusted hashes reverified unchanged: dataset `406be8ed9fc097adcdaf6c3446addd4bf94c909d3a299cca8ce1304da35b0807`; selection `4c15e952eef67f7291a306d2eedc8277ca86601286b301538e8c03335dc71f1f`; freeze manifest `ed1bbe4f9b24980c0277ace6da5d3b320b9f51a2b33f39c18c52e73beeed64ab`; checkpoint `6168b65abaf8ade9008c9611413167f76533d1e80926b2be852df6e7e3a67789`; approved gate `a6595257ef073338cdeafadca3371ab568697e8e045fe3d696542b8584e07a83`.
- Selection names `p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01`; freeze manifest has the same run ID and recorded revision. Filename-only scan at the correct operational directory found no final lock, final report or gate-final report. No final content was read during recovery implementation/preflight; `finalDataOpened: false` remains supported by the prior early exit and current control flow.

Exact pending recovery command, reviewed but not launched:

```bash
/Users/hieunt/learning-reverse/avatar-web/fishing-ml/.venv/bin/python -m fishing_ml.experiments confirm-final \
  --selection /Users/hieunt/learning-reverse/avatar-web/fishing-ml/artifacts/phase2-selection.json \
  --artifacts-root /Users/hieunt/learning-reverse/avatar-web/fishing-ml/artifacts \
  --candidates /Users/hieunt/learning-reverse/avatar-web/fishing-ml/config/phase2/candidates.yaml \
  --dataset-version /Users/hieunt/learning-reverse/avatar-web/fishing-ml/data/phase2/dataset-version.json \
  --gate-config /Users/hieunt/learning-reverse/avatar-web/fishing-ml/config/phase2/gate.yaml \
  --confirm-final-once p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01 \
  --raw-root /Users/hieunt/learning-reverse/avatar-web/fishing-ml/data/phase2/raw \
  --labels-root /Users/hieunt/learning-reverse/avatar-web/fishing-ml/data/phase2/labels \
  --splits-root /Users/hieunt/learning-reverse/avatar-web/fishing-ml/data/phase2/splits \
  --duplicate-reviews /Users/hieunt/learning-reverse/avatar-web/fishing-ml/config/duplicate-reviews.json
```

- When separately authorized, aggregate stdout, stderr and invocation metadata will be captured under `/private/tmp/fishing-phase2-final-recovery-once/`. Starting the command consumes the sole recovery invocation regardless of outcome. It must never be relaunched.

## Recovery final — terminal gate failure

- User explicitly authorized exactly one recovery invocation with `duyệt`. Immediate preflight reverified all five trusted hashes, unchanged HEAD and absence of terminal outputs.
- The exact command started once at `2026-09-05T06:10:46.555714000Z`, ended at `2026-09-05T06:10:51.363142000Z`, and exited `3`. No retry occurred or is permitted.
- The durable final boundary was entered. `final-evaluation.lock` was created at `2026-09-05T06:10:48.137360+00:00` and remains present. Therefore `finalDataOpened: true`.
- Terminal artifact SHA-256 values: lock `75b6659d7d961870bcdbe3652ae532bfd2e162d6fde61af7bcb5b16b091490e6`; final report `3da0160a93ea6bcfd4747f696c1b5bbd1d3eef2ce599c4b405934d4f0daddc0b`; gate report `018c8c164f4c97b567ebba636f5004730d8dda2ec4fc9755532a6b918ce8d01d`.
- Gate status: fail. `wrongAccepted=0` passed; `top1Accuracy=0.9952380952380953` passed against `0.98`; `batchExactMatch=0.9666666666666667` passed against `0.90`; `acceptedRate=0.5523809523809524` failed against `0.60`. Failure code: `accepted_rate_below_minimum`. Policy SHA and evidence SHA in gate report match the trusted gate and final report.
- Captured stdout is 61,410 bytes and has SHA-256 `68bb21b9114a06d331a8ceb85bb5ae80f54d3f69ee2d9a530a03796005664ec3`; stderr is empty with SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. Stdout contains the complete CLI result and is retained under `/private/tmp/fishing-phase2-final-recovery-once/`; per-example content is not copied into mutable documentation.
- Replay prerequisites require final exit 0 and a passing gate. They are not met, so replay/service/adjudication are NOT RUN. No live shadow, TX43, `finishFishing()` or gameplay mutation occurred.
- This is the terminal outcome for recovery. The persistent lock prevents further final evaluation, and the recovery invocation policy independently forbids another launch.
