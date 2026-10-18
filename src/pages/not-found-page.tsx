import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/use-browser'

export function NotFoundPage() {
  usePageTitle('Page not found — DocuFix')
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="text-xs font-semibold tracking-[0.16em] text-emerald-300">404</p>
      <h1 className="mt-2 text-4xl font-semibold">That page is not in DocuFix</h1>
      <p className="mt-3 text-muted-foreground">The address may be mistyped. The tools directory lists everything that exists.</p>
      <Button className="mt-6" asChild>
        <Link to="/tools">Browse tools</Link>
      </Button>
    </div>
  )
}
