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

## Install (editable)

```bash
cd avatar-web/fishing-ml
python3.11 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e .
.venv/bin/python -c "import fishing_ml; print(fishing_ml.__file__)"
```
