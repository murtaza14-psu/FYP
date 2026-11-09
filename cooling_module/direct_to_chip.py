"""Direct-to-chip liquid cooling (PDF sections 3 and 4), hour by hour.

Cold plates capture a share fcap of the server heat in a liquid loop; the rest goes to room air and is
removed by a small chilled-water air system (`air.air_side_system`). The liquid loop's heat leaves the
building through three stages in series, each taking a share of the building-water temperature rise:

    dry cooler (no water)  ->  cooling tower (water)  ->  chiller (hottest hours only)
    T1 = clamp(Tdb + adry, Tfws, Tret)     T2 = clamp(Twb + atower + ahx, Tfws, T1)
    fdry = (Tret - T1)/dT   ftwr = (T1 - T2)/dT   fch = (T2 - Tfws)/dT       (sum to 1)

Electricity (kWh per hour) is the sum of six items: coolant-distribution pumps, building-water pumps, dry-cooler
fans, liquid-side chiller, liquid-side tower fans and pumps, and the small air system. Water is used only by the two
cooling towers (liquid side, and the air system's). All arrays are per hour of the weather year.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from cooling_module.air import AirResult, air_side_system
from cooling_module.parameters import KW_PER_TON, D2CParams, TowerParams
from cooling_module.tower import TowerWater, tower_water
from cooling_module.weather import Weather


@dataclass(frozen=True)
class D2CResult:
    e_cdu: np.ndarray
    e_fws: np.ndarray
    e_dry: np.ndarray
    e_chiller_liq: np.ndarray
    e_tower_liq: np.ndarray
    air: AirResult              # the small air-cooling system (its own electricity and water)
    q_liq_total: np.ndarray     # Q'liq: liquid heat plus the heat added by the two pump sets, kWh
    q_twr: np.ndarray           # liquid-side heat sent to the tower, kWh
    f_dry: np.ndarray
    f_twr: np.ndarray
    f_ch: np.ndarray
    water_liq: TowerWater
    water_air: TowerWater

    @property
    def electricity_kwh(self) -> np.ndarray:
        return self.e_cdu + self.e_fws + self.e_dry + self.e_chiller_liq + self.e_tower_liq + self.air.electricity_kwh

    @property
    def water_total_l(self) -> np.ndarray:
        return self.water_liq.total_l + self.water_air.total_l


def direct_to_chip(q_it_kwh, w: Weather, p: D2CParams, tower: TowerParams) -> D2CResult:
    """Cool `q_it_kwh` of server heat (kWh in each hour of `w`) with cold plates plus a small air system."""
    q = np.asarray(q_it_kwh, dtype=float)
    air = p.air

    q_liq = p.f_cap * q
    q_air = (1.0 - p.f_cap) * q
    q_ups = q * (1.0 / air.eta_ups - 1.0)
    e_cdu = p.e_cdu * q_liq
    e_fws = p.e_fws * q_liq
    q_liq_total = q_liq + e_cdu + e_fws

    t_ret = p.t_return_c
    t1 = np.minimum(np.maximum(w.dry_bulb_c + p.a_dry_k, p.t_fws_c), t_ret)
    t2 = np.minimum(np.maximum(w.wet_bulb_c + tower.a_tower_k + tower.a_hx_k, p.t_fws_c), t1)
    f_dry = (t_ret - t1) / p.delta_t_fws_k
    f_twr = (t1 - t2) / p.delta_t_fws_k
    f_ch = (t2 - p.t_fws_c) / p.delta_t_fws_k

    e_dry = f_dry * q_liq_total / p.r_dry
    e_chiller_liq = f_ch * q_liq_total / KW_PER_TON * p.k_ch_kw_per_ton
    q_twr = (f_twr + f_ch) * q_liq_total + e_chiller_liq
    e_tower_liq = q_twr / KW_PER_TON * (air.k_tower + air.k_cw)

    air_result = air_side_system(q_air, q_ups, w, air, tower)

    t_ao_liq = (t2 - tower.a_hx_k) + tower.delta_t_range_k / 2.0
    water_liq = tower_water(q_twr, t_ao_liq, w.dry_bulb_c, w.rel_humidity_pct, w.pressure_kpa, tower)

    return D2CResult(e_cdu=e_cdu, e_fws=e_fws, e_dry=e_dry, e_chiller_liq=e_chiller_liq, e_tower_liq=e_tower_liq,
                     air=air_result, q_liq_total=q_liq_total, q_twr=q_twr, f_dry=f_dry, f_twr=f_twr, f_ch=f_ch,
                     water_liq=water_liq, water_air=air_result.water)
