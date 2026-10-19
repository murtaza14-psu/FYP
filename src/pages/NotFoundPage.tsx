import { Link } from 'react-router'
import Container from '../components/ui/Container'
import { usePageTitle } from '../lib/usePageTitle'

export default function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <Container className="py-24 text-center">
      <h1 className="text-4xl font-bold">Page not found</h1>
      <p className="mt-4 text-ink-600">The page you are looking for does not exist.</p>
      <Link
        to="/"
        className="mt-8 inline-block rounded-lg bg-coolant-600 px-5 py-2.5 font-semibold text-white hover:bg-coolant-700"
      >
        Back to home
      </Link>
    </Container>
  )
}
