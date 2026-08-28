"""PyTorch Dataset cho captcha thật (có nhãn) + augmentation.

Vì font bitmap cố định và ảnh chỉ 100x15, augmentation tập trung vào:
- dịch ngang ±4px, dịch dọc ±1px
- thêm/vỡ nhiễu nhẹ (các pixel ngẫu nhiên như nhiễu thật)
- bào mòn/giãn nở ngẫu nhiên 1 lần (bắt chước thay đổi độ dày nét)
"""
from __future__ import annotations

import csv
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import Dataset

from src.captcha_io import list_dataset_images, load_alpha_binary
from src.charset import CharSet
from src.denoise import remove_isolated_noise

WIDTH, HEIGHT = 100, 15
NOISE_RATE = 0.25  # mật độ nhiễu tối đa trên nền


def _add_noise(arr: np.ndarray, rng: np.random.Generator, rate: float) -> np.ndarray:
    """Thêm nhiễu điểm ngẫu nhiên vào vùng nền (bắt chước nhiễu captcha thật)."""
    if rate <= 0:
        return arr
    out = arr.copy()
    bg = np.argwhere(out == 0)
    if len(bg):
        n_add = max(1, int(rate * len(bg) / 400.0))
        picks = bg[rng.integers(0, len(bg), size=n_add)]
        for yy, xx in picks:
            out[yy, xx] = 1
    return out


def _erode(arr: np.ndarray) -> np.ndarray:
    """Bào mòn nhẹ: chỉ loại pixel đầu mút nét (<=1 láng giềng).

    KHÔNG dùng ngưỡng cao (<4) vì sẽ xóa sạch nét ngang 1px
    (thanh ngang của Đ, viền trên/dưới chữ) làm hỏng glyph.
    """
    from src.denoise import _neighbor_count
    n = _neighbor_count(arr)
    return np.where(arr & (n <= 1), 0, arr).astype(np.uint8)


def _dilate(arr: np.ndarray) -> np.ndarray:
    """Giãn nở 1 pixel (nét dày hơn) — bật pixel nền kề cạnh pixel chữ."""
    from src.denoise import _neighbor_count
    n = _neighbor_count(arr)
    return np.where(arr | (n > 0), 1, 0).astype(np.uint8)


class CaptchaDataset(Dataset):
    """Dataset từ ảnh PNG + labels.csv.

    Mỗi sample: (image (1,15,100) float32, target list[int]).
    """

    def __init__(self, dataset_dir: str | Path, labels_csv: str | Path,
                 charset: CharSet, augment: bool = True,
                 augment_noise: float = 0.15, seed: int = 0):
        self.charset = charset
        self.augment = augment
        self.augment_noise = augment_noise
        self.rng = np.random.default_rng(seed)
        self.pairs: list[tuple[Path, str]] = []
        labels: dict[str, str] = {}
        with open(labels_csv, newline="", encoding="utf-8") as f:
            for row in csv.reader(f):
                if len(row) == 2 and row[0] != "filename" and row[1].strip():
                    labels[row[0]] = row[1].strip()
        for p in list_dataset_images(dataset_dir):
            if p.name in labels:
                self.pairs.append((p, labels[p.name]))
        if not self.pairs:
            raise ValueError("Không có ảnh nào khớp labels.csv")

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int):
        path, text = self.pairs[idx]
        img = load_alpha_binary(path)
        if self.augment:
            img = self._augment(img)
        else:
            img = remove_isolated_noise(img)
        tensor = torch.from_numpy(img.astype(np.float32)).unsqueeze(0)  # (1,15,100)
        target = torch.tensor(self.charset.encode(text), dtype=torch.long)
        return tensor, text, target

    def _augment(self, img: np.ndarray) -> np.ndarray:
        rng = self.rng
        img = remove_isolated_noise(img)
        # dịch ngang ±4
        shift = int(rng.integers(-4, 5))
        if shift != 0:
            img = np.roll(img, shift, axis=1)
            if shift > 0:
                img[:, :shift] = 0
            else:
                img[:, shift:] = 0
        # dịch dọc ±1
        vshift = int(rng.integers(-1, 2))
        if vshift != 0:
            img = np.roll(img, vshift, axis=0)
            if vshift > 0:
                img[:vshift, :] = 0
            else:
                img[vshift:, :] = 0
        # nhiễu
        img = _add_noise(img, rng, self.augment_noise)
        # bào mòn/giãn nở ngẫu nhiên
        m = rng.random()
        if m < 0.2:
            img = _erode(img)
        elif m > 0.8:
            img = _dilate(img)
        return img


def collate(batch: list[tuple[torch.Tensor, str, torch.Tensor]]):
    """Ghép batch: (images (B,1,15,100), texts, targets 1D nối, target_lengths)."""
    images, texts, targets = zip(*batch)
    images = torch.stack(images, dim=0)
    target_cat = torch.cat(targets, dim=0)
    target_lens = torch.tensor([t.numel() for t in targets], dtype=torch.long)
    return images, list(texts), target_cat, target_lens