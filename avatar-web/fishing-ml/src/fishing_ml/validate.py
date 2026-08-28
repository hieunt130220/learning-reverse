"""Dataset integrity validation and collection gates for fishing image batches."""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

from PIL import Image

from .schema import EXPECTED_SIZE, PNG_SIGNATURE, BatchManifest, ManifestError, ValidationError, atomic_write_json, load_label, load_manifest, sha256_file

CODES = frozenset({"MANIFEST_SCHEMA", "MISSING_FILE", "PNG_DECODE", "PNG_SIZE", "CHECKSUM_MISMATCH", "INDEX_GAP", "LABEL_MISSING", "LABEL_INCOMPLETE", "LABEL_DUPLICATE_NEW", "LABEL_RANGE", "BATCH_ID_MISMATCH", "DUPLICATE_BLOB"})
_ROOT_BATCH = "<dataset>"

@dataclass(frozen=True, slots=True)
class ValidationIssue:
    code: str
    batch_id: str
    detail: str

@dataclass(frozen=True, slots=True)
class ValidationReport:
    completed_batches: int
    ambiguous_batches: int
    labeled_pairs: int
    issues: tuple[ValidationIssue, ...]
    duplicate_blobs: Mapping[str, tuple[tuple[str, str, int], ...]]

def _issue(code: str, batch: str, detail: str) -> ValidationIssue:
    if code not in CODES: raise ValueError(code)
    return ValidationIssue(code, batch, detail)

def _root_issue(root: Path, name: str) -> ValidationIssue | None:
    try:
        if not root.exists(): return _issue("MISSING_FILE", _ROOT_BATCH, f"missing {name}: {root}")
        if not root.is_dir(): return _issue("MISSING_FILE", _ROOT_BATCH, f"{name} is not a directory: {root}")
        next(root.iterdir(), None)
    except OSError as exc:
        return _issue("MISSING_FILE", _ROOT_BATCH, f"cannot read {name} {root}: {exc}")
    return None

def _has_index_gap(path: Path) -> bool:
    try:
        with path.open("r", encoding="utf-8") as handle: data = json.load(handle)
    except (OSError, UnicodeError, ValueError): return False
    if not isinstance(data, dict): return False
    for field in ("images", "imagesNew"):
        entries = data.get(field)
        if not isinstance(entries, list): continue
        indices: list[int] = []
        for entry in entries:
            if not isinstance(entry, dict) or "index" not in entry: break
            index = entry["index"]
            if not isinstance(index, int) or isinstance(index, bool) or index < 0: return True
            indices.append(index)
        else:
            if len(set(indices)) != len(indices) or sorted(indices) != list(range(len(indices))): return True
    return False

def _image_code(path: Path, expected: str) -> tuple[str | None, str | None]:
    try:
        if not path.is_file(): return "MISSING_FILE", None
        digest = sha256_file(path)
    except OSError: return "MISSING_FILE", None
    try:
        with path.open("rb") as handle:
            if handle.read(len(PNG_SIGNATURE)) != PNG_SIGNATURE: return "PNG_DECODE", digest
        with Image.open(path) as image:
            if image.format != "PNG": return "PNG_DECODE", digest
            if image.size != EXPECTED_SIZE: return "PNG_SIZE", digest
            image.load(); image.convert("RGB").load()
    except (OSError, UnicodeError, ValueError, SyntaxError): return "PNG_DECODE", digest
    return ("CHECKSUM_MISMATCH" if digest != expected.lower() else None), digest

def _label(root: Path, batch: str, manifest: BatchManifest) -> tuple[str | None, int, list[ValidationIssue]]:
    path = root / f"{batch}.json"
    try:
        if not path.is_file(): return None, 0, [_issue("LABEL_MISSING", batch, f"missing label: {path}")]
        label = load_label(path)
    except OSError as exc: return None, 0, [_issue("LABEL_INCOMPLETE", batch, f"cannot read label {path}: {exc}")]
    except (ManifestError, ValidationError, UnicodeError, ValueError) as exc: return None, 0, [_issue("LABEL_INCOMPLETE", batch, str(exc))]
    out: list[ValidationIssue] = []
    if label.batch_id != batch or label.batch_id != manifest.batch_id: out.append(_issue("BATCH_ID_MISMATCH", batch, f"label batchId {label.batch_id!r} does not match directory/manifest"))
    if label.status == "ambiguous":
        if label.matches: out.append(_issue("LABEL_INCOMPLETE", batch, "ambiguous label must have empty matches"))
        return "ambiguous", 0, out
    news = [match.new_index for match in label.matches]
    duplicate_new = sorted({index for index in news if news.count(index) > 1})
    if duplicate_new: out.append(_issue("LABEL_DUPLICATE_NEW", batch, f"duplicate newIndex values: {duplicate_new}"))
    expected, actual = set(range(len(manifest.images_new))), set(news)
    if actual != expected: out.append(_issue("LABEL_INCOMPLETE", batch, f"query coverage mismatch; missing={sorted(expected - actual)}, extra={sorted(actual - expected)}"))
    bad = sorted((match.new_index, match.img_index) for match in label.matches if not 0 <= match.new_index < len(manifest.images_new) or not 0 <= match.img_index < len(manifest.images))
    if bad: out.append(_issue("LABEL_RANGE", batch, f"out-of-range pairs: {bad}"))
    return "complete", len(label.matches), out

