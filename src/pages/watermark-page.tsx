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
import { Slider } from '@/components/ui/slider'
import { useHistory } from '@/context/history-context'
import { useObjectUrl, usePageTitle } from '@/hooks/use-browser'
import { isPdfFile, MAX_PDF_BYTES } from '@/lib/files'
import { downloadBlob, formatBytes, safeFileName } from '@/lib/format'
import { renderPdfPreview, watermarkPdf } from '@/lib/pdf-process'

const schema = z.object({
  text: z.string().trim().min(1, 'Enter watermark text.').max(80, 'Use 80 characters or fewer.'),
  filename: z.string().trim().min(1, 'Enter a file name.').max(120).regex(/^[^\\/:*?"<>|]+$/, 'That file name cannot be saved.'),
  opacity: z.number().min(10).max(80),
  fontSize: z.number().min(18).max(96),
})

type WatermarkForm = z.infer<typeof schema>

export function WatermarkPage() {
  usePageTitle('Add Watermark — DocuFix')
  const { addOutput } = useHistory()
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [output, setOutput] = useState<{ blob: Blob; name: string } | null>(null)
  const [preview, setPreview] = useState<Blob | null>(null)
  const previewUrl = useObjectUrl(preview)
  const form = useForm<WatermarkForm>({
    resolver: zodResolver(schema),
    defaultValues: { text: 'DOCUFIX', filename: 'Watermarked.pdf', opacity: 30, fontSize: 48 },
  })

  const mutation = useMutation({
    mutationFn: async (values: WatermarkForm) => {
      if (!file) throw new Error('Add a PDF first.')
      const blob = await watermarkPdf(file, { text: values.text, opacity: values.opacity / 100, fontSize: values.fontSize })
      const name = safeFileName(values.filename, 'pdf')
      const firstPage = await renderPdfPreview(await blob.arrayBuffer()).catch(() => null)
      return { blob, name, firstPage, originalName: file.name, originalSize: file.size }
    },
    onSuccess: async (result) => {
      setOutput({ blob: result.blob, name: result.name })
      setPreview(result.firstPage)
      await addOutput({ name: result.name, blob: result.blob, kind: 'pdf', tool: 'Add Watermark', originalName: result.originalName, originalSize: result.originalSize })
    },
  })

  function onFiles(files: File[]) {
    const next = files[0]
    if (!next) return
    if (!isPdfFile(next)) {
      setFileError('Choose a PDF file.')
      return
    }
    if (next.size > MAX_PDF_BYTES) {
      setFileError('This PDF is larger than 50 MB.')
      return
    }
    setFile(next)
    setFileError(null)
    setOutput(null)
    setPreview(null)
  }

  const opacity = form.watch('opacity')
  const fontSize = form.watch('fontSize')

  return (
    <ToolFrame>
      <ToolHeading title="Add Watermark" description="Stamp text across every page of a PDF. The download is a new file." />
      <form className="grid gap-4 lg:grid-cols-2" noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <div className="space-y-4 rounded-3xl border border-white/10 bg-card p-4">
          <DropZone accept="application/pdf,.pdf" title="Drag and drop a PDF or click to browse" detail="Max 50 MB. Encrypted PDFs are rejected." onFiles={onFiles} selected={file ? `${file.name} · ${formatBytes(file.size)}` : undefined} />
          {fileError ? <p className="text-sm text-amber-200">{fileError}</p> : null}
          <div>
            <Label htmlFor="watermark-text">Watermark text</Label>
            <Input id="watermark-text" className="mt-1.5" {...form.register('text')} />
            {form.formState.errors.text ? <p className="mt-1 text-xs text-red-300">{form.formState.errors.text.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="watermark-name">Output filename</Label>
            <Input id="watermark-name" className="mt-1.5" {...form.register('filename')} />
            {form.formState.errors.filename ? <p className="mt-1 text-xs text-red-300">{form.formState.errors.filename.message}</p> : null}
          </div>
          <div>
            <Label>Opacity · {opacity}%</Label>
            <Controller control={form.control} name="opacity" render={({ field }) => <Slider className="mt-3" min={10} max={80} step={1} value={[field.value]} onValueChange={(value) => field.onChange(value[0] ?? field.value)} aria-label="Watermark opacity" />} />
          </div>
          <div>
            <Label>Font size · {fontSize} pt</Label>
            <Controller control={form.control} name="fontSize" render={({ field }) => <Slider className="mt-3" min={18} max={96} step={1} value={[field.value]} onValueChange={(value) => field.onChange(value[0] ?? field.value)} aria-label="Font size" />} />
          </div>
        </div>
        <div className="space-y-4">
          <div className="grid min-h-72 place-items-center overflow-hidden rounded-3xl border border-white/10 bg-white">
            {previewUrl ? <img src={previewUrl} alt="First page with watermark" className="max-h-96 w-full object-contain" /> : <p className="px-6 text-center text-sm text-black/50">The first page appears here after the watermark is applied.</p>}
          </div>
          {mutation.isPending ? <p className="text-sm text-emerald-200">Applying watermark…</p> : null}
          {mutation.error ? <Notice tone="error">{mutation.error.message}</Notice> : null}
          {output ? <Notice tone="success">{output.name} · {formatBytes(output.blob.size)}. Selectable text in the original PDF is kept, with the stamp drawn on top.</Notice> : null}
          <Button type="submit" className="w-full" data-testid="primary-action" disabled={!file || mutation.isPending}>
            Add watermark
          </Button>
          <Button type="button" variant="outline" className="w-full" data-testid="download-output" disabled={!output} onClick={() => output && downloadBlob(output.blob, output.name)}>
            Download PDF
          </Button>
        </div>
      </form>
    </ToolFrame>
  )
}
