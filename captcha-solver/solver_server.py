#!/usr/bin/env python3
"""Solver API server - drop-in mimic + transparent proxy cho avatar-auto.jar.

- Request captcha (body chứa bitmap 0/1 dài >= 500 ký tự) -> giải bằng model AI,
  trả response byte-level giống OCR gốc: byte status (1=OK) + byte resultType (0) + Java modified UTF.
  Theo az.class: status 1 + readByte() + readUTF() mới là path gửi đáp án về game;
  status 0 là message/error và sẽ KHÔNG gửi đáp án (gây treo dialog "Xin chờ").
- Mọi request khác (tải dữ liệu Auto lúc khởi động...) -> forward nguyên xi
  về server gốc (ORIGIN), trả về response gốc byte-for-byte.

Log ghi ra stdout + /tmp/solver.log.

Chạy:
    ../.venv-captcha312/bin/python captcha-solver/solver_server.py [--port 8643]
"""
from __future__ import annotations

import re
import sys
import threading
import time
import urllib.request
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from src.predict import load_model, predict_array
from src.denoise import remove_isolated_noise

import numpy as np
import struct

MODEL = None
CHARSET = None
MODEL_PATH = str(Path(__file__).resolve().parent / "checkpoints" / "crnn_ctc.pt")
ORIGIN = "http://chip.vcdn.io.vn/avatar/full/"
LOG_FILE = "/tmp/solver.log"
_XOR_KEY = b"NguyenHuuQuyet"
_LOG_LOCK = threading.Lock()
_MODEL_LOCK = threading.Lock()
# OFFLINE: không gọi chip.vcdn.io.vn ra ngoài (tránh treo 20s khi chip chậm)
OFFLINE = True
CACHED_DIR = Path(__file__).resolve().parent / "data"
CACHED_CONFIG = CACHED_DIR / "cached_chip_config.bin"  # 1070 bytes đã patch 127.0.0.1:8643
CACHED_DATA_PHP = CACHED_DIR / "cached_data_php.bin"
CACHED_TEACHER = CACHED_DIR / "cached_teacher_php.bin"


def _xor(data: bytes) -> bytes:
    return bytes(b ^ _XOR_KEY[i % len(_XOR_KEY)] for i, b in enumerate(data))


def _patch_chip_config(data: bytes, new_host: str = "127.0.0.1:8643") -> bytes:
    """Patch config 1074 bytes của chip server: thay host chip -> solver host.

    Config được XOR với key NguyenHuuQuyet, chứa các URL dạng UTF (2-byte BE len + bytes)
    như `http://chip.vcdn.io.vn/avatar/full/captcha.php`. Thay host giữ nguyên path,
    cập nhật length prefix cho đúng. Nếu không phải config (không chứa chip) thì trả nguyên.
    """
    try:
        dec = _xor(data)
    except Exception:
        return data
    if b"chip.vcdn.io.vn" not in dec:
        return data
    # Danh sách URL gốc cần patch (đã xác định từ live capture 1074 bytes)
    olds = [
        b"http://chip.vcdn.io.vn/avatar/full/data.php",
        b"http://chip.vcdn.io.vn/avatar/full/captcha.php",
        b"http://chip.vcdn.io.vn/avatar/teacher.php",
        b"http://chip.vcdn.io.vn/avatar/avdata.php?_t=",
        b"http://chip.vcdn.io.vn/avatar/full/",
    ]
    # Sắp xếp dài trước để tránh thay thế lồng nhau (vd captcha.php chứa full/)
    olds.sort(key=len, reverse=True)
    new_dec = dec
    patched = 0
    for old in olds:
        new = old.replace(b"chip.vcdn.io.vn", new_host.encode())
        old_enc = struct.pack(">H", len(old)) + old
        new_enc = struct.pack(">H", len(new)) + new
        if old_enc in new_dec:
            new_dec = new_dec.replace(old_enc, new_enc)
            patched += 1
        elif old in new_dec:
            # Fallback: thay raw host trong decoded (trường hợp length đã lệch do patch trước)
            # thì tìm raw và thay, nhưng cần cập nhật length prefix thủ công
            # Đơn giản: thay raw host, sau đó sẽ được xử lý ở lần lặp sau nếu còn
            pass
    if patched:
        log(f"PATCH config: thay {patched} URL chip -> {new_host}, {len(data)} -> {len(new_dec)} bytes (xor)")
        return _xor(new_dec)
    return data


