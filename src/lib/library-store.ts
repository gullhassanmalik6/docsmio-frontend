import { copyLegacyDatabase } from '@/lib/legacy-db'
import { defaultFolders, uniqueFileName, type Classification, type LibraryFolderKey } from '@/lib/library-rules'

export type LibraryFolder = {
  id: string
  name: string
  parentId: string | null
  systemKey: LibraryFolderKey | null
  createdAt: number
  updatedAt: number
}

export type LibraryDocument = {
  id: string
  name: string
  mime: string
  size: number
  folderId: string
  favorite: boolean
  createdAt: number
  updatedAt: number
  classification: Classification | null
}

type StoredDocument = LibraryDocument & { blob: Blob }

const DB_NAME = 'docsmio-library'
const DB_VERSION = 2

async function openDatabase(): Promise<IDBDatabase> {
  await copyLegacyDatabase('docufix-library', DB_NAME, DB_VERSION, ['folders', 'documents', 'staged'])
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains('folders')) database.createObjectStore('folders', { keyPath: 'id' })
      if (!database.objectStoreNames.contains('documents')) database.createObjectStore('documents', { keyPath: 'id' })
      if (!database.objectStoreNames.contains('staged')) database.createObjectStore('staged', { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('This browser could not open the document library.'))
  })
}

async function withStore<T>(store: 'folders' | 'documents', mode: IDBTransactionMode, run: (objectStore: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(store, mode)
      const request = run(transaction.objectStore(store))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error ?? new Error('The document library could not be updated.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('The document library update was cancelled.'))
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('This browser has no room left for more documents. Remove some files or use the online library.')
    }
    throw error
  } finally {
    database.close()
  }
}

let preparing: Promise<void> | null = null

export async function ensureLibraryFolders(): Promise<LibraryFolder[]> {
  preparing ??= prepareLibrary().finally(() => {
    preparing = null
  })
  await preparing
  return listFolders()
}

async function prepareLibrary(): Promise<void> {
  const existing = await listFolders()
  if (existing.length === 0) {
    const now = Date.now()
    const seeded = defaultFolders.map((folder) => ({
      id: crypto.randomUUID(),
      name: folder.name,
      parentId: null,
      systemKey: folder.key,
      createdAt: now,
      updatedAt: now,
    }))
    const database = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('folders', 'readwrite')
      const store = transaction.objectStore('folders')
      for (const folder of seeded) store.put(folder)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Default folders could not be created.'))
    })
    database.close()
  }
  await dedupeSystemFolders()
}

async function dedupeSystemFolders(): Promise<LibraryFolder[]> {
  const folders = await listFolders()
  const keeper = new Map<string, string>()
  const extras: string[] = []
  for (const folder of folders) {
    if (!folder.systemKey) continue
    const current = keeper.get(folder.systemKey)
    if (current) extras.push(folder.id)
    else keeper.set(folder.systemKey, folder.id)
  }
  if (extras.length === 0) return folders
  const documents = await withStore('documents', 'readonly', (store) => store.getAll() as IDBRequest<StoredDocument[]>)
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(['documents', 'folders'], 'readwrite')
    const documentStore = transaction.objectStore('documents')
    for (const document of documents) {
      const folder = folders.find((item) => item.id === document.folderId)
      const kept = folder?.systemKey ? keeper.get(folder.systemKey) : undefined
      if (kept && kept !== document.folderId) documentStore.put({ ...document, folderId: kept, updatedAt: Date.now() })
    }
    const folderStore = transaction.objectStore('folders')
    for (const id of extras) folderStore.delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Duplicate folders could not be repaired.'))
  })
  database.close()
  return listFolders()
}

export async function listFolders(): Promise<LibraryFolder[]> {
  const folders = await withStore('folders', 'readonly', (store) => store.getAll() as IDBRequest<LibraryFolder[]>)
  return folders.sort((a, b) => a.name.localeCompare(b.name))
}

