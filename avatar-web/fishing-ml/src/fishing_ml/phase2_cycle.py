"""Immutable contracts for the Phase 2 coverage-recovery dataset cycle."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from fractions import Fraction
from pathlib import Path
from typing import Iterable, Literal, Mapping, Sequence

from .duplicate_detector import (
    DETECTOR_DESCRIPTOR,
    BatchEvidence,
    build_duplicate_groups,
    compare_batches,
    detector_descriptor_sha256,
    detector_implementation_sha256,
    load_batch_evidence,
)
from .schema import (
    BatchManifest,
    ManifestError,
    load_label,
    load_manifest,
    publish_no_replace,
    read_json,
    sha256_file,
    validate_batch,
)

LEGACY_CYCLE_ID = "p2cr-20260905-01"
CYCLE_ID = "p2cr2-20260906-01"
EXPERIMENT_ID = CYCLE_ID
DATASET_ID = "phase2-coverage-recovery-v2-20260906-01"
PARENT_DATASET_ID = "phase2-20260904-01"
ALLOCATION_SEED = "20260906"
TARGET_ELIGIBLE_BATCH_COUNT = 90
TRAIN_ACQUIRED_COUNT = 45
DEV_ACQUIRED_COUNT = 15
FINAL_ACQUIRED_COUNT = 30
PARENT_TRAIN_COUNT = 140
PARENT_DEV_COUNT = 30
PARENT_FINAL_COUNT = 30
DIAGNOSTIC_INVENTORY_SHA256 = (
    "c133238289a9d36dddc0861d4ac2c0347814b9d231fcb2c75560d33645647c53"
)

_SAFE_ID = re.compile(r"^[^/\\\s]+$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_POLICY_KEYS = frozenset(
    {
        "schemaVersion",
        "cycleId",
        "datasetId",
        "parentDatasetId",
        "targetEligibleBatchCount",
        "selectionRule",
        "captureMode",
        "captureFishingCommands",
        "forbiddenFishingCommands",
        "requiresCompleteReviewerLabel",
        "forbidsPriorFinalDirectedSampling",
        "singleImageOverlapRejectsBatch",
        "diagnosticCycleId",
        "diagnosticInventorySha256",
        "diagnosticBatchCommitment",
        "detector",
        "detectorSha256",
        "detectorImplementationSha256",
        "activatedAt",
        "approvedBy",
        "approvalEvidence",
    }
)
_QUARANTINE_KEYS = frozenset(
    {
        "schemaVersion",
        "cycleId",
        "parentDatasetId",
        "parentDatasetVersionSha256",
        "parentFinalSplitSha256",
        "parentFinalBatchIds",
        "diagnosticCycleId",
        "diagnosticInventorySha256",
        "diagnosticBatchCount",
        "diagnosticBatchCommitment",
        "diagnosticBatchIds",
        "reasons",
    }
)
_LEGACY_CAPTURE_INVENTORY_KEYS = frozenset(
    {"schemaVersion", "cycleId", "startedAt", "stoppedAt", "records"}
)
_CAPTURE_INVENTORY_KEYS = frozenset(
    {
        "schemaVersion",
        "cycleId",
        "captureMode",
        "startedAt",
        "stoppedAt",
        "requested",
        "summary",
        "records",
    }
)
_CAPTURE_RECORD_KEYS = frozenset(
    {"batchId", "capturedAt", "manifestSha256"}
)
_CAPTURE_REQUEST_KEYS = frozenset({"map", "area", "target", "delayMs"})
_CAPTURE_SUMMARY_KEYS = frozenset(
    {"reason", "savedBatchCount", "skippedBatchCount", "errorCount", "tx43Count"}
)
_RULING_KEYS = frozenset(
    {
        "schemaVersion",
        "cycleId",
        "detectorSha256",
        "detectorImplementationSha256",
        "approvedBy",
        "approvedAt",
        "approvalEvidence",
        "groups",
    }
)
_RULING_ENTRY_KEYS = frozenset({"groupId", "decision"})
_ACQUISITION_KEYS = frozenset(
    {
        "schemaVersion",
        "cycleId",
        "parentDatasetId",
        "acquisitionPolicySha256",
        "quarantineSha256",
        "detector",
        "eligibleBatchCount",
        "rejectedByReason",
        "batches",
    }
)
_ACQUISITION_BATCH_KEYS = frozenset(
    {
        "batchId",
        "captureTimestamp",
        "manifestSha256",
        "labelSha256",
        "imageSha256",
        "duplicateGroupIds",
        "acquisitionPolicySha256",
    }
)
_ALLOCATION_KEYS = frozenset(
    {
        "schemaVersion",
        "cycleId",
        "datasetId",
        "parentDatasetId",
        "seed",
        "acquisitionSha256",
        "quarantineSha256",
        "detector",
        "acquired",
        "final",
        "counts",
        "splits",
        "sourceCommitment",
    }
)
_PREFINAL_KEYS = frozenset({"schemaVersion", "cycleId", "datasetId", "sealedFinal"})
_SEALED_FINAL_KEYS = frozenset({"path", "count", "sizeBytes", "sha256"})

class StageBlockedError(RuntimeError):
    """Raised when an approval, adjudication, or prerequisite is missing."""


class StageInvalidError(ValueError):
    """Raised when an immutable cycle contract is violated."""


class _CycleArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        raise StageInvalidError(message)


@dataclass(frozen=True, slots=True)
class SourceCommitment:
    count: int
    sha256: str


@dataclass(frozen=True, slots=True)
class SplitCommitment:
    count: int
    sha256: str


@dataclass(frozen=True, slots=True)
class AcquisitionPolicy:
    schema_version: Literal[2]
    cycle_id: str
    dataset_id: str
    parent_dataset_id: str
    target_eligible_batch_count: int
    selection_rule: str
    capture_mode: str
    capture_fishing_commands: tuple[int, ...]
    forbidden_fishing_commands: tuple[int, ...]
    requires_complete_reviewer_label: bool
    forbids_prior_final_directed_sampling: bool
    single_image_overlap_rejects_batch: bool
    diagnostic_cycle_id: str
    diagnostic_inventory_sha256: str
    diagnostic_batch_commitment: str
    detector_descriptor: Mapping[str, object]
    detector_sha256: str
    detector_implementation_sha256: str
    activated_at: str
    approved_by: str
    approval_evidence: str


@dataclass(frozen=True, slots=True)
class QuarantineLedger:
    schema_version: Literal[2]
    cycle_id: str
    parent_dataset_id: str
    parent_dataset_version_sha256: str
    parent_final_split_sha256: str
    parent_final_batch_ids: tuple[str, ...]
    diagnostic_cycle_id: str
    diagnostic_inventory_sha256: str
    diagnostic_batch_count: int
    diagnostic_batch_commitment: str
    diagnostic_batch_ids: tuple[str, ...]
    reasons: tuple[str, ...]

    @property
    def batch_ids(self) -> tuple[str, ...]:
        return tuple(sorted((*self.parent_final_batch_ids, *self.diagnostic_batch_ids)))


@dataclass(frozen=True, slots=True)
class CaptureRecord:
    batch_id: str
    captured_at: str
    manifest_sha256: str


@dataclass(frozen=True, slots=True)
class LegacyCaptureInventory:
    schema_version: Literal[1]
    cycle_id: str
    started_at: str
    stopped_at: str
    records: tuple[CaptureRecord, ...]


@dataclass(frozen=True, slots=True)
class CaptureRequest:
    map: int
    area: int
    target: int
    delay_ms: int


@dataclass(frozen=True, slots=True)
class CaptureSummary:
    reason: str
    saved_batch_count: int
    skipped_batch_count: int
    error_count: int
    tx43_count: int


@dataclass(frozen=True, slots=True)
class CaptureInventory:
    schema_version: Literal[2]
    cycle_id: str
    capture_mode: str
    started_at: str
    stopped_at: str
    requested: CaptureRequest
    summary: CaptureSummary
    records: tuple[CaptureRecord, ...]


@dataclass(frozen=True, slots=True)
class DuplicateRuling:
    group_id: str
    decision: Literal["reject-acquired", "allow-batch-group"]


@dataclass(frozen=True, slots=True)
class DuplicateRulingDocument:
    schema_version: Literal[2]
    cycle_id: str
    detector_sha256: str
    detector_implementation_sha256: str
    approved_by: str
    approved_at: str
    approval_evidence: str
    groups: tuple[DuplicateRuling, ...]


@dataclass(frozen=True, slots=True)
class AcquisitionBatch:
    batch_id: str
    capture_timestamp: str
    manifest_sha256: str
    label_sha256: str
    image_sha256: tuple[str, ...]
    duplicate_group_ids: tuple[str, ...]
    acquisition_policy_sha256: str


@dataclass(frozen=True, slots=True)
class AcquisitionManifest:
    schema_version: Literal[2]
    cycle_id: str
    parent_dataset_id: str
    acquisition_policy_sha256: str
    quarantine_sha256: str
    detector_sha256: str
    detector_implementation_sha256: str
    rejected_by_reason: Mapping[str, int]
    batches: tuple[AcquisitionBatch, ...]


@dataclass(frozen=True, slots=True)
class AllocationManifest:
    schema_version: Literal[2]
    cycle_id: str
    dataset_id: str
    parent_dataset_id: str
    seed: str
    acquisition_sha256: str
    quarantine_sha256: str
    detector_sha256: str
    detector_implementation_sha256: str
    acquired_train_ids: tuple[str, ...]
    acquired_dev_ids: tuple[str, ...]
    final_commitment: SplitCommitment
    final_size_bytes: int
    train_commitment: SplitCommitment
    dev_commitment: SplitCommitment
    source_commitment: SourceCommitment


@dataclass(frozen=True, slots=True)
class WorkingMembership:
    dataset_id: str
    train_ids: tuple[str, ...]
    dev_ids: tuple[str, ...]
    acquired_dev_ids: tuple[str, ...]
    source_commitment: SourceCommitment


@dataclass(frozen=True, slots=True)
class PrefinalIntegrity:
    schema_version: Literal[2]
    final_count: int
    final_size_bytes: int
    final_sha256: str


@dataclass(slots=True)
class _UnionFind:
    parent: list[int]
    rank: list[int]

    @classmethod
    def create(cls, size: int) -> "_UnionFind":
        return cls(parent=list(range(size)), rank=[0] * size)

    def find(self, item: int) -> int:
        root = item
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[item] != item:
            parent = self.parent[item]
            self.parent[item] = root
            item = parent
        return root

    def union(self, left: int, right: int) -> None:
        left_root = self.find(left)
        right_root = self.find(right)
        if left_root == right_root:
            return
        if self.rank[left_root] < self.rank[right_root]:
            left_root, right_root = right_root, left_root
        self.parent[right_root] = left_root
        if self.rank[left_root] == self.rank[right_root]:
            self.rank[left_root] += 1


def _canonical_json_bytes(value: object) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")


def _document_sha256(value: object) -> str:
    return hashlib.sha256(_canonical_json_bytes(value)).hexdigest()


def detector_identity() -> str:
    return detector_descriptor_sha256()


def _exact_mapping(value: object, keys: frozenset[str], name: str) -> Mapping[str, object]:
    if not isinstance(value, Mapping):
        raise StageInvalidError(f"{name} must be an object")
    present = set(value)
    if present != keys:
        missing = sorted(keys - present)
        unknown = sorted(present - keys)
        details: list[str] = []
        if missing:
            details.append(f"missing {missing}")
        if unknown:
            details.append(f"unknown {unknown}")
        raise StageInvalidError(f"{name} fields mismatch ({'; '.join(details)})")
    return value


def _strict_int(value: object, name: str, *, minimum: int = 0) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < minimum:
        raise StageInvalidError(f"{name} must be an integer >= {minimum}")
    return value


def _strict_bool(value: object, name: str) -> bool:
    if not isinstance(value, bool):
        raise StageInvalidError(f"{name} must be a boolean")
    return value


def _strict_int_tuple(value: object, name: str) -> tuple[int, ...]:
    if not isinstance(value, list):
        raise StageInvalidError(f"{name} must be a list")
    return tuple(_strict_int(item, f"{name} entry") for item in value)


def _text(value: object, name: str) -> str:
    if not isinstance(value, str) or not value or value.strip() != value:
        raise StageInvalidError(f"{name} must be a non-empty trimmed string")
    return value


def _safe_id(value: object, name: str) -> str:
    result = _text(value, name)
    if result in {".", ".."} or not _SAFE_ID.fullmatch(result):
        raise StageInvalidError(f"{name} is not a safe id")
    return result


def _sha256(value: object, name: str) -> str:
    if not isinstance(value, str) or not _HEX64.fullmatch(value):
        raise StageInvalidError(f"{name} must be lowercase SHA-256")
    return value


def _utc(value: object, name: str) -> str:
    text = _text(value, name)
    _utc_instant(text, name)
    return text


def _utc_instant(value: object, name: str) -> datetime:
    text = _text(value, name)
    normalized = text[:-1] + "+00:00" if text.endswith("Z") else text
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as error:
        raise StageInvalidError(f"{name} must be ISO-8601") from error
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise StageInvalidError(f"{name} must be UTC")
    return parsed.astimezone(timezone.utc)


def _safe_unique_ids(values: Iterable[object], name: str = "batchIds") -> tuple[str, ...]:
    result = tuple(_safe_id(value, f"{name} entry") for value in values)
    if len(result) != len(set(result)):
        raise StageInvalidError(f"{name} contains duplicate ids")
    return result


def _sorted_unique_ids(values: Iterable[object], name: str = "batchIds") -> tuple[str, ...]:
    return tuple(sorted(_safe_unique_ids(values, name)))


def commit_ids(batch_ids: Iterable[str]) -> SourceCommitment:
    normalized = _sorted_unique_ids(batch_ids)
    payload = ("\n".join(normalized) + "\n").encode("utf-8")
    return SourceCommitment(
        count=len(normalized),
        sha256=hashlib.sha256(payload).hexdigest(),
    )


def _ids_bytes(batch_ids: Sequence[str]) -> bytes:
    normalized = _safe_unique_ids(batch_ids)
    if tuple(sorted(normalized)) != normalized:
        raise StageInvalidError("split ids must be byte-ascending")
    return ("\n".join(normalized) + "\n").encode("utf-8")


def _read_ids(
    path: Path,
    *,
    expected_count: int | None = None,
    require_sorted: bool = True,
) -> tuple[str, ...]:
    raw = Path(path).read_text(encoding="utf-8").splitlines()
    ids = _safe_unique_ids(raw, path.name)
    if require_sorted and tuple(sorted(ids)) != ids:
        raise StageInvalidError(f"{path} ids must be sorted")
    if expected_count is not None and len(ids) != expected_count:
        raise StageInvalidError(
            f"{path} must contain exactly {expected_count} ids, got {len(ids)}"
        )
    return ids


def _parse_source_commitment(value: object, name: str) -> SourceCommitment:
    document = _exact_mapping(value, frozenset({"count", "sha256"}), name)
    return SourceCommitment(
        count=_strict_int(document["count"], f"{name}.count", minimum=1),
        sha256=_sha256(document["sha256"], f"{name}.sha256"),
    )


def _parse_split_commitment(value: object, name: str) -> SplitCommitment:
    commitment = _parse_source_commitment(value, name)
    return SplitCommitment(commitment.count, commitment.sha256)


def _publish_bytes_no_replace(path: Path, payload: bytes, mode: int = 0o600) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.parent / f".{path.name}.tmp.{os.getpid()}.{os.urandom(6).hex()}"
    descriptor = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, mode)
    try:
        view = memoryview(payload)
        while view:
            written = os.write(descriptor, view)
            view = view[written:]
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
    try:
        try:
            os.link(temporary, path)
        except FileExistsError:
            metadata = os.lstat(path)
            if not stat.S_ISREG(metadata.st_mode) or path.read_bytes() != payload:
                raise FileExistsError(f"refusing to replace existing file: {path}")
        parent_descriptor = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(parent_descriptor)
        finally:
            os.close(parent_descriptor)
    finally:
        try:
            temporary.unlink()
        except FileNotFoundError:
            pass


def _policy_to_json(policy: AcquisitionPolicy) -> dict[str, object]:
    return {
        "schemaVersion": policy.schema_version,
        "cycleId": policy.cycle_id,
        "datasetId": policy.dataset_id,
        "parentDatasetId": policy.parent_dataset_id,
        "targetEligibleBatchCount": policy.target_eligible_batch_count,
        "selectionRule": policy.selection_rule,
        "captureMode": policy.capture_mode,
        "captureFishingCommands": list(policy.capture_fishing_commands),
        "forbiddenFishingCommands": list(policy.forbidden_fishing_commands),
        "requiresCompleteReviewerLabel": policy.requires_complete_reviewer_label,
        "forbidsPriorFinalDirectedSampling": policy.forbids_prior_final_directed_sampling,
        "singleImageOverlapRejectsBatch": policy.single_image_overlap_rejects_batch,
        "diagnosticCycleId": policy.diagnostic_cycle_id,
        "diagnosticInventorySha256": policy.diagnostic_inventory_sha256,
        "diagnosticBatchCommitment": policy.diagnostic_batch_commitment,
        "detector": policy.detector_descriptor,
        "detectorSha256": policy.detector_sha256,
        "detectorImplementationSha256": policy.detector_implementation_sha256,
        "activatedAt": policy.activated_at,
        "approvedBy": policy.approved_by,
        "approvalEvidence": policy.approval_evidence,
    }


def parse_acquisition_policy(value: object) -> AcquisitionPolicy:
    document = _exact_mapping(value, _POLICY_KEYS, "acquisition policy")
    detector_descriptor = document["detector"]
    if detector_descriptor != DETECTOR_DESCRIPTOR:
        raise StageInvalidError("acquisition policy detector descriptor mismatch")
    policy = AcquisitionPolicy(
        schema_version=_strict_int(document["schemaVersion"], "schemaVersion", minimum=2),
        cycle_id=_safe_id(document["cycleId"], "cycleId"),
        dataset_id=_safe_id(document["datasetId"], "datasetId"),
        parent_dataset_id=_safe_id(document["parentDatasetId"], "parentDatasetId"),
        target_eligible_batch_count=_strict_int(
            document["targetEligibleBatchCount"], "targetEligibleBatchCount", minimum=1
        ),
        selection_rule=_text(document["selectionRule"], "selectionRule"),
        capture_mode=_text(document["captureMode"], "captureMode"),
        capture_fishing_commands=_strict_int_tuple(
            document["captureFishingCommands"], "captureFishingCommands"
        ),
        forbidden_fishing_commands=_strict_int_tuple(
            document["forbiddenFishingCommands"], "forbiddenFishingCommands"
        ),
        requires_complete_reviewer_label=_strict_bool(
            document["requiresCompleteReviewerLabel"], "requiresCompleteReviewerLabel"
        ),
        forbids_prior_final_directed_sampling=_strict_bool(
            document["forbidsPriorFinalDirectedSampling"],
            "forbidsPriorFinalDirectedSampling",
        ),
        single_image_overlap_rejects_batch=_strict_bool(
            document["singleImageOverlapRejectsBatch"],
            "singleImageOverlapRejectsBatch",
        ),
        diagnostic_cycle_id=_safe_id(
            document["diagnosticCycleId"], "diagnosticCycleId"
        ),
        diagnostic_inventory_sha256=_sha256(
            document["diagnosticInventorySha256"], "diagnosticInventorySha256"
        ),
        diagnostic_batch_commitment=_sha256(
            document["diagnosticBatchCommitment"], "diagnosticBatchCommitment"
        ),
        detector_descriptor=DETECTOR_DESCRIPTOR,
        detector_sha256=_sha256(document["detectorSha256"], "detectorSha256"),
        detector_implementation_sha256=_sha256(
            document["detectorImplementationSha256"],
            "detectorImplementationSha256",
        ),
        activated_at=_utc(document["activatedAt"], "activatedAt"),
        approved_by=_text(document["approvedBy"], "approvedBy"),
        approval_evidence=_text(document["approvalEvidence"], "approvalEvidence"),
    )
    if policy != AcquisitionPolicy(
        schema_version=2,
        cycle_id=CYCLE_ID,
        dataset_id=DATASET_ID,
        parent_dataset_id=PARENT_DATASET_ID,
        target_eligible_batch_count=TARGET_ELIGIBLE_BATCH_COUNT,
        selection_rule="first-90-chronological-eligible-after-activation",
        capture_mode="active-rx79-crawl-no-answer",
        capture_fishing_commands=(41, 44, 45),
        forbidden_fishing_commands=(43,),
        requires_complete_reviewer_label=True,
        forbids_prior_final_directed_sampling=True,
        single_image_overlap_rejects_batch=False,
        diagnostic_cycle_id=LEGACY_CYCLE_ID,
        diagnostic_inventory_sha256=DIAGNOSTIC_INVENTORY_SHA256,
        diagnostic_batch_commitment=policy.diagnostic_batch_commitment,
        detector_descriptor=DETECTOR_DESCRIPTOR,
        detector_sha256=detector_identity(),
        detector_implementation_sha256=detector_implementation_sha256(),
        activated_at=policy.activated_at,
        approved_by="hieunt",
        approval_evidence=(
            "2026-09-06 approved Fishing Phase 2 Batch-Duplicate Recovery Cycle design"
        ),
    ):
        raise StageInvalidError("acquisition policy does not match the approved contract")
    return policy


def publish_acquisition_policy(
    diagnostic_inventory_path: Path,
    output_path: Path,
    now: datetime | None = None,
) -> AcquisitionPolicy:
    _, diagnostic_commitment = _load_committed_legacy_inventory(
        diagnostic_inventory_path
    )
    activated = now or datetime.now(timezone.utc)
    if activated.tzinfo is None or activated.utcoffset() != timedelta(0):
        raise StageInvalidError("policy activation time must be UTC")
    policy = AcquisitionPolicy(
        schema_version=2,
        cycle_id=CYCLE_ID,
        dataset_id=DATASET_ID,
        parent_dataset_id=PARENT_DATASET_ID,
        target_eligible_batch_count=TARGET_ELIGIBLE_BATCH_COUNT,
        selection_rule="first-90-chronological-eligible-after-activation",
        capture_mode="active-rx79-crawl-no-answer",
        capture_fishing_commands=(41, 44, 45),
        forbidden_fishing_commands=(43,),
        requires_complete_reviewer_label=True,
        forbids_prior_final_directed_sampling=True,
        single_image_overlap_rejects_batch=False,
        diagnostic_cycle_id=LEGACY_CYCLE_ID,
        diagnostic_inventory_sha256=DIAGNOSTIC_INVENTORY_SHA256,
        diagnostic_batch_commitment=diagnostic_commitment.sha256,
        detector_descriptor=DETECTOR_DESCRIPTOR,
        detector_sha256=detector_identity(),
        detector_implementation_sha256=detector_implementation_sha256(),
        activated_at=activated.isoformat().replace("+00:00", "Z"),
        approved_by="hieunt",
        approval_evidence=(
            "2026-09-06 approved Fishing Phase 2 Batch-Duplicate Recovery Cycle design"
        ),
    )
    publish_no_replace(Path(output_path), _policy_to_json(policy))
    return policy


def _quarantine_to_json(ledger: QuarantineLedger) -> dict[str, object]:
    return {
        "schemaVersion": ledger.schema_version,
        "cycleId": ledger.cycle_id,
        "parentDatasetId": ledger.parent_dataset_id,
        "parentDatasetVersionSha256": ledger.parent_dataset_version_sha256,
        "parentFinalSplitSha256": ledger.parent_final_split_sha256,
        "parentFinalBatchIds": list(ledger.parent_final_batch_ids),
        "diagnosticCycleId": ledger.diagnostic_cycle_id,
        "diagnosticInventorySha256": ledger.diagnostic_inventory_sha256,
        "diagnosticBatchCount": ledger.diagnostic_batch_count,
        "diagnosticBatchCommitment": ledger.diagnostic_batch_commitment,
        "diagnosticBatchIds": list(ledger.diagnostic_batch_ids),
        "reasons": list(ledger.reasons),
    }


def parse_quarantine(value: object) -> QuarantineLedger:
    document = _exact_mapping(value, _QUARANTINE_KEYS, "quarantine")
    parent_final_values = document["parentFinalBatchIds"]
    diagnostic_values = document["diagnosticBatchIds"]
    reasons_values = document["reasons"]
    if not isinstance(parent_final_values, list):
        raise StageInvalidError("parentFinalBatchIds must be a list")
    if not isinstance(diagnostic_values, list):
        raise StageInvalidError("diagnosticBatchIds must be a list")
    if not isinstance(reasons_values, list):
        raise StageInvalidError("reasons must be a list")
    parent_final_ids = _sorted_unique_ids(
        parent_final_values, "parentFinalBatchIds"
    )
    diagnostic_ids = _sorted_unique_ids(diagnostic_values, "diagnosticBatchIds")
    reasons = tuple(_text(reason, "reasons entry") for reason in reasons_values)
    ledger = QuarantineLedger(
        schema_version=_strict_int(document["schemaVersion"], "schemaVersion", minimum=2),
        cycle_id=_safe_id(document["cycleId"], "cycleId"),
        parent_dataset_id=_safe_id(document["parentDatasetId"], "parentDatasetId"),
        parent_dataset_version_sha256=_sha256(
            document["parentDatasetVersionSha256"], "parentDatasetVersionSha256"
        ),
        parent_final_split_sha256=_sha256(
            document["parentFinalSplitSha256"], "parentFinalSplitSha256"
        ),
        parent_final_batch_ids=parent_final_ids,
        diagnostic_cycle_id=_safe_id(
            document["diagnosticCycleId"], "diagnosticCycleId"
        ),
        diagnostic_inventory_sha256=_sha256(
            document["diagnosticInventorySha256"], "diagnosticInventorySha256"
        ),
        diagnostic_batch_count=_strict_int(
            document["diagnosticBatchCount"], "diagnosticBatchCount", minimum=1
        ),
        diagnostic_batch_commitment=_sha256(
            document["diagnosticBatchCommitment"], "diagnosticBatchCommitment"
        ),
        diagnostic_batch_ids=diagnostic_ids,
        reasons=reasons,
    )
    if (
        ledger.schema_version != 2
        or ledger.cycle_id != CYCLE_ID
        or ledger.parent_dataset_id != PARENT_DATASET_ID
        or len(ledger.parent_final_batch_ids) != PARENT_FINAL_COUNT
        or ledger.diagnostic_cycle_id != LEGACY_CYCLE_ID
        or ledger.diagnostic_inventory_sha256 != DIAGNOSTIC_INVENTORY_SHA256
        or ledger.diagnostic_batch_count != TARGET_ELIGIBLE_BATCH_COUNT
        or len(ledger.diagnostic_batch_ids) != TARGET_ELIGIBLE_BATCH_COUNT
        or ledger.reasons
        != ("post-policy-diagnostic", "previous-final-exposed")
    ):
        raise StageInvalidError("quarantine does not match the approved contract")
    if set(ledger.parent_final_batch_ids).intersection(ledger.diagnostic_batch_ids):
        raise StageInvalidError("parent-final and diagnostic quarantines overlap")
    diagnostic_commitment = commit_ids(ledger.diagnostic_batch_ids)
    if (
        diagnostic_commitment.count != ledger.diagnostic_batch_count
        or diagnostic_commitment.sha256 != ledger.diagnostic_batch_commitment
    ):
        raise StageInvalidError("diagnostic quarantine commitment mismatch")
    return ledger


def publish_quarantine(
    parent_version_path: Path,
    parent_final_path: Path,
    diagnostic_inventory_path: Path,
    output_path: Path,
) -> QuarantineLedger:
    parent_final_ids = tuple(
        sorted(
            _read_ids(
                parent_final_path,
                expected_count=PARENT_FINAL_COUNT,
                require_sorted=False,
            )
        )
    )
    parent_ids = set(_load_parent_batch_ids(parent_version_path))
    if not set(parent_final_ids).issubset(parent_ids):
        raise StageInvalidError("parent final contains ids outside sourceBatches")
    legacy_inventory, diagnostic_commitment = _load_committed_legacy_inventory(
        diagnostic_inventory_path
    )
    diagnostic_ids = tuple(
        sorted(record.batch_id for record in legacy_inventory.records)
    )
    if parent_ids.intersection(diagnostic_ids):
        raise StageInvalidError("parent and diagnostic batch ids overlap")
    document: dict[str, object] = {
        "schemaVersion": 2,
        "cycleId": CYCLE_ID,
        "parentDatasetId": PARENT_DATASET_ID,
        "parentDatasetVersionSha256": sha256_file(parent_version_path),
        "parentFinalSplitSha256": sha256_file(parent_final_path),
        "parentFinalBatchIds": list(parent_final_ids),
        "diagnosticCycleId": LEGACY_CYCLE_ID,
        "diagnosticInventorySha256": DIAGNOSTIC_INVENTORY_SHA256,
        "diagnosticBatchCount": diagnostic_commitment.count,
        "diagnosticBatchCommitment": diagnostic_commitment.sha256,
        "diagnosticBatchIds": list(diagnostic_ids),
        "reasons": ["post-policy-diagnostic", "previous-final-exposed"],
    }
    ledger = parse_quarantine(document)
    publish_no_replace(Path(output_path), document)
    return ledger


def _parse_capture_records(value: object, name: str) -> tuple[CaptureRecord, ...]:
    records_raw = value
    if not isinstance(records_raw, list):
        raise StageInvalidError(f"{name} records must be a list")
    records: list[CaptureRecord] = []
    seen: set[str] = set()
    for index, raw in enumerate(records_raw):
        record_name = f"{name} record {index}"
        record = _exact_mapping(raw, _CAPTURE_RECORD_KEYS, record_name)
        batch_id = _safe_id(record["batchId"], f"{record_name}.batchId")
        if batch_id in seen:
            raise StageInvalidError("capture inventory contains a duplicate batch id")
        seen.add(batch_id)
        records.append(
            CaptureRecord(
                batch_id=batch_id,
                captured_at=_utc(record["capturedAt"], f"{record_name}.capturedAt"),
                manifest_sha256=_sha256(
                    record["manifestSha256"], f"{record_name}.manifestSha256"
                ),
            )
        )
    if records != sorted(
        records,
        key=lambda item: (
            _utc_instant(item.captured_at, "capture record capturedAt"),
            item.batch_id,
        ),
    ):
        raise StageInvalidError("capture records must be chronological then byte-ascending")
    return tuple(records)


def parse_legacy_capture_inventory(value: object) -> LegacyCaptureInventory:
    document = _exact_mapping(
        value, _LEGACY_CAPTURE_INVENTORY_KEYS, "legacy capture inventory"
    )
    records = _parse_capture_records(
        document["records"], "legacy capture inventory"
    )
    inventory = LegacyCaptureInventory(
        schema_version=_strict_int(document["schemaVersion"], "schemaVersion", minimum=1),
        cycle_id=_safe_id(document["cycleId"], "cycleId"),
        started_at=_utc(document["startedAt"], "startedAt"),
        stopped_at=_utc(document["stoppedAt"], "stoppedAt"),
        records=records,
    )
    if (
        inventory.schema_version != 1
        or inventory.cycle_id != LEGACY_CYCLE_ID
        or len(inventory.records) != TARGET_ELIGIBLE_BATCH_COUNT
    ):
        raise StageInvalidError("legacy capture inventory identity mismatch")
    if _utc_instant(inventory.stopped_at, "stoppedAt") < _utc_instant(
        inventory.started_at, "startedAt"
    ):
        raise StageInvalidError("legacy capture inventory stop precedes start")
    return inventory


def _load_committed_legacy_inventory(
    path: Path,
    expected_commitment: str | None = None,
) -> tuple[LegacyCaptureInventory, SourceCommitment]:
    raw = Path(path).read_bytes()
    if hashlib.sha256(raw).hexdigest() != DIAGNOSTIC_INVENTORY_SHA256:
        raise StageInvalidError("diagnostic inventory byte commitment mismatch")
    try:
        value = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise StageInvalidError("diagnostic inventory is not valid JSON") from error
    inventory = parse_legacy_capture_inventory(value)
    commitment = commit_ids(record.batch_id for record in inventory.records)
    if commitment.count != TARGET_ELIGIBLE_BATCH_COUNT:
        raise StageInvalidError("diagnostic inventory record count mismatch")
    if expected_commitment is not None and commitment.sha256 != expected_commitment:
        raise StageInvalidError("diagnostic inventory record commitment mismatch")
    return inventory, commitment


def _capture_inventory_to_json(inventory: CaptureInventory) -> dict[str, object]:
    return {
        "schemaVersion": inventory.schema_version,
        "cycleId": inventory.cycle_id,
        "captureMode": inventory.capture_mode,
        "startedAt": inventory.started_at,
        "stoppedAt": inventory.stopped_at,
        "requested": {
            "map": inventory.requested.map,
            "area": inventory.requested.area,
            "target": inventory.requested.target,
            "delayMs": inventory.requested.delay_ms,
        },
        "summary": {
            "reason": inventory.summary.reason,
            "savedBatchCount": inventory.summary.saved_batch_count,
            "skippedBatchCount": inventory.summary.skipped_batch_count,
            "errorCount": inventory.summary.error_count,
            "tx43Count": inventory.summary.tx43_count,
        },
        "records": [
            {
                "batchId": record.batch_id,
                "capturedAt": record.captured_at,
                "manifestSha256": record.manifest_sha256,
            }
            for record in inventory.records
        ],
    }


def parse_capture_inventory(
    value: object,
    policy: AcquisitionPolicy,
) -> CaptureInventory:
    parse_acquisition_policy(_policy_to_json(policy))
    document = _exact_mapping(value, _CAPTURE_INVENTORY_KEYS, "capture inventory")
    request = _exact_mapping(
        document["requested"], _CAPTURE_REQUEST_KEYS, "capture inventory requested"
    )
    summary = _exact_mapping(
        document["summary"], _CAPTURE_SUMMARY_KEYS, "capture inventory summary"
    )
    records = _parse_capture_records(document["records"], "capture inventory")
    inventory = CaptureInventory(
        schema_version=_strict_int(document["schemaVersion"], "schemaVersion", minimum=2),
        cycle_id=_safe_id(document["cycleId"], "cycleId"),
        capture_mode=_text(document["captureMode"], "captureMode"),
        started_at=_utc(document["startedAt"], "startedAt"),
        stopped_at=_utc(document["stoppedAt"], "stoppedAt"),
        requested=CaptureRequest(
            map=_strict_int(request["map"], "requested.map"),
            area=_strict_int(request["area"], "requested.area"),
            target=_strict_int(request["target"], "requested.target", minimum=1),
            delay_ms=_strict_int(request["delayMs"], "requested.delayMs", minimum=1),
        ),
        summary=CaptureSummary(
            reason=_text(summary["reason"], "summary.reason"),
            saved_batch_count=_strict_int(
                summary["savedBatchCount"], "summary.savedBatchCount"
            ),
            skipped_batch_count=_strict_int(
                summary["skippedBatchCount"], "summary.skippedBatchCount"
            ),
            error_count=_strict_int(summary["errorCount"], "summary.errorCount"),
            tx43_count=_strict_int(summary["tx43Count"], "summary.tx43Count"),
        ),
        records=records,
    )
    if (
        inventory.schema_version != 2
        or inventory.cycle_id != CYCLE_ID
        or inventory.capture_mode != "active-rx79-crawl-no-answer"
        or inventory.requested.map != 14
        or inventory.requested.area != 1
        or inventory.requested.target != TARGET_ELIGIBLE_BATCH_COUNT
        or inventory.requested.delay_ms < 2000
        or inventory.summary.reason != "target-reached"
        or inventory.summary.saved_batch_count != TARGET_ELIGIBLE_BATCH_COUNT
        or inventory.summary.tx43_count != 0
        or len(inventory.records) != TARGET_ELIGIBLE_BATCH_COUNT
        or inventory.summary.saved_batch_count != len(inventory.records)
    ):
        raise StageInvalidError("capture inventory does not match the approved contract")
    activated_at = _utc_instant(policy.activated_at, "policy.activatedAt")
    started_at = _utc_instant(inventory.started_at, "startedAt")
    stopped_at = _utc_instant(inventory.stopped_at, "stoppedAt")
    if started_at < activated_at or stopped_at < activated_at:
        raise StageInvalidError("capture inventory predates policy activation")
    if stopped_at < started_at:
        raise StageInvalidError("capture inventory stop precedes start")
    for record in inventory.records:
        captured_at = _utc_instant(record.captured_at, "capture record capturedAt")
        if captured_at < activated_at or captured_at < started_at or captured_at > stopped_at:
            raise StageInvalidError("capture record timestamp is outside the approved window")
    return inventory


def _ruling_document_to_json(
    document: DuplicateRulingDocument,
) -> dict[str, object]:
    return {
        "schemaVersion": document.schema_version,
        "cycleId": document.cycle_id,
        "detectorSha256": document.detector_sha256,
        "detectorImplementationSha256": document.detector_implementation_sha256,
        "approvedBy": document.approved_by,
        "approvedAt": document.approved_at,
        "approvalEvidence": document.approval_evidence,
        "groups": [
            {"groupId": ruling.group_id, "decision": ruling.decision}
            for ruling in document.groups
        ],
    }


def parse_duplicate_rulings(value: object) -> DuplicateRulingDocument:
    document = _exact_mapping(value, _RULING_KEYS, "duplicate rulings")
    if (
        _strict_int(document["schemaVersion"], "schemaVersion", minimum=2) != 2
        or document["cycleId"] != CYCLE_ID
    ):
        raise StageInvalidError("duplicate ruling identity mismatch")
    if document["detectorSha256"] != detector_identity():
        raise StageInvalidError("duplicate ruling detector identity mismatch")
    implementation_sha256 = detector_implementation_sha256()
    if document["detectorImplementationSha256"] != implementation_sha256:
        raise StageInvalidError("duplicate ruling implementation identity mismatch")
    approved_by = _text(document["approvedBy"], "approvedBy")
    if approved_by != "hieunt":
        raise StageInvalidError("duplicate ruling approvedBy must be hieunt")
    approved_at = _utc(document["approvedAt"], "approvedAt")
    approval_evidence = _text(document["approvalEvidence"], "approvalEvidence")
    raw_groups = document["groups"]
    if not isinstance(raw_groups, list):
        raise StageInvalidError("duplicate ruling groups must be a list")
    groups: list[DuplicateRuling] = []
    seen: set[str] = set()
    for index, raw in enumerate(raw_groups):
        group = _exact_mapping(raw, _RULING_ENTRY_KEYS, f"duplicate ruling {index}")
        group_id = _sha256(group["groupId"], f"duplicate ruling {index}.groupId")
        decision = group["decision"]
        if decision not in {"reject-acquired", "allow-batch-group"}:
            raise StageInvalidError("duplicate ruling decision is not approved")
        if group_id in seen:
            raise StageInvalidError(f"duplicate ruling repeated for {group_id}")
        seen.add(group_id)
        groups.append(DuplicateRuling(group_id=group_id, decision=decision))
    if groups != sorted(groups, key=lambda ruling: ruling.group_id):
        raise StageInvalidError("duplicate ruling groups must be byte-ascending")
    return DuplicateRulingDocument(
        schema_version=2,
        cycle_id=CYCLE_ID,
        detector_sha256=detector_identity(),
        detector_implementation_sha256=implementation_sha256,
        approved_by=approved_by,
        approved_at=approved_at,
        approval_evidence=approval_evidence,
        groups=tuple(groups),
    )


@dataclass(frozen=True, slots=True)
class _AcquisitionScreen:
    policy: AcquisitionPolicy
    quarantine: QuarantineLedger
    inventory: CaptureInventory
    valid_records: tuple[CaptureRecord, ...]
    evidence_by_batch_id: Mapping[str, BatchEvidence]
    group_id_by_batch_id: Mapping[str, str]
    acquired_only_multi_groups: Mapping[str, tuple[str, ...]]
    auto_rejected_by_reason: Mapping[str, int]
    auto_rejected_batch_ids: frozenset[str]
    manual_rejected_batch_ids: frozenset[str]


def _require_canonical_document(path: Path, document: object, name: str) -> None:
    metadata = os.lstat(path)
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1:
        raise StageInvalidError(f"{name} must be a single-link regular file")
    if stat.S_IMODE(metadata.st_mode) != 0o600:
        raise StageInvalidError(f"{name} mode must be 0600")
    if Path(path).read_bytes() != _canonical_json_bytes(document):
        raise StageInvalidError(f"{name} bytes are not canonical")


def _load_parent_batch_ids(parent_version_path: Path) -> tuple[str, ...]:
    parent_version = _exact_mapping(
        read_json(parent_version_path),
        frozenset(
            {"schemaVersion", "datasetId", "parentDatasetId", "createdAt", "sourceBatches"}
        ),
        "parent dataset version",
    )
    if (
        _strict_int(parent_version["schemaVersion"], "parent schemaVersion", minimum=1)
        != 1
        or parent_version["datasetId"] != PARENT_DATASET_ID
    ):
        raise StageInvalidError("parent dataset identity mismatch")
    source_values = parent_version["sourceBatches"]
    if not isinstance(source_values, list):
        raise StageInvalidError("parent sourceBatches must be a list")
    parent_batch_ids = _sorted_unique_ids(source_values, "parent sourceBatches")
    if len(parent_batch_ids) not in (200, 206):
        raise StageInvalidError(
            f"parent dataset must contain 200 or 206 batches, got {len(parent_batch_ids)}"
        )
    return parent_batch_ids


def _load_evidence_corpus(
    owner: Literal["parent", "diagnostic"],
    batch_ids: Sequence[str],
    raw_root: Path,
    name: str,
) -> tuple[BatchEvidence, ...]:
    evidence: list[BatchEvidence] = []
    for batch_id in batch_ids:
        try:
            evidence.append(load_batch_evidence(owner, batch_id, raw_root))
        except (OSError, ManifestError, ValueError) as error:
            raise StageInvalidError(f"{name} evidence validation failed") from error
    return tuple(evidence)


def _is_complete_label(
    manifest: BatchManifest,
    label_path: Path,
    batch_id: str,
) -> bool:
    try:
        label = load_label(label_path)
    except (OSError, ValueError):
        return False
    query_indices = {entry.index for entry in manifest.images_new}
    reference_indices = {entry.index for entry in manifest.images}
    labeled_queries = [match.new_index for match in label.matches]
    return (
        label.batch_id == manifest.batch_id == batch_id
        and label.status == "complete"
        and len(labeled_queries) == len(query_indices)
        and set(labeled_queries) == query_indices
        and all(match.img_index in reference_indices for match in label.matches)
    )


def _load_screen_rulings(
    rulings_path: Path | None,
    required_groups: Mapping[str, tuple[str, ...]],
    policy: AcquisitionPolicy,
    *,
    require_rulings: bool,
) -> Mapping[str, DuplicateRuling]:
    required_ids = set(required_groups)
    if rulings_path is None:
        if require_rulings and required_ids:
            raise StageBlockedError(
                f"manual duplicate adjudication missing for {len(required_ids)} groups"
            )
        return {}
    document = parse_duplicate_rulings(read_json(rulings_path))
    _require_canonical_document(
        rulings_path,
        _ruling_document_to_json(document),
        "duplicate rulings",
    )
    if _utc_instant(document.approved_at, "rulings.approvedAt") < _utc_instant(
        policy.activated_at, "policy.activatedAt"
    ):
        raise StageInvalidError("duplicate rulings predate policy activation")
    rulings = {ruling.group_id: ruling for ruling in document.groups}
    extra_count = len(set(rulings) - required_ids)
    if extra_count:
        raise StageInvalidError(
            f"duplicate rulings contain {extra_count} stale or forbidden groups"
        )
    missing_count = len(required_ids - set(rulings))
    if missing_count:
        raise StageBlockedError(
            f"manual duplicate adjudication missing for {missing_count} groups"
        )
    return rulings


def _screen_acquisition_inputs(
    *,
    inventory_path: Path,
    policy_path: Path,
    quarantine_path: Path,
    parent_version_path: Path,
    parent_raw_root: Path,
    diagnostic_raw_root: Path,
    acquired_raw_root: Path,
    acquired_labels_root: Path,
    rulings_path: Path | None,
    require_rulings: bool,
) -> _AcquisitionScreen:
    policy = parse_acquisition_policy(read_json(policy_path))
    _require_canonical_document(
        policy_path, _policy_to_json(policy), "acquisition policy"
    )
    quarantine = parse_quarantine(read_json(quarantine_path))
    _require_canonical_document(
        quarantine_path, _quarantine_to_json(quarantine), "quarantine"
    )
    inventory = parse_capture_inventory(read_json(inventory_path), policy)
    _require_canonical_document(
        inventory_path, _capture_inventory_to_json(inventory), "capture inventory"
    )
    if quarantine.parent_dataset_version_sha256 != sha256_file(parent_version_path):
        raise StageInvalidError("quarantine parent dataset digest mismatch")
    if (
        policy.diagnostic_inventory_sha256
        != quarantine.diagnostic_inventory_sha256
        or policy.diagnostic_batch_commitment
        != quarantine.diagnostic_batch_commitment
    ):
        raise StageInvalidError("policy/quarantine diagnostic commitment mismatch")
    parent_batch_ids = _load_parent_batch_ids(parent_version_path)
    parent_set = set(parent_batch_ids)
    diagnostic_set = set(quarantine.diagnostic_batch_ids)
    if not set(quarantine.parent_final_batch_ids).issubset(parent_set):
        raise StageInvalidError("parent-final quarantine is outside parent dataset")
    if parent_set.intersection(diagnostic_set):
        raise StageInvalidError("parent and diagnostic identities overlap")

    auto_rejected_by_reason: Counter[str] = Counter()
    auto_rejected_by_reason["parent-duplicate-batch-group"] = 0
    auto_rejected_by_reason["diagnostic-duplicate-batch-group"] = 0
    invalid_batch_ids: set[str] = set()
    incomplete_label_count = 0
    valid_records: list[CaptureRecord] = []
    acquired_evidence: list[BatchEvidence] = []
    evidence_by_batch_id: dict[str, BatchEvidence] = {}
    for record in inventory.records:
        if record.batch_id in parent_set:
            auto_rejected_by_reason["parent-batch-id"] += 1
            invalid_batch_ids.add(record.batch_id)
            continue
        if record.batch_id in diagnostic_set:
            auto_rejected_by_reason["diagnostic-batch-id"] += 1
            invalid_batch_ids.add(record.batch_id)
            continue
        batch_root = Path(acquired_raw_root) / record.batch_id
        manifest_path = batch_root / "manifest.json"
        label_path = Path(acquired_labels_root) / f"{record.batch_id}.json"
        if not manifest_path.is_file():
            auto_rejected_by_reason["missing-manifest"] += 1
            invalid_batch_ids.add(record.batch_id)
            continue
        if sha256_file(manifest_path) != record.manifest_sha256:
            auto_rejected_by_reason["manifest-digest-mismatch"] += 1
            invalid_batch_ids.add(record.batch_id)
            continue
        try:
            manifest = load_manifest(manifest_path)
            validate_batch(batch_root, manifest)
        except (OSError, ManifestError, ValueError):
            auto_rejected_by_reason["invalid-batch"] += 1
            invalid_batch_ids.add(record.batch_id)
            continue
        if (
            manifest.batch_id != record.batch_id
            or manifest.captured_at != record.captured_at
            or manifest.map != inventory.requested.map
            or manifest.area != inventory.requested.area
        ):
            auto_rejected_by_reason["capture-manifest-mismatch"] += 1
            invalid_batch_ids.add(record.batch_id)
            continue
        if not _is_complete_label(manifest, label_path, record.batch_id):
            incomplete_label_count += 1
            continue
        try:
            evidence = load_batch_evidence(
                "acquired", record.batch_id, acquired_raw_root
            )
        except (OSError, ManifestError, ValueError):
            auto_rejected_by_reason["invalid-batch"] += 1
            invalid_batch_ids.add(record.batch_id)
            continue
        valid_records.append(record)
        acquired_evidence.append(evidence)
        evidence_by_batch_id[record.batch_id] = evidence
    if incomplete_label_count:
        raise StageBlockedError(
            f"reviewer labels are incomplete for {incomplete_label_count} captured batches"
        )

    parent_evidence = _load_evidence_corpus(
        "parent", parent_batch_ids, parent_raw_root, "parent"
    )
    diagnostic_evidence = _load_evidence_corpus(
        "diagnostic",
        quarantine.diagnostic_batch_ids,
        diagnostic_raw_root,
        "diagnostic",
    )
    groups = build_duplicate_groups(
        (*parent_evidence, *diagnostic_evidence, *acquired_evidence)
    )
    group_id_by_batch_id: dict[str, str] = {}
    acquired_only_multi_groups: dict[str, tuple[str, ...]] = {}
    group_rejected_batch_ids: set[str] = set()
    for group in groups:
        parent_members = tuple(
            member for member in group.members if member.owner == "parent"
        )
        diagnostic_members = tuple(
            member for member in group.members if member.owner == "diagnostic"
        )
        acquired_members = tuple(
            member for member in group.members if member.owner == "acquired"
        )
        if not acquired_members:
            continue
        acquired_member_ids = tuple(
            sorted(member.batch_id for member in acquired_members)
        )
        for batch_id in acquired_member_ids:
            if batch_id in group_id_by_batch_id:
                raise StageInvalidError("acquired batch belongs to multiple duplicate groups")
            group_id_by_batch_id[batch_id] = group.group_id
        touches_excluded_corpus = False
        if parent_members:
            auto_rejected_by_reason["parent-duplicate-batch-group"] += len(
                acquired_member_ids
            )
            touches_excluded_corpus = True
        if diagnostic_members:
            auto_rejected_by_reason["diagnostic-duplicate-batch-group"] += len(
                acquired_member_ids
            )
            touches_excluded_corpus = True
        if touches_excluded_corpus:
            group_rejected_batch_ids.update(acquired_member_ids)
        elif len(acquired_member_ids) > 1:
            acquired_only_multi_groups[group.group_id] = acquired_member_ids
    if set(evidence_by_batch_id) != set(group_id_by_batch_id):
        raise StageInvalidError("acquired duplicate-group coverage mismatch")

    rulings = _load_screen_rulings(
        rulings_path,
        acquired_only_multi_groups,
        policy,
        require_rulings=require_rulings,
    )
    manual_rejected_batch_ids = {
        batch_id
        for group_id, member_ids in acquired_only_multi_groups.items()
        if group_id in rulings and rulings[group_id].decision == "reject-acquired"
        for batch_id in member_ids
    }
    return _AcquisitionScreen(
        policy=policy,
        quarantine=quarantine,
        inventory=inventory,
        valid_records=tuple(valid_records),
        evidence_by_batch_id=evidence_by_batch_id,
        group_id_by_batch_id=group_id_by_batch_id,
        acquired_only_multi_groups=dict(sorted(acquired_only_multi_groups.items())),
        auto_rejected_by_reason=dict(sorted(auto_rejected_by_reason.items())),
        auto_rejected_batch_ids=frozenset(
            invalid_batch_ids | group_rejected_batch_ids
        ),
        manual_rejected_batch_ids=frozenset(manual_rejected_batch_ids),
    )


def _ratio_is_greater(
    numerator: int,
    denominator: int,
    best_numerator: int,
    best_denominator: int,
) -> bool:
    return numerator * best_denominator > best_numerator * denominator


def _percentage_text(numerator: int, denominator: int) -> str:
    percentage = Fraction(numerator, denominator) * 100
    if percentage.denominator == 1:
        return f"{percentage.numerator}%"
    return f"{float(percentage):.6g}%"


def diagnostic_summary(
    *,
    parent_version_path: Path,
    parent_raw_root: Path,
    diagnostic_inventory_path: Path,
    diagnostic_raw_root: Path,
) -> dict[str, object]:
    parent_batch_ids = _load_parent_batch_ids(parent_version_path)
    legacy_inventory, _ = _load_committed_legacy_inventory(
        diagnostic_inventory_path
    )
    parent_evidence = _load_evidence_corpus(
        "parent", parent_batch_ids, parent_raw_root, "parent"
    )
    diagnostic_evidence = _load_evidence_corpus(
        "diagnostic",
        tuple(record.batch_id for record in legacy_inventory.records),
        diagnostic_raw_root,
        "diagnostic",
    )
    parent_batch_edge_count = 0
    maximum_reference_match_count = 0
    best_reference = (0, 1)
    best_query = (0, 1)
    best_combined = (0, 1)
    for diagnostic_batch in diagnostic_evidence:
        for parent_batch in parent_evidence:
            comparison = compare_batches(diagnostic_batch, parent_batch)
            parent_batch_edge_count += int(comparison.is_duplicate)
            maximum_reference_match_count = max(
                maximum_reference_match_count,
                comparison.reference_matches,
            )
            reference_denominator = max(
                len(diagnostic_batch.references), len(parent_batch.references)
            )
            query_denominator = max(
                len(diagnostic_batch.queries), len(parent_batch.queries)
            )
            combined_numerator = (
                comparison.reference_matches + comparison.query_matches
            )
            combined_denominator = reference_denominator + query_denominator
            if _ratio_is_greater(
                comparison.reference_matches,
                reference_denominator,
                *best_reference,
            ):
                best_reference = (
                    comparison.reference_matches,
                    reference_denominator,
                )
            if _ratio_is_greater(
                comparison.query_matches,
                query_denominator,
                *best_query,
            ):
                best_query = (comparison.query_matches, query_denominator)
            if _ratio_is_greater(
                combined_numerator,
                combined_denominator,
                *best_combined,
            ):
                best_combined = (combined_numerator, combined_denominator)
    diagnostic_multi_batch_group_count = sum(
        len(group.members) > 1
        for group in build_duplicate_groups(diagnostic_evidence)
    )
    return {
        "parentBatchEdgeCount": parent_batch_edge_count,
        "diagnosticMultiBatchGroupCount": diagnostic_multi_batch_group_count,
        "maximumReferenceMatchCount": maximum_reference_match_count,
        "maximumReferenceMatchRatio": f"{best_reference[0]}/{best_reference[1]}",
        "maximumQueryMatchRatio": _percentage_text(*best_query),
        "maximumCombinedMatchRatio": _percentage_text(*best_combined),
    }


def screen_acquisition(
    *,
    inventory_path: Path,
    policy_path: Path,
    quarantine_path: Path,
    parent_version_path: Path,
    parent_raw_root: Path,
    diagnostic_raw_root: Path,
    acquired_raw_root: Path,
    acquired_labels_root: Path,
    rulings_path: Path | None = None,
) -> dict[str, object]:
    screen = _screen_acquisition_inputs(
        inventory_path=inventory_path,
        policy_path=policy_path,
        quarantine_path=quarantine_path,
        parent_version_path=parent_version_path,
        parent_raw_root=parent_raw_root,
        diagnostic_raw_root=diagnostic_raw_root,
        acquired_raw_root=acquired_raw_root,
        acquired_labels_root=acquired_labels_root,
        rulings_path=rulings_path,
        require_rulings=rulings_path is not None,
    )
    if screen.manual_rejected_batch_ids:
        raise StageBlockedError(
            "NO_DATASET: approved duplicate rejection reduces eligible count"
        )
    return {
        "cycleId": CYCLE_ID,
        "detectorSha256": screen.policy.detector_sha256,
        "detectorImplementationSha256": (
            screen.policy.detector_implementation_sha256
        ),
        "totalAcquiredCount": len(screen.inventory.records),
        "autoRejectedByReason": dict(screen.auto_rejected_by_reason),
        "acquiredOnlyMultiBatchGroups": [
            {"groupId": group_id, "memberCount": len(member_ids)}
            for group_id, member_ids in screen.acquired_only_multi_groups.items()
        ],
    }


def _parse_ruling_decisions(
    values: Sequence[str],
) -> Mapping[str, Literal["reject-acquired", "allow-batch-group"]]:
    decisions: dict[str, Literal["reject-acquired", "allow-batch-group"]] = {}
    for value in values:
        if not isinstance(value, str) or value.strip() != value or value.count("=") != 1:
            raise StageInvalidError(
                "decision must be literal groupId=reject-acquired or groupId=allow-batch-group"
            )
        group_id, decision = value.split("=", 1)
        normalized_group_id = _sha256(group_id, "decision groupId")
        if decision not in {"reject-acquired", "allow-batch-group"}:
            raise StageInvalidError("decision value is not approved")
        if normalized_group_id in decisions:
            raise StageInvalidError("decision groupId is repeated")
        decisions[normalized_group_id] = decision
    return decisions


def publish_rulings(
    *,
    inventory_path: Path,
    policy_path: Path,
    quarantine_path: Path,
    parent_version_path: Path,
    parent_raw_root: Path,
    diagnostic_raw_root: Path,
    acquired_raw_root: Path,
    acquired_labels_root: Path,
    decisions: Sequence[str],
    approval_evidence: str,
    output_path: Path,
    now: datetime | None = None,
) -> DuplicateRulingDocument:
    screen = _screen_acquisition_inputs(
        inventory_path=inventory_path,
        policy_path=policy_path,
        quarantine_path=quarantine_path,
        parent_version_path=parent_version_path,
        parent_raw_root=parent_raw_root,
        diagnostic_raw_root=diagnostic_raw_root,
        acquired_raw_root=acquired_raw_root,
        acquired_labels_root=acquired_labels_root,
        rulings_path=None,
        require_rulings=False,
    )
    if sum(screen.auto_rejected_by_reason.values()):
        raise StageBlockedError(
            "NO_DATASET: automatic exclusions reduce eligible count"
        )
    parsed_decisions = _parse_ruling_decisions(decisions)
    required_ids = set(screen.acquired_only_multi_groups)
    extra_count = len(set(parsed_decisions) - required_ids)
    if extra_count:
        raise StageInvalidError(
            f"ruling decisions contain {extra_count} stale or forbidden groups"
        )
    missing_count = len(required_ids - set(parsed_decisions))
    if missing_count:
        raise StageBlockedError(
            f"ruling decisions missing for {missing_count} acquired-only groups"
        )
    approved_at = now or datetime.now(timezone.utc)
    if approved_at.tzinfo is None or approved_at.utcoffset() != timedelta(0):
        raise StageInvalidError("ruling approval time must be UTC")
    if approved_at.astimezone(timezone.utc) < _utc_instant(
        screen.policy.activated_at, "policy.activatedAt"
    ):
        raise StageInvalidError("ruling approval predates policy activation")
    document = DuplicateRulingDocument(
        schema_version=2,
        cycle_id=CYCLE_ID,
        detector_sha256=screen.policy.detector_sha256,
        detector_implementation_sha256=(
            screen.policy.detector_implementation_sha256
        ),
        approved_by="hieunt",
        approved_at=approved_at.astimezone(timezone.utc).isoformat().replace(
            "+00:00", "Z"
        ),
        approval_evidence=_text(approval_evidence, "approvalEvidence"),
        groups=tuple(
            DuplicateRuling(group_id=group_id, decision=parsed_decisions[group_id])
            for group_id in sorted(parsed_decisions)
        ),
    )
    parsed_document = parse_duplicate_rulings(_ruling_document_to_json(document))
    publish_no_replace(output_path, _ruling_document_to_json(parsed_document))
    return parsed_document


publish_duplicate_rulings = publish_rulings


def _acquisition_batch_to_json(batch: AcquisitionBatch) -> dict[str, object]:
    return {
        "batchId": batch.batch_id,
        "captureTimestamp": batch.capture_timestamp,
        "manifestSha256": batch.manifest_sha256,
        "labelSha256": batch.label_sha256,
        "imageSha256": list(batch.image_sha256),
        "duplicateGroupIds": list(batch.duplicate_group_ids),
        "acquisitionPolicySha256": batch.acquisition_policy_sha256,
    }


def parse_acquisition_manifest(value: object) -> AcquisitionManifest:
    document = _exact_mapping(value, _ACQUISITION_KEYS, "acquisition manifest")
    if (
        _strict_int(document["schemaVersion"], "schemaVersion", minimum=2) != 2
        or document["cycleId"] != CYCLE_ID
        or document["parentDatasetId"] != PARENT_DATASET_ID
    ):
        raise StageInvalidError("acquisition identity mismatch")
    detector = _exact_mapping(
        document["detector"],
        frozenset({"descriptor", "sha256", "implementationSha256"}),
        "detector",
    )
    implementation_sha256 = detector_implementation_sha256()
    if (
        detector["descriptor"] != DETECTOR_DESCRIPTOR
        or detector["sha256"] != detector_identity()
        or detector["implementationSha256"] != implementation_sha256
    ):
        raise StageInvalidError("acquisition detector identity mismatch")
    rejected_raw = document["rejectedByReason"]
    if not isinstance(rejected_raw, Mapping):
        raise StageInvalidError("rejectedByReason must be an object")
    rejected: dict[str, int] = {}
    for key, count in rejected_raw.items():
        rejected[_safe_id(key, "rejection reason")] = _strict_int(
            count, f"rejectedByReason.{key}"
        )
    batches_raw = document["batches"]
    if not isinstance(batches_raw, list):
        raise StageInvalidError("acquisition batches must be a list")
    batches: list[AcquisitionBatch] = []
    seen: set[str] = set()
    policy_sha = _sha256(document["acquisitionPolicySha256"], "acquisitionPolicySha256")
    for index, raw in enumerate(batches_raw):
        item = _exact_mapping(raw, _ACQUISITION_BATCH_KEYS, f"acquisition batch {index}")
        batch_id = _safe_id(item["batchId"], f"acquisition batch {index}.batchId")
        if batch_id in seen:
            raise StageInvalidError("acquisition contains a duplicate batch id")
        seen.add(batch_id)
        image_values = item["imageSha256"]
        group_values = item["duplicateGroupIds"]
        if not isinstance(image_values, list) or not isinstance(group_values, list):
            raise StageInvalidError("acquisition image/group fields must be lists")
        image_sha = tuple(_sha256(value, "imageSha256") for value in image_values)
        group_ids = tuple(_sha256(value, "duplicateGroupIds") for value in group_values)
        if image_sha != tuple(sorted(image_sha)) or len(image_sha) < 7:
            raise StageInvalidError("acquisition image hashes must be sorted and complete")
        if len(group_ids) != 1:
            raise StageInvalidError("each acquisition batch must have one duplicate group")
        if item["acquisitionPolicySha256"] != policy_sha:
            raise StageInvalidError("acquisition batch policy digest mismatch")
        batches.append(
            AcquisitionBatch(
                batch_id=batch_id,
                capture_timestamp=_utc(
                    item["captureTimestamp"], f"acquisition batch {index}.captureTimestamp"
                ),
                manifest_sha256=_sha256(
                    item["manifestSha256"], f"acquisition batch {index}.manifestSha256"
                ),
                label_sha256=_sha256(
                    item["labelSha256"], f"acquisition batch {index}.labelSha256"
                ),
                image_sha256=image_sha,
                duplicate_group_ids=group_ids,
                acquisition_policy_sha256=policy_sha,
            )
        )
    if batches != sorted(
        batches,
        key=lambda item: (
            _utc_instant(item.capture_timestamp, "acquisition captureTimestamp"),
            item.batch_id,
        ),
    ):
        raise StageInvalidError("acquisition batches must remain chronological")
    eligible_batch_count = _strict_int(
        document["eligibleBatchCount"], "eligibleBatchCount", minimum=1
    )
    if eligible_batch_count != len(batches) or len(batches) != TARGET_ELIGIBLE_BATCH_COUNT:
        raise StageInvalidError("acquisition must contain exactly 90 eligible batches")
    return AcquisitionManifest(
        schema_version=2,
        cycle_id=CYCLE_ID,
        parent_dataset_id=PARENT_DATASET_ID,
        acquisition_policy_sha256=policy_sha,
        quarantine_sha256=_sha256(document["quarantineSha256"], "quarantineSha256"),
        detector_sha256=detector_identity(),
        detector_implementation_sha256=implementation_sha256,
        rejected_by_reason=dict(sorted(rejected.items())),
        batches=tuple(batches),
    )


def publish_acquisition(
    *,
    inventory_path: Path,
    policy_path: Path,
    quarantine_path: Path,
    parent_version_path: Path,
    parent_raw_root: Path,
    diagnostic_raw_root: Path,
    acquired_raw_root: Path,
    acquired_labels_root: Path,
    rulings_path: Path | None,
    output_path: Path,
) -> AcquisitionManifest:
    screen = _screen_acquisition_inputs(
        inventory_path=inventory_path,
        policy_path=policy_path,
        quarantine_path=quarantine_path,
        parent_version_path=parent_version_path,
        parent_raw_root=parent_raw_root,
        diagnostic_raw_root=diagnostic_raw_root,
        acquired_raw_root=acquired_raw_root,
        acquired_labels_root=acquired_labels_root,
        rulings_path=rulings_path,
        require_rulings=True,
    )
    rejected_by_reason = Counter(screen.auto_rejected_by_reason)
    if screen.manual_rejected_batch_ids:
        rejected_by_reason["manual-duplicate-rejection"] += len(
            screen.manual_rejected_batch_ids
        )
    policy_sha256 = sha256_file(policy_path)
    selected: list[AcquisitionBatch] = []
    for record in screen.valid_records:
        if (
            record.batch_id in screen.auto_rejected_batch_ids
            or record.batch_id in screen.manual_rejected_batch_ids
        ):
            continue
        evidence = screen.evidence_by_batch_id[record.batch_id]
        image_sha256 = tuple(
            sorted(
                image.sha256
                for image in (*evidence.references, *evidence.queries)
            )
        )
        selected.append(
            AcquisitionBatch(
                batch_id=record.batch_id,
                capture_timestamp=record.captured_at,
                manifest_sha256=record.manifest_sha256,
                label_sha256=sha256_file(
                    Path(acquired_labels_root) / f"{record.batch_id}.json"
                ),
                image_sha256=image_sha256,
                duplicate_group_ids=(
                    screen.group_id_by_batch_id[record.batch_id],
                ),
                acquisition_policy_sha256=policy_sha256,
            )
        )
        if len(selected) == TARGET_ELIGIBLE_BATCH_COUNT:
            break
    if len(selected) != TARGET_ELIGIBLE_BATCH_COUNT:
        raise StageBlockedError(
            f"NO_DATASET: expected 90 eligible batches, got {len(selected)}"
        )
    document: dict[str, object] = {
        "schemaVersion": 2,
        "cycleId": CYCLE_ID,
        "parentDatasetId": PARENT_DATASET_ID,
        "acquisitionPolicySha256": policy_sha256,
        "quarantineSha256": sha256_file(quarantine_path),
        "detector": {
            "descriptor": DETECTOR_DESCRIPTOR,
            "sha256": screen.policy.detector_sha256,
            "implementationSha256": (
                screen.policy.detector_implementation_sha256
            ),
        },
        "eligibleBatchCount": len(selected),
        "rejectedByReason": dict(sorted(rejected_by_reason.items())),
        "batches": [_acquisition_batch_to_json(batch) for batch in selected],
    }
    manifest = parse_acquisition_manifest(document)
    if set(screen.quarantine.batch_ids).intersection(
        batch.batch_id for batch in manifest.batches
    ):
        raise StageInvalidError("quarantined batch entered acquisition")
    publish_no_replace(Path(output_path), document)
    return manifest


def _allocation_units(
    batches: Sequence[AcquisitionBatch],
) -> tuple[tuple[str, tuple[str, ...]], ...]:
    batch_union = _UnionFind.create(len(batches))
    first_by_group: dict[str, int] = {}
    for index, batch in enumerate(batches):
        for group_id in batch.duplicate_group_ids:
            previous = first_by_group.setdefault(group_id, index)
            if previous != index:
                batch_union.union(previous, index)
    members: dict[int, list[str]] = defaultdict(list)
    groups: dict[int, set[str]] = defaultdict(set)
    for index, batch in enumerate(batches):
        root = batch_union.find(index)
        members[root].append(batch.batch_id)
        groups[root].update(batch.duplicate_group_ids)
    units: list[tuple[str, tuple[str, ...]]] = []
    for root, batch_ids in members.items():
        unit_ids = tuple(sorted(batch_ids))
        payload = [*sorted(groups[root]), *unit_ids]
        unit_id = hashlib.sha256(("\n".join(payload) + "\n").encode()).hexdigest()
        units.append((unit_id, unit_ids))
    units.sort(
        key=lambda item: (
            hashlib.sha256(f"{ALLOCATION_SEED}|{item[0]}".encode()).hexdigest(),
            item[0],
        )
    )
    return tuple(units)


def _solve_allocation(
    units: Sequence[tuple[str, tuple[str, ...]]],
) -> Mapping[str, tuple[str, ...]] | None:
    memo: set[tuple[int, int, int, int]] = set()

    def visit(
        index: int,
        train_count: int,
        dev_count: int,
        final_count: int,
    ) -> tuple[str, ...] | None:
        state = (index, train_count, dev_count, final_count)
        if state in memo:
            return None
        if index == len(units):
            if (train_count, dev_count, final_count) == (
                TRAIN_ACQUIRED_COUNT,
                DEV_ACQUIRED_COUNT,
                FINAL_ACQUIRED_COUNT,
            ):
                return ()
            memo.add(state)
            return None
        size = len(units[index][1])
        options = (
            ("train", train_count + size, dev_count, final_count),
            ("dev", train_count, dev_count + size, final_count),
            ("final", train_count, dev_count, final_count + size),
        )
        for role, next_train, next_dev, next_final in options:
            if (
                next_train > TRAIN_ACQUIRED_COUNT
                or next_dev > DEV_ACQUIRED_COUNT
                or next_final > FINAL_ACQUIRED_COUNT
            ):
                continue
            suffix = visit(index + 1, next_train, next_dev, next_final)
            if suffix is not None:
                return (role, *suffix)
        memo.add(state)
        return None

    vector = visit(0, 0, 0, 0)
    if vector is None:
        return None
    roles: dict[str, list[str]] = {"train": [], "dev": [], "final": []}
    for role, (_, batch_ids) in zip(vector, units, strict=True):
        roles[role].extend(batch_ids)
    return {role: tuple(sorted(ids)) for role, ids in roles.items()}


def parse_allocation_manifest(value: object) -> AllocationManifest:
    document = _exact_mapping(value, _ALLOCATION_KEYS, "allocation")
    if (
        _strict_int(document["schemaVersion"], "schemaVersion", minimum=2) != 2
        or document["cycleId"] != CYCLE_ID
        or document["datasetId"] != DATASET_ID
        or document["parentDatasetId"] != PARENT_DATASET_ID
        or document["seed"] != ALLOCATION_SEED
    ):
        raise StageInvalidError("allocation identity mismatch")
    detector = _exact_mapping(
        document["detector"],
        frozenset({"descriptor", "sha256", "implementationSha256"}),
        "detector",
    )
    implementation_sha256 = detector_implementation_sha256()
    if (
        detector["descriptor"] != DETECTOR_DESCRIPTOR
        or detector["sha256"] != detector_identity()
        or detector["implementationSha256"] != implementation_sha256
    ):
        raise StageInvalidError("allocation detector identity mismatch")
    acquired = _exact_mapping(document["acquired"], frozenset({"train", "dev"}), "acquired")
    train_values = acquired["train"]
    dev_values = acquired["dev"]
    if not isinstance(train_values, list) or not isinstance(dev_values, list):
        raise StageInvalidError("acquired train/dev must be lists")
    acquired_train = _sorted_unique_ids(train_values, "acquired.train")
    acquired_dev = _sorted_unique_ids(dev_values, "acquired.dev")
    final = _exact_mapping(
        document["final"], frozenset({"count", "sha256", "sizeBytes"}), "final"
    )
    counts = _exact_mapping(
        document["counts"],
        frozenset(
            {
                "parentTrain",
                "parentDev",
                "acquiredTrain",
                "acquiredDev",
                "acquiredFinal",
                "train",
                "dev",
                "final",
                "total",
            }
        ),
        "counts",
    )
    expected_counts = {
        "parentTrain": PARENT_TRAIN_COUNT,
        "parentDev": PARENT_DEV_COUNT,
        "acquiredTrain": TRAIN_ACQUIRED_COUNT,
        "acquiredDev": DEV_ACQUIRED_COUNT,
        "acquiredFinal": FINAL_ACQUIRED_COUNT,
        "train": PARENT_TRAIN_COUNT + TRAIN_ACQUIRED_COUNT,
        "dev": PARENT_DEV_COUNT + DEV_ACQUIRED_COUNT,
        "final": FINAL_ACQUIRED_COUNT,
        "total": 260,
    }
    if dict(counts) != expected_counts:
        raise StageInvalidError("allocation counts mismatch")
    if len(acquired_train) != TRAIN_ACQUIRED_COUNT or len(acquired_dev) != DEV_ACQUIRED_COUNT:
        raise StageInvalidError("acquired public role counts mismatch")
    if set(acquired_train).intersection(acquired_dev):
        raise StageInvalidError("acquired train/dev overlap")
    splits = _exact_mapping(
        document["splits"], frozenset({"train", "dev", "final"}), "splits"
    )
    final_commitment = SplitCommitment(
        _strict_int(final["count"], "final.count", minimum=1),
        _sha256(final["sha256"], "final.sha256"),
    )
    train_commitment = _parse_split_commitment(splits["train"], "splits.train")
    dev_commitment = _parse_split_commitment(splits["dev"], "splits.dev")
    split_final_commitment = _parse_split_commitment(
        splits["final"], "splits.final"
    )
    source_commitment = _parse_source_commitment(
        document["sourceCommitment"], "sourceCommitment"
    )
    if (
        train_commitment.count != 185
        or dev_commitment.count != 45
        or final_commitment.count != FINAL_ACQUIRED_COUNT
        or split_final_commitment != final_commitment
        or source_commitment.count != 260
    ):
        raise StageInvalidError("allocation commitment counts mismatch")
    return AllocationManifest(
        schema_version=2,
        cycle_id=CYCLE_ID,
        dataset_id=DATASET_ID,
        parent_dataset_id=PARENT_DATASET_ID,
        seed=ALLOCATION_SEED,
        acquisition_sha256=_sha256(document["acquisitionSha256"], "acquisitionSha256"),
        quarantine_sha256=_sha256(document["quarantineSha256"], "quarantineSha256"),
        detector_sha256=detector_identity(),
        detector_implementation_sha256=implementation_sha256,
        acquired_train_ids=acquired_train,
        acquired_dev_ids=acquired_dev,
        final_commitment=final_commitment,
        final_size_bytes=_strict_int(final["sizeBytes"], "final.sizeBytes", minimum=1),
        train_commitment=train_commitment,
        dev_commitment=dev_commitment,
        source_commitment=source_commitment,
    )


def _dataset_version_v2_document(
    *,
    created_at: str,
    source_commitment: SourceCommitment,
    parent_version_sha256: str,
    policy_sha256: str,
    quarantine_sha256: str,
    acquisition_sha256: str,
    allocation_sha256: str,
    train_commitment: SplitCommitment,
    dev_commitment: SplitCommitment,
    final_commitment: SplitCommitment,
) -> dict[str, object]:
    return {
        "schemaVersion": 2,
        "datasetId": DATASET_ID,
        "parentDatasetId": PARENT_DATASET_ID,
        "createdAt": created_at,
        "sourceCommitment": {
            "count": source_commitment.count,
            "sha256": source_commitment.sha256,
        },
        "lineage": {
            "parentDatasetVersionSha256": parent_version_sha256,
            "acquisitionPolicySha256": policy_sha256,
            "quarantineSha256": quarantine_sha256,
            "acquisitionSha256": acquisition_sha256,
            "allocationSha256": allocation_sha256,
        },
        "splits": {
            "train": {"count": train_commitment.count, "sha256": train_commitment.sha256},
            "dev": {"count": dev_commitment.count, "sha256": dev_commitment.sha256},
            "final": {"count": final_commitment.count, "sha256": final_commitment.sha256},
        },
    }


def _dataset_created_at_for_publication(path: Path) -> str:
    path = Path(path)
    try:
        metadata = os.lstat(path)
    except FileNotFoundError:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1:
        raise StageInvalidError("existing dataset version must be a single-link regular file")
    document = _exact_mapping(
        read_json(path),
        frozenset(
            {
                "schemaVersion",
                "datasetId",
                "parentDatasetId",
                "createdAt",
                "sourceCommitment",
                "lineage",
                "splits",
            }
        ),
        "existing dataset version",
    )
    return _utc(document["createdAt"], "existing dataset version.createdAt")


def publish_allocation(
    *,
    acquisition_path: Path,
    quarantine_path: Path,
    policy_path: Path,
    parent_version_path: Path,
    parent_train_path: Path,
    parent_dev_path: Path,
    cycle_root: Path,
    check_only: bool = False,
) -> AllocationManifest:
    acquisition_document = read_json(acquisition_path)
    acquisition = parse_acquisition_manifest(acquisition_document)
    _require_canonical_document(
        acquisition_path, acquisition_document, "acquisition manifest"
    )
    quarantine = parse_quarantine(read_json(quarantine_path))
    _require_canonical_document(
        quarantine_path, _quarantine_to_json(quarantine), "quarantine"
    )
    policy = parse_acquisition_policy(read_json(policy_path))
    _require_canonical_document(
        policy_path, _policy_to_json(policy), "acquisition policy"
    )
    if acquisition.acquisition_policy_sha256 != sha256_file(policy_path):
        raise StageInvalidError("acquisition policy digest mismatch")
    if acquisition.quarantine_sha256 != sha256_file(quarantine_path):
        raise StageInvalidError("acquisition quarantine digest mismatch")
    if (
        acquisition.detector_sha256 != policy.detector_sha256
        or acquisition.detector_implementation_sha256
        != policy.detector_implementation_sha256
    ):
        raise StageInvalidError("acquisition detector lineage mismatch")
    if quarantine.parent_dataset_version_sha256 != sha256_file(parent_version_path):
        raise StageInvalidError("parent dataset digest mismatch")
    parent_train = _read_ids(
        parent_train_path, expected_count=PARENT_TRAIN_COUNT, require_sorted=False
    )
    parent_dev = _read_ids(
        parent_dev_path, expected_count=PARENT_DEV_COUNT, require_sorted=False
    )
    if set(parent_train).intersection(parent_dev):
        raise StageInvalidError("parent train/dev overlap")
    if set(quarantine.batch_ids).intersection((*parent_train, *parent_dev)):
        raise StageInvalidError("quarantine overlaps reusable parent train/dev")
    acquired_ids = {batch.batch_id for batch in acquisition.batches}
    if acquired_ids.intersection((*parent_train, *parent_dev, *quarantine.batch_ids)):
        raise StageInvalidError("acquired ids overlap parent or quarantine")
    units = _allocation_units(acquisition.batches)
    roles = _solve_allocation(units)
    if roles is None:
        raise StageBlockedError("NO_DATASET: duplicate groups cannot satisfy 45/15/30")
    acquired_train = roles["train"]
    acquired_dev = roles["dev"]
    acquired_final = roles["final"]
    train_ids = tuple(sorted((*parent_train, *acquired_train)))
    dev_ids = tuple(sorted((*parent_dev, *acquired_dev)))
    final_ids = tuple(sorted(acquired_final))
    if (len(train_ids), len(dev_ids), len(final_ids)) != (185, 45, 30):
        raise StageInvalidError("successor split counts mismatch")
    train_bytes = _ids_bytes(train_ids)
    dev_bytes = _ids_bytes(dev_ids)
    final_bytes = _ids_bytes(final_ids)
    train_commitment = SplitCommitment(185, hashlib.sha256(train_bytes).hexdigest())
    dev_commitment = SplitCommitment(45, hashlib.sha256(dev_bytes).hexdigest())
    final_commitment = SplitCommitment(30, hashlib.sha256(final_bytes).hexdigest())
    source_commitment = commit_ids((*train_ids, *dev_ids, *final_ids))
    allocation_document: dict[str, object] = {
        "schemaVersion": 2,
        "cycleId": CYCLE_ID,
        "datasetId": DATASET_ID,
        "parentDatasetId": PARENT_DATASET_ID,
        "seed": ALLOCATION_SEED,
        "acquisitionSha256": sha256_file(acquisition_path),
        "quarantineSha256": sha256_file(quarantine_path),
        "detector": {
            "descriptor": DETECTOR_DESCRIPTOR,
            "sha256": acquisition.detector_sha256,
            "implementationSha256": acquisition.detector_implementation_sha256,
        },
        "acquired": {"train": list(acquired_train), "dev": list(acquired_dev)},
        "final": {
            "count": final_commitment.count,
            "sha256": final_commitment.sha256,
            "sizeBytes": len(final_bytes),
        },
        "counts": {
            "parentTrain": 140,
            "parentDev": 30,
            "acquiredTrain": 45,
            "acquiredDev": 15,
            "acquiredFinal": 30,
            "train": 185,
            "dev": 45,
            "final": 30,
            "total": 260,
        },
        "splits": {
            "train": {"count": 185, "sha256": train_commitment.sha256},
            "dev": {"count": 45, "sha256": dev_commitment.sha256},
            "final": {"count": 30, "sha256": final_commitment.sha256},
        },
        "sourceCommitment": {
            "count": source_commitment.count,
            "sha256": source_commitment.sha256,
        },
    }
    allocation = parse_allocation_manifest(allocation_document)
    if check_only:
        return allocation
    root = Path(cycle_root)
    splits_root = root / "splits"
    allocation_path = root / "allocation.json"
    dataset_path = root / "dataset-version.json"
    created_at = _dataset_created_at_for_publication(dataset_path)
    dataset_document = _dataset_version_v2_document(
        created_at=created_at,
        source_commitment=source_commitment,
        parent_version_sha256=sha256_file(parent_version_path),
        policy_sha256=sha256_file(policy_path),
        quarantine_sha256=sha256_file(quarantine_path),
        acquisition_sha256=sha256_file(acquisition_path),
        allocation_sha256=_document_sha256(allocation_document),
        train_commitment=train_commitment,
        dev_commitment=dev_commitment,
        final_commitment=final_commitment,
    )
    _publish_bytes_no_replace(splits_root / "sealed-final.txt", final_bytes)
    _publish_bytes_no_replace(splits_root / "train.txt", train_bytes)
    _publish_bytes_no_replace(splits_root / "dev.txt", dev_bytes)
    publish_no_replace(allocation_path, allocation_document)
    publish_no_replace(dataset_path, dataset_document)
    integrity = {
        "schemaVersion": 2,
        "cycleId": CYCLE_ID,
        "datasetId": DATASET_ID,
        "sealedFinal": {
            "path": "splits/sealed-final.txt",
            "count": 30,
            "sizeBytes": len(final_bytes),
            "sha256": final_commitment.sha256,
        },
    }
    publish_no_replace(root / "evidence" / "prefinal-integrity.json", integrity)
    return allocation


def _safe_cycle_file(cycle_root: Path, relative_path: str) -> Path:
    root = Path(cycle_root).resolve()
    path = root / relative_path
    resolved_parent = path.parent.resolve()
    if root != resolved_parent and root not in resolved_parent.parents:
        raise StageInvalidError(f"cycle path escapes root: {relative_path}")
    metadata = os.lstat(path)
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1:
        raise StageInvalidError(f"cycle path must be a single-link regular file: {relative_path}")
    return path


def parse_prefinal_integrity(value: object) -> PrefinalIntegrity:
    document = _exact_mapping(value, _PREFINAL_KEYS, "prefinal integrity")
    schema_version = _strict_int(
        document["schemaVersion"], "prefinal schemaVersion", minimum=2
    )
    if (
        schema_version != 2
        or document["cycleId"] != CYCLE_ID
        or document["datasetId"] != DATASET_ID
    ):
        raise StageInvalidError("prefinal integrity identity mismatch")
    sealed_final = _exact_mapping(
        document["sealedFinal"], _SEALED_FINAL_KEYS, "prefinal sealedFinal"
    )
    if sealed_final["path"] != "splits/sealed-final.txt":
        raise StageInvalidError("prefinal sealed-final path mismatch")
    integrity = PrefinalIntegrity(
        schema_version=2,
        final_count=_strict_int(
            sealed_final["count"], "prefinal sealedFinal.count", minimum=1
        ),
        final_size_bytes=_strict_int(
            sealed_final["sizeBytes"], "prefinal sealedFinal.sizeBytes", minimum=1
        ),
        final_sha256=_sha256(
            sealed_final["sha256"], "prefinal sealedFinal.sha256"
        ),
    )
    if integrity.final_count != FINAL_ACQUIRED_COUNT:
        raise StageInvalidError("prefinal sealed-final count mismatch")
    return integrity


def verify_prefinal_integrity(cycle_root: Path) -> PrefinalIntegrity:
    integrity_path = _safe_cycle_file(
        cycle_root, "evidence/prefinal-integrity.json"
    )
    integrity_document = read_json(integrity_path)
    integrity = parse_prefinal_integrity(integrity_document)
    _require_canonical_document(
        integrity_path, integrity_document, "prefinal integrity"
    )
    allocation_path = _safe_cycle_file(cycle_root, "allocation.json")
    allocation_document = read_json(allocation_path)
    allocation = parse_allocation_manifest(allocation_document)
    _require_canonical_document(
        allocation_path, allocation_document, "allocation"
    )
    if (
        allocation.final_commitment.count != integrity.final_count
        or allocation.final_size_bytes != integrity.final_size_bytes
        or allocation.final_commitment.sha256 != integrity.final_sha256
    ):
        raise StageInvalidError("prefinal/allocation commitment mismatch")
    final_path = _safe_cycle_file(cycle_root, "splits/sealed-final.txt")
    metadata = final_path.stat()
    digest = sha256_file(final_path)
    if (
        metadata.st_size != integrity.final_size_bytes
        or digest != integrity.final_sha256
    ):
        raise StageInvalidError("sealed final opaque commitment mismatch")
    return integrity


def load_working_membership(cycle_root: Path) -> WorkingMembership:
    allocation = parse_allocation_manifest(
        read_json(_safe_cycle_file(cycle_root, "allocation.json"))
    )
    train_path = _safe_cycle_file(cycle_root, "splits/train.txt")
    dev_path = _safe_cycle_file(cycle_root, "splits/dev.txt")
    train_ids = _read_ids(train_path, expected_count=185)
    dev_ids = _read_ids(dev_path, expected_count=45)
    if sha256_file(train_path) != allocation.train_commitment.sha256:
        raise StageInvalidError("train split digest mismatch")
    if sha256_file(dev_path) != allocation.dev_commitment.sha256:
        raise StageInvalidError("dev split digest mismatch")
    if set(train_ids).intersection(dev_ids):
        raise StageInvalidError("working train/dev overlap")
    if not set(allocation.acquired_dev_ids).issubset(dev_ids):
        raise StageInvalidError("acquired dev ids are not a subset of dev")
    verify_prefinal_integrity(cycle_root)
    return WorkingMembership(
        dataset_id=allocation.dataset_id,
        train_ids=train_ids,
        dev_ids=dev_ids,
        acquired_dev_ids=allocation.acquired_dev_ids,
        source_commitment=allocation.source_commitment,
    )


def load_final_membership_after_lock(cycle_root: Path, lock_path: Path) -> tuple[str, ...]:
    lock_metadata = os.lstat(lock_path)
    if not stat.S_ISREG(lock_metadata.st_mode) or lock_metadata.st_nlink != 1:
        raise StageInvalidError("final lock must be a single-link regular file")
    integrity = verify_prefinal_integrity(cycle_root)
    final_path = _safe_cycle_file(cycle_root, "splits/sealed-final.txt")
    final_ids = _read_ids(final_path, expected_count=integrity.final_count)
    if sha256_file(final_path) != integrity.final_sha256:
        raise StageInvalidError("sealed final changed during semantic opening")
    working = load_working_membership(cycle_root)
    if set(final_ids).intersection((*working.train_ids, *working.dev_ids)):
        raise StageInvalidError("final overlaps working membership")
    if commit_ids((*working.train_ids, *working.dev_ids, *final_ids)) != working.source_commitment:
        raise StageInvalidError("split union does not match source commitment")
    return final_ids


def verify_cycle_dataset(
    cycle_root: Path,
    mode: Literal["working", "prefinal", "final"],
    lock_path: Path | None = None,
) -> dict[str, object]:
    if mode not in {"working", "prefinal", "final"}:
        raise StageInvalidError("verify mode must be working, prefinal, or final")
    if mode == "prefinal":
        integrity = verify_prefinal_integrity(cycle_root)
        return {
            "schemaVersion": 2,
            "mode": mode,
            "cycleId": CYCLE_ID,
            "datasetId": DATASET_ID,
            "finalCommitmentCount": integrity.final_count,
            "finalSizeBytes": integrity.final_size_bytes,
            "finalSha256": integrity.final_sha256,
        }
    working = load_working_membership(cycle_root)
    result: dict[str, object] = {
        "schemaVersion": 2,
        "mode": mode,
        "cycleId": CYCLE_ID,
        "datasetId": DATASET_ID,
        "trainCount": len(working.train_ids),
        "devCount": len(working.dev_ids),
        "acquiredDevCount": len(working.acquired_dev_ids),
        "sourceCommitmentCount": working.source_commitment.count,
        "sourceCommitmentSha256": working.source_commitment.sha256,
    }
    if mode == "final":
        if lock_path is None:
            raise StageBlockedError("final verification requires --lock")
        result["finalCount"] = len(load_final_membership_after_lock(cycle_root, lock_path))
    return result


def _build_parser() -> argparse.ArgumentParser:
    parser = _CycleArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    policy = sub.add_parser("publish-policy")
    policy.add_argument("--diagnostic-inventory", type=Path, required=True)
    policy.add_argument("--output", type=Path, required=True)

    quarantine = sub.add_parser("publish-quarantine")
    quarantine.add_argument("--parent-version", type=Path, required=True)
    quarantine.add_argument("--parent-final", type=Path, required=True)
    quarantine.add_argument("--diagnostic-inventory", type=Path, required=True)
    quarantine.add_argument("--output", type=Path, required=True)

    diagnostic = sub.add_parser("diagnostic-summary")
    diagnostic.add_argument("--parent-version", type=Path, required=True)
    diagnostic.add_argument("--parent-raw-root", type=Path, required=True)
    diagnostic.add_argument("--diagnostic-inventory", type=Path, required=True)
    diagnostic.add_argument("--diagnostic-raw-root", type=Path, required=True)

    def add_screen_arguments(command: argparse.ArgumentParser) -> None:
        command.add_argument("--inventory", type=Path, required=True)
        command.add_argument("--policy", type=Path, required=True)
        command.add_argument("--quarantine", type=Path, required=True)
        command.add_argument("--parent-version", type=Path, required=True)
        command.add_argument("--parent-raw-root", type=Path, required=True)
        command.add_argument("--diagnostic-raw-root", type=Path, required=True)
        command.add_argument("--acquired-raw-root", type=Path, required=True)
        command.add_argument("--acquired-labels-root", type=Path, required=True)

    screen = sub.add_parser("screen-acquisition")
    add_screen_arguments(screen)
    screen.add_argument("--rulings", type=Path)

    rulings = sub.add_parser("publish-rulings")
    add_screen_arguments(rulings)
    rulings.add_argument("--approval-evidence", required=True)
    rulings.add_argument("--decision", action="append", required=True)
    rulings.add_argument("--output", type=Path, required=True)

    acquisition = sub.add_parser("publish-acquisition")
    add_screen_arguments(acquisition)
    acquisition.add_argument("--rulings", type=Path)
    acquisition.add_argument("--output", type=Path, required=True)

    allocation = sub.add_parser("publish-allocation")
    allocation.add_argument("--acquisition", type=Path, required=True)
    allocation.add_argument("--quarantine", type=Path, required=True)
    allocation.add_argument("--policy", type=Path, required=True)
    allocation.add_argument("--parent-version", type=Path, required=True)
    allocation.add_argument("--parent-train", type=Path, required=True)
    allocation.add_argument("--parent-dev", type=Path, required=True)
    allocation.add_argument("--cycle-root", type=Path, required=True)
    allocation.add_argument("--check", action="store_true")

    verify = sub.add_parser("verify")
    verify.add_argument("--cycle-root", type=Path, required=True)
    verify.add_argument("--mode", choices=("working", "prefinal", "final"), required=True)
    verify.add_argument("--lock", type=Path)
    return parser


def main(argv: list[str] | None = None) -> int:
    try:
        parser = _build_parser()
        args = parser.parse_args(argv)
        if args.command == "publish-policy":
            result: object = _policy_to_json(
                publish_acquisition_policy(
                    args.diagnostic_inventory,
                    args.output,
                )
            )
        elif args.command == "publish-quarantine":
            ledger = publish_quarantine(
                args.parent_version,
                args.parent_final,
                args.diagnostic_inventory,
                args.output,
            )
            result = {
                "schemaVersion": ledger.schema_version,
                "cycleId": ledger.cycle_id,
                "parentFinalBatchCount": len(ledger.parent_final_batch_ids),
                "diagnosticBatchCount": len(ledger.diagnostic_batch_ids),
                "diagnosticBatchCommitment": ledger.diagnostic_batch_commitment,
                "output": str(args.output),
                "sha256": sha256_file(args.output),
            }
        elif args.command == "diagnostic-summary":
            result = diagnostic_summary(
                parent_version_path=args.parent_version,
                parent_raw_root=args.parent_raw_root,
                diagnostic_inventory_path=args.diagnostic_inventory,
                diagnostic_raw_root=args.diagnostic_raw_root,
            )
        elif args.command == "screen-acquisition":
            result = screen_acquisition(
                inventory_path=args.inventory,
                policy_path=args.policy,
                quarantine_path=args.quarantine,
                parent_version_path=args.parent_version,
                parent_raw_root=args.parent_raw_root,
                diagnostic_raw_root=args.diagnostic_raw_root,
                acquired_raw_root=args.acquired_raw_root,
                acquired_labels_root=args.acquired_labels_root,
                rulings_path=args.rulings,
            )
        elif args.command == "publish-rulings":
            ruling_document = publish_rulings(
                inventory_path=args.inventory,
                policy_path=args.policy,
                quarantine_path=args.quarantine,
                parent_version_path=args.parent_version,
                parent_raw_root=args.parent_raw_root,
                diagnostic_raw_root=args.diagnostic_raw_root,
                acquired_raw_root=args.acquired_raw_root,
                acquired_labels_root=args.acquired_labels_root,
                decisions=args.decision,
                approval_evidence=args.approval_evidence,
                output_path=args.output,
            )
            result = {
                "schemaVersion": ruling_document.schema_version,
                "cycleId": ruling_document.cycle_id,
                "detectorSha256": ruling_document.detector_sha256,
                "detectorImplementationSha256": (
                    ruling_document.detector_implementation_sha256
                ),
                "groupCount": len(ruling_document.groups),
                "output": str(args.output),
                "sha256": sha256_file(args.output),
            }
        elif args.command == "publish-acquisition":
            manifest = publish_acquisition(
                inventory_path=args.inventory,
                policy_path=args.policy,
                quarantine_path=args.quarantine,
                parent_version_path=args.parent_version,
                parent_raw_root=args.parent_raw_root,
                diagnostic_raw_root=args.diagnostic_raw_root,
                acquired_raw_root=args.acquired_raw_root,
                acquired_labels_root=args.acquired_labels_root,
                rulings_path=args.rulings,
                output_path=args.output,
            )
            result = {
                "schemaVersion": manifest.schema_version,
                "cycleId": manifest.cycle_id,
                "eligibleBatchCount": len(manifest.batches),
                "rejectedByReason": dict(manifest.rejected_by_reason),
                "output": str(args.output),
                "sha256": sha256_file(args.output),
            }
        elif args.command == "publish-allocation":
            allocation = publish_allocation(
                acquisition_path=args.acquisition,
                quarantine_path=args.quarantine,
                policy_path=args.policy,
                parent_version_path=args.parent_version,
                parent_train_path=args.parent_train,
                parent_dev_path=args.parent_dev,
                cycle_root=args.cycle_root,
                check_only=args.check,
            )
            result = {
                "schemaVersion": allocation.schema_version,
                "cycleId": allocation.cycle_id,
                "datasetId": allocation.dataset_id,
                "acquiredTrainCount": len(allocation.acquired_train_ids),
                "acquiredDevCount": len(allocation.acquired_dev_ids),
                "finalCommitmentCount": allocation.final_commitment.count,
                "sourceCommitmentCount": allocation.source_commitment.count,
                "checkOnly": args.check,
            }
        elif args.command == "verify":
            result = verify_cycle_dataset(args.cycle_root, args.mode, args.lock)
        else:
            raise StageInvalidError("unsupported command")
    except StageBlockedError as error:
        print(
            json.dumps({"status": "BLOCKED", "error": str(error)}, sort_keys=True),
            file=sys.stderr,
        )
        return 4
    except (OSError, ManifestError, StageInvalidError, ValueError) as error:
        print(
            json.dumps({"status": "INVALID", "error": str(error)}, sort_keys=True),
            file=sys.stderr,
        )
        return 2
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    return 0


__all__ = [
    "LEGACY_CYCLE_ID",
    "CYCLE_ID",
    "EXPERIMENT_ID",
    "DATASET_ID",
    "PARENT_DATASET_ID",
    "ALLOCATION_SEED",
    "DIAGNOSTIC_INVENTORY_SHA256",
    "DETECTOR_DESCRIPTOR",
    "StageBlockedError",
    "StageInvalidError",
    "SourceCommitment",
    "SplitCommitment",
    "AcquisitionPolicy",
    "QuarantineLedger",
    "CaptureRecord",
    "LegacyCaptureInventory",
    "CaptureRequest",
    "CaptureSummary",
    "CaptureInventory",
    "DuplicateRuling",
    "DuplicateRulingDocument",
    "AcquisitionBatch",
    "AcquisitionManifest",
    "AllocationManifest",
    "WorkingMembership",
    "PrefinalIntegrity",
    "commit_ids",
    "detector_identity",
    "parse_acquisition_policy",
    "publish_acquisition_policy",
    "parse_quarantine",
    "publish_quarantine",
    "parse_legacy_capture_inventory",
    "parse_capture_inventory",
    "parse_duplicate_rulings",
    "diagnostic_summary",
    "screen_acquisition",
    "publish_rulings",
    "publish_duplicate_rulings",
    "parse_acquisition_manifest",
    "publish_acquisition",
    "parse_allocation_manifest",
    "publish_allocation",
    "parse_prefinal_integrity",
    "verify_prefinal_integrity",
    "load_working_membership",
    "load_final_membership_after_lock",
    "verify_cycle_dataset",
    "main",
]


if __name__ == "__main__":
    raise SystemExit(main())
