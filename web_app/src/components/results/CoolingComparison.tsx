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

/** Drift is tiny: say so instead of rounding it to "0 L". */
const formatLitres = (litres: number) => (litres > 0 && litres < 1 ? '< 1 L' : formatVolume(litres))

const percent = (share: number) => `${Math.round(share * 100)} %`

/** Bars show the typical value; the thin line under each bar spans the low–high range. */
function BarChart({ metric, estimates }: { metric: Metric; estimates: readonly CoolingEstimate[] }) {
  const max = Math.max(0, ...estimates.map((e) => metric.pick(e).high))
  const toPercent = (value: number) => (max === 0 ? 0 : Number(((value / max) * 100).toFixed(2)))
  return (
    <figure className="rounded-xl border border-ink-200 bg-ink-50 p-5">
      <figcaption className="font-display text-base font-semibold text-ink-900">{metric.title} used per year</figcaption>
      <div className="mt-4 space-y-4">
        {estimates.map((estimate) => {
          const name = getTechnique(estimate.techniqueId).name
          const range = metric.pick(estimate)
          const formatted = metric.format(range.value)
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
                  style={{ width: `${toPercent(range.value)}%` }}
                />
              </div>
              <div className="relative mt-1 h-2" aria-hidden="true">
                <div
                  className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-ink-700"
                  style={{ left: `${toPercent(range.low)}%`, width: `${toPercent(range.high) - toPercent(range.low)}%` }}
                />
                <div className="absolute top-0 h-2 w-0.5 bg-ink-700" style={{ left: `${toPercent(range.low)}%` }} />
                <div className="absolute top-0 h-2 w-0.5 bg-ink-700" style={{ left: `calc(${toPercent(range.high)}% - 2px)` }} />
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-ink-500">Bar: typical case. Line: low to high range.</p>
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
        Electricity and water each technique needs to remove a year of your GPUs&apos; heat in Ashburn, Virginia. The
        headline figure is the typical case; the range runs from the best case (low heat, efficient equipment) to the
        worst (high heat, less efficient equipment).
      </p>
      <p className="mt-2 text-sm text-ink-500">
        GPU heat only: CPUs, networking, storage and lighting are not included. Water is evaporation plus drift plus
        blowdown.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {METRICS.map((metric) => (
          <BarChart key={metric.key} metric={metric} estimates={estimates} />
        ))}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">
            Electricity and water use by cooling technique, with low–high ranges and use per kWh of GPU heat
          </caption>
          <thead>
            <tr className="border-b border-ink-200 text-ink-500">
              <th scope="col" className="py-2 pr-4 font-semibold">
                Technique
              </th>
              <th scope="col" className="py-2 pr-4 font-semibold">
                Electricity
              </th>
              <th scope="col" className="py-2 pr-4 font-semibold">
                Water
              </th>
              <th scope="col" className="py-2 font-semibold">
                Per kWh of GPU heat
              </th>
            </tr>
          </thead>
          <tbody>
            {estimates.map((estimate) => {
              const items = estimate.electricityItems.filter((item) => item.value > 0)
              const water = estimate.waterBreakdown
              return (
                <tr key={estimate.techniqueId} className="border-b border-ink-100 align-top last:border-0">
                  <th scope="row" className="py-3 pr-4 font-semibold text-ink-900">
                    {getTechnique(estimate.techniqueId).name}
                  </th>
                  <td className="py-3 pr-4">
                    <span className="font-semibold">{formatEnergy(estimate.electricityKWh.value)}</span>
                    <span className="block text-xs text-ink-500">{rangeText(estimate.electricityKWh, formatEnergy)}</span>
                    <span className="mt-1 block text-xs text-ink-500">
                      {items.map((item) => `${item.label} ${formatEnergy(item.value)}`).join(' · ')}
                    </span>
                    {estimate.heatSplit && (
                      <span className="mt-1 block text-xs text-ink-500">
                        {`Liquid heat leaves via dry cooler ${percent(estimate.heatSplit.dryCooler)} · tower ${percent(estimate.heatSplit.tower)} · chiller ${percent(estimate.heatSplit.chiller)}`}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="font-semibold">{formatVolume(estimate.waterLitres.value)}</span>
                    <span className="block text-xs text-ink-500">{rangeText(estimate.waterLitres, formatVolume)}</span>
                    <span className="mt-1 block text-xs text-ink-500">
                      {`Evaporation ${formatLitres(water.evaporation)} · Blowdown ${formatLitres(water.blowdown)} · Drift ${formatLitres(water.drift)}`}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className="font-semibold">{`${estimate.kWhPerKWhHeat.toFixed(2)} kWh`}</span>
                    <span className="block font-semibold">{`${estimate.litresPerKWhHeat.toFixed(2)} L`}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <section aria-labelledby="cooling-notes-heading" className="mt-6 rounded-xl bg-ink-50 p-4">
        <h3 id="cooling-notes-heading" className="text-sm font-semibold text-ink-900">
          Notes
        </h3>
        <div className="mt-2 grid gap-4 text-sm text-ink-600 md:grid-cols-2">
          {estimates.map((estimate) => (
            <div key={estimate.techniqueId}>
              <h4 className="font-semibold text-ink-800">{getTechnique(estimate.techniqueId).name}</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {estimate.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </section>
  )
}
