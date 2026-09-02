"""Phase 2 gate adjudication — pass/fail/blocked for final and replay."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Literal, Mapping

import yaml

from .schema import read_json

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


def load_gate_policy(path: Path) -> GatePolicy:
    """Strict parser for gate.yaml. Rejects unknown fields, non-finite values, malformed approval."""
    document = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    if not isinstance(document, dict):
        raise ValueError("gate config must be a YAML mapping")
    allowed_top = {"schemaVersion", "meta", "coverage", "latency", "errorBudget", "gate"}
    unknown_top = sorted(set(document) - allowed_top)
    if unknown_top:
        raise ValueError(f"unknown gate config keys: {unknown_top}")
    schema_version = document.get("schemaVersion")
    if schema_version != 1:
        raise ValueError(f"gate.yaml schemaVersion must be 1, got {schema_version!r}")

    meta = document.get("meta")
    if not isinstance(meta, dict):
        raise ValueError("gate config meta must be a mapping")
    allowed_meta = {"preAgreedPlaceholders", "revisitAt", "notTunedOnPhaseAFinal", "approvedAt", "approvedBy", "evidence"}
    unknown_meta = sorted(set(meta) - allowed_meta)
    if unknown_meta:
        raise ValueError(f"unknown gate meta keys: {unknown_meta}")

    placeholders = meta.get("preAgreedPlaceholders")
    if not isinstance(placeholders, bool):
        raise ValueError("meta.preAgreedPlaceholders must be a boolean")
    # Spec §3.8: approved state REQUIRES complete provenance. Never auto-create.
    if not placeholders:
        for field in ("approvedAt", "approvedBy", "evidence"):
            value = meta.get(field)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"approved policy requires non-empty meta.{field}")
        # approvedAt must be ISO-8601 UTC (same rule as dataset_version._parse_utc_iso).
        raw = meta["approvedAt"]
        candidate = raw[:-1] + "+00:00" if raw.endswith("Z") else raw
        parsed = datetime.fromisoformat(candidate)
        if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
            raise ValueError("meta.approvedAt must be UTC ISO-8601")

    for section in ("coverage", "latency", "errorBudget", "gate"):
        value = document.get(section)
        if not isinstance(value, dict):
            raise ValueError(f"gate config {section} must be a mapping")

    coverage = document["coverage"]
    latency = document["latency"]
    error_budget = document["errorBudget"]
    gate = document["gate"]
    # Mandatory keys per section (strict — no silent defaults, spec §3.8).
    for section, keys in (
        ("coverage", ("minAcceptedRate", "minBatchExactMatch", "minTop1Accuracy")),
        ("latency", ("budgetMs", "p95Ms", "maxMs")),
        ("errorBudget", ("maxErroredBatchRate", "maxOmittedRate", "requireSingleModelIdentity")),
        ("gate", ("requireZeroWrongAccepted",)),
    ):
        missing = sorted(set(keys) - set(document[section]))
        if missing:
            raise ValueError(f"gate config {section} missing keys: {missing}")

    return GatePolicy(
        schema_version=schema_version,
        pre_agreed_placeholders=placeholders,
        approved_at=meta.get("approvedAt"),
        approved_by=meta.get("approvedBy"),
        approval_evidence=meta.get("evidence"),
        not_tuned_on_phase_a_final=bool(meta["notTunedOnPhaseAFinal"]),
        min_accepted_rate=_rate_value(coverage["minAcceptedRate"], "minAcceptedRate"),
        min_batch_exact_match=_rate_value(coverage["minBatchExactMatch"], "minBatchExactMatch"),
        min_top1_accuracy=_rate_value(coverage["minTop1Accuracy"], "minTop1Accuracy"),
        budget_ms=_positive_ms(latency["budgetMs"], "budgetMs"),
        p95_ms=_positive_ms(latency["p95Ms"], "p95Ms"),
        max_ms=_positive_ms(latency["maxMs"], "maxMs"),
        max_errored_batch_rate=_rate_value(error_budget["maxErroredBatchRate"], "maxErroredBatchRate"),
        max_omitted_rate=_rate_value(error_budget["maxOmittedRate"], "maxOmittedRate"),
        require_single_model_identity=bool(error_budget["requireSingleModelIdentity"]),
        require_zero_wrong_accepted=bool(gate["requireZeroWrongAccepted"]),
    )


def _rate_value(value: object, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be a number")
    result = float(value)
    if not 0.0 <= result <= 1.0:
        raise ValueError(f"{name} must be in [0, 1]")
    return result


def _positive_ms(value: object, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be a number")
    result = float(value)
    if result <= 0:
        raise ValueError(f"{name} must be positive")
    return result


def adjudicate_final(policy: GatePolicy, evidence: dict, *, policy_sha256: str, evidence_sha256: str) -> GateReport:
    """Adjudicate a final evaluation report against gate policy.

    ``evidence`` shape (built by confirm_final_once from the snake_case
    MetricSummary document):

    {"metrics": {
        "wrongCount": int, "acceptedCount": int, "acceptedRate": float,
        "top1Accuracy": float, "batchExactMatch": float, "abstentionRate": float,
    }}
    """
    checks: list[GateCheck] = []
    failures: list[str] = []
    blockers: list[str] = []

    # Placeholder policy → blocked (never pass).
    if policy.pre_agreed_placeholders:
        blockers.append(BLOCK_POLICY_NOT_APPROVED)

    metrics = evidence.get("metrics")
    if not isinstance(metrics, dict):
        blockers.append(BLOCK_NO_LABELED_QUERIES)
    else:
        wrong_accepted = metrics.get("wrongCount")
        if not isinstance(wrong_accepted, int) or wrong_accepted < 0:
            failures.append(FAIL_WRONG_ACCEPTED_NONZERO)
        elif policy.require_zero_wrong_accepted and wrong_accepted != 0:
            failures.append(FAIL_WRONG_ACCEPTED_NONZERO)
            checks.append(GateCheck("wrongAccepted", "fail", wrong_accepted, "must be 0"))
        else:
            checks.append(GateCheck("wrongAccepted", "pass", wrong_accepted, "must be 0"))

        accepted_rate = metrics.get("acceptedRate")
        top1 = metrics.get("top1Accuracy")
        batch_exact = metrics.get("batchExactMatch")
        if not isinstance(accepted_rate, (int, float)) or accepted_rate < policy.min_accepted_rate:
            failures.append(FAIL_ACCEPTED_RATE_BELOW_MINIMUM)
            checks.append(GateCheck("acceptedRate", "fail", accepted_rate, f">= {policy.min_accepted_rate}"))
        else:
            checks.append(GateCheck("acceptedRate", "pass", accepted_rate, f">= {policy.min_accepted_rate}"))
        if not isinstance(top1, (int, float)) or top1 < policy.min_top1_accuracy:
            failures.append(FAIL_TOP1_ACCURACY_BELOW_MINIMUM)
            checks.append(GateCheck("top1Accuracy", "fail", top1, f">= {policy.min_top1_accuracy}"))
        else:
            checks.append(GateCheck("top1Accuracy", "pass", top1, f">= {policy.min_top1_accuracy}"))
        if not isinstance(batch_exact, (int, float)) or batch_exact < policy.min_batch_exact_match:
            failures.append(FAIL_BATCH_EXACT_MATCH_BELOW_MINIMUM)
            checks.append(GateCheck("batchExactMatch", "fail", batch_exact, f">= {policy.min_batch_exact_match}"))
        else:
            checks.append(GateCheck("batchExactMatch", "pass", batch_exact, f">= {policy.min_batch_exact_match}"))

    return GateReport(
        schema_version=1,
        gate="final",
        status=_reduce_status(failures, blockers),
        policy_sha256=policy_sha256,
        evidence_sha256=evidence_sha256,
        checks=tuple(checks),
        failures=tuple(failures),
        blockers=tuple(blockers),
    )


def adjudicate_replay(
    policy: GatePolicy,
    replay_report: Mapping[str, object],
    freeze_manifest: Mapping[str, object],
    *,
    policy_sha256: str,
    evidence_sha256: str,
) -> GateReport:
    """Adjudicate a replay report against gate policy and verified frozen manifest (spec §3.11)."""
    checks: list[GateCheck] = []
    failures: list[str] = []
    blockers: list[str] = []

    if policy.pre_agreed_placeholders:
        blockers.append(BLOCK_POLICY_NOT_APPROVED)

    # --- Quality sub-gate ---
    # ReplayReport.to_dict() shape (after Task 3):
    #   {..., "labeledQueryCount", "wrongAcceptedCount", "acceptedRate",
    #    "labeledTop1Accuracy", "labeledBatchExactMatch",
    #    "clientLatencyMs": {"sampleCount", "p50", "p95", "p99", "max", "rule"},
    #    "modelIdentity": {"modelIds", "checksums"}}
    labeled_query_count = replay_report.get("labeledQueryCount", 0)
    wrong_accepted = replay_report.get("wrongAcceptedCount", 0)
    accepted_rate = replay_report.get("acceptedRate")
    top1 = replay_report.get("labeledTop1Accuracy")
    batch_exact = replay_report.get("labeledBatchExactMatch")
    latency = replay_report.get("clientLatencyMs")
    latency_p95 = latency.get("p95") if isinstance(latency, dict) else None
    latency_max = latency.get("max") if isinstance(latency, dict) else None
    latency_sample_count = latency.get("sampleCount") if isinstance(latency, dict) else None

    if not isinstance(labeled_query_count, int) or labeled_query_count <= 0:
        blockers.append(BLOCK_NO_LABELED_QUERIES)
    else:
        if isinstance(wrong_accepted, int) and wrong_accepted == 0:
            checks.append(GateCheck("wrongAccepted", "pass", wrong_accepted, "must be 0"))
        else:
            failures.append(FAIL_WRONG_ACCEPTED_NONZERO)
            checks.append(GateCheck("wrongAccepted", "fail", wrong_accepted, "must be 0"))
        if isinstance(accepted_rate, (int, float)) and accepted_rate >= policy.min_accepted_rate:
            checks.append(GateCheck("acceptedRate", "pass", accepted_rate, f">= {policy.min_accepted_rate}"))
        else:
            failures.append(FAIL_ACCEPTED_RATE_BELOW_MINIMUM)
            checks.append(GateCheck("acceptedRate", "fail", accepted_rate, f">= {policy.min_accepted_rate}"))
        if isinstance(top1, (int, float)) and top1 >= policy.min_top1_accuracy:
            checks.append(GateCheck("top1Accuracy", "pass", top1, f">= {policy.min_top1_accuracy}"))
        else:
            failures.append(FAIL_TOP1_ACCURACY_BELOW_MINIMUM)
            checks.append(GateCheck("top1Accuracy", "fail", top1, f">= {policy.min_top1_accuracy}"))
        if isinstance(batch_exact, (int, float)) and batch_exact >= policy.min_batch_exact_match:
            checks.append(GateCheck("batchExactMatch", "pass", batch_exact, f">= {policy.min_batch_exact_match}"))
        else:
            failures.append(FAIL_BATCH_EXACT_MATCH_BELOW_MINIMUM)
            checks.append(GateCheck("batchExactMatch", "fail", batch_exact, f">= {policy.min_batch_exact_match}"))

    # --- Operational sub-gate ---
    request_count = replay_report.get("requestCount", 0)
    batch_count = replay_report.get("batchCount", 0)
    errored_batch_count = replay_report.get("erroredBatchCount", 0)
    omitted_rate = replay_report.get("omittedRate", 0)
    identity = replay_report.get("modelIdentity")
    model_ids = identity.get("modelIds", ()) if isinstance(identity, dict) else ()
    checksums = identity.get("checksums", ()) if isinstance(identity, dict) else ()

    if not isinstance(request_count, int) or request_count <= 0:
        blockers.append(BLOCK_NO_REQUESTS)
    elif not isinstance(latency_sample_count, int) or latency_sample_count != request_count:
        blockers.append(BLOCK_INCOMPLETE_LATENCY_SAMPLES)
    if not isinstance(batch_count, int) or batch_count <= 0:
        blockers.append(BLOCK_NO_BATCHES)
    else:
        errored_rate = errored_batch_count / batch_count
        if errored_rate > policy.max_errored_batch_rate:
            failures.append(FAIL_ERRORED_BATCH_RATE_EXCEEDED)
            checks.append(GateCheck("erroredBatchRate", "fail", errored_rate, f"<= {policy.max_errored_batch_rate}"))
        else:
            checks.append(GateCheck("erroredBatchRate", "pass", errored_rate, f"<= {policy.max_errored_batch_rate}"))
        if isinstance(omitted_rate, (int, float)) and omitted_rate > policy.max_omitted_rate:
            failures.append(FAIL_OMITTED_RATE_EXCEEDED)
            checks.append(GateCheck("omittedRate", "fail", omitted_rate, f"<= {policy.max_omitted_rate}"))

    if isinstance(latency_p95, (int, float)) and latency_p95 > policy.p95_ms:
        failures.append(FAIL_LATENCY_P95_EXCEEDED)
        checks.append(GateCheck("latencyP95", "fail", latency_p95, f"<= {policy.p95_ms}"))
    else:
        checks.append(GateCheck("latencyP95", "pass", latency_p95, f"<= {policy.p95_ms}"))
    # Spec §3.11: latencyMaxMs >= maxMs IS a fail (strictly below required).
    if latency_max is None:
        blockers.append(BLOCK_INCOMPLETE_LATENCY_SAMPLES)
    elif isinstance(latency_max, (int, float)) and latency_max >= policy.max_ms:
        failures.append(FAIL_LATENCY_MAX_NOT_BELOW_CEILING)
        checks.append(GateCheck("latencyMax", "fail", latency_max, f"< {policy.max_ms}"))
    else:
        checks.append(GateCheck("latencyMax", "pass", latency_max, f"< {policy.max_ms}"))

    if not model_ids or not all(isinstance(value, str) for value in model_ids):
        blockers.append(BLOCK_MISSING_MODEL_IDENTITY)
    elif policy.require_single_model_identity and len(set(model_ids)) != 1:
        failures.append(FAIL_MULTIPLE_MODEL_IDENTITIES)
        checks.append(GateCheck("modelIdentity", "fail", len(set(model_ids)), "exactly 1"))
    if not checksums or not all(isinstance(value, str) for value in checksums):
        blockers.append(BLOCK_MISSING_MODEL_CHECKSUM)
    elif len(set(checksums)) != 1:
        failures.append(FAIL_MULTIPLE_MODEL_CHECKSUMS)
    else:
        frozen_checksum = freeze_manifest.get("files", {}).get("best-dev.pt")
        if frozen_checksum is None:
            blockers.append(BLOCK_MISSING_MODEL_CHECKSUM)
        elif checksums[0] != frozen_checksum:
            failures.append(FAIL_MODEL_IDENTITY_CHANGED)
            checks.append(GateCheck("modelChecksum", "fail", checksums[0], f"== {frozen_checksum}"))

    return GateReport(
        schema_version=1,
        gate="replay",
        status=_reduce_status(failures, blockers),
        policy_sha256=policy_sha256,
        evidence_sha256=evidence_sha256,
        checks=tuple(checks),
        failures=tuple(failures),
        blockers=tuple(blockers),
    )


def publish_gate_report(path: Path, report: GateReport) -> Path:
    """Immutable publication of gate report. Idempotent for byte-equivalent content."""
    from .schema import publish_no_replace
    publish_no_replace(path, report.to_dict())
    return path


def main(argv: list[str] | None = None) -> int:
    """CLI: adjudicate-final or adjudicate-replay (never runs service/replay)."""
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    final = sub.add_parser("adjudicate-final", help="Adjudicate a final evaluation report against gate policy.")
    final.add_argument("--gate-config", type=Path, required=True)
    final.add_argument("--final-report", type=Path, required=True)
    final.add_argument("--output", type=Path, default=None)
    final.add_argument("--stdout", action="store_true")

    replay = sub.add_parser("adjudicate-replay", help="Adjudicate an existing replay report against gate policy.")
    replay.add_argument("--gate-config", type=Path, required=True)
    replay.add_argument("--replay-report", type=Path, required=True)
    replay.add_argument("--frozen-dir", type=Path, required=True)
    replay.add_argument("--output", type=Path, default=None)
    replay.add_argument("--stdout", action="store_true")

    args = parser.parse_args(argv)
    try:
        policy = load_gate_policy(Path(args.gate_config))
        evidence_path = Path(args.final_report if args.command == "adjudicate-final" else args.replay_report)
        evidence_doc = read_json(evidence_path)
    except (OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return EXIT_INVALID

    if args.command == "adjudicate-final":
        report = adjudicate_final(
            policy,
            evidence_doc,
            policy_sha256=_sha256_file(Path(args.gate_config)),
            evidence_sha256=_sha256_file(evidence_path),
        )
    else:
        freeze_doc = read_json(Path(args.frozen_dir) / "freeze-manifest.json")
        report = adjudicate_replay(
            policy,
            evidence_doc,
            freeze_doc,
            policy_sha256=_sha256_file(Path(args.gate_config)),
            evidence_sha256=_sha256_file(evidence_path),
        )

    if args.output:
        publish_gate_report(args.output, report)
    if args.stdout or not args.output:
        print(report.to_json())
    return exit_code_for_status(report.status)


if __name__ == "__main__":
    sys.exit(main())
