import type { CanonicalChange } from '@asyra/core'
import { Buffer } from 'node:buffer'
import { decodeDocumentPublication } from '../src/collaboration/operations'
import { decodePublicationFramePublication } from '../src/collaboration/protocol'

export const DOCUMENT_PERSISTENCE_PROTOCOL_VERSION = 1

type Awaitable<Value> = Value | Promise<Value>

export interface SequencedDocumentPublication {
  readonly documentId: string
  readonly sequence: number
  readonly publicationId: string
  readonly encodedPublicationFrames: readonly string[]
}

export interface DocumentPersistenceBatch {
  readonly protocolVersion: number
  readonly batchId: string
  readonly documentId: string
  readonly expectedDurableSequence: number
  readonly firstSequence: number
  readonly lastSequence: number
  readonly entries: readonly SequencedDocumentPublication[]
}

export interface MaterializedDocumentRecord<Document> {
  readonly document: Document
  readonly durableSequence: number
  readonly publicationSequences: Readonly<Record<string, number>>
  readonly batches: Readonly<
    Record<
      string,
      Readonly<{
        firstSequence: number
        lastSequence: number
        publicationIds: readonly string[]
      }>
    >
  >
}

export interface DocumentMaterializationStore<Document> {
  transact<Result>(
    documentId: string,
    execute: (
      current: MaterializedDocumentRecord<Document>,
      commit: (next: MaterializedDocumentRecord<Document>) => void
    ) => Promise<Result>
  ): Promise<Result>
}

export interface DocumentMaterializationServiceOptions<Document> {
  readonly store: DocumentMaterializationStore<Document>
  readonly authorize: (
    documentId: string,
    batch: DocumentPersistenceBatch
  ) => Awaitable<void>
  readonly applyCanonicalChanges: (
    document: Document,
    changes: readonly CanonicalChange[]
  ) => Awaitable<Document>
}

export interface DocumentMaterializationService {
  materialize(input: unknown): Promise<Readonly<{ durableSequence: number }>>
}

interface PreparedPublication {
  readonly sequence: number
  readonly publicationId: string
  readonly canonicalChanges: readonly CanonicalChange[]
}

const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonBlankString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0

const isPositiveSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0

const parsePersistenceBatch = (input: unknown): DocumentPersistenceBatch => {
  if (
    !isRecord(input) ||
    input.protocolVersion !== DOCUMENT_PERSISTENCE_PROTOCOL_VERSION ||
    !isNonBlankString(input.batchId) ||
    !isNonBlankString(input.documentId) ||
    !isNonNegativeSafeInteger(input.expectedDurableSequence) ||
    !isPositiveSafeInteger(input.firstSequence) ||
    !isPositiveSafeInteger(input.lastSequence) ||
    !Array.isArray(input.entries) ||
    input.entries.length === 0
  ) {
    throw new Error('[document-materializer] persistence batch is invalid')
  }

  const protocolVersion = input.protocolVersion
  const batchId = input.batchId
  const documentId = input.documentId
  const expectedDurableSequence = input.expectedDurableSequence
  const firstSequence = input.firstSequence
  const lastSequence = input.lastSequence
  const entries: SequencedDocumentPublication[] = []
  const publicationIds = new Set<string>()
  input.entries.forEach((entry, index) => {
    const expectedSequence = firstSequence + index
    if (
      !isRecord(entry) ||
      entry.documentId !== documentId ||
      entry.sequence !== expectedSequence ||
      !isNonBlankString(entry.publicationId) ||
      publicationIds.has(entry.publicationId) ||
      !Array.isArray(entry.encodedPublicationFrames) ||
      entry.encodedPublicationFrames.length === 0 ||
      entry.encodedPublicationFrames.some(
        (frame) =>
          !isNonBlankString(frame) ||
          !BASE64_PATTERN.test(frame) ||
          Buffer.from(frame, 'base64').toString('base64') !== frame
      )
    ) {
      throw new Error(
        '[document-materializer] persistence batch entries must be contiguous and uniquely identified'
      )
    }
    publicationIds.add(entry.publicationId)
    entries.push({
      documentId: entry.documentId,
      sequence: entry.sequence,
      publicationId: entry.publicationId,
      encodedPublicationFrames: Object.freeze([
        ...entry.encodedPublicationFrames
      ])
    })
  })

  if (
    firstSequence !== expectedDurableSequence + 1 ||
    lastSequence !== firstSequence + entries.length - 1
  ) {
    throw new Error(
      '[document-materializer] persistence batch sequence must be contiguous'
    )
  }

  return Object.freeze({
    protocolVersion,
    batchId,
    documentId,
    expectedDurableSequence,
    firstSequence,
    lastSequence,
    entries: Object.freeze(entries.map((entry) => Object.freeze(entry)))
  })
}

