import { COOLING_TECHNIQUES } from '../data/coolingTechniques'
import type { CoolingEstimate, HeatPrediction, Range, Region } from '../types/analysis'

const KWH_PER_MWH = 1000

/** Total heat energy over the job in kWh (assumes all GPU electrical power becomes heat). */
export function totalHeatEnergy(prediction: HeatPrediction, durationHours: number): Range {
  return {
    low: prediction.lowMW * KWH_PER_MWH * durationHours,
    value: prediction.valueMW * KWH_PER_MWH * durationHours,
    high: prediction.highMW * KWH_PER_MWH * durationHours,
  }
}

function scale(range: Range, factor: number): Range {
  return { low: range.low * factor, value: range.value * factor, high: range.high * factor }
}

/**
 * PLACEHOLDER for Module 2: linear per-kWh factors. The region is accepted already so the
 * real model can use local climate and grid data without a signature change.
 */
export function estimateCooling(
  prediction: HeatPrediction,
  durationHours: number,
  _region: Region,
): CoolingEstimate[] {
  const heat = totalHeatEnergy(prediction, durationHours)
  return COOLING_TECHNIQUES.map((technique) => ({
    techniqueId: technique.id,
    electricityKWh: scale(heat, technique.energyFactor),
    waterLitres: scale(heat, technique.waterFactor),
  }))
}
