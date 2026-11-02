"""Compare the five models, pick one without peeking at the test set, and draw the figures.

Selection rule (one-standard-error rule): take the lowest cross-validated MAE, then choose
the SIMPLEST model whose CV MAE is within one standard error of it. Test-set scores are
reported but never used to choose, so they stay an unbiased estimate.
"""
from __future__ import annotations

import json
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

import common as C

MODELS = ["m1_linear", "m2_random_forest", "m3_gradient_boosting", "m4_svr", "m5_neural_network"]
COMPLEXITY = {m: i for i, m in enumerate(["m1_linear", "m3_gradient_boosting", "m2_random_forest",
                                          "m5_neural_network", "m4_svr"])}  # simplest -> most opaque
# reference palette, categorical slots 1-5 in fixed order; one colour per model, never re-assigned
COLORS = {"m1_linear": "#2a78d6", "m2_random_forest": "#eb6834", "m3_gradient_boosting": "#1baf7a",
          "m4_svr": "#eda100", "m5_neural_network": "#e87ba4", "baseline": "#8a8985"}
SURFACE, INK, INK2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3df"

plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
    "axes.edgecolor": GRID, "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
    "text.color": INK, "axes.spines.top": False, "axes.spines.right": False, "axes.grid": True,
    "grid.color": GRID, "grid.linewidth": 0.8, "font.size": 10, "axes.titleweight": "bold",
    "axes.titlesize": 11, "axes.titlelocation": "left",
})


def load_metrics() -> dict:
    out = {}
    for m in MODELS:
        p = C.ARTIFACTS / m / "metrics.json"
        if not p.is_file():
            sys.exit(f"missing {p}; run run_all.py first")
        out[m] = json.loads(p.read_text())
    return out


def baseline_row(train: pd.DataFrame, test: pd.DataFrame) -> dict:
    """Predict the training mean for everyone: any real model must beat this."""
    pred = np.full(len(test), train[C.TARGET].mean())
    return C.regression_metrics(test[C.TARGET].to_numpy(), pred)


def build_table(M: dict, base: dict) -> pd.DataFrame:
    rows = []
    for m, x in M.items():
        rows.append({"model": x["label"], "id": m, "cv_mae_w": x["cv"]["val_mae_w"], "cv_std_w": x["cv"]["val_mae_std_w"],
                     "cv_train_mae_w": x["cv"]["train_mae_w"], "gap": x["diagnostics"]["train_val_gap"],
                     "test_mae_w": x["test"]["mae_w"], "test_rmse_w": x["test"]["rmse_w"], "test_r2": x["test"]["r2"],
                     "total_bias_pct": x["test"]["total_bias_pct"], "band_coverage": x["interval"]["coverage"],
                     "band_width_w": x["interval"]["mean_width_w"], "overfit": x["diagnostics"]["overfit_flag"],
                     "fit_s": x["runtime_s"]})
    t = pd.DataFrame(rows).sort_values("cv_mae_w").reset_index(drop=True)
    t.attrs["baseline"] = base
    return t


def select(t: pd.DataFrame) -> str:
    ok = t[~t.overfit]
    best = ok.iloc[0]
    se = best.cv_std_w / np.sqrt(C.CV_FOLDS)
    within = ok[ok.cv_mae_w <= best.cv_mae_w + se]
    return min(within.id, key=COMPLEXITY.get)


def fig_comparison(t: pd.DataFrame, base: dict, chosen: str, path) -> None:
    fig, ax = plt.subplots(figsize=(8.6, 4.2))
    rows = list(t.itertuples())[::-1]
    for y, r in enumerate(rows):
        c = COLORS[r.id]
        se = r.cv_std_w / np.sqrt(C.CV_FOLDS)
        ax.plot([r.cv_mae_w, r.test_mae_w], [y, y], color=c, lw=2, alpha=0.45, zorder=1)
        ax.errorbar(r.cv_mae_w, y, xerr=se, fmt="o", mfc=SURFACE, mec=c, mew=2, ms=8, ecolor=c, elinewidth=1.6,
                    capsize=0, zorder=3)
        ax.plot(r.test_mae_w, y, "o", color=c, ms=8, mec=SURFACE, mew=1.5, zorder=4)
    ax.set_yticks(range(len(rows)))
    ax.set_yticklabels([r.model + ("  (chosen)" if r.id == chosen else "") for r in rows], color=INK)
    ax.tick_params(axis="y", length=0)
    ax.set_xlim(7, 11.5)
    ax.set_ylim(-0.6, len(rows) - 0.4)
    ax.set_xlabel("Mean absolute error per GPU (W), lower is better")
    spread = t.test_mae_w.max() - t.test_mae_w.min()
    ax.set_title(f"All five models are within {spread:.1f} W of each other "
                 f"(guessing the mean: {base['mae_w']:.0f} W)")
    ax.grid(axis="y", visible=False)
    ax.plot([], [], "o", mfc=SURFACE, mec=INK2, mew=2, ms=8, label="cross-validation (bar = 1 standard error)")
    ax.plot([], [], "o", color=INK2, ms=8, label="held-out test users")
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.18), ncol=2, frameon=False, fontsize=9)
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def fig_learning_curves(M: dict, path) -> None:
    fig, axes = plt.subplots(2, 3, figsize=(10, 5.6), sharey=True)
    for ax, m in zip(axes.flat, MODELS):
        lc = M[m]["diagnostics"]["learning_curve"]
        n = np.asarray(lc["train_sizes"])
        c = COLORS[m]
        ax.plot(n, lc["train_mae_w"], color=c, lw=2, ls=(0, (4, 2)))
        ax.plot(n, lc["val_mae_w"], color=c, lw=2)
        ax.text(n[-1], lc["val_mae_w"][-1] + 0.5, "validation", ha="right", va="bottom", color=INK2, fontsize=8.5)
        ax.text(n[-1], lc["train_mae_w"][-1] + 0.25, "training", ha="right", va="bottom", color=INK2, fontsize=8.5)
        ax.set_title(M[m]["label"])
        ax.set_xlabel("training rows")
    axes.flat[-1].axis("off")
    axes[0, 0].set_ylabel("MAE (W)")
    axes[1, 0].set_ylabel("MAE (W)")
    fig.suptitle("Validation error stops improving with more data; the gap to training shows each model's over-fit",
                 x=0.01, ha="left", fontsize=11, fontweight="bold")
    fig.tight_layout(rect=(0, 0, 1, 0.95))
    fig.savefig(path, dpi=160)
    plt.close(fig)


