import { Buffer } from 'node:buffer'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { CoreRawData } from '@asyra/utils'
import { createFormalInitialDocument } from '../src/collaboration/initial-document'
import type {
  DocumentMaterializationStore,
  MaterializedDocumentRecord
} from './document-materializer'

const STORAGE_PROTOCOL_VERSION = 1

interface StoredDocumentRecord {
  readonly protocolVersion: number
  readonly documentId: string
  readonly record: MaterializedDocumentRecord<CoreRawData>
}

export interface FileDocumentMaterializationStore
  extends DocumentMaterializationStore<CoreRawData> {
  readCheckpoint(
    documentId: string
  ): Promise<MaterializedDocumentRecord<CoreRawData>>
  resetCheckpoint(documentId: string): Promise<void>
}

const createInitialRecord = (): MaterializedDocumentRecord<CoreRawData> => ({
  document: createFormalInitialDocument(),
  durableSequence: 0,
  publicationSequences: {},
  batches: {}
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseStoredRecord = (
  input: unknown,
  documentId: string
): MaterializedDocumentRecord<CoreRawData> => {
  if (
    !isRecord(input) ||
    input.protocolVersion !== STORAGE_PROTOCOL_VERSION ||
    input.documentId !== documentId ||
    !isRecord(input.record) ||
    !Number.isSafeInteger(input.record.durableSequence) ||
    Number(input.record.durableSequence) < 0 ||
    !isRecord(input.record.document) ||
    !isRecord(input.record.publicationSequences) ||
    !isRecord(input.record.batches)
  ) {
    throw new Error(
      `[document-backend-store] stored document "${documentId}" is invalid`
    )
  }
  return input.record as unknown as MaterializedDocumentRecord<CoreRawData>
}

const documentFileName = (documentId: string): string =>
  `${Buffer.from(documentId, 'utf8').toString('base64url')}.json`

export const createFileDocumentMaterializationStore = (
  dataDirectory: string
): FileDocumentMaterializationStore => {
  const directory = resolve(dataDirectory)
  const cache = new Map<string, MaterializedDocumentRecord<CoreRawData>>()
  const transactionTails = new Map<string, Promise<void>>()
  let temporaryFileSequence = 0

  const load = async (
    documentId: string
  ): Promise<MaterializedDocumentRecord<CoreRawData>> => {
    const cached = cache.get(documentId)
    if (cached) return cached
    const filePath = resolve(directory, documentFileName(documentId))
    let record: MaterializedDocumentRecord<CoreRawData>
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
    record: MaterializedDocumentRecord<CoreRawData>
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
      await store.transact(documentId, async (_current, commit) => {
        commit(createInitialRecord())
      })
    },
    async transact<Result>(
      documentId: string,
      execute: (
        current: MaterializedDocumentRecord<CoreRawData>,
        commit: (next: MaterializedDocumentRecord<CoreRawData>) => void
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
        let committed: MaterializedDocumentRecord<CoreRawData> | undefined
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
