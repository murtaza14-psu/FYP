# GPU Cooling Advisor (FYP)

Final Year Project: predict the heat a GPU data centre gives off in a year, estimate the water and electricity used by three cooling techniques (air, direct-to-chip, immersion), and rank them.

## Repository layout

| Folder | Contents |
|---|---|
| `web_app/` | The website (React + TypeScript). See `web_app/README.md`. |
| `ml_module/` | The machine-learning models, the prediction service and the dataset (`ml_module/data/`). See `ml_module/README.md`. |
| `docs/` | Reference material, e.g. `Cooling_Equations_Summary.pdf`. |

## Run it in the browser: step by step

You need two programs open at once: the **prediction service** (Python, does the maths) and the **website** (Node, what you see). Run every command from the repo root (`FYP/`) unless a step says otherwise.

1. **Install the tools (once).** Install [Python 3.13](https://www.python.org/downloads/) and [Node.js 20 or newer](https://nodejs.org/); this gives you the `python`, `pip` and `npm` commands.
2. **Install the Python packages (once).** Run `pip install -r ml_module/requirements.txt -r ml_module/requirements-api.txt` to get the machine-learning and web-service libraries.
3. **Check the dataset is there (once).** The folder `ml_module/data/` must contain `dcgm.csv` and `scheduler_data.csv` (the MIT SuperCloud data); the models are trained from it and it is not in git.
4. **Train the five models (once, about 15 minutes).** Run `python ml_module/run_all.py`; it saves the trained models to `ml_module/artifacts/`, so you do not repeat this unless the data or code changes.
5. **Start the prediction service.** Run `python ml_module/api.py` and leave the window open; when it says `Uvicorn running on http://127.0.0.1:8000` the models are loaded and ready.
6. **Open a second terminal and install the website (once).** Run `cd web_app` and then `npm install` to download the website's libraries.
7. **Start the website.** Run `npm run dev` and leave it running; it prints the address `http://localhost:5173`.
8. **Open the website.** Go to `http://localhost:5173` in your browser and click **Predict**.
9. **Enter your data centre.** Fill in the number of GPUs, average SM (compute) utilisation %, average memory utilisation %, hours per day and days per year in use, then click **Run prediction**.
10. **Read the result.** The Results page shows the heat produced per year with its likely range, followed by the cooling comparison and ranking (the cooling numbers are still placeholders).
11. **Stop everything.** Press `Ctrl + C` in both terminals when you are finished.

Next time, skip steps 1–4 and 6: just do step 5, then step 7 (inside `web_app`), then open the browser.

**If the page says "Could not reach the prediction service":** step 5 is not running, so start `python ml_module/api.py` and click **Run prediction** again.

**If `api.py` says "only one usage of each socket address" (port 8000):** the prediction service is already running in another terminal, so you do not need to start it again; check with `http://127.0.0.1:8000/health` in your browser. To restart it, close that terminal (or press `Ctrl + C` in it) and run step 5 again.

**No browser needed?** After step 4, `python ml_module/estimate.py` asks the same questions in the terminal and prints the annual heat.
