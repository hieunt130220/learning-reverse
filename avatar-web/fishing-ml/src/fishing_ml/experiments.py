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
import tempfile
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Mapping

import yaml

from .dataset_version import DatasetVersion
from .schema import atomic_write_json, read_json, sha256_file

# Lazy-friendly imports: these modules import torch at module load, so we import
# them inside the functions that need them (run_experiment / confirm_final_once)
# rather than at top level. This keeps the pure-Python gate/matrix logic usable
# without torch installed.
#   from . import train, calibrate, artifacts, evaluate, config

_GIT_HEX = re.compile(r"^[0-9a-f]{40}$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")

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
    }
)

# Finite augmentation tokens. These are the candidate's identity/provenance for
# the Phase-2 training-configuration experiment; the ACTUAL augmentation mechanics
# are activated by a later Phase-2 training task. schema-v1 ``TrainingConfig``
# (config.py, read-only and strict — unknown keys are rejected) does not yet
# carry augmentation fields, so these tokens are recorded in the manifest but are
# NOT injected into the TrainingConfig overlay passed to ``run_training``.
AUGMENTATION: Mapping[str, str] = {
    "none": "none",
    "photometric": "photometric",
    "photometric_plus_geom": "photometric_plus_geom",
}

# Finite hard-negative tokens. Same status as AUGMENTATION: recorded for
# provenance, not (yet) consumed by schema-v1 TrainingConfig.
HARD_NEGATIVE: Mapping[str, str] = {
    "off": "off",
    "ratio_0.25": "ratio_0.25",
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

# Tie-breaker name (as written in candidates.yaml) -> the camelCase key in the
# raw ``dev-metrics.json`` document that ``run_experiment`` stores in
# ``dev_metrics``. ``acceptedRate`` is derived from ``abstentionRate`` (inverted).
_TIE_BREAKER_METRIC_KEY = {
    "acceptedRate": "abstentionRate",
    "top1Accuracy": "top1Accuracy",
    "batchExactMatch": "batchExactMatch",
}
# Tie-breakers whose value must be inverted so that HIGHER is better.
_TIE_BREAKER_INVERT = frozenset({"acceptedRate"})


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


def _checksum_file(path: Path) -> str:
    return sha256_file(Path(path))


def _split_checksum(splits_root: Path) -> str:
    """Single checksum over the train/dev/final split membership files.

    Includes ALL three split files so the checksum captures the full split
    definition (provenance), even though final is never opened during selection.
    """
    root = Path(splits_root)
    parts: list[bytes] = []
    for name in ("train", "dev", "final"):
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
    if document.get("schemaVersion") != 1:
        raise ValueError("candidates.yaml schemaVersion must be 1")

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
                    # The TrainingConfig overlay contains ONLY schema-v1 keys
                    # (strict config.py rejects unknown keys). Augmentation and
                    # hard-negative tokens are recorded in ``config_overlay`` for
                    # provenance but never injected into the training config today.
                    overlay = (
                        dict(base_config)
                        | EMBEDDING[emb]
                        | {"temperature": float(temp)}
                    )
                    unknown_overlay = set(overlay) - _ALLOWED_OVERRIDE_KEYS
                    if unknown_overlay:  # defensive; maps are curated
                        raise ValueError(f"illegal overlay keys: {sorted(unknown_overlay)}")
                    config_text = json.dumps(overlay, sort_keys=True)
                    config_checksum = hashlib.sha256(config_text.encode("utf-8")).hexdigest()
                    spec_seed = seed if seed is not None else int(overlay.get("seed", 20260827))
                    provenance_overlay = dict(overlay) | {
                        "augmentation": AUGMENTATION[aug],
                        "hardNegative": HARD_NEGATIVE[hn],
                        "embedding": emb,
                    }
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
    """Write a strict schema-v1 TrainingConfig YAML for one candidate.

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
            metric_key = _TIE_BREAKER_METRIC_KEY.get(name)
            if metric_key is None:
                continue
            value = float(result.dev_metrics.get(metric_key, 0.0))  # type: ignore[arg-type]
            if name in _TIE_BREAKER_INVERT:
                # accepted rate := 1 - abstentionRate (higher is better)
                value = 1.0 - value
            keys.append(value)
        return tuple(keys)

    ranked = sorted(eligible, key=lambda r: (sort_key(r), r.run_id))
    return ranked[-1]


# --------------------------------------------------------------------------- #
# Public experiment API                                                        #
# --------------------------------------------------------------------------- #


def run_experiment(
    spec: ExperimentSpec,
    *,
    raw_root: Path,
    labels_root: Path,
    splits_root: Path,
    duplicate_reviews: Path,
    artifacts_root: Path,
    require_zero_wrong_accepted: bool = True,
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
    # The strict TrainingConfig overlay: only schema-v1 keys (baseConfig + the
    # candidate's embeddingDim + temperature). Augmentation / hard-negative tokens
    # are provenance only and are not sent to run_training.
    strict_overlay: dict[str, Any] = {
        "schemaVersion": 1,
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

    accepted_wrong = int(metrics_doc.get("wrongCount", 0))
    query_count = int(metrics_doc.get("queryCount", 0)) or 1
    abstention_rate = float(metrics_doc.get("abstentionRate", 0.0))
    top1 = float(metrics_doc.get("top1Accuracy", 0.0))
    batch_exact = float(metrics_doc.get("batchExactMatch", 0.0))

    result = ExperimentResult(
        spec=spec,
        run_id=run_id,
        run_dir=str(run_dir),
        thresholds_path=str(thresholds_path),
        thresholds=dict(thresholds_doc["thresholds"]),
        dev_metrics=dict(metrics_doc),
        accepted_wrong_count=accepted_wrong,
        accepted_rate=1.0 - abstention_rate,
        top1_accuracy=top1,
        batch_exact_match=batch_exact,
        manifest_path="",  # set after writing below
        config_checksum=spec.config_checksum,
        split_checksum=spec.split_checksum,
        git_revision=_git_revision(),
        passed_gate=(not require_zero_wrong_accepted) or accepted_wrong == 0,
    )
    manifest_path = _write_experiment_manifest(result, artifacts_root)
    object.__setattr__(result, "manifest_path", manifest_path)
    return result


def _write_experiment_manifest(result: ExperimentResult, artifacts_root: Path) -> str:
    artifacts_root = Path(artifacts_root)
    manifest_dir = artifacts_root / "phase2-experiments"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    path = manifest_dir / f"{result.run_id}.json"
    atomic_write_json(path, {
        "schemaVersion": 1,
        "stage": "train-dev-selection",
        "runId": result.run_id,
        "gitRevision": result.git_revision,
        "configChecksum": result.config_checksum,
        "splitChecksum": result.split_checksum,
        "spec": asdict(result.spec),
        "thresholds": dict(result.thresholds),
        "devMetrics": dict(result.dev_metrics),
        "acceptedWrongCount": result.accepted_wrong_count,
        "acceptedRate": result.accepted_rate,
        "top1Accuracy": result.top1_accuracy,
        "batchExactMatch": result.batch_exact_match,
        "passedGate": result.passed_gate,
        "thresholdsPath": result.thresholds_path,
        "runDir": result.run_dir,
    })
    return str(path)


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

    gate = load_gate(gate_path)
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
    if gate["gate"]["requireZeroWrongAccepted"] and wrong_accepted != 0:
        raise RuntimeError(
            f"Phase 2 final FAILED primary gate: accepted_wrong_count={wrong_accepted} (must be 0)"
        )

    # Secondary coverage/accuracy gates (design §3.2 / §5, gate 2A-2).
    coverage = gate["coverage"]
    accepted_rate = 1.0 - float(metrics.get("abstentionRate", 0.0))
    top1 = float(metrics.get("top1Accuracy", 0.0))
    batch_exact = float(metrics.get("batchExactMatch", 0.0))
    failures: list[str] = []
    if accepted_rate < float(coverage["minAcceptedRate"]):
        failures.append(
            f"acceptedRate {accepted_rate:.4f} < minAcceptedRate {coverage['minAcceptedRate']}"
        )
    if batch_exact < float(coverage["minBatchExactMatch"]):
        failures.append(
            f"batchExactMatch {batch_exact:.4f} < minBatchExactMatch {coverage['minBatchExactMatch']}"
        )
    if top1 < float(coverage["minTop1Accuracy"]):
        failures.append(
            f"top1Accuracy {top1:.4f} < minTop1Accuracy {coverage['minTop1Accuracy']}"
        )
    if failures:
        raise RuntimeError("Phase 2 final FAILED coverage gates: " + "; ".join(failures))

    return final


# --------------------------------------------------------------------------- #
# Gate / policy loading                                                        #
# --------------------------------------------------------------------------- #


def load_gate(path: Path) -> dict[str, Any]:
    """Load the explicit quality-gate document (read, never inferred from data)."""
    document = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    if not isinstance(document, dict):
        raise ValueError("gate config must be a YAML mapping")
    for key in ("coverage", "latency", "gate"):
        if key not in document:
            raise ValueError(f"gate config missing section: {key!r}")
    return document


# --------------------------------------------------------------------------- #
# CLI                                                                          #
# --------------------------------------------------------------------------- #


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    ls = sub.add_parser("list", help="Enumerate the finite candidate matrix and exit (no training).")
    ls.add_argument("--candidates", type=Path, required=True)
    ls.add_argument("--splits-root", type=Path, required=True)
    ls.add_argument("--dataset-version", type=Path, required=True)
    ls.add_argument("--parent-dataset-id", type=str, default=None)

    args = parser.parse_args(argv)

    if args.command == "list":
        version = DatasetVersion(1, "dry-run", args.parent_dataset_id, "2026-08-28T00:00:00Z", [])
        specs = enumerate_specs(args.candidates, args.splits_root, version)
        out = {
            "schemaVersion": 1,
            "count": len(specs),
            "axes": {
                "augmentation": 3, "hardNegative": 2, "temperature": 2, "embedding": 2,
            },
            "candidates": [
                {"runId": s.run_id, "matrixKey": s.matrix_key,
                 "configChecksum": s.config_checksum[:12], "splitChecksum": s.split_checksum[:12]}
                for s in specs
            ],
        }
        print(json.dumps(out, sort_keys=True, indent=2))
        return 0
    raise AssertionError("unreachable")


if __name__ == "__main__":
    raise SystemExit(main())
