from __future__ import annotations

import argparse, json, random
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageEnhance

from .schema import load_label, load_manifest
from .split import validate_splits
from .phase2_cycle import CycleDataRoots, WorkingMembership
from .phase2_training import stable_seed_context

@dataclass(frozen=True, slots=True)
class NormalizationStats:
    mean: tuple[float, float, float]
    std: tuple[float, float, float]

@dataclass(frozen=True, slots=True)
class FishingEpisode:
    batch_id: str
    references: torch.Tensor
    queries: torch.Tensor
    targets: torch.Tensor

def _image(path: Path) -> torch.Tensor:
    with Image.open(path) as im:
        im = im.convert("RGB")
        if im.size != (75, 75): raise ValueError(f"{path}: expected 75x75")
        a = np.asarray(im, dtype=np.float32) / 255.0
    return torch.from_numpy(a).permute(2, 0, 1).contiguous()

def _validate_normalization_stats(stats: NormalizationStats) -> tuple[torch.Tensor, torch.Tensor]:
    try:
        mean = tuple(stats.mean)
        std = tuple(stats.std)
    except (AttributeError, TypeError):
        raise ValueError("normalization statistics must provide mean and std") from None
    if len(mean) != 3 or len(std) != 3:
        raise ValueError("normalization statistics must contain exactly three mean and std values")
    try:
        mean_array = np.asarray(mean, dtype=np.float64)
        std_array = np.asarray(std, dtype=np.float64)
    except (TypeError, ValueError):
        raise ValueError("normalization statistics must be numeric") from None
    if (not np.isfinite(mean_array).all() or not np.isfinite(std_array).all()
            or (mean_array < 0).any() or (mean_array > 1).any()
            or (std_array <= 0).any() or (std_array > 1).any()):
        raise ValueError("normalization statistics contain non-finite or out-of-range values")
    return torch.tensor(mean_array, dtype=torch.float32).view(3, 1, 1), torch.tensor(std_array, dtype=torch.float32).view(3, 1, 1)

def _entries(
    raw_root: Path,
    labels_root: Path,
    batch_id: str,
    stats: NormalizationStats | None,
    *,
    cycle_data_roots: CycleDataRoots | None = None,
):
    if cycle_data_roots is not None:
        raw_root, labels_root = cycle_data_roots.roots_for(batch_id)
    d = raw_root / batch_id; m = load_manifest(d / "manifest.json"); l = load_label(labels_root / f"{batch_id}.json")
    normalized = _validate_normalization_stats(stats) if stats is not None else None
    if l.status != "complete": raise ValueError(f"{batch_id}: label is not complete")
    refs = {x.index: _image(d / x.path) for x in m.images}
    qs = [_image(d / x.path) for x in m.images_new]
    target = [next(x.img_index for x in l.matches if x.new_index == i) for i in range(len(qs))]
    rids = sorted(refs)
    r = torch.stack([refs[i] for i in rids]); q = torch.stack(qs)
    if normalized is not None:
        mean, std = normalized
        r, q = (r-mean)/std, (q-mean)/std
    return r, q, torch.tensor([rids.index(i) for i in target], dtype=torch.long)

def _validate_split_inputs(raw_root, labels_root, splits_root, duplicate_reviews=None):
    review_path = Path(duplicate_reviews) if duplicate_reviews is not None else Path("config") / "duplicate-reviews.json"
    result = validate_splits(Path(raw_root), Path(labels_root), Path(splits_root), review_path)
    if not result.valid:
        raise ValueError("invalid dataset splits: " + "; ".join(f"{x.code}: {x.detail}" for x in result.issues))

def _membership_ids(membership: WorkingMembership, split: str) -> list[str]:
    if split not in {"train", "dev"}:
        raise ValueError(f"unsupported working split: {split}")
    ids = membership.train_ids if split == "train" else membership.dev_ids
    if tuple(sorted(ids)) != ids or len(set(ids)) != len(ids):
        raise ValueError(f"membership {split} ids must be sorted and unique")
    for batch_id in ids:
        if (
            not isinstance(batch_id, str)
            or not batch_id
            or batch_id.strip() != batch_id
            or batch_id in {".", ".."}
            or "/" in batch_id
            or "\\" in batch_id
            or any(character.isspace() for character in batch_id)
        ):
            raise ValueError(f"membership {split} contains unsafe batch id")
    return list(ids)


