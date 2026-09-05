# Fishing Phase 2 Final and Replay Handover

Status: Tasks 1–7 PASS; Task 8 INVALID after the single authorized invocation; replay NOT RUN.

Repository `/Users/hieunt/learning-reverse`, branch `docs/fishing-phase2-transfer-bundle`, HEAD `aebbbe5a01affddebf7e0c7e8244e6a1e1fd3288`.

Relocation validation and exact current→recorded compatibility implemented in experiments.py; recorded revision remains `8ca1f93990dcd06a0b7d6ee6251100e67a155365`. Selection publication preserves recorded revision. Eleven authorized synthetic tests added after production; 30 focused tests pass. Full evidence and hashes are in the results ledger.

All 24 CPU candidates pass strict read-only validation. Winner is `p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01`. All 3,289 restored files remain byte-identical to trusted archives. Exact 9-file frozen inventory and all payload hashes pass without snapshot parsing.

User approved the Task 5 sequencing amendment. Pre-final validation used exact byte integrity, metadata, train/dev provenance and frozen inventory without opening final. Deferred semantic validation was not reached because the one-shot stopped before dataset validation.

Gate policy is approved: `approvedAt=2026-09-05T04:33:21Z`, `approvedBy=hieunt`, durable evidence references this Codex task, and SHA-256 is `a6595257ef073338cdeafadca3371ab568697e8e045fe3d696542b8584e07a83`.

Final invocation count is exactly 1. It ran from `2026-09-05T05:47:58.763773+00:00` to `2026-09-05T05:48:07.144193+00:00` and exited `2`: `frozen Git revision does not match current revision`. Source inspection confirms `evaluate_final_once` rejected the frozen revision before dataset validation, lock creation or final split access. No `final-evaluation.lock`, `final-evaluation.json`, or `gate-final.json` exists. finalDataOpened remains false.

The compatibility change in `experiments.py` does not cover the independent strict revision check in `evaluate.py`. The Plan forbids a retry after exit 2, so do not fix and rerun under this cycle. Any recovery requires a new reviewed Spec/Plan that preserves this one-shot record and explicitly decides whether a new final invocation is permitted.

Replay was not authorized because final did not exit 0. No service, replay report or replay gate report was created. liveShadowStatus: not-run; TX43, finishFishing and gameplay mutation not run.

Selection JSON remains untracked operational input; never stage/commit it. Tracked changes are `gate.yaml`, `experiments.py`, and the two authorized existing test modules; untracked docs are Spec/Plan/ledger/handover. No commit made.

GitNexus final change analysis reports 4 tracked files, 33 symbols, zero named affected processes, risk LOW, without partial/truncated output. `git diff --check` passes. Privacy scan of ledger, handover and temporary aggregate command evidence found no forbidden fields. No commit, push, merge or publication occurred.

Recovery Spec and Plan are now approved. Shared revision validation has been implemented across experiments, evaluation and inference, and the final lock is durable before dataset verification. The focused suite passes 37 tests. All five trusted hashes and HEAD remain unchanged; the selected run has no final lock/report/gate output. The exact recovery command is recorded in the results ledger but has not run.

The user authorized exactly one recovery invocation. It ran once from `2026-09-05T06:10:46.555714000Z` to `2026-09-05T06:10:51.363142000Z` and exited `3`. Final data was opened; the durable lock, final report and gate report all exist and their hashes are recorded in the results ledger.

The final gate failed only `acceptedRate`: actual `0.5523809523809524`, required `0.60`. Zero wrong accepted, top-1 accuracy `0.9952380952380953`, and batch exact match `0.9666666666666667` passed. The lock is permanent and no further final invocation is permitted.

Replay, service adjudication and rollout are NOT RUN because the final gate did not pass. No live shadow, TX43, `finishFishing()` or gameplay mutation occurred. Preserve the terminal artifacts and do not tune policy from final evidence.
