import { copyLegacyDatabase } from '@/lib/legacy-db'

export type HistoryKind = 'image' | 'pdf'

export type HistoryItem = {
  id: string
  name: string
  kind: HistoryKind
  mime: string
  size: number
  createdAt: number
  tool: string
  status: 'ready'
}

type HistoryRecord = HistoryItem & { blob: Blob }

const DB_NAME = 'docsmio'
const STORE = 'outputs'

let memoryMode = false
let memoryRecords: HistoryRecord[] = []

async function openDatabase(): Promise<IDBDatabase> {
  await copyLegacyDatabase('docufix', DB_NAME, 1, [STORE])
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open browser storage.'))
  })
}

async function database(): Promise<IDBDatabase | null> {
  if (memoryMode) return null
  try {
    return await openDatabase()
  } catch {
    memoryMode = true
    return null
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Browser storage request failed.'))
  })
}

function toItem(record: HistoryRecord): HistoryItem {
  return {
    id: record.id,
    name: record.name,
    kind: record.kind,
    mime: record.mime,
    size: record.size,
    createdAt: record.createdAt,
    tool: record.tool,
    status: 'ready',
  }
}

async function readAll(): Promise<HistoryRecord[]> {
  const db = await database()
  if (!db) return [...memoryRecords]
  const records = await requestToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).getAll() as IDBRequest<HistoryRecord[]>)
  db.close()
  return records
}

export function historyIsMemoryOnly(): boolean {
  return memoryMode
}

export async function listHistory(): Promise<HistoryItem[]> {
  const records = await readAll()
  return records.map(toItem).sort((a, b) => b.createdAt - a.createdAt)
}

export async function addHistory(input: {
  name: string
  blob: Blob
  kind: HistoryKind
  tool: string
}): Promise<HistoryItem> {
  const record: HistoryRecord = {
    id: crypto.randomUUID(),
    name: input.name,
    kind: input.kind,
    mime: input.blob.type || (input.kind === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
    size: input.blob.size,
    createdAt: Date.now(),
    tool: input.tool,
    status: 'ready',
    blob: input.blob,
  }
  const db = await database()
  if (!db) {
    memoryRecords = [record, ...memoryRecords]
    return toItem(record)
  }
  await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(record))
  db.close()
  return toItem(record)
}

export async function getHistoryBlob(id: string): Promise<Blob | null> {
  const db = await database()
  if (!db) return memoryRecords.find((record) => record.id === id)?.blob ?? null
  const record = await requestToPromise(
    db.transaction(STORE, 'readonly').objectStore(STORE).get(id) as IDBRequest<HistoryRecord | undefined>,
  )
  db.close()
  return record?.blob ?? null
}

export async function removeHistory(id: string): Promise<void> {
  const db = await database()
  if (!db) {
    memoryRecords = memoryRecords.filter((record) => record.id !== id)
    return
  }
  await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id))
  db.close()
}

export async function clearHistory(): Promise<void> {
  const db = await database()
  if (!db) {
    memoryRecords = []
    return
  }
  await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).clear())
  db.close()
}