def compute_train_normalization(
    raw_root: Path,
    labels_root: Path,
    splits_root: Path,
    *,
    duplicate_reviews: Path | None = None,
    membership: WorkingMembership | None = None,
    cycle_data_roots: CycleDataRoots | None = None,
) -> NormalizationStats:
    if membership is None:
        _validate_split_inputs(raw_root, labels_root, splits_root, duplicate_reviews)
        ids = _split_ids(splits_root, "train")
    else:
        ids = _membership_ids(membership, "train")
    values=[]
    for b in ids:
        r,q,_ = _entries(
            raw_root,
            labels_root,
            b,
            None,
            cycle_data_roots=cycle_data_roots,
        ); values += [r,q]
    x=torch.cat(values); mean=x.mean((0,2,3)); std=x.std((0,2,3), unbiased=False)
    if not torch.isfinite(mean).all() or not torch.isfinite(std).all() or (std<=0).any(): raise ValueError("invalid normalization statistics")
    return NormalizationStats(tuple(mean.tolist()), tuple(std.tolist()))

def _split_ids(root: Path, name: str) -> list[str]:
    if name == "final": raise ValueError("final split is locked; use fishing_ml.evaluate final loader")
    p=root/f"{name}.txt"
    if not p.is_file(): raise FileNotFoundError(p)
    return [x.strip() for x in p.read_text().splitlines() if x.strip()]

def _augment(x: torch.Tensor, rng: random.Random) -> torch.Tensor:
    x = x * (1 + rng.uniform(-.08,.08)) + rng.uniform(-.04,.04)
    dx,dy = rng.randint(-3,3),rng.randint(-3,3); scale=rng.uniform(.95,1.05)
    theta=torch.tensor([[[scale,0,dx/37.5],[0,scale,dy/37.5]]],dtype=x.dtype)
    grid=torch.nn.functional.affine_grid(theta, (1,*x.shape), align_corners=False)
    return torch.nn.functional.grid_sample(x.unsqueeze(0),grid,mode="bilinear",padding_mode="border",align_corners=False)[0].clamp(-5,5)

def _augment_v2(tensor: torch.Tensor, profile: str, context: bytes) -> torch.Tensor:
    """Schema-v2 deterministic augmentation on a raw [0,1] RGB tensor (3, H, W)."""
    from .phase2_training import apply_augmentation_profile

    return apply_augmentation_profile(profile, tensor, context)

def _load(
    raw_root, labels_root, splits_root, split, stats,
    *, duplicate_reviews=None, train=False, seed=20260827, limit=None,
    augmentation_profile="legacy_combined", epoch=0, global_seed=None,
    membership: WorkingMembership | None = None,
    cycle_data_roots: CycleDataRoots | None = None,
):
    if split == "final": raise ValueError("final split is locked; use fishing_ml.evaluate final loader")
    if membership is None:
        _validate_split_inputs(raw_root, labels_root, splits_root, duplicate_reviews)
        ids = _split_ids(splits_root, split)[:limit]
    else:
        ids = _membership_ids(membership, split)[:limit]
    rng = random.Random(seed)
    out = []
    for bid in ids:
        if train and augmentation_profile == "legacy_combined":
            # v1 legacy: EXACT existing behavior — shuffle, then the shared rng
            # drives _augment on already-normalized tensors (clamp [-5, 5]).
            r, q, t = _entries(
                raw_root,
                labels_root,
                bid,
                stats,
                cycle_data_roots=cycle_data_roots,
            )
            order = list(range(len(r))); rng.shuffle(order)
            remap = {old: new for new, old in enumerate(order)}
            r = r[order]; t = torch.tensor([remap[int(v)] for v in t])
            r = torch.stack([_augment(v, rng) for v in r])
            q = torch.stack([_augment(v, rng) for v in q])
        elif train:
            # v2: augmentation on RAW [0,1] BEFORE normalization. The image index
            # in the stable context is the image's position in its role list as
            # loaded (references in ascending img_index order, queries in manifest
            # order) — i.e. BEFORE the shuffle — so augmentation is a pure
            # function of (global_seed, epoch, batch_id, role, image index) and
            # does not depend on where the shuffle happens to place the image
            # (spec §3.3: results must not depend on traversal order, worker
            # scheduling, or RNG calls for other images).
            r, q, t = _entries(
                raw_root,
                labels_root,
                bid,
                None,
                cycle_data_roots=cycle_data_roots,
            )
            base_seed = global_seed if global_seed is not None else seed
            r = torch.stack([
                _augment_v2(v, augmentation_profile,
                            stable_seed_context(base_seed, epoch, bid, "reference", i))
                for i, v in enumerate(r)
            ])
            q = torch.stack([
                _augment_v2(v, augmentation_profile,
                            stable_seed_context(base_seed, epoch, bid, "query", i))
                for i, v in enumerate(q)
            ])
            # The reference-order shuffle still runs afterwards (spec §3.3).
            order = list(range(len(r))); rng.shuffle(order)
            remap = {old: new for new, old in enumerate(order)}
            r = r[order]; t = torch.tensor([remap[int(v)] for v in t])
            mean, std = _validate_normalization_stats(stats)
            r = (r - mean) / std
            q = (q - mean) / std
        else:
            # Dev/final: NEVER augmented, regardless of profile (spec §3.3).
            r, q, t = _entries(
                raw_root,
                labels_root,
                bid,
                stats,
                cycle_data_roots=cycle_data_roots,
            )
        out.append(FishingEpisode(bid, r, q, t))
    return out