const sameOrderedValues = (
  actual: readonly string[],
  expected: readonly string[]
): boolean =>
  actual.length === expected.length &&
  actual.every((value, index) => value === expected[index])

const getOwnValue = <Value>(
  values: Readonly<Record<string, Value>>,
  key: string
): Value | undefined =>
  Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined

const copyRegistry = <Value>(
  values: Readonly<Record<string, Value>>
): Record<string, Value> =>
  Object.assign(Object.create(null) as Record<string, Value>, values)

const assertExistingBatchIdentity = <Document>(
  current: MaterializedDocumentRecord<Document>,
  batch: DocumentPersistenceBatch,
  publicationIds: readonly string[]
): boolean => {
  const existing = getOwnValue(current.batches, batch.batchId)
  if (!existing) return false
  if (
    existing.firstSequence !== batch.firstSequence ||
    existing.lastSequence !== batch.lastSequence ||
    !sameOrderedValues(existing.publicationIds, publicationIds)
  ) {
    throw new Error(
      '[document-materializer] persistence batch identity conflicts with durable data'
    )
  }
  return true
}

const isFullyDurablePublicationRetry = <Document>(
  current: MaterializedDocumentRecord<Document>,
  prepared: readonly PreparedPublication[]
): boolean => {
  let knownCount = 0
  for (const item of prepared) {
    const durableSequence = getOwnValue(
      current.publicationSequences,
      item.publicationId
    )
    if (durableSequence === undefined) continue
    knownCount += 1
    if (durableSequence !== item.sequence) {
      throw new Error(
        '[document-materializer] publication identity conflicts with durable data'
      )
    }
  }
  if (knownCount === 0) return false
  if (knownCount !== prepared.length) {
    throw new Error(
      '[document-materializer] persistence batch partially overlaps durable data'
    )
  }
  return true
}

export const createDocumentMaterializationService = <Document>({
  store,
  authorize,
  applyCanonicalChanges
}: DocumentMaterializationServiceOptions<Document>): DocumentMaterializationService => ({
  async materialize(input) {
    const batch = parsePersistenceBatch(input)
    await authorize(batch.documentId, batch)

    const prepared = Object.freeze(
      batch.entries.map((entry) => {
        const decoded = decodePublicationFramePublication(
          entry.encodedPublicationFrames.map(
            (frame) => new Uint8Array(Buffer.from(frame, 'base64'))
          )
        )
        if (decoded.publication.publicationId !== entry.publicationId) {
          throw new Error(
            '[document-materializer] publication identity conflicts with encoded bytes'
          )
        }
        return Object.freeze({
          sequence: entry.sequence,
          publicationId: entry.publicationId,
          canonicalChanges: decodeDocumentPublication(decoded.publication)
        })
      })
    )
    const publicationIds = Object.freeze(
      prepared.map(({ publicationId }) => publicationId)
    )

    return store.transact(batch.documentId, async (current, commit) => {
      const existingBatch = assertExistingBatchIdentity(
        current,
        batch,
        publicationIds
      )
      const publicationRetry = isFullyDurablePublicationRetry(current, prepared)
      if (existingBatch || publicationRetry) {
        if (current.durableSequence < batch.lastSequence) {
          throw new Error(
            '[document-materializer] durable retry watermark is inconsistent'
          )
        }
        return Object.freeze({
          durableSequence: current.durableSequence
        })
      }

      if (current.durableSequence !== batch.expectedDurableSequence) {
        throw new Error(
          '[document-materializer] expected durable sequence conflicts with stored checkpoint'
        )
      }

      let document = current.document
      for (const item of prepared) {
        document = await applyCanonicalChanges(document, item.canonicalChanges)
      }

      const publicationSequences = copyRegistry(current.publicationSequences)
      prepared.forEach(({ publicationId, sequence }) => {
        publicationSequences[publicationId] = sequence
      })
      const batches = copyRegistry(current.batches)
      batches[batch.batchId] = Object.freeze({
        firstSequence: batch.firstSequence,
        lastSequence: batch.lastSequence,
        publicationIds
      })
      commit({
        document,
        durableSequence: batch.lastSequence,
        publicationSequences: Object.freeze(publicationSequences),
        batches: Object.freeze(batches)
      })

      return Object.freeze({
        durableSequence: batch.lastSequence
      })
    })
  }
})
