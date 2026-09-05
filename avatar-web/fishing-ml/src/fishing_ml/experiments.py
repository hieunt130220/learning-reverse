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
import math
import re
import subprocess
import sys
from dataclasses import asdict, dataclass, field, replace
from pathlib import Path
from typing import Any, Mapping

import yaml

import os
from .dataset_version import DatasetVersion
from .provenance import revision_matches_recorded
from .schema import publish_no_replace, read_json, sha256_file

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
_SELECTION_TIE_BREAKERS = frozenset({"acceptedRate", "top1Accuracy", "batchExactMatch"})
_BASE_CONFIG_KEYS = frozenset(
    {
        "schemaVersion",
        "seed",
        "epochs",
        "learningRate",
        "weightDecay",
        "embeddingDim",
        "channels",
        "checkpointMetric",
        "device",
        "workers",
        "reproducibilityTolerance",
        "hardNegativeMargin",
    }
)
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_GIT_HEX = re.compile(r"^[0-9a-f]{40}$")
_SAFE_COMPONENT = re.compile(r"^[^/\\\s]+$")
_MAX_MANIFEST_TEXT = 4096
_MAX_MANIFEST_KEYS = 64
_MAX_METRIC_RATE_ERROR = 1e-12
_MAX_METRIC_COUNT = 2**53 - 1


@dataclass(frozen=True, slots=True)
class SelectionGate:
    require_zero_wrong_accepted: bool
    tie_breakers: tuple[str, ...]


def _parse_selection_gate(document: Mapping[str, Any]) -> SelectionGate:
    raw = document.get("selectionGate")
    if not isinstance(raw, Mapping) or set(raw) != {"requireZeroWrongAccepted", "tieBreakers"}:
        raise ValueError("candidates.yaml selectionGate fields mismatch")
    require_zero = raw["requireZeroWrongAccepted"]
    if not isinstance(require_zero, bool):
        raise ValueError("selectionGate.requireZeroWrongAccepted must be a boolean")
    tie_breakers = raw["tieBreakers"]
    if (
        not isinstance(tie_breakers, list)
        or not tie_breakers
        or len(tie_breakers) > len(_SELECTION_TIE_BREAKERS)
        or any(
            not isinstance(name, str) or name not in _SELECTION_TIE_BREAKERS
            for name in tie_breakers
        )
        or len(set(tie_breakers)) != len(tie_breakers)
    ):
        raise ValueError(
            "selectionGate.tieBreakers must be a non-empty list of unique metric names"
        )
    return SelectionGate(require_zero, tuple(tie_breakers))


def load_selection_gate(path: Path) -> SelectionGate:
    """Load the candidate-selection policy without silently choosing defaults."""
    try:
        document = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as error:
        raise ValueError(f"cannot read candidates config: {error}") from error
    if not isinstance(document, Mapping):
        raise ValueError("candidates config must be a YAML mapping")
    return _parse_selection_gate(document)


@dataclass(frozen=True, slots=True)
class ExperimentSpec:
    """Frozen description of one candidate in the enumerated matrix."""

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


