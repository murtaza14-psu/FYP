import { render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { COOLING_TECHNIQUES } from '../../data/coolingTechniques'
import { formatEnergy, formatVolume } from '../../lib/format'
import { makeResult } from '../../test/fixtures'
import type { AnalysisResult } from '../../types/analysis'
import CoolingComparison from './CoolingComparison'

let result: AnalysisResult

beforeAll(async () => {
  result = await makeResult()
})

const rowFor = (name: RegExp) => within(screen.getByRole('table')).getByRole('row', { name })

describe('CoolingComparison', () => {
  it('has a table row per modelled technique, and none for immersion', () => {
    render(<CoolingComparison estimates={result.estimates} />)
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(1 + COOLING_TECHNIQUES.length)
    expect(screen.queryByText(/immersion/i)).not.toBeInTheDocument()
  })

  it('shows formatted electricity and water for each technique', () => {
    render(<CoolingComparison estimates={result.estimates} />)
    for (const technique of COOLING_TECHNIQUES) {
      const estimate = result.estimates.find((e) => e.techniqueId === technique.id)!
      const row = rowFor(new RegExp(technique.name))
      expect(row).toHaveTextContent(formatEnergy(estimate.electricityKWh.value))
      expect(row).toHaveTextContent(formatVolume(estimate.waterLitres.value))
    }
  })

  it('shows the low–high range in each cell', () => {
    render(<CoolingComparison estimates={result.estimates} />)
    const air = result.estimates[0]
    const row = rowFor(/air cooling/i)
    expect(row).toHaveTextContent(`${formatEnergy(air.electricityKWh.low)} – ${formatEnergy(air.electricityKWh.high)}`)
    expect(row).toHaveTextContent(`${formatVolume(air.waterLitres.low)} – ${formatVolume(air.waterLitres.high)}`)
  })

  it('splits the water into evaporation, blowdown and drift', () => {
    render(<CoolingComparison estimates={result.estimates} />)
    const air = result.estimates[0]
    const row = rowFor(/air cooling/i)
    expect(row).toHaveTextContent(`Evaporation ${formatVolume(air.waterBreakdown.evaporation)}`)
    expect(row).toHaveTextContent(`Blowdown ${formatVolume(air.waterBreakdown.blowdown)}`)
    expect(row).toHaveTextContent(`Drift ${formatVolume(air.waterBreakdown.drift)}`)
  })

  it('shows the resources used per kWh of GPU heat', () => {
    render(<CoolingComparison estimates={result.estimates} />)
    const d2c = result.estimates[1]
    const row = rowFor(/direct-to-chip/i)
    expect(row).toHaveTextContent(`${d2c.kWhPerKWhHeat.toFixed(2)} kWh`)
    expect(row).toHaveTextContent(`${d2c.litresPerKWhHeat.toFixed(2)} L`)
  })

  it('labels every chart bar for assistive technology, matching the data', () => {
    render(<CoolingComparison estimates={result.estimates} />)
    for (const technique of COOLING_TECHNIQUES) {
      const estimate = result.estimates.find((e) => e.techniqueId === technique.id)!
      expect(
        screen.getByRole('img', { name: `${technique.name} electricity ${formatEnergy(estimate.electricityKWh.value)}` }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('img', { name: `${technique.name} water ${formatVolume(estimate.waterLitres.value)}` }),
      ).toBeInTheDocument()
    }
  })

  it('scales the bars so the largest high-end value fits, and draws each technique in proportion', () => {
    render(<CoolingComparison estimates={result.estimates} />)
    const [air, d2c] = result.estimates
    const max = Math.max(air.electricityKWh.high, d2c.electricityKWh.high)
    const airBar = screen.getByRole('img', { name: /air cooling electricity/i })
    const d2cBar = screen.getByRole('img', { name: /direct-to-chip cooling electricity/i })
    expect(parseFloat(airBar.style.width)).toBeCloseTo((air.electricityKWh.value / max) * 100, 1)
    expect(parseFloat(d2cBar.style.width)).toBeCloseTo((d2c.electricityKWh.value / max) * 100, 1)
    expect(parseFloat(airBar.style.width)).toBeGreaterThan(parseFloat(d2cBar.style.width))
  })

  it('explains what the range means and that only GPU heat is cooled', () => {
    render(<CoolingComparison estimates={result.estimates} />)
    expect(screen.getByText(/headline figure is the typical case/i)).toBeInTheDocument()
    expect(screen.getByText(/GPU heat only/i)).toBeInTheDocument()
  })

  it('lists the notes of each technique under its name', () => {
    render(<CoolingComparison estimates={result.estimates} />)
    const notes = screen.getByRole('region', { name: /notes/i })
    expect(within(notes).getAllByRole('heading', { level: 4 }).map((h) => h.textContent)).toEqual([
      'Air cooling',
      'Direct-to-chip cooling',
    ])
    expect(within(notes).getAllByText('mock note')).toHaveLength(2)
  })

  it('shows where direct-to-chip heat leaves the building, and the electricity items', () => {
    render(<CoolingComparison estimates={result.estimates} />)
    const row = rowFor(/direct-to-chip/i)
    expect(row).toHaveTextContent(/dry cooler 92 %/i)
    expect(row).toHaveTextContent(/tower 8 %/i)
    expect(rowFor(/air cooling/i)).toHaveTextContent(/Air-handler fans/)
  })
})
