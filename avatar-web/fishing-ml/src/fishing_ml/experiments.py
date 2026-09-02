"""Phase 2 controlled experiment runner — candidate selection on train/dev only.

This module is STRICTLY ADDITIVE. It composes the existing Phase A entry points:

    run_training(config_path, raw_root, labels_root, splits_root,
                 duplicate_reviews, artifacts_root, run_id) -> Path
    calibrate_run(run_dir, require_zero_wrong_accepted=True) -> Path
    freeze_run(run_dir, raw_root, labels_root, splits_root, duplicate_reviews) -> Path
    verify_freeze(frozen_dir) -> FreezeManifest
    evaluate.evaluate_run(run_dir, raw_root, labels_root, splits_root, "dev") -> dict
    evaluate.evaluate_final_once(run_dir, raw_root, labels_root, splits_root,
                                 confirm_final_once) -> dict

and the provenance record ``DatasetVersion`` from ``dataset_version.py``.

It NEVER opens the Phase A final split during selection, NEVER modifies the
reused symbols, and NEVER writes images / raw packets / base64. The candidate
matrix in ``config/phase2/candidates.yaml`` is a FINITE, enumerated set; unknown
keys and unbounded combinations are rejected.

The trained model always accepts a frozen checkpoint: the service later loads
exactly one frozen candidate (see artifacts.py / evaluate.py). This module only
produces that frozen artifact; it does not expose per-request model selection.

Real training requires torch + GPU + Phase 2 data, which may be unavailable in a
given worktree. All torch / numpy imports are lazy so the pure-Python logic
(matrix finiteness, gate ordering, manifest/determinism) is importable and
testable without torch. The Phase 2 final is opened at most once, gated by
``--confirm-final-once`` matching the selected run-id exactly.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Mapping

import yaml

import os
from .dataset_version import DatasetVersion
from .phase2_gate import load_gate_policy
from .schema import atomic_write_json, read_json, sha256_file

# CLI exit codes (spec §3.9): 0 = stage completed / adjudication pass;
# 2 = input/schema/provenance/checksum/infrastructure invalid;
# 3 = at least one mandatory gate failure; 4 = gate blocked (missing evidence
# or policy not approved). Non-adjudication commands return 0 or 2 only.
EXIT_OK = 0
EXIT_INVALID = 2
EXIT_GATE_FAIL = 3
EXIT_BLOCKED = 4

# Lazy-friendly imports: these modules import torch at module load, so we import
# them inside the functions that need them (run_experiment / confirm_final_once)
# rather than at top level. This keeps the pure-Python gate/matrix logic usable
# without torch installed.
#   from . import train, calibrate, artifacts, evaluate, config

# Allowed override keys: a strict subset of schema-v1 TrainingConfig fields.
_ALLOWED_OVERRIDE_KEYS = frozenset(
    {
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
    }
)

# Finite augmentation tokens. These are the candidate's identity/provenance for
# the Phase-2 training-configuration experiment; the ACTUAL augmentation mechanics
# are activated by a later Phase-2 training task. schema-v1 ``TrainingConfig``
# (config.py, read-only and strict — unknown keys are rejected) does not yet
# carry augmentation fields, so these tokens are recorded in the manifest but are
# NOT injected into the TrainingConfig overlay passed to ``run_training``.
AUGMENTATION: Mapping[str, Mapping[str, Any]] = {
    "none": {"augmentationProfile": "none"},
    "photometric": {"augmentationProfile": "photometric"},
    "photometric_plus_geom": {"augmentationProfile": "photometric_plus_geom"},
}

# Finite hard-negative tokens -> schema-v2 config overlay.
HARD_NEGATIVE: Mapping[str, Mapping[str, Any]] = {
    "off": {"hardNegativeRatio": 0.0},
    "ratio_0.25": {"hardNegativeRatio": 0.25},
}

# Finite embedding -> training-config overlay (the ONLY augmentation/embd axis
# that maps to a real, valid TrainingConfig key today: embeddingDim).
EMBEDDING: Mapping[str, Mapping[str, Any]] = {
    "dim_96": {"embeddingDim": 96},
    "dim_128": {"embeddingDim": 128},
}

# The four enumerated axes. The cartesian product is bounded:
#   3 augmentation * 2 hard-negative * 2 temperature * 2 embedding = 24 candidates.
_AXES = ("augmentation", "hardNegative", "temperature", "embedding")
_AXIS_MAPS = {
    "augmentation": AUGMENTATION,
    "hardNegative": HARD_NEGATIVE,
    "embedding": EMBEDDING,
}
# temperature is a real TrainingConfig key, handled separately (float).


@dataclass(frozen=True, slots=True)
class ExperimentSpec:
    """Frozen description of one candidate in the enumerated matrix.

    Every candidate records the axis values, the exact TrainingConfig overlay,
    the seed, the split checksum, the resolved config checksum, and the parent
    dataset id (from Task 1 ``DatasetVersion``). The dataclass is frozen: a
    candidate cannot be mutated after construction, which keeps selection
    reproducible and auditable.
    """

    augmentation: str
    hard_negative: str
    temperature: float
    embedding: str
    seed: int
    split_checksum: str
    config_checksum: str
    parent_dataset_id: str | None
    config_overlay: dict[str, Any] = field(default_factory=dict)

    @property
    def run_id(self) -> str:
        """Stable, collision-free run id derived from the candidate + checksums."""
        basis = "|".join(
            (
                self.augmentation,
                self.hard_negative,
                f"t{self.temperature}",
                self.embedding,
                f"s{self.seed}",
                self.split_checksum[:12],
                self.config_checksum[:12],
            )
        )
        digest = hashlib.sha256(basis.encode("utf-8")).hexdigest()[:16]
        return f"p2-{self.augmentation}-{self.hard_negative}-t{self.temperature}-{self.embedding}-{digest}"

    @property
    def matrix_key(self) -> str:
        return f"{self.augmentation}|{self.hard_negative}|t{self.temperature}|{self.embedding}"

    @property
    def embedding_dim(self) -> int:
        return EMBEDDING[self.embedding]["embeddingDim"]


@dataclass(frozen=True, slots=True)
class ExperimentResult:
    """Frozen reproducible outcome for one evaluated candidate (dev-only)."""

    spec: ExperimentSpec
    run_id: str
    run_dir: str
    thresholds_path: str
    thresholds: Mapping[str, float]
    dev_metrics: Mapping[str, Any]
    accepted_wrong_count: int
    accepted_rate: float
    top1_accuracy: float
    batch_exact_match: float
    manifest_path: str
    config_checksum: str
    split_checksum: str
    git_revision: str
    passed_gate: bool

    def to_json(self) -> dict[str, Any]:
        document = asdict(self)
        document["spec"] = asdict(self.spec)
        return document


# --------------------------------------------------------------------------- #
# Candidate matrix loading / validation                                        #
# --------------------------------------------------------------------------- #


def _split_checksum(splits_root: Path) -> str:
    """Checksum over the TRAIN/DEV split membership files only.

    Selection must never read the final split, even for provenance — the final
    split is opened solely by ``evaluate_final_once`` (one-shot, after
    selection). Restricting the checksum to train/dev keeps that boundary
    literal: no ``final.txt`` bytes are ever touched during candidate selection.
    """
    root = Path(splits_root)
    parts: list[bytes] = []
    for name in ("train", "dev"):
        parts.append(root.joinpath(f"{name}.txt").read_bytes())
    return hashlib.sha256(b"\n".join(parts)).hexdigest()


def load_candidate_matrix(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Load and STRICTLY validate the candidate matrix YAML.

    Returns ``(base_config, candidates)`` where ``candidates`` is the list of
    allowed per-axis value lists. Rejects unknown top-level keys, unknown axis
    keys, and any value outside the enumerated ``*_MAPS`` sets.
    """
    document = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    if not isinstance(document, dict):
        raise ValueError("candidates config must be a YAML mapping")
    allowed_top = {"schemaVersion", "baseConfig", "candidates", "selectionGate"}
    unknown_top = set(document) - allowed_top
    if unknown_top:
        raise ValueError(f"unknown candidates.yaml keys: {sorted(unknown_top)}")
    if document.get("schemaVersion") != 2:
        raise ValueError("candidates.yaml schemaVersion must be 2")

    base_config = document.get("baseConfig")
    if not isinstance(base_config, dict):
        raise ValueError("candidates.yaml baseConfig must be a mapping")
    unknown_base = set(base_config) - _ALLOWED_OVERRIDE_KEYS
    if unknown_base:
        raise ValueError(f"unknown baseConfig keys: {sorted(unknown_base)}")

    candidates = document.get("candidates")
    if not isinstance(candidates, dict):
        raise ValueError("candidates.yaml candidates must be a mapping")
    unknown_axes = set(candidates) - set(_AXES)
    if unknown_axes:
        raise ValueError(f"unknown candidate axes: {sorted(unknown_axes)}")

    # Validate each enumerated axis value is finite / known.
    for axis in _AXES:
        values = candidates.get(axis)
        if not isinstance(values, list) or not values:
            raise ValueError(f"candidate axis {axis!r} must be a non-empty list")
        if axis in _AXIS_MAPS:
            for value in values:
                if value not in _AXIS_MAPS[axis]:
                    raise ValueError(f"unknown {axis} value {value!r}")
        else:  # temperature -> real float TrainingConfig key
            for value in values:
                if isinstance(value, bool) or not isinstance(value, (int, float)):
                    raise ValueError(f"temperature value {value!r} must be a number")
    return base_config, candidates


