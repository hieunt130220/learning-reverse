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
    ../.venv-captcha312/bin/python captcha-solver/solver_server.py \
        [--host 127.0.0.1] [--port 8643] \
        [--public-base-url http://127.0.0.1:8643/]
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
from src.predict import load_model, predict_array_fixed
from src.denoise import remove_isolated_noise

import numpy as np
import struct

MODEL = None
CHARSET = None
MODEL_PATH = str(Path(__file__).resolve().parent / "checkpoints" / "crnn_ctc.pt")
ORIGIN = "http://chip.vcdn.io.vn/avatar/full/"
DEFAULT_PUBLIC_BASE_URL = "http://127.0.0.1:8643/"
PUBLIC_BASE_URL = DEFAULT_PUBLIC_BASE_URL
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
CACHED_AVDATA = CACHED_DIR / "cached_avdata.bin"
CAPTCHA_ANSWER_LEN = 4          # captcha Avatar luôn là 4 chữ số
FALLBACK_ANSWER = "0000"        # chỉ dùng khi model lỗi: trả đáp án hợp lệ còn hơn treo
MIN_BITMAP_CHARS = 200          # ngưỡng nhận diện body là bitmap captcha
# Kỳ vọng ảnh captcha 100x15; các cặp khác chỉ dùng khi phân tích thừa số bất ngờ
PREFERRED_DIMS = (100, 15)
_CONFIG_URL_PATHS = (
    "avatar/full/data.php",
    "avatar/full/captcha.php",
    "avatar/teacher.php",
    "avatar/avdata.php?_t=",
    "",
)
_CONFIG_SOURCE_BASE_URLS = (
    "http://chip.vcdn.io.vn/",
    DEFAULT_PUBLIC_BASE_URL,
)
# Đường dẫn -> file cache phục vụ offline (không gọi chip.vcdn.io.vn)
_CACHE_BY_PATH: dict[str, Path] = {
    "": CACHED_CONFIG,
    "/": CACHED_CONFIG,
    "/avatar/full": CACHED_CONFIG,
    "/avatar/full/": CACHED_CONFIG,
    "/avatar/full/data.php": CACHED_DATA_PHP,
    "/avatar/teacher.php": CACHED_TEACHER,
    "/avatar/avdata.php": CACHED_AVDATA,
}


def _xor(data: bytes) -> bytes:
    return bytes(b ^ _XOR_KEY[i % len(_XOR_KEY)] for i, b in enumerate(data))


def _normalize_base_url(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("public base URL must not be empty")
    return normalized.rstrip("/") + "/"


def _patch_chip_config(
    data: bytes,
    public_base_url: str = DEFAULT_PUBLIC_BASE_URL,
) -> bytes:
    """Rewrite known config URLs thành endpoint resolver được public.

    Config được XOR với key NguyenHuuQuyet, chứa các URL dạng UTF (2-byte BE len + bytes)
    như `http://chip.vcdn.io.vn/avatar/full/captcha.php`. Cached config có thể đã trỏ
    về local `127.0.0.1:8643`; cả hai source đều phải được rewrite và cập nhật length prefix.
    """
    try:
        dec = _xor(data)
    except Exception:
        return data

    normalized_base_url = _normalize_base_url(public_base_url)
    target_base = normalized_base_url.encode("utf-8")
    source_bases = tuple(
        _normalize_base_url(source).encode("utf-8")
        for source in _CONFIG_SOURCE_BASE_URLS
    )
    new_dec = dec
    patched = 0
    for path in _CONFIG_URL_PATHS:
        path_bytes = path.encode("utf-8")
        target = target_base + path_bytes
        target_field = struct.pack(">H", len(target)) + target
        for source_base in source_bases:
            source = source_base + path_bytes
            if source == target:
                continue
            source_field = struct.pack(">H", len(source)) + source
            occurrences = new_dec.count(source_field)
            if occurrences:
                new_dec = new_dec.replace(source_field, target_field)
                patched += occurrences
    if patched:
        log(
            f"PATCH config: thay {patched} URL -> {normalized_base_url}, "
            f"{len(data)} -> {len(new_dec)} bytes (xor)"
        )
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


def _normalize_answer(answer: str) -> str:
    """Ép đáp án về đúng 4 chữ số. Trả về chuỗi luôn hợp lệ, kể cả khi model lỗi."""
    digits = "".join(c for c in (answer or "") if c.isdigit())
    if len(digits) >= CAPTCHA_ANSWER_LEN:
        return digits[:CAPTCHA_ANSWER_LEN]
    return digits.ljust(CAPTCHA_ANSWER_LEN, "0")


def _solve_bitmap(bitmap: str, width: int, height: int) -> tuple[str, float]:
    arr = np.frombuffer(bitmap.encode("ascii"), dtype=np.uint8) - ord("0")
    arr = arr.reshape(height, width)
    # JAR bitmap: 1=nền, 0=chữ; model train với alpha: 1=chữ, 0=nền → đảo bit
    arr = 1 - arr
    arr = remove_isolated_noise(arr)
    with _MODEL_LOCK:
        # decode ép độ dài: greedy CTC thỉnh thoảng ra 3 hoặc 5 ký tự, mà pad
        # "0" vào thì chắc chắn sai -> game hỏi lại captcha liên tục.
        ans, conf = predict_array_fixed(arr, MODEL, CHARSET, CAPTCHA_ANSWER_LEN)
    return _normalize_answer(ans), conf


def _guess_dims(n_px: int, nums: list[int]) -> tuple[int, int, int] | None:
    """Suy ra (width, height, rank) với rank càng nhỏ càng chắc chắn.

    rank 0: có cặp số khai báo trong body khớp chính xác w*h == n_px
    rank 1: n_px đúng bằng kích thước captcha chuẩn 100x15
    rank 2: phân tích thừa số (đoán)
    """
    for i in range(len(nums) - 1):
        w, h = nums[i], nums[i + 1]
        if w > 0 and h > 0 and w * h == n_px:
            return w, h, 0
    if n_px == PREFERRED_DIMS[0] * PREFERRED_DIMS[1]:
        return PREFERRED_DIMS[0], PREFERRED_DIMS[1], 1
    best = None
    for h in range(5, 61):
        if n_px % h:
            continue
        w = n_px // h
        if not 20 <= w <= 400:
            continue
        cost = abs(w - PREFERRED_DIMS[0]) + 4 * abs(h - PREFERRED_DIMS[1])
        if best is None or cost < best[0]:
            best = (cost, w, h)
    if best is None:
        return None
    return best[1], best[2], 2


def _extract_captcha(text: str) -> tuple[str, int, int] | None:
    """Nhận diện request captcha: trả (bitmap, width, height) hoặc None.

    Body từ az.class có dạng <sep1><bitmap 0/1><sep2><width><sep3><height>.
    Trả None khi body không chứa chuỗi 0/1 đủ dài (request cấu hình/data).

    width/height chỉ gồm các chữ số 0 và 1 nên có thể dính liền bitmap khi
    separator là ký tự không phải số; vì vậy cắt bớt vài ký tự cuối của run
    0/1 và chọn cách cắt cho suy luận kích thước chắc chắn nhất.
    """
    runs = [m for m in re.finditer(r"[01]{%d,}" % MIN_BITMAP_CHARS, text)]
    if not runs:
        return None
    longest = max(runs, key=lambda m: m.end() - m.start())
    start, end = longest.start(), longest.end()
    best: tuple[int, int, int, int] | None = None    # (rank, extra, w, h)
    for extra in range(0, 9):
        n_px = (end - start) - extra
        if n_px < MIN_BITMAP_CHARS:
            break
        nums = [int(x) for x in re.findall(r"\d+", text[end - extra:]) if x]
        dims = _guess_dims(n_px, nums)
        if dims is None:
            continue
        cand = (dims[2], extra, dims[0], dims[1])
        if best is None or cand[0] < best[0]:
            best = cand
        elif cand[0] == best[0] and extra < best[1]:
            best = cand
        if best[0] == 0:
            break
    if best is None:
        # Vẫn coi là captcha: thà trả đáp án sai còn hơn để client treo "Xin chờ".
        log(f"CAPTCHA? bitmap {end - start}px khong suy ra duoc w/h")
        return text[start:end], 0, 0
    rank, extra, width, height = best
    if extra or rank:
        log(f"  DIMS {width}x{height} (rank {rank}, cat {extra} ky tu cuoi run 0/1)")
    return text[start:end - extra], width, height


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"

    def log_message(self, format, *args):
        pass  # tự log qua log()

    # ---------- helpers ----------

    def _read_body(self) -> bytes:
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            return b""
        return self.rfile.read(min(length, 8 * 1024 * 1024))

    def _send_bytes(self, payload: bytes, status: int = 200) -> bool:
        """Ghi response hoàn chỉnh. Trả False nếu client đã ngắt kết nối."""
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            if payload:
                self.wfile.write(payload)
            return True
        except OSError as e:
            log(f"SEND FAIL {self.command} {self.path}: {e}")
            return False

    def _send_captcha_answer(self, answer: str) -> None:
        """Luôn trả payload hợp lệ: status 1 + resultType 0 + UTF 4 chữ số.

        az.class chỉ gửi đáp án về game khi byte đầu tiên là 1; mọi response
        khác (rỗng, status 0/-1/3) khiến thread OCR kết thúc mà không nộp đáp
        án và dialog "Xin chờ" không bao giờ đóng.
        """
        encoded = _normalize_answer(answer).encode("ascii")
        payload = bytes([1, 0]) + len(encoded).to_bytes(2, "big") + encoded
        self._send_bytes(payload)

    def _answer_captcha(self, bitmap: str, width: int, height: int) -> None:
        """Giải và nộp đáp án cho một request captcha. Không bao giờ trả rỗng."""
        answer, conf = FALLBACK_ANSWER, 0.0
        try:
            answer, conf = _solve_bitmap(bitmap, width, height)
        except Exception as e:  # model/reshape lỗi vẫn phải trả lời
            log(f"CAPTCHA solve error {width}x{height}: {e} -> fallback {answer}")
        log(f"CAPTCHA {width}x{height} -> {answer} (conf {conf:.3f}) status 1,0 + UTF")
        self._send_captcha_answer(answer)

    # ---------- proxy / cache ----------

    def _is_captcha_path(self) -> bool:
        return "captcha" in self.path.split("?")[0].lower()

    def _fail_safe(self) -> None:
        """Chốt chặn cuối: mọi lỗi không tên vẫn phải trả response hợp lệ.

        Với endpoint captcha, response rỗng làm az.class kết thúc mà không nộp
        đáp án -> dialog "Xin chờ" treo vĩnh viễn. Trả đáp án hợp lệ (dù sai)
        để game chỉ hỏi lại captcha.
        """
        if self._is_captcha_path():
            self._send_captcha_answer(FALLBACK_ANSWER)
        else:
            self._send_bytes(b"")

    def _proxy(self, body: bytes | None) -> None:
        """Forward request về ORIGIN, trả response gốc byte-for-byte.
        OFFLINE=True -> KHÔNG gọi chip.vcdn.io.vn ra ngoài, phục vụ từ cache cục bộ để tránh treo 20s.
        """
        # Chốt chặn cuối: request captcha đi lạc vào đây (vd JAR retry sang
        # teacher.php) phải nhận đáp án hợp lệ, KHÔNG nhận cache config.
        if body and _extract_captcha(body.decode("utf-8", errors="replace")):
            bitmap, width, height = _extract_captcha(body.decode("utf-8", errors="replace"))
            log(f"GUARD captcha trên path {self.path} -> trả đáp án, bỏ qua cache/proxy")
            self._answer_captcha(bitmap, width, height)
            return
        if self._is_captcha_path():
            log(f"GUARD {self.command} {self.path} khong co bitmap -> fallback {FALLBACK_ANSWER}")
            self._send_captcha_answer(FALLBACK_ANSWER)
            return
        # 1. Nếu là config hoặc data đã cache -> trả cache ngay, không gọi chip
        # path có thể chứa query string (vd /avatar/full/data.php?_t=...)
        p = self.path.split("?")[0]
        try:
            cache_file = _CACHE_BY_PATH.get(p)
            if p == "/avatar/avdata.php" and (cache_file is None or not cache_file.exists()):
                # dữ liệu mẫu 15 bytes lấy từ chip, trả về để client không treo
                self._send_bytes(b"LgtHek:\x14\x05\x0cyetN")
                log(f"CACHE  {self.command} {self.path} -> 14 bytes (avdata offline)")
                return
            if cache_file is not None and cache_file.exists():
                data = cache_file.read_bytes()
                if cache_file == CACHED_CONFIG:
                    data = _patch_chip_config(data, PUBLIC_BASE_URL)
                self._send_bytes(data)
                log(f"CACHE  {self.command} {self.path} -> {len(data)} bytes ({cache_file.name}, KHÔNG gọi chip)")
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
                patched = _patch_chip_config(data, PUBLIC_BASE_URL)
                if patched is not data:
                    data = patched
                    log(f"PROXY PATCH config {url} -> {len(data)} bytes ({PUBLIC_BASE_URL})")
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
        try:
            if self.path in ("/health", "/healthz"):
                self.send_response(200)
                self.send_header("Content-Type", "text/plain")
                self.send_header("Content-Length", "2")
                self.end_headers()
                self.wfile.write(b"ok")
                log(f"HEALTH check {self.path}")
                return
            self._proxy(None)
        except Exception as e:
            log(f"ERROR GET {self.path}: {e}")
            self._fail_safe()

    def do_POST(self):
        try:
            body = self._read_body()
        except Exception as e:
            log(f"ERROR đọc body {self.path}: {e}")
            self._fail_safe()
            return
        text = body.decode("utf-8", errors="replace")
        log(f"POST {self.path} len={len(body)} body[:120]={text[:120]!r}")
        if 0 < len(text) < 50:
            log(f"  POST hex[:100]={body[:100].hex()}")

        # Request captcha: nhận diện theo NỘI DUNG (bitmap 0/1), không theo path,
        # vì az.class retry bằng URL khác (teacher.php) khi đã fail lần trước.
        try:
            captcha = _extract_captcha(text)
        except Exception as e:
            log(f"ERROR parse captcha {self.path}: {e}")
            captcha = None
        if captcha is not None:
            self._answer_captcha(*captcha)
            return

        if self._is_captcha_path():
            log(f"POST {self.path} khong co bitmap hop le -> fallback {FALLBACK_ANSWER}")
            self._send_captcha_answer(FALLBACK_ANSWER)
            return

        try:
            self._proxy(body)
        except Exception as e:
            log(f"ERROR POST {self.path}: {e}")
            self._fail_safe()


def main() -> None:
    global MODEL_PATH, ORIGIN, PUBLIC_BASE_URL
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8643)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--ckpt", default=MODEL_PATH)
    ap.add_argument("--origin", default=ORIGIN)
    ap.add_argument("--public-base-url", default=DEFAULT_PUBLIC_BASE_URL)
    args = ap.parse_args()

    MODEL_PATH = args.ckpt
    ORIGIN = args.origin
    try:
        PUBLIC_BASE_URL = _normalize_base_url(args.public_base_url)
    except ValueError as exc:
        ap.error(str(exc))
    _load()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    log(
        f"Solver server (mimic+proxy) on {args.host}:{args.port} "
        f"-> origin {ORIGIN}; public base {PUBLIC_BASE_URL}"
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("Shutting down")


if __name__ == "__main__":
    main()
