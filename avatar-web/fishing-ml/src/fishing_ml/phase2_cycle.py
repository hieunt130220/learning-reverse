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
from pathlib import Path
from typing import Iterable, Literal, Mapping, Sequence

from PIL import Image

from .duplicate_detector import DETECTOR_DESCRIPTOR, detector_descriptor_sha256
from .schema import (
    ManifestError,
    load_label,
    load_manifest,
    publish_no_replace,
    read_json,
    sha256_file,
    validate_batch,
)

CYCLE_ID = "p2cr-20260905-01"
EXPERIMENT_ID = CYCLE_ID
DATASET_ID = "phase2-coverage-recovery-20260905-01"
PARENT_DATASET_ID = "phase2-20260904-01"
ALLOCATION_SEED = "20260905"
TARGET_ELIGIBLE_BATCH_COUNT = 90
TRAIN_ACQUIRED_COUNT = 45
DEV_ACQUIRED_COUNT = 15
FINAL_ACQUIRED_COUNT = 30
PARENT_TRAIN_COUNT = 140
PARENT_DEV_COUNT = 30
PARENT_FINAL_COUNT = 30

_SAFE_ID = re.compile(r"^[^/\\\s]+$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_POLICY_KEYS = frozenset(
    {
        "schemaVersion",
        "cycleId",
        "parentDatasetId",
        "targetEligibleBatchCount",
        "selectionRule",
        "captureMode",
        "requiresCompleteReviewerLabel",
        "forbidsPriorFinalDirectedSampling",
        "oldDatasetExclusion",
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
        "reason",
        "batchIds",
    }
)
_CAPTURE_INVENTORY_KEYS = frozenset(
    {"schemaVersion", "cycleId", "startedAt", "stoppedAt", "records"}
)
_CAPTURE_RECORD_KEYS = frozenset(
    {"batchId", "capturedAt", "manifestSha256"}
)
_RULING_KEYS = frozenset(
    {"schemaVersion", "cycleId", "detectorSha256", "groups"}
)
_RULING_ENTRY_KEYS = frozenset(
    {"groupId", "decision", "approvedBy", "approvedAt", "evidence"}
)
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

class StageBlockedError(RuntimeError):
    """Raised when an approval, adjudication, or prerequisite is missing."""


class StageInvalidError(ValueError):
    """Raised when an immutable cycle contract is violated."""


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
    schema_version: Literal[1]
    cycle_id: str
    parent_dataset_id: str
    target_eligible_batch_count: int
    selection_rule: str
    capture_mode: str
    requires_complete_reviewer_label: bool
    forbids_prior_final_directed_sampling: bool
    activated_at: str
    approved_by: str
    approval_evidence: str


@dataclass(frozen=True, slots=True)
class QuarantineLedger:
    schema_version: Literal[1]
    cycle_id: str
    parent_dataset_id: str
    parent_dataset_version_sha256: str
    parent_final_split_sha256: str
    batch_ids: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class CaptureRecord:
    batch_id: str
    captured_at: str
    manifest_sha256: str


@dataclass(frozen=True, slots=True)
class CaptureInventory:
    schema_version: Literal[1]
    cycle_id: str
    started_at: str
    stopped_at: str
    records: tuple[CaptureRecord, ...]


@dataclass(frozen=True, slots=True)
class DuplicateRuling:
    group_id: str
    decision: Literal["reject-acquired", "allow-same-role"]
    approved_by: str
    approved_at: str
    evidence: str


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
    schema_version: Literal[1]
    cycle_id: str
    parent_dataset_id: str
    acquisition_policy_sha256: str
    quarantine_sha256: str
    detector_sha256: str
    rejected_by_reason: Mapping[str, int]
    batches: tuple[AcquisitionBatch, ...]


@dataclass(frozen=True, slots=True)
class AllocationManifest:
    schema_version: Literal[1]
    cycle_id: str
    dataset_id: str
    parent_dataset_id: str
    seed: str
    acquisition_sha256: str
    quarantine_sha256: str
    detector_sha256: str
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


