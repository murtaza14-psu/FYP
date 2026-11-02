import { createContext, useContext } from 'react'
import type { AnalysisResult } from '../types/analysis'

export interface AnalysisContextValue {
  result: AnalysisResult | null
  setResult: (result: AnalysisResult) => void
  clear: () => void
}

export const AnalysisContext = createContext<AnalysisContextValue | null>(null)

export function useAnalysis(): AnalysisContextValue {
  const value = useContext(AnalysisContext)
  if (!value) throw new Error('useAnalysis must be used inside <AnalysisProvider>')
  return value
}
