import copy
import tempfile
import unittest
from pathlib import Path

from fishing_ml.phase2_gate import (
    BLOCK_INCOMPLETE_GROUND_TRUTH,
    BLOCK_POLICY_NOT_APPROVED,
    FAIL_LATENCY_MAX_NOT_BELOW_CEILING,
    FAIL_WRONG_ACCEPTED_NONZERO,
    GatePolicy,
    _normalize_replay_evidence,
    adjudicate_final,
    adjudicate_replay,
    exit_code_for_status,
    load_gate_policy,
    publish_gate_report,
)


def policy(placeholders=False):
    return GatePolicy(1, placeholders, None, None, None, True, .5, .5, .5,
                      100, 80, 120, 0, 0, True, True)


def freeze(run_id="run", checksum="a" * 64):
    names = (
        "model-config.json", "normalization.json", "thresholds.json",
        "environment.json", "dev-metrics.json", "best-dev.pt",
        "dataset-snapshot.json", "split-checksums.json",
    )
    files = {name: "b" * 64 for name in names}
    files["best-dev.pt"] = checksum
    return {"schemaVersion": 1, "runId": run_id, "gitRevision": "c" * 40, "files": files}


def replay_report():
    return {
        "schemaVersion": 2,
        "batchCount": 1, "queryCount": 2, "requestCount": 1,
        "successfulBatchCount": 1, "erroredBatchCount": 0,
        "acceptedCount": 1, "acceptedRate": .5,
        "abstainedCount": 1, "abstainedRate": .5,
        "omittedCount": 0, "omittedRate": 0.0,
        "labeledBatchCount": 1, "unknownBatchCount": 0,
        "labeledQueryCount": 2, "unknownQueryCount": 0,
        "labeledReturnedPredictionCount": 2,
        "unknownReturnedPredictionCount": 0,
        "correctAcceptedCount": 1, "wrongAcceptedCount": 0,
        "labeledCorrectPredictionCount": 2,
        "labeledWrongPredictionCount": 0,
        "labeledTop1Accuracy": 1.0,
        "labeledBatchExactCount": 1,
        "labeledBatchExactMatch": 1.0,
        "labeledAcceptedRate": .5,
        "errorCounts": {},
        "clientLatencyMs": {
            "sampleCount": 1, "p50": 50.0, "p95": 70.0,
            "p99": 75.0, "max": 100.0, "rule": "nearest-rank",
        },
        "rqBreakdown": {
            "R=2,Q=2": {
                "batches": 1, "queries": 2, "successfulBatches": 1,
                "erroredBatches": 0, "accepted": 1, "abstained": 1,
                "omitted": 0, "errors": {},
            }
        },
        "modelIdentity": {"modelIds": ["run"], "checksums": ["a" * 64]},
    }


