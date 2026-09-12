"""Deterministic role-aware duplicate detection for immutable RX79 batches."""

from __future__ import annotations

import hashlib
import json
import math
import re
import stat
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Sequence

from PIL import Image

from .schema import ImageEntry, load_manifest, validate_batch

BatchOwner = Literal["parent", "diagnostic", "acquired"]

DETECTOR_DESCRIPTOR = {
    "algorithm": "role-aware-batch-difference-hash",
    "algorithmVersion": 2,
    "decode": "Pillow RGB",
    "inputSize": [75, 75],
    "grayscale": "Pillow L",
    "resize": [9, 8],
    "hashBits": 64,
    "imageHammingThreshold": 4,
    "pairing": "maximum-cardinality-bipartite-per-role",
    "crossRolePairing": False,
    "referenceMinimumRatio": {
        "numerator": 5,
        "denominator": 6,
        "rounding": "ceiling",
    },
    "queryMinimumRatio": {
        "numerator": 4,
        "denominator": 5,
        "rounding": "ceiling",
    },
    "batchEdge": "reference-and-query-thresholds",
    "singleImageOverlapRejectsBatch": False,
    "grouping": "transitive-closure-of-batch-edges",
}

_SAFE_ID = re.compile(r"^[^/\\\s]+$")
_OWNERS = frozenset({"parent", "diagnostic", "acquired"})


@dataclass(frozen=True, slots=True)
class ImageEvidence:
    index: int
    sha256: str
    dhash: int


@dataclass(frozen=True, slots=True)
class BatchEvidence:
    batch_id: str
    owner: BatchOwner
    references: tuple[ImageEvidence, ...]
    queries: tuple[ImageEvidence, ...]
    evidence_sha256: str


@dataclass(frozen=True, slots=True)
class BatchComparison:
    reference_matches: int
    reference_required: int
    query_matches: int
    query_required: int
    is_duplicate: bool


@dataclass(frozen=True, slots=True)
class BatchDuplicateGroup:
    group_id: str
    members: tuple[BatchEvidence, ...]


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


def detector_descriptor_sha256() -> str:
    return hashlib.sha256(_canonical_json_bytes(DETECTOR_DESCRIPTOR)).hexdigest()


def detector_implementation_sha256(path: Path | None = None) -> str:
    implementation_path = Path(__file__) if path is None else Path(path)
    try:
        metadata = implementation_path.lstat()
    except OSError as exc:
        raise ValueError(
            f"detector implementation path is unavailable: {implementation_path}"
        ) from exc
    if stat.S_ISLNK(metadata.st_mode):
        raise ValueError("detector implementation path must not be a symlink")
    if not stat.S_ISREG(metadata.st_mode):
        raise ValueError("detector implementation path must be a regular file")
    try:
        return hashlib.sha256(implementation_path.read_bytes()).hexdigest()
    except OSError as exc:
        raise ValueError(f"cannot read detector implementation: {implementation_path}") from exc


def _image_dhash(path: Path) -> int:
    with Image.open(path) as image:
        if image.format != "PNG" or image.size != (75, 75):
            raise ValueError(f"{path}: expected a 75x75 PNG")
        grayscale = image.convert("RGB").convert("L").resize(
            (9, 8), Image.Resampling.BILINEAR
        )
        pixels = tuple(grayscale.getdata())
    value = 0
    for row in range(8):
        offset = row * 9
        for column in range(8):
            value = (value << 1) | int(
                pixels[offset + column] > pixels[offset + column + 1]
            )
    return value


def _role_evidence(
    entries: Sequence[ImageEntry], batch_root: Path, role: str
) -> tuple[ImageEvidence, ...]:
    ordered_entries = sorted(entries, key=lambda entry: entry.index)
    indices = [entry.index for entry in ordered_entries]
    if indices != list(range(len(ordered_entries))):
        raise ValueError(f"{role} image indices must be unique and contiguous")
    return tuple(
        ImageEvidence(
            index=entry.index,
            sha256=entry.sha256,
            dhash=_image_dhash(batch_root / entry.path),
        )
        for entry in ordered_entries
    )


def _evidence_sha256(
    references: Sequence[ImageEvidence], queries: Sequence[ImageEvidence]
) -> str:
    document = {
        "references": sorted(
            [[image.sha256, f"{image.dhash:016x}"] for image in references]
        ),
        "queries": sorted(
            [[image.sha256, f"{image.dhash:016x}"] for image in queries]
        ),
    }
    return hashlib.sha256(_canonical_json_bytes(document)).hexdigest()


