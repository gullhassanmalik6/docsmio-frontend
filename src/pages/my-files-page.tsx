import { Download, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Notice } from '@/components/notice'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'
import { useHistory } from '@/context/history-context'
import { usePageTitle } from '@/hooks/use-browser'
import { api, ApiError, type HistoryPage } from '@/lib/api'
import { formatBytes, formatDate } from '@/lib/format'
import { fieldClass } from '@/lib/utils'

type KindFilter = 'all' | 'image' | 'pdf'
type StatusFilter = 'all' | 'ready'

export function MyFilesPage() {
  usePageTitle('My Files — Docsmio')
  const history = useHistory()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<KindFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)
  const [accountOperation, setAccountOperation] = useState('all')
  const [accountStatus, setAccountStatus] = useState('all')
  const [accountPage, setAccountPage] = useState(1)

  const accountHistory = useQuery({
    queryKey: ['server-history', accountOperation, accountStatus, accountPage],
    enabled: Boolean(auth.user),
    queryFn: () => {
      const params = new URLSearchParams({ page: String(accountPage), page_size: '10' })
      if (accountOperation !== 'all') params.set('operation_type', accountOperation)
      if (accountStatus !== 'all') params.set('status', accountStatus)
      return api<HistoryPage>(`/api/history?${params.toString()}`)
    },
  })
  const removeAccountRecord = useMutation({
    mutationFn: (id: string) => api<void>(`/api/history/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['server-history'] }),
  })

  const visible = useMemo(
    () =>
      history.items.filter((item) => {
        const matchesQuery = item.name.toLowerCase().includes(query.trim().toLowerCase())
        const matchesKind = kind === 'all' || item.kind === kind
        const matchesStatus = status === 'all' || item.status === status
        return matchesQuery && matchesKind && matchesStatus
      }),
    [history.items, query, kind, status],
  )

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">My Files</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Downloads below were created in this browser. Account history, when you are signed in, stores only the filename, operation, and sizes.</p>
      <section className="mt-6 rounded-3xl border border-white/10 bg-card p-4">
        <h2 className="text-lg font-semibold">Account history</h2>
        {!auth.ready ? <p className="mt-3 text-sm text-muted-foreground">Checking your session…</p> : null}
        {auth.ready && !auth.user ? (
          <div className="mt-3">
            <Notice tone="info">
              Sign in to see history saved to your account.{' '}
              <Link to="/login" className="font-semibold text-emerald-200 underline">Login</Link>
            </Notice>
          </div>
        ) : null}
        {auth.user ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              {auth.user.name} · {auth.user.plan} plan · up to {auth.user.history_limit} records. These rows are not downloadable files.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select aria-label="Filter account history by operation" className={fieldClass} value={accountOperation} onChange={(event) => { setAccountOperation(event.target.value); setAccountPage(1) }}>
                <option value="all">All operations</option>
                <option value="image-resize">Image resize</option>
                <option value="compress-pdf">Compress PDF</option>
                <option value="merge-pdf">Merge PDF</option>
                <option value="split-pdf">Split PDF</option>
                <option value="image-to-pdf">Image to PDF</option>
                <option value="jpg-to-pdf">JPG to PDF</option>
                <option value="convert">Convert</option>
                <option value="watermark">Watermark</option>
                <option value="scan">Scan</option>
              </select>
              <select aria-label="Filter account history by status" className={fieldClass} value={accountStatus} onChange={(event) => { setAccountStatus(event.target.value); setAccountPage(1) }}>
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            {accountHistory.isLoading ? <p className="text-sm text-muted-foreground">Loading account history…</p> : null}
            {accountHistory.error ? <Notice tone="error">{accountHistory.error instanceof ApiError ? accountHistory.error.message : 'Account history could not be loaded.'}</Notice> : null}
            {accountHistory.data && accountHistory.data.items.length === 0 ? <p className="text-sm text-muted-foreground">No account history matches this filter.</p> : null}
            {accountHistory.data && accountHistory.data.items.length > 0 ? (
              <ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
                {accountHistory.data.items.map((item) => (
                  <li key={item.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.original_filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.operation_type} · {item.status} · original {formatBytes(item.original_size)}
                        {item.output_size !== null ? ` · output ${formatBytes(item.output_size)}` : ''} · {formatDate(Date.parse(item.created_at))}
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="destructive" disabled={removeAccountRecord.isPending} onClick={() => removeAccountRecord.mutate(item.id)}>
                      Delete record
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            {accountHistory.data && accountHistory.data.total > accountHistory.data.page_size ? (
              <div className="flex items-center justify-between text-sm">
                <Button type="button" variant="outline" size="sm" disabled={accountPage <= 1} onClick={() => setAccountPage((page) => page - 1)}>Previous</Button>
                <span className="text-muted-foreground">Page {accountHistory.data.page}</span>
                <Button type="button" variant="outline" size="sm" disabled={accountPage * accountHistory.data.page_size >= accountHistory.data.total} onClick={() => setAccountPage((page) => page + 1)}>Next</Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      {!history.persistent && history.ready ? (
        <div className="mt-4">
          <Notice tone="warning">This browser did not allow saved history. Files from this visit disappear when you refresh.</Notice>
        </div>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search files" placeholder="Search files" className={fieldClass + ' pl-10'} />
        </label>
        <select aria-label="Filter by type" className={fieldClass + ' sm:w-40'} value={kind} onChange={(event) => setKind(event.target.value as KindFilter)}>
          <option value="all">All types</option>
          <option value="image">Images</option>
          <option value="pdf">PDFs</option>
        </select>
        <select aria-label="Filter by status" className={fieldClass + ' sm:w-40'} value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
          <option value="all">All statuses</option>
          <option value="ready">Ready</option>
        </select>
      </div>
      {!history.ready ? <p className="mt-8 text-sm text-muted-foreground">Loading files saved in this browser…</p> : null}
      {history.ready && history.items.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-white/15 px-6 py-14 text-center">
          <h2 className="text-xl font-semibold">No processed files yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">When you resize an image or export a PDF, it shows up here for download. This list starts empty on purpose.</p>
          <Button className="mt-5" asChild>
            <Link to="/tools">Go to tools</Link>
          </Button>
        </div>
      ) : null}
      {history.ready && history.items.length > 0 && visible.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-white/10 bg-card px-4 py-8 text-center text-sm text-muted-foreground">No saved files match that search or filter.</p>
      ) : null}
      {visible.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.tool}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{item.kind}</td>
                  <td className="px-4 py-3">{formatBytes(item.size)}</td>
                  <td className="px-4 py-3">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3 text-emerald-200">Ready</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => void history.download(item.id)}>
                        <Download className="size-3.5" />
                        Download
                      </Button>
                      {pendingRemove === item.id ? (
                        <Button type="button" size="sm" variant="destructive" onClick={() => { void history.remove(item.id); setPendingRemove(null) }}>
                          Confirm remove
                        </Button>
                      ) : (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setPendingRemove(item.id)}>
                          <Trash2 className="size-3.5" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {history.items.length > 0 ? (
        <Button type="button" variant="outline" className="mt-4" onClick={() => void history.clear()}>
          Remove all files from this browser
        </Button>
      ) : null}
    </div>
  )
}
