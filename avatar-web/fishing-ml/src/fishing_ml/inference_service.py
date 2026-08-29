"""HTTP read-only inference service for one verified frozen Phase 2 candidate.

Giai đoạn B — this is the **inference service** (Task 5). It loads EXACTLY ONE
verified frozen candidate at startup (via :func:`load_frozen_matcher`, which calls
``evaluate._inputs`` → ``verify_freeze``) and answers contract-shaped (Task 4)
inference requests in-memory. No ML training, game/client code, per-request model
selection, or image persistence is part of this module.

The wire contract (:mod:`fishing_ml.inference_contract`) is composed, never
modified. The heavy (torch) modules — ``evaluate``, ``model``, ``calibrate``,
``metrics`` — are imported lazily inside functions so this module can be imported
for structural checks without torch installed.

Safety invariants:
- No game/client/opcode imports.
- Decoded PNG pixels live only in request memory; nothing is written to disk or
  telemetry.
- Error bodies contain only ``code`` + ``reason``; images, base64, account
  identity, credentials, cookies, and raw packets are never logged.
- Exactly one frozen candidate is loaded at startup; requests cannot select a
  model. Missing/tampered/nonmatching frozen directories fail closed.
"""

from __future__ import annotations

import argparse
import json
import threading
import time
from base64 import b64decode
from collections.abc import Mapping
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from typing import TYPE_CHECKING, Any, Callable
from urllib.parse import urlparse

from .inference_contract import (
    ContractError,
    InferencePrediction,
    InferenceResponse,
    parse_request,
    serialize_response,
)

if TYPE_CHECKING:
    import torch

    from .calibrate import Thresholds
    from .dataset import NormalizationStats
    from .model import FishingEncoder

    _MatcherDevice = torch.device
else:
    _MatcherDevice = Any
    FishingEncoder = Any
    NormalizationStats = Any
    Thresholds = Any


# Inference mount path. The Python service and the Node shadow client (Task 7/8)
# both POST contract requests here.
_INFER_PATH = "/infer"

# Only an actual body-size violation maps to HTTP 413. Image count and all other
# contract violations are malformed/invalid requests and map to HTTP 400.
_SIZE_CODES = frozenset({"body_too_large", "too_many_images"})


class _RequestTimeout(Exception):
    """Raised when in-memory inference exceeds the per-request timeout."""


@dataclass(frozen=True, slots=True)
class InferenceServerConfig:
    """Bounded configuration for the inference HTTP server."""

    host: str
    port: int
    frozen_dir: Path
    max_body_bytes: int
    timeout_ms: int

    def __post_init__(self) -> None:
        if isinstance(self.port, bool) or not isinstance(self.port, int) or not 0 <= self.port <= 65535:
            raise ValueError("port must be an integer from 0 through 65535")
        if (
            isinstance(self.max_body_bytes, bool)
            or not isinstance(self.max_body_bytes, int)
            or self.max_body_bytes <= 0
        ):
            raise ValueError("max_body_bytes must be a positive integer")
        if (
            isinstance(self.timeout_ms, bool)
            or not isinstance(self.timeout_ms, int)
            or self.timeout_ms <= 0
        ):
            raise ValueError("timeout_ms must be a positive integer")


@dataclass(frozen=True, slots=True)
class FrozenMatcher:
    """The single verified frozen candidate, loaded once at startup.

    Carries everything the in-memory inference path needs; ``model_id`` is the
    frozen manifest's ``runId`` (the current artifact format stores this in
    ``freeze-manifest.json``).
    """

    model: FishingEncoder
    stats: NormalizationStats
    thresholds: Thresholds
    device: _MatcherDevice
    model_id: str


