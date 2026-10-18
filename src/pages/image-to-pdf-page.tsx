import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { DropZone } from '@/components/drop-zone'
import { Notice } from '@/components/notice'
import { ToolFrame, ToolHeading } from '@/components/tool-heading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useHistory } from '@/context/history-context'
import { useObjectUrl, usePageTitle } from '@/hooks/use-browser'
import { isHeic, isJpegFile, isSupportedImage, MAX_IMAGE_BYTES } from '@/lib/files'
import { downloadBlob, formatBytes, safeFileName } from '@/lib/format'
import { imagesToPdf, renderPdfPreview } from '@/lib/pdf-process'
import { fieldClass } from '@/lib/utils'

const schema = z.object({
  filename: z.string().trim().min(1, 'Enter a file name.').max(120).regex(/^[^\\/:*?"<>|]+$/, 'That file name cannot be saved.'),
  pageSize: z.enum(['fit', 'a4']),
})

type PdfForm = z.infer<typeof schema>

export function ImageToPdfPage({ mode }: { mode: 'jpeg' | 'image' }) {
  const title = mode === 'jpeg' ? 'JPG to PDF' : 'Image to PDF'
  usePageTitle(`${title} — DocuFix`)
  const { addOutput } = useHistory()
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [output, setOutput] = useState<{ blob: Blob; name: string } | null>(null)
  const [preview, setPreview] = useState<Blob | null>(null)
  const previewUrl = useObjectUrl(preview)
  const form = useForm<PdfForm>({
    resolver: zodResolver(schema),
    defaultValues: { filename: mode === 'jpeg' ? 'JPG_Document.pdf' : 'Images_Document.pdf', pageSize: 'fit' },
  })

  const mutation = useMutation({
    mutationFn: async (values: PdfForm) => {
      if (files.length === 0) throw new Error('Add at least one image.')
      const blob = await imagesToPdf(files, values.pageSize)
      const name = safeFileName(values.filename, 'pdf')
      const firstPage = await renderPdfPreview(await blob.arrayBuffer()).catch(() => null)
      return { blob, name, firstPage, originalName: files[0]?.name, originalSize: files.reduce((total, item) => total + item.size, 0) }
    },
    onSuccess: async (result) => {
      setOutput({ blob: result.blob, name: result.name })
      setPreview(result.firstPage)
      await addOutput({ name: result.name, blob: result.blob, kind: 'pdf', tool: title, originalName: result.originalName, originalSize: result.originalSize })
    },
  })

  function onFiles(incoming: File[]) {
    if (incoming.length === 0) {
      setFileError('Choose an image to continue.')
      return
    }
    setOutput(null)
    setPreview(null)
    const accepted: File[] = []
    for (const file of incoming) {
      if (file.size <= 0) {
        setFileError(`${file.name || 'This file'} is empty. Choose an image that has content.`)
        continue
      }
      if (isHeic(file)) {
        setFileError(`${file.name} is HEIC. Export a JPG, PNG, or WebP first.`)
        continue
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setFileError(`${file.name} is larger than 20 MB.`)
        continue
      }
      if (mode === 'jpeg' && !isJpegFile(file)) {
        setFileError(`${file.name} is not a JPEG. Use Image to PDF for PNG and WebP.`)
        continue
      }
      if (mode === 'image' && !isSupportedImage(file)) {
        setFileError(`${file.name} must be JPG, PNG, or WebP.`)
        continue
      }
      accepted.push(file)
    }
    if (accepted.length > 0) {
      setFileError(null)
      setFiles((current) => [...current, ...accepted])
    }
  }

  function move(index: number, direction: -1 | 1) {
    setFiles((current) => {
      const next = index + direction
      if (next < 0 || next >= current.length) return current
      const copy = [...current]
      const [item] = copy.splice(index, 1)
      copy.splice(next, 0, item)
      return copy
    })
    setOutput(null)
  }

  return (
    <ToolFrame>
      <ToolHeading
        title={title}
        description={mode === 'jpeg' ? 'Build a PDF from JPEG images. Each image becomes a page.' : 'Place JPG, PNG, or WebP images onto PDF pages. WebP is flattened before it is embedded.'}
      />
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-3">
          <div className="rounded-3xl border border-white/10 bg-card p-4">
            <DropZone
              accept={mode === 'jpeg' ? 'image/jpeg,.jpg,.jpeg' : 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'}
              multiple
              title="Drag and drop images or click to browse"
              detail={mode === 'jpeg' ? 'JPEG only. Max 20 MB each.' : 'JPG, PNG, and WebP. Max 20 MB each.'}
              onFiles={onFiles}
            />
          </div>
          {files.length === 0 ? <p className="text-sm text-muted-foreground">No images yet. The PDF is created only from files you add here.</p> : null}
          <ul className="space-y-2">
            {files.map((file, index) => (
              <FileRow key={`${file.name}-${index}-${file.size}`} file={file} index={index} total={files.length} onMove={move} onRemove={() => { setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index)); setOutput(null) }} />
            ))}
          </ul>
          {fileError ? <Notice tone="warning">{fileError}</Notice> : null}
        </div>
        <form className="h-fit space-y-4 rounded-3xl border border-white/10 bg-card p-4" noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <div>
            <Label htmlFor="pdf-name">Output filename</Label>
            <Input id="pdf-name" className="mt-1.5" {...form.register('filename')} />
            {form.formState.errors.filename ? <p className="mt-1 text-xs text-red-300">{form.formState.errors.filename.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="image-page-size">Page size</Label>
            <select id="image-page-size" className={fieldClass + ' mt-1.5'} {...form.register('pageSize')}>
              <option value="fit">Fit the image</option>
              <option value="a4">Fit onto A4</option>
            </select>
          </div>
          <p className="text-sm text-muted-foreground">
            Need a different image format first? <Link className="text-primary" to="/tools/convert">Open the converter</Link>.
          </p>
          {mutation.isPending ? <p className="text-sm text-emerald-200">Creating PDF…</p> : null}
          {mutation.error ? <Notice tone="error">{mutation.error.message}</Notice> : null}
          {output ? (
            <Notice tone="success">
              {output.name} · {formatBytes(output.blob.size)} · {files.length} page{files.length === 1 ? '' : 's'}.
              {previewUrl ? <img src={previewUrl} alt="First page of the new PDF" className="mt-3 max-h-56 w-full rounded-xl bg-white object-contain" /> : null}
            </Notice>
          ) : null}
          <Button type="submit" className="w-full" data-testid="primary-action" disabled={files.length === 0 || mutation.isPending}>
            Create PDF
          </Button>
          <Button type="button" variant="outline" className="w-full" data-testid="download-output" disabled={!output} onClick={() => output && downloadBlob(output.blob, output.name)}>
            Download PDF
          </Button>
        </form>
      </div>
    </ToolFrame>
  )
}

export function JpgToPdfPage() {
  return <ImageToPdfPage mode="jpeg" />
}

export function ImagesToPdfRoute() {
  return <ImageToPdfPage mode="image" />
}

function FileRow({ file, index, total, onMove, onRemove }: { file: File; index: number; total: number; onMove: (index: number, direction: -1 | 1) => void; onRemove: () => void }) {
  const url = useObjectUrl(file)
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-white/10 bg-card p-3">
      {url ? <img src={url} alt="" className="size-14 rounded-lg object-cover" /> : <span className="size-14 rounded-lg bg-black/40" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
      </div>
      <Button type="button" size="icon" variant="outline" aria-label="Move up" disabled={index === 0} onClick={() => onMove(index, -1)}>
        <ArrowUp className="size-4" />
      </Button>
      <Button type="button" size="icon" variant="outline" aria-label="Move down" disabled={index === total - 1} onClick={() => onMove(index, 1)}>
        <ArrowDown className="size-4" />
      </Button>
      <Button type="button" size="icon" variant="destructive" aria-label="Remove image" onClick={onRemove}>
        <Trash2 className="size-4" />
      </Button>
    </li>
  )
}
