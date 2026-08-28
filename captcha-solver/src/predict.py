"""Suy luận (predict) captcha bằng CRNN+CTC đã train.

Chạy:
    cd captcha-solver
    ../.venv-captcha312/bin/python -m src.predict \
        --image ../avatar-web/server/captcha-dataset/xxx.png \
        --ckpt checkpoints/crnn_ctc.pt
  hoặc --dir <thư_mục> để predict hàng loạt.
"""
from __future__ import annotations

import argparse
import time
from pathlib import Path

import numpy as np
import torch

from src.captcha_io import load_alpha_binary
from src.charset import CharSet
from src.denoise import remove_isolated_noise
from src.model import CaptchaCRNN


def load_model(ckpt_path: str | Path) -> tuple[CaptchaCRNN, CharSet]:
    """Nạp checkpoint → (model eval mode, charset)."""
    ckpt = torch.load(ckpt_path, map_location="cpu")
    charset = CharSet.from_serialized(ckpt["charset"])
    model = CaptchaCRNN(charset.size)
    model.load_state_dict(ckpt["model"])
    model.eval()
    return model, charset


def preprocess(path: str | Path) -> torch.Tensor:
    """Load ảnh → tensor (1,1,15,100) float 0/1 đã denoise."""
    arr = remove_isolated_noise(load_alpha_binary(path))
    return torch.from_numpy(arr.astype(np.float32)).unsqueeze(0).unsqueeze(0)


def predict_image(path: str | Path, model: CaptchaCRNN,
                  charset: CharSet) -> tuple[str, float]:
    """Predict 1 ảnh. Trả về (text, conf)."""
    x = preprocess(path)
    with torch.no_grad():
        logp = model(x)  # (1, 25, C)
        probs = logp.exp().max(dim=-1).values.mean().item()
        from src.train import greedy_decode
        text = greedy_decode(logp, charset)[0]
    return text.strip(), probs


def main() -> None:
    parser = argparse.ArgumentParser(description="Predict captcha")
    parser.add_argument("--image", help="Đường dẫn 1 ảnh")
    parser.add_argument("--dir", help="Thư mục chứa nhiều ảnh")
    parser.add_argument("--ckpt", required=True,
                        default="checkpoints/crnn_ctc.pt")
    args = parser.parse_args()

    if not args.image and not args.dir:
        parser.error("Cần --image hoặc --dir")
    model, charset = load_model(args.ckpt)
    print(f"Charset: {charset.chars_str}")

    if args.image:
        text, conf = predict_image(args.image, model, charset)
        print(f"{Path(args.image).name}: {text}  (conf {conf:.3f})")
    else:
        import glob
        t0 = time.time()
        for p in sorted(glob.glob(str(Path(args.dir) / "*.png"))):
            text, conf = predict_image(p, model, charset)
            print(f"{Path(p).name}: {text}  (conf {conf:.3f})")
        print(f"n images = {len(glob.glob(str(Path(args.dir) / '*.png')))}"
              f"  total {time.time()-t0:.1f}s")


if __name__ == "__main__":
    main()