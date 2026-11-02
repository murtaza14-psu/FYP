"""Model 1: regularised linear regression (Ridge) with optional polynomial terms.

Interpretable baseline. Degree 1 is plain linear regression; higher degrees let it
bend, so the search shows how much non-linearity the power curve needs.
"""
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import PolynomialFeatures, StandardScaler

from common import run_experiment

if __name__ == "__main__":
    pipe = Pipeline([("scale", StandardScaler()), ("poly", PolynomialFeatures(include_bias=False)),
                     ("model", Ridge())])
    grid = {"poly__degree": [1, 2, 3], "model__alpha": [0.1, 1, 10, 100, 1000]}
    run_experiment("m1_linear", "Linear (Ridge)", pipe, grid, notes="Ridge with polynomial degree 1-3")
