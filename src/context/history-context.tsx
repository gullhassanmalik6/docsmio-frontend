import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/context/auth-context'
import {
  addHistory,
  clearHistory,
  getHistoryBlob,
  historyIsMemoryOnly,
  listHistory,
  removeHistory,
  type HistoryItem,
  type HistoryKind,
} from '@/lib/history'
import { api } from '@/lib/api'
import { downloadBlob } from '@/lib/format'

const operationByTool: Record<string, string> = {
  'Image Resize & Compress': 'image-resize',
  'Compress PDF': 'compress-pdf',
  'Merge PDF': 'merge-pdf',
  'Split PDF': 'split-pdf',
  'Image to PDF': 'image-to-pdf',
  'JPG to PDF': 'jpg-to-pdf',
  'Convert Files': 'convert',
  'Add Watermark': 'watermark',
  'Scan & OCR': 'scan',
}

type HistoryContextValue = {
  items: HistoryItem[]
  ready: boolean
  persistent: boolean
  addOutput: (input: { name: string; blob: Blob; kind: HistoryKind; tool: string; originalName?: string; originalSize?: number }) => Promise<void>
  remove: (id: string) => Promise<void>
  download: (id: string) => Promise<void>
  clear: () => Promise<void>
}

const HistoryContext = createContext<HistoryContextValue | null>(null)

export function HistoryProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [ready, setReady] = useState(false)
  const [persistent, setPersistent] = useState(true)

  const refresh = useCallback(async () => {
    const next = await listHistory()
    setItems(next)
    setPersistent(!historyIsMemoryOnly())
    setReady(true)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  const addOutput = useCallback(
    async (input: { name: string; blob: Blob; kind: HistoryKind; tool: string; originalName?: string; originalSize?: number }) => {
      await addHistory(input)
      await refresh()
      const operation = operationByTool[input.tool]
      if (!auth.user || !operation) return
      void api('/api/history', {
        method: 'POST',
        body: JSON.stringify({
          original_filename: input.originalName ?? input.name,
          operation_type: operation,
          original_size: input.originalSize ?? input.blob.size,
          output_size: input.blob.size,
          status: 'completed',
        }),
      }).catch(() => undefined)
    },
    [auth.user, refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      await removeHistory(id)
      await refresh()
    },
    [refresh],
  )

  const download = useCallback(async (id: string) => {
    const blob = await getHistoryBlob(id)
    const item = items.find((entry) => entry.id === id)
    if (!blob || !item) return
    downloadBlob(blob, item.name)
  }, [items])

  const clear = useCallback(async () => {
    await clearHistory()
    await refresh()
  }, [refresh])

  const value = useMemo(
    () => ({ items, ready, persistent, addOutput, remove, download, clear }),
    [items, ready, persistent, addOutput, remove, download, clear],
  )

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
}

export function useHistory(): HistoryContextValue {
  const value = useContext(HistoryContext)
  if (!value) throw new Error('useHistory must be used inside HistoryProvider')
  return value
}
