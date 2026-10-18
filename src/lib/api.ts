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
  billing_connected: false
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
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
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
  created_at: string
  updated_at: string
}

async function readApiError(response: Response): Promise<never> {
  const body = await response.json().catch(() => null)
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    throw new ApiError(response.status, 'The account service is not reachable. Document tools still work in this browser.')
  }
  const detail = body && typeof body.detail === 'string' ? body.detail : 'The request failed.'
  throw new ApiError(response.status, detail)
}

export function uploadLibraryDocument(file: Blob, filename: string, folderId: string, classificationKey: string | null) {
  const body = new FormData()
  body.set('folder_id', folderId)
  if (classificationKey) body.set('classification_key', classificationKey)
  body.set('upload', file, filename)
  return fetch(`${API_BASE}/api/library/documents`, { method: 'POST', body, credentials: 'include' }).then(async (response) => {
    if (!response.ok) await readApiError(response)
    return response.json() as Promise<OnlineDocument>
  })
}

export async function downloadLibraryDocument(id: string, filename: string) {
  const response = await fetch(`${API_BASE}/api/library/documents/${id}/file`, { credentials: 'include' })
  if (!response.ok) await readApiError(response)
  const blob = await response.blob()
  downloadBlob(blob, filename)
  return blob
}
