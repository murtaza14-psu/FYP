"""Module 2 entry point: electricity and water used to cool a year of GPU heat in Ashburn, VA.

    from cooling_module.model import estimate_cooling
    out = estimate_cooling({"low": 3.0e6, "expected": 3.3e6, "high": 3.7e6})   # annual kWh of GPU heat

Two techniques (PLAN.md): air cooling (PDF sections 1-2) and direct-to-chip cooling (sections 3-4), each run hour by
hour over the 8,760 hours of the Ashburn typical year. The annual heat from Module 1 is spread evenly over those hours
(PLAN.md R9). The range pairs Module 1's heat range with the PDF's three parameter sets:

    low     = low heat      with the LOW-USE parameters   (fewest resources)
    typical = expected heat with the TYPICAL parameters   (headline number)
    high    = high heat     with the HIGH-USE parameters  (most resources)

Only GPU heat is cooled (PLAN.md D1). The result is plain dicts, lists and floats, ready for JSON.
"""

from __future__ import annotations

import math

import numpy as np

from cooling_module import air as A
from cooling_module import direct_to_chip as D
from cooling_module import parameters as K
from cooling_module.weather import Weather, load_ashburn

CASES = (("low", "low_use", "low"), ("typical", "typical", "expected"), ("high", "high_use", "high"))  # (output key, scenario, heat key)

_WEATHER: Weather | None = None


def _weather() -> Weather:
    global _WEATHER
    if _WEATHER is None:
        _WEATHER = load_ashburn()
    return _WEATHER


def preload() -> str:
    """Load and verify the Ashburn weather now (so a service fails at start-up, not on the first request)."""
    return _weather().site["site_name"]


def _validate_heat(heat) -> dict[str, float]:
    if not isinstance(heat, dict):
        raise ValueError("annual heat must be a mapping with low, expected and high")
    out = {}
    for key in ("low", "expected", "high"):
        v = heat.get(key)
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0:
            raise ValueError(f"annual heat '{key}' must be a finite number >= 0 (kWh)")
        out[key] = float(v)
    if not out["low"] <= out["expected"] <= out["high"]:
        raise ValueError("annual heat must satisfy low <= expected <= high")
    return out


def _monthly(w: Weather, electricity: np.ndarray, water: np.ndarray) -> list[dict]:
    e = np.bincount(w.month_index, weights=electricity, minlength=12)
    l = np.bincount(w.month_index, weights=water, minlength=12)
    return [{"month": m + 1, "electricity_kwh": float(e[m]), "water_litres": float(l[m])} for m in range(12)]


def _ratio(numerator: float, denominator: float) -> float:
    return float(numerator / denominator) if denominator > 0 else 0.0


def _air_technique(heat: dict[str, float], w: Weather) -> dict:
    n = w.n_hours
    elec, water, typical = {}, {}, None
    for key, scenario, heat_key in CASES:
        r = A.air_cooling(np.full(n, heat[heat_key] / n), w, K.AIR[scenario], K.TOWER)
        elec[key], water[key] = float(r.electricity_kwh.sum()), float(r.water.total_l.sum())
        if key == "typical":
            typical = r
    r = typical
    clamped = int(r.water.clamped.sum())
    return {
        "id": "air",
        "name": "Air cooling",
        "electricity_kwh": elec,
        "water_litres": water,
        "water_breakdown_litres": {"evaporation": float(r.water.evaporation_l.sum()), "drift": float(r.water.drift_l.sum()),
                                   "blowdown": float(r.water.blowdown_l.sum())},
        "electricity_breakdown_kwh": {"air_handler_fans": float(r.e_fan.sum()), "chiller": float(r.e_chiller.sum()),
                                      "pumps": float(r.e_pump.sum()), "tower_fans": float(r.e_tower.sum())},
        "monthly": _monthly(w, r.electricity_kwh, r.water.total_l),
        "kwh_per_kwh_heat": _ratio(elec["typical"], heat["expected"]),
        "litres_per_kwh_heat": _ratio(water["typical"], heat["expected"]),
        "chiller_hours": int((r.f_mech > 0).sum()),
        "notes": [
            f"The chiller runs in {int((r.f_mech > 0).sum()):,} of {n:,} hours (wet-bulb above 7.2 °C); below that the tower alone makes the chilled water.",
            f"In {clamped:,} of {n:,} hours the calculated evaporation share exceeded 100 % of the tower heat "
            "(warm outdoor air supplies part of the evaporation heat) and was limited to 100 %.",
        ],
    }


