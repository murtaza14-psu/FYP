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

export type CoolingTechniqueId = 'air' | 'direct-to-chip' | 'immersion'

export interface CoolingTechnique {
  id: CoolingTechniqueId
  name: string
  shortDescription: string
  /** kWh of electricity used per kWh of heat removed (placeholder). */
  energyFactor: number
  /** Litres of water used per kWh of heat removed (placeholder). */
  waterFactor: number
}

export interface Region {
  id: string
  name: string
  country: string
  climateNote: string
}

export interface Range {
  low: number
  value: number
  high: number
}

export interface CoolingEstimate {
  techniqueId: CoolingTechniqueId
  /** Electricity used by the cooling system, kWh. */
  electricityKWh: Range
  /** Water consumed by the cooling system, litres. */
  waterLitres: Range
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
  /** Total heat energy over the job, kWh. */
  heatEnergyKWh: Range
  estimates: CoolingEstimate[]
  ranking: RankedTechnique[]
  criterion: RankingCriterion
  createdAt: string
}

export type ValidationErrors = Partial<Record<keyof PredictionInput, string>>

export interface ValidationResult {
  values?: PredictionInput
  errors: ValidationErrors
}
