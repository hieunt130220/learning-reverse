"""Bounded HTTP client for the Phase 2 fishing inference service.

The client serializes the frozen Task 4 request contract exactly, performs one
POST to the configured endpoint, and returns only a fully validated response.
Request and response bytes remain in memory.  Errors expose stable codes and
reasons only; endpoint text, response bodies, images, and base64 are never
included in an exception message.
"""

from __future__ import annotations

import http.client
import json
import socket
import threading
from collections.abc import Mapping
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from .inference_contract import (
    ContractError,
    InferenceRequest,
    InferenceResponse,
    validate_response,
)

# A legitimate Task 4 request contains at most 960,000 decoded PNG bytes.  Base64
# expansion plus the small JSON envelope remains below this wire-size ceiling.
_MAX_REQUEST_BYTES = 1_500_000
_MAX_RESPONSE_BYTES = 1_048_576
_MAX_TIMEOUT_MS = 120_000
_MAX_MODEL_ID_CHARS = 1024

CLIENT_ERROR_CODES = frozenset(
    {
        "invalid_request",
        "request_too_large",
        "unavailable",
        "timeout",
        "http_status",
        "response_too_large",
        "invalid_response",
        "model_identity_mismatch",
    }
)


class InferenceClientError(RuntimeError):
    """Sanitized terminal failure from :meth:`InferenceClient.match`.

    ``code`` and ``reason`` are stable machine-readable strings.  ``status`` is
    present only for a valid HTTP status and no server response body is retained.
    """

    def __init__(self, code: str, reason: str, *, status: int | None = None) -> None:
        if code not in CLIENT_ERROR_CODES:
            raise ValueError("unknown inference client error code")
        super().__init__(reason)
        self.code = code
        self.reason = reason
        self.status = status if _is_http_status(status) else None

    def __str__(self) -> str:
        suffix = "" if self.status is None else f" status={self.status}"
        return f"{self.code}: {self.reason}{suffix}"


class _NoRedirectHandler(HTTPRedirectHandler):
    """Treat redirects as terminal statuses rather than sending a second request."""

    def redirect_request(
        self,
        req: Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Mapping[str, str],
        newurl: str,
    ) -> None:
        return None


