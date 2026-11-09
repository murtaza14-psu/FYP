import { useId, useState } from 'react'
import { getTechnique } from '../../data/coolingTechniques'
import { formatEnergy, formatVolume } from '../../lib/format'
import type { CoolingEstimate, CoolingTechniqueId } from '../../types/analysis'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

type MetricKey = 'electricity' | 'water'

const METRICS: { key: MetricKey; label: string; pick: (m: CoolingEstimate['monthly'][number]) => number; format: (n: number) => string }[] = [
  { key: 'electricity', label: 'Electricity', pick: (m) => m.electricityKWh, format: formatEnergy },
  { key: 'water', label: 'Water', pick: (m) => m.waterLitres, format: formatVolume },
]

/** Dark vs light, so the two series differ in lightness as well as hue. */
const SERIES_COLOR: Record<CoolingTechniqueId, string> = {
  air: 'bg-ink-700',
  'direct-to-chip': 'bg-coolant-400',
}

export default function MonthlyBreakdown({ estimates }: { estimates: readonly CoolingEstimate[] }) {
  const groupName = useId()
  const [metricKey, setMetricKey] = useState<MetricKey>('electricity')
  const metric = METRICS.find((m) => m.key === metricKey)!
  const max = Math.max(0, ...estimates.flatMap((e) => e.monthly.map(metric.pick)))

  return (
    <section aria-labelledby="monthly-heading" className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 id="monthly-heading" className="text-2xl font-bold">
        Month by month
      </h2>
      <p className="mt-2 text-ink-600">
        Cooling needs follow the weather: in Ashburn the chillers and cooling towers work hardest in summer, when it is
        hot and humid, and much less in winter.
      </p>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-ink-900">Show</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {METRICS.map((m) => (
            <label
              key={m.key}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-300 bg-white px-4 py-2 has-[:checked]:border-coolant-600 has-[:checked]:bg-coolant-50 has-[:checked]:ring-2 has-[:checked]:ring-coolant-600/30"
            >
              <input
                type="radio"
                name={groupName}
                value={m.key}
                checked={metricKey === m.key}
                onChange={() => setMetricKey(m.key)}
                className="accent-coolant-600"
              />
              <span className="font-medium">{m.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <ul aria-label="Legend" className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {estimates.map((estimate) => (
          <li key={estimate.techniqueId} className="flex items-center gap-2">
            <span className={`inline-block h-3 w-3 rounded-sm ${SERIES_COLOR[estimate.techniqueId]}`} aria-hidden="true" />
            <span>{getTechnique(estimate.techniqueId).name}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid grid-cols-12 gap-1 sm:gap-2">
        {MONTHS.map((month, index) => (
          <div key={month} className="flex flex-col items-center">
            <div className="flex h-44 w-full items-end justify-center gap-0.5">
              {estimates.map((estimate) => {
                const name = getTechnique(estimate.techniqueId).name
                const value = metric.pick(estimate.monthly[index])
                const height = max === 0 ? 0 : Number(((value / max) * 100).toFixed(2))
                return (
                  <div
                    key={estimate.techniqueId}
                    role="img"
                    aria-label={`${name} ${month} ${metric.key} ${metric.format(value)}`}
                    className={`w-full max-w-4 rounded-t-sm ${SERIES_COLOR[estimate.techniqueId]}`}
                    style={{ height: `${height}%` }}
                  />
                )
              })}
            </div>
            <span className="mt-1 text-[0.65rem] text-ink-500 sm:text-xs" aria-hidden="true">
              {month.slice(0, 3)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-500">Typical case. The tallest bar is the month with the highest use of either technique.</p>
    </section>
  )
}