def _exact_dict(value: object, expected: set[str], name: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != expected:
        raise ValueError(f"{name} fields mismatch")
    return value


def _manifest_text(value: object, name: str, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str) or len(value) > _MAX_MANIFEST_TEXT:
        raise ValueError(f"{name} must be bounded text")
    if not allow_empty and not value:
        raise ValueError(f"{name} must be non-empty text")
    if any(ord(character) < 0x20 or ord(character) == 0x7F for character in value):
        raise ValueError(f"{name} contains a control character")
    if any(0xD800 <= ord(character) <= 0xDFFF for character in value):
        raise ValueError(f"{name} contains invalid Unicode")
    return value


def _manifest_non_negative_int(value: object, name: str) -> int:
    if (
        isinstance(value, bool)
        or not isinstance(value, int)
        or value < 0
        or value > _MAX_METRIC_COUNT
    ):
        raise ValueError(f"{name} must be a bounded non-negative integer")
    return value


def _manifest_rate(value: object, name: str, *, allow_none: bool = False) -> float | None:
    if value is None and allow_none:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be a finite rate")
    result = float(value)
    if not math.isfinite(result) or not 0.0 <= result <= 1.0:
        raise ValueError(f"{name} must be a finite rate in [0, 1]")
    return result


def _manifest_sha256(value: object, name: str) -> str:
    if not isinstance(value, str) or _HEX64.fullmatch(value) is None:
        raise ValueError(f"{name} must be a lowercase SHA-256")
    return value


def _manifest_git_revision(value: object, name: str = "gitRevision") -> str:
    if not isinstance(value, str) or _GIT_HEX.fullmatch(value) is None:
        raise ValueError(f"{name} must be a 40-character lowercase Git revision")
    return value


def _manifest_safe_component(value: object, name: str) -> str:
    result = _manifest_text(value, name)
    if result in {".", ".."} or _SAFE_COMPONENT.fullmatch(result) is None:
        raise ValueError(f"{name} must be one safe path component")
    return result


def _parse_manifest_thresholds(value: object) -> dict[str, float]:
    raw = _exact_dict(value, {"minSimilarity", "minMargin"}, "manifest thresholds")
    min_similarity = raw["minSimilarity"]
    if isinstance(min_similarity, bool) or not isinstance(min_similarity, (int, float)):
        raise ValueError("thresholds.minSimilarity must be a finite number")
    min_similarity = float(min_similarity)
    if not math.isfinite(min_similarity):
        raise ValueError("thresholds.minSimilarity must be a finite number")
    min_margin = raw["minMargin"]
    if isinstance(min_margin, bool) or not isinstance(min_margin, (int, float)):
        raise ValueError("thresholds.minMargin must be a finite non-negative number")
    min_margin = float(min_margin)
    if not math.isfinite(min_margin) or min_margin < 0.0:
        raise ValueError("thresholds.minMargin must be a finite non-negative number")
    return {"minSimilarity": min_similarity, "minMargin": min_margin}


def _parse_effective_config(value: object) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError("manifest effectiveConfig must be a mapping")
    config = dict(value)
    if set(config) != _ALLOWED_OVERRIDE_KEYS:
        missing = sorted(_ALLOWED_OVERRIDE_KEYS - set(config))
        unknown = sorted(set(config) - _ALLOWED_OVERRIDE_KEYS)
        raise ValueError(f"manifest effectiveConfig fields mismatch (missing={missing}, unknown={unknown})")
    from .config import config_to_document, load_training_config_from_document
    parsed = load_training_config_from_document(config)
    canonical = config_to_document(parsed)
    if canonical != config:
        raise ValueError("manifest effectiveConfig is not canonical")
    return config


def _validate_metric_consistency(raw: RawDevMetrics, calibrated: CalibratedMetrics) -> None:
    if raw.query_count <= 0 or raw.batch_count <= 0:
        raise ValueError("manifest raw metrics must contain positive query and batch counts")
    if raw.wrong_count > raw.query_count:
        raise ValueError("manifest raw wrong count exceeds query count")
    if calibrated.accepted_count > raw.query_count:
        raise ValueError("manifest accepted count exceeds raw query count")
    if calibrated.wrong_accepted_count > calibrated.accepted_count:
        raise ValueError("manifest wrong accepted count exceeds accepted count")
    if calibrated.wrong_accepted_count > raw.wrong_count:
        raise ValueError("manifest wrong accepted count exceeds raw wrong count")
    expected_accepted_rate = calibrated.accepted_count / raw.query_count
    if abs(calibrated.accepted_rate - expected_accepted_rate) > _MAX_METRIC_RATE_ERROR:
        raise ValueError("manifest calibrated accepted rate is inconsistent")
    if abs((1.0 - calibrated.abstention_rate) - calibrated.accepted_rate) > _MAX_METRIC_RATE_ERROR:
        raise ValueError("manifest calibrated abstention rate is inconsistent")
    if abs(raw.top1_accuracy - (1.0 - (raw.wrong_count / raw.query_count))) > _MAX_METRIC_RATE_ERROR:
        raise ValueError("manifest raw top1 accuracy is inconsistent")
    if raw.batch_exact_match > 1.0:
        raise ValueError("manifest raw batch exact match is invalid")
    if calibrated.accepted_accuracy is not None:
        accepted_accuracy = calibrated.accepted_accuracy
        if calibrated.accepted_count == 0:
            raise ValueError("manifest accepted accuracy must be null when accepted count is zero")
        expected_accepted_accuracy = (
            calibrated.accepted_count - calibrated.wrong_accepted_count
        ) / calibrated.accepted_count
        if abs(accepted_accuracy - expected_accepted_accuracy) > _MAX_METRIC_RATE_ERROR:
            raise ValueError("manifest calibrated accepted accuracy is inconsistent")
    elif calibrated.accepted_count != 0:
        raise ValueError("manifest accepted accuracy is required when accepted count is positive")


def _validate_manifest_shape(doc: Mapping[str, Any]) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, float], dict[str, Any]]:
    expected = {
        "schemaVersion", "stage", "runId", "matrixKey", "spec", "runDir",
        "thresholdsPath", "provenance", "effectiveConfig", "thresholds",
        "rawDevMetrics", "calibratedMetrics", "devSelectionPassed",
    }
    if set(doc) != expected:
        raise ValueError("candidate manifest fields mismatch")
    if doc["schemaVersion"] != 2 or doc["stage"] != "train-dev-selection":
        raise ValueError("candidate manifest metadata is invalid")
    _manifest_text(doc["runId"], "manifest runId")
    _manifest_text(doc["matrixKey"], "manifest matrixKey")
    run_dir = _manifest_text(doc["runDir"], "manifest runDir")
    thresholds_path = _manifest_text(doc["thresholdsPath"], "manifest thresholdsPath")
    spec_doc = _exact_dict(
        doc["spec"],
        {
            "augmentation", "hard_negative", "temperature", "embedding", "seed",
            "split_checksum", "config_checksum", "parent_dataset_id", "config_overlay",
        },
        "manifest spec",
    )
    _manifest_safe_component(spec_doc["augmentation"], "spec augmentation")
    _manifest_safe_component(spec_doc["hard_negative"], "spec hard_negative")
    _manifest_safe_component(spec_doc["embedding"], "spec embedding")
    temperature = spec_doc["temperature"]
    if isinstance(temperature, bool) or not isinstance(temperature, (int, float)) or not math.isfinite(float(temperature)) or float(temperature) <= 0:
        raise ValueError("spec temperature must be a finite positive number")
    _manifest_non_negative_int(spec_doc["seed"], "spec seed")
    _manifest_sha256(spec_doc["split_checksum"], "spec split_checksum")
    _manifest_sha256(spec_doc["config_checksum"], "spec config_checksum")
    parent = spec_doc["parent_dataset_id"]
    if parent is not None:
        _manifest_safe_component(parent, "spec parent_dataset_id")
    overlay = _parse_effective_config(spec_doc["config_overlay"])
    provenance = _exact_dict(
        doc["provenance"],
        {
            "datasetId", "parentDatasetId", "datasetVersionSha256", "splitSha256",
            "configSha256", "gitRevision",
        },
        "manifest provenance",
    )
    _manifest_safe_component(provenance["datasetId"], "provenance datasetId")
    if provenance["parentDatasetId"] is not None:
        _manifest_safe_component(provenance["parentDatasetId"], "provenance parentDatasetId")
    _manifest_sha256(provenance["datasetVersionSha256"], "provenance datasetVersionSha256")
    _manifest_sha256(provenance["splitSha256"], "provenance splitSha256")
    _manifest_sha256(provenance["configSha256"], "provenance configSha256")
    _manifest_git_revision(provenance["gitRevision"], "provenance gitRevision")
    thresholds = _parse_manifest_thresholds(doc["thresholds"])
    raw_doc = _exact_dict(
        doc["rawDevMetrics"],
        {"queryCount", "batchCount", "wrongCount", "top1Accuracy", "batchExactMatch", "abstentionRate"},
        "manifest rawDevMetrics",
    )
    calibrated_doc = _exact_dict(
        doc["calibratedMetrics"],
        {"acceptedCount", "acceptedAccuracy", "acceptedRate", "abstentionRate", "wrongAcceptedCount"},
        "manifest calibratedMetrics",
    )
    raw = _parse_raw_dev_metrics({
        "schemaVersion": 1,
        "query_count": raw_doc["queryCount"], "batch_count": raw_doc["batchCount"],
        "wrong_count": raw_doc["wrongCount"], "top1_accuracy": raw_doc["top1Accuracy"],
        "batch_exact_match": raw_doc["batchExactMatch"], "abstention_rate": raw_doc["abstentionRate"],
    })
    calibrated = _parse_calibrated_metrics({
        "acceptedCount": calibrated_doc["acceptedCount"],
        "acceptedAccuracy": calibrated_doc["acceptedAccuracy"],
        "abstentionRate": calibrated_doc["abstentionRate"],
        "wrongAcceptedCount": calibrated_doc["wrongAcceptedCount"],
    })
    manifest_accepted_rate = _manifest_rate(
        calibrated_doc["acceptedRate"], "calibratedMetrics.acceptedRate"
    )
    if abs(manifest_accepted_rate - calibrated.accepted_rate) > _MAX_METRIC_RATE_ERROR:
        raise ValueError("manifest calibrated accepted rate is inconsistent")
    _validate_metric_consistency(raw, calibrated)
    if not isinstance(doc["devSelectionPassed"], bool):
        raise ValueError("manifest devSelectionPassed must be a boolean")
    return (
        spec_doc, raw_doc, calibrated_doc, thresholds,
        {"runDir": run_dir, "thresholdsPath": thresholds_path, "provenance": provenance,
         "effectiveConfig": overlay, "raw": raw, "calibrated": calibrated},
    )


