import { parseAnalysisResponse, type AnalysisBackend } from '../services/analysisClient'
import type { PredictionInput } from '../types/analysis'

/**
 * Test double for the prediction service: builds a response in the SAME shape as `POST /api/v1/analysis`
 * (so it goes through the real parser) from fixed per-kWh ratios. The ratios are the typical Ashburn results
 * of a real run (500 GPUs, 60 % SM, 30 % memory), rounded; they are for tests and demos, not for science.
 */
const HEAT_MW = { low: 1.35, expected: 1.5, high: 1.65 }

// [low, typical, high] per kWh of expected heat.
const RATIO = {
  air: { e: [0.164, 0.262, 0.478], w: [1.43, 1.97, 2.81] },
  d2c: { e: [0.03, 0.08, 0.186], w: [0.149, 0.576, 1.264] },
}
const MONTH_WEIGHTS = [0.05, 0.05, 0.07, 0.07, 0.09, 0.11, 0.12, 0.12, 0.1, 0.08, 0.07, 0.07]

const CLIMATE = [
  [2.14, -0.31, 63.6, -6.7, 13.3],
  [2.61, 0.09, 61.8, -13.9, 19.4],
  [9.34, 5.41, 56.5, -7.2, 25.0],
  [13.3, 8.74, 57.0, 2.2, 26.1],
  [19.0, 15.03, 68.7, 4.4, 33.9],
  [23.02, 17.66, 61.3, 8.3, 35.0],
  [26.26, 20.97, 65.4, 16.1, 37.2],
  [24.81, 21.81, 79.3, 12.8, 34.4],
  [20.77, 16.76, 69.2, 8.3, 31.1],
  [15.0, 12.6, 77.0, -0.6, 30.6],
  [9.75, 6.47, 63.1, -7.2, 26.7],
  [4.2, 2.37, 74.1, -7.2, 18.9],
]

const triple = (r: number[], heat: number) => ({ low: r[0] * heat, typical: r[1] * heat, high: r[2] * heat })

function technique(
  id: string,
  name: string,
  ratio: { e: number[]; w: number[] },
  heat: number,
  items: Record<string, number>,
  water: [number, number, number],
  extra: Record<string, unknown>,
) {
  const electricity = triple(ratio.e, heat)
  const litres = triple(ratio.w, heat)
  return {
    id,
    name,
    electricity_kwh: electricity,
    water_litres: litres,
    water_breakdown_litres: {
      evaporation: litres.typical * water[0],
      drift: litres.typical * water[1],
      blowdown: litres.typical * water[2],
    },
    electricity_breakdown_kwh: Object.fromEntries(Object.entries(items).map(([k, share]) => [k, electricity.typical * share])),
    monthly: MONTH_WEIGHTS.map((w, i) => ({
      month: i + 1,
      electricity_kwh: electricity.typical * w,
      water_litres: litres.typical * w,
    })),
    kwh_per_kwh_heat: ratio.e[1],
    litres_per_kwh_heat: ratio.w[1],
    chiller_hours: 5383,
    notes: ['mock note'],
    ...extra,
  }
}

export function buildMockBody(input: PredictionInput) {
  const annualMwh = {
    low: HEAT_MW.low * input.hoursPerDay * input.daysPerYear,
    expected: HEAT_MW.expected * input.hoursPerDay * input.daysPerYear,
    high: HEAT_MW.high * input.hoursPerDay * input.daysPerYear,
  }
  const heat = annualMwh.expected * 1000
  return {
    heat: {
      heat_load_mw: HEAT_MW,
      per_gpu: { expected_w: 123 },
      annual_heat_mwh: annualMwh,
      warnings: ['Heat from the GPUs only: CPUs, network, storage and cooling plant are not included.'],
    },
    cooling: {
      site: {
        name: 'Ashburn, Virginia, USA',
        weather_station: 'Dulles-Washington.Dulles.Intl.AP (WMO 724030)',
        weather_source: 'Climate.OneBuilding.Org, TMYx typical meteorological year',
        period_of_record: '2011-2025',
        source_url: 'https://climate.onebuilding.org',
        monthly_climate: CLIMATE.map(([db, wb, rh, min, max], i) => ({
          month: i + 1,
          hours: 720,
          mean_dry_bulb_c: db,
          mean_wet_bulb_c: wb,
          mean_rel_humidity_pct: rh,
          min_dry_bulb_c: min,
          max_dry_bulb_c: max,
        })),
      },
      heat_annual_kwh: { low: annualMwh.low * 1000, expected: heat, high: annualMwh.high * 1000 },
      techniques: [
        technique(
          'air',
          'Air cooling',
          RATIO.air,
          heat,
          { air_handler_fans: 0.45, chiller: 0.34, pumps: 0.14, tower_fans: 0.07 },
          [0.755, 0.0005, 0.2445],
          {},
        ),
        technique(
          'direct-to-chip',
          'Direct-to-chip cooling',
          RATIO.d2c,
          heat,
          {
            coolant_pumps: 0.07,
            building_water_pumps: 0.05,
            dry_cooler_fans: 0.14,
            liquid_side_chiller: 0,
            liquid_side_tower: 0.03,
            air_system: 0.71,
          },
          [0.74, 0.0005, 0.2595],
          {
            chiller_hours: 0,
            heat_split: { dry_cooler: 0.918, tower: 0.082, chiller: 0 },
            hours_without_liquid_water: 6404,
            water_by_loop_litres: { liquid_side: 0, air_system: 0 },
          },
        ),
      ],
      assumptions: {
        heat_basis: 'GPU heat only',
        load_profile: 'spread evenly over all 8,760 hours of the year',
        cycles_of_concentration: 4.0,
        drift_percent: 0.0005,
        ups_efficiency: 0.95,
        range:
          'low = low heat with low-use parameters; typical = expected heat with typical parameters; high = high heat with high-use parameters',
      },
      parameters: {
        air: {
          high_use: { sfp_w_per_cfm: 1.25, e_fan: 0.1975, k_ch_kw_per_ton: 0.56, k_pump_kw_per_ton: 0.1098, k_tower_kw_per_ton: 0.0586 },
          typical: { sfp_w_per_cfm: 0.75, e_fan: 0.1185, k_ch_kw_per_ton: 0.5, k_pump_kw_per_ton: 0.1098, k_tower_kw_per_ton: 0.0586 },
          low_use: { sfp_w_per_cfm: 0.5, e_fan: 0.079, k_ch_kw_per_ton: 0.5, k_pump_kw_per_ton: 0.1098, k_tower_kw_per_ton: 0.0586 },
        },
        direct_to_chip: {
          high_use: { f_cap: 0.7, t_fws_c: 27, r_dry: 45, k_ch_kw_per_ton: 0.56 },
          typical: { f_cap: 0.8, t_fws_c: 32, r_dry: 70, k_ch_kw_per_ton: 0.5 },
          low_use: { f_cap: 0.94, t_fws_c: 40, r_dry: 110, k_ch_kw_per_ton: 0.5 },
        },
      },
    },
  }
}

/** A backend that answers instantly from `buildMockBody`. The heat is flagged as a mock, like the old hard-coded predictor. */
export function createMockBackend(delayMs = 0): AnalysisBackend {
  return {
    async analyse(input) {
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
      const parsed = parseAnalysisResponse(buildMockBody(input))
      return { ...parsed, prediction: { ...parsed.prediction, isMock: true } }
    },
  }
}

export const mockBackend = createMockBackend()
