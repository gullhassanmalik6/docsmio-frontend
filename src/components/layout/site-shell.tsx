import { Component, Suspense, useEffect, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { Button } from '@/components/ui/button'

class PageErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null }

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : 'This page could not be shown.' }
  }

  render() {
    if (!this.state.message) return this.props.children
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">This page hit a problem</p>
        <p className="mt-2 text-sm text-muted-foreground">{this.state.message}</p>
        <Button type="button" className="mt-4" onClick={() => this.setState({ message: null })}>
          Try again
        </Button>
      </div>
    )
  }
}

function ScrollToTop() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname, search])
  return null
}

export function SiteShell() {
  const { pathname, search } = useLocation()
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <SiteHeader />
      <main id="main" className="flex-1">
        <PageErrorBoundary key={`${pathname}${search}`}>
          <Suspense fallback={<div className="px-4 py-24 text-center text-sm text-muted-foreground">Loading tool…</div>}>
            <Outlet />
          </Suspense>
        </PageErrorBoundary>
      </main>
      <SiteFooter />
    </div>
  )
}