@dataclass(frozen=True, slots=True)
class _ImageEvidence:
    batch_id: str
    owner: Literal["parent", "acquired"]
    sha256: str
    dhash: int


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
        "parentDatasetId": policy.parent_dataset_id,
        "targetEligibleBatchCount": policy.target_eligible_batch_count,
        "selectionRule": policy.selection_rule,
        "captureMode": policy.capture_mode,
        "requiresCompleteReviewerLabel": policy.requires_complete_reviewer_label,
        "forbidsPriorFinalDirectedSampling": policy.forbids_prior_final_directed_sampling,
        "oldDatasetExclusion": {
            "batchId": True,
            "imageSha256": True,
            "nearDuplicate": True,
        },
        "activatedAt": policy.activated_at,
        "approvedBy": policy.approved_by,
        "approvalEvidence": policy.approval_evidence,
    }


def parse_acquisition_policy(value: object) -> AcquisitionPolicy:
    document = _exact_mapping(value, _POLICY_KEYS, "acquisition policy")
    exclusion = _exact_mapping(
        document["oldDatasetExclusion"],
        frozenset({"batchId", "imageSha256", "nearDuplicate"}),
        "oldDatasetExclusion",
    )
    if any(
        _strict_bool(exclusion[name], f"oldDatasetExclusion.{name}") is not True
        for name in ("batchId", "imageSha256", "nearDuplicate")
    ):
        raise StageInvalidError("all oldDatasetExclusion values must be true")
    policy = AcquisitionPolicy(
        schema_version=_strict_int(document["schemaVersion"], "schemaVersion", minimum=1),
        cycle_id=_safe_id(document["cycleId"], "cycleId"),
        parent_dataset_id=_safe_id(document["parentDatasetId"], "parentDatasetId"),
        target_eligible_batch_count=_strict_int(
            document["targetEligibleBatchCount"], "targetEligibleBatchCount", minimum=1
        ),
        selection_rule=_text(document["selectionRule"], "selectionRule"),
        capture_mode=_text(document["captureMode"], "captureMode"),
        requires_complete_reviewer_label=_strict_bool(
            document["requiresCompleteReviewerLabel"], "requiresCompleteReviewerLabel"
        ),
        forbids_prior_final_directed_sampling=_strict_bool(
            document["forbidsPriorFinalDirectedSampling"],
            "forbidsPriorFinalDirectedSampling",
        ),
        activated_at=_utc(document["activatedAt"], "activatedAt"),
        approved_by=_text(document["approvedBy"], "approvedBy"),
        approval_evidence=_text(document["approvalEvidence"], "approvalEvidence"),
    )
    if policy != AcquisitionPolicy(
        schema_version=1,
        cycle_id=CYCLE_ID,
        parent_dataset_id=PARENT_DATASET_ID,
        target_eligible_batch_count=TARGET_ELIGIBLE_BATCH_COUNT,
        selection_rule="first-90-chronological-eligible-after-activation",
        capture_mode="rx79-read-only",
        requires_complete_reviewer_label=True,
        forbids_prior_final_directed_sampling=True,
        activated_at=policy.activated_at,
        approved_by="hieunt",
        approval_evidence="2026-09-05 approved Fishing Phase 2 Coverage Recovery Cycle design",
    ):
        raise StageInvalidError("acquisition policy does not match the approved contract")
    return policy


def publish_acquisition_policy(path: Path, now: datetime | None = None) -> AcquisitionPolicy:
    activated = now or datetime.now(timezone.utc)
    if activated.tzinfo is None or activated.utcoffset() != timedelta(0):
        raise StageInvalidError("policy activation time must be UTC")
    policy = AcquisitionPolicy(
        schema_version=1,
        cycle_id=CYCLE_ID,
        parent_dataset_id=PARENT_DATASET_ID,
        target_eligible_batch_count=TARGET_ELIGIBLE_BATCH_COUNT,
        selection_rule="first-90-chronological-eligible-after-activation",
        capture_mode="rx79-read-only",
        requires_complete_reviewer_label=True,
        forbids_prior_final_directed_sampling=True,
        activated_at=activated.isoformat().replace("+00:00", "Z"),
        approved_by="hieunt",
        approval_evidence="2026-09-05 approved Fishing Phase 2 Coverage Recovery Cycle design",
    )
    publish_no_replace(Path(path), _policy_to_json(policy))
    return policy


