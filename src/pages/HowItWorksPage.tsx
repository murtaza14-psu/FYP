import Container from '../components/ui/Container'
import LinkButton from '../components/ui/LinkButton'
import PageHeader from '../components/ui/PageHeader'
import { usePageTitle } from '../lib/usePageTitle'

const STEPS = [
  {
    title: 'Describe your workload',
    body: 'Tell us the type of task, how many GPUs you will use, for how long, and how busy they will be.',
  },
  {
    title: 'Predict the heat',
    body: 'A machine-learning model estimates the heat load your GPUs will generate, as a value and a range.',
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
    term: 'Task type',
    detail: 'Training, fine-tuning or inference. Each stresses GPUs differently and so produces a different heat profile.',
  },
  {
    term: 'Number of GPUs',
    detail: 'How many GPUs run the job in parallel, from 1 to 100,000.',
  },
  {
    term: 'Duration',
    detail: 'How long the job runs, in hours (up to one year). Longer jobs mean more total heat to remove.',
  },
  {
    term: 'GPU utilisation',
    detail: 'The average share of GPU capacity you expect to use, from 1% to 100%. Busy GPUs produce more heat.',
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
