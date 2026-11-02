import { describe, expect, it, vi } from 'vitest'
import type { PredictionInput } from '../types/analysis'
import { createHttpHeatPredictor, HeatPredictionError, mockHeatPredictor } from './heatPrediction'

const input: PredictionInput = {
  gpuCount: 512,
  smUtilPercent: 85,
  memUtilPercent: 40,
  hoursPerDay: 24,
  daysPerYear: 3,
}

describe('mockHeatPredictor', () => {
  it('returns a promise', () => {
    expect(mockHeatPredictor.predict(input)).toBeInstanceOf(Promise)
  })

  it('returns the hard-coded 1.5 MW value with a 1.35–1.65 MW range', async () => {
    const result = await mockHeatPredictor.predict(input)
    expect(result.valueMW).toBe(1.5)
    expect(result.lowMW).toBeCloseTo(1.35)
    expect(result.highMW).toBeCloseTo(1.65)
  })

  it('keeps low ≤ value ≤ high', async () => {
    const { lowMW, valueMW, highMW } = await mockHeatPredictor.predict(input)
    expect(lowMW).toBeLessThanOrEqual(valueMW)
    expect(valueMW).toBeLessThanOrEqual(highMW)
  })

  it('is flagged as a mock', async () => {
    expect((await mockHeatPredictor.predict(input)).isMock).toBe(true)
  })

  it('ignores the input while mocked (same answer for any fleet)', async () => {
    const other = await mockHeatPredictor.predict({ ...input, gpuCount: 1 })
    expect(other.valueMW).toBe(1.5)
  })
})

describe('createHttpHeatPredictor', () => {
  const ok = { heat_load_mw: { low: 0.04, expected: 0.06, high: 0.08 }, per_gpu: { expected_w: 120 }, warnings: ['w', 3] }
  const respond = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status })

  it('posts the mapped inputs and maps the response', async () => {
    const fetchImpl = vi.fn(respond(200, ok))
    const result = await createHttpHeatPredictor({ baseUrl: 'http://svc', fetchImpl }).predict(input)

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://svc/api/v1/annual-heat')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      n_gpus: 512,
      sm_util_pct: 85,
      mem_util_pct: 40,
      hours_per_day: 24,
      days_per_year: 3,
    })
    expect(result).toEqual({ valueMW: 0.06, lowMW: 0.04, highMW: 0.08, perGpuW: 120, warnings: ['w'], isMock: false })
  })

  it('explains when the service cannot be reached', async () => {
    const fetchImpl = async () => Promise.reject(new TypeError('Failed to fetch'))
    await expect(createHttpHeatPredictor({ fetchImpl }).predict(input)).rejects.toThrow(/could not reach/i)
  })

  it('reports validation and server errors without leaking details', async () => {
    await expect(createHttpHeatPredictor({ fetchImpl: respond(422, { detail: 'secret' }) }).predict(input)).rejects.toThrow(
      /rejected these values/i,
    )
    const err = await createHttpHeatPredictor({ fetchImpl: respond(500, { detail: 'secret' }) })
      .predict(input)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(HeatPredictionError)
    expect((err as Error).message).toMatch(/error 500/)
    expect((err as Error).message).not.toMatch(/secret/)
  })

  it.each([{}, { heat_load_mw: { low: 1, expected: 'x', high: 2 } }, { heat_load_mw: null }, null])(
    'rejects an unexpected response shape %#',
    async (body) => {
      await expect(createHttpHeatPredictor({ fetchImpl: respond(200, body) }).predict(input)).rejects.toThrow(
        /unexpected response/i,
      )
    },
  )

  it('rejects a body that is not JSON', async () => {
    const fetchImpl = async () => new Response('<html>', { status: 200 })
    await expect(createHttpHeatPredictor({ fetchImpl }).predict(input)).rejects.toThrow(/unexpected response/i)
  })
})
