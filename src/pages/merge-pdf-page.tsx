import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
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
import { getPdfPageCount, mergePdfs, renderPdfPreview } from '@/lib/pdf-process'
import { fieldClass } from '@/lib/utils'

const schema = z.object({
  filename: z
    .string()
    .trim()
    .min(1, 'Enter a file name.')
    .max(120, 'Use 120 characters or fewer.')
    .regex(/^[^\\/:*?"<>|]+$/, 'Remove characters such as / \\ : * ? " < > |'),
  pageSize: z.enum(['original', 'a4']),
})

type MergeForm = z.infer<typeof schema>

type MergeItem = {
  id: string
  file: File
  pages: number | null
  error: string | null
}

export function MergePdfPage() {
  usePageTitle('Merge PDF — Docsmio')
  const { addOutput } = useHistory()
  const [items, setItems] = useState<MergeItem[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [output, setOutput] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<Blob | null>(null)
  const [savedName, setSavedName] = useState('')
  const previewUrl = useObjectUrl(preview)
  const form = useForm<MergeForm>({
    resolver: zodResolver(schema),
    defaultValues: { filename: 'Merged_Document.pdf', pageSize: 'original' },
  })

  const mutation = useMutation({
    mutationFn: async (values: MergeForm) => {
      const ready = items.filter((item) => item.pages && !item.error)
      if (ready.length < 2) throw new Error('Add at least two readable PDFs.')
      if (items.some((item) => item.error || item.pages === null)) {
        throw new Error('Remove any PDF that could not be read before merging.')
      }
      const blob = await mergePdfs(ready.map((item) => item.file), values.pageSize)
      const name = safeFileName(values.filename, 'pdf')
      const firstPage = await renderPdfPreview(await blob.arrayBuffer()).catch(() => null)
      return { blob, name, firstPage, originalSize: ready.reduce((total, item) => total + item.file.size, 0), originalName: ready[0]?.file.name }
    },
    onSuccess: async (result) => {
      setOutput(result.blob)
      setPreview(result.firstPage)
      setSavedName(result.name)
      await addOutput({ name: result.name, blob: result.blob, kind: 'pdf', tool: 'Merge PDF', originalName: result.originalName, originalSize: result.originalSize })
    },
  })

  async function addFiles(files: File[]) {
    if (files.length === 0) {
      setListError('Choose at least one PDF to continue.')
      return
    }
    setListError(null)
    setOutput(null)
    setPreview(null)
    const additions: MergeItem[] = []
    for (const file of files) {
      const rejection = pdfFileError(file)
      if (rejection) {
        setListError(`${file.name || 'This file'}: ${rejection}`)
        continue
      }
      additions.push({ id: crypto.randomUUID(), file, pages: null, error: null })
    }
    if (additions.length === 0) return
    setItems((current) => [...current, ...additions])
    for (const item of additions) {
      try {
        const pages = await getPdfPageCount(item.file)
        setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, pages } : entry)))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'This PDF could not be read.'
        setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, error: message, pages: null } : entry)))
      }
    }
  }

  function move(id: string, direction: -1 | 1) {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id)
      const next = index + direction
      if (index < 0 || next < 0 || next >= current.length) return current
      const copy = [...current]
      const [item] = copy.splice(index, 1)
      copy.splice(next, 0, item)
      return copy
    })
    setOutput(null)
  }

  const readyCount = items.filter((item) => item.pages && !item.error).length

  return (
    <ToolFrame>
      <ToolHeading title="Merge PDF Files" description="Combine multiple PDF files into one document. The original files are not changed." />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {items.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-card p-4">
              <DropZone accept="application/pdf,.pdf" multiple title="Add PDF files" detail="Add at least two PDFs. Max 50 MB each." onFiles={(files) => void addFiles(files)} />
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item, index) => (
                <li key={item.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-card p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatBytes(item.file.size)}
                      {item.pages === null && !item.error ? ' · Reading pages…' : ''}
                      {item.pages ? ` · ${item.pages} page${item.pages === 1 ? '' : 's'}` : ''}
                    </p>
                    {item.error ? <p className="text-sm text-red-300">{item.error}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="icon" aria-label={`Move ${item.file.name} up`} disabled={index === 0} onClick={() => move(item.id, -1)}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" aria-label={`Move ${item.file.name} down`} disabled={index === items.length - 1} onClick={() => move(item.id, 1)}>
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button type="button" variant="destructive" size="icon" aria-label={`Remove ${item.file.name}`} onClick={() => { setItems((current) => current.filter((entry) => entry.id !== item.id)); setOutput(null) }}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {items.length > 0 ? (
            <DropZone accept="application/pdf,.pdf" multiple title="Add more files" detail="New PDFs are added at the end. Reorder them before merging." onFiles={(files) => void addFiles(files)} />
          ) : null}
          {listError ? <Notice tone="warning">{listError}</Notice> : null}
        </div>
        <form
          className="h-fit space-y-4 rounded-3xl border border-white/10 bg-card p-4"
          noValidate
          onSubmit={form.handleSubmit((values) => {
            setOutput(null)
            mutation.mutate(values)
          })}
        >
          <h2 className="text-lg font-semibold">Output settings</h2>
          <div>
            <Label htmlFor="merge-name">Output filename</Label>
            <Input id="merge-name" className="mt-1.5" {...form.register('filename')} />
            {form.formState.errors.filename ? <p className="mt-1 text-xs text-red-300">{form.formState.errors.filename.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="page-size">Page size</Label>
            <select id="page-size" className={fieldClass + ' mt-1.5'} {...form.register('pageSize')}>
              <option value="original">Keep original size</option>
              <option value="a4">Fit onto A4</option>
            </select>
          </div>
          <p className="text-sm text-muted-foreground">{readyCount} readable PDF{readyCount === 1 ? '' : 's'} ready. Merge needs two.</p>
          {mutation.isPending ? <p className="text-sm text-emerald-200">Merging PDFs…</p> : null}
          {mutation.error ? <Notice tone="error">{mutation.error.message}</Notice> : null}
          {output ? (
            <Notice tone="success">
              Merged file is {formatBytes(output.size)}. Your source PDFs were not changed.
              {previewUrl ? <img src={previewUrl} alt="First page of merged PDF" className="mt-3 max-h-64 w-full rounded-xl bg-white object-contain" /> : null}
            </Notice>
          ) : null}
          <Button type="submit" className="w-full" data-testid="primary-action" disabled={readyCount < 2 || mutation.isPending || items.some((item) => item.pages === null || item.error)}>
            Merge PDFs
          </Button>
          <Button type="button" variant="outline" className="w-full" data-testid="download-output" disabled={!output} onClick={() => output && downloadBlob(output, savedName)}>
            Download merged PDF
          </Button>
          <LibrarySaveActions blob={output} filename={savedName} mime="application/pdf" />
        </form>
      </div>
    </ToolFrame>
  )
}
