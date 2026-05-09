import { createContext, useContext, useEffect, type ReactNode } from 'react'
import type { AppMode } from '../types'

interface AppModeContextValue {
  appMode: AppMode | undefined
  setAppMode: (mode: AppMode) => void
  isSimple: boolean
}

const AppModeContext = createContext<AppModeContextValue>({
  appMode: undefined,
  setAppMode: () => {},
  isSimple: false,
})

interface ProviderProps {
  appMode: AppMode | undefined
  setAppMode: (mode: AppMode) => void
  children: ReactNode
}

export function AppModeProvider({ appMode, setAppMode, children }: ProviderProps) {
  const isSimple = appMode === 'simple'

  useEffect(() => {
    const root = document.documentElement
    if (isSimple) {
      root.setAttribute('data-app-mode', 'simple')
    } else {
      root.removeAttribute('data-app-mode')
    }
  }, [isSimple])

  return (
    <AppModeContext.Provider value={{ appMode, setAppMode, isSimple }}>
      {children}
    </AppModeContext.Provider>
  )
}

export function useAppMode() {
  return useContext(AppModeContext)
}
