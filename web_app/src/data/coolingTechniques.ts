import type { CoolingTechnique } from '../types/analysis'

/**
 * PLACEHOLDER coefficients — illustrative values only.
 * Module 2 (physics model) will replace these with region- and load-dependent equations.
 */
export const COOLING_TECHNIQUES: readonly CoolingTechnique[] = [
  {
    id: 'air',
    name: 'Air cooling',
    shortDescription: 'Chilled air circulated through server racks by CRAH units and chillers.',
    energyFactor: 0.35,
    waterFactor: 1.8,
  },
  {
    id: 'direct-to-chip',
    name: 'Direct-to-chip cooling',
    shortDescription: 'Cold plates on each GPU carry heat away in a warm-water liquid loop.',
    energyFactor: 0.15,
    waterFactor: 0.6,
  },
  {
    id: 'immersion',
    name: 'Immersion cooling',
    shortDescription: 'Servers submerged in dielectric fluid that absorbs heat directly.',
    energyFactor: 0.05,
    waterFactor: 0.1,
  },
]

export function getTechnique(id: CoolingTechnique['id']): CoolingTechnique {
  const technique = COOLING_TECHNIQUES.find((t) => t.id === id)
  if (!technique) throw new Error(`Unknown cooling technique: ${id}`)
  return technique
}
