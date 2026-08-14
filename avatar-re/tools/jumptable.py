#!/usr/bin/env python3
"""Đọc jump-table của FarmMsgHandler.onMessage và map command -> nhánh xử lý.
Table base VA=0x14e35d8, 53 entry i32 (index 0..52 = command 51..103), target = base + entry.
Với mỗi target, disasm vài lệnh để lấy lời gọi named đầu tiên (handler)."""
import struct, json
import capstone
from capstone import Cs, CS_MODE_ARM
CS_ARCH_ARM64 = capstone.CS_ARCH_AARCH64

WS = "/Users/devios/learning-reverse/avatar-re"
SO = f"{WS}/apk_extracted/lib/arm64-v8a/libil2cpp.so"
data = open(SO, "rb").read()

def segments():
    e_phoff = struct.unpack_from("<Q", data, 0x20)[0]
    e_phentsize = struct.unpack_from("<H", data, 0x36)[0]
    e_phnum = struct.unpack_from("<H", data, 0x38)[0]
    segs = []
    for i in range(e_phnum):
        off = e_phoff + i * e_phentsize
        if struct.unpack_from("<I", data, off)[0] != 1:
            continue
        p_offset = struct.unpack_from("<Q", data, off + 0x08)[0]
        p_vaddr = struct.unpack_from("<Q", data, off + 0x10)[0]
        p_filesz = struct.unpack_from("<Q", data, off + 0x20)[0]
        segs.append((p_vaddr, p_offset, p_filesz))
    return segs

SEGS = segments()
def va2off(va):
    for v, o, sz in SEGS:
        if v <= va < v + sz:
            return va - v + o
    return None

sj = json.load(open(f"{WS}/il2cpp_out/script.json"))
addr2name = {m["Address"]: m["Name"] for m in sj["ScriptMethod"]}
md = Cs(CS_ARCH_ARM64, CS_MODE_ARM)

BASE = 0x14e35d8
toff = va2off(BASE)
seen = {}
for idx in range(53):
    entry = struct.unpack_from("<i", data, toff + idx * 4)[0]
    target = BASE + entry
    cmd = idx + 0x33
    # disasm target, lấy vài lời gọi named đầu tiên
    off = va2off(target)
    calls = []
    if off is not None:
        for insn in md.disasm(data[off:off + 40 * 4], target):
            if insn.mnemonic == "bl":
                nm = addr2name.get(int(insn.op_str.lstrip("#"), 0), "")
                if "$$" in nm:
                    calls.append(nm.split("$$")[-1])
            if insn.mnemonic in ("ret", "br") and calls:
                break
            if len(calls) >= 4:
                break
    key = target
    dup = "  (== cmd %d)" % seen[key] if key in seen else ""
    if key not in seen:
        seen[key] = cmd
    print(f"cmd {cmd:>3} (idx {idx:>2}) -> {hex(target)}  calls: {', '.join(calls[:4]) or '(inline)'}{dup}")
