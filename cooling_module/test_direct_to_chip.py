"""Tests for direct-to-chip cooling (PDF sections 3 and 4).  Run from the repo root: python -m unittest cooling_module.test_direct_to_chip"""
import dataclasses
import unittest

import numpy as np

from cooling_module import air as A
from cooling_module import direct_to_chip as D
from cooling_module import parameters as K
from cooling_module import psychrometrics as P
from cooling_module import weather as W
from cooling_module.testing_helpers import hours

TYPICAL = K.D2C["typical"]
Q = 1000.0

# Typical-scenario constants written out as raw numbers (independent of parameters.py).
FCAP, ETA, ECDU, EFWS, TFWS, DT_FWS, ADRY, RDRY = 0.80, 0.95, 0.00612, 0.00527, 32.0, 14.1, 10.0, 70.0
AT, AHX, KCH = 7 * 5 / 9, 3 * 5 / 9, 0.500
K_TOWER, K_CW = 0.7457 * 3 / 38.2, 19 * 3 / 1000
E_FAN = 3.412 * 0.75 / (1.08 * 20)
K_PUMP = (22 * 2.4 + 19 * 3) / 1000


def hand_worked(t_db, t_wb):
    """Section 3 for one hour of 1,000 kWh server heat, with raw arithmetic."""
    q_liq, q_air, q_ups = FCAP * Q, (1 - FCAP) * Q, Q * (1 / ETA - 1)
    q_liq_p = q_liq + ECDU * q_liq + EFWS * q_liq
    t_ret = TFWS + DT_FWS
    t1 = min(max(t_db + ADRY, TFWS), t_ret)
    t2 = min(max(t_wb + AT + AHX, TFWS), t1)
    f_dry, f_twr, f_ch = (t_ret - t1) / DT_FWS, (t1 - t2) / DT_FWS, (t2 - TFWS) / DT_FWS
    e_dry = f_dry * q_liq_p / RDRY
    e_ch = f_ch * q_liq_p / 3.517 * KCH
    q_twr = (f_twr + f_ch) * q_liq_p + e_ch
    e_twr = q_twr / 3.517 * (K_TOWER + K_CW)
    q_chw_air = q_air + q_ups + E_FAN * q_air
    tons = q_chw_air / 3.517
    f_mech = 1 - min(max((12.7778 + 5.5556 - t_wb - AT - AHX) / 5.5556, 0), 1)
    e_air = E_FAN * q_air + tons * (f_mech * KCH + K_PUMP + K_TOWER)
    return dict(cdu=ECDU * q_liq, fws=EFWS * q_liq, dry=e_dry, ch=e_ch, twr=e_twr, air=e_air, q_twr=q_twr,
                f=(f_dry, f_twr, f_ch), total=ECDU * q_liq + EFWS * q_liq + e_dry + e_ch + e_twr + e_air)


class HandWorkedHours(unittest.TestCase):
    def check(self, t_db, t_wb, rh=50.0):
        r = D.direct_to_chip(np.array([Q]), hours(t_wb, dry_bulb=t_db, rh=rh), TYPICAL, K.TOWER)
        h = hand_worked(t_db, t_wb)
        for name, got in (("cdu", r.e_cdu), ("fws", r.e_fws), ("dry", r.e_dry), ("ch", r.e_chiller_liq),
                          ("twr", r.e_tower_liq), ("air", r.air.electricity_kwh)):
            with self.subTest(name):
                self.assertAlmostEqual(float(got[0]), h[name], places=6)
        self.assertAlmostEqual(float(r.electricity_kwh[0]), h["total"], places=6)
        self.assertAlmostEqual(float(r.q_twr[0]), h["q_twr"], places=6)
        np.testing.assert_allclose([float(r.f_dry[0]), float(r.f_twr[0]), float(r.f_ch[0])], h["f"], atol=1e-9)
        return r, h

    def test_cold_hour_dry_cooler_does_everything(self):
        r, h = self.check(0.0, -2.0, rh=70.0)
        np.testing.assert_allclose(h["f"], (1.0, 0.0, 0.0), atol=1e-12)
        self.assertEqual(float(r.water_liq.total_l[0]), 0.0)     # no water on the liquid side
        self.assertEqual(float(r.e_tower_liq[0]), 0.0)
        self.assertGreater(float(r.water_air.total_l[0]), 0.0)    # the small air system still uses its tower

    def test_hot_hour_uses_dry_cooler_and_tower(self):
        r, h = self.check(35.0, 26.0)
        self.assertGreater(h["f"][1], 0.9)
        self.assertEqual(float(r.e_chiller_liq[0]), 0.0)          # wet-bulb is low enough for the tower alone

    def test_very_hot_humid_hour_also_needs_the_liquid_chiller(self):
        r, h = self.check(33.0, 28.0, rh=70.0)
        self.assertGreater(h["f"][2], 0.05)
        self.assertGreater(float(r.e_chiller_liq[0]), 0.0)

    def test_liquid_side_water_uses_the_tower_heat_and_water_temperature(self):
        r, h = self.check(35.0, 26.0)
        t2 = min(max(26.0 + AT + AHX, TFWS), min(max(35.0 + ADRY, TFWS), TFWS + DT_FWS))
        t_ao = (t2 - AHX) + (10 * 5 / 9) / 2
        f, _ = P.evaporation_fraction(t_ao, 35.0, 50.0, 100.2)
        evap = 3600 * h["q_twr"] * float(f) / (2501 - 2.361 * t_ao)
        self.assertAlmostEqual(float(r.water_liq.evaporation_l[0]), evap, places=6)