def load_frozen_matcher(frozen_dir: Path) -> FrozenMatcher:
    """Load + verify EXACTLY ONE frozen candidate ONCE.

    Calls ``evaluate._inputs``, which internally calls ``verify_freeze`` (hash +
    manifest checks). Missing/tampered/nonmatching frozen directories raise
    ``ValueError``/``ManifestError`` from that path and propagate as a startup
    failure; this function does not catch-and-continue.
    """
    from . import evaluate

    frozen_dir = Path(frozen_dir)
    config_doc, stats, thresholds, model, device = evaluate._inputs(frozen_dir)

    # The current task-3 artifact stores runId/gitRevision in the verified freeze
    # manifest. A future _inputs implementation may expose runId in config_doc,
    # so support that shape too without a second verification/load call.
    manifest_doc: Mapping[str, object] | None = None
    manifest_path = frozen_dir / "freeze-manifest.json"
    if manifest_path.is_file():
        from .schema import read_json

        raw_manifest = read_json(manifest_path)
        if not isinstance(raw_manifest, Mapping):
            raise ValueError("frozen manifest must be an object")
        manifest_doc = raw_manifest

        # verify_freeze validates the manifest's revision format and file
        # inventory. Also reject a valid-but-different revision here: the
        # service must not run a candidate produced from another checkout.
        revision = manifest_doc.get("gitRevision")
        if not isinstance(revision, str) or revision != evaluate._git():
            raise RuntimeError("frozen Git revision does not match current revision")

    config_model_id = config_doc.get("runId") if isinstance(config_doc, Mapping) else None
    manifest_model_id = manifest_doc.get("runId") if manifest_doc is not None else None
    if manifest_model_id is not None and not isinstance(manifest_model_id, str):
        raise ValueError("frozen manifest runId must be a string")
    if config_model_id is not None and not isinstance(config_model_id, str):
        raise ValueError("model-config runId must be a string")
    if config_model_id and manifest_model_id and config_model_id != manifest_model_id:
        raise ValueError("frozen runId values do not match")
    model_id = manifest_model_id or config_model_id
    if not isinstance(model_id, str) or not model_id:
        raise ValueError("frozen candidate missing a non-empty runId")

    return FrozenMatcher(
        model=model,
        stats=stats,
        thresholds=thresholds,
        device=device,
        model_id=model_id,
    )


def _numpy() -> Any:
    import numpy

    return numpy


def _image_class() -> Any:
    from PIL import Image

    return Image


def _normalization_tensors(stats: Any, torch: Any) -> tuple[Any, Any]:
    """Validate frozen RGB statistics and return ``(mean, std)`` as ``[3,1,1]``."""
    try:
        mean = tuple(stats.mean)
        std = tuple(stats.std)
    except (AttributeError, TypeError):
        raise ValueError("normalization statistics must provide mean and std") from None
    if len(mean) != 3 or len(std) != 3:
        raise ValueError("normalization statistics must contain exactly three values")
    np = _numpy()
    try:
        mean_array = np.asarray(mean, dtype=np.float64)
        std_array = np.asarray(std, dtype=np.float64)
    except (TypeError, ValueError):
        raise ValueError("normalization statistics must be numeric") from None
    if (
        not np.isfinite(mean_array).all()
        or not np.isfinite(std_array).all()
        or (mean_array < 0).any()
        or (mean_array > 1).any()
        or (std_array <= 0).any()
        or (std_array > 1).any()
    ):
        raise ValueError("normalization statistics contain non-finite or out-of-range values")
    return (
        torch.tensor(mean_array, dtype=torch.float32).view(3, 1, 1),
        torch.tensor(std_array, dtype=torch.float32).view(3, 1, 1),
    )


def _decode_image_tensor(png_base64: str, mean_t: Any, std_t: Any) -> Any:
    """Decode a contract-validated PNG into a normalized ``[3,75,75]`` tensor.

    The contract already guaranteed the PNG is 75×75 RGB/RGBA and the base64 is
    valid, so this re-decodes in-memory and normalizes with the frozen candidate's
    ``(mean, std)`` stats viewed as ``(3,1,1)``. No file path is involved.
    """
    import torch

    raw = b64decode(png_base64, validate=True)
    np = _numpy()
    Image = _image_class()
    with Image.open(BytesIO(raw)) as img:
        img = img.convert("RGB")
        array = np.asarray(img, dtype=np.float32) / 255.0
    tensor = torch.from_numpy(array).permute(2, 0, 1).contiguous()
    return (tensor - mean_t) / std_t


def _apply_thresholds_compat(rows: tuple[Any, ...], thresholds: Any) -> tuple[Any, ...]:
    """Apply the shared calibrator while preserving the contract's sentinel fields.

    ``calibrate.apply_thresholds`` deliberately validates the dataset ``Prediction``
    shape, which requires a non-empty batch id and a non-negative expected index.
    Inference has no labeled batch or expected index, so it first calibrates
    validation-only surrogate rows and copies only each resulting ``accepted``
    flag back to the exact unlabeled rows required by the service contract.
    """
    from .calibrate import apply_thresholds
    from .metrics import Prediction

    calibrated_rows: list[Any] = []
    for index, row in enumerate(rows):
        # Prefer the exact unlabeled row requested by the service contract. The
        # current shared calibrator also runs dataset metric validation, which
        # rejects batch_id="" / expected_img_index=-1; in that version, retry
        # with a validation-only surrogate and copy only its accepted flag back.
        try:
            calibrated_rows.append(apply_thresholds((row,), thresholds)[0])
            continue
        except ValueError as error:
            if str(error) != "prediction batch_id must be non-empty":
                raise

        surrogate = Prediction(
            batch_id=f"inference-{index}",
            new_index=0,
            expected_img_index=row.predicted_img_index,
            predicted_img_index=row.predicted_img_index,
            similarity=row.similarity,
            margin=row.margin,
            accepted=True,
        )
        calibrated_rows.append(apply_thresholds((surrogate,), thresholds)[0])

    return tuple(
        type(row)(
            batch_id=row.batch_id,
            new_index=row.new_index,
            expected_img_index=row.expected_img_index,
            predicted_img_index=row.predicted_img_index,
            similarity=row.similarity,
            margin=row.margin,
            accepted=calibrated_rows[index].accepted,
        )
        for index, row in enumerate(rows)
    )


