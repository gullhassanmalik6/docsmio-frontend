import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { DropZone } from '@/components/drop-zone'
import { Notice } from '@/components/notice'
import { ToolFrame, ToolHeading } from '@/components/tool-heading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useHistory } from '@/context/history-context'
import { useObjectUrl, usePageTitle } from '@/hooks/use-browser'
import { MAX_PDF_BYTES } from '@/lib/files'
import { downloadBlob, formatBytes, safeFileName, targetToBytes } from '@/lib/format'
import { getPdfPageCount, compressPdf, type CompressResult } from '@/lib/pdf-process'
import { pdfFileError } from '@/lib/pdf-report'
import { cn, fieldClass } from '@/lib/utils'

const schema = z
  .object({
    targetSize: z.number({ invalid_type_error: 'Enter a target size.' }).positive(),
    targetUnit: z.enum(['KB', 'MB']),
    mode: z.enum(['high', 'balanced', 'low']),
    grayscale: z.boolean(),
  })
  .superRefine((values, context) => {
    const bytes = targetToBytes(values.targetSize, values.targetUnit)
    if (bytes < 20 * 1024) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['targetSize'], message: 'Use a target of at least 20 KB.' })
    }
    if (bytes > MAX_PDF_BYTES) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['targetSize'], message: 'Target size must be 50 MB or less.' })
    }
  })

type CompressForm = z.infer<typeof schema>

const modes = [
  { id: 'high', title: 'High Compression', detail: 'Smaller file. Pages become images, so selectable text is removed.' },
  { id: 'balanced', title: 'Balanced', detail: 'A middle pass. Pages still become images, with a lighter quality cut.' },
  { id: 'low', title: 'Low Compression', detail: 'Rewrites the PDF structure and clears document info. Text stays selectable. This does not recompress images or fonts, and it may not make the file smaller.' },
] as const

