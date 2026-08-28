# Fishing Matcher Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây pipeline Phase 2 theo ba gate tuần tự: cải thiện matcher offline, inference service/replay và shadow mode read-only không gửi TX43.

**Architecture:** Tái sử dụng pipeline Python hiện có bằng namespace dataset Phase 2, freeze candidate trước service, rồi cung cấp HTTP inference contract độc lập. Node.js chỉ gọi service best-effort từ RX79 để ghi telemetry đã sanitize; existing fishing flow vẫn là source of truth và không có submit side effect.

**Tech Stack:** Python 3.11, PyTorch hiện hữu, Pillow, HTTP server/client theo dependency được duyệt, TypeScript/Node.js 22, GitNexus.

**Spec:** `docs/superpowers/specs/2026-08-28-fishing-phase-2-design.md`

## Global Constraints

- Gate chính Phase 2A là `accepted_wrong_count == 0`; coverage, accuracy và latency phải được báo cáo và đạt ngưỡng trước shadow.
- Dataset Phase 2 dùng namespace/version riêng, không ghi đè dataset, split, frozen artifact hoặc final report Phase A.
- Chỉ tuning trên train/dev; không dùng 3 lỗi final Phase A để tuning và không chạy lại final Phase A.
- Ground truth cuối cùng do người review; không dùng pseudo-label làm ground truth.
- Frozen candidate là input duy nhất của service; request không được đổi model tùy ý.
- Không gửi TX43, không xác định mapping `imgIndex → TX43 byte`, không gọi `finishFishing()` và không thay đổi TX41/TX44/TX45.
- Feature flag shadow mặc định off; service failure/timeout/schema error không làm fail fishing session.
- Không ghi account identity, credentials, cookie, raw packet, base64 ảnh hoặc ảnh vào telemetry/artifacts.
- Không tạo test files trừ khi user yêu cầu; verification dùng CLI, replay, fixtures, fault injection và manual checks sau production code.
- Trước khi sửa symbol hiện hữu phải chạy GitNexus upstream impact; HIGH/CRITICAL phải báo user trước khi edit.
- Trước mỗi commit phải chạy `gitnexus_detect_changes({scope: "all"})` hoặc `staged`; không commit dataset, PNG, labels/splits, venv, checkpoints hoặc generated run artifacts.

---

## File Map

- `avatar-web/fishing-ml/src/fishing_ml/dataset_version.py`: dataset namespace/version/provenance.
- `avatar-web/fishing-ml/src/fishing_ml/error_analysis.py`: phân tích confidence và lỗi theo batch/R/Q.
- `avatar-web/fishing-ml/src/fishing_ml/experiments.py`: candidate config, experiment manifest và so sánh dev.
- `avatar-web/fishing-ml/src/fishing_ml/inference_contract.py`: request/response/error schema và validation.
- `avatar-web/fishing-ml/src/fishing_ml/inference_service.py`: HTTP read-only inference với frozen candidate.
- `avatar-web/fishing-ml/src/fishing_ml/inference_client.py`: client typed, timeout và response validation.
- `avatar-web/fishing-ml/src/fishing_ml/replay.py`: replay captured batches, fault cases và latency report.
- `avatar-web/fishing-ml/config/phase2/`: config dataset/model/service/gate.
- `avatar-web/server/src/fishing/inferenceClient.ts`: Node HTTP client.
- `avatar-web/server/src/fishing/shadowMatcher.ts`: RX79 adapter và sanitized shadow result.
- `avatar-web/server/src/fishing/shadowConfig.ts`: feature flag, endpoint, timeout, sampling và kill switch.
- Existing RX79 integration file: locate via GitNexus before editing; only additive hook is allowed.
- `avatar-web/fishing-ml/README.md`: commands, contract, operational gates and privacy policy.

---

