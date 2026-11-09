import AssumptionsPanel from '../components/results/AssumptionsPanel'
import CoolingComparison from '../components/results/CoolingComparison'
import ClimatePanel from '../components/results/ClimatePanel'
import HeatSummary from '../components/results/HeatSummary'
import MonthlyBreakdown from '../components/results/MonthlyBreakdown'
import RankingPanel from '../components/results/RankingPanel'
import Container from '../components/ui/Container'
import LinkButton from '../components/ui/LinkButton'
import PageHeader from '../components/ui/PageHeader'
import { usePageTitle } from '../lib/usePageTitle'
import { useAnalysis } from '../state/analysisContext'

export default function ResultsPage() {
  usePageTitle('Results')
  const { result } = useAnalysis()

  return (
    <>
      <PageHeader
        eyebrow="Step 2 of 2"
        title="Results"
        intro="Predicted heat, the water and electricity each cooling technique needs, and a ranked recommendation."
      />
      <Container className="py-12">
        {result ? (
          <div className="space-y-8">
            <HeatSummary result={result} />
            <CoolingComparison estimates={result.estimates} />
            <MonthlyBreakdown estimates={result.estimates} />
            <ClimatePanel site={result.cooling.site} />
            <RankingPanel estimates={result.estimates} initialCriterion={result.criterion} />
            <AssumptionsPanel cooling={result.cooling} />
          </div>
        ) : (
          <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-ink-300 bg-white p-10 text-center">
            <p className="font-display text-2xl font-semibold text-ink-900">No results yet</p>
            <p className="mt-2 text-ink-600">Describe your GPU fleet to see its annual heat and cooling comparison.</p>
            <div className="mt-6">
              <LinkButton to="/predict" variant="outline">
                Run a prediction
              </LinkButton>
            </div>
          </div>
        )}
      </Container>
    </>
  )
}
