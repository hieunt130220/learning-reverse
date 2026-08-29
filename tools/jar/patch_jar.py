#!/usr/bin/env python3
"""Patch avatar-auto.jar thành JAR dùng captcha resolver được chỉ định.

Cách hoạt động (xem docs/protocol/az-ocr-notes.md):
- Config OCR nằm trong resource `normal/lg.png` (archive packed, XOR key
  'NguyenHuuQuyet'), entry `u.png` chứa text `0=...|1=...|2=<URL OCR>|...`.
- Patch: đổi value của key `2` thành URL solver (mặc định local
  http://127.0.0.1:8643/), rebuild entry u.png + offsets, ghi JAR mới.
- Bản gốc KHÔNG bị đụng vào. Cấu trúc archive giữ nguyên nên br.class
  đọc bình thường.
- Patch fJ.class bytecode:
  1. Gán default var5 = do[2] (=1) và var6 = do[2] (=1) bằng iconst_2.
  2. NOP 9 bytes kiểm tra cờ az.do:B từ server để bypass hoàn toàn gate OCR.
  3. Giữ nguyên ifeq (0x99) nhảy thẳng vào khối khởi tạo OCR worker az,
     rồi gọi az.if() ngay thay vì chờ screen tick đang bị dialog chặn.

Chạy:
    python3 tools/jar/patch_jar.py [--url URL] [--out OUTPUT_JAR]
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

    Chi tiết:
    - Offset i:
        12 02 b6 02 36 58      ldc #2; invokevirtual length; pop2
        b2 01 37 04 2e 36 05   getstatic do:[I; iconst_1; iaload; istore 5
        b2 01 37 04 2e 36 06   getstatic do:[I; iconst_1; iaload; istore 6
    1. Patch iconst_1 -> iconst_2 cho cả var5 (offset +9) và var6 (offset +16).
       Lúc này var5 = do[2] (=1) và var6 = do[2] (=1) làm giá trị mặc định.
    2. NOP 9 bytes kiểm tra cờ az.do:B từ server (offset +20 đến +28):
       b2 00 c4 b8 01 df 99 00 3d -> 9 bytes 0x00 (NOP).
       Execution rơi thẳng vào kiểm tra bX.do instanceof al / bS mà không phụ thuộc server flag.
    3. Giữ nguyên ifeq (0x99) ở các lệnh jump tới 7290 (offset +100 và +108).
    4. Thêm Methodref az.if:()V vào cuối constant pool, rồi thay hai chuỗi
       putstatic al.do/bS.do + invokestatic wakeup thành invokevirtual az.if
       + 3 NOP. Stack effect và độ dài bytecode không đổi.
    """
    cp_count = int.from_bytes(data[8:10], "big")
    cp_end = 10
    cp_index = 1
    while cp_index < cp_count:
        tag = data[cp_end]
        cp_end += 1
        if tag == 1:  # Utf8
            length = int.from_bytes(data[cp_end:cp_end + 2], "big")
            cp_end += 2 + length
        elif tag in (3, 4):  # Integer, Float
            cp_end += 4
        elif tag in (5, 6):  # Long, Double — chiếm hai constant-pool slots
            cp_end += 8
            cp_index += 1
        elif tag in (7, 8, 16, 19, 20):
            cp_end += 2
        elif tag in (9, 10, 11, 12, 17, 18):
            cp_end += 4
        elif tag == 15:
            cp_end += 3
        else:
            raise SystemExit(f"!! patch_fj: constant-pool tag không hỗ trợ: {tag}")
        cp_index += 1

    # fJ constant pool đã có Class #64 = az và NameAndType #784 = if:()V.
    # Append Methodref mới để không thay đổi index của các entry hiện có.
    az_if_methodref = cp_count
    methodref_entry = bytes([10]) + struct.pack(">HH", 64, 784)
    data = (
        data[:8]
        + struct.pack(">H", cp_count + 1)
        + data[10:cp_end]
        + methodref_entry
        + data[cp_end:]
    )

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
    patched = bytearray(data)

    # 1. Patch iconst_1 (0x04) -> iconst_2 (0x05) cho var5 và var6
    if patched[i + 9] != 0x04 or patched[i + 16] != 0x04:
        raise SystemExit(f"!! patch_fj: byte không phải iconst_1")
    patched[i + 9] = 0x05
    patched[i + 16] = 0x05
    print("  patch fJ.class: var5, var6 default index 1->2 (do[2]=1)")

    # 2. NOP 9 bytes của az.do:B gate check: b2 00 c4 b8 01 df 99 00 3d
    az_gate_pat = bytes.fromhex("b200c4b801df99003d")
    if patched[i + 20 : i + 29] != az_gate_pat:
        raise SystemExit(f"!! patch_fj: không khớp pattern az.do:B check")
    for k in range(9):
        patched[i + 20 + k] = 0x00  # NOP
    print("  patch fJ.class: NOP 9 bytes az.do:B server check (bypass OCR gate)")

    # 3. Đảm bảo các lệnh jump tới khối OCR giữ nguyên opcode ifeq (0x99)
    # Offset +100 (18973) và +108 (18981)
    ifeq1_offset = i + 100
    ifeq2_offset = i + 108
    if patched[ifeq1_offset] != 0x99 or patched[ifeq2_offset] != 0x99:
        raise SystemExit(f"!! patch_fj: opcode jump không phải ifeq (0x99)")
    print("  patch fJ.class: giữ nguyên ifeq (0x99) nhảy thẳng vào OCR worker block")

    # 4. az instance đang được giữ trong al.do/bS.do nhưng popup "Xin chờ"
    # chặn screen tick, nên az.if() không bao giờ chạy. Gọi trực tiếp ngay sau
    # constructor; thay đúng 6 bytes nên không cần sửa branch offsets/StackMap.
    al_worker = bytes.fromhex("b300b1b8018a")  # putstatic al.do; invokestatic aQ.for
    bs_worker = bytes.fromhex("b300dab8018e")  # putstatic bS.do; invokestatic aQ.this
    direct_call = bytes([0xB6]) + struct.pack(">H", az_if_methodref) + b"\x00\x00\x00"
    if patched.count(al_worker) != 1 or patched.count(bs_worker) != 1:
        raise SystemExit("!! patch_fj: không tìm thấy đúng một OCR holder/wakeup sequence")
    patched = bytearray(bytes(patched).replace(al_worker, direct_call, 1))
    patched = bytearray(bytes(patched).replace(bs_worker, direct_call, 1))
    print(f"  patch fJ.class: gọi trực tiếp invokevirtual #{az_if_methodref} az.if() cho al/bS")

    return bytes(patched)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Patch Avatar Auto JAR để gọi captcha resolver được chỉ định",
    )
    ap.add_argument(
        "--url",
        default=DEFAULT_URL,
        help=f"base URL của captcha resolver (default: {DEFAULT_URL})",
    )
    ap.add_argument(
        "--out",
        default=str(JAR_OUT),
        help=f"đường dẫn JAR output (default: {JAR_OUT})",
    )
    args = ap.parse_args()

    target_url = args.url.strip()
    if not target_url:
        ap.error("--url không được rỗng")
    target_url = target_url.rstrip("/") + "/"
    output_path = Path(args.out).expanduser().resolve()
    print(f"Target resolver URL: {target_url}")
    print(f"Output JAR: {output_path}")

    with ZipFile(JAR_IN) as jar:
        raw_res = jar.read(RES)
        all_entries = [(i.filename, jar.read(i.filename))
                       for i in jar.infolist() if not i.is_dir()]

    sub_entries, _ = parse_archive(raw_res)
    print(f"{RES}: {len(sub_entries)} entries: {[n for n, _ in sub_entries]}")
    patched_sub = patch_config(sub_entries, target_url)
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

    with ZipFile(JAR_IN, "r") as src, ZipFile(output_path, "w", ZIP_DEFLATED) as dst:
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

    print(f"\n✅ Đã ghi {output_path} ({output_path.stat().st_size} bytes)")
    print(f"   Bản gốc giữ nguyên: {JAR_IN}")


if __name__ == "__main__":
    main()
