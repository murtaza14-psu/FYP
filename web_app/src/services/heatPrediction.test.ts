import { describe, expect, it } from 'vitest'
import type { PredictionInput } from '../types/analysis'
import { mockHeatPredictor } from './heatPrediction'

const input: PredictionInput = {
  taskType: 'training',
  gpuCount: 512,
  durationHours: 72,
  utilizationPercent: 85,
}

describe('mockHeatPredictor', () => {
  it('returns a promise', () => {
    expect(mockHeatPredictor.predict(input)).toBeInstanceOf(Promise)
  })

  it('returns the hard-coded 1.5 MW value with a 1.35–1.65 MW range', async () => {
    const result = await mockHeatPredictor.predict(input)
    expect(result.valueMW).toBe(1.5)
    expect(result.lowMW).toBeCloseTo(1.35)
    expect(result.highMW).toBeCloseTo(1.65)
  })

  it('keeps low ≤ value ≤ high', async () => {
    const { lowMW, valueMW, highMW } = await mockHeatPredictor.predict(input)
    expect(lowMW).toBeLessThanOrEqual(valueMW)
    expect(valueMW).toBeLessThanOrEqual(highMW)
  })

  it('is flagged as a mock', async () => {
    expect((await mockHeatPredictor.predict(input)).isMock).toBe(true)
  })

  it('ignores the input while mocked (same answer for any job)', async () => {
    const other = await mockHeatPredictor.predict({ ...input, gpuCount: 1 })
    expect(other.valueMW).toBe(1.5)
  })
})
