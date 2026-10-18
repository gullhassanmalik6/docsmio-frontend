const DB_NAME = 'docufix-library'
const STORE = 'staged'

export async function stageForTool(file: { name: string; mime: string; blob: Blob }): Promise<void> {
  const database = await openStageDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).put({ id: 'next', ...file })
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('The file could not be prepared for a tool.'))
  })
  database.close()
}

export async function consumeStagedFile(): Promise<File | null> {
  const database = await openStageDatabase()
  const record = await new Promise<{ name: string; mime: string; blob: Blob } | undefined>((resolve, reject) => {
    const request = database.transaction(STORE, 'readwrite').objectStore(STORE).get('next')
    request.onsuccess = () => {
      const value = request.result as { name: string; mime: string; blob: Blob } | undefined
      if (value) request.transaction?.objectStore(STORE).delete('next')
      resolve(value)
    }
    request.onerror = () => reject(request.error)
  }).catch(() => undefined)
  database.close()
  if (!record) return null
  return new File([record.blob], record.name, { type: record.mime })
}

function openStageDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains('folders')) database.createObjectStore('folders', { keyPath: 'id' })
      if (!database.objectStoreNames.contains('documents')) database.createObjectStore('documents', { keyPath: 'id' })
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('The document library could not be opened.'))
  })
}
