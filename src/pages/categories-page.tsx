import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/auth-context'
import { usePageTitle } from '@/hooks/use-browser'
import { api } from '@/lib/api'

type CategoryResponse = {
  suggested: string[]
  custom: { id: string; name: string }[]
}

export function CategoriesPage() {
  usePageTitle('Categories — Docsmio')
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const categories = useQuery({
    queryKey: ['categories'],
    enabled: Boolean(auth.user),
    queryFn: () => api<CategoryResponse>('/api/library/categories'),
  })

  if (!auth.user) {
    return <div className="mx-auto max-w-lg px-4 py-16"><h1 className="text-3xl font-semibold">Sign in to manage categories</h1><Button asChild className="mt-4"><Link to="/login">Sign in</Link></Button></div>
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Categories</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Categories are labels. They do not block an upload. A suggestion comes from the file name or extracted text. It stays a suggestion until you confirm or change it on the document. Removing a custom label does not delete the documents that use it.</p>
      <h2 className="mt-6 text-sm font-semibold">Suggested names</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {(categories.data?.suggested ?? []).map((item) => <li key={item} className="rounded-full border border-white/10 px-3 py-1 text-sm">{item}</li>)}
      </ul>
      <form className="mt-6 flex gap-2" onSubmit={(event) => {
        event.preventDefault()
        setError('')
        void api('/api/library/categories', { method: 'POST', body: JSON.stringify({ name }) })
          .then(() => {
            setName('')
            return queryClient.invalidateQueries({ queryKey: ['categories'] })
          })
          .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'The category could not be saved.'))
      }}>
        <Input aria-label="Custom category name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Custom category" />
        <Button type="submit">Add</Button>
      </form>
      {error ? <p className="mt-3 text-sm text-red-200" role="alert">{error}</p> : null}
      <ul className="mt-4 space-y-2">
        {(categories.data?.custom ?? []).map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded-2xl border border-white/10 px-3 py-2 text-sm">
            <span>{item.name}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void api(`/api/library/categories/${item.id}`, { method: 'DELETE' }).then(() => queryClient.invalidateQueries({ queryKey: ['categories'] }))}>Remove label</Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
