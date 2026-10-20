import { Cloud, Download, FolderPlus, HardDrive, LayoutGrid, List, Mail, MessageCircle, Search, Share2, Star, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/auth-context'
import { api, downloadLibraryDocument, uploadLibraryDocument, type LibrarySearchPage, type OnlineDocument, type OnlineFolder } from '@/lib/api'
import { downloadBlob, formatBytes, formatDate } from '@/lib/format'
import { classifyFileName, folderMoveError, libraryFileError, type Classification } from '@/lib/library-rules'
import { shareDocumentFile, shareFallbackNote, type ShareTarget } from '@/lib/library-share'
import { stageForTool } from '@/lib/library-stage'
import {
  createFolder,
  deleteDocument,
  deleteFolder,
  ensureLibraryFolders,
  importDocument,
  listDocuments,
  readDocumentBlob,
  updateDocument,
  updateFolder,
  type LibraryFolder,
} from '@/lib/library-store'
import { cn } from '@/lib/utils'

type Mode = 'local' | 'online'
type SortKey = 'added' | 'updated' | 'name' | 'size' | 'type'
type View = 'grid' | 'list'

type Row = {
  id: string
  name: string
  mime: string
  size: number
  folderId: string
  favorite: boolean
  createdAt: number
  updatedAt: number
  category?: string | null
  categorySource?: string | null
  categoryConfirmed?: boolean
  textStatus?: string
  notes?: string | null
  tags?: string
  dateValue?: string | null
  dateLabel?: string | null
  dateSource?: string | null
}

type PendingFile = {
  key: string
  file: File
  folderId: string
  classification: Classification
  error: string | null
  progress: number | null
}

const MODE_KEY = 'docsmio.library.mode'

function storedMode(): Mode {
  const saved = window.localStorage.getItem(MODE_KEY) ?? window.localStorage.getItem('docufix.library.mode')
  if (saved && !window.localStorage.getItem(MODE_KEY)) window.localStorage.setItem(MODE_KEY, saved)
  return saved === 'online' ? 'online' : 'local'
}

function mapFolder(folder: OnlineFolder): LibraryFolder {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parent_id,
    systemKey: folder.system_key as LibraryFolder['systemKey'],
    createdAt: Date.parse(folder.created_at),
    updatedAt: Date.parse(folder.updated_at),
  }
}

function mapDocument(document: OnlineDocument): Row {
  return {
    id: document.id,
    name: document.filename,
    mime: document.mime_type,
    size: document.size,
    folderId: document.folder_id,
    favorite: document.favorite,
    createdAt: Date.parse(document.created_at),
    updatedAt: Date.parse(document.updated_at),
    category: document.category,
    categorySource: document.category_source,
    categoryConfirmed: document.category_confirmed,
    textStatus: document.text_status,
    notes: document.notes,
    tags: document.tags,
    dateValue: document.date_value,
    dateLabel: document.date_label,
    dateSource: document.date_source,
  }
}

