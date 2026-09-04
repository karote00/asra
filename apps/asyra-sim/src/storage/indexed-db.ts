import {
  decodeProject,
  validateSummary,
  type ProjectRepository,
  type ProjectSummary,
  type StoredProject
} from './project-format'

const DATABASE = 'asyra-sim-local-v1'
const PROJECTS = 'projects',
  DOCUMENTS = 'documents'
const abortError = () =>
  new DOMException('Local storage operation cancelled', 'AbortError')

/** Resolve only at transaction completion, never at individual request success. */
export function transactionCompletion(
  transaction: IDBTransaction,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      transaction.removeEventListener('complete', complete)
      transaction.removeEventListener('abort', aborted)
      signal?.removeEventListener('abort', cancel)
    }
    const complete = () => {
      cleanup()
      resolve()
    }
    const aborted = () => {
      cleanup()
      reject(transaction.error ?? abortError())
    }
    const cancel = () => {
      try {
        transaction.abort()
      } catch {
        /* A completed transaction cannot be aborted. */
      }
    }
    transaction.addEventListener('complete', complete)
    transaction.addEventListener('abort', aborted)
    signal?.addEventListener('abort', cancel, { once: true })
    if (signal?.aborted) cancel()
  })
}

export class IndexedProjectRepository implements ProjectRepository {
  private database: IDBDatabase | null = null
  private opening: Promise<IDBDatabase> | null = null
  private closed = false
  private transactions = new Set<IDBTransaction>()
  constructor(
    private readonly factory: IDBFactory | undefined = globalThis.indexedDB,
    private readonly name = DATABASE
  ) {}

  private open(): Promise<IDBDatabase> {
    if (this.closed)
      return Promise.reject(
        new Error('Local storage is closed; reload the App')
      )
    if (this.database) return Promise.resolve(this.database)
    if (this.opening) return this.opening
    const factory = this.factory
    if (!factory)
      return Promise.reject(
        new Error(
          'IndexedDB is unavailable; enable browser storage to save or open projects'
        )
      )
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(this.name, 1)
      let settled = false
      const timeout = setTimeout(
        () => fail(new Error('Local storage did not open within 5 seconds')),
        5000
      )
      const fail = (error: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        reject(error)
      }
      request.onblocked = () =>
        fail(
          new Error(
            'Local storage is blocked by another tab; close it and retry'
          )
        )
      request.onerror = () =>
        fail(request.error ?? new Error('Cannot open local storage'))
      request.onupgradeneeded = () => {
        if (settled || this.closed) {
          request.transaction?.abort()
          return
        }
        const projects = request.result.createObjectStore(PROJECTS, {
          keyPath: 'id'
        })
        projects.createIndex('savedAt', 'savedAt')
        request.result.createObjectStore(DOCUMENTS)
      }
      request.onsuccess = () => {
        if (settled || this.closed) {
          request.result.close()
          fail(new Error('Local storage was closed during startup'))
          return
        }
        settled = true
        clearTimeout(timeout)
        const database = request.result
        database.onversionchange = () => this.close()
        database.onclose = () => this.close()
        this.database = database
        resolve(database)
      }
    })
    this.opening = opening
    void opening
      .finally(() => {
        if (this.opening === opening) this.opening = null
      })
      .catch(() => undefined)
    return opening
  }

  private async transact<T>(
    mode: IDBTransactionMode,
    run: (tx: IDBTransaction, result: (value: T) => void) => void,
    signal?: AbortSignal
  ): Promise<T> {
    signal?.throwIfAborted()
    const database = await this.open()
    signal?.throwIfAborted()
    if (this.closed) throw new Error('Local storage is closed')
    const transaction = database.transaction([PROJECTS, DOCUMENTS], mode)
    this.transactions.add(transaction)
    const completion = transactionCompletion(transaction, signal)
    let output: { value: T } | undefined, failure: unknown
    try {
      try {
        run(transaction, (result) => {
          output = { value: result }
        })
      } catch (error) {
        failure = error
        transaction.abort()
      }
      try {
        await completion
      } catch (error) {
        throw failure ?? error
      }
      if (!output)
        throw new Error('Storage transaction completed without a result')
      return output.value
    } finally {
      this.transactions.delete(transaction)
    }
  }

  async write(
    project: StoredProject,
    expectedRevision: string | null,
    signal?: AbortSignal
  ): Promise<void> {
    validateSummary(project)
    decodeProject(project.payload)
    const { payload, ...metadata } = structuredClone(project)
    let conflict: Error | undefined
    try {
      await this.transact<undefined>(
        'readwrite',
        (tx, done) => {
          const store = tx.objectStore(PROJECTS),
            request = store.get(metadata.id)
          request.onsuccess = () => {
            const current = request.result as ProjectSummary | undefined
            if ((current?.revision ?? null) !== expectedRevision) {
              conflict = new Error(
                'This project changed in another tab; reopen it or save a new project'
              )
              tx.abort()
              return
            }
            store.put(metadata)
            tx.objectStore(DOCUMENTS).put(payload, metadata.id)
            done(undefined)
          }
        },
        signal
      )
    } catch (error) {
      throw conflict ?? error
    }
  }

  async read(id: string, signal?: AbortSignal): Promise<StoredProject> {
    const value = await this.transact<{ metadata: unknown; payload: unknown }>(
      'readonly',
      (tx, done) => {
        let metadata: unknown, payload: unknown
        const meta = tx.objectStore(PROJECTS).get(id),
          doc = tx.objectStore(DOCUMENTS).get(id)
        const finish = () => done({ metadata, payload })
        meta.onsuccess = () => {
          metadata = meta.result
          finish()
        }
        doc.onsuccess = () => {
          payload = doc.result
          finish()
        }
      },
      signal
    )
    if (value.metadata === undefined)
      throw new Error('Saved project was not found')
    validateSummary(value.metadata)
    if (typeof value.payload !== 'string')
      throw new Error('Saved project document is missing')
    decodeProject(value.payload)
    return { ...value.metadata, payload: value.payload }
  }

  list(
    signal?: AbortSignal
  ): Promise<{ projects: ProjectSummary[]; limited: boolean }> {
    return this.transact(
      'readonly',
      (tx, done) => {
        const projects: ProjectSummary[] = []
        const request = tx
          .objectStore(PROJECTS)
          .index('savedAt')
          .openCursor(null, 'prev')
        request.onsuccess = () => {
          const cursor = request.result
          if (!cursor || projects.length === 100) {
            done({ projects, limited: !!cursor })
            return
          }
          try {
            validateSummary(cursor.value)
          } catch {
            tx.abort()
            return
          }
          projects.push(cursor.value)
          cursor.continue()
        }
      },
      signal
    )
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    for (const transaction of this.transactions) {
      try {
        transaction.abort()
      } catch {
        /* Already settled. */
      }
    }
    this.database?.close()
    this.database = null
  }
}
