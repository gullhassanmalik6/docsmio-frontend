import { isHeic, isSupportedImage, MAX_IMAGE_BYTES } from '@/lib/files'
import { extensionOf } from '@/lib/format'

export const MAX_EDGE = 8000
export const MAX_PIXELS = 16_000_000

export function dimensionError(value: number): string | null {
  if (!Number.isFinite(value)) return 'Enter a whole number of pixels.'
  if (!Number.isInteger(value)) return 'Use whole pixels.'
  if (value < 1) return 'Dimensions must be at least 1 pixel.'
  if (value > MAX_EDGE) return 'Each side must be 8000 px or less.'
  return null
}

export function scaleError(value: number): string | null {
  if (!Number.isFinite(value)) return 'Enter a scale percentage.'
  if (value <= 0) return 'Scale must be greater than 0%.'
  if (value > 400) return 'Scale must be 400% or less.'
  return null
}

export function targetSizeError(bytes: number): string | null {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Enter a target size.'
  if (bytes < 10 * 1024) return 'Use a target of at least 10 KB.'
  if (bytes > MAX_IMAGE_BYTES) return 'Target size must be 20 MB or less.'
  return null
}

export function pixelBudgetError(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width * height > MAX_PIXELS) {
    return 'These dimensions need more memory than the browser can safely use. Reduce the width or height and try again.'
  }
  return null
}

export function imageFileError(file: File): string | null {
  if (file.size <= 0) return 'This file is empty. Choose an image that has content.'
  if (isHeic(file)) return 'HEIC images are not supported here. Export a JPG, PNG, or WebP and try again.'
  if (!isSupportedImage(file)) return 'Use a JPG, PNG, or WebP image.'
  if (file.size > MAX_IMAGE_BYTES) return 'This image is larger than the 20 MB limit.'
  return null
}

