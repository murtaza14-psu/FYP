export type TaskType = 'training' | 'fine-tuning' | 'inference'

export interface PredictionInput {
  taskType: TaskType
  gpuCount: number
  durationHours: number
  /** Expected average GPU utilisation, 1–100. */
  utilizationPercent: number
}

/** Raw form values before validation. Everything is a string, as typed by the user. */
export interface RawPredictionInput {
  taskType: string
  gpuCount: string
  durationHours: string
  utilizationPercent: string
}

export interface HeatPrediction {
  /** Predicted heat load in megawatts. */
  valueMW: number
  lowMW: number
  highMW: number
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
