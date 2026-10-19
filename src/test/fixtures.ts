import { runAnalysis } from '../services/analysis'
import type { AnalysisResult, PredictionInput } from '../types/analysis'

export const sampleInput: PredictionInput = {
  taskType: 'training',
  gpuCount: 64,
  durationHours: 24,
  utilizationPercent: 80,
}

export function makeResult(input: PredictionInput = sampleInput): Promise<AnalysisResult> {
  return runAnalysis(input)
}
