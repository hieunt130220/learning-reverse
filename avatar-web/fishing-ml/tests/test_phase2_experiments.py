import hashlib
import json
import tempfile
import unittest
from dataclasses import asdict
from pathlib import Path
from unittest.mock import patch

from fishing_ml.dataset_version import DatasetVersion, dataset_version_to_json
from fishing_ml.experiments import (
    ExperimentResult,
    SelectionGate,
    _result_from_manifest,
    _validate_candidate_against_spec,
    compare_experiments,
    enumerate_specs,
    load_selection_gate,
    write_selection,
)
from fishing_ml.schema import atomic_write_json


CANDIDATES = Path("config/phase2/candidates.yaml")


def version():
    return DatasetVersion(1, "dataset-2", "dataset-1", "2026-09-03T00:00:00Z", ())


def result_for(spec, *, wrong=0, accepted=.75, top1=.75, exact=.5):
    return ExperimentResult(
        spec=spec, run_id=spec.run_id, run_dir=f"/synthetic/{spec.run_id}",
        thresholds_path=f"/synthetic/{spec.run_id}/thresholds.json",
        thresholds={"minSimilarity": .5, "minMargin": .1},
        dev_metrics={"schemaVersion": 1, "query_count": 4, "batch_count": 2,
                     "wrong_count": 1, "top1_accuracy": top1,
                     "batch_exact_match": exact, "abstention_rate": 1 - accepted},
        accepted_wrong_count=wrong, accepted_rate=accepted,
        top1_accuracy=top1, batch_exact_match=exact, manifest_path="",
        config_checksum=spec.config_checksum, split_checksum=spec.split_checksum,
        git_revision="a" * 40, passed_gate=wrong == 0,
    )


def manifest_for(result, dataset_path):
    spec = result.spec
    return {
        "schemaVersion": 2, "stage": "train-dev-selection",
        "runId": result.run_id, "matrixKey": spec.matrix_key,
        "spec": asdict(spec), "runDir": result.run_dir,
        "thresholdsPath": result.thresholds_path,
        "provenance": {
            "datasetId": "dataset-2", "parentDatasetId": "dataset-1",
            "datasetVersionSha256": hashlib.sha256(dataset_path.read_bytes()).hexdigest(),
            "splitSha256": spec.split_checksum, "configSha256": spec.config_checksum,
            "gitRevision": "a" * 40,
        },
        "effectiveConfig": spec.config_overlay,
        "thresholds": {"minSimilarity": .5, "minMargin": .1},
        "rawDevMetrics": {
            "queryCount": 4, "batchCount": 2, "wrongCount": 1,
            "top1Accuracy": .75, "batchExactMatch": .5, "abstentionRate": 0.0,
        },
        "calibratedMetrics": {
            "acceptedCount": 3, "acceptedAccuracy": 1.0,
            "acceptedRate": .75, "abstentionRate": .25,
            "wrongAcceptedCount": 0,
        },
        "devSelectionPassed": True,
    }


class ExperimentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.splits = self.root / "splits"
        self.splits.mkdir()
        (self.splits / "train.txt").write_text("train-a\n", encoding="utf-8")
        (self.splits / "dev.txt").write_text("dev-a\n", encoding="utf-8")
        self.dataset_path = self.root / "dataset-version.json"
        atomic_write_json(self.dataset_path, dataset_version_to_json(version()))

    def tearDown(self):
        self.temp.cleanup()

    def test_matrix_enumerates_24_unique_canonical_candidates(self):
        specs = enumerate_specs(CANDIDATES, self.splits, version())
        self.assertEqual(len(specs), 24)
        self.assertEqual(len({s.matrix_key for s in specs}), 24)
        self.assertEqual(len({s.run_id for s in specs}), 24)
        self.assertEqual(len({s.config_checksum for s in specs}), 24)
        self.assertTrue(all(s.parent_dataset_id == "dataset-1" for s in specs))

    def test_selection_policy_and_order_are_configured(self):
        gate = load_selection_gate(CANDIDATES)
        self.assertEqual(gate, SelectionGate(
            True, ("acceptedRate", "top1Accuracy", "batchExactMatch")))
        specs = enumerate_specs(CANDIDATES, self.splits, version())
        wrong = result_for(specs[0], wrong=1, accepted=1.0, top1=1.0, exact=1.0)
        lower = result_for(specs[1], accepted=.8, top1=.9, exact=.9)
        higher = result_for(specs[2], accepted=.9, top1=.8, exact=.8)
        selected = compare_experiments(
            [wrong, lower, higher], require_zero_wrong_accepted=gate.require_zero_wrong_accepted,
            tie_breakers=gate.tie_breakers)
        self.assertEqual(selected.run_id, higher.run_id)

    def test_manifest_parser_rejects_tampered_identity_metrics_and_provenance(self):
        spec = enumerate_specs(CANDIDATES, self.splits, version())[0]
        document = manifest_for(result_for(spec), self.dataset_path)
        parsed = _result_from_manifest(document, "manifest.json")
        _validate_candidate_against_spec(parsed, spec)
        for path, value in (
            (("runId",), "../escape"),
            (("provenance", "configSha256"), "0" * 64),
            (("calibratedMetrics", "acceptedRate"), .5),
            (("rawDevMetrics", "top1Accuracy"), float("nan")),
        ):
            tampered = json.loads(json.dumps(document))
            target = tampered
            for key in path[:-1]:
                target = target[key]
            target[path[-1]] = value
            with self.subTest(path=path), self.assertRaises(ValueError):
                _result_from_manifest(tampered)

    def test_selection_is_idempotent_never_replaced_and_uses_configured_order(self):
        spec = enumerate_specs(CANDIDATES, self.splits, version())[0]
        candidate_result = result_for(spec)
        candidate_manifest = self.root / "manifest.json"
        candidate_manifest.write_text("{}", encoding="utf-8")
        selection = self.root / "selection.json"
        gate = load_selection_gate(CANDIDATES)
        with patch("fishing_ml.experiments._git_revision", return_value="a" * 40):
            write_selection(
                selection, candidate_result, candidate_manifest, self.dataset_path,
                version(), git_revision="a" * 40, selection_gate=gate)
            original = selection.read_bytes()
            write_selection(
                selection, candidate_result, candidate_manifest, self.dataset_path,
                version(), git_revision="a" * 40, selection_gate=gate)
        self.assertEqual(selection.read_bytes(), original)
        doc = json.loads(original)
        self.assertEqual(doc["policy"]["tieBreakers"], [*gate.tie_breakers, "runId"])
        with self.assertRaises(FileExistsError):
            write_selection(
                selection, candidate_result, candidate_manifest, self.dataset_path,
                version(), git_revision="b" * 40, selection_gate=gate)
        self.assertEqual(selection.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
