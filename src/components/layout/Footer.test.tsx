import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { SITE } from '../../config/site'
import Footer from './Footer'

describe('Footer', () => {
  it('shows the current year and project name', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveTextContent(String(new Date().getFullYear()))
    expect(footer).toHaveTextContent(SITE.name)
  })

  it('states that this is a prototype using placeholder values', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/prototype/i)
  })
})
