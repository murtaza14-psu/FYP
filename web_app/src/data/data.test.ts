import { describe, expect, it } from 'vitest'
import { COOLING_TECHNIQUES } from './coolingTechniques'
import { ASHBURN } from './regions'

describe('cooling techniques', () => {
  it('defines exactly three techniques with unique ids', () => {
    const ids = COOLING_TECHNIQUES.map((t) => t.id)
    expect(ids).toEqual(['air', 'direct-to-chip', 'immersion'])
    expect(new Set(ids).size).toBe(3)
  })

  it('has positive placeholder coefficients', () => {
    for (const t of COOLING_TECHNIQUES) {
      expect(t.energyFactor).toBeGreaterThan(0)
      expect(t.waterFactor).toBeGreaterThan(0)
    }
  })

  it('gives every technique a name and description', () => {
    for (const t of COOLING_TECHNIQUES) {
      expect(t.name.length).toBeGreaterThan(0)
      expect(t.shortDescription.length).toBeGreaterThan(0)
    }
  })
})

describe('region', () => {
  it('is Ashburn, Virginia', () => {
    expect(ASHBURN.id).toBe('ashburn-va')
    expect(ASHBURN.name).toBe('Ashburn, Virginia, USA')
  })
})