def validate_dataset(raw_root: Path, labels_root: Path) -> ValidationReport:
    raw_root, labels_root = Path(raw_root), Path(labels_root)
    issues: list[ValidationIssue] = []; inventory: dict[str, list[tuple[str, str, int]]] = defaultdict(list); candidates: dict[str, tuple[str | None, int, bool]] = {}
    raw_problem, labels_problem = _root_issue(raw_root, "raw root"), _root_issue(labels_root, "labels root")
    if raw_problem: issues.append(raw_problem)
    if labels_problem: issues.append(labels_problem)
    if raw_problem: return ValidationReport(0, 0, 0, tuple(sorted(issues, key=lambda x: (x.code, x.batch_id, x.detail))), {})
    try: dirs = sorted((path for path in raw_root.iterdir() if path.is_dir()), key=lambda path: path.name)
    except OSError as exc:
        issues.append(_issue("MISSING_FILE", _ROOT_BATCH, f"cannot traverse raw root {raw_root}: {exc}")); return ValidationReport(0, 0, 0, tuple(sorted(issues, key=lambda x: (x.code, x.batch_id, x.detail))), {})
    for directory in dirs:
        batch, manifest_path = directory.name, directory / "manifest.json"
        try: manifest_exists = manifest_path.is_file()
        except OSError: manifest_exists = False
        if not manifest_exists: issues.append(_issue("MISSING_FILE", batch, f"missing manifest: {manifest_path}")); continue
        try: manifest = load_manifest(manifest_path)
        except (ManifestError, ValidationError, OSError, UnicodeError, ValueError) as exc:
            issues.append(_issue("INDEX_GAP" if _has_index_gap(manifest_path) else "MANIFEST_SCHEMA", batch, str(exc))); continue
        start = len(issues)
        if manifest.batch_id != batch: issues.append(_issue("BATCH_ID_MISMATCH", batch, f"manifest batchId {manifest.batch_id!r} does not match directory"))
        for role, entries in (("img", manifest.images), ("new", manifest.images_new)):
            for entry in sorted(entries, key=lambda item: item.index):
                path = directory / entry.path; code, digest = _image_code(path, entry.sha256)
                if digest: inventory[digest].append((batch, role, entry.index))
                if code: issues.append(_issue(code, batch, f"{role}[{entry.index}]: {path}"))
        status, count, label_issues = (None, 0, []) if labels_problem else _label(labels_root, batch, manifest)
        issues.extend(label_issues); candidates[batch] = (status, count, len(issues) == start)
    duplicates: dict[str, tuple[tuple[str, str, int], ...]] = {}; duplicate_batches: set[str] = set()
    for digest, occurrences in sorted(inventory.items()):
        ordered = tuple(sorted(occurrences)); batches = sorted({item[0] for item in ordered})
        if len(batches) > 1:
            duplicates[digest] = ordered; duplicate_batches.update(batches)
            for batch in batches: issues.append(_issue("DUPLICATE_BLOB", batch, f"sha256 {digest} occurs across batches: {ordered}"))
    completed = ambiguous = pairs = 0
    for batch, (status, count, valid) in candidates.items():
        if not valid or batch in duplicate_batches: continue
        if status == "complete": completed += 1; pairs += count
        elif status == "ambiguous": ambiguous += 1
    return ValidationReport(completed, ambiguous, pairs, tuple(sorted(issues, key=lambda x: (x.code, x.batch_id, x.detail))), duplicates)

def _json(report: ValidationReport, rb: int | None, rp: int | None) -> dict[str, object]:
    gates = {}
    if rb is not None: gates["batches"] = {"met": report.completed_batches >= rb, "observed": report.completed_batches, "required": rb}
    if rp is not None: gates["pairs"] = {"met": report.labeled_pairs >= rp, "observed": report.labeled_pairs, "required": rp}
    return {"ambiguousBatches": report.ambiguous_batches, "completedBatches": report.completed_batches, "duplicateBlobs": {d: [{"batchId": b, "role": r, "index": i} for b, r, i in xs] for d, xs in report.duplicate_blobs.items()}, "gates": gates, "issues": [{"code": x.code, "batchId": x.batch_id, "detail": x.detail} for x in report.issues], "labeledPairs": report.labeled_pairs}

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate fishing image dataset integrity")
    parser.add_argument("--raw-root", type=Path, required=True); parser.add_argument("--labels-root", type=Path, required=True); parser.add_argument("--require-batches", type=int); parser.add_argument("--require-pairs", type=int); parser.add_argument("--report", type=Path)
    args = parser.parse_args(argv)
    if args.require_batches is not None and args.require_batches < 0: parser.error("--require-batches must be non-negative")
    if args.require_pairs is not None and args.require_pairs < 0: parser.error("--require-pairs must be non-negative")
    report = validate_dataset(args.raw_root, args.labels_root); document = _json(report, args.require_batches, args.require_pairs)
    if args.report:
        try: atomic_write_json(args.report, document)
        except (OSError, UnicodeError, ValueError) as exc:
            print(f"error: cannot write report {args.report}: {exc}", file=sys.stderr); return 2
    print(f"completed_batches={report.completed_batches} ambiguous_batches={report.ambiguous_batches} labeled_pairs={report.labeled_pairs} issues={len(report.issues)}")
    for name, gate in document["gates"].items(): print(f"gate_{name}: observed={gate['observed']} required={gate['required']} met={str(gate['met']).lower()}")
    return 0 if not report.issues and all(gate["met"] for gate in document["gates"].values()) else 2

if __name__ == "__main__": raise SystemExit(main())
