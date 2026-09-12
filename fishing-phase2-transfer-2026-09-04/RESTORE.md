# Restore Fishing Phase 2 on a New Machine

## 1. Clone and checkout

```bash
git clone <repository-url> learning-reverse
cd learning-reverse
git checkout 906e5e4a
```

A newer commit is acceptable only if Fishing Phase 2 production code and `config/phase2/candidates.yaml` remain compatible. The frozen artifacts record training revision `8ca1f93990dcd06a0b7d6ee6251100e67a155365`; do not edit that revision inside manifests.

## 2. Verify this transfer bundle

Run from this transfer directory before extracting:

```bash
shasum -a 256 -c SHA256SUMS
```

Every file must report `OK`.

Inspect archive paths before extracting:

```bash
tar -tzf fishing-phase2-dataset.tar.gz
tar -tzf fishing-phase2-artifacts.tar.gz
```

Dataset paths must start with `data/phase2/`. Artifact paths must start with `artifacts/phase2-` or `artifacts/p2-`.

## 3. Extract into the clone

Run from the repository root:

```bash
tar -C avatar-web/fishing-ml \
  -xzf /path/to/fishing-phase2-transfer-2026-09-04/fishing-phase2-dataset.tar.gz

tar -C avatar-web/fishing-ml \
  -xzf /path/to/fishing-phase2-transfer-2026-09-04/fishing-phase2-artifacts.tar.gz
```

Extract into a clone where these Phase 2 paths do not already exist. Do not overwrite a partial or conflicting dataset/artifact set.

## 4. Create the Python environment

```bash
cd avatar-web/fishing-ml
python3.12 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e .
PY=.venv/bin/python
```

## 5. Verify restored state

```bash
$PY -m fishing_ml.dataset_version verify data/phase2/dataset-version.json
shasum -a 256 data/phase2/dataset-version.json
shasum -a 256 artifacts/phase2-selection.json

SELECTED=p2-photometric_plus_geom-off-t0.05-dim_128-db8460d9b1cabc01
$PY -m fishing_ml.artifacts verify \
  --frozen-dir "artifacts/$SELECTED/frozen"

shasum -a 256 "artifacts/$SELECTED/frozen/freeze-manifest.json"
```

Expected hashes:

```text
dataset-version.json:
406be8ed9fc097adcdaf6c3446addd4bf94c909d3a299cca8ce1304da35b0807

phase2-selection.json:
4c15e952eef67f7291a306d2eedc8277ca86601286b301538e8c03335dc71f1f

best-dev.pt (recorded inside freeze-manifest.json):
6168b65abaf8ade9008c9611413167f76533d1e80926b2be852df6e7e3a67789

freeze-manifest.json:
ed1bbe4f9b24980c0277ace6da5d3b320b9f51a2b33f39c18c52e73beeed64ab
```

Full context and next-step safety rules are in `HANDOVER.md`.
