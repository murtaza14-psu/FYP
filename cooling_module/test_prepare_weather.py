"""Tests for the EPW -> hourly CSV converter.  Run from the repo root: python -m unittest cooling_module.test_prepare_weather"""
import unittest

import numpy as np

from cooling_module import prepare_weather as W

DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
LOCATION = "LOCATION,Test-Station,VA,USA,SRC-TMYx,724030,38.97670,-77.48580,-5.0,88.4"


def make_epw(*, dry=15.0, dew=8.0, rh=60, pressure=100500, drop_last=False, header=LOCATION, mutate=None) -> str:
    lines = [header] + [f"HEADER {i}" for i in range(2, 9)]
    rows = []
    for m, n in enumerate(DAYS, start=1):
        for d in range(1, n + 1):
            for h in range(1, 25):
                rows.append([2020, m, d, h, 0, "FLAGS", dry, dew, rh, pressure, 0, 0, 300])
    if mutate:
        mutate(rows)
    if drop_last:
        rows = rows[:-1]
    lines += [",".join(str(v) for v in r) for r in rows]
    return "\n".join(lines) + "\n"


class ParseEpw(unittest.TestCase):
    def test_reads_a_full_year(self):
        site, cols = W.parse_epw(make_epw())
        self.assertEqual(len(cols["month"]), 8760)
        self.assertEqual((cols["month"][0], cols["day"][0], cols["hour"][0]), (1, 1, 1))
        self.assertEqual((cols["month"][-1], cols["day"][-1], cols["hour"][-1]), (12, 31, 24))

    def test_converts_pressure_from_pascals_to_kilopascals(self):
        _, cols = W.parse_epw(make_epw(pressure=100500))
        self.assertTrue(np.allclose(cols["pressure_kpa"], 100.5))

    def test_reads_the_site_line(self):
        site, _ = W.parse_epw(make_epw())
        self.assertEqual(site["station_name"], "Test-Station")
        self.assertEqual(site["wmo_id"], "724030")
        self.assertAlmostEqual(site["latitude"], 38.9767)
        self.assertAlmostEqual(site["longitude"], -77.4858)
        self.assertAlmostEqual(site["elevation_m"], 88.4)

    def test_rejects_a_partial_year(self):
        with self.assertRaises(ValueError):
            W.parse_epw(make_epw(drop_last=True))

    def test_rejects_missing_value_codes(self):
        for kwargs in (dict(dry=99.9), dict(dew=99.9), dict(rh=999), dict(pressure=999999)):
            with self.subTest(kwargs), self.assertRaises(ValueError):
                W.parse_epw(make_epw(**kwargs))

    def test_rejects_values_outside_physical_ranges(self):
        for kwargs in (dict(dry=60.0), dict(dry=-50.0), dict(rh=101), dict(rh=-1), dict(pressure=80000), dict(pressure=110000)):
            with self.subTest(kwargs), self.assertRaises(ValueError):
                W.parse_epw(make_epw(**kwargs))

    def test_rejects_a_year_that_is_out_of_order(self):
        def swap(rows):
            rows[100], rows[101] = rows[101], rows[100]

        with self.assertRaises(ValueError):
            W.parse_epw(make_epw(mutate=swap))

    def test_rejects_a_malformed_location_line(self):
        with self.assertRaises(ValueError):
            W.parse_epw(make_epw(header="LOCATION,only,three"))


class BuildDataset(unittest.TestCase):
    def setUp(self):
        _, cols = W.parse_epw(make_epw(dry=20.0, rh=50, dew=9.3))
        self.cols = W.add_wet_bulb(cols)

    def test_wet_bulb_is_added_and_physical(self):
        wb = self.cols["wet_bulb_c"]
        self.assertTrue(np.all(wb <= self.cols["dry_bulb_c"] + 1e-9))
        self.assertAlmostEqual(float(wb[0]), 13.8, delta=0.3)

    def test_csv_has_a_header_and_one_row_per_hour(self):
        text = W.to_csv(self.cols)
        lines = text.strip().splitlines()
        self.assertEqual(lines[0], "month,day,hour,dry_bulb_c,dew_point_c,rel_humidity_pct,pressure_kpa,wet_bulb_c")
        self.assertEqual(len(lines), 8761)
        self.assertEqual(len(lines[1].split(",")), 8)

    def test_monthly_summary_has_twelve_months(self):
        summary = W.monthly_summary(self.cols)
        self.assertEqual([m["month"] for m in summary], list(range(1, 13)))
        self.assertAlmostEqual(summary[0]["mean_dry_bulb_c"], 20.0, places=2)
        self.assertEqual(summary[0]["hours"], 31 * 24)


if __name__ == "__main__":
    unittest.main()
