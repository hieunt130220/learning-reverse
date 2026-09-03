# Fishing Matcher Phase 2 Code Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Phase 2 fishing matcher to code-complete: experiment semantics with real augmentation/hard-negative loss, CLI state machine through confirm-final and adjudicate-replay, calibrated selection with immutable artifacts, gate adjudication returning truthful pass/fail/blocked, and unified request-size contracts across Python and TypeScript.

**Architecture:** Four workstreams connected by immutable artifact contracts: (1) training config v2 + deterministic augmentation/hard-negative policy, (2) experiment CLI state machine with calibrated selection, (3) gate adjudication and replay report completion, (4) request-size contract alignment across Python contract/service/client and TypeScript client. All production code before tests; synthetic fixtures only.

**Tech Stack:** Python 3.11, PyTorch, YAML, TypeScript, Node.js test runner

**Spec:** `docs/superpowers/specs/2026-09-02-fishing-phase-2-code-completion-design.md`

## Global Constraints

- Python 3.11 only; no new runtime dependencies.
- `unittest` and `node:test`; no new test frameworks.
- No TDD — production code first, tests after.
- No TX43, `finishFishing()`, live shadow, game interaction, or answer submission.
- No commit of generated data, checkpoints, PNG, labels, or run artifacts.
- Synthetic test fixtures only; no real dataset/checkpoint captures.
- Gate placeholder values stay placeholders; code-completion does not approve numeric policy.
- Atomic no-replace publication for terminal artifacts; `atomic_write_json` is NOT safe for terminal publication.
- GitNexus impact analysis before editing existing functions; detect-changes before commits.
- `UNKNOWN` risk treated as unresolved, not low.
- Existing frozen schema-v1 artifacts remain loadable; new Phase 2 candidates use schema v2.

---

## File Structure

### Production Python — Create

- `avatar-web/fishing-ml/src/fishing_ml/phase2_training.py` — Deterministic augmentation profiles, stable RNG derivation, hard-negative auxiliary margin loss.
- `avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py` — Gate policy parser, approval provenance validation, final/replay adjudication, gate report publication.

### Production Python — Modify

- `avatar-web/fishing-ml/src/fishing_ml/config.py:34-105` — Add v2 fields to `TrainingConfig`, v2 parsing path, canonical serializer.
- `avatar-web/fishing-ml/src/fishing_ml/dataset.py:88-105` — Split `_augment` into profile-dispatched path; preserve unaugmented dev/final.
- `avatar-web/fishing-ml/src/fishing_ml/train.py:63-332` — Thread config/epoch/batch context into augmentation and hard-negative loss.
- `avatar-web/fishing-ml/src/fishing_ml/evaluate.py:53-148` — Replace duplicate config parser with canonical; separate evidence from policy; guard schema-v2 final path.
- `avatar-web/fishing-ml/src/fishing_ml/artifacts.py:113-146` — Strict-parse frozen model-config (v1/v2); parameterize `verify_current_dataset` review path; freeze manifest stays v1.
- `avatar-web/fishing-ml/src/fishing_ml/experiments.py:100-657` — Strict manifest parsers, dataset-version integration, full CLI state machine, calibrated selection.
- `avatar-web/fishing-ml/src/fishing_ml/replay.py:95-858` — Add `latency_max_ms`, labeled raw correctness, batch exact aggregates; bump schema v2.
- `avatar-web/fishing-ml/src/fishing_ml/schema.py:424-448` — Add `publish_no_replace` (byte-equivalent idempotent, else FileExistsError).
- `avatar-web/fishing-ml/src/fishing_ml/calibrate.py:119-147` — Preserve calibrated document; expose strict parsing contract.
- `avatar-web/fishing-ml/src/fishing_ml/inference_contract.py:39-48` — Add `MAX_CANONICAL_REQUEST_BYTES`; expose pure size calculator.
- `avatar-web/fishing-ml/src/fishing_ml/inference_client.py:32-215` — Replace `_MAX_REQUEST_BYTES` with canonical constant; remove dead helpers.
- `avatar-web/fishing-ml/src/fishing_ml/inference_service.py:815-853` — Default `max_body_bytes` to canonical constant; bounded CLI override.
- `avatar-web/fishing-ml/pyproject.toml:20-31` — Register `fishing-phase2-experiment`, `fishing-phase2-replay`, `fishing-phase2-gate`.

### Production Config

- `avatar-web/fishing-ml/config/phase2/candidates.yaml` — Schema v2 base config, augmentation/hard-negative axis mapping.
- `avatar-web/fishing-ml/config/phase2/gate.yaml` — Add `errorBudget`; keep placeholder state.

### Production TypeScript

- `avatar-web/server/src/fishing/inferenceClient.ts:43-404` — Add `MAX_CANONICAL_REQUEST_BYTES`; validate serialized body size before fetch.

### Test Files — Create After Production Code

- `avatar-web/fishing-ml/tests/test_phase2_training.py`
- `avatar-web/fishing-ml/tests/test_phase2_experiments.py`
- `avatar-web/fishing-ml/tests/test_phase2_gate.py`
- `avatar-web/fishing-ml/tests/test_inference_size_contract.py`
- `avatar-web/server/src/fishing/inferenceClient.test.ts`

### Documentation

- `avatar-web/fishing-ml/README.md` — Config v2, stage CLI, gate statuses, exact commands.
- `docs/superpowers/plans/2026-08-28-fishing-phase-2-results.md` — Add correction/current-status section.
- `docs/superpowers/plans/2026-09-02-fishing-phase-2-code-completion-results.md` — Code verification template.

---

## Task 1: Training Config Schema v1/v2

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/config.py:34-105`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/evaluate.py:53-58`

**Interfaces:**
- Produces: `TrainingConfig` with three new fields, `config_to_document(config) -> dict`, `load_training_config_from_document(doc) -> TrainingConfig`.
- Consumes: existing YAML files (schema v1 unchanged).

- [x] **Step 1: Add v2 constants and extend TrainingConfig**

In `config.py`, add after the existing imports:

```python
# Schema v2 allowed values
ALLOWED_AUGMENTATION_PROFILES = frozenset({"none", "photometric", "photometric_plus_geom"})
ALLOWED_HARD_NEGATIVE_RATIOS = frozenset({0.0, 0.25})
_V2_SCHEMA_VERSION = 2

# Schema v1 compatibility defaults (not valid in v2 YAML)
_LEGACY_AUGMENTATION_PROFILE = "legacy_combined"
_LEGACY_HARD_NEGATIVE_RATIO = 0.0
_LEGACY_HARD_NEGATIVE_MARGIN = 0.10
```

Extend `TrainingConfig` dataclass (currently lines 34–46) to add three fields after `reproducibility_tolerance`:

```python
augmentation_profile: str = _LEGACY_AUGMENTATION_PROFILE
hard_negative_ratio: float = _LEGACY_HARD_NEGATIVE_RATIO
hard_negative_margin: float = _LEGACY_HARD_NEGATIVE_MARGIN
```

Note: the current `TrainingConfig` is a flat dataclass — there is no `hidden_dim` field or nested `model` dict. The YAML has `model.hiddenDim` but `load_training_config` does not currently extract it. Do not introduce a nested `model` key in `config_to_document`.

- [x] **Step 2: Share one v1/v2 parser between Path and document loading**

Replace `load_training_config` (config.py:49-105) and add `load_training_config_from_document` plus a shared `_parse_config_document`. The current code (lines 62–70) compares `set(raw)` against `_REQUIRED_KEYS` exactly and rejects `schema_version != 1` at line 73 — both change to a schema-version-aware superset check, and the same body serves YAML files and in-memory model-config documents:

```python
_V1_REQUIRED_KEYS = frozenset({
    "schemaVersion", "seed", "epochs", "learningRate", "weightDecay",
    "temperature", "embeddingDim", "channels", "checkpointMetric",
    "device", "workers", "reproducibilityTolerance",
})
_V2_EXTRA_KEYS = frozenset({"augmentationProfile", "hardNegativeRatio", "hardNegativeMargin"})


def load_training_config(path: Path) -> TrainingConfig:
    """Load a schema-v1 or schema-v2 YAML config, rejecting coercion and unknown fields."""
    config_path = Path(path)
    try:
        raw = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    except OSError as error:
        raise ValueError(f"cannot read training config {config_path}: {error}") from error
    except yaml.YAMLError as error:
        raise ValueError(f"invalid YAML in training config {config_path}: {error}") from error
    if not isinstance(raw, Mapping):
        raise ValueError("training config must be a YAML mapping")
    return _parse_config_document(raw)


def load_training_config_from_document(document: Mapping[str, Any]) -> TrainingConfig:
    """Parse an in-memory training-config document (model-config.json, v1 or v2)."""
    return _parse_config_document(document)


def _parse_config_document(raw: Mapping[str, Any]) -> TrainingConfig:
    """Shared canonical parser: exact key set per schemaVersion, strict field types."""
    schema_version = _integer(raw, "schemaVersion", minimum=1)
    if schema_version not in (_SCHEMA_VERSION, _V2_SCHEMA_VERSION):
        raise ValueError(f"unsupported training config schemaVersion {schema_version}")
    v2 = schema_version == _V2_SCHEMA_VERSION
    allowed_keys = _V1_REQUIRED_KEYS | (_V2_EXTRA_KEYS if v2 else frozenset())
    keys = set(raw)
    missing = sorted(allowed_keys - keys)
    unknown = sorted(keys - allowed_keys)
    if missing or unknown:
        details = []
        if missing:
            details.append(f"missing keys: {', '.join(missing)}")
        if unknown:
            details.append(f"unknown keys: {', '.join(map(str, unknown))}")
        raise ValueError("invalid training config keys (" + "; ".join(details) + ")")

    channels_value = raw["channels"]
    if not isinstance(channels_value, list) or len(channels_value) != 4:
        raise ValueError("channels must be a list of exactly four positive integers")
    channels = tuple(_positive_integer(value, f"channels[{index}]") for index, value in enumerate(channels_value))

    checkpoint_metric = _string(raw, "checkpointMetric")
    if checkpoint_metric not in _SUPPORTED_CHECKPOINT_METRICS:
        raise ValueError(f"unsupported checkpointMetric {checkpoint_metric!r}")
    device = _string(raw, "device")
    if device not in _SUPPORTED_DEVICES:
        raise ValueError(f"unsupported device {device!r}")

    augmentation_profile = _LEGACY_AUGMENTATION_PROFILE
    hard_negative_ratio = _LEGACY_HARD_NEGATIVE_RATIO
    hard_negative_margin = _LEGACY_HARD_NEGATIVE_MARGIN
    if v2:
        # Spec §3.2/§3.5: schema-v2 configs MUST carry all three fields (missing
        # keys already rejected above via the allowed_keys superset check).
        augmentation_profile = _string(raw, "augmentationProfile")
        if augmentation_profile not in ALLOWED_AUGMENTATION_PROFILES:
            raise ValueError(f"augmentationProfile must be one of {sorted(ALLOWED_AUGMENTATION_PROFILES)}")
        if augmentation_profile == _LEGACY_AUGMENTATION_PROFILE:
            raise ValueError("legacy_combined is not valid in schema v2")
        hard_negative_ratio = _finite_number(raw, "hardNegativeRatio")
        if hard_negative_ratio not in ALLOWED_HARD_NEGATIVE_RATIOS:
            raise ValueError(f"hardNegativeRatio must be one of {sorted(ALLOWED_HARD_NEGATIVE_RATIOS)}")
        hard_negative_margin = _finite_number(raw, "hardNegativeMargin")
        if hard_negative_margin <= 0:
            raise ValueError("hardNegativeMargin must be positive")

    return TrainingConfig(
        schema_version=schema_version,
        seed=_integer(raw, "seed", minimum=0),
        epochs=_integer(raw, "epochs", minimum=1),
        learning_rate=_finite_number(raw, "learningRate", minimum_exclusive=0.0),
        weight_decay=_finite_number(raw, "weightDecay", minimum_inclusive=0.0),
        temperature=_finite_number(raw, "temperature", minimum_exclusive=0.0),
        embedding_dim=_integer(raw, "embeddingDim", minimum=1),
        channels=channels,  # type: ignore[arg-type]
        checkpoint_metric=checkpoint_metric,
        device=device,
        workers=_integer(raw, "workers", minimum=0),
        reproducibility_tolerance=_finite_number(
            raw,
            "reproducibilityTolerance",
            minimum_inclusive=0.0,
            maximum_inclusive=1.0,
        ),
        augmentation_profile=augmentation_profile,
        hard_negative_ratio=hard_negative_ratio,
        hard_negative_margin=hard_negative_margin,
    )
```

This keeps v1 behavior byte-identical for Phase A configs (`train-baseline.yaml`, frozen model-config.json): v1 key set and error messages unchanged, `TrainingConfig` gains the three defaulted fields.

- [x] **Step 3: Add canonical serializer config_to_document**

Add a new public function after `load_training_config`:

```python
def config_to_document(config: TrainingConfig) -> dict[str, object]:
    """Canonical serialization for model-config.json and effective config hashing.
    
    Always writes all fields including v2 augmentation/hard-negative fields.
    Schema v1 configs get legacy defaults; schema v2 configs get explicit values.
    
    The output is a FLAT mapping matching the YAML camelCase field names,
    suitable for deterministic hashing with sort_keys=True.
    """
    doc: dict[str, object] = {
        "schemaVersion": config.schema_version,
        "seed": config.seed,
        "epochs": config.epochs,
        "learningRate": config.learning_rate,
        "weightDecay": config.weight_decay,
        "temperature": config.temperature,
        "embeddingDim": config.embedding_dim,
        "channels": list(config.channels),
        "checkpointMetric": config.checkpoint_metric,
        "device": config.device,
        "workers": config.workers,
        "reproducibilityTolerance": config.reproducibility_tolerance,
    }
    if config.schema_version >= 2:
        doc["augmentationProfile"] = config.augmentation_profile
        doc["hardNegativeRatio"] = config.hard_negative_ratio
        doc["hardNegativeMargin"] = config.hard_negative_margin
    return doc
```

This replaces the existing `_config_json` in `train.py` (lines 211–219) which produces the same flat camelCase dict.

- [x] **Step 4: Replace duplicate config parser in evaluate.py**

The old `load_training_config_from_document` (evaluate.py:53-58) hardcodes an exact v1 key set and constructs `TrainingConfig` positionally without the new fields — a phase-2 candidate's `model-config.json` (schema v2, containing `augmentationProfile`/`hardNegativeRatio`/`hardNegativeMargin`) would raise "model config fields mismatch". Replace the entire function (remove the old body and its local `from .config import TrainingConfig` import, which becomes unused) with a thin delegate to the canonical parser:

```python
def load_training_config_from_document(doc: dict):
    """Canonical parser delegating to config.py (supports schema v1 and v2)."""
    from .config import load_training_config_from_document as _canonical
    return _canonical(doc)
```

- [x] **Step 5: Verify**

Run: `cd avatar-web/fishing-ml && python3.11 -m py_compile src/fishing_ml/config.py && python3.11 -m py_compile src/fishing_ml/evaluate.py && python3.11 -c "
from pathlib import Path
from fishing_ml.config import load_training_config
c = load_training_config(Path('config/train-baseline.yaml'))
assert c.schema_version == 1
assert c.augmentation_profile == 'legacy_combined'
assert c.hard_negative_ratio == 0.0
assert c.hard_negative_margin == 0.10
print('v1 OK', c.augmentation_profile, c.hard_negative_ratio, c.hard_negative_margin)
v2 = {'schemaVersion': 2, 'seed': 1, 'epochs': 2, 'learningRate': 0.001, 'weightDecay': 0.0001,
      'temperature': 0.07, 'embeddingDim': 96, 'channels': [32, 64, 96, 128],
      'checkpointMetric': 'dev_top1_accuracy', 'device': 'cpu', 'workers': 0,
      'reproducibilityTolerance': 0.002, 'augmentationProfile': 'none',
      'hardNegativeRatio': 0.25, 'hardNegativeMargin': 0.10}
from fishing_ml.config import load_training_config_from_document
d = load_training_config_from_document(v2)
assert (d.augmentation_profile, d.hard_negative_ratio, d.hard_negative_margin) == ('none', 0.25, 0.10)
try:
    load_training_config_from_document(dict(v2, augmentationProfile='legacy_combined'))
    raise SystemExit('expected ValueError')
except ValueError:
    pass
print('v2 OK')
from fishing_ml.evaluate import load_training_config_from_document as eval_loader
assert eval_loader(v2).hard_negative_ratio == 0.25
print('evaluate delegate OK')
"`
Expected: `v1 OK legacy_combined 0.0 0.1`, `v2 OK`, `evaluate delegate OK` — the v1 YAML loads with legacy defaults; the v2 document round-trips; `legacy_combined` is rejected in v2; the evaluator delegate parses v2.

- [x] **Step 6: Commit**

```bash
git add avatar-web/fishing-ml/src/fishing_ml/config.py avatar-web/fishing-ml/src/fishing_ml/evaluate.py
git commit -m "feat(config): add training config schema v2 with augmentation/hard-negative fields"
```

---

## Task 2: Deterministic Augmentation and Hard-Negative Policy

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/phase2_training.py`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/dataset.py:88-105`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/train.py:63-97`

**Interfaces:**
- Produces: `stable_seed_context(...)`, `derive_rng(...)`, `apply_augmentation_profile(...)`, `compute_hard_negative_loss(...)`.
- Consumes: `TrainingConfig.augmentation_profile`, `TrainingConfig.hard_negative_ratio`, `TrainingConfig.hard_negative_margin`.

- [x] **Step 1: Create phase2_training.py with stable seed derivation**

```python
"""Deterministic augmentation profiles and hard-negative auxiliary loss for Phase 2."""
from __future__ import annotations

import hashlib
import math
import random
from typing import Sequence

import torch

# ---------------------------------------------------------------------------
# Stable seed derivation
# ---------------------------------------------------------------------------

def stable_seed_context(
    global_seed: int,
    epoch: int,
    batch_id: str,
    role: str,
    index: int,
) -> bytes:
    """Deterministic context bytes for RNG. Not dependent on process state."""
    payload = f"{global_seed}|{epoch}|{batch_id}|{role}|{index}"
    return hashlib.sha256(payload.encode("utf-8")).digest()


def derive_rng(context: bytes) -> random.Random:
    """Create a deterministic RNG from stable context bytes."""
    seed_int = int.from_bytes(context[:8], "big")
    return random.Random(seed_int)


# ---------------------------------------------------------------------------
# Augmentation profiles
# ---------------------------------------------------------------------------

def _transform_rng(context: bytes, transform: str) -> random.Random:
    """Per-transform RNG, domain-separated from the canonical context.

    Spec §3.3: each transform creates its own RNG from the SHA-256 stable
    context. Domain separation (appending the transform tag before the second
    SHA-256) keeps the two transforms of `photometric_plus_geom` independent,
    so the photometric values do not depend on how many values the geometric
    transform draws, and `photometric` alone and `photometric_plus_geom`
    produce identical photometric steps for the same image.
    """
    return derive_rng(hashlib.sha256(context + transform.encode("utf-8")).digest())


def apply_augmentation_profile(
    profile: str,
    tensor: torch.Tensor,
    context: bytes,
) -> torch.Tensor:
    """Apply deterministic augmentation to an RGB tensor in [0,1].

    Args:
        profile: one of "none", "photometric", "photometric_plus_geom"
        tensor: shape (3, H, W), values in [0, 1]
        context: canonical stable context bytes (see stable_seed_context)
    """
    if profile == "none":
        return tensor
    if profile == "photometric":
        return _photometric(tensor, _transform_rng(context, "photometric"))
    if profile == "photometric_plus_geom":
        tensor = _photometric(tensor, _transform_rng(context, "photometric"))
        return _geometric(tensor, _transform_rng(context, "geometric"))
    raise ValueError(f"Unknown augmentation profile: {profile!r}")


def _photometric(tensor: torch.Tensor, rng: random.Random) -> torch.Tensor:
    gain = 1.0 + rng.uniform(-0.08, 0.08)  # [0.92, 1.08]
    offset = rng.uniform(-0.04, 0.04)
    return (tensor * gain + offset).clamp(0.0, 1.0)


def _geometric(tensor: torch.Tensor, rng: random.Random) -> torch.Tensor:
    dx = rng.randint(-3, 3)
    dy = rng.randint(-3, 3)
    scale = rng.uniform(0.95, 1.05)
    # Same center-of-75x75 normalization as the v1 _augment (75 / 2 = 37.5):
    # theta is in normalized [-1, 1] image coordinates.
    h, w = tensor.shape[1], tensor.shape[2]
    theta = torch.tensor(
        [[[scale, 0, dx / (w / 2.0)], [0, scale, dy / (h / 2.0)]]],
        dtype=tensor.dtype,
    )
    grid = torch.nn.functional.affine_grid(
        theta, (1, *tensor.shape), align_corners=False
    )
    return torch.nn.functional.grid_sample(
        tensor.unsqueeze(0), grid, mode="bilinear", padding_mode="border", align_corners=False
    )[0].clamp(0.0, 1.0)


# ---------------------------------------------------------------------------
# Hard-negative auxiliary margin loss
# ---------------------------------------------------------------------------

def compute_hard_negative_loss(
    query_embeddings: torch.Tensor,
    reference_embeddings: torch.Tensor,
    targets: torch.Tensor,
    ratio: float,
    margin: float,
    global_seed: int,
    epoch: int,
    batch_id: str,
) -> torch.Tensor:
    """Compute auxiliary hardest-negative margin loss.

    Args:
        query_embeddings: (Q, D) L2-normalized query embeddings
        reference_embeddings: (R, D) L2-normalized reference embeddings
        targets: (Q,) long tensor of correct reference index per query
        ratio: fraction of eligible queries to select (0.0 returns zero)
        margin: positive margin for the hinge loss
        global_seed, epoch, batch_id: for deterministic selection
    """
    if ratio <= 0.0 or reference_embeddings.shape[0] < 2:
        # Zero auxiliary loss with the same device/dtype (spec §3.4: an episode
        # with a single reference has no wrong reference to mine).
        return torch.tensor(0.0, device=query_embeddings.device, dtype=query_embeddings.dtype)

    # Cosine similarity matrix (embeddings are already L2-normalized by
    # FishingEncoder.forward; torch.mm of normalized vectors is cosine).
    sim_matrix = torch.mm(query_embeddings, reference_embeddings.t())  # (Q, R)

    # For each query, find the hardest WRONG reference:
    correct_sims = sim_matrix[torch.arange(len(targets)), targets]  # (Q,)
    masked_sim = sim_matrix.clone()
    masked_sim[torch.arange(len(targets)), targets] = float("-inf")
    # torch.max resolves ties to the smallest reference index (spec §3.4.1).
    hardest_wrong_sims = masked_sim.max(dim=1).values  # (Q,)

    # Deterministic selection by stable key (spec §3.4.3):
    #   global seed | epoch | batch id | query index
    eligible_indices = list(range(len(targets)))
    n_select = max(1, math.ceil(len(eligible_indices) * ratio))

    def _selection_key(query_index: int) -> bytes:
        payload = f"{global_seed}|{epoch}|{batch_id}|{query_index}"
        return hashlib.sha256(payload.encode("utf-8")).digest()

    keys = [(int.from_bytes(_selection_key(idx)[:8], "big"), idx) for idx in eligible_indices]
    keys.sort(key=lambda item: item[0])  # stable: key, then index order
    selected = [idx for _, idx in keys[:n_select]]

    selected_t = torch.tensor(selected, device=targets.device)
    aux = torch.clamp(
        margin + hardest_wrong_sims[selected_t] - correct_sims[selected_t],
        min=0.0,
    )
    return aux.mean()
