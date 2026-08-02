import {
  subscribeToBrowserDragPhases,
  subscribeToDiagnosticCounters,
  type BrowserDragPhaseSink,
  type DiagnosticCounterSink,
  type TransactionStatusPayload
} from '@asyra/utils'
import type {
  AiConversationController,
  AiConversationSnapshot
} from '../../ai/conversation'

export type AiDrawingPerformanceRuntime = 'development' | 'production'

export interface AiDrawingPerformancePhaseSample {
  readonly atMs: number
  readonly durationMs: number
  readonly name: string
}

export interface AiDrawingPerformanceCounterSample {
  readonly atMs: number
  readonly name: string
  readonly value: number
}

export interface AiDrawingPerformanceCanonicalElement {
  readonly computed: unknown
  readonly id: string
  readonly raw: unknown
  readonly rendered: boolean
  readonly type: string
}

export interface AiDrawingPerformanceCanonicalOwnerSnapshot {
  readonly props: unknown
  readonly sceneTree: unknown
}

export interface AiDrawingPerformanceViewportPosition {
  readonly x: number
  readonly y: number
}

export interface AiDrawingPerformanceFactoryPublicationEvidence {
  readonly capturedAtMs: number
  readonly deliveryCount: number
  readonly publicationId: string
}

export interface AiDrawingPerformanceFactoryCommitEvidence {
  readonly capturedAtMs: number
  readonly origin: TransactionStatusPayload['origin']
  readonly transactionId: number
  readonly undoableChangeCount: number
}

export interface AiDrawingPerformanceDiagnosticErrorEvidence {
  readonly message: string
  readonly name: string
}

export type AiDrawingPerformanceDiagnosticValue =
  | AiDrawingPerformanceDiagnosticErrorEvidence
  | string

export interface AiDrawingPerformanceFactoryTransactionStatusEvidence {
  readonly capturedAtMs: number
  readonly changeCount: number
  readonly error?: AiDrawingPerformanceDiagnosticValue
  readonly failure?: {
    readonly cause?: AiDrawingPerformanceDiagnosticValue
    readonly kind: NonNullable<TransactionStatusPayload['failure']>['kind']
    readonly message?: string
  }
  readonly nonRollbackableChangeCount: number
  readonly origin: TransactionStatusPayload['origin']
  readonly providerName?: string
  readonly rollbackableChangeCount: number
  readonly status: TransactionStatusPayload['status']
  readonly transactionId: number
  readonly undoableChangeCount: number
}

export interface AiDrawingPerformanceRuntimeEvidence {
  readonly factoryCommits: readonly AiDrawingPerformanceFactoryCommitEvidence[]
  readonly factoryPublications: readonly AiDrawingPerformanceFactoryPublicationEvidence[]
  readonly factoryStatuses: readonly AiDrawingPerformanceFactoryTransactionStatusEvidence[]
}

export interface AiDrawingPerformanceRuntimeEvidenceSource {
  readCanonicalElementCount(): number
  readCanonicalElements(): readonly AiDrawingPerformanceCanonicalElement[]
  readCanonicalOwnerSnapshot(): AiDrawingPerformanceCanonicalOwnerSnapshot
  readHistoryDepth(): number
  readRenderProjectionElementCount(): number
  readViewportPosition(): AiDrawingPerformanceViewportPosition
  readZoom(): number
  subscribeToTransactionStatus(
    subscriber: (status: TransactionStatusPayload) => void
  ): () => void
}

export interface AiDrawingPerformanceSnapshot {
  readonly counters: readonly AiDrawingPerformanceCounterSample[]
  readonly phases: readonly AiDrawingPerformancePhaseSample[]
  readonly releaseEvidenceEligible: boolean
  readonly runtime: AiDrawingPerformanceRuntime
}

