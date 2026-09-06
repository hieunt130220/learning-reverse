"""Immutable coverage-recovery experiment identities and orchestration."""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import math
import os
import platform
import re
import secrets
import shlex
import socket
import stat
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Mapping, Sequence

import yaml

from .calibrate import (
    CalibrationResult,
    Thresholds,
    apply_thresholds,
    calibrate_partition_robust_zero_wrong,
    calibrate_thresholds,
    load_dev_predictions,
)
from .config import TrainingConfig, config_to_document
from .dataset_version import DatasetVersionV2, load_dataset_version
from .metrics import MetricSummary, Prediction, summarize_predictions
from .phase2_cycle import (
    CYCLE_ID,
    DATASET_ID,
    EXPERIMENT_ID,
    CycleDataRoots,
    StageBlockedError,
    WorkingMembership,
    commit_ids,
    load_working_membership,
    resolve_cycle_data_roots,
)
from .phase2_training import PROFILE_PARAMETERS
from .phase2_gate import GateBlockedError, load_gate_policy
from .provenance import revision_matches_recorded
from .schema import load_label, load_manifest, publish_no_replace, read_json, sha256_file

GLOBAL_SEED = 20260827
CALIBRATION_POLICIES = ("joint_zero_wrong", "partition_robust_zero_wrong")
HARD_NEGATIVE_OPTIONS = (
    ("off", 0.0),
    ("ratio_0.25", 0.25),
    ("ratio_0.50", 0.50),
)
EMBEDDING_OPTIONS = (
    ("dim_96", 96),
    ("dim_128", 128),
)
_SAFE_COMPONENT = re.compile(r"^[A-Za-z0-9._-]+$")
_HEX40 = re.compile(r"^[0-9a-f]{40}$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_RUN_FILES = frozenset(
    {
        "checkpoints/best-dev.pt",
        "dev-metrics.json",
        "dev-predictions.json",
        "environment.json",
        "model-config.json",
        "normalization.json",
        "training-history.json",
    }
)


@dataclass(frozen=True, slots=True)
class ModelSpec:
    run_id: str
    augmentation_profile: str
    hard_negative_policy: str
    hard_negative_ratio: float
    embedding_policy: str
    embedding_dim: int
    config: TrainingConfig
    effective_config_sha256: str

    @property
    def effective_config(self) -> dict[str, object]:
        return config_to_document(self.config)


@dataclass(frozen=True, slots=True)
class CandidateSpec:
    candidate_id: str
    model: ModelSpec
    calibration_policy: Literal["joint_zero_wrong", "partition_robust_zero_wrong"]

    @property
    def run_id(self) -> str:
        return self.model.run_id

    @property
    def effective_config_sha256(self) -> str:
        return self.model.effective_config_sha256


@dataclass(frozen=True, slots=True)
class RunEvidence:
    model: ModelSpec
    run_dir: Path
    environment: Mapping[str, object]
    predictions: tuple[Prediction, ...]
    raw_metrics: MetricSummary
    checkpoint_sha256: str
    predictions_sha256: str


@dataclass(frozen=True, slots=True)
class CandidateEvidence:
    spec: CandidateSpec
    path: Path
    sha256: str
    calibration_sha256: str
    document: Mapping[str, object]
    accepted_rate: float
    top1_accuracy: float
    batch_exact_match: float
    wrong_accepted_count: int
    acquired_dev_wrong_accepted_count: int


