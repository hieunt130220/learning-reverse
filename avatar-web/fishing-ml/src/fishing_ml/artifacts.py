"""Build, publish and verify immutable fishing matcher candidate bundles."""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from .schema import atomic_write_json, load_label, load_manifest, read_json, sha256_file
from .split import validate_splits
from .train import _publish_directory_no_replace

_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_GIT_HEX = re.compile(r"^[0-9a-f]{40}$")

_FROZEN_INPUTS = {
    "model-config.json": "model-config.json",
    "normalization.json": "normalization.json",
    "thresholds.json": "thresholds.json",
    "environment.json": "environment.json",
    "best-dev.pt": "checkpoints/best-dev.pt",
}
_GENERATED = ("dataset-snapshot.json", "split-checksums.json")


@dataclass(frozen=True, slots=True)
class FreezeManifest:
    schema_version: int
    run_id: str
    git_revision: str
    files: dict[str, str]


def _git_revision() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError) as error:
        raise RuntimeError("freeze requires a readable Git revision") from error


def _split_ids(path: Path) -> tuple[str, ...]:
    values = tuple(path.read_text(encoding="utf-8").splitlines())
    if not values or any(not value for value in values) or len(values) != len(set(values)):
        raise ValueError(f"invalid split file: {path}")
    return values


def build_dataset_snapshot(raw_root: Path, labels_root: Path, splits_root: Path) -> dict[str, object]:
    raw_root, labels_root, splits_root = Path(raw_root), Path(labels_root), Path(splits_root)
    batches: list[dict[str, object]] = []
    for split in ("train", "dev", "final"):
        for batch_id in _split_ids(splits_root / f"{split}.txt"):
            batch_dir = raw_root / batch_id
            manifest_path = batch_dir / "manifest.json"
            label_path = labels_root / f"{batch_id}.json"
            manifest, label = load_manifest(manifest_path), load_label(label_path)
            if manifest.batch_id != batch_id or label.batch_id != batch_id or label.status != "complete":
                raise ValueError(f"invalid snapshot batch contract: {batch_id}")
            files = {entry.path: sha256_file(batch_dir / entry.path) for entry in (*manifest.images, *manifest.images_new)}
            if any(files[entry.path] != entry.sha256 for entry in (*manifest.images, *manifest.images_new)):
                raise ValueError(f"snapshot image checksum mismatch: {batch_id}")
            batches.append({
                "batchId": batch_id, "split": split,
                "manifest": read_json(manifest_path), "manifestSha256": sha256_file(manifest_path),
                "label": read_json(label_path), "labelSha256": sha256_file(label_path),
                "files": dict(sorted(files.items())),
            })
    return {"schemaVersion": 1, "batches": batches}


def checksum_split_files(splits_root: Path) -> dict[str, object]:
    root = Path(splits_root)
    return {"schemaVersion": 1, "files": {f"{name}.txt": sha256_file(root / f"{name}.txt") for name in ("train", "dev", "final")}}


def _manifest(document: object) -> FreezeManifest:
    if not isinstance(document, dict) or set(document) != {"schemaVersion", "runId", "gitRevision", "files"}:
        raise ValueError("freeze-manifest.json fields mismatch")
    files = document["files"]
    if document["schemaVersion"] != 1 or not isinstance(document["runId"], str) or not document["runId"] or not isinstance(document["gitRevision"], str) or not _GIT_HEX.fullmatch(document["gitRevision"]) or not isinstance(files, dict):
        raise ValueError("invalid freeze manifest")
    expected = set(_FROZEN_INPUTS) | set(_GENERATED)
    if set(files) != expected or any(not isinstance(value, str) or not _HEX64.fullmatch(value) for value in files.values()):
        raise ValueError("freeze manifest file inventory mismatch")
    return FreezeManifest(1, document["runId"], document["gitRevision"], dict(files))


def verify_freeze(frozen_dir: Path) -> FreezeManifest:
    frozen_dir = Path(frozen_dir)
    manifest = _manifest(read_json(frozen_dir / "freeze-manifest.json"))
    actual = {path.name for path in frozen_dir.iterdir() if path.is_file()}
    expected = set(manifest.files) | {"freeze-manifest.json"}
    if actual != expected:
        raise ValueError(f"frozen file inventory mismatch: expected {sorted(expected)}, got {sorted(actual)}")
    for name, expected_hash in manifest.files.items():
        actual_hash = sha256_file(frozen_dir / name)
        if actual_hash != expected_hash:
            raise ValueError(f"frozen checksum mismatch for {name}: expected {expected_hash}, got {actual_hash}")
    snapshot, splits = read_json(frozen_dir / "dataset-snapshot.json"), read_json(frozen_dir / "split-checksums.json")
    if not isinstance(snapshot, dict) or set(snapshot) != {"schemaVersion", "batches"} or snapshot["schemaVersion"] != 1 or not isinstance(snapshot["batches"], list):
        raise ValueError("invalid dataset snapshot")
    if not isinstance(splits, dict) or set(splits) != {"schemaVersion", "files"} or splits["schemaVersion"] != 1:
        raise ValueError("invalid split checksums")
    return manifest


