import type { ImageFormat } from '@/lib/image-process'

export type Preferences = {
  defaultQuality: number
  defaultFormat: ImageFormat
  defaultTargetKb: number
}

export const defaultPreferences: Preferences = {
  defaultQuality: 75,
  defaultFormat: 'jpeg',
  defaultTargetKb: 200,
}

const STORAGE_KEY = 'docsmio.preferences'
const LEGACY_STORAGE_KEY = 'docufix.preferences'

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
    if (raw && !localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, raw)
    if (!raw) return defaultPreferences
    const parsed = JSON.parse(raw) as Partial<Preferences>
    const format = parsed.defaultFormat
    return {
      defaultQuality: clamp(parsed.defaultQuality, 5, 100, defaultPreferences.defaultQuality),
      defaultFormat: format === 'png' || format === 'webp' || format === 'jpeg' ? format : 'jpeg',
      defaultTargetKb: clamp(parsed.defaultTargetKb, 10, 10240, defaultPreferences.defaultTargetKb),
    }
  } catch {
    return defaultPreferences
  }
}

export function savePreferences(preferences: Preferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
}
