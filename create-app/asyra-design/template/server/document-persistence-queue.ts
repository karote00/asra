import type { SharedPublication } from '@asyra/factory'
import {
  DOCUMENT_PERSISTENCE_PROTOCOL_VERSION,
  type DocumentPersistenceBatch
} from './document-materializer'

export const DEFAULT_DOCUMENT_PERSISTENCE_FLUSH_INTERVAL_MS = 3_000
export const MIN_DOCUMENT_PERSISTENCE_FLUSH_INTERVAL_MS = 1_000
export const MAX_DOCUMENT_PERSISTENCE_FLUSH_INTERVAL_MS = 3_000
export const DEFAULT_DOCUMENT_PERSISTENCE_RETRY_INTERVAL_MS = 1_000
export const DEFAULT_DOCUMENT_PERSISTENCE_MAX_PUBLICATIONS = 256
export const DEFAULT_DOCUMENT_PERSISTENCE_MAX_SERIALIZED_BYTES = 4 * 1024 * 1024

type Awaitable<Value> = Value | Promise<Value>

export interface PendingDocumentPublication {
  readonly sequence: number
  readonly publication: SharedPublication
  readonly byteLength: number
}

export interface DocumentPersistenceQueueState {
  readonly editable: boolean
  readonly durableSequence: number
  readonly headSequence: number
  readonly pendingCount: number
  readonly inFlightBatchId?: string
}

export interface DocumentPersistenceQueue {
  enqueue(entry: PendingDocumentPublication): void
  enqueueBatch(entries: readonly PendingDocumentPublication[]): void
  flushNow(): Promise<void>
  flushForShutdown(): Promise<void>
  getState(): DocumentPersistenceQueueState
  dispose(): void
}

export interface DocumentPersistenceQueueOptions {
  readonly documentId: string
  readonly sendBatch: (
    batch: DocumentPersistenceBatch
  ) => Awaitable<Readonly<{ durableSequence: number }>>
  readonly onEditabilityChange?: (editable: boolean) => void
  readonly onDurableSequenceChange?: (durableSequence: number) => void
  readonly initialDurableSequence?: number
  readonly flushIntervalMs?: number
  readonly retryIntervalMs?: number
  readonly maxPublicationCount?: number
  readonly maxSerializedBytes?: number
}

interface InFlightBatch {
  readonly batch: DocumentPersistenceBatch
}

const isNonBlankString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0

const isPositiveSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0

const requirePositivePolicy = (value: number, name: string): number => {
  if (!isPositiveSafeInteger(value)) {
    throw new Error(`[document-persistence-queue] ${name} must be positive`)
  }
  return value
}

const createBatchId = (
  documentId: string,
  firstSequence: number,
  lastSequence: number
): string =>
  `document-persistence:${encodeURIComponent(documentId)}:${firstSequence}-${lastSequence}`