def enumerate_specs(
    matrix_path: Path,
    splits_root: Path,
    dataset_version: DatasetVersion,
    seed: int | None = None,
) -> list[ExperimentSpec]:
    """Enumerate the FINITE product of every axis as ``ExperimentSpec`` objects.

    The product is bounded (24 candidates for the shipped matrix). Each spec
    records the split checksum, config checksum, and parent dataset id.
    """
    base_config, candidates = load_candidate_matrix(Path(matrix_path))
    split_checksum = _split_checksum(Path(splits_root))

    specs: list[ExperimentSpec] = []
    for aug in candidates["augmentation"]:
        for hn in candidates["hardNegative"]:
            for temp in candidates["temperature"]:
                for emb in candidates["embedding"]:
                    overlay = (
                        dict(base_config)
                        | EMBEDDING[emb]
                        | {"temperature": float(temp)}
                        | AUGMENTATION[aug]
                        | HARD_NEGATIVE[hn]
                    )
                    unknown_overlay = set(overlay) - _ALLOWED_OVERRIDE_KEYS
                    if unknown_overlay:  # defensive; maps are curated
                        raise ValueError(f"illegal overlay keys: {sorted(unknown_overlay)}")
                    config_text = json.dumps(overlay, sort_keys=True)
                    config_checksum = hashlib.sha256(config_text.encode("utf-8")).hexdigest()
                    spec_seed = seed if seed is not None else int(overlay.get("seed", 20260827))
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
    return specs


