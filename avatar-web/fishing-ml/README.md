# fishing-ml

Offline dataset, labeling, training, calibration, freezing, and evaluation pipeline for
**Avatar fishing image matching** (Giai đoạn A).

No live inference and no service layer are included here — those belong to Giai đoạn B.
No command submits TX43.

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

```bash
# Verify an inference request/response document (exit 1 on rejected).
python -m fishing_ml.inference_contract check-request path/to/request.json
python -m fishing_ml.inference_contract check-response path/to/response.json
```

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

## Install (editable)

```bash
cd avatar-web/fishing-ml
python3.11 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e .
.venv/bin/python -c "import fishing_ml; print(fishing_ml.__file__)"
```