export interface AiDrawingPerformanceTurnSettlementEvidence {
  readonly code: string | null
  readonly message: string | null
  readonly outcome: AiConversationSnapshot['settledTurns'][number]['outcome']
  readonly stage: string | null
  readonly status: string | null
}

export interface AiDrawingPerformanceProfile {
  attachConversation(conversation: AiConversationController | null): () => void
  dispose(): void
  getRuntimeEvidence(): AiDrawingPerformanceRuntimeEvidence
  readConversationSnapshot(): AiConversationSnapshot | null
  readCounterTotal(name: string): number
  readPhaseCount(name: string): number
  readCanonicalElementCount(): number
  readCanonicalElements(): readonly AiDrawingPerformanceCanonicalElement[]
  readCanonicalOwnerSnapshot(): AiDrawingPerformanceCanonicalOwnerSnapshot
  readFactoryPublicationCount(): number
  readHistoryDepth(): number
  readLatestFactoryTransactionStatus(): AiDrawingPerformanceFactoryTransactionStatusEvidence | null
  readLatestPhaseSample(): AiDrawingPerformancePhaseSample | null
  readLatestTurnSettlement(): AiDrawingPerformanceTurnSettlementEvidence | null
  readRenderProjectionElementCount(): number
  readViewportPosition(): AiDrawingPerformanceViewportPosition
  readZoom(): number
  reset(): void
  snapshot(): AiDrawingPerformanceSnapshot
}

interface InstallAiDrawingPerformanceProfileOptions {
  readonly epochNow?: () => number
  readonly now?: () => number
  readonly runtime: AiDrawingPerformanceRuntime
}

const RETAINED_EVIDENCE_CAPACITY = 16_384
const RETAINED_COUNTER_KEY_CAPACITY = 1_024
const RETAINED_EVIDENCE_NAME_LENGTH = 160

const isBoundedEvidenceName = (name: unknown): name is string =>
  typeof name === 'string' &&
  name.length > 0 &&
  name.length <= RETAINED_EVIDENCE_NAME_LENGTH

const readBoundedOwnString = (
  value: unknown,
  key: string,
  maximumLength: number
): string | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  return descriptor?.enumerable &&
    'value' in descriptor &&
    typeof descriptor.value === 'string'
    ? descriptor.value.slice(0, maximumLength)
    : null
}

const captureTurnSettlement = (
  settled: AiConversationSnapshot['settledTurns'][number]
): AiDrawingPerformanceTurnSettlementEvidence =>
  Object.freeze({
    code: readBoundedOwnString(settled.result, 'code', 80),
    message: readBoundedOwnString(settled.result, 'message', 300),
    outcome: settled.outcome,
    stage: readBoundedOwnString(settled.result, 'stage', 80),
    status: readBoundedOwnString(settled.result, 'status', 80)
  })

class BoundedEvidenceBuffer<T> {
  private readonly entries: T[] = []
  private nextWriteIndex = 0

  constructor(private readonly capacity: number) {}

  append(value: T): void {
    if (this.entries.length < this.capacity) {
      this.entries.push(value)
      return
    }

    this.entries[this.nextWriteIndex] = value
    this.nextWriteIndex = (this.nextWriteIndex + 1) % this.capacity
  }

  clear(): void {
    this.entries.length = 0
    this.nextWriteIndex = 0
  }

  get length(): number {
    return this.entries.length
  }

  latest(): T | undefined {
    if (this.entries.length === 0) return
    if (this.entries.length < this.capacity) {
      return this.entries.at(-1)
    }
    return this.entries[
      (this.nextWriteIndex + this.capacity - 1) % this.capacity
    ]
  }

  toArray(): T[] {
    if (this.entries.length < this.capacity || this.nextWriteIndex === 0) {
      return [...this.entries]
    }
    return [
      ...this.entries.slice(this.nextWriteIndex),
      ...this.entries.slice(0, this.nextWriteIndex)
    ]
  }
}