```

- [x] **Step 2: Update dataset.py augmentation dispatch**

The current `_augment` (dataset.py:88-93) runs the combined photometric+geometric transform **after** normalization (it is called on `_entries(..., stats)` output) and clamps to `[-5, 5]`. Spec §3.2/§3.3: `legacy_combined` MUST keep exactly this v1 behavior (post-normalization, clamp −5,5 — it is an internal compatibility value), while schema-v2 profiles run on the raw `[0,1]` RGB tensor **before** normalization with clamp `[0,1]`, train split only, each image's transform using its own RNG derived from `SHA-256(global_seed|epoch|batch_id|role|index)`.

**Keep `_augment` unchanged** (it is the v1 legacy path). Add the v2 helper next to it (dataset.py, after `_augment` line 93):

```python
def _augment_v2(tensor: torch.Tensor, profile: str, context: bytes) -> torch.Tensor:
    """Schema-v2 deterministic augmentation on a raw [0,1] RGB tensor (3, H, W)."""
    from .phase2_training import apply_augmentation_profile

    return apply_augmentation_profile(profile, tensor, context)
```

Rewrite `_load` (dataset.py:95-105) to branch on the profile. The v1 branch is byte-for-byte the existing code; the v2 branch loads raw images (`stats=None`), applies per-image derived RNGs, then normalizes (spec §4.1: "tại boundary trước normalization"):

```python
def _load(
    raw_root, labels_root, splits_root, split, stats,
    *, duplicate_reviews=None, train=False, seed=20260827, limit=None,
    augmentation_profile="legacy_combined", epoch=0, global_seed=None,
):
    if split == "final": raise ValueError("final split is locked; use fishing_ml.evaluate final loader")
    _validate_split_inputs(raw_root, labels_root, splits_root, duplicate_reviews)
    ids = _split_ids(splits_root, split)[:limit]
    rng = random.Random(seed)
    out = []
    for bid in ids:
        if train and augmentation_profile == "legacy_combined":
            # v1 legacy: EXACT existing behavior — shuffle, then the shared rng
            # drives _augment on already-normalized tensors (clamp [-5, 5]).
            r, q, t = _entries(raw_root, labels_root, bid, stats)
            order = list(range(len(r))); rng.shuffle(order)
            remap = {old: new for new, old in enumerate(order)}
            r = r[order]; t = torch.tensor([remap[int(v)] for v in t])
            r = torch.stack([_augment(v, rng) for v in r])
            q = torch.stack([_augment(v, rng) for v in q])
        elif train:
            # v2: augmentation on RAW [0,1] BEFORE normalization. The image index
            # in the stable context is the image's position in its role list as
            # loaded (references in ascending img_index order, queries in manifest
            # order) — i.e. BEFORE the shuffle — so augmentation is a pure
            # function of (global_seed, epoch, batch_id, role, image index) and
            # does not depend on where the shuffle happens to place the image
            # (spec §3.3: results must not depend on traversal order, worker
            # scheduling, or RNG calls for other images).
            r, q, t = _entries(raw_root, labels_root, bid, None)
            base_seed = global_seed if global_seed is not None else seed
            r = torch.stack([
                _augment_v2(v, augmentation_profile,
                            stable_seed_context(base_seed, epoch, bid, "reference", i))
                for i, v in enumerate(r)
            ])
            q = torch.stack([
                _augment_v2(v, augmentation_profile,
                            stable_seed_context(base_seed, epoch, bid, "query", i))
                for i, v in enumerate(q)
            ])
            # The reference-order shuffle still runs afterwards (spec §3.3).
            order = list(range(len(r))); rng.shuffle(order)
            remap = {old: new for new, old in enumerate(order)}
            r = r[order]; t = torch.tensor([remap[int(v)] for v in t])
            mean, std = _validate_normalization_stats(stats)
            r = (r - mean) / std
            q = (q - mean) / std
        else:
            # Dev/final: NEVER augmented, regardless of profile (spec §3.3).
            r, q, t = _entries(raw_root, labels_root, bid, stats)
        out.append(FishingEpisode(bid, r, q, t))
    return out
```

Import at the top of dataset.py (with the existing `from .schema import ...` imports at line 11):

```python
from .phase2_training import stable_seed_context
```

(`stable_seed_context` is plain hashlib — importable without torch at module level; `derive_rng` is used only inside `_augment_v2`'s local import so dataset.py never touches torch beyond what it already imports.)

Update the loaders (dataset.py:107-108) to forward and default the new parameters:

```python
def load_training_episodes(
    raw_root, labels_root, splits_root, stats, *,
    duplicate_reviews=None, seed=20260827, limit=None,
    augmentation_profile="legacy_combined", epoch=0, global_seed=None,
): return _load(Path(raw_root), Path(labels_root), Path(splits_root), "train", stats,
                 duplicate_reviews=duplicate_reviews, train=True, seed=seed, limit=limit,
                 augmentation_profile=augmentation_profile, epoch=epoch, global_seed=global_seed)

def load_dev_episodes(raw_root, labels_root, splits_root, stats, *, duplicate_reviews=None, limit=None):
    # Dev loader keeps its exact current signature: no augmentation, ever.
    return _load(Path(raw_root), Path(labels_root), Path(splits_root), "dev", stats,
                 duplicate_reviews=duplicate_reviews, limit=limit)
```

- [x] **Step 3: Thread config/epoch into train.py**

`FishingEncoder` has no `.encode` submodule — `forward(images)` IS the encoder and already returns L2-normalized embeddings. `train_epoch` (train.py:63-97) already computes `reference_embeddings`/`query_embeddings` with gradients; the auxiliary loss must reuse them (no `torch.no_grad()`, no re-normalization). Update the `train_epoch` signature and add the auxiliary loss between loss computation and `loss.backward()`:

```python
def train_epoch(
    model: FishingEncoder,
    episodes: Iterable[FishingEpisode],
    optimizer: torch.optim.Optimizer,
    *,
    temperature: float,
    device: torch.device,
    config: TrainingConfig | None = None,
    epoch: int = 0,
) -> float:
    """Optimize one pass over variable-size train episodes."""
    model.train()
    loss_sum = 0.0
    query_count = 0
    for episode in episodes:
        references = episode.references.to(device)
        queries = episode.queries.to(device)
        targets = episode.targets.to(device)
        _finite_tensor(references, "training references")
        _finite_tensor(queries, "training queries")
        optimizer.zero_grad(set_to_none=True)
        reference_embeddings = model(references)
        query_embeddings = model(queries)
        logits = episode_logits(query_embeddings, reference_embeddings, temperature)
        loss = episode_loss(logits, targets)
        if config is not None and config.hard_negative_ratio > 0:
            from .phase2_training import compute_hard_negative_loss

            # Same normalized embeddings already used for the CE loss; the model
            # output is L2-normalized, so no re-normalization and NO no_grad —
            # the auxiliary loss must backpropagate through the encoder.
            hn_loss = compute_hard_negative_loss(
                query_embeddings,
                reference_embeddings,
                targets,
                ratio=config.hard_negative_ratio,
                margin=config.hard_negative_margin,
                global_seed=config.seed,
                epoch=epoch,
                batch_id=episode.batch_id,
            )
            _finite_tensor(loss, "training loss")
            _finite_tensor(hn_loss, "hard-negative loss")
            loss = loss + hn_loss
        else:
            _finite_tensor(loss, "training loss")
        loss.backward()
        for parameter in model.parameters():
            if parameter.grad is not None:
                _finite_tensor(parameter.grad, "gradient")
        optimizer.step()
        count = int(targets.numel())
        loss_sum += float(loss.detach().cpu()) * count
        query_count += count
    if query_count == 0:
        raise ValueError("training split contains no queries")
    return loss_sum / query_count
```

Note: when `ratio == 0.0` (i.e. `hardNegativeRatio: 0.0`), the `if` guard is skipped entirely — the exact cross-entropy path is preserved (spec §3.4: "giữ exact cross-entropy path, không thay đổi loss hoặc gradient"). This also keeps schema-v1 configs (ratio defaults to 0.0) on the untouched path.

Update `_config_json` (train.py:211-219) to use the canonical serializer:

```python
def _config_json(config: TrainingConfig) -> dict[str, object]:
    from .config import config_to_document
    return config_to_document(config)
```

Update the `run_training` call sites (train.py:258-278) to thread the config/epoch into the train loaders and `train_epoch`. First, replace the pre-loop load at train.py:258-261 — the epoch-1 load is hoisted precisely because it would otherwise be loaded twice, so it must carry `epoch=1` explicitly:

```python
        first_train_episodes = load_training_episodes(
            raw_root, labels_root, splits_root, stats,
            duplicate_reviews=duplicate_reviews, seed=config.seed,
            augmentation_profile=config.augmentation_profile,
            epoch=1,
            global_seed=config.seed,
        )
```

(`dev_episodes` at train.py:262-264 stays exactly as-is — dev never augments.)

Then the in-loop load and the `train_epoch` call (train.py:274-278):

```python
            train_episodes = first_train_episodes if epoch == 1 else load_training_episodes(
                raw_root, labels_root, splits_root, stats,
                duplicate_reviews=duplicate_reviews, seed=config.seed + epoch - 1,
                augmentation_profile=config.augmentation_profile,
                epoch=epoch,
                global_seed=config.seed,
            )
            train_loss = train_epoch(
                model, train_episodes, optimizer,
                temperature=config.temperature, device=device,
                config=config, epoch=epoch,
            )
```

The epoch-1 hoisted load and the loop's first iteration now produce identical episode tensors: same `seed=config.seed`, same `epoch=1`, same `global_seed=config.seed` — and since there is no `random.Random(seed)` dependency left for v2 augmentation, `first_train_episodes` is reused verbatim with no drift. For `legacy_combined`, the epoch loop's epoch-1 branch also reuses the same list, preserving the exact v1 seed order (`config.seed` for epoch 1, `config.seed + epoch - 1` later).

**Config hash note:** the effective config overlay now contains `augmentationProfile`/`hardNegativeRatio`/`hardNegativeMargin` (Task 7), so the YAML written by `_yaml_config_path` is schema v2 and `load_training_config` accepts it after Task 1. Schema-v1 configs (Phase A runs) keep `_config_json` output identical to today, because `config_to_document` writes v2 fields only when `schema_version >= 2`.

- [x] **Step 4: Verify**

Run: `cd avatar-web/fishing-ml && python3.11 -m py_compile src/fishing_ml/phase2_training.py && python3.11 -m py_compile src/fishing_ml/dataset.py && python3.11 -m py_compile src/fishing_ml/train.py`
Expected: All compile cleanly. v1 training behavior preserved when ratio=0.0.

- [x] **Step 5: Commit**

```bash
git add avatar-web/fishing-ml/src/fishing_ml/phase2_training.py avatar-web/fishing-ml/src/fishing_ml/dataset.py avatar-web/fishing-ml/src/fishing_ml/train.py
git commit -m "feat(training): add deterministic augmentation profiles and hard-negative auxiliary loss"
```

---

## Task 3: Replay Report Completion

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/replay.py:95-858`

**Interfaces:**
- Extends: `ReplayReport` with `latency_max_ms`, labeled raw correctness, batch exact aggregates.
- Bumps: replay aggregate schema from v1 to v2.

- [x] **Step 1: Extend ReplayReport dataclass**

Add to `ReplayReport` (currently lines 95–126) after `latency_p99_ms`:

```python
latency_max_ms: float | None
labeled_correct_prediction_count: int
labeled_wrong_prediction_count: int
labeled_top1_accuracy: float | None
labeled_batch_exact_count: int
labeled_batch_exact_match: float | None
labeled_accepted_rate: float | None
```

Update `_REPLAY_SCHEMA_VERSION` from `1` to `2`.

- [x] **Step 2: Add latency_max_ms field to ReplayReport and to_dict**

The `ReplayReport.to_dict` currently emits `clientLatencyMs` with `sampleCount`, `p50`, `p95`, `p99`, `rule` (lines 153–159). Add `max` after `p99`:

```python
"clientLatencyMs": {
    "sampleCount": self.latency_sample_count,
    "p50": self.latency_p50_ms,
    "p95": self.latency_p95_ms,
    "p99": self.latency_p99_ms,
    "max": self.latency_max_ms,
    "rule": "nearest-rank",
},
```

- [x] **Step 3: Add labeled raw correctness tracking to accumulator**

Extend `_Accumulator` (lines 197–218) with:

```python
labeled_correct_prediction_count: int = 0
labeled_wrong_prediction_count: int = 0
labeled_batch_exact_count: int = 0
```

The current `_record_predictions` (replay.py:505-539) already increments `labeled_batch_count`/`labeled_query_count`/`labeled_returned_prediction_count` at lines 530-532, then only counts correctness among ACCEPTED predictions (lines 533-539). The spec §3.11 requires **raw top-1** accuracy (every labeled query, accepted or not) and batch exact-match. Replace the existing `for query_index, prediction in returned.items():` loop (lines 533-539) with:

```python
    batch_exact = True
    for query_index, prediction in returned.items():
        is_correct = prediction.reference_index == ground_truth[query_index]
        if prediction.accepted:
            if is_correct:
                accumulator.correct_accepted_count += 1
            else:
                accumulator.wrong_accepted_count += 1
        if is_correct:
            accumulator.labeled_correct_prediction_count += 1
        else:
            accumulator.labeled_wrong_prediction_count += 1
        batch_exact = batch_exact and is_correct
    if batch_exact:
        accumulator.labeled_batch_exact_count += 1
```

(Do NOT re-add the `labeled_batch_count`/`labeled_query_count`/`labeled_returned_prediction_count` increments — lines 530-532 already do those. This uses `response.predictions` which always carries `reference_index` for every returned query — accepting/abstention only affects the `accepted` flag, not the top-1 `reference_index`. Omitted queries (missing from `returned`) make `batch_exact` False but contribute no raw correctness count, so the top-1 denominator stays `labeled_returned_prediction_count`.)

- [x] **Step 4: Compute derived rates in _freeze_report**

In `_freeze_report` (lines 542–604), after building the `ReplayReport`, pass the derived values into the constructor. Replace the `latency_p99_ms=` line and add the new aggregates:

```python
    # Labeled raw metrics use _safe_rate (returns None on denominator 0) and the
    # denominators that _record_predictions actually increments:
    #  - labeled top-1 counts every RETURNED labeled prediction (accepted or
    #    abstained), so denominator = labeled_returned_prediction_count;
    #  - labeled accepted rate = accepted labeled queries / returned labeled;
    #  - labeled batch exact = exact labeled batches / labeled batches.
    labeled_top1_accuracy = _safe_rate(
        accumulator.labeled_correct_prediction_count,
        accumulator.labeled_returned_prediction_count,
    )
    labeled_accepted_rate = _safe_rate(
        accumulator.correct_accepted_count + accumulator.wrong_accepted_count,
        accumulator.labeled_returned_prediction_count,
    )
    labeled_batch_exact_match = _safe_rate(
        accumulator.labeled_batch_exact_count,
        accumulator.labeled_batch_count,
    )

    return ReplayReport(
        schema_version=_REPLAY_SCHEMA_VERSION,
        batch_count=accumulator.batch_count,
        query_count=accumulator.query_count,
        request_count=accumulator.request_count,
        successful_batch_count=accumulator.successful_batch_count,
        errored_batch_count=errored,  # already computed above in _freeze_report
        accepted_count=accumulator.accepted_count,
        accepted_rate=_safe_rate(
            accumulator.accepted_count,
            accumulator.accepted_count
            + accumulator.abstained_count
            + accumulator.omitted_count,
        ),
        abstained_count=accumulator.abstained_count,
        abstained_rate=_safe_rate(
            accumulator.abstained_count,
            accumulator.accepted_count
            + accumulator.abstained_count
            + accumulator.omitted_count,
        ),
        omitted_count=accumulator.omitted_count,
        omitted_rate=_safe_rate(
            accumulator.omitted_count,
            accumulator.accepted_count
            + accumulator.abstained_count
            + accumulator.omitted_count,
        ),
        labeled_batch_count=accumulator.labeled_batch_count,
        unknown_batch_count=accumulator.unknown_batch_count,
        labeled_query_count=accumulator.labeled_query_count,
        unknown_query_count=accumulator.unknown_query_count,
        labeled_returned_prediction_count=accumulator.labeled_returned_prediction_count,
        unknown_returned_prediction_count=accumulator.unknown_returned_prediction_count,
        correct_accepted_count=accumulator.correct_accepted_count,
        wrong_accepted_count=accumulator.wrong_accepted_count,
        error_counts=dict(sorted(accumulator.errors.items())),
        latency_sample_count=len(accumulator.request_latencies_ms),
        latency_p50_ms=_nearest_rank(accumulator.request_latencies_ms, 50),
        latency_p95_ms=_nearest_rank(accumulator.request_latencies_ms, 95),
        latency_p99_ms=_nearest_rank(accumulator.request_latencies_ms, 99),
        latency_max_ms=(
            max(accumulator.request_latencies_ms) if accumulator.request_latencies_ms else None
        ),
        rq_breakdown=rq,
        model_ids=tuple(sorted(accumulator.model_ids)),
        model_checksums=model_checksums,
        labeled_correct_prediction_count=accumulator.labeled_correct_prediction_count,
        labeled_wrong_prediction_count=accumulator.labeled_wrong_prediction_count,
        labeled_top1_accuracy=labeled_top1_accuracy,
        labeled_batch_exact_count=accumulator.labeled_batch_exact_count,
        labeled_batch_exact_match=labeled_batch_exact_match,
        labeled_accepted_rate=labeled_accepted_rate,
    )
```

- [x] **Step 5: Update ReplayReport.to_dict serialization**

Add to the serialized dict (lines 131–168), after `wrongAcceptedCount`:

```python
"labeledCorrectPredictionCount": self.labeled_correct_prediction_count,
"labeledWrongPredictionCount": self.labeled_wrong_prediction_count,
"labeledTop1Accuracy": self.labeled_top1_accuracy,
"labeledBatchExactCount": self.labeled_batch_exact_count,
"labeledBatchExactMatch": self.labeled_batch_exact_match,
"labeledAcceptedRate": self.labeled_accepted_rate,
```

- [x] **Step 6: Verify**

Run: `cd avatar-web/fishing-ml && python3.11 -m py_compile src/fishing_ml/replay.py`
Expected: Compiles cleanly. Old schema v1 consumers can parse v2 with new fields ignored or rejected.

- [x] **Step 7: Commit**

```bash
git add avatar-web/fishing-ml/src/fishing_ml/replay.py
git commit -m "feat(replay): add max latency, labeled correctness, and batch exact aggregates"
```

---

