import type { AnalysisResult } from '../types/analysis'

/** Bumped when the stored shape changes, so results saved by an older version are never read (v2: real cooling model). */
export const STORAGE_KEY = 'gpu-cooling-advisor:analysis:v2'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const isTechniqueId = (id: unknown) => id === 'air' || id === 'direct-to-chip'

function isEstimate(value: unknown): boolean {
  return (
    isObject(value) &&
    isTechniqueId(value.techniqueId) &&
    isObject(value.electricityKWh) &&
    isObject(value.waterLitres) &&
    isObject(value.waterBreakdown) &&
    Array.isArray(value.electricityItems) &&
    Array.isArray(value.monthly) &&
    value.monthly.length === 12 &&
    typeof value.kWhPerKWhHeat === 'number' &&
    Array.isArray(value.notes)
  )
}

/** Light structural check so stale or tampered storage can't crash the Results page. */
export function isAnalysisResult(value: unknown): value is AnalysisResult {
  return (
    isObject(value) &&
    isObject(value.input) &&
    typeof value.input.smUtilPercent === 'number' &&
    isObject(value.region) &&
    isObject(value.prediction) &&
    isObject(value.heatEnergyKWh) &&
    Array.isArray(value.estimates) &&
    value.estimates.length > 0 &&
    value.estimates.every(isEstimate) &&
    isObject(value.cooling) &&
    isObject(value.cooling.site) &&
    Array.isArray(value.cooling.site.monthlyClimate) &&
    isObject(value.cooling.assumptions) &&
    isObject(value.cooling.parameters) &&
    Array.isArray(value.ranking) &&
    typeof value.criterion === 'string' &&
    typeof value.createdAt === 'string'
  )
}

export function loadResult(): AnalysisResult | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isAnalysisResult(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveResult(result: AnalysisResult | null): void {
  try {
    if (result) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result))
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage can be unavailable (private mode, quota); the in-memory state still works.
  }
}
