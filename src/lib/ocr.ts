import { createWorker } from 'tesseract.js'
import { isOcrLanguage, ocrReview, type OcrLanguageCode } from '@/lib/conversion'

export type OcrProgress = {
  status: string
  progress: number
}

export async function recognizeDocument(
  image: Blob | string,
  language: string,
  onProgress?: (update: OcrProgress) => void,
): Promise<{ text: string; warning: string | null }> {
  if (!isOcrLanguage(language)) {
    throw new Error('That language is not available. Choose one of the listed languages.')
  }
  const code: OcrLanguageCode = language
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null
  try {
    worker = await createWorker(code, 1, {
      logger: (message) => {
        onProgress?.({
          status: message.status || 'working',
          progress: typeof message.progress === 'number' ? message.progress : 0,
        })
      },
    })
    const result = await worker.recognize(image)
    return ocrReview(result.data.text ?? '')
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('That language')) throw error
    const message = error instanceof Error ? error.message : ''
    if (/traineddata|network|fetch|lang path/i.test(message)) {
      throw new Error(
        'The language data could not be loaded. The image stayed in this browser. Try English, or try again when language files can download.',
      )
    }
    throw new Error('Text could not be read from this image. It may be damaged, blank, or too unclear.')
  } finally {
    if (worker) await worker.terminate()
  }
}
