# fishing-ml

Offline dataset, labeling, and training pipeline for **Avatar fishing image matching**
(Giai đoạn A). This package establishes the Python boundary only; the data-processing
and training logic is added incrementally by later tasks.

No live inference and no service layer are included here — those belong to Giai đoạn B.

## Console commands

| Command | Module |
|---------|--------|
| `fishing-import` | `fishing_ml.import_data` |
| `fishing-label` | `fishing_ml.label` |
| `fishing-validate` | `fishing_ml.validate` |
| `fishing-split` | `fishing_ml.split` |
| `fishing-baseline` | `fishing_ml.baselines` |
| `fishing-train` | `fishing_ml.train` |
| `fishing-freeze` | `fishing_ml.calibrate` |
| `fishing-evaluate` | `fishing_ml.evaluate` |

Each command currently prints a "not yet implemented" message and exits 0; later tasks
replace the placeholder modules with real logic.

## Install (editable)

```bash
cd avatar-web/fishing-ml
python3.11 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e .
.venv/bin/python -c "import fishing_ml; print(fishing_ml.__file__)"
```