### Task 1: Establish Phase 2 dataset namespace and provenance

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/dataset_version.py`
- Create: `avatar-web/fishing-ml/config/phase2/dataset.yaml`
- Modify: `avatar-web/fishing-ml/README.md`

**Interfaces:**
- Produces `DatasetVersion(schema_version: int, dataset_id: str, parent_dataset_id: str | None, created_at: str, source_batches: tuple[str, ...])`.
- Produces `load_dataset_version(path: Path) -> DatasetVersion` and `write_dataset_version(...)` using existing schema/atomic JSON conventions.

- [ ] **Step 1: Run index refresh and inspect existing schema/artifact helpers**
  - Run `npx gitnexus analyze` before impact analysis because the index must match HEAD.
  - Read `schema.py`, `artifacts.py`, `split.py`, and README conventions; do not modify existing symbols until impact is recorded.

- [ ] **Step 2: Run impact checks for reused writers/loaders**
  - Run upstream GitNexus impact for each existing function to be modified or imported. Record direct callers and risk before editing.

- [ ] **Step 3: Implement strict dataset-version schema**
  - Accept only schema version 1, ISO UTC timestamp, safe batch IDs, sorted unique source batches, explicit parent ID, and reject unknown keys.
  - Ensure Phase 2 paths resolve under `data/phase2/` and cannot point to Phase A mutable roots.

- [ ] **Step 4: Verify namespace and README commands**
  - Run the version CLI/loader against a valid fixture and malformed version documents.
  - Expected: valid metadata round-trips; malformed/Phase A-overwrite paths fail with exit 2; no generated data is committed.

- [ ] **Step 5: Detect and commit**
  - Run `gitnexus_detect_changes({scope: "all"})`; commit source/config/docs with `feat: add fishing phase 2 dataset namespace`.

### Task 2: Collect/import/label and analyze Phase 2 data

**Files:**
- Modify: `avatar-web/server/src/tools/fishing-probe.ts` only if crawler needs Phase 2 output selection
- Create: `avatar-web/fishing-ml/src/fishing_ml/error_analysis.py`
- Create: `avatar-web/fishing-ml/config/phase2/gate.yaml`

**Interfaces:**
- Consumes existing crawler/import/label/validate pipeline and frozen Phase A dev/final reports as read-only references.
- Produces `ErrorCase`, `ErrorAnalysisReport`, `analyze_predictions(...)`, and gate configuration with explicit coverage/latency thresholds.

- [ ] **Step 1: Run upstream impact for `fishing-probe` symbols before any change**
  - If existing crawler already accepts a Phase 2 output directory, do not modify it. Otherwise run impact for `parseArgs`/`runProbe` and add only an additive output namespace option.

- [ ] **Step 2: Implement error-analysis report**
  - Read predictions and labels without changing labels; join by batch/query; group by reference/query count, accepted flag, similarity, margin and source metadata.
  - Record Phase A errors as diagnostic hypotheses only and mark them unavailable for training/tuning.

- [ ] **Step 3: Execute Phase 2 data gate**
  - Capture authorized batches, import to `data/phase2/raw`, label manually, validate, inspect duplicate blobs, and create a new batch-level split.
  - Expected: dataset version references only Phase 2 batches, no cross-split leakage, and source bytes/checksums remain unchanged.

- [ ] **Step 4: Verify analysis and gate configuration**
  - Run error analysis on Phase A report and Phase 2 dev predictions; verify deterministic output and explicit unknown/abstention counts.
  - Record selected coverage and latency thresholds in `config/phase2/gate.yaml`; do not infer them from final data.

- [ ] **Step 5: Detect and commit**
  - Run detect-changes and commit source/config/docs only with `feat: add fishing phase 2 error analysis`.

### Task 3: Add controlled Phase 2 experiment runner

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/experiments.py`
- Create: `avatar-web/fishing-ml/config/phase2/candidates.yaml`
- Modify: existing training/config modules only where impact-approved

**Interfaces:**
- Produces `ExperimentSpec`, `ExperimentResult`, `run_experiment(...)`, and `compare_experiments(...)`.
- Consumes Phase 2 train/dev split and existing `run_training`, calibration and freeze APIs.

- [ ] **Step 1: Run impact for every reused training/calibration/freeze entry point**
  - Run GitNexus upstream impact for `run_training`, `calibrate_run`, `freeze_run`, and any modified config loader; stop and report if HIGH/CRITICAL.

- [ ] **Step 2: Define finite candidate matrix**
  - Explicitly enumerate augmentation, hard-negative sampling, loss/temperature and embedding candidates; reject unknown keys and unbounded combinations.
  - Ensure every candidate records seed, split checksum, config checksum and parent dataset ID.

- [ ] **Step 3: Implement train/dev-only runner**
  - Run candidates only on train/dev, select by zero wrong accepted first, then configured coverage/accuracy tie-breakers; never open final during selection.
  - Persist reproducible manifests and no images/raw packets.

- [ ] **Step 4: Freeze the selected candidate and evaluate Phase 2 final once**
  - Calibrate from dev, freeze, verify all hashes, then run exact final confirmation once. Exit success only when zero wrong accepted and configured coverage/accuracy gates pass.

- [ ] **Step 5: Verify and commit**
  - Compare Phase 2 candidate to Phase A baseline without using final errors for tuning; run detect-changes and commit `feat: run controlled fishing phase 2 experiments`.