def _result_from_manifest(doc: dict[str, Any], manifest_path: str = "") -> ExperimentResult:
    """Rebuild and strictly validate a frozen ExperimentResult manifest."""
    if not isinstance(doc, dict):
        raise ValueError("candidate manifest must be a mapping")
    spec_doc, raw_doc, calibrated_doc, thresholds, parsed = _validate_manifest_shape(doc)
    provenance = parsed["provenance"]
    spec = ExperimentSpec(
        augmentation=spec_doc["augmentation"],
        hard_negative=spec_doc["hard_negative"],
        temperature=float(spec_doc["temperature"]),
        embedding=spec_doc["embedding"],
        seed=spec_doc["seed"],
        split_checksum=spec_doc["split_checksum"],
        config_checksum=spec_doc["config_checksum"],
        parent_dataset_id=spec_doc["parent_dataset_id"],
        config_overlay=dict(parsed["effectiveConfig"]),
    )
    if doc["runId"] != spec.run_id or doc["matrixKey"] != spec.matrix_key:
        raise ValueError("candidate manifest identity does not match spec")
    if spec.config_checksum != provenance["configSha256"] or spec.split_checksum != provenance["splitSha256"]:
        raise ValueError("candidate manifest provenance does not match spec")
    if spec.config_overlay != doc["effectiveConfig"]:
        raise ValueError("candidate manifest effectiveConfig does not match spec")
    raw = parsed["raw"]
    calibrated = parsed["calibrated"]
    return ExperimentResult(
        spec=spec,
        run_id=doc["runId"],
        run_dir=parsed["runDir"],
        thresholds_path=parsed["thresholdsPath"],
        thresholds=thresholds,
        dev_metrics={
            "schemaVersion": 1,
            "query_count": raw.query_count, "batch_count": raw.batch_count,
            "wrong_count": raw.wrong_count, "top1_accuracy": raw.top1_accuracy,
            "batch_exact_match": raw.batch_exact_match, "abstention_rate": raw.abstention_rate,
        },
        accepted_wrong_count=calibrated.wrong_accepted_count,
        accepted_rate=calibrated.accepted_rate,
        top1_accuracy=raw.top1_accuracy,
        batch_exact_match=raw.batch_exact_match,
        manifest_path=manifest_path,
        config_checksum=provenance["configSha256"],
        split_checksum=provenance["splitSha256"],
        git_revision=provenance["gitRevision"],
        passed_gate=doc["devSelectionPassed"],
    )


def _validate_relocated_run_paths(
    result: ExperimentResult,
    *,
    artifacts_root: Path,
    run_id: str,
) -> tuple[Path, Path]:
    """Validate archived and operational paths share the exact artifacts/run suffix."""
    _manifest_safe_component(run_id, "relocated run ID")
    archived_run = Path(result.run_dir)
    archived_thresholds = Path(result.thresholds_path)
    if (
        not archived_run.is_absolute()
        or not archived_thresholds.is_absolute()
        or ".." in archived_run.parts
        or ".." in archived_thresholds.parts
        or archived_run.name != run_id
        or archived_run.parent.name != "artifacts"
        or archived_thresholds != archived_run / "thresholds.json"
    ):
        raise ValueError("candidate manifest has invalid archived run paths")

    root = Path(artifacts_root)
    if not root.is_absolute() or ".." in root.parts:
        raise ValueError("artifacts root must be an absolute path without traversal")
    run_dir = root / run_id
    thresholds = run_dir / "thresholds.json"
    manifest = root / "phase2-experiments" / f"{run_id}.json"
    # Require callers to supply a physical absolute root, including OS aliases.
    # A regular leaf beneath a symlink is not a trusted operational path.
    if any(parent.is_symlink() for parent in (root, *root.parents)) or not root.is_dir():
        raise ValueError("artifacts root must be a regular directory")
    resolved_root = root.resolve()
    for path in (run_dir, thresholds, manifest):
        relative = path.relative_to(root)
        current = root
        for component in relative.parts:
            current = current / component
            if current.is_symlink():
                raise ValueError("candidate operational paths must not contain symlinks")
        if path.resolve() != resolved_root / relative:
            raise ValueError("candidate operational path escapes artifacts root")
    if not run_dir.is_dir() or not thresholds.is_file() or not manifest.is_file():
        raise ValueError("candidate operational run, thresholds or manifest is missing")
    actual_manifest = Path(result.manifest_path)
    if actual_manifest.is_symlink() or actual_manifest.resolve() != manifest.resolve():
        raise ValueError("candidate manifest is not at its canonical current location")
    checkpoints = run_dir / "checkpoints"
    if checkpoints.is_symlink():
        raise ValueError("candidate checkpoints directory must not be a symlink")
    return run_dir.resolve(), thresholds.resolve()


def _validate_selection_document(
    document: object,
    *,
    selected: ExperimentResult | None = None,
    manifest_path: Path | None = None,
    dataset_version_path: Path | None = None,
    version: DatasetVersion | None = None,
    git_revision: str | None = None,
) -> dict[str, Any]:
    """Strictly validate a selection artifact and optional current provenance."""
    if not isinstance(document, dict):
        raise ValueError("selection artifact must be a mapping")
    expected = {
        "schemaVersion", "stage", "selectedRunId", "selectedMatrixKey",
        "candidateManifestSha256", "provenance", "policy",
    }
    if set(document) != expected:
        raise ValueError("selection artifact fields mismatch")
    if isinstance(document["schemaVersion"], bool) or document["schemaVersion"] != 1:
        raise ValueError("selection artifact schemaVersion must be 1")
    if document["stage"] != "phase2-selection":
        raise ValueError("selection artifact stage is invalid")

    run_id = _manifest_safe_component(document["selectedRunId"], "selection selectedRunId")
    matrix_key = _manifest_text(document["selectedMatrixKey"], "selection selectedMatrixKey")
    manifest_sha = _manifest_sha256(
        document["candidateManifestSha256"], "selection candidateManifestSha256"
    )
    provenance = _exact_dict(
        document["provenance"],
        {
            "datasetId", "parentDatasetId", "datasetVersionSha256", "splitSha256",
            "configSha256", "gitRevision",
        },
        "selection provenance",
    )
    _manifest_safe_component(provenance["datasetId"], "selection datasetId")
    if provenance["parentDatasetId"] is not None:
        _manifest_safe_component(provenance["parentDatasetId"], "selection parentDatasetId")
    for name in ("datasetVersionSha256", "splitSha256", "configSha256"):
        _manifest_sha256(provenance[name], f"selection {name}")
    _manifest_git_revision(provenance["gitRevision"], "selection gitRevision")

    policy = _exact_dict(
        document["policy"],
        {"requireZeroWrongAccepted", "tieBreakers"},
        "selection policy",
    )
    if not isinstance(policy["requireZeroWrongAccepted"], bool):
        raise ValueError("selection policy gate must be boolean")
    tie_breakers = policy["tieBreakers"]
    if (
        not isinstance(tie_breakers, list)
        or not tie_breakers
        or len(tie_breakers) != len(set(tie_breakers))
        or any(not isinstance(name, str) for name in tie_breakers)
        or any(name not in _SELECTION_TIE_BREAKERS and name != "runId" for name in tie_breakers)
        or tie_breakers[-1] != "runId"
    ):
        raise ValueError("selection policy tieBreakers must end with runId and contain unique known names")

    if selected is not None:
        if run_id != selected.run_id or matrix_key != selected.spec.matrix_key:
            raise ValueError("selection identity does not match selected candidate")
        if manifest_path is None or dataset_version_path is None or version is None or git_revision is None:
            raise ValueError("selection validation requires provenance inputs")
        if not manifest_path.is_file() or hashlib.sha256(manifest_path.read_bytes()).hexdigest() != manifest_sha:
            raise ValueError("selection candidate manifest checksum mismatch")
        if provenance["datasetId"] != version.dataset_id or provenance["parentDatasetId"] != version.parent_dataset_id:
            raise ValueError("selection dataset provenance mismatch")
        if provenance["datasetVersionSha256"] != sha256_file(dataset_version_path):
            raise ValueError("selection dataset-version checksum mismatch")
        if (
            provenance["splitSha256"] != selected.split_checksum
            or provenance["configSha256"] != selected.config_checksum
            or provenance["gitRevision"] != selected.git_revision
            or not revision_matches_recorded(git_revision, provenance["gitRevision"])
        ):
            raise ValueError("selection candidate provenance mismatch")
    return document


