# Module 2: cooling resources (Ashburn, VA)

Given the GPU heat from Module 1, works out the **electricity (kWh)** and **water (litres)** that two cooling techniques use in a year in **Ashburn, Virginia**:

1. **Air cooling**: chilled-water air handlers, chillers, pumps and cooling towers (equation document sections 1 and 2).
2. **Direct-to-chip cooling**: cold plates on the GPUs, dry coolers, a tower and chiller used only in hot weather, and a small air system for the heat the plates miss (sections 3 and 4).

The equations come from `docs/Cooling_Equations_Summary.pdf`. The plan, the decisions and every gap filled in are in [`PLAN.md`](PLAN.md). Only GPU heat is cooled. Immersion cooling is not modelled (no equations).

```
python -m unittest discover -s cooling_module -t . -p "test_*.py"     # 120 tests, about 10 s, run from the repo root
python ml_module/api.py                                               # POST /api/v1/analysis returns heat + cooling
```

```python
from cooling_module.model import estimate_cooling
out = estimate_cooling({"low": 405_000, "expected": 538_000, "high": 710_000})   # annual kWh of GPU heat
out["techniques"][0]["electricity_kwh"]   # {'low': ..., 'typical': ..., 'high': ...}
```

## How it works

- **Hourly, for one typical year.** Every equation is evaluated for each of the 8,760 hours of a typical weather year and summed. The annual heat from Module 1 is spread evenly over those hours.
- **Range.** `low` = low heat with the **low-use** parameters, `typical` = expected heat with the **typical** parameters (the headline), `high` = high heat with the **high-use** parameters. The PDF's three values per parameter (for example fan power 1.25 / 0.75 / 0.50 W/cfm) are the high-use / typical / low-use set.
- **Water** = evaporation + drift + **blowdown**. Blowdown is not in the PDF: `evaporation / (cycles of concentration - 1) - drift` with 4 cycles assumed. It is reported separately.

| File | Role |
|---|---|
| `parameters.py` | Every constant of the PDF in SI units, in the three scenarios. Derived values (`efan`, `kpump`, `ktower`) are computed from the PDF's formulas |
| `psychrometrics.py` | Moist-air formulas: saturation pressure, humidity ratio, enthalpy, wet-bulb, `hfg`, evaporation share `fevap` |
| `weather.py` | Safe loader for the Ashburn weather (size cap, fixed columns, range checks, SHA-256 check) |
| `tower.py` | Cooling-tower water: evaporation, drift, blowdown |
| `air.py`, `direct_to_chip.py` | The two techniques, hour by hour |
| `model.py` | `estimate_cooling()`: runs both techniques in the three scenarios and returns JSON-ready results |
| `prepare_weather.py` | One-off conversion of the EPW weather file to the CSV in `data/` |
| `data/` | `ashburn_va_hourly.csv`, `ashburn_va.json`, and `README.md` with the source and checks |
| `test_*.py`, `testing_helpers.py` | Tests |

## Results for a reference fleet

500 GPUs, 60 % SM and 30 % memory utilisation, 24 h a day, 365 days (Module 1: about 123 W per GPU, **538 MWh** of heat a year, range 405 to 710 MWh).

| | Electricity (MWh/year) | Water (million litres/year) | Per kWh of GPU heat |
|---|---|---|---|
| **Air cooling** | **141** (88 to 257) | **1.06** (0.77 to 1.51) | 0.26 kWh, 1.97 L |
| **Direct-to-chip** | **43** (16 to 100) | **0.31** (0.08 to 0.68) | 0.08 kWh, 0.58 L |

- Air cooling water is 1.48 L evaporated plus 0.49 L blowdown (and 0.001 L drift) per kWh of heat. Its electricity is fans 45 %, chiller 33 %, pumps 14 %, tower fans 7 %.
- Direct-to-chip: in a typical year 92 % of the liquid heat leaves through dry coolers (no water), 8 % through the tower, and the liquid-side chiller essentially never runs. The liquid side needs no tower water in 6,404 of 8,760 hours. The small air system still accounts for about 72 % of its electricity and 80 % of its water, because it also removes all of the UPS losses.
- The range is wide because it combines Module 1's heat range with the worst and best equipment values.

## What was checked

- **The PDF's own numbers:** `efan` = 0.197 / 0.118 / 0.079, `kpump` = 0.1098, `ktower` = 0.0586 kW/ton, flow per ton 2.4 gpm, all reproduced from the formulas (tested).
- **Hand-worked hours:** a hot and a cold air-cooling hour, and a cold, a hot and a very hot humid direct-to-chip hour, are calculated with raw arithmetic in the tests and match the code.
- **Physical rules (tested):** the dry-cooler, tower and chiller shares sum to 1 every hour; no chiller below 7.2 degC wet-bulb and all chiller above 12.8 degC; zero heat gives zero results; doubling the heat doubles them; warmer building water never increases use; higher plate capture lowers the air system's use; low <= typical <= high; monthly values add up to the annual total.
- **The PDF's quoted evaporation share (0.61 to 0.85 by month):** monthly means of the Ashburn weather give 0.63 to 0.90 with the same formulas, so the equations and the assumption that the air leaves saturated reproduce it closely. The warm end is a little higher than the PDF's, which suggests the PDF's weather was slightly cooler.
- **Plausibility against published ranges:** air cooling at 0.26 kWh and 1.97 L per kWh of heat is within typical chilled-water, cooling-tower data centres (about 0.2 to 0.4 kWh, about 1.8 L); direct-to-chip is clearly lower.
- **Hourly against monthly calculation (the PDF sums air cooling by month):** the two differ by less than 1 % for Ashburn (0.2625 vs 0.2618 kWh/kWh, 1.97 vs 1.99 L/kWh).
- **Weather:** monthly means equal the weather file's own statistics, and the wet-bulb agrees with an independent formula to within 0.73 K (see `data/README.md`).

## Limits

- GPU heat only: CPUs, networking, storage and lighting are not cooled in these figures. Module 1 is V100-trained.
- One typical weather year at one site; the airport is about 10 km from Ashburn.
- The load is assumed even across the year. Night-only or winter-only operation would change the answer.
- Fan, chiller and pump efficiencies do not change with load (as in the PDF). Blowdown (4 cycles) is an assumption.
- In about 900 hours a year the formula's evaporation share exceeds 100 % (warm air supplies part of the evaporation heat) and is limited to 100 %; this is counted and shown on the Results page.
- Immersion cooling is not modelled. The weather data's terms of use are not stated on the source's pages (see `data/README.md`).
