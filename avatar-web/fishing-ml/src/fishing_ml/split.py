"""Deterministic, leakage-safe fishing dataset split creation and validation.

Publication uses an exclusive sibling lock, refuses existing destinations (including
symlinks), stages/fsyncs all files, and rolls back best-effort on failure. Three
renames cannot be power-loss atomic as a set; validation is required before use.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Literal, Mapping

from .schema import LabelError, ManifestError, ValidationError, load_label, load_manifest
from .validate import ValidationIssue, ValidationReport, validate_dataset

_SPLITS = ("train", "dev", "final")
_CANONICAL = {"train": 140, "dev": 30, "final": 30}
_REVIEW_KEYS = frozenset({"checksum", "affectedBatches", "reviewer", "date", "rationale", "resolution"})
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_SAFE_ID = re.compile(r"^[^/\\\s]+$")
_ROOT = "<dataset>"


@dataclass(frozen=True, slots=True)
class DuplicateReview:
    checksum: str
    affected_batches: tuple[str, ...]
    reviewer: str
    review_date: str
    rationale: str
    resolution: Literal["remove", "regroup", "accepted"]


@dataclass(frozen=True, slots=True)
class SplitValidation:
    valid: bool
    counts: Mapping[str, int]
    issues: tuple[ValidationIssue, ...]
    accepted_duplicates: tuple[str, ...]


def _issue(code: str, batch: str, detail: str) -> ValidationIssue:
    return ValidationIssue(code, batch, detail)


def _load_reviews(path: Path, duplicates: Mapping[str, tuple[tuple[str, str, int], ...]]) -> tuple[dict[str, DuplicateReview], list[ValidationIssue]]:
    problems: list[ValidationIssue] = []
    try:
        with path.open("r", encoding="utf-8") as handle:
            raw = json.load(handle)
    except (OSError, UnicodeError, ValueError) as exc:
        return {}, [_issue("DUPLICATE_REVIEW_SCHEMA", _ROOT, f"cannot read {path}: {exc}")]
    if not isinstance(raw, dict) or set(raw) != {"schemaVersion", "reviewedSha256"} or raw.get("schemaVersion") != 1 or not isinstance(raw.get("reviewedSha256"), list):
        return {}, [_issue("DUPLICATE_REVIEW_SCHEMA", _ROOT, "expected exact schemaVersion=1 and reviewedSha256 list")]
    reviews: dict[str, DuplicateReview] = {}
    seen: set[str] = set()
    for index, item in enumerate(raw["reviewedSha256"]):
        prefix = f"reviewedSha256[{index}]"
        if not isinstance(item, dict) or set(item) != _REVIEW_KEYS:
            problems.append(_issue("DUPLICATE_REVIEW_SCHEMA", _ROOT, f"{prefix} must have exact keys {sorted(_REVIEW_KEYS)}")); continue
        checksum, affected = item["checksum"], item["affectedBatches"]
        if not isinstance(checksum, str) or not _HEX64.fullmatch(checksum):
            problems.append(_issue("DUPLICATE_REVIEW_SCHEMA", _ROOT, f"{prefix}.checksum must be lowercase SHA-256")); continue
        if checksum in seen:
            problems.append(_issue("DUPLICATE_REVIEW_SCHEMA", _ROOT, f"duplicate review for {checksum}")); continue
        seen.add(checksum)
        if not isinstance(affected, list) or not affected or any(not isinstance(value, str) or not value for value in affected) or len(affected) != len(set(affected)):
            problems.append(_issue("DUPLICATE_REVIEW_SCHEMA", _ROOT, f"{prefix}.affectedBatches must contain unique nonempty strings")); continue
        if not all(isinstance(item[key], str) and item[key].strip() == item[key] and item[key] for key in ("reviewer", "rationale")) or item["resolution"] not in ("remove", "regroup", "accepted"):
            problems.append(_issue("DUPLICATE_REVIEW_SCHEMA", _ROOT, f"{prefix} contains invalid values")); continue
        try:
            parsed_date = date.fromisoformat(item["date"])
            if parsed_date.isoformat() != item["date"]: raise ValueError
        except (TypeError, ValueError):
            problems.append(_issue("DUPLICATE_REVIEW_SCHEMA", _ROOT, f"{prefix}.date must be YYYY-MM-DD")); continue
        expected = tuple(sorted({occurrence[0] for occurrence in duplicates.get(checksum, ())})); actual = tuple(sorted(affected))
        if not expected or actual != expected:
            problems.append(_issue("DUPLICATE_REVIEW_STALE", _ROOT, f"{checksum}: affectedBatches={actual}, current={expected}")); continue
        reviews[checksum] = DuplicateReview(checksum, actual, item["reviewer"], item["date"], item["rationale"], item["resolution"])
    return reviews, problems


def _eligibility(raw: Path, labels: Path, reviews_path: Path) -> tuple[set[str], dict[str, DuplicateReview], ValidationReport, list[ValidationIssue]]:
    report = validate_dataset(raw, labels); reviews, review_issues = _load_reviews(reviews_path, report.duplicate_blobs)
    bad = {entry.batch_id for entry in report.issues if entry.code != "DUPLICATE_BLOB"}; structural: set[str] = set()
    try: directories = sorted((path for path in raw.iterdir() if path.is_dir()), key=lambda path: path.name)
    except OSError: directories = []
    for directory in directories:
        if directory.name in bad: continue
        try:
            manifest = load_manifest(directory / "manifest.json"); label = load_label(labels / f"{directory.name}.json")
        except (OSError, UnicodeError, ValueError, ManifestError, LabelError, ValidationError):
            continue
        if label.status == "complete" and manifest.images_new: structural.add(directory.name)
    constraints: dict[str, list[str | None]] = {batch: [] for batch in structural}
    for checksum, occurrences in report.duplicate_blobs.items():
        resolution = reviews.get(checksum).resolution if checksum in reviews else None
        for batch in {entry[0] for entry in occurrences}:
            if batch in constraints: constraints[batch].append(resolution)
    eligible = {batch for batch in structural if all(resolution in ("regroup", "accepted") for resolution in constraints[batch])}
    return eligible, reviews, report, review_issues


def _regroup_components(eligible: set[str], reviews: Mapping[str, DuplicateReview]) -> list[tuple[str, ...]]:
    parent = {batch: batch for batch in eligible}
    def find(item: str) -> str:
        while parent[item] != item: parent[item] = parent[parent[item]]; item = parent[item]
        return item
    def union(left: str, right: str) -> None:
        a, b = find(left), find(right)
        if a != b: parent[max(a, b)] = min(a, b)
    grouped: set[str] = set()
    for review in reviews.values():
        if review.resolution != "regroup": continue
        members = set(review.affected_batches)
        if not members <= eligible: continue
        ordered = sorted(members); grouped.update(ordered)
        for item in ordered[1:]: union(ordered[0], item)
    components: dict[str, list[str]] = {}
    for batch in eligible: components.setdefault(find(batch), []).append(batch)
    return [tuple(sorted(component)) for component in components.values()]


def _allocate(eligible: set[str], reviews: Mapping[str, DuplicateReview], seed: int, counts: Mapping[str, int]) -> dict[str, list[str]]:
    units = sorted(_regroup_components(eligible, reviews)); random.Random(seed).shuffle(units)
    memo: set[tuple[int, int, int, int]] = set()
    def place(index: int, train: int, dev: int, final: int) -> list[str] | None:
        state = (index, train, dev, final)
        if state in memo: return None
        if index == len(units): return [] if (train, dev, final) == (0, 0, 0) else None
        size = len(units[index]); remaining = [train, dev, final]
        for partition in range(3):
            if remaining[partition] < size: continue
            next_counts = remaining.copy(); next_counts[partition] -= size
            result = place(index + 1, *next_counts)
            if result is not None: return [_SPLITS[partition], *result]
        memo.add(state); return None
    assignments = place(0, counts["train"], counts["dev"], counts["final"])
    if assignments is None: raise ValueError("regroup components cannot satisfy exact split capacities")
    values = {name: [] for name in _SPLITS}
    for unit, partition in zip(units, assignments): values[partition].extend(unit)
    return values


def _lexists(path: Path) -> bool:
    return os.path.lexists(os.fspath(path))


def _write_split_set(root: Path, values: Mapping[str, list[str]]) -> None:
    root.mkdir(parents=True, exist_ok=True); lock = root / ".fishing-split.lock"
    try:
        lock_fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        try:
            if (os.stat(lock).st_mtime < __import__('time').time() - 3600): lock.unlink(); lock_fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            else: raise FileExistsError(f"split creation lock exists: {lock}") from exc
        except OSError: raise FileExistsError(f"split creation lock exists: {lock}") from exc
    os.write(lock_fd, f"pid={os.getpid()}\n".encode())
    os.fsync(lock_fd)
    destinations = {name: root / f"{name}.txt" for name in _SPLITS}; temps: dict[str, Path] = {}; committed: list[Path] = []
    try:
        existing = [str(path) for path in destinations.values() if _lexists(path)]
        if existing: raise FileExistsError(f"refusing to overwrite existing split files: {existing}")
        for name in _SPLITS:
            temp = root / f".{name}.txt.tmp.{os.getpid()}.{os.urandom(6).hex()}"
            with temp.open("x", encoding="utf-8", newline="\n") as handle:
                handle.write("".join(f"{batch}\n" for batch in values[name])); handle.flush(); os.fsync(handle.fileno())
            temps[name] = temp
        if any(_lexists(path) for path in destinations.values()): raise FileExistsError("a split destination appeared during staging")
        for name in _SPLITS: os.rename(temps[name], destinations[name]); committed.append(destinations[name])
        directory_fd = os.open(root, os.O_RDONLY)
        try: os.fsync(directory_fd)
        finally: os.close(directory_fd)
    except Exception:
        for path in committed:
            try: path.unlink()
            except OSError: pass
        raise
    finally:
        for path in temps.values():
            try: path.unlink()
            except OSError: pass
        os.close(lock_fd)
        try: lock.unlink()
        except OSError: pass


def create_splits(raw_root: Path, labels_root: Path, splits_root: Path, duplicate_reviews: Path, *, seed: int, train_count: int, dev_count: int, final_count: int) -> SplitValidation:
    counts = {"train": train_count, "dev": dev_count, "final": final_count}
    if counts != _CANONICAL: raise ValueError(f"canonical split counts must be {_CANONICAL}")
    if seed != 20260827: raise ValueError("canonical creation requires seed 20260827")
    if Path(duplicate_reviews).name == "": raise ValueError("duplicate review config is required")
    eligible, reviews, report, review_issues = _eligibility(Path(raw_root), Path(labels_root), Path(duplicate_reviews))
    dataset_issues = [entry for entry in report.issues if entry.code != "DUPLICATE_BLOB" and entry.batch_id == _ROOT]
    if dataset_issues or review_issues: raise ValueError("unresolved dataset/review issues: " + "; ".join(entry.detail for entry in dataset_issues + review_issues))
    if report.labeled_pairs < 1000: raise ValueError(f"canonical creation requires at least 1000 labeled pairs, got {report.labeled_pairs}")
    if Path(duplicate_reviews).name != "duplicate-reviews.json": raise ValueError("use the documented config/duplicate-reviews.json review config")
    if len(eligible) != 200: raise ValueError(f"canonical creation requires exactly 200 eligible batches, got {len(eligible)}")
    values = _allocate(eligible, reviews, seed, counts)
    # Publish only after the single authoritative dataset snapshot has passed all gates.
    _write_split_set(Path(splits_root), values)
    return SplitValidation(True, {name: len(values[name]) for name in _SPLITS}, (), ())


def _read_split(path: Path) -> tuple[list[str], list[ValidationIssue]]:
    try: text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc: return [], [_issue("SPLIT_FILE", _ROOT, f"cannot read {path}: {exc}")]
    lines = text.splitlines(); problems: list[ValidationIssue] = []; seen: set[str] = set()
    for batch in lines:
        if not batch: problems.append(_issue("SPLIT_ID", _ROOT, f"blank ID in {path.name}")); continue
        if batch != batch.strip() or batch in (".", "..") or not _SAFE_ID.fullmatch(batch): problems.append(_issue("SPLIT_ID", batch, f"unsafe or non-canonical ID in {path.name}"))
        if batch in seen: problems.append(_issue("SPLIT_DUPLICATE_ID", batch, f"duplicate ID in {path.name}"))
        seen.add(batch)
    return lines, problems


def validate_splits(raw_root: Path, labels_root: Path, splits_root: Path, duplicate_reviews: Path, *, train_count: int = 140, dev_count: int = 30, final_count: int = 30) -> SplitValidation:
    expected = {"train": train_count, "dev": dev_count, "final": final_count}; eligible, reviews, report, review_issues = _eligibility(Path(raw_root), Path(labels_root), Path(duplicate_reviews))
    if expected != _CANONICAL: issues = [_issue("SPLIT_COUNT", _ROOT, f"canonical validation requires {_CANONICAL}")]
    else: issues = []
    if report.labeled_pairs < 1000: issues.append(_issue("LABELED_PAIRS", _ROOT, f"requires at least 1000 labeled pairs, got {report.labeled_pairs}"))
    issues.extend(report.issues); issues.extend(review_issues); values: dict[str, list[str]] = {}
    for name in _SPLITS:
        values[name], found = _read_split(Path(splits_root) / f"{name}.txt"); issues.extend(found)
        if len(values[name]) != expected[name]: issues.append(_issue("SPLIT_COUNT", _ROOT, f"{name}: expected {expected[name]}, got {len(values[name])}"))
    sets = {name: set(values[name]) for name in _SPLITS}
    for index, left in enumerate(_SPLITS):
        for right in _SPLITS[index + 1:]:
            for batch in sorted(sets[left] & sets[right]): issues.append(_issue("SPLIT_OVERLAP", batch, f"present in {left} and {right}"))
    assigned = set().union(*sets.values())
    for batch in sorted(assigned - eligible): issues.append(_issue("SPLIT_INELIGIBLE", batch, "not an eligible batch"))
    for batch in sorted(eligible - assigned): issues.append(_issue("SPLIT_OMISSION", batch, "eligible batch absent from splits"))
    placement = {batch: name for name, batches in sets.items() for batch in batches}; accepted: list[str] = []
    for checksum, occurrences in report.duplicate_blobs.items():
        members = {entry[0] for entry in occurrences}; partitions = {placement[batch] for batch in members if batch in placement}; review = reviews.get(checksum)
        if review and review.resolution == "accepted" and members <= assigned: accepted.append(checksum)
        if len(partitions) > 1 and review is None: issues.append(_issue("DUPLICATE_UNREVIEWED", _ROOT, f"{checksum} crosses {sorted(partitions)}"))
        if len(partitions) > 1 and review and review.resolution == "regroup": issues.append(_issue("DUPLICATE_REGROUP", _ROOT, f"{checksum} must remain together"))
        if members & assigned and review and review.resolution == "remove": issues.append(_issue("DUPLICATE_REMOVE", _ROOT, f"{checksum} batches must be excluded"))
    # DUPLICATE_BLOB is resolved only by a valid explicit review; avoid making every reviewed dataset invalid.
    unresolved_duplicate_issues = {(checksum, batch) for checksum, occurrences in report.duplicate_blobs.items() if checksum not in reviews for batch, _, _ in occurrences}
    issues = [entry for entry in issues if entry.code != "DUPLICATE_BLOB" or any(entry.batch_id == batch for _, batch in unresolved_duplicate_issues)]
    ordered = tuple(sorted(issues, key=lambda entry: (entry.code, entry.batch_id, entry.detail)))
    return SplitValidation(not ordered, {name: len(values[name]) for name in _SPLITS}, ordered, tuple(sorted(set(accepted))))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create and validate frozen fishing dataset splits"); subparsers = parser.add_subparsers(dest="command", required=True)
    for command in ("create", "validate"):
        current = subparsers.add_parser(command)
        for flag in ("raw-root", "labels-root", "splits-root", "duplicate-reviews"): current.add_argument(f"--{flag}", type=Path, required=True)
        current.add_argument("--train-count", type=int, default=140); current.add_argument("--dev-count", type=int, default=30); current.add_argument("--final-count", type=int, default=30)
        if command == "create": current.add_argument("--seed", type=int, required=True)
    args = parser.parse_args(argv); counts = dict(train_count=args.train_count, dev_count=args.dev_count, final_count=args.final_count)
    try:
        result = create_splits(args.raw_root, args.labels_root, args.splits_root, args.duplicate_reviews, seed=args.seed, **counts) if args.command == "create" else validate_splits(args.raw_root, args.labels_root, args.splits_root, args.duplicate_reviews, **counts)
    except (OSError, ValueError) as exc: print(f"error: {exc}", file=sys.stderr); return 2
    print(f"valid={str(result.valid).lower()} train={result.counts['train']} dev={result.counts['dev']} final={result.counts['final']} issues={len(result.issues)} accepted_duplicates={len(result.accepted_duplicates)}")
    for entry in result.issues: print(f"{entry.code} {entry.batch_id}: {entry.detail}")
    for checksum in result.accepted_duplicates: print(f"ACCEPTED_DUPLICATE {checksum}")
    return 0 if result.valid else 2


if __name__ == "__main__": raise SystemExit(main())
