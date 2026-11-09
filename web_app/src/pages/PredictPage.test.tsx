import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './../App'
import { STORAGE_KEY } from '../state/storage'
import { buildMockBody } from '../test/mockBackend'

// What the service returns for the form's default inputs (500 GPUs, 60 % SM, 30 % memory, 24 h x 365 days).
const API_RESPONSE = buildMockBody({ gpuCount: 500, smUtilPercent: 60, memUtilPercent: 30, hoursPerDay: 24, daysPerYear: 365 })

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
    expect(url).toMatch(/\/api\/v1\/analysis$/)
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
    expect(stored.heatEnergyKWh.value).toBeCloseTo(1.5 * 1000 * 24 * 365)
    expect(stored.estimates.map((e: { techniqueId: string }) => e.techniqueId)).toEqual(['air', 'direct-to-chip'])
    expect(stored.cooling.site.name).toBe('Ashburn, Virginia, USA')
    expect(screen.getByRole('heading', { name: /cooling comparison/i })).toBeInTheDocument()
  })

  it('shows a message and stays on the page when the service answers with something unexpected', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ heat_load_mw: {} }), { status: 200 })))
    const user = userEvent.setup()
    renderPredict()

    await user.click(screen.getByRole('button', { name: /run prediction/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/unexpected response/i)
    expect(screen.getByRole('heading', { level: 1, name: /run a prediction/i })).toBeInTheDocument()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
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
