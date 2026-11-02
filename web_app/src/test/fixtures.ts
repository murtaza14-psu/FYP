import { runAnalysis } from '../services/analysis'
import type { AnalysisResult, PredictionInput } from '../types/analysis'

export const sampleInput: PredictionInput = {
  gpuCount: 64,
  smUtilPercent: 60,
  memUtilPercent: 30,
  hoursPerDay: 24,
  daysPerYear: 365,
}

export function makeResult(input: PredictionInput = sampleInput): Promise<AnalysisResult> {
  return runAnalysis(input)
}
