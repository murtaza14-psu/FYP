import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import { NAV_LINKS, SITE } from '../../config/site'
import Container from '../ui/Container'

function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="#0891b2" />
      <rect x="9" y="9" width="14" height="14" rx="2" fill="none" stroke="#ecfeff" strokeWidth="2" />
      <path
        d="M13 5v4M19 5v4M13 23v4M19 23v4M5 13h4M5 19h4M23 13h4M23 19h4"
        stroke="#ecfeff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/95 text-white backdrop-blur">
      <Container className="flex items-center justify-between gap-4 py-3">
        <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-semibold">
          <BrandMark />
          <span>{SITE.name}</span>
        </Link>

        <button
          type="button"
          className="rounded-md p-2 text-ink-100 hover:bg-white/10 md:hidden"
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>

        <nav
          id="main-nav"
          aria-label="Main"
          className={`${open ? 'flex' : 'hidden'} absolute inset-x-0 top-full flex-col gap-1 border-b border-white/10 bg-ink-950 p-4 md:static md:flex md:flex-row md:items-center md:gap-1 md:border-0 md:bg-transparent md:p-0`}
        >
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-coolant-600/20 text-coolant-200' : 'text-ink-200 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </Container>
    </header>
  )
}
