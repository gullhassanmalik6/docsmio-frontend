import { Link } from 'react-router-dom'
import { accentClasses, type ToolDefinition } from '@/lib/tools'
import { cn } from '@/lib/utils'

const statusLabel = {
  ready: null,
  preview: 'Preview only',
  unavailable: 'Not available yet',
}

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  const Icon = tool.icon
  const badge = statusLabel[tool.status]
  return (
    <Link
      to={tool.href}
      data-testid={`tool-card-${tool.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-white/10 bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_16px_40px_rgba(34,197,94,0.08)]"
    >
      <span className={cn('grid size-11 place-items-center rounded-xl', accentClasses[tool.accent])}>
        <Icon className="size-5" />
      </span>
      <span className="mt-4 font-semibold">{tool.title}</span>
      <span className="mt-1 flex-1 text-sm leading-6 text-muted-foreground">{tool.description}</span>
      {badge ? <span className="mt-3 text-xs font-medium text-amber-200">{badge}</span> : null}
    </Link>
  )
}
