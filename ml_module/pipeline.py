"""Data-centre inputs -> annual heat, using the ensemble of all five trained models.

    from pipeline import DataCenter, HeatPipeline
    result = HeatPipeline.load().estimate(DataCenter(n_gpus=500, sm_util_pct=60, mem_util_pct=30,
                                                     hours_per_day=12, days_per_year=365))

How it works
1. Each of the five models predicts the average power of ONE GPU from SM and memory
   utilisation, with a 90% band (common.predict_power, clipped to the physical range).
2. The ensemble is the plain average of the five expected values, and of the five lower
   and five upper band edges. On the held-out users this scored MAE 8.4 W, R2 0.920 and
   89.8% band coverage (see artifacts/ensemble_metrics.json, written by evaluate_ensemble.py).
3. Nearly all GPU electrical power leaves as heat, so
       heat load (MW)     = GPUs x power per GPU
       annual heat (MWh)  = heat load x hours/day x days/year
4. Two ranges are returned for the fleet (common.fleet_heat_range): "shared error" (every GPU
   off in the same direction, use for planning) and "independent GPUs" (optimistic).

Limits that still apply: V100 training data, GPU power only (no CPU / network / storage / pumps),
and utilisation means DCGM SM / memory utilisation.
"""

from __future__ import annotations

import hmac
import json
import math
import os
import pickle
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn

# Windows 11 has no `wmic`, so joblib cannot count physical cores and prints a traceback (not a
# filterable warning) on first use. Pre-filling its cache with the logical core count is harmless.
try:
    from joblib.externals.loky.backend import context as _loky_context

    if getattr(_loky_context, "physical_cores_cache", 1) is None:
        _loky_context.physical_cores_cache = os.cpu_count() or 1
except Exception:  # internals may change between joblib versions; the message is cosmetic
    pass

import common as C  # noqa: E402

MODEL_NAMES = ["m1_linear", "m2_random_forest", "m3_gradient_boosting", "m4_svr", "m5_neural_network"]
BOUNDS_FILE = "power_bounds.json"
BUNDLE_VERSION = 1
DEFAULT_BUNDLE = C.ARTIFACTS / "annual_heat_ensemble.pkl"

MAX_GPUS = 1_000_000
# The models disagree most where the data is thin; flag it above this spread of expected power.
HIGH_DISAGREEMENT_W = 25.0


class InputError(ValueError):
    """Raised for inputs that are missing, not numbers, or outside the allowed range."""


def _number(name: str, value, lo: float, hi: float, *, integer: bool = False, lo_open: bool = False) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float, np.integer, np.floating)):
        raise InputError(f"{name} must be a number")
    v = float(value)
    if not math.isfinite(v):
        raise InputError(f"{name} must be a finite number")
    if integer and v != int(v):
        raise InputError(f"{name} must be a whole number")
    if v < lo or v > hi or (lo_open and v == lo):
        left = ">" if lo_open else ">="
        raise InputError(f"{name} must be {left} {lo:,g} and <= {hi:,.0f}" if hi >= 1e5 else f"{name} must be {left} {lo:g} and <= {hi:g}")
    return int(v) if integer else v


@dataclass(frozen=True)
class DataCenter:
    """What the operator enters about the facility."""

    n_gpus: int
    sm_util_pct: float          # average SM (compute) utilisation across the GPUs, 0-100
    mem_util_pct: float         # average memory utilisation across the GPUs, 0-100
    hours_per_day: float = 24.0  # hours per day the GPUs are in use
    days_per_year: int = 365     # days per year they are in use

    def __post_init__(self) -> None:
        object.__setattr__(self, "n_gpus", _number("n_gpus", self.n_gpus, 1, MAX_GPUS, integer=True))
        object.__setattr__(self, "sm_util_pct", _number("sm_util_pct", self.sm_util_pct, 0, 100))
        object.__setattr__(self, "mem_util_pct", _number("mem_util_pct", self.mem_util_pct, 0, 100))
        object.__setattr__(self, "hours_per_day", _number("hours_per_day", self.hours_per_day, 0, 24, lo_open=True))
        object.__setattr__(self, "days_per_year", _number("days_per_year", self.days_per_year, 1, 366, integer=True))

    @property
    def operating_hours_per_year(self) -> float:
        return self.hours_per_day * self.days_per_year


def _load_bounds() -> tuple[float, float]:
    raw = json.loads((C.ARTIFACTS / BOUNDS_FILE).read_text())
    floor, cap = float(raw["floor_w"]), float(raw["cap_w"])
    if not (0 < floor < cap < 2000):
        raise RuntimeError(f"{BOUNDS_FILE} holds implausible GPU power limits")
    return floor, cap


