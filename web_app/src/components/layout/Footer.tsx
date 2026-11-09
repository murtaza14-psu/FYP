import { SITE } from '../../config/site'
import Container from '../ui/Container'

const YEAR = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink-950 text-ink-300">
      <Container className="flex flex-col gap-3 py-8 text-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-display text-base font-semibold text-white">{SITE.name}</p>
          <p className="mt-1">Final Year Project · {SITE.institution}</p>
        </div>
        <div className="max-w-md sm:text-right">
          <p>
            Prototype: heat and cooling figures are model estimates for Ashburn, Virginia, and are not engineering advice.
          </p>
          <p className="mt-1">
            © {YEAR} {SITE.name}
          </p>
        </div>
      </Container>
    </footer>
  )
}