def _canonical_json_bytes(document: object) -> bytes:
    return json.dumps(
        document,
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def _published_json_bytes(document: object) -> bytes:
    return (
        json.dumps(
            document,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n"
    ).encode("utf-8")


def _document_sha256(document: object) -> str:
    return hashlib.sha256(_published_json_bytes(document)).hexdigest()


def _git_revision() -> str:
    try:
        revision = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError) as error:
        raise RuntimeError("coverage recovery requires a readable Git revision") from error
    if not _HEX40.fullmatch(revision):
        raise RuntimeError("coverage recovery Git revision is invalid")
    return revision


def _require_clean_tracked_worktree() -> None:
    try:
        unstaged = subprocess.run(["git", "diff", "--quiet"], check=False).returncode
        staged = subprocess.run(["git", "diff", "--cached", "--quiet"], check=False).returncode
    except OSError as error:
        raise RuntimeError("cannot inspect tracked Git state") from error
    if unstaged != 0 or staged != 0:
        raise StageBlockedError("tracked Git changes must be committed before experiment execution")


def _mapping(value: object, field: str) -> Mapping[str, object]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{field} must be an object")
    return value


def _exact_mapping(
    value: object,
    expected_keys: frozenset[str],
    field: str,
) -> Mapping[str, object]:
    document = _mapping(value, field)
    if set(document) != expected_keys:
        raise ValueError(f"{field} fields mismatch")
    return document


def _hex64(value: object, field: str) -> str:
    if not isinstance(value, str) or not _HEX64.fullmatch(value):
        raise ValueError(f"{field} must be a lowercase SHA-256")
    return value


def _regular_file(path: Path, field: str) -> Path:
    metadata = os.lstat(path)
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1:
        raise ValueError(f"{field} must be a single-link regular file")
    return path


def _read_mapping(path: Path, field: str) -> Mapping[str, object]:
    _regular_file(path, field)
    return _mapping(read_json(path), field)


def _training_config(
    augmentation_profile: str,
    hard_negative_ratio: float,
    embedding_dim: int,
) -> TrainingConfig:
    return TrainingConfig(
        schema_version=3,
        seed=GLOBAL_SEED,
        epochs=80,
        learning_rate=0.001,
        weight_decay=0.0001,
        temperature=0.05,
        embedding_dim=embedding_dim,
        channels=(32, 64, 96, 128),
        checkpoint_metric="dev_top1_accuracy",
        device="cpu",
        workers=0,
        reproducibility_tolerance=0.002,
        augmentation_profile=augmentation_profile,
        hard_negative_ratio=hard_negative_ratio,
        hard_negative_margin=0.10,
    )


def _safe_identity(value: str, field: str) -> str:
    if not value or Path(value).name != value or not _SAFE_COMPONENT.fullmatch(value):
        raise ValueError(f"{field} must be one safe ASCII path component")
    return value


def enumerate_model_specs() -> tuple[ModelSpec, ...]:
    models: list[ModelSpec] = []
    for augmentation_profile in PROFILE_PARAMETERS:
        for hard_negative_policy, hard_negative_ratio in HARD_NEGATIVE_OPTIONS:
            for embedding_policy, embedding_dim in EMBEDDING_OPTIONS:
                config = _training_config(
                    augmentation_profile,
                    hard_negative_ratio,
                    embedding_dim,
                )
                effective_config_sha256 = hashlib.sha256(
                    _canonical_json_bytes(config_to_document(config))
                ).hexdigest()
                run_id = _safe_identity(
                    "-".join(
                        (
                            EXPERIMENT_ID,
                            augmentation_profile,
                            hard_negative_policy,
                            embedding_policy,
                            effective_config_sha256[:16],
                        )
                    ),
                    "run id",
                )
                models.append(
                    ModelSpec(
                        run_id=run_id,
                        augmentation_profile=augmentation_profile,
                        hard_negative_policy=hard_negative_policy,
                        hard_negative_ratio=hard_negative_ratio,
                        embedding_policy=embedding_policy,
                        embedding_dim=embedding_dim,
                        config=config,
                        effective_config_sha256=effective_config_sha256,
                    )
                )
    result = tuple(models)
    if len(result) != 24 or len({model.run_id for model in result}) != 24:
        raise RuntimeError("coverage-recovery model matrix is not exactly 24 unique identities")
    return result


def enumerate_candidate_specs(
    models: Sequence[ModelSpec] | None = None,
) -> tuple[CandidateSpec, ...]:
    selected_models = tuple(models) if models is not None else enumerate_model_specs()
    if len(selected_models) != 24 or len({model.run_id for model in selected_models}) != 24:
        raise ValueError("candidate enumeration requires exactly 24 unique model specs")
    candidates = tuple(
        CandidateSpec(
            candidate_id=_safe_identity(
                f"{model.run_id}-{calibration_policy}",
                "candidate id",
            ),
            model=model,
            calibration_policy=calibration_policy,
        )
        for model in selected_models
        for calibration_policy in CALIBRATION_POLICIES
    )
    if len(candidates) != 48 or len({candidate.candidate_id for candidate in candidates}) != 48:
        raise RuntimeError("coverage-recovery candidate matrix is not exactly 48 unique identities")
    return candidates


def candidate_record_path(artifacts_root: Path, candidate_id: str) -> Path:
    return Path(artifacts_root) / "candidates" / _safe_identity(candidate_id, "candidate id") / "candidate.json"


def experiment_manifest_path(artifacts_root: Path) -> Path:
    return Path(artifacts_root) / "experiment" / "experiment-manifest.json"


def _model_document(model: ModelSpec) -> dict[str, object]:
    return {
        "runId": model.run_id,
        "augmentationProfile": model.augmentation_profile,
        "hardNegativePolicy": model.hard_negative_policy,
        "hardNegativeRatio": model.hard_negative_ratio,
        "embeddingPolicy": model.embedding_policy,
        "embeddingDim": model.embedding_dim,
        "effectiveConfig": model.effective_config,
        "effectiveConfigSha256": model.effective_config_sha256,
    }


def _candidate_spec_document(candidate: CandidateSpec) -> dict[str, object]:
    return {
        "candidateId": candidate.candidate_id,
        "runId": candidate.run_id,
        "calibrationPolicy": candidate.calibration_policy,
        "effectiveConfigSha256": candidate.effective_config_sha256,
    }


def _dataset_provenance(
    cycle_root: Path,
) -> tuple[WorkingMembership, dict[str, object]]:
    root = Path(cycle_root)
    membership = load_working_membership(root)
    dataset_version_path = _regular_file(
        root / "dataset-version.json",
        "cycle dataset-version.json",
    )
    dataset_version = load_dataset_version(dataset_version_path)
    if not isinstance(dataset_version, DatasetVersionV2):
        raise ValueError("coverage recovery requires dataset-version schema v2")
    if dataset_version.dataset_id != DATASET_ID or membership.dataset_id != DATASET_ID:
        raise ValueError("coverage-recovery dataset identity mismatch")
    if (
        dataset_version.source_commitment.count != membership.source_commitment.count
        or dataset_version.source_commitment.sha256 != membership.source_commitment.sha256
    ):
        raise ValueError("dataset-version source commitment does not match working membership")
    train_commitment = commit_ids(membership.train_ids)
    dev_commitment = commit_ids(membership.dev_ids)
    for split, commitment in (("train", train_commitment), ("dev", dev_commitment)):
        expected = dataset_version.splits[split]
        if expected.count != commitment.count or expected.sha256 != commitment.sha256:
            raise ValueError(f"dataset-version {split} commitment does not match working membership")
    return membership, {
        "path": str(dataset_version_path.resolve()),
        "sha256": sha256_file(dataset_version_path),
        "datasetId": dataset_version.dataset_id,
        "parentDatasetId": dataset_version.parent_dataset_id,
        "sourceCommitment": {
            "count": dataset_version.source_commitment.count,
            "sha256": dataset_version.source_commitment.sha256,
        },
        "splits": {
            split: {
                "count": dataset_version.splits[split].count,
                "sha256": dataset_version.splits[split].sha256,
            }
            for split in ("train", "dev", "final")
        },
    }


def _experiment_document(cycle_root: Path, git_revision: str) -> dict[str, object]:
    if not _HEX40.fullmatch(git_revision):
        raise ValueError("experiment Git revision must be a lowercase 40-character SHA")
    _, dataset = _dataset_provenance(cycle_root)
    models = enumerate_model_specs()
    candidates = enumerate_candidate_specs(models)
    return {
        "schemaVersion": 1,
        "cycleId": CYCLE_ID,
        "experimentId": EXPERIMENT_ID,
        "datasetId": DATASET_ID,
        "datasetVersion": dataset,
        "gitRevision": git_revision,
        "device": "cpu",
        "workers": 0,
        "globalSeed": GLOBAL_SEED,
        "models": [_model_document(model) for model in models],
        "candidates": [_candidate_spec_document(candidate) for candidate in candidates],
        "calibrationPolicies": list(CALIBRATION_POLICIES),
        "devPromotionGate": {
            "wrongAcceptedCount": 0,
            "minAcceptedRate": 0.65,
            "minTop1Accuracy": 0.99,
            "minBatchExactMatch": 0.95,
            "acquiredDevWrongAcceptedCount": 0,
        },
        "selectionOrder": [
            "acceptedRateDescending",
            "top1AccuracyDescending",
            "batchExactMatchDescending",
            "latencyP95BucketAscending",
            "candidateIdByteAscending",
        ],
        "latencyTieBreak": {
            "device": "cpu",
            "torchThreads": 1,
            "warmupCalls": 10,
            "timedCalls": 100,
            "clock": "perf_counter_ns",
            "p95": "nearest-rank-ceil-1",
            "bucketMilliseconds": 1,
            "scope": "matcher-only-quality-ties",
        },
        "executionOrder": {
            "runIds": [model.run_id for model in models],
            "candidateIds": [candidate.candidate_id for candidate in candidates],
        },
    }


def publish_experiment(
    cycle_root: Path,
    artifacts_root: Path,
    *,
    preview: bool = False,
) -> dict[str, object]:
    git_revision = _git_revision()
    document = _experiment_document(Path(cycle_root), git_revision)
    digest = _document_sha256(document)
    models = _mapping(document["executionOrder"], "executionOrder")["runIds"]
    candidates = _mapping(document["executionOrder"], "executionOrder")["candidateIds"]
    result = {
        "schemaVersion": 1,
        "status": "PREVIEW" if preview else "PUBLISHED",
        "path": str(experiment_manifest_path(artifacts_root)),
        "sha256": digest,
        "modelCount": 24,
        "candidateCount": 48,
        "runIds": models,
        "candidateIds": candidates,
    }
    if preview:
        result["manifest"] = document
        return result
    _require_clean_tracked_worktree()
    path = experiment_manifest_path(artifacts_root)
    publish_no_replace(path, document)
    if sha256_file(path) != digest:
        raise RuntimeError("published experiment manifest digest mismatch")
    return result


def _load_experiment(
    cycle_root: Path,
    artifacts_root: Path,
    *,
    require_current_revision: bool = True,
) -> tuple[Mapping[str, object], str, WorkingMembership]:
    path = experiment_manifest_path(artifacts_root)
    document = _read_mapping(path, "experiment manifest")
    recorded_revision = document.get("gitRevision")
    if not isinstance(recorded_revision, str) or not _HEX40.fullmatch(recorded_revision):
        raise ValueError("experiment manifest Git revision is invalid")
    expected = _experiment_document(Path(cycle_root), recorded_revision)
    if document != expected:
        raise ValueError("experiment manifest does not match the fixed coverage-recovery contract")
    digest = sha256_file(path)
    if digest != _document_sha256(expected):
        raise ValueError("experiment manifest digest mismatch")
    if require_current_revision and not revision_matches_recorded(_git_revision(), recorded_revision):
        raise StageBlockedError("current Git revision is not compatible with experiment manifest")
    membership, _ = _dataset_provenance(Path(cycle_root))
    return document, digest, membership


def _model_for_run(run_id: str) -> ModelSpec:
    safe_run_id = _safe_identity(run_id, "run id")
    matches = [model for model in enumerate_model_specs() if model.run_id == safe_run_id]
    if len(matches) != 1:
        raise ValueError(f"unknown coverage-recovery run id: {run_id}")
    return matches[0]


def _candidates_for_run(run_id: str) -> tuple[CandidateSpec, ...]:
    candidates = tuple(
        candidate
        for candidate in enumerate_candidate_specs()
        if candidate.run_id == run_id
    )
    if len(candidates) != 2:
        raise RuntimeError("coverage-recovery run does not map to exactly two candidates")
    return candidates


def _runtime_identity() -> dict[str, str]:
    import numpy as np
    import torch

    return {
        "pythonVersion": platform.python_version(),
        "pytorchVersion": torch.__version__,
        "numpyVersion": np.__version__,
        "pillowVersion": importlib.metadata.version("Pillow"),
        "scikitImageVersion": importlib.metadata.version("scikit-image"),
        "pyyamlVersion": importlib.metadata.version("PyYAML"),
        "platform": platform.platform(),
        "device": "cpu",
    }


def _run_inventory(run_dir: Path) -> tuple[str, ...]:
    root = Path(run_dir)
    if root.is_symlink() or not root.is_dir():
        raise ValueError("run directory must be a real directory")
    files: list[str] = []
    for current_root, directory_names, file_names in os.walk(root, followlinks=False):
        current = Path(current_root)
        for directory_name in directory_names:
            directory = current / directory_name
            if directory.is_symlink() or not directory.is_dir():
                raise ValueError("run inventory contains a non-directory or symlink")
        for file_name in file_names:
            path = current / file_name
            _regular_file(path, f"run file {path.relative_to(root).as_posix()}")
            files.append(path.relative_to(root).as_posix())
    return tuple(sorted(files))


def _run_tree_sha256(run_dir: Path) -> str:
    root = Path(run_dir)
    digest = hashlib.sha256()
    for relative in _run_inventory(root):
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(sha256_file(root / relative).encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def _validate_normalization_document(document: Mapping[str, object]) -> None:
    if set(document) != {"mean", "std"}:
        raise ValueError("normalization.json fields mismatch")
    for field in ("mean", "std"):
        values = document[field]
        if not isinstance(values, list) or len(values) != 3:
            raise ValueError(f"normalization {field} must contain three values")
        for value in values:
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(float(value))
            ):
                raise ValueError(f"normalization {field} contains an invalid value")
        if field == "std" and any(float(value) <= 0 for value in values):
            raise ValueError("normalization std must be positive")


def _validate_run(
    cycle_root: Path,
    artifacts_root: Path,
    model: ModelSpec,
    experiment_manifest: Mapping[str, object],
    experiment_manifest_sha256: str,
    membership: WorkingMembership,
) -> RunEvidence:
    run_dir = Path(artifacts_root) / "runs" / model.run_id
    inventory = _run_inventory(run_dir)
    if frozenset(inventory) != _RUN_FILES:
        raise ValueError("run file inventory mismatch")

    config_document = _read_mapping(run_dir / "model-config.json", "run model config")
    if config_document != model.effective_config:
        raise ValueError("run model configuration does not match experiment manifest")
    if hashlib.sha256(_canonical_json_bytes(config_document)).hexdigest() != model.effective_config_sha256:
        raise ValueError("run effective-config digest mismatch")

    environment = _read_mapping(run_dir / "environment.json", "run environment")
    expected_environment_keys = frozenset(
        {
            "schemaVersion",
            "pythonVersion",
            "pytorchVersion",
            "numpyVersion",
            "pillowVersion",
            "scikitImageVersion",
            "pyyamlVersion",
            "platform",
            "device",
            "gitRevision",
            "checkpointSha256",
            "deterministicAlgorithmsEnabled",
            "determinismLimitations",
            "cycleProvenance",
        }
    )
    if set(environment) != expected_environment_keys or environment.get("schemaVersion") != 2:
        raise ValueError("cycle run environment fields mismatch")
    for key, expected in _runtime_identity().items():
        if environment.get(key) != expected:
            raise ValueError(f"cycle run runtime identity mismatch for {key}")
    recorded_revision = experiment_manifest.get("gitRevision")
    if environment.get("gitRevision") != recorded_revision:
        raise ValueError("cycle run Git revision does not match experiment manifest")
    if environment.get("deterministicAlgorithmsEnabled") is not True:
        raise ValueError("cycle run did not enable deterministic algorithms")
    limitations = environment.get("determinismLimitations")
    if not isinstance(limitations, list) or any(not isinstance(item, str) for item in limitations):
        raise ValueError("cycle run determinism limitations are invalid")

    dataset = _mapping(experiment_manifest["datasetVersion"], "manifest datasetVersion")
    splits = _mapping(dataset["splits"], "manifest datasetVersion.splits")
    expected_cycle_provenance = {
        "datasetId": DATASET_ID,
        "datasetVersionSha256": dataset["sha256"],
        "sourceCommitment": dataset["sourceCommitment"],
        "splits": {"train": splits["train"], "dev": splits["dev"]},
        "experimentManifestSha256": experiment_manifest_sha256,
    }
    if environment.get("cycleProvenance") != expected_cycle_provenance:
        raise ValueError("cycle run dataset/experiment provenance mismatch")

    checkpoint_path = run_dir / "checkpoints" / "best-dev.pt"
    checkpoint_sha256 = sha256_file(checkpoint_path)
    if environment.get("checkpointSha256") != checkpoint_sha256:
        raise ValueError("cycle run checkpoint digest mismatch")

    predictions_path = run_dir / "dev-predictions.json"
    predictions = load_dev_predictions(predictions_path)
    if {row.batch_id for row in predictions} != set(membership.dev_ids):
        raise ValueError("cycle run dev predictions do not cover exact working dev membership")
    raw_metrics = summarize_predictions(predictions)
    metrics_document = _read_mapping(run_dir / "dev-metrics.json", "run dev metrics")
    if metrics_document.get("schemaVersion") != 1:
        raise ValueError("run dev metrics schemaVersion mismatch")
    for key, expected in raw_metrics.to_json().items():
        if metrics_document.get(key) != expected:
            raise ValueError(f"run dev metrics mismatch for {key}")

    normalization_document = _read_mapping(
        run_dir / "normalization.json",
        "run normalization",
    )
    _validate_normalization_document(normalization_document)
    history_document = _read_mapping(run_dir / "training-history.json", "training history")
    if set(history_document) != {"schemaVersion", "epochs"} or history_document["schemaVersion"] != 1:
        raise ValueError("training history fields mismatch")
    epochs = history_document["epochs"]
    if not isinstance(epochs, list) or len(epochs) != model.config.epochs:
        raise ValueError("training history epoch count mismatch")

    import torch

    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    checkpoint_document = _mapping(checkpoint, "checkpoint")
    if checkpoint_document.get("schemaVersion") != 1:
        raise ValueError("checkpoint schemaVersion mismatch")
    if checkpoint_document.get("config") != model.effective_config:
        raise ValueError("checkpoint config mismatch")
    if checkpoint_document.get("devMetrics") != {
        key: value for key, value in metrics_document.items() if key != "schemaVersion"
    }:
        raise ValueError("checkpoint dev metrics mismatch")
    model_state = checkpoint_document.get("modelStateDict")
    if not isinstance(model_state, Mapping):
        raise ValueError("checkpoint model state is invalid")
    optimizer_state = checkpoint_document.get("optimizerStateDict")
    if not isinstance(optimizer_state, Mapping):
        raise ValueError("checkpoint optimizer state is invalid")
    selected_epoch = metrics_document.get("selectedEpoch")
    if (
        isinstance(selected_epoch, bool)
        or not isinstance(selected_epoch, int)
        or selected_epoch < 1
        or selected_epoch > model.config.epochs
        or checkpoint_document.get("epoch") != selected_epoch
    ):
        raise ValueError("checkpoint selected epoch mismatch")
    from .model import FishingEncoder

    validation_model = FishingEncoder(model.embedding_dim, model.config.channels)
    validation_model.load_state_dict(model_state)

    return RunEvidence(
        model=model,
        run_dir=run_dir,
        environment=environment,
        predictions=predictions,
        raw_metrics=raw_metrics,
        checkpoint_sha256=checkpoint_sha256,
        predictions_sha256=sha256_file(predictions_path),
    )


def _adjudication_path(artifacts_root: Path, run_id: str) -> Path:
    return Path(artifacts_root) / "adjudications" / _safe_identity(run_id, "run id") / "decision.json"


def _load_adjudication(
    artifacts_root: Path,
    run_id: str,
    experiment_manifest_sha256: str,
) -> Mapping[str, object] | None:
    path = _adjudication_path(artifacts_root, run_id)
    if not path.exists():
        return None
    document = _read_mapping(path, "run adjudication")
    expected_keys = frozenset(
        {
            "schemaVersion",
            "cycleId",
            "experimentId",
            "runId",
            "decision",
            "experimentManifestSha256",
            "gitRevision",
            "runTreeSha256",
            "movedTo",
        }
    )
    if set(document) != expected_keys:
        raise ValueError("run adjudication fields mismatch")
    if (
        document["schemaVersion"] != 1
        or document["cycleId"] != CYCLE_ID
        or document["experimentId"] != EXPERIMENT_ID
        or document["runId"] != run_id
        or document["decision"] not in {"reject", "reset"}
        or document["experimentManifestSha256"] != experiment_manifest_sha256
    ):
        raise ValueError("run adjudication identity mismatch")
    _hex64(document["runTreeSha256"], "run adjudication runTreeSha256")
    if not isinstance(document["gitRevision"], str) or not _HEX40.fullmatch(document["gitRevision"]):
        raise ValueError("run adjudication Git revision is invalid")
    if document["decision"] == "reject" and document["movedTo"] is not None:
        raise ValueError("reject adjudication must not move run evidence")
    if document["decision"] == "reset" and (
        not isinstance(document["movedTo"], str) or not document["movedTo"]
    ):
        raise ValueError("reset adjudication must name the preserved run evidence")
    if document["decision"] == "reset":
        expected_prefix = f"interrupted/{run_id}-"
        moved_to = str(document["movedTo"])
        if (
            not moved_to.startswith(expected_prefix)
            or moved_to != f"{expected_prefix}{document['runTreeSha256'][:16]}"
        ):
            raise ValueError("reset adjudication preserved-run path mismatch")
    return document


def adjudicate_interrupted(
    cycle_root: Path,
    artifacts_root: Path,
    run_id: str,
    decision: Literal["reject", "reset"],
) -> dict[str, object]:
    if decision not in {"reject", "reset"}:
        raise ValueError("adjudication decision must be reject or reset")
    manifest, manifest_sha256, membership = _load_experiment(cycle_root, artifacts_root)
    model = _model_for_run(run_id)
    run_dir = Path(artifacts_root) / "runs" / model.run_id
    if not run_dir.exists():
        existing = _load_adjudication(artifacts_root, model.run_id, manifest_sha256)
        if existing is not None and existing["decision"] == "reset":
            moved_to = Path(artifacts_root) / str(existing["movedTo"])
            if moved_to.is_dir():
                return dict(existing)
        raise FileNotFoundError(f"interrupted run directory does not exist: {run_dir}")
    try:
        _validate_run(
            cycle_root,
            artifacts_root,
            model,
            manifest,
            manifest_sha256,
            membership,
        )
    except (OSError, ValueError):
        pass
    else:
        raise ValueError("complete valid runs cannot be rejected or reset")
    for candidate in _candidates_for_run(model.run_id):
        if candidate_record_path(artifacts_root, candidate.candidate_id).exists():
            raise StageBlockedError("cannot adjudicate a run after candidate evidence exists")
    if (Path(artifacts_root) / "selection" / "selection.json").exists():
        raise StageBlockedError("cannot adjudicate a run after selection publication")

    run_tree_sha256 = _run_tree_sha256(run_dir)
    moved_to: str | None = None
    if decision == "reset":
        moved_relative = Path("interrupted") / f"{model.run_id}-{run_tree_sha256[:16]}"
        moved_to = moved_relative.as_posix()
    document = {
        "schemaVersion": 1,
        "cycleId": CYCLE_ID,
        "experimentId": EXPERIMENT_ID,
        "runId": model.run_id,
        "decision": decision,
        "experimentManifestSha256": manifest_sha256,
        "gitRevision": _git_revision(),
        "runTreeSha256": run_tree_sha256,
        "movedTo": moved_to,
    }
    publish_no_replace(_adjudication_path(artifacts_root, model.run_id), document)
    if decision == "reset":
        destination = Path(artifacts_root) / str(moved_to)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            if _run_tree_sha256(destination) != run_tree_sha256:
                raise ValueError("preserved interrupted-run evidence digest mismatch")
            if run_dir.exists():
                raise ValueError("both active and preserved interrupted run directories exist")
        else:
            os.rename(run_dir, destination)
    return document


def _validated_cycle_data_roots(
    cycle_root: Path,
    raw_root: Path | None = None,
    labels_root: Path | None = None,
) -> CycleDataRoots:
    roots = resolve_cycle_data_roots(cycle_root)
    for requested, expected, name in (
        (raw_root, roots.parent_raw_root, "raw root"),
        (labels_root, roots.parent_labels_root, "labels root"),
    ):
        if requested is None:
            continue
        candidate = Path(requested)
        if (
            not candidate.is_dir()
            or candidate.is_symlink()
            or candidate.resolve(strict=True) != expected
        ):
            raise ValueError(f"cycle {name} must equal the resolved parent {name}")
    return roots


def run_model(
    cycle_root: Path,
    artifacts_root: Path,
    raw_root: Path,
    labels_root: Path,
    duplicate_reviews: Path,
    run_id: str,
) -> dict[str, object]:
    _require_clean_tracked_worktree()
    cycle_data_roots = _validated_cycle_data_roots(
        cycle_root, raw_root, labels_root
    )
    manifest, manifest_sha256, membership = _load_experiment(cycle_root, artifacts_root)
    model = _model_for_run(run_id)
    adjudication = _load_adjudication(artifacts_root, model.run_id, manifest_sha256)
    if adjudication is not None and adjudication["decision"] == "reject":
        raise StageBlockedError("run was terminally rejected by explicit adjudication")
    run_dir = Path(artifacts_root) / "runs" / model.run_id
    if run_dir.exists():
        evidence = _validate_run(
            cycle_root,
            artifacts_root,
            model,
            manifest,
            manifest_sha256,
            membership,
        )
        return {
            "schemaVersion": 1,
            "status": "REUSED",
            "runId": model.run_id,
            "runDirectory": str(evidence.run_dir),
            "checkpointSha256": evidence.checkpoint_sha256,
            "devPredictionsSha256": evidence.predictions_sha256,
        }

    from .train import run_training

    config_directory = Path(artifacts_root) / "experiment" / ".runtime-configs"
    config_directory.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{model.run_id}.",
        suffix=".yaml",
        dir=config_directory,
    )
    os.close(descriptor)
    temporary_path = Path(temporary_name)
    try:
        temporary_path.write_text(
            yaml.safe_dump(model.effective_config, sort_keys=False),
            encoding="utf-8",
        )
        run_training(
            config_path=temporary_path,
            raw_root=Path(raw_root),
            labels_root=Path(labels_root),
            splits_root=Path(cycle_root) / "splits",
            duplicate_reviews=Path(duplicate_reviews),
            artifacts_root=Path(artifacts_root) / "runs",
            run_id=model.run_id,
            working_membership=membership,
            experiment_manifest_sha256=manifest_sha256,
            cycle_data_roots=cycle_data_roots,
        )
    finally:
        temporary_path.unlink(missing_ok=True)
        try:
            config_directory.rmdir()
        except OSError:
            pass
    evidence = _validate_run(
        cycle_root,
        artifacts_root,
        model,
        manifest,
        manifest_sha256,
        membership,
    )
    return {
        "schemaVersion": 1,
        "status": "COMPLETED",
        "runId": model.run_id,
        "runDirectory": str(evidence.run_dir),
        "checkpointSha256": evidence.checkpoint_sha256,
        "devPredictionsSha256": evidence.predictions_sha256,
    }