def parse_quarantine(value: object) -> QuarantineLedger:
    document = _exact_mapping(value, _QUARANTINE_KEYS, "quarantine")
    batch_ids_raw = document["batchIds"]
    if not isinstance(batch_ids_raw, list):
        raise StageInvalidError("quarantine.batchIds must be a list")
    batch_ids = _sorted_unique_ids(batch_ids_raw, "quarantine.batchIds")
    ledger = QuarantineLedger(
        schema_version=_strict_int(document["schemaVersion"], "schemaVersion", minimum=1),
        cycle_id=_safe_id(document["cycleId"], "cycleId"),
        parent_dataset_id=_safe_id(document["parentDatasetId"], "parentDatasetId"),
        parent_dataset_version_sha256=_sha256(
            document["parentDatasetVersionSha256"], "parentDatasetVersionSha256"
        ),
        parent_final_split_sha256=_sha256(
            document["parentFinalSplitSha256"], "parentFinalSplitSha256"
        ),
        batch_ids=batch_ids,
    )
    if (
        ledger.schema_version != 1
        or ledger.cycle_id != CYCLE_ID
        or ledger.parent_dataset_id != PARENT_DATASET_ID
        or document["reason"] != "previous-final-exposed"
        or len(ledger.batch_ids) != PARENT_FINAL_COUNT
    ):
        raise StageInvalidError("quarantine does not match the approved contract")
    return ledger


def publish_quarantine(
    parent_version_path: Path,
    parent_final_path: Path,
    output_path: Path,
) -> QuarantineLedger:
    parent_document = _exact_mapping(
        read_json(parent_version_path),
        frozenset(
            {"schemaVersion", "datasetId", "parentDatasetId", "createdAt", "sourceBatches"}
        ),
        "parent dataset version",
    )
    if parent_document["schemaVersion"] != 1 or parent_document["datasetId"] != PARENT_DATASET_ID:
        raise StageInvalidError("unexpected parent dataset identity")
    batch_ids = tuple(
        sorted(
            _read_ids(
                parent_final_path,
                expected_count=PARENT_FINAL_COUNT,
                require_sorted=False,
            )
        )
    )
    source_batches = parent_document["sourceBatches"]
    if not isinstance(source_batches, list):
        raise StageInvalidError("parent sourceBatches must be a list")
    parent_ids = set(_safe_unique_ids(source_batches, "parent sourceBatches"))
    if not set(batch_ids).issubset(parent_ids):
        raise StageInvalidError("parent final contains ids outside sourceBatches")
    document: dict[str, object] = {
        "schemaVersion": 1,
        "cycleId": CYCLE_ID,
        "parentDatasetId": PARENT_DATASET_ID,
        "parentDatasetVersionSha256": sha256_file(parent_version_path),
        "parentFinalSplitSha256": sha256_file(parent_final_path),
        "reason": "previous-final-exposed",
        "batchIds": list(batch_ids),
    }
    ledger = parse_quarantine(document)
    publish_no_replace(Path(output_path), document)
    return ledger


