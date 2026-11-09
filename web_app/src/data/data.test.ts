import { describe, expect, it } from 'vitest'
import { COOLING_TECHNIQUES, getTechnique } from './coolingTechniques'
import { ASHBURN } from './regions'

describe('cooling techniques', () => {
  it('defines exactly the two modelled techniques with unique ids', () => {
    const ids = COOLING_TECHNIQUES.map((t) => t.id)
    expect(ids).toEqual(['air', 'direct-to-chip'])
    expect(new Set(ids).size).toBe(2)
  })

  it('does not list immersion cooling, which is not modelled', () => {
    expect(COOLING_TECHNIQUES.some((t) => /immersion/i.test(t.name))).toBe(false)
  })

  it('keeps no placeholder coefficients: the numbers come from the cooling model', () => {
    for (const t of COOLING_TECHNIQUES) {
      expect(t).not.toHaveProperty('energyFactor')
      expect(t).not.toHaveProperty('waterFactor')
    }
  })

  it('gives every technique a name and description', () => {
    for (const t of COOLING_TECHNIQUES) {
      expect(t.name.length).toBeGreaterThan(0)
      expect(t.shortDescription.length).toBeGreaterThan(0)
    }
  })

  it('looks a technique up by id', () => {
    expect(getTechnique('air').name).toBe('Air cooling')
  })
})

describe('region', () => {
  it('is Ashburn, Virginia', () => {
    expect(ASHBURN.id).toBe('ashburn-va')
    expect(ASHBURN.name).toBe('Ashburn, Virginia, USA')
  })

  it('says real hourly weather is used', () => {
    expect(ASHBURN.climateNote).toMatch(/hourly weather/i)
    expect(ASHBURN.climateNote).not.toMatch(/placeholder/i)
  })
})
