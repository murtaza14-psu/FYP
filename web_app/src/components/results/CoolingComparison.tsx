import { getTechnique } from '../../data/coolingTechniques'
import { formatEnergy, formatVolume } from '../../lib/format'
import type { CoolingEstimate, Range } from '../../types/analysis'

type Metric = {
  key: 'electricity' | 'water'
  title: string
  color: string
  pick: (e: CoolingEstimate) => Range
  format: (n: number) => string
}

const METRICS: Metric[] = [
  { key: 'electricity', title: 'Electricity', color: 'bg-energy', pick: (e) => e.electricityKWh, format: formatEnergy },
  { key: 'water', title: 'Water', color: 'bg-water', pick: (e) => e.waterLitres, format: formatVolume },
]

const rangeText = (range: Range, format: (n: number) => string) => `${format(range.low)} – ${format(range.high)}`

function BarChart({ metric, estimates }: { metric: Metric; estimates: readonly CoolingEstimate[] }) {
  const max = Math.max(0, ...estimates.map((e) => metric.pick(e).value))
  return (
    <figure className="rounded-xl border border-ink-200 bg-ink-50 p-5">
      <figcaption className="font-display text-base font-semibold text-ink-900">{metric.title} used</figcaption>
      <div className="mt-4 space-y-4">
        {estimates.map((estimate) => {
          const name = getTechnique(estimate.techniqueId).name
          const value = metric.pick(estimate).value
          const percent = max === 0 ? 0 : Number(((value / max) * 100).toFixed(2))
          const formatted = metric.format(value)
          return (
            <div key={estimate.techniqueId}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-ink-800">{name}</span>
                <span className="font-semibold text-ink-900">{formatted}</span>
              </div>
              <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-ink-200">
                <div
                  role="img"
                  aria-label={`${name} ${metric.key} ${formatted}`}
                  className={`h-full rounded-full ${metric.color}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </figure>
  )
}

export default function CoolingComparison({ estimates }: { estimates: readonly CoolingEstimate[] }) {
  return (
    <section aria-labelledby="cooling-heading" className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 id="cooling-heading" className="text-2xl font-bold">
        Cooling comparison
      </h2>
      <p className="mt-2 text-ink-600">
        Estimated electricity and water each technique needs to remove the heat of your job.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {METRICS.map((metric) => (
          <BarChart key={metric.key} metric={metric} estimates={estimates} />
        ))}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <caption className="sr-only">Electricity and water use by cooling technique, with low–high ranges</caption>
          <thead>
            <tr className="border-b border-ink-200 text-ink-500">
              <th scope="col" className="py-2 pr-4 font-semibold">
                Technique
              </th>
              <th scope="col" className="py-2 pr-4 font-semibold">
                Electricity
              </th>
              <th scope="col" className="py-2 font-semibold">
                Water
              </th>
            </tr>
          </thead>
          <tbody>
            {estimates.map((estimate) => (
              <tr key={estimate.techniqueId} className="border-b border-ink-100 last:border-0">
                <th scope="row" className="py-3 pr-4 font-semibold text-ink-900">
                  {getTechnique(estimate.techniqueId).name}
                </th>
                <td className="py-3 pr-4">
                  <span className="font-semibold">{formatEnergy(estimate.electricityKWh.value)}</span>
                  <span className="block text-xs text-ink-500">{rangeText(estimate.electricityKWh, formatEnergy)}</span>
                </td>
                <td className="py-3">
                  <span className="font-semibold">{formatVolume(estimate.waterLitres.value)}</span>
                  <span className="block text-xs text-ink-500">{rangeText(estimate.waterLitres, formatVolume)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
