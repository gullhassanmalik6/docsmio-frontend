import { downloadBlob } from '@/lib/format'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export type AccountUser = {
  id: string
  name: string
  email: string
  plan: 'free' | 'pro' | 'business'
  is_active: boolean
  created_at: string
  history_limit: number
  features: string[]
  billing_connected: boolean
  audience: string | null
  timezone_name: string
  onboarding_completed: boolean
  notify_in_app: boolean
  notify_email: boolean
  quiet_start: string | null
  quiet_end: string | null
  storage_used_bytes: number
  storage_quota_bytes: number
}

export type HistoryRecord = {
  id: string
  original_filename: string
  operation_type: string
  original_size: number
  output_size: number | null
  status: 'completed' | 'failed'
  created_at: string
  download_available: false
}

export type HistoryPage = {
  items: HistoryRecord[]
  page: number
  page_size: number
  total: number
  download_available: false
  note: string
}

export function accountErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof TypeError) return 'The account service is not reachable. Document tools still work in this browser.'
  return fallback
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('X-Docsmio-Request', '1')
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' })
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new ApiError(response.status, 'The account service is not reachable. Document tools still work in this browser.')
    }
    const detail = body && typeof body.detail === 'string' ? body.detail : 'The request failed.'
    throw new ApiError(response.status, detail)
  }
  return body as T
}

export type OnlineFolder = {
  id: string
  name: string
  parent_id: string | null
  system_key: string | null
  created_at: string
  updated_at: string
}

export type OnlineDocument = {
  id: string
  folder_id: string
  filename: string
  mime_type: string
  size: number
  favorite: boolean
  classification_key: string | null
  classification_method: string | null
  classification_confidence: string | null
  category: string | null
  category_source: string | null
  category_confirmed: boolean
  notes: string | null
  tags: string
  text_status: string
  has_text: boolean
  date_value: string | null
  date_label: string | null
  date_source: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type LibrarySearchPage = {
  items: OnlineDocument[]
  page: number
  page_size: number
  total: number
  note: string
}

async function readApiError(response: Response): Promise<never> {
  const body = await response.json().catch(() => null)
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    throw new ApiError(response.status, 'The account service is not reachable. Document tools still work in this browser.')
  }
  const detail = body && typeof body.detail === 'string' ? body.detail : 'The request failed.'
  throw new ApiError(response.status, detail)
}

export function uploadLibraryDocument(
  file: Blob,
  filename: string,
  folderId: string,
  classificationKey: string | null,
  options: { onProgress?: (ratio: number) => void; signal?: AbortSignal } = {},
) {
  const body = new FormData()
  body.set('folder_id', folderId)
  if (classificationKey) body.set('classification_key', classificationKey)
  body.set('upload', file, filename)
  return new Promise<OnlineDocument>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/api/library/documents`)
    xhr.withCredentials = true
    xhr.setRequestHeader('X-Docsmio-Request', '1')
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total)
    }
    xhr.onload = () => {
      const payload = xhr.responseText ? (JSON.parse(xhr.responseText) as { detail?: string }) : null
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as OnlineDocument)
        return
      }
      const detail = payload && typeof payload.detail === 'string' ? payload.detail : 'The request failed.'
      reject(new ApiError(xhr.status, detail))
    }
    xhr.onerror = () => reject(new ApiError(0, 'The connection was lost. This file was not confirmed.'))
    xhr.onabort = () => reject(new ApiError(0, 'The upload was cancelled.'))
    options.signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(body)
  })
}

export async function downloadLibraryDocument(id: string, filename: string) {
  const response = await fetch(`${API_BASE}/api/library/documents/${id}/file`, {
    credentials: 'include',
    headers: { 'X-Docsmio-Request': '1' },
  })
  if (!response.ok) await readApiError(response)
  const blob = await response.blob()
  downloadBlob(blob, filename)
  return blob
}
