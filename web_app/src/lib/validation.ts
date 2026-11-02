import type {
  PredictionInput,
  RawPredictionInput,
  ValidationErrors,
  ValidationResult,
} from '../types/analysis'

export const LIMITS = {
  gpuCount: { min: 1, max: 100_000 },
  utilizationPercent: { min: 0, max: 100 },
  hoursPerDay: { min: 0, max: 24 },
  daysPerYear: { min: 1, max: 366 },
} as const

type NumberCheck = { value?: number; error?: string }

const fmt = (n: number) => n.toLocaleString('en-US')

function parseNumber(raw: string): NumberCheck {
  const text = raw.trim()
  if (text === '') return { error: 'This field is required.' }
  const value = Number(text)
  if (!Number.isFinite(value)) return { error: 'Enter a valid number.' }
  return { value }
}

function wholeNumber(raw: string, min: number, max: number): NumberCheck {
  const parsed = parseNumber(raw)
  if (parsed.error) return parsed
  const value = parsed.value!
  if (!Number.isInteger(value)) return { error: 'Enter a whole number.' }
  if (value < min || value > max) return { error: `Enter a value between ${fmt(min)} and ${fmt(max)}.` }
  return { value }
}

function percentage(raw: string): NumberCheck {
  const parsed = parseNumber(raw)
  if (parsed.error) return parsed
  const { min, max } = LIMITS.utilizationPercent
  if (parsed.value! < min || parsed.value! > max) return { error: `Enter a value between ${min} and ${max}.` }
  return parsed
}

function hoursPerDay(raw: string): NumberCheck {
  const parsed = parseNumber(raw)
  if (parsed.error) return parsed
  if (parsed.value! <= LIMITS.hoursPerDay.min) return { error: 'Hours per day must be greater than 0.' }
  if (parsed.value! > LIMITS.hoursPerDay.max) return { error: `Hours per day can be at most ${LIMITS.hoursPerDay.max}.` }
  return parsed
}

export function validatePredictionInput(raw: RawPredictionInput): ValidationResult {
  const errors: ValidationErrors = {}

  const gpu = wholeNumber(raw.gpuCount, LIMITS.gpuCount.min, LIMITS.gpuCount.max)
  if (gpu.error) errors.gpuCount = gpu.error

  const sm = percentage(raw.smUtilPercent)
  if (sm.error) errors.smUtilPercent = sm.error

  const mem = percentage(raw.memUtilPercent)
  if (mem.error) errors.memUtilPercent = mem.error

  const hours = hoursPerDay(raw.hoursPerDay)
  if (hours.error) errors.hoursPerDay = hours.error

  const days = wholeNumber(raw.daysPerYear, LIMITS.daysPerYear.min, LIMITS.daysPerYear.max)
  if (days.error) errors.daysPerYear = days.error

  if (Object.keys(errors).length > 0) return { errors }

  const values: PredictionInput = {
    gpuCount: gpu.value!,
    smUtilPercent: sm.value!,
    memUtilPercent: mem.value!,
    hoursPerDay: hours.value!,
    daysPerYear: days.value!,
  }
  return { values, errors }
}

/** Hours per year the GPUs are running; the cooling model scales heat energy by this. */
export function operatingHoursPerYear(input: PredictionInput): number {
  return input.hoursPerDay * input.daysPerYear
}
