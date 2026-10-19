import { ASHBURN } from '../data/regions'
import type { AnalysisResult, PredictionInput, RankingCriterion } from '../types/analysis'
import { estimateCooling, totalHeatEnergy } from './coolingModel'
import { mockHeatPredictor, type HeatPredictor } from './heatPrediction'
import { rankTechniques } from './ranking'

export interface AnalysisOptions {
  predictor?: HeatPredictor
  criterion?: RankingCriterion
}

/** Runs the full pipeline: heat prediction → cooling estimates → ranking. */
export async function runAnalysis(
  input: PredictionInput,
  { predictor = mockHeatPredictor, criterion = 'balanced' }: AnalysisOptions = {},
): Promise<AnalysisResult> {
  const region = ASHBURN
  const prediction = await predictor.predict(input)
  const estimates = estimateCooling(prediction, input.durationHours, region)

  return {
    input,
    region,
    prediction,
    heatEnergyKWh: totalHeatEnergy(prediction, input.durationHours),
    estimates,
    ranking: rankTechniques(estimates, criterion),
    criterion,
    createdAt: new Date().toISOString(),
  }
}
