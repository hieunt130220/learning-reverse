"""Đọc ảnh captcha Avatar → mảng binary từ kênh alpha.

Ảnh captcha của game Avatar là PNG 100x15 RGBA trong đó:
- RGB toàn đen (0,0,0)
- Kênh alpha chứa nội dung: pixel chữ có alpha > 0, nền alpha = 0

Hàm `load_alpha_binary` trả về mảng uint8 0/1 shape (H, W) với 1 = pixel chữ.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
from PIL import Image


def load_alpha_binary(path: str | Path) -> np.ndarray:
    """Load PNG captcha và trả về mảng binary 0/1 (uint8) từ kênh alpha.

    Args:
        path: Đường dẫn file PNG captcha.

    Returns:
        Mảng numpy uint8 shape (H, W), giá trị 1 ở pixel chữ, 0 ở nền.
    """
    img = Image.open(path)
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    alpha = np.array(img)[:, :, 3]
    return (alpha > 0).astype(np.uint8)


def alpha_sha256(arr: np.ndarray) -> str:
    """Hash SHA-256 nội dung mảng binary — dùng để dedupe ảnh trùng.

    Args:
        arr: Mảng binary 0/1 từ `load_alpha_binary`.

    Returns:
        Chuỗi hex SHA-256.
    """
    return hashlib.sha256(np.ascontiguousarray(arr).tobytes()).hexdigest()


def list_dataset_images(dataset_dir: str | Path) -> list[Path]:
    """Danh sách file .png trong thư mục dataset, sort theo tên file.

    Args:
        dataset_dir: Thư mục chứa captcha PNG (VD: avatar-web/server/captcha-dataset).

    Returns:
        List Path sort tăng dần theo tên.
    """
    return sorted(Path(dataset_dir).glob("*.png"))
