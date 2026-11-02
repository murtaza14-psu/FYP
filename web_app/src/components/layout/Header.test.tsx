import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { NAV_LINKS, SITE } from '../../config/site'
import Header from './Header'

function renderHeader(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Header />
    </MemoryRouter>,
  )
}

describe('Header', () => {
  it('shows the project name linking home', () => {
    renderHeader('/faq')
    expect(screen.getByRole('link', { name: SITE.name })).toHaveAttribute('href', '/')
  })

  it('links to all seven pages', () => {
    renderHeader()
    expect(NAV_LINKS).toHaveLength(7)
    const nav = screen.getByRole('navigation', { name: /main/i })
    for (const { label, to } of NAV_LINKS) {
      const link = Array.from(nav.querySelectorAll('a')).find((a) => a.textContent === label)
      expect(link, label).toBeDefined()
      expect(link).toHaveAttribute('href', to)
    }
  })

  it('marks only the current page with aria-current="page"', () => {
    renderHeader('/faq')
    const nav = screen.getByRole('navigation', { name: /main/i })
    const current = nav.querySelectorAll('[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('FAQ')
  })

  it('does not mark Home as current on other pages', () => {
    renderHeader('/about')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('toggles the mobile menu with aria-expanded', async () => {
    const user = userEvent.setup()
    renderHeader()
    const button = screen.getByRole('button', { name: /menu/i })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the mobile menu after choosing a link', async () => {
    const user = userEvent.setup()
    renderHeader()
    const button = screen.getByRole('button', { name: /menu/i })
    await user.click(button)
    await user.click(screen.getByRole('link', { name: 'FAQ' }))
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })
})
