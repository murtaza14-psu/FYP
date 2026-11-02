import Container from '../components/ui/Container'
import LinkButton from '../components/ui/LinkButton'
import PageHeader from '../components/ui/PageHeader'
import { usePageTitle } from '../lib/usePageTitle'

const STEPS = [
  {
    title: 'Describe your workload',
    body: 'Tell us how many GPUs you run, how busy their compute and memory are, and how many hours a day and days a year they are in use.',
  },
  {
    title: 'Predict the heat',
    body: 'Five machine-learning models estimate the power of each GPU, and from it the heat your fleet gives off in a year, as a value and a range.',
  },
  {
    title: 'Estimate cooling resources',
    body: 'Equations calculate the water and electricity that air, direct-to-chip and immersion cooling would use to remove that heat in Ashburn, Virginia.',
  },
  {
    title: 'Compare and rank',
    body: 'Pick what matters most, such as saving water, and see the techniques ranked with a recommendation.',
  },
]

const INPUTS = [
  {
    term: 'Number of GPUs',
    detail: 'How many GPUs are in the fleet, from 1 to 100,000.',
  },
  {
    term: 'SM utilisation',
    detail: 'The average share of GPU compute in use, from 0% to 100%. Busy GPUs draw more power and produce more heat.',
  },
  {
    term: 'Memory utilisation',
    detail: 'The average share of GPU memory bandwidth in use, from 0% to 100%.',
  },
  {
    term: 'Operating time',
    detail: 'Hours per day and days per year the GPUs are in use. More running time means more total heat to remove.',
  },
  {
    term: 'Region',
    detail: 'Fixed to Ashburn, Virginia, USA in this prototype. Local climate and grid affect cooling water and electricity.',
  },
]

export default function HowItWorksPage() {
  usePageTitle('How It Works')

  return (
    <>
      <PageHeader
        eyebrow="Walkthrough"
        title="How It Works"
        intro="A quick guide to going from a GPU workload to a ranked cooling recommendation."
      />

      <Container className="space-y-14 py-14">
        <section aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="text-2xl font-bold">
            Four steps
          </h2>
          <ol aria-label="Steps" className="mt-6 grid gap-6 md:grid-cols-2">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4 rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-coolant-600 font-display font-bold text-white"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1 text-ink-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="inputs-heading">
          <h2 id="inputs-heading" className="text-2xl font-bold">
            Understanding the inputs
          </h2>
          <dl className="mt-6 divide-y divide-ink-200 rounded-2xl border border-ink-200 bg-white">
            {INPUTS.map((input) => (
              <div key={input.term} className="grid gap-1 p-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
                <dt className="font-semibold text-ink-900">{input.term}</dt>
                <dd className="text-ink-600">{input.detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="flex flex-wrap items-center gap-4">
          <LinkButton to="/predict">Try it now</LinkButton>
          <p className="text-ink-600">Prototype values are placeholders. See the FAQ for details.</p>
        </div>
      </Container>
    </>
  )
}
