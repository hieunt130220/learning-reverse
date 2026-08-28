"""Locked development and one-shot final evaluation for a frozen candidate."""
from __future__ import annotations

import argparse, json, subprocess
from dataclasses import asdict
from pathlib import Path
from typing import Literal

import torch

from .artifacts import verify_freeze
from .baselines import predict_episode
from .calibrate import apply_thresholds
from .config import load_training_config
from .dataset import NormalizationStats, load_dev_episodes, _load_final_episodes
from .metrics import Prediction, summarize_predictions
from .model import FishingEncoder
from .schema import atomic_write_json, read_json, sha256_file
from .train import predict_episodes, _device, _prediction_json


def _git() -> str:
    return subprocess.run(["git", "rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()


def _inputs(run_dir: Path) -> tuple[dict, NormalizationStats, object, FishingEncoder, torch.device]:
    config_doc = read_json(run_dir / "model-config.json")
    norm_doc = read_json(run_dir / "normalization.json")
    threshold_doc = read_json(run_dir / "thresholds.json")
    if not isinstance(norm_doc, dict) or set(norm_doc) != {"mean", "std"}:
        raise ValueError("invalid normalization.json")
    stats = NormalizationStats(tuple(norm_doc["mean"]), tuple(norm_doc["std"]))
    values = threshold_doc.get("thresholds") if isinstance(threshold_doc, dict) else None
    if not isinstance(values, dict) or set(values) != {"minSimilarity", "minMargin"}:
        raise ValueError("invalid thresholds.json")
    from .calibrate import Thresholds
    thresholds = Thresholds(float(values["minSimilarity"]), float(values["minMargin"]))
    if not isinstance(config_doc, dict): raise ValueError("invalid model-config.json")
    config = load_training_config_from_document(config_doc)
    device = _device(config.device)
    checkpoint = torch.load(run_dir / "checkpoints" / "best-dev.pt", map_location=device, weights_only=False)
    model = FishingEncoder(config.embedding_dim, config.channels).to(device)
    model.load_state_dict(checkpoint["modelStateDict"])
    model.eval()
    return config_doc, stats, thresholds, model, device


def load_training_config_from_document(doc: dict):
    required = {"schemaVersion","seed","epochs","learningRate","weightDecay","temperature","embeddingDim","channels","checkpointMetric","device","workers","reproducibilityTolerance"}
    if set(doc) != required: raise ValueError("model config fields mismatch")
    # Config parser is intentionally reused through a temporary in-memory equivalent.
    from .config import TrainingConfig
    return TrainingConfig(doc["schemaVersion"],doc["seed"],doc["epochs"],doc["learningRate"],doc["weightDecay"],doc["temperature"],doc["embeddingDim"],tuple(doc["channels"]),doc["checkpointMetric"],doc["device"],doc["workers"],doc["reproducibilityTolerance"])


def _evaluate(episodes, model, device, temperature, thresholds):
    raw, loss, shapes = predict_episodes(model, episodes, temperature=temperature, device=device)
    predictions = apply_thresholds(raw, thresholds, batch_shapes=shapes)
    metrics = summarize_predictions(predictions, batch_shapes=shapes)
    baseline = {name: summarize_predictions(tuple(p for e in episodes for p in predict_episode(e,name)), batch_shapes=shapes).to_json() for name in ("binary-shape","ssim","ncc")}
    return predictions, metrics, loss, shapes, baseline


def evaluate_run(run_dir: Path, raw_root: Path, labels_root: Path, splits_root: Path, split_name: Literal["dev"] = "dev") -> dict:
    if split_name != "dev": raise ValueError("public evaluator only accepts dev")
    run_dir=Path(run_dir); verify_freeze(run_dir/"frozen")
    config_doc, stats, thresholds, model, device = _inputs(run_dir)
    episodes=load_dev_episodes(raw_root,labels_root,splits_root,stats)
    predictions, metrics, loss, shapes, baseline = _evaluate(episodes,model,device,float(config_doc["temperature"]),thresholds)
    stored=read_json(run_dir/"dev-metrics.json")
    tolerance=float(config_doc["reproducibilityTolerance"])
    if abs(float(stored.get("top1Accuracy", stored.get("top1_accuracy",0))) - metrics.top1_accuracy) > tolerance:
        raise RuntimeError("development metrics exceed reproducibility tolerance")
    result={"schemaVersion":1,"split":"dev","loss":loss,"metrics":metrics.to_json(),"baselines":baseline,"predictions":[_prediction_json(p) for p in predictions]}
    atomic_write_json(run_dir/"evaluation-dev.json",result)
    return result


def evaluate_final_once(run_dir: Path, raw_root: Path, labels_root: Path, splits_root: Path, confirm_final_once: str) -> dict:
    run_dir=Path(run_dir)
    if confirm_final_once != run_dir.name: raise PermissionError("exact --confirm-final-once run-id is required")
    output=run_dir/"final-evaluation.json"
    if output.exists(): raise FileExistsError("final evaluation already exists; one-shot lock")
    freeze=verify_freeze(run_dir/"frozen")
    if freeze.git_revision != _git(): raise RuntimeError("frozen Git revision does not match current revision")
    config_doc, stats, thresholds, model, device = _inputs(run_dir)
    episodes=_load_final_episodes(raw_root,labels_root,splits_root,stats)
    predictions, metrics, loss, shapes, baseline = _evaluate(episodes,model,device,float(config_doc["temperature"]),thresholds)
    result={"schemaVersion":1,"split":"final","loss":loss,"metrics":metrics.to_json(),"baselines":baseline,"predictions":[_prediction_json(p) for p in predictions],"passed":metrics.top1_accuracy>=.99 and metrics.wrong_count==0}
    atomic_write_json(run_dir/"final-predictions.json",result["predictions"])
    atomic_write_json(output,result)
    return result


def main(argv=None) -> int:
    p=argparse.ArgumentParser(); sub=p.add_subparsers(dest="mode",required=True)
    for mode in ("dev","final"):
        q=sub.add_parser(mode); q.add_argument("--run-dir",type=Path,required=True); q.add_argument("--raw-root",type=Path,required=True); q.add_argument("--labels-root",type=Path,required=True); q.add_argument("--splits-root",type=Path,required=True)
        if mode=="final": q.add_argument("--confirm-final-once",required=True)
    a=p.parse_args(argv)
    try:
        result=evaluate_run(a.run_dir,a.raw_root,a.labels_root,a.splits_root) if a.mode=="dev" else evaluate_final_once(a.run_dir,a.raw_root,a.labels_root,a.splits_root,a.confirm_final_once)
        print(json.dumps({"split":result["split"],"passed":result.get("passed",True)},sort_keys=True)); return 0 if result.get("passed",True) else 3
    except (ValueError,FileNotFoundError,PermissionError,FileExistsError,RuntimeError) as e:
        print(f"evaluation failed: {e}"); return 2

if __name__ == "__main__": raise SystemExit(main())
