import {
  LocalStoragePersistence,
  providers,
  type IPersistenceProvider
} from '@asyra/reactive-events'

const DEFAULT_DOCUMENT_STORAGE_KEY = 'FILE'

export const getDocumentStorageKey = (fileId?: string): string =>
  fileId
    ? `${DEFAULT_DOCUMENT_STORAGE_KEY}:${encodeURIComponent(fileId)}`
    : DEFAULT_DOCUMENT_STORAGE_KEY

export const createDocumentPersistence = (
  fileId?: string
): IPersistenceProvider =>
  fileId
    ? new LocalStoragePersistence(getDocumentStorageKey(fileId))
    : providers.localStorage
