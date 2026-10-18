import { FileCheck2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('inline-flex items-center gap-2.5 font-semibold tracking-tight', className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_22px_rgba(34,197,94,0.45)]">
        <FileCheck2 className="size-5" />
      </span>
      <span className="text-lg">DocuFix</span>
    </Link>
  )
}
