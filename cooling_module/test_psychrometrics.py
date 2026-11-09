"""Tests for the moist-air formulas.  Run from the repo root: python -m unittest cooling_module.test_psychrometrics

Reference values are from the ASHRAE Handbook of Fundamentals (SI), chapter 1, at 101.325 kPa.
"""
import unittest

import numpy as np

from cooling_module import psychrometrics as P

P0 = 101.325


class SaturationPressure(unittest.TestCase):
    def test_matches_ashrae_table(self):
        for t, expected in [(0, 0.6112), (20, 2.3392), (30, 4.2467), (40, 7.3849), (100, 101.42)]:
            with self.subTest(t=t):
                self.assertAlmostEqual(float(P.saturation_pressure_kpa(t)), expected, delta=0.002 * max(1, expected / 10))

    def test_over_ice_below_freezing(self):
        self.assertAlmostEqual(float(P.saturation_pressure_kpa(-10)), 0.2599, delta=0.001)

    def test_increases_with_temperature(self):
        t = np.linspace(-30, 50, 200)
        self.assertTrue(np.all(np.diff(P.saturation_pressure_kpa(t)) > 0))

    def test_is_continuous_at_freezing(self):
        self.assertAlmostEqual(float(P.saturation_pressure_kpa(-1e-6)), float(P.saturation_pressure_kpa(1e-6)), delta=1e-4)


class HumidityAndEnthalpy(unittest.TestCase):
    def test_saturated_humidity_ratio_at_20c(self):
        w = float(P.humidity_ratio_saturated(20, P0))
        self.assertAlmostEqual(w, 0.014695, delta=0.000005)  # ideal-gas formula, ASHRAE eq. 23
        # ASHRAE's table (0.014758) includes a 0.4 % real-gas enhancement factor that these formulas leave out.
        self.assertAlmostEqual(w, 0.014758, delta=0.0001)

    def test_humidity_ratio_scales_with_relative_humidity(self):
        w50 = float(P.humidity_ratio(20, 50, P0))
        w100 = float(P.humidity_ratio(20, 100, P0))
        self.assertAlmostEqual(w100, float(P.humidity_ratio_saturated(20, P0)), places=9)
        self.assertAlmostEqual(w50 / w100, 0.5, delta=0.01)
        self.assertEqual(float(P.humidity_ratio(20, 0, P0)), 0.0)

    def test_enthalpy_of_saturated_air_at_20c(self):
        w = float(P.humidity_ratio_saturated(20, P0))
        self.assertAlmostEqual(float(P.enthalpy_kj_per_kg(20, w)), 57.54, delta=0.15)

    def test_dry_air_enthalpy(self):
        self.assertAlmostEqual(float(P.enthalpy_kj_per_kg(25, 0.0)), 1.006 * 25, places=9)


class WetBulb(unittest.TestCase):
    def test_known_points(self):
        for t, rh, expected in [(20, 50, 13.8), (30, 50, 22.0), (25, 60, 19.5)]:
            with self.subTest(t=t, rh=rh):
                self.assertAlmostEqual(float(P.wet_bulb_c(t, rh, P0)), expected, delta=0.25)

    def test_equals_dry_bulb_when_saturated(self):
        for t in (-10, 0, 15, 35):
            with self.subTest(t=t):
                self.assertAlmostEqual(float(P.wet_bulb_c(t, 100, P0)), t, delta=0.01)

    def test_never_exceeds_dry_bulb_and_rises_with_humidity(self):
        rh = np.linspace(5, 100, 50)
        wb = P.wet_bulb_c(np.full_like(rh, 28.0), rh, P0)
        self.assertTrue(np.all(wb <= 28.0 + 1e-9))
        self.assertTrue(np.all(np.diff(wb) > 0))

    def test_works_below_freezing_and_on_arrays(self):
        wb = P.wet_bulb_c(np.array([-8.0, 0.0, 33.0]), np.array([60.0, 70.0, 45.0]), np.array([100.5, 100.5, 100.0]))
        self.assertEqual(wb.shape, (3,))
        self.assertTrue(np.all(np.isfinite(wb)))
        self.assertTrue(wb[0] < -8.0 < wb[0] + 5)


class LatentHeat(unittest.TestCase):
    def test_hfg_formula_from_the_equation_document(self):
        self.assertAlmostEqual(float(P.hfg_kj_per_kg(0)), 2501.0)
        self.assertAlmostEqual(float(P.hfg_kj_per_kg(30)), 2430.17, places=2)

    def test_hfg_covers_the_documented_range(self):
        # The document quotes 2,437 to 2,495 kJ/kg for tower temperatures of about 3 to 27 degC.
        self.assertAlmostEqual(float(P.hfg_kj_per_kg(24.4)), 2443.4, delta=1)
        self.assertTrue(2430 < float(P.hfg_kj_per_kg(30)) < 2437)


class EvaporationFraction(unittest.TestCase):
    def test_winter_value_matches_the_low_end_of_the_documented_band(self):
        # January in Ashburn: the document quotes 0.61 to 0.85 across the year; the cold end is about 0.6.
        f, clamped = P.evaporation_fraction(t_ao_c=4.2, t_db_c=0.5, rh_pct=65.0, p_kpa=100.2)
        self.assertTrue(0.55 < float(f) < 0.75, float(f))
        self.assertFalse(bool(clamped))

    def test_hot_weather_leaves_almost_all_heat_to_evaporation(self):
        # Outdoor air (30 degC) is warmer than the tower water (28.7 degC): no sensible heat goes to the air.
        f, clamped = P.evaporation_fraction(t_ao_c=28.7, t_db_c=30.0, rh_pct=50.0, p_kpa=100.2)
        self.assertTrue(0.9 < float(f) <= 1.0, float(f))

    def test_rises_as_the_weather_warms(self):
        t_db = np.array([-5.0, 5.0, 15.0, 25.0])
        t_wb = P.wet_bulb_c(t_db, np.full(4, 65.0), 100.2)
        f, _ = P.evaporation_fraction(t_wb + 6.7, t_db, np.full(4, 65.0), 100.2)
        self.assertTrue(np.all(np.diff(f) > 0), f)

    def test_is_always_between_zero_and_one(self):
        rng = np.random.default_rng(0)
        t_db = rng.uniform(-20, 40, 2000)
        rh = rng.uniform(5, 100, 2000)
        t_ao = rng.uniform(-5, 45, 2000)
        f, _ = P.evaporation_fraction(t_ao, t_db, rh, 100.2)
        self.assertTrue(np.all((f >= 0) & (f <= 1)))

    def test_clamps_when_exit_air_carries_less_heat_than_the_inlet(self):
        # Water at 0 degC cannot warm 30 degC / 60 % air: the formula's denominator is negative.
        f, clamped = P.evaporation_fraction(t_ao_c=0.0, t_db_c=30.0, rh_pct=60.0, p_kpa=100.2)
        self.assertEqual(float(f), 1.0)
        self.assertTrue(bool(clamped))

    def test_accepts_arrays_and_returns_matching_shapes(self):
        f, clamped = P.evaporation_fraction(np.array([25.0, 30.0]), np.array([30.0, 35.0]), np.array([50.0, 40.0]), 100.2)
        self.assertEqual(f.shape, (2,))
        self.assertEqual(clamped.shape, (2,))


if __name__ == "__main__":
    unittest.main()
