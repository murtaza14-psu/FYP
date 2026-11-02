"""Model 4: Support Vector Regression (RBF kernel).

SVR scales roughly O(n^2) with rows, so tuning and fitting use a random 12,000-row
subsample of the training users' rows. The test set is always scored in full.
"""
from sklearn.compose import TransformedTargetRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR

from common import run_experiment

if __name__ == "__main__":
    pipe = Pipeline([("scale", StandardScaler()), ("model", SVR(kernel="rbf", cache_size=500))])
    est = TransformedTargetRegressor(regressor=pipe, transformer=StandardScaler())  # target in std units
    grid = {"regressor__model__C": [0.3, 1, 3], "regressor__model__epsilon": [0.02, 0.1],
            "regressor__model__gamma": [0.1, 0.5, 2.0]}
    run_experiment("m4_svr", "Support Vector Regression", est, grid, max_fit_rows=12_000,
                   notes="RBF kernel, fitted on a 12k-row subsample")
