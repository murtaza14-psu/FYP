"""Model 5: Neural network (multi-layer perceptron).

Early stopping on an internal validation split and L2 weight decay (alpha) guard
against overfitting. Inputs and target are standardised.
"""
from sklearn.compose import TransformedTargetRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from common import SEED, run_experiment

if __name__ == "__main__":
    mlp = MLPRegressor(max_iter=500, early_stopping=True, validation_fraction=0.15, n_iter_no_change=15,
                       learning_rate_init=0.003, random_state=SEED)
    est = TransformedTargetRegressor(regressor=Pipeline([("scale", StandardScaler()), ("model", mlp)]),
                                     transformer=StandardScaler())
    grid = {"regressor__model__hidden_layer_sizes": [(16,), (64,), (32, 16)],
            "regressor__model__alpha": [1e-4, 1e-2, 1.0]}
    run_experiment("m5_neural_network", "Neural Network (MLP)", est, grid, notes="early stopping, L2 alpha")
