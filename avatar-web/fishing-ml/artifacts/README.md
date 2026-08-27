# Artifacts

This directory holds the outputs produced by the `fishing-ml` pipeline that are intended
to be **packaged and published externally** (shared with collaborators, the model registry,
or a model card). It is the home of the publishable bundle — *not* of raw datasets.

## Publishable bundle contents

When a training run completes, the following are assembled here for external sharing:

- **Model weights** — frozen/calibrated model (`.pt` is gitignored; ship the file via the
  bundle, not via git).
- **Calibration / threshold config** — the chosen decision threshold and any normalization
  stats (`config`/`calibrate` output).
- **Evaluation report** — metrics, confusion matrix, and rollout notes (`evaluate` output).
- **Label schema** — the canonical label set and image-matching contract (`schema` output).
- **Model card / README** — provenance, training split, and known limitations.

The `artifacts/` directory itself is tracked; only its generated sub-bundles
(`artifacts/*/`) and `*.pt` weights are gitignored. **This `README.md` is intentionally
un-ignored** so the publishable-bundle policy travels with the repo.

## Privacy gate (mandatory)

No dataset, artifact, or bundle in this directory may contain:

- account credentials, tokens, session cookies, or passwords;
- raw captured game packet logs or decrypted session traffic;
- any per-user or per-account identifying material.

The fishing image-matching pipeline operates only on **screenshots / derived image crops
and labels** that are safe to share. Before publishing any bundle, verify it contains no
credentials, cookies, passwords, or packet logs. If in doubt, do not publish.
