import { useId, useState } from 'react'
import type { CoolingSite } from '../../types/analysis'

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

/** The weather behind the cooling figures: collapsed by default, like the Assumptions panel. */
export default function ClimatePanel({ site }: { site: CoolingSite }) {
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
          Ashburn climate
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

      <div id={panelId} role="region" aria-label="Ashburn climate" hidden={!open} className="space-y-4 px-6 pb-6">
        <p className="text-ink-700">
          {`Hourly weather for a typical year (${site.periodOfRecord}) from ${site.weatherStation}, about 10 km from Ashburn. Source: ${site.weatherSource}.`}
        </p>
        <p className="text-sm text-ink-600">
          Cooling depends mostly on the wet-bulb temperature, which combines heat and humidity. Below about 7 °C
          the cooling towers alone can make the chilled water; above about 13 °C the chiller must do all of it.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">Monthly weather in the typical year used for Ashburn</caption>
            <thead>
              <tr className="border-b border-ink-200 text-ink-500">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Month
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Air temp. (°C)
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Wet-bulb (°C)
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Humidity (%)
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Lowest / highest (°C)
                </th>
              </tr>
            </thead>
            <tbody>
              {site.monthlyClimate.map((m) => (
                <tr key={m.month} className="border-b border-ink-100 last:border-0">
                  <th scope="row" className="py-2 pr-4 font-semibold">
                    {MONTHS[m.month - 1]}
                  </th>
                  <td className="py-2 pr-4">{m.meanDryBulbC.toFixed(1)}</td>
                  <td className="py-2 pr-4">{m.meanWetBulbC.toFixed(1)}</td>
                  <td className="py-2 pr-4">{Math.round(m.meanRelHumidityPct)}</td>
                  <td className="py-2">{`${m.minDryBulbC.toFixed(1)} / ${m.maxDryBulbC.toFixed(1)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
