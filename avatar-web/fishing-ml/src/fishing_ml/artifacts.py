"""Build, publish and verify immutable fishing matcher candidate bundles."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import stat
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Mapping

from .schema import atomic_write_json, load_label, load_manifest, read_json, sha256_file
from .split import validate_splits
from .train import _publish_directory_no_replace

_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_GIT_HEX = re.compile(r"^[0-9a-f]{40}$")

_FROZEN_INPUTS = {
    "model-config.json": "model-config.json",
    "normalization.json": "normalization.json",
    "thresholds.json": "thresholds.json",
    "environment.json": "environment.json",
    "dev-metrics.json": "dev-metrics.json",
    "best-dev.pt": "checkpoints/best-dev.pt",
}
_GENERATED = ("dataset-snapshot.json", "split-checksums.json")
_ORIGINAL_CYCLE_DEV_PROMOTION_GATE = {
    "wrongAcceptedCount": 0,
    "minAcceptedRate": 0.65,
    "minTop1Accuracy": 0.99,
    "minBatchExactMatch": 0.95,
    "acquiredDevWrongAcceptedCount": 0,
}
_RECOVERY_CYCLE_DEV_PROMOTION_GATE = {
    "wrongAcceptedCount": 0,
    "minAcceptedRate": 0.64,
    "minTop1Accuracy": 0.987220,
    "minBatchExactMatch": 0.95,
    "acquiredDevWrongAcceptedCount": 0,
}


@dataclass(frozen=True, slots=True)
class FreezeManifest:
    schema_version: int
    run_id: str
    git_revision: str
    files: dict[str, str]


@dataclass(frozen=True, slots=True)
class CycleFreezeManifest:
    schema_version: Literal[2]
    cycle_id: str
    experiment_id: str
    dataset_id: str
    run_id: str
    candidate_id: str
    git_revision: str
    experiment_manifest_sha256: str
    selection_sha256: str
    candidate_sha256: str
    calibration_sha256: str
    dataset_version_sha256: str
    files: dict[str, str]


def _git_revision() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError) as error:
        raise RuntimeError("freeze requires a readable Git revision") from error


def _split_ids(path: Path) -> tuple[str, ...]:
    values = tuple(path.read_text(encoding="utf-8").splitlines())
    if not values or any(not value for value in values) or len(values) != len(set(values)):
        raise ValueError(f"invalid split file: {path}")
    return values


def build_dataset_snapshot(raw_root: Path, labels_root: Path, splits_root: Path) -> dict[str, object]:
    raw_root, labels_root, splits_root = Path(raw_root), Path(labels_root), Path(splits_root)
    batches: list[dict[str, object]] = []
    for split in ("train", "dev", "final"):
        for batch_id in _split_ids(splits_root / f"{split}.txt"):
            batch_dir = raw_root / batch_id
            manifest_path = batch_dir / "manifest.json"
            label_path = labels_root / f"{batch_id}.json"
            manifest, label = load_manifest(manifest_path), load_label(label_path)
            if manifest.batch_id != batch_id or label.batch_id != batch_id or label.status != "complete":
                raise ValueError(f"invalid snapshot batch contract: {batch_id}")
            files = {entry.path: sha256_file(batch_dir / entry.path) for entry in (*manifest.images, *manifest.images_new)}
            if any(files[entry.path] != entry.sha256 for entry in (*manifest.images, *manifest.images_new)):
                raise ValueError(f"snapshot image checksum mismatch: {batch_id}")
            batches.append({
                "batchId": batch_id, "split": split,
                "manifest": read_json(manifest_path), "manifestSha256": sha256_file(manifest_path),
                "label": read_json(label_path), "labelSha256": sha256_file(label_path),
                "files": dict(sorted(files.items())),
            })
    return {"schemaVersion": 1, "batches": batches}


def checksum_split_files(splits_root: Path) -> dict[str, object]:
    root = Path(splits_root)
    return {"schemaVersion": 1, "files": {f"{name}.txt": sha256_file(root / f"{name}.txt") for name in ("train", "dev", "final")}}


def _manifest(document: object) -> FreezeManifest:
    if not isinstance(document, dict) or set(document) != {"schemaVersion", "runId", "gitRevision", "files"}:
        raise ValueError("freeze-manifest.json fields mismatch")
    files = document["files"]
    if (
        isinstance(document["schemaVersion"], bool)
        or document["schemaVersion"] != 1
        or not isinstance(document["runId"], str)
        or not document["runId"]
        or not isinstance(document["gitRevision"], str)
        or not _GIT_HEX.fullmatch(document["gitRevision"])
        or not isinstance(files, dict)
    ):
        raise ValueError("invalid freeze manifest")
    expected = set(_FROZEN_INPUTS) | set(_GENERATED)
    if set(files) != expected or any(not isinstance(value, str) or not _HEX64.fullmatch(value) for value in files.values()):
        raise ValueError("freeze manifest file inventory mismatch")
    return FreezeManifest(1, document["runId"], document["gitRevision"], dict(files))


def verify_freeze(frozen_dir: Path) -> FreezeManifest:
    frozen_dir = Path(frozen_dir)
    manifest = _manifest(read_json(frozen_dir / "freeze-manifest.json"))
    actual = {path.name for path in frozen_dir.iterdir() if path.is_file()}
    expected = set(manifest.files) | {"freeze-manifest.json"}
    if actual != expected:
        raise ValueError(f"frozen file inventory mismatch: expected {sorted(expected)}, got {sorted(actual)}")
    for name, expected_hash in manifest.files.items():
        actual_hash = sha256_file(frozen_dir / name)
        if actual_hash != expected_hash:
            raise ValueError(f"frozen checksum mismatch for {name}: expected {expected_hash}, got {actual_hash}")
    snapshot, splits = read_json(frozen_dir / "dataset-snapshot.json"), read_json(frozen_dir / "split-checksums.json")
    if not isinstance(snapshot, dict) or set(snapshot) != {"schemaVersion", "batches"} or snapshot["schemaVersion"] != 1 or not isinstance(snapshot["batches"], list):
        raise ValueError("invalid dataset snapshot")
    if not isinstance(splits, dict) or set(splits) != {"schemaVersion", "files"} or splits["schemaVersion"] != 1:
        raise ValueError("invalid split checksums")
    return manifest


def _single_link_regular(path: Path, field: str) -> Path:
    metadata = os.lstat(path)
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1:
        raise ValueError(f"{field} must be a single-link regular file")
    return path


def _cycle_manifest(document: object) -> CycleFreezeManifest:
    expected_keys = {
        "schemaVersion",
        "cycleId",
        "experimentId",
        "datasetId",
        "runId",
        "candidateId",
        "gitRevision",
        "experimentManifestSha256",
        "selectionSha256",
        "candidateSha256",
        "calibrationSha256",
        "datasetVersionSha256",
        "files",
    }
    if not isinstance(document, dict) or set(document) != expected_keys:
        raise ValueError("cycle freeze-manifest.json fields mismatch")
    if document["schemaVersion"] != 2 or isinstance(document["schemaVersion"], bool):
        raise ValueError("cycle freeze manifest schemaVersion must equal 2")
    for field in ("cycleId", "experimentId", "datasetId", "runId", "candidateId"):
        if not isinstance(document[field], str) or not document[field]:
            raise ValueError(f"cycle freeze manifest {field} must be a non-empty string")
    if not isinstance(document["gitRevision"], str) or not _GIT_HEX.fullmatch(document["gitRevision"]):
        raise ValueError("cycle freeze manifest Git revision is invalid")
    for field in (
        "experimentManifestSha256",
        "selectionSha256",
        "candidateSha256",
        "calibrationSha256",
        "datasetVersionSha256",
    ):
        if not isinstance(document[field], str) or not _HEX64.fullmatch(document[field]):
            raise ValueError(f"cycle freeze manifest {field} must be a lowercase SHA-256")
    files = document["files"]
    expected_files = set(_FROZEN_INPUTS) | set(_GENERATED)
    if (
        not isinstance(files, dict)
        or set(files) != expected_files
        or any(not isinstance(value, str) or not _HEX64.fullmatch(value) for value in files.values())
    ):
        raise ValueError("cycle freeze manifest file inventory mismatch")
    return CycleFreezeManifest(
        schema_version=2,
        cycle_id=document["cycleId"],
        experiment_id=document["experimentId"],
        dataset_id=document["datasetId"],
        run_id=document["runId"],
        candidate_id=document["candidateId"],
        git_revision=document["gitRevision"],
        experiment_manifest_sha256=document["experimentManifestSha256"],
        selection_sha256=document["selectionSha256"],
        candidate_sha256=document["candidateSha256"],
        calibration_sha256=document["calibrationSha256"],
        dataset_version_sha256=document["datasetVersionSha256"],
        files=dict(files),
    )


def verify_cycle_freeze(frozen_dir: Path) -> CycleFreezeManifest:
    root = Path(frozen_dir)
    if root.is_symlink() or not root.is_dir():
        raise ValueError("cycle frozen bundle must be a real directory")
    manifest_path = _single_link_regular(root / "freeze-manifest.json", "cycle freeze manifest")
    manifest = _cycle_manifest(read_json(manifest_path))
    actual: set[str] = set()
    for entry in os.scandir(root):
        if not entry.is_file(follow_symlinks=False):
            raise ValueError(f"cycle frozen bundle contains a non-regular entry: {entry.name}")
        _single_link_regular(Path(entry.path), f"cycle frozen file {entry.name}")
        actual.add(entry.name)
    expected = set(manifest.files) | {"freeze-manifest.json"}
    if actual != expected:
        raise ValueError(
            f"cycle frozen file inventory mismatch: expected {sorted(expected)}, got {sorted(actual)}"
        )
    for name, expected_hash in manifest.files.items():
        actual_hash = sha256_file(root / name)
        if actual_hash != expected_hash:
            raise ValueError(
                f"cycle frozen checksum mismatch for {name}: expected {expected_hash}, got {actual_hash}"
            )

    from .config import load_training_config_from_document
    from .phase2_cycle import CYCLE_ID, DATASET_ID, EXPERIMENT_ID

    if (
        manifest.cycle_id != CYCLE_ID
        or manifest.experiment_id != EXPERIMENT_ID
        or manifest.dataset_id != DATASET_ID
    ):
        raise ValueError("cycle frozen identity mismatch")
    config_document = read_json(root / "model-config.json")
    if not isinstance(config_document, dict):
        raise ValueError("cycle frozen model config must be an object")
    config = load_training_config_from_document(config_document)
    if config.schema_version != 3 or config.device != "cpu" or config.workers != 0:
        raise ValueError("cycle frozen model config must be deterministic schema v3")

    environment = read_json(root / "environment.json")
    if not isinstance(environment, dict) or environment.get("schemaVersion") != 2:
        raise ValueError("cycle frozen environment must be schema v2")
    if environment.get("gitRevision") != manifest.git_revision:
        raise ValueError("cycle frozen environment Git revision mismatch")
    if environment.get("checkpointSha256") != manifest.files["best-dev.pt"]:
        raise ValueError("cycle frozen checkpoint/environment digest mismatch")
    cycle_provenance = environment.get("cycleProvenance")
    if not isinstance(cycle_provenance, dict):
        raise ValueError("cycle frozen environment lacks cycle provenance")
    if (
        cycle_provenance.get("datasetId") != manifest.dataset_id
        or cycle_provenance.get("datasetVersionSha256") != manifest.dataset_version_sha256
        or cycle_provenance.get("experimentManifestSha256") != manifest.experiment_manifest_sha256
    ):
        raise ValueError("cycle frozen environment provenance mismatch")

    thresholds = read_json(root / "thresholds.json")
    threshold_keys = {
        "schemaVersion",
        "cycleId",
        "experimentId",
        "datasetId",
        "runId",
        "candidateId",
        "calibrationPolicy",
        "thresholds",
        "provenance",
    }
    if not isinstance(thresholds, dict) or frozenset(thresholds) not in {
        frozenset(threshold_keys),
        frozenset(threshold_keys | {"selectionRecovery"}),
    }:
        raise ValueError("cycle frozen thresholds fields mismatch")
    if (
        thresholds["schemaVersion"] != 2
        or thresholds["cycleId"] != manifest.cycle_id
        or thresholds["experimentId"] != manifest.experiment_id
        or thresholds["datasetId"] != manifest.dataset_id
        or thresholds["runId"] != manifest.run_id
        or thresholds["candidateId"] != manifest.candidate_id
        or thresholds["calibrationPolicy"] not in {
            "joint_zero_wrong",
            "partition_robust_zero_wrong",
        }
    ):
        raise ValueError("cycle frozen thresholds identity mismatch")
    threshold_values = thresholds["thresholds"]
    if not isinstance(threshold_values, dict) or set(threshold_values) != {"minSimilarity", "minMargin"}:
        raise ValueError("cycle frozen threshold values mismatch")
    for field, value in threshold_values.items():
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
            raise ValueError(f"cycle frozen threshold {field} must be finite")
    if float(threshold_values["minMargin"]) < 0:
        raise ValueError("cycle frozen minimum margin must be non-negative")
    provenance = thresholds["provenance"]
    expected_provenance = {
        "experimentManifestSha256": manifest.experiment_manifest_sha256,
        "selectionSha256": manifest.selection_sha256,
        "candidateSha256": manifest.candidate_sha256,
        "calibrationSha256": manifest.calibration_sha256,
        "datasetVersionSha256": manifest.dataset_version_sha256,
    }
    if provenance != expected_provenance:
        raise ValueError("cycle frozen threshold provenance mismatch")
    if "selectionRecovery" in thresholds:
        selection_recovery = thresholds["selectionRecovery"]
        if not isinstance(selection_recovery, dict) or set(selection_recovery) != {
            "recoverySelectionSha256",
            "originalSelectionSha256",
            "originalDevPromotionGate",
            "recoveryDevPromotionGate",
        }:
            raise ValueError("cycle frozen recovery selection provenance fields mismatch")
        if (
            selection_recovery["recoverySelectionSha256"] != manifest.selection_sha256
            or not isinstance(selection_recovery["originalSelectionSha256"], str)
            or not _HEX64.fullmatch(selection_recovery["originalSelectionSha256"])
            or selection_recovery["originalSelectionSha256"] == manifest.selection_sha256
            or selection_recovery["originalDevPromotionGate"]
            != _ORIGINAL_CYCLE_DEV_PROMOTION_GATE
            or selection_recovery["recoveryDevPromotionGate"]
            != _RECOVERY_CYCLE_DEV_PROMOTION_GATE
        ):
            raise ValueError("cycle frozen recovery selection provenance mismatch")

    snapshot = read_json(root / "dataset-snapshot.json")
    snapshot_keys = {
        "schemaVersion",
        "cycleId",
        "datasetId",
        "datasetVersionSha256",
        "batches",
        "sealedFinal",
    }
    if not isinstance(snapshot, dict) or set(snapshot) != snapshot_keys:
        raise ValueError("cycle frozen dataset snapshot fields mismatch")
    if (
        snapshot["schemaVersion"] != 2
        or snapshot["cycleId"] != manifest.cycle_id
        or snapshot["datasetId"] != manifest.dataset_id
        or snapshot["datasetVersionSha256"] != manifest.dataset_version_sha256
        or not isinstance(snapshot["batches"], list)
        or len(snapshot["batches"]) != 230
    ):
        raise ValueError("cycle frozen dataset snapshot metadata mismatch")
    batch_ids: set[str] = set()
    split_counts = {"train": 0, "dev": 0}
    for batch in snapshot["batches"]:
        if not isinstance(batch, dict) or set(batch) != {
            "batchId",
            "split",
            "manifest",
            "manifestSha256",
            "label",
            "labelSha256",
            "files",
        }:
            raise ValueError("cycle frozen snapshot batch fields mismatch")
        batch_id = batch["batchId"]
        split = batch["split"]
        if not isinstance(batch_id, str) or not batch_id or batch_id in batch_ids:
            raise ValueError("cycle frozen snapshot has an invalid or duplicate batch id")
        if split not in split_counts:
            raise ValueError("cycle frozen snapshot includes a non-working split")
        batch_ids.add(batch_id)
        split_counts[split] += 1
    if split_counts != {"train": 185, "dev": 45}:
        raise ValueError("cycle frozen snapshot working split counts mismatch")
    sealed_final = snapshot["sealedFinal"]
    if not isinstance(sealed_final, dict) or set(sealed_final) != {"path", "count", "sizeBytes", "sha256"}:
        raise ValueError("cycle frozen sealed-final snapshot fields mismatch")
    if (
        sealed_final["path"] != "splits/sealed-final.txt"
        or sealed_final["count"] != 30
        or isinstance(sealed_final["sizeBytes"], bool)
        or not isinstance(sealed_final["sizeBytes"], int)
        or sealed_final["sizeBytes"] <= 0
        or not isinstance(sealed_final["sha256"], str)
        or not _HEX64.fullmatch(sealed_final["sha256"])
    ):
        raise ValueError("cycle frozen sealed-final snapshot is invalid")

    splits = read_json(root / "split-checksums.json")
    if not isinstance(splits, dict) or set(splits) != {
        "schemaVersion",
        "cycleId",
        "datasetId",
        "datasetVersionSha256",
        "working",
        "sealedFinal",
    }:
        raise ValueError("cycle frozen split-checksums fields mismatch")
    if (
        splits["schemaVersion"] != 2
        or splits["cycleId"] != manifest.cycle_id
        or splits["datasetId"] != manifest.dataset_id
        or splits["datasetVersionSha256"] != manifest.dataset_version_sha256
        or splits["sealedFinal"] != sealed_final
    ):
        raise ValueError("cycle frozen split-checksums metadata mismatch")
    working = splits["working"]
    if not isinstance(working, dict) or set(working) != {"train.txt", "dev.txt"}:
        raise ValueError("cycle frozen working split checksums mismatch")
    if any(not isinstance(value, str) or not _HEX64.fullmatch(value) for value in working.values()):
        raise ValueError("cycle frozen working split checksum is invalid")
    provenance_splits = cycle_provenance.get("splits")
    if not isinstance(provenance_splits, dict) or set(provenance_splits) != {"train", "dev"}:
        raise ValueError("cycle frozen environment split provenance mismatch")
    for split_name, file_name in (("train", "train.txt"), ("dev", "dev.txt")):
        split_provenance = provenance_splits[split_name]
        if (
            not isinstance(split_provenance, dict)
            or split_provenance.get("sha256") != working[file_name]
        ):
            raise ValueError(f"cycle frozen {split_name} checksum/provenance mismatch")
    return manifest


def verify_frozen_bundle(frozen_dir: Path) -> FreezeManifest | CycleFreezeManifest:
    document = read_json(Path(frozen_dir) / "freeze-manifest.json")
    if not isinstance(document, Mapping):
        raise ValueError("freeze manifest must be an object")
    if document.get("schemaVersion") == 1:
        return verify_freeze(frozen_dir)
    if document.get("schemaVersion") == 2:
        return verify_cycle_freeze(frozen_dir)
    raise ValueError("unsupported freeze manifest schemaVersion")


def _cycle_snapshot_batch(
    raw_root: Path,
    labels_root: Path,
    batch_id: str,
    split: Literal["train", "dev"],
) -> dict[str, object]:
    batch_dir = Path(raw_root) / batch_id
    manifest_path = _single_link_regular(
        batch_dir / "manifest.json",
        f"cycle snapshot manifest {batch_id}",
    )
    label_path = _single_link_regular(
        Path(labels_root) / f"{batch_id}.json",
        f"cycle snapshot label {batch_id}",
    )
    manifest = load_manifest(manifest_path)
    label = load_label(label_path)
    if manifest.batch_id != batch_id or label.batch_id != batch_id or label.status != "complete":
        raise ValueError(f"invalid cycle snapshot batch contract: {batch_id}")
    query_indices = {match.new_index for match in label.matches}
    if query_indices != set(range(len(manifest.images_new))) or len(label.matches) != len(manifest.images_new):
        raise ValueError(f"cycle snapshot label query coverage mismatch: {batch_id}")
    reference_indices = {entry.index for entry in manifest.images}
    if any(match.img_index not in reference_indices for match in label.matches):
        raise ValueError(f"cycle snapshot label target outside references: {batch_id}")
    files: dict[str, str] = {}
    for entry in (*manifest.images, *manifest.images_new):
        image_path = _single_link_regular(
            batch_dir / entry.path,
            f"cycle snapshot image {batch_id}/{entry.path}",
        )
        digest = sha256_file(image_path)
        if digest != entry.sha256:
            raise ValueError(f"cycle snapshot image checksum mismatch: {batch_id}/{entry.path}")
        files[entry.path] = digest
    return {
        "batchId": batch_id,
        "split": split,
        "manifest": read_json(manifest_path),
        "manifestSha256": sha256_file(manifest_path),
        "label": read_json(label_path),
        "labelSha256": sha256_file(label_path),
        "files": dict(sorted(files.items())),
    }


def build_cycle_dataset_snapshot(
    raw_root: Path,
    labels_root: Path,
    cycle_root: Path,
    dataset_version_sha256: str,
    *,
    cycle_data_roots=None,
) -> dict[str, object]:
    from .phase2_cycle import CYCLE_ID, DATASET_ID, load_working_membership, verify_prefinal_integrity

    if not _HEX64.fullmatch(dataset_version_sha256):
        raise ValueError("cycle dataset-version digest must be a lowercase SHA-256")
    membership = load_working_membership(cycle_root)
    integrity = verify_prefinal_integrity(cycle_root)
    batches: list[dict[str, object]] = []
    for split, batch_ids in (
        ("train", membership.train_ids),
        ("dev", membership.dev_ids),
    ):
        for batch_id in batch_ids:
            batch_raw_root, batch_labels_root = (
                (Path(raw_root), Path(labels_root))
                if cycle_data_roots is None
                else cycle_data_roots.roots_for(batch_id)
            )
            batches.append(
                _cycle_snapshot_batch(
                    batch_raw_root,
                    batch_labels_root,
                    batch_id,
                    split,
                )
            )
    return {
        "schemaVersion": 2,
        "cycleId": CYCLE_ID,
        "datasetId": DATASET_ID,
        "datasetVersionSha256": dataset_version_sha256,
        "batches": batches,
        "sealedFinal": {
            "path": "splits/sealed-final.txt",
            "count": integrity.final_count,
            "sizeBytes": integrity.final_size_bytes,
            "sha256": integrity.final_sha256,
        },
    }


def checksum_cycle_split_files(
    cycle_root: Path,
    dataset_version_sha256: str,
) -> dict[str, object]:
    from .phase2_cycle import CYCLE_ID, DATASET_ID, commit_ids, load_working_membership, verify_prefinal_integrity

    if not _HEX64.fullmatch(dataset_version_sha256):
        raise ValueError("cycle dataset-version digest must be a lowercase SHA-256")
    root = Path(cycle_root)
    membership = load_working_membership(root)
    integrity = verify_prefinal_integrity(root)
    train_path = _single_link_regular(root / "splits" / "train.txt", "cycle train split")
    dev_path = _single_link_regular(root / "splits" / "dev.txt", "cycle dev split")
    train_digest = sha256_file(train_path)
    dev_digest = sha256_file(dev_path)
    if train_digest != commit_ids(membership.train_ids).sha256:
        raise ValueError("cycle train split digest does not match working membership")
    if dev_digest != commit_ids(membership.dev_ids).sha256:
        raise ValueError("cycle dev split digest does not match working membership")
    sealed_final = {
        "path": "splits/sealed-final.txt",
        "count": integrity.final_count,
        "sizeBytes": integrity.final_size_bytes,
        "sha256": integrity.final_sha256,
    }
    return {
        "schemaVersion": 2,
        "cycleId": CYCLE_ID,
        "datasetId": DATASET_ID,
        "datasetVersionSha256": dataset_version_sha256,
        "working": {"train.txt": train_digest, "dev.txt": dev_digest},
        "sealedFinal": sealed_final,
    }


def freeze_cycle_run(
    run_dir: Path,
    frozen_dir: Path,
    raw_root: Path,
    labels_root: Path,
    cycle_root: Path,
    experiment_manifest_path: Path,
    selection_path: Path,
    candidate_path: Path,
    *,
    cycle_data_roots=None,
) -> Path:
    from .config import config_to_document, load_training_config_from_document
    from .phase2_cycle import CYCLE_ID, DATASET_ID, EXPERIMENT_ID
    from .provenance import revision_matches_recorded

    run_root = Path(run_dir)
    destination = Path(frozen_dir)
    if destination.name != "frozen":
        raise ValueError("cycle frozen directory must use the exact name 'frozen'")
    if os.path.lexists(destination):
        raise FileExistsError(f"refusing to overwrite cycle frozen bundle: {destination}")
    artifacts_root = destination.parent
    for terminal_name in ("final", "replay", "local-shadow"):
        terminal_path = artifacts_root / terminal_name
        if os.path.lexists(terminal_path):
            raise ValueError(f"cannot freeze after terminal artifact path exists: {terminal_path}")

    experiment_path = _single_link_regular(Path(experiment_manifest_path), "experiment manifest")
    selected_path = _single_link_regular(Path(selection_path), "selection")
    calibrated_path = _single_link_regular(Path(candidate_path), "candidate")
    experiment = read_json(experiment_path)
    selection = read_json(selected_path)
    candidate = read_json(calibrated_path)
    if not isinstance(experiment, dict) or not isinstance(selection, dict) or not isinstance(candidate, dict):
        raise ValueError("cycle freeze source records must be objects")
    if (
        experiment.get("schemaVersion") != 1
        or experiment.get("cycleId") != CYCLE_ID
        or experiment.get("experimentId") != EXPERIMENT_ID
        or experiment.get("datasetId") != DATASET_ID
    ):
        raise ValueError("cycle freeze experiment identity mismatch")
    git_revision = experiment.get("gitRevision")
    if not isinstance(git_revision, str) or not _GIT_HEX.fullmatch(git_revision):
        raise ValueError("cycle freeze experiment Git revision is invalid")
    if not revision_matches_recorded(_git_revision(), git_revision):
        raise ValueError("current Git revision is not compatible with experiment manifest")
    experiment_sha256 = sha256_file(experiment_path)

    if (
        selection.get("schemaVersion") != 1
        or selection.get("cycleId") != CYCLE_ID
        or selection.get("experimentId") != EXPERIMENT_ID
        or selection.get("datasetId") != DATASET_ID
        or selection.get("status") != "SELECTED"
        or selection.get("experimentManifestSha256") != experiment_sha256
    ):
        raise ValueError("cycle freeze selection identity mismatch")
    selected = selection.get("selected")
    if not isinstance(selected, dict):
        raise ValueError("cycle freeze selection lacks a selected candidate")
    run_id = selected.get("runId")
    candidate_id = selected.get("candidateId")
    if (
        not isinstance(run_id, str)
        or not run_id
        or not isinstance(candidate_id, str)
        or not candidate_id
        or run_root.name != run_id
    ):
        raise ValueError("cycle freeze selected run/candidate identity mismatch")
    selection_sha256 = sha256_file(selected_path)
    recovery_fields = {
        "selectionKind",
        "originalSelectionSha256",
        "originalDevPromotionGate",
    }
    recovery_selection: dict[str, object] | None = None
    present_recovery_fields = recovery_fields & set(selection)
    if present_recovery_fields:
        if (
            present_recovery_fields != recovery_fields
            or selection.get("selectionKind") != "RECOVERY"
            or not isinstance(selection.get("originalSelectionSha256"), str)
            or not _HEX64.fullmatch(selection["originalSelectionSha256"])
            or selection["originalSelectionSha256"] == selection_sha256
            or selection.get("originalDevPromotionGate")
            != _ORIGINAL_CYCLE_DEV_PROMOTION_GATE
            or experiment.get("devPromotionGate")
            != _ORIGINAL_CYCLE_DEV_PROMOTION_GATE
            or selection.get("devPromotionGate")
            != _RECOVERY_CYCLE_DEV_PROMOTION_GATE
        ):
            raise ValueError("cycle freeze recovery selection provenance mismatch")
        recovery_selection = {
            "recoverySelectionSha256": selection_sha256,
            "originalSelectionSha256": selection["originalSelectionSha256"],
            "originalDevPromotionGate": selection["originalDevPromotionGate"],
            "recoveryDevPromotionGate": selection["devPromotionGate"],
        }
    candidate_sha256 = sha256_file(calibrated_path)
    if selected.get("candidateSha256") != candidate_sha256:
        raise ValueError("cycle freeze selected candidate digest mismatch")
    if (
        candidate.get("schemaVersion") != 1
        or candidate.get("cycleId") != CYCLE_ID
        or candidate.get("experimentId") != EXPERIMENT_ID
        or candidate.get("datasetId") != DATASET_ID
        or candidate.get("runId") != run_id
        or candidate.get("candidateId") != candidate_id
        or candidate.get("calibrationPolicy") != selected.get("calibrationPolicy")
    ):
        raise ValueError("cycle freeze candidate identity mismatch")
    calibration_sha256 = candidate.get("calibrationSha256")
    if not isinstance(calibration_sha256, str) or not _HEX64.fullmatch(calibration_sha256):
        raise ValueError("cycle freeze candidate calibration digest is invalid")
    candidate_provenance = candidate.get("provenance")
    if not isinstance(candidate_provenance, dict):
        raise ValueError("cycle freeze candidate provenance is missing")
    if candidate_provenance.get("experimentManifestSha256") != experiment_sha256:
        raise ValueError("cycle freeze candidate experiment digest mismatch")

    dataset_meta = experiment.get("datasetVersion")
    if not isinstance(dataset_meta, dict):
        raise ValueError("cycle freeze experiment dataset provenance is missing")
    dataset_version_sha256 = dataset_meta.get("sha256")
    if not isinstance(dataset_version_sha256, str) or not _HEX64.fullmatch(dataset_version_sha256):
        raise ValueError("cycle freeze dataset-version digest is invalid")
    dataset_version_path = _single_link_regular(
        Path(cycle_root) / "dataset-version.json",
        "cycle dataset-version.json",
    )
    if sha256_file(dataset_version_path) != dataset_version_sha256:
        raise ValueError("cycle freeze dataset-version digest mismatch")
    if (
        selection.get("datasetVersionSha256") != dataset_version_sha256
        or candidate_provenance.get("datasetVersionSha256") != dataset_version_sha256
    ):
        raise ValueError("cycle freeze source dataset-version provenance mismatch")

    environment_path = _single_link_regular(run_root / "environment.json", "cycle run environment")
    environment = read_json(environment_path)
    if not isinstance(environment, dict) or environment.get("schemaVersion") != 2:
        raise ValueError("cycle freeze run environment must be schema v2")
    if environment.get("gitRevision") != git_revision:
        raise ValueError("cycle freeze run Git revision mismatch")
    cycle_provenance = environment.get("cycleProvenance")
    if not isinstance(cycle_provenance, dict) or (
        cycle_provenance.get("datasetVersionSha256") != dataset_version_sha256
        or cycle_provenance.get("experimentManifestSha256") != experiment_sha256
    ):
        raise ValueError("cycle freeze run provenance mismatch")

    config_path = _single_link_regular(run_root / "model-config.json", "cycle run model config")
    config_document = read_json(config_path)
    if not isinstance(config_document, dict):
        raise ValueError("cycle freeze model config must be an object")
    config = load_training_config_from_document(config_document)
    if config.schema_version != 3 or config.device != "cpu" or config.workers != 0:
        raise ValueError("cycle freeze model config must be deterministic schema v3")
    config_sha256 = hashlib.sha256(
        json.dumps(
            config_to_document(config),
            ensure_ascii=True,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    ).hexdigest()
    if candidate_provenance.get("effectiveConfigSha256") != config_sha256:
        raise ValueError("cycle freeze effective-config digest mismatch")

    checkpoint_path = _single_link_regular(run_root / "checkpoints" / "best-dev.pt", "cycle checkpoint")
    predictions_path = _single_link_regular(run_root / "dev-predictions.json", "cycle dev predictions")
    checkpoint_sha256 = sha256_file(checkpoint_path)
    if (
        environment.get("checkpointSha256") != checkpoint_sha256
        or candidate_provenance.get("checkpointSha256") != checkpoint_sha256
        or candidate_provenance.get("devPredictionsSha256") != sha256_file(predictions_path)
    ):
        raise ValueError("cycle freeze run evidence digest mismatch")

    staging = Path(tempfile.mkdtemp(prefix=".frozen.staging-", dir=artifacts_root))
    try:
        for destination_name, source_name in _FROZEN_INPUTS.items():
            if destination_name == "thresholds.json":
                continue
            source_path = run_root / source_name
            _single_link_regular(source_path, f"cycle freeze input {source_name}")
            shutil.copyfile(source_path, staging / destination_name)
        threshold_document = {
            "schemaVersion": 2,
            "cycleId": CYCLE_ID,
            "experimentId": EXPERIMENT_ID,
            "datasetId": DATASET_ID,
            "runId": run_id,
            "candidateId": candidate_id,
            "calibrationPolicy": candidate["calibrationPolicy"],
            "thresholds": candidate["thresholds"],
            "provenance": {
                "experimentManifestSha256": experiment_sha256,
                "selectionSha256": selection_sha256,
                "candidateSha256": candidate_sha256,
                "calibrationSha256": calibration_sha256,
                "datasetVersionSha256": dataset_version_sha256,
            },
        }
        if recovery_selection is not None:
            threshold_document["selectionRecovery"] = recovery_selection
        atomic_write_json(staging / "thresholds.json", threshold_document)
        atomic_write_json(
            staging / "dataset-snapshot.json",
            build_cycle_dataset_snapshot(
                raw_root,
                labels_root,
                cycle_root,
                dataset_version_sha256,
                cycle_data_roots=cycle_data_roots,
            ),
        )
        atomic_write_json(
            staging / "split-checksums.json",
            checksum_cycle_split_files(cycle_root, dataset_version_sha256),
        )
        files = {
            name: sha256_file(staging / name)
            for name in sorted(set(_FROZEN_INPUTS) | set(_GENERATED))
        }
        atomic_write_json(
            staging / "freeze-manifest.json",
            {
                "schemaVersion": 2,
                "cycleId": CYCLE_ID,
                "experimentId": EXPERIMENT_ID,
                "datasetId": DATASET_ID,
                "runId": run_id,
                "candidateId": candidate_id,
                "gitRevision": git_revision,
                "experimentManifestSha256": experiment_sha256,
                "selectionSha256": selection_sha256,
                "candidateSha256": candidate_sha256,
                "calibrationSha256": calibration_sha256,
                "datasetVersionSha256": dataset_version_sha256,
                "files": files,
            },
        )
        verify_cycle_freeze(staging)
        _publish_directory_no_replace(staging, destination)
        return destination
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def freeze_run(run_dir: Path, raw_root: Path, labels_root: Path, splits_root: Path, duplicate_reviews: Path) -> Path:
    run_dir = Path(run_dir)
    frozen_dir = run_dir / "frozen"
    if os.path.lexists(frozen_dir):
        raise FileExistsError(f"refusing to overwrite frozen candidate: {frozen_dir}")
    validation = validate_splits(raw_root, labels_root, splits_root, duplicate_reviews)
    if not validation.valid:
        raise ValueError("split validation failed: " + "; ".join(f"{item.code}:{item.batch_id}" for item in validation.issues))
    revision = _git_revision()
    environment = read_json(run_dir / "environment.json")
    if not isinstance(environment, dict) or environment.get("gitRevision") != revision:
        raise ValueError("run Git revision does not match current revision")
    staging = Path(tempfile.mkdtemp(prefix=".frozen.staging-", dir=run_dir))
    try:
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
        atomic_write_json(staging / "dataset-snapshot.json", build_dataset_snapshot(raw_root, labels_root, splits_root))
        atomic_write_json(staging / "split-checksums.json", checksum_split_files(splits_root))
        files = {name: sha256_file(staging / name) for name in sorted(set(_FROZEN_INPUTS) | set(_GENERATED))}
        atomic_write_json(staging / "freeze-manifest.json", {"schemaVersion": 1, "runId": run_dir.name, "gitRevision": revision, "files": files})
        verify_freeze(staging)
        _publish_directory_no_replace(staging, frozen_dir)
        return frozen_dir
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise


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
    expected = read_json(frozen_dir / "dataset-snapshot.json")
    if not isinstance(expected, dict) or set(expected) != {"schemaVersion", "batches"} or expected["schemaVersion"] != 1 or not isinstance(expected["batches"], list):
        raise ValueError("invalid dataset snapshot")
    for batch in expected["batches"]:
        if not isinstance(batch, dict) or set(batch) != {"batchId", "split", "manifest", "manifestSha256", "label", "labelSha256", "files"}:
            raise ValueError("invalid snapshot batch")
        batch_dir = Path(raw_root) / batch["batchId"]
        if sha256_file(batch_dir / "manifest.json") != batch["manifestSha256"] or sha256_file(Path(labels_root) / f"{batch['batchId']}.json") != batch["labelSha256"]:
            raise ValueError(f"current dataset does not match frozen snapshot: {batch['batchId']}")
        for entry_path, expected_hash in batch["files"].items():
            if sha256_file(batch_dir / entry_path) != expected_hash:
                raise ValueError(f"current dataset does not match frozen snapshot: {batch['batchId']}/{entry_path}")
    expected_splits = read_json(frozen_dir / "split-checksums.json")
    if not isinstance(expected_splits, dict) or set(expected_splits) != {"schemaVersion", "files"} or expected_splits["schemaVersion"] != 1:
        raise ValueError("invalid split checksums")
    for name, expected_hash in expected_splits["files"].items():
        if sha256_file(Path(splits_root) / name) != expected_hash:
            raise ValueError(f"current split files do not match frozen checksums: {name}")


def main(argv=None) -> int:
    arguments = list(argv) if argv is not None else __import__("sys").argv[1:]
    if not arguments or arguments[0] not in {"freeze", "verify"}:
        arguments.insert(0, "freeze")
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    freeze = sub.add_parser("freeze")
    freeze.add_argument("--run-dir", type=Path, required=True); freeze.add_argument("--raw-root", type=Path, required=True)
    freeze.add_argument("--labels-root", type=Path, required=True); freeze.add_argument("--splits-root", type=Path, required=True)
    freeze.add_argument("--duplicate-reviews", type=Path, default=Path("config/duplicate-reviews.json"))
    verify = sub.add_parser("verify"); verify.add_argument("--frozen-dir", type=Path, required=True)
    args = parser.parse_args(arguments)
    try:
        result = verify_freeze(args.frozen_dir) if args.command == "verify" else freeze_run(args.run_dir, args.raw_root, args.labels_root, args.splits_root, args.duplicate_reviews)
    except (OSError, ValueError, RuntimeError) as error:
        print(f"artifact operation failed: {error}")
        return 2
    print(json.dumps({"result": str(result)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
