# Module 2: Cooling Resource Model (Plan)

> **Goal:** for the GPU heat predicted by Module 1, work out the **electricity (kWh)** and **water (litres)** that cooling uses in a year, in **Ashburn, Virginia**, for the two techniques in `docs/Cooling_Equations_Summary.pdf`:
> **1. Air cooling** (chilled water + cooling towers) and **2. Direct-to-chip cooling** (cold plates + dry coolers/towers/chiller + a small air system).
> **Source of the equations:** `docs/Cooling_Equations_Summary.pdf` (Sections 1–4). This plan only adds what the PDF leaves open, and lists every such addition in §3.
> **Development style:** same as the rest of the project: tests first (red → green → refactor), tick the boxes here, add a row to the progress log, commit per step.

---

## 1. Scope

| In scope | Out of scope (for now) |
|---|---|
| Air cooling and direct-to-chip, as in the PDF | Immersion cooling (no equations yet; removed from the website's comparison) |
| Ashburn, VA only, using a fixed hourly weather file stored in the repo | Other regions, live weather, scraping |
| Heat from the **GPUs only** (Module 1 output, used as it is) | CPUs, networking, storage, lighting |
| Electricity and water used **by the cooling system** | The electricity the GPUs themselves use, carbon, cost |
| Evaporation + drift + **blowdown** water (blowdown labelled separately) | Water used to generate the electricity (indirect water) |
| Low / typical / high range from the PDF's three parameter values | Weather year-to-year variation (one typical year is used) |

---

## 2. Decisions already agreed

| # | Decision |
|---|---|
| D1 | **GPU heat only.** The heat from Module 1 is the cooling load `Q_IT`. The website says so plainly. |
| D2 | **Blowdown water is included** and shown as its own line next to evaporation and drift. |
| D3 | **The three values in the PDF are a range.** The first value is always the worst case (most resources) and the last is the best case: `SFP` 1.25/0.75/0.50, `kch` 0.560/0.500/0.500, `fcap` 0.70/0.80/0.94, `Tfws` 27/32/40 °C, `R` 45/70/110. They map to **High use / Typical / Low use**. |
| D4 | **Inconsistencies in the PDF are resolved by me** using the recommended engineering choice, and each one is listed in §3 and on the website's Assumptions panel. |
| D5 | **Only two techniques.** Immersion is removed from the comparison, ranking and charts. It stays on information pages as "not modelled yet". |
| D6 | **Same folder pattern as `ml_module/`**: a `data/` folder, `test_*.py` files run with `unittest`, a `README.md`. One deliberate difference: `cooling_module/` is a Python **package** (it has an `__init__.py` and imports itself as `cooling_module.x`), because `ml_module/api.py` has to import it. Tests run from the repo root: `python -m unittest discover -s cooling_module -t . -p "test_*.py"`. |

---

## 3. Gaps and inconsistencies in the PDF, and how they are resolved

| # | Issue in the PDF | Resolution |
|---|---|---|
| R1 | Air cooling sums **by month**, direct-to-chip **by time step**. | Use **hourly** steps (8,760 per year) for both, with monthly totals reported. *Measured:* the original reasoning ("monthly averages hide hot hours and underestimate chiller use") did **not** hold for air cooling in Ashburn: calculating it exactly as the PDF writes it (monthly mean weather) differs from the hourly answer by less than 1 % (0.2618 vs 0.2625 kWh/kWh, 1.99 vs 1.97 L/kWh), because the chiller ramp is roughly symmetric and the errors cancel. Hourly steps are kept because direct-to-chip's clamped temperature thresholds are hourly in the PDF itself, and it costs nothing. |
| R2 | Air pressure is 101.325 kPa (Section 2) but 100.5 kPa (Section 4). | Use the **hourly station pressure from the weather file** (Dulles, about 95 m elevation, about 100 kPa). If an hour is missing, fall back to the altitude-based standard value. |
| R3 | Tower fan electricity is 0.0586 kW/ton in Section 1 (from its formula) and 0.0556 kW/ton in Section 3. | Use the **formula value 0.0586** (0.7457 × 3 / 38.2) in both, so the two techniques use the same towers. Keep `kcw = 0.057 kW/ton` for the direct-to-chip liquid-side tower, because its pumps are not in `kpump`. In the air model the condenser pumps are already inside `kpump` (`wcw × gcw`), so `kcw` is not added there. |
| R4 | `w_out` and `h_out` (air leaving the tower) are not defined. | The air leaves **saturated at `T_ao`**, the standard assumption. |
| R5 | `fevap` can go outside 0–1 when outdoor air is hot and humid (the denominator `h_out − h_in` gets small or negative). | Clamp `fevap` to [0, 1]. If `h_out ≤ h_in`, set `fevap = 1` (all heat leaves by evaporation). The number of hours this happens is counted and reported. |
| R6 | Units are mixed (°F, °C, W/cfm, gpm, tons). | Everything is converted to **SI internally** in `parameters.py`. °F *differences* × 5/9, °F temperatures → °C. Each converted value has a unit test against the PDF. |
| R7 | The PDF stops at evaporation + drift (D2). | **Blowdown** = `evaporation / (COC − 1) − drift` (not below 0), with **cycles of concentration COC = 4**, a common typical value. Stated on the website. |
| R8 | Drift `d = 0.0005 %` | Used as the fraction **5 × 10⁻⁶** of circulating water. Circulating water = tower heat / (cp × ΔT_range). |
| R9 | Module 1 gives heat for a number of hours/day and days/year, but not **which** hours. | The load is **spread evenly over every hour of the year**: hourly heat = heat load (kW) × (hours/day ÷ 24) × (days/year ÷ 365). Stated on the website. Night-only or winter-only operation would give different results. |
| R10 | The UPS factor (`1/ηUPS`) assumes the load is fed through the UPS. | Kept as in the PDF: the GPUs' power goes through the UPS, so its losses are counted as GPU-related heat. |
| R11 | `fevap` "0.61 to 0.85" and `hfg` "2,437 to 2,495 kJ/kg" are listed as values. | They are **results**, not inputs. They are used as sanity checks in the tests. |

---

## 4. Data: Ashburn, VA (stored in the repo)

| File | Contents |
|---|---|
| `data/ashburn_va_hourly.csv` | 8,760 rows: `month, day, hour, dry_bulb_c, dew_point_c, rel_humidity_pct, pressure_kpa, wet_bulb_c` |
| `data/ashburn_va.json` | Site metadata: name, latitude/longitude, elevation, weather source and URL, station ID, years covered, licence, SHA-256 of the CSV, and a monthly summary (mean dry-bulb and wet-bulb) |
| `data/README.md` | Where the data came from, how it was converted, and the terms of use |

- **Source:** TMYx typical year for **Washington Dulles Intl AP (WMO 724030)**, from `climate.onebuilding.org`. The airport is about 10 km from Ashburn. The latest TMYx period is used and the exact file name is recorded.
- **Conversion:** a one-off script `prepare_weather.py` reads the EPW file, keeps the columns above and computes wet-bulb from dry-bulb, humidity and pressure (§5). It writes the CSV and JSON. The raw EPW is not committed. The CSV is the "hard-coded" data the model reads.
- **Checks:** 8,760 rows, no gaps, physical ranges (−30 to 45 °C, RH 0–100%, wet-bulb ≤ dry-bulb), and monthly means compared with published Dulles climate normals.

---

## 5. Code layout (`cooling_module/`)

| File | Role |
|---|---|
| `parameters.py` | Every constant from the PDF, in SI, as frozen dataclasses: `AirParams`, `D2CParams`, `TowerParams`, plus a `SCENARIOS = {"high_use", "typical", "low_use"}` mapping (D3). Constants that are derived (`efan`, `kpump`, `ktower`) are computed from their formulas, not typed in. |
| `psychrometrics.py` | Moist-air formulas (ASHRAE Fundamentals): saturation pressure, humidity ratio `w`, enthalpy `h`, wet-bulb (solved iteratively), `hfg(T) = 2501 − 2.361·T`, and `fevap` (with R4, R5) |
| `weather.py` | Safe loader for the Ashburn CSV: allow-listed path, size cap, fixed columns and dtypes, range checks, SHA-256 checked against `ashburn_va.json` (same approach as `ml_module/common.py`) |
| `tower.py` | Shared cooling-tower water calculation: evaporation, drift, blowdown for a given heat and hour (used by both techniques) |
| `air.py` | PDF Sections 1 + 2, per hour: fans, chiller, pumps, tower fans; tower heat `Q_rej`; water |
| `direct_to_chip.py` | PDF Sections 3 + 4, per hour: CDU and facility pumps, dry-cooler/tower/chiller split (`T1`, `T2`, `fdry`, `ftwr`, `fch`), liquid-side tower, small air-side system; water from both towers |
| `model.py` | Entry point: `estimate_cooling({"low", "expected", "high"})` takes the annual kWh of GPU heat from Module 1 (spread evenly over the hours), runs both techniques for the three scenarios over the 8,760 hours and returns annual totals, monthly totals, a water breakdown and simple measures (§6) |
| `prepare_weather.py` | One-off EPW → CSV/JSON conversion (§4) |
| `test_parameters.py`, `test_psychrometrics.py`, `test_air.py`, `test_direct_to_chip.py`, `test_model.py`, `test_weather.py` | Tests (§8) |
| `README.md` | Written once built: what it does, how to run, results for a reference fleet, limits |

The whole calculation is vectorised with numpy over the 8,760 hours, so one run takes milliseconds. **No new dependencies:** numpy and pandas are already pinned in `ml_module/requirements.txt`.

### Range (low / typical / high)

| Output | Heat from Module 1 | Cooling parameters |
|---|---|---|
| **Low** | low end of the planning range | Low use (best-case values) |
| **Typical** (headline) | expected | Typical |
| **High** | high end of the planning range | High use (worst-case values) |

---

## 6. What the model returns (per technique)

```json
{
  "technique": "air",
  "electricity_kwh":   {"low": …, "typical": …, "high": …},
  "water_litres":      {"low": …, "typical": …, "high": …},
  "water_breakdown_litres": {"evaporation": …, "drift": …, "blowdown": …},          // typical
  "electricity_breakdown_kwh": {"fans": …, "chiller": …, "pumps": …, "tower": …},   // typical
  "monthly": [{"month": 1, "electricity_kwh": …, "water_litres": …}, … 12],         // typical
  "kwh_per_kwh_heat": …,         // cooling electricity per kWh of GPU heat (partial PUE − 1)
  "litres_per_kwh_heat": …,      // water per kWh of GPU heat (WUE-style)
  "chiller_hours": …,            // hours the chiller runs at all
  "notes": ["…"]                 // e.g. hours where fevap was clamped (R5)
}
```

Direct-to-chip also returns its yearly split of liquid heat between **dry cooler / tower / chiller**. This shows how much of the year in Ashburn needs no water at all.

---

## 7. Connecting it to the website

### 7.1 Prediction service (`ml_module/api.py`)
- New endpoint **`POST /api/v1/analysis`**. It takes the same body as `/annual-heat`, runs Module 1, passes its `heat_load_mw` (low/expected/high) and the load factor (R9) into `cooling_module.model.estimate_cooling`, and returns `{heat: …, cooling: [air, direct_to_chip], site: {name, weather_source, monthly_climate}, assumptions: […]}`.
- `/api/v1/annual-heat` stays as it is (the command-line tools and existing tests use it).
- The same security rules as now: pydantic range checks, 127.0.0.1 only, CORS limited to Vite, no internals in errors. The weather file is loaded and hash-checked once at start-up.

### 7.2 Web app (`web_app/src/`)

| Area | Change |
|---|---|
| `types/analysis.ts` | `CoolingTechniqueId = 'air' \| 'direct-to-chip'`. `CoolingEstimate` gets `waterBreakdown`, `electricityBreakdown`, `monthly`, `kwhPerKwhHeat`, `litresPerKwhHeat`. `Range` keeps `low/value/high`. |
| `services/` | A new `analysisClient.ts` (HTTP client for `/api/v1/analysis`, strict response parsing like `parseApiResponse`). `runAnalysis` uses it. `coolingModel.ts` placeholder factors are deleted; a mock analysis client stays for tests. |
| `data/coolingTechniques.ts` | Placeholder factors removed; only names and descriptions of the two techniques remain. |
| `data/regions.ts` | Ashburn climate note updated (real weather is now used). |
| `components/results/CoolingComparison.tsx` | Two rows: electricity and water with low–high ranges, the two per-kWh-heat measures, and water split into evaporation / drift / blowdown. |
| `components/results/MonthlyBreakdown.tsx` (new) | Monthly bar chart, switchable between electricity and water, both techniques side by side. Lightweight SVG like the existing chart. |
| `components/results/ClimatePanel.tsx` (new, collapsible) | Ashburn monthly dry-bulb and wet-bulb temperatures and the weather source |
| `components/results/AssumptionsPanel.tsx` | Rewritten: equations used, parameter table (High use / Typical / Low use), R1–R11, blowdown, GPU-heat-only, even-load assumption |
| `components/results/RankingPanel.tsx`, `services/ranking.ts` | Work with two techniques and the real numbers (still the Module 3 placeholder). |
| `pages/HomePage`, `HowItWorksPage`, `faq.ts`, `AboutPage` | Text updated: two techniques modelled, immersion "planned", how Module 2 works. |
| `state/storage.ts` | Storage version bumped so old saved results (with immersion and placeholder numbers) are discarded safely. |

### 7.3 User flow (agreed)
1. **Home** → "Start a prediction".
2. **Predict**: the same five inputs (GPUs, SM %, memory %, hours/day, days/year). Location shown as fixed "Ashburn, Virginia, USA". No new inputs.
3. **Run prediction** → "Analysing…" → one call to `/api/v1/analysis`. Invalid inputs → field errors. Service down → "start `python ml_module/api.py`". Either way the user stays on the page.
4. **Results**, top to bottom: input summary + *Edit inputs* → heat (Module 1) → **cooling comparison** (table + chart with ranges) → **month-by-month chart** → Ashburn climate (collapsible) → ranking (placeholder) → assumptions & method (collapsible).
5. *Edit inputs* → change → *Run prediction* again → results update.

---

## 8. Tests (written before the code)

**Parameters and units**
- `efan` = 0.197 / 0.118 / 0.079. `kpump` = 0.1098 kW/ton. `ktower` = 0.0586 kW/ton. `24/ΔTchw` = 2.4 gpm/ton. All of these must match the PDF to 3 significant figures.
- °F → °C conversions: ΔT 10 °F → 5.56 °C, `atower` 7 °F → 3.89 °C, `ahx` 3 °F → 1.67 °C.

**Psychrometrics**
- Saturation pressure and humidity ratio match ASHRAE table values (for example at 20 °C and 101.325 kPa).
- Wet-bulb ≤ dry-bulb. Wet-bulb = dry-bulb at 100% humidity. Matches known pairs to ±0.2 °C.
- `hfg(30) ≈ 2430 kJ/kg`.

**Air cooling**
- `fmech = 0` when wet-bulb ≤ 45 °F (7.2 °C), `= 1` when ≥ 55 °F (12.8 °C), linear in between.
- One hand-worked hour (written out in the test) matches the code.
- Zero heat → zero electricity and zero water. Doubling the heat doubles both (the model is linear in load).
- A cold hour uses no chiller electricity.

**Direct-to-chip**
- `fdry + ftwr + fch = 1` every hour, each in [0, 1].
- Cold hour → all dry cooler, no water on the liquid side. Hot humid hour → chiller share > 0.
- A higher `Tfws` never increases electricity or water.
- A higher `fcap` reduces the air-side share.

**Water**
- Water = evaporation + drift + blowdown. Blowdown = evaporation / 3 − drift (COC = 4), never negative.
- `fevap` is always in [0, 1]. Most hours in Ashburn are in about 0.6–0.9.

**Whole model (Ashburn)**
- Low ≤ typical ≤ high for both techniques.
- Direct-to-chip uses less electricity *and* less water than air cooling for the same heat.
- **Sanity range check against published figures:** air cooling at about 0.2–0.5 kWh cooling per kWh heat and about 1–3 L per kWh heat, direct-to-chip clearly lower. A result outside these ranges does not fail the build, but it is printed and investigated.
- Monthly values add up to the annual totals.

**API and website**
- `/api/v1/analysis` returns the documented shape. It rejects bad input with 422 and never leaks internals.
- The web client rejects malformed responses. The Results page shows two techniques, ranges, the water breakdown and the monthly chart. Old stored results are discarded.

---

## 9. Implementation steps and checklist

### Phase A: Data
- [x] **A.1** Download the Dulles TMYx file. Write `prepare_weather.py` (tests first for the EPW parser on a small sample).
- [x] **A.2** Generate `data/ashburn_va_hourly.csv` + `ashburn_va.json` + `data/README.md`. Check against Dulles climate normals.
- [x] **A.3** `weather.py` safe loader + `test_weather.py` → commit

### Phase B: Building blocks
- [x] **B.1** `parameters.py` (three scenarios, SI units, derived constants) + `test_parameters.py`
- [x] **B.2** `psychrometrics.py` + `test_psychrometrics.py`
- [x] **B.3** `tower.py` (evaporation, drift, blowdown) + tests → commit

### Phase C: Cooling models
- [x] **C.1** `air.py` (Sections 1 + 2) + `test_air.py`, including the hand-worked hour and the monthly-average comparison (R1)
- [x] **C.2** `direct_to_chip.py` (Sections 3 + 4) + `test_direct_to_chip.py`
- [x] **C.3** `model.py` (scenarios, ranges, monthly, breakdowns, measures) + `test_model.py`
- [x] **C.4** Run for a reference fleet (for example 500 GPUs, 60% SM, 30% memory, 24/365). Compare with the published ranges and write `README.md` → commit

### Phase D: Service
- [x] **D.1** `POST /api/v1/analysis` in `ml_module/api.py` + API tests → commit

### Phase E: Website
- [x] **E.1** Types + `analysisClient.ts` (+ mock) + tests. Remove placeholder factors and immersion from the model. (the mock is test-only: `src/test/mockBackend.ts`; `coolingModel.ts` and `heatPrediction.ts` were deleted)
- [x] **E.2** `CoolingComparison` (ranges, water breakdown, per-kWh measures)
- [x] **E.3** `MonthlyBreakdown` and `ClimatePanel`
- [x] **E.4** `AssumptionsPanel` rewrite; ranking works with two techniques
- [x] **E.5** Page texts and FAQ updated; storage version bump
- [ ] **E.6** `npm run check` green (done: lint, types, 191 tests, build), then manual run in the browser (**not done**: the Chrome extension was not connected; the real service response was checked against the website's client with a throwaway test instead) → commit

### Phase F: Wrap-up
- [x] **F.1** Root `README.md` and `web_app/README.md` updated (Module 2 no longer a placeholder)
- [x] **F.2** `web_app/docs/PROJECT_PLAN.md` updated to match

---

## 10. Known limits (to state in the report)
- One typical weather year for one site. Hot or cold years will differ.
- The load is assumed even across the year (R9).
- GPU heat only (D1). Module 1's V100-only limit carries through.
- Fixed part-load behaviour: chiller and fan efficiencies don't change with load, as in the PDF.
- Blowdown depends on local water quality. COC = 4 is an assumption.
- Immersion cooling is not modelled.

---

## 11. Progress log

| Date | Step(s) | Result | Commit |
|---|---|---|---|
| 2026-11-07 | Plan | Plan written (`cooling_module/PLAN.md`) | — |
| 2026-11-07 | A.1 - A.3 | Dulles TMYx 2011-2025 converted to `data/ashburn_va_hourly.csv`; monthly means equal the EPW's own statistics; wet-bulb within 0.73 K of an independent formula (done after B.2, which it needs) | uncommitted |
| 2026-11-07 | B.1 - B.3 | Parameters (PDF values reproduced), psychrometrics, tower water | uncommitted |
| 2026-11-07 | C.1 - C.4 | Air and direct-to-chip models, `estimate_cooling`, README; 120 tests. Reference fleet: air 0.26 kWh and 1.97 L per kWh of heat, direct-to-chip 0.08 kWh and 0.58 L. R1 corrected (see above) | uncommitted |
| 2026-11-07 | D.1 | `POST /api/v1/analysis` + 5 API tests; checked live including CORS | uncommitted |
| 2026-11-07 | E.1 - E.5, F.1 - F.2 | Website uses the real model: strict client/parser, comparison with ranges and water split, month-by-month chart, climate and assumptions panels, two techniques; 191 web tests, `npm run check` green | uncommitted |
