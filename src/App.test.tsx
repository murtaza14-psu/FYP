import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from './App'
import { SITE } from './config/site'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App', () => {
  it('renders without crashing', () => {
    renderAt('/')
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('has a skip-to-content link targeting the main landmark', () => {
    renderAt('/')
    const skip = screen.getByRole('link', { name: /skip to content/i })
    expect(skip).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it.each([
    ['/', /choose the right cooling/i],
    ['/about', /about us/i],
    ['/how-it-works', /how it works/i],
    ['/predict', /run a prediction/i],
    ['/results', /^results$/i],
    ['/faq', /frequently asked questions/i],
    ['/contact', /^contact$/i],
  ])('renders the page heading for %s', (path, heading) => {
    renderAt(path)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it('shows a 404 page with a link home for unknown routes', () => {
    renderAt('/nope')
    expect(screen.getByRole('heading', { level: 1, name: /page not found/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/')
  })

  it.each([
    ['/about', 'About Us'],
    ['/faq', 'FAQ'],
    ['/nope', 'Page not found'],
  ])('sets the document title for %s', (path, title) => {
    renderAt(path)
    expect(document.title).toBe(`${title} · ${SITE.name}`)
  })

  it('sets the plain site title on the home page', () => {
    renderAt('/')
    expect(document.title).toBe(`${SITE.name} · ${SITE.tagline}`)
  })

  it('navigates between pages through the header', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('link', { name: 'FAQ' }))
    expect(screen.getByRole('heading', { level: 1, name: /frequently asked questions/i })).toBeInTheDocument()
  })
})
