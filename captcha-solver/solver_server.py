#!/usr/bin/env python3
"""Solver API server - mimics OCR service for avatar-auto.jar.

The JAR sends: <sep1><bitmap><sep2><width><sep3><height>
The JAR expects: byte status (0=OK) + UTF string (4-digit answer)
"""
from __future__ import annotations

import json
import re
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from src.predict import load_model, predict_array
from src.denoise import remove_isolated_noise

import numpy as np

MODEL = None
CHARSET = None
MODEL_PATH = str(Path(__file__).resolve().parent / "checkpoints" / "crnn_ctc.pt")


def _load():
    global MODEL, CHARSET
    if MODEL is None:
        MODEL, CHARSET = load_model(MODEL_PATH)
        print(f"Model loaded: {MODEL_PATH}")


def _solve_from_bitmap(bitmap: str, width: int, height: int) -> str:
    arr = np.array([int(c) for c in bitmap], dtype=np.uint8).reshape(height, width)
    arr = remove_isolated_noise(arr)
    text, conf = predict_array(arr, MODEL, CHARSET)
    print(f"  -> {text} (conf {conf:.3f})")
    return text


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        # Try JSON first (for testing)
        try:
            data = json.loads(body)
            if "bitmap" in data:
                text = _solve_from_bitmap(data["bitmap"], data["width"], data["height"])
                self._send_response(0, text)
                return
        except (json.JSONDecodeError, KeyError):
            pass

        # Legacy format
        text = body.decode("utf-8", errors="replace")
        print(f"  Raw body ({len(text)} chars): {text[:200]}...")

        # Extract bitmap (longest run of 0s and 1s)
        matches = re.findall(r"[01]{50,}", text)
        if matches:
            bitmap = max(matches, key=len)
            nums = re.findall(r"\d+", text.replace(bitmap, ""))
            width, height = None, None
            if len(nums) >= 2:
                width, height = int(nums[-2]), int(nums[-1])
            if width and height and len(bitmap) == width * height:
                text_result = _solve_from_bitmap(bitmap, width, height)
                self._send_response(0, text_result)
                return

        # Fallback: raw bitmap
        if re.match(r"^[01]+$", text.strip()):
            bitmap = text.strip()
            if len(bitmap) == 1500:
                text_result = _solve_from_bitmap(bitmap, 100, 15)
                self._send_response(0, text_result)
                return

        print("  ERROR: could not parse request")
        self._send_response(1, "ERROR")

    def _send_response(self, status: int, answer: str):
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.end_headers()
        self.wfile.write(bytes([status]))
        encoded = answer.encode("utf-8")
        self.wfile.write(len(encoded).to_bytes(2, "big"))
        self.wfile.write(encoded)


def main():
    global MODEL_PATH
    global MODEL_PATH
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8643)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--ckpt", default=MODEL_PATH)
    args = ap.parse_args()

    MODEL_PATH = args.ckpt
    _load()

    server = HTTPServer((args.host, args.port), Handler)
    print(f"Solver server listening on {args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down")


if __name__ == "__main__":
    main()
