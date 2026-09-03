import copy
import unittest
from pathlib import Path

import torch

from fishing_ml.config import (
    config_to_document,
    load_training_config,
    load_training_config_from_document,
)
from fishing_ml.phase2_training import (
    apply_augmentation_profile,
    compute_hard_negative_loss,
    derive_rng,
    stable_seed_context,
)


V1 = {
    "schemaVersion": 1, "seed": 7, "epochs": 2, "learningRate": 0.001,
    "weightDecay": 0.0, "temperature": 0.1, "embeddingDim": 96,
    "channels": [32, 64, 96, 128], "checkpointMetric": "dev_top1_accuracy",
    "device": "cpu", "workers": 0, "reproducibilityTolerance": 0.002,
}
V2 = V1 | {
    "schemaVersion": 2, "augmentationProfile": "photometric",
    "hardNegativeRatio": 0.25, "hardNegativeMargin": 0.1,
}


class TrainingConfigTests(unittest.TestCase):
    def test_checked_in_v1_config_preserves_legacy_defaults(self):
        config = load_training_config(Path("config/train-baseline.yaml"))
        self.assertEqual(config.augmentation_profile, "legacy_combined")
        self.assertEqual(config.hard_negative_ratio, 0.0)
        self.assertNotIn("augmentationProfile", config_to_document(config))

    def test_v1_is_strict(self):
        for mutation in ({"extra": 1}, {"augmentationProfile": "none"}):
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                load_training_config_from_document(V1 | mutation)

    def test_v2_round_trips_and_rejects_invalid_fields(self):
        self.assertEqual(config_to_document(load_training_config_from_document(V2)), V2)
        for key in ("augmentationProfile", "hardNegativeRatio", "hardNegativeMargin"):
            invalid = copy.deepcopy(V2)
            del invalid[key]
            with self.subTest(missing=key), self.assertRaises(ValueError):
                load_training_config_from_document(invalid)
        for patch in (
            {"augmentationProfile": "legacy_combined"},
            {"hardNegativeRatio": 0.5},
            {"hardNegativeMargin": float("nan")},
            {"unknown": True},
        ):
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                load_training_config_from_document(V2 | patch)


class DeterminismTests(unittest.TestCase):
    def test_context_and_augmentation_are_deterministic(self):
        context = stable_seed_context(7, 3, "batch-a", "query", 2)
        self.assertEqual(len(context), 32)
        self.assertEqual(derive_rng(context).random(), derive_rng(context).random())
        tensor = torch.linspace(0.1, 0.9, 3 * 11 * 13).reshape(3, 11, 13)
        first = apply_augmentation_profile("photometric_plus_geom", tensor, context)
        second = apply_augmentation_profile("photometric_plus_geom", tensor, context)
        self.assertTrue(torch.equal(first, second))
        self.assertIs(apply_augmentation_profile("none", tensor, context), tensor)
        self.assertGreaterEqual(first.min().item(), 0.0)
        self.assertLessEqual(first.max().item(), 1.0)
        with self.assertRaises(ValueError):
            apply_augmentation_profile("unknown", tensor, context)

    def test_hard_negative_is_deterministic_and_handles_no_eligible_query(self):
        refs = torch.tensor([[1.0, 0.0], [0.0, 1.0]])
        queries = torch.nn.functional.normalize(
            torch.tensor([[1.0, 0.0], [0.8, 0.6], [0.0, 1.0], [0.6, 0.8]]), dim=1)
        targets = torch.tensor([0, 0, 1, 1])
        args = dict(ratio=0.25, margin=0.5, global_seed=9, epoch=2, batch_id="b")
        first = compute_hard_negative_loss(queries, refs, targets, **args)
        second = compute_hard_negative_loss(queries, refs, targets, **args)
        self.assertEqual(first.item(), second.item())
        empty_queries = torch.empty((0, 2), requires_grad=True)
        empty = compute_hard_negative_loss(
            empty_queries, refs, torch.empty((0,), dtype=torch.long), **args)
        self.assertEqual(empty.item(), 0.0)
        empty.backward()
        self.assertEqual(compute_hard_negative_loss(
            queries, refs[:1], torch.zeros(4, dtype=torch.long), **args).item(), 0.0)
        self.assertEqual(compute_hard_negative_loss(
            queries, refs, targets, **(args | {"ratio": 0.0})).item(), 0.0)


if __name__ == "__main__":
    unittest.main()
