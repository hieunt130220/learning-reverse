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



class RelocatedProvenanceTests(unittest.TestCase):
    """Synthetic train/dev fixtures; no restored artifacts or final data."""
    CURRENT = "aebbbe5a01affddebf7e0c7e8244e6a1e1fd3288"
    RECORDED = "8ca1f93990dcd06a0b7d6ee6251100e67a155365"

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.splits = self.root / "splits"
        self.splits.mkdir()
        (self.splits / "train.txt").write_text("train-a\n", encoding="utf-8")
        (self.splits / "dev.txt").write_text("dev-a\n", encoding="utf-8")
        self.dataset = self.root / "dataset-version.json"
        atomic_write_json(self.dataset, dataset_version_to_json(version()))
        self.spec = enumerate_specs(CANDIDATES, self.splits, version())[0]
        self.artifacts = self.root / "artifacts"
        self.run = self.artifacts / self.spec.run_id
        (self.run / "checkpoints").mkdir(parents=True)
        self.manifest = self.artifacts / "phase2-experiments" / f"{self.spec.run_id}.json"
        self.manifest.parent.mkdir()
        self.selection = self.artifacts / "phase2-selection.json"
        self._configure()

    def _configure(self, *, relocated=False, recorded=None):
        from dataclasses import replace
        recorded = recorded or self.CURRENT
        archived = Path("/synthetic-absent-transfer/artifacts") / self.spec.run_id if relocated else self.run
        candidate = replace(result_for(self.spec), run_dir=str(archived),
                            thresholds_path=str(archived / "thresholds.json"), git_revision=recorded)
        self.document = manifest_for(candidate, self.dataset)
        self.document["provenance"]["gitRevision"] = recorded
        atomic_write_json(self.manifest, self.document)
        checkpoint = self.run / "checkpoints" / "best-dev.pt"
        checkpoint.write_bytes(b"synthetic checkpoint, never loaded")
        for name in ("normalization.json", "dev-predictions.json", "training-history.json"):
            atomic_write_json(self.run / name, {})
        atomic_write_json(self.run / "model-config.json", self.spec.config_overlay)
        atomic_write_json(self.run / "dev-metrics.json", candidate.dev_metrics)
        atomic_write_json(self.run / "thresholds.json", {
            "thresholds": dict(candidate.thresholds), "metrics": self.document["calibratedMetrics"]})
        atomic_write_json(self.run / "environment.json", {
            "gitRevision": recorded, "checkpointSha256": hashlib.sha256(checkpoint.read_bytes()).hexdigest()})
        if self.selection.exists():
            self.selection.unlink()
        write_selection(self.selection, candidate, self.manifest, self.dataset, version(),
                        git_revision=recorded, selection_gate=load_selection_gate(CANDIDATES))

    def _resolve(self):
        from fishing_ml.experiments import _resolve_selected_result
        return _resolve_selected_result(self.selection, self.artifacts, self.dataset,
                                        self.splits, CANDIDATES)[1]

    def _candidate(self):
        from fishing_ml.experiments import _validate_current_candidate
        return _validate_current_candidate(self.manifest, self.spec, version=version(),
            dataset_version_path=self.dataset, splits_root=self.splits, artifacts_root=self.artifacts)

    def _assert_both_reject(self, *, current=None):
        with patch("fishing_ml.experiments._git_revision", return_value=current or self.CURRENT):
            for check in (self._resolve, self._candidate):
                with self.subTest(check=check.__name__), self.assertRaises(ValueError):
                    check()

    def test_same_root_and_trusted_relocation_preserve_evidence(self):
        for relocated, recorded in ((False, self.CURRENT), (True, self.RECORDED)):
            with self.subTest(relocated=relocated):
                self._configure(relocated=relocated, recorded=recorded)
                original = (self.manifest.read_bytes(), self.selection.read_bytes())
                with patch("fishing_ml.experiments._git_revision", return_value=self.CURRENT):
                    for check in (self._resolve, self._candidate):
                        result = check()
                        self.assertEqual(Path(result.run_dir), self.run)
                        self.assertEqual(Path(result.thresholds_path), self.run / "thresholds.json")
                        self.assertEqual(result.git_revision, recorded)
                self.assertEqual((self.manifest.read_bytes(), self.selection.read_bytes()), original)

    def test_malformed_archived_paths_are_rejected(self):
        for run, thresholds in (
            ("/archive/artifacts/wrong-run", "/archive/artifacts/wrong-run/thresholds.json"),
            (f"/archive/models/{self.spec.run_id}", f"/archive/models/{self.spec.run_id}/thresholds.json"),
            (f"artifacts/{self.spec.run_id}", f"artifacts/{self.spec.run_id}/thresholds.json"),
            (str(self.run), str(self.run / "other.json")),
            (f"/archive/../artifacts/{self.spec.run_id}", f"/archive/../artifacts/{self.spec.run_id}/thresholds.json"),
        ):
            with self.subTest(run=run, thresholds=thresholds):
                self._configure()
                self.document.update(runDir=run, thresholdsPath=thresholds)
                atomic_write_json(self.manifest, self.document)
                self._assert_both_reject()

    def test_revision_compatibility_is_exact_and_directional(self):
        for current, recorded in ((self.CURRENT, "b" * 40), (self.RECORDED, self.CURRENT),
                                  ("c" * 40, self.RECORDED)):
            with self.subTest(current=current, recorded=recorded):
                self._configure(relocated=True, recorded=recorded)
                self._assert_both_reject(current=current)

    def test_selection_cannot_mix_current_and_recorded_revisions(self):
        self._configure(relocated=True, recorded=self.RECORDED)
        selection = json.loads(self.selection.read_bytes())
        selection["provenance"]["gitRevision"] = self.CURRENT
        atomic_write_json(self.selection, selection)
        with patch("fishing_ml.experiments._git_revision", return_value=self.CURRENT):
            self._candidate()
            with self.assertRaises(ValueError):
                self._resolve()

    def test_symlink_operational_directories_and_leaves_are_rejected(self):
        for target in (self.run, self.run / "checkpoints", self.manifest.parent,
                       self.run / "thresholds.json", self.run / "checkpoints" / "best-dev.pt", self.manifest):
            with self.subTest(target=target):
                moved = self.root / "symlink-target"
                target.rename(moved)
                target.symlink_to(moved, target_is_directory=moved.is_dir())
                try:
                    self._assert_both_reject()
                finally:
                    target.unlink()
                    moved.rename(target)

    def test_checkpoint_and_dataset_checksums_are_enforced(self):
        for target in (self.run / "checkpoints" / "best-dev.pt", self.dataset):
            with self.subTest(target=target):
                original = target.read_bytes()
                target.write_bytes(original + b"\n")
                try:
                    self._assert_both_reject()
                finally:
                    target.write_bytes(original)

    def test_selection_manifest_checksum_is_enforced(self):
        self.manifest.write_bytes(self.manifest.read_bytes() + b"\n")
        with patch("fishing_ml.experiments._git_revision", return_value=self.CURRENT):
            self._candidate()
            with self.assertRaises(ValueError):
                self._resolve()

    def test_noncanonical_manifest_location_is_rejected(self):
        alternate = self.root / "alternate.json"
        alternate.write_bytes(self.manifest.read_bytes())
        self.manifest = alternate
        with patch("fishing_ml.experiments._git_revision", return_value=self.CURRENT):
            with self.assertRaises(ValueError):
                self._candidate()

    def test_symlink_artifacts_root_and_parent_are_rejected(self):
        original = self.artifacts
        for target in (self.artifacts, self.root):
            with self.subTest(target=target), tempfile.TemporaryDirectory() as alias_directory:
                alias = Path(alias_directory).resolve() / "alias"
                alias.symlink_to(target, target_is_directory=True)
                self.artifacts = alias if target == original else alias / "artifacts"
                try:
                    self._assert_both_reject()
                finally:
                    self.artifacts = original

    def test_frozen_identity_retains_exact_candidate_revision_and_checksum(self):
        from dataclasses import replace
        from fishing_ml.experiments import _validate_frozen_identity

        frozen = self.run / "frozen"
        frozen.mkdir()
        for name in ("model-config.json", "normalization.json", "thresholds.json",
                     "environment.json", "dev-metrics.json"):
            (frozen / name).write_bytes((self.run / name).read_bytes())
        (frozen / "best-dev.pt").write_bytes((self.run / "checkpoints" / "best-dev.pt").read_bytes())
        atomic_write_json(frozen / "dataset-snapshot.json", {"schemaVersion": 1, "batches": []})
        atomic_write_json(frozen / "split-checksums.json", {"schemaVersion": 1, "files": {}})
        inventory = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in frozen.iterdir()}
        frozen_manifest = frozen / "freeze-manifest.json"
        for recorded, candidate_revision, accepted in (
            (self.CURRENT, self.CURRENT, True),
            (self.RECORDED, self.RECORDED, True),
            ("b" * 40, "b" * 40, False),
            (self.CURRENT, self.RECORDED, False),
            (self.RECORDED, self.CURRENT, False),
        ):
            with self.subTest(recorded=recorded, candidate=candidate_revision):
                atomic_write_json(frozen_manifest, {
                    "schemaVersion": 1, "runId": self.spec.run_id,
                    "gitRevision": recorded, "files": inventory})
                original = frozen_manifest.read_bytes()
                result = replace(result_for(self.spec), git_revision=candidate_revision)
                with patch("fishing_ml.experiments._git_revision", return_value=self.CURRENT):
                    if accepted:
                        _validate_frozen_identity(frozen, result)
                    else:
                        with self.assertRaises(ValueError):
                            _validate_frozen_identity(frozen, result)
                self.assertEqual(frozen_manifest.read_bytes(), original)
        atomic_write_json(frozen_manifest, {
            "schemaVersion": 1, "runId": self.spec.run_id,
            "gitRevision": self.CURRENT, "files": inventory})
        (frozen / "best-dev.pt").write_bytes(b"modified checkpoint")
        with patch("fishing_ml.experiments._git_revision", return_value=self.CURRENT):
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                _validate_frozen_identity(frozen, replace(result_for(self.spec), git_revision=self.CURRENT))

    def test_publication_preserves_recorded_revision_and_is_idempotent(self):
        self._configure(relocated=True, recorded=self.RECORDED)
        with patch("fishing_ml.experiments._git_revision", return_value=self.CURRENT):
            candidate = self._candidate()
        target = self.artifacts / "new-selection.json"
        for _ in range(2):
            write_selection(target, candidate, self.manifest, self.dataset, version(),
                            git_revision=self.CURRENT, selection_gate=load_selection_gate(CANDIDATES))
        self.assertEqual(target.read_bytes(), self.selection.read_bytes())
        before = target.read_bytes()
        with self.assertRaises(FileExistsError):
            write_selection(target, candidate, self.manifest, self.dataset, version(),
                            git_revision="b" * 40, selection_gate=load_selection_gate(CANDIDATES))
        self.assertEqual(target.read_bytes(), before)
        absent = self.artifacts / "invalid-selection.json"
        with self.assertRaises(ValueError):
            write_selection(absent, candidate, self.manifest, self.dataset, version(),
                            git_revision="b" * 40, selection_gate=load_selection_gate(CANDIDATES))
        self.assertFalse(absent.exists())


if __name__ == "__main__":
    unittest.main()
