"""Strict, versioned configuration for fishing matcher training."""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

import yaml

_SCHEMA_VERSION = 1
_V2_SCHEMA_VERSION = 2
_V3_SCHEMA_VERSION = 3

# Schema v2 allowed values
ALLOWED_AUGMENTATION_PROFILES = frozenset({"none", "photometric", "photometric_plus_geom"})
ALLOWED_HARD_NEGATIVE_RATIOS = frozenset({0.0, 0.25})

# Schema v3 coverage-recovery values
ALLOWED_CYCLE_AUGMENTATION_PROFILES = frozenset(
    {
        "photometric_mild",
        "photometric_plus_geom_mild",
        "photometric_plus_geom_standard",
        "photometric_plus_geom_strong",
    }
)
ALLOWED_CYCLE_HARD_NEGATIVE_RATIOS = frozenset({0.0, 0.25, 0.50})

# Schema v1 compatibility defaults (not valid in v2 YAML)
_LEGACY_AUGMENTATION_PROFILE = "legacy_combined"
_LEGACY_HARD_NEGATIVE_RATIO = 0.0
_LEGACY_HARD_NEGATIVE_MARGIN = 0.10

_V1_REQUIRED_KEYS = frozenset(
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
_REQUIRED_KEYS = _V1_REQUIRED_KEYS
_V2_EXTRA_KEYS = frozenset({"augmentationProfile", "hardNegativeRatio", "hardNegativeMargin"})

_SUPPORTED_CHECKPOINT_METRICS = frozenset({"dev_top1_accuracy"})
_SUPPORTED_DEVICES = frozenset({"auto", "cpu", "cuda", "mps"})

# Keep all schema integers bounded so a hostile YAML/JSON integer cannot reach
# float conversion, tensor shapes, or unbounded error formatting.
_MAX_PROTOCOL_INTEGER = 2**53 - 1
_MAX_CONFIG_INTEGER = 2**53 - 1


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
    augmentation_profile: str = _LEGACY_AUGMENTATION_PROFILE
    hard_negative_ratio: float = _LEGACY_HARD_NEGATIVE_RATIO
    hard_negative_margin: float = _LEGACY_HARD_NEGATIVE_MARGIN


def load_training_config(path: Path) -> TrainingConfig:
    """Load a schema-v1/v2/v3 YAML config, rejecting coercion and unknown fields."""
    config_path = Path(path)
    try:
        raw = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    except OSError as error:
        raise ValueError(f"cannot read training config {config_path}: {error}") from error
    except yaml.YAMLError as error:
        raise ValueError(f"invalid YAML in training config {config_path}: {error}") from error
    if not isinstance(raw, Mapping):
        raise ValueError("training config must be a YAML mapping")
    return _parse_config_document(raw)


def load_training_config_from_document(document: Mapping[str, Any]) -> TrainingConfig:
    """Parse an in-memory training-config document (model-config.json, v1/v2/v3)."""
    return _parse_config_document(document)


def config_to_document(config: TrainingConfig) -> dict[str, object]:
    """Canonical serialization for model-config.json and effective config hashing.

    Always writes all fields including v2 augmentation/hard-negative fields.
    Schema v1 configs get legacy defaults; schema v2/v3 configs get explicit values.

    The output is a FLAT mapping matching the YAML camelCase field names,
    suitable for deterministic hashing with sort_keys=True.
    """
    doc: dict[str, object] = {
        "schemaVersion": config.schema_version,
        "seed": config.seed,
        "epochs": config.epochs,
        "learningRate": config.learning_rate,
        "weightDecay": config.weight_decay,
        "temperature": config.temperature,
        "embeddingDim": config.embedding_dim,
        "channels": list(config.channels),
        "checkpointMetric": config.checkpoint_metric,
        "device": config.device,
        "workers": config.workers,
        "reproducibilityTolerance": config.reproducibility_tolerance,
    }
    if config.schema_version >= 2:
        doc["augmentationProfile"] = config.augmentation_profile
        doc["hardNegativeRatio"] = config.hard_negative_ratio
        doc["hardNegativeMargin"] = config.hard_negative_margin
    return doc


def _parse_config_document(raw: Mapping[str, Any]) -> TrainingConfig:
    """Shared canonical parser: exact key set per schemaVersion, strict field types."""
    schema_version = _integer(raw, "schemaVersion", minimum=1)
    if schema_version not in (_SCHEMA_VERSION, _V2_SCHEMA_VERSION, _V3_SCHEMA_VERSION):
        raise ValueError(f"unsupported training config schemaVersion {schema_version}")
    has_explicit_training_controls = schema_version in (_V2_SCHEMA_VERSION, _V3_SCHEMA_VERSION)
    allowed_keys = _V1_REQUIRED_KEYS | (
        _V2_EXTRA_KEYS if has_explicit_training_controls else frozenset()
    )
    keys = set(raw)
    missing = sorted(allowed_keys - keys)
    unknown = sorted(keys - allowed_keys)
    if missing or unknown:
        details = []
        if missing:
            details.append(f"missing keys: {', '.join(missing)}")
        if unknown:
            details.append(f"unknown keys: {', '.join(map(str, unknown))}")
        raise ValueError("invalid training config keys (" + "; ".join(details) + ")")

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
    workers = _integer(raw, "workers", minimum=0)

    augmentation_profile = _LEGACY_AUGMENTATION_PROFILE
    hard_negative_ratio = _LEGACY_HARD_NEGATIVE_RATIO
    hard_negative_margin = _LEGACY_HARD_NEGATIVE_MARGIN
    if has_explicit_training_controls:
        # Schema-v2/v3 configs MUST carry all three fields (missing
        # keys already rejected above via the allowed_keys superset check).
        augmentation_profile = _string(raw, "augmentationProfile")
        allowed_profiles = (
            ALLOWED_AUGMENTATION_PROFILES
            if schema_version == _V2_SCHEMA_VERSION
            else ALLOWED_CYCLE_AUGMENTATION_PROFILES
        )
        if augmentation_profile not in allowed_profiles:
            raise ValueError(f"augmentationProfile must be one of {sorted(allowed_profiles)}")
        hard_negative_ratio = _finite_number(raw, "hardNegativeRatio")
        allowed_ratios = (
            ALLOWED_HARD_NEGATIVE_RATIOS
            if schema_version == _V2_SCHEMA_VERSION
            else ALLOWED_CYCLE_HARD_NEGATIVE_RATIOS
        )
        if hard_negative_ratio not in allowed_ratios:
            raise ValueError(f"hardNegativeRatio must be one of {sorted(allowed_ratios)}")
        hard_negative_margin = _finite_number(raw, "hardNegativeMargin")
        if hard_negative_margin <= 0:
            raise ValueError("hardNegativeMargin must be positive")
    if schema_version == _V3_SCHEMA_VERSION:
        if device != "cpu":
            raise ValueError("schema v3 requires device='cpu'")
        if workers != 0:
            raise ValueError("schema v3 requires workers=0")

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
        workers=workers,
        reproducibility_tolerance=_finite_number(
            raw,
            "reproducibilityTolerance",
            minimum_inclusive=0.0,
            maximum_inclusive=1.0,
        ),
        augmentation_profile=augmentation_profile,
        hard_negative_ratio=hard_negative_ratio,
        hard_negative_margin=hard_negative_margin,
    )


