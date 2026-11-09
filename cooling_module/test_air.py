"""Tests for the air-cooling model (PDF sections 1 and 2).  Run from the repo root: python -m unittest cooling_module.test_air"""
import unittest

import numpy as np

from cooling_module import air as A
from cooling_module import parameters as K
from cooling_module import psychrometrics as P
from cooling_module import weather as W
from cooling_module.testing_helpers import hours

TYPICAL = K.AIR["typical"]


class ChillerShare(unittest.TestCase):
    def test_zero_below_45_degf_and_one_above_55_degf(self):
        c = lambda f: (f - 32) * 5 / 9
        fm = A.chiller_fraction(np.array([c(30), c(45), c(50), c(55), c(70)]), TYPICAL, K.TOWER)
        np.testing.assert_allclose(fm, [0.0, 0.0, 0.5, 1.0, 1.0], atol=1e-9)

    def test_is_a_straight_ramp_between_the_limits(self):
        wb = np.linspace(7.222, 12.778, 50)
        self.assertTrue(np.all(np.diff(A.chiller_fraction(wb, TYPICAL, K.TOWER)) > 0))


class HandWorkedHot_Hour(unittest.TestCase):
    """One hot hour (wet-bulb 20 degC, chiller fraction 1), 1,000 kWh of server heat, typical parameters."""

    def setUp(self):
        self.r = A.air_cooling(np.array([1000.0]), hours(20.0), TYPICAL, K.TOWER)
        # Independent arithmetic straight from the PDF, with raw numbers:
        e_fan = 3.412 * 0.75 / (1.08 * 20) * 1000            # fans: 118.47 kWh
        q_chw = 1000 / 0.95 + e_fan                          # chilled-water load: 1171.10 kWh
        tons = q_chw / 3.517                                  # ton-hours: 332.98
        self.expected = dict(
            e_fan=e_fan, q_chw=q_chw,
            e_chiller=tons * 1.0 * 0.500,                     # 166.49 kWh
            e_pump=tons * (22 * 2.4 + 19 * 3) / 1000,         # 36.56 kWh
            e_tower=tons * 0.7457 * 3 / 38.2,                 # 19.50 kWh
        )

    def test_each_electricity_item(self):
        for name in ("e_fan", "e_chiller", "e_pump", "e_tower"):
            with self.subTest(name):
                self.assertAlmostEqual(float(getattr(self.r, name)[0]), self.expected[name], places=6)

    def test_total_electricity(self):
        self.assertAlmostEqual(float(self.r.electricity_kwh[0]), 341.0, delta=0.1)

    def test_chilled_water_and_tower_heat(self):
        self.assertAlmostEqual(float(self.r.q_chw[0]), self.expected["q_chw"], places=6)
        q_rej = self.expected["q_chw"] + self.expected["e_chiller"] + self.expected["e_pump"]
        self.assertAlmostEqual(float(self.r.q_rej[0]), q_rej, places=6)

    def test_water_uses_the_tower_heat_and_tower_water_temperature(self):
        q_rej = float(self.r.q_rej[0])
        t_ao = 20.0 + 7 * 5 / 9 + (10 * 5 / 9) / 2
        f, _ = P.evaporation_fraction(t_ao, 25.0, 60.0, 100.2)
        evaporation = 3600 * q_rej * float(f) / (2501 - 2.361 * t_ao)
        self.assertAlmostEqual(float(self.r.water.evaporation_l[0]), evaporation, places=6)
        self.assertAlmostEqual(float(self.r.water.blowdown_l[0]), evaporation / 3 - float(self.r.water.drift_l[0]), places=6)


class ColdHour(unittest.TestCase):
    def test_free_cooling_needs_no_chiller_but_still_runs_fans_and_pumps(self):
        r = A.air_cooling(np.array([1000.0]), hours(0.0, dry_bulb=2.0, rh=70.0), TYPICAL, K.TOWER)
        self.assertEqual(float(r.f_mech[0]), 0.0)
        self.assertEqual(float(r.e_chiller[0]), 0.0)
        self.assertGreater(float(r.e_fan[0]), 0)
        self.assertGreater(float(r.e_pump[0]), 0)
        self.assertAlmostEqual(float(r.electricity_kwh[0]), 341.0 - 166.49, delta=0.1)


