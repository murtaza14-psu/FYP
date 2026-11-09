"""One-off converter: an EnergyPlus weather file (EPW, typical meteorological year) -> the hourly CSV the model reads.

    python -m cooling_module.prepare_weather <file.epw> --source-url <url> --period 2011-2025

Writes cooling_module/data/ashburn_va_hourly.csv (8,760 rows) and ashburn_va.json (site, source, SHA-256 of
the CSV, monthly climate summary). The raw EPW is not stored in the repo. Run it again only to change the
weather year; see cooling_module/data/README.md.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import date
from pathlib import Path

import numpy as np

from cooling_module import psychrometrics as P

DATA_DIR = Path(__file__).resolve().parent / "data"
CSV_NAME = "ashburn_va_hourly.csv"
JSON_NAME = "ashburn_va.json"
CSV_COLUMNS = ["month", "day", "hour", "dry_bulb_c", "dew_point_c", "rel_humidity_pct", "pressure_kpa", "wet_bulb_c"]

HEADER_LINES = 8
HOURS_PER_YEAR = 8760
MAX_EPW_BYTES = 5 * 1024**2
DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]  # EPW typical years have no 29 February

# EPW "missing" codes and the physical range accepted for each field.
_LIMITS = {
    "dry_bulb_c": (-40.0, 50.0, 99.9),
    "dew_point_c": (-60.0, 40.0, 99.9),
    "rel_humidity_pct": (0.0, 100.0, 999.0),
    "pressure_kpa": (90.0, 105.0, 999.999),
}


def _expected_calendar() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    months, days, hours = [], [], []
    for m, n in enumerate(DAYS_IN_MONTH, start=1):
        for d in range(1, n + 1):
            for h in range(1, 25):
                months.append(m), days.append(d), hours.append(h)
    return np.array(months), np.array(days), np.array(hours)


def parse_epw(text: str) -> tuple[dict, dict[str, np.ndarray]]:
    """Read the site line and the hourly rows of an EPW. Raises ValueError on anything unexpected."""
    lines = [ln for ln in text.splitlines() if ln.strip()]
    loc = lines[0].split(",") if lines else []
    if len(loc) < 10 or loc[0].strip().upper() != "LOCATION":
        raise ValueError("first line is not a valid EPW LOCATION record")
    try:
        site = {
            "station_name": loc[1].strip(), "state": loc[2].strip(), "country": loc[3].strip(),
            "wmo_id": loc[5].strip(), "latitude": float(loc[6]), "longitude": float(loc[7]),
            "time_zone_hours": float(loc[8]), "elevation_m": float(loc[9]),
        }
    except ValueError as e:
        raise ValueError("EPW LOCATION record has non-numeric coordinates") from e

    rows = lines[HEADER_LINES:]
    if len(rows) != HOURS_PER_YEAR:
        raise ValueError(f"expected {HOURS_PER_YEAR} hourly rows, found {len(rows)}")

    raw = np.empty((HOURS_PER_YEAR, 7))
    for i, row in enumerate(rows):
        f = row.split(",")
        if len(f) < 10:
            raise ValueError(f"row {i + 1} has too few fields")
        try:
            raw[i] = [float(f[1]), float(f[2]), float(f[3]), float(f[6]), float(f[7]), float(f[8]), float(f[9]) / 1000.0]
        except ValueError as e:
            raise ValueError(f"row {i + 1} has a non-numeric field") from e

    months, days, hours = _expected_calendar()
    if not (np.array_equal(raw[:, 0], months) and np.array_equal(raw[:, 1], days) and np.array_equal(raw[:, 2], hours)):
        raise ValueError("hourly rows are not one non-leap year in date order")

    cols = {"month": months, "day": days, "hour": hours}
    for k, name in enumerate(("dry_bulb_c", "dew_point_c", "rel_humidity_pct", "pressure_kpa"), start=3):
        lo, hi, missing = _LIMITS[name]
        values = raw[:, k]
        if np.any(values >= missing - 1e-9):
            raise ValueError(f"{name} contains the EPW 'missing' code")
        if np.any(values < lo) or np.any(values > hi):
            raise ValueError(f"{name} is outside {lo} to {hi}")
        cols[name] = values
    return site, cols


def add_wet_bulb(cols: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    out = dict(cols)
    out["wet_bulb_c"] = P.wet_bulb_c(cols["dry_bulb_c"], cols["rel_humidity_pct"], cols["pressure_kpa"])
    return out


def to_csv(cols: dict[str, np.ndarray]) -> str:
    fmt = {"month": "{:d}", "day": "{:d}", "hour": "{:d}", "dry_bulb_c": "{:.2f}", "dew_point_c": "{:.2f}",
           "rel_humidity_pct": "{:.1f}", "pressure_kpa": "{:.3f}", "wet_bulb_c": "{:.2f}"}
    out = [",".join(CSV_COLUMNS)]
    for i in range(HOURS_PER_YEAR):
        out.append(",".join(fmt[c].format(cols[c][i]) for c in CSV_COLUMNS))
    return "\n".join(out) + "\n"


def monthly_summary(cols: dict[str, np.ndarray]) -> list[dict]:
    out = []
    for m in range(1, 13):
        sel = cols["month"] == m
        out.append({
            "month": m,
            "hours": int(sel.sum()),
            "mean_dry_bulb_c": round(float(cols["dry_bulb_c"][sel].mean()), 2),
            "mean_wet_bulb_c": round(float(cols["wet_bulb_c"][sel].mean()), 2),
            "mean_rel_humidity_pct": round(float(cols["rel_humidity_pct"][sel].mean()), 1),
            "min_dry_bulb_c": round(float(cols["dry_bulb_c"][sel].min()), 1),
            "max_dry_bulb_c": round(float(cols["dry_bulb_c"][sel].max()), 1),
        })
    return out


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("epw", type=Path)
    ap.add_argument("--source-url", required=True)
    ap.add_argument("--period", required=True, help="years the typical year was built from, e.g. 2011-2025")
    args = ap.parse_args(argv)

    if args.epw.stat().st_size > MAX_EPW_BYTES:
        raise SystemExit("EPW file is larger than the 5 MB safety limit")
    raw = args.epw.read_bytes()
    site, cols = parse_epw(raw.decode("utf-8", errors="replace"))
    cols = add_wet_bulb(cols)

    csv_bytes = to_csv(cols).encode("ascii")
    DATA_DIR.mkdir(exist_ok=True)
    (DATA_DIR / CSV_NAME).write_bytes(csv_bytes)

    meta = {
        "site_name": "Ashburn, Virginia, USA",
        "weather_station": f"{site['station_name']} (WMO {site['wmo_id']})",
        "station": site,
        "station_note": "Washington Dulles International Airport, about 10 km from Ashburn (Loudoun County).",
        "weather_source": "Climate.OneBuilding.Org, TMYx typical meteorological year",
        "source_url": args.source_url,
        "source_file": args.epw.name,
        "period_of_record": args.period,
        "retrieved": date.today().isoformat(),
        "epw_sha256": sha256_bytes(raw),
        "csv_file": CSV_NAME,
        "csv_sha256": sha256_bytes(csv_bytes),
        "rows": HOURS_PER_YEAR,
        "columns": CSV_COLUMNS,
        "wet_bulb_method": "ASHRAE Fundamentals ch. 1 (Hyland-Wexler saturation pressure, psychrometric equation), solved by bisection",
        "monthly": monthly_summary(cols),
    }
    (DATA_DIR / JSON_NAME).write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {CSV_NAME} ({len(csv_bytes) / 1024:.0f} kB) and {JSON_NAME}")


if __name__ == "__main__":
    main()
