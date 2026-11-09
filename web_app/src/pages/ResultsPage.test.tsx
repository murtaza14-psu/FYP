import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeAll, describe, expect, it } from 'vitest'
import { makeResult } from '../test/fixtures'
import { AnalysisContext } from '../state/analysisContext'
import type { AnalysisResult } from '../types/analysis'
import ResultsPage from './ResultsPage'

let result: AnalysisResult

beforeAll(async () => {
  result = await makeResult()
})

function renderPage(value: AnalysisResult | null) {
  return render(
    <MemoryRouter>
      <AnalysisContext.Provider value={{ result: value, setResult: () => {}, clear: () => {} }}>
        <ResultsPage />
      </AnalysisContext.Provider>
    </MemoryRouter>,
  )
}

describe('ResultsPage', () => {
  it('shows an empty state with a link to predict when there is no analysis', () => {
    renderPage(null)
    expect(screen.getByRole('heading', { level: 1, name: /^results$/i })).toBeInTheDocument()
    expect(screen.getByText(/no results yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /run a prediction/i })).toHaveAttribute('href', '/predict')
  })

  it('shows every results section when an analysis exists', () => {
    renderPage(result)
    expect(screen.getByRole('heading', { name: /^annual heat$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /cooling comparison/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /month by month/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ashburn climate/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^ranking$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /assumptions and equations/i })).toBeInTheDocument()
    expect(screen.queryByText(/no results yet/i)).not.toBeInTheDocument()
  })

  it('lists the sections in reading order: heat, cooling, months, climate, ranking, assumptions', () => {
    renderPage(result)
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '')
    const at = (re: RegExp) => headings.findIndex((t) => re.test(t))
    const order = [/^annual heat$/i, /cooling comparison/i, /month by month/i, /ashburn climate/i, /^ranking$/i, /assumptions/i].map(at)
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('compares exactly the two modelled techniques', () => {
    renderPage(result)
    expect(screen.queryByText(/immersion cooling$/i)).not.toBeInTheDocument()
    expect(screen.getAllByRole('row', { name: /air cooling/i }).length).toBeGreaterThan(0)
  })

  it('names the recommended technique', () => {
    renderPage(result)
    expect(screen.getByText(/recommended/i)).toBeInTheDocument()
  })
})
