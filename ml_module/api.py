"""Local HTTP API around the pipeline, used by the web app.

    pip install -r ml_module/requirements-api.txt
    python ml_module/api.py            # http://127.0.0.1:8000  (docs at /docs)

POST /api/v1/annual-heat   body: {n_gpus, sm_util_pct, mem_util_pct, hours_per_day?, days_per_year?}   -> module 1 (heat)
POST /api/v1/analysis      same body -> {heat: <module 1>, cooling: <module 2: air and direct-to-chip, Ashburn VA>}
GET  /health

Security: binds to 127.0.0.1 only, CORS allows just the local Vite dev/preview origins, every field is
range-checked (pydantic, then DataCenter), request bodies are tiny, errors never echo internals, and the
models are loaded once at start-up after their SHA-256 check. Do not expose this to a network as-is.
"""

from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from pipeline import MAX_GPUS, DataCenter, HeatPipeline, InputError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # repo root, so cooling_module can be imported
from cooling_module import model as cooling  # noqa: E402

ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173"]
MAX_BODY_BYTES = 2_000


class AnnualHeatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    n_gpus: int = Field(ge=1, le=MAX_GPUS)
    sm_util_pct: float = Field(ge=0, le=100, allow_inf_nan=False)
    mem_util_pct: float = Field(ge=0, le=100, allow_inf_nan=False)
    hours_per_day: float = Field(default=24.0, gt=0, le=24, allow_inf_nan=False)
    days_per_year: int = Field(default=365, ge=1, le=366)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pipeline = HeatPipeline.load()
    app.state.weather_site = cooling.preload()
    yield


app = FastAPI(title="GPU annual heat", version="1.0.0", lifespan=lifespan, docs_url="/docs", redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["GET", "POST"],
                   allow_headers=["Content-Type"], allow_credentials=False)


@app.middleware("http")
async def limit_body(request: Request, call_next):
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_BODY_BYTES:
        return JSONResponse({"detail": "request body too large"}, status_code=413)
    return await call_next(request)


@app.get("/health")
def health(request: Request):
    return {"status": "ok", "models": list(request.app.state.pipeline.models), "weather_site": request.app.state.weather_site}


@app.post("/api/v1/annual-heat")
def annual_heat(body: AnnualHeatRequest, request: Request):
    try:
        dc = DataCenter(**body.model_dump())
    except InputError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return request.app.state.pipeline.estimate(dc)


@app.post("/api/v1/analysis")
def analysis(body: AnnualHeatRequest, request: Request):
    """Heat from the five-model ensemble, then the electricity and water to cool it in Ashburn, VA."""
    try:
        dc = DataCenter(**body.model_dump())
    except InputError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    heat = request.app.state.pipeline.estimate(dc)
    kwh = {k: heat["annual_heat_mwh"][k] * 1000.0 for k in ("low", "expected", "high")}
    try:
        cooling_result = cooling.estimate_cooling(kwh)
    except ValueError as e:  # the heat range was not ordered or not finite: a fault here, not the caller's
        raise HTTPException(status_code=500, detail="the cooling model could not use this heat estimate") from e
    return {"heat": heat, "cooling": cooling_result}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
