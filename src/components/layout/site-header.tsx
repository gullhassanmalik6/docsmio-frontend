import { Menu, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Logo } from '@/components/layout/logo'
import { Button } from '@/components/ui/button'
import { useAppMode } from '@/context/app-mode-context'
import { useAuth } from '@/context/auth-context'
import { filterTools } from '@/lib/tools'
import { cn } from '@/lib/utils'

const walletLinks = [
  { to: '/wallet', label: 'Dashboard', end: true },
  { to: '/documents', label: 'Documents', end: false },
  { to: '/reminders', label: 'Reminders', end: false },
  { to: '/sharing', label: 'Sharing', end: false },
  { to: '/settings', label: 'Settings', end: false },
]

const toolLinks = [
  { to: '/tools', label: 'Tools', end: true },
  { to: '/documents', label: 'Documents', end: false },
  { to: '/features', label: 'Features', end: false },
  { to: '/pricing', label: 'Pricing', end: false },
  { to: '/help', label: 'Help', end: false },
]

function navClass(active: boolean) {
  return cn(
    'rounded-full px-3 py-2 text-sm transition',
    active ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground',
  )
}

export function SiteHeader() {
  const auth = useAuth()
  const { mode, toggleMode } = useAppMode()
  const links = mode === 'wallet' ? walletLinks : toolLinks
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const results = useMemo(() => filterTools(query), [query])

  function closeSearch() {
    setSearchOpen(false)
    setQuery('')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b09]/80 backdrop-blur-xl">
      <a
        href="#main"
        className="absolute left-4 top-3 z-50 -translate-y-20 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:translate-y-0"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Logo />
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => navClass(isActive)}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            aria-label={mode === 'wallet' ? 'Switch to tools mode' : 'Switch to wallet mode'}
            onClick={toggleMode}
          >
            <span className="sm:hidden">{mode === 'wallet' ? 'Tools' : 'Wallet'}</span>
            <span className="hidden sm:inline">{mode === 'wallet' ? 'Tools mode' : 'Wallet mode'}</span>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Search tools" onClick={() => setSearchOpen(true)}>
            <Search className="size-4" />
          </Button>
          {auth.user ? (
            <>
              <span className="hidden max-w-32 truncate text-sm text-muted-foreground sm:inline">{auth.user.name}</span>
              <Button variant="outline" size="sm" className="hidden sm:inline-flex" type="button" onClick={() => void auth.logout()}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="hidden sm:inline-flex" asChild>
                <Link to="/login">Login</Link>
              </Button>
              <Button size="sm" className="hidden sm:inline-flex" asChild>
                <Link to="/signup">Sign Up</Link>
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Menu className="size-5" />
          </Button>
        </div>
      </div>

      {searchOpen ? (
        <div className="fixed inset-0 z-50 bg-black/70" role="presentation" onClick={closeSearch}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search tools"
            className="mx-auto mt-20 w-[min(560px,calc(100%-2rem))] rounded-2xl border border-white/10 bg-[#0e1613] p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Search className="size-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tools, for example compress or merge"
                aria-label="Search tools"
                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button type="button" aria-label="Close search" onClick={closeSearch} className="grid size-8 place-items-center rounded-full hover:bg-white/10">
                <X className="size-4" />
              </button>
            </div>
            <ul className="mt-3 max-h-80 space-y-1 overflow-auto">
              {results.length === 0 ? (
                <li className="px-2 py-6 text-sm text-muted-foreground">No tools match that search.</li>
              ) : (
                results.map((tool) => (
                  <li key={tool.slug}>
                    <Link
                      to={tool.href}
                      onClick={closeSearch}
                      className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-white/5"
                    >
                      <span>
                        <span className="block text-sm font-medium">{tool.title}</span>
                        <span className="block text-xs text-muted-foreground">{tool.description}</span>
                      </span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}

      {menuOpen ? (
        <div className="fixed inset-0 z-50 bg-black/70 md:hidden" role="presentation" onClick={() => setMenuOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mobile menu"
            className="ml-auto flex h-full w-[min(100%,20rem)] flex-col border-l border-white/10 bg-[#0c1411] p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <Logo />
              <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="grid size-10 place-items-center rounded-full hover:bg-white/10">
                <X className="size-5" />
              </button>
            </div>
            <nav className="mt-8 flex flex-col gap-1" aria-label="Mobile">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => cn(navClass(isActive), 'px-3 py-3')}
                >
                  {link.label}
                </NavLink>
              ))}
              <Link to="/files" onClick={() => setMenuOpen(false)} className="rounded-full px-3 py-3 text-sm text-muted-foreground hover:text-foreground">
                My Files
              </Link>
            </nav>
            <div className="mt-auto grid gap-2">
              {auth.user ? (
                <Button type="button" variant="outline" onClick={() => { setMenuOpen(false); void auth.logout() }}>
                  Logout
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild>
                    <Link to="/login" onClick={() => setMenuOpen(false)}>
                      Login
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link to="/signup" onClick={() => setMenuOpen(false)}>
                      Sign Up
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}
