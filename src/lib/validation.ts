import { TASK_TYPES } from '../data/taskTypes'
import type {
  PredictionInput,
  RawPredictionInput,
  TaskType,
  ValidationErrors,
  ValidationResult,
} from '../types/analysis'

export const LIMITS = {
  gpuCount: { min: 1, max: 100_000 },
  durationHours: { min: 0, max: 8760 },
  utilizationPercent: { min: 1, max: 100 },
} as const

type NumberCheck = { value?: number; error?: string }

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
  if (value < min || value > max) return { error: `Enter a value between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')}.` }
  return { value }
}

function duration(raw: string): NumberCheck {
  const parsed = parseNumber(raw)
  if (parsed.error) return parsed
  const value = parsed.value!
  if (value <= LIMITS.durationHours.min) return { error: 'Duration must be greater than 0 hours.' }
  if (value > LIMITS.durationHours.max) return { error: `Duration can be at most ${LIMITS.durationHours.max.toLocaleString('en-US')} hours (one year).` }
  return { value }
}

export function validatePredictionInput(raw: RawPredictionInput): ValidationResult {
  const errors: ValidationErrors = {}

  const taskType = TASK_TYPES.find((t) => t.id === raw.taskType)?.id as TaskType | undefined
  if (!taskType) errors.taskType = 'Select a task type.'

  const gpu = wholeNumber(raw.gpuCount, LIMITS.gpuCount.min, LIMITS.gpuCount.max)
  if (gpu.error) errors.gpuCount = gpu.error

  const hours = duration(raw.durationHours)
  if (hours.error) errors.durationHours = hours.error

  const util = wholeNumber(raw.utilizationPercent, LIMITS.utilizationPercent.min, LIMITS.utilizationPercent.max)
  if (util.error) errors.utilizationPercent = util.error

  if (Object.keys(errors).length > 0) return { errors }

  const values: PredictionInput = {
    taskType: taskType!,
    gpuCount: gpu.value!,
    durationHours: hours.value!,
    utilizationPercent: util.value!,
  }
  return { values, errors }
}
