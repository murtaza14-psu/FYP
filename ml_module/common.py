"""Shared plumbing for the GPU power models (data, evaluation, artifacts).

Target     : average electrical power of one GPU in watts. Essentially all of it is
             dissipated as heat, so annual heat = N x power x hours/day x days.
Features   : average SM utilisation (%) and average memory utilisation (%), both
             quantities an operator can read from DCGM / their monitoring stack.
Evaluation : the hold-out set and every CV fold are split BY USER, so scores
             estimate performance for operators the model has never seen.

Security notes
- Input is read only from ml_module/data, through an allow-listed file name, size-capped,
  with an explicit column whitelist and dtypes, and range-validated.
- No eval/exec/shell, no network access, no pickle read from outside ml_module/artifacts.
- User IDs are used only as CV group labels. They are never a feature and are never
  written to any output file.
- Model files are SHA-256 hashed when saved and verified before joblib loads them.
  That detects corruption or a swapped file; it does not defend against someone
  who can write both the model and its manifest.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from pathlib import Path

os.environ.setdefault("LOKY_MAX_CPU_COUNT", str(os.cpu_count() or 1))

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.metrics import mean_absolute_error, median_absolute_error, r2_score, root_mean_squared_error
from sklearn.model_selection import GridSearchCV, GroupKFold, GroupShuffleSplit, cross_val_predict, learning_curve

ROOT = Path(__file__).resolve().parent
DATA_DIR = (ROOT / "data").resolve()
ARTIFACTS = ROOT / "artifacts"

SEED = 42
FEATURES = ["sm_util_pct", "mem_util_pct"]
TARGET = "gpu_power_w"
MIN_RUNTIME_S = 600  # shorter runs give unreliable average power
TEST_FRACTION = 0.2
CV_FOLDS = 5
ALPHA = 0.10  # prediction interval nominal coverage = 1 - ALPHA
N_INTERVAL_BINS = 10
MAX_FILE_BYTES = 500 * 1024**2
OVERFIT_GAP = 0.30  # flag when CV-train MAE is >30% below CV-validation MAE

_DCGM_DTYPES = {
    "id_job": "int64",
    "Node": "string",
    "gpu_id": "int64",
    "smutilization_pct_avg": "float64",
    "memoryutilization_pct_avg": "float64",
    "powerusage_watts_avg": "float64",
    "totalexecutiontime_sec": "float64",
}


# --------------------------------------------------------------------------- data
def _safe_data_path(name: str) -> Path:
    path = (DATA_DIR / name).resolve()
    if not path.is_relative_to(DATA_DIR) or not path.is_file():
        raise FileNotFoundError(f"{name} not found inside {DATA_DIR}")
    if path.stat().st_size > MAX_FILE_BYTES:
        raise ValueError(f"{name} exceeds the {MAX_FILE_BYTES >> 20} MB safety limit")
    return path


def load_dataset() -> tuple[pd.DataFrame, dict]:
    """Return the cleaned modelling table (one row per job x GPU) and a cleaning report."""
    dcgm = pd.read_csv(_safe_data_path("dcgm.csv"), usecols=list(_DCGM_DTYPES), dtype=_DCGM_DTYPES)
    sched = pd.read_csv(_safe_data_path("scheduler_data.csv"), usecols=["id_job", "id_user"], dtype="int64")

    report = {"dcgm_rows": len(dcgm)}
    df = dcgm.replace([np.inf, -np.inf], np.nan).dropna()
    report["after_missing_or_inf"] = len(df)
    df = df.drop_duplicates(["id_job", "Node", "gpu_id"])
    report["after_duplicates"] = len(df)

    df = df.rename(columns={"smutilization_pct_avg": "sm_util_pct", "memoryutilization_pct_avg": "mem_util_pct",
                            "powerusage_watts_avg": TARGET, "totalexecutiontime_sec": "runtime_s"})
    valid = (
        df.sm_util_pct.between(0, 100) & df.mem_util_pct.between(0, 100)
        & (df[TARGET] > 0) & (df[TARGET] < 1000)  # zero power = sensor failure; >1 kW is not a single GPU
        & (df.runtime_s >= MIN_RUNTIME_S)
    )
    df = df[valid]
    report["after_range_and_runtime_filters"] = len(df)

    # a job id that maps to several scheduler rows has ambiguous ownership: drop it
    sched = sched[~sched.id_job.duplicated(keep=False)]
    df = df.merge(sched, on="id_job", how="inner", validate="many_to_one")
    df = df.sort_values(["id_job", "Node", "gpu_id"]).reset_index(drop=True)  # file-order independent
    report.update(final_rows=len(df), users=int(df.id_user.nunique()), jobs=int(df.id_job.nunique()))
    return df[FEATURES + [TARGET, "id_user", "id_job"]], report


def split_by_user(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Hold out whole users so no operator appears in both train and test."""
    train_idx, test_idx = next(
        GroupShuffleSplit(n_splits=1, test_size=TEST_FRACTION, random_state=SEED).split(df, groups=df.id_user)
    )
    return df.iloc[train_idx].reset_index(drop=True), df.iloc[test_idx].reset_index(drop=True)


