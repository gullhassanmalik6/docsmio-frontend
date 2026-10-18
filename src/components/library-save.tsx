import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'
import { api, uploadLibraryDocument, type OnlineFolder } from '@/lib/api'
import { classifyFileName } from '@/lib/library-rules'
import { ensureLibraryFolders, importDocument } from '@/lib/library-store'

type LibrarySaveActionsProps = {
  blob: Blob | null
  filename: string
  mime: string
}

export function LibrarySaveActions({ blob, filename, mime }: LibrarySaveActionsProps) {
  const auth = useAuth()
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<'local' | 'online' | null>(null)

  async function saveLocal() {
    if (!blob || pending) return
    setPending('local')
    setMessage('')
    try {
      const folders = await ensureLibraryFolders()
      const suggestion = classifyFileName(filename)
      const folder = folders.find((item) => item.systemKey === suggestion.folderKey) ?? folders.find((item) => item.systemKey === 'uncategorized')
      if (!folder) throw new Error('The local library has no folders yet.')
      const file = new File([blob], filename, { type: mime || blob.type })
      await importDocument({ file, folderId: folder.id, classification: suggestion })
      setMessage(`Saved a copy to ${folder.name} in this browser. The file you just processed is unchanged.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The copy could not be saved in this browser.')
    } finally {
      setPending(null)
    }
  }

  async function copyOnline() {
    if (!blob || pending) return
    if (!auth.user) {
      setMessage('Sign in before copying a file to the online library. This does not happen automatically.')
      return
    }
    setPending('online')
    setMessage('')
    try {
      const folders = await api<OnlineFolder[]>('/api/library/folders')
      const suggestion = classifyFileName(filename)
      const folder = folders.find((item) => item.system_key === suggestion.folderKey) ?? folders.find((item) => item.system_key === 'uncategorized')
      if (!folder) throw new Error('The online library has no folders yet.')
      await uploadLibraryDocument(blob, filename, folder.id, suggestion.folderKey)
      setMessage(`Copied to ${folder.name} in your online library. The local result was not deleted.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The online copy failed.')
    } finally {
      setPending(null)
    }
  }

  if (!blob) return null

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending !== null} onClick={() => void saveLocal()}>
          {pending === 'local' ? 'Saving…' : 'Save copy locally'}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={pending !== null} onClick={() => void copyOnline()}>
          {pending === 'online' ? 'Uploading…' : 'Copy to online library'}
        </Button>
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      {!auth.user ? (
        <p className="text-xs text-muted-foreground">
          Online copy needs an account. <Link to="/login" className="text-primary">Sign in</Link>
        </p>
      ) : null}
    </div>
  )
}
