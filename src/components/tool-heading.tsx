import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function ToolHeading({
  title,
  description,
  trail,
}: {
  title: string
  description: string
  trail?: string
}) {
  return (
    <header className="mb-6">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="size-3.5" />
        <Link to="/tools" className="hover:text-foreground">
          Tools
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">{trail ?? title}</span>
      </nav>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
    </header>
  )
}

export function ToolFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>
}