# ----------------------------------------------------------------------- metrics
def regression_metrics(y: np.ndarray, pred: np.ndarray) -> dict:
    return {
        "mae_w": float(mean_absolute_error(y, pred)),
        "rmse_w": float(root_mean_squared_error(y, pred)),
        "median_ae_w": float(median_absolute_error(y, pred)),
        "r2": float(r2_score(y, pred)),
        # what matters for annual heat: does the total over many GPUs come out right?
        "total_bias_pct": float(100 * (pred.sum() - y.sum()) / y.sum()),
    }


# --------------------------------------------------------------------- intervals
def fit_interval(pred_oof: np.ndarray, y: np.ndarray) -> dict:
    """Split-conformal style band: residual quantiles per bin of predicted power.

    Binning lets the band widen where the model is less certain (high power).
    Fitted on out-of-fold training predictions, so no test data is involved.
    """
    resid = y - pred_oof
    edges = np.unique(np.quantile(pred_oof, np.linspace(0, 1, N_INTERVAL_BINS + 1)))
    b = np.clip(np.searchsorted(edges, pred_oof, side="right") - 1, 0, len(edges) - 2)
    lo = [float(np.quantile(resid[b == k], ALPHA / 2)) for k in range(len(edges) - 1)]
    hi = [float(np.quantile(resid[b == k], 1 - ALPHA / 2)) for k in range(len(edges) - 1)]
    return {"alpha": ALPHA, "edges": edges.tolist(), "lo": lo, "hi": hi}


