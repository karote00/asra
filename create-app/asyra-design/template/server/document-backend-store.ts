import { Buffer } from 'node:buffer'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { AppDocumentData } from '../src/collaboration/app-protocol-types'
import { createFormalInitialDocument } from '../src/collaboration/initial-document'
import type {
  DocumentMaterializationStore,
  MaterializedDocumentRecord
} from './document-materializer'

const STORAGE_PROTOCOL_VERSION = 1

interface StoredDocumentRecord {
  readonly protocolVersion: number
  readonly documentId: string
  readonly record: MaterializedDocumentRecord<AppDocumentData>
}

export interface FileDocumentMaterializationStore
  extends DocumentMaterializationStore<AppDocumentData> {
  readCheckpoint(
    documentId: string
  ): Promise<MaterializedDocumentRecord<AppDocumentData>>
  resetCheckpoint(documentId: string): Promise<number>
}

const createInitialRecord = (
  documentGeneration = 0
): MaterializedDocumentRecord<AppDocumentData> => ({
  document: createFormalInitialDocument(),
  documentGeneration,
  durableSequence: 0,
  publicationSequences: {},
  batches: {}
})

const formalInitialDocumentJson = JSON.stringify(createFormalInitialDocument())

const inferLegacyDocumentGeneration = (
  record: Record<string, unknown>
): number => {
  if (
    record.durableSequence === 0 &&
    isRecord(record.document) &&
    JSON.stringify(record.document) === formalInitialDocumentJson &&
    isRecord(record.publicationSequences) &&
    Object.keys(record.publicationSequences).length === 0 &&
    isRecord(record.batches) &&
    Object.keys(record.batches).length === 0
  ) {
    // Before document generations existed, the backend wrote an explicit
    // sequence-zero file only for Reset. A never-persisted document has no
    // file and remains generation zero.
    return 1
  }
  return 0
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseStoredRecord = (
  input: unknown,
  documentId: string
): MaterializedDocumentRecord<AppDocumentData> => {
  if (
    !isRecord(input) ||
    input.protocolVersion !== STORAGE_PROTOCOL_VERSION ||
    input.documentId !== documentId ||
    !isRecord(input.record) ||
    !Number.isSafeInteger(input.record.durableSequence) ||
    Number(input.record.durableSequence) < 0 ||
    (Object.prototype.hasOwnProperty.call(input.record, 'documentGeneration') &&
      (!Number.isSafeInteger(input.record.documentGeneration) ||
        Number(input.record.documentGeneration) < 0)) ||
    !isRecord(input.record.document) ||
    !isRecord(input.record.publicationSequences) ||
    !isRecord(input.record.batches)
  ) {
    throw new Error(
      `[document-backend-store] stored document "${documentId}" is invalid`
    )
  }
  const record =
    input.record as unknown as MaterializedDocumentRecord<AppDocumentData>
  return {
    ...record,
    documentGeneration:
      record.documentGeneration ?? inferLegacyDocumentGeneration(input.record)
  }
}

const documentFileName = (documentId: string): string =>
  `${Buffer.from(documentId, 'utf8').toString('base64url')}.json`

export const createFileDocumentMaterializationStore = (
  dataDirectory: string
): FileDocumentMaterializationStore => {
  const directory = resolve(dataDirectory)
  const cache = new Map<string, MaterializedDocumentRecord<AppDocumentData>>()
  const transactionTails = new Map<string, Promise<void>>()
  let temporaryFileSequence = 0

  const load = async (
    documentId: string
  ): Promise<MaterializedDocumentRecord<AppDocumentData>> => {
    const cached = cache.get(documentId)
    if (cached) return cached
    const filePath = resolve(directory, documentFileName(documentId))
    let record: MaterializedDocumentRecord<AppDocumentData>
    try {
      record = parseStoredRecord(
        JSON.parse(await readFile(filePath, 'utf8')) as unknown,
        documentId
      )
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        record = createInitialRecord()
      } else {
        throw error
      }
    }
    cache.set(documentId, record)
    return record
  }

  const persist = async (
    documentId: string,
    record: MaterializedDocumentRecord<AppDocumentData>
  ): Promise<void> => {
    await mkdir(directory, { recursive: true })
    const filePath = resolve(directory, documentFileName(documentId))
    const temporaryPath = `${filePath}.${String(
      process.pid
    )}.${String(++temporaryFileSequence)}.tmp`
    const stored: StoredDocumentRecord = {
      protocolVersion: STORAGE_PROTOCOL_VERSION,
      documentId,
      record
    }
    await writeFile(temporaryPath, JSON.stringify(stored), {
      encoding: 'utf8',
      flag: 'wx'
    })
    await rename(temporaryPath, filePath)
  }

  const store: FileDocumentMaterializationStore = {
    readCheckpoint: load,
    resetCheckpoint: async (documentId) => {
      return store.transact(documentId, async (current, commit) => {
        const documentGeneration = (current.documentGeneration ?? 0) + 1
        commit(createInitialRecord(documentGeneration))
        return documentGeneration
      })
    },
    async transact<Result>(
      documentId: string,
      execute: (
        current: MaterializedDocumentRecord<AppDocumentData>,
        commit: (next: MaterializedDocumentRecord<AppDocumentData>) => void
      ) => Promise<Result>
    ): Promise<Result> {
      const previous = transactionTails.get(documentId) ?? Promise.resolve()
      let releaseTransaction: (() => void) | undefined
      const transactionDone = new Promise<void>((resolveTransaction) => {
        releaseTransaction = resolveTransaction
      })
      const tail = previous.then(() => transactionDone)
      transactionTails.set(documentId, tail)
      await previous
      try {
        const current = await load(documentId)
        let committed: MaterializedDocumentRecord<AppDocumentData> | undefined
        const result = await execute(current, (next) => {
          if (committed) {
            throw new Error(
              '[document-backend-store] one transaction may commit only once'
            )
          }
          committed = next
        })
        if (committed) {
          await persist(documentId, committed)
          cache.set(documentId, committed)
        }
        return result
      } finally {
        releaseTransaction?.()
        if (transactionTails.get(documentId) === tail) {
          transactionTails.delete(documentId)
        }
      }
    }
  }
  return store
}
