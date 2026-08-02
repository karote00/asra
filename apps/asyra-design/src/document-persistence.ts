import type { IPersistenceProvider } from '@asyra/persistence'
import type { CoreRawData } from '@asyra/utils'
import { createInitialDocumentForFile } from './config/demo-document'

interface DocumentAccess {
  load(data: unknown): void
  save(): Promise<CoreRawData>
}

export const DOCUMENT_DATABASE_ENDPOINT = '/api/documents'
export const DOCUMENT_DATABASE_UNAVAILABLE_MESSAGE =
  'Document database is unavailable. You can keep using the app, but changes cannot be saved.'

export type DocumentPersistenceOperation = 'clear' | 'load' | 'save'

export type DocumentPersistenceStatus =
  | Readonly<{ status: 'available' }>
  | Readonly<{
      error: unknown
      operation: DocumentPersistenceOperation
      status: 'unavailable'
    }>

interface DocumentDatabaseResponse {
  readonly ok: boolean
  readonly status: number
  json(): Promise<unknown>
}

interface DocumentDatabaseRequest {
  readonly body?: string
  readonly credentials: 'same-origin'
  readonly headers: Readonly<Record<string, string>>
  readonly method: 'DELETE' | 'GET' | 'PUT'
}

export type DocumentDatabaseFetch = (
  input: string,
  request: DocumentDatabaseRequest
) => Promise<DocumentDatabaseResponse>

interface DocumentPersistenceOptions {
  fetch?: DocumentDatabaseFetch
  provider?: IPersistenceProvider
  createInitialDocument?: () => CoreRawData | Promise<CoreRawData>
  onStatusChange?: (status: DocumentPersistenceStatus) => void
}

export interface DocumentPersistence {
  readonly fileId: string
  readonly provider: IPersistenceProvider
  createInitialDocument(): Promise<CoreRawData>
}

class DocumentDatabaseError extends Error {
  constructor(
    readonly operation: DocumentPersistenceOperation,
    readonly status?: number,
    options?: ErrorOptions
  ) {
    super(
      `Document database ${operation} failed${
        status === undefined ? '' : ` with status ${String(status)}`
      }`,
      options
    )
    this.name = 'DocumentDatabaseError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const getPlatformFetch = (): DocumentDatabaseFetch => {
  if (typeof globalThis.fetch !== 'function') {
    throw new DocumentDatabaseError('load', undefined, {
      cause: new Error('Fetch is unavailable')
    })
  }
  return globalThis.fetch.bind(globalThis) as unknown as DocumentDatabaseFetch
}

class DocumentDatabaseProvider implements IPersistenceProvider {
  readonly name = 'DocumentDatabase'
  private readonly endpoint: string

  constructor(
    fileId: string,
    private readonly fetch: DocumentDatabaseFetch
  ) {
    this.endpoint = `${DOCUMENT_DATABASE_ENDPOINT}/${encodeURIComponent(fileId)}`
  }

  async load(): Promise<unknown | null> {
    const response = await this.request('load', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      method: 'GET'
    })
    let payload: unknown
    try {
      payload = await response.json()
    } catch (error) {
      throw new DocumentDatabaseError('load', response.status, { cause: error })
    }
    if (!isRecord(payload) || !Object.hasOwn(payload, 'document')) {
      throw new DocumentDatabaseError('load', response.status, {
        cause: new Error('Document database response is invalid')
      })
    }
    return payload.document ?? null
  }

  async save(data: CoreRawData): Promise<void> {
    await this.request('save', {
      body: JSON.stringify({ document: data }),
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      method: 'PUT'
    })
  }

  async clear(): Promise<void> {
    await this.request('clear', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      method: 'DELETE'
    })
  }

  private async request(
    operation: DocumentPersistenceOperation,
    request: DocumentDatabaseRequest
  ): Promise<DocumentDatabaseResponse> {
    let response: DocumentDatabaseResponse
    try {
      response = await this.fetch(this.endpoint, request)
    } catch (error) {
      throw new DocumentDatabaseError(operation, undefined, { cause: error })
    }
    if (!response.ok) {
      throw new DocumentDatabaseError(operation, response.status)
    }
    return response
  }
}

class SerialDocumentProvider implements IPersistenceProvider {
  readonly name: string
  private queue: Promise<void> = Promise.resolve()

  constructor(
    private readonly provider: IPersistenceProvider,
    private readonly createInitialDocument: () => Promise<CoreRawData>,
    private readonly onStatusChange: (status: DocumentPersistenceStatus) => void
  ) {
    this.name = provider.name
  }

  async load(): Promise<unknown> {
    await this.queue
    try {
      const stored = await this.provider.load()
      this.onStatusChange({ status: 'available' })
      return stored ?? (await this.createInitialDocument())
    } catch (error) {
      // Database availability must not own App runtime availability. The
      // failure stays visible while Core continues with the formal initial
      // document for this file.
      this.onStatusChange({ error, operation: 'load', status: 'unavailable' })
      return this.createInitialDocument()
    }
  }

  save(data: CoreRawData): Promise<void> {
    return this.enqueue('save', () => this.provider.save(data))
  }

  clear(): Promise<void> {
    return this.enqueue('clear', () => this.provider.clear())
  }

  private enqueue(
    operation: Exclude<DocumentPersistenceOperation, 'load'>,
    execute: () => Promise<void>
  ): Promise<void> {
    const pending = this.queue.then(async () => {
      try {
        await execute()
        this.onStatusChange({ status: 'available' })
      } catch (error) {
        this.onStatusChange({ error, operation, status: 'unavailable' })
        throw error
      }
    })
    this.queue = pending.catch(() => undefined)
    return pending
  }
}

let activePersistence: DocumentPersistence | null = null

export const createDocumentPersistence = (
  fileId: string,
  options: DocumentPersistenceOptions = {}
): DocumentPersistence => {
  const normalizedFileId = fileId.trim()
  if (!normalizedFileId) {
    throw new Error('[document-persistence] fileId is required')
  }

  const createInitialDocument = async (): Promise<CoreRawData> =>
    options.createInitialDocument
      ? options.createInitialDocument()
      : createInitialDocumentForFile(normalizedFileId)
  const provider =
    options.provider ??
    new DocumentDatabaseProvider(
      normalizedFileId,
      options.fetch ?? getPlatformFetch()
    )
  const onStatusChange = options.onStatusChange ?? (() => undefined)

  return Object.freeze({
    fileId: normalizedFileId,
    provider: new SerialDocumentProvider(
      provider,
      createInitialDocument,
      onStatusChange
    ),
    createInitialDocument
  })
}

export const activateDocumentPersistence = (
  persistence: DocumentPersistence | null
): void => {
  activePersistence = persistence
}

const getActiveDocumentPersistence = (): DocumentPersistence => {
  if (!activePersistence) {
    throw new Error('[document-persistence] active document is unavailable')
  }
  return activePersistence
}

export const resetPersistedDocument = async (
  document: DocumentAccess
): Promise<void> => {
  const persistence = getActiveDocumentPersistence()
  document.load(await persistence.createInitialDocument())
  const snapshot = await document.save()
  await persistence.provider.save(snapshot)
}