def _integer(values: Mapping[str, Any], key: str, *, minimum: int) -> int:
    value = values[key]
    if (
        isinstance(value, bool)
        or not isinstance(value, int)
        or value < minimum
        or value > _MAX_CONFIG_INTEGER
    ):
        raise ValueError(f"{key} must be an integer from {minimum} through {_MAX_CONFIG_INTEGER}")
    return value


def _positive_integer(value: Any, name: str) -> int:
    if (
        isinstance(value, bool)
        or not isinstance(value, int)
        or value <= 0
        or value > _MAX_CONFIG_INTEGER
    ):
        raise ValueError(f"{name} must be a positive integer <= {_MAX_CONFIG_INTEGER}")
    return value


def _finite_float(value: object, key: str) -> float:
    try:
        number = float(value)
    except (OverflowError, ValueError, TypeError):
        raise ValueError(f"{key} must be a finite number") from None
    if not math.isfinite(number):
        raise ValueError(f"{key} must be a finite number")
    return number


def _format_bound(value: float | None) -> str:
    return repr(value)


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
    number = _finite_float(value, key)
    if minimum_exclusive is not None and number <= minimum_exclusive:
        raise ValueError(f"{key} must be > {_format_bound(minimum_exclusive)}")
    if minimum_inclusive is not None and number < minimum_inclusive:
        raise ValueError(f"{key} must be >= {_format_bound(minimum_inclusive)}")
    if maximum_inclusive is not None and number > maximum_inclusive:
        raise ValueError(f"{key} must be <= {_format_bound(maximum_inclusive)}")
    return number


def _string(values: Mapping[str, Any], key: str) -> str:
    value = values[key]
    if not isinstance(value, str) or not value:
        raise ValueError(f"{key} must be a non-empty string")
    return value
