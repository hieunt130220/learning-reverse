#!/usr/bin/env python3
"""Patch avatar-auto.jar → avatar-auto-patched.jar (trỏ OCR về solver local).

Cách hoạt động (xem docs/protocol/az-ocr-notes.md):
- Config OCR nằm trong resource `normal/lg.png` (archive packed, XOR key
  'NguyenHuuQuyet'), entry `u.png` chứa text `0=...|1=...|2=<URL OCR>|...`.
- Patch: đổi value của key `2` thành URL solver local (mặc định
  http://127.0.0.1:8643/), rebuild entry u.png + offsets, ghi JAR mới.
- Bản gốc KHÔNG bị đụng vào. Cấu trúc archive giữ nguyên nên br.class
  đọc bình thường.

⚠️ Lưu ý: server game có thể đẩy config override lúc login (key "2=") —
khi đó cần patch bytecode (xem notes §6). Verify bằng live capture.

Chạy: ../../.venv-captcha312/bin/python tools/jar/patch_jar.py [--url URL]
"""
from __future__ import annotations

import argparse
import shutil
import struct
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent.parent
JAR_IN = ROOT / "avatar-jar" / "avatar-auto.jar"
JAR_OUT = ROOT / "avatar-jar" / "avatar-auto-patched.jar"
KEY = b"NguyenHuuQuyet"
RES = "normal/lg.png"
CONFIG_ENTRY = "u.png"
PATCH_KEY = "2"
DEFAULT_URL = "http://127.0.0.1:8643/"


def xor(data: bytes) -> bytes:
    return bytes(b ^ KEY[i % len(KEY)] for i, b in enumerate(data))


def parse_archive(raw: bytes) -> tuple[list[tuple[str, bytes]], bytes]:
    """lg.png → [(tên, dữ_liệu)], phần header dư (nếu có)."""
    buf = memoryview(raw)
    count = buf[0]
    entries = []
    offset = 1
    for _ in range(count):
        nlen = struct.unpack_from(">b", buf, offset)[0]
        offset += 1
        name = xor(bytes(buf[offset : offset + nlen])).decode("utf-8")
        offset += nlen
        length = struct.unpack_from(">H", buf, offset)[0]
        offset += 2
        entries.append([name, length])  # length tạm, fill sau
    blob = xor(bytes(buf[offset:]))
    out = []
    pos = 0
    for name, length in entries:
        out.append((name, blob[pos : pos + length]))
        pos += length
    return out, bytes(buf[offset + pos :])


def build_archive(entries: list[tuple[str, bytes]]) -> bytes:
    """[(tên, dữ_liệu)] → lg.png bytes (đúng cấu trúc br(String) đọc)."""
    header = bytearray()
    header.append(len(entries))
    offset = 0
    for name, data in entries:
        nb = name.encode("utf-8")
        header += struct.pack(">b", len(nb)) + xor(nb)
        header += struct.pack(">H", len(data))
        offset += len(data)
    blob = xor(b"".join(d for _, d in entries))
    return bytes(header) + blob


def patch_config(entries: list[tuple[str, bytes]], new_url: str) -> list[tuple[str, bytes]]:
    import base64
    out = []
    patched = False
    for name, data in entries:
        if name == CONFIG_ENTRY:
            text = base64.b64decode(data).decode("utf-8")  # u.png = base64
            parts = text.split("|")
            new_parts = []
            for p in parts:
                if "=" in p and p.split("=", 1)[0] == PATCH_KEY:
                    old = p.split("=", 1)[1]
                    print(f"  patch {PATCH_KEY}={old!r} → {new_url!r}")
                    new_parts.append(f"{PATCH_KEY}={new_url}")
                    patched = True
                else:
                    new_parts.append(p)
            data = base64.b64encode("|".join(new_parts).encode("utf-8"))
        out.append((name, data))
    if not patched:
        raise SystemExit(f"!! không tìm thấy key {PATCH_KEY}= trong {CONFIG_ENTRY}")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--out", default=str(JAR_OUT))
    args = ap.parse_args()

    with ZipFile(JAR_IN) as jar:
        raw_res = jar.read(RES)
        all_entries = [(i.filename, jar.read(i.filename))
                       for i in jar.infolist() if not i.is_dir()]

    sub_entries, _ = parse_archive(raw_res)
    print(f"{RES}: {len(sub_entries)} entries: {[n for n, _ in sub_entries]}")
    patched_sub = patch_config(sub_entries, args.url)
    new_res = build_archive(patched_sub)

    # verify round-trip ngay: parse lại config từ archive mới
    check, _ = parse_archive(new_res)
    for name, data in check:
        if name == CONFIG_ENTRY:
            print(f"  verify: {data.decode('utf-8')!r}")

    with ZipFile(args.out, "w", ZIP_DEFLATED) as jar:
        for name, data in all_entries:
            jar.writestr(name, new_res if name == RES else data)

    print(f"\n✅ Đã ghi {args.out} ({Path(args.out).stat().st_size} bytes)")
    print(f"   Bản gốc giữ nguyên: {JAR_IN}")


if __name__ == "__main__":
    main()
