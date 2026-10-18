export const MAX_IMAGE_BYTES = 20 * 1024 * 1024
export const MAX_PDF_BYTES = 50 * 1024 * 1024
export const MAX_PDF_RASTER_PAGES = 40

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export function imageExtension(file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return extension
}

export function isJpegFile(file: File): boolean {
  return file.type === 'image/jpeg' || ['jpg', 'jpeg'].includes(imageExtension(file))
}

export function isSupportedImage(file: File): boolean {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return true
  return ['jpg', 'jpeg', 'png', 'webp'].includes(imageExtension(file))
}

export function isHeic(file: File): boolean {
  return file.type === 'image/heic' || file.type === 'image/heif' || ['heic', 'heif'].includes(imageExtension(file))
}
