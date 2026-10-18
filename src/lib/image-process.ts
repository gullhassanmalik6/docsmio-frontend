import { cropRect, imageConversionNote, rotatedSize, type CropInsets } from '@/lib/conversion'
import { mimeOf } from '@/lib/format'
import { binarySearchQuality, compressionNote, dimensionError, imageFileError, pixelBudgetError, targetWasReached } from '@/lib/image-math'

export type ImageFormat = 'jpeg' | 'png' | 'webp'

export type ImageProcessOptions = {
  targetBytes: number
  width: number
  height: number
  quality: number
  format: ImageFormat
  preventUpscale: boolean
  background: string
}

export type ImageProcessResult = {
  blob: Blob
  width: number
  height: number
  reachedTarget: boolean
  note: string
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('This browser could not encode the image.'))
        else resolve(blob)
      },
      type,
      quality,
    )
  })
}

async function drawImage(
  source: CanvasImageSource,
  width: number,
  height: number,
  format: ImageFormat,
  background: string,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot process images.')
  if (format === 'jpeg') {
    context.fillStyle = background || '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

function assertImage(file: File) {
  const error = imageFileError(file)
  if (error) throw new Error(error)
}

function assertEncodedType(blob: Blob, format: ImageFormat) {
  if (!blob.type) return
  const expected = mimeOf(format)
  if (blob.type === expected) return
  if (format === 'webp') throw new Error('This browser cannot encode WebP. Choose JPG or PNG instead.')
  throw new Error('This browser could not encode the image.')
}

function sampleHasTransparency(source: CanvasImageSource): boolean {
  const canvas = document.createElement('canvas')
  canvas.width = 48
  canvas.height = 48
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return false
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  for (let index = 3; index < pixels.length; index += 16) {
    if (pixels[index] < 250) return true
  }
  return false
}

export async function processImage(file: File, options: ImageProcessOptions): Promise<ImageProcessResult> {
  assertImage(file)
  const widthError = dimensionError(Math.round(options.width))
  const heightError = dimensionError(Math.round(options.height))
  if (widthError || heightError) throw new Error(widthError ?? heightError ?? 'Enter valid dimensions.')
  const budgetError = pixelBudgetError(options.width, options.height)
  if (budgetError) throw new Error(budgetError)
  if (!Number.isFinite(options.targetBytes) || options.targetBytes <= 0) throw new Error('Enter a target size.')

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('This image could not be read. It may be corrupt or in an unsupported format.')
  })

  let width = Math.round(options.width)
  let height = Math.round(options.height)
  if (options.preventUpscale) {
    width = Math.min(width, bitmap.width)
    height = Math.min(height, bitmap.height)
  }

  const mime = mimeOf(options.format)
  const maxQuality = Math.min(1, Math.max(0.05, options.quality / 100))
  const flattenedTransparency = options.format === 'jpeg' && sampleHasTransparency(bitmap)

  try {
    if (options.format === 'png') {
      return await compressPng(bitmap, width, height, options, mime, flattenedTransparency)
    }
    return await compressLossy(bitmap, width, height, options, mime, maxQuality, flattenedTransparency)
  } finally {
    bitmap.close()
  }
}

async function compressPng(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  options: ImageProcessOptions,
  mime: string,
  flattenedTransparency: boolean,
): Promise<ImageProcessResult> {
  let outputWidth = width
  let outputHeight = height
  let canvas = await drawImage(bitmap, outputWidth, outputHeight, 'png', options.background)
  let blob = await canvasToBlob(canvas, mime)
  assertEncodedType(blob, 'png')
  let steps = 0
  while (blob.size > options.targetBytes && steps < 8 && outputWidth > 32 && outputHeight > 32) {
    outputWidth = Math.max(1, Math.round(outputWidth * 0.82))
    outputHeight = Math.max(1, Math.round(outputHeight * 0.82))
    canvas = await drawImage(bitmap, outputWidth, outputHeight, 'png', options.background)
    blob = await canvasToBlob(canvas, mime)
    assertEncodedType(blob, 'png')
    steps += 1
  }
  const reachedTarget = targetWasReached(blob.size, options.targetBytes)
  const scaledDown = outputWidth !== width || outputHeight !== height
  return {
    blob,
    width: outputWidth,
    height: outputHeight,
    reachedTarget,
    note: compressionNote({ format: 'png', reachedTarget, scaledDown, width: outputWidth, height: outputHeight, flattenedTransparency }),
  }
}

