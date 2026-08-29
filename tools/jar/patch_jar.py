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
import struct
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

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

    Theo docs/protocol/az-ocr-notes.md:
    - Case -60 (cmd -60) trong class fJ khởi tạo var5 = do[1] (=0).
    - Chỉ auto OCR khi var5 >= do[36] (=1) VÀ flag az.do:B != 0 (server
      trả khi login) VÀ màn hình là al/bS. Nếu không -> bx.do.do(img)
      hiện captcha nhập tay.
    - Patch: đổi 1 byte iconst_1 -> iconst_2 khi load index vào var5.
      Lúc đó var5 = do[2] (=1) luôn >= do[36] (=1) -> auto OCR trigger.
      Gate az.do vẫn phải pass (server phải enable OCR) — KHÔNG bypass.

    Pattern 20 bytes (duy nhất trong class):
        12 02 b6 02 36 58      ldc #2; invokevirtual length; pop2
        b2 01 37 04 2e 36 05   getstatic do:[I; iconst_1; iaload; istore 5
        b2 01 37 04 2e 36 06   getstatic do:[I; iconst_1; iaload; istore 6
    Patch CA HAI byte iconst_1 (offset 9 va 16) -> iconst_2 (05) de ca
    var5 = do[2] (=1) va var6 = do[2] (=1). OCR chi chay khi ca 2 != 0.
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
    # Patch CA HAI iconst_1 (0x04) -> iconst_2 (0x05) cho var5 (offset 9) va var6 (offset 16).
    # Ca 2 deu = do[2] = 1 -> OCR gate var5!=0 AND var6!=0 passed.
    patched = bytearray(data)
    if patched[i + 9] != 0x04 or patched[i + 16] != 0x04:
        raise SystemExit(f"!! patch_fj: byte khong phai iconst_1")
    patched[i + 9] = 0x05
    patched[i + 16] = 0x05
    print("  patch fJ.class: var5,var6 index 1->2 (auto OCR)")

    # Fix logic dao nguoc: doi ifeq (0x99) thanh ifne (0x9c)
    # Tim ifeq instruction ma branch toi OCR code (offset 19088)
    count = 0
    for offset in range(i, i + 120):
        if data[offset] == 0x99:  # ifeq opcode
            branch_offset = int.from_bytes(data[offset+1:offset+3], 'big', signed=True)
            target = offset + 3 + branch_offset
            if target == 19088:  # OCR code
                patched[offset] = 0x9c  # ifeq -> ifne
                count += 1
    print(f"  patch fJ.class: ifeq->ifne x{count}")
    if count != 2:
        raise SystemExit(f"!! patch_fj: expected 2 ifeq to OCR, found {count}")

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

    # Repack JAR bằng Python ZipFile nhưng giữ nguyên metadata MS-DOS giống
    # JAR gốc (create_system=0). MicroEmulator cũ đọc sai nếu dùng zip -u.
    patched_fj = patch_fj_bytecode(dict(all_entries)["fJ.class"])
    new_entries = {RES: new_res, "fJ.class": patched_fj}

    with ZipFile(JAR_IN, "r") as src, ZipFile(args.out, "w", ZIP_DEFLATED) as dst:
        for info in src.infolist():
            data = new_entries.get(info.filename, src.read(info.filename))
            # Giữ nguyên create_system=0, compress_type từ entry gốc
            new_info = ZipInfo(info.filename, info.date_time)
            new_info.compress_type = info.compress_type
            new_info.create_system = 0  # MS-DOS
            new_info.external_attr = info.external_attr
            if info.flag_bits & 0x01:  # ZIP_ENCRYPTED
                new_info.flag_bits |= 0x01
            dst.writestr(new_info, data)

    print(f"\n✅ Đã ghi {args.out} ({Path(args.out).stat().st_size} bytes)")
    print(f"   Bản gốc giữ nguyên: {JAR_IN}")


if __name__ == "__main__":
    main()
