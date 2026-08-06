import type { SharedPublication } from '@asyra/factory'
import {
  measureBrowserDragAsyncPhase,
  measureBrowserDragPhase
} from '@asyra/utils'

export type PendingDocumentPublicationStatus = 'pending' | 'conflicted'

export interface PendingDocumentPublication {
  readonly fileId: string
  readonly publicationId: string
  readonly appendOrder: number
  readonly publication: SharedPublication
  readonly status: PendingDocumentPublicationStatus
  readonly failureReason?: string
}

export interface PublicationOutboxStorage {
  load(fileId: string): Promise<readonly PendingDocumentPublication[]>
  put(record: PendingDocumentPublication): Promise<void>
  delete(fileId: string, publicationId: string): Promise<void>
}

export interface PublicationOutboxState {
  readonly pendingCount: number
  readonly status: 'synced' | 'pending' | 'conflicted' | 'storage-failed'
}

export interface SourcePublicationAcceptance {
  readonly publicationId: string
  readonly sequence: number
}

interface IndexedDbPublicationOutboxStorageOptions {
  readonly factory?: IDBFactory
  readonly databaseName?: string
}

interface DocumentPublicationOutboxOptions {
  readonly fileId: string
  readonly storage?: PublicationOutboxStorage
}

const DEFAULT_DATABASE_NAME = 'asyra-design-collaboration'
const DATABASE_VERSION = 1
const PUBLICATION_STORE_NAME = 'pending-publications'
const FILE_ID_INDEX_NAME = 'file-id'

const freezeValue = <T>(value: T): T => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  Object.values(value).forEach((nested) => freezeValue(nested))
  return Object.freeze(value)
}

const snapshotPublication = (
  publication: SharedPublication
): SharedPublication =>
  measureBrowserDragPhase('collaboration:outbox-snapshot-publication', () =>
    freezeValue(structuredClone(publication))
  )

const createRecord = (
  fileId: string,
  publication: SharedPublication,
  appendOrder: number,
  retainFactoryPublication: boolean
): PendingDocumentPublication =>
  Object.freeze({
    fileId,
    publicationId: publication.publicationId,
    appendOrder,
    publication: retainFactoryPublication
      ? publication
      : snapshotPublication(publication),
    status: 'pending'
  })

const snapshotRecord = (
  record: PendingDocumentPublication
): PendingDocumentPublication =>
  freezeValue({
    ...structuredClone(record),
    publication: structuredClone(record.publication)
  })

const samePublication = (
  first: SharedPublication,
  second: SharedPublication
): boolean => JSON.stringify(first) === JSON.stringify(second)

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), {
      once: true
    })
    request.addEventListener(
      'error',
      () =>
        reject(
          request.error ?? new Error('[collaboration] IndexedDB request failed')
        ),
      { once: true }
    )
  })

const transactionCompletion = (transaction: IDBTransaction): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true })
    transaction.addEventListener(
      'abort',
      () =>
        reject(
          transaction.error ??
            new Error('[collaboration] IndexedDB transaction was aborted')
        ),
      { once: true }
    )
    transaction.addEventListener(
      'error',
      () =>
        reject(
          transaction.error ??
            new Error('[collaboration] IndexedDB transaction failed')
        ),
      { once: true }
    )
  })

export class PublicationOutboxStorageError extends Error {
  override readonly cause: unknown

  constructor(message: string, cause: unknown) {
    super(message)
    this.name = 'PublicationOutboxStorageError'
    this.cause = cause
  }
}

