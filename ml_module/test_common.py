"""Unit tests for the parts of common.py that must not silently break.  Run: python -m unittest ml_module/test_common.py"""
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C


class TestAnnualHeat(unittest.TestCase):
    def test_arithmetic(self):
        # 1000 GPUs x 100 W x 24 h x 365 d = 876 MWh
        self.assertAlmostEqual(C.annual_heat_mwh(1000, 100, 24), 876.0)

    def test_range_ordering_and_shrinkage(self):
        r = C.fleet_heat_range(400, 60.0, 100.0, 140.0, 12)
        lo, mid, hi = r["shared_error_mwh"]
        ilo, imid, ihi = r["independent_gpus_mwh"]
        self.assertTrue(lo < mid < hi and ilo < imid < ihi)
        self.assertAlmostEqual(mid, imid)
        self.assertGreater(ilo, lo)  # independent range is narrower
        self.assertLess(ihi, hi)


class TestInterval(unittest.TestCase):
    def test_coverage_close_to_nominal(self):
        rng = np.random.default_rng(0)
        pred = rng.uniform(30, 200, 20000)
        y = pred + rng.normal(0, 1 + pred / 20)  # noise grows with power
        cal = C.fit_interval(pred[:10000], y[:10000])
        lo, hi = C.apply_interval(cal, pred[10000:])
        self.assertAlmostEqual(np.mean((y[10000:] >= lo) & (y[10000:] <= hi)), 1 - C.ALPHA, delta=0.02)
        self.assertTrue((lo >= 0).all() and (hi >= lo).all())


class TestPredictPower(unittest.TestCase):
    def test_clipped_to_physical_range(self):
        class Wild:  # a model that extrapolates to impossible watts
            def predict(self, X):
                return np.array([-50.0, 100.0, 900.0])

        cal = {"edges": [-100.0, 1000.0], "lo": [-20.0], "hi": [20.0]}
        lo, mid, hi = C.predict_power(Wild(), cal, np.zeros((3, 2)), (25.0, 240.0))
        self.assertTrue(((mid >= 25) & (mid <= 240) & (lo >= 25) & (hi <= 240) & (lo <= mid) & (mid <= hi)).all())


class TestSecurity(unittest.TestCase):
    def test_path_traversal_rejected(self):
        for bad in ("../ml_module/common.py", r"..\ml_module\common.py", "/etc/passwd", "missing.csv"):
            with self.assertRaises((FileNotFoundError, ValueError)):
                C._safe_data_path(bad)

    def test_tampered_model_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            old = C.ARTIFACTS
            C.ARTIFACTS = Path(tmp)
            try:
                C.save_model("m_test", {"coef": 1}, {"edges": [0, 1], "lo": [0], "hi": [0]})
                self.assertEqual(C.load_model("m_test")[0], {"coef": 1})
                (Path(tmp) / "m_test" / "model.joblib").write_bytes(b"tampered")
                with self.assertRaises(RuntimeError):
                    C.load_model("m_test")
            finally:
                C.ARTIFACTS = old

    def test_model_name_must_be_identifier(self):
        with self.assertRaises(ValueError):
            C._model_dir("../evil")


if __name__ == "__main__":
    unittest.main()
