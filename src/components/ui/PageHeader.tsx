import type { ReactNode } from 'react'
import Container from './Container'

interface PageHeaderProps {
  title: string
  intro?: ReactNode
  eyebrow?: string
}

/** Dark banner at the top of every inner page. Renders the page's single <h1>. */
export default function PageHeader({ title, intro, eyebrow }: PageHeaderProps) {
  return (
    <section className="bg-ink-900 text-white">
      <Container className="py-12 sm:py-16">
        {eyebrow && (
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-coolant-300">{eyebrow}</p>
        )}
        <h1 className="text-3xl font-bold text-white sm:text-4xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-lg text-ink-200">{intro}</p>}
      </Container>
    </section>
  )
}
