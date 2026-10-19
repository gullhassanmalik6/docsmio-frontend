export type ShareTarget = 'whatsapp' | 'email' | 'other'

export type ShareResult = 'shared' | 'cancelled' | 'unsupported' | 'retry'

export async function shareDocumentFile(file: File): Promise<ShareResult> {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function' || !navigator.canShare({ files: [file] })) {
    return 'unsupported'
  }
  try {
    await navigator.share({ files: [file], title: file.name })
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    if (error instanceof DOMException && error.name === 'NotAllowedError') return 'retry'
    throw error
  }
}

export function shareFallbackNote(target: ShareTarget): string {
  if (target === 'whatsapp') {
    return 'The file was downloaded. Attach it in WhatsApp. This page cannot place the file into the chat by itself.'
  }
  if (target === 'email') {
    return 'The file was downloaded. Attach it to the email. A mail link cannot carry the file.'
  }
  return 'The file was downloaded. Attach it in the app you want to use.'
}
