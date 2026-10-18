import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import type { PDFPageProxy } from 'pdfjs-dist'
import { MAX_PDF_EXPORT_PAGES } from '@/lib/conversion'
import { isJpegFile, isSupportedImage, MAX_PDF_BYTES, MAX_PDF_RASTER_PAGES } from '@/lib/files'
import { mimeOf } from '@/lib/format'
import type { ImageFormat } from '@/lib/image-process'
import { compressionFacts, pdfFileError, type CompressMode } from '@/lib/pdf-report'

export type { CompressMode }

export type PdfPreview = Blob | null

export type CompressResult = {
  blob: Blob | null
  preview: PdfPreview
  originalPreview: PdfPreview
  reduced: boolean
  reachedTarget: boolean
  note: string
}

type Progress = (message: string) => void

let workerReady = false

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  if (!workerReady) {
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    workerReady = true
  }
  return pdfjs
}

export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes)
  return new Blob([copy], { type })
}

export function describePdfError(error: unknown): string {
  if (error instanceof Error) {
    const encrypted = error.name === 'PasswordException' || error.name === 'EncryptedPDFError' || /encrypt|password/i.test(error.message)
    if (encrypted) return 'This PDF is password protected. Remove the password and try again.'
    if (error.name === 'InvalidPDFException' || /invalid pdf|failed to parse/i.test(error.message)) {
      return 'This file is not a readable PDF.'
    }
    return error.message
  }
  return 'The PDF could not be processed.'
}

function assertPdf(file: File) {
  const error = pdfFileError(file)
  if (error) throw new Error(error)
}

export async function readPdfPageCount(data: ArrayBuffer | Uint8Array): Promise<number> {
  const bytes = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data.slice(0))
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: false })
  const count = doc.getPageCount()
  if (count < 1) throw new Error('This PDF has no pages.')
  return count
}

async function verifyPdf(bytes: Uint8Array, expectedPages: number) {
  const count = await readPdfPageCount(bytes)
  if (count !== expectedPages) throw new Error('The new PDF could not be verified.')
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('The page could not be encoded.'))
        else resolve(blob)
      },
      type,
      quality,
    )
  })
}

function applyGrayscale(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')
  if (!context) return
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = image.data
  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722
    data[index] = gray
    data[index + 1] = gray
    data[index + 2] = gray
  }
  context.putImageData(image, 0, 0)
}

export async function renderPdfPreview(data: ArrayBuffer | Uint8Array): Promise<Blob> {
  const pdfjs = await loadPdfjs()
  const source = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data.slice(0))
  const pdf = await pdfjs.getDocument({ data: source }).promise
  try {
    if (pdf.numPages < 1) throw new Error('This PDF has no pages.')
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 0.8 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    await page.render({ canvas, viewport }).promise
    return canvasToBlob(canvas, 'image/png')
  } finally {
    await pdf.cleanup()
  }
}

export async function getPdfPageCount(file: File): Promise<number> {
  assertPdf(file)
  try {
    return await readPdfPageCount(await file.arrayBuffer())
  } catch (error) {
    throw new Error(describePdfError(error))
  }
}

function clearDocumentInfo(doc: PDFDocument) {
  doc.setTitle('')
  doc.setAuthor('')
  doc.setSubject('')
  doc.setKeywords([])
  doc.setCreator('')
  doc.setProducer('')
}

async function rasterizePdf(
  data: ArrayBuffer,
  options: { scale: number; quality: number; grayscale: boolean; onProgress?: Progress },
): Promise<{ bytes: Uint8Array; preview: Blob }> {
  const pdfjs = await loadPdfjs()
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise
  try {
    if (pdf.numPages > MAX_PDF_RASTER_PAGES) {
      throw new Error(
        `This PDF has ${pdf.numPages} pages. Split it first, then compress each part. Rebuilding more than ${MAX_PDF_RASTER_PAGES} pages in the browser would stall this tab.`,
      )
    }
    const out = await PDFDocument.create()
    let preview: Blob | null = null
    for (let index = 1; index <= pdf.numPages; index += 1) {
      options.onProgress?.(`Rebuilding page ${index} of ${pdf.numPages}`)
      const page = await pdf.getPage(index)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.max(0.45, Math.min(options.scale, 2200 / base.width, 2200 / base.height))
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.floor(viewport.width))
      canvas.height = Math.max(1, Math.floor(viewport.height))
      await page.render({ canvas, viewport }).promise
      if (options.grayscale) applyGrayscale(canvas)
      const blob = await canvasToBlob(canvas, 'image/jpeg', options.quality)
      if (index === 1) preview = blob
      const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()))
      const longEdge = Math.max(canvas.width, canvas.height)
      const pointScale = 792 / longEdge
      const pageWidth = canvas.width * pointScale
      const pageHeight = canvas.height * pointScale
      const pdfPage = out.addPage([pageWidth, pageHeight])
      pdfPage.drawImage(jpg, { x: 0, y: 0, width: pageWidth, height: pageHeight })
      page.cleanup()
    }
    if (!preview) throw new Error('This PDF has no pages.')
    const bytes = await out.save()
    return { bytes: new Uint8Array(bytes), preview }
  } finally {
    await pdf.cleanup()
  }
}

