#!/usr/bin/env python3
"""Tính br.do[] từ bytecode và decode config XOR."""
from pathlib import Path
from zipfile import ZipFile

JAR = Path(__file__).resolve().parent.parent.parent / "avatar-jar" / "avatar-auto.jar"


def compute_br_do() -> list[int]:
    """Evaluate br.for() bytecode - corrected values."""
    do = [0] * 35
    do[0] = 0x9E ^ 0x96          # 8
    do[1] = 1
    do[2] = 0xC3 ^ 0xB5 ^ (0x15 ^ 0x55)  # 54
    do[3] = 1
    do[4] = 0x14 ^ 0x67          # 115
    do[5] = 2
    do[6] = 0x70 ^ 0x1E          # 110
    do[7] = 3
    do[8] = 0x4C ^ 0x6F ^ (0x6A ^ 0x7C)  # 53
    do[9] = 0x59 ^ 0x22 ^ (97 + 74 - 49 + 5)  # 4
    do[10] = 0x75 ^ 0x7E         # 11
    do[11] = -1
    do[12] = (78 + 64 - 71 + 63) ^ (132 + 0 - 56 + 67)  # 134 ^ 143 = 9
    do[13] = 0x53 ^ 0x67 ^ (0x1A ^ 0x28)  # 6
    do[14] = 2 ^ (0xA5 ^ 0xA0)   # 7
    do[15] = 0xA5 ^ 0xAB         # 14
    do[16] = 0xE ^ 0x40          # 78
    do[17] = 0x7A ^ 0x18 ^ (0x2A ^ 0x2F)  # 103
    do[18] = 0xE0 ^ 0x99         # 121
    do[19] = 0x52 ^ 0x16 ^ (0x79 ^ 0x58)  # 101
    do[20] = 0x6F ^ 0x27         # 72
    do[21] = 0x26 ^ 0x50 ^ (53 + 74 - 97 + 97)  # 9
    do[22] = 4 ^ 0x55            # 81
    do[23] = 0xE4 ^ 0x87 ^ (0x4E ^ 0x27)  # 10
    do[24] = 0x9C ^ 0x97         # 11
    do[25] = 0x5E ^ 0x52         # 12
    do[26] = 0x84 ^ 0x89         # 13
    do[27] = 0xFD ^ 0xA4 ^ (0x72 ^ 0x5F)  # 116
    do[28] = 0x91 ^ 0xA3         # 50
    do[29] = 0x39 ^ 0x4B         # 114
    do[30] = 0x64 ^ 0x2B ^ (1 ^ 0x25)  # 107
    do[31] = 0x13 ^ 0x70         # 99
    do[32] = 0xBA ^ 0xC6         # 124
    do[33] = 0x4E ^ 0x73         # 61
    do[34] = (113 + 88 - 182 + 157) ^ (11 + 56 - 11 + 83)  # 176 ^ 139 = 39
    return do


def xor_decrypt(data: bytes, key: bytes) -> bytes:
    if not key:
        return data
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))


def main() -> int:
    do = compute_br_do()
    print(f"do = {do}")
    
    # XOR key: byte[do[15]=14], valid indices 0-13
    # Bytecode sets: 1,3,5,7,9,11,13,14,0,21,23,24,25,26
    # Valid: 0,1,3,5,7,9,11,13
    key = bytearray(14)
    key[0] = do[12]   # 9
    key[1] = do[16]   # 78
    key[3] = do[17]   # 103
    key[5] = do[12]   # 9
    key[7] = do[18]   # 121
    key[9] = do[19]   # 101
    key[11] = do[6]   # 110
    key[13] = do[20]  # 72
    print(f"XOR key (14 bytes): {bytes(key).hex()}")
    print(f"XOR key chars: {list(key)}")
    
    with ZipFile(JAR) as zf:
        for name in zf.namelist():
            if name.endswith('.class'):
                continue
            info = zf.getinfo(name)
            if info.file_size > 20000 or info.file_size < 5:
                continue
            raw = zf.read(name)
            dec = xor_decrypt(raw, bytes(key))
            # Check if it looks like text
            try:
                text = dec.decode('utf-8', errors='strict')
                printable = sum(1 for c in text if c.isprintable() or c in '\n\r\t')
                if printable > len(text) * 0.8:
                    print(f"\n✓ {name} ({info.file_size}b):")
                    print(text[:500])
            except:
                pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


