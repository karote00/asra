import {
  IndexedDbPersistence,
  type IPersistenceProvider
} from '@asyra/persistence'
import type { CoreRawData } from '@asyra/utils'
import { createEmptyDocument as createDefaultEmptyDocument } from './config/empty-document'

interface DocumentAccess {
  load(data: unknown): void
  save(): Promise<CoreRawData>
}

interface DocumentPersistenceOptions {
  databaseName?: string
  factory?: IDBFactory
  provider?: IPersistenceProvider
  createEmptyDocument?: () => CoreRawData
}

export interface DocumentPersistence {
  readonly fileId: string
  readonly provider: IPersistenceProvider
  createEmptyDocument(): CoreRawData
}

class SerialDocumentProvider implements IPersistenceProvider {
  readonly name: string
  private queue: Promise<void> = Promise.resolve()

  constructor(
    private readonly provider: IPersistenceProvider,
    private readonly createEmptyDocument: () => CoreRawData
  ) {
    this.name = provider.name
  }

  async load(): Promise<unknown> {
    await this.queue
    return (await this.provider.load()) ?? this.createEmptyDocument()
  }

  save(data: CoreRawData): Promise<void> {
    const pending = this.queue.then(() => this.provider.save(data))
    this.queue = pending.catch(() => undefined)
    return pending
  }

  clear(): Promise<void> {
    const pending = this.queue.then(() => this.provider.clear())
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

  const createEmptyDocument =
    options.createEmptyDocument ?? createDefaultEmptyDocument
  const provider =
    options.provider ??
    new IndexedDbPersistence(`FILE:${encodeURIComponent(normalizedFileId)}`, {
      databaseName: options.databaseName,
      factory: options.factory
    })

  return Object.freeze({
    fileId: normalizedFileId,
    provider: new SerialDocumentProvider(provider, createEmptyDocument),
    createEmptyDocument
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

export const persistAcceptedRemoteDocument = async (
  document: Pick<DocumentAccess, 'save'>
): Promise<void> => {
  const persistence = getActiveDocumentPersistence()
  const snapshot = await document.save()
  await persistence.provider.save(snapshot)
}

export const resetPersistedDocument = async (
  document: DocumentAccess
): Promise<void> => {
  const persistence = getActiveDocumentPersistence()
  document.load(persistence.createEmptyDocument())
  const snapshot = await document.save()
  await persistence.provider.save(snapshot)
}
