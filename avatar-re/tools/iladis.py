#!/usr/bin/env python3
"""Disassemble 1 hàm trong libil2cpp.so (arm64) và resolve các lệnh 'bl' sang tên method
qua script.json của Il2CppDumper. Dùng để xác minh chuỗi writeInt/writeShort/writeByte.

Cách dùng:
  python dis.py FarmService..doPlantSeed (dùng $$ khi gõ tay)
  python dis.py 0x5D1290
  python dis.py doPlantSeed          # tìm gần đúng theo tên
"""
import sys, json, struct
from capstone import Cs, CS_ARCH_ARM64, CS_MODE_ARM

WS = "/Users/devios/learning-reverse/avatar-re"
SO = f"{WS}/apk_extracted/lib/arm64-v8a/libil2cpp.so"
SCRIPT = f"{WS}/il2cpp_out/script.json"

def load_segments(data):
    # ELF64 header: e_phoff@0x20, e_phentsize@0x36(H), e_phnum@0x38(H)
    e_phoff = struct.unpack_from("<Q", data, 0x20)[0]
    e_phentsize = struct.unpack_from("<H", data, 0x36)[0]
    e_phnum = struct.unpack_from("<H", data, 0x38)[0]
    segs = []
    for i in range(e_phnum):
        off = e_phoff + i * e_phentsize
        p_type = struct.unpack_from("<I", data, off)[0]
        if p_type != 1:  # PT_LOAD
            continue
        p_offset = struct.unpack_from("<Q", data, off + 0x08)[0]
        p_vaddr  = struct.unpack_from("<Q", data, off + 0x10)[0]
        p_filesz = struct.unpack_from("<Q", data, off + 0x20)[0]
        segs.append((p_vaddr, p_offset, p_filesz))
    return segs

def va_to_off(va, segs):
    for p_vaddr, p_offset, p_filesz in segs:
        if p_vaddr <= va < p_vaddr + p_filesz:
            return va - p_vaddr + p_offset
    return None

def main():
    if len(sys.argv) < 2:
        print(__doc__); return
    target = sys.argv[1]
    ninsn = int(sys.argv[2]) if len(sys.argv) > 2 else 90

    data = open(SO, "rb").read()
    segs = load_segments(data)
    sj = json.load(open(SCRIPT))
    methods = sj["ScriptMethod"]  # [{Address, Name}]
    # map địa chỉ -> tên; và tìm hàm mục tiêu
    addr2name = {m["Address"]: m["Name"] for m in methods}

    if target.lower().startswith("0x"):
        func_va = int(target, 16)
        func_name = addr2name.get(func_va, "?")
    else:
        cand = [m for m in methods if target in m["Name"]]
        if not cand:
            print(f"Không tìm thấy method chứa '{target}'"); return
        if len(cand) > 1:
            print(f"[{len(cand)} kết quả, lấy cái đầu] " + ", ".join(c["Name"] for c in cand[:6]))
        func_va = cand[0]["Address"]; func_name = cand[0]["Name"]

    off = va_to_off(func_va, segs)
    if off is None:
        print(f"VA {hex(func_va)} không nằm trong segment nào"); return

    md = Cs(CS_ARCH_ARM64, CS_MODE_ARM)
    code = data[off: off + ninsn * 4]
    summ = "--sum" in sys.argv

    if "--calls" in sys.argv:
        # Liệt kê MỌI bl (theo thứ tự địa chỉ), không dừng ở ret — để đọc luồng RX có nhánh/vòng lặp.
        for insn in md.disasm(code, func_va):
            if insn.mnemonic == "bl":
                nm = addr2name.get(int(insn.op_str.lstrip("#"), 0), insn.op_str)
                short = nm.split("$$")[-1] if "$$" in nm else nm
                print(f"  {insn.address:08x}  {short}")
        return

    if summ:
        cmd = None; writes = []
        for insn in md.disasm(code, func_va):
            if insn.mnemonic == "mov" and insn.op_str.startswith("w1, #0x") and cmd is None:
                cmd = insn.op_str.split("#")[1]
            if insn.mnemonic == "bl":
                nm = addr2name.get(int(insn.op_str.lstrip("#"), 0), "")
                if "myWriter$$write" in nm:
                    writes.append(nm.split("write")[1])
            if insn.mnemonic == "ret":
                break
        v = int(cmd, 16) if cmd else None
        vs = f"{v}" + (f"({v-256})" if v is not None and v > 127 else "") if v is not None else "?"
        print(f"{func_name:<34} cmd={cmd}={vs:<8} writes=[{', '.join(writes)}]")
        return

    print(f"== {func_name}  VA={hex(func_va)} off={hex(off)} ==")
    for insn in md.disasm(code, func_va):
        note = ""
        if insn.mnemonic == "bl":
            tgt = int(insn.op_str.lstrip("#"), 0)
            note = "  -> " + addr2name.get(tgt, hex(tgt))
        print(f"  {insn.address:08x}  {insn.mnemonic:<6} {insn.op_str}{note}")
        if insn.mnemonic == "ret":
            break

if __name__ == "__main__":
    main()