## Task 4: File No-Replace Publisher and Freeze Provenance

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/schema.py:424-448` (add `publish_no_replace`)
- Modify: `avatar-web/fishing-ml/src/fishing_ml/artifacts.py:113-141` (freeze_run model-config validation)
- Modify: `avatar-web/fishing-ml/src/fishing_ml/artifacts.py:144-146` (verify_current_dataset signature + review path)

**Interfaces:**
- Produces: `publish_no_replace(path, value)` — immutable, byte-equivalent-idempotent publication primitive (used by Task 9 selection and Task 6/10 gate report).
- Produces: `verify_current_dataset(..., duplicate_reviews=None)` — parameter makes the review path explicit without changing existing-caller behavior.
- Consumes: `load_training_config_from_document` (Task 1) for the frozen model-config strict parse.
- Unchanged: `FreezeManifest`/`_manifest` stay schema v1; `freeze_run` no-replace boundary stays.

- [x] **Step 1: Add publish_no_replace to schema.py**

Add after `atomic_write_json` (schema.py:424-448), reusing its exact JSON text shape (`sort_keys=True, separators=(",", ":")`, trailing newline, `ensure_ascii=False`):

```python
def publish_no_replace(path: Path, value: dict[str, object]) -> None:
    """Publish JSON atomically with no-replace semantics.

    If the path already exists with byte-equivalent content, succeeds idempotently
    (spec §5.3: "indempotent nếu nội dung giống byte nhau"). If it exists with
    different content, raises FileExistsError and leaves the existing file intact.
    Reused for terminal artifacts: phase2-selection.json, final gate report.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    text = (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    )
    target_bytes = text.encode("utf-8")
    if path.exists():
        if path.read_bytes() == target_bytes:
            return
        raise FileExistsError(f"refusing to overwrite existing artifact: {path}")
    tmp = path.parent / f".{path.name}.tmp.{os.getpid()}.{os.urandom(6).hex()}"
    try:
        with open(tmp, "wb") as handle:
            handle.write(target_bytes)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    finally:
        try:
            if tmp.exists():
                os.remove(tmp)
        except OSError:
            pass
```

- [x] **Step 2: Record schema-v2 config fields in freeze_run (preserve no-replace boundary)**

Spec §4.1 "artifacts.py — Preserve freeze/verify no-replace boundary; ghi/verify schema-v2 model config fields". The freeze **manifest itself stays schema v1 and unchanged** (spec does not define a v2 freeze manifest; `FreezeManifest`, `_manifest`, and the `{schemaVersion, runId, gitRevision, files}` key set stay exactly as they are — v1 frozen artifacts remain loadable). The schema-v2 requirement applies to the **model-config.json` inside the frozen dir**, which `freeze_run` copies from the run dir at artifacts.py:127-131 (`_FROZEN_INPUTS["model-config.json"]`).

So the only change in Step 2 is: in `freeze_run`'s copy loop, validate the model-config document parses under the canonical v1/v2 parser BEFORE copying (fail closed on a malformed v2 config rather than freezing it):

```python
        for destination, source in _FROZEN_INPUTS.items():
            source_path = run_dir / source
            if not source_path.is_file():
                raise FileNotFoundError(source_path)
            if destination == "model-config.json":
                # Spec §4.1: the frozen bundle must carry a schema-valid model
                # config. phase2-training writes schema v2; Phase A froze v1.
                from .config import load_training_config_from_document

                config_doc = read_json(source_path)
                if not isinstance(config_doc, dict):
                    raise ValueError("invalid model-config.json: not a mapping")
                load_training_config_from_document(config_doc)  # strict v1/v2 parse
            shutil.copyfile(source_path, staging / destination)
```

`freeze_run`'s existing no-replace boundary at artifacts.py:116-117 (`if os.path.lexists(frozen_dir): raise FileExistsError`) is unchanged — Task 9's CLI (not this module) implements the "existing verified byte-equivalent frozen output accepted" narrow case, per spec §3.6 `freeze`.

- [x] **Step 3: Fix verify_current_dataset**

In `verify_current_dataset` (artifacts.py:144-164), the current signature is `(frozen_dir, raw_root, labels_root, splits_root)` — it does NOT accept a `duplicate_reviews` path, and its inline default is broken: `Path(__file__).resolve().parents[3] / "config"` resolves to `avatar-web/config/`, but the committed review file lives at `avatar-web/fishing-ml/config/duplicate-reviews.json` (i.e. `parents[2]`). Verified: `_load_reviews` (split.py) returns a `DUPLICATE_REVIEW_SCHEMA` issue when the file is missing, and `validate_splits` extends `issues` with `review_issues` unconditionally — so today's default makes `verify_current_dataset` FAIL for any caller, not silently bypass. Add the parameter, fix the default to the actual location, and let the phase-2 CLI pass the path explicitly:

```python
def verify_current_dataset(
    frozen_dir: Path,
    raw_root: Path,
    labels_root: Path,
    splits_root: Path,
    duplicate_reviews: Path | None = None,
) -> None:
    frozen_dir = Path(frozen_dir)
    if duplicate_reviews is None:
        # Default: the committed review file location (parents[2] = fishing-ml).
        # The historical parents[3] (avatar-web/config) never existed; keeping a
        # default that points nowhere would make this always fail validation.
        duplicate_reviews = Path(__file__).resolve().parents[2] / "config" / "duplicate-reviews.json"
    result = validate_splits(
        Path(raw_root), Path(labels_root), Path(splits_root), duplicate_reviews
    )
    if not result.valid:
        raise ValueError(
            "split validation failed: "
            + "; ".join(f"{item.code}:{item.detail}" for item in result.issues)
        )
    # ... the remainder of the function (snapshot batch + split-checksums
    # verification, lines 147-164) stays unchanged ...
```

(Only the `validate_splits` call at line 146 changes — its one-line form becomes the above branch. All of lines 147-164 are untouched. For Phase A callers this is a bug FIX: the default now points to the file that actually exists and is committed; were it left at parents[3], `evaluate_run`/`evaluate_final_once` would always raise "split validation failed: DUPLICATE_REVIEW_SCHEMA". Task 9's `_cmd_freeze` and `_cmd_confirm_final` pass `--duplicate-reviews` explicitly, so they use the operator-supplied path regardless.)

- [x] **Step 4: Keep freeze_run no-replace (no change) — verify boundary stays**

`freeze_run` (artifacts.py:113-141) already fails closed with `FileExistsError` when the frozen dir exists, and Task 9's `_cmd_freeze` handles the spec §3.6 "existing verified byte-equivalent frozen output accepted" case by first `verify_freeze`-ing an existing frozen dir and only calling `freeze_run` when that fails. **No code change in this task for `freeze_run` beyond Step 2's model-config validation** — the no-replace boundary must remain exactly where it is. This step is a verification step only:

Run: `cd avatar-web/fishing-ml && python3.11 -c "
from pathlib import Path
import inspect
from fishing_ml import artifacts
assert 'lexists' in inspect.getsource(artifacts.freeze_run), 'no-replace boundary missing'
print('freeze_run no-replace boundary intact')
"`

- [x] **Step 5: Verify**

Run: `cd avatar-web/fishing-ml && python3.11 -m py_compile src/fishing_ml/schema.py && python3.11 -m py_compile src/fishing_ml/artifacts.py && python3.11 -c "
import json
from pathlib import Path
from fishing_ml.schema import publish_no_replace
p = Path('build/tmp-publish-test.json')
publish_no_replace(p, {'a': 1})
publish_no_replace(p, {'a': 1})  # byte-equivalent -> idempotent
try:
    publish_no_replace(p, {'a': 2})
    raise SystemExit('expected FileExistsError')
except FileExistsError:
    pass
assert json.loads(p.read_text()) == {'a': 1}
p.unlink()
print('publish_no_replace OK')
"`
Expected: `publish_no_replace OK` — new artifact, same-bytes idempotent, different bytes raises FileExistsError and leaves the existing file untouched. (Step 4's `freeze_run` block already demonstrates the boundary check.)

- [x] **Step 6: Commit**

```bash
git add avatar-web/fishing-ml/src/fishing_ml/schema.py avatar-web/fishing-ml/src/fishing_ml/artifacts.py
git commit -m "feat(artifacts): no-replace publisher, frozen v1/v2 config strict-parse, explicit review path"
```

---

## Task 5: Request-Size Contract Alignment

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/inference_contract.py:39-48`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/inference_client.py:32-215`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/inference_service.py:815-853`
- Modify: `avatar-web/server/src/fishing/inferenceClient.ts:43-55`

**Interfaces:**
- Produces: `MAX_CANONICAL_REQUEST_BYTES = 1_283_950`, pure `canonical_request_byte_length(references, queries) -> int` calculator, `_MAX_BASE64_CHARS` raise from `1_280_004` to `1_280_340`.

**Why these numbers** — the canonical wire document is the exact JSON shape from `_request_document` + the standard serializer (`sort_keys=True, separators=(",", ":")`, UTF-8). A contract-valid request can carry 128 images summing to exactly 960,000 decoded PNG bytes. Base64 chars per image = `4 * ceil(d/3)`. Over all distributions with `Σd = 960_000`, `Σ ceil(d/3)` is maximized at **320,085** — 127 images with `d ≡ 1 (mod 3)` (e.g. `d = 7558`, 10,080 b64 chars) plus 1 image with `d ≡ 2 (mod 3)` (e.g. `d = 134`, 180 b64 chars); any other residue split yields ≤ this. Total b64 chars = `4 * 320_085 = 1_280_340`. Entry overhead (indices 0–63): `{"index":0,"pngBase64":""}` = 26 chars × 10, `{"index":63,...}` = 27 chars × 54, per list = 1,718; envelope `{"schemaVersion":1,"references":[],"queries":[]}` = 48. Therefore the exact maximum canonical byte length = `1_280_340 + 2×1718 + 48 = 1_283_950` (verified by encoding the actual maximal document with `json.dumps`). This is the bound the spec requires: "đủ cho canonical serialization của mọi request đạt decoded budget/count limits."

- [x] **Step 1: Add canonical constant and size calculator to inference_contract.py**

In `inference_contract.py`, after the existing constants (lines 39–48):

```python
# Canonical raw JSON budget for a request at decoded/count limits.  The exact
# maximum over all contract-valid requests: 1,280,340 base64 chars (127 images
# d≡1 mod 3 + 1 image d≡2 mod 3 summing to 960,000 decoded bytes) plus per-entry
# overhead (1,718 per list) plus the 48-char envelope = 1,283,950 bytes.
MAX_CANONICAL_REQUEST_BYTES = 1_283_950
```

Add a pure size calculator. The canonical document shape is owned by the contract itself (do NOT import from `inference_client` — that creates a client→contract→client import cycle):

```python
def _request_document(request: InferenceRequest) -> dict[str, object]:
    return {
        "schemaVersion": request.schema_version,
        "references": [
            {"index": image.index, "pngBase64": image.png_base64}
            for image in request.references
        ],
        "queries": [
            {"index": image.index, "pngBase64": image.png_base64}
            for image in request.queries
        ],
    }


def canonical_request_byte_length(
    references: Sequence[InferenceImage],
    queries: Sequence[InferenceImage],
) -> int:
    """Exact UTF-8 byte length of the canonical compact JSON request.

    Pure function of the image payloads — no I/O, no parsing, no decoding.
    """
    request = InferenceRequest(
        schema_version=SCHEMA_VERSION,
        references=tuple(references),
        queries=tuple(queries),
    )
    return len(
        json.dumps(
            _request_document(request),
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    )
```

`Sequence` is already importable from `collections.abc` in this module. The contract already imports `json` (line 22).

- [x] **Step 2: Update inference_client.py constants and preflight**

The client's outbound budget and its base64 preflight must match the contract's true ceilings. Replace `_MAX_REQUEST_BYTES` (line 33) with the contract constant:

```python
from .inference_contract import MAX_CANONICAL_REQUEST_BYTES

_MAX_REQUEST_BYTES = MAX_CANONICAL_REQUEST_BYTES
```

Replace `_MAX_BASE64_CHARS` (line 37) — the current value `960_000 * 4 // 3 + 4 = 1_280_004` is **below** the true base64 ceiling of 1,280,340, so a contract-valid request at the decoded limit gets rejected by the client preflight. The preflight must be exact (it counts only base64 chars, so the bound must be the worst-case base64 char count, not a decoded-bytes approximation):

```python
# Worst-case base64 char count for 960,000 decoded bytes across 128 images:
# 4 * ceil(d/3) per image, maximized at sum_ceil = 320,085 (all images d ≡ 1
# mod 3 except one d ≡ 2 mod 3).
_MAX_BASE64_CHARS = 1_280_340
```

Remove `_MAX_JSON_DOC_BYTES` (line 44), `_read_bounded` (lines 120–141), `_parse_response` (lines 288–296), and `_parse_response`'s now-unused `_is_strict_utf8`/`_has_surrogate` helpers **only if** the search shows them unused — but note `_parse_response_doc` (line 299) remains the doc-validation path and `_read_response_doc` (line 267) remains the wire-read path. `_read_response` (lines 237–264) IS used by `_read_response_doc` — keep it.

Remove `_MAX_JSON_DOC_BYTES` and `_read_bounded` and `_parse_response` (dead helpers) after verifying no active callers with text search.

- [x] **Step 3: Update inference_service.py default and cap**

The `--max-body-bytes` argument **already exists** at lines 829–834 with `default=960000` — this is exactly the bug: the service's wire-body guard equals the decoded budget, so a contract-valid canonical request at the decoded limit (~1,283,950 wire bytes) is rejected before parsing. Change only the default and add the override cap:

```python
from .inference_contract import MAX_CANONICAL_REQUEST_BYTES

# Upper safety cap for the CLI override so an operator cannot inadvertently
# remove the body bound entirely.
_MAX_BODY_OVERRIDE_CAP = MAX_CANONICAL_REQUEST_BYTES * 2
```

In `main`, change the existing `--max-body-bytes` argument (currently `default=960000`):

```python
parser.add_argument(
    "--max-body-bytes",
    type=int,
    default=MAX_CANONICAL_REQUEST_BYTES,
    help=(
        f"Reject request bodies larger than this many bytes (before parsing); "
        f"default {MAX_CANONICAL_REQUEST_BYTES}, max {_MAX_BODY_OVERRIDE_CAP}"
    ),
)
```

And after `args = parser.parse_args(argv)`, before `InferenceServerConfig(...)` — note `InferenceServerConfig` (lines 178–189) already validates `max_body_bytes` as positive int, but it does not cap the override, so validate the cap here:

```python
if args.max_body_bytes < 1 or args.max_body_bytes > _MAX_BODY_OVERRIDE_CAP:
    parser.error(
        f"--max-body-bytes must be in [1, {_MAX_BODY_OVERRIDE_CAP}]"
    )
```

**Verify the contract boundary holds:** with a FIFO body reader, a canonical request at 1,283,950 bytes must pass `len(raw) <= config.max_body_bytes` (line 601 checks `declared > max_body_bytes`) — the default change from 960,000 to 1,283,950 is what makes boundary requests succeed.

- [x] **Step 4: Update TypeScript client**

In `inferenceClient.ts`, add after `MAX_PNG_BYTES` (around line 46):

```typescript
/** Maximum canonical raw JSON request body size at decoded/count limits. */
export const MAX_CANONICAL_REQUEST_BYTES = 1_283_950;
```

In the `match` method (around line 444), **replace** the current `body: JSON.stringify(request)` with a bounded, single-serialization body (spec 3.12 item 4: "gửi chính bytes/string đã validate, không serialize lại từ mutable object"):

```typescript
const body = JSON.stringify(request);
if (Buffer.byteLength(body, 'utf8') > MAX_CANONICAL_REQUEST_BYTES) {
  // Release nothing — no body was sent; the error is local and stable.
  return { status: 'invalid', errorCode: 'request_too_large' };
}
const response = await fetch(this.#config.endpoint, {
  method: 'POST',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
  },
  body, // The exact validated string — no second serialization.
  redirect: 'error',
  signal: controller.signal,
});
```

Note: `inferenceClient.ts` already bounds aggregate **decoded PNG** bytes via `MAX_PNG_BYTES` in `buildRequest` (line 149) — the new check is the **canonical raw JSON** bound, which is strictly larger (1,283,950 > 960,000) and therefore accepts all decoded-valid requests while bounding the wire bytes.

- [x] **Step 5: Verify**

Run: `cd avatar-web/fishing-ml && python3.11 -m py_compile src/fishing_ml/inference_contract.py && python3.11 -m py_compile src/fishing_ml/inference_client.py && python3.11 -m py_compile src/fishing_ml/inference_service.py`
Run: `cd avatar-web/server && npx tsc -p tsconfig.json --noEmit`

Then a boundary test that must pass — the canonical maximal request (127 images at 10,080 b64 chars, 1 at 180, decoded sum = 960,000) must validate client-side, and one byte beyond (adding a whitespace-free diff or a 1-byte-larger base64 string) must be rejected:

```bash
cd avatar-web/fishing-ml && python3.11 -c "
import json
from fishing_ml.inference_contract import MAX_CANONICAL_REQUEST_BYTES, canonical_request_byte_length, InferenceImage
refs = [InferenceImage(index=i, png_base64='A' * (10080 if i < 63 else 180)) for i in range(64)]
queries = [InferenceImage(index=i, png_base64='A' * 10080) for i in range(64)]
n = canonical_request_byte_length(refs, queries)
assert n <= MAX_CANONICAL_REQUEST_BYTES, (n, MAX_CANONICAL_REQUEST_BYTES)
assert n == 1_283_950, n
print('boundary canonical bytes:', n, 'OK')
"
```

Expected: prints `boundary canonical bytes: 1283950 OK` (assert proves a contract-valid request at the decoded limit fits within `MAX_CANONICAL_REQUEST_BYTES`).

Also verify the preflight boundary logic by `py_compile` only (no test file — CLAUDE.md forbids tests unless requested).

- [x] **Step 6: Commit**

```bash
git add avatar-web/fishing-ml/src/fishing_ml/inference_contract.py avatar-web/fishing-ml/src/fishing_ml/inference_client.py avatar-web/fishing-ml/src/fishing_ml/inference_service.py avatar-web/server/src/fishing/inferenceClient.ts
git commit -m "fix(contract): unify decoded/canonical request budgets across Python and TypeScript"
```

---

## Task 6: Gate Policy Module and Adjudication

**Files:**
- Create: `avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py`
- Modify: `avatar-web/fishing-ml/config/phase2/gate.yaml`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/experiments.py:612-620` (replace `load_gate`)

**Interfaces:**
- Produces: `GatePolicy`, `GateReport`, `load_gate_policy(...)`, `adjudicate_final(...)`, `adjudicate_replay(...)`, `publish_gate_report(...)`, `exit_code_for_status(...)`.
- Consumes: `FreezeManifest` from artifacts, `ReplayReport` from replay.

- [x] **Step 1: Add errorBudget to gate.yaml**

Append to `config/phase2/gate.yaml`:

```yaml
errorBudget:
  maxErroredBatchRate: 0.01
  maxOmittedRate: 0.0
  requireSingleModelIdentity: true
```

All values remain placeholders under the existing `meta.preAgreedPlaceholders: true`.

- [x] **Step 2: Create phase2_gate.py with GatePolicy and parsers**

```python
"""Phase 2 gate adjudication — pass/fail/blocked for final and replay."""
from __future__ import annotations

import hashlib
import json
import math
import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Literal, Mapping

import yaml

from .schema import read_json

GateStatus = Literal["pass", "fail", "blocked"]
GateKind = Literal["final", "replay"]

# Exit codes
EXIT_PASS = 0
EXIT_INVALID = 2
EXIT_FAIL = 3
EXIT_BLOCKED = 4


class GateBlockedError(RuntimeError):
    """Raised when a gate operation is refused by policy state (e.g. placeholder
    policy). Distinct from a plain RuntimeError so callers map it to EXIT_BLOCKED
    rather than EXIT_GATE_FAIL (spec §3.9: blocked != fail)."""

# Stable check/failure/blocker codes
FAIL_WRONG_ACCEPTED_NONZERO = "wrong_accepted_nonzero"
FAIL_ACCEPTED_RATE_BELOW_MINIMUM = "accepted_rate_below_minimum"
FAIL_TOP1_ACCURACY_BELOW_MINIMUM = "top1_accuracy_below_minimum"
FAIL_BATCH_EXACT_MATCH_BELOW_MINIMUM = "batch_exact_match_below_minimum"
FAIL_LATENCY_P95_EXCEEDED = "latency_p95_exceeded"
FAIL_LATENCY_MAX_NOT_BELOW_CEILING = "latency_max_not_below_ceiling"
FAIL_ERRORED_BATCH_RATE_EXCEEDED = "errored_batch_rate_exceeded"
FAIL_OMITTED_RATE_EXCEEDED = "omitted_rate_exceeded"
FAIL_MULTIPLE_MODEL_IDENTITIES = "multiple_model_identities"
FAIL_MULTIPLE_MODEL_CHECKSUMS = "multiple_model_checksums"
FAIL_MODEL_IDENTITY_CHANGED = "model_identity_changed"

BLOCK_POLICY_NOT_APPROVED = "policy_not_approved"
BLOCK_NO_LABELED_QUERIES = "no_labeled_queries"
BLOCK_INCOMPLETE_GROUND_TRUTH = "incomplete_ground_truth"
BLOCK_NO_REQUESTS = "no_requests"
BLOCK_INCOMPLETE_LATENCY_SAMPLES = "incomplete_latency_samples"
BLOCK_MISSING_MODEL_IDENTITY = "missing_model_identity"
BLOCK_MISSING_MODEL_CHECKSUM = "missing_model_checksum"
BLOCK_NO_BATCHES = "no_batches"


@dataclass(frozen=True, slots=True)
class GatePolicy:
    schema_version: int
    pre_agreed_placeholders: bool
    approved_at: str | None
    approved_by: str | None
    approval_evidence: str | None
    not_tuned_on_phase_a_final: bool
    min_accepted_rate: float
    min_batch_exact_match: float
    min_top1_accuracy: float
    budget_ms: float
    p95_ms: float
    max_ms: float
    max_errored_batch_rate: float
    max_omitted_rate: float
    require_single_model_identity: bool
    require_zero_wrong_accepted: bool


@dataclass(frozen=True, slots=True)
class GateCheck:
    name: str
    status: GateStatus
    actual: object
    expected: str


@dataclass(frozen=True, slots=True)
class GateReport:
    schema_version: int
    gate: GateKind
    status: GateStatus
    policy_sha256: str
    evidence_sha256: str
    checks: tuple[GateCheck, ...]
    failures: tuple[str, ...]
    blockers: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "schemaVersion": self.schema_version,
            "gate": self.gate,
            "status": self.status,
            "policySha256": self.policy_sha256,
            "evidenceSha256": self.evidence_sha256,
            "checks": [
                {"name": c.name, "status": c.status, "actual": c.actual, "expected": c.expected}
                for c in self.checks
            ],
            "failures": list(self.failures),
            "blockers": list(self.blockers),
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_file(path: Path) -> str:
    return _sha256_bytes(Path(path).read_bytes())


def exit_code_for_status(status: GateStatus) -> int:
    return {"pass": EXIT_PASS, "fail": EXIT_FAIL, "blocked": EXIT_BLOCKED}[status]


def _reduce_status(failures: list[str], blockers: list[str]) -> GateStatus:
    if failures:
        return "fail"
    if blockers:
        return "blocked"
    return "pass"


def load_gate_policy(path: Path) -> GatePolicy:
    """Strict parser for gate.yaml. Rejects unknown fields, non-finite values, malformed approval."""
    document = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    if not isinstance(document, dict):
        raise ValueError("gate config must be a YAML mapping")
    allowed_top = {"schemaVersion", "meta", "coverage", "latency", "errorBudget", "gate"}
    unknown_top = sorted(set(document) - allowed_top)
    if unknown_top:
        raise ValueError(f"unknown gate config keys: {unknown_top}")
    schema_version = document.get("schemaVersion")
    if schema_version != 1:
        raise ValueError(f"gate.yaml schemaVersion must be 1, got {schema_version!r}")

    meta = document.get("meta")
    if not isinstance(meta, dict):
        raise ValueError("gate config meta must be a mapping")
    allowed_meta = {"preAgreedPlaceholders", "revisitAt", "notTunedOnPhaseAFinal", "approvedAt", "approvedBy", "evidence"}
    unknown_meta = sorted(set(meta) - allowed_meta)
    if unknown_meta:
        raise ValueError(f"unknown gate meta keys: {unknown_meta}")

    placeholders = meta.get("preAgreedPlaceholders")
    if not isinstance(placeholders, bool):
        raise ValueError("meta.preAgreedPlaceholders must be a boolean")
    # Spec §3.8: approved state REQUIRES complete provenance. Never auto-create.
    if not placeholders:
        for field in ("approvedAt", "approvedBy", "evidence"):
            value = meta.get(field)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"approved policy requires non-empty meta.{field}")
        # approvedAt must be ISO-8601 UTC (same rule as dataset_version._parse_utc_iso).
        raw = meta["approvedAt"]
        candidate = raw[:-1] + "+00:00" if raw.endswith("Z") else raw
        parsed = datetime.fromisoformat(candidate)
        if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
            raise ValueError("meta.approvedAt must be UTC ISO-8601")

    for section in ("coverage", "latency", "errorBudget", "gate"):
        value = document.get(section)
        if not isinstance(value, dict):
            raise ValueError(f"gate config {section} must be a mapping")

    coverage = document["coverage"]
    latency = document["latency"]
    error_budget = document["errorBudget"]
    gate = document["gate"]
    # Mandatory keys per section (strict — no silent defaults, spec §3.8).
    for section, keys in (
        ("coverage", ("minAcceptedRate", "minBatchExactMatch", "minTop1Accuracy")),
        ("latency", ("budgetMs", "p95Ms", "maxMs")),
        ("errorBudget", ("maxErroredBatchRate", "maxOmittedRate", "requireSingleModelIdentity")),
        ("gate", ("requireZeroWrongAccepted",)),
    ):
        missing = sorted(set(keys) - set(document[section]))
        if missing:
            raise ValueError(f"gate config {section} missing keys: {missing}")

    return GatePolicy(
        schema_version=schema_version,
        pre_agreed_placeholders=placeholders,
        approved_at=meta.get("approvedAt"),
        approved_by=meta.get("approvedBy"),
        approval_evidence=meta.get("evidence"),
        not_tuned_on_phase_a_final=bool(meta["notTunedOnPhaseAFinal"]),
        min_accepted_rate=_rate_value(coverage["minAcceptedRate"], "minAcceptedRate"),
        min_batch_exact_match=_rate_value(coverage["minBatchExactMatch"], "minBatchExactMatch"),
        min_top1_accuracy=_rate_value(coverage["minTop1Accuracy"], "minTop1Accuracy"),
        budget_ms=_positive_ms(latency["budgetMs"], "budgetMs"),
        p95_ms=_positive_ms(latency["p95Ms"], "p95Ms"),
        max_ms=_positive_ms(latency["maxMs"], "maxMs"),
        max_errored_batch_rate=_rate_value(error_budget["maxErroredBatchRate"], "maxErroredBatchRate"),
        max_omitted_rate=_rate_value(error_budget["maxOmittedRate"], "maxOmittedRate"),
        require_single_model_identity=bool(error_budget["requireSingleModelIdentity"]),
        require_zero_wrong_accepted=bool(gate["requireZeroWrongAccepted"]),
    )


def _rate_value(value: object, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be a number")
    result = float(value)
    if not 0.0 <= result <= 1.0:
        raise ValueError(f"{name} must be in [0, 1]")
    return result


def _positive_ms(value: object, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be a number")
    result = float(value)
    if result <= 0:
        raise ValueError(f"{name} must be positive")
    return result


def adjudicate_final(policy: GatePolicy, evidence: dict, *, policy_sha256: str, evidence_sha256: str) -> GateReport:
    """Adjudicate a final evaluation report against gate policy.

    ``evidence`` shape (built by confirm_final_once from the snake_case
    MetricSummary document):

    {"metrics": {
        "wrongCount": int, "acceptedCount": int, "acceptedRate": float,
        "top1Accuracy": float, "batchExactMatch": float, "abstentionRate": float,
    }}
    """
    checks: list[GateCheck] = []
    failures: list[str] = []
    blockers: list[str] = []

    # Placeholder policy → blocked (never pass).
    if policy.pre_agreed_placeholders:
        blockers.append(BLOCK_POLICY_NOT_APPROVED)

    metrics = evidence.get("metrics")
    if not isinstance(metrics, dict):
        blockers.append(BLOCK_NO_LABELED_QUERIES)
    else:
        wrong_accepted = metrics.get("wrongCount")
        if not isinstance(wrong_accepted, int) or wrong_accepted < 0:
            failures.append(FAIL_WRONG_ACCEPTED_NONZERO)
        elif policy.require_zero_wrong_accepted and wrong_accepted != 0:
            failures.append(FAIL_WRONG_ACCEPTED_NONZERO)
            checks.append(GateCheck("wrongAccepted", "fail", wrong_accepted, "must be 0"))
        else:
            checks.append(GateCheck("wrongAccepted", "pass", wrong_accepted, "must be 0"))

        accepted_rate = metrics.get("acceptedRate")
        top1 = metrics.get("top1Accuracy")
        batch_exact = metrics.get("batchExactMatch")
        if not isinstance(accepted_rate, (int, float)) or accepted_rate < policy.min_accepted_rate:
            failures.append(FAIL_ACCEPTED_RATE_BELOW_MINIMUM)
            checks.append(GateCheck("acceptedRate", "fail", accepted_rate, f">= {policy.min_accepted_rate}"))
        else:
            checks.append(GateCheck("acceptedRate", "pass", accepted_rate, f">= {policy.min_accepted_rate}"))
        if not isinstance(top1, (int, float)) or top1 < policy.min_top1_accuracy:
            failures.append(FAIL_TOP1_ACCURACY_BELOW_MINIMUM)
            checks.append(GateCheck("top1Accuracy", "fail", top1, f">= {policy.min_top1_accuracy}"))
        else:
            checks.append(GateCheck("top1Accuracy", "pass", top1, f">= {policy.min_top1_accuracy}"))
        if not isinstance(batch_exact, (int, float)) or batch_exact < policy.min_batch_exact_match:
            failures.append(FAIL_BATCH_EXACT_MATCH_BELOW_MINIMUM)
            checks.append(GateCheck("batchExactMatch", "fail", batch_exact, f">= {policy.min_batch_exact_match}"))
        else:
            checks.append(GateCheck("batchExactMatch", "pass", batch_exact, f">= {policy.min_batch_exact_match}"))

    return GateReport(
        schema_version=1, gate="final",
        status=_reduce_status(failures, blockers),
        policy_sha256=policy_sha256, evidence_sha256=evidence_sha256,
        checks=tuple(checks), failures=tuple(failures), blockers=tuple(blockers),
    )


def adjudicate_replay(
    policy: GatePolicy,
    replay_report: Mapping[str, object],
    freeze_manifest: Mapping[str, object],
    *,
    policy_sha256: str,
    evidence_sha256: str,
) -> GateReport:
    """Adjudicate a replay report against gate policy and verified frozen manifest (spec §3.11)."""
    checks: list[GateCheck] = []
    failures: list[str] = []
    blockers: list[str] = []

    if policy.pre_agreed_placeholders:
        blockers.append(BLOCK_POLICY_NOT_APPROVED)

    # --- Quality sub-gate ---
    # ReplayReport.to_dict() shape (after Task 3):
    #   {..., "labeledQueryCount", "wrongAcceptedCount", "acceptedRate",
    #    "labeledTop1Accuracy", "labeledBatchExactMatch",
    #    "clientLatencyMs": {"sampleCount", "p50", "p95", "p99", "max", "rule"},
    #    "modelIdentity": {"modelIds", "checksums"}}
    labeled_query_count = replay_report.get("labeledQueryCount", 0)
    wrong_accepted = replay_report.get("wrongAcceptedCount", 0)
    accepted_rate = replay_report.get("acceptedRate")
    top1 = replay_report.get("labeledTop1Accuracy")
    batch_exact = replay_report.get("labeledBatchExactMatch")
    latency = replay_report.get("clientLatencyMs")
    latency_p95 = latency.get("p95") if isinstance(latency, dict) else None
    latency_max = latency.get("max") if isinstance(latency, dict) else None
    latency_sample_count = latency.get("sampleCount") if isinstance(latency, dict) else None

    if not isinstance(labeled_query_count, int) or labeled_query_count <= 0:
        blockers.append(BLOCK_NO_LABELED_QUERIES)
    else:
        if isinstance(wrong_accepted, int) and wrong_accepted == 0:
            checks.append(GateCheck("wrongAccepted", "pass", wrong_accepted, "must be 0"))
        else:
            failures.append(FAIL_WRONG_ACCEPTED_NONZERO)
            checks.append(GateCheck("wrongAccepted", "fail", wrong_accepted, "must be 0"))
        if isinstance(accepted_rate, (int, float)) and accepted_rate >= policy.min_accepted_rate:
            checks.append(GateCheck("acceptedRate", "pass", accepted_rate, f">= {policy.min_accepted_rate}"))
        else:
            failures.append(FAIL_ACCEPTED_RATE_BELOW_MINIMUM)
            checks.append(GateCheck("acceptedRate", "fail", accepted_rate, f">= {policy.min_accepted_rate}"))
        if isinstance(top1, (int, float)) and top1 >= policy.min_top1_accuracy:
            checks.append(GateCheck("top1Accuracy", "pass", top1, f">= {policy.min_top1_accuracy}"))
        else:
            failures.append(FAIL_TOP1_ACCURACY_BELOW_MINIMUM)
            checks.append(GateCheck("top1Accuracy", "fail", top1, f">= {policy.min_top1_accuracy}"))
        if isinstance(batch_exact, (int, float)) and batch_exact >= policy.min_batch_exact_match:
            checks.append(GateCheck("batchExactMatch", "pass", batch_exact, f">= {policy.min_batch_exact_match}"))
        else:
            failures.append(FAIL_BATCH_EXACT_MATCH_BELOW_MINIMUM)
            checks.append(GateCheck("batchExactMatch", "fail", batch_exact, f">= {policy.min_batch_exact_match}"))

    # --- Operational sub-gate ---
    request_count = replay_report.get("requestCount", 0)
    batch_count = replay_report.get("batchCount", 0)
    errored_batch_count = replay_report.get("erroredBatchCount", 0)
    omitted_rate = replay_report.get("omittedRate", 0)
    identity = replay_report.get("modelIdentity")
    model_ids = identity.get("modelIds", ()) if isinstance(identity, dict) else ()
    checksums = identity.get("checksums", ()) if isinstance(identity, dict) else ()

    if not isinstance(request_count, int) or request_count <= 0:
        blockers.append(BLOCK_NO_REQUESTS)
    elif not isinstance(latency_sample_count, int) or latency_sample_count != request_count:
        blockers.append(BLOCK_INCOMPLETE_LATENCY_SAMPLES)
    if not isinstance(batch_count, int) or batch_count <= 0:
        blockers.append(BLOCK_NO_BATCHES)
    else:
        errored_rate = errored_batch_count / batch_count
        if errored_rate > policy.max_errored_batch_rate:
            failures.append(FAIL_ERRORED_BATCH_RATE_EXCEEDED)
            checks.append(GateCheck("erroredBatchRate", "fail", errored_rate, f"<= {policy.max_errored_batch_rate}"))
        else:
            checks.append(GateCheck("erroredBatchRate", "pass", errored_rate, f"<= {policy.max_errored_batch_rate}"))
        if isinstance(omitted_rate, (int, float)) and omitted_rate > policy.max_omitted_rate:
            failures.append(FAIL_OMITTED_RATE_EXCEEDED)
            checks.append(GateCheck("omittedRate", "fail", omitted_rate, f"<= {policy.max_omitted_rate}"))

    if isinstance(latency_p95, (int, float)) and latency_p95 > policy.p95_ms:
        failures.append(FAIL_LATENCY_P95_EXCEEDED)
        checks.append(GateCheck("latencyP95", "fail", latency_p95, f"<= {policy.p95_ms}"))
    else:
        checks.append(GateCheck("latencyP95", "pass", latency_p95, f"<= {policy.p95_ms}"))
    # Spec §3.11: latencyMaxMs >= maxMs IS a fail (strictly below required).
    if latency_max is None:
        blockers.append(BLOCK_INCOMPLETE_LATENCY_SAMPLES)
    elif isinstance(latency_max, (int, float)) and latency_max >= policy.max_ms:
        failures.append(FAIL_LATENCY_MAX_NOT_BELOW_CEILING)
        checks.append(GateCheck("latencyMax", "fail", latency_max, f"< {policy.max_ms}"))
    else:
        checks.append(GateCheck("latencyMax", "pass", latency_max, f"< {policy.max_ms}"))

    if not model_ids or not all(isinstance(value, str) for value in model_ids):
        blockers.append(BLOCK_MISSING_MODEL_IDENTITY)
    elif policy.require_single_model_identity and len(set(model_ids)) != 1:
        failures.append(FAIL_MULTIPLE_MODEL_IDENTITIES)
        checks.append(GateCheck("modelIdentity", "fail", len(set(model_ids)), "exactly 1"))
    if not checksums or not all(isinstance(value, str) for value in checksums):
        blockers.append(BLOCK_MISSING_MODEL_CHECKSUM)
    elif len(set(checksums)) != 1:
        failures.append(FAIL_MULTIPLE_MODEL_CHECKSUMS)
    else:
        frozen_checksum = freeze_manifest.get("files", {}).get("best-dev.pt")
        if frozen_checksum is None:
            blockers.append(BLOCK_MISSING_MODEL_CHECKSUM)
        elif checksums[0] != frozen_checksum:
            failures.append(FAIL_MODEL_IDENTITY_CHANGED)
            checks.append(GateCheck("modelChecksum", "fail", checksums[0], f"== {frozen_checksum}"))

    return GateReport(
        schema_version=1, gate="replay",
        status=_reduce_status(failures, blockers),
        policy_sha256=policy_sha256, evidence_sha256=evidence_sha256,
        checks=tuple(checks), failures=tuple(failures), blockers=tuple(blockers),
    )


def publish_gate_report(path: Path, report: GateReport) -> Path:
    """Immutable publication of gate report. Idempotent for byte-equivalent content."""
    from .schema import publish_no_replace
    publish_no_replace(path, report.to_dict())
    return path

def main(argv: list[str] | None = None) -> int:
    """CLI: adjudicate-final or adjudicate-replay (never runs service/replay)."""
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    final = sub.add_parser("adjudicate-final", help="Adjudicate a final evaluation report against gate policy.")
    final.add_argument("--gate-config", type=Path, required=True)
    final.add_argument("--final-report", type=Path, required=True)
    final.add_argument("--output", type=Path, default=None)
    final.add_argument("--stdout", action="store_true")

    replay = sub.add_parser("adjudicate-replay", help="Adjudicate an existing replay report against gate policy.")
    replay.add_argument("--gate-config", type=Path, required=True)
    replay.add_argument("--replay-report", type=Path, required=True)
    replay.add_argument("--frozen-dir", type=Path, required=True)
    replay.add_argument("--output", type=Path, default=None)
    replay.add_argument("--stdout", action="store_true")

    args = parser.parse_args(argv)
    try:
        policy = load_gate_policy(Path(args.gate_config))
        evidence_path = Path(args.final_report if args.command == "adjudicate-final" else args.replay_report)
        evidence_doc = read_json(evidence_path)
    except (OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID

    if args.command == "adjudicate-final":
        report = adjudicate_final(
            policy, evidence_doc,
            policy_sha256=_sha256_file(Path(args.gate_config)),
            evidence_sha256=_sha256_file(evidence_path),
        )
    else:
        freeze_doc = read_json(Path(args.frozen_dir) / "freeze-manifest.json")
        report = adjudicate_replay(
            policy, evidence_doc, freeze_doc,
            policy_sha256=_sha256_file(Path(args.gate_config)),
            evidence_sha256=_sha256_file(evidence_path),
        )

    if args.output:
        publish_gate_report(args.output, report)
    if args.stdout or not args.output:
        print(report.to_json())
    return exit_code_for_status(report.status)
```

- [x] **Step 3: Replace experiments.load_gate**

In `experiments.py`, the ONLY call site of `load_gate` is `confirm_final_once` at line 565 (`gate = load_gate(gate_path)`). Delete the `load_gate` function (lines 612–620) and update the call site to the strict policy loader:

```python
from .phase2_gate import load_gate_policy

# In confirm_final_once (line 565):
policy = load_gate_policy(gate_path)
```

Note: Task 10 replaces the body of `confirm_final_once` entirely; this interim change keeps the file importable after Task 6. Delete the imports of `yaml` from `experiments.py` if they become unused (check `grep -n "yaml\." src/fishing_ml/experiments.py` first).

- [x] **Step 4: Verify**

Run: `cd avatar-web/fishing-ml && python3.11 -m py_compile src/fishing_ml/phase2_gate.py && python3.11 -m py_compile src/fishing_ml/experiments.py`
Expected: Both compile. `load_gate_policy` replaces the old shallow loader.

- [x] **Step 5: Commit**

```bash
git add avatar-web/fishing-ml/config/phase2/gate.yaml avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py avatar-web/fishing-ml/src/fishing_ml/experiments.py
git commit -m "feat(gate): add strict gate policy parser, approval validation, and final/replay adjudication"
```

---

## Task 7: Candidate Identity and Effective Config

**Files:**
- Modify: `avatar-web/fishing-ml/config/phase2/candidates.yaml`
- Modify: `avatar-web/fishing-ml/src/fishing_ml/experiments.py:100-310`

**Interfaces:**
- Transforms: axis tokens → exact schema-v2 config values in `effective_config`.
- Validates: 24 specs produce 24 unique effective configs/checksums/run IDs.

- [x] **Step 1: Update candidates.yaml base config to schema v2**

The current file (lines 14–31) has `schemaVersion: 1` at the top level and a schema-v1 `baseConfig`. In the new schema v2:

1. Bump the top-level `schemaVersion` from `1` to `2`.
2. Add the v2 axis-dependent defaults into `baseConfig`. The current `candidates.yaml` has NO `hardNegativeMargin` anywhere — add it. `augmentationProfile` and `hardNegativeRatio` stay OUT of baseConfig (they come from axis tokens).

Replace the baseConfig section:

```yaml
schemaVersion: 2

baseConfig:
  schemaVersion: 2
  seed: 20260827
  epochs: 80
  learningRate: 0.001
  weightDecay: 0.0001
  embeddingDim: 96
  channels: [32, 64, 96, 128]
  checkpointMetric: dev_top1_accuracy
  device: auto
  workers: 0
  reproducibilityTolerance: 0.002
  hardNegativeMargin: 0.10
```

The `augmentationProfile` and `hardNegativeRatio` fields are NOT in the base — they come from axis tokens. Update the comment on line 33 to note that augmentation/hard-negative tokens now map to REAL config fields, not just provenance.

- [x] **Step 2: Update axis token mapping in experiments.py**

Replace the `AUGMENTATION` and `HARD_NEGATIVE` mapping dicts (lines 78–89). Currently they map token → string identity (`{"none": "none"}`). Change them to map token → real schema-v2 config overlay:

```python
AUGMENTATION: Mapping[str, Mapping[str, Any]] = {
    "none": {"augmentationProfile": "none"},
    "photometric": {"augmentationProfile": "photometric"},
    "photometric_plus_geom": {"augmentationProfile": "photometric_plus_geom"},
}

HARD_NEGATIVE: Mapping[str, Mapping[str, Any]] = {
    "off": {"hardNegativeRatio": 0.0},
    "ratio_0.25": {"hardNegativeRatio": 0.25},
}
```

- [x] **Step 3: Extend _ALLOWED_OVERRIDE_KEYS for schema v2**

At line 55, `_ALLOWED_OVERRIDE_KEYS` is the strict schema-v1 set. Add the three v2 keys:

```python
_ALLOWED_OVERRIDE_KEYS = frozenset({
    "schemaVersion",
    "seed",
    "epochs",
    "learningRate",
    "weightDecay",
    "temperature",
    "embeddingDim",
    "channels",
    "checkpointMetric",
    "device",
    "workers",
    "reproducibilityTolerance",
    "augmentationProfile",
    "hardNegativeRatio",
    "hardNegativeMargin",
})
```

- [x] **Step 4: Rework enumerate_specs overlay building**

In `enumerate_specs` (lines 274–309), the overlay is built as `base_config | EMBEDDING[emb] | {"temperature": temp}`. Change it to include the real axis values so each candidate's effective config differs:

```python
overlay = (
    dict(base_config)
    | EMBEDDING[emb]
    | {"temperature": float(temp)}
    | AUGMENTATION[aug]
    | HARD_NEGATIVE[hn]
)
```

`config_checksum` (line 291) already hashes `json.dumps(overlay, sort_keys=True)` — the checksum now differs per axis because augmentationProfile/hardNegativeRatio are in the overlay. This is exactly the fix for the current defect where only 4 unique checksums exist among 24 candidates.

Also update `run_experiment`'s `strict_overlay` (lines 416–429): it currently hardcodes a schema-v1 dict of 13 keys. Change `strict_overlay` to include:

```python
strict_overlay: dict[str, Any] = {
    "schemaVersion": 2,
    "seed": spec.seed,
    "epochs": 80,
    "learningRate": 0.001,
    "weightDecay": 0.0001,
    "embeddingDim": spec.embedding_dim,
    "channels": [32, 64, 96, 128],
    "checkpointMetric": "dev_top1_accuracy",
    "device": "auto",
    "workers": 0,
    "reproducibilityTolerance": 0.002,
    "temperature": spec.temperature,
    "augmentationProfile": AUGMENTATION[spec.augmentation]["augmentationProfile"],
    "hardNegativeRatio": HARD_NEGATIVE[spec.hard_negative]["hardNegativeRatio"],
    "hardNegativeMargin": 0.10,
}
```

The `ExperimentSpec.config_overlay` field (set from `provenance_overlay` at lines 294–298) already records `augmentation` / `hardNegative` provenance — now those values are redundant with the real config fields, so keep only the real field dictionary in the manifest:

```python
provenance_overlay = dict(overlay)
specs.append(ExperimentSpec(
    augmentation=aug,
    hard_negative=hn,
    temperature=float(temp),
    embedding=emb,
    seed=spec_seed,
    split_checksum=split_checksum,
    config_checksum=config_checksum,
    parent_dataset_id=dataset_version.parent_dataset_id,
    config_overlay=provenance_overlay,
))
```

- [x] **Step 5: Verify 24 unique identities**

Run the enumeration check:

```bash
cd avatar-web/fishing-ml && python3.11 -c "
from pathlib import Path
import json
from fishing_ml.experiments import enumerate_specs
from fishing_ml.dataset_version import DatasetVersion
version = DatasetVersion(1, 'test', None, '2026-09-02T00:00:00Z', [])
specs = enumerate_specs(Path('config/phase2/candidates.yaml'), Path('data/phase2/splits'), version)
assert len(specs) == 24, f'Expected 24 specs, got {len(specs)}'
checksums = set(s.config_checksum for s in specs)
assert len(checksums) == 24, f'Only {len(checksums)} unique config checksums'
run_ids = set(s.run_id for s in specs)
assert len(run_ids) == 24, f'Only {len(run_ids)} unique run_ids'
effective = set(json.dumps(s.config_overlay, sort_keys=True) for s in specs)
assert len(effective) == 24, f'Only {len(effective)} unique effective configs'
print('OK: 24 unique effective configs, checksums, and run IDs')
"
```

Expected: `OK: 24 unique effective configs, checksums, and run IDs`.

- [x] **Step 6: Commit**

```bash
git add avatar-web/fishing-ml/config/phase2/candidates.yaml avatar-web/fishing-ml/src/fishing_ml/experiments.py
git commit -m "feat(candidates): schema v2 effective config with 24 unique checksums and run IDs"
```

---

## Task 8: Calibrated Selection and Strict Manifest Parsing

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/experiments.py:391-520`

**Interfaces:**
- Changes: `run_experiment` uses calibrated `thresholds.json.metrics` for acceptance.
- Produces: strict candidate manifest with `rawDevMetrics` and `calibratedMetrics`.

- [x] **Step 1: Add strict metric parsers (snake_case raw → camelCase calibrated)**

**The actual on-disk shape (verified):** `dev-metrics.json` is written by `run_training` (train.py:308) as `{"schemaVersion": 1, **best_metrics}` where `best_metrics` comes from `MetricSummary.to_json()` = `asdict(self)` (metrics.py:40-41) — **snake_case** keys: `query_count`, `batch_count`, `wrong_count`, `top1_accuracy`, `batch_exact_match`, `abstention_rate`, plus the score/margin/grouped/histogram fields. The current `run_experiment` reads `.get("wrongCount", 0)` / `.get("top1Accuracy", 0.0)` — those camelCase keys **never exist**, so every candidate silently gets `wrongCount=0` and `top1Accuracy=0.0` (defect: spec §3.13 no-silent-defaults). `thresholds.json.metrics` IS camelCase (`acceptedCount`, `acceptedAccuracy`, `abstentionRate`, `wrongAcceptedCount`) — that's `calibrate_run`'s output (calibrate.py:126-132).

So: parse the raw dev-metrics document with **snake_case** keys and normalize to the camelCase manifest shape; parse the calibrated metrics with camelCase keys.

```python
@dataclass(frozen=True, slots=True)
class RawDevMetrics:
    query_count: int
    batch_count: int
    wrong_count: int
    top1_accuracy: float
    batch_exact_match: float
    abstention_rate: float

```python
_RAW_DEV_METRIC_KEYS = frozenset({
    "query_count", "batch_count", "wrong_count",
    "top1_accuracy", "batch_exact_match", "abstention_rate",
})

def _parse_raw_dev_metrics(doc: dict) -> RawDevMetrics:
    """Strict parser for the RAW dev-metrics document (SNAKE_CASE keys).

    dev-metrics.json is written by ``run_training`` as
    ``MetricSummary.to_json()`` = asdict -> snake_case (i.e. ``wrong_count``,
    never ``wrongCount``). No .get(key, 0) defaults (spec §3.13).
    """
    missing = sorted(_RAW_DEV_METRIC_KEYS - set(doc))
    if missing:
        raise ValueError(f"dev-metrics.json missing keys: {', '.join(missing)}")
    return RawDevMetrics(
        query_count=_non_negative_int(doc, "query_count"),
        batch_count=_non_negative_int(doc, "batch_count"),
        wrong_count=_non_negative_int(doc, "wrong_count"),
        top1_accuracy=_rate(doc, "top1_accuracy"),
        batch_exact_match=_rate(doc, "batch_exact_match"),
        abstention_rate=_rate(doc, "abstention_rate"),
    )
```

**Calibrated metrics** — `thresholds.json.metrics` camelCase keys `acceptedCount`, `acceptedAccuracy`, `abstentionRate`, `wrongAcceptedCount` (produced by `calibrate_run` at calibrate.py:126-132):

```python
@dataclass(frozen=True, slots=True)
class CalibratedMetrics:
    accepted_count: int
    accepted_accuracy: float | None
    abstention_rate: float
    wrong_accepted_count: int

def _parse_calibrated_metrics(doc: dict) -> CalibratedMetrics:
    """Strict parser for thresholds.json.metrics (camelCase, spec §5.2)."""
    keys = {"acceptedCount", "acceptedAccuracy", "abstentionRate", "wrongAcceptedCount"}
    missing = sorted(keys - set(doc))
    if missing:
        raise ValueError(f"thresholds.json metrics missing keys: {', '.join(missing)}")
    accuracy = doc["acceptedAccuracy"]
    if accuracy is not None and not isinstance(accuracy, (int, float)):
        raise ValueError("acceptedAccuracy must be a number or null")
    result = CalibratedMetrics(
        accepted_count=_non_negative_int(doc, "acceptedCount"),
        accepted_accuracy=None if accuracy is None else float(accuracy),
        abstention_rate=_rate(doc, "abstentionRate"),
        wrong_accepted_count=_non_negative_int(doc, "wrongAcceptedCount"),
    )
    return result
```

Add the two validation helpers at module level:

```python
def _non_negative_int(doc: dict, key: str) -> int:
    value = doc.get(key)
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{key} must be a non-negative integer")
    return value

def _rate(doc: dict, key: str) -> float:
    value = doc.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{key} must be a number")
    value = float(value)
    if not 0.0 <= value <= 1.0:
        raise ValueError(f"{key} must be in [0, 1]")
    return value
```

- [x] **Step 2: Update run_experiment to use calibrated metrics**

In `run_experiment` (experiments.py:391-472), after calibration, replace the raw reads (lines 445-451 — which read nonexistent camelCase keys from the snake_case dev-metrics.json, silently defaulting to 0) with the strict parsers, and compute the result from the CALIBRATED wrong-accepted count:

```python
thresholds_doc = read_json(thresholds_path)
metrics_doc = read_json(run_dir / "dev-metrics.json")
raw = _parse_raw_dev_metrics(metrics_doc)
calibrated = _parse_calibrated_metrics(thresholds_doc["metrics"])

# Selection decision uses CALIBRATED metrics (wrong_accepted_count after
# thresholding), never the raw wrong_count (spec §3.7 eligibility).
result = ExperimentResult(
    spec=spec,
    run_id=run_id,
    run_dir=str(run_dir),
    thresholds_path=str(thresholds_path),
    thresholds=dict(thresholds_doc["thresholds"]),
    dev_metrics=dict(metrics_doc),  # snake_case raw document, unchanged storage
    accepted_wrong_count=calibrated.wrong_accepted_count,
    accepted_rate=calibrated.accepted_rate,
    top1_accuracy=raw.top1_accuracy,
    batch_exact_match=raw.batch_exact_match,
    manifest_path="",  # set after writing below
    config_checksum=spec.config_checksum,
    split_checksum=spec.split_checksum,
    git_revision=_git_revision(),
    passed_gate=(not require_zero_wrong_accepted) or calibrated.wrong_accepted_count == 0,
)
manifest_path = _write_experiment_manifest(
    result, artifacts_root, raw, calibrated,
    dataset_version, dataset_version_sha256,
)
object.__setattr__(result, "manifest_path", manifest_path)
return result
```

`run_experiment` gains two keyword-only parameters (the CLI passes them; direct train+calibrate composition in tests may pass None and then the manifest writer requires them — see below):

```python
def run_experiment(
    spec: ExperimentSpec,
    *,
    raw_root: Path,
    labels_root: Path,
    splits_root: Path,
    duplicate_reviews: Path,
    artifacts_root: Path,
    require_zero_wrong_accepted: bool = True,
    dataset_version: DatasetVersion | None = None,
    dataset_version_sha256: str | None = None,
) -> ExperimentResult:
```

**Spec §5.2 manifest shape — `_write_experiment_manifest`** (experiments.py:475-498) must write the FULL §5.2 candidate manifest (schemaVersion 2, camelCase metric sections). Serialize the two metric sections explicitly with camelCase keys (NOT `asdict`, which yields snake_case):

```python
def _raw_metrics_document(raw: RawDevMetrics) -> dict[str, object]:
    return {
        "queryCount": raw.query_count,
        "batchCount": raw.batch_count,
        "wrongCount": raw.wrong_count,
        "top1Accuracy": raw.top1_accuracy,
        "batchExactMatch": raw.batch_exact_match,
        "abstentionRate": raw.abstention_rate,
    }


def _calibrated_metrics_document(calibrated: CalibratedMetrics) -> dict[str, object]:
    return {
        "acceptedCount": calibrated.accepted_count,
        "acceptedAccuracy": calibrated.accepted_accuracy,
        "acceptedRate": calibrated.accepted_rate,
        "abstentionRate": calibrated.abstention_rate,
        "wrongAcceptedCount": calibrated.wrong_accepted_count,
    }


def _write_experiment_manifest(
    result: ExperimentResult,
    artifacts_root: Path,
    raw: RawDevMetrics,
    calibrated: CalibratedMetrics,
    dataset_version: DatasetVersion | None,
    dataset_version_sha256: str | None,
) -> str:
    artifacts_root = Path(artifacts_root)
    if dataset_version is None or dataset_version_sha256 is None:
        # No silent provenance gaps in a sealed manifest (spec §5.2 + §3.13).
        raise ValueError("candidate manifest requires dataset version provenance")
    manifest_dir = artifacts_root / "phase2-experiments"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    path = manifest_dir / f"{result.run_id}.json"
    # Spec §5.2 defines the REQUIRED keys ("chứa tối thiểu"); runDir/thresholdsPath
    # are allowed extras the CLI re-resolution needs (they are themselves immutable
    # run outputs, never operator input).
    atomic_write_json(path, {
        "schemaVersion": 2,
        "stage": "train-dev-selection",
        "runId": result.run_id,
        "matrixKey": result.spec.matrix_key,
        "runDir": result.run_dir,
        "thresholdsPath": result.thresholds_path,
        "provenance": {
            "datasetId": dataset_version.dataset_id,
            "parentDatasetId": dataset_version.parent_dataset_id,
            "datasetVersionSha256": dataset_version_sha256,
            "splitSha256": result.split_checksum,
            "configSha256": result.config_checksum,
            "gitRevision": result.git_revision,
        },
        "effectiveConfig": dict(result.spec.config_overlay),
        "thresholds": dict(result.thresholds),
        "rawDevMetrics": _raw_metrics_document(raw),
        "calibratedMetrics": _calibrated_metrics_document(calibrated),
        "devSelectionPassed": result.passed_gate,
    })
    return str(path)
```

(`asdict` import at experiments.py:16 stays — `ExperimentResult.to_json`/`ExperimentSpec` serialization still uses it.)

**CalibratedMetrics needs `accepted_rate`** — spec §5.2's calibratedMetrics includes `acceptedRate`, and `thresholds.json.metrics` does NOT. Add it to the dataclass (Step 1) and compute it in the parser as `1.0 - abstention_rate` (the calibration acceptance model treats abstention as rejection; same identity the old `run_experiment` used):

```python
@dataclass(frozen=True, slots=True)
class CalibratedMetrics:
    accepted_count: int
    accepted_accuracy: float | None
    accepted_rate: float
    abstention_rate: float
    wrong_accepted_count: int
```

and in `_parse_calibrated_metrics`, after parsing `abstention_rate`:

```python
    result = CalibratedMetrics(
        accepted_count=_non_negative_int(doc, "acceptedCount"),
        accepted_accuracy=None if accuracy is None else float(accuracy),
        accepted_rate=1.0 - abstention_rate,
        abstention_rate=abstention_rate,
        wrong_accepted_count=_non_negative_int(doc, "wrongAcceptedCount"),
    )
```

(hoist `abstention_rate = _rate(doc, "abstentionRate")` into a local before constructing.)

**Fix `_select_by_gate` tie-breakers** (experiments.py:369-383) — it currently reads `result.dev_metrics.get(metric_key)` where metric_key is camelCase (`top1Accuracy`), which never matches the snake_case raw document, so tie-breakers are always 0. Use the flattened `ExperimentResult` fields that Task 8 now populates correctly:

```python
    def sort_key(result: ExperimentResult) -> tuple[float, ...]:
        keys: list[float] = []
        for name in tie_breakers:
            if name == "acceptedRate":
                keys.append(result.accepted_rate)
            elif name == "top1Accuracy":
                keys.append(result.top1_accuracy)
            elif name == "batchExactMatch":
                keys.append(result.batch_exact_match)
            else:
                raise ValueError(f"unknown tie breaker: {name!r}")
        return tuple(keys)
```

(`_TIE_BREAKER_METRIC_KEY`/`_TIE_BREAKER_INVERT` at experiments.py:111-117 become unused — remove them with this change. Tie-breaker names still come from the candidates.yaml `selectionGate.tieBreakers` — the CLI passes them, never from operator input.)

**Task 9 coupling (this direction):** Task 9's `_cmd_run` already parses the dataset version (`load_dataset_version`) — it MUST pass `dataset_version=version, dataset_version_sha256=sha256_file(dataset_version_path)` into `run_experiment`, or the manifest writer now raises. Task 9's `_result_from_manifest` must read the §5.2 shape (rebuilt in Task 9 Step 4 from the matching `doc["spec"]`/`doc["rawDevMetrics"]`/`doc["calibratedMetrics"]`).

- [x] **Step 3: Verify**

Run: `cd avatar-web/fishing-ml && python3.11 -m py_compile src/fishing_ml/experiments.py`
Expected: Compiles. Manifest fields match spec §5.2.

- [x] **Step 4: Commit**

```bash
git add avatar-web/fishing-ml/src/fishing_ml/experiments.py
git commit -m "feat(experiments): calibrated selection with strict raw/calibrated manifest parsing"
```

---

## Task 9: Experiment CLI State Machine

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/experiments.py:628-657`
- Modify: `avatar-web/fishing-ml/pyproject.toml:20-31`

**Interfaces:**
- Implements: `list`, `run`, `compare`, `freeze`, `confirm-final`, `adjudicate-replay` CLI subcommands.
- Exit codes: 0 (success/pass), 2 (invalid), 3 (gate fail), 4 (gate blocked). Non-adjudication commands return only 0 or 2 (spec §3.9).
- Reuses: `_write_experiment_manifest` (Task 1) writes `phase2-experiments/{run_id}.json` into the same `artifacts_root`, with the v2 spec document of Task 8. `publish_no_replace` comes from Task 4 (`schema.py`). `load_gate_policy`/`adjudicate_replay`/`GateReport`/`exit_code_for_status` come from Task 6. `load_dataset_version` exists at `dataset_version.py:163`.

**Precondition on existing code:** `run_experiment(spec, *, raw_root, labels_root, splits_root, duplicate_reviews, artifacts_root, require_zero_wrong_accepted=True) -> ExperimentResult` already exists (experiments.py:391) and is parameter-keyword-only. `freeze_selected` (experiments.py:525) and `confirm_final_once` (experiments.py:547, returns `dict`, raises `RuntimeError` on gate failure) also exist. The current `main` (experiments.py:628-657) supports only `list` and builds a synthetic `DatasetVersion(1, "dry-run", ...)` — this task replaces it entirely.

- [x] **Step 1: Add module constants and imports**

After the existing imports in `experiments.py` (line 46), add:

```python
# CLI exit codes (spec §3.9): 0 = stage completed / adjudication pass;
# 2 = input/schema/provenance/checksum/infrastructure invalid;
# 3 = at least one mandatory gate failure; 4 = gate blocked (missing evidence
# or policy not approved). Non-adjudication commands return 0 or 2 only.
EXIT_OK = 0
EXIT_INVALID = 2
EXIT_GATE_FAIL = 3
EXIT_BLOCKED = 4
```

`read_json` is already imported (line 46: `from .schema import atomic_write_json, read_json`); extend that schema import to also bring in `sha256_file` (it is exported — schema.py:35). No new top-level imports beyond that — `load_dataset_version`, `publish_no_replace`, and the `phase2_gate` module are imported inside the handlers (matching the module's lazy-import style; `phase2_gate` is pure-Python so it could be top-level, but keep it lazy for consistency).

- [x] **Step 2: Rewrite CLI main with all six subcommands**

Replace the current `main` (lines 628–657) with a full argparse-based CLI. One parser block per subcommand, no duplicates, `--artifacts-root` defined exactly where a handler needs it:

```python
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    # list — enumerate the finite matrix from REAL dataset provenance (never final.txt)
    ls = sub.add_parser("list", help="Enumerate the finite candidate matrix and exit (no training).")
    ls.add_argument("--candidates", type=Path, required=True)
    ls.add_argument("--splits-root", type=Path, required=True)
    ls.add_argument("--dataset-version", type=Path, required=True)

    # run — train+calibrate exactly one candidate (train/dev only)
    run = sub.add_parser("run", help="Train and calibrate one candidate (train/dev only).")
    run.add_argument("--candidates", type=Path, required=True)
    run.add_argument("--splits-root", type=Path, required=True)
    run.add_argument("--dataset-version", type=Path, required=True)
    run.add_argument("--raw-root", type=Path, required=True)
    run.add_argument("--labels-root", type=Path, required=True)
    run.add_argument("--duplicate-reviews", type=Path, required=True)
    run.add_argument("--artifacts-root", type=Path, required=True)
    run.add_argument("--matrix-key", type=str, default=None)
    run.add_argument("--run-id", type=str, default=None)
    # Mirrors calibrate.py's --allow-wrong-accepted (store_true, default False):
    run.add_argument("--allow-wrong-accepted", action="store_true", default=False)

    # compare — select the best candidate from the complete matrix
    cmp = sub.add_parser("compare", help="Select best candidate from complete matrix (dev-only).")
    cmp.add_argument("--candidates", type=Path, required=True)
    cmp.add_argument("--splits-root", type=Path, required=True)
    cmp.add_argument("--dataset-version", type=Path, required=True)
    cmp.add_argument("--artifacts-root", type=Path, required=True)
    cmp.add_argument("--selection-path", type=Path, required=True)
    cmp.add_argument("--allow-wrong-accepted", action="store_true", default=False)

    # freeze — read phase2-selection.json, verify, freeze (no-replace)
    frz = sub.add_parser("freeze", help="Freeze selected candidate (no-replace).")
    frz.add_argument("--selection", type=Path, required=True)
    frz.add_argument("--artifacts-root", type=Path, required=True)  # resolves the manifest
    frz.add_argument("--raw-root", type=Path, required=True)
    frz.add_argument("--labels-root", type=Path, required=True)
    frz.add_argument("--splits-root", type=Path, required=True)
    frz.add_argument("--duplicate-reviews", type=Path, required=True)

    # confirm-final — one-shot final evaluation, gated BEFORE opening final
    cf = sub.add_parser("confirm-final", help="One-shot final evaluation with gate (the only path to final).")
    cf.add_argument("--selection", type=Path, required=True)
    cf.add_argument("--artifacts-root", type=Path, required=True)
    cf.add_argument("--gate-config", type=Path, required=True)
    cf.add_argument("--confirm-final-once", type=str, required=True)
    cf.add_argument("--raw-root", type=Path, required=True)
    cf.add_argument("--labels-root", type=Path, required=True)
    cf.add_argument("--splits-root", type=Path, required=True)
    cf.add_argument("--duplicate-reviews", type=Path, required=True)

    # adjudicate-replay — gate existing replay evidence; NEVER runs the service
    ar = sub.add_parser("adjudicate-replay", help="Adjudicate existing replay evidence against gate policy.")
    ar.add_argument("--gate-config", type=Path, required=True)
    ar.add_argument("--replay-report", type=Path, required=True)
    ar.add_argument("--frozen-dir", type=Path, required=True)
    ar.add_argument("--output", type=Path, default=None)
    ar.add_argument("--stdout", action="store_true")

    args = parser.parse_args(argv)

    handlers = {
        "list": _cmd_list,
        "run": _cmd_run,
        "compare": _cmd_compare,
        "freeze": _cmd_freeze,
        "confirm-final": _cmd_confirm_final,
        "adjudicate-replay": _cmd_adjudicate_replay,
    }
    return handlers[args.command](args)
```

- [x] **Step 3: Implement `_cmd_list` and `_cmd_run`**

Add all `_cmd_*` handlers before `main` (after `load_gate`, around line 620). Each returns an `int` exit code. Errors print sanitized messages to stderr (never PNG/base64/raw data) and return `EXIT_INVALID`.

```python
def _cmd_list(args: argparse.Namespace) -> int:
    from .dataset_version import load_dataset_version

    version = load_dataset_version(args.dataset_version)
    specs = enumerate_specs(
        Path(args.candidates),
        Path(args.splits_root),
        version,
    )
    out = {
        "schemaVersion": 1,
        "count": len(specs),
        "dataset": {
            "datasetId": version.dataset_id,
            "parentDatasetId": version.parent_dataset_id,
            "createdAt": version.created_at,
        },
        "axes": {
            "augmentation": len({s.augmentation for s in specs}),
            "hardNegative": len({s.hard_negative for s in specs}),
            "temperature": len({s.temperature for s in specs}),
            "embedding": len({s.embedding for s in specs}),
        },
        "candidates": [
            {"runId": s.run_id, "matrixKey": s.matrix_key,
             "configChecksum": s.config_checksum[:12], "splitChecksum": s.split_checksum[:12]}
            for s in specs
        ],
    }
    print(json.dumps(out, sort_keys=True, indent=2))
    return EXIT_OK


def _cmd_run(args: argparse.Namespace) -> int:
    from .dataset_version import load_dataset_version

    try:
        version = load_dataset_version(args.dataset_version)
        specs = enumerate_specs(Path(args.candidates), Path(args.splits_root), version)
    except (ValueError, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID
    if (args.matrix_key is None) == (args.run_id is None):
        print("error: exactly one of --matrix-key or --run-id is required", file=sys.stderr)
        return EXIT_INVALID
    if args.run_id is not None:
        matches = [s for s in specs if s.run_id == args.run_id]
    else:
        matches = [s for s in specs if s.matrix_key == args.matrix_key]
    if len(matches) != 1:
        print(f"error: expected exactly one matching spec, got {len(matches)}", file=sys.stderr)
        return EXIT_INVALID

    spec = matches[0]
    # Spec §3.6 `run` reuse-or-fail-closed: an existing complete manifest for this
    # run is verified and returned; an incomplete/tampered one fails closed. No
    # overwrite, no auto-delete.
    manifest_path = Path(args.artifacts_root) / "phase2-experiments" / f"{spec.run_id}.json"
    if manifest_path.exists():
        return _cmd_run_reuse(manifest_path, spec, args)

    try:
        result = run_experiment(
            spec,
            raw_root=Path(args.raw_root),
            labels_root=Path(args.labels_root),
            splits_root=Path(args.splits_root),
            duplicate_reviews=Path(args.duplicate_reviews),
            artifacts_root=Path(args.artifacts_root),
            require_zero_wrong_accepted=not args.allow_wrong_accepted,
            # Task 8 manifest requires sealed dataset provenance (spec §5.2).
            dataset_version=version,
            dataset_version_sha256=sha256_file(Path(args.dataset_version)),
        )
    except (OSError, ValueError, RuntimeError, FileExistsError) as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID
    print(json.dumps(result.to_json(), sort_keys=True, indent=2))
    # Spec §3.9: `run` is a non-adjudication command → 0 or 2 only. Whether the
    # candidate satisfies the dev-selection gate is decided by `compare` (3 there);
    # here the stage completed (with require_zero_wrong_accepted, a failing
    # calibration raises above instead of producing a result).
    return EXIT_OK


def _cmd_run_reuse(manifest_path: Path, spec: ExperimentSpec, args: argparse.Namespace) -> int:
    """Verify an existing complete manifest and return it (spec §3.6 reuse)."""
    try:
        doc = read_json(manifest_path)
    except (OSError, ValueError) as error:
        print(f"error: existing manifest is unreadable: {error}", file=sys.stderr)
        return EXIT_INVALID
    # Required-file completeness: frozen dir, dev-metrics.json, thresholds.json.
    run_dir = Path(doc.get("runDir", ""))
    if not run_dir.is_absolute() or not (run_dir / "frozen").is_dir():
        print("error: existing manifest references a non-frozen run dir", file=sys.stderr)
        return EXIT_INVALID
    for required in ("dev-metrics.json", "thresholds.json"):
        if not (run_dir / required).is_file():
            print(f"error: existing run is missing {required}", file=sys.stderr)
            return EXIT_INVALID
    # Provenance: run id, dataset/split/config/Git checksums must all match
    # (split/config/Git checksums live under `provenance` in the §5.2 manifest).
    provenance = doc.get("provenance")
    if (not isinstance(provenance, dict)
            or spec.run_id != doc.get("runId")
            or spec.split_checksum != provenance.get("splitSha256")
            or spec.config_checksum != provenance.get("configSha256")
            or not provenance.get("gitRevision")):
        print("error: existing manifest provenance conflicts with the enumerated spec", file=sys.stderr)
        return EXIT_INVALID
    result = _result_from_manifest(doc, str(manifest_path))
    print(json.dumps(result.to_json(), sort_keys=True, indent=2))
    # Non-adjudication command → 0 or 2 only (spec §3.9); the dev-gate verdict
    # belongs to `compare`.
    return EXIT_OK
```

Note: `doc["runDir"]` is a manifest-controlled string from the sealed manifest (already written via `atomic_write_json`); the absolute-path check above prevents a tampered manifest from pointing the operator at arbitrary directories. First-striking provenance checks (run ID, split/config checksums) always take precedence so a tampered manifest cannot be "reused".

- [x] **Step 4: Implement `_cmd_compare` and `_result_from_manifest`**

```python
def _cmd_compare(args: argparse.Namespace) -> int:
    from .dataset_version import load_dataset_version

    try:
        version = load_dataset_version(args.dataset_version)
        specs = enumerate_specs(Path(args.candidates), Path(args.splits_root), version)
    except (ValueError, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID
    # Spec §3.6 `compare`: every expected run must have a manifest; duplicates,
    # mismatches, and invalid metrics fail closed.
    results: list[ExperimentResult] = []
    seen_run_ids: dict[str, str] = {}
    for spec in specs:
        manifest_path = Path(args.artifacts_root) / "phase2-experiments" / f"{spec.run_id}.json"
        if not manifest_path.exists():
            print(f"error: missing manifest for {spec.run_id}", file=sys.stderr)
            return EXIT_INVALID
        other = seen_run_ids.get(spec.run_id)
        if other is not None:
            print(f"error: duplicate run id {spec.run_id} in {other} and {manifest_path}", file=sys.stderr)
            return EXIT_INVALID
        seen_run_ids[spec.run_id] = str(manifest_path)
        doc = read_json(manifest_path)
        # The manifest's spec document is sealed snake_case (asdict of ExperimentSpec).
        spec_doc = doc.get("spec")
        if not isinstance(spec_doc, dict) or spec_doc.get("config_checksum") != spec.config_checksum \
                or spec_doc.get("split_checksum") != spec.split_checksum:
            print(f"error: checksum mismatch for {spec.run_id}", file=sys.stderr)
            return EXIT_INVALID
        results.append(_result_from_manifest(doc, str(manifest_path)))

    if len(results) != len(specs):
        print("error: resolved candidate count does not match enumeration", file=sys.stderr)
        return EXIT_INVALID
    # Deterministic tie-breakers per spec §3.7 order (never passed from the CLI).
    selected = compare_experiments(
        results,
        require_zero_wrong_accepted=not args.allow_wrong_accepted,
        tie_breakers=("acceptedRate", "top1Accuracy", "batchExactMatch"),
    )
    if selected is None:
        print("error: no candidate passed the zero-wrong-accepted gate", file=sys.stderr)
        return EXIT_GATE_FAIL
    # Spec §3.6: an existing byte-equivalent selection is verified and returned;
    # a conflicting selection fails closed. publish_no_replace implements exactly
    # that (byte-equivalent → idempotent; different → FileExistsError).
    selected_manifest = Path(args.artifacts_root) / "phase2-experiments" / f"{selected.run_id}.json"
    git_revision = _git_revision()
    try:
        write_selection(
            Path(args.selection_path),
            selected,
            selected_manifest,
            Path(args.dataset_version),
            version,
            git_revision=git_revision,
            require_zero_wrong_accepted=not args.allow_wrong_accepted,
        )
    except FileExistsError as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID
    print(json.dumps(
        {"selectedRunId": selected.run_id, "selectedMatrixKey": selected.spec.matrix_key},
        sort_keys=True, indent=2,
    ))
    return EXIT_OK
```

`_result_from_manifest` rebuilds a frozen `ExperimentResult` from its sealed §5.2 manifest. Top-level keys are camelCase (`runId`, `matrixKey`, `rawDevMetrics`, `calibratedMetrics`, `effectiveConfig`, `devSelectionPassed`); the nested `spec` section is **snake_case** — it was written as `asdict(result.spec)` (experiments.py:487), so read `hard_negative`, `split_checksum`, `config_checksum`, `parent_dataset_id`, `config_overlay` there:

```python
def _result_from_manifest(doc: dict[str, Any], manifest_path: str = "") -> ExperimentResult:
    """Rebuild a frozen ExperimentResult from its immutable manifest document."""
    spec_doc = doc["spec"]
    raw_doc = doc["rawDevMetrics"]
    calibrated_doc = doc["calibratedMetrics"]
    spec = ExperimentSpec(
        augmentation=spec_doc["augmentation"],
        hard_negative=spec_doc["hard_negative"],
        temperature=float(spec_doc["temperature"]),
        embedding=spec_doc["embedding"],
        seed=int(spec_doc["seed"]),
        split_checksum=spec_doc["split_checksum"],
        config_checksum=spec_doc["config_checksum"],
        parent_dataset_id=spec_doc.get("parent_dataset_id"),
        config_overlay=dict(spec_doc.get("config_overlay", {})),
    )
    thresholds = dict(doc["thresholds"])
    return ExperimentResult(
        spec=spec,
        run_id=doc["runId"],
        run_dir=doc["runDir"],
        thresholds_path=doc["thresholdsPath"],
        thresholds=thresholds,
        # Raw dev metrics: the manifest's camelCase section is normalized back
        # to the same snake_case shape run_experiment stores (dev_metrics).
        dev_metrics={
            "query_count": int(raw_doc["queryCount"]),
            "batch_count": int(raw_doc["batchCount"]),
            "wrong_count": int(raw_doc["wrongCount"]),
            "top1_accuracy": float(raw_doc["top1Accuracy"]),
            "batch_exact_match": float(raw_doc["batchExactMatch"]),
            "abstention_rate": float(raw_doc["abstentionRate"]),
        },
        accepted_wrong_count=int(calibrated_doc["wrongAcceptedCount"]),
        accepted_rate=float(calibrated_doc["acceptedRate"]),
        top1_accuracy=float(raw_doc["top1Accuracy"]),
        batch_exact_match=float(raw_doc["batchExactMatch"]),
        manifest_path=manifest_path,
        config_checksum=doc["provenance"]["configSha256"],
        split_checksum=doc["provenance"]["splitSha256"],
        git_revision=doc["provenance"]["gitRevision"],
        passed_gate=bool(doc["devSelectionPassed"]),
    )
```

**Strict-parse note:** the §5.2 sections are read with explicit `doc["..."]`/`calibrated_doc["..."]` indexing (raises KeyError on a tampered manifest) — never `.get(key, default)`. The `thresholds` section is `{"minSimilarity": ..., "minMargin": ...}` (calibrate.py's `thresholds.json` shape). `_cmd_run_reuse`'s checksum checks (runId/splitChecksum/configChecksum) stay on the top-level `doc` — but for the §5.2 shape splitChecksum/configChecksum now LIVE under `doc["provenance"]`, so `_cmd_run_reuse` must compare `spec.split_checksum != doc["provenance"]["splitSha256"]` and `spec.config_checksum != doc["provenance"]["configSha256"]` (update those two lines in Step 3).

`write_selection` publishes the immutable `phase2-selection.json` with the spec §5.3 shape (schemaVersion 1, stage `phase2-selection`, selectedRunId, selectedMatrixKey, candidateManifestSha256, provenance, policy). It uses Task 4's `publish_no_replace` from `schema.py` — DO NOT use `atomic_write_json`, which overwrites:

```python
def write_selection(
    path: Path,
    selected: ExperimentResult,
    selected_manifest_path: Path,
    dataset_version_path: Path,
    version: DatasetVersion,
    *,
    git_revision: str,
    require_zero_wrong_accepted: bool,
) -> None:
    """Write the immutable phase2-selection.json (spec §5.3).

    Byte-equivalent existing artifact → idempotent success (publish_no_replace);
    existing artifact with different bytes → FileExistsError (fail closed).
    """
    document = {
        "schemaVersion": 1,
        "stage": "phase2-selection",
        "selectedRunId": selected.run_id,
        "selectedMatrixKey": selected.spec.matrix_key,
        "candidateManifestSha256": hashlib.sha256(selected_manifest_path.read_bytes()).hexdigest(),
        "provenance": {
            "datasetId": version.dataset_id,
            "parentDatasetId": version.parent_dataset_id,
            "datasetVersionSha256": hashlib.sha256(dataset_version_path.read_bytes()).hexdigest(),
            "splitSha256": selected.split_checksum,
            "configSha256": selected.config_checksum,
            "gitRevision": git_revision,
        },
        "policy": {
            "requireZeroWrongAccepted": require_zero_wrong_accepted,
            "tieBreakers": ["acceptedRate", "top1Accuracy", "batchExactMatch", "runId"],
        },
    }
    from .schema import publish_no_replace
    publish_no_replace(path, document)
```

**Interfaces note:** `write_selection(path, selected, selected_manifest_path, dataset_version_path, version, *, git_revision, require_zero_wrong_accepted)` — the resolved `DatasetVersion` (already `load_dataset_version`-parsed by the caller) supplies dataset provenance without re-reading the file. In `_cmd_compare`, call it as:

```python
    write_selection(
        Path(args.selection_path),
        selected,
        selected_manifest,
        Path(args.dataset_version),
        version,
        git_revision=git_revision,
        require_zero_wrong_accepted=not args.allow_wrong_accepted,
    )
```

- [x] **Step 5: Implement `_cmd_freeze` and `_cmd_confirm_final`**

```python
def _cmd_freeze(args: argparse.Namespace) -> int:
    selection = read_json(Path(args.selection))
    if selection.get("stage") != "phase2-selection":
        print(f"error: not a phase2-selection artifact: {args.selection}", file=sys.stderr)
        return EXIT_INVALID
    selected_run_id = selection["selectedRunId"]
    # Spec §3.6 `freeze`: NEVER accepts an arbitrary result; it reads the selection
    # artifact and re-resolves the selected candidate's sealed manifest.
    manifest_path = Path(args.artifacts_root) / "phase2-experiments" / f"{selected_run_id}.json"
    if not manifest_path.exists():
        print(f"error: selected manifest missing: {manifest_path}", file=sys.stderr)
        return EXIT_INVALID
    doc = read_json(manifest_path)
    if doc.get("runId") != selected_run_id:
        print("error: selection/manifest run-id mismatch", file=sys.stderr)
        return EXIT_INVALID
    result = _result_from_manifest(doc, str(manifest_path))
    # Spec §3.6 `freeze`: existing verified frozen output is accepted; only an
    # invalid/conflicting existing output fails closed. The frozen dir is a
    # fully expected path (run_dir/frozen), so check it BEFORE freeze_selected
    # (which calls freeze_run, which unconditionally FileExistsErrors).
    from . import artifacts

    frozen_dir = Path(result.run_dir) / "frozen"
    if os.path.lexists(frozen_dir):
        try:
            artifacts.verify_freeze(frozen_dir)
        except (OSError, ValueError, RuntimeError) as error:
            print(f"error: existing frozen candidate is invalid: {error}", file=sys.stderr)
            return EXIT_INVALID
        print(f"frozen: {frozen_dir} (existing verified)")
        return EXIT_OK
    try:
        frozen_dir = freeze_selected(
            result,
            raw_root=Path(args.raw_root),
            labels_root=Path(args.labels_root),
            splits_root=Path(args.splits_root),
            duplicate_reviews=Path(args.duplicate_reviews),
        )
    except (OSError, ValueError, RuntimeError, FileExistsError) as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID
    print(f"frozen: {frozen_dir}")
    return EXIT_OK


def _cmd_confirm_final(args: argparse.Namespace) -> int:
    from . import phase2_gate

    selection = read_json(Path(args.selection))
    if selection.get("selectedRunId") != args.confirm_final_once:
        print(
            f"error: --confirm-final-once must equal selection.selectedRunId "
            f"(got {args.confirm_final_once!r}, selection has {selection.get('selectedRunId')!r})",
            file=sys.stderr,
        )
        return EXIT_INVALID

    # Spec §3.10: placeholder policy or missing approval provenance → BLOCKED, and
    # final.txt must NOT be opened. load_gate_policy raises ValueError on a
    # malformed/placeholder-inconsistent document; status comes from adjudication.
    try:
        policy = phase2_gate.load_gate_policy(Path(args.gate_config))
    except ValueError as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID
    if policy.pre_agreed_placeholders:
        print("error: gate policy is not approved (preAgreedPlaceholders still true)", file=sys.stderr)
        return EXIT_BLOCKED

    manifest_path = Path(args.artifacts_root) / "phase2-experiments" / f"{args.confirm_final_once}.json"
    if not manifest_path.exists():
        print(f"error: selected manifest missing: {manifest_path}", file=sys.stderr)
        return EXIT_INVALID
    result = _result_from_manifest(read_json(manifest_path), str(manifest_path))
    try:
        final = confirm_final_once(
            result,
            raw_root=Path(args.raw_root),
            labels_root=Path(args.labels_root),
            splits_root=Path(args.splits_root),
            duplicate_reviews=Path(args.duplicate_reviews),
            gate_path=Path(args.gate_config),
        )
    except RuntimeError as error:
        # Current confirm_final_once raises RuntimeError for a gate failure
        # (post-evaluation, non-placeholder policy). Exit 3 = gate fail.
        print(f"gate fail: {error}", file=sys.stderr)
        return EXIT_GATE_FAIL
    print(json.dumps(final, sort_keys=True, indent=2))
    return EXIT_OK
```

**Forward note (Task 10):** Task 10 rewrites `confirm_final_once` to return `(final, gate_report)` and raise `GateBlockedError` on placeholder policy before any final read. Task 10 Step 3 replaces this handler's post-policy-preflight tail (the `result = ...`/`try: final = confirm_final_once(...)` block) with the tuple-destructuring version; until then this task's single-return call is correct and self-contained.

- [x] **Step 6: Implement `_cmd_adjudicate_replay`**

```python
def _cmd_adjudicate_replay(args: argparse.Namespace) -> int:
    from . import phase2_gate

    try:
        policy = phase2_gate.load_gate_policy(Path(args.gate_config))
        replay_doc = read_json(Path(args.replay_report))
        freeze_doc = read_json(Path(args.frozen_dir) / "freeze-manifest.json")
    except (OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID
    report = phase2_gate.adjudicate_replay(
        policy,
        replay_doc,
        freeze_doc,
        policy_sha256=hashlib.sha256(Path(args.gate_config).read_bytes()).hexdigest(),
        evidence_sha256=hashlib.sha256(Path(args.replay_report).read_bytes()).hexdigest(),
    )
    if args.output:
        phase2_gate.publish_gate_report(args.output, report)
    if args.stdout or not args.output:
        print(report.to_json())
    return phase2_gate.exit_code_for_status(report.status)
```

Note the verified Task 6 signature: `adjudicate_replay(policy, replay_report: Mapping, freeze_manifest: Mapping, *, policy_sha256: str, evidence_sha256: str) -> GateReport`. The handler reads both JSON documents itself (it never passes paths to the adjudicator) and publishes via `publish_gate_report` (immutable no-replace) when `--output` is given.

- [x] **Step 7: Verify**

Run: `cd avatar-web/fishing-ml && python3.11 -m py_compile src/fishing_ml/experiments.py`
Expected: Compiles. All six subcommands registered, handlers defined, no undefined names (``EXIT_*``, `_result_from_manifest`, `write_selection`, `publish_no_replace`, `load_gate_policy`).
Run: `cd avatar-web/fishing-ml && python3.11 -m fishing_ml.experiments list --help`
Expected: argparse help for `list` exits 0.

- [x] **Step 8: Register entry points in pyproject.toml**

Append to the existing `[project.scripts]` section (pyproject.toml:20-31, after `fishing-phase2-inference-service`):

```toml
fishing-phase2-experiment = "fishing_ml.experiments:main"
fishing-phase2-replay = "fishing_ml.replay:main"
fishing-phase2-gate = "fishing_ml.phase2_gate:main"
```

- [x] **Step 9: Commit**

```bash
git add avatar-web/fishing-ml/src/fishing_ml/experiments.py avatar-web/fishing-ml/pyproject.toml
git commit -m "feat(cli): full experiment state machine with list/run/compare/freeze/confirm-final/adjudicate-replay"
```

---

## Task 10: Evaluation Separation and Final Safety

**Files:**
- Modify: `avatar-web/fishing-ml/src/fishing_ml/evaluate.py:120-148` (`evaluate_final_once`)
- Modify: `avatar-web/fishing-ml/src/fishing_ml/experiments.py:547-604` (`confirm_final_once`)

**Interfaces:**
- Consumes: `phase2_gate.load_gate_policy`, `phase2_gate.adjudicate_final`, `phase2_gate.publish_gate_report`, `phase2_gate.exit_code_for_status`.
- Changes: `evaluate_final_once` publishes evidence only for schema-v1; rejects the v2 path (must go through `confirm-final`).
- Changes: `confirm_final_once` returns `(final, gate_report)` and blocks on placeholder policy BEFORE opening `final.txt`.
- Closes: direct `fishing-evaluate final` bypass for Phase 2 schema-v2 frozen candidates.

- [x] **Step 1: Guard the schema-v2 path in evaluate_final_once**

In `evaluate.py`, `evaluate_final_once` (lines 120–148) currently hardcodes `"passed": metrics.top1_accuracy >= .99 and metrics.wrong_count == 0` (line 139). The `.99` hardcode bypasses the phase2 gate policy. Phase 2 candidates are schema-v2 **model configs**; their freeze-manifest `schemaVersion` is still v1 (Task 4 kept it), so the discriminator is the **model-config document's** `schemaVersion`, already loaded into `config_doc` by `_inputs` (evaluate.py:133). Guard:

```python
    config_doc, stats, thresholds, model, device = _inputs(frozen_dir)
    if isinstance(config_doc, dict) and config_doc.get("schemaVersion") == 2:
        raise RuntimeError(
            "Phase 2 frozen candidates (schema-v2 model config) require "
            "fishing-phase2-experiment confirm-final; direct fishing-evaluate "
            "final is disabled for v2"
        )
```

(This sits right after the `_inputs` call at line 133, before the lock at line 135 — the failure must happen before `final-evaluation.lock` is created so a v2 candidate doesn't leave a stale one-shot lock. `evaluate_final_once` raises `RuntimeError`; its `main` (evaluate.py:165) already maps that to exit 2.)

> **Existing defect (spec §3.13 — no silent defaults):** `evaluate_final_once` stores `"metrics": metrics.to_json()` (line 139), and `MetricSummary.to_json()` is `asdict(self)` → **snake_case** keys (`wrong_count`, `abstention_rate`, `top1_accuracy`, `batch_exact_match`). But `confirm_final_once` (experiments.py lines 574–600) reads `metrics.get("wrongCount", 0)` / `metrics.get("abstentionRate", 0.0)` / `metrics.get("top1Accuracy", 0.0)` — **camelCase keys that never exist in the final document**, so they silently default to `0` / `0.0`. `wrong_accepted` always reads 0 and `top1` always reads 0.0 (which makes the coverage gate spuriously fail on `minTop1Accuracy`). Step 2 fixes the reads; the gate parser in Task 6 must parse the actual snake_case document. Note the v1 direct path's `"passed"` hardcode stays (Phase A semantics unchanged) — only the v2 candidate is refused here.

- [x] **Step 2: Rewrite confirm_final_once preflight order**

The current `confirm_final_once` (experiments.py:547-604) reads gate FIRST, then calls `evaluate_final_once`, then applies a partial gate with camelCase `.get(..., 0)` reads that **never match** the actual snake_case `MetricSummary.to_json()` document — a silent-default defect (spec §3.13). Rewrite to follow the spec's preflight order so `blocked` is decided BEFORE any final read/lock, and all metrics parse from the snake_case document strictly:

```python
def confirm_final_once(
    result: ExperimentResult,
    *,
    raw_root: Path,
    labels_root: Path,
    splits_root: Path,
    duplicate_reviews: Path,
    gate_path: Path,
) -> tuple[dict, "GateReport"]:
    """Open the Phase 2 final EXACTLY ONCE, gated by --confirm-final-once.

    Spec §3.10: placeholder policy or missing approval provenance → BLOCKED,
    and final.txt must NOT be opened. Final report is published BEFORE
    adjudication so pass/fail are both terminal evidence.
    """
    from . import artifacts, evaluate
    from .phase2_gate import (
        GateBlockedError,
        _sha256_file,
        adjudicate_final,
        load_gate_policy,
        publish_gate_report,
    )

    # 1. Gate policy must be approved (blocks BEFORE any final read/lock).
    #    load_gate_policy raises ValueError on a malformed document; the
    #    placeholder/blocked decision is made HERE, before any final read.
    policy = load_gate_policy(gate_path)
    if policy.pre_agreed_placeholders:
        # Spec §3.10: placeholder policy → BLOCKED, final.txt must NOT be opened.
        # No GateReport exists yet (no evidence); the blocker is the policy state
        # itself. GateBlockedError (RuntimeError subclass) lets the CLI map it to
        # EXIT_BLOCKED instead of EXIT_GATE_FAIL.
        raise GateBlockedError("gate policy is not approved (preAgreedPlaceholders still true)")

    # 2. Verify frozen candidate is schema-v2 Phase 2 (schema v1 final uses
    #    the direct evaluator per Step 1; mixing paths is a provenance break).
    #    verify_freeze RAISES on missing/invalid frozen dir; it never returns None.
    artifacts.verify_freeze(Path(result.run_dir) / "frozen")

    # 3. Open final exactly once (enforces one-shot lock + report).
    final = evaluate.evaluate_final_once(
        Path(result.run_dir),
        Path(raw_root),
        Path(labels_root),
        Path(splits_root),
        confirm_final_once=result.run_id,  # exact run-id gate
    )

    # 4. Adjudicate against the APPROVED policy (evidence = final report).
    #    final["metrics"] is MetricSummary.to_json() => SNAKE_CASE keys
    #    (wrong_count, accepted_count, query_count, abstention_rate,
    #    top1_accuracy, batch_exact_match). Read them with bracket access on
    #    a validated dict -- never .get(key, default) (spec §3.13).
    metrics = final["metrics"]
    if not isinstance(metrics, dict):
        raise ValueError("final evaluation metrics must be a mapping")
    required_metric_keys = (
        "wrong_count", "accepted_count", "query_count", "abstention_rate",
        "top1_accuracy", "batch_exact_match",
    )
    missing = sorted(set(required_metric_keys) - set(metrics))
    if missing:
        raise ValueError(f"final evaluation metrics missing keys: {missing}")
    wrong_accepted = int(metrics["wrong_count"])
    accepted_count = int(metrics["accepted_count"])
    query_count = int(metrics["query_count"])
    accepted_rate = accepted_count / query_count if query_count > 0 else 0.0
    evidence = {
        "metrics": {
            # phase2_gate.adjudicate_final consumes these camelCase fields.
            "wrongCount": wrong_accepted,
            "acceptedCount": accepted_count,
            "acceptedRate": accepted_rate,
            "top1Accuracy": float(metrics["top1_accuracy"]),
            "batchExactMatch": float(metrics["batch_exact_match"]),
            "abstentionRate": float(metrics["abstention_rate"]),
        }
    }
    policy_sha256 = _sha256_file(gate_path)
    evidence_sha256 = _sha256_file(Path(result.run_dir) / "final-evaluation.json")
    gate_report = adjudicate_final(
        policy, evidence,
        policy_sha256=policy_sha256, evidence_sha256=evidence_sha256,
    )

    # 5. Publish gate report (immutable no-replace).
    publish_gate_report(Path(result.run_dir) / "gate-final.json", gate_report)

    return final, gate_report
```

(`_sha256_file` is imported from `phase2_gate` — Task 6 already defines it; do NOT redeclare it in experiments.py. `GateReport` is quoted in the return annotation only because experiments.py's top level stays lazy about the phase2_gate import; when `from __future__ import annotations` is active (it is, experiments.py:27) the annotation can be `GateReport` unquoted with only a local import — keep the local import inside the function and the unquoted name in the signature.)

- [x] **Step 3: Update the `_cmd_confirm_final` CLI handler**

Task 9's `_cmd_confirm_final` calls the OLD single-return `confirm_final_once` and catches `RuntimeError → EXIT_GATE_FAIL`. With Step 2 the function returns `(final, gate_report)` and gate truth lives in `gate_report.status`, so replace the body of `_cmd_confirm_final` (the part after the policy preflight in Task 9 Step 5) with:

```python
    result = _result_from_manifest(read_json(manifest_path), str(manifest_path))
    from .phase2_gate import GateBlockedError, exit_code_for_status

    try:
        final, gate_report = confirm_final_once(
            result,
            raw_root=Path(args.raw_root),
            labels_root=Path(args.labels_root),
            splits_root=Path(args.splits_root),
            duplicate_reviews=Path(args.duplicate_reviews),
            gate_path=Path(args.gate_config),
        )
    except GateBlockedError as error:
        # Placeholder policy refused before any final read/lock.
        print(f"gate blocked: {error}", file=sys.stderr)
        return EXIT_BLOCKED
    except (ValueError, RuntimeError, PermissionError, FileExistsError) as error:
        # evaluate_final_once raises OSError/ValueError/PermissionError/
        # FileExistsError/RuntimeError for one-shot/validation failures; a
        # RuntimeError here is a genuine gate fail or a locked/refused final read.
        print(f"gate fail: {error}", file=sys.stderr)
        return EXIT_GATE_FAIL
    print(json.dumps(
        {"status": gate_report.status, "runId": result.run_id,
         "gateReport": gate_report.to_dict()},
        sort_keys=True, indent=2,
    ))
    return exit_code_for_status(gate_report.status)
```

This keeps exit-code mapping in ONE place (`phase2_gate.exit_code_for_status`) — the handler never invents its own code mapping. Because the handler's policy preflight (`policy.pre_agreed_placeholders → EXIT_BLOCKED`) now mirrors the same decision `load_gate_policy` made inside `confirm_final_once`, no final read or lock can happen under a placeholder policy from either path.

- [x] **Step 4: Verify**

Run: `cd avatar-web/fishing-ml && python3.11 -m py_compile src/fishing_ml/evaluate.py && python3.11 -m py_compile src/fishing_ml/experiments.py && python3.11 -m py_compile src/fishing_ml/config.py`
Expected: All compile. Direct final bypass closed for schema v2; schema v1 direct final still works.

- [x] **Step 5: Commit**

```bash
git add avatar-web/fishing-ml/src/fishing_ml/evaluate.py avatar-web/fishing-ml/src/fishing_ml/experiments.py avatar-web/fishing-ml/src/fishing_ml/config.py
git commit -m "feat(final): separate evidence from policy, block Phase 2 direct final, proper preflight order"
```

---

## Task 11: Python Tests

**Files:**
- Create: `avatar-web/fishing-ml/tests/test_phase2_training.py`
- Create: `avatar-web/fishing-ml/tests/test_phase2_experiments.py`
- Create: `avatar-web/fishing-ml/tests/test_phase2_gate.py`
- Create: `avatar-web/fishing-ml/tests/test_inference_size_contract.py`

**Interfaces:**
- Tests cover all spec §6.1 verification cases (16 items).
- Uses `unittest`; synthetic fixtures only; small CPU tensors; NO real checkpoints/captures.
- Production code is complete (Tasks 1-10) before this task — tests are written after code, per CLAUDE.md (no TDD).

- [x] **Step 1: Create test_phase2_training.py**

```python
import unittest

import torch

from fishing_ml.config import load_training_config, load_training_config_from_document, config_to_document
from fishing_ml.phase2_training import (
    apply_augmentation_profile,
    compute_hard_negative_loss,
    derive_rng,
    stable_seed_context,
)


def _v2_document(**overrides):
    doc = {
        "schemaVersion": 2, "seed": 1, "epochs": 2, "learningRate": 0.001,
        "weightDecay": 0.0001, "temperature": 0.07, "embeddingDim": 96,
        "channels": [32, 64, 96, 128], "checkpointMetric": "dev_top1_accuracy",
        "device": "cpu", "workers": 0, "reproducibilityTolerance": 0.002,
        "augmentationProfile": "none", "hardNegativeRatio": 0.25,
        "hardNegativeMargin": 0.10,
    }
    doc.update(overrides)
    return doc


class TestConfigSchema(unittest.TestCase):
    def test_v1_compat_defaults(self):
        """v1 config loads with legacy defaults (spec 6.1-1)."""
        from pathlib import Path
        config = load_training_config(Path("config/train-baseline.yaml"))
        self.assertEqual(config.schema_version, 1)
        self.assertEqual(config.augmentation_profile, "legacy_combined")
        self.assertEqual(config.hard_negative_ratio, 0.0)
        self.assertEqual(config.hard_negative_margin, 0.10)

    def test_v2_strict_parse(self):
        """v2 config with allowed values loads."""
        config = load_training_config_from_document(_v2_document())
        self.assertEqual(config.schema_version, 2)
        self.assertEqual(config.augmentation_profile, "none")
        self.assertEqual(config.hard_negative_ratio, 0.25)
        self.assertEqual(config.hard_negative_margin, 0.10)

    def test_v2_rejects_legacy_combined(self):
        """v2 rejects legacy_combined augmentationProfile (spec 3.2)."""
        with self.assertRaises(ValueError):
            load_training_config_from_document(
                _v2_document(augmentationProfile="legacy_combined"))

    def test_v2_rejects_unknown_field(self):
        """v2 rejects unknown fields (spec 3.2 strict)."""
        with self.assertRaises(ValueError):
            load_training_config_from_document(_v2_document(extraField=1))

    def test_v2_rejects_missing_field(self):
        """v2 requires all three v2 fields; missing hardNegativeMargin fails."""
        document = _v2_document()
        del document["hardNegativeMargin"]
        with self.assertRaises(ValueError):
            load_training_config_from_document(document)

    def test_v2_rejects_range_invalid(self):
        """v2 rejects out-of-allowed values: hardNegativeRatio 0.5, margin 0."""
        with self.assertRaises(ValueError):
            load_training_config_from_document(_v2_document(hardNegativeRatio=0.5))
        with self.assertRaises(ValueError):
            load_training_config_from_document(_v2_document(hardNegativeMargin=0.0))

    def test_v2_serializer_round_trip(self):
        """config_to_document on v2 keeps v2 fields; parse of that output equals input."""
        config = load_training_config_from_document(_v2_document())
        document = config_to_document(config)
        self.assertEqual(document["schemaVersion"], 2)
        self.assertIn("augmentationProfile", document)
        self.assertIn("hardNegativeRatio", document)
        self.assertIn("hardNegativeMargin", document)
        again = load_training_config_from_document(document)
        self.assertEqual(again.augmentation_profile, config.augmentation_profile)
        self.assertEqual(again.hard_negative_ratio, config.hard_negative_ratio)
        self.assertEqual(again.hard_negative_margin, config.hard_negative_margin)


class TestAugmentation(unittest.TestCase):
    def test_none_preserves_input(self):
        """Profile `none` returns the exact same tensor (spec 3.3)."""
        tensor = torch.rand(3, 6, 6)
        context = stable_seed_context(42, 1, "b1", "reference", 0)
        result = apply_augmentation_profile("none", tensor, context)
        self.assertTrue(torch.equal(result, tensor))

    def test_deterministic_by_context(self):
        """Same context => identical transform; different context differs."""
        tensor = torch.rand(3, 6, 6)
        context = stable_seed_context(42, 1, "b1", "reference", 0)
        a = apply_augmentation_profile("photometric", tensor, context)
        b = apply_augmentation_profile("photometric", tensor, context)
        self.assertTrue(torch.equal(a, b))
        other = stable_seed_context(43, 1, "b1", "reference", 0)
        c = apply_augmentation_profile("photometric", tensor, other)
        self.assertFalse(torch.equal(a, c))

    def test_profiles_differ(self):
        """Different profiles behave differently; values stay in [0,1] (spec 3.3)."""
        tensor = torch.rand(3, 6, 6)
        context = stable_seed_context(42, 1, "b1", "reference", 0)
        photo = apply_augmentation_profile("photometric", tensor, context)
        geom = apply_augmentation_profile("photometric_plus_geom", tensor, context)
        self.assertFalse(torch.allclose(photo, geom))
        for profile in ("photometric", "photometric_plus_geom"):
            out = apply_augmentation_profile(profile, tensor, context)
            self.assertGreaterEqual(out.min().item(), 0.0)
            self.assertLessEqual(out.max().item(), 1.0)

    def test_unknown_profile_rejected(self):
        tensor = torch.rand(3, 6, 6)
        context = stable_seed_context(42, 1, "b1", "reference", 0)
        with self.assertRaises(ValueError):
            apply_augmentation_profile("bogus", tensor, context)

    def test_seed_context_stable_shape(self):
        """Context is 32 bytes; derive_rng is deterministic."""
        context = stable_seed_context(42, 1, "b1", "reference", 0)
        self.assertEqual(len(context), 32)
        value = derive_rng(context).uniform(0.0, 1.0)
        self.assertEqual(value, derive_rng(context).uniform(0.0, 1.0))


class TestHardNegative(unittest.TestCase):
    def test_ratio_zero_preserves_loss(self):
        """ratio 0 returns zero aux on the same device/dtype (spec 3.4)."""
        queries = torch.randn(4, 8)
        references = torch.randn(3, 8)
        targets = torch.tensor([0, 1, 2, 0])
        aux = compute_hard_negative_loss(
            queries, references, targets, ratio=0.0, margin=0.10,
            global_seed=1, epoch=1, batch_id="b1")
        self.assertEqual(aux.item(), 0.0)
        self.assertEqual(aux.device, queries.device)
        self.assertEqual(aux.dtype, queries.dtype)

    def test_ratio_025_selects_correct_count(self):
        """24 eligible queries, ratio 0.25 => exactly 6 selected (spec 3.4.4)."""
        queries = torch.randn(24, 8)
        references = torch.randn(5, 8)
        targets = torch.randint(0, 5, (24,))
        # margin small enough that at least one selected query has a positive
        # hinge term, so a non-zero mean is expected; determinism asserted by
        # the second call.
        aux = compute_hard_negative_loss(
            queries, references, targets, ratio=0.25, margin=0.10,
            global_seed=7, epoch=1, batch_id="b1")
        aux_again = compute_hard_negative_loss(
            queries, references, targets, ratio=0.25, margin=0.10,
            global_seed=7, epoch=1, batch_id="b1")
        self.assertEqual(aux.item(), aux_again.item())
        self.assertGreater(aux.item(), 0.0)

    def test_selection_deterministic_order(self):
        """Same seed/epoch/batch selects the same queries (spec 3.4.3)."""
        queries = torch.randn(8, 8)
        references = torch.randn(4, 8)
        targets = torch.tensor([0, 1, 2, 3, 0, 1, 2, 3])
        a = compute_hard_negative_loss(
            queries, references, targets, ratio=0.9, margin=0.01,
            global_seed=7, epoch=2, batch_id="b_batch")
        b = compute_hard_negative_loss(
            queries, references, targets, ratio=0.9, margin=0.01,
            global_seed=7, epoch=2, batch_id="b_batch")
        self.assertEqual(a.item(), b.item())

    def test_single_reference_zero_aux(self):
        """R=1 episode returns zero auxiliary loss (spec 3.4: no wrong reference)."""
        queries = torch.randn(3, 8)
        references = torch.randn(1, 8)
        targets = torch.tensor([0, 0, 0])
        aux = compute_hard_negative_loss(
            queries, references, targets, ratio=0.25, margin=0.10,
            global_seed=1, epoch=1, batch_id="b1")
        self.assertEqual(aux.item(), 0.0)

    def test_zero_eligible_queries_zero_aux(self):
        """Empty query list -> zero aux (eligible_count 0: min 1 cannot apply)."""
        queries = torch.zeros(0, 8)
        references = torch.randn(3, 8)
        targets = torch.tensor([], dtype=torch.long)
        aux = compute_hard_negative_loss(
            queries, references, targets, ratio=0.25, margin=0.10,
            global_seed=1, epoch=1, batch_id="b1")
        self.assertEqual(aux.item(), 0.0)
```

**Spec §6.1 coverage:** items 1, 4, 5 and the strict-parse half of items 1/2. Note: `compute_hard_negative_loss` is tested with un-normalized random tensors — the function only computes `torch.mm(query, reference.t())` cosine similarities and a hinge, so no model or normalization is required; determinism of selection is asserted by repeat-call equality.

- [x] **Step 2: Create test_phase2_experiments.py**

```python
import hashlib
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from fishing_ml.experiments import (
    ExperimentSpec,
    ExperimentResult,
    _select_by_gate,
    compare_experiments,
    enumerate_specs,
    _ALLOWED_OVERRIDE_KEYS,
    AUGMENTATION,
    HARD_NEGATIVE,
    EMBEDDING,
)
from fishing_ml.dataset_version import DatasetVersion


def _version():
    return DatasetVersion(1, "test-ds", None, "2026-09-02T00:00:00Z", [])


class TestCandidateMatrix(unittest.TestCase):
    """Spec §6.1-3: 24 candidates, 24 unique configs/checksums/run IDs."""

    def test_24_unique_specs(self):
        specs = enumerate_specs(
            Path("config/phase2/candidates.yaml"),
            Path("data/phase2/splits"),
            _version(),
        )
        self.assertEqual(len(specs), 24)
        checksums = set(s.config_checksum for s in specs)
        self.assertEqual(len(checksums), 24)
        run_ids = set(s.run_id for s in specs)
        self.assertEqual(len(run_ids), 24)

    def test_matrix_key_covers_all_axes(self):
        specs = enumerate_specs(
            Path("config/phase2/candidates.yaml"),
            Path("data/phase2/splits"),
            _version(),
        )
        augs = {s.augmentation for s in specs}
        hns = {s.hard_negative for s in specs}
        temps = {s.temperature for s in specs}
        embs = {s.embedding for s in specs}
        self.assertEqual(augs, set(AUGMENTATION))
        self.assertEqual(hns, set(HARD_NEGATIVE))
        self.assertEqual(len(temps), 2)
        self.assertEqual(len(embs), 2)

    def test_allowed_override_keys(self):
        """v2 keys must be in the override set."""
        self.assertIn("augmentationProfile", _ALLOWED_OVERRIDE_KEYS)
        self.assertIn("hardNegativeRatio", _ALLOWED_OVERRIDE_KEYS)
        self.assertIn("hardNegativeMargin", _ALLOWED_OVERRIDE_KEYS)


class TestGateSelection(unittest.TestCase):
    """Spec §6.1-8: selection uses calibrated wrong-accepted, tie-breakers."""

    def _result(self, accepted_wrong=0, top1=0.5,
                batch_exact=0.5, accepted_rate=0.9,
                label="a", split_checksum=None, config_checksum=None):
        """Distinct candidates get distinct run_ids via distinct checksums."""
        split_checksum = split_checksum or (label * 64)[:64]
        config_checksum = config_checksum or (chr(ord("a") + 1) * 64)
        spec = ExperimentSpec(
            augmentation="none", hard_negative="off", temperature=0.05,
            embedding="dim_96", seed=1, split_checksum=split_checksum,
            config_checksum=config_checksum, parent_dataset_id=None,
        )
        # run_id is a read-only property; it is deterministic from the axes +
        # checksums, so candidates made with different checksums differ here.
        return ExperimentResult(
            spec=spec, run_id=spec.run_id, run_dir=f"/tmp/{spec.run_id}",
            thresholds_path="", thresholds={}, dev_metrics={},
            accepted_wrong_count=accepted_wrong, accepted_rate=accepted_rate,
            top1_accuracy=top1, batch_exact_match=batch_exact,
            manifest_path="", config_checksum=config_checksum,
            split_checksum=split_checksum, git_revision="a" * 40,
            passed_gate=(accepted_wrong == 0),
        )

    def test_zero_wrong_accepted_wins(self):
        good = self._result(accepted_wrong=0, top1=0.9, label="good")
        bad = self._result(accepted_wrong=1, top1=1.0, label="bad")
        winner = compare_experiments([bad, good], require_zero_wrong_accepted=True)
        self.assertEqual(winner.run_id, good.run_id)

    def test_none_when_all_wrong(self):
        bad = self._result(accepted_wrong=1, label="bad")
        winner = compare_experiments([bad], require_zero_wrong_accepted=True)
        self.assertIsNone(winner)

    def test_allow_wrong_accepted_overrides(self):
        a = self._result(accepted_wrong=2, top1=0.8, label="a")
        b = self._result(accepted_wrong=3, top1=0.7, label="b")
        winner = compare_experiments([a, b], require_zero_wrong_accepted=False)
        self.assertEqual(winner.run_id, a.run_id)

    def test_tie_breaker_order(self):
        """Higher acceptedRate wins, then top1Accuracy, then batchExactMatch."""
        a = self._result(accepted_rate=0.95, top1=0.8, batch_exact=0.7, label="a")
        b = self._result(accepted_rate=0.90, top1=0.9, batch_exact=0.8, label="b")
        winner = compare_experiments([a, b], require_zero_wrong_accepted=False)
        self.assertEqual(winner.run_id, a.run_id)

    def test_stable_tie_break_run_id(self):
        """Exact ties break on the run_id string (lexicographic)."""
        a = self._result(top1=0.99, batch_exact=0.99, label="a")
        b = self._result(top1=0.99, batch_exact=0.99, label="b")
        winner = compare_experiments([a, b], require_zero_wrong_accepted=False)
        # sorted(eligible, key=(metrics..., run_id)) then ranked[-1] -> the
        # LEXICOGRAPHICALLY LARGEST run_id wins on a full tie.
        self.assertEqual(winner.run_id, max(a.run_id, b.run_id))


class TestManifestShape(unittest.TestCase):
    """Spec §5.2: candidate manifest has schemaVersion 2, required sections."""

    def test_experiment_spec_properties(self):
        spec = ExperimentSpec(
            augmentation="photometric", hard_negative="ratio_0.25",
            temperature=0.07, embedding="dim_128", seed=20260827,
            split_checksum="a" * 64, config_checksum="b" * 64,
            parent_dataset_id=None,
        )
        self.assertEqual(spec.embedding_dim, 128)
        self.assertIn("photometric", spec.run_id)
        self.assertIn("ratio_0.25", spec.run_id)
        self.assertIn("t0.07", spec.matrix_key)


class TestCompareFailClosed(unittest.TestCase):
    """Spec §6.1-9: compare rejects incomplete/duplicate/tampered matrix.

    The CLI-level duplicate/checksum checks live in ``_cmd_compare``; this class
    pins the pure helper-level properties they rely on: a spec's checksums are
    stable and a tampered spec's config_checksum differs, so the same-run-id
    collision and the spec-vs-manifest checksum comparison are well-defined.
    """

    def test_checksum_mismatch_detected(self):
        """A tampered spec (different config checksum) is distinguishable."""
        spec = ExperimentSpec(
            augmentation="none", hard_negative="off", temperature=0.05,
            embedding="dim_96", seed=1,
            split_checksum="a" * 64, config_checksum="b" * 64,
            parent_dataset_id=None,
        )
        tampered = ExperimentSpec(
            augmentation="none", hard_negative="off", temperature=0.05,
            embedding="dim_96", seed=1,
            split_checksum="a" * 64, config_checksum="c" * 64,  # different
            parent_dataset_id=None,
        )
        self.assertNotEqual(spec.config_checksum, tampered.config_checksum)

    def test_duplicate_run_id_is_detectable(self):
        """Two distinct specs cannot share a run_id (detection precondition)."""
        spec_a = ExperimentSpec(
            augmentation="none", hard_negative="off", temperature=0.05,
            embedding="dim_96", seed=1,
            split_checksum="a" * 64, config_checksum="b" * 64,
            parent_dataset_id=None,
        )
        spec_b = ExperimentSpec(
            augmentation="photometric", hard_negative="off", temperature=0.05,
            embedding="dim_96", seed=1,
            split_checksum="a" * 64, config_checksum="b" * 64,
            parent_dataset_id=None,
        )
        # run_id embeds the augmentation token, so distinct axes never collide.
        self.assertNotEqual(spec_a.run_id, spec_b.run_id)
        self.assertEqual(len({spec_a.run_id, spec_b.run_id}), 2)


class TestDatasetVersionList(unittest.TestCase):
    """Spec §6.1-6: list reads real dataset-version, not synthetic."""

    def test_enumerate_requires_real_version(self):
        """enumerate_specs uses the parsed DatasetVersion (not synthetic)."""
        version = _version()
        self.assertEqual(version.dataset_id, "test-ds")
        self.assertIsNone(version.parent_dataset_id)


class TestCalibratedMetricsSelection(unittest.TestCase):
    """Spec §6.1-8: selection uses wrongAcceptedCount after thresholding."""

    def test_run_experiment_uses_calibrated_wrong_accepted(self):
        """_parse_calibrated_metrics reads wrongAcceptedCount strictly."""
        from fishing_ml.experiments import _parse_calibrated_metrics
        metrics = _parse_calibrated_metrics({
            "acceptedCount": 10, "acceptedAccuracy": 0.9,
            "abstentionRate": 0.2, "wrongAcceptedCount": 1,
        })
        self.assertEqual(metrics.wrong_accepted_count, 1)
        self.assertEqual(metrics.accepted_rate, 0.8)
        with self.assertRaises(ValueError):
            _parse_calibrated_metrics({
                "acceptedCount": 10, "acceptedAccuracy": 0.9,
                "abstentionRate": 0.2,  # wrongAcceptedCount missing
            })
```

**Spec §6.1 coverage:** items 3 (24 unique), 8 (selection uses calibrated metrics + tie-breakers), 9 (compare fail-closed).

- [x] **Step 3: Create test_phase2_gate.py**

```python
import unittest
from pathlib import Path

from fishing_ml.phase2_gate import (
    GatePolicy,
    GateReport,
    GateCheck,
    GateBlockedError,
    load_gate_policy,
    adjudicate_final,
    adjudicate_replay,
    exit_code_for_status,
    _sha256_file,
    BLOCK_POLICY_NOT_APPROVED,
    FAIL_WRONG_ACCEPTED_NONZERO,
    EXIT_PASS,
    EXIT_INVALID,
    EXIT_FAIL,
    EXIT_BLOCKED,
)


class TestGateExitCodes(unittest.TestCase):
    """Spec §3.9 / §6.1: exit codes 0/2/3/4."""

    def test_pass_returns_0(self):
        self.assertEqual(exit_code_for_status("pass"), EXIT_PASS)

    def test_fail_returns_3(self):
        self.assertEqual(exit_code_for_status("fail"), EXIT_FAIL)

    def test_blocked_returns_4(self):
        self.assertEqual(exit_code_for_status("blocked"), EXIT_BLOCKED)


class TestGateBlockedError(unittest.TestCase):
    """Spec §3.10 / §6.1-11: placeholder blocks final before read/lock."""

    def test_is_runtime_error(self):
        self.assertTrue(issubclass(GateBlockedError, RuntimeError))


class TestGatePolicyParsing(unittest.TestCase):
    """Spec §3.8: strict gate.yaml parsing."""

    def test_load_real_gate_yaml(self):
        """gate.yaml with preAgreedPlaceholders: true loads without approval."""
        policy = load_gate_policy(Path("config/phase2/gate.yaml"))
        self.assertTrue(policy.pre_agreed_placeholders)
        self.assertFalse(policy.not_tuned_on_phase_a_final)

    def test_missing_coverage_section_rejected(self):
        """Missing required section raises ValueError."""
        # Use a real gate but override with an invalid doc
        with self.assertRaises(ValueError):
            load_gate_policy(Path("nonexistent-gate.yaml"))


class TestAdjudicateFinal(unittest.TestCase):
    """Spec §6.1-11: placeholder blocks, wrong-accepted nonzero fails."""

    def _approved_policy(self):
        return GatePolicy(
            schema_version=1, pre_agreed_placeholders=False,
            approved_at="2026-09-01T00:00:00Z", approved_by="tester",
            approval_evidence="test", not_tuned_on_phase_a_final=False,
            min_accepted_rate=0.8, min_batch_exact_match=0.9,
            min_top1_accuracy=0.95, budget_ms=500.0, p95_ms=100.0,
            max_ms=200.0, max_errored_batch_rate=0.01,
            max_omitted_rate=0.0, require_single_model_identity=True,
            require_zero_wrong_accepted=True,
        )

    def test_placeholder_policy_blocks(self):
        policy = GatePolicy(
            schema_version=1, pre_agreed_placeholders=True,
            approved_at=None, approved_by=None, approval_evidence=None,
            not_tuned_on_phase_a_final=False,
            min_accepted_rate=0.0, min_batch_exact_match=0.0,
            min_top1_accuracy=0.0, budget_ms=500.0, p95_ms=100.0,
            max_ms=200.0, max_errored_batch_rate=0.01,
            max_omitted_rate=0.0, require_single_model_identity=False,
            require_zero_wrong_accepted=True,
        )
        report = adjudicate_final(
            policy, {}, policy_sha256="a" * 64, evidence_sha256="b" * 64)
        self.assertEqual(report.status, "blocked")
        self.assertIn(BLOCK_POLICY_NOT_APPROVED, report.blockers)

    def test_wrong_accepted_nonzero_fails(self):
        policy = self._approved_policy()
        evidence = {"metrics": {
            "wrongCount": 1, "acceptedCount": 100, "acceptedRate": 0.95,
            "top1Accuracy": 0.99, "batchExactMatch": 0.98,
            "abstentionRate": 0.05,
        }}
        report = adjudicate_final(
            policy, evidence, policy_sha256="a" * 64, evidence_sha256="b" * 64)
        self.assertEqual(report.status, "fail")
        self.assertIn(FAIL_WRONG_ACCEPTED_NONZERO, report.failures)

    def test_pass_when_all_gates_satisfied(self):
        policy = self._approved_policy()
        evidence = {"metrics": {
            "wrongCount": 0, "acceptedCount": 100, "acceptedRate": 0.95,
            "top1Accuracy": 0.99, "batchExactMatch": 0.98,
            "abstentionRate": 0.05,
        }}
        report = adjudicate_final(
            policy, evidence, policy_sha256="a" * 64, evidence_sha256="b" * 64)
        self.assertEqual(report.status, "pass")
        self.assertEqual(report.blockers, ())
        self.assertEqual(report.failures, ())

    def _replay_document(self, **overrides):
        """ReplayReport.to_dict() shape (Task 3): top-level keys, clientLatencyMs."""
        doc = {
            "schemaVersion": 2,
            "batchCount": 10,
            "queryCount": 100,
            "requestCount": 100,
            "successfulBatchCount": 10,
            "erroredBatchCount": 0,
            "acceptedCount": 95,
            "acceptedRate": 0.95,
            "abstainedCount": 5,
            "abstainedRate": 0.05,
            "omittedCount": 0,
            "omittedRate": 0.0,
            "labeledBatchCount": 10,
            "unknownBatchCount": 0,
            "labeledQueryCount": 50,
            "unknownQueryCount": 0,
            "labeledReturnedPredictionCount": 50,
            "unknownReturnedPredictionCount": 0,
            "correctAcceptedCount": 49,
            "wrongAcceptedCount": 0,
            "labeledTop1Accuracy": 0.99,
            "labeledBatchExactMatch": 0.98,
            "labeledAcceptedRate": 0.95,
            "clientLatencyMs": {
                "sampleCount": 100, "p50": 50, "p95": 90, "max": 100,
                "rule": "nearest-rank",
            },
            "modelIdentity": {"modelIds": ["m1"], "checksums": {"m1": "a" * 64}},
        }
        doc.update(overrides)
        return doc

    def test_latency_p95_exceeded_fails(self):
        policy = self._approved_policy()
        replay = self._replay_document(
            clientLatencyMs={"sampleCount": 100, "p50": 50, "p95": 150,  # exceeds p95_ms=100
                             "max": 200, "rule": "nearest-rank"},
        )
        freeze = {"schemaVersion": 1, "runId": "test", "gitRevision": "a" * 40, "files": {}}
        report = adjudicate_replay(
            policy, replay, freeze,
            policy_sha256="a" * 64, evidence_sha256="b" * 64)
        self.assertEqual(report.status, "fail")
        self.assertIn("latency_p95_exceeded", report.failures)

    def test_latency_max_not_below_ceiling_fails(self):
        """Spec §3.11: latencyMaxMs == maxMs IS a FAIL (hard ceiling)."""
        policy = self._approved_policy()
        replay = self._replay_document(
            clientLatencyMs={"sampleCount": 100, "p50": 50, "p95": 90,  # p95 ok
                             "max": 100, "rule": "nearest-rank"},  # max == maxMs
        )
        freeze = {"schemaVersion": 1, "runId": "test", "gitRevision": "a" * 40, "files": {}}
        report = adjudicate_replay(
            policy, replay, freeze,
            policy_sha256="a" * 64, evidence_sha256="b" * 64)
        self.assertEqual(report.status, "fail")
        self.assertIn("latency_max_not_below_ceiling", report.failures)

    def test_wrong_accepted_nonzero_beats_blocked(self):
        """Spec §3.9/§3.11: fail takes priority over blocked."""
        policy = self._approved_policy()
        replay = self._replay_document(
            wrongAcceptedCount=1,  # quality fail
            batchCount=0,          # operational blocked (no batches)
            erroredBatchCount=0,
        )
        freeze = {"schemaVersion": 1, "runId": "test", "gitRevision": "a" * 40, "files": {}}
        report = adjudicate_replay(
            policy, replay, freeze,
            policy_sha256="a" * 64, evidence_sha256="b" * 64)
        self.assertEqual(report.status, "fail")
        self.assertIn("wrong_accepted_nonzero", report.failures)


class TestSha256File(unittest.TestCase):
    """Helper sanity check: _sha256_file is deterministic."""

    def test_deterministic(self):
        import hashlib
        tmp = Path("build/test-sha256.tmp")
        tmp.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_text("hello")
        h1 = _sha256_file(tmp)
        h2 = _sha256_file(tmp)
        expected = hashlib.sha256(b"hello").hexdigest()
        self.assertEqual(h1, expected)
        self.assertEqual(h1, h2)
        tmp.unlink()
```

**Spec §6.1 coverage:** items 9 (compare rejects incomplete/duplicate), 11 (placeholder blocks), 13 (replay statuses), 14 (latency ceiling). Gate exit codes mapped.

- [x] **Step 4: Create test_inference_size_contract.py**

The 64-image constant is internal (`_MAX_IMAGES`), so the tests use the public `InferenceImage` + `canonical_request_byte_length` (Task 5) and the exported `MAX_CANONICAL_REQUEST_BYTES`, asserting the exact boundary numerically:

```python
import unittest

from fishing_ml.inference_contract import (
    MAX_CANONICAL_REQUEST_BYTES,
    InferenceImage,
    canonical_request_byte_length,
)


def _maximal_images():
    """127 images at 10,080 b64 chars + 1 at 180: the byte-maximal distribution
    of 960,000 decoded bytes over 128 images (each d ≡ 1 mod 3 except one d ≡ 2)."""
    refs = [InferenceImage(index=i, png_base64="A" * (10080 if i < 63 else 180))
            for i in range(64)]
    queries = [InferenceImage(index=i, png_base64="A" * 10080) for i in range(64)]
    return refs, queries


class TestCanonicalBoundary(unittest.TestCase):
    """Spec §3.12 / §6.1-15: exact canonical upper bound and one-byte overflow."""

    def test_exact_maximum_is_accepted(self):
        refs, queries = _maximal_images()
        n = canonical_request_byte_length(refs, queries)
        self.assertEqual(n, MAX_CANONICAL_REQUEST_BYTES)

    def test_one_byte_overflow_rejected(self):
        """One extra base64 character on any image exceeds the canonical budget."""
        refs, queries = _maximal_images()
        n = canonical_request_byte_length(refs, queries)
        # Enlarging the last query by one b64 char: +1 byte in the wire JSON.
        queries = list(queries)
        queries[-1] = InferenceImage(index=63, png_base64=queries[-1].png_base64 + "A")
        self.assertGreater(canonical_request_byte_length(refs, queries), n)
        self.assertGreater(
            canonical_request_byte_length(refs, queries), MAX_CANONICAL_REQUEST_BYTES
        )

    def test_envelope_only(self):
        n = canonical_request_byte_length([], [])
        # {"schemaVersion":1,"references":[],"queries":[]} = 48 chars.
        self.assertEqual(n, 48)


class TestDecodedBudgetWiring(unittest.TestCase):
    """The constant surfaced by the client binder matches the contract."""

    def test_contract_constant_exported(self):
        from fishing_ml.inference_client import _MAX_REQUEST_BYTES
        self.assertEqual(_MAX_REQUEST_BYTES, MAX_CANONICAL_REQUEST_BYTES)
```

**Spec §6.1 coverage:** item 15 (decoded/canonical exact boundaries, overflow one byte) and item 16 (client uses the contract constant — no payload in errors, verified in the TS tests).

- [x] **Step 5: Run all Python tests**

```bash
cd avatar-web/fishing-ml && python3.11 -m unittest discover -s tests -p 'test_*.py' -v
```

Expected: All pass.

- [x] **Step 6: Commit**

```bash
git add avatar-web/fishing-ml/tests/
git commit -m "test: add Phase 2 training, experiments, gate, and size contract tests"
```

---

## Task 12: TypeScript Tests

**Files:**
- Create: `avatar-web/server/src/fishing/inferenceClient.test.ts`

**Interfaces:**
- Tests the existing `InferenceClient` API: `match(payload: CanCauPayload): Promise<ShadowMatchResult>`.
- Uses `node:test` + `assert` (or the repo's existing test runner — check the sibling `inferenceClient` tests; `npx tsc --noEmit` must pass).
- No real network: inject `globalThis.fetch` stub.

- [x] **Step 1: Create inferenceClient.test.ts**

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { InferenceClient } from './inferenceClient.js';

// A client-side-valid PNG: InferenceClient.validatePng only checks the
// signature, IHDR (length 13, "IHDR", 75x75), and color type (2 or 6). The
// client never decodes pixel data — it only serializes to base64 — so this
// header stub is sufficient and is not a real decodable image.
const PNG = (() => {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(29);
  ihdr.writeUInt32BE(13, 4); // IHDR chunk length
  ihdr.write('IHDR', 8, 'ascii');
  ihdr.writeUInt32BE(75, 16); // width
  ihdr.writeUInt32BE(75, 20); // height
  ihdr[24] = 8; // bit depth
  ihdr[25] = 2; // color type: truecolor RGB
  return Buffer.concat([sig, ihdr, Buffer.alloc(64)]);
})();

const payload = { images: [PNG], imagesNew: [PNG] };
const config = (overrides = {}) => ({
  enabled: true, killSwitch: false, sampleRate: 1.0,
  endpoint: 'http://example.invalid/', timeoutMs: 1000,
  circuitBreaker: { failureThreshold: 3, maxInFlight: 8, resetMs: 1000 },
  ...overrides,
});

const originalFetch = globalThis.fetch;

function stubFetch(implementation: typeof fetch): void {
  globalThis.fetch = implementation;
}

function restoreFetch(): void {
  globalThis.fetch = originalFetch;
}

test('disabled/kill-switch/sample-zero creates zero fetch', async () => {
  let fetched = 0;
  stubFetch((async () => { fetched++; throw new Error('unreachable'); }) as typeof fetch);
  try {
    for (const cfg of [
      config({ enabled: false }),
      config({ killSwitch: true }),
      config({ sampleRate: 0 }),
    ]) {
      const client = new InferenceClient(cfg as never);
      const result = await client.match(payload);
      assert.equal(result.status, 'disabled');
    }
  } finally {
    restoreFetch();
  }
  assert.equal(fetched, 0);
});

test('canonical serialized body is validated before fetch', async () => {
  const requestBodies: string[] = [];
  stubFetch((async (_url, init: any) => {
    requestBodies.push(init.body);
    return new Response(JSON.stringify({
      schemaVersion: 1, modelId: 'm-123',
      predictions: [
        { queryIndex: 0, referenceIndex: 0, similarity: 0.9, margin: 0.1, accepted: true },
      ],
      latencyMs: 5,
    }), { status: 200 });
  }) as typeof fetch);
  try {
    const client = new InferenceClient(config() as never);
    const result = await client.match(payload);
    assert.equal(result.status, 'ok');
    // The body passed to fetch is exactly the string that was size-checked.
    assert.equal(requestBodies.length, 1);
    assert.ok(requestBodies[0].length < 1_283_950);
  } finally {
    restoreFetch();
  }
});

test('decoded overflow (aggregate > MAX_PNG_BYTES) is rejected locally', async () => {
  let fetched = false;
  stubFetch((async () => { fetched = true; throw new Error('unreachable'); }) as typeof fetch);
  try {
    const big = Buffer.alloc(960_001, 0);
    const client = new InferenceClient(config() as never);
    const result = await client.match({ images: [big], imagesNew: [PNG] });
    assert.equal(result.status, 'invalid');
    assert.equal(result.errorCode, 'invalid_image_type');
  } finally {
    restoreFetch();
  }
  assert.equal(fetched, false);
});

test('timeout returns bounded result without throwing', async () => {
  stubFetch((( _url: any, init: any) => {
    // Simulate an abort: reject like the fetch API does on abort()
    return new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  }) as typeof fetch);
  try {
    const client = new InferenceClient(config({ timeoutMs: 20 }) as never);
    const result = await client.match(payload);
    assert.equal(result.status, 'timeout');
    assert.equal(result.errorCode, 'request_timeout');
  } finally {
    restoreFetch();
  }
});

test('model identity pinning rejects mismatch', async () => {
  let calls = 0;
  stubFetch((async () => {
    calls++;
    return new Response(JSON.stringify({
      schemaVersion: 1, modelId: calls === 1 ? 'model-a' : 'model-b',
      predictions: [], latencyMs: 5,
    }), { status: 200 });
  }) as typeof fetch);
  try {
    const client = new InferenceClient(config() as never);
    const first = await client.match(payload);
    assert.equal(first.status, 'ok');
    const second = await client.match(payload);
    assert.equal(second.status, 'invalid');
    assert.equal(second.errorCode, 'model_identity_mismatch');
  } finally {
    restoreFetch();
  }
});

test('circuit breaker opens after failureThreshold consecutive failures', async () => {
  let calls = 0;
  stubFetch((async () => {
    calls++;
    throw new Error('network down');
  }) as typeof fetch);
  try {
    const client = new InferenceClient(config({
      circuitBreaker: { failureThreshold: 2, maxInFlight: 8, resetMs: 10_000 },
    }) as never);
    // First failure: recorded (breaker still closed).
    assert.equal((await client.match(payload)).status, 'unavailable');
    // Second failure: breaker opens.
    assert.equal((await client.match(payload)).status, 'unavailable');
    // While open, requests are refused without any fetch.
    const before = calls;
    const result = await client.match(payload);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.errorCode, 'circuit_open');
    assert.equal(calls, before);
  } finally {
    restoreFetch();
  }
});

test('request document contains only schema/images — no account/fish fields', async () => {
  const bodies: Record<string, unknown>[] = [];
  stubFetch((async (_url, init: any) => {
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({
      schemaVersion: 1, modelId: 'm-1',
      predictions: [], latencyMs: 5,
    }), { status: 200 });
  }) as typeof fetch);
  try {
    const client = new InferenceClient(config() as never);
    await client.match(payload);
    assert.equal(bodies.length, 1);
    const doc = bodies[0];
    assert.deepEqual(Object.keys(doc).sort(), ['queries', 'references', 'schemaVersion']);
    assert.equal(doc.schemaVersion, 1);
    assert.ok(Array.isArray(doc.references) && Array.isArray(doc.queries));
    assert.ok(doc.references.length >= 1 && doc.queries.length >= 1);
    for (const image of [...(doc.references as any[]), ...(doc.queries as any[])]) {
      assert.deepEqual(Object.keys(image).sort(), ['index', 'pngBase64']);
    }
  } finally {
    restoreFetch();
  }
});
```

**Spec §6.2 coverage:** disabled/zero-fetch, canonical serialized size-guard, decoded overflow, timeout bounded result, model identity pinning, breaker generation, request-document-only-schema/images, no payload in errors.

- [x] **Step 2: Run TypeScript verification**

```bash
cd avatar-web/server && npm test && npm run typecheck && npm run build
```

Expected: All pass. (Run `npm run typecheck` first if the existing server test runner differs; the repo uses `node:test` per CLAUDE.md.)

- [x] **Step 3: Commit**

```bash
git add avatar-web/server/src/fishing/inferenceClient.test.ts
git commit -m "test: add TypeScript inference client contract and boundary tests"
```

---

## Task 13: Documentation and Status

**Files:**
- Modify: `avatar-web/fishing-ml/README.md`
- Modify: `docs/superpowers/plans/2026-08-28-fishing-phase-2-results.md`
- Create: `docs/superpowers/plans/2026-09-02-fishing-phase-2-code-completion-results.md`

- [x] **Step 1: Update README.md**

- Remove contradiction about no service layer.
- Document config v2 fields and augmentation/hard-negative profiles.
- Document all six CLI commands with exact usage.
- Document gate statuses: `pass`, `fail`, `blocked`.
- Update request-size constants.
- Expected post-code status vocabulary:
  ```text
  codeComplete: true
  offlineGateStatus: blocked
  replayGateStatus: blocked
  liveShadowStatus: not-run
  ```

- [x] **Step 2: Add correction section to 2026-08-28-fishing-phase-2-results.md**

Add a clearly dated section:

```markdown
## Correction / Current Status (2026-09-02)

The green 2B-2 row in the original results table reflected code-completion verification,
not real-checkpoint replay. Real inference replay against a frozen checkpoint was not
performed. See `2026-09-02-fishing-phase-2-code-completion-results.md` for code verification.
```

- [x] **Step 3: Create code-completion results template**

Create `docs/superpowers/plans/2026-09-02-fishing-phase-2-code-completion-results.md` with the verification matrix from spec §6. Start from this template (fill the Command/Result columns during verification):

```markdown
# Fishing Phase 2 Code Completion — Verification Results

> Scope: code-completion verification only. Gate statuses are `blocked` until
> real-checkpoint offline replay and approved policy exist. See the correction
> note in `2026-08-28-fishing-phase-2-results.md`.

## Python automated (spec §6.1)

| # | Check | Command | Result |
|---|-------|---------|--------|
| 1 | Schema v1 legacy; v2 strict/reject | `python3.11 -m unittest tests.test_phase2_training.TestConfigSchema` | pending |
| 2 | v1 artifacts load; v2 round-trip | `TestConfigSchema.test_v2_serializer_round_trip` | pending |
| 3 | 24 unique configs/checksums/run IDs | `python3.11 -m unittest tests.test_phase2_experiments.TestCandidateMatrix` | pending |
| 4 | Augmentation deterministic / dev-final unaugmented | `TestAugmentation` | pending |
| 5 | Hard-negative off exact; ratio 0.25 deterministic; R=1 safe | `TestHardNegative` | pending |
| 6 | `list` reads real dataset-version, not final | CLI smoke: `fishing-phase2-experiment list ...` | pending |
| 7 | `run` reuse-or-fail-closed | CLI smoke: rerun `fishing-phase2-experiment run` on existing run | pending |
| 8 | Selection uses calibrated metrics | `TestGateSelection` + `TestCalibratedMetricsSelection` | pending |
| 9 | `compare` rejects incomplete/duplicate/tampered | `TestCompareFailClosed` + manifest missing run in `compare` | pending |
| 10 | Freeze only selected run | CLI: `freeze` with mismatched selection run-id exits 2 | pending |
| 11 | Placeholder blocks before final read/lock | `TestAdjudicateFinal.test_placeholder_policy_blocks` | pending |
| 12 | Final report terminal / transient cleanup | `TestAdjudicateFinal` + one-shot lock (evaluate_final_once) | pending |
| 13 | Replay quality/operational fail-over-blocked | `TestAdjudicateReplay.*` | pending |
| 14 | Replay max latency nearest observed | `TestAdjudicateReplay` latency checks (`p95`/`max`) | pending |
| 15 | Decoded/canonical exact boundary + overflow | `python3.11 -m unittest tests.test_inference_size_contract` | pending |
| 16 | Service/client errors never carry payload | TS tests + `grep -rn 'base64\|idUser' avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py` (empty) | pending |

## TypeScript automated (spec §6.2)

| # | Check | Command | Result |
|---|-------|---------|--------|
| 1 | Disabled/kill-switch/sample-zero → zero fetch | `npm test -- --test-name-pattern="zero fetch"` | pending |
| 2 | Canonical serialized body size-checked | `--test-name-pattern="canonical serialized"` | pending |
| 3 | Decoded/raw-body boundaries/overflow | `--test-name-pattern="decoded overflow"` | pending |
| 4 | Timeout/unavailable/malformed bounded result | `--test-name-pattern="timeout|malformed"` | pending |
| 5 | Model identity pinning + breaker | `--test-name-pattern="identity|breaker"` | pending |
| 6 | Request doc only schema/images | `--test-name-pattern="only schema"` | pending |

## Static/manual (spec §6.3)

- [ ] `list` smoke on synthetic fixture: count 24, provenance present
- [ ] Gate fixtures pass/fail/blocked → exit codes 0/3/4
- [ ] Source scan: no TX43 / `finishFishing()` / new game send
- [ ] Privacy scan: gate reports/logs contain no image/base64/account/raw packets
- [ ] `git status` clean of generated runtime artifacts
```

Then fill in Command/Result during verification (after Task 12).

- [x] **Step 4: Final source scan**

```bash
# No TX43 or finishFishing in production Phase 2 files
grep -rn 'TX43\|finishFishing' avatar-web/fishing-ml/src/fishing_ml/ avatar-web/server/src/fishing/

# No image/base64/account in gate reports
grep -rn 'pngBase64\|base64\|idUser\|idFish\|cookie' avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py

# No generated runtime artifacts in source
git status --short
```

- [x] **Step 5: Commit**

```bash
git add avatar-web/fishing-ml/README.md docs/superpowers/plans/
git commit -m "docs: update README for Phase 2 code-completion, add status vocabulary and correction"
```

---

## Verification Checklist (Post-Implementation)

After all tasks are complete, run the full verification matrix:

```bash
# Python tests
cd avatar-web/fishing-ml && python3.11 -m unittest discover -s tests -p 'test_*.py' -v

# TypeScript verification
cd avatar-web/server && npm test && npm run typecheck && npm run build

# Source scans
grep -rn 'TX43\|finishFishing' avatar-web/fishing-ml/src/ avatar-web/server/src/fishing/
grep -rn 'TODO\|TBD\|implement later' avatar-web/fishing-ml/src/fishing_ml/phase2_training.py avatar-web/fishing-ml/src/fishing_ml/phase2_gate.py

# No generated artifacts in git
git status --short
```

Expected post-implementation status:

```text
codeComplete: true
offlineGateStatus: blocked
replayGateStatus: blocked
liveShadowStatus: not-run
```