def _validate_selection_for_spec(
    document: object,
    *,
    selected: ExperimentResult,
    manifest_path: Path,
    dataset_version_path: Path,
    version: DatasetVersion,
) -> dict[str, Any]:
    """Validate a selection artifact against the current selected manifest/spec."""
    return _validate_selection_document(
        document,
        selected=selected,
        manifest_path=manifest_path,
        dataset_version_path=dataset_version_path,
        version=version,
        git_revision=_git_revision(),
    )


def _resolve_selected_result(
    selection_path: Path,
    artifacts_root: Path,
    dataset_version_path: Path,
    splits_root: Path,
    candidates_path: Path,
) -> tuple[dict[str, Any], ExperimentResult, ExperimentSpec, DatasetVersion, Path]:
    """Resolve and verify the selected candidate from immutable artifacts."""
    from .dataset_version import load_dataset_version

    selection = read_json(selection_path)
    version = load_dataset_version(dataset_version_path)
    selection_gate = _selection_gate_from_candidates(candidates_path)
    specs = enumerate_specs(candidates_path, splits_root, version)
    selected_run_id = _manifest_safe_component(
        selection.get("selectedRunId") if isinstance(selection, dict) else None,
        "selection selectedRunId",
    )
    matches = [spec for spec in specs if spec.run_id == selected_run_id]
    if len(matches) != 1:
        raise ValueError("selection does not resolve to exactly one enumerated candidate")
    spec = matches[0]
    manifest_path = Path(artifacts_root) / "phase2-experiments" / f"{selected_run_id}.json"
    if manifest_path.is_symlink() or not manifest_path.is_file():
        raise ValueError("selected candidate manifest is missing or not regular")
    result = _result_from_manifest(read_json(manifest_path), str(manifest_path))
    _validate_candidate_against_spec(result, spec)
    _validate_manifest_current_provenance(
        result,
        document=read_json(manifest_path),
        spec=spec,
        dataset_version=version,
        dataset_version_path=dataset_version_path,
        splits_root=splits_root,
        artifacts_root=artifacts_root,
    )
    run_dir, thresholds = _validate_relocated_run_paths(
        result, artifacts_root=artifacts_root, run_id=spec.run_id
    )
    result = replace(result, run_dir=str(run_dir), thresholds_path=str(thresholds))
    _validate_selection_for_spec(
        selection,
        selected=result,
        manifest_path=manifest_path,
        dataset_version_path=dataset_version_path,
        version=version,
    )
    _validate_selection_current(
        selection,
        selected=result,
        manifest_path=manifest_path,
        dataset_version=version,
        dataset_version_path=dataset_version_path,
        selection_gate=selection_gate,
    )
    _validate_run_outputs(result, spec=spec)
    return selection, result, spec, version, manifest_path


def _validate_manifest_current_provenance(
    result: ExperimentResult,
    *,
    document: Mapping[str, Any],
    spec: ExperimentSpec,
    dataset_version: DatasetVersion,
    dataset_version_path: Path,
    splits_root: Path,
    artifacts_root: Path,
) -> None:
    """Require a candidate manifest to describe the current immutable inputs."""
    _validate_candidate_against_spec(result, spec)
    provenance = document.get("provenance")
    if not isinstance(provenance, Mapping):
        raise ValueError("candidate manifest provenance is missing")
    if provenance.get("datasetId") != dataset_version.dataset_id:
        raise ValueError("candidate manifest dataset ID does not match current dataset")
    if provenance.get("parentDatasetId") != dataset_version.parent_dataset_id:
        raise ValueError("candidate manifest parent dataset ID does not match current dataset")
    if provenance.get("datasetVersionSha256") != sha256_file(dataset_version_path):
        raise ValueError("candidate manifest dataset-version checksum does not match current file")
    if provenance.get("splitSha256") != _split_checksum(splits_root):
        raise ValueError("candidate manifest split checksum does not match current train/dev splits")
    if provenance.get("configSha256") != spec.config_checksum:
        raise ValueError("candidate manifest config checksum does not match enumerated spec")
    if not revision_matches_recorded(_git_revision(), provenance.get("gitRevision")):
        raise ValueError("candidate manifest Git revision does not match current revision")

    _validate_relocated_run_paths(result, artifacts_root=artifacts_root, run_id=spec.run_id)


def _current_candidate_result(
    manifest_path: Path,
    spec: ExperimentSpec,
    *,
    dataset_version: DatasetVersion,
    dataset_version_path: Path,
    splits_root: Path,
    artifacts_root: Path,
) -> ExperimentResult:
    """Read one candidate manifest and validate its complete current provenance."""
    if manifest_path.is_symlink() or not manifest_path.is_file():
        raise ValueError("candidate manifest must be a regular file")
    document = read_json(manifest_path)
    if not isinstance(document, dict):
        raise ValueError("candidate manifest must be a mapping")
    result = _result_from_manifest(document, str(manifest_path))
    _validate_manifest_current_provenance(
        result,
        document=document,
        spec=spec,
        dataset_version=dataset_version,
        dataset_version_path=dataset_version_path,
        splits_root=splits_root,
        artifacts_root=artifacts_root,
    )
    run_dir, thresholds = _validate_relocated_run_paths(
        result, artifacts_root=artifacts_root, run_id=spec.run_id
    )
    return replace(result, run_dir=str(run_dir), thresholds_path=str(thresholds))


