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
import os
import socket
import subprocess
import threading
import time
from base64 import b64decode
from collections.abc import Mapping
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from typing import TYPE_CHECKING, Any, Callable
from urllib.parse import urlparse

from .inference_contract import (
    ContractError,
    InferencePrediction,
    InferenceResponse,
    MAX_CANONICAL_REQUEST_BYTES,
    parse_request,
    serialize_response,
)
from .provenance import revision_matches_recorded

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


# Upper safety cap for the CLI override so an operator cannot inadvertently
# remove the body bound entirely.
_MAX_BODY_OVERRIDE_CAP = MAX_CANONICAL_REQUEST_BYTES * 2

# Inference mount path. The Python service and the Node shadow client (Task 7/8)
# both POST contract requests here.
_INFER_PATH = "/infer"

# Only an actual body-size violation maps to HTTP 413. Image count and all other
# contract violations are malformed/invalid requests and map to HTTP 400.
_SIZE_CODES = frozenset({"body_too_large"})

# A process-wide cap prevents timed-out inference workers from accumulating.
# The slot is released only after the worker actually exits.
_MAX_INFERENCE_WORKERS = 1
_INFERENCE_SLOTS = threading.BoundedSemaphore(_MAX_INFERENCE_WORKERS)


class _QuietThreadingHTTPServer(ThreadingHTTPServer):
    """Threaded server that never emits request tracebacks or access data."""

    def handle_error(self, _request: Any, _client_address: Any) -> None:
        # BaseServer would print a traceback for an exception raised while a
        # handler is being constructed or after a disconnect. There is no safe
        # response channel in that case, so close quietly instead of logging
        # request-adjacent data.
        return


class _RequestTimeout(Exception):
    """Raised when a body read or in-memory inference exceeds its deadline."""


class _ClientDisconnected(Exception):
    """Raised when a peer closes the connection during request parsing."""


class _InferenceBusy(Exception):
    """Raised when the single bounded inference slot is still occupied."""


class _DeadlineReader:
    """Unbuffered request reader enforcing one absolute connection deadline."""

    def __init__(self, raw: Any, connection: Any, deadline: float) -> None:
        self._raw = raw
        self._connection = connection
        self._deadline = deadline

    def settimeout(self, _timeout: float | None) -> None:
        # The absolute deadline controls every parser/body read; ignore any
        # resettable timeout requested by an underlying parser.
        return

    def _read_once(self, size: int) -> bytes:
        remaining = self._deadline - time.monotonic()
        if remaining <= 0:
            raise _RequestTimeout()
        try:
            self._connection.settimeout(remaining)
            value = self._raw.read(size)
        except (socket.timeout, TimeoutError):
            raise _RequestTimeout() from None
        except OSError:
            # A peer disconnect is a closed request, not a server error. Keep
            # parser failures from escaping into the serving loop/logging path.
            raise _ClientDisconnected() from None
        return b"" if value is None else value

    def read(self, size: int = -1) -> bytes:
        if size == 0:
            return b""
        if size < 0:
            raise ValueError("unbounded request reads are not supported")
        return self._read_once(size)

    def readline(self, size: int = -1) -> bytes:
        if size == 0:
            return b""
        line = bytearray()
        while size < 0 or len(line) < size:
            chunk = self._read_once(1)
            if not chunk:
                break
            line.extend(chunk)
            if chunk == b"\n":
                break
        return bytes(line)

    def read1(self, size: int = -1) -> bytes:
        return self.read(size)

    def readinto(self, buffer: Any) -> int:
        value = self.read(len(buffer))
        buffer[: len(value)] = value
        return len(value)

    def readable(self) -> bool:
        return True

    def fileno(self) -> int:
        return self._raw.fileno()

    def close(self) -> None:
        self._raw.close()

    def __getattr__(self, name: str) -> Any:
        return getattr(self._raw, name)


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
            or not 1 <= self.max_body_bytes <= _MAX_BODY_OVERRIDE_CAP
        ):
            raise ValueError(
                f"max_body_bytes must be an integer from 1 through {_MAX_BODY_OVERRIDE_CAP}"
            )
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


