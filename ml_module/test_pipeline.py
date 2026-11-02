"""Tests for the data-centre -> annual-heat pipeline and its API.  Run: python -m unittest ml_module/test_pipeline.py

Needs the trained models in artifacts/ (python ml_module/run_all.py).
"""
import math
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pipeline import MAX_GPUS, DataCenter, HeatPipeline, InputError  # noqa: E402

PIPE = HeatPipeline.load()
BASE = dict(n_gpus=500, sm_util_pct=60, mem_util_pct=30, hours_per_day=12, days_per_year=365)


class DataCenterValidation(unittest.TestCase):
    def test_accepts_defaults_for_hours_and_days(self):
        dc = DataCenter(n_gpus=1, sm_util_pct=0, mem_util_pct=100)
        self.assertEqual((dc.hours_per_day, dc.days_per_year), (24.0, 365))
        self.assertEqual(dc.operating_hours_per_year, 24 * 365)

    def test_rejects_bad_values(self):
        bad = [
            dict(n_gpus=0), dict(n_gpus=MAX_GPUS + 1), dict(n_gpus=2.5), dict(n_gpus="5"), dict(n_gpus=True),
            dict(sm_util_pct=-1), dict(sm_util_pct=100.1), dict(mem_util_pct=float("nan")),
            dict(mem_util_pct=float("inf")), dict(hours_per_day=0), dict(hours_per_day=24.5),
            dict(days_per_year=0), dict(days_per_year=367), dict(days_per_year=10.5),
        ]
        for patch in bad:
            with self.subTest(patch), self.assertRaises(InputError):
                DataCenter(**{**BASE, **patch})


