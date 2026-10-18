import type { InputHTMLAttributes } from 'react'
import { cn, fieldClass } from '@/lib/utils'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />
}
