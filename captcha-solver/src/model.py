"""Model CRNN (CNN → BiLSTM → CTC head) nhận ảnh captcha 100x15 → chuỗi.

Input: tensor (B, 1, H, W) float, giá trị 0/1 (text=1, nền=0).
Output: log-probs (B, T, C) với C = charset.size (gồm blank), T = số frame thời gian.
Kích thước input được pad chiều cao lên bội số chia hết cho pooling (padding 1 px
trên/dưới để 15 → 16).
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


class CaptchaCRNN(nn.Module):
    def __init__(self, num_classes: int, height: int = 15, width: int = 100):
        super().__init__()
        self.num_classes = num_classes
        self.height = height
        self.width = width
        self.height_pad = 16  # 15 -> 16 để chia hết pool (2,2)

        def conv_block(cin: int, cout: int, pool: tuple[int, int]) -> nn.Sequential:
            return nn.Sequential(
                nn.Conv2d(cin, cout, kernel_size=3, padding=1, bias=False),
                nn.BatchNorm2d(cout),
                nn.ReLU(inplace=True),
                nn.MaxPool2d(kernel_size=pool, stride=pool),
            )

        self.features = nn.Sequential(
            conv_block(1, 32, (2, 2)),   # (32, 8, 50)
            conv_block(32, 64, (2, 1)),  # (64, 4, 50)
            conv_block(64, 128, (2, 2)), # (128, 2, 25)
            conv_block(128, 128, (2, 1)),# (128, 1, 25)
        )
        self.rnn = nn.LSTM(input_size=128, hidden_size=128,
                           num_layers=2, bidirectional=True, batch_first=True)
        self.head = nn.Linear(256, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, 1, H, W)
        B = x.size(0)
        # pad height lên 16 (15 -> 16) để chia hết pool
        if x.size(2) < self.height_pad:
            x = F.pad(x, (0, 0, 0, self.height_pad - x.size(2)))
        feat = self.features(x)               # (B, 128, 1, 25)
        # ép về sequence theo chiều timestep
        Bc, Cc, Hc, Wc = feat.shape
        seq = feat.permute(0, 3, 1, 2).reshape(Bc * Wc, Cc * Hc)  # (B*25, 128)
        seq = seq.view(Bc, Wc, -1)            # (B, 25, 128)
        out, _ = self.rnn(seq)                # (B, 25, 256)
        logits = self.head(out)               # (B, 25, C)
        return F.log_softmax(logits, dim=-1)

    def ctc_input_lengths(self, batch_size: int) -> torch.Tensor:
        """Độ dài frame cho CTCLoss: width // 4 = 25."""
        return torch.full((batch_size,), self.width // 4, dtype=torch.long)


def ctc_loss(log_probs: torch.Tensor, targets: torch.Tensor,
             target_lengths: torch.Tensor) -> torch.Tensor:
    """CTCLoss wrapper.

    Args:
        log_probs: (B, T, C) log-softmax từ model.
        targets: mảng 1D nối dồn các target encoding.
        target_lengths: độ dài từng target.
    """
    B, T, C = log_probs.shape
    log_probs_t = log_probs.permute(1, 0, 2).contiguous()  # (T, B, C)
    input_lengths = torch.full((B,), T, dtype=torch.long, device=log_probs.device)
    return nn.functional.ctc_loss(
        log_probs_t, targets, input_lengths, target_lengths,
        blank=0, zero_infinity=True)