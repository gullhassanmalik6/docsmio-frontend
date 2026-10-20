import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'
import { usePageTitle } from '@/hooks/use-browser'
import { api, type AccountUser, type LibrarySearchPage, type OnlineFolder } from '@/lib/api'
import { formatBytes } from '@/lib/format'

type ReminderItem = {
  id: string
  title: string
  bucket: string
  due_at: string
  status: string
}

const bucketLabel: Record<string, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  upcoming: 'Upcoming',
  completed: 'Completed',
  dismissed: 'Dismissed',
  cancelled: 'Cancelled',
}

export function WalletPage() {
  usePageTitle('Wallet — Docsmio')
  const auth = useAuth()
  const account = useQuery({
    queryKey: ['wallet-account'],
    enabled: Boolean(auth.user),
    queryFn: () => api<AccountUser>('/api/auth/me'),
  })
  const documents = useQuery({
    queryKey: ['wallet-documents'],
    enabled: Boolean(auth.user),
    queryFn: () => api<LibrarySearchPage>('/api/library/search?page_size=5'),
  })
  const folders = useQuery({
    queryKey: ['wallet-folders'],
    enabled: Boolean(auth.user),
    queryFn: () => api<OnlineFolder[]>('/api/library/folders'),
  })
  const reminders = useQuery({
    queryKey: ['wallet-reminders'],
    enabled: Boolean(auth.user),
    queryFn: () => api<ReminderItem[]>('/api/reminders'),
  })

  if (!auth.ready) return <p className="px-4 py-16 text-center text-sm text-muted-foreground">Loading your account…</p>
  if (!auth.user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-3xl font-semibold">Document wallet</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in to store documents, folders, reminders, and share links on your account. The local library and the PDF tools still work in this browser without an account.</p>
        <div className="mt-6 flex gap-3">
          <Button asChild><Link to="/login">Sign in</Link></Button>
          <Button variant="outline" asChild><Link to="/signup">Create account</Link></Button>
        </div>
      </div>
    )
  }

  const profile = account.data
  const upcoming = (reminders.data ?? []).filter((item) => item.status === 'active').slice(0, 4)
  const used = profile?.storage_used_bytes ?? 0
  const quota = profile?.storage_quota_bytes ?? 0

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Wallet</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Hello, {auth.user.name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Your documents stay private until you share one. Filename and text suggestions are keyword and extraction matches, not an external AI service.</p>
        </div>
        <Button asChild><Link to="/documents">Add a document</Link></Button>
      </div>
      {!profile?.onboarding_completed ? (
        <div className="mt-6 rounded-3xl border border-primary/30 bg-primary/10 p-4">
          <p className="font-medium">Choose a starting set of folders, or skip it.</p>
          <p className="mt-1 text-sm text-muted-foreground">This only suggests folders. It does not limit what you can store.</p>
          <Button asChild className="mt-3" size="sm"><Link to="/onboarding">Set up folders</Link></Button>
        </div>
      ) : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-3xl border border-white/10 bg-card p-4">
          <p className="text-xs text-muted-foreground">Documents</p>
          <p className="mt-2 text-2xl font-semibold">{documents.data?.total ?? '—'}</p>
        </article>
        <article className="rounded-3xl border border-white/10 bg-card p-4">
          <p className="text-xs text-muted-foreground">Folders</p>
          <p className="mt-2 text-2xl font-semibold">{folders.data?.length ?? '—'}</p>
        </article>
        <article className="rounded-3xl border border-white/10 bg-card p-4">
          <p className="text-xs text-muted-foreground">Storage</p>
          <p className="mt-2 text-2xl font-semibold">{formatBytes(used)}</p>
          <p className="text-xs text-muted-foreground">of {quota ? formatBytes(quota) : 'the plan limit'}</p>
        </article>
        <article className="rounded-3xl border border-white/10 bg-card p-4">
          <p className="text-xs text-muted-foreground">Active reminders</p>
          <p className="mt-2 text-2xl font-semibold">{(reminders.data ?? []).filter((item) => item.status === 'active').length}</p>
        </article>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-card p-4">
          <h2 className="font-semibold">Recent documents</h2>
          {documents.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading documents…</p> : null}
          {documents.data && documents.data.items.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No online documents yet. Import a PDF or image and confirm the folder before it is stored.</p>
          ) : null}
          <ul className="mt-3 space-y-2">
            {(documents.data?.items ?? []).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2 text-sm">
                <span className="truncate">{item.filename}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{item.text_status === 'ready' ? 'Text indexed' : item.text_status === 'pending' ? 'Text not read yet' : 'Text unavailable'}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-3xl border border-white/10 bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Reminders</h2>
            <Link className="text-sm text-primary" to="/reminders">Open reminders</Link>
          </div>
          {upcoming.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No active reminders. Add an expiry date or a deadline when you want a nudge.</p> : null}
          <ul className="mt-3 space-y-2">
            {upcoming.map((item) => (
              <li key={item.id} className="rounded-2xl bg-white/5 px-3 py-2 text-sm">
                <span className="font-medium">{bucketLabel[item.bucket] ?? item.bucket}</span>
                <span className="mt-1 block">{item.title}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
