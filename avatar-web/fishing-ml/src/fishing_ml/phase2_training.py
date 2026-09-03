"""Deterministic augmentation profiles and hard-negative auxiliary loss for Phase 2."""
from __future__ import annotations

import hashlib
import math
import random
from typing import Sequence

import torch

# ---------------------------------------------------------------------------
# Stable seed derivation
# ---------------------------------------------------------------------------

def stable_seed_context(
    global_seed: int,
    epoch: int,
    batch_id: str,
    role: str,
    index: int,
) -> bytes:
    """Deterministic context bytes for RNG. Not dependent on process state."""
    payload = f"{global_seed}|{epoch}|{batch_id}|{role}|{index}"
    return hashlib.sha256(payload.encode("utf-8")).digest()


def derive_rng(context: bytes) -> random.Random:
    """Create a deterministic RNG from stable context bytes."""
    seed_int = int.from_bytes(context[:8], "big")
    return random.Random(seed_int)


# ---------------------------------------------------------------------------
# Augmentation profiles
# ---------------------------------------------------------------------------

def _transform_rng(context: bytes, transform: str) -> random.Random:
    """Per-transform RNG, domain-separated from the canonical context.

    Spec §3.3: each transform creates its own RNG from the SHA-256 stable
    context. Domain separation (appending the transform tag before the second
    SHA-256) keeps the two transforms of `photometric_plus_geom` independent,
    so the photometric values do not depend on how many values the geometric
    transform draws, and `photometric` alone and `photometric_plus_geom`
    produce identical photometric steps for the same image.
    """
    return derive_rng(hashlib.sha256(context + transform.encode("utf-8")).digest())


def apply_augmentation_profile(
    profile: str,
    tensor: torch.Tensor,
    context: bytes,
) -> torch.Tensor:
    """Apply deterministic augmentation to an RGB tensor in [0,1].

    Args:
        profile: one of "none", "photometric", "photometric_plus_geom"
        tensor: shape (3, H, W), values in [0, 1]
        context: canonical stable context bytes (see stable_seed_context)
    """
    if profile == "none":
        return tensor
    if profile == "photometric":
        return _photometric(tensor, _transform_rng(context, "photometric"))
    if profile == "photometric_plus_geom":
        tensor = _photometric(tensor, _transform_rng(context, "photometric"))
        return _geometric(tensor, _transform_rng(context, "geometric"))
    raise ValueError(f"Unknown augmentation profile: {profile!r}")


def _photometric(tensor: torch.Tensor, rng: random.Random) -> torch.Tensor:
    gain = 1.0 + rng.uniform(-0.08, 0.08)  # [0.92, 1.08]
    offset = rng.uniform(-0.04, 0.04)
    return (tensor * gain + offset).clamp(0.0, 1.0)


def _geometric(tensor: torch.Tensor, rng: random.Random) -> torch.Tensor:
    dx = rng.randint(-3, 3)
    dy = rng.randint(-3, 3)
    scale = rng.uniform(0.95, 1.05)
    # Same center-of-75x75 normalization as the v1 _augment (75 / 2 = 37.5):
    # theta is in normalized [-1, 1] image coordinates.
    h, w = tensor.shape[1], tensor.shape[2]
    theta = torch.tensor(
        [[[scale, 0, dx / (w / 2.0)], [0, scale, dy / (h / 2.0)]]],
        dtype=tensor.dtype,
    )
    grid = torch.nn.functional.affine_grid(
        theta, (1, *tensor.shape), align_corners=False
    )
    return torch.nn.functional.grid_sample(
        tensor.unsqueeze(0), grid, mode="bilinear", padding_mode="border", align_corners=False
    )[0].clamp(0.0, 1.0)


# ---------------------------------------------------------------------------
# Hard-negative auxiliary margin loss
# ---------------------------------------------------------------------------

def compute_hard_negative_loss(
    query_embeddings: torch.Tensor,
    reference_embeddings: torch.Tensor,
    targets: torch.Tensor,
    ratio: float,
    margin: float,
    global_seed: int,
    epoch: int,
    batch_id: str,
) -> torch.Tensor:
    """Compute auxiliary hardest-negative margin loss.

    Args:
        query_embeddings: (Q, D) L2-normalized query embeddings
        reference_embeddings: (R, D) L2-normalized reference embeddings
        targets: (Q,) long tensor of correct reference index per query
        ratio: fraction of eligible queries to select (0.0 returns zero)
        margin: positive margin for the hinge loss
        global_seed, epoch, batch_id: for deterministic selection
    """
    if ratio <= 0.0 or reference_embeddings.shape[0] < 2 or targets.numel() == 0:
        # Zero auxiliary loss with the same device/dtype (spec §3.4: an episode
        # with a single reference or no eligible query has nothing to mine).
        return query_embeddings.sum() * 0.0

    # Cosine similarity matrix (embeddings are already L2-normalized by
    # FishingEncoder.forward; torch.mm of normalized vectors is cosine).
    sim_matrix = torch.mm(query_embeddings, reference_embeddings.t())  # (Q, R)

    # For each query, find the hardest WRONG reference:
    correct_sims = sim_matrix[torch.arange(len(targets)), targets]  # (Q,)
    masked_sim = sim_matrix.clone()
    masked_sim[torch.arange(len(targets)), targets] = float("-inf")
    # torch.max resolves ties to the smallest reference index (spec §3.4.1).
    hardest_wrong_sims = masked_sim.max(dim=1).values  # (Q,)

    # Deterministic selection by stable key (spec §3.4.3):
    #   global seed | epoch | batch id | query index
    eligible_indices = list(range(len(targets)))
    n_select = max(1, math.ceil(len(eligible_indices) * ratio))

    def _selection_key(query_index: int) -> bytes:
        payload = f"{global_seed}|{epoch}|{batch_id}|{query_index}"
        return hashlib.sha256(payload.encode("utf-8")).digest()

    keys = [(int.from_bytes(_selection_key(idx)[:8], "big"), idx) for idx in eligible_indices]
    keys.sort(key=lambda item: item[0])  # stable: key, then index order
    selected = [idx for _, idx in keys[:n_select]]

    selected_t = torch.tensor(selected, device=targets.device)
    aux = torch.clamp(
        margin + hardest_wrong_sims[selected_t] - correct_sims[selected_t],
        min=0.0,
    )
    return aux.mean()
