const copies = new Map<string, Promise<void>>()

export function copyLegacyDatabase(legacyName: string, nextName: string, version: number, stores: string[]): Promise<void> {
  const key = `${legacyName}->${nextName}`
  const existing = copies.get(key)
  if (existing) return existing
  const job = migrate(legacyName, nextName, version, stores).catch((error: unknown) => {
    copies.delete(key)
    throw error
  })
  copies.set(key, job)
  return job
}

async function migrate(legacyName: string, nextName: string, version: number, stores: string[]): Promise<void> {
  if (!(await databaseExists(legacyName))) return
  const next = await openDatabase(nextName, version, stores)
  const empty = await storesEmpty(next, stores)
  next.close()
  if (!empty) return
  const legacy = await openDatabase(legacyName)
  const target = await openDatabase(nextName, version, stores)
  try {
    for (const store of stores) {
      if (!legacy.objectStoreNames.contains(store) || !target.objectStoreNames.contains(store)) continue
      const rows = await readAll(legacy, store)
      await writeAll(target, store, rows)
    }
  } finally {
    legacy.close()
    target.close()
  }
}

async function databaseExists(name: string): Promise<boolean> {
  if (typeof indexedDB.databases !== 'function') return false
  const databases = await indexedDB.databases()
  return databases.some((database) => database.name === name)
}

function openDatabase(name: string, version?: number, stores: string[] = []): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version)
    request.onupgradeneeded = () => {
      const database = request.result
      for (const store of stores) {
        if (!database.objectStoreNames.contains(store)) database.createObjectStore(store, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('The renamed browser storage could not be opened.'))
  })
}

async function storesEmpty(database: IDBDatabase, stores: string[]): Promise<boolean> {
  for (const store of stores) {
    if (!database.objectStoreNames.contains(store)) continue
    const count = await new Promise<number>((resolve, reject) => {
      const request = database.transaction(store).objectStore(store).count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Saved files could not be counted.'))
    })
    if (count > 0) return false
  }
  return true
}

function readAll(database: IDBDatabase, store: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(store).objectStore(store).getAll()
    request.onsuccess = () => resolve(request.result as unknown[])
    request.onerror = () => reject(request.error ?? new Error('Saved files could not be read.'))
  })
}

function writeAll(database: IDBDatabase, store: string, rows: unknown[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(store, 'readwrite')
    const objectStore = transaction.objectStore(store)
    for (const row of rows) objectStore.put(row)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Saved files could not be moved to the new name.'))
  })
}
