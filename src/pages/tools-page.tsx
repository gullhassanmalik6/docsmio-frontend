import { Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { ToolCard } from '@/components/tool-card'
import { usePageTitle } from '@/hooks/use-browser'
import { categoryFilters, filterTools, isCategoryFilter, type CategoryFilter } from '@/lib/tools'
import { cn, fieldClass } from '@/lib/utils'
import { Link } from 'react-router-dom'

export function ToolsPage() {
  usePageTitle('Tools — Docsmio')
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const categoryParam = params.get('category')
  const category: CategoryFilter = isCategoryFilter(categoryParam) ? categoryParam : 'all'
  const visible = filterTools(query, category)

  function update(next: { q?: string; category?: CategoryFilter }) {
    const q = next.q ?? query
    const selected = next.category ?? category
    const following = new URLSearchParams()
    if (q.trim()) following.set('q', q)
    if (selected !== 'all') following.set('category', selected)
    setParams(following, { replace: true })
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold tracking-[0.16em] text-emerald-300">TOOLS</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Our Document Tools</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Choose a tool to get started. Fast, easy, and clear about what it can and cannot do.{' '}
        <Link to="/tools/convert" className="text-primary">
          Open the format converter
        </Link>
        .
      </p>
      <label className="relative mt-8 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => update({ q: event.target.value })}
          placeholder="Search tools (e.g. compress PDF, resize image…)"
          aria-label="Search tools"
          className={cn(fieldClass, 'pl-10')}
        />
      </label>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Tool categories">
        {categoryFilters.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={category === item.id}
            onClick={() => update({ category: item.id })}
            className={cn(
              'shrink-0 rounded-full border px-4 py-2 text-sm',
              category === item.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-white/10 bg-white/5 text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-white/10 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No tools match that search. Try “compress”, “merge”, or clear the filter.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {visible.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      )}
    </div>
  )
}
