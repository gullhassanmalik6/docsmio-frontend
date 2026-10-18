export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024
    return `${kb >= 100 ? kb.toFixed(0) : kb.toFixed(1)} KB`
  }
  const mb = bytes / (1024 * 1024)
  return `${mb >= 10 ? mb.toFixed(1) : mb.toFixed(2)} MB`
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

export function targetToBytes(size: number, unit: 'KB' | 'MB'): number {
  return Math.round(size * (unit === 'MB' ? 1024 * 1024 : 1024))
}

export function safeFileName(name: string, extension: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'document'
  const base = cleaned.replace(/\.[^.]+$/, '')
  return `${base}.${extension.replace(/^\./, '')}`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function extensionOf(format: 'jpeg' | 'png' | 'webp'): string {
  if (format === 'jpeg') return 'jpg'
  return format
}

export function mimeOf(format: 'jpeg' | 'png' | 'webp'): string {
  if (format === 'jpeg') return 'image/jpeg'
  if (format === 'png') return 'image/png'
  return 'image/webp'
}
