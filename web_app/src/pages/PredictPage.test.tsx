import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './../App'
import { STORAGE_KEY } from '../state/storage'

const API_RESPONSE = {
  heat_load_mw: { low: 0.04, expected: 0.06, high: 0.08 },
  per_gpu: { expected_w: 122.8 },
  warnings: ['GPU heat only.'],
}

function renderPredict() {
  render(
    <MemoryRouter initialEntries={['/predict']}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('PredictPage', () => {
  it('sends the inputs to the service, stores the analysis and navigates to results', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(API_RESPONSE), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderPredict()

    await user.click(screen.getByRole('button', { name: /run prediction/i }))

    expect(await screen.findByRole('heading', { level: 1, name: /^results$/i }, { timeout: 3000 })).toBeInTheDocument()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/annual-heat$/)
    expect(JSON.parse(init.body as string)).toEqual({
      n_gpus: 500,
      sm_util_pct: 60,
      mem_util_pct: 30,
      hours_per_day: 24,
      days_per_year: 365,
    })
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY)!)
    expect(stored.input).toEqual({ gpuCount: 500, smUtilPercent: 60, memUtilPercent: 30, hoursPerDay: 24, daysPerYear: 365 })
    expect(stored.prediction.isMock).toBe(false)
    expect(stored.heatEnergyKWh.value).toBeCloseTo(0.06 * 1000 * 24 * 365)
  })

  it('shows a helpful message and stays on the page when the service is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    const user = userEvent.setup()
    renderPredict()

    await user.click(screen.getByRole('button', { name: /run prediction/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the prediction service/i)
    expect(screen.getByRole('heading', { level: 1, name: /run a prediction/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /run prediction/i })).toBeEnabled()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('stays on the page when the input is invalid, without calling the service', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderPredict()
    await user.clear(screen.getByLabelText('Number of GPUs'))
    await user.click(screen.getByRole('button', { name: /run prediction/i }))
    expect(screen.getByRole('heading', { level: 1, name: /run a prediction/i })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
