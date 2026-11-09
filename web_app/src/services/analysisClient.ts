import type {
  ClimateMonth,
  CoolingContext,
  CoolingEstimate,
  CoolingTechniqueId,
  HeatPrediction,
  ParameterRow,
  PredictionInput,
  Range,
} from '../types/analysis'

/** Everything the Python service (`ml_module/api.py`) works out for one set of inputs. */
export interface BackendAnalysis {
  prediction: HeatPrediction
  /** Annual heat energy in kWh: exactly the heat the cooling figures were calculated for. */
  heatEnergyKWh: Range
  estimates: CoolingEstimate[]
  cooling: CoolingContext
}

/** Module 1 (heat) and Module 2 (cooling) behind one call, so a test double or another backend can replace it. */
export interface AnalysisBackend {
  analyse(input: PredictionInput): Promise<BackendAnalysis>
}

/** An error whose message is safe to show to the user. */
export class AnalysisServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AnalysisServiceError'
  }
}

export const DEFAULT_API_URL = 'http://127.0.0.1:8000'
const UNEXPECTED = 'The prediction service returned an unexpected response.'

// ---------------------------------------------------------------------------------------------- strict readers
type Obj = Record<string, unknown>

const fail = (): never => {
  throw new AnalysisServiceError(UNEXPECTED)
}
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const obj = (v: unknown): Obj => (isObj(v) ? v : fail())
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : fail())
const str = (v: unknown): string => (typeof v === 'string' ? v : fail())
const list = (v: unknown, length?: number): unknown[] =>
  Array.isArray(v) && (length === undefined || v.length === length) ? v : fail()

/** {low, <mid>, high} -> Range, where the mid key is `expected` for heat and `typical` for cooling. */
function range(v: unknown, mid: 'expected' | 'typical'): Range {
  const o = obj(v)
  const r = { low: num(o.low), value: num(o[mid]), high: num(o.high) }
  return r.low <= r.value && r.value <= r.high ? r : fail()
}

const scale = (r: Range, factor: number): Range => ({ low: r.low * factor, value: r.value * factor, high: r.high * factor })

// ---------------------------------------------------------------------------------------------- heat
function parseHeat(body: unknown): { prediction: HeatPrediction; heatEnergyKWh: Range } {
  const heat = obj(body)
  const load = range(heat.heat_load_mw, 'expected')
  const annualMWh = range(heat.annual_heat_mwh, 'expected')
  const perGpu = isObj(heat.per_gpu) ? heat.per_gpu.expected_w : undefined
  const warnings = Array.isArray(heat.warnings) ? heat.warnings.filter((w): w is string => typeof w === 'string') : []
  return {
    prediction: {
      valueMW: load.value,
      lowMW: load.low,
      highMW: load.high,
      perGpuW: typeof perGpu === 'number' && Number.isFinite(perGpu) ? perGpu : undefined,
      warnings,
      isMock: false,
    },
    heatEnergyKWh: scale(annualMWh, 1000),
  }
}

// ---------------------------------------------------------------------------------------------- cooling
const ELECTRICITY_LABELS: Record<string, string> = {
  air_handler_fans: 'Air-handler fans',
  chiller: 'Chiller',
  pumps: 'Pumps',
  tower_fans: 'Cooling-tower fans',
  coolant_pumps: 'Coolant-unit pumps',
  building_water_pumps: 'Building-water pumps',
  dry_cooler_fans: 'Dry-cooler fans',
  liquid_side_chiller: 'Chiller (liquid side)',
  liquid_side_tower: 'Cooling tower (liquid side)',
  air_system: 'Small air-cooling system',
}

const TECHNIQUE_IDS: readonly CoolingTechniqueId[] = ['air', 'direct-to-chip']

function parseTechnique(v: unknown): CoolingEstimate {
  const t = obj(v)
  const id = TECHNIQUE_IDS.find((candidate) => candidate === t.id) ?? fail()
  const water = obj(t.water_breakdown_litres)
  const electricity = obj(t.electricity_breakdown_kwh)

  const estimate: CoolingEstimate = {
    techniqueId: id,
    electricityKWh: range(t.electricity_kwh, 'typical'),
    waterLitres: range(t.water_litres, 'typical'),
    waterBreakdown: { evaporation: num(water.evaporation), drift: num(water.drift), blowdown: num(water.blowdown) },
    electricityItems: Object.entries(electricity).map(([key, value]) => ({
      label: ELECTRICITY_LABELS[key] ?? fail(),
      value: num(value),
    })),
    monthly: list(t.monthly, 12).map((m) => {
      const month = obj(m)
      return { month: num(month.month), electricityKWh: num(month.electricity_kwh), waterLitres: num(month.water_litres) }
    }),
    kWhPerKWhHeat: num(t.kwh_per_kwh_heat),
    litresPerKWhHeat: num(t.litres_per_kwh_heat),
    chillerHours: num(t.chiller_hours),
    notes: list(t.notes).map(str),
  }
  if (t.heat_split !== undefined) {
    const split = obj(t.heat_split)
    estimate.heatSplit = { dryCooler: num(split.dry_cooler), tower: num(split.tower), chiller: num(split.chiller) }
  }
  if (t.hours_without_liquid_water !== undefined) estimate.hoursWithoutLiquidWater = num(t.hours_without_liquid_water)
  return estimate
}

