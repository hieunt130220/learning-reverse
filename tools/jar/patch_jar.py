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
import os
import shutil
import struct
import subprocess
import tempfile
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


def patch_fj_bytecode(data: bytes) -> bytes:
    """Patch fJ.class: mọi captcha có ảnh -> luôn đi qua OCR worker (az).

    Case -60 (cmd -60) khởi tạo:
        var5 = do[1], var6 = do[1]
    rồi chỉ auto OCR khi cả var5 và var6 khác 0. Ta đổi cả hai giá trị
    initial từ do[1] (=0) thành do[2] (=1) — tức iconst_1 -> iconst_2 —
    để vượt qua gate và luôn new az(...).

    Pattern 20 bytes (duy nhất trong class — có prefix ldc #2; invokevirtual
    String.length; pop2 đứng ngay trước + istore 6 theo sau):
        12 02 b6 02 36 58      ldc #2; invokevirtual length; pop2
        b2 01 37 04 2e 36 05   getstatic do:[I; iconst_1; iaload; istore 5
        b2 01 37 04 2e 36 06   getstatic do:[I; iconst_1; iaload; istore 6
    Patch cả hai byte iconst_1 (index 9 và 16) -> iconst_2 (05), đồng thời
    bỏ qua hai gate `az.do` và `bX.do != null` ngay sau đó. Hai gate này
    vẫn giữ nguyên kích thước instruction bằng `pop; nop; nop`, để branch
    offsets của method không thay đổi.
    """
    pat = bytes.fromhex(
        "1202b60236" + "58"
        + "b20137" + "04" + "2e3605"
        + "b20137" + "04" + "2e3606"
    )
    count = data.count(pat)
    if count != 1:
        raise SystemExit(
            f"!! patch_fj: tìm thấy {count} occurrence (cần đúng 1) — không patch"
        )
    i = data.index(pat)
    # Pattern contains two iconst_1 instructions: var5 at +9 and var6 at +16.
    patched = bytearray(data)
    patched[i + 9] = 0x05
    patched[i + 16] = 0x05

    # Sau var5/var6 là:
    #   getstatic az.do; invokestatic if(I)Z; ifeq 7165
    #   getstatic bX.do; invokestatic do(Object)Z; ifeq 7165
    # Thay mỗi chuỗi 3-byte `ifeq target` bằng pop/nop/nop: bỏ boolean
    # trên operand stack và luôn fall-through vào phần xử lý captcha.
    gate1 = bytes.fromhex("b200c4b801df")  # az.do; if(I)Z
    gate2 = bytes.fromhex("b200ecb801d9")  # bX.do; do(Object)Z
    # Resolve the exact `ifeq` bytes by the known method bytecode sequence.
    for gate in (gate1, gate2):
        start = data.find(gate, i)
        if start < 0:
            raise SystemExit("!! patch_fj: không tìm thấy gate captcha")
        branch = start + len(gate)
        if patched[branch] != 0x99:
            raise SystemExit("!! patch_fj: gate không phải ifeq")
        patched[branch:branch + 3] = b"\x57\x00\x00"
    print("  patch fJ.class: var5,var6 + 2 gate -> luôn auto OCR")
    return bytes(patched)


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

    # Không dùng ZipFile để repack toàn bộ JAR: MicroEmulator cũ yêu cầu
    # metadata ZIP kiểu MS-DOS/Info-ZIP giống JAR build bằng Ant. Thay vào
    # đó copy JAR gốc rồi dùng `zip -u` chỉ cập nhật đúng hai entry.
    with tempfile.TemporaryDirectory(prefix="captcha-jar-") as tmp:
        tmp_path = Path(tmp)
        (tmp_path / RES).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / RES).write_bytes(new_res)
        patched_fj = patch_fj_bytecode(dict(all_entries)["fJ.class"])
        (tmp_path / "fJ.class").write_bytes(patched_fj)
        shutil.copy2(JAR_IN, args.out)
        subprocess.run(
            ["/usr/bin/zip", "-q", "-u", str(Path(args.out).resolve()), RES, "fJ.class"],
            cwd=tmp,
            check=True,
        )

    print(f"\n✅ Đã ghi {args.out} ({Path(args.out).stat().st_size} bytes)")
    print(f"   Bản gốc giữ nguyên: {JAR_IN}")


if __name__ == "__main__":
    main()