class HeatPipeline:
    """Loads the five models once (SHA-256 verified) and answers any number of queries."""

    def __init__(self, models: dict[str, tuple[object, dict]], bounds: tuple[float, float]):
        if not models:
            raise ValueError("no models given")
        self.models, self.bounds = models, bounds

    @classmethod
    def load(cls, names: list[str] | None = None) -> "HeatPipeline":
        names = names or MODEL_NAMES
        missing = [n for n in names if not (C.ARTIFACTS / n / "model.joblib").exists()]
        if missing:
            raise FileNotFoundError(
                f"trained models not found: {', '.join(missing)}. Run `python ml_module/run_all.py` first.")
        return cls({n: C.load_model(n) for n in names}, _load_bounds())

    # --------------------------------------------------------------- .pkl bundle
    def save_bundle(self, path: str | Path) -> Path:
        """Write the whole ensemble to ONE .pkl file (plus a .sha256 next to it).

        The pickle holds only plain dicts, numpy arrays and scikit-learn estimators, so loading it
        needs scikit-learn/numpy but none of this project's code.
        """
        path = Path(path)
        bundle = {
            "format_version": BUNDLE_VERSION,
            "features": C.FEATURES,
            "models": {n: m for n, (m, _) in self.models.items()},
            "calibrations": {n: c for n, (_, c) in self.models.items()},
            "power_bounds_w": list(self.bounds),
            "library_versions": {"scikit-learn": sklearn.__version__, "numpy": np.__version__},
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as f:
            pickle.dump(bundle, f, protocol=pickle.HIGHEST_PROTOCOL)
        path.with_suffix(path.suffix + ".sha256").write_text(C._sha256(path) + "\n")
        return path

    @classmethod
    def load_bundle(cls, path: str | Path) -> "HeatPipeline":
        """Load a .pkl written by save_bundle after checking its SHA-256. Never load a .pkl you did not make."""
        path = Path(path)
        sidecar = path.with_suffix(path.suffix + ".sha256")
        if not sidecar.exists():
            raise FileNotFoundError(f"{sidecar.name} is missing, refusing to unpickle {path.name}")
        if not hmac.compare_digest(C._sha256(path), sidecar.read_text().strip()):
            raise RuntimeError(f"{path.name} does not match its .sha256, refusing to load")
        with path.open("rb") as f:
            bundle = pickle.load(f)  # noqa: S301 - hash-verified above
        if not isinstance(bundle, dict) or bundle.get("format_version") != BUNDLE_VERSION:
            raise RuntimeError("unsupported bundle format")
        floor, cap = bundle["power_bounds_w"]
        models = {n: (m, bundle["calibrations"][n]) for n, m in bundle["models"].items()}
        return cls(models, (float(floor), float(cap)))

    # ------------------------------------------------------------------ per GPU
    def per_gpu_power(self, sm_util_pct: float, mem_util_pct: float) -> dict:
        """Ensemble (low, expected, high) watts for one GPU, plus each model's expected watts."""
        X = pd.DataFrame({"sm_util_pct": [float(sm_util_pct)], "mem_util_pct": [float(mem_util_pct)]})
        lows, mids, highs, per_model = [], [], [], {}
        for name, (model, cal) in self.models.items():
            lo, mid, hi = (float(v[0]) for v in C.predict_power(model, cal, X, self.bounds))
            lows.append(lo), mids.append(mid), highs.append(hi)
            per_model[name] = mid
        return {
            "low_w": float(np.mean(lows)),
            "expected_w": float(np.mean(mids)),
            "high_w": float(np.mean(highs)),
            "model_spread_w": float(max(mids) - min(mids)),
            "per_model_w": per_model,
        }

    # -------------------------------------------------------------------- fleet
    def estimate(self, dc: DataCenter) -> dict:
        gpu = self.per_gpu_power(dc.sm_util_pct, dc.mem_util_pct)
        lo, mid, hi = gpu["low_w"], gpu["expected_w"], gpu["high_w"]
        rng = C.fleet_heat_range(dc.n_gpus, lo, mid, hi, dc.hours_per_day)
        # fleet_heat_range assumes 365 days; rescale to the requested days per year.
        scale = dc.days_per_year / 365
        shared = [v * scale for v in rng["shared_error_mwh"]]
        indep = [v * scale for v in rng["independent_gpus_mwh"]]

        warnings = ["Heat from the GPUs only: CPUs, network, storage and cooling plant are not included.",
                    "Trained on V100 jobs; other GPU generations will differ."]
        if gpu["model_spread_w"] > HIGH_DISAGREEMENT_W:
            warnings.append(
                f"The five models disagree by {gpu['model_spread_w']:.0f} W per GPU for these utilisations, "
                "which are uncommon in the training data. Treat the result with extra caution.")
        if dc.mem_util_pct > dc.sm_util_pct + 40:
            warnings.append("Memory utilisation far above SM utilisation is rare in the training data.")

        return {
            "input": asdict(dc),
            "per_gpu": gpu,
            "heat_load_mw": {"low": dc.n_gpus * lo / 1e6, "expected": dc.n_gpus * mid / 1e6,
                             "high": dc.n_gpus * hi / 1e6},
            "operating_hours_per_year": dc.operating_hours_per_year,
            "annual_heat_mwh": {
                "low": shared[0], "expected": shared[1], "high": shared[2],
                "independent_gpu_low": indep[0], "independent_gpu_high": indep[2],
            },
            "annual_heat_gwh_expected": shared[1] / 1000,
            "models_used": list(self.models),
            "interval": "90% (shared-error range; independent_gpu_* assumes GPU errors cancel and is optimistic)",
            "warnings": warnings,
        }

