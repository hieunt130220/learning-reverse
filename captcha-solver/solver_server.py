#!/usr/bin/env python3
"""Solver API server - drop-in mimic + transparent proxy cho avatar-auto.jar.

- Request captcha (body chứa bitmap 0/1 dài >= 500 ký tự) -> giải bằng model AI,
  trả response byte-level giống OCR gốc: byte status (0=OK) + Java modified UTF.
- Mọi request khác (tải dữ liệu Auto lúc khởi động...) -> forward nguyên xi
  về server gốc (ORIGIN), trả về response gốc byte-for-byte.

Log ghi ra stdout + /tmp/solver.log.

Chạy:
    ../.venv-captcha312/bin/python captcha-solver/solver_server.py [--port 8643]
"""
from __future__ import annotations

import re
import sys
import time
import urllib.request
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from src.predict import load_model, predict_array
from src.denoise import remove_isolated_noise

import numpy as np

MODEL = None
CHARSET = None
MODEL_PATH = str(Path(__file__).resolve().parent / "checkpoints" / "crnn_ctc.pt")
ORIGIN = "http://chip.vcdn.io.vn/avatar/full/"
LOG_FILE = "/tmp/solver.log"


def log(msg: str) -> None:
    line = f'[{time.strftime("%H:%M:%S")}] {msg}'
    print(line, flush=True)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def _load() -> None:
    global MODEL, CHARSET
    if MODEL is None:
        MODEL, CHARSET = load_model(MODEL_PATH)
        log(f"Model loaded: {MODEL_PATH}")


def _solve_bitmap(bitmap: str, width: int, height: int) -> tuple[str, float]:
    arr = np.array([int(c) for c in bitmap], dtype=np.uint8).reshape(height, width)
    arr = remove_isolated_noise(arr)
    return predict_array(arr, MODEL, CHARSET)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"

    def log_message(self, format, *args):
        pass  # tự log qua log()

    # ---------- helpers ----------

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length) if length else b""

    def _send_captcha_answer(self, answer: str) -> None:
        encoded = answer.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Length", str(1 + 2 + len(encoded)))
        self.end_headers()
        self.wfile.write(bytes([0]))                       # status 0 = OK
        self.wfile.write(len(encoded).to_bytes(2, "big"))  # Java modified UTF len
        self.wfile.write(encoded)

    def _proxy(self, body: bytes | None) -> None:
        """Forward request về ORIGIN, trả response gốc byte-for-byte."""
        path = self.path if self.path not in ("", "/") else ""
        url = ORIGIN.rstrip("/") + "/" + path.lstrip("/")
        req = urllib.request.Request(url, data=body, method=self.command)
        for h in ("Content-Type", "User-Agent", "Accept"):
            v = self.headers.get(h)
            if v:
                req.add_header(h, v)
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                data = r.read()
                self.send_response(r.status)
                ct = r.headers.get("Content-Type")
                if ct:
                    self.send_header("Content-Type", ct)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            log(f"PROXY  {self.command} {url} -> {len(data)} bytes")
        except Exception as e:
            log(f"PROXY FAIL {self.command} {url}: {e}")
            try:
                self.send_response(502)
                self.send_header("Content-Length", "0")
                self.end_headers()
            except Exception:
                pass

    # ---------- methods ----------

    def do_GET(self):
        self._proxy(None)

    def do_POST(self):
        body = self._read_body()
        text = body.decode("utf-8", errors="replace")

        # Captcha OCR: bitmap là chuỗi 0/1 dài
        m = re.search(r"[01]{500,}", text)
        if m:
            bitmap = m.group(0)
            nums = re.findall(r"\d+", text.replace(bitmap, " "))
            width = height = None
            if len(nums) >= 2:
                width, height = int(nums[-2]), int(nums[-1])
            if width and height and len(bitmap) == width * height:
                answer, conf = _solve_bitmap(bitmap, width, height)
                log(f"CAPTCHA {width}x{height} -> {answer} (conf {conf:.3f})")
                self._send_captcha_answer(answer)
                return
            log(f"CAPTCHA? bitmap {len(bitmap)} chars nhung w/h khong khop: {nums[-5:]}")
            # không parse được -> vẫn proxy để không làm hỏng request

        self._proxy(body)


def main() -> None:
    global MODEL_PATH, ORIGIN
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8643)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--ckpt", default=MODEL_PATH)
    ap.add_argument("--origin", default=ORIGIN)
    args = ap.parse_args()

    MODEL_PATH = args.ckpt
    ORIGIN = args.origin
    _load()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    log(f"Solver server (mimic+proxy) on {args.host}:{args.port} -> origin {ORIGIN}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("Shutting down")


if __name__ == "__main__":
    main()
