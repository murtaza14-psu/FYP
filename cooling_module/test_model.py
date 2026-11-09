"""Tests for the Module 2 entry point.  Run from the repo root: python -m unittest cooling_module.test_model"""
import json
import unittest

from cooling_module import model as M

HEAT = {"low": 3_000_000.0, "expected": 3_300_000.0, "high": 3_700_000.0}  # annual kWh of GPU heat


class Shape(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = M.estimate_cooling(HEAT)
        cls.by_id = {t["id"]: t for t in cls.out["techniques"]}

    def test_two_techniques_in_a_fixed_order(self):
        self.assertEqual([t["id"] for t in self.out["techniques"]], ["air", "direct-to-chip"])
        self.assertNotIn("immersion", self.by_id)

    def test_every_technique_has_the_documented_fields(self):
        for t in self.out["techniques"]:
            for key in ("id", "name", "electricity_kwh", "water_litres", "water_breakdown_litres",
                        "electricity_breakdown_kwh", "monthly", "kwh_per_kwh_heat", "litres_per_kwh_heat",
                        "chiller_hours", "notes"):
                self.assertIn(key, t, (t["id"], key))
            self.assertEqual(set(t["electricity_kwh"]), {"low", "typical", "high"})
            self.assertEqual(set(t["water_litres"]), {"low", "typical", "high"})
            self.assertEqual(len(t["monthly"]), 12)

    def test_site_heat_and_assumptions_are_included(self):
        self.assertEqual(self.out["site"]["name"], "Ashburn, Virginia, USA")
        self.assertEqual(len(self.out["site"]["monthly_climate"]), 12)
        self.assertEqual(self.out["heat_annual_kwh"], HEAT)
        self.assertEqual(self.out["assumptions"]["cycles_of_concentration"], 4.0)
        self.assertEqual(self.out["assumptions"]["heat_basis"], "GPU heat only")
        self.assertEqual(set(self.out["parameters"]), {"air", "direct_to_chip"})

    def test_result_is_plain_json(self):
        self.assertEqual(json.loads(json.dumps(self.out))["techniques"][0]["id"], "air")


class Ranges(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = M.estimate_cooling(HEAT)

    def test_low_is_below_typical_is_below_high(self):
        for t in self.out["techniques"]:
            for k in ("electricity_kwh", "water_litres"):
                with self.subTest(f'{t["id"]} {k}'):
                    self.assertLess(t[k]["low"], t[k]["typical"])
                    self.assertLess(t[k]["typical"], t[k]["high"])

    def test_direct_to_chip_uses_less_of_both_resources(self):
        air, d2c = self.out["techniques"]
        self.assertLess(d2c["electricity_kwh"]["typical"], air["electricity_kwh"]["typical"])
        self.assertLess(d2c["water_litres"]["typical"], air["water_litres"]["typical"])
        self.assertLess(d2c["electricity_kwh"]["high"], air["electricity_kwh"]["low"] * 1.5)


class Consistency(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = M.estimate_cooling(HEAT)

    def test_monthly_values_add_up_to_the_typical_annual_totals(self):
        for t in self.out["techniques"]:
            with self.subTest(t["id"]):
                self.assertAlmostEqual(sum(m["electricity_kwh"] for m in t["monthly"]), t["electricity_kwh"]["typical"], delta=1e-6 * t["electricity_kwh"]["typical"])
                self.assertAlmostEqual(sum(m["water_litres"] for m in t["monthly"]), t["water_litres"]["typical"], delta=1e-6 * t["water_litres"]["typical"])
                self.assertEqual([m["month"] for m in t["monthly"]], list(range(1, 13)))

    def test_breakdowns_add_up_to_the_totals(self):
        for t in self.out["techniques"]:
            with self.subTest(t["id"]):
                self.assertAlmostEqual(sum(t["water_breakdown_litres"].values()), t["water_litres"]["typical"], delta=1e-6 * t["water_litres"]["typical"])
                self.assertAlmostEqual(sum(t["electricity_breakdown_kwh"].values()), t["electricity_kwh"]["typical"], delta=1e-6 * t["electricity_kwh"]["typical"])
                self.assertEqual(set(t["water_breakdown_litres"]), {"evaporation", "drift", "blowdown"})

    def test_per_kwh_of_heat_values(self):
        for t in self.out["techniques"]:
            with self.subTest(t["id"]):
                self.assertAlmostEqual(t["kwh_per_kwh_heat"] * HEAT["expected"], t["electricity_kwh"]["typical"], delta=1e-6 * t["electricity_kwh"]["typical"])
                self.assertAlmostEqual(t["litres_per_kwh_heat"] * HEAT["expected"], t["water_litres"]["typical"], delta=1e-6 * t["water_litres"]["typical"])

    def test_results_are_proportional_to_the_heat(self):
        doubled = M.estimate_cooling({k: 2 * v for k, v in HEAT.items()})
        for a, b in zip(self.out["techniques"], doubled["techniques"]):
            self.assertAlmostEqual(b["electricity_kwh"]["typical"], 2 * a["electricity_kwh"]["typical"], delta=1e-6 * b["electricity_kwh"]["typical"])
            self.assertAlmostEqual(b["water_litres"]["high"], 2 * a["water_litres"]["high"], delta=1e-6 * b["water_litres"]["high"])

    def test_direct_to_chip_reports_where_its_heat_goes(self):
        d2c = self.out["techniques"][1]
        self.assertAlmostEqual(sum(d2c["heat_split"].values()), 1.0, places=6)
        self.assertEqual(set(d2c["heat_split"]), {"dry_cooler", "tower", "chiller"})
        self.assertGreater(d2c["heat_split"]["dry_cooler"], 0.5)
        self.assertGreater(d2c["hours_without_liquid_water"], 1000)

    def test_air_chiller_hours_are_part_of_the_year(self):
        self.assertTrue(3000 < self.out["techniques"][0]["chiller_hours"] < 8760)

    def test_notes_mention_the_limited_evaporation_hours(self):
        self.assertTrue(any("evaporation" in n.lower() for n in self.out["techniques"][0]["notes"]))


class Edges(unittest.TestCase):
    def test_zero_heat_gives_zero_results_and_no_division_error(self):
        out = M.estimate_cooling({"low": 0.0, "expected": 0.0, "high": 0.0})
        for t in out["techniques"]:
            self.assertEqual(t["electricity_kwh"]["typical"], 0.0)
            self.assertEqual(t["water_litres"]["high"], 0.0)
            self.assertEqual(t["kwh_per_kwh_heat"], 0.0)

    def test_rejects_bad_heat(self):
        bad = [
            {"low": -1.0, "expected": 1.0, "high": 2.0},
            {"low": 1.0, "expected": float("nan"), "high": 2.0},
            {"low": 1.0, "expected": 2.0, "high": float("inf")},
            {"low": 3.0, "expected": 2.0, "high": 4.0},
            {"low": 1.0, "expected": 5.0, "high": 4.0},
            {"low": 1.0, "expected": 2.0},
            {"low": "1", "expected": 2.0, "high": 3.0},
            {"low": True, "expected": 2.0, "high": 3.0},
            [1.0, 2.0, 3.0],
        ]
        for heat in bad:
            with self.subTest(heat), self.assertRaises(ValueError):
                M.estimate_cooling(heat)


if __name__ == "__main__":
    unittest.main()
