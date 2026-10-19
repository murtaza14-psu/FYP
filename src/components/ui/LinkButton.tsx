import type { ReactNode } from 'react'
import { Link } from 'react-router'

type Variant = 'primary' | 'secondary' | 'outline'

const STYLES: Record<Variant, string> = {
  // For dark backgrounds
  primary: 'bg-coolant-400 text-ink-950 hover:bg-coolant-300',
  secondary: 'border border-white/30 text-white hover:bg-white/10',
  // For light backgrounds
  outline: 'border border-ink-300 text-ink-800 hover:bg-ink-100',
}

interface LinkButtonProps {
  to: string
  children: ReactNode
  variant?: Variant
}

export default function LinkButton({ to, children, variant = 'primary' }: LinkButtonProps) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center rounded-lg px-5 py-3 text-base font-semibold transition-colors ${STYLES[variant]}`}
    >
      {children}
    </Link>
  )
}
