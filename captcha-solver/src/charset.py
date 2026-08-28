"""Charset + mã hóa/giải mã CTC cho captcha Avatar.

CTC dùng blank index 0. Các ký tự còn lại xếp theo charset (bảng chữ).
Chuỗi nhãn phải chỉ chứa các ký tự có trong charset.
"""
from __future__ import annotations

import csv
from pathlib import Path

# Các ký tự cơ bản theo mức độ quan sát được từ dữ liệu thật.
# Đây là charset NỀN; khi có labels.csv đầy đủ sẽ mở rộng thêm.
DEFAULT_CHARS = list("0123456789Đabcdefghijklmnopqrstuvwxyz")


class CharSet:
    def __init__(self, chars: list[str] | None = None):
        # dedupe giữ thứ tự
        self.chars: list[str] = []
        seen: set[str] = set()
        for ch in (chars or DEFAULT_CHARS):
            if ch not in seen:
                seen.add(ch)
                self.chars.append(ch)
        self._char_to_idx = {ch: i + 1 for i, ch in enumerate(self.chars)}
        self.blank_id = 0
        self.size = len(self.chars) + 1  # + blank

    def encode(self, text: str) -> list[int]:
        """Chuỗi ký tự → list index CTC (mỗi char 1 index)."""
        out = []
        for ch in text:
            if ch not in self._char_to_idx:
                raise ValueError(
                    f"Ký tự {ch!r} không nằm trong charset: {''.join(self.chars)}")
            out.append(self._char_to_idx[ch])
        return out

    def contains(self, text: str) -> bool:
        return all(ch in self._char_to_idx for ch in text)

    @property
    def chars_str(self) -> str:
        return "".join(self.chars)

    @classmethod
    def from_labels_csv(cls, labels_csv: str | Path,
                        extra: str = "") -> "CharSet":
        """Dựng charset tự động từ mọi ký tự xuất hiện trong labels.csv."""
        chars: list[str] = []
        seen: set[str] = set()
        with open(labels_csv, newline="", encoding="utf-8") as f:
            for row in csv.reader(f):
                if (len(row) == 2 and row[0] != "filename"
                        and row[1].strip()):
                    for ch in row[1].strip():
                        if ch not in seen:
                            seen.add(ch)
                            chars.append(ch)
        return cls(chars + [c for c in extra if c not in seen])

    @classmethod
    def from_serialized(cls, chars_str: str) -> "CharSet":
        return cls(list(chars_str))