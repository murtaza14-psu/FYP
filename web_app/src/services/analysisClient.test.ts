import { describe, expect, it, vi } from 'vitest'
import { buildMockBody } from '../test/mockBackend'
import type { PredictionInput } from '../types/analysis'
import { AnalysisServiceError, createHttpAnalysisClient, parseAnalysisResponse } from './analysisClient'

const input: PredictionInput = { gpuCount: 512, smUtilPercent: 85, memUtilPercent: 40, hoursPerDay: 24, daysPerYear: 3 }

describe('parseAnalysisResponse', () => {
  const body = buildMockBody(input)
  const parsed = parseAnalysisResponse(body)

  it('maps the heat prediction', () => {
    expect(parsed.prediction).toEqual({
      valueMW: 1.5,
      lowMW: 1.35,
      highMW: 1.65,
      perGpuW: 123,
      warnings: [expect.stringContaining('GPUs only')],
      isMock: false,
    })
  })

  it('takes the annual heat energy in kWh from the service (the same heat the cooling was calculated for)', () => {
    expect(parsed.heatEnergyKWh.value).toBeCloseTo(1.5 * 24 * 3 * 1000)
    expect(parsed.heatEnergyKWh.low).toBeCloseTo(1.35 * 24 * 3 * 1000)
    expect(parsed.heatEnergyKWh.high).toBeCloseTo(1.65 * 24 * 3 * 1000)
  })

  it('returns the two modelled techniques and no immersion', () => {
    expect(parsed.estimates.map((e) => e.techniqueId)).toEqual(['air', 'direct-to-chip'])
  })

  it('maps low / typical / high onto a range', () => {
    const air = parsed.estimates[0]
    const raw = body.cooling.techniques[0]
    expect(air.electricityKWh).toEqual({ low: raw.electricity_kwh.low, value: raw.electricity_kwh.typical, high: raw.electricity_kwh.high })
    expect(air.waterLitres.value).toBe(raw.water_litres.typical)
    expect(air.electricityKWh.low).toBeLessThan(air.electricityKWh.value)
    expect(air.electricityKWh.value).toBeLessThan(air.electricityKWh.high)
  })

  it('maps the water breakdown, the electricity items (labelled, in order) and the months', () => {
    const air = parsed.estimates[0]
    expect(Object.keys(air.waterBreakdown)).toEqual(['evaporation', 'drift', 'blowdown'])
    expect(air.waterBreakdown.evaporation + air.waterBreakdown.drift + air.waterBreakdown.blowdown).toBeCloseTo(air.waterLitres.value)
    expect(air.electricityItems.map((i) => i.label)).toEqual(['Air-handler fans', 'Chiller', 'Pumps', 'Cooling-tower fans'])
    expect(air.electricityItems.reduce((s, i) => s + i.value, 0)).toBeCloseTo(air.electricityKWh.value)
    expect(air.monthly).toHaveLength(12)
    expect(air.monthly[6]).toEqual({ month: 7, electricityKWh: expect.any(Number), waterLitres: expect.any(Number) })
    expect(air.kWhPerKWhHeat).toBe(0.262)
    expect(air.chillerHours).toBe(5383)
    expect(air.heatSplit).toBeUndefined()
  })

  it('keeps the direct-to-chip extras', () => {
    const d2c = parsed.estimates[1]
    expect(d2c.heatSplit).toEqual({ dryCooler: 0.918, tower: 0.082, chiller: 0 })
    expect(d2c.hoursWithoutLiquidWater).toBe(6404)
    expect(d2c.electricityItems).toHaveLength(6)
    expect(d2c.electricityItems[5].label).toBe('Small air-cooling system')
  })

  it('maps the site, assumptions and parameters', () => {
    const { site, assumptions, parameters } = parsed.cooling
    expect(site.name).toBe('Ashburn, Virginia, USA')
    expect(site.monthlyClimate).toHaveLength(12)
    expect(site.monthlyClimate[6]).toEqual({
      month: 7,
      meanDryBulbC: 26.26,
      meanWetBulbC: 20.97,
      meanRelHumidityPct: 65.4,
      minDryBulbC: 16.1,
      maxDryBulbC: 37.2,
    })
    expect(assumptions.cyclesOfConcentration).toBe(4)
    expect(assumptions.heatBasis).toBe('GPU heat only')
    const fan = parameters.air.find((r) => r.label.includes('Fan power'))!
    expect([fan.highUse, fan.typical, fan.lowUse]).toEqual([1.25, 0.75, 0.5])
    const cap = parameters.directToChip.find((r) => r.label.includes('cold plates'))!
    expect([cap.highUse, cap.typical, cap.lowUse]).toEqual([0.7, 0.8, 0.94])
  })

  const broken: [string, (b: ReturnType<typeof buildMockBody>) => unknown][] = [
    ['not an object', () => null],
    ['no heat', (b) => ({ cooling: b.cooling })],
    ['no cooling', (b) => ({ heat: b.heat })],
    ['text in the heat load', (b) => ({ ...b, heat: { ...b.heat, heat_load_mw: { low: 1, expected: 'x', high: 2 } } })],
    ['no annual heat', (b) => ({ ...b, heat: { ...b.heat, annual_heat_mwh: null } })],
    ['one technique', (b) => ({ ...b, cooling: { ...b.cooling, techniques: [b.cooling.techniques[0]] } })],
    ['an unknown technique', (b) => ({ ...b, cooling: { ...b.cooling, techniques: [b.cooling.techniques[0], { ...b.cooling.techniques[1], id: 'immersion' }] } })],
    ['a repeated technique', (b) => ({ ...b, cooling: { ...b.cooling, techniques: [b.cooling.techniques[0], b.cooling.techniques[0]] } })],
    ['a non-finite number', (b) => ({ ...b, cooling: { ...b.cooling, techniques: [{ ...b.cooling.techniques[0], kwh_per_kwh_heat: null }, b.cooling.techniques[1]] } })],
    ['eleven months', (b) => ({ ...b, cooling: { ...b.cooling, techniques: [{ ...b.cooling.techniques[0], monthly: b.cooling.techniques[0].monthly.slice(1) }, b.cooling.techniques[1]] } })],
    ['an unknown electricity item', (b) => ({ ...b, cooling: { ...b.cooling, techniques: [{ ...b.cooling.techniques[0], electricity_breakdown_kwh: { mystery: 1 } }, b.cooling.techniques[1]] } })],
    ['a missing range key', (b) => ({ ...b, cooling: { ...b.cooling, techniques: [{ ...b.cooling.techniques[0], water_litres: { low: 1, typical: 2 } }, b.cooling.techniques[1]] } })],
    ['no site', (b) => ({ ...b, cooling: { ...b.cooling, site: null } })],
    ['eleven climate months', (b) => ({ ...b, cooling: { ...b.cooling, site: { ...b.cooling.site, monthly_climate: b.cooling.site.monthly_climate.slice(1) } } })],
    ['no parameters', (b) => ({ ...b, cooling: { ...b.cooling, parameters: {} } })],
  ]

  it.each(broken)('rejects a response with %s', (_name, mutate) => {
    const attempt = () => parseAnalysisResponse(mutate(buildMockBody(input)))
    expect(attempt).toThrow(AnalysisServiceError)
    expect(attempt).toThrow(/unexpected response/i)
  })
})