def _validate_selection_current(
    selection: object,
    *,
    selected: ExperimentResult,
    manifest_path: Path,
    dataset_version: DatasetVersion,
    dataset_version_path: Path,
    selection_gate: SelectionGate,
) -> None:
    """Validate a selection against its manifest, policy, and current provenance."""
    _validate_selection_document(
        selection,
        selected=selected,
        manifest_path=manifest_path,
        dataset_version_path=dataset_version_path,
        version=dataset_version,
        git_revision=_git_revision(),
    )
    if not isinstance(selection, Mapping):
        raise ValueError("selection artifact must be a mapping")
    policy = selection["policy"]
    if not isinstance(policy, Mapping):
        raise ValueError("selection policy must be a mapping")
    expected_tie_breakers = [*selection_gate.tie_breakers, "runId"]
    if policy["requireZeroWrongAccepted"] != selection_gate.require_zero_wrong_accepted:
        raise ValueError("selection policy does not match candidates.yaml")
    if policy["tieBreakers"] != expected_tie_breakers:
        raise ValueError("selection tie-breakers do not match candidates.yaml")
    if selection_gate.require_zero_wrong_accepted is not True:
        raise ValueError("candidates.yaml cannot weaken zero-wrong-accepted")


def _resolve_selected_result_from_args(
    args: argparse.Namespace,
) -> tuple[dict[str, Any], ExperimentResult, ExperimentSpec, DatasetVersion, Path]:
    """Resolve selected candidate using the CLI's explicit candidate inputs."""
    return _resolve_selected_result(
        Path(args.selection),
        Path(args.artifacts_root),
        Path(args.dataset_version),
        Path(args.splits_root),
        Path(args.candidates),
    )


def _validate_run_outputs(result: ExperimentResult, *, spec: ExperimentSpec) -> None:
    """Require the train/calibration outputs represented by a manifest."""
    run_dir = Path(result.run_dir)
    if run_dir.is_symlink() or not run_dir.is_absolute() or not run_dir.is_dir():
        raise ValueError("candidate manifest references a missing run directory")
    for required in (
        "model-config.json",
        "normalization.json",
        "dev-predictions.json",
        "dev-metrics.json",
        "thresholds.json",
        "training-history.json",
        "environment.json",
        "checkpoints/best-dev.pt",
    ):
        required_path = run_dir / required
        if required_path.is_symlink() or not required_path.is_file():
            raise ValueError(f"existing run is missing or non-regular {required}")
    environment = read_json(run_dir / "environment.json")
    if not isinstance(environment, Mapping) or environment.get("gitRevision") != result.git_revision:
        raise ValueError("existing run environment Git revision does not match manifest")
    checkpoint_sha = environment.get("checkpointSha256")
    if checkpoint_sha != sha256_file(run_dir / "checkpoints" / "best-dev.pt"):
        raise ValueError("existing run checkpoint checksum does not match environment")
    from .config import config_to_document, load_training_config_from_document

    config_doc = read_json(run_dir / "model-config.json")
    if not isinstance(config_doc, Mapping):
        raise ValueError("existing run model-config.json is not a mapping")
    parsed = load_training_config_from_document(config_doc)
    if config_to_document(parsed) != spec.config_overlay:
        raise ValueError("existing run model configuration does not match enumerated spec")
    thresholds_doc = read_json(run_dir / "thresholds.json")
    if not isinstance(thresholds_doc, Mapping):
        raise ValueError("existing thresholds.json is not a mapping")
    if _parse_manifest_thresholds(thresholds_doc.get("thresholds")) != dict(result.thresholds):
        raise ValueError("existing thresholds do not match candidate manifest")
    raw = _parse_raw_dev_metrics(read_json(run_dir / "dev-metrics.json"))
    if (
        raw.top1_accuracy != result.top1_accuracy
        or raw.batch_exact_match != result.batch_exact_match
    ):
        raise ValueError("existing development metrics do not match candidate manifest")
    calibrated_doc = thresholds_doc.get("metrics")
    if not isinstance(calibrated_doc, dict):
        raise ValueError("existing thresholds metrics are missing")
    calibrated = _parse_calibrated_metrics(calibrated_doc)
    if (
        calibrated.wrong_accepted_count != result.accepted_wrong_count
        or abs(calibrated.accepted_rate - result.accepted_rate) > _MAX_METRIC_RATE_ERROR
    ):
        raise ValueError("existing calibrated metrics do not match candidate manifest")


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
    """Load and strictly validate the finite candidate matrix YAML."""
    try:
        document = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as error:
        raise ValueError(f"cannot read candidates config: {error}") from error
    if not isinstance(document, dict):
        raise ValueError("candidates config must be a YAML mapping")
    if set(document) != {"schemaVersion", "baseConfig", "candidates", "selectionGate"}:
        raise ValueError("candidates config fields mismatch")
    if isinstance(document["schemaVersion"], bool) or document["schemaVersion"] != 2:
        raise ValueError("candidates.yaml schemaVersion must be 2")

    base_config = document["baseConfig"]
    if not isinstance(base_config, dict):
        raise ValueError("candidates.yaml baseConfig must be a mapping")
    if set(base_config) != _BASE_CONFIG_KEYS:
        missing = sorted(_BASE_CONFIG_KEYS - set(base_config))
        unknown = sorted(set(base_config) - _BASE_CONFIG_KEYS)
        details = []
        if missing:
            details.append(f"missing baseConfig keys: {missing}")
        if unknown:
            details.append(f"unknown baseConfig keys: {unknown}")
        raise ValueError("invalid candidates.yaml baseConfig (" + "; ".join(details) + ")")
    if isinstance(base_config["schemaVersion"], bool) or base_config["schemaVersion"] != 2:
        raise ValueError("candidates.yaml baseConfig.schemaVersion must be 2")

    candidates = document["candidates"]
    if not isinstance(candidates, dict) or set(candidates) != set(_AXES):
        raise ValueError("candidates.yaml candidates axes mismatch")
    for axis in _AXES:
        values = candidates[axis]
        if not isinstance(values, list) or not values:
            raise ValueError(f"candidate axis {axis!r} must be a non-empty list")
        if len(values) != len(set(values)):
            raise ValueError(f"candidate axis {axis!r} contains duplicates")
        if axis in _AXIS_MAPS:
            for value in values:
                if not isinstance(value, str) or value not in _AXIS_MAPS[axis]:
                    raise ValueError(f"unknown {axis} value {value!r}")
        else:
            for value in values:
                if (
                    isinstance(value, bool)
                    or not isinstance(value, (int, float))
                    or not math.isfinite(float(value))
                    or float(value) <= 0.0
                ):
                    raise ValueError(f"temperature value {value!r} must be a finite positive number")

    selection_gate = _parse_selection_gate(document)
    from .config import load_training_config_from_document

    # Validate the base schema with one representative axis overlay. Every
    # enumerated overlay is checked again by enumerate_specs before hashing.
    load_training_config_from_document(
        dict(
            base_config,
            temperature=float(candidates["temperature"][0]),
            augmentationProfile=AUGMENTATION[candidates["augmentation"][0]]["augmentationProfile"],
            hardNegativeRatio=HARD_NEGATIVE[candidates["hardNegative"][0]]["hardNegativeRatio"],
        )
    )
    return base_config, candidates


