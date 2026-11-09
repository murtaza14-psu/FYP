"""Safe loader for the Ashburn, VA hourly weather (one typical year, 8,760 hours).

Same approach as ml_module/common.py: fixed file names inside cooling_module/data, a size cap, an
explicit column list, range checks, and a SHA-256 of the CSV recorded in ashburn_va.json that is
verified before the numbers are used. The hash catches corruption or an edited file; it does not
protect against someone who can edit both files.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

DATA_DIR = Path(__file__).resolve().parent / "data"
CSV_NAME = "ashburn_va_hourly.csv"
JSON_NAME = "ashburn_va.json"
MAX_FILE_BYTES = 5 * 1024**2
HOURS_PER_YEAR = 8760
COLUMNS = ["month", "day", "hour", "dry_bulb_c", "dew_point_c", "rel_humidity_pct", "pressure_kpa", "wet_bulb_c"]
DAYS_IN_MONTH = np.array([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])


@dataclass(frozen=True)
class Weather:
    month: np.ndarray  # 1-12
    day: np.ndarray
    hour: np.ndarray  # 1-24
    dry_bulb_c: np.ndarray
    dew_point_c: np.ndarray
    rel_humidity_pct: np.ndarray
    pressure_kpa: np.ndarray
    wet_bulb_c: np.ndarray
    site: dict

    @property
    def n_hours(self) -> int:
        return int(self.month.shape[0])

    @property
    def month_index(self) -> np.ndarray:
        """0-11, for np.bincount."""
        return self.month - 1

    @property
    def hours_per_month(self) -> np.ndarray:
        return np.bincount(self.month_index, minlength=12)


def _read_capped(path: Path) -> bytes:
    if not path.is_file():
        raise FileNotFoundError(f"{path.name} not found in {path.parent}")
    if path.stat().st_size > MAX_FILE_BYTES:
        raise ValueError(f"{path.name} exceeds the {MAX_FILE_BYTES >> 20} MB size limit")
    return path.read_bytes()


def load_ashburn(data_dir: Path | str = DATA_DIR) -> Weather:
    """Read and validate the Ashburn weather. Raises on any missing, altered or implausible data."""
    data_dir = Path(data_dir)
    meta_bytes = _read_capped(data_dir / JSON_NAME)
    csv_bytes = _read_capped(data_dir / CSV_NAME)
    try:
        site = json.loads(meta_bytes)
        expected = str(site["csv_sha256"])
    except (ValueError, KeyError, TypeError) as e:
        raise ValueError(f"{JSON_NAME} is not valid site metadata") from e
    if not hmac.compare_digest(hashlib.sha256(csv_bytes).hexdigest(), expected):
        raise RuntimeError(f"{CSV_NAME} does not match the SHA-256 in {JSON_NAME}")

    lines = csv_bytes.decode("ascii").splitlines()
    if lines[0].split(",") != COLUMNS:
        raise ValueError(f"{CSV_NAME} must have exactly the columns {COLUMNS}")
    if len(lines) - 1 != HOURS_PER_YEAR:
        raise ValueError(f"{CSV_NAME} must have {HOURS_PER_YEAR} hourly rows, found {len(lines) - 1}")
    try:
        table = np.array([[float(v) for v in ln.split(",")] for ln in lines[1:]])
    except ValueError as e:
        raise ValueError(f"{CSV_NAME} contains a value that is not a number") from e
    if table.shape[1] != len(COLUMNS) or not np.all(np.isfinite(table)):
        raise ValueError(f"{CSV_NAME} contains missing or non-finite values")

    col = {name: table[:, i] for i, name in enumerate(COLUMNS)}
    month, day, hour = (col[k].astype(int) for k in ("month", "day", "hour"))
    if not (month.min() == 1 and month.max() == 12 and day.min() >= 1 and day.max() <= 31 and hour.min() >= 1 and hour.max() <= 24):
        raise ValueError("month, day or hour is out of range")
    if not np.array_equal(np.bincount(month - 1, minlength=12), DAYS_IN_MONTH * 24):
        raise ValueError("hours per month do not describe a non-leap year")

    db, dp, rh, p, wb = (col[k] for k in ("dry_bulb_c", "dew_point_c", "rel_humidity_pct", "pressure_kpa", "wet_bulb_c"))
    if not (np.all((db > -40) & (db < 50)) and np.all((rh >= 0) & (rh <= 100)) and np.all((p > 90) & (p < 105))):
        raise ValueError("temperature, humidity or pressure is outside the physical range")
    if np.any(wb > db + 0.01) or np.any(dp > db + 0.01):
        raise ValueError("wet-bulb or dew-point temperature is above the dry-bulb temperature")

    arrays = dict(month=month, day=day, hour=hour, dry_bulb_c=db, dew_point_c=dp, rel_humidity_pct=rh,
                  pressure_kpa=p, wet_bulb_c=wb)
    for a in arrays.values():
        a.setflags(write=False)
    return Weather(**arrays, site=site)


def monthly_average(w: Weather) -> Weather:
    """Twelve rows, each the mean weather of one month. Only for comparing with the PDF's monthly sums (PLAN.md R1)."""
    def mean(a):
        return np.bincount(w.month_index, weights=a, minlength=12) / w.hours_per_month

    months = np.arange(1, 13)
    return Weather(month=months, day=np.ones(12, dtype=int), hour=np.ones(12, dtype=int),
                   dry_bulb_c=mean(w.dry_bulb_c), dew_point_c=mean(w.dew_point_c),
                   rel_humidity_pct=mean(w.rel_humidity_pct), pressure_kpa=mean(w.pressure_kpa),
                   wet_bulb_c=mean(w.wet_bulb_c), site=w.site)
