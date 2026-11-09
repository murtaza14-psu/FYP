"""Cooling-tower water use, shared by the air and direct-to-chip models (PDF sections 2 and 4).

    evaporation = 3600 x Qrej x fevap / hfg(Tao)          litres (1 kg of water = 1 litre)
    drift       = 3600 x Qrej x d / (cp x dT_range)
    blowdown    = max(evaporation / (COC - 1) - drift, 0)  <- not in the PDF (PLAN.md D2, R7)

Qrej is the heat reaching the tower in kWh and Tao the tower water temperature in degC. Everything
is calculated per hour and vectorised over numpy arrays.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from cooling_module import psychrometrics as P
from cooling_module.parameters import KJ_PER_KWH, TowerParams


@dataclass(frozen=True)
class TowerWater:
    evaporation_l: np.ndarray
    drift_l: np.ndarray
    blowdown_l: np.ndarray
    clamped: np.ndarray  # hours where the evaporation share had to be limited (PLAN.md R5)

    @property
    def total_l(self) -> np.ndarray:
        return self.evaporation_l + self.drift_l + self.blowdown_l


def tower_water(q_rej_kwh, t_ao_c, t_db_c, rh_pct, p_kpa, tower: TowerParams) -> TowerWater:
    q = np.asarray(q_rej_kwh, dtype=float)
    f_evap, clamped = P.evaporation_fraction(t_ao_c, t_db_c, rh_pct, p_kpa)
    kj = KJ_PER_KWH * q
    evaporation = kj * f_evap / P.hfg_kj_per_kg(t_ao_c)
    drift = kj * tower.drift_fraction / (tower.cp_kj_per_kg_k * tower.delta_t_range_k)
    blowdown = np.maximum(evaporation / (tower.cycles_of_concentration - 1.0) - drift, 0.0)
    return TowerWater(evaporation_l=evaporation, drift_l=drift, blowdown_l=blowdown, clamped=clamped & (q > 0))
