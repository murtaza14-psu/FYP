import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { SITE, TEAM } from '../config/site'
import AboutPage from './AboutPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <AboutPage />
    </MemoryRouter>,
  )
}

describe('AboutPage', () => {
  it('has the project overview and problem statement sections', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /project overview/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /the problem/i })).toBeInTheDocument()
  })

  it('shows a card for every team member', () => {
    renderPage()
    for (const member of TEAM) {
      expect(screen.getByRole('heading', { name: member.name })).toBeInTheDocument()
      expect(screen.getByText(member.role)).toBeInTheDocument()
    }
  })

  it('shows the supervisor and institution', () => {
    renderPage()
    expect(screen.getByText(SITE.supervisor)).toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(SITE.institution)).length).toBeGreaterThan(0)
  })
})
