# Ashburn, VA weather data

| File | Contents |
|---|---|
| `ashburn_va_hourly.csv` | 8,760 hourly rows of one typical year: `month, day, hour (1-24), dry_bulb_c, dew_point_c, rel_humidity_pct, pressure_kpa, wet_bulb_c` |
| `ashburn_va.json` | Site and source details, the SHA-256 of the CSV, and a monthly climate summary (the website's Climate panel reads it) |

## Source
- **Station:** Washington Dulles International Airport (WMO 724030), 38.977 N, 77.486 W, 88 m above sea level. It is the nearest long-record airport station to Ashburn (about 10 km).
- **Product:** TMYx typical meteorological year built from 2011-2025 observations (NCEI ISD / ERA5), from [Climate.OneBuilding.Org](https://climate.onebuilding.org):
  `USA_VA_Dulles-Washington.Dulles.Intl.AP.724030_TMYx.2011-2025.zip`.
- **Retrieved:** 2026-11-07. SHA-256 of the original `.epw`: recorded in `ashburn_va.json` (`epw_sha256`).
- **Typical year:** each month is taken from the most typical real year of the record (Jan 2021, Feb 2016, Mar 2022, Apr 2015, May 2022, Jun 2020, Jul 2019, Aug 2018, Sep 2022, Oct 2018, Nov 2022, Dec 2018). It is not an average, and it does not show hot-summer or cold-winter extremes.

## Conversion (`python -m cooling_module.prepare_weather`)
Dry-bulb, dew-point, relative humidity and station pressure are copied from the EPW (pressure converted from Pa to kPa). **Wet-bulb temperature is computed**, because the cooling equations need it: ASHRAE Fundamentals chapter 1 saturation pressure (Hyland-Wexler) and psychrometric equation, solved by bisection (`cooling_module/psychrometrics.py`).

## Checks that were run
- 8,760 rows, no EPW "missing" codes, every field inside a physical range, hours in date order for a 365-day year.
- Monthly mean dry-bulb temperatures equal the monthly values in the EPW's own `.stat` file (2.1, 2.6, 9.3, 13.3, 19.0, 23.0, 26.3, 24.8, 20.8, 15.0, 9.8, 4.2 degC).
- Computed wet-bulb is never above dry-bulb and agrees with Stull's (2011) independent approximation to within 0.73 K over all 8,760 hours.
- Climate is consistent with Northern Virginia: annual mean about 13 degC, January about 2 degC, July about 26 degC. The hottest hour has a wet-bulb of 29.2 degC (30.6 degC, 90 % humidity).

## Terms of use
The weather files are offered for download for building-energy simulation. **The site pages checked state a copyright notice and no explicit licence**, so check [climate.onebuilding.org](https://climate.onebuilding.org) before redistributing this CSV outside the project, and cite the source (above) in the report.

## Limits
- One site, one typical year (decision recorded in `PLAN.md`). Real years differ from it.
- The airport is not the data-centre campus; local conditions (heat island, a few hundred metres of terrain) are not captured.
