import { useMemo, useState, type ReactNode } from 'react'
import type { AnalysisResult } from '../types/analysis'
import { AnalysisContext, type AnalysisContextValue } from './analysisContext'
import { loadResult, saveResult } from './storage'

/** Holds the latest analysis and mirrors it to sessionStorage so a page refresh keeps it. */
export default function AnalysisProvider({ children }: { children: ReactNode }) {
  const [result, setResultState] = useState<AnalysisResult | null>(loadResult)

  const value = useMemo<AnalysisContextValue>(
    () => ({
      result,
      setResult: (next) => {
        saveResult(next)
        setResultState(next)
      },
      clear: () => {
        saveResult(null)
        setResultState(null)
      },
    }),
    [result],
  )

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
}