export const createDocumentPersistenceQueue = ({
  documentId,
  sendBatch,
  onEditabilityChange,
  onDurableSequenceChange,
  initialDurableSequence = 0,
  flushIntervalMs = DEFAULT_DOCUMENT_PERSISTENCE_FLUSH_INTERVAL_MS,
  retryIntervalMs = DEFAULT_DOCUMENT_PERSISTENCE_RETRY_INTERVAL_MS,
  maxPublicationCount = DEFAULT_DOCUMENT_PERSISTENCE_MAX_PUBLICATIONS,
  maxSerializedBytes = DEFAULT_DOCUMENT_PERSISTENCE_MAX_SERIALIZED_BYTES
}: DocumentPersistenceQueueOptions): DocumentPersistenceQueue => {
  if (!isNonBlankString(documentId)) {
    throw new Error(
      '[document-persistence-queue] document identity is required'
    )
  }
  if (
    !Number.isSafeInteger(flushIntervalMs) ||
    flushIntervalMs < MIN_DOCUMENT_PERSISTENCE_FLUSH_INTERVAL_MS ||
    flushIntervalMs > MAX_DOCUMENT_PERSISTENCE_FLUSH_INTERVAL_MS
  ) {
    throw new Error(
      '[document-persistence-queue] flush interval must be within 1000..3000 ms'
    )
  }
  if (!isNonNegativeSafeInteger(initialDurableSequence)) {
    throw new Error(
      '[document-persistence-queue] initial durable sequence is invalid'
    )
  }
  requirePositivePolicy(retryIntervalMs, 'retry interval')
  requirePositivePolicy(maxPublicationCount, 'publication count limit')
  requirePositivePolicy(maxSerializedBytes, 'serialized byte limit')

  let durableSequence = initialDurableSequence
  let headSequence = initialDurableSequence
  let editable = true
  let disposed = false
  let stopping = false
  let pending: PendingDocumentPublication[] = []
  let pendingBytes = 0
  let dirtyStartedAt: number | undefined
  let dirtyTimer: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let inFlight: InFlightBatch | undefined
  let activeAttempt: Promise<void> | undefined

  const setEditable = (next: boolean): void => {
    if (editable === next) return
    editable = next
    onEditabilityChange?.(next)
  }

  const clearDirtyTimer = (): void => {
    if (dirtyTimer !== undefined) clearTimeout(dirtyTimer)
    dirtyTimer = undefined
  }

  const clearRetryTimer = (): void => {
    if (retryTimer !== undefined) clearTimeout(retryTimer)
    retryTimer = undefined
  }

  const scheduleDirtyTimer = (): void => {
    if (dirtyTimer !== undefined || dirtyStartedAt === undefined || disposed) {
      return
    }
    const remaining = Math.max(0, dirtyStartedAt + flushIntervalMs - Date.now())
    dirtyTimer = setTimeout(() => {
      dirtyTimer = undefined
      void beginPendingBatch()
    }, remaining)
  }

  const scheduleRetry = (): void => {
    if (retryTimer !== undefined || disposed || stopping) return
    retryTimer = setTimeout(() => {
      retryTimer = undefined
      void attemptInFlight()
    }, retryIntervalMs)
  }

  const completeSuccessfulBatch = (
    completed: InFlightBatch,
    acknowledgement: Readonly<{ durableSequence: number }>
  ): void => {
    if (
      acknowledgement.durableSequence !== completed.batch.lastSequence ||
      inFlight !== completed
    ) {
      throw new Error(
        '[document-persistence-queue] backend durable acknowledgement is not contiguous'
      )
    }
    const wasBlocked = !editable
    durableSequence = acknowledgement.durableSequence
    onDurableSequenceChange?.(durableSequence)
    inFlight = undefined
    if (pending.length === 0) {
      dirtyStartedAt = undefined
      clearDirtyTimer()
      setEditable(true)
      return
    }
    const deadlineElapsed =
      dirtyStartedAt !== undefined &&
      dirtyStartedAt + flushIntervalMs <= Date.now()
    if (wasBlocked || deadlineElapsed || stopping) {
      void beginPendingBatch()
      return
    }
    scheduleDirtyTimer()
  }

  async function attemptInFlight(): Promise<void> {
    const active = inFlight
    if (!active || disposed) return
    clearRetryTimer()
    try {
      const acknowledgement = await sendBatch(active.batch)
      completeSuccessfulBatch(active, acknowledgement)
    } catch {
      if (inFlight !== active) return
      setEditable(false)
      scheduleRetry()
    }
  }

  function beginPendingBatch(): Promise<void> {
    if (disposed || inFlight || pending.length === 0) {
      return activeAttempt ?? Promise.resolve()
    }
    clearDirtyTimer()
    const entries = pending
    pending = []
    pendingBytes = 0
    dirtyStartedAt = undefined
    const firstSequence = entries[0]?.sequence
    const lastSequence = entries.at(-1)?.sequence
    if (
      firstSequence === undefined ||
      lastSequence === undefined ||
      firstSequence !== durableSequence + 1
    ) {
      throw new Error(
        '[document-persistence-queue] pending sequence is not contiguous with durability'
      )
    }
    const batch: DocumentPersistenceBatch = Object.freeze({
      protocolVersion: DOCUMENT_PERSISTENCE_PROTOCOL_VERSION,
      batchId: createBatchId(documentId, firstSequence, lastSequence),
      documentId,
      expectedDurableSequence: durableSequence,
      firstSequence,
      lastSequence,
      entries: Object.freeze(
        entries.map(({ sequence, publication }) =>
          Object.freeze({ documentId, sequence, publication })
        )
      )
    })
    inFlight = { batch }
    const trackedAttempt = attemptInFlight().finally(() => {
      if (activeAttempt === trackedAttempt) activeAttempt = undefined
    })
    activeAttempt = trackedAttempt
    return trackedAttempt
  }

  const queue: DocumentPersistenceQueue = {
    enqueue(entry) {
      queue.enqueueBatch([entry])
    },
    enqueueBatch(entries) {
      if (disposed) {
        throw new Error('[document-persistence-queue] queue is disposed')
      }
      if (!editable) {
        throw new Error(
          '[document-persistence-queue] document is unavailable until pending changes are durable'
        )
      }
      if (entries.length === 0) {
        throw new Error(
          '[document-persistence-queue] publication batch is empty'
        )
      }
      const addedBytes = entries.reduce((total, entry, index) => {
        if (
          !isPositiveSafeInteger(entry.sequence) ||
          entry.sequence !== headSequence + index + 1 ||
          !isPositiveSafeInteger(entry.byteLength) ||
          !isNonBlankString(entry.publication.publicationId)
        ) {
          throw new Error(
            '[document-persistence-queue] publication sequence is invalid'
          )
        }
        return total + entry.byteLength
      }, 0)
      if (
        inFlight &&
        (pending.length + entries.length > maxPublicationCount ||
          pendingBytes + addedBytes > maxSerializedBytes)
      ) {
        throw new Error(
          '[document-persistence-queue] pending capacity is unavailable until accepted changes are durable'
        )
      }
      headSequence = entries.at(-1)?.sequence as number
      if (pending.length === 0) {
        dirtyStartedAt = Date.now()
      }
      pending.push(...entries.map((entry) => Object.freeze({ ...entry })))
      pendingBytes += addedBytes
      scheduleDirtyTimer()
      if (
        pending.length >= maxPublicationCount ||
        pendingBytes >= maxSerializedBytes
      ) {
        if (inFlight) {
          setEditable(false)
        } else {
          void beginPendingBatch()
        }
      }
    },
    flushNow() {
      return beginPendingBatch()
    },
    async flushForShutdown() {
      if (disposed) return
      stopping = true
      clearDirtyTimer()
      clearRetryTimer()
      if (!inFlight) {
        await beginPendingBatch()
      } else if (activeAttempt) {
        await activeAttempt
      }
      while (!inFlight && pending.length > 0) {
        await beginPendingBatch()
      }
    },
    getState() {
      return Object.freeze({
        editable,
        durableSequence,
        headSequence,
        pendingCount: pending.length,
        ...(inFlight ? { inFlightBatchId: inFlight.batch.batchId } : {})
      })
    },
    dispose() {
      disposed = true
      stopping = true
      clearDirtyTimer()
      clearRetryTimer()
      pending = []
      pendingBytes = 0
      dirtyStartedAt = undefined
    }
  }

  return queue
}