def _effective_config_for_spec(spec: ExperimentSpec) -> dict[str, Any]:
    """Return the canonical schema-v2 effective config for one matrix spec."""
    from .config import config_to_document, load_training_config_from_document

    config = load_training_config_from_document(spec.config_overlay)
    canonical = config_to_document(config)
    if canonical != spec.config_overlay:
        raise ValueError("candidate effectiveConfig is not canonical")
    return canonical


def _validate_candidate_against_spec(
    result: ExperimentResult,
    expected: ExperimentSpec,
) -> None:
    """Reject a manifest that resolves to anything other than its matrix spec."""
    if result.spec != expected:
        raise ValueError("candidate manifest spec does not match enumerated matrix")
    if result.run_id != expected.run_id or result.spec.matrix_key != expected.matrix_key:
        raise ValueError("candidate manifest identity does not match enumerated matrix")
    if result.config_checksum != expected.config_checksum or result.split_checksum != expected.split_checksum:
        raise ValueError("candidate manifest checksums do not match enumerated matrix")
    expected_config = _effective_config_for_spec(expected)
    if expected_config != expected.config_overlay:
        raise ValueError("enumerated candidate effective config is not canonical")
    if result.spec.config_overlay != expected_config:
        raise ValueError("candidate manifest effective config does not match enumerated matrix")


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
    target_bytes = text.encode("utf-8")
    if os.path.lexists(path):
        if path.is_symlink() or not path.is_file() or path.read_bytes() != target_bytes:
            raise FileExistsError(f"refusing conflicting generated training config: {path}")
    else:
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        try:
            os.write(descriptor, target_bytes)
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
    # Reject if config.py would refuse it (defensive: keeps the gate honest).
    from .config import load_training_config  # lazy import (no torch)

    load_training_config(path)
    return path


def _non_negative_int(doc: Mapping[str, Any], key: str) -> int:
    value = doc[key]
    if (
        isinstance(value, bool)
        or not isinstance(value, int)
        or value < 0
        or value > _MAX_METRIC_COUNT
    ):
        raise ValueError(f"{key} must be a bounded non-negative integer")
    return value


def _rate(doc: Mapping[str, Any], key: str) -> float:
    value = doc[key]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{key} must be a finite rate")
    try:
        result = float(value)
    except (OverflowError, ValueError):
        raise ValueError(f"{key} must be a finite rate") from None
    if not math.isfinite(result) or not 0.0 <= result <= 1.0:
        raise ValueError(f"{key} must be a finite rate in [0, 1]")
    return result


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
    if doc.get("schemaVersion") != 1 or isinstance(doc.get("schemaVersion"), bool):
        raise ValueError("dev-metrics.json schemaVersion must be 1")
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
    if accuracy is not None:
        if isinstance(accuracy, bool) or not isinstance(accuracy, (int, float)):
            raise ValueError("acceptedAccuracy must be a number or null")
        accuracy = float(accuracy)
        if not math.isfinite(accuracy) or not 0.0 <= accuracy <= 1.0:
            raise ValueError("acceptedAccuracy must be a finite rate in [0, 1]")
    abstention_rate = _rate(doc, "abstentionRate")
    result = CalibratedMetrics(
        accepted_count=_non_negative_int(doc, "acceptedCount"),
        accepted_accuracy=accuracy,
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
    publish_no_replace(path, {
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
    strict_overlay = _effective_config_for_spec(spec)
    if strict_overlay.get("seed") != spec.seed or strict_overlay.get("temperature") != spec.temperature:
        raise ValueError("candidate effective config does not match its spec")
    config_path = _yaml_config_path(spec, strict_overlay, artifacts_root / ".p2-configs")

    if dataset_version is None or dataset_version_sha256 is None:
        raise ValueError("candidate manifest requires dataset version provenance")
    if dataset_version.parent_dataset_id != spec.parent_dataset_id:
        raise ValueError("candidate parent dataset provenance does not match spec")
    _manifest_sha256(dataset_version_sha256, "dataset version checksum")

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
    if not isinstance(thresholds_doc, dict):
        raise ValueError("thresholds.json must be a mapping")
    calibrated_doc = thresholds_doc.get("metrics")
    if not isinstance(calibrated_doc, dict):
        raise ValueError("thresholds.json metrics must be a mapping")
    thresholds = _parse_manifest_thresholds(thresholds_doc.get("thresholds"))
    calibrated = _parse_calibrated_metrics(calibrated_doc)
    _validate_metric_consistency(raw, calibrated)

    result = ExperimentResult(
        spec=spec,
        run_id=run_id,
        run_dir=str(run_dir),
        thresholds_path=str(thresholds_path),
        thresholds=thresholds,
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
) -> tuple[dict, "GateReport"]:
    """Open the Phase 2 final once and return evidence plus GateReport."""
    from . import artifacts, evaluate
    from .phase2_gate import (
        GateBlockedError,
        _sha256_file,
        adjudicate_final,
        load_gate_policy,
        publish_gate_report,
    )

    policy = load_gate_policy(gate_path)
    if policy.pre_agreed_placeholders:
        raise GateBlockedError(
            "gate policy is not approved (preAgreedPlaceholders still true)"
        )
    frozen_dir = Path(result.run_dir) / "frozen"
    artifacts.verify_freeze(frozen_dir)
    final = evaluate.evaluate_final_once(
        Path(result.run_dir),
        Path(raw_root),
        Path(labels_root),
        Path(splits_root),
        confirm_final_once=result.run_id,
        phase2_confirmed=True,
        duplicate_reviews=Path(duplicate_reviews),
    )
    metrics = final.get("metrics")
    if not isinstance(metrics, dict):
        raise ValueError("final evaluation metrics must be a mapping")
    required = {
        "wrong_count", "accepted_wrong_count", "accepted_count", "query_count",
        "abstention_rate", "top1_accuracy", "batch_exact_match",
    }
    missing = sorted(required - set(metrics))
    if missing:
        raise ValueError(f"final evaluation metrics missing keys: {missing}")

    def count(key: str) -> int:
        value = metrics[key]
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValueError(f"final evaluation metric {key} must be non-negative integer")
        return value

    def rate(key: str) -> float:
        value = metrics[key]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"final evaluation metric {key} must be numeric")
        try:
            result_value = float(value)
        except (OverflowError, ValueError):
            raise ValueError(f"final evaluation metric {key} must be finite") from None
        if not math.isfinite(result_value) or not 0.0 <= result_value <= 1.0:
            raise ValueError(f"final evaluation metric {key} must be in [0, 1]")
        return result_value

    wrong_count = count("wrong_count")
    wrong_accepted = count("accepted_wrong_count")
    accepted_count = count("accepted_count")
    query_count = count("query_count")
    if query_count <= 0 or accepted_count > query_count or wrong_accepted > accepted_count or wrong_accepted > wrong_count:
        raise ValueError("final evaluation count metrics are inconsistent")
    abstention_rate = rate("abstention_rate")
    accepted_rate = accepted_count / query_count
    if abs((1.0 - abstention_rate) - accepted_rate) > 1e-12:
        raise ValueError("final evaluation rates are inconsistent")
    evidence = {
        "metrics": {
            "wrongAcceptedCount": wrong_accepted,
            "acceptedCount": accepted_count,
            "queryCount": query_count,
            "acceptedRate": accepted_rate,
            "top1Accuracy": rate("top1_accuracy"),
            "batchExactMatch": rate("batch_exact_match"),
            "abstentionRate": abstention_rate,
        }
    }
    gate_report = adjudicate_final(
        policy,
        evidence,
        policy_sha256=_sha256_file(Path(gate_path)),
        evidence_sha256=_sha256_file(Path(result.run_dir) / "final-evaluation.json"),
    )
    publish_gate_report(Path(result.run_dir) / "gate-final.json", gate_report)
    return final, gate_report


def write_selection(
    path: Path,
    selected: ExperimentResult,
    selected_manifest_path: Path,
    dataset_version_path: Path,
    version: DatasetVersion,
    *,
    git_revision: str,
    selection_gate: SelectionGate,
) -> None:
    """Write the immutable phase2-selection.json (spec §5.3).

    The selection policy is copied from the sealed candidates.yaml gate; callers
    cannot weaken it with an operator flag. Byte-equivalent existing artifacts
    remain idempotent through ``publish_no_replace``.
    """
    if not selection_gate.require_zero_wrong_accepted:
        raise ValueError("selection gate must require zero wrong accepted")
    if selected_manifest_path.is_symlink() or not selected_manifest_path.is_file():
        raise ValueError("selected candidate manifest must be a regular file")
    if not revision_matches_recorded(git_revision, selected.git_revision):
        if os.path.lexists(path):
            raise FileExistsError("existing selection conflicts with requested Git revision")
        raise ValueError("selection Git revision is incompatible with selected candidate")
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
            "gitRevision": selected.git_revision,
        },
        "policy": {
            "requireZeroWrongAccepted": selection_gate.require_zero_wrong_accepted,
            "tieBreakers": [*selection_gate.tie_breakers, "runId"],
        },
    }
    publish_no_replace(path, document)


