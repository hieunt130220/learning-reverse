"""Phase 2 error analysis and confidence/R-Q breakdown for fishing matches.

Giai đoạn 2 (2A) — offline error analysis. This module is STRICTLY ADDITIVE:
it consumes the canonical Phase A prediction rows, the frozen Phase A
dev/final reports and batch shapes as READ-ONLY references. It never mutates
labels or any Phase A artifact.

Design contract (see task brief + design spec §3.2 / §5):
- Prediction rows follow the canonical shape produced by ``train._prediction_json``
  and ``calibrate._prediction``: ``{batchId, newIndex, expectedImgIndex,
  predictedImgIndex, similarity, margin, accepted}`` with ``margin`` nullable
  and ``similarity`` a finite float.
- ``metrics.Prediction`` / ``metrics.MetricSummary`` are the canonical in-memory
  types; this module imports ``summarize_predictions`` / ``Prediction`` from
  ``fishing_ml.metrics`` for aggregation and does NOT modify ``metrics.py``.
- Ground truth stays reviewer-owned: this analysis never auto-labels or
  pseudo-labels. Phase A errors are recorded ONLY as diagnostic hypotheses and
  are explicitly flagged ``usable_for_tuning=False``; downstream gates must not
  count them toward training/tuning inputs.
- All serialization is deterministic (sorted keys, stable floats) so the same
  input yields byte-identical report JSON.
- No account identity, credentials, raw packet, base64 or image data is ever
  written by this module.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from math import isfinite
from typing import Iterable, Mapping, Sequence

from .metrics import Prediction, summarize_predictions


# Categories assigned to each reported error/hard case.
class ErrorCategory:
    WRONG_ACCEPTED = "wrong-accepted"
    LOW_SIMILARITY = "low-similarity"
    LOW_MARGIN = "low-margin"
    ABSTAINED = "abstained"
    UNKNOWN = "unknown"


# Default similarity/margin thresholds used ONLY to bucket hard cases into
# readable categories. These are classification hints for error analysis, NOT
# acceptance gates (those live in gate.yaml + calibrate.Thresholds). They are
# conservative and clearly-labeled; revisit alongside gate.yaml at Gate 2A.
DEFAULT_LOW_SIMILARITY = 0.90
DEFAULT_LOW_MARGIN = 0.10


@dataclass(frozen=True, slots=True)
class ErrorCase:
    """A single error or hard case.

    ``phase_a_hypothesis`` is an OPTIONAL diagnostic note that references a Phase
    A error pattern. When present it is explicitly NOT usable for tuning: the
    ``usable_for_tuning`` flag is always False for such cases, and the analysis
    never counts them toward training/tuning inputs.
    """

    batch_id: str
    query_index: int
    expected_img_index: int
    predicted_img_index: int
    similarity: float
    margin: float | None
    accepted: bool
    category: str
    source: str
    phase_a_hypothesis: str | None = None
    # Hard invariant: any case carrying a Phase A hypothesis is never usable for
    # training/tuning. The field is computed, never passed in by callers.
    usable_for_tuning: bool = True

    def __post_init__(self) -> None:
        # A Phase A hypothesis is diagnostic only; it must never reach tuning.
        if self.phase_a_hypothesis is not None and self.usable_for_tuning:
            object.__setattr__(self, "usable_for_tuning", False)

    def to_json(self) -> dict[str, object]:
        return {
            "batchId": self.batch_id,
            "queryIndex": self.query_index,
            "expectedImgIndex": self.expected_img_index,
            "predictedImgIndex": self.predicted_img_index,
            "similarity": self.similarity,
            "margin": self.margin,
            "accepted": self.accepted,
            "category": self.category,
            "source": self.source,
            "phaseAHypothesis": self.phase_a_hypothesis,
            "usableForTuning": self.usable_for_tuning,
        }


@dataclass(frozen=True, slots=True)
class ErrorAnalysisReport:
    """Aggregated error analysis over a prediction set."""

    total_count: int
    accepted_count: int
    wrong_count: int
    abstained_count: int
    unknown_count: int
    by_rq: dict[str, int]
    by_category: dict[str, int]
    similarity_stats: dict[str, float | None]
    margin_stats: dict[str, float | None]
    tuning_input_count: int
    phase_a_only_count: int
    error_cases: list[ErrorCase]

    def to_json(self) -> dict[str, object]:
        return {
            "totalCount": self.total_count,
            "acceptedCount": self.accepted_count,
            "wrongCount": self.wrong_count,
            "abstainedCount": self.abstained_count,
            "unknownCount": self.unknown_count,
            "byRQ": dict(sorted(self.by_rq.items())),
            "byCategory": dict(sorted(self.by_category.items())),
            "similarityStats": self.similarity_stats,
            "marginStats": self.margin_stats,
            # Cases that may legitimately inform tuning (no Phase A hypothesis,
            # i.e. not derived from Phase A final/dev errors). Always <= len.
            "tuningInputCount": self.tuning_input_count,
            # Cases that reference Phase A errors — diagnostic only, never tuning.
            "phaseAOnlyCount": self.phase_a_only_count,
            "errorCases": [case.to_json() for case in self.error_cases],
        }


def _distribution(values: Sequence[float]) -> dict[str, float | None]:
    if not values:
        return {"count": 0, "min": None, "max": None, "mean": None}
    return {
        "count": len(values),
        "min": min(values),
        "max": max(values),
        "mean": sum(values) / len(values),
    }


def _classify(
    row: Prediction,
    *,
    low_similarity: float,
    low_margin: float,
) -> str:
    """Classify a single prediction into a primary error/hard-case category."""
    correct = row.predicted_img_index == row.expected_img_index
    if row.accepted and not correct:
        return ErrorCategory.WRONG_ACCEPTED
    if not row.accepted:
        return ErrorCategory.ABSTAINED
    # Accepted and correct below: still a hard case if similarity/margin is low.
    if not isfinite(row.similarity) or row.similarity < low_similarity:
        return ErrorCategory.LOW_SIMILARITY
    if row.margin is None or (isfinite(row.margin) and row.margin < low_margin):
        return ErrorCategory.LOW_MARGIN
    return ErrorCategory.UNKNOWN


def analyze_predictions(
    predictions: Iterable[Prediction],
    labels_or_shapes: Mapping[str, tuple[int, int]] | None = None,
    *,
    source: str = "phase2-dev",
    low_similarity: float = DEFAULT_LOW_SIMILARITY,
    low_margin: float = DEFAULT_LOW_MARGIN,
    phase_a_hypotheses: Mapping[tuple[str, int], str] | None = None,
) -> ErrorAnalysisReport:
    """Join predictions to labels/shapes, classify errors, group and aggregate.

    Args:
        predictions: canonical ``Prediction`` rows (never mutated).
        labels_or_shapes: optional batch -> (R, Q) shapes used to group counts
            by reference/query count (R/Q) and to validate query indices.
        source: provenance tag recorded on every error case (e.g.
            ``phase2-dev`` / ``phase-a-final``). No identity/packet/image data.
        low_similarity / low_margin: classification hints for hard cases. These
            are NOT acceptance gates.
        phase_a_hypotheses: optional map of (batch_id, query_index) -> free-text
            diagnostic hypothesis referencing a Phase A error. Such cases are
            recorded as ``phaseAHypothesis`` and flagged ``usableForTuning=False``;
            they are NEVER counted toward tuning inputs.

    Returns:
        A deterministic ``ErrorAnalysisReport``.
    """
    rows = tuple(predictions)
    if phase_a_hypotheses:
        phase_a_hypotheses = {
            (str(b), int(q)): str(h) for (b, q), h in phase_a_hypotheses.items()
        }

    # Aggregate base statistics via the canonical Phase A metric summarizer.
    summary = summarize_predictions(rows, batch_shapes=labels_or_shapes)

    by_rq: dict[str, int] = defaultdict(int)
    by_category: Counter[str] = Counter()
    error_cases: list[ErrorCase] = []
    unknown_count = 0
    tuning_input_count = 0
    phase_a_only_count = 0

    for row in rows:
        rq_key = "unknown"
        if labels_or_shapes is not None and row.batch_id in labels_or_shapes:
            refs, queries = labels_or_shapes[row.batch_id]
            rq_key = f"R={refs},Q={queries}"
        by_rq[rq_key] += 1

        category = _classify(row, low_similarity=low_similarity, low_margin=low_margin)
        by_category[category] += 1

        hypothesis = (
            phase_a_hypotheses.get((row.batch_id, row.new_index))
            if phase_a_hypotheses
            else None
        )
        has_phase_a = hypothesis is not None

        case = ErrorCase(
            batch_id=row.batch_id,
            query_index=row.new_index,
            expected_img_index=row.expected_img_index,
            predicted_img_index=row.predicted_img_index,
            similarity=row.similarity,
            margin=row.margin,
            accepted=row.accepted,
            category=category,
            source=source,
            phase_a_hypothesis=hypothesis,
        )
        # usable_for_tuning is forced False inside __post_init__ when a Phase A
        # hypothesis is present; assert the invariant holds.
        if has_phase_a:
            phase_a_only_count += 1
            assert not case.usable_for_tuning
        else:
            tuning_input_count += 1

        # Unknown category means "accepted, correct, high confidence" — not an
        # error/hard case, but we still report the count for transparency.
        if category == ErrorCategory.UNKNOWN:
            unknown_count += 1
        else:
            error_cases.append(case)

    return ErrorAnalysisReport(
        total_count=summary.query_count,
        accepted_count=summary.accepted_count,
        wrong_count=summary.wrong_count,
        abstained_count=summary.abstention_count,
        unknown_count=unknown_count,
        by_rq=dict(by_rq),
        by_category=dict(by_category),
        similarity_stats=_distribution([row.similarity for row in rows]),
        margin_stats=_distribution(
            [row.margin for row in rows if row.margin is not None]
        ),
        tuning_input_count=tuning_input_count,
        phase_a_only_count=phase_a_only_count,
        error_cases=error_cases,
    )


def load_predictions_from_report(path) -> tuple[Prediction, ...]:
    """Read prediction rows from a frozen Phase A report (READ-ONLY reference).

    Accepts the evaluation-dev.json / final-evaluation.json shape
    ({schemaVersion, split, loss, metrics, baselines, predictions}) and returns
    the canonical ``Prediction`` rows WITHOUT changing labels or any field.
    """
    from pathlib import Path

    from .calibrate import _prediction
    from .schema import read_json

    document = read_json(Path(path))
    if not isinstance(document, dict) or "predictions" not in document:
        raise ValueError("report must contain a 'predictions' array")
    raw = document["predictions"]
    if not isinstance(raw, list):
        raise ValueError("report 'predictions' must be a list")
    return tuple(_prediction(item, i) for i, item in enumerate(raw))


def load_batch_shapes_from_report(path) -> dict[str, tuple[int, int]]:
    """Reconstruct (R, Q) shapes per batch from a frozen report's predictions.

    Used to group error counts by reference/query count. READ-ONLY: it derives
    shapes purely from the prediction rows (max reference index + 1 gives R,
    the sorted query indices give Q). It does not read labels and never writes.
    """
    from pathlib import Path

    from .schema import read_json

    document = read_json(Path(path))
    if not isinstance(document, dict) or "predictions" not in document:
        raise ValueError("report must contain a 'predictions' array")
    raw = document["predictions"]
    if not isinstance(raw, list):
        raise ValueError("report 'predictions' must be a list")

    by_batch: dict[str, list[dict]] = defaultdict(list)
    for item in raw:
        if not isinstance(item, dict):
            raise ValueError("each prediction must be an object")
        by_batch[item["batchId"]].append(item)

    shapes: dict[str, tuple[int, int]] = {}
    for batch_id, items in by_batch.items():
        refs = max(
            int(item["expectedImgIndex"]) for item in items
        ) + 1
        queries = len({int(item["newIndex"]) for item in items})
        shapes[batch_id] = (refs, queries)
    return shapes


__all__ = [
    "ErrorCategory",
    "ErrorCase",
    "ErrorAnalysisReport",
    "analyze_predictions",
    "load_predictions_from_report",
    "load_batch_shapes_from_report",
    "DEFAULT_LOW_SIMILARITY",
    "DEFAULT_LOW_MARGIN",
]
