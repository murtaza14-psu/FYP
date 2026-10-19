import { describe, expect, it } from 'vitest'
import { COOLING_TECHNIQUES } from '../data/coolingTechniques'
import { ASHBURN } from '../data/regions'
import type { HeatPrediction } from '../types/analysis'
import { estimateCooling, totalHeatEnergy } from './coolingModel'

const prediction: HeatPrediction = { valueMW: 1.5, lowMW: 1.35, highMW: 1.65, isMock: true }

describe('totalHeatEnergy', () => {
  it('is MW × 1000 × hours (kWh)', () => {
    const energy = totalHeatEnergy(prediction, 24)
    expect(energy.value).toBeCloseTo(36_000)
    expect(energy.low).toBeCloseTo(32_400)
    expect(energy.high).toBeCloseTo(39_600)
  })

  it('is zero for zero duration', () => {
    expect(totalHeatEnergy(prediction, 0)).toEqual({ low: 0, value: 0, high: 0 })
  })
})

describe('estimateCooling', () => {
  const estimates = estimateCooling(prediction, 24, ASHBURN)

  it('returns one estimate per technique, in order', () => {
    expect(estimates.map((e) => e.techniqueId)).toEqual(COOLING_TECHNIQUES.map((t) => t.id))
  })

  it('computes electricity as heat energy × energy factor', () => {
    for (const t of COOLING_TECHNIQUES) {
      const e = estimates.find((x) => x.techniqueId === t.id)!
      expect(e.electricityKWh.value).toBeCloseTo(36_000 * t.energyFactor)
    }
  })

  it('computes water as heat energy × water factor', () => {
    for (const t of COOLING_TECHNIQUES) {
      const e = estimates.find((x) => x.techniqueId === t.id)!
      expect(e.waterLitres.value).toBeCloseTo(36_000 * t.waterFactor)
    }
  })

  it('uses the prediction range for low/high bounds', () => {
    const air = estimates[0]
    expect(air.electricityKWh.low).toBeCloseTo(32_400 * COOLING_TECHNIQUES[0].energyFactor)
    expect(air.electricityKWh.high).toBeCloseTo(39_600 * COOLING_TECHNIQUES[0].energyFactor)
  })

  it('returns zeros for zero duration', () => {
    for (const e of estimateCooling(prediction, 0, ASHBURN)) {
      expect(e.electricityKWh.value).toBe(0)
      expect(e.waterLitres.value).toBe(0)
    }
  })

  it('is deterministic', () => {
    expect(estimateCooling(prediction, 24, ASHBURN)).toEqual(estimates)
  })
})
