"""Deterministic train-only optimization with dev-only checkpoint selection."""
from __future__ import annotations

import argparse
import ctypes
import errno
import hashlib
import importlib.metadata
import json
import os
import platform
import random
import re
import shutil
import subprocess
import tempfile
from dataclasses import asdict
from pathlib import Path
from typing import Iterable, Mapping

import numpy as np
import torch

from .config import TrainingConfig, load_training_config
from .dataset import (
    FishingEpisode,
    NormalizationStats,
    compute_train_normalization,
    load_dev_episodes,
    load_training_episodes,
)
from .dataset_version import DatasetVersionV2, load_dataset_version
from .metrics import Prediction, summarize_predictions
from .model import FishingEncoder, cosine_similarity_matrix, episode_logits, episode_loss
from .phase2_cycle import WorkingMembership, commit_ids
from .schema import atomic_write_json, sha256_file

_HEX64 = re.compile(r"^[0-9a-f]{64}$")


def set_reproducible_seed(seed: int) -> list[str]:
    """Seed all training RNGs and return honest determinism limitations."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    limitations: list[str] = []
    try:
        torch.use_deterministic_algorithms(True)
    except (RuntimeError, AttributeError) as error:
        limitations.append(f"deterministic algorithms unavailable: {error}")
    if hasattr(torch.backends, "cudnn"):
        torch.backends.cudnn.benchmark = False
        torch.backends.cudnn.deterministic = True
    if hasattr(torch.backends, "cuda") and hasattr(torch.backends.cuda, "matmul"):
        torch.backends.cuda.matmul.allow_tf32 = False
    if hasattr(torch.backends, "cudnn"):
        torch.backends.cudnn.allow_tf32 = False
    return limitations


def _finite_tensor(value: torch.Tensor, name: str) -> None:
    if not torch.isfinite(value).all():
        raise RuntimeError(f"non-finite {name}")


def train_epoch(
    model: FishingEncoder,
    episodes: Iterable[FishingEpisode],
    optimizer: torch.optim.Optimizer,
    *,
    temperature: float,
    device: torch.device,
    config: TrainingConfig | None = None,
    epoch: int = 0,
) -> float:
    """Optimize one pass over variable-size train episodes."""
    model.train()
    loss_sum = 0.0
    query_count = 0
    for episode in episodes:
        references = episode.references.to(device)
        queries = episode.queries.to(device)
        targets = episode.targets.to(device)
        _finite_tensor(references, "training references")
        _finite_tensor(queries, "training queries")
        optimizer.zero_grad(set_to_none=True)
        reference_embeddings = model(references)
        query_embeddings = model(queries)
        logits = episode_logits(query_embeddings, reference_embeddings, temperature)
        loss = episode_loss(logits, targets)
        if config is not None and config.hard_negative_ratio > 0:
            from .phase2_training import compute_hard_negative_loss

            # Same normalized embeddings already used for the CE loss; the model
            # output is L2-normalized, so no re-normalization and NO no_grad —
            # the auxiliary loss must backpropagate through the encoder.
            hn_loss = compute_hard_negative_loss(
                query_embeddings,
                reference_embeddings,
                targets,
                ratio=config.hard_negative_ratio,
                margin=config.hard_negative_margin,
                global_seed=config.seed,
                epoch=epoch,
                batch_id=episode.batch_id,
            )
            _finite_tensor(loss, "training loss")
            _finite_tensor(hn_loss, "hard-negative loss")
            loss = loss + hn_loss
        else:
            _finite_tensor(loss, "training loss")
        loss.backward()
        for parameter in model.parameters():
            if parameter.grad is not None:
                _finite_tensor(parameter.grad, "gradient")
        optimizer.step()
        count = int(targets.numel())
        loss_sum += float(loss.detach().cpu()) * count
        query_count += count
    if query_count == 0:
        raise ValueError("training split contains no queries")
    return loss_sum / query_count


def predict_episodes(
    model: FishingEncoder,
    episodes: Iterable[FishingEpisode],
    *,
    temperature: float,
    device: torch.device,
) -> tuple[tuple[Prediction, ...], float, dict[str, tuple[int, int]]]:
    """Evaluate labeled episodes without augmentation or threshold abstention."""
    model.eval()
    predictions: list[Prediction] = []
    shapes: dict[str, tuple[int, int]] = {}
    loss_sum = 0.0
    query_count = 0
    with torch.no_grad():
        for episode in episodes:
            references = episode.references.to(device)
            queries = episode.queries.to(device)
            targets = episode.targets.to(device)
            _finite_tensor(references, "evaluation references")
            _finite_tensor(queries, "evaluation queries")
            reference_embeddings = model(references)
            query_embeddings = model(queries)
            similarities = cosine_similarity_matrix(query_embeddings, reference_embeddings)
            logits = similarities / temperature
            loss = episode_loss(logits, targets)
            _finite_tensor(loss, "development loss")
            scores, indices = similarities.max(dim=1)
            for new_index in range(len(targets)):
                row = similarities[new_index]
                margin = None
                if row.numel() > 1:
                    top_two = torch.topk(row, 2).values
                    margin = float((top_two[0] - top_two[1]).cpu())
                predictions.append(Prediction(
                    batch_id=episode.batch_id,
                    new_index=new_index,
                    expected_img_index=int(targets[new_index].cpu()),
                    predicted_img_index=int(indices[new_index].cpu()),
                    similarity=float(scores[new_index].cpu()),
                    margin=margin,
                    accepted=True,
                ))
            count = int(targets.numel())
            loss_sum += float(loss.cpu()) * count
            query_count += count
            shapes[episode.batch_id] = (len(references), len(queries))
    if query_count == 0:
        raise ValueError("development split contains no queries")
    return tuple(predictions), loss_sum / query_count, shapes


def _atomic_torch_save(path: Path, value: Mapping[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as output:
            torch.save(dict(value), output)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _device(requested: str) -> torch.device:
    if requested == "auto":
        requested = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    if requested == "cuda" and not torch.cuda.is_available():
        raise ValueError("CUDA requested but unavailable")
    if requested == "mps" and not torch.backends.mps.is_available():
        raise ValueError("MPS requested but unavailable")
    return torch.device(requested)


def _git_revision() -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"], check=True, capture_output=True, text=True
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError) as error:
        raise RuntimeError("training requires a readable Git revision") from error


def _publish_directory_no_replace(staging_dir: Path, run_dir: Path) -> None:
    """Atomically publish a sibling directory without replacing an existing run."""
    if platform.system() == "Linux":
        libc = ctypes.CDLL(None, use_errno=True)
        renameat2 = getattr(libc, "renameat2", None)
        if renameat2 is not None:
            renameat2.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
            renameat2.restype = ctypes.c_int
            if renameat2(-100, os.fsencode(staging_dir), -100, os.fsencode(run_dir), 1) == 0:
                return
            error_number = ctypes.get_errno()
            if error_number not in {errno.ENOSYS, errno.EINVAL}:
                raise OSError(error_number, os.strerror(error_number), run_dir)
    elif platform.system() == "Darwin":
        libc = ctypes.CDLL(None, use_errno=True)
        renamex_np = getattr(libc, "renamex_np", None)
        if renamex_np is not None:
            renamex_np.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint]
            renamex_np.restype = ctypes.c_int
            if renamex_np(os.fsencode(staging_dir), os.fsencode(run_dir), 0x00000004) == 0:
                return
            error_number = ctypes.get_errno()
            if error_number not in {errno.ENOTSUP, errno.EINVAL}:
                raise OSError(error_number, os.strerror(error_number), run_dir)
    raise RuntimeError("atomic no-overwrite directory rename is unsupported on this platform")


def _config_json(config: TrainingConfig) -> dict[str, object]:
    from .config import config_to_document
    return config_to_document(config)


def _membership_commitment(batch_ids: tuple[str, ...], split: str):
    if tuple(sorted(batch_ids)) != batch_ids or len(set(batch_ids)) != len(batch_ids):
        raise ValueError(f"working membership {split} ids must be sorted and unique")
    try:
        return commit_ids(batch_ids)
    except ValueError as error:
        raise ValueError(f"invalid working membership {split} ids: {error}") from error


def _cycle_training_provenance(
    splits_root: Path,
    working_membership: WorkingMembership,
    experiment_manifest_sha256: str | None,
) -> dict[str, object]:
    if not isinstance(experiment_manifest_sha256, str) or not _HEX64.fullmatch(
        experiment_manifest_sha256
    ):
        raise ValueError("cycle training requires a lowercase experiment manifest SHA-256")

    train_commitment = _membership_commitment(working_membership.train_ids, "train")
    dev_commitment = _membership_commitment(working_membership.dev_ids, "dev")
    _membership_commitment(working_membership.acquired_dev_ids, "acquired dev")
    if set(working_membership.train_ids).intersection(working_membership.dev_ids):
        raise ValueError("working membership train/dev overlap")
    if not set(working_membership.acquired_dev_ids).issubset(working_membership.dev_ids):
        raise ValueError("working membership acquired dev ids are not a subset of dev")

    dataset_version_path = Path(splits_root).parent / "dataset-version.json"
    if dataset_version_path.is_symlink() or not dataset_version_path.is_file():
        raise ValueError(f"cycle dataset version must be a regular file: {dataset_version_path}")
    dataset_version = load_dataset_version(dataset_version_path)
    if not isinstance(dataset_version, DatasetVersionV2):
        raise ValueError("cycle training requires dataset-version schema v2")
    if dataset_version.dataset_id != working_membership.dataset_id:
        raise ValueError("working membership dataset id does not match dataset version")
    if (
        dataset_version.source_commitment.count != working_membership.source_commitment.count
        or dataset_version.source_commitment.sha256 != working_membership.source_commitment.sha256
    ):
        raise ValueError("working membership source commitment does not match dataset version")
    for split, commitment in (("train", train_commitment), ("dev", dev_commitment)):
        expected = dataset_version.splits[split]
        if expected.count != commitment.count or expected.sha256 != commitment.sha256:
            raise ValueError(f"working membership {split} commitment does not match dataset version")

    return {
        "datasetId": dataset_version.dataset_id,
        "datasetVersionSha256": sha256_file(dataset_version_path),
        "sourceCommitment": {
            "count": working_membership.source_commitment.count,
            "sha256": working_membership.source_commitment.sha256,
        },
        "splits": {
            "train": {"count": train_commitment.count, "sha256": train_commitment.sha256},
            "dev": {"count": dev_commitment.count, "sha256": dev_commitment.sha256},
        },
        "experimentManifestSha256": experiment_manifest_sha256,
    }


def _prediction_json(row: Prediction) -> dict[str, object]:
    return {
        "batchId": row.batch_id, "newIndex": row.new_index,
        "expectedImgIndex": row.expected_img_index, "predictedImgIndex": row.predicted_img_index,
        "similarity": row.similarity, "margin": row.margin, "accepted": row.accepted,
    }


def run_training(
    config_path: Path,
    raw_root: Path,
    labels_root: Path,
    splits_root: Path,
    duplicate_reviews: Path,
    artifacts_root: Path,
    run_id: str,
    *,
    working_membership: WorkingMembership | None = None,
    experiment_manifest_sha256: str | None = None,
) -> Path:
    """Train on train, select on dev, and atomically publish the run contract."""
    if not run_id or run_id in {".", ".."} or Path(run_id).name != run_id:
        raise ValueError("run-id must be one safe path component")
    artifacts_root = Path(artifacts_root)
    run_dir = artifacts_root / run_id
    if run_dir.exists():
        raise FileExistsError(f"run directory already exists: {run_dir}")
    artifacts_root.mkdir(parents=True, exist_ok=True)
    staging_dir: Path | None = None
    try:
        git_revision = _git_revision()
        staging_dir = Path(tempfile.mkdtemp(prefix=f".{run_id}.staging-", dir=artifacts_root))
        config = load_training_config(Path(config_path))
        cycle_provenance: dict[str, object] | None = None
        if working_membership is None:
            if config.schema_version == 3:
                raise ValueError("schema-v3 training requires explicit working membership")
            if experiment_manifest_sha256 is not None:
                raise ValueError("experiment manifest digest requires explicit working membership")
        else:
            if config.schema_version != 3:
                raise ValueError("explicit working membership requires training config schema v3")
            cycle_provenance = _cycle_training_provenance(
                Path(splits_root), working_membership, experiment_manifest_sha256
            )
        limitations = set_reproducible_seed(config.seed)
        stats = compute_train_normalization(
            Path(raw_root), Path(labels_root), Path(splits_root),
            duplicate_reviews=Path(duplicate_reviews),
            membership=working_membership,
        )
        # Load both permitted partitions before optimization so boundary errors fail early.
        first_train_episodes = load_training_episodes(
            raw_root, labels_root, splits_root, stats,
            duplicate_reviews=duplicate_reviews, seed=config.seed,
            augmentation_profile=config.augmentation_profile,
            epoch=1,
            global_seed=config.seed,
            membership=working_membership,
        )
        dev_episodes = load_dev_episodes(
            raw_root, labels_root, splits_root, stats,
            duplicate_reviews=duplicate_reviews,
            membership=working_membership,
        )
        device = _device(config.device)
        model = FishingEncoder(config.embedding_dim, config.channels).to(device)
        optimizer = torch.optim.AdamW(model.parameters(), lr=config.learning_rate, weight_decay=config.weight_decay)
        history: list[dict[str, object]] = []
        best_key: tuple[float, int, float, int] | None = None
        best_predictions: tuple[Prediction, ...] = ()
        best_metrics: dict[str, object] = {}
        best_epoch = 0
        for epoch in range(1, config.epochs + 1):
            train_episodes = first_train_episodes if epoch == 1 else load_training_episodes(
                raw_root, labels_root, splits_root, stats,
                duplicate_reviews=duplicate_reviews, seed=config.seed + epoch - 1,
                augmentation_profile=config.augmentation_profile,
                epoch=epoch,
                global_seed=config.seed,
                membership=working_membership,
            )
            train_loss = train_epoch(
                model, train_episodes, optimizer,
                temperature=config.temperature, device=device,
                config=config, epoch=epoch,
            )
            predictions, dev_loss, shapes = predict_episodes(
                model, dev_episodes, temperature=config.temperature, device=device
            )
            summary = summarize_predictions(predictions, batch_shapes=shapes)
            key = (-summary.top1_accuracy, summary.wrong_count, dev_loss, epoch)
            selected = best_key is None or key < best_key
            history.append({
                "epoch": epoch, "trainLoss": train_loss, "devLoss": dev_loss,
                "devTop1Accuracy": summary.top1_accuracy, "devWrongCount": summary.wrong_count,
                "selected": selected,
            })
            if selected:
                best_key = key
                best_epoch = epoch
                best_predictions = predictions
                best_metrics = summary.to_json() | {"loss": dev_loss, "selectedEpoch": epoch}
                _atomic_torch_save(staging_dir / "checkpoints" / "best-dev.pt", {
                    "schemaVersion": 1, "epoch": epoch, "modelStateDict": model.state_dict(),
                    "optimizerStateDict": optimizer.state_dict(), "config": _config_json(config),
                    "normalization": asdict(stats), "devMetrics": best_metrics,
                })
        checkpoint = staging_dir / "checkpoints" / "best-dev.pt"
        checkpoint_sha256 = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
        atomic_write_json(staging_dir / "model-config.json", _config_json(config))
        atomic_write_json(staging_dir / "normalization.json", {"mean": list(stats.mean), "std": list(stats.std)})
        atomic_write_json(staging_dir / "dev-predictions.json", {
            "schemaVersion": 1, "split": "dev", "selectedEpoch": best_epoch,
            "predictions": [_prediction_json(row) for row in best_predictions],
        })
        atomic_write_json(staging_dir / "dev-metrics.json", {"schemaVersion": 1, **best_metrics})
        atomic_write_json(staging_dir / "training-history.json", {"schemaVersion": 1, "epochs": history})
        ending_git_revision = _git_revision()
        if ending_git_revision != git_revision:
            raise RuntimeError(
                f"Git revision changed during training: {git_revision} -> {ending_git_revision}"
            )
        environment: dict[str, object] = {
            "schemaVersion": 1, "pythonVersion": platform.python_version(),
            "pytorchVersion": torch.__version__, "numpyVersion": np.__version__,
            "pillowVersion": importlib.metadata.version("Pillow"),
            "scikitImageVersion": importlib.metadata.version("scikit-image"),
            "pyyamlVersion": importlib.metadata.version("PyYAML"),
            "platform": platform.platform(), "device": str(device), "gitRevision": git_revision,
            "checkpointSha256": checkpoint_sha256, "deterministicAlgorithmsEnabled": torch.are_deterministic_algorithms_enabled(),
            "determinismLimitations": limitations,
        }
        if cycle_provenance is not None:
            environment["schemaVersion"] = 2
            environment["cycleProvenance"] = cycle_provenance
        atomic_write_json(staging_dir / "environment.json", environment)
        # The sibling rename is the only publication point; existing runs are never replaced.
        _publish_directory_no_replace(staging_dir, run_dir)
        return run_dir
    except BaseException:
        # A failed run must never resemble a complete artifact set.
        if staging_dir is not None:
            shutil.rmtree(staging_dir, ignore_errors=True)
        raise


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--raw-root", type=Path, required=True)
    parser.add_argument("--labels-root", type=Path, required=True)
    parser.add_argument("--splits-root", type=Path, required=True)
    parser.add_argument("--duplicate-reviews", type=Path, required=True)
    parser.add_argument("--artifacts-root", type=Path, required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args(argv)
    run_dir = run_training(
        args.config, args.raw_root, args.labels_root, args.splits_root,
        args.duplicate_reviews, args.artifacts_root, args.run_id,
    )
    print(json.dumps({"runDirectory": str(run_dir)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
