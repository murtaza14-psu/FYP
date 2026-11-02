import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { SITE, TEAM } from '../config/site'
import ContactPage from './ContactPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <ContactPage />
    </MemoryRouter>,
  )
}

describe('ContactPage', () => {
  it('shows the project email as text and as a mailto link', () => {
    renderPage()
    const link = screen.getByRole('link', { name: SITE.contactEmail })
    expect(link).toHaveAttribute('href', `mailto:${SITE.contactEmail}`)
  })

  it('shows the institution address', () => {
    renderPage()
    expect(screen.getByText(SITE.address)).toBeInTheDocument()
  })

  it('lists each team member with an email', () => {
    renderPage()
    for (const member of TEAM) {
      expect(screen.getByText(member.name)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: member.email })).toHaveAttribute('href', `mailto:${member.email}`)
    }
  })

  it('has no form', () => {
    const { container } = renderPage()
    expect(container.querySelector('form')).toBeNull()
  })
})