export function CompressPdfPage() {
  usePageTitle('Compress PDF — DocuFix')
  const { addOutput } = useHistory()
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [reading, setReading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [result, setResult] = useState<CompressResult | null>(null)
  const [filename, setFilename] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const originalUrl = useObjectUrl(result?.originalPreview)
  const outputUrl = useObjectUrl(result?.preview)

  const form = useForm<CompressForm>({
    resolver: zodResolver(schema),
    defaultValues: { targetSize: 500, targetUnit: 'KB', mode: 'balanced', grayscale: false },
  })
  const mode = form.watch('mode')

  const mutation = useMutation({
    mutationFn: (values: CompressForm) => {
      if (!file) throw new Error('Add a PDF first.')
      setProgress('Reading the PDF…')
      return compressPdf(file, {
        mode: values.mode,
        targetBytes: targetToBytes(values.targetSize, values.targetUnit),
        grayscale: values.mode === 'low' ? false : values.grayscale,
        onProgress: setProgress,
      })
    },
    onSuccess: async (next) => {
      setProgress(null)
      setResult(next)
      if (next.blob && file) {
        const name = safeFileName(file.name.replace(/\.[^.]+$/, '') + '_compressed', 'pdf')
        setFilename(name)
        await addOutput({ name, blob: next.blob, kind: 'pdf', tool: 'Compress PDF', originalName: file.name, originalSize: file.size })
      }
    },
    onError: () => setProgress(null),
  })

  async function onFiles(files: File[]) {
    const next = files[0]
    if (!next) {
      setFileError('Choose a PDF to continue.')
      return
    }
    const rejection = pdfFileError(next)
    if (rejection) {
      setFileError(rejection)
      return
    }
    setFile(next)
    setPageCount(null)
    setResult(null)
    setFilename('')
    setFileError(null)
    setReading(true)
    mutation.reset()
    try {
      setPageCount(await getPdfPageCount(next))
    } catch (error) {
      setFile(null)
      setPageCount(null)
      setFileError(error instanceof Error ? error.message : 'This PDF could not be read.')
    } finally {
      setReading(false)
    }
  }

  return (
    <ToolFrame>
      <ToolHeading title="Compress PDF" description="Reduce PDF file size toward a KB or MB target. The page reports the real output size and what the chosen mode changed." />
      <form
        className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          setResult(null)
          mutation.mutate(values)
        })}
      >
        <div className="space-y-4 rounded-3xl border border-white/10 bg-card p-4">
          <DropZone
            accept="application/pdf,.pdf"
            title="Drag and drop your PDF here or click to browse"
            detail="Max file size 50 MB. Encrypted PDFs are rejected."
            onFiles={(files) => void onFiles(files)}
            selected={file ? `${file.name} · ${formatBytes(file.size)}` : undefined}
          />
          {fileError ? <p className="text-sm text-amber-200" data-testid="file-error">{fileError}</p> : null}
          {reading ? <p className="text-sm text-emerald-200">Reading the PDF…</p> : null}
          {file && pageCount ? (
            <dl className="grid grid-cols-3 gap-2 text-sm" data-testid="source-meta">
              <div>
                <dt className="text-xs text-muted-foreground">File</dt>
                <dd className="truncate font-medium">{file.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Size</dt>
                <dd>{formatBytes(file.size)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Pages</dt>
                <dd>{pageCount}</dd>
              </div>
            </dl>
          ) : null}
          <div>
            <Label htmlFor="pdf-target">Target file size</Label>
            <div className="mt-1.5 flex gap-2">
              <Input id="pdf-target" type="number" min={1} {...form.register('targetSize', { valueAsNumber: true })} />
              <select aria-label="Target unit" className={fieldClass + ' w-24'} {...form.register('targetUnit')}>
                <option value="KB">KB</option>
                <option value="MB">MB</option>
              </select>
            </div>
            {form.formState.errors.targetSize ? <p className="mt-1 text-xs text-red-300">{form.formState.errors.targetSize.message}</p> : null}
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Compression mode</legend>
            <div className="mt-2 space-y-2">
              {modes.map((item) => (
                <label key={item.id} className={cn('block cursor-pointer rounded-2xl border px-3 py-3', mode === item.id ? 'border-primary bg-primary/10' : 'border-white/10')}>
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <input type="radio" value={item.id} {...form.register('mode')} />
                    {item.title}
                  </span>
                  <span className="mt-1 block pl-6 text-xs leading-5 text-muted-foreground">{item.detail}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="rounded-2xl border border-white/10">
            <button type="button" className="flex w-full items-center justify-between px-3 py-3 text-sm font-medium" aria-expanded={advanced} onClick={() => setAdvanced((open) => !open)}>
              Advanced options
              <span className="text-muted-foreground">{advanced ? 'Hide' : 'Show'}</span>
            </button>
            {advanced ? (
              <label className="flex items-center justify-between gap-3 border-t border-white/10 px-3 py-3 text-sm">
                <span>
                  <span className="block font-medium">Grayscale</span>
                  <span className="text-muted-foreground">{mode === 'low' ? 'Grayscale applies only when pages are rebuilt as images.' : 'Converts rebuilt pages to gray before encoding.'}</span>
                </span>
                <Controller control={form.control} name="grayscale" render={({ field }) => <Switch checked={field.value} disabled={mode === 'low'} onCheckedChange={field.onChange} aria-label="Grayscale" />} />
              </label>
            ) : null}
          </div>
          {progress ? <Notice tone="info"><span data-testid="process-status">{progress}</span></Notice> : null}
          {mutation.error ? <Notice tone="error">{mutation.error.message}</Notice> : null}
          <Button type="submit" className="w-full" data-testid="primary-action" disabled={!file || !pageCount || mutation.isPending}>
            {mutation.isPending ? 'Compressing…' : 'Compress PDF'}
          </Button>
        </div>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <PreviewCard title="Original" size={file ? formatBytes(file.size) : 'No file'} url={originalUrl} />
            <PreviewCard title="Output" size={result?.blob ? formatBytes(result.blob.size) : 'Not created'} url={outputUrl} warn={Boolean(result && !result.reachedTarget)} />
          </div>
          {result ? (
            <Notice tone={result.reduced && result.reachedTarget ? 'success' : 'warning'}>
              <span data-testid="result-note">{result.note}</span>
              {result.blob ? (
                <span className="mt-1 block" data-testid="result-size">
                  Original {file ? formatBytes(file.size) : ''} · Output {formatBytes(result.blob.size)} · {result.reachedTarget ? 'Target reached.' : 'Target not reached.'}
                </span>
              ) : null}
            </Notice>
          ) : (
            <Notice tone="info">Changing the label or re-saving a PDF does not guarantee a smaller file. Download appears only after a real output exists.</Notice>
          )}
          <Button type="button" className="w-full" data-testid="download-output" disabled={!result?.blob} onClick={() => result?.blob && downloadBlob(result.blob, filename || 'document_compressed.pdf')}>
            {result?.blob ? `Download PDF · ${formatBytes(result.blob.size)}` : 'Download PDF'}
          </Button>
        </div>
      </form>
    </ToolFrame>
  )
}

function PreviewCard({ title, size, url, warn = false }: { title: string; size: string; url: string | null; warn?: boolean }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/10 bg-card">
      <figcaption className="flex items-center justify-between px-3 py-2 text-xs">
        <span>{title}</span>
        <span className={warn ? 'text-amber-200' : 'text-emerald-200'}>{size}</span>
      </figcaption>
      <div className="grid h-72 place-items-center bg-white">
        {url ? <img src={url} alt={`${title} first page`} className="h-full w-full object-contain" /> : <p className="px-4 text-center text-xs text-black/50">First-page preview appears after processing.</p>}
      </div>
    </figure>
  )
}
