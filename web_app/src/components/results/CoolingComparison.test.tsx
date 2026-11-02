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

describe('CoolingComparison', () => {
  it('has a table row per technique with formatted electricity and water', () => {
    render(<CoolingComparison estimates={result.estimates} />)
    const table = screen.getByRole('table')
    for (const technique of COOLING_TECHNIQUES) {
      const estimate = result.estimates.find((e) => e.techniqueId === technique.id)!
      const row = within(table).getByRole('row', { name: new RegExp(technique.name) })
      expect(row).toHaveTextContent(formatEnergy(estimate.electricityKWh.value))
      expect(row).toHaveTextContent(formatVolume(estimate.waterLitres.value))
    }
  })

  it('shows the low–high range in each cell', () => {
    render(<CoolingComparison estimates={result.estimates} />)
    const air = result.estimates[0]
    const row = within(screen.getByRole('table')).getByRole('row', { name: /air cooling/i })
    expect(row).toHaveTextContent(`${formatEnergy(air.electricityKWh.low)} – ${formatEnergy(air.electricityKWh.high)}`)
    expect(row).toHaveTextContent(`${formatVolume(air.waterLitres.low)} – ${formatVolume(air.waterLitres.high)}`)
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

  it('draws the largest value as a full-width bar and others proportionally', () => {
    render(<CoolingComparison estimates={result.estimates} />)
    const air = result.estimates[0]
    const immersion = result.estimates[2]
    const airBar = screen.getByRole('img', { name: /air cooling electricity/i })
    const immersionBar = screen.getByRole('img', { name: /immersion cooling electricity/i })
    expect(airBar.style.width).toBe('100%')
    const expected = (immersion.electricityKWh.value / air.electricityKWh.value) * 100
    expect(parseFloat(immersionBar.style.width)).toBeCloseTo(expected, 1)
  })
})