def _dev_batch_shapes(
    cycle_data_roots: CycleDataRoots,
    membership: WorkingMembership,
) -> dict[str, tuple[int, int]]:
    shapes: dict[str, tuple[int, int]] = {}
    for batch_id in membership.dev_ids:
        raw_root, labels_root = cycle_data_roots.roots_for(batch_id)
        manifest = load_manifest(Path(raw_root) / batch_id / "manifest.json")
        label = load_label(Path(labels_root) / f"{batch_id}.json")
        if manifest.batch_id != batch_id or label.batch_id != batch_id:
            raise ValueError(f"dev batch identity mismatch for {batch_id}")
        if label.status != "complete":
            raise StageBlockedError(f"dev label is not complete: {batch_id}")
        query_count = len(manifest.images_new)
        expected_queries = set(range(query_count))
        observed_queries = {match.new_index for match in label.matches}
        if observed_queries != expected_queries or len(label.matches) != query_count:
            raise StageBlockedError(f"dev label query coverage mismatch: {batch_id}")
        reference_indices = {entry.index for entry in manifest.images}
        if any(match.img_index not in reference_indices for match in label.matches):
            raise StageBlockedError(f"dev label target is outside manifest references: {batch_id}")
        shapes[batch_id] = (len(manifest.images), query_count)
    if set(shapes) != set(membership.dev_ids):
        raise RuntimeError("dev shape inventory does not match working membership")
    return shapes


def _thresholds_document(thresholds: Thresholds) -> dict[str, float]:
    return {
        "minSimilarity": thresholds.min_similarity,
        "minMargin": thresholds.min_margin,
    }


def _metrics_document(raw: MetricSummary, thresholded: MetricSummary) -> dict[str, object]:
    if thresholded.accepted_count + thresholded.abstention_count != thresholded.query_count:
        raise ValueError("calibrated dev metrics do not reconcile")
    return {
        "queryCount": thresholded.query_count,
        "batchCount": thresholded.batch_count,
        "acceptedCount": thresholded.accepted_count,
        "abstainedCount": thresholded.abstention_count,
        "acceptedRate": (
            thresholded.accepted_count / thresholded.query_count
            if thresholded.query_count
            else 0.0
        ),
        "acceptedAccuracy": thresholded.accepted_accuracy,
        "wrongAcceptedCount": thresholded.accepted_wrong_count,
        "top1Accuracy": raw.top1_accuracy,
        "batchExactMatch": raw.batch_exact_match,
    }


def _candidate_document(
    candidate: CandidateSpec,
    run: RunEvidence,
    experiment_manifest: Mapping[str, object],
    experiment_manifest_sha256: str,
    membership: WorkingMembership,
    thresholds: Thresholds,
    *,
    batch_shapes: Mapping[str, tuple[int, int]] | None,
) -> dict[str, object]:
    raw = summarize_predictions(run.predictions, batch_shapes=batch_shapes)
    calibrated_rows = apply_thresholds(
        run.predictions,
        thresholds,
        batch_shapes=dict(batch_shapes) if batch_shapes is not None else None,
    )
    calibrated = summarize_predictions(calibrated_rows, batch_shapes=batch_shapes)
    acquired_rows = tuple(
        row for row in calibrated_rows if row.batch_id in set(membership.acquired_dev_ids)
    )
    acquired_shapes = (
        {batch_id: batch_shapes[batch_id] for batch_id in membership.acquired_dev_ids}
        if batch_shapes is not None
        else None
    )
    acquired = summarize_predictions(acquired_rows, batch_shapes=acquired_shapes)
    if calibrated.accepted_wrong_count:
        raise ValueError("candidate calibration accepted a wrong dev prediction")
    if calibrated.accepted_count == 0:
        raise ValueError("candidate calibration fully abstains")
    dataset = _mapping(experiment_manifest["datasetVersion"], "manifest datasetVersion")
    splits = _mapping(dataset["splits"], "manifest datasetVersion.splits")
    calibration_evidence = {
        "policy": candidate.calibration_policy,
        "thresholds": _thresholds_document(thresholds),
        "allDevMetrics": _metrics_document(raw, calibrated),
        "acquiredDevWrongAcceptedCount": acquired.accepted_wrong_count,
    }
    return {
        "schemaVersion": 1,
        "cycleId": CYCLE_ID,
        "experimentId": EXPERIMENT_ID,
        "datasetId": DATASET_ID,
        "candidateId": candidate.candidate_id,
        "runId": candidate.run_id,
        "calibrationPolicy": candidate.calibration_policy,
        "thresholds": _thresholds_document(thresholds),
        "allDevMetrics": _metrics_document(raw, calibrated),
        "acquiredDevWrongAcceptedCount": acquired.accepted_wrong_count,
        "calibrationSha256": hashlib.sha256(
            _canonical_json_bytes(calibration_evidence)
        ).hexdigest(),
        "provenance": {
            "experimentManifestSha256": experiment_manifest_sha256,
            "datasetVersionSha256": dataset["sha256"],
            "trainSplitSha256": _mapping(splits["train"], "train split")["sha256"],
            "devSplitSha256": _mapping(splits["dev"], "dev split")["sha256"],
            "devPredictionsSha256": run.predictions_sha256,
            "checkpointSha256": run.checkpoint_sha256,
            "effectiveConfigSha256": candidate.effective_config_sha256,
            "gitRevision": experiment_manifest["gitRevision"],
        },
    }


def _calibration_for_policy(
    policy: str,
    predictions: tuple[Prediction, ...],
    membership: WorkingMembership,
) -> CalibrationResult:
    if policy == "joint_zero_wrong":
        return calibrate_thresholds(
            predictions,
            require_zero_wrong_accepted=True,
            allow_full_abstention=False,
        )
    if policy == "partition_robust_zero_wrong":
        acquired = frozenset(membership.acquired_dev_ids)
        inherited = frozenset(membership.dev_ids) - acquired
        return calibrate_partition_robust_zero_wrong(predictions, inherited, acquired)
    raise ValueError(f"unknown calibration policy: {policy}")