def _selection_gate_from_candidates(path: Path) -> SelectionGate:
    """Load the sealed candidate-selection policy and enforce the safety floor."""
    gate = load_selection_gate(Path(path))
    if not gate.require_zero_wrong_accepted:
        raise ValueError("candidates.yaml must require zero wrong accepted")
    return gate


def _validate_frozen_identity(frozen_dir: Path, result: ExperimentResult) -> None:
    """Verify an existing frozen directory belongs to the selected candidate."""
    from . import artifacts

    if frozen_dir.is_symlink() or not frozen_dir.is_dir():
        raise ValueError("frozen candidate must be a regular directory")
    manifest = artifacts.verify_freeze(frozen_dir)
    if manifest.run_id != result.run_id:
        raise ValueError("frozen manifest run ID does not match selected candidate")
    if manifest.git_revision != result.git_revision:
        raise ValueError("frozen manifest Git revision does not match candidate")
    if not revision_matches_recorded(_git_revision(), manifest.git_revision):
        raise ValueError("frozen manifest Git revision does not match current revision")


def _resolve_and_validate_selection(
    args: argparse.Namespace,
) -> tuple[dict[str, Any], ExperimentResult, ExperimentSpec, DatasetVersion, Path]:
    """Resolve selection and enforce candidates.yaml policy before terminal stages."""
    selection, result, spec, version, manifest_path = _resolve_selected_result_from_args(args)
    gate = _selection_gate_from_candidates(Path(args.candidates))
    _validate_selection_current(
        selection,
        selected=result,
        manifest_path=manifest_path,
        dataset_version=version,
        dataset_version_path=Path(args.dataset_version),
        selection_gate=gate,
    )
    return selection, result, spec, version, manifest_path


def _validate_current_candidate(
    manifest_path: Path,
    spec: ExperimentSpec,
    *,
    version: DatasetVersion,
    dataset_version_path: Path,
    splits_root: Path,
    artifacts_root: Path,
) -> ExperimentResult:
    """Resolve one candidate and validate both its manifest and run outputs."""
    result = _current_candidate_result(
        manifest_path,
        spec,
        dataset_version=version,
        dataset_version_path=dataset_version_path,
        splits_root=splits_root,
        artifacts_root=artifacts_root,
    )
    _validate_run_outputs(result, spec=spec)
    return result


def _validate_selection_artifact_after_publish(
    selection_path: Path,
    selected: ExperimentResult,
    selected_manifest: Path,
    *,
    version: DatasetVersion,
    dataset_version_path: Path,
    selection_gate: SelectionGate,
) -> None:
    """Re-read a published selection so reuse cannot trust unchecked bytes."""
    _validate_selection_current(
        read_json(selection_path),
        selected=selected,
        manifest_path=selected_manifest,
        dataset_version=version,
        dataset_version_path=dataset_version_path,
        selection_gate=selection_gate,
    )


