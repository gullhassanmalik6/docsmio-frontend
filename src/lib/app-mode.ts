export type AppMode = 'wallet' | 'tools'

export const APP_MODE_KEY = 'docsmio.app.mode'

export function parseAppMode(value: string | null): AppMode {
  return value === 'tools' ? 'tools' : 'wallet'
}

export function nextAppMode(mode: AppMode): AppMode {
  return mode === 'wallet' ? 'tools' : 'wallet'
}