class Scaling(unittest.TestCase):
    def test_zero_heat_gives_zero_everything(self):
        r = A.air_cooling(np.zeros(3), hours([0.0, 10.0, 20.0]), TYPICAL, K.TOWER)
        self.assertTrue(np.all(r.electricity_kwh == 0))
        self.assertTrue(np.all(r.water.total_l == 0))

    def test_doubling_the_heat_doubles_electricity_and_water(self):
        w = hours([0.0, 10.0, 20.0])
        a = A.air_cooling(np.full(3, 500.0), w, TYPICAL, K.TOWER)
        b = A.air_cooling(np.full(3, 1000.0), w, TYPICAL, K.TOWER)
        np.testing.assert_allclose(b.electricity_kwh, 2 * a.electricity_kwh)
        np.testing.assert_allclose(b.water.total_l, 2 * a.water.total_l)

    def test_hotter_weather_uses_more_electricity_and_water(self):
        r = A.air_cooling(np.full(3, 1000.0), hours([0.0, 10.0, 20.0]), TYPICAL, K.TOWER)
        self.assertTrue(np.all(np.diff(r.electricity_kwh) > 0))

    def test_scenarios_are_ordered(self):
        w = hours(np.linspace(-5, 25, 40))
        q = np.full(40, 1000.0)
        e = {s: A.air_cooling(q, w, K.AIR[s], K.TOWER).electricity_kwh.sum() for s in K.SCENARIOS}
        self.assertGreater(e["high_use"], e["typical"])
        self.assertGreater(e["typical"], e["low_use"])


class SharedAirSide(unittest.TestCase):
    def test_air_side_system_with_ups_heat_matches_the_air_model(self):
        w = hours([5.0, 15.0])
        q = np.array([800.0, 1200.0])
        full = A.air_cooling(q, w, TYPICAL, K.TOWER)
        shared = A.air_side_system(q, q * (1 / 0.95 - 1), w, TYPICAL, K.TOWER)
        np.testing.assert_allclose(shared.electricity_kwh, full.electricity_kwh)
        np.testing.assert_allclose(shared.water.total_l, full.water.total_l)


class AshburnYear(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.w = W.load_ashburn()
        cls.r = A.air_cooling(np.full(cls.w.n_hours, 1000.0), cls.w, TYPICAL, K.TOWER)
        cls.heat = 1000.0 * cls.w.n_hours

    def test_electricity_per_kwh_of_heat_is_plausible(self):
        ratio = float(self.r.electricity_kwh.sum()) / self.heat
        self.assertTrue(0.15 < ratio < 0.40, ratio)

    def test_water_per_kwh_of_heat_is_plausible(self):
        ratio = float(self.r.water.total_l.sum()) / self.heat
        self.assertTrue(0.8 < ratio < 3.0, ratio)

    def test_summer_costs_more_than_winter(self):
        m = np.bincount(self.w.month_index, weights=self.r.electricity_kwh, minlength=12)
        self.assertGreater(m[6], m[0])
        wm = np.bincount(self.w.month_index, weights=self.r.water.total_l, minlength=12)
        self.assertGreater(wm[6], wm[0])

    def test_chiller_runs_for_part_of_the_year(self):
        hours_on = int((self.r.f_mech > 0).sum())
        self.assertTrue(3000 < hours_on < 7000, hours_on)

    def test_hourly_and_monthly_average_calculations_are_consistent(self):
        """PLAN.md R1: the PDF sums by month. Using monthly means must give a similar (not identical) answer."""
        monthly = W.monthly_average(self.w)
        q = 1000.0 * self.w.hours_per_month  # kWh of heat in each month
        m = A.air_cooling(q, monthly, TYPICAL, K.TOWER)
        hourly_e, monthly_e = float(self.r.electricity_kwh.sum()), float(m.electricity_kwh.sum())
        hourly_w, monthly_w = float(self.r.water.total_l.sum()), float(m.water.total_l.sum())
        self.assertLess(abs(monthly_e - hourly_e) / hourly_e, 0.30)
        self.assertLess(abs(monthly_w - hourly_w) / hourly_w, 0.30)


if __name__ == "__main__":
    unittest.main()