### Task 4: Implement inference contract

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/inference_contract.py`
- Modify: `avatar-web/fishing-ml/pyproject.toml`
- Modify: `avatar-web/fishing-ml/README.md`

**Interfaces:**
- `InferenceImage(index: int, png_base64: str)`.
- `InferenceRequest(schema_version: int, references: tuple[InferenceImage, ...], queries: tuple[InferenceImage, ...])`.
- `InferencePrediction(query_index: int, reference_index: int, similarity: float, margin: float | None, accepted: bool)`.
- `InferenceResponse(schema_version: int, model_id: str, predictions: tuple[InferencePrediction, ...], latency_ms: int)`.
- `parse_request(value: Mapping[str, object])`, `serialize_response(response)`, `validate_response(value)` and typed error codes.

- [ ] **Step 1: Define strict request/response validation**
  - Enforce schema version, contiguous unique indices, count/body limits, PNG 75×75 decode, finite values and no unknown fields.
  - Preserve `margin: null` for one-reference requests and allow many-to-one predictions.

- [ ] **Step 2: Add contract CLI smoke verification**
  - Run valid, malformed, duplicate-index, bad-PNG, oversized and one-reference fixtures; expected deterministic accept/reject codes without payload echo.

- [ ] **Step 3: Detect and commit**
  - Run detect-changes and commit `feat: define fishing inference contract`.

### Task 5: Implement frozen-candidate inference service

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/inference_service.py`
- Modify: `avatar-web/fishing-ml/pyproject.toml`
- Modify: `avatar-web/fishing-ml/README.md`

**Interfaces:**
- `InferenceServerConfig(host: str, port: int, frozen_dir: Path, max_body_bytes: int, timeout_ms: int)`.
- `load_frozen_matcher(frozen_dir: Path) -> FrozenMatcher`.
- `serve(config: InferenceServerConfig) -> None`.

- [ ] **Step 1: Run impact for frozen loader and model prediction functions**
  - Run upstream impact for `verify_freeze`, `_inputs`, and the prediction function used by the service before modifying or exposing them.

- [ ] **Step 2: Load and verify candidate once at startup**
  - Call `verify_freeze` before reading model files; refuse missing/tampered/nonmatching revision; do not permit per-request model selection.

- [ ] **Step 3: Implement bounded HTTP handler**
  - Parse JSON, validate contract, run in-memory inference, return response/error code, enforce body/count/time limits, and never log images/base64.
  - Service must not import game/client/TX opcode modules.

- [ ] **Step 4: Fault-verify service**
  - Start service against a synthetic frozen fixture; replay valid and invalid requests, then exercise timeout/unavailable/5xx behavior from client side.

- [ ] **Step 5: Detect and commit**
  - Run detect-changes and commit `feat: serve frozen fishing matcher inference`.

