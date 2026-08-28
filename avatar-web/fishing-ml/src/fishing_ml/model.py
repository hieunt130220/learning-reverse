"""Shared metric-learning model for fishing image matching episodes."""

from __future__ import annotations

from collections.abc import Sequence

import torch
from torch import nn
from torch.nn import functional as F


class FishingEncoder(nn.Module):
    """Encode 75x75 RGB images as L2-normalized embedding vectors."""

    def __init__(
        self,
        embedding_dim: int = 96,
        channels: Sequence[int] = (32, 64, 96, 128),
    ) -> None:
        super().__init__()
        if isinstance(embedding_dim, bool) or not isinstance(embedding_dim, int) or embedding_dim <= 0:
            raise ValueError("embedding_dim must be a positive integer")
        normalized_channels = tuple(channels)
        if len(normalized_channels) != 4:
            raise ValueError("channels must contain exactly four values")
        if any(isinstance(value, bool) or not isinstance(value, int) or value <= 0 for value in normalized_channels):
            raise ValueError("channels must contain positive integers")

        blocks: list[nn.Module] = []
        input_channels = 3
        for output_channels in normalized_channels:
            group_count = _group_count(output_channels)
            blocks.extend(
                (
                    nn.Conv2d(input_channels, output_channels, kernel_size=3, padding=1, bias=False),
                    nn.GroupNorm(group_count, output_channels),
                    nn.ReLU(inplace=True),
                    nn.MaxPool2d(kernel_size=2, stride=2),
                )
            )
            input_channels = output_channels

        self.features = nn.Sequential(*blocks)
        self.pool = nn.AdaptiveAvgPool2d((1, 1))
        self.projection = nn.Linear(normalized_channels[-1], embedding_dim)

    def forward(self, images: torch.Tensor) -> torch.Tensor:
        if images.ndim != 4 or images.shape[1] != 3:
            raise ValueError("images must have shape [N, 3, H, W]")
        if images.shape[0] == 0:
            raise ValueError("images must not be empty")
        features = self.features(images)
        embeddings = self.projection(torch.flatten(self.pool(features), 1))
        return F.normalize(embeddings, p=2, dim=1)


def _group_count(channels: int) -> int:
    """Choose the largest conventional GroupNorm divisor, up to eight groups."""
    for groups in (8, 4, 2, 1):
        if channels % groups == 0:
            return groups
    return 1


def cosine_similarity_matrix(
    query_embeddings: torch.Tensor,
    reference_embeddings: torch.Tensor,
) -> torch.Tensor:
    """Return independent query-to-reference cosine scores with shape [Q, R]."""
    _validate_embedding_pair(query_embeddings, reference_embeddings)
    queries = F.normalize(query_embeddings, p=2, dim=1)
    references = F.normalize(reference_embeddings, p=2, dim=1)
    return queries @ references.transpose(0, 1)


def episode_logits(
    query_embeddings: torch.Tensor,
    reference_embeddings: torch.Tensor,
    temperature: float,
) -> torch.Tensor:
    """Scale one variable-size episode's cosine scores by positive temperature."""
    if isinstance(temperature, bool) or not isinstance(temperature, (int, float)):
        raise ValueError("temperature must be a positive finite number")
    temperature_value = float(temperature)
    if not torch.isfinite(torch.tensor(temperature_value)) or temperature_value <= 0:
        raise ValueError("temperature must be a positive finite number")
    return cosine_similarity_matrix(query_embeddings, reference_embeddings) / temperature_value


def episode_loss(logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
    """Compute per-query cross entropy for one episode without one-to-one assignment."""
    if logits.ndim != 2 or logits.shape[0] == 0 or logits.shape[1] == 0:
        raise ValueError("logits must have non-empty shape [Q, R]")
    if targets.ndim != 1 or targets.shape[0] != logits.shape[0]:
        raise ValueError("targets must have shape [Q]")
    if targets.dtype != torch.long:
        raise ValueError("targets must use torch.long dtype")
    if targets.device != logits.device:
        raise ValueError("targets and logits must be on the same device")
    if not torch.isfinite(logits).all():
        raise ValueError("logits must be finite")
    if torch.any(targets < 0) or torch.any(targets >= logits.shape[1]):
        raise ValueError("targets contain an out-of-range reference index")
    return F.cross_entropy(logits, targets)


def _validate_embedding_pair(queries: torch.Tensor, references: torch.Tensor) -> None:
    if queries.ndim != 2 or references.ndim != 2:
        raise ValueError("embeddings must have shapes [Q, D] and [R, D]")
    if queries.shape[0] == 0 or references.shape[0] == 0:
        raise ValueError("episodes must contain at least one query and one reference")
    if queries.shape[1] == 0 or queries.shape[1] != references.shape[1]:
        raise ValueError("query and reference embedding dimensions must match")
    if queries.device != references.device:
        raise ValueError("query and reference embeddings must be on the same device")
    if not queries.is_floating_point() or not references.is_floating_point():
        raise ValueError("embeddings must use floating-point tensors")
    if not torch.isfinite(queries).all() or not torch.isfinite(references).all():
        raise ValueError("embeddings must be finite")
