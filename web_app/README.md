# GPU Cooling Advisor

Final Year Project: a web interface that predicts the annual heat a GPU fleet generates, estimates the water and electricity used by two cooling techniques (air, direct-to-chip) in Ashburn, Virginia, and ranks them.

> **Status:** the heat prediction (five-model ensemble) and the cooling model (air and direct-to-chip, Ashburn weather) are real and served by `ml_module/api.py`. Only the AHP/TOPSIS **ranking** is still a placeholder. Immersion cooling is not modelled.

## Run it

Requires Node 20+.

```bash
# terminal 1, from the repo root: the ML service that predicts the heat
pip install -r ml_module/requirements.txt -r ml_module/requirements-api.txt
python ml_module/run_all.py     # once, trains the models (~15 min)
python ml_module/api.py         # http://127.0.0.1:8000

# terminal 2
cd web_app
npm install
npm run dev                     # http://localhost:5173
```

The service URL defaults to `http://127.0.0.1:8000`; override it with `VITE_API_URL`.

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Run unit and component tests (Vitest) |
| `npm run test:watch` | Tests in watch mode (TDD loop) |
| `npm run lint` | oxlint |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build into `dist/` |
| `npm run check` | lint + typecheck + tests + build (run before committing) |
| `npm run test:e2e` | Playwright browser tests (**paused**, see the plan) |

## How it works

```
PredictPage form ─► runAnalysis(input, { backend })
                      ├─ backend.analyse   Modules 1 + 2: ONE call to POST /api/v1/analysis of ml_module/api.py
                      │                    (heat from the ML ensemble, then cooling from cooling_module/)
                      └─ ranking           Module 3 (placeholder: water / electricity / balanced)
                    ─► AnalysisProvider (+ sessionStorage) ─► ResultsPage
```

Pages: Home, About Us, How It Works, Predict, Results, FAQ, Contact (and a 404).

The Results page shows, in order: annual heat, the cooling comparison (electricity and water with low to high ranges, water split into evaporation / blowdown / drift), a month-by-month chart, the Ashburn climate (collapsible), the ranking, and the assumptions and equations (collapsible). The service's response is checked strictly in `src/services/analysisClient.ts`; anything unexpected is rejected with a safe message.

## What is mocked, and where to replace it

| Module | File | Replace with |
|---|---|---|
| Immersion cooling (not modelled) | `cooling_module/`, `src/data/coolingTechniques.ts` | Its equations, once available |
| 3. Ranking | `src/services/ranking.ts` | AHP weights + TOPSIS |
| Region | `src/data/regions.ts` | More regions and a region selector in the form |
| Team, supervisor, email | `src/config/site.ts` | Real details (currently placeholders) |

## Project structure

```
docs/PROJECT_PLAN.md   step-by-step plan and progress checklist
src/config/            site name, navigation, team placeholders
src/types/             domain types
src/data/              techniques, region, FAQ
src/lib/               formatting, validation, page-title hook
src/services/          service client + response parser, ranking, analysis pipeline
src/state/             analysis context + sessionStorage persistence
src/components/        layout, ui, predict form, results panels
src/pages/             one file per route
src/test/              test setup, fixtures and a test double of the service (mockBackend.ts)
e2e/                   Playwright tests (paused)
```

Tests sit next to the code they test (`foo.ts` → `foo.test.ts`). See `docs/PROJECT_PLAN.md` for the development approach and checklist.
