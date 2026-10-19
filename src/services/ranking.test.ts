import { describe, expect, it } from 'vitest'
import type { CoolingEstimate } from '../types/analysis'
import { rankTechniques } from './ranking'

const range = (value: number) => ({ low: value * 0.9, value, high: value * 1.1 })

// air: heavy on water & electricity; immersion: light on both; d2c: in between.
const estimates: CoolingEstimate[] = [
  { techniqueId: 'air', electricityKWh: range(500), waterLitres: range(2000) },
  { techniqueId: 'direct-to-chip', electricityKWh: range(200), waterLitres: range(700) },
  { techniqueId: 'immersion', electricityKWh: range(100), waterLitres: range(100) },
]

describe('rankTechniques', () => {
  it('ranks lowest water use first for the water criterion', () => {
    expect(rankTechniques(estimates, 'water').map((r) => r.techniqueId)).toEqual([
      'immersion',
      'direct-to-chip',
      'air',
    ])
  })

  it('ranks lowest electricity first for the electricity criterion', () => {
    // Make electricity order differ from water order.
    const custom: CoolingEstimate[] = [
      { techniqueId: 'air', electricityKWh: range(50), waterLitres: range(2000) },
      { techniqueId: 'direct-to-chip', electricityKWh: range(200), waterLitres: range(700) },
      { techniqueId: 'immersion', electricityKWh: range(100), waterLitres: range(100) },
    ]
    expect(rankTechniques(custom, 'electricity').map((r) => r.techniqueId)).toEqual([
      'air',
      'immersion',
      'direct-to-chip',
    ])
  })

  it('ranks by an equal-weight normalised score for the balanced criterion', () => {
    const ranked = rankTechniques(estimates, 'balanced')
    expect(ranked.map((r) => r.techniqueId)).toEqual(['immersion', 'direct-to-chip', 'air'])
    expect(ranked[0].score).toBeLessThan(ranked[2].score)
  })

  it('numbers ranks 1..n with no gaps', () => {
    expect(rankTechniques(estimates, 'balanced').map((r) => r.rank)).toEqual([1, 2, 3])
  })

  it('keeps input order for ties', () => {
    const tied: CoolingEstimate[] = [
      { techniqueId: 'air', electricityKWh: range(100), waterLitres: range(100) },
      { techniqueId: 'direct-to-chip', electricityKWh: range(100), waterLitres: range(100) },
    ]
    expect(rankTechniques(tied, 'water').map((r) => r.techniqueId)).toEqual(['air', 'direct-to-chip'])
  })

  it('does not mutate its input', () => {
    const copy = structuredClone(estimates)
    rankTechniques(estimates, 'water')
    expect(estimates).toEqual(copy)
  })

  it('returns an empty list for no estimates', () => {
    expect(rankTechniques([], 'water')).toEqual([])
  })
})
