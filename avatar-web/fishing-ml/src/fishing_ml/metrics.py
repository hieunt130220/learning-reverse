"""Shared prediction validation and deterministic metric aggregation."""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from math import isfinite
from typing import Iterable, Mapping


@dataclass(frozen=True, slots=True)
class Prediction:
    batch_id: str
    new_index: int
    expected_img_index: int
    predicted_img_index: int
    similarity: float
    margin: float | None
    accepted: bool


@dataclass(frozen=True, slots=True)
class MetricSummary:
    top1_accuracy: float
    wrong_count: int
    query_count: int
    batch_exact_match: float
    batch_exact_count: int
    batch_count: int
    all_accepted_batch_count: int
    accepted_accuracy: float | None
    accepted_count: int
    abstention_count: int
    abstention_rate: float
    score_distribution: dict[str, float | int | None]
    margin_distribution: dict[str, float | int | None]
    grouped_metrics: dict[str, dict[str, float | int]]
    index_histogram: dict[str, int]

    def to_json(self) -> dict[str, object]:
        return asdict(self)


def validate_predictions(predictions: Iterable[Prediction]) -> tuple[Prediction, ...]:
    rows = tuple(predictions)
    seen: set[tuple[str, int]] = set()
    for row in rows:
        if not row.batch_id:
            raise ValueError("prediction batch_id must be non-empty")
        if row.new_index < 0 or row.expected_img_index < 0 or row.predicted_img_index < 0:
            raise ValueError("prediction indices must be non-negative")
        key = (row.batch_id, row.new_index)
        if key in seen:
            raise ValueError(f"duplicate prediction for {row.batch_id} query {row.new_index}")
        seen.add(key)
        if not isfinite(row.similarity):
            raise ValueError("prediction similarity must be finite")
        if row.margin is not None and (not isfinite(row.margin) or row.margin < 0):
            raise ValueError("prediction margin must be finite and non-negative")
    return rows


def _distribution(values: list[float]) -> dict[str, float | int | None]:
    if not values:
        return {"count": 0, "min": None, "max": None, "mean": None}
    return {"count": len(values), "min": min(values), "max": max(values), "mean": sum(values) / len(values)}


def summarize_predictions(
    predictions: Iterable[Prediction],
    *,
    batch_shapes: Mapping[str, tuple[int, int]] | None = None,
) -> MetricSummary:
    rows = validate_predictions(predictions)
    by_batch: dict[str, list[Prediction]] = defaultdict(list)
    for row in rows:
        by_batch[row.batch_id].append(row)
    correct_count = sum(row.predicted_img_index == row.expected_img_index for row in rows)
    accepted = tuple(row for row in rows if row.accepted)
    accepted_correct = sum(row.predicted_img_index == row.expected_img_index for row in accepted)
    exact_count = sum(all(row.predicted_img_index == row.expected_img_index for row in batch) for batch in by_batch.values())
    all_accepted_count = sum(all(row.accepted for row in batch) for batch in by_batch.values())
    groups: dict[str, list[Prediction]] = defaultdict(list)
    if batch_shapes is not None:
        unknown = set(by_batch) - set(batch_shapes)
        if unknown:
            raise ValueError(f"missing batch shapes for: {', '.join(sorted(unknown))}")
        for batch_id, (references, queries) in batch_shapes.items():
            if references <= 0 or queries <= 0:
                raise ValueError(f"invalid R/Q shape for {batch_id}")
            batch = by_batch.get(batch_id, [])
            query_indices = {row.new_index for row in batch}
            if len(batch) != queries or query_indices != set(range(queries)):
                raise ValueError(f"invalid predictions for {batch_id}: expected query indices 0..{queries - 1}")
            if any(row.expected_img_index >= references or row.predicted_img_index >= references for row in batch):
                raise ValueError(f"prediction image index outside R={references} for {batch_id}")
            groups[f"R={references},Q={queries}"].extend(batch)
    grouped_metrics = {
        name: {
            "queryCount": len(group),
            "top1Accuracy": sum(p.predicted_img_index == p.expected_img_index for p in group) / len(group),
            "wrongCount": sum(p.predicted_img_index != p.expected_img_index for p in group),
        }
        for name, group in sorted(groups.items())
    }
    count = len(rows)
    batch_count = len(by_batch)
    return MetricSummary(
        top1_accuracy=correct_count / count if count else 0.0,
        wrong_count=count - correct_count,
        query_count=count,
        batch_exact_match=exact_count / batch_count if batch_count else 0.0,
        batch_exact_count=exact_count,
        batch_count=batch_count,
        all_accepted_batch_count=all_accepted_count,
        accepted_accuracy=accepted_correct / len(accepted) if accepted else None,
        accepted_count=len(accepted),
        abstention_count=count - len(accepted),
        abstention_rate=(count - len(accepted)) / count if count else 0.0,
        score_distribution=_distribution([row.similarity for row in rows]),
        margin_distribution=_distribution([row.margin for row in rows if row.margin is not None]),
        grouped_metrics=grouped_metrics,
        index_histogram={str(index): amount for index, amount in sorted(Counter(row.predicted_img_index for row in rows).items())},
    )
