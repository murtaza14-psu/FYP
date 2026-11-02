import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { FAQ_ITEMS } from '../data/faq'
import FaqPage from './FaqPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <FaqPage />
    </MemoryRouter>,
  )
}

describe('FaqPage', () => {
  it('renders every question from the data', () => {
    renderPage()
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(6)
    for (const item of FAQ_ITEMS) {
      expect(screen.getByRole('button', { name: item.question })).toBeInTheDocument()
    }
  })

  it('hides answers initially', () => {
    renderPage()
    for (const item of FAQ_ITEMS) {
      expect(screen.getByRole('button', { name: item.question })).toHaveAttribute('aria-expanded', 'false')
    }
    expect(screen.queryByText(FAQ_ITEMS[0].answer)).not.toBeVisible()
  })

  it('expands an answer when its question is clicked, and collapses it again', async () => {
    const user = userEvent.setup()
    renderPage()
    const question = screen.getByRole('button', { name: FAQ_ITEMS[0].question })

    await user.click(question)
    expect(question).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(FAQ_ITEMS[0].answer)).toBeVisible()

    await user.click(question)
    expect(question).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(FAQ_ITEMS[0].answer)).not.toBeVisible()
  })

  it('keeps other answers closed when one is opened', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: FAQ_ITEMS[0].question }))
    expect(screen.getByRole('button', { name: FAQ_ITEMS[1].question })).toHaveAttribute('aria-expanded', 'false')
  })
})