function OnlineDetails({ row, onSaved }: { row: Row; onSaved: () => Promise<void> }) {
  const [notes, setNotes] = useState(row.notes ?? '')
  const [tags, setTags] = useState(row.tags ?? '')
  const [category, setCategory] = useState(row.category ?? '')
  const [dateValue, setDateValue] = useState(row.dateValue ?? '')
  const [dateLabel, setDateLabel] = useState(row.dateLabel ?? 'expiry')
  const [message, setMessage] = useState('')

  async function save() {
    await api(`/api/library/documents/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        notes,
        tags,
        category: category || undefined,
        confirm_category: Boolean(category),
        ...(dateValue ? { date_value: dateValue, date_label: dateLabel } : { clear_date: true }),
      }),
    })
    setMessage('Saved. A category you type is kept if text is read again.')
    await onSaved()
  }

  async function readImageText() {
    setMessage('Reading text in this browser…')
    const response = await fetch(`/api/library/documents/${row.id}/file`, { credentials: 'include', headers: { 'X-Docsmio-Request': '1' } })
    if (!response.ok) throw new Error('The file could not be opened for text reading.')
    const blob = await response.blob()
    const { recognizeDocument } = await import('@/lib/ocr')
    const result = await recognizeDocument(blob, 'eng')
    await api(`/api/library/documents/${row.id}/text`, { method: 'POST', body: JSON.stringify({ text: result.text }) })
    setMessage(result.warning ?? 'Text was saved for search on this account. It was not sent to an external AI service.')
    await onSaved()
  }

  return (
    <form className="mt-3 grid w-full gap-2 rounded-2xl border border-white/10 bg-black/20 p-3" onSubmit={(event) => { event.preventDefault(); void save().catch((caught: unknown) => setMessage(caught instanceof Error ? caught.message : 'Could not save.')) }}>
      <label className="text-xs" htmlFor={`notes-${row.id}`}>Notes</label>
      <textarea id={`notes-${row.id}`} className="min-h-20 rounded-xl border border-white/10 bg-transparent p-2 text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} />
      <label className="text-xs" htmlFor={`tags-${row.id}`}>Tags, separated by commas</label>
      <Input id={`tags-${row.id}`} value={tags} onChange={(event) => setTags(event.target.value)} />
      <label className="text-xs" htmlFor={`category-${row.id}`}>Category</label>
      <Input id={`category-${row.id}`} value={category} onChange={(event) => setCategory(event.target.value)} />
      <p className="text-xs text-muted-foreground">{row.categorySource === 'manual' ? 'You chose this category.' : row.categorySource === 'text' ? 'Suggested from extracted text.' : row.categorySource === 'filename' ? 'Suggested from the file name.' : 'No keyword match yet.'}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input aria-label={`Date for ${row.name}`} type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
        <select aria-label={`Date label for ${row.name}`} className="h-11 rounded-full border border-white/10 bg-transparent px-3 text-sm" value={dateLabel} onChange={(event) => setDateLabel(event.target.value)}>
          <option value="expiry">Expiry</option>
          <option value="deadline">Deadline</option>
          <option value="issued">Issued</option>
          <option value="renewal">Renewal</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm">Save details</Button>
        {row.mime.startsWith('image/') ? <Button type="button" size="sm" variant="outline" onClick={() => void readImageText().catch((caught: unknown) => setMessage(caught instanceof Error ? caught.message : 'Text could not be read.'))}>Read image text</Button> : null}
        <Button type="button" size="sm" variant="outline" onClick={() => void api(`/api/library/documents/${row.id}/reprocess`, { method: 'POST' }).then(() => onSaved()).then(() => setMessage('Processing was run again.'))}>Retry text extraction</Button>
      </div>
      {message ? <p className="text-xs" role="status">{message}</p> : null}
    </form>
  )
}

export function DocumentsPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const cancelImport = useRef(false)
  const [mode, setMode] = useState<Mode>(storedMode)
  const [folders, setFolders] = useState<LibraryFolder[]>([])
  const [documents, setDocuments] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('added')
  const [view, setView] = useState<View>('grid')
  const [typeFilter, setTypeFilter] = useState('all')
  const [folderId, setFolderId] = useState('all')
  const [selected, setSelected] = useState<string[]>([])
  const [pending, setPending] = useState<PendingFile[]>([])
  const [importing, setImporting] = useState(false)
  const [newFolder, setNewFolder] = useState('')
  const [preview, setPreview] = useState<{ name: string; url: string; mime: string } | null>(null)
  const [moveTarget, setMoveTarget] = useState('')
  const [shareFor, setShareFor] = useState<string | null>(null)
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchRows, setSearchRows] = useState<Row[] | null>(null)
  const [detailsFor, setDetailsFor] = useState<string | null>(null)
  const [showTrash, setShowTrash] = useState(false)
  const preparedShare = useRef<{ id: string; file: File } | null>(null)

  function run(action: () => Promise<unknown>) {
    void action().catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : 'That action could not be completed.')
    })
  }

  useEffect(() => {
    window.localStorage.setItem(MODE_KEY, mode)
  }, [mode])

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      if (mode === 'local') {
        const nextFolders = await ensureLibraryFolders()
        const nextDocuments = await listDocuments()
        setFolders(nextFolders)
        setDocuments(nextDocuments)
      } else if (!auth.user) {
        setFolders([])
        setDocuments([])
      } else {
        const [nextFolders, nextDocuments] = await Promise.all([
          api<OnlineFolder[]>('/api/library/folders'),
          api<OnlineDocument[]>(`/api/library/documents?trash=${showTrash ? 'true' : 'false'}&limit=200`),
        ])
        setFolders(nextFolders.map(mapFolder))
        setDocuments(nextDocuments.map(mapDocument))
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The library could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // Search and sort for the online library are applied again locally, so this reload follows the library mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, auth.user, showTrash])

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query), 300)
    return () => window.clearTimeout(handle)
  }, [query])

  useEffect(() => {
    if (mode !== 'online' || !auth.user || !debouncedQuery.trim()) {
      setSearchRows(null)
      return
    }
    const params = new URLSearchParams({ q: debouncedQuery.trim(), page_size: '50', sort })
    if (typeFilter === 'pdf' || typeFilter === 'image') params.set('mime', typeFilter)
    if (folderId === 'favorites') params.set('favorite', 'true')
    if (folderId !== 'all' && folderId !== 'favorites' && folderId !== 'recent') params.set('folder_id', folderId)
    let cancel = false
    void api<LibrarySearchPage>(`/api/library/search?${params.toString()}`)
      .then((result) => {
        if (!cancel) setSearchRows(result.items.map(mapDocument))
      })
      .catch((caught: unknown) => {
        if (!cancel) setError(caught instanceof Error ? caught.message : 'Search failed.')
      })
    return () => {
      cancel = true
    }
  }, [auth.user, debouncedQuery, folderId, mode, sort, typeFilter])

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url)
  }, [preview])

  const visible = useMemo(() => {
    if (mode === 'online' && searchRows) return searchRows
    const needle = query.trim().toLowerCase()
    const folderName = (id: string) => folders.find((folder) => folder.id === id)?.name.toLowerCase() ?? ''
    const rows = documents.filter((document) => {
      if (folderId === 'favorites' && !document.favorite) return false
      if (folderId !== 'all' && folderId !== 'favorites' && folderId !== 'recent' && document.folderId !== folderId) return false
      if (typeFilter === 'pdf' && document.mime !== 'application/pdf') return false
      if (typeFilter === 'image' && !document.mime.startsWith('image/')) return false
      if (!needle) return true
      return document.name.toLowerCase().includes(needle) || folderName(document.folderId).includes(needle) || document.mime.includes(needle)
    })
    const sorted = [...rows].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'size') return b.size - a.size
      if (sort === 'type') return a.mime.localeCompare(b.mime)
      if (sort === 'updated') return b.updatedAt - a.updatedAt
      return b.createdAt - a.createdAt
    })
    return folderId === 'recent' ? sorted.slice(0, 8) : sorted
  }, [documents, folderId, folders, mode, query, searchRows, sort, typeFilter])

  const recent = [...documents].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4)

  function queueFiles(files: File[]) {
    const next = files.map((file) => {
      const classification = classifyFileName(file.name)
      const match = folders.find((folder) => folder.systemKey === classification.folderKey)
      const fallback = folders.find((folder) => folder.systemKey === 'uncategorized')
      return {
        key: crypto.randomUUID(),
        file,
        folderId: match?.id ?? fallback?.id ?? folders[0]?.id ?? '',
        classification,
        error: libraryFileError(file),
        progress: null,
      }
    })
    setPending((current) => [...current, ...next])
    setNotice('Review the suggested folder. Nothing is stored until you confirm.')
  }

  async function confirmImport() {
    if (importing) return
    const ready = pending.filter((item) => !item.error && item.folderId)
    if (ready.length === 0) return
    setImporting(true)
    cancelImport.current = false
    setError('')
    try {
      for (const item of ready) {
        if (cancelImport.current) break
        try {
          if (mode === 'local') {
            await importDocument({ file: item.file, folderId: item.folderId, classification: item.classification })
          } else {
            await uploadLibraryDocument(item.file, item.file.name, item.folderId, item.classification.folderKey, {
              onProgress: (ratio) => setPending((current) => current.map((entry) => entry.key === item.key ? { ...entry, progress: ratio } : entry)),
            })
          }
          setPending((current) => current.filter((entry) => entry.key !== item.key))
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : 'This file was not saved.'
          setPending((current) => current.map((entry) => entry.key === item.key ? { ...entry, error: message, progress: null } : entry))
        }
      }
      setNotice(mode === 'local' ? 'Saved in this browser.' : 'Confirmed uploads are in the online library. Local copies were not changed.')
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The import stopped before every file was saved.')
    } finally {
      setImporting(false)
    }
  }

  async function blobFor(row: Row): Promise<Blob> {
    if (mode === 'local') return readDocumentBlob(row.id)
    const response = await fetch(`/api/library/documents/${row.id}/file`, { credentials: 'include', headers: { 'X-Docsmio-Request': '1' } })
    if (!response.ok) throw new Error('The online file could not be opened.')
    return response.blob()
  }

  async function previewRow(row: Row) {
    const blob = await blobFor(row)
    if (preview) URL.revokeObjectURL(preview.url)
    if (!blob.type.startsWith('image/') && blob.type !== 'application/pdf' && row.mime !== 'application/pdf') {
      setError('Preview is available for PDF and image files. Download the file instead.')
      return
    }
    setPreview({ name: row.name, url: URL.createObjectURL(blob), mime: blob.type || row.mime })
  }

  async function shareRow(row: Row, target: ShareTarget) {
    let file = preparedShare.current?.id === row.id ? preparedShare.current.file : null
    if (!file) {
      const blob = await blobFor(row)
      file = new File([blob], row.name, { type: blob.type || row.mime })
      preparedShare.current = { id: row.id, file }
    }
    const result = await shareDocumentFile(file)
    if (result === 'cancelled') return
    if (result === 'shared') {
      setShareFor(null)
      setNotice(`“${file.name}” was handed to the app you chose.`)
      return
    }
    if (result === 'retry') {
      setNotice('Tap the same share button again. The file is ready for WhatsApp, email, or another app.')
      return
    }
    downloadBlob(file, file.name)
    if (target === 'whatsapp') window.open('https://web.whatsapp.com/', '_blank', 'noopener,noreferrer')
    if (target === 'email') {
      window.location.href = `mailto:?subject=${encodeURIComponent(file.name)}&body=${encodeURIComponent('Attach the downloaded file before sending.')}`
    }
    setNotice(shareFallbackNote(target))
  }

  async function downloadRow(row: Row) {
    if (mode === 'online') {
      await downloadLibraryDocument(row.id, row.name)
      return
    }
    const blob = await readDocumentBlob(row.id)
    downloadBlob(blob, row.name)
  }

  async function renameRow(row: Row) {
    const name = window.prompt('New file name', row.name)
    if (!name || name.trim() === row.name) return
    if (mode === 'local') await updateDocument(row.id, { name: name.trim() })
    else await api(`/api/library/documents/${row.id}`, { method: 'PATCH', body: JSON.stringify({ filename: name.trim() }) })
    await refresh()
  }

  async function favoriteRow(row: Row) {
    if (mode === 'local') await updateDocument(row.id, { favorite: !row.favorite })
    else await api(`/api/library/documents/${row.id}`, { method: 'PATCH', body: JSON.stringify({ favorite: !row.favorite }) })
    await refresh()
  }

  async function removeRow(row: Row) {
    const label = mode === 'local'
      ? 'Delete this file from this browser?'
      : showTrash
        ? 'Delete this file permanently? The stored copy will be removed.'
        : 'Move this file to trash? You can restore it from Trash.'
    if (!window.confirm(label)) return
    if (mode === 'local') await deleteDocument(row.id)
    else await api(`/api/library/documents/${row.id}${showTrash ? '?purge=true' : ''}`, { method: 'DELETE' })
    setNotice(showTrash || mode === 'local' ? 'Deleted.' : 'Moved to trash.')
    await refresh()
  }

  async function moveRows(ids: string[], destination = moveTarget) {
    if (!destination) return
    if (mode === 'local') {
      for (const id of ids) await updateDocument(id, { folderId: destination })
    } else {
      for (const id of ids) await api(`/api/library/documents/${id}`, { method: 'PATCH', body: JSON.stringify({ folder_id: destination }) })
    }
    setSelected([])
    setNotice(mode === 'local' ? 'Moved in this browser.' : 'Moved in the online library.')
    await refresh()
  }

  async function copyLocalToOnline(row: Row) {
    if (!auth.user) {
      setError('Sign in before uploading. Local files stay on this device until you do.')
      return
    }
    if (!window.confirm(`Upload “${row.name}” to your online library? The browser copy stays where it is.`)) return
    const blob = await readDocumentBlob(row.id)
    const foldersOnline = await api<OnlineFolder[]>('/api/library/folders')
    const localFolder = folders.find((folder) => folder.id === row.folderId)
    const destination = foldersOnline.find((folder) => folder.system_key && folder.system_key === localFolder?.systemKey) ?? foldersOnline.find((folder) => folder.system_key === 'uncategorized')
    if (!destination) throw new Error('The online library has no destination folder.')
    await uploadLibraryDocument(blob, row.name, destination.id, localFolder?.systemKey ?? null)
    setNotice('Uploaded a copy. The local file was not deleted, and nothing else was synced.')
  }

  async function openInTool(row: Row, href: string) {
    const blob = await blobFor(row)
    await stageForTool({ name: row.name, mime: row.mime, blob })
    navigate(href)
  }

  async function addFolder() {
    const name = newFolder.trim()
    if (!name) return
    const parentId = folderId !== 'all' && folderId !== 'favorites' && folderId !== 'recent' ? folderId : null
    if (mode === 'local') await createFolder(name, parentId)
    else await api('/api/library/folders', { method: 'POST', body: JSON.stringify({ name, parent_id: parentId }) })
    setNewFolder('')
    await refresh()
  }

  async function renameCurrentFolder() {
    const folder = folders.find((item) => item.id === folderId)
    if (!folder) return
    const name = window.prompt('Folder name', folder.name)
    if (!name?.trim()) return
    if (mode === 'local') await updateFolder(folder.id, { name: name.trim() })
    else await api(`/api/library/folders/${folder.id}`, { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) })
    await refresh()
  }

  async function removeCurrentFolder(disposition: 'uncategorized' | 'delete') {
    const folder = folders.find((item) => item.id === folderId)
    if (!folder) return
    const count = documents.filter((document) => document.folderId === folder.id).length
    const warning = disposition === 'delete'
      ? `Delete “${folder.name}” and its ${count} file(s)? This cannot be undone.`
      : `Delete “${folder.name}” and move its ${count} file(s) to Uncategorized?`
    if (!window.confirm(warning)) return
    try {
      if (mode === 'local') await deleteFolder(folder.id, disposition)
      else await api(`/api/library/folders/${folder.id}?disposition=${disposition}`, { method: 'DELETE' })
      setFolderId('all')
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The folder could not be deleted.')
    }
  }

  async function nestFolder(parentId: string) {
    const folder = folders.find((item) => item.id === folderId)
    if (!folder) return
    const problem = folderMoveError(folders.map((item) => ({ id: item.id, parentId: item.parentId })), folder.id, parentId || null)
    if (problem) {
      setError(problem)
      return
    }
    if (mode === 'local') await updateFolder(folder.id, { parentId: parentId || null })
    else await api(`/api/library/folders/${folder.id}`, { method: 'PATCH', body: JSON.stringify({ parent_id: parentId || null }) })
    await refresh()
  }

  const activeFolder = folders.find((folder) => folder.id === folderId)

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[240px_1fr] lg:px-6">
      <aside className="rounded-3xl border border-white/10 bg-[#101815] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Folders</p>
        <div className="mt-3 grid gap-1">
          {[
            ['all', 'All documents'],
            ['recent', 'Recently added'],
            ['favorites', 'Favorites'],
          ].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFolderId(id)} className={cn('rounded-xl px-3 py-2 text-left text-sm', folderId === id ? 'bg-white/10' : 'hover:bg-white/5')}>
              {label}
            </button>
          ))}
          {folders.map((folder) => (
            <button key={folder.id} type="button" onClick={() => setFolderId(folder.id)} className={cn('rounded-xl px-3 py-2 text-left text-sm', folderId === folder.id ? 'bg-white/10' : 'hover:bg-white/5')}>
              <span className={folder.parentId ? 'pl-3' : ''}>{folder.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">{documents.filter((document) => document.folderId === folder.id).length}</span>
            </button>
          ))}
        </div>
        <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); run(addFolder) }}>
          <Input aria-label="New folder name" value={newFolder} onChange={(event) => setNewFolder(event.target.value)} placeholder="New folder" />
          <Button type="submit" size="icon" variant="outline" aria-label="Create folder"><FolderPlus className="size-4" /></Button>
        </form>
      </aside>

      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">My Documents</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Organize PDFs and images in this browser, or copy chosen files to a private online library after you sign in.</p>
          </div>
          <div className="flex gap-2">
            {mode === 'online' ? <Button type="button" variant="outline" onClick={() => setShowTrash((current) => !current)}>{showTrash ? 'Back to library' : 'Trash'}</Button> : null}
            <Button type="button" onClick={() => fileInput.current?.click()}><Upload className="size-4" /> Import</Button>
          </div>
          <input ref={fileInput} className="sr-only" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp" aria-label="Import documents" onChange={(event) => { queueFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setMode('local')} className={cn('inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm', mode === 'local' ? 'bg-primary text-primary-foreground' : 'bg-white/5')}>
            <HardDrive className="size-4" /> Local library
          </button>
          <button type="button" onClick={() => setMode('online')} className={cn('inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm', mode === 'online' ? 'bg-primary text-primary-foreground' : 'bg-white/5')}>
            <Cloud className="size-4" /> Online library
          </button>
          <span className="text-xs text-muted-foreground">{mode === 'local' ? 'On this device only. Not a sync and not an encrypted vault.' : 'Manual upload. Files are not synced back automatically.'}</span>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Browser storage can be cleared by the browser, a cleanup tool, or a private window. Local documents then disappear. Online upload sends the file to your account only after you confirm it. Filename suggestions are keyword matches, not OCR or an external AI service.</p>

        {mode === 'online' && !auth.user ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#101815] p-6">
            <h2 className="text-lg font-semibold">Sign in to use the online library</h2>
            <p className="mt-2 text-sm text-muted-foreground">Your local library still works without an account. Signing in does not upload those files.</p>
            <Button asChild className="mt-4"><Link to="/login">Sign in</Link></Button>
          </div>
        ) : null}

        <div
          className="mt-5 rounded-3xl border border-dashed border-white/15 bg-[#101815] p-4"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); queueFiles(Array.from(event.dataTransfer.files)) }}
        >
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search documents by file name" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search file names and folders" />
            </div>
            <select aria-label="Sort documents" className="h-11 rounded-full border border-white/10 bg-transparent px-3 text-sm" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <option value="added">Date added</option>
              <option value="updated">Last modified</option>
              <option value="name">Name</option>
              <option value="size">File size</option>
              <option value="type">File type</option>
            </select>
            <select aria-label="Filter by file type" className="h-11 rounded-full border border-white/10 bg-transparent px-3 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">All types</option>
              <option value="pdf">PDF</option>
              <option value="image">Images</option>
            </select>
            <Button type="button" variant="outline" size="icon" aria-label="Grid view" onClick={() => setView('grid')}><LayoutGrid className="size-4" /></Button>
            <Button type="button" variant="outline" size="icon" aria-label="List view" onClick={() => setView('list')}><List className="size-4" /></Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{mode === 'online' ? 'Online search checks names, folders, categories, tags, notes, and extracted text. A document marked “text not read yet” has not been indexed.' : 'Local search checks file names, folder names, and file types. It does not read text inside the file.'}</p>
        </div>

        {error ? <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert">{error}</p> : null}
        {notice ? <p className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm" role="status">{notice}</p> : null}

        {pending.length > 0 ? (
          <div className="mt-4 rounded-3xl border border-white/10 bg-[#101815] p-4">
            <h2 className="font-semibold">Confirm where to file these</h2>
            <ul className="mt-3 space-y-3">
              {pending.map((item) => (
                <li key={item.key} className="grid gap-2 rounded-2xl bg-white/5 p-3 md:grid-cols-[1fr_220px_auto]">
                  <div>
                    <p className="text-sm font-medium">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)} · filename match · {item.classification.confidence} confidence · {item.classification.folderName}</p>
                    {item.error ? <p className="text-xs text-red-200">{item.error}</p> : null}
                    {item.progress !== null ? <p className="text-xs text-muted-foreground">Uploading {Math.round(item.progress * 100)}%</p> : null}
                  </div>
                  <select aria-label={`Folder for ${item.file.name}`} className="h-10 rounded-xl border border-white/10 bg-transparent px-2 text-sm" value={item.folderId} onChange={(event) => setPending((current) => current.map((entry) => entry.key === item.key ? { ...entry, folderId: event.target.value } : entry))}>
                    {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                  </select>
                  <Button type="button" variant="ghost" onClick={() => setPending((current) => current.filter((entry) => entry.key !== item.key))}>Remove</Button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <Button type="button" disabled={importing} onClick={() => run(confirmImport)}>{importing ? 'Saving…' : mode === 'local' ? 'Save in this browser' : 'Upload to online library'}</Button>
              {importing ? <Button type="button" variant="outline" onClick={() => { cancelImport.current = true }}>Stop after the current file</Button> : null}
            </div>
          </div>
        ) : null}

        {activeFolder ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span>{activeFolder.name}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => run(renameCurrentFolder)}>Rename folder</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => run(() => removeCurrentFolder('uncategorized'))}>Delete folder, keep files</Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => run(() => removeCurrentFolder('delete'))}>Delete folder and files</Button>
            <select aria-label="Move this folder" className="h-9 rounded-full border border-white/10 bg-transparent px-3 text-xs" defaultValue="" onChange={(event) => { const value = event.target.value; event.target.value = ''; run(() => nestFolder(value)) }}>
              <option value="" disabled>Move folder into…</option>
              <option value="">Top level</option>
              {folders.filter((folder) => folder.id !== activeFolder.id).map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select>
          </div>
        ) : null}

        {selected.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm">{selected.length} selected</span>
            <select aria-label="Move selected documents" className="h-9 rounded-full border border-white/10 bg-transparent px-3 text-sm" value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)}>
              <option value="">Choose folder</option>
              {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select>
            <Button type="button" size="sm" onClick={() => run(() => moveRows(selected))}>Move selected</Button>
          </div>
        ) : null}

        {folderId === 'all' && recent.length > 0 && query.trim() === '' ? (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-muted-foreground">Recently added</h2>
            <div className="mt-2 flex gap-2 overflow-auto">
              {recent.map((document) => (
                <button key={document.id} type="button" className="min-w-40 rounded-2xl border border-white/10 px-3 py-2 text-left text-sm" onClick={() => setFolderId(document.folderId)}>
                  {document.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {loading ? <p className="mt-8 text-sm text-muted-foreground">Loading documents…</p> : null}
        {!loading && visible.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-[#101815] px-6 py-12 text-center">
            <h2 className="text-lg font-semibold">No documents here yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Import a PDF or image. You choose the folder before it is saved.</p>
          </div>
        ) : null}

        <div className={cn('mt-6', view === 'grid' ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'grid gap-2')}>
          {visible.map((document) => {
            const folder = folders.find((item) => item.id === document.folderId)
            const tools = document.mime === 'application/pdf'
              ? [['/tools/compress-pdf', 'Compress'], ['/tools/split-pdf', 'Split']]
              : [['/tools/image-resize', 'Resize'], ['/tools/convert', 'Convert'], ['/tools/scan', 'OCR']]
            return (
              <article key={document.id} className="rounded-3xl border border-white/10 bg-[#101815] p-4">
                <div className="flex items-start gap-3">
                  <input aria-label={`Select ${document.name}`} type="checkbox" checked={selected.includes(document.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, document.id] : current.filter((id) => id !== document.id))} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium">{document.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{document.mime} · {formatBytes(document.size)} · {folder?.name ?? 'Missing folder'} · {mode === 'local' ? 'Local' : 'Online'}</p>
                    <p className="text-xs text-muted-foreground">Added {formatDate(document.createdAt)} · Updated {formatDate(document.updatedAt)}</p>
                    {mode === 'online' ? (
                      <p className="text-xs text-muted-foreground">
                        {document.category ? `${document.categoryConfirmed ? 'Category' : 'Suggested category'}: ${document.category}` : 'No category'}
                        {' · '}
                        {document.textStatus === 'ready' ? 'Text indexed' : document.textStatus === 'pending' ? 'Text not read yet' : document.textStatus === 'failed' ? 'Text extraction failed' : 'No extracted text'}
                        {document.dateValue ? ` · ${document.dateSource === 'suggested' ? 'Suggested date' : 'Date'} ${document.dateValue}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <button type="button" aria-label={document.favorite ? 'Remove favorite' : 'Mark favorite'} onClick={() => run(() => favoriteRow(document))} className={document.favorite ? 'text-primary' : 'text-muted-foreground'}>
                    <Star className="size-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => run(() => previewRow(document))}>Preview</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => run(() => downloadRow(document))}><Download className="size-3.5" /> Download</Button>
                  <Button type="button" size="sm" variant="outline" aria-expanded={shareFor === document.id} onClick={() => setShareFor((current) => current === document.id ? null : document.id)}><Share2 className="size-3.5" /> Share</Button>
                  {shareFor === document.id ? (
                    <div className="flex w-full flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/20 p-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => run(() => shareRow(document, 'whatsapp'))}><MessageCircle className="size-3.5" /> WhatsApp</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => run(() => shareRow(document, 'email'))}><Mail className="size-3.5" /> Email</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => run(() => shareRow(document, 'other'))}>Other app</Button>
                      <p className="w-full text-xs text-muted-foreground">The file is sent only if your browser opens a share window. Otherwise it is downloaded so you can attach it.</p>
                    </div>
                  ) : null}
                  <Button type="button" size="sm" variant="outline" onClick={() => run(() => renameRow(document))}>Rename</Button>
                  <select aria-label={`Move ${document.name}`} className="h-9 rounded-full border border-white/10 bg-transparent px-2 text-xs" defaultValue="" onChange={(event) => { const value = event.target.value; event.target.value = ''; run(() => moveRows([document.id], value)) }}>
                    <option value="" disabled>Move</option>
                    {folders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  {mode === 'local' ? <Button type="button" size="sm" variant="outline" onClick={() => run(() => copyLocalToOnline(document))}>Copy online</Button> : null}
                  <select aria-label={`Open ${document.name} in a tool`} className="h-9 rounded-full border border-white/10 bg-transparent px-2 text-xs" defaultValue="" onChange={(event) => { const value = event.target.value; event.target.value = ''; if (value) run(() => openInTool(document, value)) }}>
                    <option value="" disabled>Open copy in tool</option>
                    {tools.map(([href, label]) => <option key={href} value={href}>{label}</option>)}
                  </select>
                  <Button type="button" size="sm" variant="destructive" onClick={() => run(() => removeRow(document))}><Trash2 className="size-3.5" /> Delete</Button>
                  {mode === 'online' && showTrash ? <Button type="button" size="sm" variant="outline" onClick={() => run(async () => { await api(`/api/library/documents/${document.id}/restore`, { method: 'POST' }); setNotice('Restored.'); await refresh() })}>Restore</Button> : null}
                  {mode === 'online' && !showTrash ? <Button type="button" size="sm" variant="outline" onClick={() => setDetailsFor((current) => current === document.id ? null : document.id)}>Details</Button> : null}
                  {mode === 'online' && detailsFor === document.id ? <OnlineDetails row={document} onSaved={refresh} /> : null}
                </div>
              </article>
            )
          })}
        </div>
        {preview ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label={`Preview ${preview.name}`}>
            <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl border border-white/10 bg-[#101815] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="truncate font-semibold">{preview.name}</h2>
                <Button type="button" variant="outline" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null) }}>Close</Button>
              </div>
              {preview.mime.startsWith('image/') ? <img src={preview.url} alt="" className="max-h-[70vh] w-full object-contain" /> : <iframe title={preview.name} src={preview.url} className="h-[70vh] w-full rounded-2xl bg-white" />}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