def _d2c_technique(heat: dict[str, float], w: Weather) -> dict:
    n = w.n_hours
    elec, water, typical = {}, {}, None
    for key, scenario, heat_key in CASES:
        r = D.direct_to_chip(np.full(n, heat[heat_key] / n), w, K.D2C[scenario], K.TOWER)
        elec[key], water[key] = float(r.electricity_kwh.sum()), float(r.water_total_l.sum())
        if key == "typical":
            typical = r
    r = typical
    liquid_heat = float(r.q_liq_total.sum())
    split = {name: _ratio(float((f * r.q_liq_total).sum()), liquid_heat) for name, f in
             (("dry_cooler", r.f_dry), ("tower", r.f_twr), ("chiller", r.f_ch))}
    no_water_hours = int((r.q_twr <= 0).sum())
    clamped = int(r.water_liq.clamped.sum() + r.water_air.clamped.sum())
    return {
        "id": "direct-to-chip",
        "name": "Direct-to-chip cooling",
        "electricity_kwh": elec,
        "water_litres": water,
        "water_breakdown_litres": {
            "evaporation": float(r.water_liq.evaporation_l.sum() + r.water_air.evaporation_l.sum()),
            "drift": float(r.water_liq.drift_l.sum() + r.water_air.drift_l.sum()),
            "blowdown": float(r.water_liq.blowdown_l.sum() + r.water_air.blowdown_l.sum()),
        },
        "electricity_breakdown_kwh": {
            "coolant_pumps": float(r.e_cdu.sum()), "building_water_pumps": float(r.e_fws.sum()),
            "dry_cooler_fans": float(r.e_dry.sum()), "liquid_side_chiller": float(r.e_chiller_liq.sum()),
            "liquid_side_tower": float(r.e_tower_liq.sum()), "air_system": float(r.air.electricity_kwh.sum()),
        },
        "monthly": _monthly(w, r.electricity_kwh, r.water_total_l),
        "kwh_per_kwh_heat": _ratio(elec["typical"], heat["expected"]),
        "litres_per_kwh_heat": _ratio(water["typical"], heat["expected"]),
        "chiller_hours": int((r.f_ch > 0).sum()),
        "heat_split": split,
        "hours_without_liquid_water": no_water_hours,
        "water_by_loop_litres": {"liquid_side": float(r.water_liq.total_l.sum()), "air_system": float(r.water_air.total_l.sum())},
        "notes": [
            f"In {no_water_hours:,} of {n:,} hours the dry cooler removes all the liquid heat, so the liquid side uses no water.",
            f"In {clamped:,} hours the calculated evaporation share exceeded 100 % of the tower heat and was limited to 100 %.",
        ],
    }


def _parameter_table() -> dict:
    return {
        "air": {s: {"sfp_w_per_cfm": a.sfp_w_per_cfm, "e_fan": a.e_fan, "k_ch_kw_per_ton": a.k_ch_kw_per_ton,
                    "k_pump_kw_per_ton": a.k_pump, "k_tower_kw_per_ton": a.k_tower} for s, a in K.AIR.items()},
        "direct_to_chip": {s: {"f_cap": d.f_cap, "t_fws_c": d.t_fws_c, "r_dry": d.r_dry, "k_ch_kw_per_ton": d.k_ch_kw_per_ton}
                           for s, d in K.D2C.items()},
    }


def estimate_cooling(annual_heat_kwh: dict) -> dict:
    """Annual electricity (kWh) and water (litres) to cool `annual_heat_kwh` = {low, expected, high} of GPU heat."""
    heat = _validate_heat(annual_heat_kwh)
    w = _weather()
    s = w.site
    return {
        "site": {
            "name": s["site_name"], "weather_station": s["weather_station"], "weather_source": s["weather_source"],
            "period_of_record": s["period_of_record"], "source_url": s["source_url"], "monthly_climate": s["monthly"],
        },
        "heat_annual_kwh": heat,
        "techniques": [_air_technique(heat, w), _d2c_technique(heat, w)],
        "assumptions": {
            "heat_basis": "GPU heat only",
            "load_profile": "spread evenly over all 8,760 hours of the year",
            "cycles_of_concentration": K.TOWER.cycles_of_concentration,
            "drift_percent": K.TOWER.drift_fraction * 100.0,
            "ups_efficiency": K.AIR["typical"].eta_ups,
            "range": "low = low heat with low-use parameters; typical = expected heat with typical parameters; "
                     "high = high heat with high-use parameters",
        },
        "parameters": _parameter_table(),
    }
