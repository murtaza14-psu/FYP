import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { makeResult } from '../../test/fixtures'
import type { AnalysisResult } from '../../types/analysis'
import ClimatePanel from './ClimatePanel'

let result: AnalysisResult

beforeAll(async () => {
  result = await makeResult()
})

describe('ClimatePanel', () => {
  it('is collapsed by default', () => {
    render(<ClimatePanel site={result.cooling.site} />)
    const toggle = screen.getByRole('button', { name: /ashburn climate/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('table', { hidden: true })).not.toBeVisible()
  })

  it('expands to a table with the twelve months of weather', async () => {
    const user = userEvent.setup()
    render(<ClimatePanel site={result.cooling.site} />)
    await user.click(screen.getByRole('button', { name: /ashburn climate/i }))
    expect(screen.getByRole('button', { name: /ashburn climate/i })).toHaveAttribute('aria-expanded', 'true')

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(13)
    const july = within(table).getByRole('row', { name: /^July/ })
    const m = result.cooling.site.monthlyClimate[6]
    expect(july).toHaveTextContent(m.meanDryBulbC.toFixed(1))
    expect(july).toHaveTextContent(m.meanWetBulbC.toFixed(1))
    expect(july).toHaveTextContent(`${Math.round(m.meanRelHumidityPct)}`)
  })

  it('names the weather station and source, and explains the wet-bulb thresholds', async () => {
    const user = userEvent.setup()
    render(<ClimatePanel site={result.cooling.site} />)
    await user.click(screen.getByRole('button', { name: /ashburn climate/i }))
    expect(screen.getByText(/Dulles/)).toBeVisible()
    expect(screen.getByText(/2011-2025/)).toBeVisible()
    expect(screen.getByText(/wet-bulb/i, { selector: 'p' })).toBeVisible()
  })
})
