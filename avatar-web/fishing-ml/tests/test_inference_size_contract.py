import io
import time
import unittest
from email.message import Message
from types import SimpleNamespace

from fishing_ml.inference_contract import (
    MAX_CANONICAL_REQUEST_BYTES,
    InferenceImage,
    canonical_request_byte_length,
)
from fishing_ml.inference_contract import ContractError
from fishing_ml.inference_service import _read_body, _status_for_code


class Connection:
    def settimeout(self, timeout):
        self.timeout = timeout


def handler(length, body=b""):
    headers = Message()
    headers["Content-Length"] = str(length)
    return SimpleNamespace(headers=headers, rfile=io.BytesIO(body), connection=Connection())


class RequestSizeTests(unittest.TestCase):
    def test_canonical_maximum_is_exact(self):
        references = [
            InferenceImage(i, "A" * (10_080 if i < 63 else 180))
            for i in range(64)
        ]
        queries = [InferenceImage(i, "A" * 10_080) for i in range(64)]
        self.assertEqual(
            canonical_request_byte_length(references, queries),
            MAX_CANONICAL_REQUEST_BYTES,
        )

    def test_exact_limit_is_accepted(self):
        body = b"x" * MAX_CANONICAL_REQUEST_BYTES
        result = _read_body(handler(len(body), body), MAX_CANONICAL_REQUEST_BYTES,
                            deadline=time.monotonic() + 5)
        self.assertEqual(len(result), MAX_CANONICAL_REQUEST_BYTES)

    def test_one_byte_over_limit_is_rejected_before_read(self):
        with self.assertRaises(ContractError) as caught:
            _read_body(handler(MAX_CANONICAL_REQUEST_BYTES + 1),
                       MAX_CANONICAL_REQUEST_BYTES, deadline=time.monotonic() + 5)
        self.assertEqual(caught.exception.code, "body_too_large")
        self.assertEqual(_status_for_code(caught.exception.code), 413)

    def test_declared_boundary_still_rejects_truncated_body(self):
        with self.assertRaises(ContractError) as caught:
            _read_body(handler(MAX_CANONICAL_REQUEST_BYTES, b"short"),
                       MAX_CANONICAL_REQUEST_BYTES, deadline=time.monotonic() + 5)
        self.assertEqual(caught.exception.code, "bad_request")
        self.assertEqual(_status_for_code(caught.exception.code), 400)


if __name__ == "__main__":
    unittest.main()
