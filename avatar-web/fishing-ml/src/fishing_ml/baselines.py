"""Binary-shape, SSIM, and NCC classical fishing-image baselines."""
from __future__ import annotations

import argparse
from dataclasses import asdict
import json
from pathlib import Path
from typing import Callable, Sequence

import numpy as np
from skimage.filters import threshold_otsu
from skimage.metrics import structural_similarity
import torch

from .dataset import FishingEpisode, load_dev_episodes
from .metrics import Prediction, summarize_predictions

Ranker = Callable[[np.ndarray, np.ndarray], float]


def _gray(image: torch.Tensor) -> np.ndarray:
    array = image.detach().cpu().numpy()
    if array.shape != (3, 75, 75):
        raise ValueError(f"expected RGB CHW image [3,75,75], got {array.shape}")
    return np.tensordot(np.array([0.299, 0.587, 0.114], dtype=np.float32), array, axes=(0, 0)).astype(np.float32)


def binary_shape(reference: np.ndarray, query: np.ndarray) -> float:
    """Compare independently thresholded foreground silhouettes."""
    def mask(image: np.ndarray) -> np.ndarray:
        threshold = float(threshold_otsu(image)) if np.ptp(image) else float(image.flat[0])
        candidate = image <= threshold
        return ~candidate if candidate.mean() > 0.5 else candidate
    return 1.0 - float(np.mean(mask(reference) != mask(query)))


def ssim(reference: np.ndarray, query: np.ndarray) -> float:
    return float(structural_similarity(reference, query, data_range=1.0))


def ncc(reference: np.ndarray, query: np.ndarray) -> float:
    left = reference - reference.mean()
    right = query - query.mean()
    denominator = float(np.linalg.norm(left) * np.linalg.norm(right))
    return float(np.sum(left * right) / denominator) if denominator > 0 else 0.0


def predict_episode(episode: FishingEpisode, method: str) -> tuple[Prediction, ...]:
    ranker: Ranker = {"binary-shape": binary_shape, "ssim": ssim, "ncc": ncc}[method]
    references = [_gray(image) for image in episode.references]
    predictions: list[Prediction] = []
    for new_index, (query_tensor, target) in enumerate(zip(episode.queries, episode.targets)):
        query = _gray(query_tensor)
        scores = np.asarray([ranker(reference, query) for reference in references], dtype=np.float64)
        order = np.argsort(-scores, kind="stable")
        predicted = int(order[0])
        margin = float(scores[order[0]] - scores[order[1]]) if len(order) > 1 else None
        predictions.append(Prediction(episode.batch_id, new_index, int(target), predicted, float(scores[predicted]), margin, True))
    return tuple(predictions)


def run_baseline(episodes: Sequence[FishingEpisode], method: str) -> dict[str, object]:
    predictions = tuple(prediction for episode in episodes for prediction in predict_episode(episode, method))
    shapes = {episode.batch_id: (len(episode.references), len(episode.queries)) for episode in episodes}
    return {
        "schemaVersion": 1,
        "method": method,
        "split": "dev",
        "metrics": summarize_predictions(predictions, batch_shapes=shapes).to_json(),
        "predictions": [asdict(prediction) for prediction in predictions],
    }


def _atomic_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(path)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--method", choices=("binary-shape", "ssim", "ncc"), required=True)
    parser.add_argument("--split", choices=("train", "dev", "final"), required=True)
    parser.add_argument("--raw-root", type=Path, required=True)
    parser.add_argument("--labels-root", type=Path, required=True)
    parser.add_argument("--splits-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    if args.split == "final":
        parser.error("final split is locked; only fishing_ml.evaluate may open it")
    if args.split != "dev":
        parser.error("classical baseline reporting is dev-only")
    episodes = load_dev_episodes(args.raw_root, args.labels_root, args.splits_root, None)
    _atomic_json(args.output, run_baseline(episodes, args.method))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
