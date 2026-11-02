import Container from '../components/ui/Container'
import PageHeader from '../components/ui/PageHeader'
import { SITE, TEAM } from '../config/site'
import { usePageTitle } from '../lib/usePageTitle'

export default function AboutPage() {
  usePageTitle('About Us')

  return (
    <>
      <PageHeader
        eyebrow="About the project"
        title="About Us"
        intro="A final year project exploring how to cool AI hardware with less water and electricity."
      />

      <Container className="space-y-14 py-14">
        <section className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Project overview</h2>
            <p className="mt-3 text-ink-600">
              {SITE.name} helps data-centre planners and researchers compare cooling techniques for GPU workloads.
              The system has three modules: a machine-learning model that predicts the heat a workload will produce, a
              physics-based model that estimates the water and electricity each cooling technique needs, and a ranking
              module that recommends the best option for the criteria you care about.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold">The problem</h2>
            <p className="mt-3 text-ink-600">
              AI workloads are driving rapid growth in GPU data centres, and nearly all the electricity they use ends up
              as heat that must be removed. Cooling can consume large amounts of both electricity and water, and the
              right technique depends on the workload and the local climate. There is no simple tool for comparing the
              options before building, which is the gap this project addresses.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold">Meet the team</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((member) => (
              <article key={member.name} className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-coolant-100 font-display text-lg font-bold text-coolant-800"
                  aria-hidden="true"
                >
                  {member.name.charAt(0)}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{member.name}</h3>
                <p className="mt-1 text-ink-600">{member.role}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-ink-900 p-8 text-white">
          <h2 className="text-2xl font-bold text-white">Supervision</h2>
          <p className="mt-4 text-sm uppercase tracking-widest text-coolant-300">Supervisor</p>
          <p className="text-xl font-semibold">{SITE.supervisor}</p>
          <p className="mt-4 text-ink-200">
            {SITE.department}, {SITE.institution}
          </p>
        </section>
      </Container>
    </>
  )
}