interface AiDrawingPerformanceRuntimeEvidenceOwner {
  attach(source: AiDrawingPerformanceRuntimeEvidenceSource): () => void
  recordPublication(publication: {
    readonly deliveryCount: number
    readonly publicationId: string
  }): void
}

const runtimeEvidenceOwners = new WeakMap<
  AiDrawingPerformanceProfile,
  AiDrawingPerformanceRuntimeEvidenceOwner
>()
let activePerformanceProfile: AiDrawingPerformanceProfile | null = null

export const getActiveAiDrawingPerformanceProfile =
  (): AiDrawingPerformanceProfile | null => activePerformanceProfile

const serializeDiagnosticValue = (
  value: unknown
): AiDrawingPerformanceDiagnosticValue | undefined => {
  if (value === undefined) return
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return String(value).slice(0, 300)
  }
  const readOwnDiagnosticString = (
    target: object,
    key: string,
    maximumLength: number
  ): string | undefined => {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(target, key)
      return descriptor &&
        'value' in descriptor &&
        typeof descriptor.value === 'string'
        ? descriptor.value.slice(0, maximumLength)
        : undefined
    } catch {
      return
    }
  }
  const candidate = value as object
  const message = readOwnDiagnosticString(candidate, 'message', 300)
  let name = readOwnDiagnosticString(candidate, 'name', 80)
  if (!name && message) {
    try {
      const prototype = Object.getPrototypeOf(candidate)
      if (prototype) {
        name = readOwnDiagnosticString(prototype, 'name', 80)
      }
    } catch {
      // Hostile diagnostic objects retain bounded fallback evidence.
    }
  }
  if (message || name) {
    return Object.freeze({
      message: message ?? 'Diagnostic value unavailable',
      name: name ?? 'Error'
    })
  }
  return 'Diagnostic value unavailable'
}

const captureFactoryTransactionStatus = (
  status: TransactionStatusPayload
): AiDrawingPerformanceFactoryTransactionStatusEvidence => {
  const cause = serializeDiagnosticValue(status.failure?.cause)
  const error = serializeDiagnosticValue(status.error)
  return Object.freeze({
    capturedAtMs: status.timestamp,
    changeCount: status.changeCount,
    ...(error === undefined ? {} : { error }),
    ...(status.failure
      ? {
          failure: Object.freeze({
            ...(cause === undefined ? {} : { cause }),
            kind: status.failure.kind,
            ...(status.failure.message === undefined
              ? {}
              : { message: status.failure.message.slice(0, 300) })
          })
        }
      : {}),
    nonRollbackableChangeCount: status.nonRollbackableChangeCount,
    origin: status.origin,
    ...(status.providerName === undefined
      ? {}
      : { providerName: status.providerName.slice(0, 80) }),
    rollbackableChangeCount: status.rollbackableChangeCount,
    status: status.status,
    transactionId: status.transactionId,
    undoableChangeCount: status.undoableChangeCount
  })
}

export const attachAiDrawingPerformanceRuntimeEvidence = (
  profile: AiDrawingPerformanceProfile,
  source: AiDrawingPerformanceRuntimeEvidenceSource
): (() => void) =>
  runtimeEvidenceOwners.get(profile)?.attach(source) ?? (() => undefined)

export const recordAiDrawingPerformancePublication = (
  profile: AiDrawingPerformanceProfile,
  publication: {
    readonly deliveryCount: number
    readonly publicationId: string
  }
): void => {
  try {
    runtimeEvidenceOwners.get(profile)?.recordPublication(publication)
  } catch {
    // Profiling observers are never allowed to alter shared publication.
  }
}

export const isAiDrawingPerformanceProfileRequested = (
  search: string
): boolean => {
  const values = new URLSearchParams(search).getAll('aiPerformance')
  return values.length === 1 && values[0] === 'profile'
}

