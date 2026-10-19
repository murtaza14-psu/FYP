import type { CoolingEstimate, RankedTechnique, RankingCriterion } from '../types/analysis'

/** Each resource use divided by the largest across techniques, so 1 = worst and values lie in (0, 1]. */
function normalise(values: number[]): number[] {
  const max = Math.max(...values)
  return values.map((v) => (max === 0 ? 0 : v / max))
}

/**
 * PLACEHOLDER for Module 3. Ranks by a single resource or an equal-weight blend.
 * AHP (criteria weights) and TOPSIS (closeness to the ideal solution) will replace this.
 * Lower score is better; ties keep input order.
 */
export function rankTechniques(
  estimates: readonly CoolingEstimate[],
  criterion: RankingCriterion,
): RankedTechnique[] {
  const water = normalise(estimates.map((e) => e.waterLitres.value))
  const electricity = normalise(estimates.map((e) => e.electricityKWh.value))

  const scored = estimates.map((estimate, index) => {
    const score =
      criterion === 'water'
        ? water[index]
        : criterion === 'electricity'
          ? electricity[index]
          : (water[index] + electricity[index]) / 2
    return { techniqueId: estimate.techniqueId, score, index }
  })

  scored.sort((a, b) => a.score - b.score || a.index - b.index)

  return scored.map(({ techniqueId, score }, i) => ({ rank: i + 1, techniqueId, score }))
}