async function compressLossy(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  options: ImageProcessOptions,
  mime: string,
  maxQuality: number,
  flattenedTransparency: boolean,
): Promise<ImageProcessResult> {
  let outputWidth = width
  let outputHeight = height
  let bestBlob: Blob | null = null
  let bestWidth = width
  let bestHeight = height

  for (let shrink = 0; shrink < 8; shrink += 1) {
    const encoded = new Map<string, Blob>()
    const found = await binarySearchQuality(async (quality) => {
      const canvas = await drawImage(bitmap, outputWidth, outputHeight, options.format, options.background)
      const blob = await canvasToBlob(canvas, mime, quality)
      assertEncodedType(blob, options.format)
      encoded.set(quality.toFixed(6), blob)
      return blob.size
    }, options.targetBytes, maxQuality)
    const blob = encoded.get(found.quality.toFixed(6)) ?? null
    if (!blob || blob.size !== found.size) throw new Error('The image could not be encoded.')
    bestBlob = blob
    bestWidth = outputWidth
    bestHeight = outputHeight
    if (targetWasReached(blob.size, options.targetBytes)) break
    if (outputWidth <= 32 || outputHeight <= 32) break
    outputWidth = Math.max(1, Math.round(outputWidth * 0.82))
    outputHeight = Math.max(1, Math.round(outputHeight * 0.82))
  }

  if (!bestBlob) throw new Error('The image could not be encoded.')

  const reachedTarget = targetWasReached(bestBlob.size, options.targetBytes)
  const scaledDown = bestWidth !== width || bestHeight !== height
  return {
    blob: bestBlob,
    width: bestWidth,
    height: bestHeight,
    reachedTarget,
    note: compressionNote({
      format: options.format,
      reachedTarget,
      scaledDown,
      width: bestWidth,
      height: bestHeight,
      flattenedTransparency,
    }),
  }
}

export async function convertImage(file: File, format: ImageFormat, quality: number): Promise<ImageProcessResult> {
  assertImage(file)
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('This image could not be read. It may be corrupt or in an unsupported format.')
  })
  const width = bitmap.width
  const height = bitmap.height
  bitmap.close()
  const result = await processImage(file, {
    targetBytes: Number.MAX_SAFE_INTEGER,
    width,
    height,
    quality,
    format,
    preventUpscale: true,
    background: '#ffffff',
  })
  return {
    ...result,
    reachedTarget: true,
    note: imageConversionNote(format),
  }
}

export async function bakeScanImage(source: Blob, quarterTurns: number, insets: CropInsets): Promise<Blob> {
  const quarter = ((quarterTurns % 4) + 4) % 4
  const untouched =
    quarter === 0 && insets.top === 0 && insets.right === 0 && insets.bottom === 0 && insets.left === 0
  if (untouched) return source

  const bitmap = await createImageBitmap(source).catch(() => {
    throw new Error('This image could not be prepared.')
  })
  try {
    const oriented = rotatedSize(bitmap.width, bitmap.height, quarter)
    const staged = document.createElement('canvas')
    staged.width = oriented.width
    staged.height = oriented.height
    const stagedContext = staged.getContext('2d')
    if (!stagedContext) throw new Error('This browser could not prepare the image.')
    stagedContext.translate(oriented.width / 2, oriented.height / 2)
    stagedContext.rotate((quarter * Math.PI) / 2)
    stagedContext.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)

    const rect = cropRect(oriented.width, oriented.height, insets)
    if ('error' in rect) throw new Error(rect.error)
    const canvas = document.createElement('canvas')
    canvas.width = rect.width
    canvas.height = rect.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser could not prepare the image.')
    context.drawImage(staged, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height)
    const type = source.type === 'image/png' || source.type === 'image/webp' ? source.type : 'image/jpeg'
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, type === 'image/png' ? undefined : 0.92))
    if (!blob) throw new Error('The adjusted image could not be created.')
    return blob
  } finally {
    bitmap.close()
  }
}

export async function enhancePreview(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('This browser cannot adjust the preview.')
  }
  context.filter = 'contrast(1.18) saturate(0.85)'
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvasToBlob(canvas, 'image/jpeg', 0.92)
}
