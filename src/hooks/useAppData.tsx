import { createContext, useContext, type ReactNode } from 'react'
import type { useAnswers } from './useAnswers'

/**
 * Shared app-data context. `App` owns the single `useAnswers()` instance and
 * publishes it here; any view can pull exactly what it needs via `useAppData()`
 * instead of receiving a dozen drilled props. This is the seam that lets views
 * migrate off prop-drilling one at a time without touching App's wiring.
 */
export type AppData = ReturnType<typeof useAnswers>

const AppDataContext = createContext<AppData | null>(null)

export function AppDataProvider({ value, children }: { value: AppData; children: ReactNode }) {
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within an AppDataProvider')
  return ctx
}
