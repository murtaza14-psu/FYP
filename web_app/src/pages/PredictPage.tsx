import { useState } from 'react'
import { useNavigate } from 'react-router'
import PredictionForm from '../components/predict/PredictionForm'
import Container from '../components/ui/Container'
import PageHeader from '../components/ui/PageHeader'
import { usePageTitle } from '../lib/usePageTitle'
import { runAnalysis } from '../services/analysis'
import { createHttpHeatPredictor, HeatPredictionError } from '../services/heatPrediction'
import { useAnalysis } from '../state/analysisContext'
import type { PredictionInput } from '../types/analysis'

// Calls the local ML service (python ml_module/api.py).
const predictor = createHttpHeatPredictor()

export default function PredictPage() {
  usePageTitle('Predict')
  const navigate = useNavigate()
  const { setResult } = useAnalysis()
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  async function handleSubmit(values: PredictionInput) {
    setPending(true)
    setFailure(null)
    try {
      setResult(await runAnalysis(values, { predictor }))
      navigate('/results')
    } catch (error) {
      setPending(false)
      setFailure(
        error instanceof HeatPredictionError
          ? error.message
          : 'Something went wrong while running the analysis. Please try again.',
      )
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Step 1 of 2"
        title="Run a prediction"
        intro="Describe your data centre's GPU fleet. We will predict the heat it gives off in a year and compare cooling options."
      />
      <Container className="grid gap-8 py-12 lg:grid-cols-[1fr_20rem]">
        <section className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8">
          {failure && (
            <p role="alert" className="mb-6 rounded-lg bg-red-50 p-3 font-medium text-red-800">
              {failure}
            </p>
          )}
          <PredictionForm onSubmit={handleSubmit} pending={pending} />
        </section>

        <aside className="space-y-4 text-sm text-ink-600">
          <div className="rounded-2xl border border-ink-200 bg-white p-5">
            <h2 className="font-display text-base font-semibold">What happens next</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>Five trained models estimate each GPU's power, and from it your annual heat.</li>
              <li>Water and electricity use is estimated for three cooling techniques.</li>
              <li>The options are ranked so you can pick the best fit.</li>
            </ol>
          </div>
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
            <h2 className="font-display text-base font-semibold text-amber-900">Before you start</h2>
            <p className="mt-2">
              Heat comes from the local prediction service: run <code>python ml_module/api.py</code> first. It counts
              GPU heat only (V100-trained). The cooling figures are still placeholders.
            </p>
          </div>
        </aside>
      </Container>
    </>
  )
}
