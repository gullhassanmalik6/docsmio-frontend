import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { DropZone } from '@/components/drop-zone'
import { LibrarySaveActions } from '@/components/library-save'
import { ImageComparison } from '@/components/image-comparison'
import { Notice } from '@/components/notice'
import { ToolFrame, ToolHeading } from '@/components/tool-heading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { useHistory } from '@/context/history-context'
import { useObjectUrl, usePageTitle } from '@/hooks/use-browser'
import { downloadBlob, formatBytes, targetToBytes } from '@/lib/format'
import { processImage, type ImageProcessResult } from '@/lib/image-process'
import {
  aspectRatio,
  dimensionError,
  fitWithinLimits,
  formatSavings,
  imageExportName,
  imageFileError,
  imageFormatLabel,
  percentFromWidth,
  pixelBudgetError,
  resizeLinked,
  savingsPercent,
  scaleError,
  sizeFromPercent,
  targetSizeError,
} from '@/lib/image-math'
import { loadPreferences } from '@/lib/preferences'
import { fieldClass } from '@/lib/utils'

const schema = z
  .object({
    targetSize: z.number({ invalid_type_error: 'Enter a target size.' }),
    targetUnit: z.enum(['KB', 'MB']),
    width: z.number({ invalid_type_error: 'Enter a width.' }),
    height: z.number({ invalid_type_error: 'Enter a height.' }),
    scale: z.number({ invalid_type_error: 'Enter a scale percentage.' }),
    lockAspect: z.boolean(),
    quality: z.number().min(5).max(100),
    format: z.enum(['jpeg', 'png', 'webp']),
    preventUpscale: z.boolean(),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex color.'),
  })
  .superRefine((values, context) => {
    const targetError = targetSizeError(targetToBytes(values.targetSize, values.targetUnit))
    if (targetError) context.addIssue({ code: z.ZodIssueCode.custom, path: ['targetSize'], message: targetError })
    const widthError = dimensionError(values.width)
    if (widthError) context.addIssue({ code: z.ZodIssueCode.custom, path: ['width'], message: widthError })
    const heightError = dimensionError(values.height)
    if (heightError) context.addIssue({ code: z.ZodIssueCode.custom, path: ['height'], message: heightError })
    const scaleMessage = scaleError(values.scale)
    if (scaleMessage) context.addIssue({ code: z.ZodIssueCode.custom, path: ['scale'], message: scaleMessage })
    if (!widthError && !heightError) {
      const budgetError = pixelBudgetError(values.width, values.height)
      if (budgetError) context.addIssue({ code: z.ZodIssueCode.custom, path: ['width'], message: budgetError })
    }
  })

type ImageForm = z.infer<typeof schema>

type OutputState = ImageProcessResult & { filename: string }

type SourceState = {
  file: File
  width: number
  height: number
  label: string
}

