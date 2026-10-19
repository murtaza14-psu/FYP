import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { COOLING_TECHNIQUES } from '../../data/coolingTechniques'
import AssumptionsPanel from './AssumptionsPanel'

describe('AssumptionsPanel', () => {
  it('is collapsed by default', () => {
    render(<AssumptionsPanel />)
    const toggle = screen.getByRole('button', { name: /assumptions and equations/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('table', { hidden: true })).not.toBeVisible()
  })

  it('expands to show the formulas and a coefficient table', async () => {
    const user = userEvent.setup()
    render(<AssumptionsPanel />)
    await user.click(screen.getByRole('button', { name: /assumptions and equations/i }))

    expect(screen.getByRole('button', { name: /assumptions and equations/i })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByText(/heat energy/i)[0]).toBeVisible()

    const table = screen.getByRole('table')
    for (const t of COOLING_TECHNIQUES) {
      const row = within(table).getByRole('row', { name: new RegExp(t.name) })
      expect(row).toHaveTextContent(String(t.energyFactor))
      expect(row).toHaveTextContent(String(t.waterFactor))
    }
  })

  it('states that the values are placeholders', async () => {
    const user = userEvent.setup()
    render(<AssumptionsPanel />)
    await user.click(screen.getByRole('button', { name: /assumptions and equations/i }))
    expect(screen.getAllByText(/placeholder/i).length).toBeGreaterThan(0)
  })
})