describe('createHttpAnalysisClient', () => {
  const respond = (status: number, payload: unknown) => async () => new Response(JSON.stringify(payload), { status })

  it('posts the mapped inputs to the analysis endpoint and maps the response', async () => {
    const fetchImpl = vi.fn(respond(200, buildMockBody(input)))
    const result = await createHttpAnalysisClient({ baseUrl: 'http://svc', fetchImpl }).analyse(input)

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://svc/api/v1/analysis')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      n_gpus: 512,
      sm_util_pct: 85,
      mem_util_pct: 40,
      hours_per_day: 24,
      days_per_year: 3,
    })
    expect(result.prediction.isMock).toBe(false)
    expect(result.estimates).toHaveLength(2)
  })

  it('explains when the service cannot be reached', async () => {
    const fetchImpl = async () => Promise.reject(new TypeError('Failed to fetch'))
    await expect(createHttpAnalysisClient({ fetchImpl }).analyse(input)).rejects.toThrow(/could not reach the prediction service/i)
  })

  it('reports validation and server errors without leaking details', async () => {
    await expect(createHttpAnalysisClient({ fetchImpl: respond(422, { detail: 'secret' }) }).analyse(input)).rejects.toThrow(
      /rejected these values/i,
    )
    const err = await createHttpAnalysisClient({ fetchImpl: respond(500, { detail: 'secret' }) })
      .analyse(input)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AnalysisServiceError)
    expect((err as Error).message).toMatch(/error 500/)
    expect((err as Error).message).not.toMatch(/secret/)
  })

  it('rejects a body that is not JSON', async () => {
    const fetchImpl = async () => new Response('<html>', { status: 200 })
    await expect(createHttpAnalysisClient({ fetchImpl }).analyse(input)).rejects.toThrow(/unexpected response/i)
  })

  it('rejects a well-formed body that is not an analysis', async () => {
    await expect(createHttpAnalysisClient({ fetchImpl: respond(200, { heat_load_mw: {} }) }).analyse(input)).rejects.toThrow(
      /unexpected response/i,
    )
  })
})
