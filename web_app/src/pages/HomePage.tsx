import Container from '../components/ui/Container'
import LinkButton from '../components/ui/LinkButton'
import { COOLING_TECHNIQUES } from '../data/coolingTechniques'
import { SITE } from '../config/site'
import { usePageTitle } from '../lib/usePageTitle'

const MODULES = [
  {
    title: 'Predict heat',
    body: 'Enter your number of GPUs, their utilisation and how long they run. Machine-learning models trained on the MIT SuperCloud dataset predict how much heat your fleet gives off in a year.',
  },
  {
    title: 'Model cooling',
    body: 'Physics-based equations turn that heat load into the water and electricity each cooling technique would use, based on conditions in your region.',
  },
  {
    title: 'Rank the options',
    body: 'Choose what matters most, such as saving water or electricity, and see the cooling techniques ranked, with the recommended one first.',
  },
]

export default function HomePage() {
  usePageTitle()

  return (
    <>
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(60rem 28rem at 85% -10%, rgba(34,211,238,0.22), transparent 60%), radial-gradient(40rem 24rem at -10% 110%, rgba(37,99,235,0.25), transparent 60%)',
          }}
          aria-hidden="true"
        />
        <Container className="relative py-20 sm:py-28">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-coolant-300">
            Final Year Project · Data-centre sustainability
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight text-white sm:text-6xl">
            Choose the right cooling for your GPU workload
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-200 sm:text-xl">
            {SITE.tagline} Compare air, direct-to-chip and immersion cooling for the heat your GPUs will produce.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <LinkButton to="/predict">Start a prediction</LinkButton>
            <LinkButton to="/how-it-works" variant="secondary">
              See how it works
            </LinkButton>
          </div>
          <ul className="mt-12 flex flex-wrap gap-2 text-sm text-ink-200">
            {['Ashburn, Virginia region', 'Water & electricity', '3 cooling techniques'].map((chip) => (
              <li key={chip} className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                {chip}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <h2 className="text-2xl font-bold sm:text-3xl">Three modules, one recommendation</h2>
          <p className="mt-3 max-w-2xl text-ink-600">
            From a workload description to a ranked cooling choice in three steps.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {MODULES.map((m, i) => (
              <article key={m.title} className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-coolant-100 font-display font-bold text-coolant-800"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <h3 className="mt-4 text-xl font-semibold">{m.title}</h3>
                <p className="mt-2 text-ink-600">{m.body}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <Container>
          <h2 className="text-2xl font-bold sm:text-3xl">Three cooling techniques compared</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {COOLING_TECHNIQUES.map((t) => (
              <article key={t.id} className="rounded-2xl border border-ink-200 bg-ink-50 p-6">
                <h3 className="text-xl font-semibold">{t.name}</h3>
                <p className="mt-2 text-ink-600">{t.shortDescription}</p>
              </article>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl bg-ink-900 p-8 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-2xl font-semibold text-white">See which one fits your workload.</p>
              <p className="mt-1 text-ink-200">It takes less than a minute.</p>
            </div>
            <LinkButton to="/predict">Open the predictor</LinkButton>
          </div>
        </Container>
      </section>
    </>
  )
}
