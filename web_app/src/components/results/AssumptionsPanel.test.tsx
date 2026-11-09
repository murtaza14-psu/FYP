import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { makeResult } from '../../test/fixtures'
import type { CoolingContext } from '../../types/analysis'
import AssumptionsPanel from './AssumptionsPanel'

let cooling: CoolingContext

beforeAll(async () => {
  cooling = (await makeResult()).cooling
})

async function open() {
  const user = userEvent.setup()
  render(<AssumptionsPanel cooling={cooling} />)
  await user.click(screen.getByRole('button', { name: /assumptions and equations/i }))
}

describe('AssumptionsPanel', () => {
  it('is collapsed by default', () => {
    render(<AssumptionsPanel cooling={cooling} />)
    const toggle = screen.getByRole('button', { name: /assumptions and equations/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByRole('table', { hidden: true })[0]).not.toBeVisible()
  })

  it('expands to show the equations for both techniques', async () => {
    await open()
    expect(screen.getByRole('button', { name: /assumptions and equations/i })).toHaveAttribute('aria-expanded', 'true')
    for (const token of [/efan/, /fmech/, /fdry/, /hfg/, /blowdown = /]) {
      expect(screen.getAllByText(token, { selector: 'li' })[0]).toBeVisible()
    }
  })

  it('has a parameter table per technique with the high-use, typical and low-use values', async () => {
    await open()
    const air = screen.getByRole('table', { name: /air cooling parameters/i })
    const fan = within(air).getByRole('row', { name: /fan power/i })
    expect(fan).toHaveTextContent('1.25')
    expect(fan).toHaveTextContent('0.75')
    expect(fan).toHaveTextContent('0.5')
    expect(within(air).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Parameter',
      'High use',
      'Typical',
      'Low use',
    ])

    const d2c = screen.getByRole('table', { name: /direct-to-chip parameters/i })
    const cap = within(d2c).getByRole('row', { name: /cold plates/i })
    expect(cap).toHaveTextContent('0.7')
    expect(cap).toHaveTextContent('0.8')
    expect(cap).toHaveTextContent('0.94')
    expect(within(d2c).getByRole('row', { name: /building-water supply/i })).toHaveTextContent('27')
  })

  it('states the blowdown assumption, the even load, and that only GPU heat is cooled', async () => {
    await open()
    expect(screen.getByText(/4 cycles of concentration/i)).toBeVisible()
    expect(screen.getByText(/spread evenly/i)).toBeVisible()
    expect(screen.getAllByText(/GPU heat only/i).length).toBeGreaterThan(0)
  })

  it('lists how gaps in the equations were filled', async () => {
    await open()
    expect(screen.getByRole('heading', { name: /how the gaps in the equations were filled/i })).toBeVisible()
    expect(screen.getByText(/saturated/i)).toBeVisible()
  })

  it('says immersion cooling is not modelled, and no longer calls the values placeholders', async () => {
    await open()
    expect(screen.getByText(/immersion cooling is not modelled/i)).toBeVisible()
    expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument()
  })
})