def _is_http_status(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 100 <= value <= 599


def _validate_endpoint(endpoint: object) -> str:
    if not isinstance(endpoint, str) or not endpoint:
        raise ValueError("endpoint must be a non-empty absolute HTTP(S) URL")
    if any(ord(character) <= 0x20 or ord(character) == 0x7F for character in endpoint):
        raise ValueError("endpoint must not contain whitespace or control characters")
    if "#" in endpoint:
        raise ValueError("endpoint must not contain a fragment")
    try:
        parsed = urlsplit(endpoint)
        hostname = parsed.hostname
        # Accessing port performs urllib's numeric/range validation.
        parsed.port
    except ValueError:
        raise ValueError("endpoint must be a valid absolute HTTP(S) URL") from None
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc or not hostname:
        raise ValueError("endpoint must be a non-empty absolute HTTP(S) URL")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("endpoint must not contain embedded credentials")
    return endpoint


def _validate_timeout(timeout_ms: object) -> int:
    if (
        not isinstance(timeout_ms, int)
        or isinstance(timeout_ms, bool)
        or timeout_ms <= 0
        or timeout_ms > _MAX_TIMEOUT_MS
    ):
        raise ValueError(f"timeout_ms must be an integer from 1 through {_MAX_TIMEOUT_MS}")
    return timeout_ms


def _request_document(request: InferenceRequest) -> dict[str, object]:
    return {
        "schemaVersion": request.schema_version,
        "references": [
            {"index": image.index, "pngBase64": image.png_base64}
            for image in request.references
        ],
        "queries": [
            {"index": image.index, "pngBase64": image.png_base64}
            for image in request.queries
        ],
    }


def _serialize_request(request: object) -> bytes:
    if not isinstance(request, InferenceRequest):
        raise InferenceClientError("invalid_request", "wrong_request_type")
    try:
        document = _request_document(request)
        # Validate the exact outbound document without replacing or mutating the
        # caller-owned typed request.
        from .inference_contract import parse_request

        parse_request(document)
        payload = json.dumps(
            document,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    except ContractError as error:
        raise InferenceClientError("invalid_request", error.code) from None
    except (AttributeError, TypeError, ValueError, RecursionError):
        raise InferenceClientError("invalid_request", "serialization_failed") from None
    if len(payload) > _MAX_REQUEST_BYTES:
        raise InferenceClientError("request_too_large", "wire_body_exceeds_limit")
    return payload


def _declared_response_length(headers: Any) -> int | None:
    get_all = getattr(headers, "get_all", None)
    values = list(get_all("Content-Length") or []) if callable(get_all) else []
    if not values:
        value = headers.get("Content-Length")
        values = [] if value is None else [value]
    if not values:
        return None
    if len(values) != 1:
        raise InferenceClientError("invalid_response", "invalid_content_length")
    value = values[0].strip()
    if not value or any(character not in "0123456789" for character in value):
        raise InferenceClientError("invalid_response", "invalid_content_length")
    try:
        return int(value, 10)
    except ValueError:
        raise InferenceClientError("invalid_response", "invalid_content_length") from None


def _read_response(response: Any) -> bytes:
    declared = _declared_response_length(response.headers)
    if declared is not None and declared > _MAX_RESPONSE_BYTES:
        raise InferenceClientError("response_too_large", "wire_body_exceeds_limit")
    raw = response.read(_MAX_RESPONSE_BYTES + 1)
    if len(raw) > _MAX_RESPONSE_BYTES:
        raise InferenceClientError("response_too_large", "wire_body_exceeds_limit")
    return raw


def _is_timeout_error(error: BaseException) -> bool:
    if isinstance(error, (TimeoutError, socket.timeout)):
        return True
    reason = getattr(error, "reason", None)
    return isinstance(reason, (TimeoutError, socket.timeout))


def _parse_response(raw: bytes) -> InferenceResponse:
    try:
        document = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError, ValueError):
        raise InferenceClientError("invalid_response", "malformed_json") from None
    try:
        return validate_response(document)
    except ContractError as error:
        raise InferenceClientError("invalid_response", error.code) from None


class InferenceClient:
    """Dependency-light, single-attempt client for a supplied ``/infer`` URL."""

    def __init__(self, endpoint: str, timeout_ms: int) -> None:
        self._endpoint = _validate_endpoint(endpoint)
        self._timeout_ms = _validate_timeout(timeout_ms)
        self._opener = build_opener(_NoRedirectHandler())
        self._match_lock = threading.Lock()
        self._model_id: str | None = None

    def match(self, request: InferenceRequest) -> InferenceResponse:
        """POST one request and return only a contract- and request-valid response.

        There are no retries and redirects are terminal HTTP status failures.  The
        first successful model ID is pinned for this client instance. Calls on one
        client instance are serialized so model pinning remains ordered.
        """

        with self._match_lock:
            return self._match_once(request)

    def _match_once(self, request: InferenceRequest) -> InferenceResponse:
        payload = _serialize_request(request)
        http_request = Request(
            self._endpoint,
            data=payload,
            headers={
                "Accept": "application/json",
                "Accept-Encoding": "identity",
                "Content-Length": str(len(payload)),
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with self._opener.open(
                http_request,
                timeout=self._timeout_ms / 1000.0,
            ) as response:
                status = response.getcode()
                if status != 200:
                    raise InferenceClientError(
                        "http_status",
                        "status_failure",
                        status=status if _is_http_status(status) else None,
                    )
                raw_response = _read_response(response)
        except InferenceClientError:
            raise
        except HTTPError as error:
            status = error.code if _is_http_status(error.code) else None
            error.close()
            raise InferenceClientError(
                "http_status", "status_failure", status=status
            ) from None
        except (URLError, ConnectionError, OSError, http.client.HTTPException) as error:
            if _is_timeout_error(error):
                raise InferenceClientError("timeout", "request_timed_out") from None
            raise InferenceClientError("unavailable", "connection_failed") from None
        except Exception:
            # urllib may surface TLS/provider-specific exceptions outside the
            # standard hierarchy.  Keep them unavailable and sanitized rather
            # than leaking endpoint-adjacent exception text.
            raise InferenceClientError("unavailable", "connection_failed") from None

        response = _parse_response(raw_response)
        if not response.model_id:
            raise InferenceClientError("invalid_response", "empty_model_id")
        if len(response.model_id) > _MAX_MODEL_ID_CHARS or any(
            ord(character) < 0x20 or ord(character) == 0x7F
            for character in response.model_id
        ):
            raise InferenceClientError("invalid_response", "invalid_model_id")

        seen_queries: set[int] = set()
        for prediction in response.predictions:
            if prediction.query_index in seen_queries:
                raise InferenceClientError("invalid_response", "duplicate_query_index")
            seen_queries.add(prediction.query_index)
            if prediction.query_index >= len(request.queries):
                raise InferenceClientError("invalid_response", "query_index_out_of_range")
            if prediction.reference_index >= len(request.references):
                raise InferenceClientError("invalid_response", "reference_index_out_of_range")

        if self._model_id is None:
            self._model_id = response.model_id
        elif response.model_id != self._model_id:
            raise InferenceClientError(
                "model_identity_mismatch", "model_id_changed"
            )
        return response


__all__ = [
    "CLIENT_ERROR_CODES",
    "InferenceClientError",
    "InferenceClient",
]