export function imageFormatLabel(file: { type: string; name: string }): string {
  const type = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  if (type === 'image/jpeg' || name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'JPEG'
  if (type === 'image/png' || name.endsWith('.png')) return 'PNG'
  if (type === 'image/webp' || name.endsWith('.webp')) return 'WebP'
  return 'Unknown'
}

export function aspectRatio(width: number, height: number): number {
  if (!(height > 0) || !Number.isFinite(width)) return 0
  return width / height
}

export function sizeFromWidth(width: number, aspect: number): { width: number; height: number } {
  const nextWidth = Math.max(1, Math.round(width))
  if (!(aspect > 0)) return { width: nextWidth, height: 1 }
  return { width: nextWidth, height: Math.max(1, Math.round(nextWidth / aspect)) }
}

export function sizeFromHeight(height: number, aspect: number): { width: number; height: number } {
  const nextHeight = Math.max(1, Math.round(height))
  if (!(aspect > 0)) return { width: 1, height: nextHeight }
  return { width: Math.max(1, Math.round(nextHeight * aspect)), height: nextHeight }
}

export function resizeLinked(
  axis: 'width' | 'height',
  value: number,
  other: number,
  aspect: number,
  locked: boolean,
): { width: number; height: number } {
  if (!locked) {
    const next = Math.max(1, Math.round(value))
    return axis === 'width' ? { width: next, height: other } : { width: other, height: next }
  }
  return axis === 'width' ? sizeFromWidth(value, aspect) : sizeFromHeight(value, aspect)
}

export function sizeFromPercent(naturalWidth: number, naturalHeight: number, percent: number): { width: number; height: number } {
  const factor = percent / 100
  return {
    width: Math.max(1, Math.round(naturalWidth * factor)),
    height: Math.max(1, Math.round(naturalHeight * factor)),
  }
}

export function percentFromWidth(naturalWidth: number, width: number): number {
  if (!(naturalWidth > 0) || !Number.isFinite(width)) return 100
  return Math.round((width / naturalWidth) * 1000) / 10
}

export function fitWithinLimits(width: number, height: number): { width: number; height: number; reduced: boolean } {
  let nextWidth = Math.max(1, Math.round(width))
  let nextHeight = Math.max(1, Math.round(height))
  let reduced = false
  const edge = Math.max(nextWidth, nextHeight)
  if (edge > MAX_EDGE) {
    const scale = MAX_EDGE / edge
    nextWidth = Math.max(1, Math.round(nextWidth * scale))
    nextHeight = Math.max(1, Math.round(nextHeight * scale))
    reduced = true
  }
  if (nextWidth * nextHeight > MAX_PIXELS) {
    const scale = Math.sqrt(MAX_PIXELS / (nextWidth * nextHeight))
    nextWidth = Math.max(1, Math.floor(nextWidth * scale))
    nextHeight = Math.max(1, Math.floor(nextHeight * scale))
    reduced = true
  }
  return { width: nextWidth, height: nextHeight, reduced }
}

export function targetWasReached(outputBytes: number, targetBytes: number): boolean {
  return Number.isFinite(outputBytes) && outputBytes >= 0 && Number.isFinite(targetBytes) && outputBytes <= targetBytes
}

export function savingsPercent(originalBytes: number, outputBytes: number): number | null {
  if (!Number.isFinite(originalBytes) || originalBytes <= 0 || !Number.isFinite(outputBytes) || outputBytes < 0) return null
  return Math.round(((originalBytes - outputBytes) / originalBytes) * 1000) / 10
}

export function formatSavings(percent: number | null): string | null {
  if (percent === null) return null
  if (percent > 0) return `Saved ${percent}% of the original file size.`
  if (percent < 0) return `The output is ${Math.abs(percent)}% larger than the original.`
  return 'The file size is unchanged.'
}

export function imageExportName(originalName: string, format: 'jpeg' | 'png' | 'webp', kind: 'compressed' | 'resized'): string {
  const stem = originalName
    .replace(/\.[^.]+$/, '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return `${stem || 'photo'}_${kind}.${extensionOf(format)}`
}

export function compressionNote(input: {
  format: 'jpeg' | 'png' | 'webp'
  reachedTarget: boolean
  scaledDown: boolean
  width: number
  height: number
  flattenedTransparency: boolean
}): string {
  let note: string
  if (input.format === 'png') {
    if (input.scaledDown && input.reachedTarget) {
      note = `PNG has no quality slider, so the image was scaled to ${input.width}×${input.height} px to meet the target.`
    } else if (!input.reachedTarget) {
      note =
        'This PNG is still above the target. PNG cannot shrink a photo the way JPEG can. Try JPG or WebP if the portal only cares about file size.'
    } else {
      note = 'The PNG was exported as a new file. Your original was not changed.'
    }
  } else if (input.reachedTarget && input.scaledDown) {
    note = `Meeting the target required a smaller image than the dimensions you entered. Output is ${input.width}×${input.height} px.`
  } else if (!input.reachedTarget) {
    note = 'The target size could not be reached without making the image unusably small. This is the smallest file these settings will produce.'
  } else {
    note = 'The exported file meets the target size. Your original file was not changed.'
  }
  if (input.flattenedTransparency) {
    note += ' Transparent areas were filled with the background color because JPG does not keep transparency.'
  }
  return note
}

export async function binarySearchQuality(
  measure: (quality: number) => Promise<number>,
  targetBytes: number,
  maxQuality: number,
  steps = 8,
): Promise<{ quality: number; size: number; reached: boolean }> {
  const ceiling = Math.min(1, Math.max(0.08, maxQuality))
  let low = 0.08
  let high = ceiling
  let bestQuality = low
  let bestSize = Number.POSITIVE_INFINITY
  let reached = false

  for (let step = 0; step < steps; step += 1) {
    const quality = (low + high) / 2
    const size = await measure(quality)
    if (!Number.isFinite(size) || size < 0) throw new Error('The image could not be encoded.')
    if (size <= targetBytes) {
      reached = true
      bestQuality = quality
      bestSize = size
      low = quality
    } else {
      if (!reached && size < bestSize) {
        bestQuality = quality
        bestSize = size
      }
      high = quality
    }
  }

  if (!Number.isFinite(bestSize)) throw new Error('The image could not be encoded.')
  return { quality: bestQuality, size: bestSize, reached: targetWasReached(bestSize, targetBytes) }
}