def _validate_candidate(
    artifacts_root: Path,
    candidate: CandidateSpec,
    run: RunEvidence,
    experiment_manifest: Mapping[str, object],
    experiment_manifest_sha256: str,
    membership: WorkingMembership,
    batch_shapes: Mapping[str, tuple[int, int]],
) -> CandidateEvidence:
    path = candidate_record_path(artifacts_root, candidate.candidate_id)
    document = _read_mapping(path, "candidate record")
    thresholds_document = _exact_mapping(
        document.get("thresholds"),
        frozenset({"minSimilarity", "minMargin"}),
        "candidate thresholds",
    )
    values = (thresholds_document["minSimilarity"], thresholds_document["minMargin"])
    if any(
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(float(value))
        for value in values
    ):
        raise ValueError("candidate thresholds must be finite numbers")
    thresholds = Thresholds(float(values[0]), float(values[1]))
    expected_calibration = _calibration_for_policy(
        candidate.calibration_policy,
        run.predictions,
        membership,
    )
    if thresholds != expected_calibration.thresholds:
        raise ValueError("candidate thresholds are not the exact calibration-policy optimum")
    expected = _candidate_document(
        candidate,
        run,
        experiment_manifest,
        experiment_manifest_sha256,
        membership,
        thresholds,
        batch_shapes=batch_shapes,
    )
    if document != expected:
        raise ValueError("candidate record does not match immutable run evidence")
    metrics = _mapping(document["allDevMetrics"], "candidate allDevMetrics")
    return CandidateEvidence(
        spec=candidate,
        path=path,
        sha256=sha256_file(path),
        calibration_sha256=_hex64(
            document["calibrationSha256"],
            "candidate calibrationSha256",
        ),
        document=document,
        accepted_rate=float(metrics["acceptedRate"]),
        top1_accuracy=float(metrics["top1Accuracy"]),
        batch_exact_match=float(metrics["batchExactMatch"]),
        wrong_accepted_count=int(metrics["wrongAcceptedCount"]),
        acquired_dev_wrong_accepted_count=int(document["acquiredDevWrongAcceptedCount"]),
    )


def calibrate_model(
    cycle_root: Path,
    artifacts_root: Path,
    raw_root: Path,
    labels_root: Path,
    run_id: str,
) -> dict[str, object]:
    cycle_data_roots = _validated_cycle_data_roots(
        cycle_root, raw_root, labels_root
    )
    manifest, manifest_sha256, membership = _load_experiment(cycle_root, artifacts_root)
    model = _model_for_run(run_id)
    run = _validate_run(
        cycle_root,
        artifacts_root,
        model,
        manifest,
        manifest_sha256,
        membership,
    )
    batch_shapes = _dev_batch_shapes(cycle_data_roots, membership)
    shaped_raw_metrics = summarize_predictions(run.predictions, batch_shapes=batch_shapes)
    shaped_document = shaped_raw_metrics.to_json()
    unshaped_document = run.raw_metrics.to_json()
    if any(
        shaped_document[key] != unshaped_document[key]
        for key in shaped_document
        if key != "grouped_metrics"
    ):
        raise ValueError("run dev predictions do not match complete labeled dev evidence")

    published: list[dict[str, object]] = []
    for candidate in _candidates_for_run(model.run_id):
        calibration = _calibration_for_policy(
            candidate.calibration_policy,
            run.predictions,
            membership,
        )
        document = _candidate_document(
            candidate,
            run,
            manifest,
            manifest_sha256,
            membership,
            calibration.thresholds,
            batch_shapes=batch_shapes,
        )
        path = candidate_record_path(artifacts_root, candidate.candidate_id)
        publish_no_replace(path, document)
        evidence = _validate_candidate(
            artifacts_root,
            candidate,
            run,
            manifest,
            manifest_sha256,
            membership,
            batch_shapes,
        )
        published.append(
            {
                "candidateId": candidate.candidate_id,
                "path": str(path),
                "sha256": evidence.sha256,
            }
        )
    return {
        "schemaVersion": 1,
        "status": "CALIBRATED",
        "runId": model.run_id,
        "candidates": published,
    }


def _passes_dev_gate(candidate: CandidateEvidence) -> bool:
    return (
        candidate.wrong_accepted_count == 0
        and candidate.accepted_rate >= 0.65
        and candidate.top1_accuracy >= 0.99
        and candidate.batch_exact_match >= 0.95
        and candidate.acquired_dev_wrong_accepted_count == 0
    )


def _matrix_state(
    cycle_root: Path,
    artifacts_root: Path,
    experiment_manifest: Mapping[str, object],
    experiment_manifest_sha256: str,
    membership: WorkingMembership,
    cycle_data_roots: CycleDataRoots,
) -> tuple[
    dict[str, RunEvidence],
    tuple[CandidateEvidence, ...],
    tuple[str, ...],
    tuple[str, ...],
]:
    runs: dict[str, RunEvidence] = {}
    candidates: list[CandidateEvidence] = []
    rejected_runs: list[str] = []
    unresolved: list[str] = []
    batch_shapes = _dev_batch_shapes(cycle_data_roots, membership)
    for model in enumerate_model_specs():
        run_dir = Path(artifacts_root) / "runs" / model.run_id
        run: RunEvidence | None = None
        if run_dir.exists():
            try:
                run = _validate_run(
                    cycle_root,
                    artifacts_root,
                    model,
                    experiment_manifest,
                    experiment_manifest_sha256,
                    membership,
                )
            except (OSError, ValueError) as error:
                adjudication = _load_adjudication(
                    artifacts_root,
                    model.run_id,
                    experiment_manifest_sha256,
                )
                if adjudication is not None and adjudication["decision"] == "reject":
                    if _run_tree_sha256(run_dir) != adjudication["runTreeSha256"]:
                        unresolved.append(f"{model.run_id}: rejected run evidence changed")
                    else:
                        rejected_runs.append(model.run_id)
                    continue
                unresolved.append(f"{model.run_id}: invalid run ({error})")
                continue
        else:
            adjudication = _load_adjudication(
                artifacts_root,
                model.run_id,
                experiment_manifest_sha256,
            )
            if adjudication is not None and adjudication["decision"] == "reject":
                unresolved.append(f"{model.run_id}: rejected run evidence is missing")
            else:
                unresolved.append(f"{model.run_id}: run is missing")
            continue

        runs[model.run_id] = run
        for candidate in _candidates_for_run(model.run_id):
            path = candidate_record_path(artifacts_root, candidate.candidate_id)
            if not path.exists():
                unresolved.append(f"{candidate.candidate_id}: candidate record is missing")
                continue
            try:
                candidates.append(
                    _validate_candidate(
                        artifacts_root,
                        candidate,
                        run,
                        experiment_manifest,
                        experiment_manifest_sha256,
                        membership,
                        batch_shapes,
                    )
                )
            except (OSError, ValueError) as error:
                unresolved.append(f"{candidate.candidate_id}: invalid candidate ({error})")
    return (
        runs,
        tuple(candidates),
        tuple(sorted(rejected_runs)),
        tuple(unresolved),
    )


def _normalization_stats(run_dir: Path):
    from .dataset import NormalizationStats

    document = _read_mapping(run_dir / "normalization.json", "run normalization")
    _validate_normalization_document(document)
    return NormalizationStats(
        mean=tuple(float(value) for value in document["mean"]),
        std=tuple(float(value) for value in document["std"]),
    )


def _benchmark_run(
    run: RunEvidence,
    cycle_data_roots: CycleDataRoots,
    cycle_root: Path,
    membership: WorkingMembership,
) -> dict[str, object]:
    import torch

    from .dataset import load_dev_episodes
    from .model import FishingEncoder, cosine_similarity_matrix

    stats = _normalization_stats(run.run_dir)
    episodes = load_dev_episodes(
        cycle_data_roots.parent_raw_root,
        cycle_data_roots.parent_labels_root,
        Path(cycle_root) / "splits",
        stats,
        membership=membership,
        cycle_data_roots=cycle_data_roots,
    )
    if len(episodes) != 45:
        raise ValueError("latency benchmark requires exactly 45 dev episodes")
    checkpoint = _mapping(
        torch.load(
            run.run_dir / "checkpoints" / "best-dev.pt",
            map_location="cpu",
            weights_only=False,
        ),
        "checkpoint",
    )
    model = FishingEncoder(run.model.embedding_dim, run.model.config.channels)
    model.load_state_dict(checkpoint["modelStateDict"])
    model.eval()

    previous_threads = torch.get_num_threads()
    torch.set_num_threads(1)
    try:
        with torch.inference_mode():
            for index in range(10):
                episode = episodes[index % len(episodes)]
                references = model(episode.references)
                queries = model(episode.queries)
                cosine_similarity_matrix(queries, references)
            durations_ms: list[float] = []
            for index in range(100):
                episode = episodes[index % len(episodes)]
                started = time.perf_counter_ns()
                references = model(episode.references)
                queries = model(episode.queries)
                cosine_similarity_matrix(queries, references)
                ended = time.perf_counter_ns()
                durations_ms.append((ended - started) / 1_000_000.0)
    finally:
        torch.set_num_threads(previous_threads)
    ordered = sorted(durations_ms)
    p95_ms = ordered[math.ceil(0.95 * len(ordered)) - 1]
    return {
        "runId": run.model.run_id,
        "warmupCalls": 10,
        "timedCalls": 100,
        "torchThreads": 1,
        "p95Ms": p95_ms,
        "p95BucketMs": math.ceil(p95_ms),
        "maxMs": max(ordered),
    }


def _candidate_summary(candidate: CandidateEvidence) -> dict[str, object]:
    return {
        "candidateId": candidate.spec.candidate_id,
        "runId": candidate.spec.run_id,
        "candidateSha256": candidate.sha256,
        "calibrationPolicy": candidate.spec.calibration_policy,
        "acceptedRate": candidate.accepted_rate,
        "top1Accuracy": candidate.top1_accuracy,
        "batchExactMatch": candidate.batch_exact_match,
        "wrongAcceptedCount": candidate.wrong_accepted_count,
        "acquiredDevWrongAcceptedCount": candidate.acquired_dev_wrong_accepted_count,
    }


def _selection_path(artifacts_root: Path) -> Path:
    return Path(artifacts_root) / "selection" / "selection.json"


def _selection_document(
    experiment_manifest: Mapping[str, object],
    experiment_manifest_sha256: str,
    candidates: tuple[CandidateEvidence, ...],
    rejected_runs: tuple[str, ...],
    *,
    latency_evidence: tuple[Mapping[str, object], ...] = (),
    selected: CandidateEvidence | None = None,
) -> dict[str, object]:
    dataset = _mapping(experiment_manifest["datasetVersion"], "manifest datasetVersion")
    base: dict[str, object] = {
        "schemaVersion": 1,
        "cycleId": CYCLE_ID,
        "experimentId": EXPERIMENT_ID,
        "datasetId": DATASET_ID,
        "experimentManifestSha256": experiment_manifest_sha256,
        "datasetVersionSha256": dataset["sha256"],
        "completedCandidateCount": len(candidates),
        "rejectedRunIds": list(rejected_runs),
        "rejectedCandidateCount": len(rejected_runs) * 2,
        "devPromotionGate": experiment_manifest["devPromotionGate"],
    }
    if selected is None:
        base.update(
            {
                "status": "NO_CANDIDATE",
                "selected": None,
                "qualityTieCandidateIds": [],
                "latencyEvidence": [],
            }
        )
        return base
    base.update(
        {
            "status": "SELECTED",
            "selected": _candidate_summary(selected),
            "qualityTieCandidateIds": [
                candidate.spec.candidate_id
                for candidate in candidates
                if _passes_dev_gate(candidate)
                and (
                    candidate.accepted_rate,
                    candidate.top1_accuracy,
                    candidate.batch_exact_match,
                )
                == (
                    selected.accepted_rate,
                    selected.top1_accuracy,
                    selected.batch_exact_match,
                )
            ],
            "latencyEvidence": [dict(item) for item in latency_evidence],
        }
    )
    return base


