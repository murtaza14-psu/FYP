import { Link } from 'react-router'
import { TASK_TYPES } from '../../data/taskTypes'
import { formatEnergy, formatNumber, formatPower } from '../../lib/format'
import type { AnalysisResult } from '../../types/analysis'

const plural = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`

export default function HeatSummary({ result }: { result: AnalysisResult }) {
  const { prediction, input, region, heatEnergyKWh } = result
  const taskLabel = TASK_TYPES.find((t) => t.id === input.taskType)?.label ?? input.taskType

  const recap = [
    ['Task type', taskLabel],
    ['GPUs', plural(input.gpuCount, 'GPU', 'GPUs')],
    ['Duration', plural(input.durationHours, 'hour', 'hours')],
    ['GPU utilisation', `${input.utilizationPercent}%`],
    ['Region', region.name],
  ]

  return (
    <section aria-labelledby="heat-heading" className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="heat-heading" className="text-2xl font-bold">
          Predicted heat load
        </h2>
        {prediction.isMock && (
          <span
            className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900"
            title="This value is hard-coded while the machine-learning model is being built."
          >
            Mock value
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-500">Heat load</p>
          <p className="mt-1 font-display text-4xl font-bold text-heat">{formatPower(prediction.valueMW)}</p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-500">Likely range</p>
          <p className="mt-2 text-xl font-semibold text-ink-800">
            {`${formatPower(prediction.lowMW)} – ${formatPower(prediction.highMW)}`}
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-500">Total heat energy</p>
          <p className="mt-2 text-xl font-semibold text-ink-800">{formatEnergy(heatEnergyKWh.value)}</p>
        </div>
      </div>

      <div className="mt-8 border-t border-ink-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Your inputs</h3>
          <Link to="/predict" className="text-sm font-semibold text-coolant-700 underline">
            Edit inputs
          </Link>
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-5">
          {recap.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</dt>
              <dd className="mt-1 font-medium text-ink-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
