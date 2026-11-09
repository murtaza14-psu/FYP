"""Air cooling: chilled-water system with a cooling tower (PDF sections 1 and 2), hour by hour.

Electricity (per hour, kWh):
    Ecool = efan.Q + (Qchw / 3.517) x [ fmech.kch + kpump + ktower ]
    Qchw  = Q / etaUPS + efan.Q                                   server heat + UPS losses + fan heat
    fmech = 1 - clamp[(Ts + dTchw - Twb - atower - ahx) / dTchw, 0, 1]
Water (litres): the tower heat Qrej = Qchw + Ech + Epump goes through `tower.tower_water`.

`air_side_system` is also the small air system that removes the heat the cold plates miss in the
direct-to-chip model (PDF section 3), so both techniques share one implementation.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from cooling_module.parameters import KW_PER_TON, AirParams, TowerParams
from cooling_module.tower import TowerWater, tower_water
from cooling_module.weather import Weather


@dataclass(frozen=True)
class AirResult:
    e_fan: np.ndarray       # air-handler fans, kWh per hour
    e_chiller: np.ndarray
    e_pump: np.ndarray      # chilled-water and tower-water pumps
    e_tower: np.ndarray     # tower fans
    q_chw: np.ndarray       # heat carried by the chilled water, kWh
    q_rej: np.ndarray       # heat reaching the cooling tower, kWh
    f_mech: np.ndarray      # share of the cooling that needs the chiller, 0-1
    water: TowerWater

    @property
    def electricity_kwh(self) -> np.ndarray:
        return self.e_fan + self.e_chiller + self.e_pump + self.e_tower


def chiller_fraction(t_wb_c, air: AirParams, tower: TowerParams) -> np.ndarray:
    """fmech: 0 when the tower alone can make the chilled water (cold, dry weather), 1 when the chiller does everything."""
    free = (air.t_supply_c + air.delta_t_chw_k - np.asarray(t_wb_c, dtype=float) - tower.a_tower_k - tower.a_hx_k) / air.delta_t_chw_k
    return 1.0 - np.clip(free, 0.0, 1.0)


def air_side_system(q_air_kwh, q_ups_kwh, w: Weather, air: AirParams, tower: TowerParams) -> AirResult:
    """Chilled-water cooling of `q_air_kwh` of heat in room air plus `q_ups_kwh` of UPS losses (kWh per hour)."""
    q_air = np.asarray(q_air_kwh, dtype=float)
    e_fan = air.e_fan * q_air
    q_chw = q_air + np.asarray(q_ups_kwh, dtype=float) + e_fan
    ton_hours = q_chw / KW_PER_TON
    f_mech = chiller_fraction(w.wet_bulb_c, air, tower)
    e_chiller = ton_hours * f_mech * air.k_ch_kw_per_ton
    e_pump = ton_hours * air.k_pump
    e_tower = ton_hours * air.k_tower
    q_rej = q_chw + e_chiller + e_pump
    t_ao = w.wet_bulb_c + tower.a_tower_k + tower.delta_t_range_k / 2.0
    water = tower_water(q_rej, t_ao, w.dry_bulb_c, w.rel_humidity_pct, w.pressure_kpa, tower)
    return AirResult(e_fan=e_fan, e_chiller=e_chiller, e_pump=e_pump, e_tower=e_tower, q_chw=q_chw, q_rej=q_rej,
                     f_mech=f_mech, water=water)


def air_cooling(q_it_kwh, w: Weather, air: AirParams, tower: TowerParams) -> AirResult:
    """Cool all of the server heat `q_it_kwh` (kWh in each hour of `w`) with the air system."""
    q = np.asarray(q_it_kwh, dtype=float)
    return air_side_system(q, q * (1.0 / air.eta_ups - 1.0), w, air, tower)