export async function compressPdf(
  file: File,
  options: { mode: CompressMode; targetBytes: number; grayscale: boolean; onProgress?: Progress },
): Promise<CompressResult> {
  assertPdf(file)
  const original = await file.arrayBuffer()
  const originalPreview = await renderPdfPreview(original.slice(0)).catch(() => null)

  try {
    const source = await PDFDocument.load(original.slice(0), { ignoreEncryption: false })
    const pageCount = source.getPageCount()
    if (pageCount < 1) throw new Error('This PDF has no pages.')

    if (options.mode === 'low') {
      options.onProgress?.('Rewriting the PDF structure…')
      clearDocumentInfo(source)
      const saved = await source.save({ useObjectStreams: true })
      await verifyPdf(saved, pageCount)
      const blob = bytesToBlob(saved, 'application/pdf')
      const facts = compressionFacts({
        mode: 'low',
        originalBytes: original.byteLength,
        outputBytes: blob.size,
        targetBytes: options.targetBytes,
      })
      const preview = await renderPdfPreview(saved.slice(0)).catch(() => null)
      return { blob, preview, originalPreview, ...facts }
    }

    let quality = options.mode === 'high' ? 0.46 : 0.72
    let scale = options.mode === 'high' ? 1.05 : 1.35
    let best: { bytes: Uint8Array; preview: Blob } | null = null
    for (let attempt = 0; attempt < 5; attempt += 1) {
      best = await rasterizePdf(original.slice(0), {
        scale,
        quality,
        grayscale: options.grayscale,
        onProgress: options.onProgress,
      })
      if (best.bytes.byteLength <= options.targetBytes) break
      quality = Math.max(0.32, quality - 0.08)
      scale = Math.max(0.7, scale - 0.12)
    }
    if (!best) throw new Error('The PDF could not be rebuilt.')
    await verifyPdf(best.bytes, pageCount)
    const blob = bytesToBlob(best.bytes, 'application/pdf')
    const facts = compressionFacts({
      mode: options.mode,
      originalBytes: file.size,
      outputBytes: blob.size,
      targetBytes: options.targetBytes,
    })
    return { blob, preview: best.preview, originalPreview, ...facts }
  } catch (error) {
    throw new Error(describePdfError(error))
  }
}

const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89

function fitPageToA4(page: ReturnType<PDFDocument['getPages']>[number]) {
  const { width, height } = page.getSize()
  const scale = Math.min(A4_WIDTH / width, A4_HEIGHT / height)
  const scaledWidth = width * scale
  const scaledHeight = height * scale
  page.scaleContent(scale, scale)
  page.setSize(A4_WIDTH, A4_HEIGHT)
  page.translateContent((A4_WIDTH - scaledWidth) / 2, (A4_HEIGHT - scaledHeight) / 2)
}

export async function mergePdfs(files: File[], pageSize: 'original' | 'a4'): Promise<Blob> {
  if (files.length < 2) throw new Error('Add at least two PDF files.')
  const out = await PDFDocument.create()
  try {
    let expectedPages = 0
    for (const file of files) {
      assertPdf(file)
      const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false })
      if (source.getPageCount() < 1) throw new Error(`${file.name} has no pages.`)
      const pages = await out.copyPages(source, source.getPageIndices())
      expectedPages += pages.length
      for (const page of pages) {
        if (pageSize === 'a4') fitPageToA4(page)
        out.addPage(page)
      }
    }
    const bytes = await out.save()
    await verifyPdf(bytes, expectedPages)
    return bytesToBlob(bytes, 'application/pdf')
  } catch (error) {
    throw new Error(describePdfError(error))
  }
}

export async function splitPdf(file: File, pages: number[]): Promise<Blob> {
  assertPdf(file)
  if (pages.length === 0) throw new Error('Select at least one page.')
  try {
    const source = await PDFDocument.load(await file.arrayBuffer())
    const count = source.getPageCount()
    if (pages.some((page) => page < 1 || page > count)) {
      throw new Error(`Pages must be between 1 and ${count}.`)
    }
    const out = await PDFDocument.create()
    const copied = await out.copyPages(
      source,
      pages.map((page) => page - 1),
    )
    copied.forEach((page) => out.addPage(page))
    const bytes = await out.save()
    await verifyPdf(bytes, pages.length)
    return bytesToBlob(bytes, 'application/pdf')
  } catch (error) {
    throw new Error(describePdfError(error))
  }
}