class Estimate(unittest.TestCase):
    def setUp(self):
        self.r = PIPE.estimate(DataCenter(**BASE))

    def test_uses_all_five_models(self):
        self.assertEqual(len(self.r["models_used"]), 5)
        self.assertEqual(len(self.r["per_gpu"]["per_model_w"]), 5)

    def test_ensemble_is_the_mean_of_the_models(self):
        g = self.r["per_gpu"]
        self.assertAlmostEqual(g["expected_w"], sum(g["per_model_w"].values()) / 5, places=9)

    def test_heat_arithmetic(self):
        w = self.r["per_gpu"]["expected_w"]
        self.assertAlmostEqual(self.r["heat_load_mw"]["expected"], 500 * w / 1e6, places=12)
        self.assertAlmostEqual(self.r["annual_heat_mwh"]["expected"], 500 * w * 12 * 365 / 1e6, places=9)

    def test_ranges_are_ordered_and_bracket_expected(self):
        a = self.r["annual_heat_mwh"]
        self.assertLess(a["low"], a["expected"])
        self.assertLess(a["expected"], a["high"])
        self.assertLessEqual(a["low"], a["independent_gpu_low"])
        self.assertLessEqual(a["independent_gpu_high"], a["high"])

    def test_power_is_within_physical_limits(self):
        floor, cap = PIPE.bounds
        g = self.r["per_gpu"]
        for k in ("low_w", "expected_w", "high_w"):
            self.assertTrue(floor <= g[k] <= cap)

    def test_scales_linearly_with_gpus_hours_and_days(self):
        base = self.r["annual_heat_mwh"]["expected"]
        ten = PIPE.estimate(DataCenter(**{**BASE, "n_gpus": 5000}))["annual_heat_mwh"]["expected"]
        self.assertAlmostEqual(ten / base, 10, places=9)
        half_days = PIPE.estimate(DataCenter(**{**BASE, "days_per_year": 365 // 5 * 5 // 2}))
        self.assertTrue(math.isclose(half_days["annual_heat_mwh"]["expected"] / base, (365 // 5 * 5 // 2) / 365))
        full_day = PIPE.estimate(DataCenter(**{**BASE, "hours_per_day": 24}))["annual_heat_mwh"]["expected"]
        self.assertAlmostEqual(full_day / base, 2, places=9)

    def test_busier_gpus_make_more_heat(self):
        idle = PIPE.estimate(DataCenter(**{**BASE, "sm_util_pct": 5, "mem_util_pct": 2}))
        busy = PIPE.estimate(DataCenter(**{**BASE, "sm_util_pct": 95, "mem_util_pct": 60}))
        self.assertLess(idle["annual_heat_mwh"]["expected"], busy["annual_heat_mwh"]["expected"])

    def test_extreme_inputs_stay_finite_and_nonnegative(self):
        for sm, mem in [(0, 0), (100, 0), (0, 100), (100, 100)]:
            r = PIPE.estimate(DataCenter(n_gpus=10, sm_util_pct=sm, mem_util_pct=mem))
            self.assertTrue(math.isfinite(r["annual_heat_mwh"]["expected"]))
            self.assertGreater(r["annual_heat_mwh"]["low"], 0)


class Bundle(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = Path(self.dir.name) / "ensemble.pkl"
        PIPE.save_bundle(self.path)

    def tearDown(self):
        self.dir.cleanup()

    def test_round_trip_gives_identical_answers(self):
        loaded = HeatPipeline.load_bundle(self.path)
        self.assertEqual(list(loaded.models), list(PIPE.models))
        for sm, mem in [(0, 0), (60, 30), (100, 100)]:
            dc = DataCenter(n_gpus=100, sm_util_pct=sm, mem_util_pct=mem)
            self.assertEqual(loaded.estimate(dc)["annual_heat_mwh"], PIPE.estimate(dc)["annual_heat_mwh"])

    def test_refuses_a_tampered_file(self):
        with self.path.open("ab") as f:
            f.write(b"x")
        with self.assertRaises(RuntimeError):
            HeatPipeline.load_bundle(self.path)

    def test_refuses_a_file_without_a_checksum(self):
        self.path.with_suffix(".pkl.sha256").unlink()
        with self.assertRaises(FileNotFoundError):
            HeatPipeline.load_bundle(self.path)


class Api(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient

        import api
        cls.client = TestClient(api.app)
        cls.client.__enter__()  # runs lifespan: loads the models

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)

    def test_health(self):
        r = self.client.get("/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()["models"]), 5)

    def test_annual_heat_matches_pipeline(self):
        r = self.client.post("/api/v1/annual-heat", json=BASE)
        self.assertEqual(r.status_code, 200)
        want = PIPE.estimate(DataCenter(**BASE))["annual_heat_mwh"]["expected"]
        self.assertAlmostEqual(r.json()["annual_heat_mwh"]["expected"], want, places=9)

    def test_defaults_apply(self):
        r = self.client.post("/api/v1/annual-heat", json={"n_gpus": 8, "sm_util_pct": 50, "mem_util_pct": 20})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["input"]["hours_per_day"], 24.0)

    def test_bad_input_is_422_and_unknown_fields_rejected(self):
        for body in ({**BASE, "n_gpus": 0}, {**BASE, "sm_util_pct": 101}, {**BASE, "extra": 1}, {"n_gpus": 5},
                     {**BASE, "sm_util_pct": "abc"}):
            with self.subTest(body):
                self.assertEqual(self.client.post("/api/v1/annual-heat", json=body).status_code, 422)

    def test_oversized_body_rejected(self):
        r = self.client.post("/api/v1/annual-heat", content=b"x" * 5000, headers={"content-type": "application/json"})
        self.assertEqual(r.status_code, 413)

    def test_cors_only_for_local_web_app(self):
        ok = self.client.options("/api/v1/annual-heat", headers={
            "Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
        self.assertEqual(ok.headers.get("access-control-allow-origin"), "http://localhost:5173")
        bad = self.client.options("/api/v1/annual-heat", headers={
            "Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
        self.assertIsNone(bad.headers.get("access-control-allow-origin"))


if __name__ == "__main__":
    unittest.main()
