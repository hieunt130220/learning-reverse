"""fishing_ml — offline pipeline for Avatar fishing image matching (Giai đoạn A).

This package currently exposes only its import boundary and console entry
points. The individual modules are placeholders; later tasks replace them with
the real dataset import, labeling, validation, split, baseline, training,
freeze/calibration, and evaluation logic.
"""

__version__ = "0.1.0"

__all__ = [
    "import_data",
    "label",
    "validate",
    "split",
    "baselines",
    "train",
    "calibrate",
    "evaluate",
]
