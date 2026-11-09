import type { CoolingTechnique } from '../types/analysis'

/**
 * The two techniques modelled in Module 2 (equations in `docs/Cooling_Equations_Summary.pdf`, implemented in
 * `cooling_module/`). Their electricity and water figures come from the prediction service, not from this file.
 * Immersion cooling has no equations yet and is not modelled.
 */
export const COOLING_TECHNIQUES: readonly CoolingTechnique[] = [
  {
    id: 'air',
    name: 'Air cooling',
    shortDescription: 'Chilled air circulated through the server racks, cooled by chillers and cooling towers.',
  },
  {
    id: 'direct-to-chip',
    name: 'Direct-to-chip cooling',
    shortDescription:
      'Cold plates on each GPU carry most of the heat away in a liquid loop; dry coolers do the work whenever the weather allows.',
  },
]

export function getTechnique(id: CoolingTechnique['id']): CoolingTechnique {
  const technique = COOLING_TECHNIQUES.find((t) => t.id === id)
  if (!technique) throw new Error(`Unknown cooling technique: ${id}`)
  return technique
}
