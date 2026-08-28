from __future__ import annotations

import argparse, json, random
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageEnhance

from .schema import load_label, load_manifest
from .split import validate_splits

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

def _entries(raw_root: Path, labels_root: Path, batch_id: str, stats: NormalizationStats | None):
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
    review_path = Path(duplicate_reviews) if duplicate_reviews is not None else Path(splits_root).parent / "config" / "duplicate-reviews.json"
    result = validate_splits(Path(raw_root), Path(labels_root), Path(splits_root), review_path)
    if not result.valid:
        raise ValueError("invalid dataset splits: " + "; ".join(f"{x.code}: {x.detail}" for x in result.issues))

def compute_train_normalization(raw_root: Path, labels_root: Path, splits_root: Path, *, duplicate_reviews: Path | None = None) -> NormalizationStats:
    _validate_split_inputs(raw_root, labels_root, splits_root, duplicate_reviews)
    ids = _split_ids(splits_root, "train")
    values=[]
    for b in ids:
        r,q,_ = _entries(raw_root, labels_root, b, None); values += [r,q]
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

def _load(raw_root: Path, labels_root: Path, splits_root: Path, split: str, stats: NormalizationStats | None, *, train=False, seed=20260827, limit=None):
    if split == "final": raise ValueError("final split is locked; use fishing_ml.evaluate final loader")
    _validate_split_inputs(raw_root, labels_root, splits_root)
    ids=_split_ids(splits_root,split)[:limit]; rng=random.Random(seed); out=[]
    for bid in ids:
        r,q,t=_entries(raw_root,labels_root,bid,stats)
        if train:
            order=list(range(len(t))); rng.shuffle(order); remap={old:new for new,old in enumerate(order)}
            r=r[order]; t=torch.tensor([remap[int(v)] for v in t]); r=torch.stack([_augment(v,rng) for v in r]); q=torch.stack([_augment(v,rng) for v in q])
        out.append(FishingEpisode(bid,r,q,t))
    return out

def load_training_episodes(raw_root, labels_root, splits_root, stats, *, seed=20260827, limit=None): return _load(Path(raw_root),Path(labels_root),Path(splits_root),"train",stats,train=True,seed=seed,limit=limit)
def load_dev_episodes(raw_root, labels_root, splits_root, stats, *, limit=None): return _load(Path(raw_root),Path(labels_root),Path(splits_root),"dev",stats,limit=limit)
def _load_final_episodes(raw_root, labels_root, splits_root, stats, *, limit=None):
    _validate_split_inputs(raw_root, labels_root, splits_root)
    ids = [x.strip() for x in (Path(splits_root) / "final.txt").read_text().splitlines() if x.strip()][:limit]
    return [FishingEpisode(bid, *_entries(Path(raw_root), Path(labels_root), bid, stats)) for bid in ids]

def main(argv=None):
    p=argparse.ArgumentParser(); p.add_argument("--raw-root",type=Path,required=True); p.add_argument("--labels-root",type=Path,required=True); p.add_argument("--splits-root",type=Path,required=True); p.add_argument("--split",choices=["train","dev","final"],required=True); p.add_argument("--limit",type=int,default=5); a=p.parse_args(argv)
    if a.split=="final": p.error("final is locked; use fishing_ml.evaluate final loader")
    s=compute_train_normalization(a.raw_root,a.labels_root,a.splits_root); e=load_training_episodes(a.raw_root,a.labels_root,a.splits_root,s,limit=a.limit) if a.split=="train" else load_dev_episodes(a.raw_root,a.labels_root,a.splits_root,s,limit=a.limit)
    print(json.dumps({"count":len(e),"episodes":[{"batchId":x.batch_id,"references":list(x.references.shape),"queries":list(x.queries.shape),"targets":list(x.targets.shape)} for x in e]})); return 0
if __name__ == "__main__": raise SystemExit(main())
