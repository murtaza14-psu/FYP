import { ASHBURN } from '../data/regions'
import type { AnalysisResult, PredictionInput, RankingCriterion } from '../types/analysis'
import type { AnalysisBackend } from './analysisClient'
import { rankTechniques } from './ranking'

export interface AnalysisOptions {
  /** Where heat and cooling come from: the Python service in the app, a test double in tests. */
  backend: AnalysisBackend
  criterion?: RankingCriterion
}

/** Runs the full pipeline for one year: heat prediction + cooling estimates (one backend call) → ranking. */
export async function runAnalysis(
  input: PredictionInput,
  { backend, criterion = 'balanced' }: AnalysisOptions,
): Promise<AnalysisResult> {
  const { prediction, heatEnergyKWh, estimates, cooling } = await backend.analyse(input)

  return {
    input,
    region: ASHBURN,
    prediction,
    heatEnergyKWh,
    estimates,
    cooling,
    ranking: rankTechniques(estimates, criterion),
    criterion,
    createdAt: new Date().toISOString(),
  }
}