def freeze_run(run_dir: Path, raw_root: Path, labels_root: Path, splits_root: Path, duplicate_reviews: Path) -> Path:
    run_dir = Path(run_dir)
    frozen_dir = run_dir / "frozen"
    if os.path.lexists(frozen_dir):
        raise FileExistsError(f"refusing to overwrite frozen candidate: {frozen_dir}")
    validation = validate_splits(raw_root, labels_root, splits_root, duplicate_reviews)
    if not validation.valid:
        raise ValueError("split validation failed: " + "; ".join(f"{item.code}:{item.batch_id}" for item in validation.issues))
    revision = _git_revision()
    environment = read_json(run_dir / "environment.json")
    if not isinstance(environment, dict) or environment.get("gitRevision") != revision:
        raise ValueError("run Git revision does not match current revision")
    staging = Path(tempfile.mkdtemp(prefix=".frozen.staging-", dir=run_dir))
    try:
        for destination, source in _FROZEN_INPUTS.items():
            source_path = run_dir / source
            if not source_path.is_file():
                raise FileNotFoundError(source_path)
            shutil.copyfile(source_path, staging / destination)
        atomic_write_json(staging / "dataset-snapshot.json", build_dataset_snapshot(raw_root, labels_root, splits_root))
        atomic_write_json(staging / "split-checksums.json", checksum_split_files(splits_root))
        files = {name: sha256_file(staging / name) for name in sorted(set(_FROZEN_INPUTS) | set(_GENERATED))}
        atomic_write_json(staging / "freeze-manifest.json", {"schemaVersion": 1, "runId": run_dir.name, "gitRevision": revision, "files": files})
        verify_freeze(staging)
        _publish_directory_no_replace(staging, frozen_dir)
        return frozen_dir
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def verify_current_dataset(frozen_dir: Path, raw_root: Path, labels_root: Path, splits_root: Path) -> None:
    frozen_dir = Path(frozen_dir)
    validate_splits(raw_root, labels_root, splits_root, Path(__file__).resolve().parents[3] / "config" / "duplicate-reviews.json")
    expected = read_json(frozen_dir / "dataset-snapshot.json")
    if not isinstance(expected, dict) or set(expected) != {"schemaVersion", "batches"} or expected["schemaVersion"] != 1 or not isinstance(expected["batches"], list):
        raise ValueError("invalid dataset snapshot")
    for batch in expected["batches"]:
        if not isinstance(batch, dict) or set(batch) != {"batchId", "split", "manifestSha256", "labelSha256", "files"}:
            raise ValueError("invalid snapshot batch")
        batch_dir = Path(raw_root) / batch["batchId"]
        if sha256_file(batch_dir / "manifest.json") != batch["manifestSha256"] or sha256_file(Path(labels_root) / f"{batch['batchId']}.json") != batch["labelSha256"]:
            raise ValueError(f"current dataset does not match frozen snapshot: {batch['batchId']}")
        for entry_path, expected_hash in batch["files"].items():
            if sha256_file(batch_dir / entry_path) != expected_hash:
                raise ValueError(f"current dataset does not match frozen snapshot: {batch['batchId']}/{entry_path}")
    expected_splits = read_json(frozen_dir / "split-checksums.json")
    if not isinstance(expected_splits, dict) or set(expected_splits) != {"schemaVersion", "files"} or expected_splits["schemaVersion"] != 1:
        raise ValueError("invalid split checksums")
    for name, expected_hash in expected_splits["files"].items():
        if sha256_file(Path(splits_root) / name) != expected_hash:
            raise ValueError(f"current split files do not match frozen checksums: {name}")


def main(argv=None) -> int:
    arguments = list(argv) if argv is not None else __import__("sys").argv[1:]
    if not arguments or arguments[0] not in {"freeze", "verify"}:
        arguments.insert(0, "freeze")
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    freeze = sub.add_parser("freeze")
    freeze.add_argument("--run-dir", type=Path, required=True); freeze.add_argument("--raw-root", type=Path, required=True)
    freeze.add_argument("--labels-root", type=Path, required=True); freeze.add_argument("--splits-root", type=Path, required=True)
    freeze.add_argument("--duplicate-reviews", type=Path, default=Path("config/duplicate-reviews.json"))
    verify = sub.add_parser("verify"); verify.add_argument("--frozen-dir", type=Path, required=True)
    args = parser.parse_args(arguments)
    try:
        result = verify_freeze(args.frozen_dir) if args.command == "verify" else freeze_run(args.run_dir, args.raw_root, args.labels_root, args.splits_root, args.duplicate_reviews)
    except (OSError, ValueError, RuntimeError) as error:
        print(f"artifact operation failed: {error}")
        return 2
    print(json.dumps({"result": str(result)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