def _current_git_revision() -> str:
    """Resolve HEAD from this source tree, not the process CWD.

    ``evaluate._git`` intentionally follows the caller's Git working directory;
    the service is a long-running entry point and must not change that shared
    policy. Resolve the package repository explicitly for this fail-closed check.
    """
    root = Path(__file__).resolve().parents[4]
    try:
        return subprocess.run(
            ["git", "-C", str(root), "rev-parse", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError) as error:
        raise RuntimeError("frozen service requires a readable Git revision") from error


def _is_git_ancestor(ancestor: str, descendant: str) -> bool:
    """Check if ancestor is an ancestor commit of descendant in this repository."""
    root = Path(__file__).resolve().parents[4]
    try:
        res = subprocess.run(
            ["git", "-C", str(root), "merge-base", "--is-ancestor", ancestor, descendant],
            check=False,
            capture_output=True,
        )
        return res.returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def load_frozen_matcher(frozen_dir: Path) -> FrozenMatcher:
    """Load + verify EXACTLY ONE frozen candidate ONCE.

    Calls ``evaluate._inputs``, which internally calls ``verify_frozen_bundle``
    (schema-dispatched hash + manifest checks). Missing/tampered/nonmatching frozen directories raise
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

        # verify_frozen_bundle validates the manifest's revision format and file
        # inventory. Also reject a valid-but-different revision here: the
        # service must not run a candidate produced from another checkout.
        revision = manifest_doc.get("gitRevision")
        current_rev = _current_git_revision()
        allow_mismatch = os.environ.get("FISHING_ALLOW_REVISION_MISMATCH") == "1"
        if not (
            revision_matches_recorded(current_rev, revision)
            or (isinstance(revision, str) and _is_git_ancestor(revision, current_rev))
            or allow_mismatch
        ):
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
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError, ValueError):
        raise ContractError("bad_json", "request body is not valid JSON") from None
    request = parse_request(document)
    return _infer(matcher, request)



def _with_timeout(
    timeout_ms: int,
    function: Callable[..., Any],
    *args: Any,
    deadline: float | None = None,
) -> Any:
    """Run one inference worker with a bounded slot and absolute deadline.

    A timed-out worker cannot be safely cancelled from Python. It therefore
    retains the single inference slot until it really exits; concurrent or
    subsequent requests fail fast rather than creating an unbounded thread
    population. When ``deadline`` is supplied, it is authoritative over the
    relative timeout and is checked both before starting and after joining.
    """
    if timeout_ms <= 0:
        raise ValueError("timeout_ms must be positive")
    wait_seconds = timeout_ms / 1000.0
    if deadline is not None:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise _RequestTimeout()
        wait_seconds = min(wait_seconds, remaining)
    if not _INFERENCE_SLOTS.acquire(blocking=False):
        if deadline is not None and deadline <= time.monotonic():
            raise _RequestTimeout()
        raise _InferenceBusy()

    box: dict[str, Any] = {}
    release_lock = threading.Lock()
    slot_released = False

    def release_slot() -> None:
        nonlocal slot_released
        with release_lock:
            if not slot_released:
                slot_released = True
                _INFERENCE_SLOTS.release()

    def target() -> None:
        try:
            box["value"] = function(*args)
        except BaseException as error:  # noqa: BLE001 - surfaced to caller below
            box["error"] = error
        finally:
            release_slot()

    if deadline is not None:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            release_slot()
            raise _RequestTimeout()
        wait_seconds = min(wait_seconds, remaining)

    worker = threading.Thread(target=target, daemon=True)
    try:
        worker.start()
    except BaseException:
        # Thread.start() can fail before the target runs. Do not permanently
        # consume the only inference slot on that rare startup/resource error.
        # The locked release also handles the unusual race where the target
        # starts before start() reports an error.
        release_slot()
        raise

    worker.join(wait_seconds)
    if worker.is_alive():
        raise _RequestTimeout()
    if deadline is not None and time.monotonic() >= deadline:
        raise _RequestTimeout()
    if "error" in box:
        raise box["error"]
    return box["value"]


def _read_header_values(handler: BaseHTTPRequestHandler, name: str) -> list[str]:
    """Return all header values, preserving duplicate-field validation."""
    get_all = getattr(handler.headers, "get_all", None)
    if callable(get_all):
        return list(get_all(name) or [])
    value = handler.headers.get(name)
    return [] if value is None else [value]


def _read_body(
    handler: BaseHTTPRequestHandler,
    max_body_bytes: int,
    *,
    deadline: float | None = None,
) -> bytes:
    """Read one framed body with a hard size bound and absolute deadline."""
    if max_body_bytes <= 0:
        raise ValueError("max_body_bytes must be positive")
    if deadline is None:
        raise ValueError("an absolute request deadline is required")

    if deadline <= time.monotonic():
        raise _RequestTimeout()

    transfer_values = _read_header_values(handler, "Transfer-Encoding")
    transfer_tokens = [
        token.strip().lower()
        for value in transfer_values
        for token in value.split(",")
    ]
    if transfer_tokens and transfer_tokens != ["identity"]:
        raise ContractError("bad_request", "unsupported transfer encoding")
    if len(transfer_values) > 1:
        raise ContractError("bad_request", "duplicate transfer encoding")

    length_values = _read_header_values(handler, "Content-Length")
    lengths: list[int] = []
    for value in length_values:
        parts = [part.strip() for part in value.split(",")]
        if not parts or any(not part for part in parts):
            raise ContractError("bad_request", "invalid Content-Length")
        for part in parts:
            if (
                not part
                or len(part) > 20
                or any(char not in "0123456789" for char in part)
            ):
                raise ContractError("bad_request", "invalid Content-Length")
            try:
                declared = int(part, 10)
            except (TypeError, ValueError):
                raise ContractError("bad_request", "invalid Content-Length") from None
            if declared < 0:
                raise ContractError("bad_request", "invalid Content-Length")
            lengths.append(declared)
    if len(set(lengths)) > 1:
        raise ContractError("bad_request", "conflicting Content-Length")
    if len(lengths) > 1:
        raise ContractError("bad_request", "duplicate Content-Length")
    if transfer_tokens and lengths:
        raise ContractError("bad_request", "conflicting body framing")
    if not lengths:
        raise ContractError("bad_request", "Content-Length is required")

    declared = lengths[0]
    if declared > max_body_bytes:
        raise ContractError("body_too_large", "request body exceeds size limit")

    remaining = declared
    chunks: list[bytes] = []
    while remaining:
        seconds = deadline - time.monotonic()
        if seconds <= 0:
            raise _RequestTimeout()
        try:
            handler.connection.settimeout(seconds)
            chunk = handler.rfile.read(min(65536, remaining))
        except (socket.timeout, TimeoutError):
            raise _RequestTimeout() from None
        except OSError:
            raise _ClientDisconnected() from None
        if not chunk:
            raise ContractError("bad_request", "request body is truncated")
        if len(chunk) > remaining:
            raise ContractError("bad_request", "request body framing is invalid")
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def _status_for_code(code: str) -> int:
    return 413 if code in _SIZE_CODES else 400


def _request_path(raw_path: str) -> str:
    """Return the URL path without exposing malformed parser details."""
    try:
        return urlparse(raw_path).path
    except ValueError:
        raise ContractError("bad_request", "malformed request path") from None


def _make_handler(matcher: FrozenMatcher, config: InferenceServerConfig):
    """Build a request handler bound to the loaded matcher and server config."""
    read_timeout = config.timeout_ms / 1000.0

    class _Handler(BaseHTTPRequestHandler):
        _matcher = matcher
        _config = config
        server_version = "fishing-phase2-inference/1.0"
        timeout = read_timeout

        # BaseHTTPRequestHandler's buffered reader can read ahead past the body
        # boundary. An unbuffered stream keeps framing bytes owned by the socket;
        # each read below is explicitly capped by the declared Content-Length.
        rbufsize = 0

        def setup(self) -> None:
            super().setup()
            # Safe defaults let a pre-parser timeout serialize without touching
            # fields BaseHTTPRequestHandler normally initializes while parsing.
            self.command = None
            self.requestline = ""
            self.request_version = "HTTP/1.1"
            # setup() is the beginning of the complete request lifecycle; the
            # deadline is intentionally not reset by do_POST after parsing.
            self._request_deadline = time.monotonic() + config.timeout_ms / 1000.0
            self.connection.settimeout(max(0.001, self._request_deadline - time.monotonic()))
            self.rfile = _DeadlineReader(self.rfile, self.connection, self._request_deadline)
            self._request_input = self.rfile

        def handle_one_request(self) -> None:
            try:
                super().handle_one_request()
            except _RequestTimeout:
                self.send_error(HTTPStatus.REQUEST_TIMEOUT)
            except _ClientDisconnected:
                self.close_connection = True
            except (BrokenPipeError, ConnectionResetError, OSError):
                self.close_connection = True

        def _send_json(self, status: int, payload: Mapping[str, object]) -> None:
            self.close_connection = True
            try:
                body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
                response_head = (
                    f"{self.protocol_version} {status} {HTTPStatus(status).phrase}\r\n"
                    "Content-Type: application/json\r\n"
                    f"Content-Length: {len(body)}\r\n"
                    "Connection: close\r\n"
                    "\r\n"
                ).encode("ascii")
                self.wfile.write(response_head)
                if getattr(self, "command", None) != "HEAD":
                    self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError, OSError):
                self.close_connection = True

        def send_error(
            self,
            code: int,
            message: str | None = None,
            explain: str | None = None,
        ) -> None:
            # BaseHTTPRequestHandler's default is HTML and echoes parser text.
            # Keep every parser/method/fallback failure on the same safe JSON wire.
            if code == HTTPStatus.REQUEST_TIMEOUT:
                status = 504
                error_code = "timeout"
                reason = "request exceeded time limit"
            elif code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE:
                status = 413
                error_code = "body_too_large"
                reason = "request body exceeds size limit"
            elif code == HTTPStatus.NOT_IMPLEMENTED:
                status = 405
                error_code = "method_not_allowed"
                reason = "use POST"
            else:
                status = int(code) if 400 <= int(code) <= 599 else 400
                error_code = "bad_request"
                reason = "malformed HTTP request"
            self._send_json(status, {"code": error_code, "reason": reason})
            self.close_connection = True

        def log_message(self, _format: str, *_args: Any) -> None:
            # Disable BaseHTTPRequestHandler access logging entirely. The request
            # line can contain user-controlled query text, and must never become
            # telemetry alongside image/base64 or identity data.
            return

        def _method_not_allowed(self) -> None:
            self._send_json(405, {"code": "method_not_allowed", "reason": "use POST"})

        def do_GET(self) -> None:
            if _request_path(self.path) == "/health":
                self._send_json(200, {
                    "code": "ok",
                    "status": "ok",
                    "model_id": matcher.model_id,
                })
                return
            self._method_not_allowed()

        def do_HEAD(self) -> None:
            self._method_not_allowed()

        def do_OPTIONS(self) -> None:
            self._method_not_allowed()

        def do_PUT(self) -> None:
            self._method_not_allowed()

        def do_PATCH(self) -> None:
            self._method_not_allowed()

        def do_DELETE(self) -> None:
            self._method_not_allowed()

        def do_POST(self) -> None:
            started = time.monotonic()
            try:
                if _request_path(self.path) != _INFER_PATH:
                    self._send_json(404, {"code": "not_found", "reason": "unknown path"})
                    return
                deadline = self._request_deadline
                raw = _read_body(self, config.max_body_bytes, deadline=deadline)
                remaining_seconds = deadline - time.monotonic()
                if remaining_seconds <= 0:
                    raise _RequestTimeout()
                # Pass a floor only after the strict expiry check. The worker's
                # millisecond guard is never allowed to start after the request
                # deadline has elapsed; its join budget is at most this remainder.
                remaining_ms = int(remaining_seconds * 1000)
                if remaining_ms <= 0:
                    raise _RequestTimeout()
                predictions = _with_timeout(
                    remaining_ms,
                    _parse_and_infer,
                    matcher,
                    raw,
                    deadline=deadline,
                )
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
            except _InferenceBusy:
                self._send_json(
                    503, {"code": "busy", "reason": "inference slot is unavailable"}
                )
            except _ClientDisconnected:
                self.close_connection = True
            except (BrokenPipeError, ConnectionResetError, OSError):
                self.close_connection = True
            except Exception:  # noqa: BLE001 - never leak internals/images/identity
                self._send_json(
                    500, {"code": "internal_error", "reason": "inference failed"}
                )

    return _Handler


def serve(config: InferenceServerConfig) -> None:
    """Blocking loop: load one frozen candidate, then serve bounded requests."""
    matcher = load_frozen_matcher(config.frozen_dir)
    handler = _make_handler(matcher, config)
    httpd = _QuietThreadingHTTPServer((config.host, config.port), handler)
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
        default=MAX_CANONICAL_REQUEST_BYTES,
        help=(
            f"Reject request bodies larger than this many bytes (before parsing); "
            f"default {MAX_CANONICAL_REQUEST_BYTES}, max {_MAX_BODY_OVERRIDE_CAP}"
        ),
    )
    parser.add_argument(
        "--timeout-ms",
        type=int,
        default=5000,
        help="Per-request inference timeout in milliseconds",
    )
    args = parser.parse_args(argv)

    if args.max_body_bytes < 1 or args.max_body_bytes > _MAX_BODY_OVERRIDE_CAP:
        parser.error(
            f"--max-body-bytes must be in [1, {_MAX_BODY_OVERRIDE_CAP}]"
        )

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
