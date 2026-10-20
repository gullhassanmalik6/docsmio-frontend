import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'
import { usePageTitle } from '@/hooks/use-browser'
import { api, type AccountUser } from '@/lib/api'

const audiences = [
  ['secondary_student', 'Intermediate or high-school student'],
  ['university_applicant', 'University applicant'],
  ['university_student', 'University student'],
  ['graduate', 'Graduate or job seeker'],
  ['international', 'International student or expatriate'],
  ['family', 'Family or personal use'],
  ['other', 'Other'],
] as const

export function OnboardingPage() {
  usePageTitle('Set up folders — Docsmio')
  const auth = useAuth()
  const navigate = useNavigate()
  const [audience, setAudience] = useState<(typeof audiences)[number][0]>('other')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  async function submit(skip: boolean) {
    setPending(true)
    setError('')
    try {
      await api<AccountUser>('/api/account/onboarding', {
        method: 'POST',
        body: JSON.stringify({ audience: skip ? null : audience, timezone_name: timezone, skip }),
      })
      navigate('/wallet')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Setup could not be saved.')
    } finally {
      setPending(false)
    }
  }

  if (!auth.user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-3xl font-semibold">Sign in to set up folders</h1>
        <Button asChild className="mt-4"><Link to="/login">Sign in</Link></Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">How should we suggest folders?</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Pick a starting point if you want one. You can rename, reorder, and delete those folders later. Docsmio does not ask for a school ID, passport number, or other document numbers here.</p>
      <fieldset className="mt-6 space-y-2">
        <legend className="text-sm font-medium">Profile</legend>
        {audiences.map(([value, label]) => (
          <label key={value} className="flex min-h-11 items-center gap-3 rounded-2xl border border-white/10 px-3 py-2 text-sm">
            <input type="radio" name="audience" value={value} checked={audience === value} onChange={() => setAudience(value)} />
            {label}
          </label>
        ))}
      </fieldset>
      <p className="mt-4 text-sm text-muted-foreground">Time zone detected for reminders: {timezone}. Documents stay private. Sharing is a separate step. Billing is not connected.</p>
      {error ? <p className="mt-4 text-sm text-red-200" role="alert">{error}</p> : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" disabled={pending} onClick={() => void submit(false)}>{pending ? 'Saving…' : 'Create suggested folders'}</Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => void submit(true)}>Skip</Button>
      </div>
    </div>
  )
}
