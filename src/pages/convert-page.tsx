import { useMutation } from '@tanstack/react-query'
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DropZone } from '@/components/drop-zone'
import { LibrarySaveActions } from '@/components/library-save'
import { Notice } from '@/components/notice'
import { ToolFrame, ToolHeading } from '@/components/tool-heading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useHistory } from '@/context/history-context'
import { useObjectUrl, usePageTitle } from '@/hooks/use-browser'
import { pagesForImageExport } from '@/lib/conversion'
import { isHeic, isPdfFile, isSupportedImage, MAX_IMAGE_BYTES, MAX_PDF_BYTES } from '@/lib/files'
import { downloadBlob, extensionOf, formatBytes, mimeOf, safeFileName } from '@/lib/format'
import { convertImage, type ImageFormat } from '@/lib/image-process'
import { getPdfPageCount, imagesToPdf, pdfPagesToImages } from '@/lib/pdf-process'
import { fieldClass } from '@/lib/utils'

type ConvertFormat = ImageFormat | 'pdf'

type OutputFile = {
  blob: Blob
  name: string
  kind: 'image' | 'pdf'
}

const formats: { id: ConvertFormat; label: string }[] = [
  { id: 'jpeg', label: 'JPG' },
  { id: 'png', label: 'PNG' },
  { id: 'webp', label: 'WebP' },
  { id: 'pdf', label: 'PDF' },
]

function pairAllowed(source: ConvertFormat, target: ConvertFormat): string | null {
  if (source === 'pdf' && target === 'pdf') return 'Choose a different target. Re-saving a PDF as a PDF is not a conversion.'
  return null
}

function ImagePreview({ file }: { file: File }) {
  const url = useObjectUrl(file)
  return url ? <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover" /> : null
}

