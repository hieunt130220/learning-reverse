#!/usr/bin/env python3
"""Trích xuất class từ avatar-auto.jar an toàn (tránh va chạm hoa/thường trên macOS).

Mỗi entry được ghi với hậu tố hash 8 ký tự của tên entry để `az.class` và
`aZ.class` không ghi đè nhau (handoff doc §2).

Chạy: ../.venv-captcha312/bin/python tools/jar/extract_classes.py
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path
from zipfile import ZipFile

JAR = Path(__file__).resolve().parent.parent.parent / "avatar-jar" / "avatar-auto.jar"
OUT = Path(__file__).resolve().parent / "out"

TARGETS = ["az.class", "br.class", "cU.class", "fJ.class", "aQ.class"]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with ZipFile(JAR) as jar:
        names = jar.namelist()
        print(f"JAR: {JAR} — {len(names)} entries")
        for target in TARGETS:
            if target not in names:
                print(f"  !! không tìm thấy {target}")
                continue
            data = jar.read(target)
            h = hashlib.sha256(data).hexdigest()[:8]
            out_name = f"{target[:-6]}_{h}.class"  # bỏ '.class', thêm hash
            (OUT / out_name).write_bytes(data)
            print(f"  {target} ({len(data)} bytes) -> out/{out_name}")

    # liệt kê mọi entry .class để tra cứu nhanh
    listing = OUT / "all_entries.txt"
    with ZipFile(JAR) as jar:
        listing.write_text("\n".join(jar.namelist()), encoding="utf-8")
    print(f"Danh sách entries: {listing}")


if __name__ == "__main__":
    sys.exit(main())