class GateTests(unittest.TestCase):
    def test_checked_in_policy_is_approved_and_not_tuned_on_final(self):
        loaded = load_gate_policy(Path("config/phase2/gate.yaml"))
        self.assertFalse(loaded.pre_agreed_placeholders)
        self.assertTrue(loaded.not_tuned_on_phase_a_final)
        self.assertEqual(loaded.approved_at, "2026-09-05T04:33:21Z")
        self.assertEqual(loaded.approved_by, "hieunt")
        self.assertEqual(
            loaded.approval_evidence,
            "Codex task 01a06f4b-932b-71c0-861d-a4a5cbba1e2c — explicit user approval",
        )
        self.assertEqual(loaded.min_accepted_rate, 0.60)
        self.assertEqual(loaded.min_batch_exact_match, 0.90)
        self.assertEqual(loaded.min_top1_accuracy, 0.98)
        self.assertEqual(loaded.budget_ms, 50)
        self.assertEqual(loaded.p95_ms, 100)
        self.assertEqual(loaded.max_ms, 250)
        self.assertEqual(loaded.max_errored_batch_rate, 0.01)
        self.assertEqual(loaded.max_omitted_rate, 0.0)
        self.assertTrue(loaded.require_single_model_identity)
        self.assertTrue(loaded.require_zero_wrong_accepted)

    def test_final_uses_canonical_wrong_accepted_and_fail_beats_blocker(self):
        evidence = {"metrics": {
            "wrongAcceptedCount": 1, "acceptedCount": 1, "queryCount": 2,
            "acceptedRate": .5, "top1Accuracy": 1.0,
            "batchExactMatch": 1.0, "abstentionRate": .5,
        }}
        report = adjudicate_final(
            policy(True), evidence, policy_sha256="a" * 64,
            evidence_sha256="b" * 64)
        self.assertEqual(report.status, "fail")
        self.assertIn(FAIL_WRONG_ACCEPTED_NONZERO, report.failures)
        self.assertIn(BLOCK_POLICY_NOT_APPROVED, report.blockers)
        self.assertEqual(exit_code_for_status(report.status), 3)

    def test_replay_passes_and_max_equal_ceiling_fails(self):
        passing = adjudicate_replay(
            policy(), replay_report(), freeze(), policy_sha256="a" * 64,
            evidence_sha256="b" * 64)
        self.assertEqual(passing.status, "pass")
        at_ceiling = replay_report()
        at_ceiling["clientLatencyMs"]["max"] = 120.0
        at_ceiling["clientLatencyMs"]["p99"] = 120.0
        failing = adjudicate_replay(
            policy(), at_ceiling, freeze(), policy_sha256="a" * 64,
            evidence_sha256="b" * 64)
        self.assertEqual(failing.status, "fail")
        self.assertIn(FAIL_LATENCY_MAX_NOT_BELOW_CEILING, failing.failures)

    def test_known_wrong_accepted_beats_incomplete_ground_truth(self):
        partial = replay_report()
        partial.update({
            "batchCount": 2, "queryCount": 3,
            "successfulBatchCount": 2, "requestCount": 2,
            "labeledBatchCount": 1, "unknownBatchCount": 1,
            "labeledQueryCount": 2, "unknownQueryCount": 1,
            "acceptedCount": 2, "abstainedCount": 1,
            "acceptedRate": 2 / 3, "abstainedRate": 1 / 3,
            "correctAcceptedCount": 1, "wrongAcceptedCount": 1,
            "labeledCorrectPredictionCount": 1,
            "labeledWrongPredictionCount": 1,
            "labeledTop1Accuracy": .5,
            "labeledBatchExactCount": 0,
            "labeledBatchExactMatch": 0.0,
            "labeledAcceptedRate": 1.0,
            "unknownReturnedPredictionCount": 1,
        })
        partial["clientLatencyMs"].update({"sampleCount": 2})
        partial["rqBreakdown"]["R=2,Q=2"].update({
            "batches": 2, "queries": 3, "successfulBatches": 2,
            "accepted": 2, "abstained": 1,
        })
        result = adjudicate_replay(
            policy(), partial, freeze(), policy_sha256="a" * 64,
            evidence_sha256="b" * 64)
        self.assertEqual(result.status, "fail")
        self.assertIn(FAIL_WRONG_ACCEPTED_NONZERO, result.failures)
        self.assertIn(BLOCK_INCOMPLETE_GROUND_TRUTH, result.blockers)

    def test_replay_normalizer_rejects_schema_and_count_tampering(self):
        base = replay_report()
        for mutation in (
            lambda value: value.pop("acceptedRate"),
            lambda value: value.update(schemaVersion=True),
            lambda value: value.update(wrongAcceptedCount=1),
        ):
            invalid = copy.deepcopy(base)
            mutation(invalid)
            with self.assertRaises(ValueError):
                _normalize_replay_evidence(invalid)

    def test_gate_report_publication_is_immutable(self):
        report = adjudicate_replay(
            policy(), replay_report(), freeze(), policy_sha256="a" * 64,
            evidence_sha256="b" * 64)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "gate.json"
            publish_gate_report(path, report)
            original = path.read_bytes()
            publish_gate_report(path, report)
            self.assertEqual(path.read_bytes(), original)
            changed = adjudicate_replay(
                policy(True), replay_report(), freeze(), policy_sha256="a" * 64,
                evidence_sha256="b" * 64)
            with self.assertRaises(FileExistsError):
                publish_gate_report(path, changed)
            self.assertEqual(path.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
