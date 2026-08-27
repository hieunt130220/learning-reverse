"""Lossless import of captured RX79 batches into the immutable raw dataset.

Giai đoạn A — offline pipeline for Avatar fishing image matching.

The importer copies captured batch directories byte-for-byte into the raw
dataset, keyed by ``batchId``, verifying every PNG SHA-256 along the way. The
copy happens inside a sibling temporary directory that is atomically renamed
into place only after all hashes are confirmed. Existing byte-identical batches
are reported ``skipped``; a ``batchId`` collision with different content is a
fatal error; legacy batches missing ``imagesNew`` are reported ``ineligible``
and never copied into the training raw root.
"""

from __future__ import annotations

import argparse
import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from .schema import (
    BatchManifest,
    ManifestError,
    ValidationError,
    load_manifest,
    manifest_to_json,
    read_json,
    sha256_file,
    validate_batch,
)

__all__ = [
    "ImportStatus",
    "ImportResult",
    "import_batch",
    "main",
]

ImportStatus = Literal["imported", "skipped", "ineligible", "error"]

INELIGIBLE_REASON = "legacy batch without imagesNew; never copied into raw root"


@dataclass(frozen=True, slots=True)
class ImportResult:
    batch_id: str
    status: ImportStatus
    image_count: int
    image_new_count: int
    reason: str = ""


def _fsync_path(path: Path) -> None:
    with open(path, "rb") as handle:
        os.fsync(handle.fileno())


def _is_identical(dest_dir: Path, manifest: BatchManifest) -> bool:
    """True when the existing raw batch is byte-identical to ``manifest``."""
    existing = load_manifest(dest_dir / "manifest.json")
    if existing != manifest:
        return False
    for entry in (*manifest.images, *manifest.images_new):
        if sha256_file(dest_dir / entry.path) != entry.sha256:
            return False
    return True


def _copy_batch(src_dir: Path, manifest: BatchManifest, raw_root: Path) -> None:
    """Copy a batch verbatim into a sibling temp dir, verify, then rename."""
    temp = raw_root / (
        f".{manifest.batch_id}.tmp.{os.getpid()}.{os.urandom(6).hex()}"
    )
    temp.mkdir(parents=True, exist_ok=True)
    try:
        src_manifest = src_dir / "manifest.json"
        dst_manifest = temp / "manifest.json"
        shutil.copyfile(src_manifest, dst_manifest)
        _fsync_path(dst_manifest)
        for entry in (*manifest.images, *manifest.images_new):
            src = src_dir / entry.path
            dst = temp / entry.path
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dst)
            _fsync_path(dst)
            if sha256_file(dst) != entry.sha256:
                raise ValidationError(
                    f"copied bytes of {entry.path} failed SHA-256 verification"
                )
        os.replace(temp, raw_root / manifest.batch_id)
    except BaseException:
        shutil.rmtree(temp, ignore_errors=True)
        raise


def import_batch(source: Path, raw_root: Path) -> ImportResult:
    """Import a single batch directory into ``raw_root`` losslessly.

    ``source`` is the batch directory containing ``manifest.json``. Returns an
    :class:`ImportResult`; raises :class:`ManifestError` / :class:`ValidationError`
    for fatal, non-recoverable problems (malformed manifest, hash mismatch, or a
    ``batchId`` collision with different content).
    """
    source = Path(source)
    raw_root = Path(raw_root)

    manifest_path = source / "manifest.json"
    if not manifest_path.is_file():
        raise ManifestError(f"no manifest.json in {source}")

    raw = read_json(manifest_path)
    # Legacy batches (schema v1 but missing imagesNew) are ineligible and are
    # never copied into the training raw root. The raw root is left untouched.
    if isinstance(raw, dict) and "imagesNew" not in raw:
        batch_id = raw.get("batchId", source.name) if isinstance(raw, dict) else source.name
        return ImportResult(
            batch_id=str(batch_id),
            status="ineligible",
            image_count=0,
            image_new_count=0,
            reason=INELIGIBLE_REASON,
        )

    raw_root.mkdir(parents=True, exist_ok=True)

    manifest = load_manifest(manifest_path)
    validate_batch(source, manifest)

    dest = raw_root / manifest.batch_id
    if dest.exists():
        if _is_identical(dest, manifest):
            return ImportResult(
                batch_id=manifest.batch_id,
                status="skipped",
                image_count=len(manifest.images),
                image_new_count=len(manifest.images_new),
            )
        raise ValidationError(
            f"batchId {manifest.batch_id!r} already exists in raw root with "
            "different manifest or image content (fatal collision)"
        )

    _copy_batch(source, manifest, raw_root)
    # Persist the canonical manifest (re-serialized deterministically) so the
    # raw root form matches the parsed schema exactly.
    from .schema import atomic_write_json

    atomic_write_json(dest / "manifest.json", manifest_to_json(manifest))
    return ImportResult(
        batch_id=manifest.batch_id,
        status="imported",
        image_count=len(manifest.images),
        image_new_count=len(manifest.images_new),
    )


def _discover_batch_dirs(source: Path) -> list[Path]:
    source = Path(source)
    if (source / "manifest.json").is_file():
        return [source]
    return sorted(
        child
        for child in source.iterdir()
        if child.is_dir() and (child / "manifest.json").is_file()
    )


def main(argv: list[str] | None = None) -> int:
    """Console entry point for ``fishing-import``."""
    parser = argparse.ArgumentParser(
        prog="fishing-import",
        description="Losslessly import captured RX79 batches into the raw dataset.",
    )
    parser.add_argument(
        "--source",
        required=True,
        type=Path,
        help="Directory holding one or more batch directories (each with manifest.json).",
    )
    parser.add_argument(
        "--raw-root",
        required=True,
        type=Path,
        help="Root directory where immutable raw batches are stored.",
    )
    args = parser.parse_args(argv)

    batch_dirs = _discover_batch_dirs(args.source)
    if not batch_dirs:
        print(f"fishing-import: no batches found in {args.source}")
        return 0

    had_error = False
    for batch_dir in batch_dirs:
        try:
            result = import_batch(batch_dir, args.raw_root)
        except (ManifestError, ValidationError) as exc:
            had_error = True
            name = batch_dir.name
            print(f"{name}: error {exc}")
            continue
        report = (
            f"{result.batch_id}: {result.image_count}/{result.image_new_count} "
            f"{result.status}"
        )
        if result.reason:
            report += f" ({result.reason})"
        print(report)

    return 1 if had_error else 0


if __name__ == "__main__":
    raise SystemExit(main())