def log(msg: str) -> None:
    line = f'[{time.strftime("%H:%M:%S")}] {msg}'
    print(line, flush=True)
    try:
        with _LOG_LOCK:
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
    # JAR bitmap: 1=nền, 0=chữ; model train với alpha: 1=chữ, 0=nền → đảo bit
    arr = 1 - arr
    arr = remove_isolated_noise(arr)
    with _MODEL_LOCK:
        ans, conf = predict_array(arr, MODEL, CHARSET)
    # Đảm bảo luôn trả 4 chữ số: model đôi khi CTC decode ra 5 ký tự (ví dụ 21217 cho label 2127)
    # Cắt/pad để tránh server reject gây treo "Xin chờ"
    if len(ans) != 4:
        fixed = ans[:4].ljust(4, "0") if len(ans) >= 4 else ans.ljust(4, "0")
        # chỉ giữ chữ số
        fixed = "".join(c if c.isdigit() else "0" for c in fixed)
        if len(fixed) != 4:
            fixed = (fixed + "0000")[:4]
        log(f"  FIX answer length {len(ans)}->{len(fixed)}: {ans!r}->{fixed!r}")
        ans = fixed
    return ans, conf


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
        self.send_header("Content-Length", str(1 + 1 + 2 + len(encoded)))
        self.end_headers()
        self.wfile.write(bytes([1, 0]))                    # status 1 = OK, resultType 0 (không phải 2)
        self.wfile.write(len(encoded).to_bytes(2, "big"))  # Java modified UTF len
        self.wfile.write(encoded)

    def _proxy(self, body: bytes | None) -> None:
        """Forward request về ORIGIN, trả response gốc byte-for-byte.
        OFFLINE=True -> KHÔNG gọi chip.vcdn.io.vn ra ngoài, phục vụ từ cache cục bộ để tránh treo 20s.
        """
        # 1. Nếu là config hoặc data đã cache -> trả cache ngay, không gọi chip
        # path có thể chứa query string (vd /avatar/full/data.php?_t=...)
        p = self.path.split("?")[0]
        try:
            if p in ("", "/", "/avatar/full", "/avatar/full/"):
                if CACHED_CONFIG.exists():
                    data = CACHED_CONFIG.read_bytes()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/octet-stream")
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                    log(f"CACHE  {self.command} {self.path} -> {len(data)} bytes (cached_chip_config, KHÔNG gọi chip)")
                    return
            elif p == "/avatar/full/data.php":
                if CACHED_DATA_PHP.exists():
                    data = CACHED_DATA_PHP.read_bytes()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/octet-stream")
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                    log(f"CACHE  {self.command} {self.path} -> {len(data)} bytes (cached_data_php, KHÔNG gọi chip)")
                    return
            elif p == "/avatar/teacher.php":
                if CACHED_TEACHER.exists():
                    data = CACHED_TEACHER.read_bytes()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/octet-stream")
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                    log(f"CACHE  {self.command} {self.path} -> {len(data)} bytes (cached_teacher, KHÔNG gọi chip)")
                    return
            elif p == "/avatar/avdata.php":
                # avdata có query _t thay đổi, trả cache nếu có, không thì 200 empty để không treo
                if (CACHED_DIR / "cached_avdata.bin").exists():
                    data = (CACHED_DIR / "cached_avdata.bin").read_bytes()
                else:
                    # dữ liệu mẫu 15 bytes lấy từ chip, trả về để client không treo
                    data = b"LgtHek:\x14\x05\x0cyetN"
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                log(f"CACHE  {self.command} {self.path} -> {len(data)} bytes (avdata offline, KHÔNG gọi chip)")
                return
        except Exception as e:
            log(f"CACHE FAIL {self.path}: {e}")

        if OFFLINE:
            # Không gọi chip, trả 200 empty nhanh để không treo Xin chờ 20s (thay vì 502)
            log(f"OFFLINE {self.command} {self.path} -> 200 empty (không gọi chip.vcdn.io.vn)")
            try:
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Length", "0")
                self.end_headers()
            except Exception:
                pass
            return

        # ONLINE fallback (khi OFFLINE=False): forward về chip
        if self.path in ("", "/"):
            url = ORIGIN
        elif self.path.startswith("/avatar/"):
            url = "http://chip.vcdn.io.vn" + self.path
        else:
            path = self.path
            url = ORIGIN.rstrip("/") + "/" + path.lstrip("/")
        req = urllib.request.Request(url, data=body, method=self.command)
        for h in ("Content-Type", "User-Agent", "Accept"):
            v = self.headers.get(h)
            if v:
                req.add_header(h, v)
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                data = r.read()
                patched = _patch_chip_config(data)
                if patched is not data:
                    data = patched
                    log(f"PROXY PATCH config {url} -> {len(data)} bytes (đã đổi chip -> 127.0.0.1:8643)")
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
        if self.path in ("/health", "/healthz"):
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"ok")
            log(f"HEALTH check {self.path}")
            return
        self._proxy(None)

    def do_POST(self):
        body = self._read_body()
        text = body.decode("utf-8", errors="replace")
        # Log mọi POST để debug treo "Xin chờ"
        preview = text[:300].replace("\n", "\\n")
        log(f"POST {self.path} len={len(body)} body[:300]={preview!r}")
        if len(body) > 0 and len(text) < 50:
            # body có thể là binary, log hex
            log(f"  POST hex[:100]={body[:100].hex()}")

        # Captcha OCR: bitmap là chuỗi 0/1 dài (>=500)
        candidates = re.findall(r"[01]{500,}", text)
        if candidates:
            bitmap = max(candidates, key=len)  # lấy đoạn dài nhất
            # Thử parse width/height từ phần còn lại
            rest = text.replace(bitmap, " ")
            nums = re.findall(r"\d+", rest)
            width = height = None
            if len(nums) >= 2:
                try:
                    width, height = int(nums[-2]), int(nums[-1])
                except ValueError:
                    pass
            # Fallback: nếu không parse được mà bitmap len =1500 thì đoán 100x15
            if (width is None or height is None) and len(bitmap) == 1500:
                width, height = 100, 15
                log(f"  Fallback đoán 100x15 cho bitmap 1500")
            if width and height and len(bitmap) == width * height:
                try:
                    answer, conf = _solve_bitmap(bitmap, width, height)
                except Exception as e:
                    log(f"  CAPTCHA solve error: {e}")
                    self._proxy(body)
                    return
                log(f"CAPTCHA {width}x{height} -> {answer} (conf {conf:.3f}) -> trả status 1,0 + UTF")
                self._send_captcha_answer(answer)
                return
            log(f"CAPTCHA? bitmap {len(bitmap)} chars nhung w/h khong khop: nums={nums[-5:]} w={width} h={height} bitmap==w*h? {width and height and len(bitmap)==width*height}")
            # không parse được -> vẫn proxy để không làm hỏng request

        self._proxy(body)


def main() -> None:
    global MODEL_PATH, ORIGIN
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8643)
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--ckpt", default=MODEL_PATH)
    ap.add_argument("--origin", default=ORIGIN)
    args = ap.parse_args()

    MODEL_PATH = args.ckpt
    ORIGIN = args.origin
    _load()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    log(f"Solver server (mimic+proxy) on {args.host}:{args.port} -> origin {ORIGIN} (bind 0.0.0.0 để MicroEmulator/điện thoại đều tới được)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("Shutting down")


if __name__ == "__main__":
    main()
