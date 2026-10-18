import { FolderOpen, LifeBuoy, Settings, Sparkles, Wrench } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'

const items = [
  { to: '/files', label: 'My Files', icon: FolderOpen },
  { to: '/tools', label: 'Tools', icon: Wrench },
  { to: '/pricing', label: 'Pricing', icon: Sparkles },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/help', label: 'Help & Support', icon: LifeBuoy },
]

export function WorkspaceShell() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[220px_1fr]">
      <aside className="h-fit rounded-2xl border border-white/10 bg-card p-3 lg:sticky lg:top-24">
        <p className="px-3 pb-2 text-xs font-semibold tracking-[0.16em] text-emerald-300/80">WORKSPACE</p>
        <nav aria-label="Workspace" className="flex gap-1 overflow-x-auto lg:flex-col">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm',
                  isActive ? 'bg-primary/15 text-emerald-200' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
