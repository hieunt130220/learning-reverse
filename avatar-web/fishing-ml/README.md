# fishing-ml

Offline dataset, labeling, training, calibration, freezing, evaluation, and local
inference/replay tooling for **Avatar fishing image matching**.

The Phase 2 service is local and read-only: it loads one verified frozen candidate and
never controls the game. No command submits TX43 or calls `finishFishing()`.

## Console commands

| Command | Module |
|---------|--------|
| `fishing-import` | `fishing_ml.import_data` |
| `fishing-label` | `fishing_ml.label` |
| `fishing-validate` | `fishing_ml.validate` |
| `fishing-split` | `fishing_ml.split` |
| `fishing-baseline` | `fishing_ml.baselines` |
| `fishing-train` | `fishing_ml.train` |
| `python -m fishing_ml.calibrate` | `fishing_ml.calibrate` |
| `fishing-freeze` | `fishing_ml.artifacts` |
| `fishing-evaluate` | `fishing_ml.evaluate` |

Calibration reads development predictions and writes abstention thresholds. Freezing is a
separate operation that snapshots the selected run, dataset, and splits before evaluation.

## Phase 2

Phase 2 is a SEPARATE namespace that improves the offline pipeline, adds an inference
service/replay layer, and a shadow mode — **strictly additive, never overwriting Phase A
artifacts**. No command submits TX43.

### Phase-2 dataset layout

All Phase-2 data lives under its own namespace, isolated from Giai đoạn A
(`data/raw`, `data/labels`, `data/splits`):

```text
avatar-web/fishing-ml/data/phase2/
├── incoming/
├── raw/
├── labels/
├── splits/
└── dataset-version.json
```

`dataset-version.json` is the immutable provenance record for each Phase-2 dataset snapshot.
It accepts only schema version 1; `createdAt` must be an ISO-8601 UTC timestamp; `datasetId`
and `parentDatasetId` (explicit `null` or a valid safe id) use the Phase A safe-id rule
(`^[^/\\\s]+$`, never `.`/`..`); and `sourceBatches` is stored as a sorted, unique tuple.
Unknown top-level keys are rejected. `resolve_phase2_dir()` guarantees a Phase-2 path can
never escape `data/phase2/` or point at a Phase A mutable root.

### Console commands

| Command | Module |
|---------|--------|
| `fishing-phase2-dataset-version` | `fishing_ml.dataset_version` |
| `fishing-phase2-inference-contract` | `fishing_ml.inference_contract` |
| `fishing-phase2-inference-service` | `fishing_ml.inference_service` |
| `fishing-phase2-experiment` | `fishing_ml.experiments` |
| `fishing-phase2-replay` | `fishing_ml.replay` |
| `fishing-phase2-gate` | `fishing_ml.phase2_gate` |

```bash
# Verify an inference request/response document (exit 1 on rejected).
python -m fishing_ml.inference_contract check-request path/to/request.json
python -m fishing_ml.inference_contract check-response path/to/response.json
```

### Phase 2 experiment state machine

New candidates use strict training-config schema v2. In addition to every schema-v1
field, v2 requires:

- `augmentationProfile`: `none`, `photometric`, or `photometric_plus_geom`;
- `hardNegativeRatio`: `0.0` or `0.25`;
- `hardNegativeMargin`: a finite positive number.

The finite matrix and immutable selection policy live in
`config/phase2/candidates.yaml`. `compare` always uses that configured policy; there
is no CLI override that can weaken the zero-wrong-accepted requirement. Freeze and
final confirmation re-resolve the selection against the current dataset version,
train/dev split checksum, effective config, Git revision, candidate manifest, and
run artifacts.

```bash
# 1. Enumerate the finite matrix without training or reading final.txt.
fishing-phase2-experiment list \
  --candidates config/phase2/candidates.yaml \
  --splits-root path/to/data/phase2/splits \
  --dataset-version path/to/data/phase2/dataset-version.json

# 2. Train and calibrate exactly one enumerated candidate on train/dev.
fishing-phase2-experiment run \
  --candidates config/phase2/candidates.yaml \
  --splits-root path/to/data/phase2/splits \
  --dataset-version path/to/data/phase2/dataset-version.json \
  --raw-root path/to/data/phase2/raw --labels-root path/to/data/phase2/labels \
  --duplicate-reviews config/duplicate-reviews.json \
  --artifacts-root path/to/artifacts --run-id p2-...

# 3. Compare the complete manifest set and publish immutable selection evidence.
fishing-phase2-experiment compare \
  --candidates config/phase2/candidates.yaml \
  --splits-root path/to/data/phase2/splits \
  --dataset-version path/to/data/phase2/dataset-version.json \
  --artifacts-root path/to/artifacts \
  --selection-path path/to/artifacts/phase2-selection.json

# 4. Freeze only the verified selected candidate.
fishing-phase2-experiment freeze \
  --selection path/to/artifacts/phase2-selection.json \
  --candidates config/phase2/candidates.yaml \
  --dataset-version path/to/data/phase2/dataset-version.json \
  --artifacts-root path/to/artifacts \
  --raw-root path/to/data/phase2/raw --labels-root path/to/data/phase2/labels \
  --splits-root path/to/data/phase2/splits \
  --duplicate-reviews config/duplicate-reviews.json

# 5. One-shot final evaluation. Placeholder gate policy returns blocked before
# final.txt, final lock, or final predictions are touched.
fishing-phase2-experiment confirm-final \
  --selection path/to/artifacts/phase2-selection.json \
  --candidates config/phase2/candidates.yaml \
  --dataset-version path/to/data/phase2/dataset-version.json \
  --artifacts-root path/to/artifacts --gate-config config/phase2/gate.yaml \
  --confirm-final-once p2-... \
  --raw-root path/to/data/phase2/raw --labels-root path/to/data/phase2/labels \
  --splits-root path/to/data/phase2/splits \
  --duplicate-reviews config/duplicate-reviews.json

# 6. Adjudicate existing replay evidence; this never starts the service.
fishing-phase2-experiment adjudicate-replay \
  --gate-config config/phase2/gate.yaml \
  --replay-report path/to/replay-report.json \
  --frozen-dir path/to/run/frozen --stdout
```

