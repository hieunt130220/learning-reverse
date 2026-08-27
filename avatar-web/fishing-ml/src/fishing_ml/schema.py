"""Version-1 schema, JSON conversion, PNG/checksum validation and atomic JSON writes.

Giai đoạn A — offline pipeline for Avatar fishing image matching.

This module owns the canonical schema for RX79 capture batches (`BatchManifest`),
the ground-truth label schema (`BatchLabel`), strict JSON parsing/validation,
lossless PNG + SHA-256 validation, and atomic JSON persistence. It has no
upstream callers yet (it is the foundation Task 4+ consume).
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Literal, Mapping

from PIL import Image

__all__ = [
    "SCHEMA_VERSION",
    "PNG_SIGNATURE",
    "EXPECTED_SIZE",
    "ManifestError",
    "ValidationError",
    "LabelError",
    "ImageEntry",
    "BatchManifest",
    "MatchLabel",
    "BatchLabel",
    "sha256_file",
    "read_json",
    "load_manifest",
    "load_label",
    "manifest_to_json",
    "label_to_json",
    "validate_png",
    "validate_batch",
    "atomic_write_json",
    "main",
]

SCHEMA_VERSION = 1
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
EXPECTED_SIZE = (75, 75)

# Required top-level manifest keys (camelCase — exact match required).
_MANIFEST_KEYS = frozenset(
    {
        "schemaVersion",
        "batchId",
        "capturedAt",
        "idFish",
        "timeDelayMs",
        "map",
        "area",
        "images",
        "imagesNew",
    }
)
# Required per-image entry keys.
_IMAGE_KEYS = frozenset({"index", "path", "sha256"})
# Required top-level label keys.
_LABEL_KEYS = frozenset({"schemaVersion", "batchId", "status", "matches"})
# Required per-match keys.
_MATCH_KEYS = frozenset({"newIndex", "imgIndex"})

_HEX64_RE = re.compile(r"^[0-9a-fA-F]{64}$")


class ManifestError(ValueError):
    """Raised when a manifest is malformed, not version 1, or invalid."""


class ValidationError(ValueError):
    """Raised when a batch or PNG fails integrity validation."""


class LabelError(ValueError):
    """Raised when a label is malformed or invalid."""


@dataclass(frozen=True, slots=True)
class ImageEntry:
    index: int
    path: str
    sha256: str


@dataclass(frozen=True, slots=True)
class BatchManifest:
    schema_version: int
    batch_id: str
    captured_at: str
    id_fish: int
    time_delay_ms: int
    map: int | None
    area: int | None
    images: tuple[ImageEntry, ...]
    images_new: tuple[ImageEntry, ...]


@dataclass(frozen=True, slots=True)
class MatchLabel:
    new_index: int
    img_index: int


@dataclass(frozen=True, slots=True)
class BatchLabel:
    schema_version: int
    batch_id: str
    status: Literal["complete", "ambiguous"]
    matches: tuple[MatchLabel, ...]


def sha256_file(path: Path) -> str:
    """Return the lowercase hex SHA-256 of a file's exact bytes."""
    path = Path(path)
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 16), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> object:
    """Read and parse a UTF-8 JSON document, wrapping errors as ``ManifestError``."""
    path = Path(path)
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError) as exc:
        raise ManifestError(f"cannot read JSON {path}: {exc}") from exc


def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _check_safe_relpath(value: str) -> None:
    if not value:
        raise ManifestError("path must not be empty")
    parsed = PurePosixPath(value)
    if parsed.is_absolute():
        raise ManifestError(f"unsafe absolute path: {value!r}")
    if ".." in parsed.parts:
        raise ManifestError(f"unsafe path with '..': {value!r}")
    if any(part in ("", "/") for part in parsed.parts):
        raise ManifestError(f"unsafe path: {value!r}")


def _parse_utc_iso(value: object) -> str:
    """Validate an ISO-8601 UTC timestamp; return the original string."""
    if not isinstance(value, str):
        raise ManifestError("capturedAt must be a string")
    raw = value
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError as exc:
        raise ManifestError(f"capturedAt is not ISO-8601: {value!r}") from exc
    if parsed.tzinfo is None:
        raise ManifestError(f"capturedAt must be UTC (has no timezone): {value!r}")
    if parsed.utcoffset() != timedelta(0):
        raise ManifestError(f"capturedAt must be UTC (offset != 0): {value!r}")
    return value


