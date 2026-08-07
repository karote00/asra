import type { CoreRawData } from '@asyra/utils'
import {
  measureBrowserDragAsyncPhase,
  measureBrowserDragPhase
} from '@asyra/utils'
import type { IPersistenceProvider } from '../persistence.js'

const INDEXED_DB_DATABASE_NAME = 'framework-documents'
const INDEXED_DB_OBJECT_STORE_NAME = 'documents'
const INDEXED_DB_VERSION = 1

const getIndexedDbError = (
  error: DOMException | null,
  operation: string
): Error => error ?? new Error(`IndexedDB ${operation} failed`)

const waitForTransaction = (
  transaction: IDBTransaction,
  operation: string
): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(getIndexedDbError(transaction.error, operation))
    transaction.onabort = () =>
      reject(getIndexedDbError(transaction.error, `${operation} aborted`))
  })

export interface IndexedDbPersistenceOptions {
  databaseName?: string
  factory?: IDBFactory
}

/**
 * LocalStorage Persistence Provider
 * Simple key-value storage using browser's localStorage
 * Best for: Small to medium-sized apps, quick prototyping
 */
export class LocalStoragePersistence implements IPersistenceProvider {
  readonly name = 'LocalStorage'

  constructor(private readonly storageKey = 'FILE') {}

  async save(data: CoreRawData): Promise<void> {
    try {
      const serialized = JSON.stringify(data)
      localStorage.setItem(this.storageKey, serialized)
    } catch (error) {
      console.error('[LocalStoragePersistence] Save failed:', error)
      throw error
    }
  }

  async load(): Promise<unknown | null> {
    try {
      const serialized = localStorage.getItem(this.storageKey)
      if (!serialized) {
        return null
      }
      return JSON.parse(serialized)
    } catch (error) {
      console.error('[LocalStoragePersistence] Load failed:', error)
      return null
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(this.storageKey)
    } catch (error) {
      console.error('[LocalStoragePersistence] Clear failed:', error)
      throw error
    }
  }
}

/**
 * IndexedDB Persistence Provider
 * Structured-clone document storage for large offline browser documents.
 */
export class IndexedDbPersistence implements IPersistenceProvider {
  readonly name = 'IndexedDB'
  private readonly databaseName: string
  private readonly factory?: IDBFactory

  constructor(
    private readonly storageKey = 'FILE',
    options: IndexedDbPersistenceOptions = {}
  ) {
    this.databaseName = options.databaseName ?? INDEXED_DB_DATABASE_NAME
    this.factory = options.factory
  }

  async save(data: CoreRawData): Promise<void> {
    try {
      const database = await measureBrowserDragAsyncPhase(
        'persistence:indexeddb-open',
        () => this.openDatabase()
      )
      try {
        const transaction = database.transaction(
          INDEXED_DB_OBJECT_STORE_NAME,
          'readwrite'
        )
        measureBrowserDragPhase('persistence:indexeddb-put', () =>
          transaction
            .objectStore(INDEXED_DB_OBJECT_STORE_NAME)
            .put(data, this.storageKey)
        )
        await measureBrowserDragAsyncPhase(
          'persistence:indexeddb-transaction',
          () => waitForTransaction(transaction, 'save')
        )
      } finally {
        database.close()
      }
    } catch (error) {
      console.error('[IndexedDbPersistence] Save failed:', error)
      throw error
    }
  }

  async load(): Promise<unknown | null> {
    try {
      const database = await this.openDatabase()
      try {
        const transaction = database.transaction(
          INDEXED_DB_OBJECT_STORE_NAME,
          'readonly'
        )
        const request = transaction
          .objectStore(INDEXED_DB_OBJECT_STORE_NAME)
          .get(this.storageKey)
        let result: unknown | null = null
        request.onsuccess = () => {
          result = request.result ?? null
        }
        await waitForTransaction(transaction, 'load')
        return result
      } finally {
        database.close()
      }
    } catch (error) {
      console.error('[IndexedDbPersistence] Load failed:', error)
      throw error
    }
  }

  async clear(): Promise<void> {
    try {
      const database = await this.openDatabase()
      try {
        const transaction = database.transaction(
          INDEXED_DB_OBJECT_STORE_NAME,
          'readwrite'
        )
        transaction
          .objectStore(INDEXED_DB_OBJECT_STORE_NAME)
          .delete(this.storageKey)
        await waitForTransaction(transaction, 'clear')
      } finally {
        database.close()
      }
    } catch (error) {
      console.error('[IndexedDbPersistence] Clear failed:', error)
      throw error
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.getFactory().open(
        this.databaseName,
        INDEXED_DB_VERSION
      )
      let settled = false

      request.onupgradeneeded = () => {
        if (
          !request.result.objectStoreNames.contains(
            INDEXED_DB_OBJECT_STORE_NAME
          )
        ) {
          request.result.createObjectStore(INDEXED_DB_OBJECT_STORE_NAME)
        }
      }
      request.onsuccess = () => {
        if (settled) {
          request.result.close()
          return
        }
        settled = true
        resolve(request.result)
      }
      request.onerror = () => {
        if (settled) return
        settled = true
        reject(getIndexedDbError(request.error, 'open'))
      }
      request.onblocked = () => {
        if (settled) return
        settled = true
        reject(new Error('IndexedDB open blocked by another connection'))
      }
    })
  }

  private getFactory(): IDBFactory {
    const factory = this.factory ?? globalThis.indexedDB
    if (!factory) {
      throw new Error('IndexedDB is not available in this environment')
    }
    return factory
  }
}

/**
 * Memory Persistence Provider
 * In-memory storage (doesn't persist across page reloads)
 * Best for: Testing, demo apps, ephemeral canvases
 */
export class MemoryPersistence implements IPersistenceProvider {
  readonly name = 'Memory'
  private data: CoreRawData | null = null

  async save(data: CoreRawData): Promise<void> {
    this.data = data
  }

  async load(): Promise<CoreRawData | null> {
    return this.data
  }

  async clear(): Promise<void> {
    this.data = null
  }
}

/**
 * Provider collection for easy access
 */
export const providers = {
  indexedDB: new IndexedDbPersistence(),
  localStorage: new LocalStoragePersistence(),
  memory: new MemoryPersistence()
}
