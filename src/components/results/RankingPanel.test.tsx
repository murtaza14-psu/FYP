import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { CoolingEstimate } from '../../types/analysis'
import RankingPanel from './RankingPanel'

const range = (value: number) => ({ low: value * 0.9, value, high: value * 1.1 })

// Orders differ by criterion: water favours immersion, electricity favours air.
const estimates: CoolingEstimate[] = [
  { techniqueId: 'air', electricityKWh: range(50), waterLitres: range(2000) },
  { techniqueId: 'direct-to-chip', electricityKWh: range(200), waterLitres: range(700) },
  { techniqueId: 'immersion', electricityKWh: range(100), waterLitres: range(100) },
]

const names = () =>
  within(screen.getByRole('list', { name: /ranking/i }))
    .getAllByRole('listitem')
    .map((li) => li.querySelector('h3')?.textContent)

describe('RankingPanel', () => {
  it('offers water, electricity and balanced criteria', () => {
    render(<RankingPanel estimates={estimates} />)
    expect(screen.getByRole('radio', { name: 'Water' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Electricity' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Balanced' })).toBeChecked()
  })

  it('re-orders the list when the criterion changes', async () => {
    const user = userEvent.setup()
    render(<RankingPanel estimates={estimates} />)

    await user.click(screen.getByRole('radio', { name: 'Water' }))
    expect(names()).toEqual(['Immersion cooling', 'Direct-to-chip cooling', 'Air cooling'])

    await user.click(screen.getByRole('radio', { name: 'Electricity' }))
    expect(names()).toEqual(['Air cooling', 'Immersion cooling', 'Direct-to-chip cooling'])
  })

  it('marks only the first-ranked technique as recommended', async () => {
    const user = userEvent.setup()
    render(<RankingPanel estimates={estimates} />)
    await user.click(screen.getByRole('radio', { name: 'Electricity' }))
    const items = within(screen.getByRole('list', { name: /ranking/i })).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent(/recommended/i)
    expect(items[1]).not.toHaveTextContent(/recommended/i)
    expect(items[2]).not.toHaveTextContent(/recommended/i)
  })

  it('starts on the given criterion', () => {
    render(<RankingPanel estimates={estimates} initialCriterion="water" />)
    expect(screen.getByRole('radio', { name: 'Water' })).toBeChecked()
  })

  it('tells the user AHP and TOPSIS are coming soon', () => {
    render(<RankingPanel estimates={estimates} />)
    expect(screen.getByText(/AHP/)).toBeInTheDocument()
    expect(screen.getByText(/TOPSIS/)).toBeInTheDocument()
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })
})