def _parse_image_entries(raw: object, field: str) -> tuple[ImageEntry, ...]:
    if not isinstance(raw, list):
        raise ManifestError(f"{field} must be a list")
    entries: list[ImageEntry] = []
    seen: set[int] = set()
    for i, item in enumerate(raw):
        if not isinstance(item, dict):
            raise ManifestError(f"{field}[{i}] must be an object")
        for key in _IMAGE_KEYS:
            if key not in item:
                raise ManifestError(f"{field}[{i}] missing field {key!r}")
        for key in item:
            if key not in _IMAGE_KEYS:
                raise ManifestError(f"{field}[{i}] unknown field {key!r}")
        index = item["index"]
        if not _is_int(index) or index < 0:
            raise ManifestError(f"{field}[{i}].index must be a non-negative int")
        path = item["path"]
        if not isinstance(path, str):
            raise ManifestError(f"{field}[{i}].path must be a string")
        _check_safe_relpath(path)
        digest = item["sha256"]
        if not isinstance(digest, str) or not _HEX64_RE.match(digest):
            raise ManifestError(f"{field}[{i}].sha256 must be 64 hex chars")
        if index in seen:
            raise ManifestError(f"{field} has duplicate index {index}")
        seen.add(index)
        entries.append(ImageEntry(index=index, path=path, sha256=digest))
    indices = sorted(e.index for e in entries)
    if indices != list(range(len(indices))):
        raise ManifestError(f"{field} indices are not contiguous from 0")
    return tuple(entries)


def _parse_opt_int(value: object, name: str) -> int | None:
    if value is None:
        return None
    if not _is_int(value):
        raise ManifestError(f"{name} must be an int or null")
    return value


def parse_manifest(data: object) -> BatchManifest:
    """Strictly parse a raw JSON object into a :class:`BatchManifest`."""
    if not isinstance(data, dict):
        raise ManifestError("manifest must be a JSON object")
    present = set(data.keys())
    if present != _MANIFEST_KEYS:
        missing = _MANIFEST_KEYS - present
        unknown = present - _MANIFEST_KEYS
        parts: list[str] = []
        if missing:
            parts.append(f"missing {sorted(missing)}")
        if unknown:
            parts.append(f"unknown {sorted(unknown)}")
        raise ManifestError("; ".join(parts))

    schema_version = data["schemaVersion"]
    if not _is_int(schema_version):
        raise ManifestError("schemaVersion must be an int")
    if schema_version != SCHEMA_VERSION:
        raise ManifestError(
            f"unsupported schemaVersion {schema_version} (expected {SCHEMA_VERSION})"
        )

    batch_id = data["batchId"]
    if not isinstance(batch_id, str) or not batch_id:
        raise ManifestError("batchId must be a non-empty string")

    captured_at = _parse_utc_iso(data["capturedAt"])

    id_fish = data["idFish"]
    if not _is_int(id_fish):
        raise ManifestError("idFish must be an int")

    time_delay_ms = data["timeDelayMs"]
    if not _is_int(time_delay_ms):
        raise ManifestError("timeDelayMs must be an int")

    map_value = _parse_opt_int(data["map"], "map")
    area_value = _parse_opt_int(data["area"], "area")

    if not isinstance(data["images"], list) or len(data["images"]) == 0:
        raise ManifestError("images must be a non-empty list")
    images = _parse_image_entries(data["images"], "images")
    images_new = _parse_image_entries(data["imagesNew"], "imagesNew")

    return BatchManifest(
        schema_version=schema_version,
        batch_id=batch_id,
        captured_at=captured_at,
        id_fish=id_fish,
        time_delay_ms=time_delay_ms,
        map=map_value,
        area=area_value,
        images=images,
        images_new=images_new,
    )


def load_manifest(path: Path) -> BatchManifest:
    """Load and strictly validate a schema-v1 batch manifest from ``path``."""
    return parse_manifest(read_json(path))


def parse_label(data: object) -> BatchLabel:
    """Parse a raw JSON object into a :class:`BatchLabel`."""
    if not isinstance(data, dict):
        raise LabelError("label must be a JSON object")
    present = set(data.keys())
    if present != _LABEL_KEYS:
        missing = _LABEL_KEYS - present
        unknown = present - _LABEL_KEYS
        msgs: list[str] = []
        if missing:
            msgs.append(f"missing {sorted(missing)}")
        if unknown:
            msgs.append(f"unknown {sorted(unknown)}")
        raise LabelError("; ".join(msgs))

    schema_version = data["schemaVersion"]
    if not _is_int(schema_version):
        raise LabelError("schemaVersion must be an int")
    if schema_version != SCHEMA_VERSION:
        raise LabelError(
            f"unsupported schemaVersion {schema_version} (expected {SCHEMA_VERSION})"
        )

    batch_id = data["batchId"]
    if not isinstance(batch_id, str) or not batch_id:
        raise LabelError("batchId must be a non-empty string")

    status = data["status"]
    if status not in ("complete", "ambiguous"):
        raise LabelError(f"status must be 'complete' or 'ambiguous', got {status!r}")

    raw_matches = data["matches"]
    if not isinstance(raw_matches, list):
        raise LabelError("matches must be a list")
    matches: list[MatchLabel] = []
    for i, item in enumerate(raw_matches):
        if not isinstance(item, dict):
            raise LabelError(f"matches[{i}] must be an object")
        for key in _MATCH_KEYS:
            if key not in item:
                raise LabelError(f"matches[{i}] missing field {key!r}")
        for key in item:
            if key not in _MATCH_KEYS:
                raise LabelError(f"matches[{i}] unknown field {key!r}")
        new_index = item["newIndex"]
        img_index = item["imgIndex"]
        if not _is_int(new_index):
            raise LabelError(f"matches[{i}].newIndex must be an int")
        if not _is_int(img_index):
            raise LabelError(f"matches[{i}].imgIndex must be an int")
        matches.append(MatchLabel(new_index=new_index, img_index=img_index))

    return BatchLabel(
        schema_version=schema_version,
        batch_id=batch_id,
        status=status,
        matches=tuple(matches),
    )


