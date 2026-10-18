import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const fieldClass =
  'h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/70 focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50'
