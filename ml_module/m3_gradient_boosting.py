"""Model 3: Gradient Boosting (histogram-based, as used by LightGBM / XGBoost).

Early stopping on an internal validation split picks the number of trees, and
L2 regularisation plus a minimum leaf size limit overfitting.
"""
from sklearn.ensemble import HistGradientBoostingRegressor

from common import SEED, run_experiment

if __name__ == "__main__":
    est = HistGradientBoostingRegressor(max_iter=500, early_stopping=True, validation_fraction=0.15,
                                        n_iter_no_change=20, random_state=SEED)
    grid = {"learning_rate": [0.03, 0.1], "max_leaf_nodes": [8, 16, 31], "min_samples_leaf": [20, 100],
            "l2_regularization": [0.0, 1.0]}
    run_experiment("m3_gradient_boosting", "Gradient Boosting", est, grid, notes="early stopping, L2 regularisation")
