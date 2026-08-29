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
from src.train import greedy_decode


def load_model(ckpt_path: str | Path) -> tuple[CaptchaCRNN, CharSet]:
    """Nạp checkpoint → (model eval mode, charset)."""
    ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    charset = CharSet.from_serialized(ckpt["charset"])
    model = CaptchaCRNN(charset.size)
    model.load_state_dict(ckpt["model"])
    model.eval()
    return model, charset


def preprocess(path: str | Path) -> torch.Tensor:
    """Load ảnh → tensor (1,1,15,100) float 0/1 đã denoise."""
    arr = remove_isolated_noise(load_alpha_binary(path))
    return torch.from_numpy(arr.astype(np.float32)).unsqueeze(0).unsqueeze(0)


def predict_array(arr: np.ndarray, model: CaptchaCRNN,
                  charset: CharSet) -> tuple[str, float]:
    """Predict từ mảng binary 0/1 (H, W) đã được denoise.

    Args:
        arr: numpy uint8 array shape (15, 100) hoặc (1, 15, 100),
             giá trị 1 = pixel chữ, 0 = nền.
        model: CaptchaCRNN đã load state dict.
        charset: CharSet tương ứng.

    Returns:
        (text, confidence) — confidence = mean max-prob over timesteps.
    """
    if arr.ndim == 2:
        arr = arr[np.newaxis, ...]  # (1, H, W)
    if arr.ndim == 3:
        arr = arr[np.newaxis, ...]  # (1, 1, H, W)
    tensor = torch.from_numpy(arr.astype(np.float32))
    with torch.no_grad():
        logp = model(tensor)  # (B, T, C)
        probs = logp.exp().max(dim=-1).values.mean().item()
        text = greedy_decode(logp, charset)[0]
    return text.strip(), probs


