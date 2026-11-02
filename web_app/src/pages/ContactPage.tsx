import Container from '../components/ui/Container'
import PageHeader from '../components/ui/PageHeader'
import { SITE, TEAM } from '../config/site'
import { usePageTitle } from '../lib/usePageTitle'

export default function ContactPage() {
  usePageTitle('Contact')

  return (
    <>
      <PageHeader title="Contact" intro="Questions, feedback or collaboration ideas? Reach the team using the details below." />
      <Container className="space-y-12 py-14">
        <section className="grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Project email</h2>
            <p className="mt-3">
              <a className="font-medium text-coolant-700 underline" href={`mailto:${SITE.contactEmail}`}>
                {SITE.contactEmail}
              </a>
            </p>
          </article>
          <article className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Where we are</h2>
            <p className="mt-3 text-ink-600">{SITE.address}</p>
          </article>
        </section>

        <section>
          <h2 className="text-2xl font-bold">The team</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((member) => (
              <li key={member.name} className="rounded-2xl border border-ink-200 bg-white p-5">
                <p className="font-semibold">{member.name}</p>
                <p className="text-sm text-ink-600">{member.role}</p>
                <a className="mt-2 inline-block text-coolant-700 underline" href={`mailto:${member.email}`}>
                  {member.email}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </Container>
    </>
  )
}
