import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const tones = {
  info: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
  success: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-50',
  warning: 'border-amber-400/30 bg-amber-400/10 text-amber-50',
  error: 'border-red-400/30 bg-red-400/10 text-red-50',
}

export function Notice({
  tone,
  children,
  className,
}: {
  tone: keyof typeof tones
  children: ReactNode
  className?: string
}) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-2xl border px-4 py-3 text-sm leading-6', tones[tone], className)}>
      {children}
    </div>
  )
}
