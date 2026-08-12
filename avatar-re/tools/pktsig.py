#!/usr/bin/env python3
"""Trích schema gói tin TX từ libil2cpp.so.

Disassemble thân method, phân giải mọi `bl` bằng script.json, rồi in ra
chuỗi `Message(cmd)` + các lời gọi myWriter.write* theo đúng thứ tự trên wire.
Đây là ground truth: kiểu tham số C# KHÔNG cho biết width thật.

    ./pktsig.py 'FarmService\\$\\$do'
    ./pktsig.py 'GlobalService\\$\\$login'
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SO = os.path.join(ROOT, "apk_extracted/lib/arm64-v8a/libil2cpp.so")
SCRIPT_JSON = os.path.join(ROOT, "il2cpp_out/script.json")
OBJDUMP = "/usr/bin/objdump"

# myWriter.write* -> nhãn kiểu trên wire (đọc từ disassembly của chính myWriter)
WIRE = {
    "myWriter$$writeByte": "i8",
    "myWriter$$writeSByte": "i8",
    "myWriter$$writeSByteUncheck": "i8",
    "myWriter$$writeUnsignedByte": "u8",
    "myWriter$$writeShort": "i16",
    "myWriter$$writeUnsignedShort": "u16",
    "myWriter$$writeInt": "i32",
    "myWriter$$writeLong": "i64",
    "myWriter$$writeBoolean": "bool",
    "myWriter$$writeBool": "bool",
    "myWriter$$writeUTF": "utf",
    "myWriter$$writeString": "str",
    "myWriter$$write": "bytes",
    # chiều nhận
    "myReader$$readByte": "i8",
    "myReader$$readSByte": "i8",
    "myReader$$readsbyte": "i8",
    "myReader$$readUnsignedByte": "u8",
    "myReader$$readShort": "i16",
    "myReader$$readUnsignedShort": "u16",
    "myReader$$readInt": "i32",
    "myReader$$readLong": "i64",
    "myReader$$readBoolean": "bool",
    "myReader$$readBool": "bool",
    "myReader$$readUTF": "utf",
    "myReader$$readStringUTF": "utf",
    "myReader$$readString": "str",
}


def load_symbols():
    with open(SCRIPT_JSON) as f:
        data = json.load(f)
    addr2name, name2addr = {}, {}
    for m in data.get("ScriptMethod", []):
        addr2name[m["Address"]] = m["Name"]
        name2addr.setdefault(m["Name"], m["Address"])
    return addr2name, name2addr


def disasm(start, stop):
    out = subprocess.run(
        [OBJDUMP, "-d", f"--start-address={start:#x}", f"--stop-address={stop:#x}", SO],
        capture_output=True, text=True, check=True,
    ).stdout
    rows = []
    for line in out.splitlines():
        m = re.match(r"\s*([0-9a-f]+):\s+[0-9a-f]{8}\s+(\S+)\s*(.*)", line)
        if m:
            rows.append((int(m.group(1), 16), m.group(2), m.group(3).strip()))
    return rows


def trace(name, addr, stop, addr2name):
    """In chuỗi thao tác ghi của một method."""
    steps = []
    pending_imm = {}  # reg -> immediate gần nhất, để bắt hằng opcode của Message(cmd)
    for _, mnem, ops in disasm(addr, stop):
        if mnem in ("mov", "movz", "orr") and "#" in ops:
            m = re.match(r"(w\d+), (?:wzr, )?#(0x[0-9a-f]+|\d+)", ops)
            if m:
                pending_imm[m.group(1)] = int(m.group(2), 0)
        elif mnem in ("bl", "b"):
            # `b` = tail-call: nhiều hàm kết thúc bằng `b FarmService$$send`
            m = re.match(r"(0x[0-9a-f]+)", ops)
            if not m:
                continue
            target = int(m.group(1), 16)
            sym = addr2name.get(target)
            if not sym:
                continue
            if sym == "Message$$.ctor":
                cmd = pending_imm.get("w1")
                if cmd is not None:
                    signed = cmd - 256 if cmd > 127 else cmd
                    steps.append(f"NEW Message(cmd={signed})")
            elif sym in WIRE:
                imm = pending_imm.get("w1")
                extra = ""
                if imm is not None and mnem == "bl":
                    extra = f"  <const {imm}?>" if imm in pending_imm.values() else ""
                steps.append(f"  {WIRE[sym]}{extra}")
            elif sym.endswith("$$send") or sym.endswith("$$sendMessage"):
                steps.append("SEND")
            pending_imm.pop("w1", None)
    return steps


def main():
    pattern = sys.argv[1] if len(sys.argv) > 1 else r"FarmService\$\$do"
    addr2name, name2addr = load_symbols()
    ordered = sorted(addr2name)

    rx = re.compile(pattern)
    hits = sorted((a, n) for a, n in addr2name.items() if rx.search(n))
    if not hits:
        sys.exit(f"không khớp method nào với /{pattern}/")

    for addr, name in hits:
        i = ordered.index(addr)
        stop = ordered[i + 1] if i + 1 < len(ordered) else addr + 0x400
        stop = min(stop, addr + 0x1000)
        steps = trace(name, addr, stop, addr2name)
        if not steps:
            continue  # không đụng tới reader/writer -> không phải hàm gói tin
        print(f"\n### {name}  @{addr:#x}")
        for s in steps:
            print(s)


if __name__ == "__main__":
    main()
