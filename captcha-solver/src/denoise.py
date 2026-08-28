"""Khử nhiễu pixel cô lập trên ảnh captcha binary.

Nhiễu của captcha Avatar là các pixel đơn (hoặc cụm nhỏ) rải rác ngẫu nhiên,
trong khi nét chữ bitmap luôn liên tục. Nguyên tắc: pixel on (giá trị 1) có
ít láng giềng on (8-connectivity) hơn ngưỡng sẽ bị coi là nhiễu và loại.
"""
from __future__ import annotations

import numpy as np


def _neighbor_count(arr: np.ndarray) -> np.ndarray:
    """Đếm số láng giềng on (giá trị 1) trong 8 hướng cho từng pixel.

    Args:
        arr: Mảng binary uint8 0/1 shape (H, W).

    Returns:
        Mảng uint8 cùng shape, mỗi phần tử = số láng giềng on (0..8).
    """
    padded = np.pad(arr, 1, constant_values=0)
    total = np.zeros(arr.shape, dtype=np.uint8)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            total += padded[1 + dy : 1 + dy + arr.shape[0],
                            1 + dx : 1 + dx + arr.shape[1]]
    return total


def remove_isolated_noise(arr: np.ndarray, min_neighbors: int = 2,
                          iterations: int = 2) -> np.ndarray:
    """Loại pixel on có số láng giềng on < `min_neighbors` (nhiễu cô lập).

    Lặp `iterations` lần vì khi một pixel nhiễu bị loại, số láng giềng của
    pixel khác cũng giảm có thể lộ thêm nhiễu.

    Args:
        arr: Mảng binary uint8 0/1.
        min_neighbors: Ngưỡng láng giềng tối thiểu để giữ pixel (mặc định 2).
        iterations: Số lần lặp khử (mặc định 2).

    Returns:
        Mảng binary đã khử nhiễu (bản sao, không sửa input).
    """
    out = arr.copy()
    for _ in range(iterations):
        neighbors = _neighbor_count(out)
        keep = (out == 0) | (neighbors >= min_neighbors)
        out = np.where(keep, out, 0).astype(np.uint8)
    return out


def noise_mask(original: np.ndarray, denoised: np.ndarray) -> np.ndarray:
    """Mask nhiễu: pixel on ở bản gốc nhưng bị loại ở bản đã khử.

    Args:
        original: Ảnh binary gốc.
        denoised: Ảnh binary sau khử nhiễu.

    Returns:
        Mảng uint8 0/1, 1 = pixel nhiễu đã bị loại.
    """
    return ((original > 0) & (denoised == 0)).astype(np.uint8)