def parse_capture_inventory(value: object) -> CaptureInventory:
    document = _exact_mapping(value, _CAPTURE_INVENTORY_KEYS, "capture inventory")
    records_raw = document["records"]
    if not isinstance(records_raw, list):
        raise StageInvalidError("capture inventory records must be a list")
    records: list[CaptureRecord] = []
    seen: set[str] = set()
    for index, raw in enumerate(records_raw):
        record = _exact_mapping(raw, _CAPTURE_RECORD_KEYS, f"capture record {index}")
        batch_id = _safe_id(record["batchId"], f"capture record {index}.batchId")
        if batch_id in seen:
            raise StageInvalidError(f"duplicate capture batch id: {batch_id}")
        seen.add(batch_id)
        records.append(
            CaptureRecord(
                batch_id=batch_id,
                captured_at=_utc(record["capturedAt"], f"capture record {index}.capturedAt"),
                manifest_sha256=_sha256(
                    record["manifestSha256"], f"capture record {index}.manifestSha256"
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
    inventory = CaptureInventory(
        schema_version=_strict_int(document["schemaVersion"], "schemaVersion", minimum=1),
        cycle_id=_safe_id(document["cycleId"], "cycleId"),
        started_at=_utc(document["startedAt"], "startedAt"),
        stopped_at=_utc(document["stoppedAt"], "stoppedAt"),
        records=tuple(records),
    )
    if inventory.schema_version != 1 or inventory.cycle_id != CYCLE_ID:
        raise StageInvalidError("capture inventory identity mismatch")
    if _utc_instant(inventory.stopped_at, "stoppedAt") < _utc_instant(
        inventory.started_at, "startedAt"
    ):
        raise StageInvalidError("capture inventory stop precedes start")
    return inventory


def parse_duplicate_rulings(value: object) -> Mapping[str, DuplicateRuling]:
    document = _exact_mapping(value, _RULING_KEYS, "duplicate rulings")
    if (
        _strict_int(document["schemaVersion"], "schemaVersion", minimum=1) != 1
        or document["cycleId"] != CYCLE_ID
    ):
        raise StageInvalidError("duplicate ruling identity mismatch")
    if document["detectorSha256"] != detector_identity():
        raise StageInvalidError("duplicate ruling detector identity mismatch")
    raw_groups = document["groups"]
    if not isinstance(raw_groups, list):
        raise StageInvalidError("duplicate ruling groups must be a list")
    result: dict[str, DuplicateRuling] = {}
    for index, raw in enumerate(raw_groups):
        group = _exact_mapping(raw, _RULING_ENTRY_KEYS, f"duplicate ruling {index}")
        group_id = _sha256(group["groupId"], f"duplicate ruling {index}.groupId")
        decision = group["decision"]
        if decision not in {"reject-acquired", "allow-same-role"}:
            raise StageInvalidError("duplicate ruling decision is not approved")
        if group_id in result:
            raise StageInvalidError(f"duplicate ruling repeated for {group_id}")
        approved_by = _text(
            group["approvedBy"], f"duplicate ruling {index}.approvedBy"
        )
        if approved_by != "hieunt":
            raise StageInvalidError("duplicate ruling approvedBy must be hieunt")
        result[group_id] = DuplicateRuling(
            group_id=group_id,
            decision=decision,
            approved_by=approved_by,
            approved_at=_utc(group["approvedAt"], f"duplicate ruling {index}.approvedAt"),
            evidence=_text(group["evidence"], f"duplicate ruling {index}.evidence"),
        )
    return result


def _image_dhash(path: Path) -> int:
    with Image.open(path) as image:
        rgb = image.convert("RGB")
        if rgb.size != (75, 75):
            raise StageInvalidError(f"{path}: expected 75x75 image")
        grayscale = rgb.convert("L").resize((9, 8), Image.Resampling.BILINEAR)
        pixels = tuple(grayscale.getdata())
    value = 0
    for row in range(8):
        offset = row * 9
        for column in range(8):
            value = (value << 1) | int(
                pixels[offset + column] > pixels[offset + column + 1]
            )
    return value


def _load_image_evidence(
    owner: Literal["parent", "acquired"],
    batch_ids: Sequence[str],
    raw_root: Path,
) -> tuple[_ImageEvidence, ...]:
    evidence: list[_ImageEvidence] = []
    for batch_id in batch_ids:
        batch_dir = Path(raw_root) / batch_id
        manifest = load_manifest(batch_dir / "manifest.json")
        if manifest.batch_id != batch_id:
            raise StageInvalidError(f"manifest batch id mismatch: {batch_id}")
        validate_batch(batch_dir, manifest)
        for image in (*manifest.images, *manifest.images_new):
            evidence.append(
                _ImageEvidence(
                    batch_id=batch_id,
                    owner=owner,
                    sha256=image.sha256,
                    dhash=_image_dhash(batch_dir / image.path),
                )
            )
    return tuple(evidence)


def _duplicate_groups(
    parent_images: Sequence[_ImageEvidence],
    acquired_images: Sequence[_ImageEvidence],
) -> tuple[
    Mapping[int, str],
    Mapping[str, set[str]],
    Mapping[str, set[str]],
    Mapping[str, int],
]:
    images = tuple(parent_images) + tuple(acquired_images)
    union = _UnionFind.create(len(images))
    first_by_sha: dict[str, int] = {}
    for index, image in enumerate(images):
        previous = first_by_sha.setdefault(image.sha256, index)
        if previous != index:
            union.union(previous, index)
    for left in range(len(images)):
        for right in range(left + 1, len(images)):
            if (images[left].dhash ^ images[right].dhash).bit_count() <= 4:
                union.union(left, right)
    members: dict[int, list[int]] = defaultdict(list)
    for index in range(len(images)):
        members[union.find(index)].append(index)
    group_by_index: dict[int, str] = {}
    parent_batches: dict[str, set[str]] = defaultdict(set)
    acquired_batches: dict[str, set[str]] = defaultdict(set)
    acquired_image_counts: Counter[str] = Counter()
    for member_indices in members.values():
        sha_values = sorted({images[index].sha256 for index in member_indices})
        group_id = hashlib.sha256(("\n".join(sha_values) + "\n").encode()).hexdigest()
        for index in member_indices:
            group_by_index[index] = group_id
            target = parent_batches if images[index].owner == "parent" else acquired_batches
            target[group_id].add(images[index].batch_id)
            if images[index].owner == "acquired":
                acquired_image_counts[group_id] += 1
    return group_by_index, parent_batches, acquired_batches, acquired_image_counts


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
        _strict_int(document["schemaVersion"], "schemaVersion", minimum=1) != 1
        or document["cycleId"] != CYCLE_ID
        or document["parentDatasetId"] != PARENT_DATASET_ID
    ):
        raise StageInvalidError("acquisition identity mismatch")
    detector = _exact_mapping(
        document["detector"], frozenset({"descriptor", "sha256"}), "detector"
    )
    if detector["descriptor"] != DETECTOR_DESCRIPTOR or detector["sha256"] != detector_identity():
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
            raise StageInvalidError(f"duplicate acquired batch id: {batch_id}")
        seen.add(batch_id)
        image_values = item["imageSha256"]
        group_values = item["duplicateGroupIds"]
        if not isinstance(image_values, list) or not isinstance(group_values, list):
            raise StageInvalidError("acquisition image/group fields must be lists")
        image_sha = tuple(sorted(_sha256(value, "imageSha256") for value in image_values))
        group_ids = tuple(sorted(_sha256(value, "duplicateGroupIds") for value in group_values))
        if len(image_sha) != len(set(image_sha)) or len(group_ids) != len(set(group_ids)):
            raise StageInvalidError("acquisition image/group fields contain duplicates")
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
    if document["eligibleBatchCount"] != len(batches) or len(batches) != TARGET_ELIGIBLE_BATCH_COUNT:
        raise StageInvalidError("acquisition must contain exactly 90 eligible batches")
    return AcquisitionManifest(
        schema_version=1,
        cycle_id=CYCLE_ID,
        parent_dataset_id=PARENT_DATASET_ID,
        acquisition_policy_sha256=policy_sha,
        quarantine_sha256=_sha256(document["quarantineSha256"], "quarantineSha256"),
        detector_sha256=detector_identity(),
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
    acquired_raw_root: Path,
    acquired_labels_root: Path,
    rulings_path: Path | None,
    output_path: Path,
) -> AcquisitionManifest:
    inventory = parse_capture_inventory(read_json(inventory_path))
    policy = parse_acquisition_policy(read_json(policy_path))
    quarantine = parse_quarantine(read_json(quarantine_path))
    if _utc_instant(inventory.started_at, "inventory.startedAt") < _utc_instant(
        policy.activated_at, "policy.activatedAt"
    ):
        raise StageInvalidError("capture started before acquisition policy activation")
    if sha256_file(policy_path) != _document_sha256(_policy_to_json(policy)):
        raise StageInvalidError("acquisition policy bytes are not canonical")
    if quarantine.parent_dataset_version_sha256 != sha256_file(parent_version_path):
        raise StageInvalidError("quarantine parent dataset digest mismatch")
    parent_version = _exact_mapping(
        read_json(parent_version_path),
        frozenset(
            {"schemaVersion", "datasetId", "parentDatasetId", "createdAt", "sourceBatches"}
        ),
        "parent dataset version",
    )
    if parent_version["schemaVersion"] != 1 or parent_version["datasetId"] != PARENT_DATASET_ID:
        raise StageInvalidError("parent dataset identity mismatch")
    parent_values = parent_version["sourceBatches"]
    if not isinstance(parent_values, list):
        raise StageInvalidError("parent sourceBatches must be a list")
    parent_ids = _safe_unique_ids(parent_values, "parent sourceBatches")
    if len(parent_ids) not in (200, 206):
        raise StageInvalidError(f"parent dataset must contain 200 or 206 batches, got {len(parent_ids)}")
    rulings = (
        parse_duplicate_rulings(read_json(rulings_path))
        if rulings_path is not None
        else {}
    )

    parent_set = set(parent_ids)

    incomplete_batches: list[str] = []
    invalid_reasons: Counter[str] = Counter()
    valid_records: list[CaptureRecord] = []
    for record in inventory.records:
        if record.batch_id in parent_set:
            invalid_reasons["parent-batch-id"] += 1
            continue
        batch_dir = Path(acquired_raw_root) / record.batch_id
        manifest_path = batch_dir / "manifest.json"
        label_path = Path(acquired_labels_root) / f"{record.batch_id}.json"
        if not manifest_path.is_file():
            invalid_reasons["missing-manifest"] += 1
            continue
        if sha256_file(manifest_path) != record.manifest_sha256:
            invalid_reasons["manifest-digest-mismatch"] += 1
            continue
        try:
            manifest = load_manifest(manifest_path)
            validate_batch(batch_dir, manifest)
        except (OSError, ManifestError, ValueError):
            invalid_reasons["invalid-batch"] += 1
            continue
        if manifest.batch_id != record.batch_id or manifest.captured_at != record.captured_at:
            invalid_reasons["capture-manifest-mismatch"] += 1
            continue
        if not label_path.is_file():
            incomplete_batches.append(record.batch_id)
            continue
        try:
            label = load_label(label_path)
        except (OSError, ValueError):
            incomplete_batches.append(record.batch_id)
            continue
        expected_new_indices = set(range(len(manifest.images_new)))
        actual_new_indices = {match.new_index for match in label.matches}
        label_complete = (
            label.batch_id == manifest.batch_id == record.batch_id
            and label.status == "complete"
            and actual_new_indices == expected_new_indices
            and all(match.img_index < len(manifest.images) for match in label.matches)
        )
        if not label_complete:
            incomplete_batches.append(record.batch_id)
            continue
        valid_records.append(record)
    if incomplete_batches:
        raise StageBlockedError(
            f"reviewer labels are incomplete for {len(incomplete_batches)} captured batches"
        )

    parent_images = _load_image_evidence("parent", parent_ids, parent_raw_root)
    acquired_ids = tuple(record.batch_id for record in valid_records)
    acquired_images = _load_image_evidence("acquired", acquired_ids, acquired_raw_root)
    (
        group_by_index,
        parent_batches_by_group,
        acquired_batches_by_group,
        acquired_image_counts_by_group,
    ) = _duplicate_groups(parent_images, acquired_images)
    offset = len(parent_images)
    group_ids_by_batch: dict[str, set[str]] = defaultdict(set)
    image_sha_by_batch: dict[str, set[str]] = defaultdict(set)
    for relative_index, image in enumerate(acquired_images):
        group_id = group_by_index[offset + relative_index]
        group_ids_by_batch[image.batch_id].add(group_id)
        image_sha_by_batch[image.batch_id].add(image.sha256)

    for group_id in sorted(rulings):
        if group_id not in acquired_batches_by_group:
            raise StageInvalidError(f"duplicate ruling references unknown group {group_id}")
        if parent_batches_by_group.get(group_id):
            raise StageInvalidError(
                f"duplicate ruling cannot override parent/quarantine group {group_id}"
            )
        if acquired_image_counts_by_group[group_id] <= 1:
            raise StageInvalidError(f"duplicate ruling references stale singleton group {group_id}")

    required_ruling_groups = {
        group_id
        for group_id, image_count in acquired_image_counts_by_group.items()
        if image_count > 1 and not parent_batches_by_group.get(group_id)
    }
    blocked_groups = sorted(required_ruling_groups - set(rulings))
    if blocked_groups:
        raise StageBlockedError(
            f"manual duplicate adjudication missing for {len(blocked_groups)} groups"
        )

    parent_duplicate_batches = {
        batch_id
        for group_id, batch_ids in acquired_batches_by_group.items()
        if parent_batches_by_group.get(group_id)
        for batch_id in batch_ids
    }
    manual_rejected_batches = {
        batch_id
        for group_id in required_ruling_groups
        if rulings[group_id].decision == "reject-acquired"
        for batch_id in acquired_batches_by_group[group_id]
    }
    rejected_batches = parent_duplicate_batches | manual_rejected_batches
    for batch_id in sorted(rejected_batches):
        reason = (
            "parent-duplicate-group"
            if batch_id in parent_duplicate_batches
            else "manual-duplicate-rejection"
        )
        invalid_reasons[reason] += 1

    policy_sha = sha256_file(policy_path)
    selected: list[AcquisitionBatch] = []
    for record in valid_records:
        if record.batch_id in rejected_batches:
            continue
        label_path = Path(acquired_labels_root) / f"{record.batch_id}.json"
        selected.append(
            AcquisitionBatch(
                batch_id=record.batch_id,
                capture_timestamp=record.captured_at,
                manifest_sha256=record.manifest_sha256,
                label_sha256=sha256_file(label_path),
                image_sha256=tuple(sorted(image_sha_by_batch[record.batch_id])),
                duplicate_group_ids=tuple(sorted(group_ids_by_batch[record.batch_id])),
                acquisition_policy_sha256=policy_sha,
            )
        )
        if len(selected) == TARGET_ELIGIBLE_BATCH_COUNT:
            break
    if len(selected) != TARGET_ELIGIBLE_BATCH_COUNT:
        raise StageBlockedError(
            f"NO_DATASET: expected 90 eligible batches, got {len(selected)}"
        )
    document: dict[str, object] = {
        "schemaVersion": 1,
        "cycleId": CYCLE_ID,
        "parentDatasetId": PARENT_DATASET_ID,
        "acquisitionPolicySha256": policy_sha,
        "quarantineSha256": sha256_file(quarantine_path),
        "detector": {"descriptor": DETECTOR_DESCRIPTOR, "sha256": detector_identity()},
        "eligibleBatchCount": len(selected),
        "rejectedByReason": dict(sorted(invalid_reasons.items())),
        "batches": [_acquisition_batch_to_json(batch) for batch in selected],
    }
    manifest = parse_acquisition_manifest(document)
    if set(quarantine.batch_ids).intersection(batch.batch_id for batch in manifest.batches):
        raise StageInvalidError("quarantined batch entered acquisition")
    publish_no_replace(Path(output_path), document)
    return manifest


def _allocation_units(batches: Sequence[AcquisitionBatch]) -> tuple[tuple[str, tuple[str, ...]], ...]:
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
        _strict_int(document["schemaVersion"], "schemaVersion", minimum=1) != 1
        or document["cycleId"] != CYCLE_ID
        or document["datasetId"] != DATASET_ID
        or document["parentDatasetId"] != PARENT_DATASET_ID
        or document["seed"] != ALLOCATION_SEED
    ):
        raise StageInvalidError("allocation identity mismatch")
    detector = _exact_mapping(
        document["detector"], frozenset({"descriptor", "sha256"}), "detector"
    )
    if (
        detector["descriptor"] != DETECTOR_DESCRIPTOR
        or detector["sha256"] != detector_identity()
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
        schema_version=1,
        cycle_id=CYCLE_ID,
        dataset_id=DATASET_ID,
        parent_dataset_id=PARENT_DATASET_ID,
        seed=ALLOCATION_SEED,
        acquisition_sha256=_sha256(document["acquisitionSha256"], "acquisitionSha256"),
        quarantine_sha256=_sha256(document["quarantineSha256"], "quarantineSha256"),
        detector_sha256=detector_identity(),
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
    acquisition = parse_acquisition_manifest(read_json(acquisition_path))
    quarantine = parse_quarantine(read_json(quarantine_path))
    policy = parse_acquisition_policy(read_json(policy_path))
    if acquisition.acquisition_policy_sha256 != sha256_file(policy_path):
        raise StageInvalidError("acquisition policy digest mismatch")
    if acquisition.quarantine_sha256 != sha256_file(quarantine_path):
        raise StageInvalidError("acquisition quarantine digest mismatch")
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
        raise StageInvalidError("parent final quarantine overlaps reusable train/dev")
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
        "schemaVersion": 1,
        "cycleId": CYCLE_ID,
        "datasetId": DATASET_ID,
        "parentDatasetId": PARENT_DATASET_ID,
        "seed": ALLOCATION_SEED,
        "acquisitionSha256": sha256_file(acquisition_path),
        "quarantineSha256": sha256_file(quarantine_path),
        "detector": {
            "descriptor": DETECTOR_DESCRIPTOR,
            "sha256": acquisition.detector_sha256,
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
        "schemaVersion": 1,
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


def verify_prefinal_integrity(cycle_root: Path) -> PrefinalIntegrity:
    allocation_path = _safe_cycle_file(cycle_root, "allocation.json")
    allocation = parse_allocation_manifest(read_json(allocation_path))
    final_path = _safe_cycle_file(cycle_root, "splits/sealed-final.txt")
    metadata = final_path.stat()
    digest = sha256_file(final_path)
    if (
        allocation.final_commitment.count != FINAL_ACQUIRED_COUNT
        or metadata.st_size != allocation.final_size_bytes
        or digest != allocation.final_commitment.sha256
    ):
        raise StageInvalidError("sealed final opaque commitment mismatch")
    return PrefinalIntegrity(
        final_count=allocation.final_commitment.count,
        final_size_bytes=metadata.st_size,
        final_sha256=digest,
    )


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
    if mode == "prefinal":
        integrity = verify_prefinal_integrity(cycle_root)
        return {
            "schemaVersion": 1,
            "mode": mode,
            "cycleId": CYCLE_ID,
            "datasetId": DATASET_ID,
            "finalCommitmentCount": integrity.final_count,
            "finalSizeBytes": integrity.final_size_bytes,
            "finalSha256": integrity.final_sha256,
        }
    working = load_working_membership(cycle_root)
    result: dict[str, object] = {
        "schemaVersion": 1,
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
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    policy = sub.add_parser("publish-policy")
    policy.add_argument("--output", type=Path, required=True)

    quarantine = sub.add_parser("publish-quarantine")
    quarantine.add_argument("--parent-version", type=Path, required=True)
    quarantine.add_argument("--parent-final", type=Path, required=True)
    quarantine.add_argument("--output", type=Path, required=True)

    acquisition = sub.add_parser("publish-acquisition")
    acquisition.add_argument("--inventory", type=Path, required=True)
    acquisition.add_argument("--policy", type=Path, required=True)
    acquisition.add_argument("--quarantine", type=Path, required=True)
    acquisition.add_argument("--parent-version", type=Path, required=True)
    acquisition.add_argument("--parent-raw-root", type=Path, required=True)
    acquisition.add_argument("--acquired-raw-root", type=Path, required=True)
    acquisition.add_argument("--acquired-labels-root", type=Path, required=True)
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
    parser = _build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "publish-policy":
            result: object = _policy_to_json(publish_acquisition_policy(args.output))
        elif args.command == "publish-quarantine":
            ledger = publish_quarantine(
                args.parent_version, args.parent_final, args.output
            )
            result = {
                "schemaVersion": ledger.schema_version,
                "cycleId": ledger.cycle_id,
                "batchCount": len(ledger.batch_ids),
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
        else:
            result = verify_cycle_dataset(args.cycle_root, args.mode, args.lock)
    except (OSError, ManifestError, StageBlockedError, StageInvalidError, ValueError) as error:
        print(json.dumps({"status": "BLOCKED", "error": str(error)}, sort_keys=True), file=sys.stderr)
        return 4 if isinstance(error, StageBlockedError) else 2
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    return 0


__all__ = [
    "CYCLE_ID",
    "EXPERIMENT_ID",
    "DATASET_ID",
    "PARENT_DATASET_ID",
    "ALLOCATION_SEED",
    "DETECTOR_DESCRIPTOR",
    "StageBlockedError",
    "StageInvalidError",
    "SourceCommitment",
    "SplitCommitment",
    "AcquisitionPolicy",
    "QuarantineLedger",
    "CaptureRecord",
    "CaptureInventory",
    "DuplicateRuling",
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
    "parse_capture_inventory",
    "parse_duplicate_rulings",
    "parse_acquisition_manifest",
    "publish_acquisition",
    "parse_allocation_manifest",
    "publish_allocation",
    "verify_prefinal_integrity",
    "load_working_membership",
    "load_final_membership_after_lock",
    "verify_cycle_dataset",
    "main",
]


if __name__ == "__main__":
    raise SystemExit(main())
