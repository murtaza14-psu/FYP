# GPU Cooling Advisor — Front-End Project Plan (MVP)

> **Update 2026-11-07:** Module 1 (ML heat prediction) and Module 2 (cooling model for air and direct-to-chip, Ashburn weather) are now real and served by `ml_module/api.py`; see `ml_module/README.md` and `cooling_module/PLAN.md`. Only the ranking is still a placeholder. The sections below describe the original mocked MVP and are kept as history.
>
> **Working name:** GPU Cooling Advisor (rename in one place: `src/config/site.ts`)
> **Scope of this plan:** the web front end (MVP). ML model, physics engine and ranking algorithms are **mocked/placeholder** for now.
> **Development style:** Test-Driven Development (red → green → refactor). Every step below lists its tests *before* its implementation.
> **How this file is used:** after each step is finished, its checkboxes are ticked, the Progress Log is updated, and the step is committed to git.

---

## 1. Project summary

The system helps a user choose the best data-centre cooling technique for a GPU workload.

| Module | What it does | Status in this MVP |
|---|---|---|
| **1. Heat prediction (ML)** | Predicts heat produced by N GPUs from task type, GPU count, duration and utilisation. Will be trained on the MIT SuperCloud dataset. | **Mocked**: returns a hard-coded heat load (1.5 MW, range 1.35–1.65 MW). |
| **2. Cooling resource model (physics)** | Given the heat load + region, computes electricity (kWh) and water (L) for **Air cooling**, **Direct-to-chip liquid cooling**, **Immersion cooling**. | **Placeholder coefficients** (simple per-kWh factors, clearly labelled). One region only: **Ashburn, Virginia**. |
| **3. Ranking (MCDM)** | Ranks the techniques by user-chosen criteria using **AHP** and **TOPSIS**. | **Placeholder**: simple ranking by a single chosen criterion; AHP/TOPSIS UI shown as "coming soon". |

### Data flow

```
PredictPage (form) ──validate──► runAnalysis(input)
                                   ├─ HeatPredictor.predict(input)      → HeatPrediction   (mock)
                                   ├─ estimateCooling(heat, duration, region) → CoolingEstimate[] (placeholder)
                                   └─ rankTechniques(estimates, criterion)    → RankedTechnique[] (placeholder)
                                 ──► AnalysisContext (+ sessionStorage) ──► ResultsPage
```

Each service sits behind a typed function/interface so the real ML API (Python/FastAPI), real physics equations and AHP/TOPSIS can replace the mocks later **without changing the UI**.

---

## 2. MVP scope

### In scope
- Pages: **Home, About Us, How It Works, Predict, Results, FAQ, Contact**, plus a 404 page.
- Prediction form inputs:
  - **Task type** — Training / Fine-tuning / Inference
  - **Number of GPUs** — whole number, 1 – 100,000
  - **Duration (hours)** — greater than 0, up to 8,760 (one year)
  - **Expected GPU utilisation (%)** — whole number, 1 – 100
  - **Region** — fixed to *Ashburn, Virginia, USA* (shown, not editable)
- Results: heat load (value + range, mock badge), total heat energy, per-technique electricity & water, comparison chart, placeholder ranking, assumptions panel.
- Responsive layout (mobile → desktop), keyboard accessible, semantic HTML.

### Out of scope (for now)
- Real ML model, real physics equations, AHP/TOPSIS maths, multiple regions, scraping.
- GPU model selection, user accounts/login, contact **form** (Contact page shows info only), backend server, deployment.

---

## 3. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **React 19 + TypeScript** | Industry standard, typed contracts for the future API. |
| Build tool | **Vite** | Fast dev server and builds. |
| Styling | **Tailwind CSS v4** | Consistent design, fast responsive layouts. |
| Routing | **React Router** | Multi-page SPA routing. |
| Unit/component tests | **Vitest + React Testing Library + jest-dom + user-event** | Fast, Vite-native TDD loop. |
| End-to-end tests | **Playwright** (Chromium) | Real-browser user journeys. |
| Linting/types | **oxlint + `tsc -b`** | Catch bugs before tests run (oxlint ships with the current Vite template). |

### npm scripts (quality gates)

