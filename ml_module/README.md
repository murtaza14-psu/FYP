# GPU heat prediction: ML pipeline

Predicts the **average power of one GPU (W)** from its average SM and memory utilisation, with a 90% band.
Nearly all GPU power ends up as heat, so **annual heat = GPUs × power × hours/day × 365** (`common.annual_heat_mwh`).

```
pip install -r ml_module/requirements.txt
python ml_module/run_all.py          # 5 models (~15 min on 4 cores), then the comparison
python ml_module/run_all.py m1 m3    # only some models, then the comparison
python -m unittest ml_module/test_common.py ml_module/test_pipeline.py
```

## Get the annual heat of a data centre

After training (`run_all.py`), enter the facility and read off the yearly heat. The estimate is the **average of all five models**
(on held-out users: MAE 8.4 W, R² 0.920, 90% band coverage 89.8%, bias +0.3%; `python ml_module/evaluate_ensemble.py`).

```
python ml_module/estimate.py                       # asks for each value
python ml_module/estimate.py --gpus 500 --sm-util 60 --mem-util 30 --hours-per-day 12 --days-per-year 365
python ml_module/estimate.py --gpus 500 --sm-util 60 --mem-util 30 --json

pip install -r ml_module/requirements-api.txt      # once, for the web app
python ml_module/api.py                            # http://127.0.0.1:8000 (docs at /docs); the web form calls this
```

**One `.pkl` file:** `python ml_module/export_pkl.py` writes `ml_module/artifacts/annual_heat_ensemble.pkl` (2.5 MB, all five models, their
90% bands and the power limits) plus a `.sha256`. Reload it with `HeatPipeline.load_bundle("path.pkl")`, which checks the hash first.
It is a plain pickle of dicts and scikit-learn models, so `pickle.load` also works without this project's code, but you then apply
the bands and clipping yourself. Pickles can run code when loaded: only load files you made, and keep the `.sha256` with the file.

| Input | Meaning | Range |
|---|---|---|
| GPUs | number of GPUs in the fleet | 1 – 1,000,000 |
| SM utilisation | average compute utilisation (DCGM) | 0 – 100 % |
| Memory utilisation | average memory utilisation (DCGM) | 0 – 100 % |
| Hours per day / days per year | how long the GPUs are in use (defaults 24 / 365) | 0 < h ≤ 24, 1 – 366 |

Output: power per GPU, average heat load (MW) and **annual heat (MWh)**, each with a 90% range. The *planning range* assumes every GPU is
off in the same direction; the *optimistic range* assumes GPU errors cancel. It also lists each model's own estimate and warns when the
models disagree. Only GPU heat is counted (no CPUs, network, storage or cooling plant), and the data is V100-only.

| File | Role |
|---|---|
| `common.py` | Secure data loading, user-grouped split, metrics, prediction bands, annual-heat maths, hashed model I/O, the shared train/evaluate protocol |
| `m1_linear.py` … `m5_neural_network.py` | One algorithm each: Ridge (polynomial), Random Forest, Gradient Boosting, SVR, MLP. Each defines only the estimator and its search grid |
| `compare.py` | Ranking table, model selection, three figures, worked annual-heat example |
| `run_all.py` | Runs everything in order |
| `pipeline.py` | Data-centre inputs → five-model ensemble → annual heat with ranges and warnings (validated inputs) |
| `estimate.py` | Command-line front end for the pipeline |
| `api.py` | Local FastAPI service used by the web app (127.0.0.1 only, CORS limited to the Vite origins) |
| `evaluate_ensemble.py` | Scores the ensemble on the held-out users, writes `artifacts/ensemble_metrics.json` |
| `test_common.py`, `test_pipeline.py` | Tests for the heat arithmetic, band coverage, path safety, tamper detection, input validation, ensemble, API |

Outputs go to `ml_module/artifacts/` (git-ignored): per-model `model.joblib`, `manifest.json`, `calibration.json`, `metrics.json`,
`test_predictions.csv`, plus `results.csv`, `results.md` and the figures.

## Method (same for every model)

- **Target / features:** `powerusage_watts_avg` ← `smutilization_pct_avg`, `memoryutilization_pct_avg`.
  Job type and GPUs per job were tried and add about 0.002 R² on unseen users, so they are left out.
- **Cleaning:** drops missing/duplicate rows, zero power, runs under 10 min and out-of-range values.
  `energyconsumed_joules` is not used: it disagrees with power × runtime for most rows.
- **Split by user:** 20% of users are held out as a test set; all CV folds are also grouped by user. Scores therefore
  describe operators the model has never seen, not repeat users.
- **Tuning:** grid search with 5-fold grouped CV on the training users only; the test set is scored once.
- **Over/under-fitting:** CV train vs validation error (flag if the gap exceeds 30%), test vs CV error, learning curves
  (`fig_learning_curves.png`), regularisation in every grid, early stopping for boosting and the MLP.
  Under-fitting is ruled out by agreement: five very different model families, including flexible ones, reach the same
  error, so the limit is the information in the two inputs, not model capacity.
- **Selection:** one-standard-error rule on CV error (simplest model within one SE of the best). The test set is never used to choose.
- **Range:** residual quantiles of out-of-fold predictions, binned by predicted power, give a 90% band. On unseen users the
  achieved coverage is a little under 90% (see `results.md`).
- **Fleet range:** `fleet_heat_range` returns a *shared-error* range (N × per-GPU band, for planning) and an
  *independent-GPU* range (shrinks with √N, optimistic).

## Security measures

- Reads only `ml_module/data/dcgm.csv` and `ml_module/data/scheduler_data.csv` through an allow-listed, path-checked, size-capped loader with
  an explicit column list, dtypes and range checks.
- No `eval`/`exec`/shell, no network. `run_all.py` launches children with a fixed argument list.
- User IDs are only CV group labels; they are never features and never written to disk.
- Models are SHA-256 hashed on save and verified before `joblib` loads them. This catches corruption or a swapped file but
  not an attacker who can edit both the model and its manifest, so never load model files from untrusted sources.
- Pinned dependency versions in `requirements.txt`; fixed random seeds for reproducibility.
- The dataset licence limits use to the HPCA'22 analysis. Derived artifacts are git-ignored; `ml_module/data/` is still untracked, so check the terms before publishing it or the models.

## Known limits

- **GPU:** V100 (Volta) data. Other GPUs need a separate scaling assumption; none is applied.
- **Task type:** the dataset has no training/fine-tuning/inference label, so it is not a model input.
- **Utilisation** means DCGM SM utilisation, which can differ from the `nvidia-smi` figure.
- **Year-long runs** extrapolate from jobs with a median runtime of a few hours; treat the result as a steady-state average.
