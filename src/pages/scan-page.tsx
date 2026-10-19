import { Camera, Copy, RotateCcw, RotateCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DropZone } from '@/components/drop-zone'
import { LibrarySaveActions } from '@/components/library-save'
import { Notice } from '@/components/notice'
import { ToolFrame, ToolHeading } from '@/components/tool-heading'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useHistory } from '@/context/history-context'
import { useObjectUrl, usePageTitle } from '@/hooks/use-browser'
import { ocrLanguages, stopMediaStream, type CropInsets } from '@/lib/conversion'
import { isHeic, isSupportedImage, MAX_IMAGE_BYTES } from '@/lib/files'
import { downloadBlob, formatBytes, safeFileName } from '@/lib/format'
import { bakeScanImage, enhancePreview } from '@/lib/image-process'
import { recognizeDocument } from '@/lib/ocr'
import { imagesToPdf } from '@/lib/pdf-process'
import { fieldClass } from '@/lib/utils'

const emptyCrop: CropInsets = { top: 0, right: 0, bottom: 0, left: 0 }

function extensionFor(blob: Blob): string {
  if (blob.type === 'image/png') return 'png'
  if (blob.type === 'image/webp') return 'webp'
  return 'jpg'
}

export function ScanPage() {
  usePageTitle('Scan & OCR — Docsmio')
  const { addOutput } = useHistory()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(true)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [libraryFile, setLibraryFile] = useState<{ blob: Blob; name: string; mime: string } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [adjusted, setAdjusted] = useState<Blob | null>(null)
  const [enhanced, setEnhanced] = useState<Blob | null>(null)
  const [enhanceOn, setEnhanceOn] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [crop, setCrop] = useState<CropInsets>(emptyCrop)
  const [prepareError, setPrepareError] = useState<string | null>(null)
  const [language, setLanguage] = useState<(typeof ocrLanguages)[number]['code']>('eng')
  const [progress, setProgress] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [ocrWarning, setOcrWarning] = useState<string | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const runningRef = useRef(false)
  const previewSource = enhanceOn && enhanced ? enhanced : adjusted ?? file
  const previewUrl = useObjectUrl(previewSource)

  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node
    if (!node || !stream) return
    node.srcObject = stream
    void node.play().catch(() => setCameraError('The camera preview could not start.'))
  }, [stream])

  useEffect(() => {
    streamRef.current = stream
  }, [stream])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopMediaStream(streamRef.current)
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!file) return
    let cancelled = false
    void bakeScanImage(file, rotation, crop)
      .then((blob) => {
        if (!cancelled) {
          setAdjusted(blob)
          setPrepareError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setPrepareError(error instanceof Error ? error.message : 'The image could not be adjusted.')
      })
    return () => {
      cancelled = true
    }
  }, [file, rotation, crop])

  useEffect(() => {
    const source = adjusted ?? file
    if (!source || !enhanceOn) return
    let cancelled = false
    void enhancePreview(source)
      .then((blob) => {
        if (!cancelled) setEnhanced(blob)
      })
      .catch(() => {
        if (!cancelled) setPrepareError('The preview could not be enhanced.')
      })
    return () => {
      cancelled = true
    }
  }, [adjusted, file, enhanceOn])

  function stopCamera() {
    stopMediaStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStream(null)
  }

  async function startCamera() {
    setCameraError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser cannot open a camera. Upload an image instead.')
      return
    }
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      if (!mountedRef.current) {
        stopMediaStream(next)
        return
      }
      stopMediaStream(streamRef.current)
      streamRef.current = next
      setStream(next)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setCameraError('Camera permission was denied. You can upload an image instead.')
      } else if (error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'OverconstrainedError')) {
        setCameraError('No usable camera was found on this device.')
      } else {
        setCameraError('The camera could not be opened. Upload an image instead.')
      }
    }
  }

  async function capture() {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) {
      setCameraError('The camera has not started yet.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(video, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) {
      setCameraError('The frame could not be captured.')
      return
    }
    setFile(new File([blob], 'scan.jpg', { type: 'image/jpeg' }))
    resetReview()
    stopCamera()
  }

  function resetReview() {
    setAdjusted(null)
    setEnhanced(null)
    setRotation(0)
    setCrop(emptyCrop)
    setText('')
    setOcrWarning(null)
    setOcrError(null)
    setProgress(null)
    setCopyMessage(null)
    setPrepareError(null)
    setFileError(null)
  }

  function onFiles(files: File[]) {
    const next = files[0]
    if (!next) return
    if (isHeic(next)) {
      setFileError('HEIC images are not supported. Export a JPG, PNG, or WebP first.')
      return
    }
    if (!isSupportedImage(next)) {
      setFileError('Upload a JPG, PNG, or WebP image.')
      return
    }
    if (next.size > MAX_IMAGE_BYTES) {
      setFileError('This image is larger than 20 MB.')
      return
    }
    setFile(next)
    resetReview()
  }

  function updateCrop(edge: keyof CropInsets, value: string) {
    const parsed = Number(value)
    setCrop((current) => ({ ...current, [edge]: Number.isFinite(parsed) ? parsed : 0 }))
    setText('')
  }

  async function workingBlob(): Promise<Blob> {
    if (!file) throw new Error('Capture or upload an image first.')
    const baked = await bakeScanImage(file, rotation, crop)
    if (enhanceOn) return enhancePreview(baked)
    return baked
  }

  async function downloadImage() {
    const blob = await workingBlob()
    const extension = extensionFor(blob)
    const name = safeFileName(file?.name.replace(/\.[^.]+$/, '') || 'scan', extension)
    downloadBlob(blob, name)
    await addOutput({ name, blob, kind: 'image', tool: 'Scan & OCR', originalName: file?.name, originalSize: file?.size })
  }

  async function downloadPdf() {
    const blob = await workingBlob()
    const extension = extensionFor(blob)
    const image = new File([blob], `scan.${extension}`, { type: blob.type || 'image/jpeg' })
    const pdf = await imagesToPdf([image], 'fit')
    const name = safeFileName(file?.name.replace(/\.[^.]+$/, '') || 'scan', 'pdf')
    downloadBlob(pdf, name)
    await addOutput({ name, blob: pdf, kind: 'pdf', tool: 'Scan & OCR', originalName: file?.name, originalSize: file?.size })
  }

  async function extractText() {
    if (runningRef.current) return
    runningRef.current = true
    setRunning(true)
    setOcrError(null)
    setOcrWarning(null)
    setCopyMessage(null)
    setProgress('Starting OCR…')
    try {
      const blob = await workingBlob()
      const result = await recognizeDocument(blob, language, (update) => {
        const percent = Math.round(Math.max(0, Math.min(1, update.progress)) * 100)
        setProgress(`${update.status} · ${percent}%`)
      })
      setText(result.text)
      setOcrWarning(result.warning)
      setProgress(null)
    } catch (error) {
      setText('')
      setProgress(null)
      setOcrError(error instanceof Error ? error.message : 'Text could not be read from this image.')
    } finally {
      runningRef.current = false
      setRunning(false)
    }
  }

  async function copyText() {
    if (!text.trim()) {
      setCopyMessage('There is no extracted text to copy.')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopyMessage('Copied the extracted text.')
    } catch {
      setCopyMessage('The browser blocked clipboard access. Select the text and copy it manually.')
    }
  }

  function downloadText() {
    if (!text.trim()) return
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    downloadBlob(blob, safeFileName(file?.name.replace(/\.[^.]+$/, '') || 'scan', 'txt'))
  }

  return (
    <ToolFrame>
      <ToolHeading
        title="Scan Document & OCR"
        description="Photograph a page or upload an image, review it, then read the text in this browser."
      />
      <Tabs
        defaultValue="camera"
        onValueChange={(value) => {
          if (value !== 'camera') stopCamera()
        }}
      >
        <TabsList>
          <TabsTrigger value="camera">Camera Scan</TabsTrigger>
          <TabsTrigger value="upload">Upload Image</TabsTrigger>
        </TabsList>
        <TabsContent value="camera">
          <div className="rounded-3xl border border-white/10 bg-card p-4">
            <div className="grid aspect-video place-items-center overflow-hidden rounded-2xl bg-black">
              {stream ? (
                <video ref={attachVideo} className="h-full w-full object-contain" playsInline muted autoPlay />
              ) : (
                <div className="px-6 text-center">
                  <Camera className="mx-auto size-10 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Camera is off until you open it.</p>
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={() => void startCamera()}>
                {stream ? 'Restart camera' : 'Open camera'}
              </Button>
              <Button type="button" variant="outline" disabled={!stream} onClick={() => void capture()}>
                Capture frame
              </Button>
              <Button type="button" variant="outline" disabled={!stream} onClick={stopCamera}>
                Close camera
              </Button>
            </div>
            {cameraError ? <p className="mt-3 text-sm text-amber-200" role="alert">{cameraError}</p> : null}
          </div>
        </TabsContent>
        <TabsContent value="upload">
          <div className="rounded-3xl border border-white/10 bg-card p-4">
            <DropZone
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              title="Upload an image of a document"
              detail="JPG, PNG, or WebP. Max 20 MB. The image stays in this browser."
              onFiles={onFiles}
              selected={file ? file.name : undefined}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <figure className="overflow-hidden rounded-3xl border border-white/10 bg-card">
            <figcaption className="flex items-center justify-between px-4 py-3 text-sm">
              <span>Review</span>
              <span className="text-muted-foreground">{previewSource ? formatBytes(previewSource.size) : 'No image'}</span>
            </figcaption>
            <div className="grid min-h-64 place-items-center bg-black/40">
              {previewUrl ? (
                <img src={previewUrl} alt="Captured document" className="max-h-96 w-full object-contain" />
              ) : (
                <p className="px-6 text-center text-sm text-muted-foreground">Capture or upload an image. Nothing is scanned until an image is here.</p>
              )}
            </div>
          </figure>
          <div className="rounded-3xl border border-white/10 bg-card p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" disabled={!file} onClick={() => { setRotation((value) => value - 1); setText('') }}>
                <RotateCcw className="size-4" />
                Rotate left
              </Button>
              <Button type="button" variant="outline" disabled={!file} onClick={() => { setRotation((value) => value + 1); setText('') }}>
                <RotateCw className="size-4" />
                Rotate right
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {(['top', 'right', 'bottom', 'left'] as const).map((edge) => (
                <div key={edge}>
                  <Label htmlFor={`crop-${edge}`}>Crop {edge} %</Label>
                  <input
                    id={`crop-${edge}`}
                    type="number"
                    min={0}
                    max={40}
                    inputMode="numeric"
                    className={fieldClass + ' mt-1.5'}
                    value={crop[edge]}
                    disabled={!file}
                    onChange={(event) => updateCrop(edge, event.target.value)}
                  />
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Rotation and crop are applied to the download, the PDF, and OCR. Perspective correction is not available.
            </p>
          </div>
        </div>
        <div className="space-y-4 rounded-3xl border border-white/10 bg-card p-4">
          <div>
            <Label htmlFor="ocr-language">OCR language</Label>
            <select
              id="ocr-language"
              className={fieldClass + ' mt-1.5'}
              value={language}
              onChange={(event) => setLanguage(event.target.value as (typeof ocrLanguages)[number]['code'])}
            >
              {ocrLanguages.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The OCR engine and language files download when you extract text, so this step needs a network connection. The image and the transcript stay in this browser and are not sent to Docsmio.
            </p>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              <span className="block font-medium">Enhance contrast</span>
              <span className="text-muted-foreground">Applies to the reviewed image before OCR and download.</span>
            </span>
            <Switch checked={enhanceOn} onCheckedChange={setEnhanceOn} aria-label="Enhance contrast" />
          </label>
          <Notice tone="info">OCR can miss or misread words. Review the text before you rely on it. This does not create a searchable PDF.</Notice>
          {fileError ? <Notice tone="warning">{fileError}</Notice> : null}
          {prepareError ? <Notice tone="warning">{prepareError}</Notice> : null}
          <Button type="button" data-testid="primary-action" disabled={!file || running} onClick={() => void extractText()}>
            {running ? 'Reading text…' : 'Extract text'}
          </Button>
          {progress ? <Notice tone="info">{progress}</Notice> : null}
          {ocrError ? <Notice tone="error">{ocrError}</Notice> : null}
          {ocrWarning ? <Notice tone="warning">{ocrWarning}</Notice> : null}
          <div>
            <Label htmlFor="ocr-text">Extracted text</Label>
            <textarea
              id="ocr-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Extracted text appears here after OCR finishes."
              className="mt-1.5 min-h-32 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" variant="outline" onClick={() => void copyText()}>
              <Copy className="size-4" />
              Copy text
            </Button>
            <Button type="button" variant="outline" disabled={!text.trim()} onClick={downloadText}>
              Download .txt
            </Button>
            <Button type="button" variant="outline" data-testid="download-output" disabled={!file || running} onClick={() => void downloadImage().catch((error: unknown) => setPrepareError(error instanceof Error ? error.message : 'The image could not be downloaded.'))}>
              Download image
            </Button>
            <Button type="button" variant="outline" disabled={!file || running} onClick={() => void downloadPdf().catch((error: unknown) => setPrepareError(error instanceof Error ? error.message : 'The PDF could not be created.'))}>
              Download PDF
            </Button>
            <Button type="button" variant="outline" disabled={!file || running} onClick={() => void workingBlob().then((blob) => setLibraryFile({ blob, name: safeFileName(file?.name.replace(/\.[^.]+$/, '') || 'scan', extensionFor(blob)), mime: blob.type || 'image/jpeg' })).catch((error: unknown) => setPrepareError(error instanceof Error ? error.message : 'The scan could not be prepared.'))}>
              Prepare library copy
            </Button>
          </div>
          <LibrarySaveActions blob={libraryFile?.blob ?? null} filename={libraryFile?.name ?? 'scan.jpg'} mime={libraryFile?.mime ?? 'image/jpeg'} />
          {copyMessage ? <p className="text-xs text-muted-foreground">{copyMessage}</p> : null}
        </div>
      </div>
    </ToolFrame>
  )
}