def _cmd_list(args: argparse.Namespace) -> int:
    from .dataset_version import load_dataset_version

    try:
        version = load_dataset_version(args.dataset_version)
        specs = enumerate_specs(
            Path(args.candidates),
            Path(args.splits_root),
            version,
        )
    except (OSError, ValueError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID
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
            require_zero_wrong_accepted=True,
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
    """Verify an existing train/calibration artifact set and return it."""
    from .dataset_version import load_dataset_version

    try:
        version = load_dataset_version(Path(args.dataset_version))
        result = _validate_current_candidate(
            manifest_path,
            spec,
            version=version,
            dataset_version_path=Path(args.dataset_version),
            splits_root=Path(args.splits_root),
            artifacts_root=Path(args.artifacts_root),
        )
    except (OSError, ValueError, RuntimeError) as error:
        print(f"error: existing candidate is invalid: {error}", file=sys.stderr)
        return EXIT_INVALID
    print(json.dumps(result.to_json(), sort_keys=True, indent=2))
    return EXIT_OK



def _cmd_compare(args: argparse.Namespace) -> int:
    from .dataset_version import load_dataset_version

    try:
        version = load_dataset_version(args.dataset_version)
        selection_gate = _selection_gate_from_candidates(Path(args.candidates))
        specs = enumerate_specs(Path(args.candidates), Path(args.splits_root), version)
        git_revision = _git_revision()
    except (ValueError, OSError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID
    results: list[ExperimentResult] = []
    seen_run_ids: set[str] = set()
    try:
        for spec in specs:
            manifest_path = Path(args.artifacts_root) / "phase2-experiments" / f"{spec.run_id}.json"
            if spec.run_id in seen_run_ids:
                raise ValueError(f"duplicate run id {spec.run_id}")
            if not manifest_path.is_file() or manifest_path.is_symlink():
                raise ValueError(f"missing manifest for {spec.run_id}")
            seen_run_ids.add(spec.run_id)
            results.append(_validate_current_candidate(
                manifest_path,
                spec,
                version=version,
                dataset_version_path=Path(args.dataset_version),
                splits_root=Path(args.splits_root),
                artifacts_root=Path(args.artifacts_root),
            ))
        if len(results) != len(specs):
            raise ValueError("resolved candidate count does not match enumeration")
    except (OSError, ValueError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID

    selected = compare_experiments(
        results,
        require_zero_wrong_accepted=selection_gate.require_zero_wrong_accepted,
        tie_breakers=selection_gate.tie_breakers,
    )
    if selected is None:
        print("error: no candidate passed the zero-wrong-accepted gate", file=sys.stderr)
        return EXIT_GATE_FAIL
    selected_manifest = Path(args.artifacts_root) / "phase2-experiments" / f"{selected.run_id}.json"
    try:
        write_selection(
            Path(args.selection_path),
            selected,
            selected_manifest,
            Path(args.dataset_version),
            version,
            git_revision=git_revision,
            selection_gate=selection_gate,
        )
        _validate_selection_artifact_after_publish(
            Path(args.selection_path),
            selected,
            selected_manifest,
            version=version,
            dataset_version_path=Path(args.dataset_version),
            selection_gate=selection_gate,
        )
    except (FileExistsError, OSError, ValueError, RuntimeError) as error:
        print(f"error: selection artifact is invalid: {error}", file=sys.stderr)
        return EXIT_INVALID
    print(json.dumps(
        {"selectedRunId": selected.run_id, "selectedMatrixKey": selected.spec.matrix_key},
        sort_keys=True, indent=2,
    ))
    return EXIT_OK


def _cmd_freeze(args: argparse.Namespace) -> int:
    try:
        _, result, _, _, _ = _resolve_and_validate_selection(args)
        frozen_dir = Path(result.run_dir) / "frozen"
        if os.path.lexists(frozen_dir):
            _validate_frozen_identity(frozen_dir, result)
            print(f"frozen: {frozen_dir} (existing verified)")
            return EXIT_OK
        frozen_dir = freeze_selected(
            result,
            raw_root=Path(args.raw_root),
            labels_root=Path(args.labels_root),
            splits_root=Path(args.splits_root),
            duplicate_reviews=Path(args.duplicate_reviews),
        )
        _validate_frozen_identity(frozen_dir, result)
    except (OSError, ValueError, RuntimeError, FileExistsError) as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID
    print(f"frozen: {frozen_dir}")
    return EXIT_OK


def _cmd_confirm_final(args: argparse.Namespace) -> int:
    from . import phase2_gate

    # Policy approval is the first preflight: a placeholder policy blocks before
    # selection resolution can touch any run or final-split artifact.
    try:
        policy = phase2_gate.load_gate_policy(Path(args.gate_config))
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID
    if policy.pre_agreed_placeholders:
        print("error: gate policy is not approved (preAgreedPlaceholders still true)", file=sys.stderr)
        return EXIT_BLOCKED

    try:
        selection, result, _, _, _ = _resolve_and_validate_selection(args)
        if selection["selectedRunId"] != args.confirm_final_once:
            raise ValueError("--confirm-final-once does not match selection")
        _validate_frozen_identity(Path(result.run_dir) / "frozen", result)
        final, gate_report = confirm_final_once(
            result,
            raw_root=Path(args.raw_root),
            labels_root=Path(args.labels_root),
            splits_root=Path(args.splits_root),
            duplicate_reviews=Path(args.duplicate_reviews),
            gate_path=Path(args.gate_config),
        )
    except phase2_gate.GateBlockedError as error:
        print(f"gate blocked: {error}", file=sys.stderr)
        return EXIT_BLOCKED
    except (OSError, ValueError, KeyError, TypeError, PermissionError, RuntimeError, FileExistsError) as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID
    print(json.dumps({
        "status": gate_report.status,
        "runId": result.run_id,
        "gateReport": gate_report.to_dict(),
        "final": final,
    }, sort_keys=True, indent=2))
    return phase2_gate.exit_code_for_status(gate_report.status)


def _cmd_adjudicate_replay(args: argparse.Namespace) -> int:
    from . import artifacts, phase2_gate

    try:
        policy = phase2_gate.load_gate_policy(Path(args.gate_config))
        replay_doc = read_json(Path(args.replay_report))
        artifacts.verify_freeze(Path(args.frozen_dir))
        freeze_doc = read_json(Path(args.frozen_dir) / "freeze-manifest.json")
        report = phase2_gate.adjudicate_replay(
            policy,
            replay_doc,
            freeze_doc,
            policy_sha256=hashlib.sha256(Path(args.gate_config).read_bytes()).hexdigest(),
            evidence_sha256=hashlib.sha256(Path(args.replay_report).read_bytes()).hexdigest(),
        )
        if args.output:
            phase2_gate.publish_gate_report(args.output, report)
    except (OSError, ValueError, TypeError, KeyError, FileExistsError) as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID
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

    # compare — select the best candidate from the complete matrix
    cmp = sub.add_parser("compare", help="Select best candidate from complete matrix (dev-only).")
    cmp.add_argument("--candidates", type=Path, required=True)
    cmp.add_argument("--splits-root", type=Path, required=True)
    cmp.add_argument("--dataset-version", type=Path, required=True)
    cmp.add_argument("--artifacts-root", type=Path, required=True)
    cmp.add_argument("--selection-path", type=Path, required=True)

    # freeze — read phase2-selection.json, verify, freeze (no-replace)
    frz = sub.add_parser("freeze", help="Freeze selected candidate (no-replace).")
    frz.add_argument("--selection", type=Path, required=True)
    frz.add_argument("--artifacts-root", type=Path, required=True)  # resolves the manifest
    frz.add_argument("--candidates", type=Path, required=True)
    frz.add_argument("--dataset-version", type=Path, required=True)
    frz.add_argument("--raw-root", type=Path, required=True)
    frz.add_argument("--labels-root", type=Path, required=True)
    frz.add_argument("--splits-root", type=Path, required=True)
    frz.add_argument("--duplicate-reviews", type=Path, required=True)

    # confirm-final — one-shot final evaluation, gated BEFORE opening final
    cf = sub.add_parser("confirm-final", help="One-shot final evaluation with gate (the only path to final).")
    cf.add_argument("--selection", type=Path, required=True)
    cf.add_argument("--artifacts-root", type=Path, required=True)
    cf.add_argument("--candidates", type=Path, required=True)
    cf.add_argument("--dataset-version", type=Path, required=True)
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
