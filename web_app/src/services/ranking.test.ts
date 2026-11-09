import { describe, expect, it } from 'vitest'
import type { RankableEstimate } from '../types/analysis'
import { rankTechniques } from './ranking'

const range = (value: number) => ({ low: value * 0.9, value, high: value * 1.1 })

// air: heavy on water & electricity; direct-to-chip: lighter on both.
const estimates: RankableEstimate[] = [
  { techniqueId: 'air', electricityKWh: range(500), waterLitres: range(2000) },
  { techniqueId: 'direct-to-chip', electricityKWh: range(200), waterLitres: range(700) },
]

describe('rankTechniques', () => {
  it('ranks lowest water use first for the water criterion', () => {
    expect(rankTechniques(estimates, 'water').map((r) => r.techniqueId)).toEqual(['direct-to-chip', 'air'])
  })

  it('ranks lowest electricity first for the electricity criterion', () => {
    // Make the electricity order differ from the water order.
    const custom: RankableEstimate[] = [
      { techniqueId: 'air', electricityKWh: range(50), waterLitres: range(2000) },
      { techniqueId: 'direct-to-chip', electricityKWh: range(200), waterLitres: range(700) },
    ]
    expect(rankTechniques(custom, 'electricity').map((r) => r.techniqueId)).toEqual(['air', 'direct-to-chip'])
    expect(rankTechniques(custom, 'water').map((r) => r.techniqueId)).toEqual(['direct-to-chip', 'air'])
  })

  it('ranks by an equal-weight normalised score for the balanced criterion', () => {
    const ranked = rankTechniques(estimates, 'balanced')
    expect(ranked.map((r) => r.techniqueId)).toEqual(['direct-to-chip', 'air'])
    expect(ranked[0].score).toBeLessThan(ranked[1].score)
    expect(ranked[1].score).toBeCloseTo(1)
  })

  it('numbers ranks 1..n with no gaps', () => {
    expect(rankTechniques(estimates, 'balanced').map((r) => r.rank)).toEqual([1, 2])
  })

  it('keeps input order for ties', () => {
    const tied: RankableEstimate[] = [
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
