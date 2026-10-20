import { ArrowRight, BadgeCheck, FolderOutput, Lock, ShieldCheck, SlidersHorizontal, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { HeroVisual } from '@/components/hero-visual'
import { ToolCard } from '@/components/tool-card'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/use-browser'
import { tools } from '@/lib/tools'

const checks = [
  'No account for the tools that are ready',
  'Original files stay untouched',
  'Works on phone, tablet, and desktop',
  'The export shows its real file size',
]

const highlights = [
  {
    icon: Lock,
    title: 'Private by default',
    copy: 'Ready tools read the file in this browser. Nothing is uploaded to make a resize, merge, split, or watermark.',
  },
  {
    icon: Zap,
    title: 'Fast processing',
    copy: 'Image and PDF work starts as soon as you drop a file. There is no queue and no account step.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Quality control',
    copy: 'Set a target size, dimensions, and quality. If the target cannot be reached, the page says so.',
  },
  {
    icon: FolderOutput,
    title: 'Simple exports',
    copy: 'Download a new file. My Files only lists outputs you actually created in this browser.',
  },
]

const steps = [
  { number: '01', title: 'Add a file', copy: 'Drop a JPG, PNG, WebP, or PDF. The original stays where it is.' },
  { number: '02', title: 'Set the result', copy: 'Choose a size, page range, order, or format. Unsupported conversions stay closed.' },
  { number: '03', title: 'Export a new file', copy: 'Download the output and check the size before you upload it anywhere else.' },
]

const formats = [
  { name: 'JPG', detail: 'Compress, resize, or place on a PDF page.' },
  { name: 'PNG', detail: 'Resize and export. Photos may need JPG to hit a small target.' },
  { name: 'WebP', detail: 'Convert to or from JPG and PNG in the browser.' },
  { name: 'PDF', detail: 'Compress, merge, split, watermark, or export selected pages as images.' },
]

export function HomePage() {
  usePageTitle('Docsmio — Document Wallet')
  const popular = tools.filter((tool) => tool.status === 'ready').slice(0, 6)

  return (
    <div>
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
        <div>
          <p className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-primary">
            DOCUMENT WALLET
          </p>
          <h1 className="mt-5 max-w-xl text-4xl font-semibold tracking-tight sm:text-6xl sm:leading-[1.05]">
            One secure place for <span className="text-primary">your documents</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Keep files, folders, and reminders in the wallet. Switch to tools when you want to resize, compress, merge, split, or scan. Those tools still run in this browser.
          </p>
          <ul className="mt-6 space-y-2">
            {checks.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-foreground/90">
                <BadgeCheck className="size-4 text-primary" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/wallet">
                Open wallet
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/tools">Open tools</Link>
            </Button>
          </div>
        </div>
        <div>
          <HeroVisual />
          <p className="mt-6 text-center text-xs text-muted-foreground">Illustration of the workspace. These are not your files.</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-3 rounded-3xl border border-white/10 bg-card/80 p-3 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((item) => (
            <article key={item.title} className="rounded-2xl px-4 py-4">
              <item.icon className="size-5 text-primary" />
              <h2 className="mt-3 font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-emerald-300">POPULAR TOOLS</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Start with a file you already have</h2>
          </div>
          <Link to="/tools" className="hidden text-sm font-medium text-primary sm:inline">
            View all tools
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {popular.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <p className="text-xs font-semibold tracking-[0.16em] text-emerald-300">HOW IT WORKS</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Three steps, then a file you can check</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <article key={step.number} className="rounded-2xl border border-white/10 bg-card p-5">
              <p className="text-sm font-semibold text-primary">{step.number}</p>
              <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold tracking-[0.16em] text-emerald-300">SUPPORTED FORMATS</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">What this version can open</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {formats.map((format) => (
            <article key={format.name} className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <h3 className="text-lg font-semibold text-primary">{format.name}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{format.detail}</p>
            </article>
          ))}
        </div>
        <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          PDF to Word and Word to PDF are not available. Scan and OCR read an image in this browser.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.2),transparent_32rem)] px-6 py-10 sm:px-10">
          <h2 className="max-w-lg text-3xl font-semibold tracking-tight">Prepare a file for the form that keeps rejecting it.</h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Start with image size or PDF compression. You will see the output size before you send the file anywhere.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/tools">
              Explore Tools
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