def decode_fixed_length(log_probs: torch.Tensor, charset: CharSet,
                        n: int) -> tuple[str, float]:
    """CTC Viterbi ep dung `n` ky tu non-blank.

    Greedy decode thoat vong CTC co the tra so ky tu khac 4 (thieu '148',
    thua '21217'). Pad/trim thoai mai sinh ra dap an chac chan sai -> game
    hoi captcha lien tuc, bieu hien ben ngoai la treo "Xin cho". Ham nay tim
    duong di CTC co diem cao nhat co dung n ky tu nen ket qua luon hop le.

    State (k, c, m): k = so ky tu da vao ket qua, c = ky tu cuoi (0 = chua co),
    m = 1 neu blank vua xen sau c (cho phep lap lai chinh c).

    Returns:
        (text, score) — score la log-prob duong di; -inf neu khong ton tai
        duong di dung n ky tu.
    """
    lp = log_probs[0].detach().double().cpu().numpy()  # (T, C+1), index 0 = blank
    T, S = lp.shape
    C = S - 1
    neg = -1e18
    if n <= 0 or T == 0 or C <= 0:
        return "", neg
    W = C + 1

    dp = np.full((n + 1, W, 2), neg)
    dp[0, 0, 1] = 0.0
    kind = np.zeros((T, n + 1, W, 2), dtype=np.int8)   # 0 blank, 1 repeat, 2 char
    pk = np.zeros((T, n + 1, W, 2), dtype=np.int8)
    pc = np.zeros((T, n + 1, W, 2), dtype=np.int16)
    pm = np.zeros((T, n + 1, W, 2), dtype=np.int8)

    for t in range(T):
        cur = dp
        ndp = np.full((n + 1, W, 2), neg)
        lb = lp[t, 0]
        chars = lp[t, 1:]

        # 1. blank: (k, c, m) -> (k, c, 1)
        for k in range(n + 1):
            for c in range(W):
                v0, v1 = cur[k, c, 0], cur[k, c, 1]
                src_m = 0 if v0 >= v1 else 1
                best = v0 if v0 >= v1 else v1
                if best <= neg / 2:
                    continue
                ndp[k, c, 1] = best + lb
                kind[t, k, c, 1] = 0
                pk[t, k, c, 1] = k
                pc[t, k, c, 1] = c
                pm[t, k, c, 1] = src_m

        # 2. lap lai chinh ky tu (CTC collapse): (k, c, 0) -> (k, c, 0)
        for k in range(1, n + 1):
            cand = cur[k, 1:, 0] + chars
            tgt = ndp[k, 1:, 0]
            upd = cand > tgt
            if not upd.any():
                continue
            ndp[k, 1:, 0] = np.where(upd, cand, tgt)
            cs = np.nonzero(upd)[0] + 1
            kind[t, k, cs, 0] = 1
            pk[t, k, cs, 0] = k
            pc[t, k, cs, 0] = cs
            pm[t, k, cs, 0] = 0

        # 3. ky tu moi: (k, c, m) -> (k+1, a, 0) voi a != c hoac (a == c va m == 1)
        for k in range(n):
            A = np.maximum(cur[k, :, 0], cur[k, :, 1])
            order = np.argsort(-A)
            i1 = int(order[0])
            i2 = int(order[1]) if W > 1 else i1
            m1, m2 = A[i1], A[i2]
            excl = np.where(np.arange(W) == i1, m2, m1)      # max qua c != a
            excl_c = np.where(np.arange(W) == i1, i2, i1)
            a_idx = np.arange(1, W)
            same_blank = cur[k, a_idx, 1]                    # a == c, can blank chen
            prev_val = np.maximum(excl[a_idx], same_blank)
            prev_is_same = same_blank > excl[a_idx]
            if prev_val.max() <= neg / 2:
                continue
            cand = prev_val + chars
            tgt = ndp[k + 1, a_idx, 0]
            upd = (cand > tgt) & (prev_val > neg / 2)
            if not upd.any():
                continue
            ndp[k + 1, a_idx, 0] = np.where(upd, cand, tgt)
            aa = a_idx[upd]
            kind[t, k + 1, aa, 0] = 2
            pk[t, k + 1, aa, 0] = k
            pc[t, k + 1, aa, 0] = np.where(prev_is_same[upd], aa, excl_c[aa])
            pm[t, k + 1, aa, 0] = np.where(
                prev_is_same[upd], 1,
                np.where(cur[k, excl_c[aa], 0] >= cur[k, excl_c[aa], 1], 0, 1),
            )
        dp = ndp

    finals = dp[n, 1:, :]
    if finals.max() <= neg / 2:
        return "", neg
    c, m = divmod(int(finals.argmax()), 2)
    c += 1
    score = float(dp[n, c, m])

    out = [0] * n
    k, cc, mm = n, c, m
    for t in range(T - 1, -1, -1):
        if k == 0:
            break
        if kind[t, k, cc, mm] == 2:
            out[k - 1] = cc
        nk, nc, nm = int(pk[t, k, cc, mm]), int(pc[t, k, cc, mm]), int(pm[t, k, cc, mm])
        k, cc, mm = nk, nc, nm
    text = "".join(charset.chars[i - 1] for i in out if 0 < i <= C)
    return text, score


def predict_array_fixed(arr: np.ndarray, model: CaptchaCRNN, charset: CharSet,
                        n: int = 4) -> tuple[str, float]:
    """Predict va ep ket qua ve dung `n` ky tu. Tra (text, confidence)."""
    if arr.ndim == 2:
        arr = arr[np.newaxis, ...]
    if arr.ndim == 3:
        arr = arr[np.newaxis, ...]
    tensor = torch.from_numpy(arr.astype(np.float32))
    with torch.no_grad():
        logp = model(tensor)
        probs = logp.exp().max(dim=-1).values.mean().item()
        text, _ = decode_fixed_length(logp, charset, n)
    return text.strip(), probs


def predict_image(path: str | Path, model: CaptchaCRNN,
                  charset: CharSet) -> tuple[str, float]:
    """Predict 1 ảnh. Trả về (text, conf)."""
    arr = remove_isolated_noise(load_alpha_binary(path))
    return predict_array(arr, model, charset)


def main() -> None:
    parser = argparse.ArgumentParser(description="Predict captcha")
    parser.add_argument("--image", help="Đường dẫn 1 ảnh")
    parser.add_argument("--dir", help="Thư mục chứa nhiều ảnh")
    parser.add_argument("--ckpt", default="checkpoints/crnn_ctc.pt")
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