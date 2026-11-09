"""Tests for the Ashburn weather loader.  Run from the repo root: python -m unittest cooling_module.test_weather"""
import json
import shutil
import tempfile
import unittest
from pathlib import Path

import numpy as np

from cooling_module import weather as W


class RealData(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.w = W.load_ashburn()

    def test_is_a_full_hourly_year(self):
        self.assertEqual(self.w.n_hours, 8760)
        for name in ("month", "day", "hour", "dry_bulb_c", "dew_point_c", "rel_humidity_pct", "pressure_kpa", "wet_bulb_c"):
            self.assertEqual(getattr(self.w, name).shape, (8760,), name)

    def test_is_in_physical_ranges(self):
        w = self.w
        self.assertTrue(np.all(w.wet_bulb_c <= w.dry_bulb_c + 0.01))
        self.assertTrue(np.all((w.rel_humidity_pct >= 0) & (w.rel_humidity_pct <= 100)))
        self.assertTrue(np.all((w.pressure_kpa > 95) & (w.pressure_kpa < 104)))
        self.assertTrue(-30 < w.dry_bulb_c.min() and w.dry_bulb_c.max() < 45)

    def test_matches_the_climate_of_northern_virginia(self):
        w = self.w
        mean = lambda m: float(w.dry_bulb_c[w.month == m].mean())
        self.assertTrue(11.0 < float(w.dry_bulb_c.mean()) < 14.5)   # annual mean about 12-13 degC
        self.assertTrue(-2.0 < mean(1) < 3.5)                       # January about 1-2 degC
        self.assertTrue(23.5 < mean(7) < 27.5)                      # July about 25-26 degC

    def test_summers_are_humid_enough_to_need_the_chiller(self):
        w = self.w
        self.assertTrue(float(w.wet_bulb_c[w.month == 7].mean()) > 12.78)   # chiller fraction 1 above 12.8 degC wet-bulb
        self.assertTrue(float(w.wet_bulb_c[w.month == 1].mean()) < 7.22)    # free cooling below 7.2 degC wet-bulb

    def test_metadata(self):
        self.assertEqual(self.w.site["site_name"], "Ashburn, Virginia, USA")
        self.assertIn("724030", self.w.site["weather_station"])
        self.assertEqual(len(self.w.site["monthly"]), 12)

    def test_arrays_are_read_only(self):
        with self.assertRaises(ValueError):
            self.w.dry_bulb_c[0] = 99.0

    def test_month_index_and_hours_per_month(self):
        self.assertEqual(int(self.w.month_index.min()), 0)
        self.assertEqual(int(self.w.month_index.max()), 11)
        self.assertEqual(list(self.w.hours_per_month), [744, 672, 744, 720, 744, 720, 744, 744, 720, 744, 720, 744])


class SafetyChecks(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        for name in (W.CSV_NAME, W.JSON_NAME):
            shutil.copy(W.DATA_DIR / name, self.tmp / name)

    def _rewrite_csv(self, fn, *, fix_hash=True):
        path = self.tmp / W.CSV_NAME
        text = fn(path.read_text())
        path.write_text(text)
        if fix_hash:
            meta = json.loads((self.tmp / W.JSON_NAME).read_text())
            meta["csv_sha256"] = W.hashlib.sha256(path.read_bytes()).hexdigest()
            (self.tmp / W.JSON_NAME).write_text(json.dumps(meta))

    def test_loads_an_untouched_copy(self):
        self.assertEqual(W.load_ashburn(self.tmp).n_hours, 8760)

    def test_detects_a_changed_csv(self):
        self._rewrite_csv(lambda t: t.replace("2.30", "9.99", 1), fix_hash=False)
        with self.assertRaisesRegex(RuntimeError, "SHA-256"):
            W.load_ashburn(self.tmp)

    def test_missing_files(self):
        (self.tmp / W.CSV_NAME).unlink()
        with self.assertRaises(FileNotFoundError):
            W.load_ashburn(self.tmp)

    def test_rejects_an_oversized_file(self):
        (self.tmp / W.CSV_NAME).write_bytes(b"x" * (W.MAX_FILE_BYTES + 1))
        with self.assertRaisesRegex(ValueError, "size"):
            W.load_ashburn(self.tmp)

    def test_rejects_wrong_columns(self):
        self._rewrite_csv(lambda t: t.replace("dry_bulb_c", "temperature", 1))
        with self.assertRaisesRegex(ValueError, "columns"):
            W.load_ashburn(self.tmp)

    def test_rejects_a_short_year(self):
        self._rewrite_csv(lambda t: "\n".join(t.splitlines()[:-1]) + "\n")
        with self.assertRaisesRegex(ValueError, "8760"):
            W.load_ashburn(self.tmp)

    def test_rejects_wet_bulb_above_dry_bulb(self):
        def bump(text):
            lines = text.splitlines()
            f = lines[1].split(",")
            f[7] = "50.00"
            lines[1] = ",".join(f)
            return "\n".join(lines) + "\n"

        self._rewrite_csv(bump)
        with self.assertRaises(ValueError):
            W.load_ashburn(self.tmp)

    def test_rejects_non_numbers(self):
        self._rewrite_csv(lambda t: t.replace("63.0", "nan", 1))
        with self.assertRaises(ValueError):
            W.load_ashburn(self.tmp)


if __name__ == "__main__":
    unittest.main()
