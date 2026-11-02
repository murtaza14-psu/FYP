import { useId, useState } from 'react'
import { COOLING_TECHNIQUES } from '../../data/coolingTechniques'

const FORMULAS = [
  'Heat load (MW) = GPUs × power per GPU (W) ÷ 1,000,000, where power per GPU is the average of five trained models.',
  'Annual heat energy (kWh) = heat load (MW) × 1,000 × hours per day × days per year',
  'Electricity (kWh) = heat energy × electricity factor',
  'Water (L) = heat energy × water factor',
  'Low and high values use the lower and upper bounds of the predicted heat load.',
  'Ranking: each resource is divided by the largest value among the techniques; the lowest score ranks first. Balanced averages water and electricity.',
]

export default function AssumptionsPanel() {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <section className="rounded-2xl border border-ink-200 bg-white shadow-sm">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-4 rounded-2xl px-6 py-5 text-left text-xl font-bold text-ink-900 hover:bg-ink-50"
        >
          Assumptions and equations
          <svg
            viewBox="0 0 24 24"
            className={`h-5 w-5 shrink-0 text-coolant-700 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </h2>

      <div id={panelId} role="region" aria-label="Assumptions and equations" hidden={!open} className="space-y-6 px-6 pb-6">
        <p className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900">
          The heat figures come from the trained ML ensemble. The cooling factors below are placeholders that will be
          replaced by physics-based models for Ashburn, Virginia.
        </p>

        <div>
          <h3 className="font-semibold">Equations</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-700">
            {FORMULAS.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-ink-500">Assumes essentially all electrical power drawn by the GPUs becomes heat.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <caption className="mb-2 text-left font-semibold">Placeholder factors per kWh of heat removed</caption>
            <thead>
              <tr className="border-b border-ink-200 text-ink-500">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Technique
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Electricity (kWh)
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Water (L)
                </th>
              </tr>
            </thead>
            <tbody>
              {COOLING_TECHNIQUES.map((t) => (
                <tr key={t.id} className="border-b border-ink-100 last:border-0">
                  <th scope="row" className="py-2 pr-4 font-semibold">
                    {t.name}
                  </th>
                  <td className="py-2 pr-4">{t.energyFactor}</td>
                  <td className="py-2">{t.waterFactor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