def compare_candidates(
    cycle_root: Path,
    artifacts_root: Path,
    raw_root: Path,
    labels_root: Path,
) -> dict[str, object]:
    cycle_data_roots = _validated_cycle_data_roots(
        cycle_root, raw_root, labels_root
    )
    manifest, manifest_sha256, membership = _load_experiment(cycle_root, artifacts_root)
    runs, candidates, rejected_runs, unresolved = _matrix_state(
        cycle_root,
        artifacts_root,
        manifest,
        manifest_sha256,
        membership,
        cycle_data_roots,
    )
    if unresolved:
        raise StageBlockedError(
            "candidate matrix is incomplete or invalid: " + "; ".join(unresolved)
        )
    if len(candidates) + len(rejected_runs) * 2 != 48:
        raise RuntimeError("candidate matrix accounting does not equal 48")
    passing = tuple(candidate for candidate in candidates if _passes_dev_gate(candidate))
    latency_evidence: tuple[Mapping[str, object], ...] = ()
    selected: CandidateEvidence | None = None
    if passing:
        best_quality = max(
            (
                candidate.accepted_rate,
                candidate.top1_accuracy,
                candidate.batch_exact_match,
            )
            for candidate in passing
        )
        quality_ties = tuple(
            candidate
            for candidate in passing
            if (
                candidate.accepted_rate,
                candidate.top1_accuracy,
                candidate.batch_exact_match,
            )
            == best_quality
        )
        if len(quality_ties) == 1:
            selected = quality_ties[0]
        else:
            evidence_by_run = {
                run_id: _benchmark_run(
                    runs[run_id],
                    cycle_data_roots,
                    cycle_root,
                    membership,
                )
                for run_id in sorted({candidate.spec.run_id for candidate in quality_ties})
            }
            latency_evidence = tuple(evidence_by_run[run_id] for run_id in sorted(evidence_by_run))
            selected = min(
                quality_ties,
                key=lambda candidate: (
                    int(evidence_by_run[candidate.spec.run_id]["p95BucketMs"]),
                    candidate.spec.candidate_id.encode("utf-8"),
                ),
            )
    selection = _selection_document(
        manifest,
        manifest_sha256,
        candidates,
        rejected_runs,
        latency_evidence=latency_evidence,
        selected=selected,
    )
    path = _selection_path(artifacts_root)
    publish_no_replace(path, selection)
    return {
        "schemaVersion": 1,
        "status": selection["status"],
        "path": str(path),
        "sha256": sha256_file(path),
        "selectedCandidateId": (
            selected.spec.candidate_id if selected is not None else None
        ),
    }


def _validate_selection(
    artifacts_root: Path,
    manifest: Mapping[str, object],
    manifest_sha256: str,
    candidates: tuple[CandidateEvidence, ...],
    rejected_runs: tuple[str, ...],
) -> Mapping[str, object] | None:
    path = _selection_path(artifacts_root)
    if not path.exists():
        return None
    document = _read_mapping(path, "selection")
    passing = tuple(candidate for candidate in candidates if _passes_dev_gate(candidate))
    if not passing:
        expected = _selection_document(
            manifest,
            manifest_sha256,
            candidates,
            rejected_runs,
        )
        if document != expected:
            raise ValueError("NO_CANDIDATE selection record mismatch")
        return document

    best_quality = max(
        (
            candidate.accepted_rate,
            candidate.top1_accuracy,
            candidate.batch_exact_match,
        )
        for candidate in passing
    )
    quality_ties = tuple(
        candidate
        for candidate in passing
        if (
            candidate.accepted_rate,
            candidate.top1_accuracy,
            candidate.batch_exact_match,
        )
        == best_quality
    )
    if document.get("status") != "SELECTED":
        raise ValueError("selection status must be SELECTED when a candidate passes")
    selected_document = _mapping(document.get("selected"), "selection.selected")
    selected_ids = {
        candidate.spec.candidate_id: candidate for candidate in quality_ties
    }
    selected_id = selected_document.get("candidateId")
    if selected_id not in selected_ids:
        raise ValueError("selected candidate is not in the best quality tier")
    latency_values = document.get("latencyEvidence")
    if not isinstance(latency_values, list):
        raise ValueError("selection latencyEvidence must be a list")
    if len(quality_ties) == 1:
        if latency_values:
            raise ValueError("latency must not be benchmarked without a quality tie")
        expected_selected = quality_ties[0]
    else:
        evidence_by_run: dict[str, Mapping[str, object]] = {}
        for value in latency_values:
            evidence = _exact_mapping(
                value,
                frozenset(
                    {
                        "runId",
                        "warmupCalls",
                        "timedCalls",
                        "torchThreads",
                        "p95Ms",
                        "p95BucketMs",
                        "maxMs",
                    }
                ),
                "latency evidence",
            )
            run_id = evidence.get("runId")
            bucket = evidence.get("p95BucketMs")
            p95_ms = evidence.get("p95Ms")
            max_ms = evidence.get("maxMs")
            if (
                not isinstance(run_id, str)
                or isinstance(bucket, bool)
                or not isinstance(bucket, int)
                or bucket < 0
                or isinstance(p95_ms, bool)
                or not isinstance(p95_ms, (int, float))
                or not math.isfinite(float(p95_ms))
                or float(p95_ms) < 0
                or isinstance(max_ms, bool)
                or not isinstance(max_ms, (int, float))
                or not math.isfinite(float(max_ms))
                or float(max_ms) < float(p95_ms)
                or bucket != math.ceil(float(p95_ms))
                or evidence.get("warmupCalls") != 10
                or evidence.get("timedCalls") != 100
                or evidence.get("torchThreads") != 1
            ):
                raise ValueError("latency evidence contract is invalid")
            if run_id in evidence_by_run:
                raise ValueError("latency evidence contains duplicate run ids")
            evidence_by_run[run_id] = evidence
        expected_runs = {candidate.spec.run_id for candidate in quality_ties}
        if set(evidence_by_run) != expected_runs:
            raise ValueError("latency evidence does not cover exact quality-tied runs")
        expected_selected = min(
            quality_ties,
            key=lambda candidate: (
                int(evidence_by_run[candidate.spec.run_id]["p95BucketMs"]),
                candidate.spec.candidate_id.encode("utf-8"),
            ),
        )
    expected = _selection_document(
        manifest,
        manifest_sha256,
        candidates,
        rejected_runs,
        latency_evidence=tuple(_mapping(item, "latency evidence") for item in latency_values),
        selected=expected_selected,
    )
    if document != expected:
        raise ValueError("selection record does not match candidate evidence and tie-break rules")
    return document


def verify_experiment(cycle_root: Path, artifacts_root: Path) -> dict[str, object]:
    cycle_data_roots = resolve_cycle_data_roots(cycle_root)
    manifest, manifest_sha256, membership = _load_experiment(cycle_root, artifacts_root)
    runs, candidates, rejected_runs, unresolved = _matrix_state(
        cycle_root,
        artifacts_root,
        manifest,
        manifest_sha256,
        membership,
        cycle_data_roots,
    )
    if unresolved:
        raise StageBlockedError(
            "experiment matrix is incomplete or invalid: " + "; ".join(unresolved)
        )
    if len(candidates) + len(rejected_runs) * 2 != 48:
        raise RuntimeError("verified candidate accounting does not equal 48")
    selection = _validate_selection(
        artifacts_root,
        manifest,
        manifest_sha256,
        candidates,
        rejected_runs,
    )
    return {
        "schemaVersion": 1,
        "status": selection["status"] if selection is not None else "READY_FOR_COMPARE",
        "experimentManifestSha256": manifest_sha256,
        "completedRunCount": len(runs),
        "rejectedRunCount": len(rejected_runs),
        "completedCandidateCount": len(candidates),
        "rejectedCandidateCount": len(rejected_runs) * 2,
        "selectionSha256": (
            sha256_file(_selection_path(artifacts_root)) if selection is not None else None
        ),
    }


def freeze_selected_candidate(
    cycle_root: Path,
    artifacts_root: Path,
    raw_root: Path,
    labels_root: Path,
) -> dict[str, object]:
    cycle_data_roots = _validated_cycle_data_roots(
        cycle_root, raw_root, labels_root
    )
    manifest, manifest_sha256, membership = _load_experiment(cycle_root, artifacts_root)
    runs, candidates, rejected_runs, unresolved = _matrix_state(
        cycle_root,
        artifacts_root,
        manifest,
        manifest_sha256,
        membership,
        cycle_data_roots,
    )
    if unresolved:
        raise StageBlockedError(
            "cannot freeze an incomplete or invalid experiment: " + "; ".join(unresolved)
        )
    selection = _validate_selection(
        artifacts_root,
        manifest,
        manifest_sha256,
        candidates,
        rejected_runs,
    )
    if selection is None or selection.get("status") != "SELECTED":
        raise StageBlockedError("freeze requires one immutable selected candidate")
    selected = _mapping(selection.get("selected"), "selection.selected")
    selected_id = selected.get("candidateId")
    if not isinstance(selected_id, str):
        raise ValueError("selected candidate id is invalid")
    matches = [candidate for candidate in candidates if candidate.spec.candidate_id == selected_id]
    if len(matches) != 1:
        raise ValueError("selected candidate does not resolve uniquely")
    candidate = matches[0]
    run = runs.get(candidate.spec.run_id)
    if run is None:
        raise ValueError("selected candidate run is not complete")

    from .artifacts import freeze_cycle_run, verify_cycle_freeze

    frozen_dir = Path(artifacts_root) / "frozen"
    freeze_cycle_run(
        run_dir=run.run_dir,
        frozen_dir=frozen_dir,
        raw_root=raw_root,
        labels_root=labels_root,
        cycle_root=cycle_root,
        experiment_manifest_path=experiment_manifest_path(artifacts_root),
        selection_path=_selection_path(artifacts_root),
        candidate_path=candidate.path,
        cycle_data_roots=cycle_data_roots,
    )
    frozen = verify_cycle_freeze(frozen_dir)
    return {
        "schemaVersion": 1,
        "status": "FROZEN",
        "frozenDirectory": str(frozen_dir),
        "runId": frozen.run_id,
        "candidateId": frozen.candidate_id,
        "freezeManifestSha256": sha256_file(frozen_dir / "freeze-manifest.json"),
        "files": dict(frozen.files),
    }


def verify_frozen_cycle(artifacts_root: Path) -> dict[str, object]:
    from .artifacts import verify_cycle_freeze

    frozen_dir = Path(artifacts_root) / "frozen"
    frozen = verify_cycle_freeze(frozen_dir)
    return {
        "schemaVersion": 1,
        "status": "VALID",
        "runId": frozen.run_id,
        "candidateId": frozen.candidate_id,
        "freezeManifestSha256": sha256_file(frozen_dir / "freeze-manifest.json"),
        "files": dict(frozen.files),
    }


def _cycle_gate_policy_path() -> Path:
    return (
        Path(__file__).resolve().parents[2]
        / "config"
        / "phase2"
        / "coverage-recovery-gate.yaml"
    )


