import { parsePageRanges, type PageRangeResult } from '@/lib/page-ranges'

export const MAX_PDF_EXPORT_PAGES = 8

export type CropInsets = {
  top: number
  right: number
  bottom: number
  left: number
}

export type CropRect = {
  x: number
  y: number
  width: number
  height: number
}

export function imageConversionNote(format: 'jpeg' | 'png' | 'webp'): string {
  const kept = 'The image was converted in this browser. Your original file was not changed.'
  if (format === 'jpeg') {
    return `${kept} JPG cannot preserve transparency, so any transparent areas were filled with white.`
  }
  const name = format === 'png' ? 'PNG' : 'WebP'
  return `${kept} ${name} keeps transparency when the source image has it.`
}

export function pagesForImageExport(input: string, pageCount: number): PageRangeResult {
  const parsed = parsePageRanges(input, pageCount)
  if ('error' in parsed) return parsed
  if (parsed.pages.length > MAX_PDF_EXPORT_PAGES) {
    return {
      error: `Export up to ${MAX_PDF_EXPORT_PAGES} pages at a time so the browser stays responsive.`,
    }
  }
  return parsed
}

export function clampCropPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(40, Math.max(0, value))
}

export function cropRect(width: number, height: number, insets: CropInsets): CropRect | { error: string } {
  if (width < 1 || height < 1) return { error: 'The image has no pixels to crop.' }
  const top = clampCropPercent(insets.top)
  const right = clampCropPercent(insets.right)
  const bottom = clampCropPercent(insets.bottom)
  const left = clampCropPercent(insets.left)
  const x = Math.round((width * left) / 100)
  const y = Math.round((height * top) / 100)
  const cropWidth = Math.round(width - x - (width * right) / 100)
  const cropHeight = Math.round(height - y - (height * bottom) / 100)
  if (cropWidth < 1 || cropHeight < 1) return { error: 'The crop leaves no pixels. Reduce the crop edges.' }
  return { x, y, width: cropWidth, height: cropHeight }
}

export function rotatedSize(width: number, height: number, quarterTurns: number): { width: number; height: number } {
  const quarter = ((quarterTurns % 4) + 4) % 4
  if (quarter % 2 === 1) return { width: height, height: width }
  return { width, height }
}

export function stopMediaStream(stream: { getTracks: () => { stop: () => void }[] } | null): void {
  if (!stream) return
  for (const track of stream.getTracks()) track.stop()
}

export const ocrLanguages = [
  { code: 'eng', label: 'English' },
  { code: 'urd', label: 'Urdu' },
  { code: 'ara', label: 'Arabic' },
  { code: 'fra', label: 'French' },
  { code: 'deu', label: 'German' },
  { code: 'spa', label: 'Spanish' },
] as const

export type OcrLanguageCode = (typeof ocrLanguages)[number]['code']

export function isOcrLanguage(value: string): value is OcrLanguageCode {
  return ocrLanguages.some((language) => language.code === value)
}

export function ocrReview(text: string): { text: string; warning: string | null } {
  const trimmed = text.split('\0').join('').trim()
  if (!trimmed) {
    return {
      text: '',
      warning: 'No text was found. The image may be blank, blurry, or in a language that was not selected.',
    }
  }
  return { text, warning: null }
}
