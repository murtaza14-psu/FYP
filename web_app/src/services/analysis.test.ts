import { describe, expect, it, vi } from 'vitest'
import { ASHBURN } from '../data/regions'
import { mockBackend } from '../test/mockBackend'
import type { PredictionInput } from '../types/analysis'
import { runAnalysis } from './analysis'
import type { AnalysisBackend } from './analysisClient'

const input: PredictionInput = {
  gpuCount: 64,
  smUtilPercent: 60,
  memUtilPercent: 30,
  hoursPerDay: 10,
  daysPerYear: 1,
}

describe('runAnalysis', () => {
  it('returns input, region, prediction, heat, estimates, cooling context, ranking and a timestamp', async () => {
    const result = await runAnalysis(input, { backend: mockBackend })
    expect(result.input).toEqual(input)
    expect(result.region).toEqual(ASHBURN)
    expect(result.prediction.valueMW).toBe(1.5)
    expect(result.heatEnergyKWh.value).toBeCloseTo(15_000)
    expect(result.estimates.map((e) => e.techniqueId)).toEqual(['air', 'direct-to-chip'])
    expect(result.cooling.site.name).toBe(ASHBURN.name)
    expect(result.ranking.map((r) => r.rank)).toEqual([1, 2])
    expect(Number.isNaN(Date.parse(result.createdAt))).toBe(false)
  })

  it('asks the backend once, with the user input', async () => {
    const analyse = vi.fn(mockBackend.analyse)
    await runAnalysis(input, { backend: { analyse } })
    expect(analyse).toHaveBeenCalledTimes(1)
    expect(analyse).toHaveBeenCalledWith(input)
  })

  it('uses the heat and cooling the backend returns', async () => {
    const base = await mockBackend.analyse(input)
    const backend: AnalysisBackend = {
      analyse: async () => ({
        ...base,
        prediction: { ...base.prediction, valueMW: 2, isMock: false },
        heatEnergyKWh: { low: 1, value: 20_000, high: 30_000 },
      }),
    }
    const result = await runAnalysis(input, { backend })
    expect(result.prediction.valueMW).toBe(2)
    expect(result.prediction.isMock).toBe(false)
    expect(result.heatEnergyKWh.value).toBe(20_000)
    expect(result.estimates).toEqual(base.estimates)
  })

  it('applies the requested ranking criterion', async () => {
    const result = await runAnalysis(input, { backend: mockBackend, criterion: 'water' })
    expect(result.criterion).toBe('water')
    expect(result.ranking[0].techniqueId).toBe('direct-to-chip')
  })

  it('defaults to the balanced criterion', async () => {
    expect((await runAnalysis(input, { backend: mockBackend })).criterion).toBe('balanced')
  })

  it('lets backend errors reach the caller', async () => {
    const backend: AnalysisBackend = { analyse: async () => Promise.reject(new Error('service down')) }
    await expect(runAnalysis(input, { backend })).rejects.toThrow('service down')
  })
})
