export type LibraryFolderKey =
  | 'educational'
  | 'identification'
  | 'career'
  | 'financial'
  | 'medical'
  | 'personal'
  | 'uncategorized'

export type Confidence = 'high' | 'medium' | 'low'

export type FolderSeed = {
  key: LibraryFolderKey
  name: string
}

export type Classification = {
  folderKey: LibraryFolderKey
  folderName: string
  confidence: Confidence
  method: 'filename'
  matched: string[]
}

export const defaultFolders: FolderSeed[] = [
  { key: 'educational', name: 'Educational Documents' },
  { key: 'identification', name: 'Identification Documents' },
  { key: 'career', name: 'Career & Work' },
  { key: 'financial', name: 'Financial Documents' },
  { key: 'medical', name: 'Medical Documents' },
  { key: 'personal', name: 'Personal Documents' },
  { key: 'uncategorized', name: 'Uncategorized' },
]

const rules: { key: LibraryFolderKey; terms: string[] }[] = [
  { key: 'educational', terms: ['marksheet', 'transcript', 'diploma', 'admission', 'academic certificate', 'student record'] },
  { key: 'identification', terms: ['passport', 'identity card', 'national id', 'birth certificate', 'cnic'] },
  { key: 'career', terms: ['resume', 'résumé', 'curriculum vitae', 'experience certificate', 'experience letter', 'offer letter', 'employment'] },
  { key: 'financial', terms: ['invoice', 'receipt', 'bank statement', 'tax return', 'salary slip'] },
  { key: 'medical', terms: ['prescription', 'medical report', 'vaccination', 'lab report', 'discharge summary'] },
  { key: 'personal', terms: ['personal record', 'warranty', 'insurance policy'] },
]

const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_PDF_BYTES = 50 * 1024 * 1024

export function libraryFileError(file: { name: string; type: string; size: number }): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const isPdf = file.type === 'application/pdf' || extension === 'pdf'
  const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || ['jpg', 'jpeg', 'png', 'webp'].includes(extension)
  if (['heic', 'heif'].includes(extension) || file.type === 'image/heic' || file.type === 'image/heif') {
    return 'HEIC is not supported. Export a JPG or PNG first.'
  }
  if (!isPdf && !isImage) return 'Use a PDF, JPG, PNG, or WebP file.'
  if (file.size <= 0) return 'The file is empty.'
  const limit = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES
  if (file.size > limit) return isPdf ? 'PDF files must be 50 MB or smaller.' : 'Images must be 20 MB or smaller.'
  return null
}

export function uniqueFileName(name: string, taken: string[]): string {
  const names = new Set(taken.map((item) => item.toLowerCase()))
  if (!names.has(name.toLowerCase())) return name
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''
  let count = 2
  let candidate = `${stem} (${count})${extension}`
  while (names.has(candidate.toLowerCase())) {
    count += 1
    candidate = `${stem} (${count})${extension}`
  }
  return candidate
}

export function classifyFileName(fileName: string): Classification {
  const haystack = fileName.toLowerCase()
  let best: { key: LibraryFolderKey; matched: string[] } | null = null
  for (const rule of rules) {
    const matched = rule.terms.filter((term) => haystack.includes(term))
    if (matched.length === 0) continue
    if (!best || matched.length > best.matched.length) best = { key: rule.key, matched }
  }
  if (!best) {
    return {
      folderKey: 'uncategorized',
      folderName: 'Uncategorized',
      confidence: 'low',
      method: 'filename',
      matched: [],
    }
  }
  const folderName = defaultFolders.find((folder) => folder.key === best.key)?.name ?? 'Uncategorized'
  return {
    folderKey: best.key,
    folderName,
    confidence: best.matched.length >= 2 || best.matched.some((term) => term.includes(' ')) ? 'high' : 'medium',
    method: 'filename',
    matched: best.matched,
  }
}

export type FolderNode = {
  id: string
  parentId: string | null
}

export function folderMoveError(folders: FolderNode[], folderId: string, parentId: string | null): string | null {
  if (parentId === null) return null
  if (parentId === folderId) return 'A folder cannot be moved into itself.'
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  let current: string | null = parentId
  const seen = new Set<string>()
  while (current) {
    if (current === folderId) return 'A folder cannot be moved into one of its subfolders.'
    if (seen.has(current)) return 'This folder structure is invalid.'
    seen.add(current)
    current = byId.get(current)?.parentId ?? null
  }
  if (!byId.has(parentId)) return 'The destination folder does not exist.'
  return null
}