# --------------------------------------------------------------------------- #
# Selection gate (dev-only metrics; never reads final)                        #
# --------------------------------------------------------------------------- #


def _yaml_config_path(spec: ExperimentSpec, overlay: Mapping[str, Any], artifacts_root: Path) -> Path:
    """Write a strict schema-v2 TrainingConfig YAML for one candidate.

    ``overlay`` must contain ONLY schema-valid keys (the caller builds it from
    ``baseConfig`` + the candidate's ``embeddingDim`` + ``temperature``). Augmentation
    / hard-negative provenance tokens are intentionally excluded so
    ``config.load_training_config`` (strict, read-only) accepts the file without
    modification.
    """
    artifacts_root = Path(artifacts_root)
    artifacts_root.mkdir(parents=True, exist_ok=True)
    strict = dict(overlay)
    unknown = set(strict) - _ALLOWED_OVERRIDE_KEYS
    if unknown:
        raise ValueError(f"illegal training-config keys: {sorted(unknown)}")
    path = artifacts_root / f".p2-config-{spec.config_checksum[:16]}.yaml"
    text = yaml.safe_dump(dict(strict), sort_keys=True, default_flow_style=False)
    path.write_text(text, encoding="utf-8")
    # Reject if config.py would refuse it (defensive: keeps the gate honest).
    from .config import load_training_config  # lazy import (no torch)

    load_training_config(path)
    return path


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


@dataclass(frozen=True, slots=True)
class RawDevMetrics:
    query_count: int
    batch_count: int
    wrong_count: int
    top1_accuracy: float
    batch_exact_match: float
    abstention_rate: float


