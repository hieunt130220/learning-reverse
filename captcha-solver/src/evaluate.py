"""Đánh giá CRNN trên dataset có nhãn — bảng từng ảnh + accuracy tổng.

Chạy:
    cd captcha-solver
    ../.venv-captcha312/bin/python -m src.evaluate \
        --dataset ../avatar-web/server/captcha-dataset \
        --labels data/labels.csv \
        --ckpt checkpoints/crnn_ctc.pt
"""
from __future__ import annotations

import argparse
import csv
import time
from pathlib import Path

from src.predict import load_model, predict_image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--labels", required=True)
    parser.add_argument("--ckpt", required=True)
    args = parser.parse_args()

    rows = []
    with open(args.labels, newline="", encoding="utf-8") as f:
        for row in csv.reader(f):
            if len(row) == 2 and row[0] != "filename" and row[1].strip():
                rows.append((row[0], row[1].strip()))

    model, charset = load_model(args.ckpt)
    n_correct = 0
    n_char_total = 0
    n_char_correct = 0
    t_total = 0.0
    table = []
    for name, label in rows:
        path = Path(args.dataset) / name
        t0 = time.time()
        pred, conf = predict_image(path, model, charset)
        dt = time.time() - t0
        t_total += dt
        ok = pred == label
        n_correct += int(ok)
        # per-char: đối chiếu từng ký tự bằng difflib zip
        import difflib
        sm = difflib.SequenceMatcher(None, pred, label)
        n_char_total += len(label)
        n_char_correct += sum(b.size for b in sm.get_matching_blocks())
        table.append((name, label, pred, ok, conf, dt))

    print(f"{'filename':<50} {'label':<10} {'pred':<10} OK   conf   ms")
    for name, label, pred, ok, conf, dt in table:
        print(f"{name:<50} {label:<10} {pred:<10} "
              f"{'✔' if ok else '✗'}   {conf:.2f}  {dt*1000:5.0f}")

    print(f"\nExact-match: {n_correct}/{len(rows)} = "
          f"{n_correct/max(1,len(rows))*100:.1f}%")
    print(f"Per-char:    {n_char_correct}/{n_char_total} = "
          f"{n_char_correct/max(1,n_char_total)*100:.1f}%")
    print(f"Avg infer time: {t_total/max(1,len(rows))*1000:.0f} ms/ảnh")


if __name__ == "__main__":
    main()