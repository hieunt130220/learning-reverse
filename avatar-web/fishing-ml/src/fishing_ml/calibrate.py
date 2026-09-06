"""Calibrate similarity and margin abstention thresholds using dev predictions only."""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from math import isfinite
from pathlib import Path
from typing import AbstractSet, Sequence

from .metrics import Prediction, summarize_predictions
from .schema import atomic_write_json, read_json, sha256_file


@dataclass(frozen=True, slots=True)
class Thresholds:
    min_similarity: float
    min_margin: float


@dataclass(frozen=True, slots=True)
class CalibrationResult:
    thresholds: Thresholds
    accepted_count: int
    accepted_accuracy: float | None
    abstention_rate: float
    accepted_wrong_count: int


def _prediction(document: object, index: int) -> Prediction:
    if not isinstance(document, dict):
        raise ValueError(f"predictions[{index}] must be an object")
    required = {"batchId", "newIndex", "expectedImgIndex", "predictedImgIndex", "similarity", "margin", "accepted"}
    if set(document) != required:
        raise ValueError(f"predictions[{index}] fields mismatch")
    margin = document["margin"]
    values = (document["newIndex"], document["expectedImgIndex"], document["predictedImgIndex"])
    if any(not isinstance(value, int) or isinstance(value, bool) or value < 0 for value in values):
        raise ValueError(f"predictions[{index}] has invalid indices")
    if not isinstance(document["batchId"], str) or not document["batchId"]:
        raise ValueError(f"predictions[{index}] has invalid batchId")
    similarity = document["similarity"]
    if not isinstance(similarity, (int, float)) or isinstance(similarity, bool) or not isfinite(float(similarity)):
        raise ValueError(f"predictions[{index}] has invalid similarity")
    if margin is not None and (not isinstance(margin, (int, float)) or isinstance(margin, bool) or not isfinite(float(margin)) or margin < 0):
        raise ValueError(f"predictions[{index}] has invalid margin")
    return Prediction(
        batch_id=document["batchId"], new_index=values[0], expected_img_index=values[1],
        predicted_img_index=values[2], similarity=float(similarity),
        margin=None if margin is None else float(margin), accepted=True,
    )


def load_dev_predictions(path: Path) -> tuple[Prediction, ...]:
    document = read_json(path)
    if not isinstance(document, dict) or set(document) != {"schemaVersion", "split", "selectedEpoch", "predictions"}:
        raise ValueError("dev-predictions.json fields mismatch")
    if document["schemaVersion"] != 1 or document["split"] != "dev" or not isinstance(document["predictions"], list):
        raise ValueError("invalid dev-predictions.json metadata")
    rows = tuple(_prediction(item, index) for index, item in enumerate(document["predictions"]))
    if not rows:
        raise ValueError("development predictions are empty")
    summarize_predictions(rows)
    return rows


def apply_thresholds(
    predictions: tuple[Prediction, ...] | list[Prediction],
    thresholds: Thresholds,
    *,
    batch_shapes: dict[str, tuple[int, int]] | None = None,
) -> tuple[Prediction, ...]:
    if not isfinite(thresholds.min_similarity) or not isfinite(thresholds.min_margin):
        raise ValueError("thresholds must be finite")
    if thresholds.min_margin < 0:
        raise ValueError("minimum margin must be non-negative")
    result = tuple(
        Prediction(
            batch_id=row.batch_id, new_index=row.new_index,
            expected_img_index=row.expected_img_index, predicted_img_index=row.predicted_img_index,
            similarity=row.similarity, margin=row.margin,
            accepted=row.similarity >= thresholds.min_similarity and (row.margin is None or row.margin >= thresholds.min_margin),
        )
        for row in predictions
    )
    summarize_predictions(result, batch_shapes=batch_shapes)
    return result


def calibrate_thresholds(
    predictions: tuple[Prediction, ...] | list[Prediction],
    *,
    require_zero_wrong_accepted: bool = True,
    allow_full_abstention: bool = False,
) -> CalibrationResult:
    rows = tuple(predictions)
    if not rows:
        raise ValueError("development predictions are empty")
    summarize_predictions(rows)
    similarities = sorted({row.similarity for row in rows})
    margins = sorted({0.0, *(row.margin for row in rows if row.margin is not None)})
    best: tuple[tuple[int, float, float], CalibrationResult] | None = None
    for similarity in similarities:
        for margin in margins:
            thresholds = Thresholds(similarity, margin)
            summary = summarize_predictions(apply_thresholds(rows, thresholds))
            if require_zero_wrong_accepted and summary.accepted_wrong_count:
                continue
            if summary.accepted_count == 0 and not allow_full_abstention:
                continue
            result = CalibrationResult(thresholds, summary.accepted_count, summary.accepted_accuracy, summary.abstention_rate, summary.accepted_wrong_count)
            key = (summary.accepted_count, similarity, margin)
            if best is None or key > best[0]:
                best = (key, result)
    if best is None:
        raise ValueError("no calibration candidate satisfies the acceptance objective")
    return best[1]