export class IndexedDbPublicationOutboxStorage
  implements PublicationOutboxStorage
{
  private readonly factory: IDBFactory
  private readonly databaseName: string
  private databasePromise: Promise<IDBDatabase> | undefined

  constructor(options: IndexedDbPublicationOutboxStorageOptions = {}) {
    const factory = options.factory ?? globalThis.indexedDB
    if (!factory) {
      throw new PublicationOutboxStorageError(
        '[collaboration] IndexedDB is unavailable',
        new Error('[collaboration] IndexedDB is unavailable')
      )
    }
    this.factory = factory
    this.databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME
  }

  async load(fileId: string): Promise<readonly PendingDocumentPublication[]> {
    const database = await this.openDatabase()
    const transaction = database.transaction(PUBLICATION_STORE_NAME, 'readonly')
    const store = transaction.objectStore(PUBLICATION_STORE_NAME)
    const index = store.index(FILE_ID_INDEX_NAME)
    const records = await requestResult(
      index.getAll(fileId) as IDBRequest<PendingDocumentPublication[]>
    )
    await transactionCompletion(transaction)
    return records
      .map(snapshotRecord)
      .sort((first, second) => first.appendOrder - second.appendOrder)
  }

  async put(record: PendingDocumentPublication): Promise<void> {
    const database = await this.openDatabase()
    const transaction = database.transaction(
      PUBLICATION_STORE_NAME,
      'readwrite'
    )
    transaction.objectStore(PUBLICATION_STORE_NAME).put(record)
    await transactionCompletion(transaction)
  }

  async delete(fileId: string, publicationId: string): Promise<void> {
    const database = await this.openDatabase()
    const transaction = database.transaction(
      PUBLICATION_STORE_NAME,
      'readwrite'
    )
    transaction
      .objectStore(PUBLICATION_STORE_NAME)
      .delete([fileId, publicationId])
    await transactionCompletion(transaction)
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory.open(this.databaseName, DATABASE_VERSION)
      request.addEventListener('upgradeneeded', () => {
        const database = request.result
        if (database.objectStoreNames.contains(PUBLICATION_STORE_NAME)) return
        const store = database.createObjectStore(PUBLICATION_STORE_NAME, {
          keyPath: ['fileId', 'publicationId']
        })
        store.createIndex(FILE_ID_INDEX_NAME, 'fileId', { unique: false })
      })
      request.addEventListener('success', () => resolve(request.result), {
        once: true
      })
      request.addEventListener(
        'error',
        () =>
          reject(
            request.error ??
              new Error('[collaboration] IndexedDB database open failed')
          ),
        { once: true }
      )
      request.addEventListener(
        'blocked',
        () =>
          reject(
            new Error('[collaboration] IndexedDB database upgrade was blocked')
          ),
        { once: true }
      )
    }).catch((error) => {
      if (this.databasePromise === opening) {
        this.databasePromise = undefined
      }
      throw error
    })
    this.databasePromise = opening
    return opening
  }
}

export class DocumentPublicationOutbox {
  readonly fileId: string

  private readonly storage: PublicationOutboxStorage
  private readonly records = new Map<string, PendingDocumentPublication>()
  private readonly stateSubscribers = new Set<
    (state: PublicationOutboxState) => void
  >()
  private operationQueue: Promise<void> = Promise.resolve()
  private initialized = false
  private storageFailed = false
  private nextAppendOrder = 1

  constructor(options: DocumentPublicationOutboxOptions) {
    if (!options.fileId.trim()) {
      throw new Error('[collaboration] publication outbox fileId is required')
    }
    this.fileId = options.fileId
    this.storage = options.storage ?? new IndexedDbPublicationOutboxStorage()
  }

  initialize(): Promise<void> {
    return this.schedule(async () => {
      if (this.initialized) return
      try {
        const records = await this.storage.load(this.fileId)
        records.forEach((record) => {
          if (
            record.fileId !== this.fileId ||
            record.publicationId !== record.publication.publicationId
          ) {
            return
          }
          const snapshot = snapshotRecord(record)
          this.records.set(snapshot.publicationId, snapshot)
          this.nextAppendOrder = Math.max(
            this.nextAppendOrder,
            snapshot.appendOrder + 1
          )
        })
        this.initialized = true
        this.emitState()
      } catch (error) {
        this.initialized = true
        this.markStorageFailed()
        throw new PublicationOutboxStorageError(
          '[collaboration] publication outbox could not be loaded',
          error
        )
      }
    })
  }

  append(publication: SharedPublication): Promise<PendingDocumentPublication> {
    return this.appendPublication(publication, false)
  }

  appendFactoryPublication(
    publication: SharedPublication
  ): Promise<PendingDocumentPublication> {
    return this.appendPublication(publication, true)
  }