export async function listDocuments(): Promise<LibraryDocument[]> {
  const documents = await withStore('documents', 'readonly', (store) => store.getAll() as IDBRequest<StoredDocument[]>)
  return documents
    .map(({ blob: _blob, ...document }) => document)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function readDocumentBlob(id: string): Promise<Blob> {
  const record = await withStore('documents', 'readonly', (store) => store.get(id) as IDBRequest<StoredDocument | undefined>)
  if (!record) throw new Error('That document is no longer in this browser.')
  return record.blob
}

export async function importDocument(input: {
  file: File
  folderId: string
  classification: Classification | null
}): Promise<LibraryDocument> {
  const documents = await listDocuments()
  const name = uniqueFileName(input.file.name, documents.map((document) => document.name))
  const now = Date.now()
  const record: StoredDocument = {
    id: crypto.randomUUID(),
    name,
    mime: input.file.type || 'application/octet-stream',
    size: input.file.size,
    folderId: input.folderId,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    classification: input.classification,
    blob: input.file,
  }
  await withStore('documents', 'readwrite', (store) => store.put(record))
  const { blob: _blob, ...document } = record
  return document
}

export async function updateDocument(id: string, patch: Partial<Pick<LibraryDocument, 'name' | 'folderId' | 'favorite'>>): Promise<void> {
  const record = await withStore('documents', 'readonly', (store) => store.get(id) as IDBRequest<StoredDocument | undefined>)
  if (!record) throw new Error('That document is no longer in this browser.')
  const documents = await listDocuments()
  const name = patch.name ? uniqueFileName(patch.name, documents.filter((document) => document.id !== id).map((document) => document.name)) : record.name
  await withStore('documents', 'readwrite', (store) => store.put({ ...record, ...patch, name, updatedAt: Date.now() }))
}

export async function deleteDocument(id: string): Promise<void> {
  await withStore('documents', 'readwrite', (store) => store.delete(id))
}

export async function createFolder(name: string, parentId: string | null): Promise<LibraryFolder> {
  const now = Date.now()
  const folder: LibraryFolder = { id: crypto.randomUUID(), name: name.trim(), parentId, systemKey: null, createdAt: now, updatedAt: now }
  if (!folder.name) throw new Error('Enter a folder name.')
  await withStore('folders', 'readwrite', (store) => store.put(folder))
  return folder
}

export async function updateFolder(id: string, patch: Partial<Pick<LibraryFolder, 'name' | 'parentId'>>): Promise<void> {
  const folders = await listFolders()
  const current = folders.find((folder) => folder.id === id)
  if (!current) throw new Error('That folder is no longer available.')
  await withStore('folders', 'readwrite', (store) => store.put({ ...current, ...patch, name: patch.name?.trim() || current.name, updatedAt: Date.now() }))
}

export async function deleteFolder(id: string, documentsGoTo: 'uncategorized' | 'delete'): Promise<void> {
  const folders = await listFolders()
  const target = folders.find((folder) => folder.id === id)
  if (!target) return
  if (target.systemKey === 'uncategorized') throw new Error('Uncategorized cannot be deleted.')
  if (folders.some((folder) => folder.parentId === id)) throw new Error('Move or delete the subfolders first.')
  const uncategorized = folders.find((folder) => folder.systemKey === 'uncategorized')
  const documents = await withStore('documents', 'readonly', (store) => store.getAll() as IDBRequest<StoredDocument[]>)
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(['documents', 'folders'], 'readwrite')
    const documentStore = transaction.objectStore('documents')
    for (const document of documents.filter((item) => item.folderId === id)) {
      if (documentsGoTo === 'delete' || !uncategorized) documentStore.delete(document.id)
      else documentStore.put({ ...document, folderId: uncategorized.id, updatedAt: Date.now() })
    }
    transaction.objectStore('folders').delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('The folder could not be deleted.'))
  })
  database.close()
}