def calibrate_partition_robust_zero_wrong(
    predictions: Sequence[Prediction],
    inherited_dev_ids: AbstractSet[str],
    acquired_dev_ids: AbstractSet[str],
) -> CalibrationResult:
    rows = tuple(predictions)
    summarize_predictions(rows)
    inherited = frozenset(inherited_dev_ids)
    acquired = frozenset(acquired_dev_ids)
    if len(inherited) != 30:
        raise ValueError("partition-robust calibration requires exactly 30 inherited-dev batches")
    if len(acquired) != 15:
        raise ValueError("partition-robust calibration requires exactly 15 acquired-dev batches")
    if any(not isinstance(batch_id, str) or not batch_id for batch_id in inherited | acquired):
        raise ValueError("partition batch ids must be non-empty strings")
    overlap = inherited.intersection(acquired)
    if overlap:
        raise ValueError("inherited-dev and acquired-dev partitions overlap")

    expected_batches = inherited | acquired
    observed_batches = {row.batch_id for row in rows}
    if observed_batches != expected_batches:
        missing = sorted(expected_batches - observed_batches)
        unexpected = sorted(observed_batches - expected_batches)
        details: list[str] = []
        if missing:
            details.append(f"missing batches: {', '.join(missing)}")
        if unexpected:
            details.append(f"unexpected batches: {', '.join(unexpected)}")
        raise ValueError("partition prediction coverage mismatch (" + "; ".join(details) + ")")

    inherited_rows = tuple(row for row in rows if row.batch_id in inherited)
    acquired_rows = tuple(row for row in rows if row.batch_id in acquired)
    inherited_result = calibrate_thresholds(
        inherited_rows,
        require_zero_wrong_accepted=True,
        allow_full_abstention=False,
    )
    acquired_result = calibrate_thresholds(
        acquired_rows,
        require_zero_wrong_accepted=True,
        allow_full_abstention=False,
    )
    thresholds = Thresholds(
        min_similarity=max(
            inherited_result.thresholds.min_similarity,
            acquired_result.thresholds.min_similarity,
        ),
        min_margin=max(
            inherited_result.thresholds.min_margin,
            acquired_result.thresholds.min_margin,
        ),
    )
    summary = summarize_predictions(apply_thresholds(rows, thresholds))
    if summary.accepted_wrong_count:
        raise ValueError("partition-robust combined thresholds accepted a wrong prediction")
    if summary.accepted_count == 0:
        raise ValueError("partition-robust combined thresholds fully abstain")
    return CalibrationResult(
        thresholds=thresholds,
        accepted_count=summary.accepted_count,
        accepted_accuracy=summary.accepted_accuracy,
        abstention_rate=summary.abstention_rate,
        accepted_wrong_count=summary.accepted_wrong_count,
    )


def calibrate_run(run_dir: Path, require_zero_wrong_accepted: bool = True) -> Path:
    run_dir = Path(run_dir)
    output = run_dir / "thresholds.json"
    if output.exists():
        raise FileExistsError(f"refusing to overwrite thresholds: {output}")
    source = run_dir / "dev-predictions.json"
    result = calibrate_thresholds(load_dev_predictions(source), require_zero_wrong_accepted=require_zero_wrong_accepted)
    atomic_write_json(output, {
        "schemaVersion": 1,
        "source": {"file": source.name, "sha256": sha256_file(source), "split": "dev"},
        "objective": {"requireZeroWrongAccepted": require_zero_wrong_accepted, "tieBreak": ["acceptedCount", "minSimilarity", "minMargin"]},
        "thresholds": {"minSimilarity": result.thresholds.min_similarity, "minMargin": result.thresholds.min_margin},
        "metrics": {"acceptedCount": result.accepted_count, "acceptedAccuracy": result.accepted_accuracy, "abstentionRate": result.abstention_rate, "wrongAcceptedCount": result.accepted_wrong_count},
    })
    return output


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--allow-wrong-accepted", action="store_true", help="Disable the zero-wrong-accepted safety objective (defaults on).")
    args = parser.parse_args(argv)
    try:
        output = calibrate_run(args.run_dir, require_zero_wrong_accepted=not args.allow_wrong_accepted)
    except (OSError, ValueError) as error:
        print(f"calibration failed: {error}")
        return 2
    print(json.dumps({"thresholds": str(output)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
