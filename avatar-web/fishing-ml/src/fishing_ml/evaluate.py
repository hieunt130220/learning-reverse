"""Locked development and one-shot final evaluation for a frozen candidate."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path
from typing import Literal

import torch

from .artifacts import verify_current_dataset, verify_freeze
from .baselines import predict_episode
from .calibrate import Thresholds, apply_thresholds
from .dataset import NormalizationStats, _load_final_episodes, load_dev_episodes
from .metrics import summarize_predictions
from .model import FishingEncoder
from .schema import atomic_write_json, read_json
from .train import _device, _prediction_json, predict_episodes


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
    if freeze_revision(frozen_dir) != _git():
        raise RuntimeError("frozen Git revision does not match current revision")
    episodes = load_dev_episodes(raw_root, labels_root, splits_root, stats)
    predictions, metrics, loss, baseline = _evaluate(episodes, model, device, float(config_doc["temperature"]), thresholds)
    if abs(_stored_dev_accuracy(frozen_dir) - metrics.top1_accuracy) > float(config_doc["reproducibilityTolerance"]):
        raise RuntimeError("development metrics exceed reproducibility tolerance")
    result = {"schemaVersion": 1, "split": "dev", "loss": loss, "metrics": metrics.to_json(), "baselines": baseline, "predictions": [_prediction_json(row) for row in predictions]}
    atomic_write_json(run_dir / "evaluation-dev.json", result)
    return result


def _create_final_lock(path: Path) -> None:
    descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        os.write(descriptor, f"pid={os.getpid()}\n".encode())
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def evaluate_final_once(run_dir: Path, raw_root: Path, labels_root: Path, splits_root: Path, confirm_final_once: str) -> dict:
    run_dir = Path(run_dir)
    if confirm_final_once != run_dir.name:
        raise PermissionError("exact --confirm-final-once run-id is required")
    output = run_dir / "final-evaluation.json"
    lock = run_dir / "final-evaluation.lock"
    if output.exists() or lock.exists():
        raise FileExistsError("final evaluation report or unresolved lock already exists")
    frozen_dir = run_dir / "frozen"
    freeze = verify_freeze(frozen_dir)
    if freeze.git_revision != _git():
        raise RuntimeError("frozen Git revision does not match current revision")
    verify_current_dataset(frozen_dir, raw_root, labels_root, splits_root)
    config_doc, stats, thresholds, model, device = _inputs(frozen_dir)
    published = False
    _create_final_lock(lock)
    try:
        episodes = _load_final_episodes(raw_root, labels_root, splits_root, stats)
        predictions, metrics, loss, baseline = _evaluate(episodes, model, device, float(config_doc["temperature"]), thresholds)
        result = {"schemaVersion": 1, "split": "final", "loss": loss, "metrics": metrics.to_json(), "baselines": baseline, "predictions": [_prediction_json(row) for row in predictions], "passed": metrics.top1_accuracy >= .99 and metrics.wrong_count == 0}
        atomic_write_json(output, result)
        published = True
        return result
    finally:
        # A published report is the only terminal evidence. On any failure (including
        # transient infra errors) the lock is removed so a corrected rerun is possible;
        # the pre-existing report lock remains the authoritative one-shot guard.
        if not published:
            lock.unlink(missing_ok=True)


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