def _infer(matcher: FrozenMatcher, request: Any) -> tuple[InferencePrediction, ...]:
    """Run in-memory inference for one validated request (mirrors ``train.predict_episodes``)."""
    import torch

    from . import model as model_mod
    from .metrics import Prediction

    if not request.references or not request.queries:
        raise ContractError("empty_images", "references and queries must not be empty")

    mean_t, std_t = _normalization_tensors(matcher.stats, torch)
    references = torch.stack(
        [_decode_image_tensor(image.png_base64, mean_t, std_t) for image in request.references]
    )
    queries = torch.stack(
        [_decode_image_tensor(image.png_base64, mean_t, std_t) for image in request.queries]
    )

    # Keep the exact inference ordering: references first, queries second, then
    # query-to-reference cosine scores and top-1/top-2 values.
    with torch.no_grad():
        reference_embeddings = matcher.model(references.to(matcher.device))
        query_embeddings = matcher.model(queries.to(matcher.device))
        similarities = model_mod.cosine_similarity_matrix(query_embeddings, reference_embeddings)

    scores, indices = similarities.max(dim=1)
    top_two = torch.topk(similarities, 2).values if similarities.shape[1] > 1 else None
    rows: list[Prediction] = []
    for query_index in range(len(request.queries)):
        margin: float | None = None
        if top_two is not None:
            margin = float((top_two[query_index, 0] - top_two[query_index, 1]).cpu())
        rows.append(
            Prediction(
                batch_id="",
                new_index=query_index,
                expected_img_index=-1,
                predicted_img_index=int(indices[query_index].cpu()),
                similarity=float(scores[query_index].cpu()),
                margin=margin,
                accepted=True,
            )
        )

    calibrated = _apply_thresholds_compat(tuple(rows), matcher.thresholds)
    return tuple(
        InferencePrediction(
            query_index=prediction.new_index,
            reference_index=prediction.predicted_img_index,
            similarity=prediction.similarity,
            margin=prediction.margin,
            accepted=prediction.accepted,
        )
        for prediction in calibrated
    )


def _parse_and_infer(matcher: FrozenMatcher, raw_body: bytes) -> tuple[InferencePrediction, ...]:
    """Parse a bounded JSON body and infer within the same timeout budget."""
    try:
        document = json.loads(raw_body)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise ContractError("bad_json", "request body is not valid JSON") from None
    request = parse_request(document)
    return _infer(matcher, request)


def _with_timeout(timeout_ms: int, function: Callable[..., Any], *args: Any) -> Any:
    """Run ``function`` on a worker thread, raising if it overruns.

    A stuck inference cannot keep the serving/request thread alive indefinitely.
    The worker is daemonized because Python cannot safely cancel arbitrary torch
    work; a timed-out request gets a bounded response while the worker winds down.
    """
    if timeout_ms <= 0:
        raise ValueError("timeout_ms must be positive")

    box: dict[str, Any] = {}

    def target() -> None:
        try:
            box["value"] = function(*args)
        except BaseException as error:  # noqa: BLE001 - surfaced to caller below
            box["error"] = error

    worker = threading.Thread(target=target, daemon=True)
    worker.start()
    worker.join(timeout_ms / 1000.0)
    if worker.is_alive():
        raise _RequestTimeout()
    if "error" in box:
        raise box["error"]
    return box["value"]


