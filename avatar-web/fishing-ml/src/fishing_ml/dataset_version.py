"""Phase-2 dataset namespace, strict dataset-version schema and provenance.

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
from pathlib import Path, PurePosixPath
from typing import Literal, Mapping

from .schema import (
    ManifestError,
    atomic_write_json,
    read_json,
)

# Phase 2 reuses the Phase A canonical schema version.
SCHEMA_VERSION = 1

# Phase 2 dataset-version.json lives under this relative data root and must
# never point at Phase A mutable roots (``data/`` directly, ``data/raw``,
# ``data/labels``, ``data/splits``, ``data/batch`` …).
PHASE2_DATA_ROOT = "data/phase2"
DATASET_VERSION_FILE = "dataset-version.json"

# Exact top-level document keys for dataset-version.json.
_VERSION_KEYS = frozenset(
    {
        "schemaVersion",
        "datasetId",
        "parentDatasetId",
        "createdAt",
        "sourceBatches",
    }
)

# Phase A safe-id rule (mirrors split.py ``_SAFE_ID`` plus ``.``/``..`` rejection).
_SAFE_ID = re.compile(r"^[^/\\\s]+$")
# Phase A mutable data roots, expressed relative to the project base, that a
# Phase-2 name must never alias. ``resolve_phase2_dir`` compares the candidate's
# path relative to ``data/phase2/`` against this set.
_PHASE_A_ROOTS = (
    "data",
    "data/raw",
    "data/labels",
    "data/splits",
    "data/batch",
)

# Documented subdirs under data/phase2 (kept in sync with config/phase2/dataset.yaml).
PHASE2_SUBDIRS = ("incoming", "raw", "labels", "splits")


@dataclass(frozen=True, slots=True)
class DatasetVersion:
    """Immutable provenance record for one Phase-2 dataset snapshot.

    ``source_batches`` is always normalized to a sorted, unique tuple in
    ``__post_init__``; duplicate batch ids are rejected at construction time.
    """

    schema_version: int
    dataset_id: str
    parent_dataset_id: str | None
    created_at: str
    source_batches: tuple[str, ...]

    def __post_init__(self) -> None:
        normalized = _normalize_source_batches(list(self.source_batches))
        if normalized != self.source_batches:
            object.__setattr__(self, "source_batches", normalized)


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


def parse_dataset_version(data: object) -> DatasetVersion:
    """Strictly parse a raw JSON object into a :class:`DatasetVersion`."""
    if not isinstance(data, dict):
        raise ManifestError("dataset version must be a JSON object")
    present = set(data.keys())
    if present != _VERSION_KEYS:
        missing = _VERSION_KEYS - present
        unknown = present - _VERSION_KEYS
        parts: list[str] = []
        if missing:
            parts.append(f"missing {sorted(missing)}")
        if unknown:
            parts.append(f"unknown {sorted(unknown)}")
        raise ManifestError("; ".join(parts))

    schema_version = data["schemaVersion"]
    if not isinstance(schema_version, int) or isinstance(schema_version, bool):
        raise ManifestError("schemaVersion must be an int")
    if schema_version != SCHEMA_VERSION:
        raise ManifestError(
            f"unsupported schemaVersion {schema_version} (expected {SCHEMA_VERSION})"
        )

    dataset_id = _check_safe_id(data["datasetId"], "datasetId")

    parent = data["parentDatasetId"]
    if parent is not None:
        parent = _check_safe_id(parent, "parentDatasetId")

    created_at = _parse_utc_iso(data["createdAt"])
    source_batches = _normalize_source_batches(data["sourceBatches"])

    return DatasetVersion(
        schema_version=schema_version,
        dataset_id=dataset_id,
        parent_dataset_id=parent,
        created_at=created_at,
        source_batches=source_batches,
    )


def load_dataset_version(path: Path) -> DatasetVersion:
    """Load and strictly validate a Phase-2 dataset-version document from ``path``."""
    return parse_dataset_version(read_json(path))


def dataset_version_to_json(version: DatasetVersion) -> dict[str, object]:
    """Serialize a :class:`DatasetVersion` back to the canonical document."""
    return {
        "schemaVersion": version.schema_version,
        "datasetId": version.dataset_id,
        "parentDatasetId": version.parent_dataset_id,
        "createdAt": version.created_at,
        "sourceBatches": list(version.source_batches),
    }


def write_dataset_version(path: Path, version: DatasetVersion) -> None:
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

    # Must be nested strictly under <base>/data/phase2/.
    if candidate_abs == phase2_root or phase2_root not in (candidate_abs, *candidate_abs.parents):
        raise ManifestError(
            f"phase2 path escapes {PHASE2_DATA_ROOT}: {name!r}"
        )

    # Refuse any name that aliases a Phase A mutable data root.
    rel = candidate_abs.relative_to(phase2_root).as_posix()
    if rel in _PHASE_A_ROOTS or rel.startswith(".."):
        raise ManifestError(f"phase2 path points at a Phase A root: {name!r}")

    return candidate_abs


def _main_verify(path: Path) -> DatasetVersion:
    version = load_dataset_version(path)
    print(
        "dataset-version: valid "
        f"datasetId={version.dataset_id} "
        f"schemaVersion={version.schema_version} "
        f"parentDatasetId={version.parent_dataset_id} "
        f"createdAt={version.created_at} "
        f"sourceBatches={list(version.source_batches)}"
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