export async function watermarkPdf(
  file: File,
  options: { text: string; opacity: number; fontSize: number },
): Promise<Blob> {
  assertPdf(file)
  const text = options.text.trim()
  if (!text) throw new Error('Enter the watermark text.')
  if (text.length > 80) throw new Error('Use 80 characters or fewer.')
  try {
    const doc = await PDFDocument.load(await file.arrayBuffer())
    const font = await doc.embedFont(StandardFonts.Helvetica)
    for (const page of doc.getPages()) {
      const { width, height } = page.getSize()
      const textWidth = font.widthOfTextAtSize(text, options.fontSize)
      page.drawText(text, {
        x: Math.max(12, (width - textWidth) / 2),
        y: height / 2,
        size: options.fontSize,
        font,
        color: rgb(0.75, 0.8, 0.77),
        opacity: options.opacity,
        rotate: degrees(-32),
      })
    }
    return bytesToBlob(await doc.save(), 'application/pdf')
  } catch (error) {
    throw new Error(describePdfError(error))
  }
}

async function imageForPdf(file: File): Promise<{ bytes: Uint8Array; width: number; height: number; kind: 'jpg' | 'png' }> {
  if (isJpegFile(file)) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return { bytes, ...size, kind: 'jpg' }
  }
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('This browser cannot prepare the image for PDF.')
  }
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await canvasToBlob(canvas, 'image/png')
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width: canvas.width,
    height: canvas.height,
    kind: 'png',
  }
}

export async function imagesToPdf(files: File[], pageSize: 'fit' | 'a4'): Promise<Blob> {
  if (files.length === 0) throw new Error('Add at least one image.')
  const doc = await PDFDocument.create()
  for (const file of files) {
    if (file.size <= 0) throw new Error(`${file.name} is empty.`)
    if (file.size > MAX_PDF_BYTES) throw new Error(`${file.name} is larger than 50 MB.`)
    if (!isSupportedImage(file)) throw new Error(`${file.name} is not a JPG, PNG, or WebP image.`)
    const image = await imageForPdf(file).catch(() => {
      throw new Error(`${file.name} could not be read.`)
    })
    const embedded = image.kind === 'jpg' ? await doc.embedJpg(image.bytes) : await doc.embedPng(image.bytes)
    const pixelWidth = (image.width * 72) / 96
    const pixelHeight = (image.height * 72) / 96
    if (pageSize === 'fit') {
      const page = doc.addPage([pixelWidth, pixelHeight])
      page.drawImage(embedded, { x: 0, y: 0, width: pixelWidth, height: pixelHeight })
    } else {
      const scale = Math.min(A4_WIDTH / pixelWidth, A4_HEIGHT / pixelHeight)
      const drawWidth = pixelWidth * scale
      const drawHeight = pixelHeight * scale
      const page = doc.addPage([A4_WIDTH, A4_HEIGHT])
      page.drawImage(embedded, {
        x: (A4_WIDTH - drawWidth) / 2,
        y: (A4_HEIGHT - drawHeight) / 2,
        width: drawWidth,
        height: drawHeight,
      })
    }
  }
  const bytes = await doc.save()
  await verifyPdf(bytes, files.length)
  return bytesToBlob(bytes, 'application/pdf')
}

export async function pdfPageToImage(file: File, pageNumber: number, format: ImageFormat): Promise<Blob> {
  assertPdf(file)
  const pdfjs = await loadPdfjs()
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  try {
    if (pageNumber < 1 || pageNumber > pdf.numPages) {
      throw new Error(`This PDF has ${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}. Choose a page in that range.`)
    }
    const page = await pdf.getPage(pageNumber)
    return renderPage(page, format)
  } catch (error) {
    throw new Error(describePdfError(error))
  } finally {
    await pdf.cleanup()
  }
}

async function renderPage(page: PDFPageProxy, format: ImageFormat): Promise<Blob> {
  const viewport = page.getViewport({ scale: 1.6 })
  const longest = Math.max(viewport.width, viewport.height)
  const scale = longest > 2400 ? (1.6 * 2400) / longest : 1.6
  const fitted = scale === 1.6 ? viewport : page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(fitted.width))
  canvas.height = Math.max(1, Math.floor(fitted.height))
  await page.render({ canvas, viewport: fitted }).promise
  const quality = format === 'png' ? undefined : 0.9
  const blob = await canvasToBlob(canvas, mimeOf(format), quality)
  if (format === 'webp' && blob.type !== 'image/webp') {
    throw new Error('This browser cannot encode WebP. Choose PNG or JPG.')
  }
  return blob
}

export async function pdfPagesToImages(file: File, pages: number[], format: ImageFormat): Promise<{ page: number; blob: Blob }[]> {
  if (pages.length === 0) throw new Error('Choose at least one page.')
  if (pages.length > MAX_PDF_EXPORT_PAGES) {
    throw new Error(`Export up to ${MAX_PDF_EXPORT_PAGES} pages at a time.`)
  }
  assertPdf(file)
  const pdfjs = await loadPdfjs()
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  try {
    const outputs: { page: number; blob: Blob }[] = []
    for (const pageNumber of pages) {
      if (pageNumber < 1 || pageNumber > pdf.numPages) {
        throw new Error(`This PDF has ${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}. Choose pages in that range.`)
      }
      const page = await pdf.getPage(pageNumber)
      outputs.push({ page: pageNumber, blob: await renderPage(page, format) })
    }
    return outputs
  } catch (error) {
    throw new Error(describePdfError(error))
  } finally {
    await pdf.cleanup()
  }
}
