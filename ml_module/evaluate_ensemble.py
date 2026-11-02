"""Score the five-model ensemble on the same held-out users the models were compared on.

    python ml_module/evaluate_ensemble.py

Reads each model's saved test_predictions.csv (identical rows and order, since the user split is
seeded), averages them the same way pipeline.HeatPipeline does, and writes
artifacts/ensemble_metrics.json. The test set is only used here for reporting.
"""

from __future__ import annotations

import json

import numpy as np
import pandas as pd

import common as C
from pipeline import MODEL_NAMES


def evaluate() -> dict:
    frames = [pd.read_csv(C.ARTIFACTS / n / "test_predictions.csv") for n in MODEL_NAMES]
    y = frames[0]["y_true_w"].to_numpy()
    if not all(np.allclose(f["y_true_w"].to_numpy(), y) for f in frames):
        raise RuntimeError("models were evaluated on different test rows; rerun run_all.py")
    mid, lo, hi = (np.mean([f[c].to_numpy() for f in frames], axis=0) for c in ("y_pred_w", "low_w", "high_w"))
    m = C.regression_metrics(y, mid)
    m.update({
        "models": MODEL_NAMES,
        "n_test_rows": int(len(y)),
        "band_coverage": float(np.mean((y >= lo) & (y <= hi))),
        "band_width_w": float(np.mean(hi - lo)),
    })
    return m


if __name__ == "__main__":
    metrics = evaluate()
    (C.ARTIFACTS / "ensemble_metrics.json").write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics, indent=2))