function parseClimateMonth(v: unknown): ClimateMonth {
  const m = obj(v)
  return {
    month: num(m.month),
    meanDryBulbC: num(m.mean_dry_bulb_c),
    meanWetBulbC: num(m.mean_wet_bulb_c),
    meanRelHumidityPct: num(m.mean_rel_humidity_pct),
    minDryBulbC: num(m.min_dry_bulb_c),
    maxDryBulbC: num(m.max_dry_bulb_c),
  }
}

/** [service key, label, unit] for each row of the Assumptions table. */
const AIR_ROWS: [string, string, string][] = [
  ['sfp_w_per_cfm', 'Fan power (SFP)', 'W/cfm'],
  ['e_fan', 'Fan electricity per kWh of heat (efan)', 'kWh/kWh'],
  ['k_ch_kw_per_ton', 'Chiller electricity (kch)', 'kW/ton'],
  ['k_pump_kw_per_ton', 'Pump electricity (kpump)', 'kW/ton'],
  ['k_tower_kw_per_ton', 'Tower-fan electricity (ktower)', 'kW/ton'],
]
const D2C_ROWS: [string, string, string][] = [
  ['f_cap', 'Heat captured by the cold plates (fcap)', 'share'],
  ['t_fws_c', 'Building-water supply temperature (Tfws)', '°C'],
  ['r_dry', 'Dry-cooler efficiency (R)', 'kWh heat per kWh'],
  ['k_ch_kw_per_ton', 'Chiller electricity (kch)', 'kW/ton'],
]

function parameterRows(v: unknown, rows: [string, string, string][]): ParameterRow[] {
  const scenarios = obj(v)
  const high = obj(scenarios.high_use)
  const typical = obj(scenarios.typical)
  const low = obj(scenarios.low_use)
  return rows.map(([key, label, unit]) => ({ label, unit, highUse: num(high[key]), typical: num(typical[key]), lowUse: num(low[key]) }))
}

function parseCooling(body: unknown): { estimates: CoolingEstimate[]; cooling: CoolingContext } {
  const cooling = obj(body)
  const estimates = list(cooling.techniques, 2).map(parseTechnique)
  if (new Set(estimates.map((e) => e.techniqueId)).size !== estimates.length) fail()

  const site = obj(cooling.site)
  const assumptions = obj(cooling.assumptions)
  const parameters = obj(cooling.parameters)
  return {
    estimates,
    cooling: {
      site: {
        name: str(site.name),
        weatherStation: str(site.weather_station),
        weatherSource: str(site.weather_source),
        periodOfRecord: str(site.period_of_record),
        sourceUrl: str(site.source_url),
        monthlyClimate: list(site.monthly_climate, 12).map(parseClimateMonth),
      },
      assumptions: {
        heatBasis: str(assumptions.heat_basis),
        loadProfile: str(assumptions.load_profile),
        cyclesOfConcentration: num(assumptions.cycles_of_concentration),
        driftPercent: num(assumptions.drift_percent),
        upsEfficiency: num(assumptions.ups_efficiency),
        range: str(assumptions.range),
      },
      parameters: {
        air: parameterRows(parameters.air, AIR_ROWS),
        directToChip: parameterRows(parameters.direct_to_chip, D2C_ROWS),
      },
    },
  }
}

/** Maps the service's JSON onto the app's types, rejecting anything that is not exactly the expected shape. */
export function parseAnalysisResponse(body: unknown): BackendAnalysis {
  const root = obj(body)
  const { prediction, heatEnergyKWh } = parseHeat(root.heat)
  const { estimates, cooling } = parseCooling(root.cooling)
  return { prediction, heatEnergyKWh, estimates, cooling }
}

// ---------------------------------------------------------------------------------------------- HTTP
interface HttpOptions {
  baseUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

/** Calls the local service (`python ml_module/api.py`). */
export function createHttpAnalysisClient({
  baseUrl = import.meta.env.VITE_API_URL ?? DEFAULT_API_URL,
  fetchImpl = (...args) => fetch(...args),
  timeoutMs = 15_000,
}: HttpOptions = {}): AnalysisBackend {
  return {
    async analyse(input) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let response: Response
      try {
        response = await fetchImpl(`${baseUrl}/api/v1/analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            n_gpus: input.gpuCount,
            sm_util_pct: input.smUtilPercent,
            mem_util_pct: input.memUtilPercent,
            hours_per_day: input.hoursPerDay,
            days_per_year: input.daysPerYear,
          }),
          signal: controller.signal,
        })
      } catch {
        throw new AnalysisServiceError(
          'Could not reach the prediction service. Start it with "python ml_module/api.py" and try again.',
        )
      } finally {
        clearTimeout(timer)
      }

      if (!response.ok) {
        throw new AnalysisServiceError(
          response.status === 422
            ? 'The prediction service rejected these values. Check the inputs and try again.'
            : `The prediction service failed (error ${response.status}).`,
        )
      }
      let body: unknown
      try {
        body = await response.json()
      } catch {
        throw new AnalysisServiceError(UNEXPECTED)
      }
      return parseAnalysisResponse(body)
    },
  }
}
