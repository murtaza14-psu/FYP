/** What the operator knows about the data centre's GPU fleet. */
export interface PredictionInput {
  gpuCount: number
  /** Average SM (compute) utilisation across the GPUs, 0–100. */
  smUtilPercent: number
  /** Average memory utilisation across the GPUs, 0–100. */
  memUtilPercent: number
  /** Hours per day the GPUs are in use, greater than 0 and at most 24. */
  hoursPerDay: number
  /** Days per year they are in use, 1–366. */
  daysPerYear: number
}

/** Raw form values before validation. Everything is a string, as typed by the user. */
export interface RawPredictionInput {
  gpuCount: string
  smUtilPercent: string
  memUtilPercent: string
  hoursPerDay: string
  daysPerYear: string
}

export interface HeatPrediction {
  /** Average heat load while the GPUs are running, in megawatts. */
  valueMW: number
  lowMW: number
  highMW: number
  /** Expected average power of one GPU in watts (absent for mock predictions). */
  perGpuW?: number
  /** Caveats from the prediction service, shown to the user. */
  warnings?: string[]
  /** True while the value is hard-coded rather than produced by the ML model. */
  isMock: boolean
}

/** The two techniques modelled in Module 2. Immersion cooling is not modelled yet. */
export type CoolingTechniqueId = 'air' | 'direct-to-chip'

export interface CoolingTechnique {
  id: CoolingTechniqueId
  name: string
  shortDescription: string
}

export interface Region {
  id: string
  name: string
  country: string
  climateNote: string
}

/** A result with its low–high range: `value` is the typical (headline) case. */
export interface Range {
  low: number
  value: number
  high: number
}

/** Water used by the cooling towers, litres (1 kg of water = 1 litre). */
export interface WaterBreakdown {
  evaporation: number
  drift: number
  blowdown: number
}

/** One line of a breakdown, in the order the service reports it. */
export interface UseItem {
  label: string
  value: number
}

export interface MonthlyUse {
  /** 1–12 */
  month: number
  electricityKWh: number
  waterLitres: number
}

/** Direct-to-chip only: share of the liquid heat removed by each stage (sums to 1). */
export interface HeatSplit {
  dryCooler: number
  tower: number
  chiller: number
}

export interface CoolingEstimate {
  techniqueId: CoolingTechniqueId
  /** Electricity used by the cooling system over a year, kWh. */
  electricityKWh: Range
  /** Water consumed by the cooling system over a year (evaporation + drift + blowdown), litres. */
  waterLitres: Range
  /** Typical case only. */
  waterBreakdown: WaterBreakdown
  /** Typical case only, kWh. */
  electricityItems: UseItem[]
  /** Typical case only, 12 months. */
  monthly: MonthlyUse[]
  /** Cooling electricity per kWh of GPU heat (typical case). */
  kWhPerKWhHeat: number
  /** Cooling water per kWh of GPU heat (typical case). */
  litresPerKWhHeat: number
  /** Hours of the year the chiller runs at all. */
  chillerHours: number
  heatSplit?: HeatSplit
  /** Direct-to-chip: hours of the year the liquid side needs no cooling-tower water. */
  hoursWithoutLiquidWater?: number
  notes: string[]
}

/** What the ranking needs from an estimate. */
export type RankableEstimate = Pick<CoolingEstimate, 'techniqueId' | 'electricityKWh' | 'waterLitres'>

export interface ClimateMonth {
  month: number
  meanDryBulbC: number
  meanWetBulbC: number
  meanRelHumidityPct: number
  minDryBulbC: number
  maxDryBulbC: number
}

export interface CoolingSite {
  name: string
  weatherStation: string
  weatherSource: string
  periodOfRecord: string
  sourceUrl: string
  monthlyClimate: ClimateMonth[]
}

/** One parameter in its three scenarios (the equation document's three values: high use / typical / low use). */
export interface ParameterRow {
  label: string
  unit: string
  highUse: number
  typical: number
  lowUse: number
}

export interface CoolingContext {
  site: CoolingSite
  assumptions: {
    heatBasis: string
    loadProfile: string
    cyclesOfConcentration: number
    driftPercent: number
    upsEfficiency: number
    range: string
  }
  parameters: { air: ParameterRow[]; directToChip: ParameterRow[] }
}

export type RankingCriterion = 'water' | 'electricity' | 'balanced'

export interface RankedTechnique {
  rank: number
  techniqueId: CoolingTechniqueId
  /** Score in [0, 1] where lower is better (resource use, normalised). */
  score: number
}

export interface AnalysisResult {
  input: PredictionInput
  region: Region
  prediction: HeatPrediction
  /** Heat energy over a year, kWh. */
  heatEnergyKWh: Range
  estimates: CoolingEstimate[]
  cooling: CoolingContext
  ranking: RankedTechnique[]
  criterion: RankingCriterion
  createdAt: string
}

export type ValidationErrors = Partial<Record<keyof PredictionInput, string>>

export interface ValidationResult {
  values?: PredictionInput
  errors: ValidationErrors
}
