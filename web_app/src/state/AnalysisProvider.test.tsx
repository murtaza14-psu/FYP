import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { runAnalysis } from '../services/analysis'
import { mockBackend } from '../test/mockBackend'
import { useAnalysis } from './analysisContext'
import AnalysisProvider from './AnalysisProvider'
import { STORAGE_KEY } from './storage'

const INPUT = { gpuCount: 8, smUtilPercent: 70, memUtilPercent: 30, hoursPerDay: 2, daysPerYear: 1 } as const

function Probe() {
  const { result, setResult, clear } = useAnalysis()
  return (
    <div>
      <p data-testid="gpus">{result ? result.input.gpuCount : 'none'}</p>
      <button onClick={async () => setResult(await runAnalysis(INPUT, { backend: mockBackend }))}>store</button>
      <button onClick={clear}>clear</button>
    </div>
  )
}

const renderProbe = () =>
  render(
    <AnalysisProvider>
      <Probe />
    </AnalysisProvider>,
  )

describe('AnalysisProvider', () => {
  it('starts empty', () => {
    renderProbe()
    expect(screen.getByTestId('gpus')).toHaveTextContent('none')
  })

  it('stores a result and persists it to sessionStorage', async () => {
    const user = userEvent.setup()
    renderProbe()
    await user.click(screen.getByText('store'))
    expect(await screen.findByText('8')).toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY)!).input.gpuCount).toBe(8)
  })

  it('restores a stored result on mount', async () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(await runAnalysis(INPUT, { backend: mockBackend })))
    renderProbe()
    expect(screen.getByTestId('gpus')).toHaveTextContent('8')
  })

  it('clear() removes the result from state and storage', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(await runAnalysis(INPUT, { backend: mockBackend })))
    renderProbe()
    await user.click(screen.getByText('clear'))
    expect(screen.getByTestId('gpus')).toHaveTextContent('none')
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('ignores corrupt JSON in storage', () => {
    sessionStorage.setItem(STORAGE_KEY, '{not json')
    renderProbe()
    expect(screen.getByTestId('gpus')).toHaveTextContent('none')
  })

  it('ignores stored data with the wrong shape', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ hello: 'world' }))
    renderProbe()
    expect(screen.getByTestId('gpus')).toHaveTextContent('none')
  })

  it('ignores results saved by an older version of the app (old key, placeholder cooling model)', async () => {
    const oldFormat = { ...(await runAnalysis(INPUT, { backend: mockBackend })), cooling: undefined }
    sessionStorage.setItem('gpu-cooling-advisor:analysis', JSON.stringify(oldFormat))
    renderProbe()
    expect(screen.getByTestId('gpus')).toHaveTextContent('none')
  })

  it('ignores a stored result whose cooling data is missing or incomplete', async () => {
    const full = await runAnalysis(INPUT, { backend: mockBackend })
    for (const broken of [
      { ...full, cooling: undefined },
      { ...full, estimates: [] },
      { ...full, estimates: [{ ...full.estimates[0], monthly: [] }] },
      { ...full, estimates: [{ ...full.estimates[0], techniqueId: 'immersion' }] },
    ]) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(broken))
      const { unmount } = renderProbe()
      expect(screen.getByTestId('gpus')).toHaveTextContent('none')
      unmount()
    }
  })
})
