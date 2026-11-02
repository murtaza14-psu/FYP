"""Model 2: Random Forest.

Bagged trees. Overfitting is controlled by capping depth and forcing large leaves
(min_samples_leaf), which also smooths the predicted power curve.
"""
from sklearn.ensemble import RandomForestRegressor

from common import SEED, run_experiment

if __name__ == "__main__":
    est = RandomForestRegressor(n_estimators=200, random_state=SEED, n_jobs=1)
    grid = {"max_depth": [6, 10, 16], "min_samples_leaf": [10, 30, 100], "max_features": [1.0, 0.5]}
    run_experiment("m2_random_forest", "Random Forest", est, grid, notes="200 trees, depth and leaf size tuned")
