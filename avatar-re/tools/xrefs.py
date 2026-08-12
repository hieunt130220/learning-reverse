#!/usr/bin/env python3
"""Tìm nơi gọi một hàm trong libil2cpp.so.

Giải mã trực tiếp opcode BL/B trên toàn file thay vì disassemble (nhanh hơn nhiều),
rồi quy địa chỉ về tên method bằng script.json.

    ./xrefs.py FarmService\\$\\$doJoinFarm
    ./xrefs.py 0x5d0c08
"""
import bisect
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SO = os.path.join(ROOT, "apk_extracted/lib/arm64-v8a/libil2cpp.so")
SCRIPT_JSON = os.path.join(ROOT, "il2cpp_out/script.json")


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    data = json.load(open(SCRIPT_JSON))
    a2n = {m["Address"]: m["Name"] for m in data["ScriptMethod"]}
    addrs = sorted(a2n)

    arg = sys.argv[1]
    if arg.startswith("0x"):
        targets = [(int(arg, 16), a2n.get(int(arg, 16), arg))]
    else:
        rx = re.compile(arg)
        targets = sorted((a, n) for a, n in a2n.items() if rx.search(n))
    if not targets:
        sys.exit(f"không tìm thấy method khớp /{arg}/")

    so = open(SO, "rb").read()
    wanted = {t for t, _ in targets}
    found: dict[int, list] = {t: [] for t in wanted}

    for off in range(0, len(so) - 4, 4):
        w = int.from_bytes(so[off : off + 4], "little")
        op = w >> 26
        if op not in (0b100101, 0b000101):  # BL / B
            continue
        imm = w & 0x3FFFFFF
        if imm & 0x2000000:
            imm -= 0x4000000
        dst = off + imm * 4
        if dst in wanted:
            i = bisect.bisect_right(addrs, off) - 1
            found[dst].append((off, a2n[addrs[i]], "BL" if op == 0b100101 else "B"))

    for t, name in targets:
        print(f"\n### {name} @{t:#x} — {len(found[t])} chỗ gọi")
        for off, caller, kind in found[t]:
            print(f"  {kind:2}  {off:#x}  trong  {caller}")


if __name__ == "__main__":
    main()
