import { ASHBURN } from '../data/regions'
import type { AnalysisResult, PredictionInput, RankingCriterion } from '../types/analysis'
import { estimateCooling, totalHeatEnergy } from './coolingModel'
import { mockHeatPredictor, type HeatPredictor } from './heatPrediction'
import { rankTechniques } from './ranking'
import { operatingHoursPerYear } from '../lib/validation'

export interface AnalysisOptions {
  predictor?: HeatPredictor
  criterion?: RankingCriterion
}

/** Runs the full pipeline (annual figures: heat energy is over a year of operating hours): heat prediction → cooling estimates → ranking. */
export async function runAnalysis(
  input: PredictionInput,
  { predictor = mockHeatPredictor, criterion = 'balanced' }: AnalysisOptions = {},
): Promise<AnalysisResult> {
  const region = ASHBURN
  const prediction = await predictor.predict(input)
  const hours = operatingHoursPerYear(input)
  const estimates = estimateCooling(prediction, hours, region)

  return {
    input,
    region,
    prediction,
    heatEnergyKWh: totalHeatEnergy(prediction, hours),
    estimates,
    ranking: rankTechniques(estimates, criterion),
    criterion,
    createdAt: new Date().toISOString(),
  }
}
