import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { COOLING_TECHNIQUES } from '../data/coolingTechniques'
import HomePage from './HomePage'

function renderPage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  it('shows the hero heading', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: /choose the right cooling for your gpu workload/i })).toBeInTheDocument()
  })

  it('has a primary call to action linking to the predict page', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Start a prediction' })).toHaveAttribute('href', '/predict')
  })

  it('has a secondary call to action linking to how it works', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'See how it works' })).toHaveAttribute('href', '/how-it-works')
  })

  it('explains the three modules in order', () => {
    renderPage()
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    const first = headings.findIndex((t) => /predict heat/i.test(t ?? ''))
    const second = headings.findIndex((t) => /model cooling/i.test(t ?? ''))
    const third = headings.findIndex((t) => /rank the options/i.test(t ?? ''))
    expect(first).toBeGreaterThanOrEqual(0)
    expect(second).toBeGreaterThan(first)
    expect(third).toBeGreaterThan(second)
  })

  it('highlights each cooling technique', () => {
    renderPage()
    for (const t of COOLING_TECHNIQUES) {
      expect(screen.getByRole('heading', { name: t.name })).toBeInTheDocument()
    }
  })
})
