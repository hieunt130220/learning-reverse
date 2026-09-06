"""Locked development and one-shot final evaluation for a frozen candidate."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Mapping

import torch

from .artifacts import (
    CycleFreezeManifest,
    verify_current_dataset,
    verify_frozen_bundle as verify_freeze,
)
from .baselines import predict_episode
from .calibrate import Thresholds, apply_thresholds
from .dataset import (
    FishingEpisode,
    NormalizationStats,
    _entries,
    _load_final_episodes,
    load_dev_episodes,
)
from .metrics import summarize_predictions
from .model import FishingEncoder
from .phase2_cycle import (
    CYCLE_ID,
    DATASET_ID,
    EXPERIMENT_ID,
    StageBlockedError,
    load_final_membership_after_lock,
    verify_prefinal_integrity,
)
from .phase2_gate import (
    GateBlockedError,
    GatePolicy,
    adjudicate_final,
    exit_code_for_status,
    load_gate_policy,
    publish_gate_report,
)
from .provenance import revision_matches_recorded
from .schema import (
    atomic_write_json,
    load_label,
    load_manifest,
    publish_no_replace,
    read_json,
    sha256_file,
    validate_batch,
)
from .train import _device, _prediction_json, predict_episodes

_HEX40 = re.compile(r"^[0-9a-f]{40}$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_AUTHORIZATION = re.compile(r"^[A-Za-z0-9_-]{32,128}$")
_CYCLE_GATE_POLICY_PATH = (
    Path(__file__).resolve().parents[2]
    / "config"
    / "phase2"
    / "coverage-recovery-gate.yaml"
)


@dataclass(frozen=True, slots=True)
class _CycleFinalContext:
    freeze: CycleFreezeManifest
    policy: GatePolicy
    command: Mapping[str, object]
    policy_path: Path
    raw_root: Path
    labels_root: Path
    lock_path: Path
    final_report_path: Path
    gate_report_path: Path


def _git() -> str:
    return subprocess.run(["git", "rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()


def _inputs(frozen_dir: Path) -> tuple[dict, NormalizationStats, Thresholds, FishingEncoder, torch.device]:
    frozen_dir = Path(frozen_dir)
    verify_freeze(frozen_dir)
    config_doc = read_json(frozen_dir / "model-config.json")
    norm_doc = read_json(frozen_dir / "normalization.json")
    threshold_doc = read_json(frozen_dir / "thresholds.json")
    if not isinstance(norm_doc, dict) or set(norm_doc) != {"mean", "std"}:
        raise ValueError("invalid normalization.json")
    stats = NormalizationStats(tuple(norm_doc["mean"]), tuple(norm_doc["std"]))
    values = threshold_doc.get("thresholds") if isinstance(threshold_doc, dict) else None
    if not isinstance(values, dict) or set(values) != {"minSimilarity", "minMargin"}:
        raise ValueError("invalid thresholds.json")
    thresholds = Thresholds(float(values["minSimilarity"]), float(values["minMargin"]))
    if not isinstance(config_doc, dict):
        raise ValueError("invalid model-config.json")
    config = load_training_config_from_document(config_doc)
    device = _device(config.device)
    checkpoint = torch.load(frozen_dir / "best-dev.pt", map_location=device, weights_only=False)
    if not isinstance(checkpoint, dict) or "modelStateDict" not in checkpoint:
        raise ValueError("invalid frozen checkpoint")
    model = FishingEncoder(config.embedding_dim, config.channels).to(device)
    model.load_state_dict(checkpoint["modelStateDict"])
    model.eval()
    return config_doc, stats, thresholds, model, device


def load_training_config_from_document(doc: dict):
    """Canonical parser delegating to config.py (supports schema v1 and v2)."""
    from .config import load_training_config_from_document as _canonical
    return _canonical(doc)


def _evaluate(episodes, model, device, temperature, thresholds):
    raw, loss, shapes = predict_episodes(model, episodes, temperature=temperature, device=device)
    predictions = apply_thresholds(raw, thresholds, batch_shapes=shapes)
    metrics = summarize_predictions(predictions, batch_shapes=shapes)
    baseline = {
        name: summarize_predictions(tuple(row for episode in episodes for row in predict_episode(episode, name)), batch_shapes=shapes).to_json()
        for name in ("binary-shape", "ssim", "ncc")
    }
    return predictions, metrics, loss, baseline


def _stored_dev_accuracy(frozen_dir: Path) -> float:
    document = read_json(Path(frozen_dir) / "dev-metrics.json")
    if not isinstance(document, dict):
        raise ValueError("invalid dev-metrics.json")
    value = document.get("top1Accuracy", document.get("top1_accuracy"))
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError("dev metrics are missing top-1 accuracy")
    return float(value)


def freeze_revision(frozen_dir: Path) -> str:
    return _manifest(read_json(Path(frozen_dir) / "freeze-manifest.json")).git_revision


def _manifest(document: object) -> FreezeManifest:
    from .artifacts import FreezeManifest, _manifest as parse
    if not isinstance(document, dict):
        raise ValueError("invalid freeze manifest")
    return parse(document)


def evaluate_run(run_dir: Path, raw_root: Path, labels_root: Path, splits_root: Path, split_name: Literal["dev"] = "dev") -> dict:
    if split_name != "dev":
        raise ValueError("public evaluator only accepts dev")
    run_dir = Path(run_dir)
    frozen_dir = run_dir / "frozen"
    verify_current_dataset(frozen_dir, raw_root, labels_root, splits_root)
    config_doc, stats, thresholds, model, device = _inputs(frozen_dir)
    if not revision_matches_recorded(_git(), freeze_revision(frozen_dir)):
        raise RuntimeError("frozen Git revision does not match current revision")
    episodes = load_dev_episodes(raw_root, labels_root, splits_root, stats)
    predictions, metrics, loss, baseline = _evaluate(episodes, model, device, float(config_doc["temperature"]), thresholds)
    if abs(_stored_dev_accuracy(frozen_dir) - metrics.top1_accuracy) > float(config_doc["reproducibilityTolerance"]):
        raise RuntimeError("development metrics exceed reproducibility tolerance")
    result = {"schemaVersion": 1, "split": "dev", "loss": loss, "metrics": metrics.to_json(), "baselines": baseline, "predictions": [_prediction_json(row) for row in predictions]}
    atomic_write_json(run_dir / "evaluation-dev.json", result)
    return result


def _create_final_lock(path: Path, run_id: str) -> None:
    descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        payload = (
            f"run_id={run_id}\n"
            f"pid={os.getpid()}\n"
            f"started_at={datetime.now(timezone.utc).isoformat()}\n"
        ).encode()
        while payload:
            payload = payload[os.write(descriptor, payload):]
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
    parent_descriptor = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(parent_descriptor)
    finally:
        os.close(parent_descriptor)


def _exact_mapping(
    value: object,
    expected_keys: set[str],
    field: str,
) -> Mapping[str, object]:
    if not isinstance(value, Mapping) or set(value) != expected_keys:
        raise ValueError(f"{field} fields mismatch")
    return value


def _single_link_regular(path: Path, field: str) -> Path:
    candidate = Path(path)
    try:
        metadata = os.lstat(candidate)
    except OSError as error:
        raise ValueError(f"cannot inspect {field}: {error}") from error
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1:
        raise ValueError(f"{field} must be a single-link regular file")
    return candidate


def _absolute_path(value: object, field: str) -> Path:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{field} must be a non-empty absolute path")
    path = Path(value)
    if not path.is_absolute():
        raise ValueError(f"{field} must be an absolute path")
    return path


def _utc_timestamp(value: object, field: str) -> str:
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


def load_cycle_final_command_record(final_output_dir: Path) -> Mapping[str, object]:
    final_root = Path(final_output_dir).resolve()
    command_path = _single_link_regular(
        final_root / "final-command.json",
        "cycle final command record",
    )
    document = _exact_mapping(
        read_json(command_path),
        {
            "schemaVersion",
            "cycle",
            "createdAt",
            "authorization",
            "executable",
            "arguments",
            "paths",
            "evidence",
        },
        "cycle final command record",
    )
    if document["schemaVersion"] != 1 or isinstance(document["schemaVersion"], bool):
        raise ValueError("cycle final command schemaVersion must equal 1")
    cycle = _exact_mapping(
        document["cycle"],
        {"cycleId", "experimentId", "datasetId"},
        "cycle final command cycle",
    )
    if dict(cycle) != {
        "cycleId": CYCLE_ID,
        "experimentId": EXPERIMENT_ID,
        "datasetId": DATASET_ID,
    }:
        raise ValueError("cycle final command identity mismatch")
    _utc_timestamp(document["createdAt"], "cycle final command createdAt")
    authorization = document["authorization"]
    if not isinstance(authorization, str) or _AUTHORIZATION.fullmatch(authorization) is None:
        raise ValueError("cycle final command authorization is invalid")
    executable = _absolute_path(document["executable"], "cycle final executable")
    if executable.resolve() != Path(sys.executable).resolve():
        raise ValueError("cycle final command executable mismatch")
    paths = _exact_mapping(
        document["paths"],
        {
            "cycleRoot",
            "artifactsRoot",
            "frozenDir",
            "gatePolicy",
            "finalOutputDir",
            "lock",
            "finalReport",
            "gateReport",
        },
        "cycle final command paths",
    )
    resolved_paths = {
        name: _absolute_path(value, f"cycle final command paths.{name}").resolve()
        for name, value in paths.items()
    }
    artifacts_root = final_root.parent
    expected_paths = {
        "artifactsRoot": artifacts_root,
        "frozenDir": artifacts_root / "frozen",
        "gatePolicy": _CYCLE_GATE_POLICY_PATH.resolve(),
        "finalOutputDir": final_root,
        "lock": final_root / "final-evaluation.lock",
        "finalReport": final_root / "final-evaluation.json",
        "gateReport": final_root / "gate-final.json",
    }
    if any(resolved_paths[name] != expected for name, expected in expected_paths.items()):
        raise ValueError("cycle final command output path mismatch")
    arguments = document["arguments"]
    expected_arguments = [
        "-m",
        "fishing_ml.coverage_recovery",
        "final-run",
        "--cycle-root",
        str(resolved_paths["cycleRoot"]),
        "--artifacts-root",
        str(resolved_paths["artifactsRoot"]),
        "--authorization",
        authorization,
    ]
    if arguments != expected_arguments:
        raise ValueError("cycle final command arguments mismatch")
    evidence = _exact_mapping(
        document["evidence"],
        {
            "gitRevision",
            "trackedStatusSha256",
            "freezeManifestSha256",
            "gatePolicySha256",
            "datasetVersionSha256",
            "allocationSha256",
            "opaqueFinal",
        },
        "cycle final command evidence",
    )
    if not isinstance(evidence["gitRevision"], str) or _HEX40.fullmatch(evidence["gitRevision"]) is None:
        raise ValueError("cycle final command Git revision is invalid")
    for field in (
        "trackedStatusSha256",
        "freezeManifestSha256",
        "gatePolicySha256",
        "datasetVersionSha256",
        "allocationSha256",
    ):
        if not isinstance(evidence[field], str) or _HEX64.fullmatch(evidence[field]) is None:
            raise ValueError(f"cycle final command {field} is invalid")
    opaque = _exact_mapping(
        evidence["opaqueFinal"],
        {"count", "sizeBytes", "sha256"},
        "cycle final command opaque final",
    )
    if (
        opaque["count"] != 30
        or isinstance(opaque["count"], bool)
        or not isinstance(opaque["sizeBytes"], int)
        or isinstance(opaque["sizeBytes"], bool)
        or opaque["sizeBytes"] <= 0
        or not isinstance(opaque["sha256"], str)
        or _HEX64.fullmatch(opaque["sha256"]) is None
    ):
        raise ValueError("cycle final command opaque commitment is invalid")
    return dict(document)


def _tracked_status_bytes() -> bytes:
    try:
        completed = subprocess.run(
            ["git", "status", "--porcelain=v1", "--untracked-files=no"],
            check=True,
            capture_output=True,
        )
    except (OSError, subprocess.CalledProcessError) as error:
        raise ValueError("cannot inspect tracked Git status") from error
    return completed.stdout


def _cycle_data_roots(cycle_root: Path) -> tuple[Path, Path]:
    root = Path(cycle_root).resolve()
    if root.name != DATASET_ID or root.parent.name != "cycles" or root.parent.parent.name != "phase2":
        raise ValueError("cycle root does not use the approved Phase 2 layout")
    phase2_root = root.parent.parent
    raw_root = phase2_root / "raw"
    labels_root = phase2_root / "labels"
    if not raw_root.is_dir() or raw_root.is_symlink():
        raise ValueError("cycle raw root must be a real directory")
    if not labels_root.is_dir() or labels_root.is_symlink():
        raise ValueError("cycle labels root must be a real directory")
    return raw_root, labels_root


def _verify_cycle_final_prelock(
    frozen_dir: Path,
    cycle_root: Path,
    final_output_dir: Path,
) -> _CycleFinalContext:
    frozen_root = Path(frozen_dir).resolve()
    cycle_data_root = Path(cycle_root).resolve()
    final_root = Path(final_output_dir).resolve()
    if not final_root.is_dir() or final_root.is_symlink():
        raise ValueError("cycle final output directory must be a real directory")
    lock_path = final_root / "final-evaluation.lock"
    final_report_path = final_root / "final-evaluation.json"
    gate_report_path = final_root / "gate-final.json"
    for path in (lock_path, final_report_path, gate_report_path):
        if os.path.lexists(path):
            raise StageBlockedError(
                f"cycle final output already exists or is unresolved: {path}"
            )

    command = load_cycle_final_command_record(final_root)
    command_paths = command["paths"]
    if (
        Path(command_paths["cycleRoot"]).resolve() != cycle_data_root
        or Path(command_paths["frozenDir"]).resolve() != frozen_root
    ):
        raise ValueError("cycle final command input path mismatch")

    freeze = verify_freeze(frozen_root)
    if not isinstance(freeze, CycleFreezeManifest):
        raise ValueError("cycle final requires a schema-v2 frozen bundle")
    if (
        freeze.cycle_id != CYCLE_ID
        or freeze.experiment_id != EXPERIMENT_ID
        or freeze.dataset_id != DATASET_ID
    ):
        raise ValueError("cycle final frozen identity mismatch")
    current_revision = _git()
    if not revision_matches_recorded(current_revision, freeze.git_revision):
        raise ValueError("cycle final Git revision is incompatible with freeze")

    policy_path = Path(command_paths["gatePolicy"]).resolve()
    policy = load_gate_policy(policy_path)
    if (
        policy.schema_version != 2
        or policy.pre_agreed_placeholders
        or policy.cycle_id != freeze.cycle_id
        or policy.experiment_id != freeze.experiment_id
        or policy.dataset_id != freeze.dataset_id
    ):
        raise GateBlockedError("cycle final gate policy is not approved for this freeze")

    integrity = verify_prefinal_integrity(cycle_data_root)
    snapshot = _exact_mapping(
        read_json(frozen_root / "dataset-snapshot.json"),
        {
            "schemaVersion",
            "cycleId",
            "datasetId",
            "datasetVersionSha256",
            "batches",
            "sealedFinal",
        },
        "cycle frozen dataset snapshot",
    )
    sealed_final = _exact_mapping(
        snapshot["sealedFinal"],
        {"path", "count", "sizeBytes", "sha256"},
        "cycle frozen sealed final",
    )
    if sealed_final != {
        "path": "splits/sealed-final.txt",
        "count": integrity.final_count,
        "sizeBytes": integrity.final_size_bytes,
        "sha256": integrity.final_sha256,
    }:
        raise ValueError("cycle final opaque commitment does not match freeze")

    dataset_version_path = _single_link_regular(
        cycle_data_root / "dataset-version.json",
        "cycle dataset version",
    )
    allocation_path = _single_link_regular(
        cycle_data_root / "allocation.json",
        "cycle allocation",
    )
    evidence = command["evidence"]
    tracked_status = _tracked_status_bytes()
    if tracked_status:
        raise GateBlockedError("cycle final requires a clean tracked worktree")
    expected_evidence = {
        "gitRevision": current_revision,
        "trackedStatusSha256": hashlib.sha256(tracked_status).hexdigest(),
        "freezeManifestSha256": sha256_file(frozen_root / "freeze-manifest.json"),
        "gatePolicySha256": sha256_file(policy_path),
        "datasetVersionSha256": sha256_file(dataset_version_path),
        "allocationSha256": sha256_file(allocation_path),
        "opaqueFinal": {
            "count": integrity.final_count,
            "sizeBytes": integrity.final_size_bytes,
            "sha256": integrity.final_sha256,
        },
    }
    if evidence != expected_evidence:
        raise ValueError("cycle final command evidence no longer matches current state")
    if expected_evidence["datasetVersionSha256"] != freeze.dataset_version_sha256:
        raise ValueError("cycle final dataset-version digest does not match freeze")
    raw_root, labels_root = _cycle_data_roots(cycle_data_root)
    return _CycleFinalContext(
        freeze=freeze,
        policy=policy,
        command=command,
        policy_path=policy_path,
        raw_root=raw_root,
        labels_root=labels_root,
        lock_path=lock_path,
        final_report_path=final_report_path,
        gate_report_path=gate_report_path,
    )


def _load_cycle_final_episodes(
    raw_root: Path,
    labels_root: Path,
    final_ids: tuple[str, ...],
    stats: NormalizationStats,
) -> tuple[FishingEpisode, ...]:
    if len(final_ids) != 30 or tuple(sorted(final_ids)) != final_ids or len(set(final_ids)) != 30:
        raise ValueError("cycle final membership must contain exactly 30 sorted unique ids")
    episodes: list[FishingEpisode] = []
    for batch_id in final_ids:
        batch_dir = Path(raw_root) / batch_id
        manifest = load_manifest(batch_dir / "manifest.json")
        label = load_label(Path(labels_root) / f"{batch_id}.json")
        if manifest.batch_id != batch_id or label.batch_id != batch_id or label.status != "complete":
            raise ValueError(f"cycle final batch contract mismatch: {batch_id}")
        validate_batch(batch_dir, manifest)
        if (
            len(label.matches) != len(manifest.images_new)
            or {match.new_index for match in label.matches}
            != set(range(len(manifest.images_new)))
            or any(
                match.img_index not in {entry.index for entry in manifest.images}
                for match in label.matches
            )
        ):
            raise ValueError(f"cycle final label coverage mismatch: {batch_id}")
        episodes.append(
            FishingEpisode(
                batch_id,
                *_entries(Path(raw_root), Path(labels_root), batch_id, stats),
            )
        )
    return tuple(episodes)


def evaluate_cycle_final_once(
    frozen_dir: Path,
    cycle_root: Path,
    final_output_dir: Path,
    authorization: str,
    expected_authorization: str,
) -> dict[str, object]:
    context = _verify_cycle_final_prelock(frozen_dir, cycle_root, final_output_dir)
    config_doc, stats, thresholds, model, device = _inputs(Path(frozen_dir))
    if not isinstance(config_doc, dict) or config_doc.get("schemaVersion") != 3:
        raise ValueError("cycle final requires a schema-v3 model config")
    recorded_authorization = context.command["authorization"]
    if (
        not isinstance(authorization, str)
        or authorization != expected_authorization
        or expected_authorization != recorded_authorization
    ):
        raise GateBlockedError("exact one-use cycle final authorization is required")

    _create_final_lock(context.lock_path, context.freeze.run_id)
    final_ids = load_final_membership_after_lock(cycle_root, context.lock_path)
    episodes = _load_cycle_final_episodes(
        context.raw_root,
        context.labels_root,
        final_ids,
        stats,
    )
    predictions, metrics, loss, baseline = _evaluate(
        episodes,
        model,
        device,
        float(config_doc["temperature"]),
        thresholds,
    )
    final_report = {
        "schemaVersion": 2,
        "cycle": {
            "cycleId": context.freeze.cycle_id,
            "experimentId": context.freeze.experiment_id,
            "datasetId": context.freeze.dataset_id,
        },
        "split": "final",
        "batchCount": len(episodes),
        "runId": context.freeze.run_id,
        "candidateId": context.freeze.candidate_id,
        "freezeManifestSha256": sha256_file(
            Path(frozen_dir) / "freeze-manifest.json"
        ),
        "loss": loss,
        "metrics": metrics.to_json(),
        "baselines": baseline,
        "predictions": [_prediction_json(row) for row in predictions],
    }
    publish_no_replace(context.final_report_path, final_report)
    final_report_sha256 = sha256_file(context.final_report_path)
    gate_report = adjudicate_final(
        context.policy,
        {"metrics": final_report["metrics"]},
        policy_sha256=sha256_file(context.policy_path),
        evidence_sha256=final_report_sha256,
    )
    publish_gate_report(context.gate_report_path, gate_report)
    gate_exit = exit_code_for_status(gate_report.status)
    terminal_state = {
        "pass": "FINAL_PASS",
        "fail": "FINAL_FAIL",
        "blocked": "FINAL_BLOCKED",
    }[gate_report.status]
    return {
        "schemaVersion": 1,
        "cycleId": context.freeze.cycle_id,
        "status": gate_report.status.upper(),
        "terminalState": terminal_state,
        "exitCode": gate_exit,
        "finalReport": str(context.final_report_path),
        "finalReportSha256": final_report_sha256,
        "gateReport": str(context.gate_report_path),
        "gateReportSha256": sha256_file(context.gate_report_path),
    }


def evaluate_final_once(
    run_dir: Path,
    raw_root: Path,
    labels_root: Path,
    splits_root: Path,
    confirm_final_once: str,
    *,
    phase2_confirmed: bool = False,
    duplicate_reviews: Path | None = None,
) -> dict:
    """Evaluate the final split once after the caller has supplied an exact run id.

    Schema-v1 candidates retain the historical direct-evaluator behavior. Schema-v2
    candidates are refused unless the Phase 2 experiment command has completed its
    gate preflight and explicitly opts into this internal evaluation boundary.
    The opt-in is keyword-only so the ordinary ``fishing-evaluate final`` CLI cannot
    accidentally enable it.
    """
    run_dir = Path(run_dir)
    if confirm_final_once != run_dir.name:
        raise PermissionError("exact --confirm-final-once run-id is required")
    output = run_dir / "final-evaluation.json"
    lock = run_dir / "final-evaluation.lock"
    if output.exists() or lock.exists():
        raise FileExistsError("final evaluation report or unresolved lock already exists")
    frozen_dir = run_dir / "frozen"
    freeze = verify_freeze(frozen_dir)
    if not revision_matches_recorded(_git(), freeze.git_revision):
        raise RuntimeError("frozen Git revision does not match current revision")
    # Load and classify the frozen model config before any dataset validation:
    # verify_current_dataset validates all split files, including final.txt.
    # A direct evaluator call must therefore reject schema-v2 before it can
    # touch the final split at all.
    config_doc, stats, thresholds, model, device = _inputs(frozen_dir)
    is_schema_v2 = isinstance(config_doc, dict) and config_doc.get("schemaVersion") == 2
    if is_schema_v2 and not phase2_confirmed:
        raise RuntimeError(
            "Phase 2 frozen candidates (schema-v2 model config) require "
            "fishing-phase2-experiment confirm-final; direct fishing-evaluate "
            "final is disabled for v2"
        )
    if phase2_confirmed and not is_schema_v2:
        raise PermissionError("Phase 2 confirmation requires a schema-v2 model config")
    _create_final_lock(lock, run_dir.name)
    verify_current_dataset(
        frozen_dir,
        raw_root,
        labels_root,
        splits_root,
        duplicate_reviews=duplicate_reviews,
    )
    episodes = _load_final_episodes(
        raw_root,
        labels_root,
        splits_root,
        stats,
        duplicate_reviews=duplicate_reviews,
    )
    predictions, metrics, loss, baseline = _evaluate(episodes, model, device, float(config_doc["temperature"]), thresholds)
    result = {"schemaVersion": 1, "split": "final", "loss": loss, "metrics": metrics.to_json(), "baselines": baseline, "predictions": [_prediction_json(row) for row in predictions], "passed": metrics.top1_accuracy >= .99 and metrics.wrong_count == 0}
    publish_no_replace(output, result)
    return result


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="mode", required=True)
    for mode in ("dev", "final"):
        current = sub.add_parser(mode)
        current.add_argument("--run-dir", type=Path, required=True); current.add_argument("--raw-root", type=Path, required=True)
        current.add_argument("--labels-root", type=Path, required=True); current.add_argument("--splits-root", type=Path, required=True)
        if mode == "final":
            current.add_argument("--confirm-final-once", required=True)
    args = parser.parse_args(argv)
    try:
        result = evaluate_run(args.run_dir, args.raw_root, args.labels_root, args.splits_root) if args.mode == "dev" else evaluate_final_once(args.run_dir, args.raw_root, args.labels_root, args.splits_root, args.confirm_final_once)
        print(json.dumps({"split": result["split"], "passed": result.get("passed", True)}, sort_keys=True))
        return 0 if result.get("passed", True) else 3
    except (OSError, ValueError, PermissionError, FileExistsError, RuntimeError) as error:
        print(f"evaluation failed: {error}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