def _read_body(handler: BaseHTTPRequestHandler, max_body_bytes: int) -> bytes:
    """Read the request body, enforcing ``max_body_bytes`` before JSON parsing."""
    if max_body_bytes <= 0:
        raise ValueError("max_body_bytes must be positive")

    transfer_encoding = handler.headers.get("Transfer-Encoding")
    if transfer_encoding and transfer_encoding.lower() != "identity":
        raise ContractError("bad_request", "unsupported transfer encoding")

    length_value = handler.headers.get("Content-Length")
    if length_value is not None:
        try:
            declared = int(length_value)
        except (TypeError, ValueError):
            raise ContractError("bad_request", "invalid Content-Length") from None
        if declared < 0:
            raise ContractError("bad_request", "invalid Content-Length")
        if declared > max_body_bytes:
            raise ContractError("body_too_large", "request body exceeds size limit")
        body = handler.rfile.read(declared)
        if len(body) != declared:
            raise ContractError("bad_request", "request body is truncated")
        return body

    # Some test/embedded handlers do not provide Content-Length. Bound that
    # fallback read too, and fail as soon as max_body_bytes+1 bytes arrive; do not
    # read an additional byte, which could block on a keep-alive connection.
    chunks: list[bytes] = []
    total = 0
    while total <= max_body_bytes:
        chunk = handler.rfile.read(min(65536, max_body_bytes + 1 - total))
        if not chunk:
            break
        chunks.append(chunk)
        total += len(chunk)
        if total > max_body_bytes:
            raise ContractError("body_too_large", "request body exceeds size limit")
    return b"".join(chunks)


def _status_for_code(code: str) -> int:
    return 413 if code in _SIZE_CODES else 400


def _make_handler(matcher: FrozenMatcher, config: InferenceServerConfig):
    """Build a request handler bound to the loaded matcher and server config."""
    read_timeout = config.timeout_ms / 1000.0

    class _Handler(BaseHTTPRequestHandler):
        _matcher = matcher
        _config = config
        server_version = "fishing-phase2-inference/1.0"
        timeout = read_timeout

        def _send_json(self, status: int, payload: Mapping[str, object]) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, _format: str, *_args: Any) -> None:
            # Disable BaseHTTPRequestHandler access logging entirely. The request
            # line can contain user-controlled query text, and must never become
            # telemetry alongside image/base64 or identity data.
            return

        def do_GET(self) -> None:
            self._send_json(405, {"code": "method_not_allowed", "reason": "use POST"})

        def do_POST(self) -> None:
            started = time.monotonic()
            try:
                if urlparse(self.path).path != _INFER_PATH:
                    self._send_json(404, {"code": "not_found", "reason": "unknown path"})
                    return
                raw = _read_body(self, config.max_body_bytes)
                predictions = _with_timeout(config.timeout_ms, _parse_and_infer, matcher, raw)
                response = InferenceResponse(
                    schema_version=1,
                    model_id=matcher.model_id,
                    predictions=predictions,
                    latency_ms=int((time.monotonic() - started) * 1000),
                )
                self._send_json(200, serialize_response(response))
            except ContractError as error:
                self._send_json(
                    _status_for_code(error.code),
                    {"code": error.code, "reason": error.reason},
                )
            except _RequestTimeout:
                self._send_json(
                    504, {"code": "timeout", "reason": "request exceeded time limit"}
                )
            except Exception:  # noqa: BLE001 - never leak internals/images/identity
                self._send_json(
                    500, {"code": "internal_error", "reason": "inference failed"}
                )

    return _Handler


def serve(config: InferenceServerConfig) -> None:
    """Blocking loop: load one frozen candidate, then serve bounded requests."""
    matcher = load_frozen_matcher(config.frozen_dir)
    handler = _make_handler(matcher, config)
    httpd = ThreadingHTTPServer((config.host, config.port), handler)
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()


def main(argv: list[str] | None = None) -> int:
    """Console entry point for the ``fishing-phase2-inference-service`` script."""
    parser = argparse.ArgumentParser(
        description="Serve a frozen Phase 2 fishing matcher for read-only inference."
    )
    parser.add_argument("--host", default="127.0.0.1", help="Bind host")
    parser.add_argument("--port", type=int, default=8080, help="Bind port")
    parser.add_argument(
        "--frozen-dir",
        type=Path,
        required=True,
        help="Path to the verified frozen candidate directory (Task 3 artifact)",
    )
    parser.add_argument(
        "--max-body-bytes",
        type=int,
        default=960000,
        help="Reject request bodies larger than this many bytes (before parsing)",
    )
    parser.add_argument(
        "--timeout-ms",
        type=int,
        default=5000,
        help="Per-request inference timeout in milliseconds",
    )
    args = parser.parse_args(argv)

    try:
        config = InferenceServerConfig(
            host=args.host,
            port=args.port,
            frozen_dir=args.frozen_dir,
            max_body_bytes=args.max_body_bytes,
            timeout_ms=args.timeout_ms,
        )
    except ValueError as error:
        parser.error(str(error))
    serve(config)
    return 0


__all__ = [
    "InferenceServerConfig",
    "FrozenMatcher",
    "load_frozen_matcher",
    "serve",
    "main",
]


if __name__ == "__main__":
    raise SystemExit(main())