def load_label(path: Path) -> BatchLabel:
    """Load and validate a schema-v1 batch label from ``path``."""
    return parse_label(read_json(path))


def manifest_to_json(manifest: BatchManifest) -> dict[str, object]:
    """Serialize a manifest back to the canonical camelCase document."""
    return {
        "schemaVersion": manifest.schema_version,
        "batchId": manifest.batch_id,
        "capturedAt": manifest.captured_at,
        "idFish": manifest.id_fish,
        "timeDelayMs": manifest.time_delay_ms,
        "map": manifest.map,
        "area": manifest.area,
        "images": [
            {"index": e.index, "path": e.path, "sha256": e.sha256}
            for e in manifest.images
        ],
        "imagesNew": [
            {"index": e.index, "path": e.path, "sha256": e.sha256}
            for e in manifest.images_new
        ],
    }


def label_to_json(label: BatchLabel) -> dict[str, object]:
    """Serialize a label back to the canonical camelCase document."""
    return {
        "schemaVersion": label.schema_version,
        "batchId": label.batch_id,
        "status": label.status,
        "matches": [
            {"newIndex": m.new_index, "imgIndex": m.img_index}
            for m in label.matches
        ],
    }


def validate_png(path: Path, expected_sha256: str) -> None:
    """Verify a file is a decodable 75x75 RGB/RGBA PNG whose SHA-256 matches."""
    path = Path(path)
    if not path.is_file():
        raise ValidationError(f"missing file: {path}")
    with open(path, "rb") as handle:
        head = handle.read(len(PNG_SIGNATURE))
    if head != PNG_SIGNATURE:
        raise ValidationError(f"not a PNG (bad signature): {path}")
    actual = sha256_file(path)
    if actual != expected_sha256:
        raise ValidationError(
            f"sha256 mismatch for {path}: expected {expected_sha256}, got {actual}"
        )
    try:
        with Image.open(path) as img:
            img.verify()
    except Exception as exc:  # noqa: BLE001 - Pillow raises varied types on corruption
        raise ValidationError(f"cannot decode PNG {path}: {exc}") from exc
    with Image.open(path) as img:
        if img.format != "PNG":
            raise ValidationError(f"decoded format is not PNG: {path}")
        if img.mode not in ("RGB", "RGBA"):
            raise ValidationError(
                f"image mode {img.mode!r} is not RGB/RGBA-convertible: {path}"
            )
        if img.size != EXPECTED_SIZE:
            raise ValidationError(
                f"image size {img.size} != {EXPECTED_SIZE}: {path}"
            )


def validate_batch(batch_dir: Path, manifest: BatchManifest) -> None:
    """Validate every manifest image exists, decodes and matches its SHA-256."""
    batch_dir = Path(batch_dir)
    for entry in (*manifest.images, *manifest.images_new):
        validate_png(batch_dir / entry.path, entry.sha256)


def atomic_write_json(path: Path, value: Mapping[str, object]) -> None:
    """Write ``value`` as deterministic UTF-8 JSON, fsync, then atomically replace.

    A temp file is created inside the same directory as ``path`` so the final
    ``os.replace`` is atomic on the same filesystem.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    text = (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    )
    tmp = path.parent / f".{path.name}.tmp.{os.getpid()}.{os.urandom(6).hex()}"
    try:
        with open(tmp, "w", encoding="utf-8") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    finally:
        try:
            if tmp.exists():
                os.remove(tmp)
        except OSError:
            pass


def main(argv: list[str] | None = None) -> int:
    """Console entry point: print schema/version information."""
    print("fishing_ml.schema — canonical versioned schemas for Giai đoạn A")
    print(f"  schemaVersion: {SCHEMA_VERSION}")
    print("  dataclasses: ImageEntry, BatchManifest, MatchLabel, BatchLabel")
    print(
        "  helpers: load_manifest, load_label, validate_batch, sha256_file, "
        "atomic_write_json"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
