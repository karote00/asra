import {
  IndexedDbPersistence,
  LocalStoragePersistence,
  providers,
  type IPersistenceProvider
} from '@asyra/reactive-events'
import type { CoreRawData } from '@asyra/utils'

const DEFAULT_DOCUMENT_STORAGE_KEY = 'FILE'

export const getDocumentStorageKey = (fileId?: string): string =>
  fileId
    ? `${DEFAULT_DOCUMENT_STORAGE_KEY}:${encodeURIComponent(fileId)}`
    : DEFAULT_DOCUMENT_STORAGE_KEY

export const createDocumentPersistence = (
  fileId?: string
): IPersistenceProvider =>
  fileId
    ? new IndexedDbPersistence(getDocumentStorageKey(fileId))
    : providers.indexedDB

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isLegacyDocumentEligibleForMigration = (
  value: unknown
): value is CoreRawData =>
  isRecord(value) &&
  typeof value.version === 'string' &&
  isRecord(value.sceneTree) &&
  isRecord(value.props)

export const initializeDocumentPersistence = async (
  persistence: IPersistenceProvider,
  emptyDocument: CoreRawData,
  fileId?: string
): Promise<void> => {
  if ((await persistence.load()) !== null) {
    return
  }

  const legacyPersistence = new LocalStoragePersistence(
    getDocumentStorageKey(fileId)
  )
  const legacyDocument = await legacyPersistence.load()
  if (isLegacyDocumentEligibleForMigration(legacyDocument)) {
    await persistence.save(legacyDocument)
    await legacyPersistence.clear()
    return
  }

  await persistence.save(emptyDocument)
}

export const clearDocumentPersistence = async (
  fileId?: string
): Promise<void> => {
  await createDocumentPersistence(fileId).clear()
  await new LocalStoragePersistence(getDocumentStorageKey(fileId)).clear()
}
