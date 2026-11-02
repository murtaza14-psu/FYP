import type { AnalysisResult } from '../types/analysis'

export const STORAGE_KEY = 'gpu-cooling-advisor:analysis'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
