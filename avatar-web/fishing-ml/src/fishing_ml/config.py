"""Strict, versioned configuration for fishing matcher training."""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

import yaml

_SCHEMA_VERSION = 1
_REQUIRED_KEYS = frozenset(
    {
        "schemaVersion",
        "seed",
        "epochs",
        "learningRate",
        "weightDecay",
        "temperature",
        "embeddingDim",
        "channels",
        "checkpointMetric",
        "device",
        "workers",
        "reproducibilityTolerance",
    }
)
_SUPPORTED_CHECKPOINT_METRICS = frozenset({"dev_top1_accuracy"})
_SUPPORTED_DEVICES = frozenset({"auto", "cpu", "cuda", "mps"})


@dataclass(frozen=True, slots=True)
class TrainingConfig:
    schema_version: int
    seed: int
    epochs: int
    learning_rate: float
    weight_decay: float
    temperature: float
    embedding_dim: int
    channels: tuple[int, int, int, int]
    checkpoint_metric: str
    device: str
    workers: int
    reproducibility_tolerance: float


def load_training_config(path: Path) -> TrainingConfig:
    """Load a schema-v1 YAML config, rejecting coercion and unknown fields."""
    config_path = Path(path)
    try:
        raw = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    except OSError as error:
        raise ValueError(f"cannot read training config {config_path}: {error}") from error
    except yaml.YAMLError as error:
        raise ValueError(f"invalid YAML in training config {config_path}: {error}") from error
    if not isinstance(raw, Mapping):
        raise ValueError("training config must be a YAML mapping")

    keys = set(raw)
    missing = sorted(_REQUIRED_KEYS - keys)
    unknown = sorted(keys - _REQUIRED_KEYS)
    if missing or unknown:
        details = []
        if missing:
            details.append(f"missing keys: {', '.join(missing)}")
        if unknown:
            details.append(f"unknown keys: {', '.join(map(str, unknown))}")
        raise ValueError("invalid training config keys (" + "; ".join(details) + ")")

    schema_version = _integer(raw, "schemaVersion", minimum=1)
    if schema_version != _SCHEMA_VERSION:
        raise ValueError(f"unsupported training config schemaVersion {schema_version}")
    channels_value = raw["channels"]
    if not isinstance(channels_value, list) or len(channels_value) != 4:
        raise ValueError("channels must be a list of exactly four positive integers")
    channels = tuple(_positive_integer(value, f"channels[{index}]") for index, value in enumerate(channels_value))

    checkpoint_metric = _string(raw, "checkpointMetric")
    if checkpoint_metric not in _SUPPORTED_CHECKPOINT_METRICS:
        raise ValueError(f"unsupported checkpointMetric {checkpoint_metric!r}")
    device = _string(raw, "device")
    if device not in _SUPPORTED_DEVICES:
        raise ValueError(f"unsupported device {device!r}")

    return TrainingConfig(
        schema_version=schema_version,
        seed=_integer(raw, "seed", minimum=0),
        epochs=_integer(raw, "epochs", minimum=1),
        learning_rate=_finite_number(raw, "learningRate", minimum_exclusive=0.0),
        weight_decay=_finite_number(raw, "weightDecay", minimum_inclusive=0.0),
        temperature=_finite_number(raw, "temperature", minimum_exclusive=0.0),
        embedding_dim=_integer(raw, "embeddingDim", minimum=1),
        channels=channels,  # type: ignore[arg-type]
        checkpoint_metric=checkpoint_metric,
        device=device,
        workers=_integer(raw, "workers", minimum=0),
        reproducibility_tolerance=_finite_number(
            raw,
            "reproducibilityTolerance",
            minimum_inclusive=0.0,
            maximum_inclusive=1.0,
        ),
    )


def _integer(values: Mapping[str, Any], key: str, *, minimum: int) -> int:
    value = values[key]
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ValueError(f"{key} must be an integer >= {minimum}")
    return value


def _positive_integer(value: Any, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError(f"{name} must be a positive integer")
    return value


def _finite_number(
    values: Mapping[str, Any],
    key: str,
    *,
    minimum_exclusive: float | None = None,
    minimum_inclusive: float | None = None,
    maximum_inclusive: float | None = None,
) -> float:
    value = values[key]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{key} must be a finite number")
    number = float(value)
    if not math.isfinite(number):
        raise ValueError(f"{key} must be a finite number")
    if minimum_exclusive is not None and number <= minimum_exclusive:
        raise ValueError(f"{key} must be > {minimum_exclusive}")
    if minimum_inclusive is not None and number < minimum_inclusive:
        raise ValueError(f"{key} must be >= {minimum_inclusive}")
    if maximum_inclusive is not None and number > maximum_inclusive:
        raise ValueError(f"{key} must be <= {maximum_inclusive}")
    return number


def _string(values: Mapping[str, Any], key: str) -> str:
    value = values[key]
    if not isinstance(value, str) or not value:
        raise ValueError(f"{key} must be a non-empty string")
    return value
