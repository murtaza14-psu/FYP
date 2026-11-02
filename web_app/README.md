# GPU Cooling Advisor

Final Year Project: a web interface that predicts the heat a GPU workload generates, estimates the water and electricity used by three cooling techniques (air, direct-to-chip, immersion), and ranks them.

> **Status: front-end MVP.** The ML model, physics equations and AHP/TOPSIS ranking are **placeholders**. The interface and its data flow are real, so the real modules can be dropped in later.

## Run it

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
```

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
PredictPage form ─► runAnalysis(input)
                      ├─ heatPrediction   Module 1 (mock: 1.5 MW, range 1.35–1.65 MW)
                      ├─ coolingModel     Module 2 (placeholder per-kWh factors, Ashburn VA only)
                      └─ ranking          Module 3 (placeholder: water / electricity / balanced)
                    ─► AnalysisProvider (+ sessionStorage) ─► ResultsPage
```

Pages: Home, About Us, How It Works, Predict, Results, FAQ, Contact (and a 404).

## What is mocked, and where to replace it

| Module | File | Replace with |
|---|---|---|
| 1. Heat prediction | `src/services/heatPrediction.ts` | An HTTP client for the trained model that implements `HeatPredictor` |
| 2. Cooling resources | `src/services/coolingModel.ts`, `src/data/coolingTechniques.ts` | Physics model using region climate/grid data |
| 3. Ranking | `src/services/ranking.ts` | AHP weights + TOPSIS |
| Region | `src/data/regions.ts` | More regions and a region selector in the form |
| Team, supervisor, email | `src/config/site.ts` | Real details (currently placeholders) |

## Project structure

```
docs/PROJECT_PLAN.md   step-by-step plan and progress checklist
src/config/            site name, navigation, team placeholders
src/types/             domain types
src/data/              techniques, region, task types, FAQ
src/lib/               formatting, validation, page-title hook
src/services/          heat prediction, cooling model, ranking, analysis pipeline
src/state/             analysis context + sessionStorage persistence
src/components/        layout, ui, predict form, results panels
src/pages/             one file per route
e2e/                   Playwright tests (paused)
```

Tests sit next to the code they test (`foo.ts` → `foo.test.ts`). See `docs/PROJECT_PLAN.md` for the development approach and checklist.
