import { useId, useState } from 'react'
import type { CoolingContext, ParameterRow } from '../../types/analysis'

const value = (n: number) => String(Number(n.toPrecision(4)))

function ParameterTable({ caption, rows }: { caption: string; rows: ParameterRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-left text-sm">
        <caption className="mb-2 text-left font-semibold">{caption}</caption>
        <thead>
          <tr className="border-b border-ink-200 text-ink-500">
            <th scope="col" className="py-2 pr-4 font-semibold">
              Parameter
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              High use
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold">
              Typical
            </th>
            <th scope="col" className="py-2 font-semibold">
              Low use
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-ink-100 last:border-0">
              <th scope="row" className="py-2 pr-4 font-semibold">
                {row.label} <span className="font-normal text-ink-500">({row.unit})</span>
              </th>
              <td className="py-2 pr-4">{value(row.highUse)}</td>
              <td className="py-2 pr-4">{value(row.typical)}</td>
              <td className="py-2">{value(row.lowUse)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AssumptionsPanel({ cooling }: { cooling: CoolingContext }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const { assumptions, parameters, site } = cooling

  const equations = [
    'Heat: GPUs × power per GPU (average of five trained models) × hours per day × days per year. Essentially all electrical power drawn by the GPUs becomes heat.',
    'Air cooling, electricity: Ecool = efan·Q + (Qchw ÷ 3.517) × [fmech·kch + kpump + ktower], with efan = 3.412 × SFP ÷ (1.08 × ΔTair), Qchw = Q ÷ ηUPS + efan·Q and fmech = 1 − clamp[(Ts + ΔTchw − Twb − atower − ahx) ÷ ΔTchw, 0, 1].',
    'Air cooling, water: W = 3600 × Qrej × [fevap ÷ hfg(Tao) + d ÷ (cp × ΔTrange)], with Qrej = Qchw + Ech + Epump, hfg(T) = 2501 − 2.361·T, fevap = hfg × (wout − win) ÷ (ha,out − ha,in) and Tao = Twb + atower + ΔTrange ÷ 2.',
    'Direct-to-chip, electricity: Ecool = ECDU + EFWS + Edry + Ech,liq + Etwr + Eair. The rise in building-water temperature is shared by the dry cooler, the tower and the chiller: fdry = (Tret − T1) ÷ ΔTFWS, ftwr = (T1 − T2) ÷ ΔTFWS, fch = (T2 − Tfws) ÷ ΔTFWS.',
    'Direct-to-chip, water: only the two cooling towers (the liquid side, used in warm weather, and the small air system) evaporate water, calculated like the air-cooling water equation. The coolant loop, building-water loop and dry coolers use none.',
    `Blowdown (added to the document): blowdown = evaporation ÷ (cycles of concentration − 1) − drift, with ${assumptions.cyclesOfConcentration} cycles of concentration. Drift is ${assumptions.driftPercent} % of the circulating water.`,
    'Each equation is evaluated for every hour of the weather year and summed. Both techniques use a UPS efficiency of ' + `${assumptions.upsEfficiency}.`,
  ]

  const gaps = [
    `The GPU heat is ${assumptions.loadProfile}. Running only at night or only in winter would give different results.`,
    'The air leaving a cooling tower is taken as saturated at the tower water temperature, and the evaporation share is kept between 0 and 100 %.',
    'The equation document uses two air pressures (101.325 and 100.5 kPa) and two tower-fan values; the hourly station pressure from the weather file and one tower-fan value (0.0586 kW/ton) are used instead.',
    'The document sums air cooling by month and direct-to-chip by time step; both are calculated hourly here. For air cooling in Ashburn the monthly and hourly answers differ by less than 1 %.',
    'Water is the water consumed by the towers, taking 1 kg as 1 litre.',
  ]

  const limits = [
    `${assumptions.heatBasis}: CPUs, networking, storage and lighting are not cooled in these figures.`,
    `One typical weather year for ${site.name}; hotter or colder years will differ.`,
    'Fan, chiller and pump efficiencies do not change with load, as in the equation document.',
    'Immersion cooling is not modelled because its equations are not yet available.',
  ]

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
        <p className="rounded-lg bg-coolant-50 p-3 text-sm font-medium text-coolant-800">
          Heat comes from the trained ML ensemble. Electricity and water come from the physical equations of the project&apos;s
          Cooling Equations Summary, run hour by hour for a typical year in {site.name}.
        </p>

        <div>
          <h3 className="font-semibold">Equations</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-700">
            {equations.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          <h3 className="font-semibold">Parameters</h3>
          <p className="text-sm text-ink-600">
            The document gives three values for some parameters. They are used as a range: {assumptions.range}.
          </p>
          <ParameterTable caption="Air cooling parameters" rows={parameters.air} />
          <ParameterTable caption="Direct-to-chip parameters" rows={parameters.directToChip} />
        </div>

        <div>
          <h3 className="font-semibold">How the gaps in the equations were filled</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-700">
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">Limits</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-700">
            {limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-ink-500">
          Ranking: each resource is divided by the largest value among the techniques and the lowest score ranks first;
          Balanced averages water and electricity. AHP and TOPSIS will replace this.
        </p>
      </div>
    </section>
  )
}
