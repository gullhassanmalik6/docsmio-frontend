import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/auth-context'
import { usePageTitle } from '@/hooks/use-browser'
import { api, type OnlineDocument } from '@/lib/api'

type ShareItem = {
  id: string
  document_id: string
  expires_at: string
  revoked_at: string | null
  permission: string
  password_protected: boolean
}

type CreatedShare = ShareItem & { token: string }

export function SharingPage() {
  usePageTitle('Sharing — Docsmio')
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [documentId, setDocumentId] = useState('')
  const [hours, setHours] = useState(24)
  const [permission, setPermission] = useState('download')
  const [password, setPassword] = useState('')
  const [created, setCreated] = useState<CreatedShare | null>(null)
  const [error, setError] = useState('')
  const documents = useQuery({
    queryKey: ['share-documents'],
    enabled: Boolean(auth.user),
    queryFn: () => api<OnlineDocument[]>('/api/library/documents?limit=100'),
  })
  const shares = useQuery({
    queryKey: ['shares'],
    enabled: Boolean(auth.user),
    queryFn: () => api<ShareItem[]>('/api/library/shares'),
  })

  if (!auth.user) {
    return <div className="mx-auto max-w-lg px-4 py-16"><h1 className="text-3xl font-semibold">Sign in to manage share links</h1><Button asChild className="mt-4"><Link to="/login">Sign in</Link></Button></div>
  }

  async function createLink() {
    setError('')
    const result = await api<CreatedShare>(`/api/library/documents/${documentId}/shares`, {
      method: 'POST',
      body: JSON.stringify({ hours, permission, password: password || null }),
    })
    setCreated(result)
    setPassword('')
    await queryClient.invalidateQueries({ queryKey: ['shares'] })
  }

  const link = created ? `${window.location.origin}/api/shared/${created.token}` : ''

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Sharing</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Documents stay private until you create a link. A person who opens it can save a copy. Revoking the link stops new access. It does not delete copies they already saved. This is not a Google Drive or Gmail connection.</p>
      <form className="mt-6 grid gap-3 rounded-3xl border border-white/10 bg-card p-4" onSubmit={(event) => { event.preventDefault(); void createLink().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'The link could not be created.')) }}>
        <div>
          <Label htmlFor="share-document">Document</Label>
          <select id="share-document" className="mt-1.5 h-11 w-full rounded-full border border-white/10 bg-transparent px-3 text-sm" value={documentId} onChange={(event) => setDocumentId(event.target.value)} required>
            <option value="">Choose a document</option>
            {(documents.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.filename}</option>)}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="share-hours">Expires in hours</Label>
            <Input id="share-hours" className="mt-1.5" type="number" min={1} max={720} value={hours} onChange={(event) => setHours(Number(event.target.value))} />
          </div>
          <div>
            <Label htmlFor="share-permission">Permission</Label>
            <select id="share-permission" className="mt-1.5 h-11 w-full rounded-full border border-white/10 bg-transparent px-3 text-sm" value={permission} onChange={(event) => setPermission(event.target.value)}>
              <option value="download">Download</option>
              <option value="view">View in the browser</option>
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="share-password">Optional password</Label>
          <Input id="share-password" className="mt-1.5" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Leave blank for no password" />
        </div>
        <Button type="submit" disabled={!documentId}>Create link</Button>
      </form>
      {error ? <p className="mt-4 text-sm text-red-200" role="alert">{error}</p> : null}
      {created ? (
        <div className="mt-4 rounded-3xl border border-primary/30 bg-primary/10 p-4">
          <p className="text-sm font-medium">Copy this link now. It will not be shown again.</p>
          <p className="mt-2 break-all text-sm">{link}</p>
          <Button type="button" className="mt-3" size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(link)}>Copy link</Button>
        </div>
      ) : null}
      <h2 className="mt-8 font-semibold">Active and past links</h2>
      <ul className="mt-3 space-y-2">
        {(shares.data ?? []).map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 px-3 py-3 text-sm">
            <span>{item.permission} · {item.password_protected ? 'Password' : 'No password'} · {item.revoked_at ? 'Revoked' : `Expires ${new Date(item.expires_at).toLocaleString()}`}</span>
            {item.revoked_at ? null : <Button type="button" size="sm" variant="destructive" onClick={() => void api(`/api/library/shares/${item.id}`, { method: 'DELETE' }).then(() => queryClient.invalidateQueries({ queryKey: ['shares'] }))}>Revoke</Button>}
          </li>
        ))}
      </ul>
      {shares.data && shares.data.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No share links yet.</p> : null}
    </div>
  )
}
