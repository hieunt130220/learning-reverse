import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fishing_ml import evaluate
from fishing_ml.inference_service import load_frozen_matcher
from fishing_ml.provenance import revision_matches_recorded


CURRENT = "aebbbe5a01affddebf7e0c7e8244e6a1e1fd3288"
RECORDED = "8ca1f93990dcd06a0b7d6ee6251100e67a155365"


class ProvenanceRecoveryTests(unittest.TestCase):
    def test_revision_contract_is_exact_and_ordered(self):
        self.assertTrue(revision_matches_recorded(CURRENT, CURRENT))
        self.assertTrue(revision_matches_recorded(CURRENT, RECORDED))
        self.assertFalse(revision_matches_recorded(RECORDED, CURRENT))
        self.assertFalse(revision_matches_recorded(CURRENT, "b" * 40))
        self.assertFalse(revision_matches_recorded(CURRENT, ""))
        self.assertFalse(revision_matches_recorded("not-a-revision", RECORDED))
        self.assertFalse(revision_matches_recorded(CURRENT, None))

    def test_frozen_matcher_accepts_approved_transfer_pair(self):
        with tempfile.TemporaryDirectory() as directory:
            frozen = Path(directory)
            (frozen / "freeze-manifest.json").write_text(
                json.dumps({"runId": "selected-run", "gitRevision": RECORDED}),
                encoding="utf-8",
            )
            inputs = ({"runId": "selected-run"}, "stats", "thresholds", "model", "cpu")
            with (
                patch("fishing_ml.evaluate._inputs", return_value=inputs),
                patch("fishing_ml.inference_service._current_git_revision", return_value=CURRENT),
            ):
                matcher = load_frozen_matcher(frozen)
            self.assertEqual(matcher.model_id, "selected-run")


class FinalLockRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.run_dir = Path(self.temp.name) / "selected-run"
        (self.run_dir / "frozen").mkdir(parents=True)
        self.config = {"schemaVersion": 2, "temperature": 0.1}
        self.inputs = (self.config, "stats", "thresholds", "model", "cpu")

    def tearDown(self):
        self.temp.cleanup()

    def call_final(self):
        return evaluate.evaluate_final_once(
            self.run_dir,
            Path("synthetic-raw"),
            Path("synthetic-labels"),
            Path("synthetic-splits"),
            "selected-run",
            phase2_confirmed=True,
        )

    def base_patches(self):
        return (
            patch("fishing_ml.evaluate.verify_freeze", return_value=SimpleNamespace(git_revision=RECORDED)),
            patch("fishing_ml.evaluate._git", return_value=CURRENT),
            patch("fishing_ml.evaluate._inputs", return_value=self.inputs),
        )

    def test_prelock_revision_rejection_never_checks_dataset(self):
        with (
            patch("fishing_ml.evaluate.verify_freeze", return_value=SimpleNamespace(git_revision="b" * 40)),
            patch("fishing_ml.evaluate._git", return_value=CURRENT),
            patch("fishing_ml.evaluate._inputs") as inputs,
            patch("fishing_ml.evaluate.verify_current_dataset") as verify_dataset,
        ):
            with self.assertRaises(RuntimeError):
                self.call_final()
        self.assertFalse((self.run_dir / "final-evaluation.lock").exists())
        inputs.assert_not_called()
        verify_dataset.assert_not_called()

    def test_dataset_verification_starts_after_durable_lock(self):
        lock = self.run_dir / "final-evaluation.lock"

        def verify_after_lock(*args, **kwargs):
            self.assertTrue(lock.exists())
            payload = lock.read_text(encoding="utf-8")
            self.assertIn("run_id=selected-run\n", payload)
            self.assertIn("started_at=", payload)
            raise ValueError("synthetic dataset failure")

        first, second, third = self.base_patches()
        with first, second, third, patch(
            "fishing_ml.evaluate.verify_current_dataset", side_effect=verify_after_lock
        ):
            with self.assertRaisesRegex(ValueError, "synthetic dataset failure"):
                self.call_final()
        self.assertTrue(lock.exists())
        with self.assertRaises(FileExistsError):
            self.call_final()

    def test_lock_creation_failure_prevents_dataset_access(self):
        first, second, third = self.base_patches()
        with (
            first,
            second,
            third,
            patch("fishing_ml.evaluate._create_final_lock", side_effect=OSError("synthetic lock failure")),
            patch("fishing_ml.evaluate.verify_current_dataset") as verify_dataset,
        ):
            with self.assertRaisesRegex(OSError, "synthetic lock failure"):
                self.call_final()
        verify_dataset.assert_not_called()

    def test_evaluation_and_publication_failures_retain_lock(self):
        for failure_target in ("_evaluate", "publish_no_replace"):
            with self.subTest(failure_target=failure_target):
                with tempfile.TemporaryDirectory() as directory:
                    self.run_dir = Path(directory) / "selected-run"
                    (self.run_dir / "frozen").mkdir(parents=True)
                    metrics = SimpleNamespace(
                        top1_accuracy=1.0,
                        wrong_count=0,
                        to_json=lambda: {"top1Accuracy": 1.0, "wrongCount": 0},
                    )
                    replacements = {
                        "_evaluate": ((), metrics, 0.0, {}),
                        "publish_no_replace": None,
                    }
                    first, second, third = self.base_patches()
                    with (
                        first,
                        second,
                        third,
                        patch("fishing_ml.evaluate.verify_current_dataset"),
                        patch("fishing_ml.evaluate._load_final_episodes", return_value=()),
                        patch("fishing_ml.evaluate._evaluate", return_value=replacements["_evaluate"]),
                        patch("fishing_ml.evaluate.publish_no_replace"),
                        patch(f"fishing_ml.evaluate.{failure_target}", side_effect=RuntimeError("synthetic failure")),
                    ):
                        with self.assertRaisesRegex(RuntimeError, "synthetic failure"):
                            self.call_final()
                    self.assertTrue((self.run_dir / "final-evaluation.lock").exists())

    def test_success_retains_lock(self):
        metrics = SimpleNamespace(
            top1_accuracy=1.0,
            wrong_count=0,
            to_json=lambda: {"top1Accuracy": 1.0, "wrongCount": 0},
        )
        first, second, third = self.base_patches()
        with (
            first,
            second,
            third,
            patch("fishing_ml.evaluate.verify_current_dataset"),
            patch("fishing_ml.evaluate._load_final_episodes", return_value=()),
            patch("fishing_ml.evaluate._evaluate", return_value=((), metrics, 0.0, {})),
            patch("fishing_ml.evaluate.publish_no_replace"),
        ):
            result = self.call_final()
        self.assertTrue(result["passed"])
        self.assertTrue((self.run_dir / "final-evaluation.lock").exists())


if __name__ == "__main__":
    unittest.main()
