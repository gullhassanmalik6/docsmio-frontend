import { formatBytes } from '@/lib/format'
import { formatSavings, savingsPercent } from '@/lib/image-math'

type OriginalDetails = {
  bytes: number
  width: number
  height: number
  format: string
}

type OutputDetails = {
  bytes: number
  width: number
  height: number
  reachedTarget: boolean
}

export function ImageComparison({
  originalUrl,
  outputUrl,
  original,
  output,
  pending,
}: {
  originalUrl: string | null
  outputUrl: string | null
  original: OriginalDetails | null
  output: OutputDetails | null
  pending: boolean
}) {
  const savings = original && output ? formatSavings(savingsPercent(original.bytes, output.bytes)) : null

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <PreviewPane
        label="Original"
        size={original ? formatBytes(original.bytes) : 'No file'}
        meta={original ? `${original.width}×${original.height} px · ${original.format}` : 'Add an image to see its size.'}
        url={originalUrl}
        empty="The original preview appears after you add an image."
      />
      <PreviewPane
        label="Processed"
        size={output ? formatBytes(output.bytes) : pending ? 'Processing…' : 'Not created'}
        meta={
          output
            ? `${output.width}×${output.height} px${savings ? ` · ${savings}` : ''}`
            : pending
              ? 'Creating the output in this browser.'
              : 'Run Resize Image to create an output preview.'
        }
        url={outputUrl}
        empty={pending ? 'Processing the image…' : 'The processed preview appears here.'}
        warn={output ? !output.reachedTarget : false}
      />
    </div>
  )
}

function PreviewPane({
  label,
  size,
  meta,
  url,
  empty,
  warn = false,
}: {
  label: string
  size: string
  meta: string
  url: string | null
  empty: string
  warn?: boolean
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
        <span>{label}</span>
        <span className={warn ? 'text-amber-200' : 'text-emerald-200'}>{size}</span>
      </div>
      <div className="grid h-48 place-items-center bg-black/40 sm:h-64">
        {url ? <img src={url} alt={`${label} preview`} className="h-full w-full object-contain" /> : <p className="px-4 text-center text-xs text-muted-foreground">{empty}</p>}
      </div>
      <figcaption className="px-3 py-2 text-xs text-muted-foreground">{meta}</figcaption>
    </figure>
  )
}
