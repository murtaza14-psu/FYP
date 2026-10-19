import { useId, useState } from 'react'
import Container from '../components/ui/Container'
import PageHeader from '../components/ui/PageHeader'
import { FAQ_ITEMS, type FaqItem } from '../data/faq'
import { usePageTitle } from '../lib/usePageTitle'

function FaqEntry({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className="border-b border-ink-200 last:border-b-0">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-lg font-semibold text-ink-900 hover:bg-ink-50"
        >
          {item.question}
          <svg
            viewBox="0 0 24 24"
            className={`h-5 w-5 shrink-0 text-coolant-700 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </h2>
      <div id={panelId} role="region" hidden={!open} className="px-5 pb-5 text-ink-600">
        <p>{item.answer}</p>
      </div>
    </div>
  )
}

export default function FaqPage() {
  usePageTitle('FAQ')

  return (
    <>
      <PageHeader title="Frequently Asked Questions" intro="Answers about the prototype, its data and how it will develop." />
      <Container className="max-w-3xl py-14">
        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
          {FAQ_ITEMS.map((item) => (
            <FaqEntry key={item.question} item={item} />
          ))}
        </div>
      </Container>
    </>
  )
}