def load_training_episodes(
    raw_root, labels_root, splits_root, stats, *,
    duplicate_reviews=None, seed=20260827, limit=None,
    augmentation_profile="legacy_combined", epoch=0, global_seed=None,
    membership: WorkingMembership | None = None,
    cycle_data_roots: CycleDataRoots | None = None,
): return _load(Path(raw_root), Path(labels_root), Path(splits_root), "train", stats,
                 duplicate_reviews=duplicate_reviews, train=True, seed=seed, limit=limit,
                 augmentation_profile=augmentation_profile, epoch=epoch, global_seed=global_seed,
                 membership=membership, cycle_data_roots=cycle_data_roots)

def load_dev_episodes(
    raw_root, labels_root, splits_root, stats, *,
    duplicate_reviews=None, limit=None, membership: WorkingMembership | None = None,
    cycle_data_roots: CycleDataRoots | None = None,
):
    # Dev loader remains unaugmented; cycle callers may supply explicit membership.
    return _load(Path(raw_root), Path(labels_root), Path(splits_root), "dev", stats,
                 duplicate_reviews=duplicate_reviews, limit=limit, membership=membership,
                 cycle_data_roots=cycle_data_roots)
def _load_final_episodes(
    raw_root,
    labels_root,
    splits_root,
    stats,
    *,
    duplicate_reviews=None,
    limit=None,
):
    _validate_split_inputs(raw_root, labels_root, splits_root, duplicate_reviews)
    ids = [
        x.strip()
        for x in (Path(splits_root) / "final.txt").read_text().splitlines()
        if x.strip()
    ][:limit]
    return [
        FishingEpisode(
            bid,
            *_entries(Path(raw_root), Path(labels_root), bid, stats),
        )
        for bid in ids
    ]

def main(argv=None):
    p=argparse.ArgumentParser(); p.add_argument("--raw-root",type=Path,required=True); p.add_argument("--labels-root",type=Path,required=True); p.add_argument("--splits-root",type=Path,required=True); p.add_argument("--duplicate-reviews",type=Path,required=True); p.add_argument("--split",choices=["train","dev","final"],required=True); p.add_argument("--limit",type=int,default=5); a=p.parse_args(argv)
    if a.split=="final": p.error("final is locked; use fishing_ml.evaluate final loader")
    s=compute_train_normalization(a.raw_root,a.labels_root,a.splits_root,duplicate_reviews=a.duplicate_reviews); e=load_training_episodes(a.raw_root,a.labels_root,a.splits_root,s,duplicate_reviews=a.duplicate_reviews,limit=a.limit) if a.split=="train" else load_dev_episodes(a.raw_root,a.labels_root,a.splits_root,s,duplicate_reviews=a.duplicate_reviews,limit=a.limit)
    print(json.dumps({"count":len(e),"episodes":[{"batchId":x.batch_id,"references":list(x.references.shape),"queries":list(x.queries.shape),"targets":list(x.targets.shape)} for x in e]})); return 0
if __name__ == "__main__": raise SystemExit(main())