def fig_power_curve(chosen: str, label: str, train: pd.DataFrame, bounds, path) -> None:
    """Expected power vs SM utilisation at three memory-utilisation levels.

    Each curve is drawn only over the SM range actually seen in training data near that
    memory level, so the figure never shows combinations the model has no evidence for.
    """
    model, cal = C.load_model(chosen)
    ramp = {10: "#8fb8ee", 40: "#2a78d6", 70: "#12396f"}  # one hue, light -> dark = more memory traffic
    fig, ax = plt.subplots(figsize=(8.0, 4.6))
    for mem, col in ramp.items():
        near = train[(train.mem_util_pct - mem).abs() <= 5].sm_util_pct
        sm = np.linspace(near.quantile(0.05), near.quantile(0.95), 60)
        lo, mid, hi = C.predict_power(model, cal, pd.DataFrame({"sm_util_pct": sm, "mem_util_pct": float(mem)}), bounds)
        ax.fill_between(sm, lo, hi, color=col, alpha=0.16, lw=0)
        ax.plot(sm, mid, color=col, lw=2.2)
        ax.text(sm[-1] + 1, mid[-1], f"memory util {mem}%", color=INK, va="center", fontsize=9)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 260)
    ax.set_xlabel("Average SM utilisation (%)")
    ax.set_ylabel("Power per GPU (W)")
    ax.set_title(f"{label}: expected GPU power and 90% band")
    fig.tight_layout()
    fig.subplots_adjust(right=0.8)
    fig.savefig(path, dpi=160)
    plt.close(fig)


def main() -> None:
    M = load_metrics()
    train, test = C.split_by_user(C.load_dataset()[0])
    base = baseline_row(train, test)
    bounds = C.power_bounds(train[C.TARGET].to_numpy())
    t = build_table(M, base)
    chosen = select(t)
    label = M[chosen]["label"]

    C.ARTIFACTS.mkdir(exist_ok=True)
    t.drop(columns="id").round(4).to_csv(C.ARTIFACTS / "results.csv", index=False)
    cols = ["model", "cv_mae_w", "cv_std_w", "gap", "test_mae_w", "test_rmse_w", "test_r2", "total_bias_pct",
            "band_coverage", "band_width_w", "fit_s"]
    md = t[cols].round(3).to_markdown(index=False) if _has_tabulate() else t[cols].round(3).to_string(index=False)
    print("\nModels ranked by cross-validated MAE (test columns are for reporting only):\n")
    print(t[cols].round(3).to_string(index=False))
    print(f"\nBaseline (predict training mean): test MAE {base['mae_w']:.2f} W, R2 {base['r2']:.3f}")
    print(f"Chosen by one-standard-error rule: {label}")

    fig_comparison(t, base, chosen, C.ARTIFACTS / "fig_model_comparison.png")
    fig_learning_curves(M, C.ARTIFACTS / "fig_learning_curves.png")
    fig_power_curve(chosen, label, train, bounds, C.ARTIFACTS / "fig_power_curve.png")
    (C.ARTIFACTS / "power_bounds.json").write_text(json.dumps({"floor_w": bounds[0], "cap_w": bounds[1]}))
    (C.ARTIFACTS / "results.md").write_text(f"# Model comparison\n\nChosen: **{label}**\n\n{md}\n")

    # worked example of the operator workflow
    n, sm, mem, hours = 500, 60.0, 30.0, 12.0
    model, cal = C.load_model(chosen)
    lo, mid, hi = (float(v[0]) for v in C.predict_power(
        model, cal, pd.DataFrame({"sm_util_pct": [sm], "mem_util_pct": [mem]}), bounds))
    r = C.fleet_heat_range(n, lo, mid, hi, hours)
    print(f"\nExample: {n} GPUs, SM util {sm:.0f}%, memory util {mem:.0f}%, {hours:.0f} h/day")
    print(f"  per GPU: {lo:.0f} / {mid:.0f} / {hi:.0f} W (low / expected / high)")
    print("  annual heat, shared-error range  : " + " / ".join(f"{v:,.0f}" for v in r["shared_error_mwh"]) + " MWh")
    print("  annual heat, independent-GPU range: " + " / ".join(f"{v:,.0f}" for v in r["independent_gpus_mwh"]) + " MWh")


def _has_tabulate() -> bool:
    try:
        import tabulate  # noqa: F401
        return True
    except ImportError:
        return False


if __name__ == "__main__":
    main()
