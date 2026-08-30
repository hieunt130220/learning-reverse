"""Operational in-memory replay for Phase 2 fishing inference batches.

Replay is read-only: it validates existing schema-v1 manifests and PNGs, builds
contract requests in memory, and prints only aggregate, sanitized evidence.  It
never writes generated JSON, PNGs, base64, packets, labels, or model artifacts.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import math
import os
import stat
import time
from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

from .inference_client import InferenceClient, InferenceClientError
from .inference_contract import InferenceImage, InferenceRequest, InferenceResponse
from .schema import (
    BatchManifest,
    EXPECTED_SIZE,
    ImageEntry,
    LabelError,
    ManifestError,
    PNG_SIGNATURE,
    ValidationError,
    parse_label,
    parse_manifest,
)

from PIL import Image

_REPLAY_SCHEMA_VERSION = 1

# A single 75x75 RGBA PNG is 22,500 raw bytes; the contract permits a 4x headroom
# per file before the capture is rejected, and a hard aggregate decoded budget
# across references + queries matching the contract's (64+64)*7500.
_PER_IMAGE_PNG_BYTES = EXPECTED_SIZE[0] * EXPECTED_SIZE[1] * 4
_MAX_SINGLE_IMAGE_BYTES = _PER_IMAGE_PNG_BYTES * 4
_MAX_DECODED_PNG_BYTES = (64 + 64) * 7500
_MAX_BATCH_JSON_BYTES = 2_000_000
_MAX_LABEL_JSON_BYTES = 2_000_000

# Descriptor-open flags are composed defensively: ``O_NOFOLLOW`` rejects a
# symlink at each traversed component, ``O_DIRECTORY`` constrains trusted roots
# and parents, and ``O_NONBLOCK`` prevents a hostile FIFO final component from
# blocking before ``fstat`` can reject it as non-regular.
_DIRECTORY_OPEN_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
_FILE_OPEN_FLAGS = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK

# Error keys are stable aggregate categories.  Client errors preserve the typed
# client's stable code with a ``client_`` prefix; filesystem/contract failures
# use the categories below.
_MALFORMED_MANIFEST = "malformed_manifest"
_INVALID_BATCH = "invalid_batch"
_MISSING_IMAGES_NEW = "missing_images_new"
_INVALID_LABEL = "invalid_label"
_UNSAFE_BATCH_DIR = "unsafe_batch_dir"
_UNRESOLVED_LABEL = "unresolved_label"


@dataclass(frozen=True, slots=True)
class RQBreakdown:
    """Aggregate terminal outcomes for one references/queries shape."""

    batches: int
    queries: int
    successful_batches: int
    errored_batches: int
    accepted: int
    abstained: int
    omitted: int
    errors: Mapping[str, int]

    def to_dict(self) -> dict[str, object]:
        return {
            "batches": self.batches,
            "queries": self.queries,
            "successfulBatches": self.successful_batches,
            "erroredBatches": self.errored_batches,
            "accepted": self.accepted,
            "abstained": self.abstained,
            "omitted": self.omitted,
            "errors": dict(sorted(self.errors.items())),
        }


@dataclass(frozen=True, slots=True)
class ReplayReport:
    """Deterministic, privacy-safe aggregate replay evidence."""

    schema_version: int
    batch_count: int
    query_count: int
    request_count: int
    successful_batch_count: int
    errored_batch_count: int
    accepted_count: int
    accepted_rate: float | None
    abstained_count: int
    abstained_rate: float | None
    omitted_count: int
    omitted_rate: float | None
    labeled_batch_count: int
    unknown_batch_count: int
    labeled_query_count: int
    unknown_query_count: int
    labeled_returned_prediction_count: int
    unknown_returned_prediction_count: int
    correct_accepted_count: int
    wrong_accepted_count: int
    error_counts: Mapping[str, int]
    latency_sample_count: int
    latency_p50_ms: float | None
    latency_p95_ms: float | None
    latency_p99_ms: float | None
    rq_breakdown: Mapping[str, RQBreakdown]
    model_ids: tuple[str, ...]
    model_checksums: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        """Return the canonical aggregate document (never request-level data)."""

        return {
            "schemaVersion": self.schema_version,
            "batchCount": self.batch_count,
            "queryCount": self.query_count,
            "requestCount": self.request_count,
            "successfulBatchCount": self.successful_batch_count,
            "erroredBatchCount": self.errored_batch_count,
            "acceptedCount": self.accepted_count,
            "acceptedRate": self.accepted_rate,
            "abstainedCount": self.abstained_count,
            "abstainedRate": self.abstained_rate,
            "omittedCount": self.omitted_count,
            "omittedRate": self.omitted_rate,
            "labeledBatchCount": self.labeled_batch_count,
            "unknownBatchCount": self.unknown_batch_count,
            "labeledQueryCount": self.labeled_query_count,
            "unknownQueryCount": self.unknown_query_count,
            "labeledReturnedPredictionCount": self.labeled_returned_prediction_count,
            "unknownReturnedPredictionCount": self.unknown_returned_prediction_count,
            "correctAcceptedCount": self.correct_accepted_count,
            "wrongAcceptedCount": self.wrong_accepted_count,
            "errorCounts": dict(sorted(self.error_counts.items())),
            "clientLatencyMs": {
                "sampleCount": self.latency_sample_count,
                "p50": self.latency_p50_ms,
                "p95": self.latency_p95_ms,
                "p99": self.latency_p99_ms,
                "rule": "nearest-rank",
            },
            "rqBreakdown": {
                key: self.rq_breakdown[key].to_dict()
                for key in sorted(self.rq_breakdown)
            },
            "modelIdentity": {
                "modelIds": list(self.model_ids),
                "checksums": list(self.model_checksums),
            },
        }

    def to_json(self) -> str:
        """Serialize deterministically as compact JSON with ASCII escaping.

        ``ensure_ascii=True`` is defense in depth: any stray non-UTF-8 value
        cannot crash stdout when the report is printed.
        """

        return json.dumps(
            self.to_dict(),
            ensure_ascii=True,
            sort_keys=True,
            separators=(",", ":"),
        )


@dataclass(slots=True)
class _RQAccumulator:
    batches: int = 0
    queries: int = 0
    successful_batches: int = 0
    errored_batches: int = 0
    accepted: int = 0
    abstained: int = 0
    omitted: int = 0
    errors: Counter[str] = field(default_factory=Counter)


@dataclass(slots=True)
class _Accumulator:
    batch_count: int = 0
    query_count: int = 0
    request_count: int = 0
    successful_batch_count: int = 0
    accepted_count: int = 0
    abstained_count: int = 0
    omitted_count: int = 0
    labeled_batch_count: int = 0
    unknown_batch_count: int = 0
    labeled_query_count: int = 0
    unknown_query_count: int = 0
    labeled_returned_prediction_count: int = 0
    unknown_returned_prediction_count: int = 0
    correct_accepted_count: int = 0
    wrong_accepted_count: int = 0
    errors: Counter[str] = field(default_factory=Counter)
    request_latencies_ms: list[float] = field(default_factory=list)
    rq: dict[str, _RQAccumulator] = field(default_factory=dict)
    model_ids: set[str] = field(default_factory=set)


def _rq_key(references: int, queries: int) -> str:
    return f"R={references},Q={queries}"


def _rq_bucket(accumulator: _Accumulator, key: str) -> _RQAccumulator:
    bucket = accumulator.rq.get(key)
    if bucket is None:
        bucket = _RQAccumulator()
        accumulator.rq[key] = bucket
    return bucket


def _record_error(accumulator: _Accumulator, key: str, code: str) -> None:
    accumulator.errors[code] += 1
    bucket = _rq_bucket(accumulator, key)
    bucket.errored_batches += 1
    bucket.errors[code] += 1


def _client_error_category(error: InferenceClientError) -> str:
    if error.code == "http_status" and error.status is not None:
        return f"client_http_status_{error.status}"
    if error.code == "invalid_request" and error.reason in {
        "body_too_large",
        "too_many_images",
    }:
        return f"client_invalid_request_{error.reason}"
    return f"client_{error.code}"


def _is_safe_component(value: object) -> bool:
    """Return whether ``value`` is one strict, non-dotted POSIX component."""

    return (
        isinstance(value, str)
        and bool(value)
        and value not in {".", ".."}
        and "/" not in value
        and "\\" not in value
        and not any(character.isspace() for character in value)
        and not value.startswith(".")
        and not value.endswith(".")
    )


def _relative_components(value: object) -> tuple[str, ...]:
    """Return normalized relative POSIX components or reject the path."""

    if not isinstance(value, str) or not value or "\\" in value:
        raise ValidationError("unsafe relative path")
    parsed = PurePosixPath(value)
    if (
        parsed.is_absolute()
        or parsed.as_posix() != value
        or any(part in {"", ".", ".."} for part in parsed.parts)
    ):
        raise ValidationError("unsafe relative path")
    return parsed.parts


def _open_directory(path: Path) -> int:
    """Open one trusted directory without following a final symlink."""

    descriptor = os.open(path, _DIRECTORY_OPEN_FLAGS)
    try:
        if not stat.S_ISDIR(os.fstat(descriptor).st_mode):
            raise OSError("not a directory")
        return descriptor
    except BaseException:
        os.close(descriptor)
        raise


def _read_regular_file_at(
    root_descriptor: int,
    relative_path: str,
    limit: int,
) -> bytes:
    """Read one bounded regular file, no-following every path component.

    Traversal is rooted at an already-open trusted directory descriptor. Every
    parent is opened as a no-follow directory relative to the preceding descriptor,
    and the final component is opened no-follow/nonblocking then checked with
    ``fstat`` before any read. This rejects symlink races, FIFOs, devices, sockets,
    directories, and files exceeding ``limit`` without leaking path contents.
    """

    components = _relative_components(relative_path)
    parent_descriptor = os.dup(root_descriptor)
    try:
        for component in components[:-1]:
            next_descriptor = os.open(
                component,
                _DIRECTORY_OPEN_FLAGS,
                dir_fd=parent_descriptor,
            )
            try:
                if not stat.S_ISDIR(os.fstat(next_descriptor).st_mode):
                    raise OSError("non-directory path component")
            except BaseException:
                os.close(next_descriptor)
                raise
            os.close(parent_descriptor)
            parent_descriptor = next_descriptor

        descriptor = os.open(
            components[-1],
            _FILE_OPEN_FLAGS,
            dir_fd=parent_descriptor,
        )
        try:
            metadata = os.fstat(descriptor)
            if not stat.S_ISREG(metadata.st_mode):
                raise OSError("non-regular file")
            if metadata.st_size > limit:
                raise OSError("file exceeds byte limit")

            chunks: list[bytes] = []
            remaining = limit + 1
            while remaining > 0:
                chunk = os.read(descriptor, min(65536, remaining))
                if not chunk:
                    break
                chunks.append(chunk)
                remaining -= len(chunk)
            raw = b"".join(chunks)
            if len(raw) > limit:
                raise OSError("file exceeds byte limit")
            return raw
        finally:
            os.close(descriptor)
    finally:
        os.close(parent_descriptor)


def _read_manifest_once(batch_descriptor: int) -> BatchManifest:
    """Read and canonically parse one bounded descriptor-anchored manifest."""

    try:
        raw = _read_regular_file_at(
            batch_descriptor,
            "manifest.json",
            _MAX_BATCH_JSON_BYTES,
        )
        document = json.loads(raw.decode("utf-8"))
        return parse_manifest(document)
    except ManifestError:
        raise
    except (UnicodeDecodeError, json.JSONDecodeError, OSError, ValueError, RecursionError):
        raise ManifestError("manifest is unreadable or malformed") from None


def _read_image_once(batch_descriptor: int, entry: ImageEntry) -> tuple[InferenceImage, int]:
    """Read, validate, and encode one image from one anchored descriptor read."""

    try:
        raw = _read_regular_file_at(
            batch_descriptor,
            entry.path,
            _MAX_SINGLE_IMAGE_BYTES,
        )
    except (OSError, ValueError):
        raise ValidationError("image is unreadable or unsafe") from None
    if hashlib.sha256(raw).hexdigest() != entry.sha256:
        raise ValidationError("sha256 mismatch for image bytes")
    if not raw.startswith(PNG_SIGNATURE):
        raise ValidationError("image is not a PNG (bad signature)")
    try:
        with io.BytesIO(raw) as buffer:
            with Image.open(buffer) as image:
                image.load()
                if image.mode not in ("RGB", "RGBA"):
                    raise ValidationError("image mode must be RGB/RGBA")
                if image.size != EXPECTED_SIZE:
                    raise ValidationError("image must be 75x75")
    except ValidationError:
        raise
    except (OSError, ValueError):
        raise ValidationError("image is not a decodable PNG") from None
    return (
        InferenceImage(
            index=entry.index,
            png_base64=base64.b64encode(raw).decode("ascii"),
        ),
        len(raw),
    )


def _build_request(batch_descriptor: int, manifest: BatchManifest) -> InferenceRequest:
    """Read every image exactly once and bound aggregate decoded bytes."""

    decoded = 0
    references: list[InferenceImage] = []
    for entry in manifest.images:
        image, byte_count = _read_image_once(batch_descriptor, entry)
        decoded += byte_count
        if decoded > _MAX_DECODED_PNG_BYTES:
            raise ValidationError("aggregate decoded PNG bytes exceed budget")
        references.append(image)
    queries: list[InferenceImage] = []
    for entry in manifest.images_new:
        image, byte_count = _read_image_once(batch_descriptor, entry)
        decoded += byte_count
        if decoded > _MAX_DECODED_PNG_BYTES:
            raise ValidationError("aggregate decoded PNG bytes exceed budget")
        queries.append(image)
    return InferenceRequest(
        schema_version=manifest.schema_version,
        references=tuple(references),
        queries=tuple(queries),
    )


def _read_label_doc_once(
    labels_descriptor: int,
    batch_id: str,
) -> Mapping[str, object] | None:
    """Read one bounded, regular, non-symlinked label below labels_root."""

    if not _is_safe_component(batch_id):
        return None
    try:
        raw = _read_regular_file_at(
            labels_descriptor,
            f"{batch_id}.json",
            _MAX_LABEL_JSON_BYTES,
        )
    except FileNotFoundError:
        return None
    except OSError:
        raise LabelError("label is unreadable or unsafe") from None
    try:
        document = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError, ValueError):
        raise LabelError("label is not valid JSON") from None
    if not isinstance(document, dict):
        raise LabelError("label must be a JSON object")
    return document


def _ground_truth(
    labels_descriptor: int | None,
    manifest: BatchManifest,
) -> tuple[dict[int, int] | None, bool]:
    """Return complete reviewer ground truth and whether a malformed label exists."""

    if labels_descriptor is None:
        return None, False
    try:
        document = _read_label_doc_once(labels_descriptor, manifest.batch_id)
    except (LabelError, ManifestError, OSError, ValueError, RecursionError):
        return None, True
    if document is None:
        return None, False
    try:
        label = parse_label(document)
    except (LabelError, ManifestError, OSError, ValueError, RecursionError):
        return None, True
    if label.status != "complete" or label.batch_id != manifest.batch_id:
        return None, False
    expected_queries = set(range(len(manifest.images_new)))
    mapping = {match.new_index: match.img_index for match in label.matches}
    if (
        set(mapping) != expected_queries
        or len(mapping) != len(label.matches)
        or any(index < 0 or index >= len(manifest.images) for index in mapping.values())
    ):
        return None, True
    return mapping, False


def _nearest_rank(values: list[float], percentile: int) -> float | None:
    """Nearest-rank percentile: sorted_values[ceil(p / 100 * n) - 1]."""

    if not values:
        return None
    ordered = sorted(values)
    rank = max(1, math.ceil(percentile / 100.0 * len(ordered)))
    return round(ordered[rank - 1], 3)


def _safe_rate(numerator: int, denominator: int) -> float | None:
    return None if denominator == 0 else round(numerator / denominator, 6)


def _record_predictions(
    accumulator: _Accumulator,
    bucket: _RQAccumulator,
    manifest: BatchManifest,
    response: InferenceResponse,
    ground_truth: dict[int, int] | None,
) -> None:
    returned = {prediction.query_index: prediction for prediction in response.predictions}
    omitted = len(manifest.images_new) - len(returned)
    accepted = sum(1 for prediction in returned.values() if prediction.accepted)
    abstained = len(returned) - accepted

    accumulator.accepted_count += accepted
    accumulator.abstained_count += abstained
    accumulator.omitted_count += omitted
    bucket.accepted += accepted
    bucket.abstained += abstained
    bucket.omitted += omitted

    if ground_truth is None:
        accumulator.unknown_batch_count += 1
        accumulator.unknown_query_count += len(manifest.images_new)
        accumulator.unknown_returned_prediction_count += len(returned)
        return

    accumulator.labeled_batch_count += 1
    accumulator.labeled_query_count += len(manifest.images_new)
    accumulator.labeled_returned_prediction_count += len(returned)
    for query_index, prediction in returned.items():
        if not prediction.accepted:
            continue
        if prediction.reference_index == ground_truth[query_index]:
            accumulator.correct_accepted_count += 1
        else:
            accumulator.wrong_accepted_count += 1


def _freeze_report(
    accumulator: _Accumulator,
    model_checksums: tuple[str, ...],
) -> ReplayReport:
    rq = {
        key: RQBreakdown(
            batches=value.batches,
            queries=value.queries,
            successful_batches=value.successful_batches,
            errored_batches=value.errored_batches,
            accepted=value.accepted,
            abstained=value.abstained,
            omitted=value.omitted,
            errors=dict(sorted(value.errors.items())),
        )
        for key, value in sorted(accumulator.rq.items())
    }
    errored = accumulator.batch_count - accumulator.successful_batch_count
    return ReplayReport(
        schema_version=_REPLAY_SCHEMA_VERSION,
        batch_count=accumulator.batch_count,
        query_count=accumulator.query_count,
        request_count=accumulator.request_count,
        successful_batch_count=accumulator.successful_batch_count,
        errored_batch_count=errored,
        accepted_count=accumulator.accepted_count,
        accepted_rate=_safe_rate(
            accumulator.accepted_count,
            accumulator.accepted_count
            + accumulator.abstained_count
            + accumulator.omitted_count,
        ),
        abstained_count=accumulator.abstained_count,
        abstained_rate=_safe_rate(
            accumulator.abstained_count,
            accumulator.accepted_count
            + accumulator.abstained_count
            + accumulator.omitted_count,
        ),
        omitted_count=accumulator.omitted_count,
        omitted_rate=_safe_rate(
            accumulator.omitted_count,
            accumulator.accepted_count
            + accumulator.abstained_count
            + accumulator.omitted_count,
        ),
        labeled_batch_count=accumulator.labeled_batch_count,
        unknown_batch_count=accumulator.unknown_batch_count,
        labeled_query_count=accumulator.labeled_query_count,
        unknown_query_count=accumulator.unknown_query_count,
        labeled_returned_prediction_count=accumulator.labeled_returned_prediction_count,
        unknown_returned_prediction_count=accumulator.unknown_returned_prediction_count,
        correct_accepted_count=accumulator.correct_accepted_count,
        wrong_accepted_count=accumulator.wrong_accepted_count,
        error_counts=dict(sorted(accumulator.errors.items())),
        latency_sample_count=len(accumulator.request_latencies_ms),
        latency_p50_ms=_nearest_rank(accumulator.request_latencies_ms, 50),
        latency_p95_ms=_nearest_rank(accumulator.request_latencies_ms, 95),
        latency_p99_ms=_nearest_rank(accumulator.request_latencies_ms, 99),
        rq_breakdown=rq,
        model_ids=tuple(sorted(accumulator.model_ids)),
        model_checksums=model_checksums,
    )


def _validated_checksums(model_checksums: tuple[str, ...] | None) -> tuple[str, ...]:
    if model_checksums is None:
        return ()
    if not isinstance(model_checksums, tuple) or any(
        not isinstance(value, str)
        or not value
        or value.strip() != value
        or len(value) > 1024
        or any(ord(character) < 0x20 or ord(character) == 0x7F for character in value)
        for value in model_checksums
    ):
        raise ValueError("model_checksums must be bounded non-empty strings")
    for value in model_checksums:
        try:
            value.encode("utf-8")
        except UnicodeEncodeError:
            raise ValueError("model_checksums must be strictly UTF-8 encodable") from None
        if any(0xD800 <= ord(character) <= 0xDFFF for character in value):
            raise ValueError("model_checksums must not contain lone surrogates")
    return tuple(sorted(set(model_checksums)))


def replay_batches(
    batches_root: Path,
    client: InferenceClient,
    labels_root: Path | None = None,
    *,
    model_checksums: tuple[str, ...] | None = None,
) -> ReplayReport:
    """Replay sorted schema-v1 batch directories and isolate every batch failure.

    ``model_checksums`` is optional trusted frozen metadata supplied by the caller;
    replay never derives or invents a checkpoint checksum from image/model data.
    """

    batches_root = Path(batches_root)
    labels_root = None if labels_root is None else Path(labels_root)
    checksums = _validated_checksums(model_checksums)
    if not hasattr(client, "match") or not callable(client.match):
        raise TypeError("client must provide match(request)")
    accumulator = _Accumulator()
    batches_descriptor: int | None = None
    labels_descriptor: int | None = None
    try:
        batches_descriptor = _open_directory(batches_root)
        labels_descriptor = (
            None if labels_root is None else _open_directory(labels_root)
        )
    except OSError:
        if batches_descriptor is not None:
            os.close(batches_descriptor)
        raise ValueError("replay roots must be safe existing directories") from None
    try:
        # Names come from the already-open root descriptor. Symlinked directories are
        # deliberately included so opening each batch no-follow can record a stable
        # per-batch containment failure instead of silently skipping them.
        batch_names = sorted(os.listdir(batches_descriptor))
        for batch_name in batch_names:
            try:
                entry_metadata = os.stat(
                    batch_name,
                    dir_fd=batches_descriptor,
                    follow_symlinks=False,
                )
            except OSError:
                continue
            is_directory = stat.S_ISDIR(entry_metadata.st_mode)
            is_symlink = stat.S_ISLNK(entry_metadata.st_mode)
            if not (is_directory or is_symlink):
                continue

            if not _is_safe_component(batch_name):
                accumulator.batch_count += 1
                key = _rq_key(0, 0)
                bucket = _rq_bucket(accumulator, key)
                bucket.batches += 1
                _record_error(accumulator, key, _UNSAFE_BATCH_DIR)
                accumulator.unknown_batch_count += 1
                continue

            try:
                batch_descriptor = os.open(
                    batch_name,
                    _DIRECTORY_OPEN_FLAGS,
                    dir_fd=batches_descriptor,
                )
                if not stat.S_ISDIR(os.fstat(batch_descriptor).st_mode):
                    os.close(batch_descriptor)
                    continue
            except OSError:
                # A directory symlink or a directory swapped after lstat is always a
                # containment failure; no pathname is followed to classify it.
                accumulator.batch_count += 1
                key = _rq_key(0, 0)
                bucket = _rq_bucket(accumulator, key)
                bucket.batches += 1
                _record_error(accumulator, key, _UNSAFE_BATCH_DIR)
                accumulator.unknown_batch_count += 1
                continue

            accumulator.batch_count += 1
            try:
                try:
                    manifest = _read_manifest_once(batch_descriptor)
                except (ManifestError, OSError, ValueError, RecursionError):
                    key = _rq_key(0, 0)
                    bucket = _rq_bucket(accumulator, key)
                    bucket.batches += 1
                    _record_error(accumulator, key, _MALFORMED_MANIFEST)
                    accumulator.unknown_batch_count += 1
                    continue

                # The manifest batchId must be one strict component equal to the
                # descriptor-opened directory name before it can name a label.
                if (
                    manifest.batch_id != batch_name
                    or not _is_safe_component(manifest.batch_id)
                ):
                    key = _rq_key(0, 0)
                    bucket = _rq_bucket(accumulator, key)
                    bucket.batches += 1
                    _record_error(accumulator, key, _UNSAFE_BATCH_DIR)
                    accumulator.unknown_batch_count += 1
                    continue

                references = len(manifest.images)
                queries = len(manifest.images_new)
                key = _rq_key(references, queries)
                bucket = _rq_bucket(accumulator, key)
                bucket.batches += 1
                bucket.queries += queries
                accumulator.query_count += queries

                # Resolve ground truth before any image/request failure so valid
                # complete labels stay labeled on every later terminal path.
                ground_truth, invalid_label = _ground_truth(
                    labels_descriptor,
                    manifest,
                )
                if invalid_label:
                    accumulator.errors[_INVALID_LABEL] += 1
                    bucket.errors[_INVALID_LABEL] += 1

                try:
                    # This is the sole image-read path for both normal and zero-query
                    # batches: one anchored descriptor read per image, with SHA/PNG
                    # validation and base64 derived from those exact bytes.
                    request = _build_request(batch_descriptor, manifest)
                except (ValidationError, OSError, ValueError):
                    _record_error(accumulator, key, _INVALID_BATCH)
                    if ground_truth is None:
                        accumulator.unknown_batch_count += 1
                        accumulator.unknown_query_count += queries
                    else:
                        accumulator.labeled_batch_count += 1
                        accumulator.labeled_query_count += queries
                    continue

                if not manifest.images_new:
                    _record_error(accumulator, key, _MISSING_IMAGES_NEW)
                    if ground_truth is None:
                        accumulator.unknown_batch_count += 1
                    else:
                        accumulator.labeled_batch_count += 1
                    continue

                # Timing starts immediately before the client call and every returned
                # or raised terminal outcome contributes one observed sample.
                started_ns = time.perf_counter_ns()
                accumulator.request_count += 1
                try:
                    response = client.match(request)
                except InferenceClientError as error:
                    elapsed_ms = (time.perf_counter_ns() - started_ns) / 1_000_000.0
                    accumulator.request_latencies_ms.append(elapsed_ms)
                    _record_error(accumulator, key, _client_error_category(error))
                    if ground_truth is None:
                        accumulator.unknown_batch_count += 1
                        accumulator.unknown_query_count += queries
                    else:
                        accumulator.labeled_batch_count += 1
                        accumulator.labeled_query_count += queries
                    continue
                except Exception:
                    elapsed_ms = (time.perf_counter_ns() - started_ns) / 1_000_000.0
                    accumulator.request_latencies_ms.append(elapsed_ms)
                    _record_error(accumulator, key, "client_unexpected")
                    if ground_truth is None:
                        accumulator.unknown_batch_count += 1
                        accumulator.unknown_query_count += queries
                    else:
                        accumulator.labeled_batch_count += 1
                        accumulator.labeled_query_count += queries
                    continue

                elapsed_ms = (time.perf_counter_ns() - started_ns) / 1_000_000.0
                accumulator.request_latencies_ms.append(elapsed_ms)
                accumulator.successful_batch_count += 1
                bucket.successful_batches += 1
                accumulator.model_ids.add(response.model_id)
                _record_predictions(
                    accumulator,
                    bucket,
                    manifest,
                    response,
                    ground_truth,
                )
            finally:
                os.close(batch_descriptor)
    finally:
        if labels_descriptor is not None:
            os.close(labels_descriptor)
        os.close(batches_descriptor)

    return _freeze_report(accumulator, checksums)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m fishing_ml.replay",
        description="Replay schema-v1 fishing batches against a Phase 2 inference endpoint.",
    )
    parser.add_argument("--batches-root", required=True, type=Path)
    parser.add_argument("--labels-root", type=Path)
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--timeout-ms", type=int, default=5000)
    parser.add_argument(
        "--model-checksum",
        action="append",
        default=[],
        help="Optional trusted frozen checksum metadata (repeatable; not derived by replay).",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """Replay batches and print one deterministic sanitized JSON report to stdout."""

    parser = _build_parser()
    args = parser.parse_args(argv)
    try:
        client = InferenceClient(args.endpoint, args.timeout_ms)
        report = replay_batches(
            args.batches_root,
            client,
            args.labels_root,
            model_checksums=tuple(args.model_checksum),
        )
    except (TypeError, ValueError) as error:
        parser.error(str(error))
    print(report.to_json())
    return 0


__all__ = [
    "RQBreakdown",
    "ReplayReport",
    "replay_batches",
    "main",
]


if __name__ == "__main__":
    raise SystemExit(main())
