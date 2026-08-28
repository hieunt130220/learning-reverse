"""Strictly-typed, validated request/response/error schema for the Phase 2
fishing matcher inference service.

Giai đoạn B — this is the **wire contract** both the Python inference service
(Task 5) and the Node shadow client (Task 7/8) must speak. It contains **no ML,
no HTTP server, and no image persistence** — only validation + serialization.

PNG bytes are decoded in-memory for validation only; they are never written to
disk, never placed in telemetry, and never echoed back in error messages.

Phase 2 is strictly additive. This module composes (never modifies) the existing
Phase A / Phase 2 schema helpers in :mod:`fishing_ml.schema` and
:mod:`fishing_ml.dataset_version`. No TX / opcode module is imported.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import math
import sys
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image

from .schema import (
    EXPECTED_SIZE,
    PNG_SIGNATURE,
    ManifestError,
    read_json,
)

# The contract only ever speaks schema version 1 (mirrors Phase A SCHEMA_VERSION).
SCHEMA_VERSION = 1

# Per-list image count cap. References and queries are each bounded to 64; the
# index-contiguity rule means indices are 0..63, so 64 is the natural ceiling.
_MAX_IMAGES = 64

# Total decoded-PNG-byte budget across references + queries. 75x75 RGBA raw is
# 22500 bytes; PNG is compressed so actual file bytes are smaller. (64+64)*7500
# = 960000 gives generous slack while still bounding runaway payloads.
_MAX_BODY_BYTES = (64 + 64) * 7500

# Exact top-level request keys (camelCase — unknown keys rejected).
_REQUEST_KEYS = frozenset({"schemaVersion", "references", "queries"})
# Exact per-image entry keys.
_IMAGE_KEYS = frozenset({"index", "pngBase64"})
# Exact top-level response keys.
_RESPONSE_KEYS = frozenset({"schemaVersion", "modelId", "predictions", "latencyMs"})
# Exact per-prediction keys.
_PREDICTION_KEYS = frozenset(
    {"queryIndex", "referenceIndex", "similarity", "margin", "accepted"}
)


class ContractError(ValueError):
    """A stable, machine-mappable contract violation.

    Carries a short ``code`` (stable string for HTTP-status mapping in Task 5)
    and a ``reason`` (human-readable, but NEVER containing image bytes/base64,
    account identity, credentials, cookies, or raw packets).
    """

    def __init__(self, code: str, reason: str) -> None:
        super().__init__(reason)
        self.code = code
        self.reason = reason

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.code}: {self.reason}"


@dataclass(frozen=True, slots=True)
class InferenceImage:
    """One reference/query image: a contiguous index plus base64 PNG payload."""

    index: int
    png_base64: str


@dataclass(frozen=True, slots=True)
class InferenceRequest:
    """A validated inference request: references + queries (in-memory only)."""

    schema_version: int
    references: tuple[InferenceImage, ...]
    queries: tuple[InferenceImage, ...]


@dataclass(frozen=True, slots=True)
class InferencePrediction:
    """One prediction row for a query against a reference."""

    query_index: int
    reference_index: int
    similarity: float
    margin: float | None
    accepted: bool


@dataclass(frozen=True, slots=True)
class InferenceResponse:
    """A validated inference response returned by the service."""

    schema_version: int
    model_id: str
    predictions: tuple[InferencePrediction, ...]
    latency_ms: int


def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _is_finite_number(value: object) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    )


def _decode_and_validate_png(b64: object, body_seen: list[int]) -> None:
    """Decode ``b64`` in-memory, assert PNG signature, 75x75 RGB/RGBA.

    Accumulates the decoded byte count into ``body_seen[0]`` and enforces the
    total body budget. Never writes to disk; never echoes pixels/base64.
    """
    if not isinstance(b64, str):
        raise ContractError("bad_type", "pngBase64 must be a string")
    try:
        raw = base64.b64decode(b64, validate=True)
    except Exception:  # noqa: BLE001 - base64/validate raise varied types
        raise ContractError("bad_base64", "pngBase64 is not valid base64")

    body_seen[0] += len(raw)
    if body_seen[0] > _MAX_BODY_BYTES:
        raise ContractError("body_too_large", "total decoded PNG bytes exceed limit")

    if not raw.startswith(PNG_SIGNATURE):
        raise ContractError("not_png", "image is not a PNG (bad signature)")

    try:
        with Image.open(io.BytesIO(raw)) as img:
            img.load()  # fully decode pixels (catches truncated/corrupt files)
            if img.mode not in ("RGB", "RGBA"):
                raise ContractError("bad_png_mode", "image mode must be RGB/RGBA")
            if img.size != EXPECTED_SIZE:
                raise ContractError("bad_png_size", "image must be 75x75")
    except ContractError:
        raise
    except Exception:  # noqa: BLE001 - Pillow raises varied types on corruption
        raise ContractError("not_png", "image is not a decodable PNG")


def _parse_images(raw: object, field: str, body_seen: list[int]) -> tuple[InferenceImage, ...]:
    """Parse + validate one image list, enforcing contiguity/uniqueness.

    Mirrors :func:`schema._parse_image_entries`: indices must be unique within
    the list and contiguous from 0 (0..n-1). Also enforces the per-list count
    cap and the shared body budget.
    """
    if not isinstance(raw, list):
        raise ContractError("bad_type", f"{field} must be a list")
    if len(raw) > _MAX_IMAGES:
        raise ContractError("too_many_images", f"{field} exceeds {_MAX_IMAGES} images")

    images: list[InferenceImage] = []
    seen: set[int] = set()
    for i, item in enumerate(raw):
        if not isinstance(item, dict):
            raise ContractError("bad_type", f"{field}[{i}] must be an object")
        present = set(item.keys())
        if present != _IMAGE_KEYS:
            missing = _IMAGE_KEYS - present
            unknown = present - _IMAGE_KEYS
            parts: list[str] = []
            if missing:
                parts.append(f"missing {sorted(missing)}")
            if unknown:
                parts.append(f"unknown {sorted(unknown)}")
            raise ContractError("unknown_field", f"{field}[{i}]: {'; '.join(parts)}")

        index = item["index"]
        if not _is_int(index) or index < 0:
            raise ContractError("bad_type", f"{field}[{i}].index must be a non-negative int")
        if index in seen:
            raise ContractError("duplicate_index", f"{field} has duplicate index {index}")
        seen.add(index)

        # Decode/validate PNG in-memory (counted against shared body budget).
        _decode_and_validate_png(item["pngBase64"], body_seen)

        images.append(InferenceImage(index=index, png_base64=item["pngBase64"]))

    indices = [img.index for img in images]
    if indices != list(range(len(indices))):
        raise ContractError(
            "not_contiguous", f"{field} indices must be contiguous from 0"
        )
    return tuple(images)


def parse_request(value: Mapping[str, object]) -> InferenceRequest:
    """Strictly parse a raw request JSON object into an :class:`InferenceRequest`.

    Raises :class:`ContractError` on any invalid input — never returns a sentinel.
    """
    if not isinstance(value, Mapping):
        raise ContractError("bad_type", "request must be a JSON object")

    present = set(value.keys())
    if present != _REQUEST_KEYS:
        missing = _REQUEST_KEYS - present
        unknown = present - _REQUEST_KEYS
        parts: list[str] = []
        if missing:
            parts.append(f"missing {sorted(missing)}")
        if unknown:
            parts.append(f"unknown {sorted(unknown)}")
        raise ContractError("unknown_field", "; ".join(parts))

    schema_version = value["schemaVersion"]
    if not _is_int(schema_version):
        raise ContractError("bad_type", "schemaVersion must be an int")
    if schema_version != SCHEMA_VERSION:
        raise ContractError(
            "unsupported_schema_version",
            f"unsupported schemaVersion {schema_version} (expected {SCHEMA_VERSION})",
        )

    # Shared body budget across both lists (refs + queries).
    body_seen = [0]
    references = _parse_images(value["references"], "references", body_seen)
    queries = _parse_images(value["queries"], "queries", body_seen)

    return InferenceRequest(
        schema_version=schema_version,
        references=references,
        queries=queries,
    )


def serialize_response(response: InferenceResponse) -> dict[str, object]:
    """Serialize a response to the canonical camelCase wire document."""
    return {
        "schemaVersion": response.schema_version,
        "modelId": response.model_id,
        "predictions": [
            {
                "queryIndex": p.query_index,
                "referenceIndex": p.reference_index,
                "similarity": p.similarity,
                "margin": p.margin,
                "accepted": p.accepted,
            }
            for p in response.predictions
        ],
        "latencyMs": response.latency_ms,
    }


def _parse_prediction(item: object, i: int) -> InferencePrediction:
    if not isinstance(item, dict):
        raise ContractError("bad_type", f"predictions[{i}] must be an object")
    present = set(item.keys())
    if present != _PREDICTION_KEYS:
        missing = _PREDICTION_KEYS - present
        unknown = present - _PREDICTION_KEYS
        parts: list[str] = []
        if missing:
            parts.append(f"missing {sorted(missing)}")
        if unknown:
            parts.append(f"unknown {sorted(unknown)}")
        raise ContractError("unknown_field", f"predictions[{i}]: {'; '.join(parts)}")

    query_index = item["queryIndex"]
    if not _is_int(query_index) or query_index < 0:
        raise ContractError("bad_type", f"predictions[{i}].queryIndex must be a non-negative int")

    reference_index = item["referenceIndex"]
    if not _is_int(reference_index) or reference_index < 0:
        raise ContractError(
            "bad_type", f"predictions[{i}].referenceIndex must be a non-negative int"
        )

    similarity = item["similarity"]
    if not _is_finite_number(similarity):
        raise ContractError("non_finite", f"predictions[{i}].similarity must be a finite number")

    margin = item["margin"]
    if margin is not None and not _is_finite_number(margin):
        raise ContractError(
            "non_finite", f"predictions[{i}].margin must be a finite number or null"
        )

    accepted = item["accepted"]
    if not isinstance(accepted, bool):
        raise ContractError("bad_type", f"predictions[{i}].accepted must be a boolean")

    return InferencePrediction(
        query_index=query_index,
        reference_index=reference_index,
        similarity=float(similarity),
        margin=None if margin is None else float(margin),
        accepted=accepted,
    )


def validate_response(value: Mapping[str, object]) -> InferenceResponse:
    """Strictly parse a raw response JSON object into an :class:`InferenceResponse`.

    Raises :class:`ContractError` on any invalid input. Validates the same
    schema that :func:`serialize_response` emits.
    """
    if not isinstance(value, Mapping):
        raise ContractError("bad_type", "response must be a JSON object")

    present = set(value.keys())
    if present != _RESPONSE_KEYS:
        missing = _RESPONSE_KEYS - present
        unknown = present - _RESPONSE_KEYS
        parts: list[str] = []
        if missing:
            parts.append(f"missing {sorted(missing)}")
        if unknown:
            parts.append(f"unknown {sorted(unknown)}")
        raise ContractError("unknown_field", "; ".join(parts))

    schema_version = value["schemaVersion"]
    if not _is_int(schema_version):
        raise ContractError("bad_type", "schemaVersion must be an int")
    if schema_version != SCHEMA_VERSION:
        raise ContractError(
            "unsupported_schema_version",
            f"unsupported schemaVersion {schema_version} (expected {SCHEMA_VERSION})",
        )

    model_id = value["modelId"]
    # The service's frozen-candidate identity (from Task 3 ExperimentSpec.run_id)
    # is echoed verbatim. We accept whatever string we are given — no scheme here.
    if not isinstance(model_id, str):
        raise ContractError("bad_type", "modelId must be a string")

    raw_predictions = value["predictions"]
    if not isinstance(raw_predictions, list):
        raise ContractError("bad_type", "predictions must be a list")
    predictions = tuple(
        _parse_prediction(item, i) for i, item in enumerate(raw_predictions)
    )

    latency_ms = value["latencyMs"]
    if not _is_int(latency_ms) or latency_ms < 0:
        raise ContractError("bad_type", "latencyMs must be a non-negative int")

    return InferenceResponse(
        schema_version=schema_version,
        model_id=model_id,
        predictions=predictions,
        latency_ms=latency_ms,
    )


def _main_check(command: str, path: Path) -> None:
    data = read_json(path)  # raises ManifestError (path only — no image data)
    if command == "check-request":
        parse_request(data)
    else:
        validate_response(data)


def main(argv: list[str] | None = None) -> int:
    """Console entry point: ``check-request`` / ``check-response`` a JSON doc.

    Prints ``ok`` on acceptance, ``rejected: <code> <reason>`` on rejection, and
    exits non-zero on rejection. Error output never contains image bytes/base64.
    """
    parser = argparse.ArgumentParser(
        description="Verify a fishing inference contract document (strict, no ML)."
    )
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("check-request", "check-response"):
        sp = sub.add_parser(name, help=f"Validate a {name.split('-')[1]} JSON document")
        sp.add_argument("path", type=Path, help="Path to the JSON document")

    args = parser.parse_args(argv)

    try:
        _main_check(args.command, args.path)
    except ContractError as error:
        print(f"rejected: {error.code} {error.reason}")
        return 1
    except (OSError, ValueError, ManifestError) as error:
        print(f"rejected: bad_input {error}")
        return 1
    print("ok")
    return 0


__all__ = [
    "SCHEMA_VERSION",
    "ContractError",
    "InferenceImage",
    "InferenceRequest",
    "InferencePrediction",
    "InferenceResponse",
    "parse_request",
    "serialize_response",
    "validate_response",
    "main",
]


if __name__ == "__main__":
    raise SystemExit(main())