class Invariants(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.w = W.load_ashburn()
        cls.q = np.full(cls.w.n_hours, Q)
        cls.r = D.direct_to_chip(cls.q, cls.w, TYPICAL, K.TOWER)

    def test_the_three_shares_sum_to_one_every_hour(self):
        r = self.r
        np.testing.assert_allclose(r.f_dry + r.f_twr + r.f_ch, 1.0, atol=1e-9)
        for f in (r.f_dry, r.f_twr, r.f_ch):
            self.assertTrue(np.all((f >= -1e-12) & (f <= 1 + 1e-12)))

    def test_electricity_is_the_sum_of_the_six_items(self):
        r = self.r
        total = r.e_cdu + r.e_fws + r.e_dry + r.e_chiller_liq + r.e_tower_liq + r.air.electricity_kwh
        np.testing.assert_allclose(r.electricity_kwh, total)

    def test_water_is_the_sum_of_both_towers(self):
        r = self.r
        np.testing.assert_allclose(r.water_total_l, r.water_liq.total_l + r.water_air.total_l)

    def test_zero_heat_gives_zero_everything(self):
        r = D.direct_to_chip(np.zeros(self.w.n_hours), self.w, TYPICAL, K.TOWER)
        self.assertTrue(np.all(r.electricity_kwh == 0))
        self.assertTrue(np.all(r.water_total_l == 0))

    def test_doubling_the_heat_doubles_the_results(self):
        r2 = D.direct_to_chip(self.q * 2, self.w, TYPICAL, K.TOWER)
        np.testing.assert_allclose(r2.electricity_kwh, 2 * self.r.electricity_kwh)
        np.testing.assert_allclose(r2.water_total_l, 2 * self.r.water_total_l)

    def test_warmer_building_water_never_increases_electricity_or_water(self):
        previous = None
        for t_fws in (24.0, 28.0, 32.0, 36.0, 40.0):
            r = D.direct_to_chip(self.q, self.w, dataclasses.replace(TYPICAL, t_fws_c=t_fws), K.TOWER)
            now = (float(r.electricity_kwh.sum()), float(r.water_total_l.sum()))
            if previous:
                self.assertLessEqual(now[0], previous[0] + 1e-6)
                self.assertLessEqual(now[1], previous[1] + 1e-6)
            previous = now

    def test_more_heat_captured_by_the_cold_plates_reduces_the_air_system(self):
        low = D.direct_to_chip(self.q, self.w, dataclasses.replace(TYPICAL, f_cap=0.70), K.TOWER)
        high = D.direct_to_chip(self.q, self.w, dataclasses.replace(TYPICAL, f_cap=0.94), K.TOWER)
        self.assertLess(float(high.air.electricity_kwh.sum()), float(low.air.electricity_kwh.sum()))
        self.assertLess(float(high.electricity_kwh.sum()), float(low.electricity_kwh.sum()))

    def test_scenarios_are_ordered(self):
        e = {s: float(D.direct_to_chip(self.q, self.w, K.D2C[s], K.TOWER).electricity_kwh.sum()) for s in K.SCENARIOS}
        wt = {s: float(D.direct_to_chip(self.q, self.w, K.D2C[s], K.TOWER).water_total_l.sum()) for s in K.SCENARIOS}
        self.assertGreater(e["high_use"], e["typical"])
        self.assertGreater(e["typical"], e["low_use"])
        self.assertGreater(wt["high_use"], wt["typical"])
        self.assertGreater(wt["typical"], wt["low_use"])


class AgainstAirCooling(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.w = W.load_ashburn()
        q = np.full(cls.w.n_hours, Q)
        cls.air = A.air_cooling(q, cls.w, K.AIR["typical"], K.TOWER)
        cls.d2c = D.direct_to_chip(q, cls.w, TYPICAL, K.TOWER)
        cls.heat = Q * cls.w.n_hours

    def test_uses_less_electricity_than_air_cooling(self):
        self.assertLess(float(self.d2c.electricity_kwh.sum()), float(self.air.electricity_kwh.sum()))

    def test_uses_less_water_than_air_cooling(self):
        self.assertLess(float(self.d2c.water_total_l.sum()), float(self.air.water.total_l.sum()))

    def test_per_kwh_results_are_plausible(self):
        self.assertTrue(0.02 < float(self.d2c.electricity_kwh.sum()) / self.heat < 0.20)
        self.assertTrue(0.0 < float(self.d2c.water_total_l.sum()) / self.heat < 1.5)

    def test_much_of_the_year_needs_no_liquid_side_water(self):
        dry_hours = int((self.d2c.q_twr == 0).sum())
        self.assertTrue(dry_hours > 1000, dry_hours)


if __name__ == "__main__":
    unittest.main()