def load_batch_evidence(
    owner: BatchOwner, batch_id: str, raw_root: Path
) -> BatchEvidence:
    if owner not in _OWNERS:
        raise ValueError(f"unsupported batch owner: {owner!r}")
    if not isinstance(batch_id, str) or _SAFE_ID.fullmatch(batch_id) is None:
        raise ValueError("batch_id must be a safe non-empty identifier")
    batch_root = Path(raw_root) / batch_id
    manifest = load_manifest(batch_root / "manifest.json")
    if manifest.batch_id != batch_id:
        raise ValueError(f"manifest batch id mismatch: {batch_id}")
    validate_batch(batch_root, manifest)
    if len(manifest.images) != 6:
        raise ValueError(f"{batch_id}: expected exactly six reference images")
    if not manifest.images_new:
        raise ValueError(f"{batch_id}: expected at least one query image")
    references = _role_evidence(manifest.images, batch_root, "reference")
    queries = _role_evidence(manifest.images_new, batch_root, "query")
    return BatchEvidence(
        batch_id=batch_id,
        owner=owner,
        references=references,
        queries=queries,
        evidence_sha256=_evidence_sha256(references, queries),
    )


def _maximum_cardinality_matches(
    left: Sequence[ImageEvidence], right: Sequence[ImageEvidence]
) -> int:
    adjacency = {
        image.index: tuple(
            candidate.index
            for candidate in sorted(right, key=lambda item: item.index)
            if image.sha256 == candidate.sha256
            or (image.dhash ^ candidate.dhash).bit_count() <= 4
        )
        for image in sorted(left, key=lambda item: item.index)
    }
    matched_right: dict[int, int] = {}

    def augment(left_index: int, visited_right: set[int]) -> bool:
        for right_index in adjacency[left_index]:
            if right_index in visited_right:
                continue
            visited_right.add(right_index)
            previous_left = matched_right.get(right_index)
            if previous_left is None or augment(previous_left, visited_right):
                matched_right[right_index] = left_index
                return True
        return False

    matched = 0
    for image in sorted(left, key=lambda item: item.index):
        if augment(image.index, set()):
            matched += 1
    return matched


def compare_batches(left: BatchEvidence, right: BatchEvidence) -> BatchComparison:
    reference_matches = _maximum_cardinality_matches(left.references, right.references)
    query_matches = _maximum_cardinality_matches(left.queries, right.queries)
    reference_required = math.ceil(
        5 * max(len(left.references), len(right.references)) / 6
    )
    query_required = math.ceil(4 * max(len(left.queries), len(right.queries)) / 5)
    return BatchComparison(
        reference_matches=reference_matches,
        reference_required=reference_required,
        query_matches=query_matches,
        query_required=query_required,
        is_duplicate=(
            reference_matches >= reference_required
            and query_matches >= query_required
        ),
    )


def build_duplicate_groups(
    batches: Sequence[BatchEvidence],
) -> tuple[BatchDuplicateGroup, ...]:
    ordered_batches = tuple(batches)
    identities = [(batch.owner, batch.batch_id) for batch in ordered_batches]
    if len(identities) != len(set(identities)):
        raise ValueError("batch owner/id pairs must be unique")
    union = _UnionFind.create(len(ordered_batches))
    for left_index in range(len(ordered_batches)):
        for right_index in range(left_index + 1, len(ordered_batches)):
            if compare_batches(
                ordered_batches[left_index], ordered_batches[right_index]
            ).is_duplicate:
                union.union(left_index, right_index)
    components: dict[int, list[BatchEvidence]] = {}
    for index, batch in enumerate(ordered_batches):
        components.setdefault(union.find(index), []).append(batch)
    groups: list[BatchDuplicateGroup] = []
    for members in components.values():
        evidence_digests = sorted({member.evidence_sha256 for member in members})
        group_id = hashlib.sha256(
            ("\n".join(evidence_digests) + "\n").encode("utf-8")
        ).hexdigest()
        groups.append(
            BatchDuplicateGroup(
                group_id=group_id,
                members=tuple(
                    sorted(
                        members,
                        key=lambda member: (
                            member.owner,
                            member.evidence_sha256,
                            member.batch_id,
                        ),
                    )
                ),
            )
        )
    return tuple(sorted(groups, key=lambda group: group.group_id))


__all__ = [
    "BatchOwner",
    "DETECTOR_DESCRIPTOR",
    "ImageEvidence",
    "BatchEvidence",
    "BatchComparison",
    "BatchDuplicateGroup",
    "detector_descriptor_sha256",
    "detector_implementation_sha256",
    "load_batch_evidence",
    "compare_batches",
    "build_duplicate_groups",
]
