import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import HowItWorksPage from './HowItWorksPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <HowItWorksPage />
    </MemoryRouter>,
  )
}

describe('HowItWorksPage', () => {
  it('lists four numbered steps in order', () => {
    renderPage()
    const steps = within(screen.getByRole('list', { name: /steps/i })).getAllByRole('listitem')
    expect(steps).toHaveLength(4)
    expect(steps[0]).toHaveTextContent(/describe your workload/i)
    expect(steps[1]).toHaveTextContent(/predict the heat/i)
    expect(steps[2]).toHaveTextContent(/estimate cooling/i)
    expect(steps[3]).toHaveTextContent(/compare and rank/i)
  })

  it('explains every prediction input', () => {
    renderPage()
    const terms = screen.getAllByRole('term').map((t) => t.textContent)
    expect(terms).toEqual(
      expect.arrayContaining(['Task type', 'Number of GPUs', 'Duration', 'GPU utilisation', 'Region']),
    )
  })

  it('links to the predict page', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Try it now' })).toHaveAttribute('href', '/predict')
  })
})