const callDetached = <T extends readonly unknown[]>(
  observer: ((...args: T) => void) | undefined,
  ...args: T
): void => {
  try {
    observer?.(...args)
  } catch {
    // Profiling observers are never allowed to alter the measured product flow.
  }
}

const freezeSnapshot = (
  counters: readonly AiDrawingPerformanceCounterSample[],
  phases: readonly AiDrawingPerformancePhaseSample[],
  hasCompleteReleaseEvidence: boolean,
  runtime: AiDrawingPerformanceRuntime
): AiDrawingPerformanceSnapshot =>
  Object.freeze({
    counters: Object.freeze(counters.map((sample) => Object.freeze(sample))),
    phases: Object.freeze(phases.map((sample) => Object.freeze(sample))),
    releaseEvidenceEligible:
      runtime === 'production' && hasCompleteReleaseEvidence,
    runtime
  })

export const installAiDrawingPerformanceProfile = ({
  epochNow = () => performance.timeOrigin + performance.now(),
  now = () => performance.now(),
  runtime
}: InstallAiDrawingPerformanceProfileOptions): AiDrawingPerformanceProfile => {
  const counters = new BoundedEvidenceBuffer<AiDrawingPerformanceCounterSample>(
    RETAINED_EVIDENCE_CAPACITY
  )
  const counterTotals = new Map<string, number>()
  const factoryCommits =
    new BoundedEvidenceBuffer<AiDrawingPerformanceFactoryCommitEvidence>(
      RETAINED_EVIDENCE_CAPACITY
    )
  const factoryPublications =
    new BoundedEvidenceBuffer<AiDrawingPerformanceFactoryPublicationEvidence>(
      RETAINED_EVIDENCE_CAPACITY
    )
  const factoryStatuses =
    new BoundedEvidenceBuffer<AiDrawingPerformanceFactoryTransactionStatusEvidence>(
      RETAINED_EVIDENCE_CAPACITY
    )
  const phaseCounts = new Map<string, number>()
  const phases = new BoundedEvidenceBuffer<AiDrawingPerformancePhaseSample>(
    RETAINED_EVIDENCE_CAPACITY
  )
  let baselineMs = now()
  let conversationDisposer: (() => void) | null = null
  let disposed = false
  let hasAcceptedToSettledEvidence = false
  let hasAcceptedTurnEvidence = false
  let hasSettledOutcomeEvidence = false
  let latestTurnSettlement: AiDrawingPerformanceTurnSettlementEvidence | null =
    null
  let previousConversationSnapshot: AiConversationSnapshot | null = null
  let observedRuntimeProgressCount = 0
  let runtimeProgressClock: {
    readonly phase: string
    readonly startedAtMs: number
  } | null = null
  let runtimeEvidenceDisposer: (() => void) | null = null
  let runtimeEvidenceSource: AiDrawingPerformanceRuntimeEvidenceSource | null =
    null

  const elapsed = () => Math.max(0, now() - baselineMs)
  const recordPhaseAt = (name: string, durationMs: number, atMs: number) => {
    if (
      disposed ||
      !isBoundedEvidenceName(name) ||
      !Number.isFinite(durationMs)
    ) {
      return
    }
    phases.append(
      Object.freeze({
        atMs: Math.max(0, atMs),
        durationMs: Math.max(0, durationMs),
        name
      })
    )
    if (
      phaseCounts.has(name) ||
      phaseCounts.size < RETAINED_COUNTER_KEY_CAPACITY
    ) {
      phaseCounts.set(name, (phaseCounts.get(name) ?? 0) + 1)
    }
    if (name === 'ai-turn:accepted-to-settled') {
      hasAcceptedToSettledEvidence = true
    }
  }
  const recordPhase = (name: string, durationMs: number) => {
    recordPhaseAt(name, durationMs, elapsed())
  }
  const recordCounterAt = (name: string, value: number, atMs: number) => {
    if (
      disposed ||
      !isBoundedEvidenceName(name) ||
      !Number.isFinite(value) ||
      (!counterTotals.has(name) &&
        counterTotals.size >= RETAINED_COUNTER_KEY_CAPACITY)
    ) {
      return
    }
    counters.append(Object.freeze({ atMs: Math.max(0, atMs), name, value }))
    counterTotals.set(name, (counterTotals.get(name) ?? 0) + value)
    if (name === 'ai-turn:accepted') {
      hasAcceptedTurnEvidence = true
    }
    if (name.startsWith('ai-turn:outcome:')) {
      hasSettledOutcomeEvidence = true
    }
  }
  const recordCounter = (name: string, value: number) => {
    recordCounterAt(name, value, elapsed())
  }
  const phaseSink: BrowserDragPhaseSink = (name, durationMs) => {
    recordPhase(name, durationMs)
  }
  const counterSink: DiagnosticCounterSink = (name, value) => {
    recordCounter(name, value)
  }
  const detachPhaseSink = subscribeToBrowserDragPhases(phaseSink)
  const detachCounterSink = subscribeToDiagnosticCounters(counterSink)

  const attachRuntimeEvidence = (
    source: AiDrawingPerformanceRuntimeEvidenceSource
  ): (() => void) => {
    runtimeEvidenceDisposer?.()
    runtimeEvidenceDisposer = null
    runtimeEvidenceSource = null
    if (disposed) {
      return () => undefined
    }

    let detachTransactionStatus: (() => void) | undefined
    try {
      detachTransactionStatus = source.subscribeToTransactionStatus(
        (status) => {
          if (disposed || !Number.isFinite(status.timestamp)) return
          factoryStatuses.append(captureFactoryTransactionStatus(status))
          if (status.status !== 'committed') return
          factoryCommits.append(
            Object.freeze({
              capturedAtMs: status.timestamp,
              origin: status.origin,
              transactionId: status.transactionId,
              undoableChangeCount: status.undoableChangeCount
            })
          )
        }
      )
    } catch {
      callDetached(detachTransactionStatus)
      return () => undefined
    }

    runtimeEvidenceSource = source
    let detached = false
    const detachRuntimeEvidence = () => {
      if (detached) return
      detached = true
      callDetached(detachTransactionStatus)
      if (runtimeEvidenceDisposer === detachRuntimeEvidence) {
        runtimeEvidenceDisposer = null
        runtimeEvidenceSource = null
      }
    }
    runtimeEvidenceDisposer = detachRuntimeEvidence
    return detachRuntimeEvidence
  }

  const recordPublication = (publication: {
    readonly deliveryCount: number
    readonly publicationId: string
  }): void => {
    const capturedAtMs = epochNow()
    if (disposed || !Number.isFinite(capturedAtMs)) return
    factoryPublications.append(
      Object.freeze({
        capturedAtMs,
        deliveryCount: publication.deliveryCount,
        publicationId: publication.publicationId
      })
    )
  }

  const profile: AiDrawingPerformanceProfile = Object.freeze({
    attachConversation: (conversation: AiConversationController | null) => {
      conversationDisposer?.()
      conversationDisposer = null
      previousConversationSnapshot = null
      latestTurnSettlement = null
      observedRuntimeProgressCount = 0
      runtimeProgressClock = null
      if (!conversation || disposed) {
        return () => undefined
      }
      const unsubscribe = conversation.subscribe((snapshot) => {
        const previous = previousConversationSnapshot
        const observedAtMs = now()
        const observedElapsedMs = Math.max(0, observedAtMs - baselineMs)
        if (!previous?.activeTurn && snapshot.activeTurn) {
          recordCounterAt('ai-turn:accepted', 1, observedElapsedMs)
          observedRuntimeProgressCount = 0
          runtimeProgressClock = null
        }
        if (snapshot.activeTurn) {
          const nextProgress = snapshot.activeTurn.progress.slice(
            observedRuntimeProgressCount
          )
          for (const update of nextProgress) {
            if (
              runtimeProgressClock &&
              runtimeProgressClock.phase !== update.phase &&
              runtimeProgressClock.phase !== 'settled'
            ) {
              recordPhaseAt(
                `ai-runtime:${runtimeProgressClock.phase}`,
                observedAtMs - runtimeProgressClock.startedAtMs,
                observedElapsedMs
              )
            }
            if (
              !runtimeProgressClock ||
              runtimeProgressClock.phase !== update.phase
            ) {
              runtimeProgressClock = {
                phase: update.phase,
                startedAtMs: observedAtMs
              }
            }
          }
          observedRuntimeProgressCount = snapshot.activeTurn.progress.length
        } else if (previous?.activeTurn) {
          if (
            runtimeProgressClock &&
            runtimeProgressClock.phase !== 'settled'
          ) {
            recordPhaseAt(
              `ai-runtime:${runtimeProgressClock.phase}`,
              observedAtMs - runtimeProgressClock.startedAtMs,
              observedElapsedMs
            )
          }
          observedRuntimeProgressCount = 0
          runtimeProgressClock = null
        }
        if (
          snapshot.settledTurns.length > (previous?.settledTurns.length ?? 0)
        ) {
          const settled = snapshot.settledTurns.at(-1)
          if (settled) {
            latestTurnSettlement = captureTurnSettlement(settled)
            recordPhaseAt(
              'ai-turn:accepted-to-settled',
              settled.durationMs,
              observedElapsedMs
            )
            recordCounterAt(
              `ai-turn:outcome:${settled.outcome}`,
              1,
              observedElapsedMs
            )
          }
        }
        previousConversationSnapshot = snapshot
      })
      conversationDisposer = () => {
        unsubscribe()
        observedRuntimeProgressCount = 0
        runtimeProgressClock = null
        if (conversationDisposer) {
          conversationDisposer = null
        }
      }
      return conversationDisposer
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      conversationDisposer?.()
      conversationDisposer = null
      observedRuntimeProgressCount = 0
      runtimeProgressClock = null
      runtimeEvidenceDisposer?.()
      runtimeEvidenceDisposer = null
      runtimeEvidenceSource = null
      detachPhaseSink()
      detachCounterSink()
      if (
        typeof window !== 'undefined' &&
        window.__AiDrawingPerformance__ === profile
      ) {
        delete window.__AiDrawingPerformance__
      }
      if (activePerformanceProfile === profile) {
        activePerformanceProfile = null
      }
      runtimeEvidenceOwners.delete(profile)
    },
    getRuntimeEvidence: () =>
      (() => {
        const detached = structuredClone({
          factoryCommits: factoryCommits.toArray(),
          factoryPublications: factoryPublications.toArray(),
          factoryStatuses: factoryStatuses.toArray()
        })
        return Object.freeze({
          factoryCommits: Object.freeze(
            detached.factoryCommits.map((evidence) => Object.freeze(evidence))
          ),
          factoryPublications: Object.freeze(
            detached.factoryPublications.map((evidence) =>
              Object.freeze(evidence)
            )
          ),
          factoryStatuses: Object.freeze(
            detached.factoryStatuses.map((evidence) => Object.freeze(evidence))
          )
        })
      })(),
    readConversationSnapshot: () =>
      previousConversationSnapshot
        ? structuredClone(previousConversationSnapshot)
        : null,
    readCounterTotal: (name: string) => counterTotals.get(name) ?? 0,
    readPhaseCount: (name: string) => phaseCounts.get(name) ?? 0,
    readCanonicalElementCount: () => {
      if (!runtimeEvidenceSource || disposed) {
        throw new Error(
          'AI drawing performance runtime evidence is unavailable'
        )
      }
      const count = runtimeEvidenceSource.readCanonicalElementCount()
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error(
          'AI drawing performance canonical element count is invalid'
        )
      }
      return count
    },
    readCanonicalElements: () => {
      if (!runtimeEvidenceSource || disposed) {
        throw new Error(
          'AI drawing performance runtime evidence is unavailable'
        )
      }
      return structuredClone(runtimeEvidenceSource.readCanonicalElements())
    },
    readCanonicalOwnerSnapshot: () => {
      if (!runtimeEvidenceSource || disposed) {
        throw new Error(
          'AI drawing performance runtime evidence is unavailable'
        )
      }
      return structuredClone(runtimeEvidenceSource.readCanonicalOwnerSnapshot())
    },
    readFactoryPublicationCount: () => {
      if (disposed) {
        throw new Error(
          'AI drawing performance runtime evidence is unavailable'
        )
      }
      return factoryPublications.length
    },
    readHistoryDepth: () => {
      if (!runtimeEvidenceSource || disposed) {
        throw new Error(
          'AI drawing performance runtime evidence is unavailable'
        )
      }
      const depth = runtimeEvidenceSource.readHistoryDepth()
      if (!Number.isSafeInteger(depth) || depth < 0) {
        throw new Error('AI drawing performance history depth is invalid')
      }
      return depth
    },
    readLatestFactoryTransactionStatus: () => factoryStatuses.latest() ?? null,
    readLatestPhaseSample: () => {
      if (disposed) {
        throw new Error(
          'AI drawing performance runtime evidence is unavailable'
        )
      }
      const latest = phases.latest()
      return latest ? Object.freeze({ ...latest }) : null
    },
    readLatestTurnSettlement: () => latestTurnSettlement,
    readRenderProjectionElementCount: () => {
      if (!runtimeEvidenceSource || disposed) {
        throw new Error(
          'AI drawing performance runtime evidence is unavailable'
        )
      }
      const count = runtimeEvidenceSource.readRenderProjectionElementCount()
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error(
          'AI drawing performance Render projection element count is invalid'
        )
      }
      return count
    },
    readViewportPosition: () => {
      if (!runtimeEvidenceSource || disposed) {
        throw new Error(
          'AI drawing performance runtime evidence is unavailable'
        )
      }
      const position = runtimeEvidenceSource.readViewportPosition()
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
        throw new Error('AI drawing performance viewport position is invalid')
      }
      return Object.freeze({ x: position.x, y: position.y })
    },
    readZoom: () => {
      if (!runtimeEvidenceSource || disposed) {
        throw new Error(
          'AI drawing performance runtime evidence is unavailable'
        )
      }
      const zoom = runtimeEvidenceSource.readZoom()
      if (!Number.isFinite(zoom) || zoom <= 0) {
        throw new Error('AI drawing performance zoom is invalid')
      }
      return zoom
    },
    reset: () => {
      if (disposed) return
      counters.clear()
      counterTotals.clear()
      factoryCommits.clear()
      factoryPublications.clear()
      factoryStatuses.clear()
      phaseCounts.clear()
      phases.clear()
      observedRuntimeProgressCount = 0
      runtimeProgressClock = null
      hasAcceptedToSettledEvidence = false
      hasAcceptedTurnEvidence = false
      hasSettledOutcomeEvidence = false
      latestTurnSettlement = null
      baselineMs = now()
    },
    snapshot: () =>
      freezeSnapshot(
        counters.toArray(),
        phases.toArray(),
        hasAcceptedTurnEvidence &&
          hasSettledOutcomeEvidence &&
          hasAcceptedToSettledEvidence,
        runtime
      )
  })

  runtimeEvidenceOwners.set(profile, {
    attach: attachRuntimeEvidence,
    recordPublication
  })
  activePerformanceProfile?.dispose()
  activePerformanceProfile = profile
  if (typeof window !== 'undefined') {
    window.__AiDrawingPerformance__ = profile
  }
  return profile
}
