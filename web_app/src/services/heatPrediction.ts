import type { HeatPrediction, PredictionInput } from '../types/analysis'

/**
 * Contract for Module 1. The real implementation calls the Python service in `ml_module/`
 * (five-model ensemble); the mock below stays available for tests and offline demos.
 */
export interface HeatPredictor {
  predict(input: PredictionInput): Promise<HeatPrediction>
}

/** Hard-coded stand-in for the ML model: always predicts 1.5 MW (±10%). */
export function createMockHeatPredictor(delayMs = 0): HeatPredictor {
  return {
    async predict() {
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
      return { valueMW: 1.5, lowMW: 1.35, highMW: 1.65, isMock: true }
    },
  }
}

export const mockHeatPredictor = createMockHeatPredictor()

/** An error whose message is safe to show to the user. */
export class HeatPredictionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HeatPredictionError'
  }
}

export const DEFAULT_API_URL = 'http://127.0.0.1:8000'

interface HttpOptions {
  baseUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Maps the service's JSON onto HeatPrediction, rejecting anything that is not the expected shape. */
export function parseApiResponse(body: unknown): HeatPrediction {
  const load = isRecord(body) && isRecord(body.heat_load_mw) ? body.heat_load_mw : null
  if (!load || !isFiniteNumber(load.low) || !isFiniteNumber(load.expected) || !isFiniteNumber(load.high)) {
    throw new HeatPredictionError('The prediction service returned an unexpected response.')
  }
  const perGpu = isRecord(body) && isRecord(body.per_gpu) ? body.per_gpu.expected_w : undefined
  const warnings = isRecord(body) && Array.isArray(body.warnings) ? body.warnings.filter((w) => typeof w === 'string') : []
  return {
    valueMW: load.expected,
    lowMW: load.low,
    highMW: load.high,
    perGpuW: isFiniteNumber(perGpu) ? perGpu : undefined,
    warnings,
    isMock: false,
  }
}

/** Calls the local ML service (`python ml_module/api.py`). */
export function createHttpHeatPredictor({
  baseUrl = import.meta.env.VITE_API_URL ?? DEFAULT_API_URL,
  fetchImpl = (...args) => fetch(...args),
  timeoutMs = 15_000,
}: HttpOptions = {}): HeatPredictor {
  return {
    async predict(input) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let response: Response
      try {
        response = await fetchImpl(`${baseUrl}/api/v1/annual-heat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            n_gpus: input.gpuCount,
            sm_util_pct: input.smUtilPercent,
            mem_util_pct: input.memUtilPercent,
            hours_per_day: input.hoursPerDay,
            days_per_year: input.daysPerYear,
          }),
          signal: controller.signal,
        })
      } catch {
        throw new HeatPredictionError(
          'Could not reach the prediction service. Start it with "python ml_module/api.py" and try again.',
        )
      } finally {
        clearTimeout(timer)
      }

      if (!response.ok) {
        throw new HeatPredictionError(
          response.status === 422
            ? 'The prediction service rejected these values. Check the inputs and try again.'
            : `The prediction service failed (error ${response.status}).`,
        )
      }
      let body: unknown
      try {
        body = await response.json()
      } catch {
        throw new HeatPredictionError('The prediction service returned an unexpected response.')
      }
      return parseApiResponse(body)
    },
  }
}
