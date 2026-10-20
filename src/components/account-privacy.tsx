import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/auth-context'
import { api, type AccountUser } from '@/lib/api'
import { formatBytes } from '@/lib/format'

type SessionItem = {
  id: string
  created_at: string
  expires_at: string
  revoked_at: string | null
  current: boolean
}

export function AccountPrivacy() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const sessions = useQuery({
    queryKey: ['sessions'],
    enabled: Boolean(auth.user),
    queryFn: () => api<SessionItem[]>('/api/account/sessions'),
  })

  if (!auth.user) return null
  const user = auth.user

  async function savePreferences(partial: Record<string, unknown>) {
    setError('')
    const updated = await api<AccountUser>('/api/account/profile', { method: 'PATCH', body: JSON.stringify(partial) })
    queryClient.setQueryData(['account'], updated)
    setMessage('Preferences saved.')
  }

  async function downloadExport() {
    const payload = await api<unknown>('/api/account/export')
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'docsmio-export.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="mt-8 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Privacy and account</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Online files are private to this account. They are stored on the server so you can open them on another device, which means this is not end-to-end encryption. The server can read a file to preview it and to extract PDF text. Deleting the account removes the current database rows and stored files. If an operator keeps backups, those copies remain until that backup window ends.
        </p>
      </div>
      <div className="rounded-3xl border border-white/10 bg-card p-5 text-sm">
        <p>{user.email}</p>
        <p className="mt-1 text-muted-foreground">Plan: {user.plan}. Billing is not connected, so this page cannot upgrade the plan.</p>
        <p className="mt-1 text-muted-foreground">Storage: {formatBytes(user.storage_used_bytes)} of {formatBytes(user.storage_quota_bytes)}.</p>
        <p className="mt-1 text-muted-foreground">Email reminders are {user.notify_email ? 'on' : 'off'}. They are delivered only when the server has mail settings. In-app reminders are {user.notify_in_app ? 'on' : 'off'}.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void savePreferences({ notify_in_app: !user.notify_in_app }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not save.'))}>
            {user.notify_in_app ? 'Turn off in-app reminders' : 'Turn on in-app reminders'}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void savePreferences({ notify_email: !user.notify_email }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not save.'))}>
            {user.notify_email ? 'Turn off email reminders' : 'Turn on email reminders'}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void downloadExport()}>Export account data</Button>
        </div>
      </div>
      <form className="rounded-3xl border border-white/10 bg-card p-5" onSubmit={(event) => {
        event.preventDefault()
        void api('/api/account/password', { method: 'POST', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) })
          .then(() => {
            setCurrentPassword('')
            setNewPassword('')
            setMessage('Password changed. Other sessions were signed out.')
            return queryClient.invalidateQueries({ queryKey: ['sessions'] })
          })
          .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'The password was not changed.'))
      }}>
        <h3 className="font-semibold">Change password</h3>
        <p className="mt-1 text-sm text-muted-foreground">Password reset by email is not available unless the operator configures mail. There is no reset link that pretends to have been sent.</p>
        <Label className="mt-3 block" htmlFor="current-password">Current password</Label>
        <Input id="current-password" className="mt-1.5" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        <Label className="mt-3 block" htmlFor="new-password">New password</Label>
        <Input id="new-password" className="mt-1.5" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        <Button className="mt-3" type="submit">Update password</Button>
      </form>
      <div className="rounded-3xl border border-white/10 bg-card p-5">
        <h3 className="font-semibold">Sessions</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {(sessions.data ?? []).map((item) => (
            <li key={item.id}>{item.current ? 'This session' : 'Other session'} · {item.revoked_at ? 'Ended' : `Expires ${new Date(item.expires_at).toLocaleString()}`}</li>
          ))}
        </ul>
        <Button className="mt-3" type="button" size="sm" variant="outline" onClick={() => void api('/api/account/sessions/revoke-others', { method: 'POST' }).then(() => queryClient.invalidateQueries({ queryKey: ['sessions'] }))}>Sign out other sessions</Button>
      </div>
      <form className="rounded-3xl border border-red-400/30 bg-card p-5" onSubmit={(event) => {
        event.preventDefault()
        if (!window.confirm('Delete this account and its stored documents?')) return
        void api('/api/account', { method: 'DELETE', body: JSON.stringify({ password: deletePassword, confirm }) })
          .then(async () => {
            try {
              await auth.logout()
            } catch {
              queryClient.setQueryData(['account'], null)
            }
          })
          .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'The account was not deleted.'))
      }}>
        <h3 className="font-semibold">Delete account</h3>
        <p className="mt-1 text-sm text-muted-foreground">Type DELETE and your password. This removes the account, reminders, share links, and current stored files.</p>
        <Label className="mt-3 block" htmlFor="delete-password">Password</Label>
        <Input id="delete-password" className="mt-1.5" type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} />
        <Label className="mt-3 block" htmlFor="delete-confirm">Type DELETE</Label>
        <Input id="delete-confirm" className="mt-1.5" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        <Button className="mt-3" type="submit" variant="destructive">Delete account</Button>
      </form>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      {error ? <p role="alert" className="text-sm text-red-200">{error}</p> : null}
    </section>
  )
}
