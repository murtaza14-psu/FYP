import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeAll, describe, expect, it } from 'vitest'
import { formatEnergy, formatPower } from '../../lib/format'
import { makeResult } from '../../test/fixtures'
import type { AnalysisResult } from '../../types/analysis'
import HeatSummary from './HeatSummary'

let result: AnalysisResult

beforeAll(async () => {
  result = await makeResult()
})

const renderSummary = () =>
  render(
    <MemoryRouter>
      <HeatSummary result={result} />
    </MemoryRouter>,
  )

describe('HeatSummary', () => {
  it('shows the predicted heat load and its range', () => {
    renderSummary()
    expect(screen.getByText(formatPower(result.prediction.valueMW))).toBeInTheDocument()
    expect(
      screen.getByText(`${formatPower(result.prediction.lowMW)} – ${formatPower(result.prediction.highMW)}`),
    ).toBeInTheDocument()
  })

  it('flags the value as a mock', () => {
    renderSummary()
    expect(screen.getByText(/mock value/i)).toBeInTheDocument()
  })

  it('does not show the mock badge for a real prediction', async () => {
    result = { ...result, prediction: { ...result.prediction, isMock: false } }
    renderSummary()
    expect(screen.queryByText(/mock value/i)).not.toBeInTheDocument()
    result = await makeResult()
  })

  it('shows the total heat energy over the job', () => {
    renderSummary()
    expect(screen.getByText(formatEnergy(result.heatEnergyKWh.value))).toBeInTheDocument()
  })

  it('recaps the inputs and the region', () => {
    renderSummary()
    expect(screen.getByText('Training')).toBeInTheDocument()
    expect(screen.getByText('64 GPUs')).toBeInTheDocument()
    expect(screen.getByText('24 hours')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('Ashburn, Virginia, USA')).toBeInTheDocument()
  })

  it('links back to the predict page to edit inputs', () => {
    renderSummary()
    expect(screen.getByRole('link', { name: /edit inputs/i })).toHaveAttribute('href', '/predict')
  })
})