def _tracked_status_bytes() -> bytes:
    try:
        completed = subprocess.run(
            ["git", "status", "--porcelain=v1", "--untracked-files=no"],
            check=True,
            capture_output=True,
        )
    except (OSError, subprocess.CalledProcessError) as error:
        raise RuntimeError("cannot inspect tracked Git status") from error
    return completed.stdout


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def final_preflight(
    cycle_root: Path,
    artifacts_root: Path,
) -> dict[str, object]:
    from .artifacts import verify_cycle_freeze
    from .evaluate import load_cycle_final_command_record
    from .phase2_cycle import verify_prefinal_integrity

    cycle_data_root = Path(cycle_root).resolve()
    artifact_root = Path(artifacts_root).resolve()
    if not cycle_data_root.is_dir() or cycle_data_root.is_symlink():
        raise ValueError("cycle root must be a real directory")
    if not artifact_root.is_dir() or artifact_root.is_symlink():
        raise ValueError("cycle artifact root must be a real directory")
    final_root = artifact_root / "final"
    if os.path.lexists(final_root):
        if final_root.is_symlink() or not final_root.is_dir():
            raise ValueError("cycle final output path must be a real directory")
    lock_path = final_root / "final-evaluation.lock"
    final_report_path = final_root / "final-evaluation.json"
    gate_report_path = final_root / "gate-final.json"
    for path in (lock_path, final_report_path, gate_report_path):
        if os.path.lexists(path):
            raise StageBlockedError(
                f"cycle final output already exists or is unresolved: {path}"
            )

    experiment_state = verify_experiment(cycle_data_root, artifact_root)
    if experiment_state.get("status") != "SELECTED":
        raise StageBlockedError("cycle final requires one immutable selected candidate")
    frozen_root = artifact_root / "frozen"
    frozen = verify_cycle_freeze(frozen_root)
    if (
        frozen.cycle_id != CYCLE_ID
        or frozen.experiment_id != EXPERIMENT_ID
        or frozen.dataset_id != DATASET_ID
    ):
        raise ValueError("cycle final frozen identity mismatch")
    if experiment_state.get("experimentManifestSha256") != frozen.experiment_manifest_sha256:
        raise ValueError("cycle final experiment/freeze digest mismatch")
    if experiment_state.get("selectionSha256") != frozen.selection_sha256:
        raise ValueError("cycle final selection/freeze digest mismatch")
    current_revision = _git_revision()
    if not revision_matches_recorded(current_revision, frozen.git_revision):
        raise StageBlockedError("cycle final Git revision is incompatible with freeze")

    policy_path = _regular_file(
        _cycle_gate_policy_path(),
        "cycle gate policy",
    ).resolve()
    policy = load_gate_policy(policy_path)
    if (
        policy.schema_version != 2
        or policy.pre_agreed_placeholders
        or policy.cycle_id != frozen.cycle_id
        or policy.experiment_id != frozen.experiment_id
        or policy.dataset_id != frozen.dataset_id
    ):
        raise GateBlockedError("cycle final gate policy is not approved for this freeze")

    integrity = verify_prefinal_integrity(cycle_data_root)
    snapshot = _exact_mapping(
        read_json(frozen_root / "dataset-snapshot.json"),
        frozenset(
            {
                "schemaVersion",
                "cycleId",
                "datasetId",
                "datasetVersionSha256",
                "batches",
                "sealedFinal",
            }
        ),
        "cycle frozen dataset snapshot",
    )
    sealed_final = _exact_mapping(
        snapshot["sealedFinal"],
        frozenset({"path", "count", "sizeBytes", "sha256"}),
        "cycle frozen sealed final",
    )
    opaque_final = {
        "count": integrity.final_count,
        "sizeBytes": integrity.final_size_bytes,
        "sha256": integrity.final_sha256,
    }
    if dict(sealed_final) != {"path": "splits/sealed-final.txt", **opaque_final}:
        raise ValueError("cycle final opaque commitment does not match freeze")

    dataset_version_path = _regular_file(
        cycle_data_root / "dataset-version.json",
        "cycle dataset version",
    )
    allocation_path = _regular_file(
        cycle_data_root / "allocation.json",
        "cycle allocation",
    )
    tracked_status = _tracked_status_bytes()
    if tracked_status:
        raise StageBlockedError("cycle final requires a clean tracked worktree")
    evidence = {
        "gitRevision": current_revision,
        "trackedStatusSha256": hashlib.sha256(tracked_status).hexdigest(),
        "freezeManifestSha256": sha256_file(frozen_root / "freeze-manifest.json"),
        "gatePolicySha256": sha256_file(policy_path),
        "datasetVersionSha256": sha256_file(dataset_version_path),
        "allocationSha256": sha256_file(allocation_path),
        "opaqueFinal": opaque_final,
    }
    if evidence["datasetVersionSha256"] != frozen.dataset_version_sha256:
        raise ValueError("cycle final dataset-version digest does not match freeze")

    command_path = final_root / "final-command.json"
    if os.path.lexists(command_path):
        command = load_cycle_final_command_record(final_root)
        if command["evidence"] != evidence:
            raise ValueError("existing cycle final command evidence is stale")
    else:
        final_root.mkdir(mode=0o700, exist_ok=True)
        if final_root.is_symlink() or not final_root.is_dir():
            raise ValueError("cycle final output path must be a real directory")
        authorization = secrets.token_urlsafe(32)
        executable = str(Path(sys.executable).resolve())
        arguments = [
            "-m",
            "fishing_ml.coverage_recovery",
            "final-run",
            "--cycle-root",
            str(cycle_data_root),
            "--artifacts-root",
            str(artifact_root),
            "--authorization",
            authorization,
        ]
        command = {
            "schemaVersion": 1,
            "cycle": {
                "cycleId": CYCLE_ID,
                "experimentId": EXPERIMENT_ID,
                "datasetId": DATASET_ID,
            },
            "createdAt": _utc_now(),
            "authorization": authorization,
            "executable": executable,
            "arguments": arguments,
            "paths": {
                "cycleRoot": str(cycle_data_root),
                "artifactsRoot": str(artifact_root),
                "frozenDir": str(frozen_root),
                "gatePolicy": str(policy_path),
                "finalOutputDir": str(final_root),
                "lock": str(lock_path),
                "finalReport": str(final_report_path),
                "gateReport": str(gate_report_path),
            },
            "evidence": evidence,
        }
        publish_no_replace(command_path, command)
        command = load_cycle_final_command_record(final_root)
    if (
        Path(command["paths"]["cycleRoot"]).resolve() != cycle_data_root
        or Path(command["paths"]["artifactsRoot"]).resolve() != artifact_root
    ):
        raise ValueError("cycle final command record path mismatch")
    command_vector = [command["executable"], *command["arguments"]]
    return {
        "schemaVersion": 1,
        "status": "READY_FOR_AUTHORIZATION",
        "cycleId": CYCLE_ID,
        "commandRecord": str(command_path),
        "commandRecordSha256": sha256_file(command_path),
        "authorization": command["authorization"],
        "command": shlex.join(command_vector),
        "outputs": {
            "lock": str(lock_path),
            "finalReport": str(final_report_path),
            "gateReport": str(gate_report_path),
        },
    }


def run_cycle_final(
    cycle_root: Path,
    artifacts_root: Path,
    authorization: str,
) -> dict[str, object]:
    from .evaluate import evaluate_cycle_final_once, load_cycle_final_command_record

    cycle_data_root = Path(cycle_root).resolve()
    artifact_root = Path(artifacts_root).resolve()
    final_root = artifact_root / "final"
    command = load_cycle_final_command_record(final_root)
    if (
        Path(command["paths"]["cycleRoot"]).resolve() != cycle_data_root
        or Path(command["paths"]["artifactsRoot"]).resolve() != artifact_root
    ):
        raise ValueError("cycle final invocation does not match command record")
    expected_authorization = command["authorization"]
    if not isinstance(expected_authorization, str):
        raise ValueError("cycle final command authorization is invalid")
    return evaluate_cycle_final_once(
        frozen_dir=artifact_root / "frozen",
        cycle_root=cycle_data_root,
        final_output_dir=final_root,
        authorization=authorization,
        expected_authorization=expected_authorization,
    )


def _require_free_loopback_port(port: int) -> None:
    if isinstance(port, bool) or not isinstance(port, int) or not 1024 <= port <= 65535:
        raise ValueError("replay port must be an integer from 1024 through 65535")
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        probe.bind(("127.0.0.1", port))
    except OSError as error:
        raise StageBlockedError("approved replay loopback port is not free") from error
    finally:
        probe.close()


def _port_is_open(port: int) -> bool:
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    probe.settimeout(0.2)
    try:
        return probe.connect_ex(("127.0.0.1", port)) == 0
    finally:
        probe.close()


def _wait_for_port_open(
    process: subprocess.Popen[bytes],
    port: int,
    timeout_seconds: float,
) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if process.poll() is not None:
            return False
        if _port_is_open(port):
            return True
        time.sleep(0.1)
    return False


def _wait_for_port_closed(port: int, timeout_seconds: float) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if not _port_is_open(port):
            return True
        time.sleep(0.1)
    return not _port_is_open(port)