export function ConvertPage() {
  usePageTitle('Convert Files — DocuFix')
  const { addOutput } = useHistory()
  const [source, setSource] = useState<ConvertFormat>('jpeg')
  const [target, setTarget] = useState<ConvertFormat>('png')
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [pageRange, setPageRange] = useState('1')
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const [outputs, setOutputs] = useState<OutputFile[]>([])
  const [note, setNote] = useState<string | null>(null)
  const previewUrl = useObjectUrl(source === 'pdf' ? null : files[0])

  const blocked = pairAllowed(source, target)
  const pdfToImage = source === 'pdf' && target !== 'pdf'
  const imagesToPdfMode = source !== 'pdf' && target === 'pdf'
  const rangeCheck = pdfToImage && pageCount ? pagesForImageExport(pageRange, pageCount) : null

  const mutation = useMutation({
    mutationFn: async () => {
      if (blocked) throw new Error(blocked)
      if (files.length === 0) throw new Error('Add a file first.')
      const file = files[0]
      if (pdfToImage) {
        if (!isPdfFile(file)) throw new Error('The source format is PDF, but this file is not a PDF.')
        if (!pageCount) throw new Error('The PDF page count is not ready yet.')
        const selected = pagesForImageExport(pageRange, pageCount)
        if ('error' in selected) throw new Error(selected.error)
        const rendered = await pdfPagesToImages(file, selected.pages, target as ImageFormat)
        const extension = extensionOf(target as ImageFormat)
        return {
          outputs: rendered.map((item) => ({
            blob: item.blob,
            name: safeFileName(`${file.name.replace(/\.[^.]+$/, '')}-page-${item.page}`, extension),
            kind: 'image' as const,
          })),
          note: `Exported ${rendered.length} page${rendered.length === 1 ? '' : 's'} as ${extension.toUpperCase()}. Each file uses ${mimeOf(target as ImageFormat)}.`,
          tool: 'Convert Files' as const,
        }
      }
      if (imagesToPdfMode) {
        const blob = await imagesToPdf(files, 'fit')
        return {
          outputs: [{ blob, name: safeFileName('Converted_Images', 'pdf'), kind: 'pdf' as const }],
          note: `Created a ${files.length}-page PDF. Each image keeps its own dimensions and is fitted on its page.`,
          tool: 'Convert Files' as const,
        }
      }
      if (!isSupportedImage(file)) throw new Error('Use a JPG, PNG, or WebP image for this conversion.')
      const result = await convertImage(file, target as ImageFormat, 92)
      const name = safeFileName(`${file.name.replace(/\.[^.]+$/, '')}-converted`, extensionOf(target as ImageFormat))
      return {
        outputs: [{ blob: result.blob, name, kind: 'image' as const }],
        note: `${result.note} Output type: ${result.blob.type || mimeOf(target as ImageFormat)}.`,
        tool: 'Convert Files' as const,
      }
    },
    onSuccess: async (result) => {
      setOutputs(result.outputs)
      setNote(result.note)
      for (const output of result.outputs) {
        await addOutput({
          name: output.name,
          blob: output.blob,
          kind: output.kind,
          tool: result.tool,
          originalName: files[0]?.name,
          originalSize: files.reduce((total, item) => total + item.size, 0),
        })
      }
    },
  })

  function moveFile(index: number, direction: -1 | 1) {
    const next = index + direction
    if (next < 0 || next >= files.length) return
    const copy = files.slice()
    const [item] = copy.splice(index, 1)
    copy.splice(next, 0, item)
    setFiles(copy)
    setOutputs([])
    setNote(null)
  }

  async function onFiles(incoming: File[]) {
    setOutputs([])
    setNote(null)
    setPageCount(null)
    setDimensions(null)
    const accepted: File[] = []
    for (const file of incoming) {
      if (isHeic(file)) {
        setFileError('HEIC is not supported. Export a JPG, PNG, or WebP first.')
        continue
      }
      if (source === 'pdf') {
        if (!isPdfFile(file)) {
          setFileError('The source format is PDF. Choose a PDF, or change the source format.')
          continue
        }
        if (file.size > MAX_PDF_BYTES) {
          setFileError('This PDF is larger than 50 MB.')
          continue
        }
        accepted.push(file)
        break
      }
      if (!isSupportedImage(file)) {
        setFileError(`${file.name} is not a JPG, PNG, or WebP file.`)
        continue
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setFileError(`${file.name} is larger than 20 MB.`)
        continue
      }
      accepted.push(file)
      if (!imagesToPdfMode) break
    }
    if (accepted.length === 0) {
      setFiles([])
      return
    }
    setFileError(null)
    setFiles(accepted)
    if (source === 'pdf') {
      try {
        setPageCount(await getPdfPageCount(accepted[0]))
      } catch (error) {
        setFiles([])
        setFileError(error instanceof Error ? error.message : 'This PDF could not be read.')
      }
      return
    }
    try {
      const bitmap = await createImageBitmap(accepted[0])
      setDimensions({ width: bitmap.width, height: bitmap.height })
      bitmap.close()
    } catch {
      setFiles([])
      setFileError('This image could not be read. It may be damaged or in an unsupported format.')
    }
  }

  return (
    <ToolFrame>
      <ToolHeading title="Convert Files" description="Convert between JPG, PNG, and WebP, place images on PDF pages, or export selected PDF pages as images." />
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4 rounded-3xl border border-white/10 bg-card p-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div>
              <Label htmlFor="source-format">From</Label>
              <select
                id="source-format"
                className={fieldClass + ' mt-1.5'}
                value={source}
                onChange={(event) => {
                  setSource(event.target.value as ConvertFormat)
                  setFiles([])
                  setOutputs([])
                  setNote(null)
                  setFileError(null)
                  setPageCount(null)
                  setDimensions(null)
                }}
              >
                {formats.map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.label}
                  </option>
                ))}
              </select>
            </div>
            <ArrowRight className="mb-3 size-4 text-primary" />
            <div>
              <Label htmlFor="target-format">To</Label>
              <select
                id="target-format"
                className={fieldClass + ' mt-1.5'}
                value={target}
                onChange={(event) => {
                  setTarget(event.target.value as ConvertFormat)
                  setOutputs([])
                  setNote(null)
                }}
              >
                {formats.map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            JPG, PNG, and WebP convert in this browser. WebP export works only when the browser can encode it. Images can become a PDF. Selected PDF pages can become PNG or JPG.
          </p>
          {target === 'jpeg' ? (
            <Notice tone="info">JPG cannot preserve transparency. Transparent areas are filled with white.</Notice>
          ) : null}
          {target === 'png' || target === 'webp' ? (
            <Notice tone="info">{target === 'png' ? 'PNG' : 'WebP'} keeps transparency when the source image has it.</Notice>
          ) : null}
          <p className="text-sm text-muted-foreground">
            <Link className="text-primary" to="/tools/pdf-to-word">PDF to Word</Link>
            {' and '}
            <Link className="text-primary" to="/tools/word-to-pdf">Word to PDF</Link>
            {' stay unavailable. Renaming a file is not a conversion, so those pages do not produce a download.'}
          </p>
          {pdfToImage ? (
            <div>
              <Label htmlFor="page-range">Pages to export</Label>
              <Input id="page-range" className="mt-1.5" value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder="1 or 1-3, 5" />
              <p className="mt-1 text-xs text-muted-foreground">
                {pageCount
                  ? `This PDF has ${pageCount} page${pageCount === 1 ? '' : 's'}. Export up to 8 pages at a time.`
                  : 'Page count appears after you add a PDF.'}
              </p>
            </div>
          ) : null}
        </div>
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-card p-4">
            <DropZone
              accept={source === 'pdf' ? 'application/pdf,.pdf' : 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'}
              multiple={imagesToPdfMode}
              title="Drag and drop your file here or click to browse"
              detail={imagesToPdfMode ? 'Add one or more images. Max 20 MB each.' : source === 'pdf' ? 'One PDF. Max 50 MB.' : 'One image. Max 20 MB.'}
              onFiles={(incoming) => void onFiles(incoming)}
              selected={files.length ? files.map((file) => file.name).join(', ') : undefined}
            />
            {files[0] && source !== 'pdf' ? (
              <div className="mt-4 flex gap-3">
                <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-black/40">
                  {previewUrl ? <img src={previewUrl} alt="Original preview" className="h-full w-full object-contain" /> : null}
                </div>
                <div className="text-sm leading-6 text-muted-foreground">
                  <p className="font-medium text-foreground">{files[0].name}</p>
                  <p>{files[0].type || 'image'} · {formatBytes(files[0].size)}</p>
                  <p>{dimensions ? `${dimensions.width} × ${dimensions.height} px` : 'Reading dimensions…'}</p>
                </div>
              </div>
            ) : null}
            {imagesToPdfMode && files.length > 0 ? (
              <ol className="mt-4 space-y-2">
                {files.map((file, index) => (
                  <li key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-2 rounded-xl border border-white/10 px-2 py-2">
                    <ImagePreview file={file} />
                    <span className="min-w-0 flex-1 truncate text-sm">{index + 1}. {file.name}</span>
                    <Button type="button" variant="outline" size="sm" aria-label={`Move ${file.name} up`} disabled={index === 0} onClick={() => moveFile(index, -1)}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button type="button" variant="outline" size="sm" aria-label={`Move ${file.name} down`} disabled={index === files.length - 1} onClick={() => moveFile(index, 1)}>
                      <ArrowDown className="size-4" />
                    </Button>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
          {fileError ? <Notice tone="warning">{fileError}</Notice> : null}
          {blocked ? <Notice tone="warning">{blocked}</Notice> : null}
          {rangeCheck && 'error' in rangeCheck ? <Notice tone="warning">{rangeCheck.error}</Notice> : null}
          {mutation.error ? <Notice tone="error">{mutation.error.message}</Notice> : null}
          {note ? <Notice tone="success">{note}</Notice> : <Notice tone="info">The convert button stays off until the format pair is supported and a matching file is added.</Notice>}
          {outputs.length > 0 ? (
            <ul className="space-y-2">
              {outputs.map((output) => (
                <li key={output.name} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm">
                    {output.name}
                    <span className="mt-1 block text-muted-foreground">{output.blob.type || 'file'} · {formatBytes(output.blob.size)}</span>
                  </span>
                  <Button type="button" variant="outline" data-testid="download-output" onClick={() => downloadBlob(output.blob, output.name)}>
                    Download
                  </Button>
                  <LibrarySaveActions blob={output.blob} filename={output.name} mime={output.blob.type || 'application/octet-stream'} />
                </li>
              ))}
            </ul>
          ) : null}
          <Button
            type="button"
            data-testid="primary-action"
            disabled={Boolean(blocked) || files.length === 0 || mutation.isPending || Boolean(rangeCheck && 'error' in rangeCheck) || (pdfToImage && !pageCount)}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Converting…' : 'Convert'}
          </Button>
        </div>
      </div>
    </ToolFrame>
  )
}
