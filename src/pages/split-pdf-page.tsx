import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { DropZone } from '@/components/drop-zone'
import { LibrarySaveActions } from '@/components/library-save'
import { Notice } from '@/components/notice'
import { ToolFrame, ToolHeading } from '@/components/tool-heading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useHistory } from '@/context/history-context'
import { useObjectUrl, usePageTitle } from '@/hooks/use-browser'
import { pdfFileError } from '@/lib/pdf-report'
import { downloadBlob, formatBytes, safeFileName } from '@/lib/format'
import { parsePageRanges } from '@/lib/page-ranges'
import { getPdfPageCount, renderPdfPreview, splitPdf } from '@/lib/pdf-process'

const schema = z.object({
  range: z.string().trim().min(1, 'Enter a page range.'),
  filename: z
    .string()
    .trim()
    .min(1, 'Enter a file name.')
    .max(120)
    .regex(/^[^\\/:*?"<>|]+$/, 'The file name contains a character that cannot be saved.'),
})

type SplitForm = z.infer<typeof schema>

export function SplitPdfPage() {
  usePageTitle('Split PDF — Docsmio')
  const { addOutput } = useHistory()
  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState<number | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [output, setOutput] = useState<{ blob: Blob; name: string; count: number } | null>(null)
  const [preview, setPreview] = useState<Blob | null>(null)
  const previewUrl = useObjectUrl(preview)
  const form = useForm<SplitForm>({
    resolver: zodResolver(schema),
    defaultValues: { range: '1', filename: 'Split_Document.pdf' },
  })

  const mutation = useMutation({
    mutationFn: async (values: SplitForm) => {
      if (!file || !pages) throw new Error('Add a PDF first.')
      const parsed = parsePageRanges(values.range, pages)
      if ('error' in parsed) throw new Error(parsed.error)
      const blob = await splitPdf(file, parsed.pages)
      const name = safeFileName(values.filename, 'pdf')
      const firstPage = await renderPdfPreview(await blob.arrayBuffer()).catch(() => null)
      return { blob, name, count: parsed.pages.length, firstPage, originalName: file.name, originalSize: file.size }
    },
    onSuccess: async (result) => {
      setOutput({ blob: result.blob, name: result.name, count: result.count })
      setPreview(result.firstPage)
      await addOutput({ name: result.name, blob: result.blob, kind: 'pdf', tool: 'Split PDF', originalName: result.originalName, originalSize: result.originalSize })
    },
  })

  const rangeValue = form.watch('range')
  const rangeCheck = pages ? parsePageRanges(rangeValue, pages) : null
  const rangeError = form.formState.errors.range?.message ?? (rangeCheck && 'error' in rangeCheck ? rangeCheck.error : null)

  async function onFiles(files: File[]) {
    const next = files[0]
    if (!next) {
      setFileError('Choose a PDF to continue.')
      return
    }
    setOutput(null)
    setPreview(null)
    const rejection = pdfFileError(next)
    if (rejection) {
      setFileError(rejection)
      setFile(null)
      setPages(null)
      return
    }
    setFile(next)
    setPages(null)
    setReading(true)
    setFileError(null)
    try {
      const count = await getPdfPageCount(next)
      setPages(count)
      form.setValue('range', count === 1 ? '1' : `1-${Math.min(3, count)}`)
    } catch (error) {
      setFile(null)
      setFileError(error instanceof Error ? error.message : 'This PDF could not be read.')
    } finally {
      setReading(false)
    }
  }

  return (
    <ToolFrame>
      <ToolHeading title="Split PDF" description="Keep the pages you need in a new PDF. Example: 1-3, 5, 8-10." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-card p-4">
          <DropZone
            accept="application/pdf,.pdf"
            title="Drag and drop a PDF or click to browse"
            detail="Max file size 50 MB."
            onFiles={(files) => void onFiles(files)}
            selected={file ? file.name : undefined}
          />
          {reading ? <p className="mt-3 text-sm text-emerald-200">Reading document…</p> : null}
          {file && pages ? (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-black/30 p-3">
                <dt className="text-muted-foreground">File</dt>
                <dd className="truncate font-medium">{file.name}</dd>
              </div>
              <div className="rounded-xl bg-black/30 p-3">
                <dt className="text-muted-foreground">Details</dt>
                <dd className="font-medium">{pages} page{pages === 1 ? '' : 's'} · {formatBytes(file.size)}</dd>
              </div>
            </dl>
          ) : null}
          {fileError ? <p className="mt-3 text-sm text-amber-200" data-testid="file-error">{fileError}</p> : null}
        </div>
        <form
          className="space-y-4 rounded-3xl border border-white/10 bg-card p-4"
          noValidate
          onSubmit={form.handleSubmit((values) => {
            setOutput(null)
            mutation.mutate(values)
          })}
        >
          <div>
            <Label htmlFor="range">Page range</Label>
            <Input id="range" className="mt-1.5" placeholder="1-3, 5" {...form.register('range')} />
            <p className="mt-1 text-xs text-muted-foreground">Example: 1-3, 5, 8-10. Use commas between parts. Pages are numbered from 1, and the smaller number comes first.</p>
            {rangeError ? <p className="mt-1 text-xs text-red-300">{rangeError}</p> : null}
          </div>
          <div>
            <Label htmlFor="split-name">Output filename</Label>
            <Input id="split-name" className="mt-1.5" {...form.register('filename')} />
            {form.formState.errors.filename ? <p className="mt-1 text-xs text-red-300">{form.formState.errors.filename.message}</p> : null}
          </div>
          {mutation.isPending ? <p className="text-sm text-emerald-200">Building the new PDF…</p> : null}
          {mutation.error ? <Notice tone="error">{mutation.error.message}</Notice> : null}
          {output ? (
            <Notice tone="success">
              Created {output.name} with {output.count} page{output.count === 1 ? '' : 's'} · {formatBytes(output.blob.size)}.
              {previewUrl ? <img src={previewUrl} alt="First page of split PDF" className="mt-3 max-h-64 w-full rounded-xl bg-white object-contain" /> : null}
            </Notice>
          ) : (
            <p className="text-sm text-muted-foreground">The download appears after a valid page range produces a PDF.</p>
          )}
          <Button type="submit" className="w-full" data-testid="primary-action" disabled={!file || !pages || mutation.isPending || Boolean(rangeCheck && 'error' in rangeCheck)}>
            Create PDF
          </Button>
          <Button type="button" variant="outline" className="w-full" data-testid="download-output" disabled={!output} onClick={() => output && downloadBlob(output.blob, output.name)}>
            Download output
          </Button>
          <LibrarySaveActions blob={output?.blob ?? null} filename={output?.name ?? 'split.pdf'} mime="application/pdf" />
        </form>
      </div>
    </ToolFrame>
  )
}
