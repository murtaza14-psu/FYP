import { useId, useMemo, useState } from 'react'
import { getTechnique } from '../../data/coolingTechniques'
import { formatEnergy, formatVolume } from '../../lib/format'
import { rankTechniques } from '../../services/ranking'
import type { CoolingEstimate, RankingCriterion } from '../../types/analysis'

const CRITERIA: { id: RankingCriterion; label: string; hint: string }[] = [
  { id: 'water', label: 'Water', hint: 'Least water consumed' },
  { id: 'electricity', label: 'Electricity', hint: 'Least electricity used' },
  { id: 'balanced', label: 'Balanced', hint: 'Equal weight on both' },
]

interface RankingPanelProps {
  estimates: readonly CoolingEstimate[]
  initialCriterion?: RankingCriterion
}

export default function RankingPanel({ estimates, initialCriterion = 'balanced' }: RankingPanelProps) {
  const groupName = useId()
  const [criterion, setCriterion] = useState<RankingCriterion>(initialCriterion)
  const ranked = useMemo(() => rankTechniques(estimates, criterion), [estimates, criterion])

  return (
    <section aria-labelledby="ranking-heading" className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 id="ranking-heading" className="text-2xl font-bold">
        Ranking
      </h2>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-ink-900">Rank by</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {CRITERIA.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-300 bg-white px-4 py-2 has-[:checked]:border-coolant-600 has-[:checked]:bg-coolant-50 has-[:checked]:ring-2 has-[:checked]:ring-coolant-600/30"
            >
              <input
                type="radio"
                name={groupName}
                value={c.id}
                checked={criterion === c.id}
                onChange={() => setCriterion(c.id)}
                className="accent-coolant-600"
              />
              <span className="font-medium">{c.label}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-500">{CRITERIA.find((c) => c.id === criterion)?.hint}</p>
      </fieldset>

      <ol aria-label="Ranking" className="mt-6 space-y-3">
        {ranked.map((item) => {
          const technique = getTechnique(item.techniqueId)
          const estimate = estimates.find((e) => e.techniqueId === item.techniqueId)!
          const first = item.rank === 1
          return (
            <li
              key={item.techniqueId}
              className={`flex items-center gap-4 rounded-xl border p-4 ${
                first ? 'border-coolant-600 bg-coolant-50' : 'border-ink-200 bg-white'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold ${
                  first ? 'bg-coolant-600 text-white' : 'bg-ink-100 text-ink-700'
                }`}
                aria-hidden="true"
              >
                {item.rank}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">{technique.name}</h3>
                  {first && (
                    <span className="rounded-full bg-coolant-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-600">
                  {formatVolume(estimate.waterLitres.value)} water · {formatEnergy(estimate.electricityKWh.value)} electricity
                </p>
              </div>
            </li>
          )
        })}
      </ol>

      <p className="mt-6 rounded-lg bg-ink-100 p-3 text-sm text-ink-700">
        This is a simple placeholder ranking. Multi-criteria ranking with AHP and TOPSIS is coming soon.
      </p>
    </section>
  )
}