  private appendPublication(
    publication: SharedPublication,
    retainFactoryPublication: boolean
  ): Promise<PendingDocumentPublication> {
    return this.schedule(async () => {
      this.requireInitialized()
      if (retainFactoryPublication && !Object.isFrozen(publication)) {
        throw new Error(
          '[collaboration] Factory publication evidence must be immutable'
        )
      }
      const existing = this.records.get(publication.publicationId)
      if (existing) {
        if (!samePublication(existing.publication, publication)) {
          throw new Error(
            '[collaboration] publication identity was reused with different content'
          )
        }
        return existing
      }

      const record = createRecord(
        this.fileId,
        publication,
        this.nextAppendOrder++,
        retainFactoryPublication
      )
      this.records.set(record.publicationId, record)
      this.emitState()
      try {
        await measureBrowserDragAsyncPhase(
          'collaboration:outbox-storage-put',
          () => this.storage.put(record)
        )
        return record
      } catch (error) {
        this.markStorageFailed()
        throw new PublicationOutboxStorageError(
          `[collaboration] publication ${record.publicationId} could not be retained in IndexedDB`,
          error
        )
      }
    })
  }

  acknowledge(acceptance: SourcePublicationAcceptance): Promise<boolean> {
    return this.schedule(async () => {
      this.requireInitialized()
      const record = this.records.get(acceptance.publicationId)
      if (!record || record.status !== 'pending') return false
      try {
        await this.storage.delete(this.fileId, record.publicationId)
      } catch (error) {
        this.markStorageFailed()
        throw new PublicationOutboxStorageError(
          `[collaboration] accepted publication ${record.publicationId} could not be removed from IndexedDB`,
          error
        )
      }
      this.records.delete(record.publicationId)
      this.emitState()
      return true
    })
  }

  retainConflict(
    publicationId: string,
    failureReason: string
  ): Promise<boolean> {
    return this.schedule(async () => {
      this.requireInitialized()
      const existing = this.records.get(publicationId)
      if (!existing) return false
      const conflicted = freezeValue({
        ...existing,
        status: 'conflicted' as const,
        failureReason
      })
      this.records.set(publicationId, conflicted)
      this.emitState()
      try {
        await this.storage.put(conflicted)
      } catch (error) {
        this.markStorageFailed()
        throw new PublicationOutboxStorageError(
          `[collaboration] conflicted publication ${publicationId} could not be updated in IndexedDB`,
          error
        )
      }
      return true
    })
  }

  getRecoverablePublications(): readonly PendingDocumentPublication[] {
    return this.sortedRecords().filter(({ status }) => status === 'pending')
  }

  getConflicts(): readonly PendingDocumentPublication[] {
    return this.sortedRecords().filter(({ status }) => status === 'conflicted')
  }

  getLastAppendOrder(): number {
    return this.nextAppendOrder - 1
  }

  getState(): PublicationOutboxState {
    const records = this.sortedRecords()
    let status: PublicationOutboxState['status'] = 'synced'
    if (records.some((record) => record.status === 'pending')) {
      status = 'pending'
    }
    if (records.some((record) => record.status === 'conflicted')) {
      status = 'conflicted'
    }
    if (this.storageFailed) status = 'storage-failed'
    return Object.freeze({
      pendingCount: records.length,
      status
    })
  }

  onStateChange(
    subscriber: (state: PublicationOutboxState) => void
  ): () => void {
    this.stateSubscribers.add(subscriber)
    return () => this.stateSubscribers.delete(subscriber)
  }

  whenIdle(): Promise<void> {
    return this.operationQueue
  }

  private schedule<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation)
    this.operationQueue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  private requireInitialized(): void {
    if (!this.initialized) {
      throw new Error('[collaboration] publication outbox is not initialized')
    }
  }

  private sortedRecords(): readonly PendingDocumentPublication[] {
    return [...this.records.values()].sort(
      (first, second) => first.appendOrder - second.appendOrder
    )
  }

  private markStorageFailed(): void {
    if (this.storageFailed) return
    this.storageFailed = true
    this.emitState()
  }

  private emitState(): void {
    const state = this.getState()
    ;[...this.stateSubscribers].forEach((subscriber) => {
      try {
        subscriber(state)
      } catch {
        // Status observers cannot alter recovery ownership.
      }
    })
  }
}
