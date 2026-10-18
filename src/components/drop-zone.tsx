import { Upload } from 'lucide-react'
import { useEffect, useRef, type DragEvent, type ReactNode } from 'react'
import { consumeStagedFile } from '@/lib/library-stage'
import { cn } from '@/lib/utils'

type DropZoneProps = {
  accept: string
  multiple?: boolean
  title: string
  detail: string
  onFiles: (files: File[]) => void
  selected?: ReactNode
  testId?: string
}

export function DropZone({ accept, multiple = false, title, detail, onFiles, selected, testId = 'dropzone' }: DropZoneProps) {
  const onFilesRef = useRef(onFiles)

  useEffect(() => {
    onFilesRef.current = onFiles
  }, [onFiles])

  useEffect(() => {
    void consumeStagedFile().then((file) => {
      if (!file) return
      const accepted = accept.split(',').map((item) => item.trim().toLowerCase())
      const name = file.name.toLowerCase()
      const matches = accepted.some((item) => item === file.type || (item.startsWith('.') && name.endsWith(item)) || (item.endsWith('/*') && file.type.startsWith(item.slice(0, -1))))
      if (matches) onFilesRef.current([file])
    }).catch(() => undefined)
  }, [accept])

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    onFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <label
      data-testid={testId}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      className={cn(
        'flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-400/35 bg-emerald-400/5 px-6 py-8 text-center transition hover:border-emerald-300/70 hover:bg-emerald-400/10',
      )}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />
      <span className="grid size-12 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300">
        <Upload className="size-5" />
      </span>
      {selected ? <div className="mt-4 text-sm text-foreground">{selected}</div> : <p className="mt-4 text-base font-medium">{title}</p>}
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{detail}</p>
    </label>
  )
}
