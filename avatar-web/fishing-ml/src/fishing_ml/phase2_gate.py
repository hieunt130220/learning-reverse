"""Phase 2 gate adjudication — pass/fail/blocked for final and replay."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Literal, Mapping

import yaml

from .schema import publish_no_replace, read_json

GateStatus = Literal["pass", "fail", "blocked"]
GateKind = Literal["final", "replay"]

# Exit codes
EXIT_PASS = 0
EXIT_INVALID = 2
EXIT_FAIL = 3
EXIT_BLOCKED = 4


class GateBlockedError(RuntimeError):
    """Raised when a gate operation is refused by policy state (e.g. placeholder
    policy). Distinct from a plain RuntimeError so callers map it to EXIT_BLOCKED
    rather than EXIT_GATE_FAIL (spec §3.9: blocked != fail)."""


# Stable check/failure/blocker codes
FAIL_WRONG_ACCEPTED_NONZERO = "wrong_accepted_nonzero"
FAIL_ACCEPTED_RATE_BELOW_MINIMUM = "accepted_rate_below_minimum"
FAIL_TOP1_ACCURACY_BELOW_MINIMUM = "top1_accuracy_below_minimum"
FAIL_BATCH_EXACT_MATCH_BELOW_MINIMUM = "batch_exact_match_below_minimum"
FAIL_LATENCY_P95_EXCEEDED = "latency_p95_exceeded"
FAIL_LATENCY_MAX_NOT_BELOW_CEILING = "latency_max_not_below_ceiling"
FAIL_ERRORED_BATCH_RATE_EXCEEDED = "errored_batch_rate_exceeded"
FAIL_OMITTED_RATE_EXCEEDED = "omitted_rate_exceeded"
FAIL_MULTIPLE_MODEL_IDENTITIES = "multiple_model_identities"
FAIL_MULTIPLE_MODEL_CHECKSUMS = "multiple_model_checksums"
FAIL_MODEL_IDENTITY_CHANGED = "model_identity_changed"

BLOCK_POLICY_NOT_APPROVED = "policy_not_approved"
BLOCK_NO_LABELED_QUERIES = "no_labeled_queries"
BLOCK_INCOMPLETE_GROUND_TRUTH = "incomplete_ground_truth"
BLOCK_NO_REQUESTS = "no_requests"
BLOCK_INCOMPLETE_LATENCY_SAMPLES = "incomplete_latency_samples"
BLOCK_MISSING_MODEL_IDENTITY = "missing_model_identity"
BLOCK_MISSING_MODEL_CHECKSUM = "missing_model_checksum"
BLOCK_NO_BATCHES = "no_batches"
BLOCK_INCOMPLETE_QUALITY_EVIDENCE = "incomplete_quality_evidence"

_MAX_REPLAY_RQ_BUCKETS = 4096
_MAX_REPLAY_ERROR_KEYS = 4096
_MAX_REPLAY_IDENTITY_VALUES = 4096
_REPLAY_RATE_EPSILON = 1e-6


_REPLAY_COUNT_FIELDS = (
    "batchCount", "queryCount", "requestCount", "successfulBatchCount",
    "erroredBatchCount", "acceptedCount", "abstainedCount", "omittedCount",
    "labeledBatchCount", "unknownBatchCount", "labeledQueryCount",
    "unknownQueryCount", "labeledReturnedPredictionCount",
    "unknownReturnedPredictionCount", "correctAcceptedCount",
    "wrongAcceptedCount", "labeledCorrectPredictionCount",
    "labeledWrongPredictionCount", "labeledBatchExactCount",
)
_REPLAY_RATE_FIELDS = ("acceptedRate", "abstainedRate", "omittedRate")
_REPLAY_LATENCY_FIELDS = ("p50", "p95", "p99", "max")
_REPLAY_RQ_KEYS = {
    "batches", "queries", "successfulBatches", "erroredBatches",
    "accepted", "abstained", "omitted", "errors",
}
_REPLAY_ERROR_KEY_LIMIT = 1024
_REPLAY_KEYS = {
    "schemaVersion", "batchCount", "queryCount", "requestCount", "successfulBatchCount", "erroredBatchCount",
    "acceptedCount", "acceptedRate", "abstainedCount", "abstainedRate", "omittedCount", "omittedRate",
    "labeledBatchCount", "unknownBatchCount", "labeledQueryCount", "unknownQueryCount",
    "labeledReturnedPredictionCount", "unknownReturnedPredictionCount", "correctAcceptedCount", "wrongAcceptedCount",
    "labeledCorrectPredictionCount", "labeledWrongPredictionCount", "labeledTop1Accuracy", "labeledBatchExactCount",
    "labeledBatchExactMatch", "labeledAcceptedRate", "errorCounts", "clientLatencyMs", "rqBreakdown", "modelIdentity",
}


def _append_unique(values: list[str], value: str) -> None:
    if value not in values:
        values.append(value)


def _optional_rate(value: object, name: str) -> float | None:
    if value is None:
        return None
    return _rate_value(value, name)


def _bounded_error_counts(value: object, name: str) -> dict[str, int]:
    if not isinstance(value, Mapping) or len(value) > _MAX_REPLAY_ERROR_KEYS:
        raise ValueError(f"{name} must be a bounded mapping")
    result: dict[str, int] = {}
    for key, count in value.items():
        if not isinstance(key, str) or not key or len(key) > _REPLAY_ERROR_KEY_LIMIT:
            raise ValueError(f"{name} contains an invalid error key")
        result[key] = _bounded_int(count, f"{name}[{key!r}]")
    return result


def _validate_rq_breakdown(value: object) -> None:
    if not isinstance(value, Mapping) or len(value) > _MAX_REPLAY_RQ_BUCKETS:
        raise ValueError("rqBreakdown must be a bounded mapping")
    for key, raw_bucket in value.items():
        _bounded_text(key, "rqBreakdown key")
        bucket = _exact_keys(raw_bucket, _REPLAY_RQ_KEYS, f"rqBreakdown[{key!r}]")
        counts = {
            field: _bounded_int(bucket[field], f"rqBreakdown[{key!r}].{field}")
            for field in ("batches", "queries", "successfulBatches", "erroredBatches", "accepted", "abstained", "omitted")
        }
        if counts["successfulBatches"] + counts["erroredBatches"] != counts["batches"]:
            raise ValueError("rqBreakdown batch counts are inconsistent")
        if counts["accepted"] + counts["abstained"] + counts["omitted"] > counts["queries"]:
            raise ValueError("rqBreakdown outcome counts are inconsistent")
        _bounded_error_counts(bucket["errors"], f"rqBreakdown[{key!r}].errors")


@dataclass(frozen=True, slots=True)
class GatePolicy:
    schema_version: int
    pre_agreed_placeholders: bool
    approved_at: str | None
    approved_by: str | None
    approval_evidence: str | None
    not_tuned_on_phase_a_final: bool
    min_accepted_rate: float
    min_batch_exact_match: float
    min_top1_accuracy: float
    budget_ms: float
    p95_ms: float
    max_ms: float
    max_errored_batch_rate: float
    max_omitted_rate: float
    require_single_model_identity: bool
    require_zero_wrong_accepted: bool


@dataclass(frozen=True, slots=True)
class GateCheck:
    name: str
    status: GateStatus
    actual: object
    expected: str


@dataclass(frozen=True, slots=True)
class GateReport:
    schema_version: int
    gate: GateKind
    status: GateStatus
    policy_sha256: str
    evidence_sha256: str
    checks: tuple[GateCheck, ...]
    failures: tuple[str, ...]
    blockers: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "schemaVersion": self.schema_version,
            "gate": self.gate,
            "status": self.status,
            "policySha256": self.policy_sha256,
            "evidenceSha256": self.evidence_sha256,
            "checks": [
                {"name": c.name, "status": c.status, "actual": c.actual, "expected": c.expected}
                for c in self.checks
            ],
            "failures": list(self.failures),
            "blockers": list(self.blockers),
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_file(path: Path) -> str:
    return _sha256_bytes(Path(path).read_bytes())


def exit_code_for_status(status: GateStatus) -> int:
    return {"pass": EXIT_PASS, "fail": EXIT_FAIL, "blocked": EXIT_BLOCKED}[status]


def _reduce_status(failures: list[str], blockers: list[str]) -> GateStatus:
    if failures:
        return "fail"
    if blockers:
        return "blocked"
    return "pass"


_MAX_PROTOCOL_INTEGER = 2**53 - 1
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_GIT_HEX = re.compile(r"^[0-9a-f]{40}$")

def _strict_bool(value: object, name: str) -> bool:
    if not isinstance(value, bool):
        raise ValueError(f"{name} must be a boolean")
    return value

def _finite_number(value: object, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be a finite number")
    try:
        result = float(value)
    except (OverflowError, ValueError):
        raise ValueError(f"{name} must be a finite number") from None
    if not math.isfinite(result):
        raise ValueError(f"{name} must be a finite number")
    return result

def _bounded_int(value: object, name: str, *, positive: bool = False) -> int:
    if (isinstance(value, bool) or not isinstance(value, int)
            or value < 0 or value > _MAX_PROTOCOL_INTEGER
            or (positive and value == 0)):
        raise ValueError(f"{name} must be a bounded integer")
    return value

def _bounded_text(value: object, name: str) -> str:
    if not isinstance(value, str) or not value or len(value) > 1024:
        raise ValueError(f"{name} must be a bounded non-empty string")
    if any(ord(char) < 0x20 or ord(char) == 0x7f for char in value):
        raise ValueError(f"{name} contains a control character")
    if any(0xd800 <= ord(char) <= 0xdfff for char in value):
        raise ValueError(f"{name} contains invalid Unicode")
    return value

def _exact_keys(value: object, expected: set[str], name: str) -> Mapping[str, object]:
    if not isinstance(value, Mapping) or set(value) != expected:
        raise ValueError(f"{name} fields mismatch")
    return value

def _sha256(value: object, name: str) -> str:
    if not isinstance(value, str) or _HEX64.fullmatch(value) is None:
        raise ValueError(f"{name} must be a lowercase SHA-256")
    return value


def load_gate_policy(path: Path) -> GatePolicy:
    """Load gate.yaml with exact nested keys and strict scalar types."""
    try:
        document = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as error:
        raise ValueError(f"cannot read gate config: {error}") from error
    document = _exact_keys(
        document,
        {"schemaVersion", "meta", "coverage", "latency", "errorBudget", "gate"},
        "gate config",
    )
    if isinstance(document["schemaVersion"], bool) or document["schemaVersion"] != 1:
        raise ValueError("gate.yaml schemaVersion must be 1")
    meta_raw = document["meta"]
    if not isinstance(meta_raw, Mapping):
        raise ValueError("gate config meta must be a mapping")
    placeholders = _strict_bool(meta_raw.get("preAgreedPlaceholders"), "meta.preAgreedPlaceholders")
    meta_keys = {"preAgreedPlaceholders", "revisitAt", "notTunedOnPhaseAFinal"}
    if not placeholders:
        meta_keys |= {"approvedAt", "approvedBy", "evidence"}
    meta = _exact_keys(meta_raw, meta_keys, "gate config meta")
    if not isinstance(meta["revisitAt"], str) or not meta["revisitAt"].strip():
        raise ValueError("meta.revisitAt must be non-empty")
    not_tuned = _strict_bool(meta["notTunedOnPhaseAFinal"], "meta.notTunedOnPhaseAFinal")
    if not not_tuned:
        raise ValueError("meta.notTunedOnPhaseAFinal must be true")
    approved_at = approved_by = approval_evidence = None
    if not placeholders:
        approved_at = meta["approvedAt"]
        approved_by = meta["approvedBy"]
        approval_evidence = meta["evidence"]
        if not all(isinstance(value, str) and value.strip() for value in (approved_at, approved_by, approval_evidence)):
            raise ValueError("approved policy requires non-empty approval metadata")
        timestamp_text = approved_at[:-1] + "+00:00" if approved_at.endswith("Z") else approved_at
        try:
            timestamp = datetime.fromisoformat(timestamp_text)
        except ValueError as error:
            raise ValueError("meta.approvedAt must be UTC ISO-8601") from error
        if timestamp.tzinfo is None or timestamp.utcoffset() != timedelta(0):
            raise ValueError("meta.approvedAt must be UTC ISO-8601")
    section_keys = {
        "coverage": {"minAcceptedRate", "minBatchExactMatch", "minTop1Accuracy"},
        "latency": {"budgetMs", "p95Ms", "maxMs"},
        "errorBudget": {"maxErroredBatchRate", "maxOmittedRate", "requireSingleModelIdentity"},
        "gate": {"requireZeroWrongAccepted"},
    }
    sections = {name: _exact_keys(document[name], keys, f"gate config {name}") for name, keys in section_keys.items()}
    p95 = _positive_ms(sections["latency"]["p95Ms"], "p95Ms")
    max_ms = _positive_ms(sections["latency"]["maxMs"], "maxMs")
    if p95 > max_ms:
        raise ValueError("p95Ms must be less than or equal to maxMs")
    return GatePolicy(
        schema_version=1,
        pre_agreed_placeholders=placeholders,
        approved_at=approved_at,
        approved_by=approved_by,
        approval_evidence=approval_evidence,
        not_tuned_on_phase_a_final=not_tuned,
        min_accepted_rate=_rate_value(sections["coverage"]["minAcceptedRate"], "minAcceptedRate"),
        min_batch_exact_match=_rate_value(sections["coverage"]["minBatchExactMatch"], "minBatchExactMatch"),
        min_top1_accuracy=_rate_value(sections["coverage"]["minTop1Accuracy"], "minTop1Accuracy"),
        budget_ms=_positive_ms(sections["latency"]["budgetMs"], "budgetMs"),
        p95_ms=p95,
        max_ms=max_ms,
        max_errored_batch_rate=_rate_value(sections["errorBudget"]["maxErroredBatchRate"], "maxErroredBatchRate"),
        max_omitted_rate=_rate_value(sections["errorBudget"]["maxOmittedRate"], "maxOmittedRate"),
        require_single_model_identity=_strict_bool(sections["errorBudget"]["requireSingleModelIdentity"], "requireSingleModelIdentity"),
        require_zero_wrong_accepted=_strict_bool(sections["gate"]["requireZeroWrongAccepted"], "requireZeroWrongAccepted"),
    )

def _rate_value(value: object, name: str) -> float:
    result = _finite_number(value, name)
    if not 0.0 <= result <= 1.0:
        raise ValueError(f"{name} must be in [0, 1]")
    return result

def _positive_ms(value: object, name: str) -> float:
    result = _finite_number(value, name)
    if result <= 0:
        raise ValueError(f"{name} must be positive")
    return result

_FINAL_CANONICAL_KEYS = {
    "wrongAcceptedCount", "acceptedCount", "queryCount", "acceptedRate",
    "top1Accuracy", "batchExactMatch", "abstentionRate",
}
_FINAL_RAW_REQUIRED = {
    "wrong_count", "accepted_wrong_count", "accepted_count", "query_count",
    "abstention_rate", "top1_accuracy", "batch_exact_match",
}
_FINAL_RAW_ALLOWED = _FINAL_RAW_REQUIRED | {
    "batch_exact_count", "batch_count", "all_accepted_batch_count", "accepted_accuracy",
    "abstention_count", "score_distribution", "margin_distribution", "grouped_metrics",
    "index_histogram",
}

def _normalize_final_evidence(evidence: Mapping[str, object]) -> dict[str, object]:
    if not isinstance(evidence, Mapping):
        raise ValueError("final evidence must be a mapping")
    if "split" in evidence and (evidence.get("schemaVersion") != 1 or evidence.get("split") != "final"):
        raise ValueError("final evidence schema or split is invalid")
    metrics = evidence.get("metrics")
    if not isinstance(metrics, Mapping):
        raise ValueError("final evidence metrics must be a mapping")
    if set(metrics) == _FINAL_CANONICAL_KEYS:
        canonical = dict(metrics)
        raw_wrong = None
    else:
        if not _FINAL_RAW_REQUIRED <= set(metrics) or not set(metrics) <= _FINAL_RAW_ALLOWED:
            raise ValueError("final evidence metric fields mismatch")
        raw_wrong = _bounded_int(metrics["wrong_count"], "wrong_count")
        canonical = {
            "wrongAcceptedCount": metrics["accepted_wrong_count"],
            "acceptedCount": metrics["accepted_count"],
            "queryCount": metrics["query_count"],
            "acceptedRate": None,
            "top1Accuracy": metrics["top1_accuracy"],
            "batchExactMatch": metrics["batch_exact_match"],
            "abstentionRate": metrics["abstention_rate"],
        }
    wrong = _bounded_int(canonical["wrongAcceptedCount"], "wrongAcceptedCount")
    accepted = _bounded_int(canonical["acceptedCount"], "acceptedCount")
    queries = _bounded_int(canonical["queryCount"], "queryCount", positive=True)
    if accepted > queries or wrong > accepted or (raw_wrong is not None and wrong > raw_wrong):
        raise ValueError("final evidence counts are inconsistent")
    accepted_rate = accepted / queries if canonical["acceptedRate"] is None else _rate_value(canonical["acceptedRate"], "acceptedRate")
    abstention = _rate_value(canonical["abstentionRate"], "abstentionRate")
    if abs(accepted_rate - accepted / queries) > 1e-12 or abs((1.0 - abstention) - accepted_rate) > 1e-12:
        raise ValueError("final evidence rates are inconsistent")
    return {
        "wrongAcceptedCount": wrong, "acceptedCount": accepted, "queryCount": queries,
        "acceptedRate": accepted_rate, "top1Accuracy": _rate_value(canonical["top1Accuracy"], "top1Accuracy"),
        "batchExactMatch": _rate_value(canonical["batchExactMatch"], "batchExactMatch"),
        "abstentionRate": abstention,
    }

def adjudicate_final(policy: GatePolicy, evidence: Mapping[str, object], *, policy_sha256: str, evidence_sha256: str) -> GateReport:
    _sha256(policy_sha256, "policy_sha256")
    _sha256(evidence_sha256, "evidence_sha256")
    metrics = _normalize_final_evidence(evidence)
    failures: list[str] = []
    blockers = [BLOCK_POLICY_NOT_APPROVED] if policy.pre_agreed_placeholders else []
    checks: list[GateCheck] = []
    wrong_failed = policy.require_zero_wrong_accepted and metrics["wrongAcceptedCount"] != 0
    if wrong_failed: failures.append(FAIL_WRONG_ACCEPTED_NONZERO)
    checks.append(GateCheck("wrongAccepted", "fail" if wrong_failed else "pass", metrics["wrongAcceptedCount"], "must be 0"))
    for name, key, threshold, code in (("acceptedRate", "acceptedRate", policy.min_accepted_rate, FAIL_ACCEPTED_RATE_BELOW_MINIMUM), ("top1Accuracy", "top1Accuracy", policy.min_top1_accuracy, FAIL_TOP1_ACCURACY_BELOW_MINIMUM), ("batchExactMatch", "batchExactMatch", policy.min_batch_exact_match, FAIL_BATCH_EXACT_MATCH_BELOW_MINIMUM)):
        failed = metrics[key] < threshold
        if failed: failures.append(code)
        checks.append(GateCheck(name, "fail" if failed else "pass", metrics[key], f">= {threshold}"))
    return GateReport(1, "final", _reduce_status(failures, blockers), policy_sha256, evidence_sha256, tuple(checks), tuple(failures), tuple(blockers))

def _normalize_replay_evidence(report: Mapping[str, object]) -> dict[str, object]:
    """Strictly normalize a schema-v2 aggregate replay report.

    The report is intentionally aggregate-only, but every aggregate relationship
    is checked before adjudication.  A malformed document is invalid input (exit
    2); a well-formed document with missing quality/operational evidence remains
    eligible for a truthful blocked result.
    """
    doc = _exact_keys(report, _REPLAY_KEYS, "replay report")
    if isinstance(doc["schemaVersion"], bool) or doc["schemaVersion"] != 2:
        raise ValueError("replay report schemaVersion must be 2")

    counts = {name: _bounded_int(doc[name], name) for name in _REPLAY_COUNT_FIELDS}
    if counts["successfulBatchCount"] + counts["erroredBatchCount"] != counts["batchCount"]:
        raise ValueError("replay batch counts are inconsistent")
    if not counts["successfulBatchCount"] <= counts["requestCount"] <= counts["batchCount"]:
        raise ValueError("replay request counts are inconsistent")
    if counts["labeledBatchCount"] + counts["unknownBatchCount"] != counts["batchCount"]:
        raise ValueError("replay label batch counts are inconsistent")
    if counts["labeledQueryCount"] + counts["unknownQueryCount"] != counts["queryCount"]:
        raise ValueError("replay label query counts are inconsistent")
    if counts["labeledReturnedPredictionCount"] > counts["labeledQueryCount"]:
        raise ValueError("labeled returned predictions exceed labeled queries")
    if counts["unknownReturnedPredictionCount"] > counts["unknownQueryCount"]:
        raise ValueError("unknown returned predictions exceed unknown queries")
    returned_count = (
        counts["labeledReturnedPredictionCount"]
        + counts["unknownReturnedPredictionCount"]
    )
    if counts["acceptedCount"] + counts["abstainedCount"] != returned_count:
        raise ValueError("replay returned/outcome counts are inconsistent")
    if counts["acceptedCount"] + counts["abstainedCount"] + counts["omittedCount"] > counts["queryCount"]:
        raise ValueError("replay outcome counts exceed queries")
    if counts["correctAcceptedCount"] + counts["wrongAcceptedCount"] > counts["acceptedCount"]:
        raise ValueError("replay accepted correctness counts are inconsistent")
    if counts["correctAcceptedCount"] + counts["wrongAcceptedCount"] > counts["labeledReturnedPredictionCount"]:
        raise ValueError("replay labeled accepted counts are inconsistent")
    if counts["labeledCorrectPredictionCount"] + counts["labeledWrongPredictionCount"] != counts["labeledReturnedPredictionCount"]:
        raise ValueError("replay raw correctness counts are inconsistent")
    if counts["correctAcceptedCount"] > counts["labeledCorrectPredictionCount"]:
        raise ValueError("correct accepted exceeds labeled correct predictions")
    if counts["wrongAcceptedCount"] > counts["labeledWrongPredictionCount"]:
        raise ValueError("wrong accepted exceeds labeled wrong predictions")
    if counts["labeledBatchExactCount"] > counts["labeledBatchCount"]:
        raise ValueError("replay labeled exact-batch count is inconsistent")

    error_counts = _bounded_error_counts(doc["errorCounts"], "errorCounts")
    _validate_rq_breakdown(doc["rqBreakdown"])
    rq_total = {
        "batches": 0,
        "queries": 0,
        "successfulBatches": 0,
        "erroredBatches": 0,
        "accepted": 0,
        "abstained": 0,
        "omitted": 0,
        "errors": {},
    }
    for raw_bucket in doc["rqBreakdown"].values():
        for field in rq_total:
            if field != "errors":
                rq_total[field] += raw_bucket[field]
        for key, amount in raw_bucket["errors"].items():
            rq_total["errors"][key] = rq_total["errors"].get(key, 0) + amount
    if any(rq_total[field] != expected for field, expected in {
        "batches": counts["batchCount"],
        "queries": counts["queryCount"],
        "successfulBatches": counts["successfulBatchCount"],
        "erroredBatches": counts["erroredBatchCount"],
        "accepted": counts["acceptedCount"],
        "abstained": counts["abstainedCount"],
        "omitted": counts["omittedCount"],
    }.items()):
        raise ValueError("replay R/Q totals do not match aggregate counts")
    if rq_total["errors"] != error_counts:
        raise ValueError("replay R/Q errors do not match aggregate errors")

    denominator = counts["acceptedCount"] + counts["abstainedCount"] + counts["omittedCount"]
    rates = {name: _optional_rate(doc[name], name) for name in _REPLAY_RATE_FIELDS}
    expected_rates = {
        "acceptedRate": counts["acceptedCount"] / denominator if denominator else None,
        "abstainedRate": counts["abstainedCount"] / denominator if denominator else None,
        "omittedRate": counts["omittedCount"] / denominator if denominator else None,
    }
    for name, expected in expected_rates.items():
        if expected is None:
            if rates[name] is not None:
                raise ValueError(f"{name} must be null when no outcomes exist")
        elif rates[name] is None or abs(rates[name] - expected) > _REPLAY_RATE_EPSILON:
            raise ValueError("replay outcome rates are inconsistent")

    labeled_top1 = _optional_rate(doc["labeledTop1Accuracy"], "labeledTop1Accuracy")
    labeled_exact = _optional_rate(doc["labeledBatchExactMatch"], "labeledBatchExactMatch")
    labeled_accepted = _optional_rate(doc["labeledAcceptedRate"], "labeledAcceptedRate")
    expected_labeled_top1 = (
        counts["labeledCorrectPredictionCount"] / counts["labeledReturnedPredictionCount"]
        if counts["labeledReturnedPredictionCount"] else None
    )
    expected_labeled_exact = (
        counts["labeledBatchExactCount"] / counts["labeledBatchCount"]
        if counts["labeledBatchCount"] else None
    )
    expected_labeled_accepted = (
        (counts["correctAcceptedCount"] + counts["wrongAcceptedCount"])
        / counts["labeledReturnedPredictionCount"]
        if counts["labeledReturnedPredictionCount"] else None
    )
    for name, actual, expected in (
        ("labeledTop1Accuracy", labeled_top1, expected_labeled_top1),
        ("labeledBatchExactMatch", labeled_exact, expected_labeled_exact),
        ("labeledAcceptedRate", labeled_accepted, expected_labeled_accepted),
    ):
        if expected is None:
            if actual is not None:
                raise ValueError(f"{name} must be null without its denominator")
        elif actual is None or abs(actual - expected) > _REPLAY_RATE_EPSILON:
            raise ValueError(f"{name} is inconsistent with replay counts")

    latency = _exact_keys(
        doc["clientLatencyMs"],
        {"sampleCount", "p50", "p95", "p99", "max", "rule"},
        "clientLatencyMs",
    )
    sample_count = _bounded_int(latency["sampleCount"], "latency sample count")
    if sample_count > counts["requestCount"]:
        raise ValueError("latency sample count exceeds request count")
    if latency["rule"] != "nearest-rank":
        raise ValueError("clientLatencyMs.rule must be nearest-rank")
    latency_values: dict[str, float | None] = {}
    for name in _REPLAY_LATENCY_FIELDS:
        value = latency[name]
        parsed = None if value is None else _finite_number(value, f"latency {name}")
        if parsed is not None and parsed < 0:
            raise ValueError(f"latency {name} must be non-negative")
        latency_values[name] = parsed
    if sample_count == 0:
        if any(value is not None for value in latency_values.values()):
            raise ValueError("latency values require a positive sample count")
    else:
        if any(value is None for value in latency_values.values()):
            raise ValueError("latency values are incomplete")
        if not (
            latency_values["p50"] <= latency_values["p95"]
            <= latency_values["p99"] <= latency_values["max"]
        ):
            raise ValueError("latency percentiles are not ordered")

    identity = _exact_keys(doc["modelIdentity"], {"modelIds", "checksums"}, "modelIdentity")
    model_ids = identity["modelIds"]
    checksums = identity["checksums"]
    if (
        not isinstance(model_ids, list)
        or not isinstance(checksums, list)
        or len(model_ids) > _MAX_REPLAY_IDENTITY_VALUES
        or len(checksums) > _MAX_REPLAY_IDENTITY_VALUES
    ):
        raise ValueError("model identity fields must be bounded lists")
    normalized_model_ids = tuple(_bounded_text(value, "model identity") for value in model_ids)
    normalized_checksums = tuple(_sha256(value, "model checksum") for value in checksums)
    if len(set(normalized_model_ids)) != len(normalized_model_ids):
        raise ValueError("model identity contains duplicate model IDs")
    if len(set(normalized_checksums)) != len(normalized_checksums):
        raise ValueError("model identity contains duplicate checksums")

    return {
        **counts,
        **rates,
        "errorCounts": error_counts,
        "labeledTop1Accuracy": labeled_top1,
        "labeledBatchExactMatch": labeled_exact,
        "labeledAcceptedRate": labeled_accepted,
        "latencySampleCount": sample_count,
        "latencyP95": latency_values["p95"],
        "latencyMax": latency_values["max"],
        "modelIds": normalized_model_ids,
        "checksums": normalized_checksums,
    }


def _freeze_identity(document: Mapping[str, object]) -> tuple[str, str]:
    doc = _exact_keys(document, {"schemaVersion", "runId", "gitRevision", "files"}, "freeze manifest")
    if (
        isinstance(doc["schemaVersion"], bool)
        or doc["schemaVersion"] != 1
        or not isinstance(doc["gitRevision"], str)
        or _GIT_HEX.fullmatch(doc["gitRevision"]) is None
    ):
        raise ValueError("freeze manifest identity is invalid")
    run_id = _bounded_text(doc["runId"], "freeze runId")
    files = doc["files"]
    expected = {"model-config.json", "normalization.json", "thresholds.json", "environment.json", "dev-metrics.json", "best-dev.pt", "dataset-snapshot.json", "split-checksums.json"}
    if not isinstance(files, Mapping) or set(files) != expected:
        raise ValueError("freeze manifest files inventory mismatch")
    for name, value in files.items(): _sha256(value, f"freeze file {name}")
    return run_id, files["best-dev.pt"]

def adjudicate_replay(policy: GatePolicy, replay_report: Mapping[str, object], freeze_manifest: Mapping[str, object], *, policy_sha256: str, evidence_sha256: str) -> GateReport:
    _sha256(policy_sha256, "policy_sha256"); _sha256(evidence_sha256, "evidence_sha256")
    evidence = _normalize_replay_evidence(replay_report)
    frozen_run_id, frozen_checksum = _freeze_identity(freeze_manifest)
    failures: list[str] = []
    blockers = [BLOCK_POLICY_NOT_APPROVED] if policy.pre_agreed_placeholders else []
    checks: list[GateCheck] = []

    incomplete_ground_truth = bool(
        evidence["unknownBatchCount"] or evidence["unknownQueryCount"]
    )
    if incomplete_ground_truth:
        blockers.append(BLOCK_INCOMPLETE_GROUND_TRUTH)

    # A proven wrong accepted prediction is a mandatory failure even when other
    # labels are missing. Failure status outranks blockers; incomplete evidence
    # remains recorded alongside the failure.
    wrong_failed = (
        policy.require_zero_wrong_accepted
        and evidence["wrongAcceptedCount"] != 0
    )
    if wrong_failed:
        failures.append(FAIL_WRONG_ACCEPTED_NONZERO)
    if evidence["labeledReturnedPredictionCount"] > 0:
        checks.append(GateCheck(
            "wrongAccepted", "fail" if wrong_failed else "pass",
            evidence["wrongAcceptedCount"], "must be 0",
        ))

    quality_ready = (
        evidence["labeledQueryCount"] > 0
        and evidence["labeledReturnedPredictionCount"] > 0
        and not incomplete_ground_truth
    )
    if not quality_ready:
        blockers.append(BLOCK_NO_LABELED_QUERIES)
    else:
        for name, actual, threshold, code in (
            ("acceptedRate", evidence["labeledAcceptedRate"], policy.min_accepted_rate, FAIL_ACCEPTED_RATE_BELOW_MINIMUM),
            ("top1Accuracy", evidence["labeledTop1Accuracy"], policy.min_top1_accuracy, FAIL_TOP1_ACCURACY_BELOW_MINIMUM),
            ("batchExactMatch", evidence["labeledBatchExactMatch"], policy.min_batch_exact_match, FAIL_BATCH_EXACT_MATCH_BELOW_MINIMUM),
        ):
            failed = actual is None or actual < threshold
            if failed:
                failures.append(code)
            checks.append(GateCheck(name, "fail" if failed else "pass", actual, f">= {threshold}"))

    if evidence["requestCount"] <= 0:
        blockers.append(BLOCK_NO_REQUESTS)
    elif evidence["latencySampleCount"] != evidence["requestCount"]:
        _append_unique(blockers, BLOCK_INCOMPLETE_LATENCY_SAMPLES)
    if evidence["batchCount"] <= 0:
        blockers.append(BLOCK_NO_BATCHES)
    else:
        errored_rate = evidence["erroredBatchCount"] / evidence["batchCount"]
        failed = errored_rate > policy.max_errored_batch_rate
        if failed:
            failures.append(FAIL_ERRORED_BATCH_RATE_EXCEEDED)
        checks.append(GateCheck(
            "erroredBatchRate", "fail" if failed else "pass", errored_rate,
            f"<= {policy.max_errored_batch_rate}",
        ))
    omitted_rate = evidence["omittedRate"]
    if omitted_rate is None:
        blockers.append(BLOCK_INCOMPLETE_QUALITY_EVIDENCE)
    elif omitted_rate > policy.max_omitted_rate:
        failures.append(FAIL_OMITTED_RATE_EXCEEDED)
    if evidence["latencyP95"] is None or evidence["latencyMax"] is None:
        _append_unique(blockers, BLOCK_INCOMPLETE_LATENCY_SAMPLES)
    else:
        if evidence["latencyP95"] > policy.p95_ms:
            failures.append(FAIL_LATENCY_P95_EXCEEDED)
        if evidence["latencyMax"] >= policy.max_ms:
            failures.append(FAIL_LATENCY_MAX_NOT_BELOW_CEILING)
    if not evidence["modelIds"]:
        blockers.append(BLOCK_MISSING_MODEL_IDENTITY)
    elif len(set(evidence["modelIds"])) != 1:
        failures.append(FAIL_MULTIPLE_MODEL_IDENTITIES)
    elif evidence["modelIds"][0] != frozen_run_id:
        failures.append(FAIL_MODEL_IDENTITY_CHANGED)
    if not evidence["checksums"]:
        blockers.append(BLOCK_MISSING_MODEL_CHECKSUM)
    elif len(set(evidence["checksums"])) != 1:
        failures.append(FAIL_MULTIPLE_MODEL_CHECKSUMS)
    elif evidence["checksums"][0] != frozen_checksum:
        failures.append(FAIL_MODEL_IDENTITY_CHANGED)
    return GateReport(
        1, "replay", _reduce_status(failures, blockers), policy_sha256,
        evidence_sha256, tuple(checks), tuple(failures), tuple(blockers),
    )

def publish_gate_report(path: Path, report: GateReport) -> Path:
    publish_no_replace(Path(path), report.to_dict())
    return Path(path)

def main(argv: list[str] | None = None) -> int:
    """Adjudicate existing final/replay evidence without running inference."""
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    final = sub.add_parser("adjudicate-final")
    final.add_argument("--gate-config", type=Path, required=True)
    final.add_argument("--final-report", type=Path, required=True)
    final.add_argument("--output", type=Path, default=None)
    final.add_argument("--stdout", action="store_true")
    replay = sub.add_parser("adjudicate-replay")
    replay.add_argument("--gate-config", type=Path, required=True)
    replay.add_argument("--replay-report", type=Path, required=True)
    replay.add_argument("--frozen-dir", type=Path, required=True)
    replay.add_argument("--output", type=Path, default=None)
    replay.add_argument("--stdout", action="store_true")
    args = parser.parse_args(argv)
    try:
        policy = load_gate_policy(args.gate_config)
        evidence_path = args.final_report if args.command == "adjudicate-final" else args.replay_report
        evidence = read_json(evidence_path)
        if args.command == "adjudicate-final":
            report = adjudicate_final(policy, evidence, policy_sha256=_sha256_file(args.gate_config), evidence_sha256=_sha256_file(evidence_path))
        else:
            from .artifacts import verify_freeze
            verify_freeze(args.frozen_dir)
            report = adjudicate_replay(policy, evidence, read_json(args.frozen_dir / "freeze-manifest.json"), policy_sha256=_sha256_file(args.gate_config), evidence_sha256=_sha256_file(evidence_path))
        if args.output is not None:
            publish_gate_report(args.output, report)
        if args.stdout or args.output is None:
            print(report.to_json())
        return exit_code_for_status(report.status)
    except (OSError, ValueError, TypeError, KeyError, FileExistsError) as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID


if __name__ == "__main__":
    raise SystemExit(main())