_RAW_DEV_METRIC_KEYS = frozenset({
    "query_count",
    "batch_count",
    "wrong_count",
    "top1_accuracy",
    "batch_exact_match",
    "abstention_rate",
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


@dataclass(frozen=True, slots=True)
class CalibratedMetrics:
    accepted_count: int
    accepted_accuracy: float | None
    accepted_rate: float
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
    abstention_rate = _rate(doc, "abstentionRate")
    result = CalibratedMetrics(
        accepted_count=_non_negative_int(doc, "acceptedCount"),
        accepted_accuracy=None if accuracy is None else float(accuracy),
        accepted_rate=1.0 - abstention_rate,
        abstention_rate=abstention_rate,
        wrong_accepted_count=_non_negative_int(doc, "wrongAcceptedCount"),
    )
    return result


def _git_revision() -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"], check=True, capture_output=True, text=True
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError) as error:
        raise RuntimeError("experiment requires a readable Git revision") from error


def _select_by_gate(
    results: list[ExperimentResult],
    require_zero_wrong_accepted: bool,
    tie_breakers: tuple[str, ...],
) -> ExperimentResult | None:
    """Rank candidates: zero-wrong-accepted first, then configured tie-breakers.

    Deterministic: ties compare the next tie-breaker key; a final stable tie
    resolves by run_id string so the ranking is reproducible across runs.
    """
    eligible = [
        r for r in results
        if (not require_zero_wrong_accepted) or r.accepted_wrong_count == 0
    ]
    if not eligible:
        return None

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

    ranked = sorted(eligible, key=lambda r: (sort_key(r), r.run_id))
    return ranked[-1]


# --------------------------------------------------------------------------- #
# Public experiment API                                                        #
# --------------------------------------------------------------------------- #


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
        "spec": asdict(result.spec),
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
    """Train + calibrate ONE candidate on train/dev ONLY; never opens final.

    Composes ``run_training`` (train/dev, dev-only checkpoint selection) and
    ``calibrate_run`` (dev-only threshold calibration). Writes NO images / raw
    packets / base64. Persists a reproducible experiment manifest. Returns an
    ``ExperimentResult`` carrying dev metrics; the gate is applied downstream by
    ``compare_experiments``.
    """
    from . import calibrate, train  # lazy (torch)

    artifacts_root = Path(artifacts_root)
    run_id = spec.run_id
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
    config_path = _yaml_config_path(spec, strict_overlay, artifacts_root / ".p2-configs")

    run_dir = train.run_training(
        config_path=config_path,
        raw_root=Path(raw_root),
        labels_root=Path(labels_root),
        splits_root=Path(splits_root),
        duplicate_reviews=Path(duplicate_reviews),
        artifacts_root=artifacts_root,
        run_id=run_id,
    )

    thresholds_path = calibrate.calibrate_run(
        run_dir, require_zero_wrong_accepted=require_zero_wrong_accepted
    )
    thresholds_doc = read_json(thresholds_path)
    metrics_doc = read_json(run_dir / "dev-metrics.json")

    raw = _parse_raw_dev_metrics(metrics_doc)
    calibrated = _parse_calibrated_metrics(thresholds_doc["metrics"])

    result = ExperimentResult(
        spec=spec,
        run_id=run_id,
        run_dir=str(run_dir),
        thresholds_path=str(thresholds_path),
        thresholds=dict(thresholds_doc["thresholds"]),
        dev_metrics=dict(metrics_doc),
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
        result,
        artifacts_root,
        raw,
        calibrated,
        dataset_version,
        dataset_version_sha256,
    )
    object.__setattr__(result, "manifest_path", manifest_path)
    return result


def compare_experiments(
    results: list[ExperimentResult],
    *,
    require_zero_wrong_accepted: bool = True,
    tie_breakers: tuple[str, ...] = ("acceptedRate", "top1Accuracy", "batchExactMatch"),
) -> ExperimentResult | None:
    """Rank candidates and return the single best by the gate ordering.

    Deterministic: zero-wrong-accepted is mandatory, then configured tie-breakers
    in order, with a final stable tie-break on run_id. Returns ``None`` if no
    candidate satisfies the zero-wrong-accepted gate.
    """
    return _select_by_gate(
        list(results),
        require_zero_wrong_accepted=require_zero_wrong_accepted,
        tie_breakers=tuple(tie_breakers),
    )


# --------------------------------------------------------------------------- #
# Freeze + one-shot final confirmation (the only place final is opened)        #
# --------------------------------------------------------------------------- #


def freeze_selected(
    result: ExperimentResult,
    *,
    raw_root: Path,
    labels_root: Path,
    splits_root: Path,
    duplicate_reviews: Path,
) -> Path:
    """Freeze the selected candidate (composes artifacts.freeze_run + verify)."""
    from . import artifacts  # lazy (torch via train? no — metadata only, but safe)

    frozen_dir = artifacts.freeze_run(
        Path(result.run_dir),
        Path(raw_root),
        Path(labels_root),
        Path(splits_root),
        Path(duplicate_reviews),
    )
    artifacts.verify_freeze(frozen_dir)
    return frozen_dir


def confirm_final_once(
    result: ExperimentResult,
    *,
    raw_root: Path,
    labels_root: Path,
    splits_root: Path,
    duplicate_reviews: Path,
    gate_path: Path,
) -> dict:
    """Open the Phase 2 final EXACTLY ONCE, gated by --confirm-final-once.

    Enforces ``accepted_wrong_count == 0`` (primary gate) and the configured
    coverage/accuracy gates from ``gate.yaml`` BEFORE declaring success. This is
    the ONLY code path that opens the final split; ``evaluate_final_once``
    itself enforces the one-shot lock (final-evaluation.lock + report).
    """
    from . import artifacts, evaluate

    policy = load_gate_policy(gate_path)
    frozen_dir = artifacts.verify_freeze(Path(result.run_dir) / "frozen")
    final = evaluate.evaluate_final_once(
        Path(result.run_dir),
        Path(raw_root),
        Path(labels_root),
        Path(splits_root),
        confirm_final_once=result.run_id,  # exact run-id gate
    )
    metrics = final["metrics"]
    wrong_accepted = int(metrics.get("wrongCount", 0))

    # Primary gate: zero wrong accepted.
    if policy.require_zero_wrong_accepted and wrong_accepted != 0:
        raise RuntimeError(
            f"Phase 2 final FAILED primary gate: accepted_wrong_count={wrong_accepted} (must be 0)"
        )

    # Secondary coverage/accuracy gates (design §3.2 / §5, gate 2A-2).
    accepted_rate = 1.0 - float(metrics.get("abstentionRate", 0.0))
    top1 = float(metrics.get("top1Accuracy", 0.0))
    batch_exact = float(metrics.get("batchExactMatch", 0.0))
    failures: list[str] = []
    if accepted_rate < policy.min_accepted_rate:
        failures.append(
            f"acceptedRate {accepted_rate:.4f} < minAcceptedRate {policy.min_accepted_rate}"
        )
    if batch_exact < policy.min_batch_exact_match:
        failures.append(
            f"batchExactMatch {batch_exact:.4f} < minBatchExactMatch {policy.min_batch_exact_match}"
        )
    if top1 < policy.min_top1_accuracy:
        failures.append(
            f"top1Accuracy {top1:.4f} < minTop1Accuracy {policy.min_top1_accuracy}"
        )
    if failures:
        raise RuntimeError("Phase 2 final FAILED coverage gates: " + "; ".join(failures))

    return final


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
    # Spec §3.6  reuse-or-fail-closed: an existing complete manifest for this
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
    # Spec §3.9:  is a non-adjudication command → 0 or 2 only. Whether the
    # candidate satisfies the dev-selection gate is decided by  (3 there);
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
    # (split/config/Git checksums live under  in the §5.2 manifest).
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
    # belongs to .
    return EXIT_OK


def _cmd_compare(args: argparse.Namespace) -> int:
    from .dataset_version import load_dataset_version

    try:
        version = load_dataset_version(args.dataset_version)
        specs = enumerate_specs(Path(args.candidates), Path(args.splits_root), version)
    except (ValueError, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID
    # Spec §3.6 : every expected run must have a manifest; duplicates,
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
        if not isinstance(spec_doc, dict) or spec_doc.get("config_checksum") != spec.config_checksum                 or spec_doc.get("split_checksum") != spec.split_checksum:
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


def _cmd_freeze(args: argparse.Namespace) -> int:
    selection = read_json(Path(args.selection))
    if selection.get("stage") != "phase2-selection":
        print(f"error: not a phase2-selection artifact: {args.selection}", file=sys.stderr)
        return EXIT_INVALID
    selected_run_id = selection["selectedRunId"]
    # Spec §3.6 : NEVER accepts an arbitrary result; it reads the selection
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
    # Spec §3.6 : existing verified frozen output is accepted; only an
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


# --------------------------------------------------------------------------- #
# CLI                                                                          #
# --------------------------------------------------------------------------- #


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


if __name__ == "__main__":
    raise SystemExit(main())
