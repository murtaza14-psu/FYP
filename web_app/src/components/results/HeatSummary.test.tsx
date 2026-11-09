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
  it('shows the annual heat and its range', () => {
    renderSummary()
    expect(screen.getByText(formatEnergy(result.heatEnergyKWh.value))).toBeInTheDocument()
    expect(
      screen.getByText(`${formatEnergy(result.heatEnergyKWh.low)} – ${formatEnergy(result.heatEnergyKWh.high)}`),
    ).toBeInTheDocument()
  })

  it('shows the heat load while running, and per-GPU power only when known', () => {
    result = { ...result, prediction: { ...result.prediction, perGpuW: undefined } }
    renderSummary()
    expect(screen.getByText(formatPower(result.prediction.valueMW))).toBeInTheDocument()
    expect(screen.queryByText(/W per GPU/)).not.toBeInTheDocument()
  })

  it('shows per-GPU power for a real prediction', () => {
    result = { ...result, prediction: { ...result.prediction, perGpuW: 122.6, isMock: false } }
    renderSummary()
    expect(screen.getByText('123 W per GPU')).toBeInTheDocument()
  })

  it('lists warnings from the prediction service', () => {
    result = { ...result, prediction: { ...result.prediction, warnings: ['GPU heat only.'] } }
    renderSummary()
    expect(screen.getByText('GPU heat only.')).toBeInTheDocument()
  })

  it('flags the value as a mock', async () => {
    result = await makeResult()
    renderSummary()
    expect(screen.getByText(/mock value/i)).toBeInTheDocument()
  })

  it('does not show the mock badge for a real prediction', () => {
    result = { ...result, prediction: { ...result.prediction, isMock: false } }
    renderSummary()
    expect(screen.queryByText(/mock value/i)).not.toBeInTheDocument()
  })

  it('recaps the inputs and the region', async () => {
    result = await makeResult()
    renderSummary()
    expect(screen.getByText('64 GPUs')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getByText('24 h/day × 365 days')).toBeInTheDocument()
    expect(screen.getByText('Ashburn, Virginia, USA')).toBeInTheDocument()
  })

  it('links back to the predict page to edit inputs', () => {
    renderSummary()
    expect(screen.getByRole('link', { name: /edit inputs/i })).toHaveAttribute('href', '/predict')
  })
})
