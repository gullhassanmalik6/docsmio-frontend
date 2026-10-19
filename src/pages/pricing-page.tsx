import { Check } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Notice } from '@/components/notice'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'
import { usePageTitle } from '@/hooks/use-browser'
import { cn } from '@/lib/utils'

const plans = [
  {
    name: 'Free',
    monthly: 0,
    points: ['Image resize and target-size compress', 'PDF merge, split, watermark, and compression', 'JPG, PNG, and WebP conversion', 'Files stay in this browser', 'No account required'],
    action: 'start' as const,
  },
  {
    name: 'Pro',
    monthly: 499,
    points: ['Planned higher file limits', 'Planned batch processing', 'Planned saved presets', 'Planned ad-free use if ads are added later'],
    action: 'later' as const,
    featured: true,
  },
  {
    name: 'Business',
    monthly: 1499,
    points: ['Everything in the Pro plan', 'Planned team file history', 'Planned priority server processing', 'Checkout is not connected'],
    action: 'later' as const,
  },
]

export function PricingPage() {
  usePageTitle('Pricing — Docsmio')
  const auth = useAuth()
  const [yearly, setYearly] = useState(false)
  const [notice, setNotice] = useState(false)
  const priceFor = (monthly: number) => (yearly ? Math.round(monthly * 0.7) : monthly)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold tracking-[0.16em] text-emerald-300">PRICING</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Simple Pricing for Everyone</h1>
        <p className="mt-3 text-muted-foreground">The free tools work today. Paid plans are listed so the offer is visible. Nothing is billed from this page.</p>
        <div className="mx-auto mt-6 inline-flex rounded-full border border-white/10 bg-black/30 p-1" role="group" aria-label="Billing period">
          <button type="button" onClick={() => setYearly(false)} className={cn('rounded-full px-4 py-2 text-sm', !yearly && 'bg-primary text-primary-foreground')} aria-pressed={!yearly}>
            Monthly
          </button>
          <button type="button" onClick={() => setYearly(true)} className={cn('rounded-full px-4 py-2 text-sm', yearly && 'bg-primary text-primary-foreground')} aria-pressed={yearly}>
            Yearly · Save 30%
          </button>
        </div>
      </div>
      <div className="mt-8">
        <Notice tone="info">
          {auth.user
            ? `This account is on the ${auth.user.plan} plan, stored by the server. Checkout is not connected, so this page cannot change that plan or take a payment.`
            : 'These prices are the planned offers in PKR. Checkout is not connected, so choosing Pro or Business does not start a subscription.'}
        </Notice>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.name} className={cn('rounded-3xl border bg-card p-6', plan.featured ? 'border-primary shadow-[0_0_40px_rgba(34,197,94,0.12)]' : 'border-white/10')}>
            <h2 className="text-lg font-semibold">{plan.name}</h2>
            <p className="mt-4 text-4xl font-semibold">
              PKR {priceFor(plan.monthly).toLocaleString()}
              <span className="text-base font-medium text-muted-foreground"> / month</span>
            </p>
            {yearly && plan.monthly > 0 ? <p className="mt-1 text-xs text-muted-foreground">Shown as a 30% yearly comparison. Billing is not available.</p> : null}
            <ul className="mt-6 space-y-3 text-sm">
              {plan.points.map((point) => (
                <li key={point} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            {plan.action === 'start' ? (
              <Button className="mt-6 w-full" asChild>
                <Link to="/tools">Get Started</Link>
              </Button>
            ) : (
              <Button className="mt-6 w-full" variant={plan.featured ? 'default' : 'outline'} type="button" onClick={() => setNotice(true)}>
                {plan.name === 'Pro' ? 'Upgrade to Pro' : 'Get Business Plan'}
              </Button>
            )}
          </article>
        ))}
      </div>
      {notice ? (
        <div className="mt-4">
          <Notice tone="warning">Payments are not connected. Paid plans cannot be purchased in this version. The free tools are ready to use.</Notice>
        </div>
      ) : null}
    </div>
  )
}