Exit codes are `0` for a successful non-adjudication stage or gate pass, `2` for
invalid input/provenance/infrastructure/publication conflict, `3` for a valid
mandatory gate failure, and `4` for a valid blocked state. A proven failure takes
precedence over blockers. Placeholder policy values are not approval and keep real
final/replay gates blocked.

### Inference service (frozen candidate)

`fishing-phase2-inference-service` loads **exactly one verified frozen Phase 2
candidate** at startup and serves read-only contract-shaped inference over HTTP
(POST `/infer`). It composes the Task 4 wire contract and the frozen-candidate
loaders (``evaluate._inputs`` → ``verify_freeze``); it performs no training, no
game/client/TX code, no per-request model selection, and no image persistence.
Decoded PNG pixels stay in request memory; error bodies carry only a stable
`code` + short `reason`.

Startup verifies and loads the frozen candidate **once** — a missing, tampered, or
revision-mismatched `--frozen-dir` fails closed and the service refuses to start
(``verify_freeze``'s hash/manifest checks propagate as a startup error). The
service requires exactly one ASCII-decimal `Content-Length` value; leading zeroes are
accepted and surrounding header whitespace is normalized. Missing, duplicate,
conflicting, signed, Unicode-digit, or malformed lengths and unsupported
`Transfer-Encoding` are rejected; it never
uses an unbounded keep-alive body read. The request body is size-bounded **before**
parsing (`--max-body-bytes`) and read under one absolute request deadline. Inference
uses one bounded worker slot: a timed-out worker retains the slot until it exits,
while later requests fail fast with sanitized `busy`/timeout status instead of
accumulating daemon workers. The revision check resolves Git from the package
repository rather than relying on the caller's current working directory.
Every parser, method, framing, contract, timeout, and internal failure returns only
`{"code": ..., "reason": ...}` JSON when the client remains connected; disconnects
are closed quietly.

The strict framing policy intentionally does not accept HTTP/1.1 requests without a
single `Content-Length`; chunked or otherwise ambiguous bodies are rejected before
inference. `evaluate._git()` remains unchanged for the existing evaluation CLI; the
service's frozen revision check resolves the repository explicitly so service startup
is not dependent on the caller's current working directory.

```bash
# Serve one verified frozen candidate (Task 3 artifact dir) on 127.0.0.1:8080.
fishing-phase2-inference-service \
  --frozen-dir path/to/run/frozen \
  --host 127.0.0.1 --port 8080 \
  --max-body-bytes 1283950 --timeout-ms 5000

# Infer (contract request → contract response, schemaVersion 1):
curl -s -X POST http://127.0.0.1:8080/infer \
  -H 'Content-Type: application/json' \
  -d '{"schemaVersion":1,"references":[{"index":0,"pngBase64":"..."}],"queries":[{"index":0,"pngBase64":"..."}]}'
```

Request/response shapes and error `code`s are identical to the contract documented
above. `modelId` in the response is the frozen candidate's `runId`; the request
cannot choose a model.

### Inference replay (operational evidence)

The dependency-light Python replay client consumes an explicitly supplied inference
URL; it does not append `/infer`, retry, follow redirects, or select a model. The URL
must be an absolute `http`/`https` URL without credentials or a fragment, and timeout
configuration is bounded. Responses are size-capped and accepted only after strict
Task 4 schema validation, request-relative index/duplicate checks, a non-empty
`modelId`, and per-client model-ID pinning.

Replay enumerates `<batches-root>/<batch-id>/manifest.json` directories in sorted
order, validates schema-v1 manifests, PNGs, and checksums, then base64-encodes PNG
bytes only in memory. A missing `imagesNew`, malformed batch, client timeout,
unavailable endpoint, HTTP failure, oversized response, invalid response, or model
identity change is isolated to that batch; later batches continue. Optional labels
are read from `<labels-root>/<batch-id>.json`. Only a matching, complete reviewer
label covering every query is ground truth; missing, ambiguous, foreign, malformed,
or incomplete labels remain unknown and are never repaired or pseudo-labeled.

```bash
# The endpoint is the complete POST target; pass /infer explicitly.
python -m fishing_ml.replay \
  --batches-root path/to/raw-batches \
  --labels-root path/to/labels \
  --endpoint http://127.0.0.1:8080/infer \
  --timeout-ms 5000
```

The command prints one deterministic aggregate JSON document to stdout. It reports
batch/query/request counts; accepted, abstained, omitted, labeled, and unknown
counts/rates (outcome rates cover successful response query outcomes, so pre-request
or failed-request queries are not silently treated as abstentions); correct/wrong
accepted counts only where complete reviewer ground truth
exists; stable error counts; `R=<references>,Q=<queries>` breakdowns; observed model
IDs and optional caller-supplied frozen checksums; and client-observed p50/p95/p99/max
latencies plus labeled raw top-1 and batch-exact metrics. Percentiles use nearest rank
over every terminal HTTP client call (success
or failure), never the service-reported `latencyMs`. No accuracy claim is valid when
labels are absent, and stub-server replay is operational/fault evidence only—not real
checkpoint or matcher-accuracy evidence.

Replay writes no report by default and never persists generated request JSON, PNG,
base64, packet bytes, credentials, cookies, or account identity. It is read-only
operational validation: it does not alter labels, thresholds, candidates, frozen
artifacts, game state, client/opcode flows, or any TX sequence.

The inference contract (`src/fishing_ml/inference_contract.py`) is the strictly-typed
**wire schema** both the Python service (Task 5) and the Node shadow client (Task 7/8)
speak. It performs validation + serialization only — no ML, no HTTP server, no image
persistence. PNG bytes are decoded in-memory (75×75 RGB/RGBA) for validation only;
they are never written to disk or echoed in errors. Counts are capped at 64 per list
(`_MAX_IMAGES`) and total decoded PNG bytes at `_MAX_BODY_BYTES` = (64+64)×7500.

Request: `{"schemaVersion":1,"references":[{"index":0,"pngBase64":"..."}],"queries":[...]}`.
Response: `{"schemaVersion":1,"modelId":"phase2-cnn-...","predictions":[{"queryIndex":0,"referenceIndex":1,"similarity":0.98,"margin":0.12,"accepted":true}],"latencyMs":18}`.
`modelId` is echoed verbatim (the service's frozen-candidate run-id from Task 3); no
model-id scheme is invented here. Errors carry a stable `code` + short `reason`.

```bash
# Verify a Phase-2 dataset-version document (exit 2 on malformed/refused).
python -m fishing_ml.dataset_version verify path/to/data/phase2/dataset-version.json

# Resolve and prove a name stays inside data/phase2/ (refuses escaping/Phase A-root names).
python -m fishing_ml.dataset_version namespace --base . --name raw
```

### Configuration

`config/phase2/dataset.yaml` declaratively documents the Phase-2 namespace: the `data/phase2`
data root, its `incoming/ raw/ labels/ splits/` subdirs, and the `dataset-version.json`
file name. It is documentation/metadata consistent with `config/train-baseline.yaml`; the
authoritative validation rules live in `src/fishing_ml/dataset_version.py`.

### Rollout gates (Phase 2 result)

The authoritative gate record is
`docs/superpowers/plans/2026-08-28-fishing-phase-2-results.md`. Summary of the
binding safety outcomes (spec §5):

- **2C shadow mode is OFF by default** and fail-closed: `FISHING_SHADOW_SAMPLE_RATE=0`
  → no request; a kill switch and finite sample-rate gate are honored; service
  failure/timeout/malformed response is recorded as a code and **never** fails the
  fishing session.
- **No game-control side effect:** the Node shadow adapter (`server/src/fishing/`)
  never calls `finishFishing()`, never sends TX43, and never alters TX41/TX44/TX45.
  It forwards **image bytes only** — no `idUser`/`idFish`/`timeDelayMs` reach the
  wire request or the sanitized telemetry (`{shadow, status, errorCode?,
  predictionCount?, acceptedCount?}`).
- **Authorized live shadow** is the final 2C rollout stage and remains gated
  behind an explicit runtime flag plus out-of-band authorization; this worktree
  wires replay-only and local-shadow stages but performs no live run.
- Numeric 2A/2B gates (real zero-wrong-accepted, coverage, p50/p95/p99 latency)
  are **pending a real training/eval + frozen-checkpoint run** unavailable in this
  environment and are recorded as blocked, not claimed.

## Install (editable)

```bash
cd avatar-web/fishing-ml
python3.11 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e .
.venv/bin/python -c "import fishing_ml; print(fishing_ml.__file__)"
```
