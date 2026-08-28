"""Train CRNN+CTC trên captcha thật có nhãn (labels.csv) với augmentation.

Chạy:
    cd captcha-solver
    ../.venv-captcha312/bin/python -m src.train \
        --dataset ../avatar-web/server/captcha-dataset \
        --labels data/labels.csv \
        --out checkpoints/crnn_ctc.pt \
        --epochs 40 --batch-size 32
"""
from __future__ import annotations

import argparse
import random
import time
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader

from src.charset import CharSet
from src.dataset import CaptchaDataset, collate
from src.model import CaptchaCRNN, ctc_loss

SEED = 42


def greedy_decode(log_probs: torch.Tensor, charset: CharSet) -> list[str]:
    """Decode greedy CTC: bỏ blank + collapse lặp.

    Args:
        log_probs: (B, T, C) log-softmax.
        charset: charset để map index->char.

    Returns:
        List chuỗi dự đoán.
    """
    preds = log_probs.argmax(dim=-1)  # (B, T)
    out = []
    for p in preds.cpu().numpy():
        chars = []
        prev = -1
        for t in p.tolist():
            if t == 0:  # blank
                prev = -1
                continue
            if t != prev:
                chars.append(t)
            prev = t
        out.append("".join(charset.chars[i - 1] for i in chars))
    return out


def evaluate(loader: DataLoader, model: torch.nn.Module,
             charset: CharSet) -> dict:
    """Đánh giá exact-match accuracy + loss trên loader (không augmentation)."""
    model.eval()
    total, correct, loss_sum = 0, 0, 0.0
    with torch.no_grad():
        for images, texts, targets, target_lens in loader:
            logp = model(images)
            loss = ctc_loss(logp, targets, target_lens)
            loss_sum += float(loss.item()) * len(texts)
            preds = greedy_decode(logp, charset)
            for pr, tr in zip(preds, texts):
                total += 1
                correct += (pr.strip() == tr.strip())
    return {"acc": correct / max(1, total), "n": total, "correct": correct,
            "avg_loss": loss_sum / max(1, total)}


def train(args) -> None:
    torch.manual_seed(SEED)
    random.seed(SEED)
    np.random.seed(SEED)

    out_dir = Path(args.out).parent
    out_dir.mkdir(parents=True, exist_ok=True)

    charset = CharSet.from_labels_csv(args.labels)
    print("Charset:", charset.chars_str)
    print("num_classes (gồm blank):", charset.size)

    ds_all = CaptchaDataset(args.dataset, args.labels, charset,
                            augment=True, augment_noise=args.noise, seed=SEED)
    n = len(ds_all)
    print(f"Samples: {n}")

    # chia train/val theo index (val giữ nguyên, không augment)
    val_frac = args.val_frac
    n_val = max(1, int(n * val_frac))
    indices = list(range(n))
    random.shuffle(indices)
    val_idx = indices[:n_val]
    train_idx = [i for i in indices if i not in set(val_idx)]

    # val loader: dataset riêng với augment=False (đọc labels + filter)
    ds_val = CaptchaDataset(args.dataset, args.labels, charset,
                            augment=False, seed=SEED)
    from torch.utils.data import Subset
    ds_train = Subset(ds_all, train_idx)
    val_sub = Subset(ds_val, val_idx if len(val_idx) else [0])

    train_loader = DataLoader(ds_train, batch_size=args.batch_size,
                              shuffle=True, num_workers=0, drop_last=False,
                              collate_fn=collate)
    val_loader = DataLoader(val_sub, batch_size=args.batch_size,
                            shuffle=False, num_workers=0,
                            collate_fn=collate)

    model = CaptchaCRNN(charset.size)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=150, gamma=0.5)

    best_acc = 0.0
    t0 = time.time()
    for epoch in range(1, args.epochs + 1):
        model.train()
        running = 0.0
        n_batch = 0
        for images, texts, targets, target_lens in train_loader:
            optimizer.zero_grad()
            logp = model(images)
            loss = ctc_loss(logp, targets, target_lens)
            loss.backward()
            optimizer.step()
            running += float(loss.item())
            n_batch += 1
        scheduler.step()
        train_loss = running / max(1, n_batch)
        vres = evaluate(val_loader, model, charset)
        t_el = time.time() - t0
        print(f"Epoch {epoch:2d}/{args.epochs} | train_loss {train_loss:.3f} "
              f"| val_acc {vres['acc']*100:5.1f}% ({vres['correct']}/{vres['n']}) "
              f"| {t_el:.0f}s", flush=True)
        if vres["acc"] >= best_acc:
            best_acc = vres["acc"]
            # ghi checkpoint cùng charset
            torch.save({
                "model": model.state_dict(),
                "charset": charset.chars_str,
                "epoch": epoch,
                "val_acc": vres["acc"],
            }, args.out)
            print(f"  -> saved {args.out} (val_acc {vres['acc']*100:.1f}%)")
        if vres["acc"] >= 0.999:
            print("Val accuracy đạt 99.9% — dừng sớm.")
            break

    # luôn lưu last state dù val không tăng
    torch.save({
        "model": model.state_dict(),
        "charset": charset.chars_str,
        "epoch": args.epochs,
        "val_acc": best_acc,
    }, args.out)
    print(f"  -> saved last state {args.out}")

    print(f"\nDone. Best val acc: {best_acc*100:.1f}%")
    print(f"Checkpoint: {args.out}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Train CRNN+CTC captcha")
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--labels", required=True)
    parser.add_argument("--out", default="checkpoints/crnn_ctc.pt")
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--noise", type=float, default=0.15)
    parser.add_argument("--val-frac", type=float, default=0.2)
    train(parser.parse_args())


if __name__ == "__main__":
    main()