export function ImageResizePage() {
  usePageTitle('Image Resize & Compress — Docsmio')
  const preferences = loadPreferences()
  const { addOutput } = useHistory()
  const aspectRef = useRef(1)
  const workingSize = useRef({ width: 1, height: 1 })
  const [source, setSource] = useState<SourceState | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [output, setOutput] = useState<OutputState | null>(null)
  const [advanced, setAdvanced] = useState(false)
  const originalUrl = useObjectUrl(source?.file)
  const outputUrl = useObjectUrl(output?.blob)

  const form = useForm<ImageForm>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      targetSize: preferences.defaultTargetKb,
      targetUnit: 'KB',
      width: 1080,
      height: 1080,
      scale: 100,
      lockAspect: true,
      quality: preferences.defaultQuality,
      format: preferences.defaultFormat,
      preventUpscale: true,
      background: '#ffffff',
    },
  })

  const mutation = useMutation({
    mutationFn: async (values: ImageForm) => {
      if (!source) throw new Error('Add an image first.')
      const result = await processImage(source.file, {
        targetBytes: targetToBytes(values.targetSize, values.targetUnit),
        width: values.width,
        height: values.height,
        quality: values.quality,
        format: values.format,
        preventUpscale: values.preventUpscale,
        background: values.background,
      })
      const start = workingSize.current
      const resized = values.width !== start.width || values.height !== start.height
      const filename = imageExportName(source.file.name, values.format, resized ? 'resized' : 'compressed')
      return { ...result, filename }
    },
    onSuccess: async (result) => {
      setOutput(result)
      await addOutput({
        name: result.filename,
        blob: result.blob,
        kind: 'image',
        tool: 'Image Resize & Compress',
        originalName: source?.file.name,
        originalSize: source?.file.size,
      })
    },
  })

  async function onFiles(files: File[]) {
    const next = files[0]
    if (!next) {
      setFileError('Choose an image to continue.')
      return
    }
    const rejection = imageFileError(next)
    if (rejection) {
      setFileError(rejection)
      return
    }
    try {
      const bitmap = await createImageBitmap(next)
      const fitted = fitWithinLimits(bitmap.width, bitmap.height)
      workingSize.current = { width: fitted.width, height: fitted.height }
      aspectRef.current = aspectRatio(fitted.width, fitted.height) || 1
      form.setValue('width', fitted.width, { shouldValidate: true })
      form.setValue('height', fitted.height, { shouldValidate: true })
      form.setValue('scale', percentFromWidth(bitmap.width, fitted.width), { shouldValidate: true })
      setSource({ file: next, width: bitmap.width, height: bitmap.height, label: imageFormatLabel(next) })
      setFileError(
        fitted.reduced
          ? `This image is ${bitmap.width}×${bitmap.height} px. The starting size was reduced to ${fitted.width}×${fitted.height} px so the browser can process it.`
          : null,
      )
      bitmap.close()
      setOutput(null)
      mutation.reset()
    } catch {
      setFileError('This image could not be read. It may be corrupt or in an unsupported format.')
    }
  }

  function updateWidth(value: number) {
    form.setValue('width', value, { shouldValidate: true })
    if (dimensionError(value)) return
    const next = resizeLinked('width', value, form.getValues('height'), aspectRef.current, form.getValues('lockAspect'))
    if (form.getValues('lockAspect')) form.setValue('height', next.height, { shouldValidate: true })
    form.setValue('scale', percentFromWidth(workingSize.current.width, next.width), { shouldValidate: true })
  }

  function updateHeight(value: number) {
    form.setValue('height', value, { shouldValidate: true })
    if (dimensionError(value)) return
    const next = resizeLinked('height', value, form.getValues('width'), aspectRef.current, form.getValues('lockAspect'))
    if (form.getValues('lockAspect')) {
      form.setValue('width', next.width, { shouldValidate: true })
      form.setValue('scale', percentFromWidth(workingSize.current.width, next.width), { shouldValidate: true })
    }
  }

  function updateScale(value: number) {
    form.setValue('scale', value, { shouldValidate: true })
    if (scaleError(value)) return
    const next = sizeFromPercent(workingSize.current.width, workingSize.current.height, value)
    aspectRef.current = aspectRatio(next.width, next.height) || aspectRef.current
    form.setValue('width', next.width, { shouldValidate: true })
    form.setValue('height', next.height, { shouldValidate: true })
  }

  function resetAll() {
    setSource(null)
    setOutput(null)
    setFileError(null)
    workingSize.current = { width: 1, height: 1 }
    aspectRef.current = 1
    mutation.reset()
    form.reset()
  }

  const format = form.watch('format')
  const quality = form.watch('quality')
  const savings = source && output ? formatSavings(savingsPercent(source.file.size, output.blob.size)) : null

  return (
    <ToolFrame>
      <ToolHeading
        title="Image Resize & Compress"
        description="Resize your image, reduce file size toward an exact KB or MB target, and keep the original file unchanged."
      />
      <form
        className="space-y-5"
        onSubmit={form.handleSubmit((values) => {
          setOutput(null)
          mutation.mutate(values)
        })}
        noValidate
      >
        <DropZone
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          title="Drag and drop your image here or click to browse"
          detail="Supports JPG, PNG, and WebP. Max file size 20 MB."
          onFiles={(files) => void onFiles(files)}
          selected={source ? <span className="font-medium">{source.file.name}</span> : undefined}
        />
        {fileError ? (
          <p className="text-sm text-amber-200" data-testid="file-error">
            {fileError}
          </p>
        ) : null}
        {source ? (
          <dl className="grid gap-3 rounded-3xl border border-white/10 bg-card p-4 text-sm sm:grid-cols-4" data-testid="source-meta">
            <div>
              <dt className="text-xs text-muted-foreground">File</dt>
              <dd className="truncate font-medium">{source.file.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Dimensions</dt>
              <dd>
                {source.width}×{source.height} px
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Format</dt>
              <dd>{source.label}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">File size</dt>
              <dd>{formatBytes(source.file.size)}</dd>
            </div>
          </dl>
        ) : null}

        <ImageComparison
          originalUrl={originalUrl}
          outputUrl={outputUrl}
          pending={mutation.isPending}
          original={source ? { bytes: source.file.size, width: source.width, height: source.height, format: source.label } : null}
          output={output ? { bytes: output.blob.size, width: output.width, height: output.height, reachedTarget: output.reachedTarget } : null}
        />

        <div className="grid gap-4 rounded-3xl border border-white/10 bg-card p-4 md:grid-cols-2 xl:grid-cols-6">
          <div>
            <Label htmlFor="targetSize">Target file size</Label>
            <div className="mt-1.5 flex gap-2">
              <Input id="targetSize" type="number" min={1} step="1" {...form.register('targetSize', { valueAsNumber: true })} />
              <select aria-label="Target unit" className={fieldClass + ' w-24'} {...form.register('targetUnit')}>
                <option value="KB">KB</option>
                <option value="MB">MB</option>
              </select>
            </div>
            {form.formState.errors.targetSize ? <p className="mt-1 text-xs text-red-300">{form.formState.errors.targetSize.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="width">Width (px)</Label>
            <Input
              id="width"
              type="number"
              min={1}
              className="mt-1.5"
              {...form.register('width', { valueAsNumber: true, onChange: (event) => updateWidth(Number(event.target.value)) })}
            />
            {form.formState.errors.width ? <p className="mt-1 text-xs text-red-300">{form.formState.errors.width.message}</p> : null}
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="height">Height (px)</Label>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                Lock ratio
                <Controller
                  control={form.control}
                  name="lockAspect"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      aria-label="Lock aspect ratio"
                      onCheckedChange={(checked) => {
                        field.onChange(checked)
                        const width = form.getValues('width')
                        const height = form.getValues('height')
                        if (checked && width > 0 && height > 0) aspectRef.current = aspectRatio(width, height)
                      }}
                    />
                  )}
                />
              </span>
            </div>
            <Input
              id="height"
              type="number"
              min={1}
              className="mt-1.5"
              {...form.register('height', { valueAsNumber: true, onChange: (event) => updateHeight(Number(event.target.value)) })}
            />
            {form.formState.errors.height ? <p className="mt-1 text-xs text-red-300">{form.formState.errors.height.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="scale">Scale (%)</Label>
            <Input
              id="scale"
              type="number"
              min={1}
              max={400}
              step="0.1"
              className="mt-1.5"
              {...form.register('scale', { valueAsNumber: true, onChange: (event) => updateScale(Number(event.target.value)) })}
            />
            {form.formState.errors.scale ? <p className="mt-1 text-xs text-red-300">{form.formState.errors.scale.message}</p> : <p className="mt-1 text-xs text-muted-foreground">100% matches the starting size.</p>}
          </div>
          <div>
            <Label htmlFor="quality">Image quality · {quality}%</Label>
            <Controller
              control={form.control}
              name="quality"
              render={({ field }) => (
                <Slider id="quality" className="mt-4" min={5} max={100} step={1} value={[field.value]} onValueChange={(value) => field.onChange(value[0] ?? field.value)} aria-label="Image quality" />
              )}
            />
            <p className="mt-2 text-xs text-muted-foreground">Highest quality used while chasing the target. PNG ignores it.</p>
          </div>
          <div>
            <Label htmlFor="format">Output format</Label>
            <select id="format" className={fieldClass + ' mt-1.5'} {...form.register('format')}>
              <option value="jpeg">JPG (recommended)</option>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-card">
          <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium" aria-expanded={advanced} onClick={() => setAdvanced((open) => !open)}>
            Advanced options
            <span className="text-muted-foreground">{advanced ? 'Hide' : 'Show'}</span>
          </button>
          {advanced ? (
            <div className="grid gap-4 border-t border-white/10 px-4 py-4 md:grid-cols-2">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="block font-medium">Prevent upscaling</span>
                  <span className="text-muted-foreground">Keep the export at or below the original pixel size.</span>
                </span>
                <Controller control={form.control} name="preventUpscale" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Prevent upscaling" />} />
              </label>
              <div>
                <Label htmlFor="background">Background for JPG</Label>
                <Input id="background" type="color" className="mt-1.5 h-11 w-24 cursor-pointer px-1" {...form.register('background')} disabled={format !== 'jpeg'} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {format === 'jpeg'
                    ? 'Transparent pixels are flattened onto this color. JPG cannot keep transparency.'
                    : 'PNG and WebP keep transparency, so the background color is not applied.'}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {mutation.isPending ? (
          <Notice tone="info">
            <span data-testid="process-status">Processing the image in this browser.</span>
          </Notice>
        ) : null}
        {mutation.error ? <Notice tone="error">{mutation.error.message}</Notice> : null}
        {output ? (
          <Notice tone={output.reachedTarget ? 'success' : 'warning'}>
            <span data-testid="result-note">{output.note}</span>
            <span className="mt-1 block" data-testid="result-size">
              Original {source ? `${source.width}×${source.height} px · ${formatBytes(source.file.size)}` : ''} · Output {output.width}×{output.height} px · {formatBytes(output.blob.size)}
              {output.reachedTarget ? ' · Target reached.' : ' · Target not reached.'}
              {savings ? ` ${savings}` : ''}
            </span>
          </Notice>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={resetAll}>
            Reset
          </Button>
          <Button type="button" variant="outline" data-testid="download-output" disabled={!output || mutation.isPending} onClick={() => output && downloadBlob(output.blob, output.filename)}>
            Download Image
          </Button>
          <Button type="submit" data-testid="primary-action" disabled={!source || mutation.isPending}>
            {mutation.isPending ? 'Processing…' : 'Resize Image'}
          </Button>
        </div>
        <LibrarySaveActions blob={output?.blob ?? null} filename={output?.filename ?? 'image'} mime={output?.blob.type || 'image/jpeg'} />
      </form>
    </ToolFrame>
  )
}
