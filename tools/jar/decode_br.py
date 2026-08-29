#!/usr/bin/env python3
"""Decode config bảng của br.class (chứa URL OCR) từ avatar-auto.jar.

Cách hoạt động (từ decompiled br.java):
- Hằng số obfuscate `br.do[i]` là biểu thức XOR/cộng-trừ thuần → eval trực tiếp.
- XOR key `if` (byte[14]) dựng từ các hằng số đó.
- Resource file (tên = bT.if() + aQ.do(int[])) bị XOR bằng key trên → giải ra
  được bảng "index:giá_trị" (URL, host, path...).

Chạy: ../../.venv-captcha312/bin/python tools/jar/decode_br.py
"""
from __future__ import annotations

import re
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent.parent
BR_JAVA = ROOT / "tools/jar/out/decompiled/br.java"
JAR = ROOT / "avatar-jar" / "avatar-auto.jar"


def java_eval(expr: str) -> int:
    """Eval biểu thức obfuscate: chỉ + - ^ & ( ) và ' '.length() literals."""
    expr = expr.replace('"   ".length()', "3")
    expr = expr.replace('"  ".length()', "2")
    expr = expr.replace('" ".length()', "1")
    return eval(expr, {"__builtins__": {}}, {})  # noqa: S307


def parse_br_constants() -> dict[int, int]:
    src = BR_JAVA.read_text(encoding="utf-8")
    consts: dict[int, int] = {}
    for m in re.finditer(r"br\.do\[(\d+)\]\s*=\s*([^;]+);", src):
        consts[int(m.group(1))] = java_eval(m.group(2))
    return consts


def build_xor_key(consts: dict[int, int]) -> bytes:
    # static block: byArray[br.do[x]] = do[y]; (byte[14])
    src = BR_JAVA.read_text(encoding="utf-8")
    block = src[src.index("byte[] byArray = new byte[") : src.index("if = byArray;")]
    pairs = re.findall(r"byArray\[br\.do\[(\d+)\]\]\s*=\s*do\[(\d+)\];", block)
    size = consts[int(re.search(r"new byte\[do\[(\d+)\]\]", block).group(1))]
    key = bytearray(size)
    for pos_idx, val_idx in pairs:
        key[consts[int(pos_idx)]] = consts[int(val_idx)] & 0xFF
    return bytes(key)


def aq_decode_ints(arr: list[int]) -> str | None:
    """aQ.do(int[]): char[i] = a[i] - (len-1), i < len-1; checksum (sum - a[last]) % (len-1) == 0."""
    n = len(arr) - 1
    if n <= 0:
        return None
    checksum = sum(arr[:n])
    if (checksum - arr[n]) % n != 0:
        print(f"  !! checksum fail: (sum={checksum} - last={arr[n]}) % {n} != 0")
    return "".join(chr(v - n) for v in arr[:n])


def main() -> None:
    consts = parse_br_constants()
    print(f"br.do[] constants ({len(consts)}): {consts}")
    key = build_xor_key(consts)
    print(f"XOR key ({len(key)} bytes): {key!r}")

    # Tên resource: aQ.do(int[do[0]]) với các gán trong br.do() (dòng 248-257)
    src = BR_JAVA.read_text(encoding="utf-8")
    loader = src[src.index("public static void do() {") :]
    m_len = re.search(r"int\[\] nArray = new int\[do\[(\d+)\]\]", loader)
    arr_len = consts[int(m_len.group(1))]
    arr = [0] * arr_len
    for pos_idx, val_idx in re.findall(r"nArray\[br\.do\[(\d+)\]\]\s*=\s*do\[(\d+)\];", loader):
        arr[consts[int(pos_idx)]] = consts[int(val_idx)]
    res_name = aq_decode_ints(arr)
    print(f"Resource name (aQ.do decoded): {res_name!r}")

    print("\n--- XOR-decrypt mọi resource non-class trong JAR ---")
    with ZipFile(JAR) as jar:
        for name in jar.namelist():
            if name.endswith((".class", "/")):
                continue
            data = jar.read(name)
            dec = bytes(b ^ key[i % len(key)] for i, b in enumerate(data))
            printable = sum(32 <= b < 127 or b in (10, 13, 9) for b in dec) / max(len(dec), 1)
            flag = " <== TEXT" if printable > 0.85 else ""
            print(f"\n[{name}] {len(data)} bytes, printable {printable:.0%}{flag}")
            if printable > 0.5:
                preview = dec[:600].decode("utf-8", errors="replace")
                for line in preview.splitlines()[:25]:
                    print("   ", line)


if __name__ == "__main__":
    main()
