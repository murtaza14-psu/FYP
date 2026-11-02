import type { HeatPrediction, PredictionInput } from '../types/analysis'

/**
 * Contract for Module 1. The real ML client (Python/FastAPI, trained on MIT SuperCloud)
 * will implement this interface and replace the mock without any UI change.
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
