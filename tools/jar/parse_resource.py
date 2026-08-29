#!/usr/bin/env python3
"""Parse packed resource normal/lg.png trong avatar-auto.jar.

Cấu trúc (từ br(String) constructor — header KHÔNG bị XOR):
  - readUnsignedByte: số entries (raw)
  - mỗi entry: readByte len (raw), tên (XOR key từ index 0),
    readUnsignedShort length (raw); offset cộng dồn
  - blob: readFully rồi XOR key từ index 0
  - dữ liệu từng entry: Base64 (eS.do) → text "k:v" pairs
"""
from __future__ import annotations

import base64
import io
import struct
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent.parent
JAR = ROOT / "avatar-jar" / "avatar-auto.jar"
KEY = b"NguyenHuuQuyet"
RES = "normal/lg.png"


def xor(data: bytes) -> bytes:
    return bytes(b ^ KEY[i % len(KEY)] for i, b in enumerate(data))


def main() -> None:
    with ZipFile(JAR) as jar:
        raw = jar.read(RES)
    buf = io.BytesIO(raw)
    count = struct.unpack(">B", buf.read(1))[0]
    print(f"{RES}: {len(raw)} bytes, entries: {count}")

    entries = []
    offset = 0
    for i in range(count):
        nlen = struct.unpack(">b", buf.read(1))[0]
        name = xor(buf.read(nlen)).decode("utf-8", errors="replace")
        length = struct.unpack(">H", buf.read(2))[0]
        entries.append((name, offset, length))
        offset += length
        print(f"  [{i}] {name!r} offset={offset - length} len={length}")

    blob = xor(buf.read())
    print(f"blob: {len(blob)} bytes (dự kiến {offset}), còn dư {len(raw) - buf.tell()} bytes header")

    out_dir = ROOT / "tools/jar/out/resource"
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, off, length in entries:
        data = blob[off : off + length]
        safe = name.replace("/", "_")
        (out_dir / safe).write_bytes(data)
        print(f"\n=== {name!r} ({len(data)} bytes) ===")
        try:
            text = base64.b64decode(data, validate=True).decode("utf-8", errors="replace")
            print(text[:1200])
        except Exception:
            printable = sum(32 <= b < 127 or b in (9, 10, 13) for b in data) / max(len(data), 1)
            print(f"(không phải base64, printable {printable:.0%}) {data[:120]!r}")


if __name__ == "__main__":
    main()
