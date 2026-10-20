import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/auth-context'
import { usePageTitle } from '@/hooks/use-browser'
import { api, type OnlineDocument } from '@/lib/api'

type ReminderItem = {
  id: string
  document_id: string | null
  title: string
  reminder_type: string
  due_at: string
  lead_days: number[]
  status: string
  bucket: string
}

const types = ['expiry', 'passport', 'visa', 'identity', 'certificate', 'scholarship', 'admission', 'renewal', 'custom']
const bucketLabel: Record<string, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  upcoming: 'Upcoming',
  completed: 'Completed',
  dismissed: 'Dismissed',
  cancelled: 'Cancelled',
}

function localInputToIso(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new Error('Enter a valid date and time.')
  return parsed.toISOString()
}

export function RemindersPage() {
  usePageTitle('Reminders — Docsmio')
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [type, setType] = useState('expiry')
  const [due, setDue] = useState('')
  const [documentId, setDocumentId] = useState('')
  const [leads, setLeads] = useState<number[]>([30, 7, 1])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const reminders = useQuery({
    queryKey: ['reminders'],
    enabled: Boolean(auth.user),
    queryFn: () => api<ReminderItem[]>('/api/reminders'),
  })
  const documents = useQuery({
    queryKey: ['reminder-documents'],
    enabled: Boolean(auth.user),
    queryFn: () => api<OnlineDocument[]>('/api/library/documents?limit=100'),
  })

  if (!auth.user) {
    return <div className="mx-auto max-w-lg px-4 py-16"><h1 className="text-3xl font-semibold">Sign in to use reminders</h1><Button asChild className="mt-4"><Link to="/login">Sign in</Link></Button></div>
  }

  async function createReminder() {
    setError('')
    await api('/api/reminders', {
      method: 'POST',
      body: JSON.stringify({
        title,
        reminder_type: type,
        due_at: localInputToIso(due),
        document_id: documentId || null,
        lead_days: leads,
        timezone_name: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      }),
    })
    setTitle('')
    setDue('')
    setNotice('Reminder saved. In-app notices are created by the API even if this page is closed. Email is sent only when the server has mail settings.')
    await queryClient.invalidateQueries({ queryKey: ['reminders'] })
  }

  async function act(id: string, action: string) {
    await api(`/api/reminders/${id}/${action}`, { method: 'POST' })
    await queryClient.invalidateQueries({ queryKey: ['reminders'] })
  }

  function toggleLead(day: number) {
    setLeads((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort((a, b) => b - a)))
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Reminders</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Use these for expiries and deadlines you care about. A suggested date from a document is not confirmed until you save it yourself. Delivery depends on the API process and, for email, on mail settings. The app cannot guarantee that a phone or inbox will show it.</p>
      <form className="mt-6 grid gap-3 rounded-3xl border border-white/10 bg-card p-4" onSubmit={(event) => { event.preventDefault(); void createReminder().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'The reminder could not be saved.')) }}>
        <div>
          <Label htmlFor="reminder-title">Title</Label>
          <Input id="reminder-title" className="mt-1.5" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="reminder-type">Type</Label>
            <select id="reminder-type" className="mt-1.5 h-11 w-full rounded-full border border-white/10 bg-transparent px-3 text-sm" value={type} onChange={(event) => setType(event.target.value)}>
              {types.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="reminder-due">Due date and time</Label>
            <Input id="reminder-due" className="mt-1.5" type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} required />
          </div>
        </div>
        <div>
          <Label htmlFor="reminder-document">Linked document</Label>
          <select id="reminder-document" className="mt-1.5 h-11 w-full rounded-full border border-white/10 bg-transparent px-3 text-sm" value={documentId} onChange={(event) => setDocumentId(event.target.value)}>
            <option value="">No document</option>
            {(documents.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.filename}</option>)}
          </select>
        </div>
        <fieldset>
          <legend className="text-sm">Remind me before</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {[90, 30, 7, 1, 0].map((day) => (
              <label key={day} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={leads.includes(day)} onChange={() => toggleLead(day)} />
                {day === 0 ? 'On the day' : `${day} days before`}
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit">Save reminder</Button>
      </form>
      {error ? <p className="mt-4 text-sm text-red-200" role="alert">{error}</p> : null}
      {notice ? <p className="mt-4 text-sm" role="status">{notice}</p> : null}
      <ul className="mt-6 space-y-3">
        {(reminders.data ?? []).map((item) => (
          <li key={item.id} className="rounded-3xl border border-white/10 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{bucketLabel[item.bucket] ?? item.status}</p>
            <h2 className="mt-1 font-semibold">{item.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{item.reminder_type} · {new Date(item.due_at).toLocaleString()} · {item.lead_days.join(', ')} day offsets</p>
            {item.status === 'active' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void act(item.id, 'complete')}>Mark complete</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void act(item.id, 'dismiss')}>Dismiss</Button>
                <Button type="button" size="sm" variant="destructive" onClick={() => void api(`/api/reminders/${item.id}`, { method: 'DELETE' }).then(() => queryClient.invalidateQueries({ queryKey: ['reminders'] }))}>Delete</Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {reminders.data && reminders.data.length === 0 ? <p className="mt-6 text-sm text-muted-foreground">No reminders yet.</p> : null}
    </div>
  )
}