### Task 6: Implement replay client and operational report

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/inference_client.py`
- Create: `avatar-web/fishing-ml/src/fishing_ml/replay.py`
- Modify: `avatar-web/fishing-ml/README.md`

**Interfaces:**
- `InferenceClient(endpoint: str, timeout_ms: int)`.
- `InferenceClient.match(request: InferenceRequest) -> InferenceResponse`.
- `ReplayReport` with batch/query counts, metrics, wrong accepted, abstention, errors, and p50/p95/p99 latency.
- `replay_batches(...) -> ReplayReport`.

- [ ] **Step 1: Implement bounded client**
  - Validate endpoint configuration, timeout, response schema, model ID and prediction indices; map unavailable/timeout/HTTP/schema failures to stable error codes.

- [ ] **Step 2: Implement replay runner**
  - Read captured batches in memory, call service, compare labels when present, and emit report without writing PNG/base64 or raw packet data.

- [ ] **Step 3: Run replay matrix**
  - Cover normal batches, R=1, R≠Q, many-to-one, missing `arrImgNew`, malformed PNG, count/body limits, unavailable service and timeout.
  - Expected: report includes all terminal outcomes and latency percentiles; no crash on one bad batch.

- [ ] **Step 4: Detect and commit**
  - Run detect-changes and commit `feat: replay fishing inference service`.

### Task 7: Add Node shadow client/config

**Files:**
- Create: `avatar-web/server/src/fishing/inferenceClient.ts`
- Create: `avatar-web/server/src/fishing/shadowConfig.ts`
- Modify: `avatar-web/server/package.json` only if an existing HTTP dependency is insufficient

**Interfaces:**
- `ShadowConfig { enabled: boolean; endpoint: string; timeoutMs: number; sampleRate: number; circuitBreaker: ... }`.
- `InferenceClient.match(payload: CanCauPayload): Promise<ShadowMatchResult>`.
- `ShadowMatchResult { status: 'ok' | 'disabled' | 'timeout' | 'unavailable' | 'invalid'; modelId?: string; predictionCount?: number; acceptedCount?: number; latencyMs?: number; errorCode?: string }`.

- [ ] **Step 1: Run impact for existing HTTP/config utilities**
  - Use GitNexus query/context to find established HTTP client, config and metrics conventions; run upstream impact for each modified symbol.

- [ ] **Step 2: Implement disabled-by-default config**
  - Parse environment/config with safe defaults, validate timeout/sample limits, and provide explicit kill switch; no credentials in endpoint/log configuration.

- [ ] **Step 3: Implement timeout-bounded typed client**
  - Convert `CanCauPayload` to contract request without account metadata/raw packet; reject missing/invalid images locally; never retry within one RX79.

- [ ] **Step 4: Verify client failures**
  - Run TypeScript typecheck and a local service/fault matrix; expected disabled mode creates no request and failures return sanitized status.

- [ ] **Step 5: Detect and commit**
  - Run detect-changes and commit `feat: add fishing shadow inference client`.

### Task 8: Integrate read-only shadow matcher into RX79 flow

**Files:**
- Create: `avatar-web/server/src/fishing/shadowMatcher.ts`
- Modify: exact RX79 handling file identified by GitNexus
- Modify: `avatar-web/server/README.md` or operational docs

**Interfaces:**
- `runShadowMatch(payload: CanCauPayload, config: ShadowConfig): Promise<ShadowMatchResult>`.
- `recordShadowTelemetry(result: ShadowMatchResult): void`.

- [ ] **Step 1: Locate RX79 flow and run mandatory impact**
  - Run GitNexus query/context for `decodeCanCau` and its caller, then upstream impact for the integration method. If risk is HIGH/CRITICAL, report the blast radius and obtain explicit user confirmation before editing.

- [ ] **Step 2: Add best-effort adapter after existing state update**
  - Invoke shadow only when flag/sample allows; isolate it from existing fishing control flow; do not await it in a way that blocks TX sequencing.

- [ ] **Step 3: Enforce no-side-effect boundary**
  - Keep adapter free of `finishFishing`, TX43, TX41, TX44 and TX45 calls; on all errors record code and continue existing flow.

- [ ] **Step 4: Verify off/on and fault behavior**
  - Run server typecheck; compare flag off/on; inject service timeout, malformed response and unavailable service; inspect sanitized logs and packet/process traces for no TX43 or sequencing change.

- [ ] **Step 5: Detect and commit**
  - Run `gitnexus_detect_changes({scope: "all"})`; confirm only expected RX79/shadow flows changed; commit `feat: add read-only fishing shadow mode`.

### Task 9: Run rollout gates and document Phase 2 result

**Files:**
- Modify: `avatar-web/fishing-ml/README.md`
- Create: `docs/superpowers/plans/2026-08-28-fishing-phase-2-results.md` only after execution evidence exists

**Interfaces:**
- Consumes Phase 2 dataset/model/service/shadow reports.
- Produces a factual gate record with candidate/model/checksums, metrics, coverage, latency, errors, rollout state and unresolved items.

- [ ] **Step 1: Run Gate 2A**
  - Confirm dataset/version/leakage, candidate freeze, `accepted_wrong_count == 0`, configured accuracy/coverage and final-once semantics.

- [ ] **Step 2: Run Gate 2B**
  - Confirm contract matrix, replay metrics, p50/p95/p99 latency, timeout/error budget and model/checksum identity.

- [ ] **Step 3: Run Gate 2C progressively**
  - Replay-only → local shadow → authorized live shadow. Keep flag default off and record authorization, duration and kill-switch verification.

- [ ] **Step 4: Run final detect-changes and privacy review**
  - Confirm no TX43, no packet sequencing changes, no sensitive telemetry and no unapproved generated files.

- [ ] **Step 5: Commit documentation**
  - Commit only source/config/docs with `docs: record fishing matcher phase 2 gates` after detect-changes.

---

## Completion Criteria

Phase 2 is complete only when:

1. Phase 2 dataset and candidate are independently frozen and reproducible.
2. Gate 2A records zero wrong accepted plus configured coverage/accuracy thresholds.
3. Service contract/replay passes valid, invalid and fault matrices.
4. Shadow mode is disabled by default, failure-isolated and telemetry-sanitized.
5. No TX43 or game-control side effect is observed.
6. All GitNexus impact/detect checks are recorded.
7. Any TX43 or automated submit work is explicitly deferred to a new Phase 3 spec.
