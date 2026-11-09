"""Tests for the cooling-tower water balance.  Run from the repo root: python -m unittest cooling_module.test_tower"""
import unittest

import numpy as np

from cooling_module import parameters as K
from cooling_module import psychrometrics as P
from cooling_module import tower as T

ARGS = dict(t_ao_c=26.7, t_db_c=25.0, rh_pct=60.0, p_kpa=100.2)


class TowerWater(unittest.TestCase):
    def setUp(self):
        self.q = np.array([1000.0])
        self.w = T.tower_water(self.q, ARGS["t_ao_c"], ARGS["t_db_c"], ARGS["rh_pct"], ARGS["p_kpa"], K.TOWER)

    def test_evaporation_follows_the_equation_document(self):
        f, _ = P.evaporation_fraction(**ARGS)
        expected = 3600 * 1000.0 * float(f) / (2501 - 2.361 * 26.7)
        self.assertAlmostEqual(float(self.w.evaporation_l[0]), expected, places=6)

    def test_drift_follows_the_equation_document(self):
        expected = 3600 * 1000.0 * 0.000005 / (4.186 * (10 * 5 / 9))
        self.assertAlmostEqual(float(self.w.drift_l[0]), expected, places=9)

    def test_blowdown_uses_four_cycles_of_concentration(self):
        expected = float(self.w.evaporation_l[0]) / 3.0 - float(self.w.drift_l[0])
        self.assertAlmostEqual(float(self.w.blowdown_l[0]), expected, places=9)

    def test_total_is_the_sum_of_the_three(self):
        w = self.w
        self.assertAlmostEqual(float(w.total_l[0]), float(w.evaporation_l[0] + w.drift_l[0] + w.blowdown_l[0]), places=9)

    def test_evaporation_dominates(self):
        self.assertGreater(float(self.w.evaporation_l[0]), 100 * float(self.w.drift_l[0]))

    def test_zero_heat_uses_no_water(self):
        w = T.tower_water(np.zeros(3), 26.7, 25.0, 60.0, 100.2, K.TOWER)
        self.assertTrue(np.all(w.total_l == 0))

    def test_water_is_proportional_to_heat(self):
        w2 = T.tower_water(self.q * 2, ARGS["t_ao_c"], ARGS["t_db_c"], ARGS["rh_pct"], ARGS["p_kpa"], K.TOWER)
        self.assertAlmostEqual(float(w2.total_l[0]), 2 * float(self.w.total_l[0]), places=9)

    def test_more_cycles_of_concentration_means_less_blowdown(self):
        loose = K.TowerParams(cycles_of_concentration=8.0)
        w = T.tower_water(self.q, 26.7, 25.0, 60.0, 100.2, loose)
        self.assertLess(float(w.blowdown_l[0]), float(self.w.blowdown_l[0]))
        self.assertAlmostEqual(float(w.evaporation_l[0]), float(self.w.evaporation_l[0]))

    def test_blowdown_is_never_negative(self):
        w = T.tower_water(self.q, 26.7, 25.0, 60.0, 100.2, K.TowerParams(cycles_of_concentration=1.0001))
        self.assertTrue(np.all(w.blowdown_l >= 0))
        w = T.tower_water(self.q, 26.7, 25.0, 60.0, 100.2, K.TowerParams(drift_fraction=0.5))
        self.assertTrue(np.all(w.blowdown_l >= 0))

    def test_reports_hours_where_the_evaporation_share_was_limited(self):
        w = T.tower_water(np.array([100.0, 100.0]), np.array([26.7, 0.0]), np.array([25.0, 30.0]),
                          np.array([60.0, 60.0]), 100.2, K.TOWER)
        self.assertEqual(list(w.clamped), [False, True])


if __name__ == "__main__":
    unittest.main()
