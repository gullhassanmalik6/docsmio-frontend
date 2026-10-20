import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { APP_MODE_KEY, nextAppMode, parseAppMode, type AppMode } from '@/lib/app-mode'

type AppModeContextValue = {
  mode: AppMode
  setMode: (mode: AppMode) => void
  toggleMode: () => void
}

const AppModeContext = createContext<AppModeContextValue | null>(null)

function storedMode(): AppMode {
  try {
    return parseAppMode(window.localStorage.getItem(APP_MODE_KEY))
  } catch {
    return 'wallet'
  }
}

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppMode>(storedMode)

  useEffect(() => {
    document.documentElement.dataset.appMode = mode
    try {
      window.localStorage.setItem(APP_MODE_KEY, mode)
    } catch {
      // Private browsing can block storage. The choice still applies to this view.
    }
  }, [mode])

  const value = useMemo<AppModeContextValue>(
    () => ({
      mode,
      setMode,
      toggleMode: () => setMode((current) => nextAppMode(current)),
    }),
    [mode],
  )

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>
}

export function useAppMode(): AppModeContextValue {
  const value = useContext(AppModeContext)
  if (!value) throw new Error('useAppMode must be used inside AppModeProvider')
  return value
}
