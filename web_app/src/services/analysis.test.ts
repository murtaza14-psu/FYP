import { describe, expect, it } from 'vitest'
import { ASHBURN } from '../data/regions'
import type { HeatPredictor } from './heatPrediction'
import type { PredictionInput } from '../types/analysis'
import { runAnalysis } from './analysis'

const input: PredictionInput = {
  gpuCount: 64,
  smUtilPercent: 60,
  memUtilPercent: 30,
  hoursPerDay: 10,
  daysPerYear: 1,
}

describe('runAnalysis', () => {
  it('returns input, region, prediction, estimates, ranking and a timestamp', async () => {
    const result = await runAnalysis(input)
    expect(result.input).toEqual(input)
    expect(result.region).toEqual(ASHBURN)
    expect(result.prediction.valueMW).toBe(1.5)
    expect(result.heatEnergyKWh.value).toBeCloseTo(15_000)
    expect(result.estimates).toHaveLength(3)
    expect(result.ranking.map((r) => r.rank)).toEqual([1, 2, 3])
    expect(Number.isNaN(Date.parse(result.createdAt))).toBe(false)
  })

  it('uses an injected predictor when provided', async () => {
    const predictor: HeatPredictor = {
      predict: async () => ({ valueMW: 2, lowMW: 1.8, highMW: 2.2, isMock: false }),
    }
    const result = await runAnalysis(input, { predictor })
    expect(result.prediction.valueMW).toBe(2)
    expect(result.prediction.isMock).toBe(false)
    expect(result.heatEnergyKWh.value).toBeCloseTo(20_000)
  })

  it('applies the requested ranking criterion', async () => {
    const result = await runAnalysis(input, { criterion: 'water' })
    expect(result.criterion).toBe('water')
    expect(result.ranking[0].techniqueId).toBe('immersion')
  })

  it('defaults to the balanced criterion', async () => {
    expect((await runAnalysis(input)).criterion).toBe('balanced')
  })
})
