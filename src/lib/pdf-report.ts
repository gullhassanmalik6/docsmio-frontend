import { isPdfFile, MAX_PDF_BYTES } from '@/lib/files'

export type CompressMode = 'high' | 'balanced' | 'low'

export function pdfFileError(file: File): string | null {
  if (file.size <= 0) return 'This file is empty. Choose a PDF that has content.'
  if (!isPdfFile(file)) return 'Choose a PDF file.'
  if (file.size > MAX_PDF_BYTES) return 'This PDF is larger than the 50 MB limit.'
  return null
}

export function compressionFacts(input: {
  mode: CompressMode
  originalBytes: number
  outputBytes: number
  targetBytes: number
}): { reduced: boolean; reachedTarget: boolean; note: string } {
  const reduced = Number.isFinite(input.outputBytes) && input.outputBytes >= 0 && input.outputBytes < input.originalBytes
  const reachedTarget =
    Number.isFinite(input.outputBytes) && input.outputBytes >= 0 && Number.isFinite(input.targetBytes) && input.outputBytes <= input.targetBytes

  if (input.mode === 'low') {
    if (!reduced) {
      return {
        reduced,
        reachedTarget,
        note: `No size reduction was achieved. Low compression only rewrites the PDF structure and clears document information. It does not recompress images, fonts, or page content. ${
          reachedTarget ? 'The output is still within the requested target.' : 'The target size was not reached.'
        }`,
      }
    }
    if (!reachedTarget) {
      return {
        reduced,
        reachedTarget,
        note: 'The file is smaller, but it is still above the target. Low compression cannot recompress embedded images or fonts, so this is the limit of a structure-only save.',
      }
    }
    return {
      reduced,
      reachedTarget,
      note: 'The PDF structure was rewritten and the measured output is under the target. Selectable text was kept. Images and fonts already stored in the file were not recompressed.',
    }
  }

  const rebuilt =
    'Pages were rebuilt as images. Selectable text, links, and form fields were removed. Embedded images were not optimized in place.'
  if (!reduced) {
    return {
      reduced,
      reachedTarget,
      note: `${rebuilt} The new file is not smaller than the original, so no size reduction was achieved. ${
        reachedTarget ? 'The output is still within the requested target.' : 'The target size was not reached.'
      }`,
    }
  }
  if (!reachedTarget) {
    return {
      reduced,
      reachedTarget,
      note: `${rebuilt} The file is smaller, but the target could not be reached without making the pages unreadable.`,
    }
  }
  return {
    reduced,
    reachedTarget,
    note: `${rebuilt} The measured output is within the target size.`,
  }
}
