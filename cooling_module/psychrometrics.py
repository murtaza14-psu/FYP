"""Moist-air formulas used by the cooling models (SI units, numpy-vectorised).

Sources: ASHRAE Handbook of Fundamentals, chapter 1 (Hyland-Wexler saturation pressure, humidity
ratio, enthalpy, wet-bulb), and `hfg(T) = 2501 - 2.361 T` from the equation document.

Every function accepts scalars or numpy arrays and returns numpy values. Temperatures are in degC,
pressures in kPa, enthalpy in kJ per kg of dry air, humidity ratio in kg water per kg dry air.
"""

from __future__ import annotations

import numpy as np

EPSILON = 0.621945  # molar-mass ratio of water vapour to dry air

# Hyland-Wexler saturation pressure (ASHRAE 2017 F1 eq. 5 over ice, eq. 6 over liquid water); T in K, result in Pa.
_ICE = (-5.6745359e3, 6.3925247, -9.677843e-3, 6.2215701e-7, 2.0747825e-9, -9.484024e-13, 4.1635019)
_WATER = (-5.8002206e3, 1.3914993, -4.8640239e-2, 4.1764768e-5, -1.4452093e-8, 6.5459673)


def saturation_pressure_kpa(t_c):
    """Saturation pressure of water vapour: over ice below 0 degC, over liquid water at and above it."""
    t = np.asarray(t_c, dtype=float)
    k = t + 273.15
    c = _ICE
    ice = c[0] / k + c[1] + c[2] * k + c[3] * k**2 + c[4] * k**3 + c[5] * k**4 + c[6] * np.log(k)
    c = _WATER
    water = c[0] / k + c[1] + c[2] * k + c[3] * k**2 + c[4] * k**3 + c[5] * np.log(k)
    return np.exp(np.where(t < 0.0, ice, water)) / 1000.0


def humidity_ratio_saturated(t_c, p_kpa):
    pws = saturation_pressure_kpa(t_c)
    return EPSILON * pws / (np.asarray(p_kpa, dtype=float) - pws)


def humidity_ratio(t_c, rh_pct, p_kpa):
    pw = np.asarray(rh_pct, dtype=float) / 100.0 * saturation_pressure_kpa(t_c)
    return EPSILON * pw / (np.asarray(p_kpa, dtype=float) - pw)


def enthalpy_kj_per_kg(t_c, w):
    """Specific enthalpy of moist air, kJ per kg of dry air."""
    t = np.asarray(t_c, dtype=float)
    return 1.006 * t + np.asarray(w, dtype=float) * (2501.0 + 1.86 * t)


def hfg_kj_per_kg(t_c):
    """Energy to evaporate 1 kg of water at tower temperature (fit used in the equation document)."""
    return 2501.0 - 2.361 * np.asarray(t_c, dtype=float)


def _w_from_wet_bulb(t_c, t_wb_c, p_kpa):
    """Humidity ratio implied by a dry-bulb / wet-bulb pair (ASHRAE F1 eq. 33 and 35)."""
    ws_star = humidity_ratio_saturated(t_wb_c, p_kpa)
    above = ((2501.0 - 2.326 * t_wb_c) * ws_star - 1.006 * (t_c - t_wb_c)) / (2501.0 + 1.86 * t_c - 4.186 * t_wb_c)
    below = ((2830.0 - 0.24 * t_wb_c) * ws_star - 1.006 * (t_c - t_wb_c)) / (2830.0 + 1.86 * t_c - 2.1 * t_wb_c)
    return np.where(t_wb_c >= 0.0, above, below)


def wet_bulb_c(t_db_c, rh_pct, p_kpa):
    """Thermodynamic wet-bulb temperature, found by bisection (the implied humidity ratio rises with t_wb)."""
    t_db, rh, p = np.broadcast_arrays(*(np.asarray(v, dtype=float) for v in (t_db_c, rh_pct, p_kpa)))
    w = humidity_ratio(t_db, rh, p)
    lo = np.full_like(t_db, -80.0)
    hi = t_db.copy()
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        too_humid = _w_from_wet_bulb(t_db, mid, p) > w
        hi = np.where(too_humid, mid, hi)
        lo = np.where(too_humid, lo, mid)
    return np.minimum(0.5 * (lo + hi), t_db)


def evaporation_fraction(t_ao_c, t_db_c, rh_pct, p_kpa):
    """Share of the tower's heat rejected by evaporating water (equation document, sections 2 and 4).

        fevap = hfg(Tao) x (w_out - w_in) / (h_out - h_in)

    The entering air is the outdoor air (t_db_c, rh_pct). The leaving air is taken as saturated at
    the tower water temperature Tao (decision R4). Returns (fevap, clamped): fevap is limited to
    [0, 1] and set to 1 when the leaving air would carry no more heat than the entering air
    (decision R5); `clamped` marks those hours so they can be reported.
    """
    t_ao, t_db, rh, p = np.broadcast_arrays(*(np.asarray(v, dtype=float) for v in (t_ao_c, t_db_c, rh_pct, p_kpa)))
    w_in = humidity_ratio(t_db, rh, p)
    h_in = enthalpy_kj_per_kg(t_db, w_in)
    w_out = humidity_ratio_saturated(t_ao, p)
    h_out = enthalpy_kj_per_kg(t_ao, w_out)
    dh = h_out - h_in
    positive = dh > 1e-9
    raw = np.where(positive, hfg_kj_per_kg(t_ao) * (w_out - w_in) / np.where(positive, dh, 1.0), 1.0)
    clamped = ~positive | (raw < 0.0) | (raw > 1.0)
    return np.clip(raw, 0.0, 1.0), clamped
