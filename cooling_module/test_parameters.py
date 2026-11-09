"""Tests for the cooling parameters.  Run from the repo root: python -m unittest cooling_module.test_parameters

Every expected number below is the one printed in docs/Cooling_Equations_Summary.pdf.
"""
import unittest

from cooling_module import parameters as K


class UnitConversion(unittest.TestCase):
    def test_fahrenheit_differences_become_kelvin(self):
        self.assertAlmostEqual(K.df_to_k(10), 5.556, places=3)  # delta T range, delta T chilled water
        self.assertAlmostEqual(K.df_to_k(7), 3.889, places=3)   # tower approach
        self.assertAlmostEqual(K.df_to_k(3), 1.667, places=3)   # heat-exchanger approach
        self.assertAlmostEqual(K.df_to_k(20), 11.111, places=3)

    def test_fahrenheit_temperatures_become_celsius(self):
        self.assertAlmostEqual(K.f_to_c(55), 12.778, places=3)
        self.assertAlmostEqual(K.f_to_c(32), 0.0)


class AirDerivedValues(unittest.TestCase):
    def test_fan_electricity_per_unit_of_heat(self):
        for scenario, expected in [("high_use", 0.197), ("typical", 0.118), ("low_use", 0.079)]:
            with self.subTest(scenario):
                self.assertAlmostEqual(K.AIR[scenario].e_fan, expected, places=3)

    def test_pump_electricity_per_ton(self):
        self.assertAlmostEqual(K.AIR["typical"].k_pump, 0.1098, places=4)

    def test_chilled_water_flow_per_ton(self):
        self.assertAlmostEqual(K.AIR["typical"].chw_gpm_per_ton, 2.4, places=6)

    def test_tower_fan_electricity_per_ton(self):
        self.assertAlmostEqual(K.AIR["typical"].k_tower, 0.0586, places=4)

    def test_tower_pump_electricity_per_ton(self):
        self.assertAlmostEqual(K.AIR["typical"].k_cw, 0.057, places=4)

    def test_chiller_efficiency_per_scenario(self):
        self.assertEqual([K.AIR[s].k_ch_kw_per_ton for s in K.SCENARIOS], [0.560, 0.500, 0.500])

    def test_fixed_values(self):
        a = K.AIR["typical"]
        self.assertEqual(a.eta_ups, 0.95)
        self.assertAlmostEqual(a.t_supply_c, 12.778, places=3)
        self.assertAlmostEqual(a.delta_t_chw_k, 5.556, places=3)


class DirectToChipValues(unittest.TestCase):
    def test_three_values_per_parameter(self):
        self.assertEqual([K.D2C[s].f_cap for s in K.SCENARIOS], [0.70, 0.80, 0.94])
        self.assertEqual([K.D2C[s].t_fws_c for s in K.SCENARIOS], [27.0, 32.0, 40.0])
        self.assertEqual([K.D2C[s].r_dry for s in K.SCENARIOS], [45.0, 70.0, 110.0])

    def test_pump_and_loop_constants(self):
        d = K.D2C["typical"]
        self.assertEqual(d.e_cdu, 0.00612)
        self.assertEqual(d.e_fws, 0.00527)
        self.assertEqual(d.delta_t_fws_k, 14.1)
        self.assertEqual(d.a_dry_k, 10.0)

    def test_air_side_uses_the_same_scenario(self):
        for s in K.SCENARIOS:
            self.assertIs(K.D2C[s].air, K.AIR[s])
            self.assertEqual(K.D2C[s].k_ch_kw_per_ton, K.AIR[s].k_ch_kw_per_ton)


class Tower(unittest.TestCase):
    def test_values_from_the_document(self):
        t = K.TOWER
        self.assertAlmostEqual(t.a_tower_k, 3.889, places=3)
        self.assertAlmostEqual(t.a_hx_k, 1.667, places=3)
        self.assertAlmostEqual(t.delta_t_range_k, 5.556, places=3)
        self.assertAlmostEqual(t.drift_fraction, 5e-6)
        self.assertEqual(t.cp_kj_per_kg_k, 4.186)

    def test_blowdown_assumption_is_explicit(self):
        self.assertEqual(K.TOWER.cycles_of_concentration, 4.0)


class Scenarios(unittest.TestCase):
    def test_names_and_order(self):
        self.assertEqual(K.SCENARIOS, ("high_use", "typical", "low_use"))
        self.assertEqual(set(K.AIR), set(K.SCENARIOS))
        self.assertEqual(set(K.D2C), set(K.SCENARIOS))

    def test_parameters_cannot_be_changed(self):
        with self.assertRaises(Exception):
            K.AIR["typical"].sfp_w_per_cfm = 1.0  # type: ignore[misc]


if __name__ == "__main__":
    unittest.main()
