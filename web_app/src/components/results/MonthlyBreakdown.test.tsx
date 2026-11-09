import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { formatEnergy, formatVolume } from '../../lib/format'
import { makeResult } from '../../test/fixtures'
import type { AnalysisResult } from '../../types/analysis'
import MonthlyBreakdown from './MonthlyBreakdown'

let result: AnalysisResult

beforeAll(async () => {
  result = await makeResult()
})

describe('MonthlyBreakdown', () => {
  it('shows electricity first, with one bar per technique per month', () => {
    render(<MonthlyBreakdown estimates={result.estimates} />)
    expect(screen.getByRole('radio', { name: 'Electricity' })).toBeChecked()
    expect(screen.getAllByRole('img', { name: /electricity/i })).toHaveLength(24)
  })

  it('labels each bar with technique, month and value', () => {
    render(<MonthlyBreakdown estimates={result.estimates} />)
    const air = result.estimates[0]
    const july = air.monthly[6]
    expect(
      screen.getByRole('img', { name: `Air cooling July electricity ${formatEnergy(july.electricityKWh)}` }),
    ).toBeInTheDocument()
    const d2c = result.estimates[1].monthly[0]
    expect(
      screen.getByRole('img', { name: `Direct-to-chip cooling January electricity ${formatEnergy(d2c.electricityKWh)}` }),
    ).toBeInTheDocument()
  })

  it('switches to water', async () => {
    const user = userEvent.setup()
    render(<MonthlyBreakdown estimates={result.estimates} />)
    await user.click(screen.getByRole('radio', { name: 'Water' }))
    expect(screen.queryAllByRole('img', { name: /electricity/i })).toHaveLength(0)
    const air = result.estimates[0]
    expect(
      screen.getByRole('img', { name: `Air cooling July water ${formatVolume(air.monthly[6].waterLitres)}` }),
    ).toBeInTheDocument()
  })

  it('draws the biggest month as the tallest bar and the others in proportion', () => {
    render(<MonthlyBreakdown estimates={result.estimates} />)
    const air = result.estimates[0]
    const max = Math.max(...result.estimates.flatMap((e) => e.monthly.map((m) => m.electricityKWh)))
    const july = screen.getByRole('img', { name: /Air cooling July electricity/ })
    const january = screen.getByRole('img', { name: /Air cooling January electricity/ })
    expect(parseFloat(july.style.height)).toBeCloseTo((air.monthly[6].electricityKWh / max) * 100, 1)
    expect(parseFloat(january.style.height)).toBeLessThan(parseFloat(july.style.height))
  })

  it('has a legend naming both techniques', () => {
    render(<MonthlyBreakdown estimates={result.estimates} />)
    const legend = screen.getByRole('list', { name: /legend/i })
    expect(within(legend).getByText('Air cooling')).toBeInTheDocument()
    expect(within(legend).getByText('Direct-to-chip cooling')).toBeInTheDocument()
  })

  it('has a heading and explains the seasonal pattern', () => {
    render(<MonthlyBreakdown estimates={result.estimates} />)
    expect(screen.getByRole('heading', { name: /month by month/i })).toBeInTheDocument()
    expect(screen.getByText(/summer/i)).toBeInTheDocument()
  })
})
