import { describe, expect, it } from 'vitest'

function filePathFromUrl(url: URL): string {
  const path = decodeURIComponent(url.pathname)
  return /^\/[A-Za-z]:/.test(path) ? path.slice(1) : path
}
import {
  clampCropPercent,
  cropRect,
  imageConversionNote,
  isOcrLanguage,
  ocrReview,
  pagesForImageExport,
  rotatedSize,
  stopMediaStream,
} from '@/lib/conversion'
import { extensionOf, mimeOf } from '@/lib/format'
import { recognizeDocument } from '@/lib/ocr'

describe('image conversion notes', () => {
  it('explains that JPG cannot keep transparency', () => {
    expect(imageConversionNote('jpeg')).toContain('cannot preserve transparency')
    expect(imageConversionNote('png')).toContain('keeps transparency')
    expect(imageConversionNote('webp')).toContain('keeps transparency')
  })

  it('uses the matching MIME type and extension', () => {
    expect(mimeOf('jpeg')).toBe('image/jpeg')
    expect(extensionOf('jpeg')).toBe('jpg')
    expect(mimeOf('png')).toBe('image/png')
    expect(extensionOf('png')).toBe('png')
    expect(mimeOf('webp')).toBe('image/webp')
    expect(extensionOf('webp')).toBe('webp')
  })
})

describe('pdf page export selection', () => {
  it('accepts a short range and rejects more than eight pages', () => {
    expect(pagesForImageExport('1-3, 5', 10)).toEqual({ pages: [1, 2, 3, 5] })
    expect(pagesForImageExport('1-9', 12)).toEqual({
      error: 'Export up to 8 pages at a time so the browser stays responsive.',
    })
    const reversed = pagesForImageExport('2-1', 4)
    const outside = pagesForImageExport('8', 3)
    expect('error' in reversed && reversed.error).toContain('reversed')
    expect('error' in outside && outside.error).toContain('outside')
  })
})

describe('scan adjustments', () => {
  it('rotates dimensions and crops inside the image', () => {
    expect(rotatedSize(200, 100, 1)).toEqual({ width: 100, height: 200 })
    expect(rotatedSize(200, 100, 2)).toEqual({ width: 200, height: 100 })
    expect(cropRect(100, 80, { top: 10, right: 0, bottom: 0, left: 25 })).toEqual({
      x: 25,
      y: 8,
      width: 75,
      height: 72,
    })
    expect(clampCropPercent(80)).toBe(40)
    expect('error' in cropRect(2, 2, { top: 40, right: 40, bottom: 40, left: 40 })).toBe(true)
  })

  it('stops every camera track', () => {
    const stopped: string[] = []
    stopMediaStream({
      getTracks: () => [
        { stop: () => stopped.push('video') },
        { stop: () => stopped.push('audio') },
      ],
    })
    stopMediaStream(null)
    expect(stopped).toEqual(['video', 'audio'])
  })
})

describe('ocr results', () => {
  it('does not invent text when the engine returns nothing', () => {
    expect(ocrReview('   ')).toEqual({
      text: '',
      warning: 'No text was found. The image may be blank, blurry, or in a language that was not selected.',
    })
    expect(ocrReview('Hello')).toEqual({ text: 'Hello', warning: null })
    expect(isOcrLanguage('eng')).toBe(true)
    expect(isOcrLanguage('klingon')).toBe(false)
  })

  it('rejects an unavailable language before processing', async () => {
    await expect(recognizeDocument(new Blob(['not-an-image']), 'klingon')).rejects.toThrow(/not available/)
  })
})

describe('ocr on a real image', () => {
  it('reads HI from a sample PNG', async () => {
    const sample = filePathFromUrl(new URL('./fixtures/hi.png', import.meta.url))
    const result = await recognizeDocument(sample, 'eng')
    expect(result.text.trim()).toBe('HI')
    expect(result.warning).toBeNull()
  }, 120000)
})