| Script | Purpose |
|---|---|
| `npm run dev` | Start dev server |
| `npm test` | Unit + component tests (Vitest, single run) |
| `npm run test:watch` | TDD watch mode |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run lint` | oxlint |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build |
| `npm run check` | lint + typecheck + test + build (run before every commit) |

---

## 4. Folder structure (target)

```
FYP/
├─ docs/PROJECT_PLAN.md          ← this file
├─ e2e/                          ← Playwright tests
├─ src/
│  ├─ config/site.ts             ← project name, nav links, team placeholders
│  ├─ types/analysis.ts          ← domain types (input, prediction, estimates, ranking)
│  ├─ data/                      ← regions, cooling techniques, task types, FAQ content
│  ├─ lib/                       ← pure helpers: validation, formatting
│  ├─ services/                  ← heatPrediction (mock), coolingModel, ranking, analysis facade
│  ├─ state/AnalysisContext.tsx  ← latest analysis, persisted to sessionStorage
│  ├─ components/
│  │  ├─ layout/                 ← Layout, Header, Footer
│  │  ├─ ui/                     ← Button, Card, Badge, etc.
│  │  ├─ predict/                ← PredictionForm
│  │  └─ results/                ← HeatSummary, CoolingComparison, RankingPanel, AssumptionsPanel
│  ├─ pages/                     ← one file per route
│  ├─ test/setup.ts              ← test setup (jest-dom)
│  ├─ App.tsx  (routes)
│  └─ main.tsx
└─ (Vite / TS / ESLint / Playwright config files)
```

Tests are co-located: `foo.ts` → `foo.test.ts`.

---

## 5. TDD workflow (applies to every step)

1. **Red** — write the tests listed for the step; run them; confirm they fail for the right reason.
2. **Green** — write the minimum code to pass.
3. **Refactor** — tidy up with tests still green.
4. **Gate** — `npm run check` passes (lint, types, tests, build).
5. **Record** — tick the step's boxes here, add a Progress Log row, commit (`feat(stepX.Y): …`).

---

## 6. Implementation steps & checklists

### Phase 0 — Repository & planning
- [x] **0.1** Initialise git repository (`main` branch)
- [x] **0.2** Agree scope and requirements with the student
- [x] **0.3** Write this plan (`docs/PROJECT_PLAN.md`)
- [x] **0.4** Commit the plan

### Phase 1 — Scaffold & tooling
**Step 1.1 — Vite + React + TypeScript scaffold**
- [x] Create Vite React-TS project in repo root, `.gitignore` covers `node_modules`, `dist`, test reports
- [x] Dev server starts and build succeeds

**Step 1.2 — Test tooling**
- [x] Install Vitest, jsdom, React Testing Library, jest-dom, user-event; `src/test/setup.ts`
- [x] *Test first:* smoke test `App renders without crashing` (fails before App exists/wired, then passes)
- [x] `npm test` runs green

**Step 1.3 — Styling, routing, lint & scripts**
- [x] Tailwind CSS v4 wired via Vite plugin; base theme tokens (colours, fonts) defined
- [x] React Router installed
- [x] oxlint passes; `typecheck` and `check` scripts added
- [x] Playwright installed with Chromium + config (`e2e/`), one smoke e2e test passed once
- [ ] ~~Playwright teardown on Windows~~ — **deferred**: the runner hangs ~3 min on exit; browser tests are paused (decision 2026-10-19) and are not part of `npm run check`
- [x] `npm run check` passes → commit

### Phase 2 — Domain types & pure logic (no UI)
**Step 2.1 — Domain types & static data**
- [x] `types/analysis.ts`: `TaskType`, `PredictionInput`, `HeatPrediction`, `CoolingTechniqueId`, `CoolingEstimate`, `RankingCriterion`, `RankedTechnique`, `AnalysisResult`
- [x] `data/`: task types, Ashburn region profile, 3 cooling techniques (+ placeholder coefficients)
- [x] *Tests:* data integrity — exactly 3 techniques with unique ids; all coefficients > 0; region id is `ashburn-va`

**Step 2.2 — Formatting helpers (`lib/format.ts`)**
- [x] *Tests first:* `formatNumber(1234567.8)` → `"1,234,568"`; `formatEnergy` picks kWh/MWh/GWh; `formatPower` picks kW/MW; `formatVolume` picks L / m³ (≥ 1,000 L); handles 0
- [x] Implement until green

**Step 2.3 — Input validation (`lib/validation.ts`)**
- [x] *Tests first:* valid input → no errors; missing task type → error; GPUs 0 / negative / decimal / > 100,000 → error; duration 0 / negative / > 8,760 → error; utilisation 0 / > 100 / decimal → error; empty strings / NaN → "required" error; multiple errors reported together
- [x] Implement `validatePredictionInput(raw) → { values?, errors }`

**Step 2.4 — Mock heat predictor (`services/heatPrediction.ts`)**
- [x] *Tests first:* returns `1.5 MW` point value with `1.35–1.65 MW` range; `low ≤ value ≤ high`; `isMock === true`; async (returns a Promise); exposes a `HeatPredictor` interface so a real API client can be swapped in
- [x] Implement

**Step 2.5 — Placeholder cooling model (`services/coolingModel.ts`)**
- [x] *Tests first:* heat energy = heat (MW) × 1,000 × duration (h) kWh; returns one estimate per technique; electricity = heat energy × technique energy factor; water = heat energy × technique water factor; low/high bounds use the prediction range; zero duration → zeros; results are deterministic
- [x] Implement `estimateCooling(prediction, durationHours, region)`

**Step 2.6 — Placeholder ranking (`services/ranking.ts`)**
- [x] *Tests first:* criterion `water` ranks lowest water first; `electricity` ranks lowest electricity first; `balanced` ranks by equal-weight normalised score; ranks are 1..n with no gaps; ties keep a stable order; input array is not mutated
- [x] Implement `rankTechniques(estimates, criterion)` (clearly marked placeholder for AHP/TOPSIS)

**Step 2.7 — Analysis facade (`services/analysis.ts`)**
- [x] *Tests first:* `runAnalysis(input)` returns input, prediction, estimates, ranking and a timestamp; uses an injected predictor (test double) when provided
- [x] Implement → `npm run check` → commit

### Phase 3 — App shell & navigation
**Step 3.1 — Layout, Header, Footer**
- [x] *Tests first:* header shows project name + links to all 7 pages; active link has `aria-current="page"`; mobile menu button toggles the nav (`aria-expanded`); footer shows the year and project name; skip-to-content link exists
- [x] Implement `Layout`, `Header`, `Footer`

**Step 3.2 — Routes & 404**
- [x] *Tests first:* each route (`/`, `/about`, `/how-it-works`, `/predict`, `/results`, `/faq`, `/contact`) renders its page heading; unknown route shows 404 with link home; document title updates per page
- [x] Implement routes in `App.tsx` with page stubs → commit

### Phase 4 — Content pages
**Step 4.1 — Home**
- [x] *Tests first:* hero heading; primary CTA "Start a prediction" links to `/predict`; secondary CTA to `/how-it-works`; 3 module cards (Predict heat → Model cooling → Rank options); 3 cooling technique highlights
- [x] Implement

**Step 4.2 — About Us**
- [x] *Tests first:* project overview section; problem statement; team section renders a card per team member from config; supervisor + institution shown (placeholders)
- [x] Implement

**Step 4.3 — How It Works (walkthrough guide)**
- [x] *Tests first:* numbered steps (1–4) in order; each module explained; section explaining each input field; CTA to `/predict`
- [x] Implement

**Step 4.4 — FAQ**
- [x] *Tests first:* renders every FAQ item from data; answers hidden initially; clicking a question expands it (`aria-expanded` true) and shows the answer; clicking again collapses
- [x] Implement accessible accordion

**Step 4.5 — Contact (info only, no form)**
- [x] *Tests first:* shows email as text with `mailto:` link, institution/address, team contacts; **no `<form>` element** on the page
- [x] Implement → commit

### Phase 5 — Predict page
**Step 5.1 — Prediction form**
- [x] *Tests first:* all 4 inputs rendered with labels; region shown as fixed "Ashburn, Virginia, USA"; utilisation slider and number stay in sync; submitting invalid values shows field errors (linked via `aria-describedby`) and does **not** call `onSubmit`; valid submit calls `onSubmit` with parsed numbers; submit button disabled + "Analysing…" while pending; "Reset" restores defaults
- [x] Implement `PredictionForm`

**Step 5.2 — Analysis state**
- [x] *Tests first:* `AnalysisContext` stores the result; persists to `sessionStorage`; restores on reload; `clear()` removes it; corrupt storage is ignored safely
- [x] Implement provider + `useAnalysis` hook

**Step 5.3 — Predict page wiring**
- [x] *Tests first:* valid submit runs analysis, stores result, navigates to `/results`
- [x] Implement → commit

### Phase 6 — Results page
**Step 6.1 — Empty state**
- [x] *Tests first:* with no analysis → message + link to `/predict`
- [x] Implement

**Step 6.2 — Heat summary + input recap**
- [x] *Tests first:* shows predicted heat (1.5 MW) and range; "Mock value" badge; total heat energy for the given duration; recap of the 4 inputs + region; "Edit inputs" link
- [x] Implement

**Step 6.3 — Cooling comparison (table + chart)**
- [x] *Tests first:* table has a row per technique with electricity & water (formatted, with ranges); chart has an accessible label/description per bar; values match the service output
- [x] Implement (lightweight SVG/CSS bars, no heavy chart dependency)

**Step 6.4 — Ranking panel (placeholder)**
- [x] *Tests first:* criterion selector (Water / Electricity / Balanced); changing it re-orders the list; #1 marked "Recommended"; "AHP & TOPSIS — coming soon" notice is visible
- [x] Implement

**Step 6.5 — Assumptions panel**
- [x] *Tests first:* lists formulas used and coefficient table; states clearly that values are placeholders; collapsible
- [x] Implement → commit

### Phase 7 — End-to-end & quality
> **Paused:** browser (Playwright) tests are deferred for now. Revisit once the interface is built.

- [ ] **7.1** E2E: user goes Home → Predict → fills form → Results shows 3 techniques and a recommendation
- [ ] **7.2** E2E: invalid input shows errors and stays on Predict
- [ ] **7.3** E2E: every nav link reaches its page; unknown URL shows 404
- [ ] **7.4** E2E: mobile viewport — menu button opens nav and navigation works
- [ ] **7.5** Manual review: responsive at 375px / 768px / 1280px, keyboard-only navigation, visible focus states

### Phase 8 — Wrap-up
- [x] **8.1** README: what the project is, how to run, scripts, folder structure, what is mocked
- [ ] **8.2** Final `npm run check` green (`npm run check` passes now; `test:e2e` paused)
- [ ] **8.3** Tag `v0.1.0-mvp`

---

## 7. Placeholder model values (to be replaced)

| Item | Value | Notes |
|---|---|---|
| Predicted heat load | **1.5 MW** (range 1.35 – 1.65 MW) | Hard-coded mock; real ML model later |
| Heat energy | heat (MW) × 1,000 × duration (h) → kWh | Assumes ~all GPU electrical power becomes heat |
| Air cooling | 0.35 kWh electricity / kWh heat · 1.8 L water / kWh heat | Chillers + CRAH + evaporative towers |
| Direct-to-chip | 0.15 kWh / kWh · 0.6 L / kWh | Warm-water loop, partial evaporative heat rejection |
| Immersion (single-phase) | 0.05 kWh / kWh · 0.1 L / kWh | Dielectric fluid + dry coolers |
| Region | Ashburn, Virginia, USA | Climate facts shown are approximate and labelled as such |

These are illustrative values within commonly reported ranges and **must be replaced** by the Module 2 physics model.

---

## 8. Future work (after MVP)
- [x] Module 1: train the model on MIT SuperCloud; serve via FastAPI; replace `mockHeatPredictor` with an HTTP client (done; superseded by one `analysisClient` for Modules 1 and 2)
- [x] Module 2: real thermodynamic models for air and direct-to-chip cooling in Ashburn (wet-bulb-dependent water use, hourly weather) (done, `cooling_module/`)
- [ ] Module 2: immersion cooling; more regions (Pakistan cities, etc.); data scraping
- [ ] Module 3: decide criteria; implement AHP (pairwise comparison UI + consistency ratio) and TOPSIS
- [ ] Export results (PDF), compare runs, deployment

---

## 9. Progress log

| Date | Step(s) | Result | Commit |
|---|---|---|---|
| 2026-10-19 | 0.1 – 0.4 | Repo initialised, plan written | 963536d |
| 2026-10-19 | 1.1 – 1.3 | Scaffold, Vitest, Tailwind v4, Router, oxlint, Playwright (paused) | uncommitted |
| 2026-10-19 | 2.1 – 2.7 | Types, data, formatting, validation, mock predictor, cooling model, ranking, pipeline (62 tests) | uncommitted |
| 2026-10-19 | 3.1 – 4.5 | Layout, routing, 404, Home, About, How It Works, FAQ, Contact (103 tests) | uncommitted |
| 2026-10-19 | 5.1 – 6.5 | Prediction form, analysis state, Predict wiring, Results page (141 tests; `npm run check` green) | uncommitted |
| 2026-11-07 | Module 2 | Cooling model (`cooling_module/`, 120 Python tests), `POST /api/v1/analysis`, website shows real electricity/water with ranges, month-by-month chart, climate and assumptions; immersion removed (191 web tests, `npm run check` green) | uncommitted |
