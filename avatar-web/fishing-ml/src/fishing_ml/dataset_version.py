r"""Phase-2 dataset namespace, strict dataset-version schema and provenance.

Giai đoạn A (``schema.py`` / ``split.py``) owns the canonical RX79 capture
schema, labels, splits and frozen candidates. This module adds a SEPARATE
Phase-2 namespace scoped under ``data/phase2/`` and a strict
``dataset-version.json`` provenance document. It reuses ``schema.py`` helpers
(``read_json``, ``atomic_write_json``, ``ManifestError``, ``_parse_utc_iso``)
and the Phase A safe-id rule from ``split.py`` (``^[^/\\\s]+$``, never ``.``/``..``)
but never modifies or overwrites Phase A artifacts.

Phase 2 is provenance metadata only: no capture, label, packet, TX43 or image
data lives in this module.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from types import MappingProxyType
from typing import Literal, Mapping

from .schema import (
    ManifestError,
    atomic_write_json,
    read_json,
)

# Historical Phase 2 reuses the Phase A canonical schema version.
SCHEMA_VERSION = 1
SCHEMA_VERSION_V2 = 2
COVERAGE_RECOVERY_DATASET_ID = "phase2-coverage-recovery-20260905-01"
COVERAGE_RECOVERY_PARENT_DATASET_ID = "phase2-20260904-01"

# Phase 2 dataset-version.json lives under this relative data root and must
# never point at Phase A mutable roots (``data/`` directly, ``data/raw``,
# ``data/labels``, ``data/splits``, ``data/batch`` …).
PHASE2_DATA_ROOT = "data/phase2"

# Exact top-level document keys for dataset-version.json.
_VERSION_V1_KEYS = frozenset(
    {
        "schemaVersion",
        "datasetId",
        "parentDatasetId",
        "createdAt",
        "sourceBatches",
    }
)
_VERSION_V2_KEYS = frozenset(
    {
        "schemaVersion",
        "datasetId",
        "parentDatasetId",
        "createdAt",
        "sourceCommitment",
        "lineage",
        "splits",
    }
)
_COMMITMENT_KEYS = frozenset({"count", "sha256"})
_LINEAGE_KEYS = frozenset(
    {
        "parentDatasetVersionSha256",
        "acquisitionPolicySha256",
        "quarantineSha256",
        "acquisitionSha256",
        "allocationSha256",
    }
)
_SPLIT_KEYS = frozenset({"train", "dev", "final"})

# Phase A safe-id rule (mirrors split.py ``_SAFE_ID`` plus ``.``/``..`` rejection).
_SAFE_ID = re.compile(r"^[^/\\\s]+$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")


@dataclass(frozen=True, slots=True)
class DatasetVersion:
    """Immutable provenance record for one Phase-2 dataset snapshot.

    ``source_batches`` is always normalized to a sorted, unique tuple in
    ``__post_init__``; duplicate batch ids are rejected at construction time.
    """

    schema_version: Literal[1]
    dataset_id: str
    parent_dataset_id: str | None
    created_at: str
    source_batches: tuple[str, ...]

    def __post_init__(self) -> None:
        normalized = _normalize_source_batches(list(self.source_batches))
        if normalized != self.source_batches:
            object.__setattr__(self, "source_batches", normalized)


DatasetVersionV1 = DatasetVersion


@dataclass(frozen=True, slots=True)
class SourceCommitment:
    count: int
    sha256: str


@dataclass(frozen=True, slots=True)
class SplitCommitment:
    count: int
    sha256: str


@dataclass(frozen=True, slots=True)
class Lineage:
    parent_dataset_version_sha256: str
    acquisition_policy_sha256: str
    quarantine_sha256: str
    acquisition_sha256: str
    allocation_sha256: str


@dataclass(frozen=True, slots=True)
class DatasetVersionV2:
    schema_version: Literal[2]
    dataset_id: str
    parent_dataset_id: str
    created_at: str
    source_commitment: SourceCommitment
    lineage: Lineage
    splits: Mapping[str, SplitCommitment]


DatasetVersionDocument = DatasetVersionV1 | DatasetVersionV2


def _parse_utc_iso(value: object) -> str:
    """Validate an ISO-8601 UTC timestamp; return the original string.

    Mirrors ``schema.py._parse_utc_iso``: string, parseable by
    ``datetime.fromisoformat``, must carry a timezone whose offset is 0;
    a trailing ``Z`` is accepted.
    """
    if not isinstance(value, str):
        raise ManifestError("createdAt must be a string")
    raw = value
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError as exc:
        raise ManifestError(f"createdAt is not ISO-8601: {value!r}") from exc
    if parsed.tzinfo is None:
        raise ManifestError(f"createdAt must be UTC (has no timezone): {value!r}")
    if parsed.utcoffset() != timedelta(0):
        raise ManifestError(f"createdAt must be UTC (offset != 0): {value!r}")
    return value


def _check_safe_id(value: object, field: str) -> str:
    """Reject empty / whitespace-surrounded / unsafe batch ids (Phase A rule)."""
    if not isinstance(value, str) or not value or value.strip() != value:
        raise ManifestError(f"{field} must be a non-empty string without surrounding whitespace")
    if value in (".", "..") or not _SAFE_ID.fullmatch(value):
        raise ManifestError(f"{field} is not a safe id: {value!r}")
    return value


def _normalize_source_batches(raw: object) -> tuple[str, ...]:
    """Validate, dedupe and sort source batches into a canonical sorted tuple."""
    if not isinstance(raw, list):
        raise ManifestError("sourceBatches must be a list")
    seen: set[str] = set()
    normalized: list[str] = []
    for item in raw:
        batch_id = _check_safe_id(item, "sourceBatches entry")
        if batch_id in seen:
            raise ManifestError(f"sourceBatches has duplicate id: {batch_id!r}")
        seen.add(batch_id)
        normalized.append(batch_id)
    normalized.sort()
    return tuple(normalized)


def _exact_mapping(
    value: object,
    expected_keys: frozenset[str],
    field: str,
) -> Mapping[str, object]:
    if not isinstance(value, Mapping):
        raise ManifestError(f"{field} must be an object")
    present = set(value)
    if present != expected_keys:
        missing = expected_keys - present
        unknown = present - expected_keys
        parts: list[str] = []
        if missing:
            parts.append(f"missing {sorted(missing)}")
        if unknown:
            parts.append(f"unknown {sorted(unknown)}")
        raise ManifestError(f"{field}: " + "; ".join(parts))
    return value


def _sha256(value: object, field: str) -> str:
    if not isinstance(value, str) or not _HEX64.fullmatch(value):
        raise ManifestError(f"{field} must be a lowercase SHA-256")
    return value


def _count(value: object, field: str, expected: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value != expected:
        raise ManifestError(f"{field} must equal {expected}")
    return value


def _commitment(value: object, field: str, expected_count: int) -> SplitCommitment:
    document = _exact_mapping(value, _COMMITMENT_KEYS, field)
    return SplitCommitment(
        count=_count(document["count"], f"{field}.count", expected_count),
        sha256=_sha256(document["sha256"], f"{field}.sha256"),
    )


def _parse_v1(data: Mapping[str, object]) -> DatasetVersionV1:
    document = _exact_mapping(data, _VERSION_V1_KEYS, "dataset version schema v1")
    dataset_id = _check_safe_id(document["datasetId"], "datasetId")
    parent = document["parentDatasetId"]
    if parent is not None:
        parent = _check_safe_id(parent, "parentDatasetId")
    return DatasetVersionV1(
        schema_version=1,
        dataset_id=dataset_id,
        parent_dataset_id=parent,
        created_at=_parse_utc_iso(document["createdAt"]),
        source_batches=_normalize_source_batches(document["sourceBatches"]),
    )


def _parse_v2(data: Mapping[str, object]) -> DatasetVersionV2:
    document = _exact_mapping(data, _VERSION_V2_KEYS, "dataset version schema v2")
    dataset_id = _check_safe_id(document["datasetId"], "datasetId")
    parent_dataset_id = _check_safe_id(document["parentDatasetId"], "parentDatasetId")
    if dataset_id != COVERAGE_RECOVERY_DATASET_ID:
        raise ManifestError(f"datasetId must equal {COVERAGE_RECOVERY_DATASET_ID}")
    if parent_dataset_id != COVERAGE_RECOVERY_PARENT_DATASET_ID:
        raise ManifestError(
            f"parentDatasetId must equal {COVERAGE_RECOVERY_PARENT_DATASET_ID}"
        )

    source_document = _exact_mapping(
        document["sourceCommitment"], _COMMITMENT_KEYS, "sourceCommitment"
    )
    source_commitment = SourceCommitment(
        count=_count(source_document["count"], "sourceCommitment.count", 260),
        sha256=_sha256(source_document["sha256"], "sourceCommitment.sha256"),
    )
    lineage_document = _exact_mapping(document["lineage"], _LINEAGE_KEYS, "lineage")
    lineage = Lineage(
        parent_dataset_version_sha256=_sha256(
            lineage_document["parentDatasetVersionSha256"],
            "lineage.parentDatasetVersionSha256",
        ),
        acquisition_policy_sha256=_sha256(
            lineage_document["acquisitionPolicySha256"],
            "lineage.acquisitionPolicySha256",
        ),
        quarantine_sha256=_sha256(
            lineage_document["quarantineSha256"], "lineage.quarantineSha256"
        ),
        acquisition_sha256=_sha256(
            lineage_document["acquisitionSha256"], "lineage.acquisitionSha256"
        ),
        allocation_sha256=_sha256(
            lineage_document["allocationSha256"], "lineage.allocationSha256"
        ),
    )
    split_documents = _exact_mapping(document["splits"], _SPLIT_KEYS, "splits")
    splits = MappingProxyType(
        {
            "train": _commitment(split_documents["train"], "splits.train", 185),
            "dev": _commitment(split_documents["dev"], "splits.dev", 45),
            "final": _commitment(split_documents["final"], "splits.final", 30),
        }
    )
    return DatasetVersionV2(
        schema_version=2,
        dataset_id=dataset_id,
        parent_dataset_id=parent_dataset_id,
        created_at=_parse_utc_iso(document["createdAt"]),
        source_commitment=source_commitment,
        lineage=lineage,
        splits=splits,
    )


def parse_dataset_version(data: object) -> DatasetVersionDocument:
    """Strictly parse schema v1 or v2 using only the integer schema tag."""
    if not isinstance(data, Mapping):
        raise ManifestError("dataset version must be a JSON object")

    schema_version = data.get("schemaVersion")
    if not isinstance(schema_version, int) or isinstance(schema_version, bool):
        raise ManifestError("schemaVersion must be an int")
    if schema_version == SCHEMA_VERSION:
        return _parse_v1(data)
    if schema_version == SCHEMA_VERSION_V2:
        return _parse_v2(data)
    raise ManifestError(f"unsupported schemaVersion {schema_version}")


def load_dataset_version(path: Path) -> DatasetVersionDocument:
    """Load and strictly validate a Phase-2 dataset-version document from ``path``."""
    return parse_dataset_version(read_json(path))


def dataset_version_to_json(version: DatasetVersionDocument) -> dict[str, object]:
    """Serialize schema v1 or v2 back to its canonical document."""
    if isinstance(version, DatasetVersionV2):
        return {
            "schemaVersion": version.schema_version,
            "datasetId": version.dataset_id,
            "parentDatasetId": version.parent_dataset_id,
            "createdAt": version.created_at,
            "sourceCommitment": {
                "count": version.source_commitment.count,
                "sha256": version.source_commitment.sha256,
            },
            "lineage": {
                "parentDatasetVersionSha256": version.lineage.parent_dataset_version_sha256,
                "acquisitionPolicySha256": version.lineage.acquisition_policy_sha256,
                "quarantineSha256": version.lineage.quarantine_sha256,
                "acquisitionSha256": version.lineage.acquisition_sha256,
                "allocationSha256": version.lineage.allocation_sha256,
            },
            "splits": {
                name: {
                    "count": version.splits[name].count,
                    "sha256": version.splits[name].sha256,
                }
                for name in ("train", "dev", "final")
            },
        }
    return {
        "schemaVersion": version.schema_version,
        "datasetId": version.dataset_id,
        "parentDatasetId": version.parent_dataset_id,
        "createdAt": version.created_at,
        "sourceBatches": list(version.source_batches),
    }


def write_dataset_version(path: Path, version: DatasetVersionDocument) -> None:
    """Write ``version`` as deterministic UTF-8 JSON via ``atomic_write_json``."""
    atomic_write_json(Path(path), dataset_version_to_json(version))


def resolve_phase2_dir(base: Path, name: str) -> Path:
    """Resolve ``name`` under ``<base>/data/phase2/`` as an absolute, safe path.

    Rejects absolute names, escape attempts (``..``), symlink escapes, and any
    name that would point at a Phase A mutable root. Returns an absolute path.
    """
    base = Path(base).resolve()
    if not isinstance(name, str) or not name or name.strip() != name:
        raise ManifestError("phase2 dir name must be a non-empty string without surrounding whitespace")
    if name in (".", "..") or not _SAFE_ID.fullmatch(name):
        raise ManifestError(f"phase2 dir name is not a safe id: {name!r}")

    # Reject names that would escape via absolute path or ".." segments before
    # any filesystem resolution, so no symlink can alias a Phase A root.
    candidate = base / PHASE2_DATA_ROOT / name
    candidate_abs = candidate.resolve()
    phase2_root = (base / PHASE2_DATA_ROOT).resolve()

    # The containment check below is the sole protection: after resolving
    # symlinks/filesystem, the candidate must nest strictly under
    # <base>/data/phase2/. Any alias of a Phase A mutable root (data/, data/raw,
    # data/labels, data/splits, data/batch …) lands outside phase2_root and is
    # refused here — there is no separate allow-list to keep in sync.
    if candidate_abs == phase2_root or phase2_root not in (candidate_abs, *candidate_abs.parents):
        raise ManifestError(
            f"phase2 path escapes {PHASE2_DATA_ROOT}: {name!r}"
        )

    return candidate_abs


def _main_verify(path: Path) -> DatasetVersionDocument:
    version = load_dataset_version(path)
    source_summary = (
        f"sourceCommitmentCount={version.source_commitment.count} "
        f"sourceCommitmentSha256={version.source_commitment.sha256}"
        if isinstance(version, DatasetVersionV2)
        else f"sourceBatches={list(version.source_batches)}"
    )
    print(
        "dataset-version: valid "
        f"datasetId={version.dataset_id} "
        f"schemaVersion={version.schema_version} "
        f"parentDatasetId={version.parent_dataset_id} "
        f"createdAt={version.created_at} "
        f"{source_summary}"
    )
    return version


def main(argv: list[str] | None = None) -> int:
    """Console entry point for Phase-2 dataset-version provenance.

    Subcommands:
      verify    print/verify a dataset-version.json document
      namespace resolve a Phase-2 data dir name under data/phase2/ and refuse
                any path that would escape the namespace or point at Phase A roots
    """
    parser = argparse.ArgumentParser(
        description="Verify Phase-2 dataset-version provenance (strict, metadata only)."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    verify = sub.add_parser("verify", help="Verify a dataset-version.json document")
    verify.add_argument("path", type=Path, help="Path to dataset-version.json")

    namespace = sub.add_parser(
        "namespace", help="Resolve a Phase-2 data dir under data/phase2/ (escape-proof)"
    )
    namespace.add_argument("--base", type=Path, required=True, help="Project base directory")
    namespace.add_argument("--name", type=str, required=True, help="Dir name under data/phase2/")

    args = parser.parse_args(argv)

    try:
        if args.command == "verify":
            _main_verify(args.path)
        else:
            resolved = resolve_phase2_dir(args.base, args.name)
            print(f"namespace: {resolved} (under data/phase2/)")
    except (OSError, ValueError, ManifestError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