def apply_interval(cal: dict, pred: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    edges = np.asarray(cal["edges"])
    b = np.clip(np.searchsorted(edges, pred, side="right") - 1, 0, len(edges) - 2)
    return np.maximum(pred + np.asarray(cal["lo"])[b], 0.0), pred + np.asarray(cal["hi"])[b]


def power_bounds(y: np.ndarray) -> tuple[float, float]:
    """Physical limits for one GPU's average power: idle floor (0.5th pct) and observed maximum."""
    return float(np.quantile(y, 0.005)), float(np.max(y))


def predict_power(model, cal: dict, X: pd.DataFrame, bounds: tuple[float, float]):
    """Deployment-side prediction: (low, expected, high) watts, clipped to the physical range.

    Models can extrapolate to impossible values (e.g. negative watts) for utilisation
    combinations that never occur in the data, so always predict through this function.
    """
    floor, cap = bounds
    mid = np.clip(model.predict(X), floor, cap)
    lo, hi = apply_interval(cal, mid)
    return np.clip(lo, floor, cap), mid, np.clip(hi, floor, cap)


# ---------------------------------------------------------------- annual heat maths
def annual_heat_mwh(n_gpus: float, power_w: float, hours_per_day: float, days_per_year: int = 365) -> float:
    """Heat released per year in MWh (1 W of GPU power = 1 W of heat)."""
    return n_gpus * power_w * hours_per_day * days_per_year / 1e6


def fleet_heat_range(n_gpus: int, lo_w: float, mid_w: float, hi_w: float, hours_per_day: float) -> dict:
    """Annual-heat range for a fleet from a per-GPU band.

    shared_error     : every GPU is off in the same direction (e.g. one workload type
                       repeated everywhere). N x per-GPU band. Conservative, use for planning.
    independent_gpus : GPU errors are independent, so the band on the fleet average shrinks
                       by sqrt(N). Normal approximation of the per-GPU band. Optimistic.
    """
    z = 1.645  # two-sided 90%
    sigma = (hi_w - lo_w) / (2 * z)
    half = z * sigma / np.sqrt(n_gpus)
    return {
        "per_gpu_w": {"low": lo_w, "mid": mid_w, "high": hi_w},
        "shared_error_mwh": [annual_heat_mwh(n_gpus, w, hours_per_day) for w in (lo_w, mid_w, hi_w)],
        "independent_gpus_mwh": [annual_heat_mwh(n_gpus, w, hours_per_day) for w in (mid_w - half, mid_w, mid_w + half)],
    }


# ---------------------------------------------------------------------- artifacts
def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _json_default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return float(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    return str(o)


def _model_dir(name: str) -> Path:
    if not name.isidentifier():
        raise ValueError("model name must be a plain identifier")
    return ARTIFACTS / name


def save_model(name: str, model, calibration: dict) -> None:
    d = _model_dir(name)
    d.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, d / "model.joblib", compress=3)
    (d / "calibration.json").write_text(json.dumps(calibration, indent=2))
    (d / "manifest.json").write_text(json.dumps({"model.joblib": _sha256(d / "model.joblib")}, indent=2))


def load_model(name: str):
    """Load a saved model after verifying its SHA-256 against the manifest."""
    d = _model_dir(name)
    expected = json.loads((d / "manifest.json").read_text())["model.joblib"]
    if not hmac.compare_digest(_sha256(d / "model.joblib"), expected):
        raise RuntimeError(f"{name}: model file does not match its manifest, refusing to load")
    return joblib.load(d / "model.joblib"), json.loads((d / "calibration.json").read_text())


# ------------------------------------------------------------------- experiment
def run_experiment(name: str, label: str, estimator, param_grid: dict, *, max_fit_rows: int | None = None,
                   notes: str = "") -> dict:
    """Tune, evaluate and save one model with the same protocol for every algorithm.

    1. Hold out 20% of USERS as a final test set (touched once, at the end).
    2. Tune hyper-parameters with user-grouped 5-fold CV on the remaining 80%.
    3. Diagnose over/under-fitting: CV train vs validation error, test vs CV error,
       and a learning curve.
    4. Calibrate a 90% prediction band from out-of-fold residuals.
    5. Score the test set once; save model, calibration, metrics, predictions.
    """
    started = time.time()
    df, report = load_dataset()
    train, test = split_by_user(df)
    fit = train
    if max_fit_rows and len(train) > max_fit_rows:  # keeps O(n^2) learners tractable
        fit = train.sample(max_fit_rows, random_state=SEED).reset_index(drop=True)

    X, y, groups = fit[FEATURES], fit[TARGET].to_numpy(), fit.id_user.to_numpy()
    cv = GroupKFold(n_splits=CV_FOLDS)

    search = GridSearchCV(estimator, param_grid, scoring={"mae": "neg_mean_absolute_error", "r2": "r2"}, refit="mae",
                          cv=cv, n_jobs=-1, return_train_score=True, error_score="raise")
    search.fit(X, y, groups=groups)
    i = search.best_index_
    cvr = search.cv_results_
    cv_train_mae, cv_val_mae = -cvr["mean_train_mae"][i], -cvr["mean_test_mae"][i]
    best = search.best_estimator_

    pred_oof = cross_val_predict(clone(best), X, y, cv=cv, groups=groups, n_jobs=-1)
    calibration = fit_interval(pred_oof, y)

    sizes, lc_train, lc_val = learning_curve(clone(best), X, y, groups=groups, cv=GroupKFold(n_splits=3),
                                             train_sizes=np.linspace(0.2, 1.0, 5), scoring="neg_mean_absolute_error",
                                             n_jobs=-1, shuffle=False)

    pred_test = best.predict(test[FEATURES])
    y_test = test[TARGET].to_numpy()
    lo, hi = apply_interval(calibration, pred_test)
    test_metrics = regression_metrics(y_test, pred_test)
    gap = (cv_val_mae - cv_train_mae) / cv_val_mae
    lc_val_mae = -lc_val.mean(axis=1)
    metrics = {
        "model": name, "label": label, "notes": notes, "best_params": search.best_params_,
        "n_train_rows": len(fit), "n_test_rows": len(test), "cleaning": report,
        "cv": {"train_mae_w": cv_train_mae, "val_mae_w": cv_val_mae, "val_mae_std_w": float(cvr["std_test_mae"][i]),
               "val_r2": float(cvr["mean_test_r2"][i]), "train_r2": float(cvr["mean_train_r2"][i])},
        "test": test_metrics,
        "interval": {"nominal": 1 - ALPHA, "coverage": float(np.mean((y_test >= lo) & (y_test <= hi))),
                     "mean_width_w": float(np.mean(hi - lo))},
        "diagnostics": {
            "train_val_gap": float(gap),
            "test_vs_cv_mae_ratio": float(test_metrics["mae_w"] / cv_val_mae),
            "overfit_flag": bool(gap > OVERFIT_GAP),
            "learning_curve": {"train_sizes": sizes.tolist(), "train_mae_w": (-lc_train.mean(axis=1)).tolist(),
                               "val_mae_w": lc_val_mae.tolist()},
            # >5% gain in the last step means more data would still help (high variance)
            "more_data_would_help": bool((lc_val_mae[-2] - lc_val_mae[-1]) / lc_val_mae[-2] > 0.05),
        },
        "runtime_s": round(time.time() - started, 1),
    }

    save_model(name, best, calibration)
    d = _model_dir(name)
    (d / "metrics.json").write_text(json.dumps(metrics, indent=2, default=_json_default))
    pd.DataFrame({"y_true_w": y_test, "y_pred_w": pred_test, "low_w": lo, "high_w": hi}).to_csv(
        d / "test_predictions.csv", index=False)  # no user or job ids
    _print_summary(metrics)
    return metrics


def _print_summary(m: dict) -> None:
    c, t, i, dg = m["cv"], m["test"], m["interval"], m["diagnostics"]
    print(f"\n== {m['label']} ==  best params: {m['best_params']}")
    print(f"  CV  train MAE {c['train_mae_w']:.2f} W | val MAE {c['val_mae_w']:.2f} +/- {c['val_mae_std_w']:.2f} W | val R2 {c['val_r2']:.3f}")
    print(f"  TEST MAE {t['mae_w']:.2f} W | RMSE {t['rmse_w']:.2f} W | R2 {t['r2']:.3f} | total bias {t['total_bias_pct']:+.2f}%")
    print(f"  90% band: coverage {i['coverage']:.3f}, mean width {i['mean_width_w']:.1f} W")
    print(f"  overfit gap {dg['train_val_gap']:.2f} ({'OVERFIT' if dg['overfit_flag'] else 'ok'}), "
          f"test/CV MAE {dg['test_vs_cv_mae_ratio']:.2f}, more data would help: {dg['more_data_would_help']}")
    print(f"  done in {m['runtime_s']} s")