def _utc_text(value: object, field: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{field} must be a UTC ISO-8601 string")
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        timestamp = datetime.fromisoformat(normalized)
    except ValueError as error:
        raise ValueError(f"{field} must be a UTC ISO-8601 string") from error
    if timestamp.tzinfo is None or timestamp.utcoffset() != timezone.utc.utcoffset(timestamp):
        raise ValueError(f"{field} must be a UTC ISO-8601 string")
    return value


def _replay_prerequisites(
    cycle_root: Path,
    artifacts_root: Path,
) -> dict[str, object]:
    from .artifacts import verify_cycle_freeze
    from .phase2_cycle import (
        commit_ids,
        load_final_membership_after_lock,
        load_working_membership,
        parse_quarantine,
    )
    from .phase2_gate import adjudicate_final

    cycle_root_path = Path(cycle_root)
    artifact_root_path = Path(artifacts_root)
    final_root_path = artifact_root_path / "final"
    lock_path = final_root_path / "final-evaluation.lock"
    final_report_path = final_root_path / "final-evaluation.json"
    final_gate_path = final_root_path / "gate-final.json"
    if not all(os.path.lexists(path) for path in (lock_path, final_report_path, final_gate_path)):
        raise StageBlockedError("replay requires complete final PASS evidence")
    if not cycle_root_path.is_dir() or cycle_root_path.is_symlink():
        raise ValueError("cycle root must be a real directory")
    if not artifact_root_path.is_dir() or artifact_root_path.is_symlink():
        raise ValueError("cycle artifact root must be a real directory")
    cycle_data_root = cycle_root_path.resolve()
    artifact_root = artifact_root_path.resolve()
    final_root = artifact_root / "final"
    lock_path = final_root / "final-evaluation.lock"
    final_report_path = final_root / "final-evaluation.json"
    final_gate_path = final_root / "gate-final.json"
    if os.path.lexists(artifact_root / "local-shadow"):
        raise StageBlockedError("replay cannot run after local-shadow output exists")

    frozen_root = artifact_root / "frozen"
    frozen = verify_cycle_freeze(frozen_root)
    if (
        frozen.cycle_id != CYCLE_ID
        or frozen.experiment_id != EXPERIMENT_ID
        or frozen.dataset_id != DATASET_ID
    ):
        raise ValueError("replay frozen identity mismatch")
    current_revision = _git_revision()
    if not revision_matches_recorded(current_revision, frozen.git_revision):
        raise StageBlockedError("replay Git revision is incompatible with freeze")
    policy_path = _regular_file(_cycle_gate_policy_path(), "cycle gate policy").resolve()
    policy = load_gate_policy(policy_path)
    if (
        policy.schema_version != 2
        or policy.pre_agreed_placeholders
        or policy.cycle_id != frozen.cycle_id
        or policy.experiment_id != frozen.experiment_id
        or policy.dataset_id != frozen.dataset_id
    ):
        raise GateBlockedError("replay gate policy is not approved for this freeze")

    lock_file = _regular_file(lock_path, "cycle final lock")
    lock_text = lock_file.read_text(encoding="utf-8")
    if len(lock_text.encode("utf-8")) > 4096:
        raise ValueError("cycle final lock is too large")
    lock_fields: dict[str, str] = {}
    for line in lock_text.splitlines():
        key, separator, value = line.partition("=")
        if not separator or key in lock_fields:
            raise ValueError("cycle final lock fields are invalid")
        lock_fields[key] = value
    if set(lock_fields) != {"run_id", "pid", "started_at"}:
        raise ValueError("cycle final lock fields mismatch")
    if lock_fields["run_id"] != frozen.run_id or not lock_fields["pid"].isdigit():
        raise ValueError("cycle final lock identity mismatch")
    _utc_text(lock_fields["started_at"], "cycle final lock started_at")

    final_report = _exact_mapping(
        _read_mapping(final_report_path, "cycle final report"),
        frozenset(
            {
                "schemaVersion",
                "cycle",
                "split",
                "batchCount",
                "runId",
                "candidateId",
                "freezeManifestSha256",
                "loss",
                "metrics",
                "baselines",
                "predictions",
            }
        ),
        "cycle final report",
    )
    final_cycle = _exact_mapping(
        final_report["cycle"],
        frozenset({"cycleId", "experimentId", "datasetId"}),
        "cycle final report identity",
    )
    expected_cycle = {
        "cycleId": CYCLE_ID,
        "experimentId": EXPERIMENT_ID,
        "datasetId": DATASET_ID,
    }
    freeze_manifest_sha256 = sha256_file(frozen_root / "freeze-manifest.json")
    if (
        final_report["schemaVersion"] != 2
        or final_report["split"] != "final"
        or final_report["batchCount"] != 30
        or final_report["runId"] != frozen.run_id
        or final_report["candidateId"] != frozen.candidate_id
        or final_report["freezeManifestSha256"] != freeze_manifest_sha256
        or dict(final_cycle) != expected_cycle
        or not isinstance(final_report["metrics"], Mapping)
        or not isinstance(final_report["predictions"], list)
    ):
        raise ValueError("cycle final report identity or shape mismatch")
    final_report_sha256 = sha256_file(final_report_path)
    policy_sha256 = sha256_file(policy_path)
    expected_gate = adjudicate_final(
        policy,
        {"metrics": final_report["metrics"]},
        policy_sha256=policy_sha256,
        evidence_sha256=final_report_sha256,
    ).to_dict()
    final_gate = _read_mapping(final_gate_path, "cycle final gate report")
    if final_gate != expected_gate:
        raise ValueError("cycle final gate report does not reconcile")
    if final_gate.get("status") != "pass":
        raise StageBlockedError("replay requires final gate PASS")

    working = load_working_membership(cycle_data_root)
    final_ids = load_final_membership_after_lock(cycle_data_root, lock_file)
    membership = tuple(sorted((*working.train_ids, *working.dev_ids, *final_ids)))
    if (
        len(membership) != 260
        or len(set(membership)) != 260
        or commit_ids(membership) != working.source_commitment
    ):
        raise ValueError("replay successor membership does not reconcile")
    quarantine = parse_quarantine(
        read_json(_regular_file(cycle_data_root / "quarantine.json", "cycle quarantine"))
    )
    if set(membership).intersection(quarantine.batch_ids):
        raise ValueError("replay membership contains quarantined parent-final ids")

    cycle_data_roots = resolve_cycle_data_roots(cycle_data_root)
    return {
        "cycleRoot": cycle_data_root,
        "artifactsRoot": artifact_root,
        "frozenRoot": frozen_root,
        "frozen": frozen,
        "policyPath": policy_path,
        "policy": policy,
        "rawRoot": cycle_data_roots.parent_raw_root,
        "labelsRoot": cycle_data_roots.parent_labels_root,
        "cycleDataRoots": cycle_data_roots,
        "membership": membership,
        "finalReportSha256": final_report_sha256,
        "finalGateSha256": sha256_file(final_gate_path),
        "freezeManifestSha256": freeze_manifest_sha256,
        "policySha256": policy_sha256,
        "membershipSha256": commit_ids(membership).sha256,
    }


def _replay_output_paths(artifacts_root: Path) -> dict[str, Path]:
    replay_root = Path(artifacts_root) / "replay"
    return {
        "root": replay_root,
        "command": replay_root / "replay-command.json",
        "report": replay_root / "replay.json",
        "gate": replay_root / "gate-replay.json",
        "pid": replay_root / "service-pid.json",
        "log": replay_root / "service.log",
    }


def _assert_replay_output_absence(paths: Mapping[str, Path]) -> None:
    for name in ("report", "gate", "pid", "log"):
        path = paths[name]
        if os.path.lexists(path):
            raise StageBlockedError(f"replay output already exists or is unresolved: {path}")


def _load_replay_command_record(replay_root: Path) -> Mapping[str, object]:
    replay_root_path = Path(replay_root)
    if not replay_root_path.is_dir() or replay_root_path.is_symlink():
        raise ValueError("cycle replay output path must be a real directory")
    root = replay_root_path.resolve()
    document = _exact_mapping(
        _read_mapping(root / "replay-command.json", "cycle replay command"),
        frozenset(
            {
                "schemaVersion",
                "cycle",
                "createdAt",
                "executable",
                "arguments",
                "service",
                "paths",
                "evidence",
            }
        ),
        "cycle replay command",
    )
    if document["schemaVersion"] != 1 or isinstance(document["schemaVersion"], bool):
        raise ValueError("cycle replay command schemaVersion must equal 1")
    cycle = _exact_mapping(
        document["cycle"],
        frozenset({"cycleId", "experimentId", "datasetId"}),
        "cycle replay command identity",
    )
    if dict(cycle) != {
        "cycleId": CYCLE_ID,
        "experimentId": EXPERIMENT_ID,
        "datasetId": DATASET_ID,
    }:
        raise ValueError("cycle replay command identity mismatch")
    _utc_text(document["createdAt"], "cycle replay command createdAt")
    executable_value = document["executable"]
    if not isinstance(executable_value, str) or not executable_value:
        raise ValueError("cycle replay command executable mismatch")
    executable = Path(executable_value)
    if not executable.is_absolute() or executable.resolve() != Path(sys.executable).resolve():
        raise ValueError("cycle replay command executable mismatch")
    paths = _exact_mapping(
        document["paths"],
        frozenset(
            {
                "cycleRoot",
                "artifactsRoot",
                "frozenDir",
                "batchesRoot",
                "labelsRoot",
                "replayOutputDir",
                "report",
                "gateReport",
                "pidRecord",
                "serviceLog",
            }
        ),
        "cycle replay command paths",
    )
    resolved_paths: dict[str, Path] = {}
    for name, value in paths.items():
        if not isinstance(value, str) or not Path(value).is_absolute():
            raise ValueError(f"cycle replay command paths.{name} must be absolute")
        resolved_paths[name] = Path(value).resolve()
    artifact_root = root.parent
    expected_paths = {
        "artifactsRoot": artifact_root,
        "frozenDir": artifact_root / "frozen",
        "replayOutputDir": root,
        "report": root / "replay.json",
        "gateReport": root / "gate-replay.json",
        "pidRecord": root / "service-pid.json",
        "serviceLog": root / "service.log",
    }
    if any(resolved_paths[name] != expected for name, expected in expected_paths.items()):
        raise ValueError("cycle replay command output path mismatch")
    service = _exact_mapping(
        document["service"],
        frozenset({"host", "port", "endpoint", "executable", "arguments"}),
        "cycle replay service",
    )
    port = service["port"]
    if (
        service["host"] != "127.0.0.1"
        or isinstance(port, bool)
        or not isinstance(port, int)
        or not 1024 <= port <= 65535
        or service["endpoint"] != f"http://127.0.0.1:{port}/infer"
        or service["executable"] != str(executable)
    ):
        raise ValueError("cycle replay service identity mismatch")
    expected_service_arguments = [
        "-m",
        "fishing_ml.inference_service",
        "--host",
        "127.0.0.1",
        "--port",
        str(port),
        "--frozen-dir",
        str(resolved_paths["frozenDir"]),
        "--timeout-ms",
        "5000",
    ]
    if service["arguments"] != expected_service_arguments:
        raise ValueError("cycle replay service arguments mismatch")
    expected_arguments = [
        "-m",
        "fishing_ml.coverage_recovery",
        "replay-run",
        "--cycle-root",
        str(resolved_paths["cycleRoot"]),
        "--artifacts-root",
        str(resolved_paths["artifactsRoot"]),
        "--port",
        str(port),
    ]
    if document["arguments"] != expected_arguments:
        raise ValueError("cycle replay command arguments mismatch")
    evidence = _exact_mapping(
        document["evidence"],
        frozenset(
            {
                "finalReportSha256",
                "finalGateSha256",
                "freezeManifestSha256",
                "gatePolicySha256",
                "membership",
                "model",
            }
        ),
        "cycle replay command evidence",
    )
    for field in (
        "finalReportSha256",
        "finalGateSha256",
        "freezeManifestSha256",
        "gatePolicySha256",
    ):
        _hex64(evidence[field], f"cycle replay command {field}")
    membership = _exact_mapping(
        evidence["membership"],
        frozenset({"count", "sha256"}),
        "cycle replay membership",
    )
    if membership["count"] != 260 or isinstance(membership["count"], bool):
        raise ValueError("cycle replay membership count mismatch")
    _hex64(membership["sha256"], "cycle replay membership sha256")
    model = _exact_mapping(
        evidence["model"],
        frozenset({"runId", "candidateId", "checkpointSha256"}),
        "cycle replay model",
    )
    if not isinstance(model["runId"], str) or not isinstance(model["candidateId"], str):
        raise ValueError("cycle replay model identity is invalid")
    _safe_identity(model["runId"], "cycle replay runId")
    _safe_identity(model["candidateId"], "cycle replay candidateId")
    _hex64(model["checkpointSha256"], "cycle replay checkpointSha256")
    return dict(document)


def _assert_replay_command_matches_prerequisites(
    command: Mapping[str, object],
    prerequisites: Mapping[str, object],
    port: int,
) -> None:
    command_paths = _mapping(command["paths"], "cycle replay command paths")
    expected_paths = {
        "cycleRoot": prerequisites["cycleRoot"],
        "artifactsRoot": prerequisites["artifactsRoot"],
        "frozenDir": prerequisites["frozenRoot"],
        "batchesRoot": prerequisites["rawRoot"],
        "labelsRoot": prerequisites["labelsRoot"],
    }
    if any(
        Path(command_paths[name]).resolve() != Path(expected).resolve()
        for name, expected in expected_paths.items()
    ):
        raise ValueError("cycle replay command input path mismatch")
    service = _mapping(command["service"], "cycle replay command service")
    if service["port"] != port:
        raise ValueError("replay invocation port does not match command record")


def replay_preflight(
    cycle_root: Path,
    artifacts_root: Path,
    port: int,
) -> dict[str, object]:
    prerequisites = _replay_prerequisites(cycle_root, artifacts_root)
    _require_free_loopback_port(port)
    paths = _replay_output_paths(prerequisites["artifactsRoot"])
    _assert_replay_output_absence(paths)
    frozen = prerequisites["frozen"]
    evidence = {
        "finalReportSha256": prerequisites["finalReportSha256"],
        "finalGateSha256": prerequisites["finalGateSha256"],
        "freezeManifestSha256": prerequisites["freezeManifestSha256"],
        "gatePolicySha256": prerequisites["policySha256"],
        "membership": {
            "count": len(prerequisites["membership"]),
            "sha256": prerequisites["membershipSha256"],
        },
        "model": {
            "runId": frozen.run_id,
            "candidateId": frozen.candidate_id,
            "checkpointSha256": frozen.files["best-dev.pt"],
        },
    }
    if os.path.lexists(paths["command"]):
        command = _load_replay_command_record(paths["root"])
        _assert_replay_command_matches_prerequisites(command, prerequisites, port)
        if command["evidence"] != evidence:
            raise ValueError("existing cycle replay command is stale or uses another port")
    else:
        paths["root"].mkdir(mode=0o700, exist_ok=True)
        if paths["root"].is_symlink() or not paths["root"].is_dir():
            raise ValueError("cycle replay output path must be a real directory")
        executable = str(Path(sys.executable).resolve())
        cycle_data_root = prerequisites["cycleRoot"]
        artifact_root = prerequisites["artifactsRoot"]
        arguments = [
            "-m",
            "fishing_ml.coverage_recovery",
            "replay-run",
            "--cycle-root",
            str(cycle_data_root),
            "--artifacts-root",
            str(artifact_root),
            "--port",
            str(port),
        ]
        service_arguments = [
            "-m",
            "fishing_ml.inference_service",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--frozen-dir",
            str(prerequisites["frozenRoot"]),
            "--timeout-ms",
            "5000",
        ]
        command = {
            "schemaVersion": 1,
            "cycle": {
                "cycleId": CYCLE_ID,
                "experimentId": EXPERIMENT_ID,
                "datasetId": DATASET_ID,
            },
            "createdAt": _utc_now(),
            "executable": executable,
            "arguments": arguments,
            "service": {
                "host": "127.0.0.1",
                "port": port,
                "endpoint": f"http://127.0.0.1:{port}/infer",
                "executable": executable,
                "arguments": service_arguments,
            },
            "paths": {
                "cycleRoot": str(cycle_data_root),
                "artifactsRoot": str(artifact_root),
                "frozenDir": str(prerequisites["frozenRoot"]),
                "batchesRoot": str(prerequisites["rawRoot"]),
                "labelsRoot": str(prerequisites["labelsRoot"]),
                "replayOutputDir": str(paths["root"]),
                "report": str(paths["report"]),
                "gateReport": str(paths["gate"]),
                "pidRecord": str(paths["pid"]),
                "serviceLog": str(paths["log"]),
            },
            "evidence": evidence,
        }
        publish_no_replace(paths["command"], command)
        command = _load_replay_command_record(paths["root"])
        _assert_replay_command_matches_prerequisites(command, prerequisites, port)
    service_vector = [command["service"]["executable"], *command["service"]["arguments"]]
    return {
        "schemaVersion": 1,
        "status": "READY_FOR_REPLAY_APPROVAL",
        "cycleId": CYCLE_ID,
        "commandRecord": str(paths["command"]),
        "commandRecordSha256": sha256_file(paths["command"]),
        "command": shlex.join([command["executable"], *command["arguments"]]),
        "serviceCommand": shlex.join(service_vector),
        "shutdownCommand": f"kill -TERM $(python3 -c 'import json; print(json.load(open(\"{paths['pid']}\"))[\"pid\"])')",
        "outputs": {
            "report": str(paths["report"]),
            "gateReport": str(paths["gate"]),
            "pidRecord": str(paths["pid"]),
            "serviceLog": str(paths["log"]),
        },
    }


def _open_replay_log(path: Path, port: int) -> int:
    descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    _append_replay_log(descriptor, "orchestrator_started", port=port)
    return descriptor


def _append_replay_log(descriptor: int, event: str, **fields: object) -> None:
    document = {"at": _utc_now(), "event": event, **fields}
    payload = (
        json.dumps(document, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")
    view = memoryview(payload)
    while view:
        written = os.write(descriptor, view)
        if written <= 0:
            raise OSError("short write while recording replay lifecycle")
        view = view[written:]
    os.fsync(descriptor)


def _replay_error_code(error: Exception) -> str:
    if isinstance(error, FileExistsError):
        return "publication_conflict"
    if isinstance(error, TimeoutError):
        return "service_timeout"
    if isinstance(error, subprocess.SubprocessError):
        return "service_process_error"
    if isinstance(error, OSError):
        return "io_error"
    if isinstance(error, ValueError):
        return "invalid_replay_evidence"
    return "replay_operation_error"


def run_cycle_replay(
    cycle_root: Path,
    artifacts_root: Path,
    port: int,
) -> dict[str, object]:
    from .artifacts import verify_cycle_freeze
    from .inference_client import InferenceClient
    from .inference_service import load_frozen_matcher
    from .phase2_gate import adjudicate_replay, exit_code_for_status, publish_gate_report
    from .replay import replay_batches

    prerequisites = _replay_prerequisites(cycle_root, artifacts_root)
    paths = _replay_output_paths(prerequisites["artifactsRoot"])
    _assert_replay_output_absence(paths)
    command = _load_replay_command_record(paths["root"])
    _assert_replay_command_matches_prerequisites(command, prerequisites, port)
    expected_evidence = {
        "finalReportSha256": prerequisites["finalReportSha256"],
        "finalGateSha256": prerequisites["finalGateSha256"],
        "freezeManifestSha256": prerequisites["freezeManifestSha256"],
        "gatePolicySha256": prerequisites["policySha256"],
        "membership": {
            "count": len(prerequisites["membership"]),
            "sha256": prerequisites["membershipSha256"],
        },
        "model": {
            "runId": prerequisites["frozen"].run_id,
            "candidateId": prerequisites["frozen"].candidate_id,
            "checkpointSha256": prerequisites["frozen"].files["best-dev.pt"],
        },
    }
    if command["evidence"] != expected_evidence:
        raise ValueError("replay command evidence no longer matches current state")
    _require_free_loopback_port(port)

    log_descriptor: int | None = None
    process: subprocess.Popen[bytes] | None = None
    operation_error: Exception | None = None
    cleanup_error: Exception | None = None
    report_document: dict[str, object] | None = None
    frozen = prerequisites["frozen"]
    shutdown_uncertain = False
    try:
        log_descriptor = _open_replay_log(paths["log"], port)
        frozen = verify_cycle_freeze(prerequisites["frozenRoot"])
        matcher = load_frozen_matcher(prerequisites["frozenRoot"])
        if matcher.model_id != frozen.run_id:
            raise ValueError("replay service model identity does not match freeze")
        service = command["service"]
        service_command = [service["executable"], *service["arguments"]]
        process = subprocess.Popen(
            service_command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        publish_no_replace(
            paths["pid"],
            {
                "schemaVersion": 1,
                "host": "127.0.0.1",
                "port": port,
                "pid": process.pid,
                "startedAt": _utc_now(),
            },
        )
        _append_replay_log(
            log_descriptor,
            "service_started",
            pid=process.pid,
            port=port,
            modelId=frozen.run_id,
        )
        if not _wait_for_port_open(process, port, 60.0):
            raise TimeoutError("replay service did not become ready")
        _append_replay_log(log_descriptor, "service_ready", pid=process.pid, port=port)

        client = InferenceClient(service["endpoint"], 5000)
        report = replay_batches(
            prerequisites["rawRoot"],
            client,
            prerequisites["labelsRoot"],
            model_checksums=(frozen.files["best-dev.pt"],),
            batch_ids=prerequisites["membership"],
            cycle_data_roots=prerequisites["cycleDataRoots"],
        )
        report_document = report.to_dict()
        publish_no_replace(paths["report"], report_document)
    except Exception as error:
        operation_error = error
        if log_descriptor is not None:
            try:
                _append_replay_log(
                    log_descriptor,
                    "operation_blocked",
                    code=_replay_error_code(error),
                )
            except Exception as log_error:
                cleanup_error = log_error
    finally:
        if process is not None:
            if process.poll() is None:
                try:
                    process.terminate()
                    if log_descriptor is not None:
                        _append_replay_log(
                            log_descriptor,
                            "termination_sent",
                            pid=process.pid,
                        )
                    process.wait(timeout=10.0)
                except (OSError, subprocess.TimeoutExpired) as error:
                    shutdown_uncertain = True
                    cleanup_error = cleanup_error or error
                    try:
                        process.kill()
                        process.wait(timeout=5.0)
                    except (OSError, subprocess.TimeoutExpired) as kill_error:
                        shutdown_uncertain = True
                        cleanup_error = cleanup_error or kill_error
            elif operation_error is None:
                shutdown_uncertain = True
            try:
                port_closed = _wait_for_port_closed(port, 10.0)
            except OSError as error:
                port_closed = False
                cleanup_error = cleanup_error or error
            if not port_closed:
                shutdown_uncertain = True
            if log_descriptor is not None:
                try:
                    _append_replay_log(
                        log_descriptor,
                        "service_stopped" if not shutdown_uncertain else "shutdown_uncertain",
                        pid=process.pid,
                        returnCode=process.poll(),
                        portClosed=port_closed,
                    )
                except Exception as log_error:
                    cleanup_error = cleanup_error or log_error
                    shutdown_uncertain = True
        if log_descriptor is not None:
            try:
                os.close(log_descriptor)
            except OSError as error:
                cleanup_error = cleanup_error or error
                shutdown_uncertain = True

    if operation_error is not None:
        raise GateBlockedError(
            f"cycle replay blocked: {_replay_error_code(operation_error)}"
        ) from operation_error
    if report_document is None:
        raise GateBlockedError("cycle replay blocked: missing_result")
    try:
        report_sha256 = sha256_file(paths["report"])
        gate_report = adjudicate_replay(
            prerequisites["policy"],
            report_document,
            read_json(prerequisites["frozenRoot"] / "freeze-manifest.json"),
            policy_sha256=prerequisites["policySha256"],
            evidence_sha256=report_sha256,
            operational_blocked=shutdown_uncertain or cleanup_error is not None,
        )
        publish_gate_report(paths["gate"], gate_report)
    except Exception as error:
        raise GateBlockedError(
            f"cycle replay blocked: {_replay_error_code(error)}"
        ) from error
    return {
        "schemaVersion": 1,
        "cycleId": CYCLE_ID,
        "status": gate_report.status.upper(),
        "terminalState": {
            "pass": "REPLAY_PASS",
            "fail": "REPLAY_FAIL",
            "blocked": "REPLAY_BLOCKED",
        }[gate_report.status],
        "exitCode": exit_code_for_status(gate_report.status),
        "report": str(paths["report"]),
        "reportSha256": report_sha256,
        "gateReport": str(paths["gate"]),
        "gateReportSha256": sha256_file(paths["gate"]),
        "pidRecord": str(paths["pid"]),
        "serviceLog": str(paths["log"]),
        "shutdownUncertain": shutdown_uncertain or cleanup_error is not None,
    }


def _matrix_document() -> dict[str, object]:
    models = enumerate_model_specs()
    candidates = enumerate_candidate_specs(models)
    return {
        "schemaVersion": 1,
        "cycleId": CYCLE_ID,
        "experimentId": EXPERIMENT_ID,
        "datasetId": DATASET_ID,
        "modelCount": len(models),
        "candidateCount": len(candidates),
        "runIds": [model.run_id for model in models],
        "candidateIds": [candidate.candidate_id for candidate in candidates],
    }


def _add_cycle_artifact_roots(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--cycle-root", type=Path, required=True)
    parser.add_argument("--artifacts-root", type=Path, required=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("matrix", help="Print the fixed 24-model/48-candidate identity matrix")

    publish = subparsers.add_parser("publish-experiment")
    _add_cycle_artifact_roots(publish)
    publish.add_argument("--preview", action="store_true")

    run = subparsers.add_parser("run-model")
    _add_cycle_artifact_roots(run)
    run.add_argument("--raw-root", type=Path, required=True)
    run.add_argument("--labels-root", type=Path, required=True)
    run.add_argument("--duplicate-reviews", type=Path, required=True)
    run.add_argument("--run-id", required=True)

    adjudicate = subparsers.add_parser("adjudicate-interrupted")
    _add_cycle_artifact_roots(adjudicate)
    adjudicate.add_argument("--run-id", required=True)
    adjudicate.add_argument("--decision", choices=("reject", "reset"), required=True)

    calibrate = subparsers.add_parser("calibrate-model")
    _add_cycle_artifact_roots(calibrate)
    calibrate.add_argument("--raw-root", type=Path, required=True)
    calibrate.add_argument("--labels-root", type=Path, required=True)
    calibrate.add_argument("--run-id", required=True)

    compare = subparsers.add_parser("compare")
    _add_cycle_artifact_roots(compare)
    compare.add_argument("--raw-root", type=Path, required=True)
    compare.add_argument("--labels-root", type=Path, required=True)

    verify = subparsers.add_parser("verify-experiment")
    _add_cycle_artifact_roots(verify)

    freeze = subparsers.add_parser("freeze-selected")
    _add_cycle_artifact_roots(freeze)
    freeze.add_argument("--raw-root", type=Path, required=True)
    freeze.add_argument("--labels-root", type=Path, required=True)

    verify_freeze = subparsers.add_parser("verify-freeze")
    verify_freeze.add_argument("--artifacts-root", type=Path, required=True)

    final_preflight_parser = subparsers.add_parser("final-preflight")
    _add_cycle_artifact_roots(final_preflight_parser)

    final_run_parser = subparsers.add_parser("final-run")
    _add_cycle_artifact_roots(final_run_parser)
    final_run_parser.add_argument("--authorization", required=True)

    replay_preflight_parser = subparsers.add_parser("replay-preflight")
    _add_cycle_artifact_roots(replay_preflight_parser)
    replay_preflight_parser.add_argument("--port", type=int, required=True)

    replay_run_parser = subparsers.add_parser("replay-run")
    _add_cycle_artifact_roots(replay_run_parser)
    replay_run_parser.add_argument("--port", type=int, required=True)

    args = parser.parse_args(argv)
    exit_code = 0
    try:
        if args.command == "matrix":
            result = _matrix_document()
        elif args.command == "publish-experiment":
            result = publish_experiment(
                args.cycle_root,
                args.artifacts_root,
                preview=args.preview,
            )
        elif args.command == "run-model":
            result = run_model(
                args.cycle_root,
                args.artifacts_root,
                args.raw_root,
                args.labels_root,
                args.duplicate_reviews,
                args.run_id,
            )
        elif args.command == "adjudicate-interrupted":
            result = adjudicate_interrupted(
                args.cycle_root,
                args.artifacts_root,
                args.run_id,
                args.decision,
            )
        elif args.command == "calibrate-model":
            result = calibrate_model(
                args.cycle_root,
                args.artifacts_root,
                args.raw_root,
                args.labels_root,
                args.run_id,
            )
        elif args.command == "compare":
            result = compare_candidates(
                args.cycle_root,
                args.artifacts_root,
                args.raw_root,
                args.labels_root,
            )
        elif args.command == "verify-experiment":
            result = verify_experiment(args.cycle_root, args.artifacts_root)
        elif args.command == "freeze-selected":
            result = freeze_selected_candidate(
                args.cycle_root,
                args.artifacts_root,
                args.raw_root,
                args.labels_root,
            )
        elif args.command == "verify-freeze":
            result = verify_frozen_cycle(args.artifacts_root)
        elif args.command == "final-preflight":
            result = final_preflight(args.cycle_root, args.artifacts_root)
        elif args.command == "final-run":
            result = run_cycle_final(
                args.cycle_root,
                args.artifacts_root,
                args.authorization,
            )
            exit_code = int(result["exitCode"])
        elif args.command == "replay-preflight":
            result = replay_preflight(
                args.cycle_root,
                args.artifacts_root,
                args.port,
            )
        else:
            try:
                result = run_cycle_replay(
                    args.cycle_root,
                    args.artifacts_root,
                    args.port,
                )
            except (GateBlockedError, StageBlockedError):
                raise
            except (OSError, RuntimeError, TypeError, ValueError) as error:
                raise GateBlockedError(
                    f"cycle replay blocked: {_replay_error_code(error)}"
                ) from error
            exit_code = int(result["exitCode"])
    except (GateBlockedError, StageBlockedError) as error:
        print(
            json.dumps({"status": "BLOCKED", "error": str(error)}, sort_keys=True),
            file=sys.stderr,
        )
        return 4
    except (OSError, RuntimeError, ValueError) as error:
        print(
            json.dumps({"status": "INVALID", "error": str(error)}, sort_keys=True),
            file=sys.stderr,
        )
        return 2
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
