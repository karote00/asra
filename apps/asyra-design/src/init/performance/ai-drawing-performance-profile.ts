import type { TransactionStatusPayload } from '@asyra/utils'
import type {
  AsyraDesignAiConversationController,
  AsyraDesignAiConversationSnapshot
} from '../../ai/conversation'

export type AiDrawingPerformanceContentsMode = 'omitted' | 'present'
export type AiDrawingPerformanceRuntime = 'development' | 'production'

export interface AiDrawingPerformanceConfiguration {
  readonly contentsMode: AiDrawingPerformanceContentsMode
  readonly deliveryMode: 'atomic' | 'progressive'
}

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
  subscribeToTransactionStatus(
    subscriber: (status: TransactionStatusPayload) => void
  ): () => void
}

export interface AiDrawingPerformanceSnapshot {
  readonly configuration: AiDrawingPerformanceConfiguration
  readonly counters: readonly AiDrawingPerformanceCounterSample[]
  readonly phases: readonly AiDrawingPerformancePhaseSample[]
  readonly releaseEvidenceEligible: boolean
  readonly runtime: AiDrawingPerformanceRuntime
}

export interface AiDrawingPerformanceProfile {
  attachConversation(
    conversation: AsyraDesignAiConversationController | null
  ): () => void
  dispose(): void
  getRuntimeEvidence(): AiDrawingPerformanceRuntimeEvidence
  readConversationSnapshot(): AsyraDesignAiConversationSnapshot | null
  readCounterTotal(name: string): number
  readCanonicalElementCount(): number
  readCanonicalElements(): readonly AiDrawingPerformanceCanonicalElement[]
  readCanonicalOwnerSnapshot(): AiDrawingPerformanceCanonicalOwnerSnapshot
  readFactoryPublicationCount(): number
  readHistoryDepth(): number
  readLatestPhaseSample(): AiDrawingPerformancePhaseSample | null
  readRenderProjectionElementCount(): number
  reset(): void
  snapshot(): AiDrawingPerformanceSnapshot
}

interface InstallAiDrawingPerformanceProfileOptions {
  readonly configuration: AiDrawingPerformanceConfiguration
  readonly epochNow?: () => number
  readonly now?: () => number
  readonly runtime: AiDrawingPerformanceRuntime
}

type PhaseSink = (name: string, durationMs: number) => void
type CounterSink = (name: string, value: number) => void

type DiagnosticGlobal = typeof globalThis & {
  __asyraBrowserDragPhaseSink?: PhaseSink
  __asyraDiagnosticCounterSink?: CounterSink
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

const serializeDiagnosticValue = (
  value: unknown
): AiDrawingPerformanceDiagnosticValue | undefined => {
  if (value === undefined) return
  if (value instanceof Error) {
    return Object.freeze({
      message: value.message,
      name: value.name
    })
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return String(value)
  }
  const candidate = value as { message?: unknown; name?: unknown }
  if (
    typeof candidate.message === 'string' ||
    typeof candidate.name === 'string'
  ) {
    return Object.freeze({
      message:
        typeof candidate.message === 'string'
          ? candidate.message
          : String(value),
      name: typeof candidate.name === 'string' ? candidate.name : 'Error'
    })
  }
  return String(value)
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
              : { message: status.failure.message })
          })
        }
      : {}),
    nonRollbackableChangeCount: status.nonRollbackableChangeCount,
    origin: status.origin,
    ...(status.providerName === undefined
      ? {}
      : { providerName: status.providerName }),
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

const exactlyOne = (
  search: URLSearchParams,
  key: string,
  accepted: readonly string[]
): string | null => {
  const values = search.getAll(key)
  return values.length === 1 && accepted.includes(values[0]) ? values[0] : null
}

export const resolveAiDrawingPerformanceProfile = (
  search: string
): AiDrawingPerformanceConfiguration | null => {
  const values = new URLSearchParams(search)
  if (exactlyOne(values, 'aiPerformance', ['profile']) !== 'profile') {
    return null
  }

  const deliveryValues = values.getAll('aiDelivery')
  const deliveryMode =
    deliveryValues.length === 0
      ? 'atomic'
      : exactlyOne(values, 'aiDelivery', ['atomic', 'progressive'])
  if (deliveryMode !== 'atomic' && deliveryMode !== 'progressive') {
    return null
  }

  const contentsValues = values.getAll('aiPerformanceContents')
  const contentsMode =
    contentsValues.length === 0
      ? 'present'
      : exactlyOne(values, 'aiPerformanceContents', ['present', 'omitted'])
  if (contentsMode !== 'present' && contentsMode !== 'omitted') {
    return null
  }

  return Object.freeze({
    contentsMode,
    deliveryMode
  })
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
  configuration: AiDrawingPerformanceConfiguration,
  counters: readonly AiDrawingPerformanceCounterSample[],
  phases: readonly AiDrawingPerformancePhaseSample[],
  runtime: AiDrawingPerformanceRuntime
): AiDrawingPerformanceSnapshot =>
  Object.freeze({
    configuration,
    counters: Object.freeze(counters.map((sample) => Object.freeze(sample))),
    phases: Object.freeze(phases.map((sample) => Object.freeze(sample))),
    releaseEvidenceEligible:
      runtime === 'production' &&
      configuration.contentsMode === 'present' &&
      counters.some(({ name }) => name === 'ai-turn:accepted') &&
      counters.some(({ name }) => name.startsWith('ai-turn:outcome:')) &&
      phases.some(({ name }) => name === 'ai-turn:accepted-to-settled'),
    runtime
  })

export const installAiDrawingPerformanceProfile = ({
  configuration,
  epochNow = () => performance.timeOrigin + performance.now(),
  now = () => performance.now(),
  runtime
}: InstallAiDrawingPerformanceProfileOptions): AiDrawingPerformanceProfile => {
  const runtimeGlobal = globalThis as DiagnosticGlobal
  const previousPhaseSink = runtimeGlobal.__asyraBrowserDragPhaseSink
  const previousCounterSink = runtimeGlobal.__asyraDiagnosticCounterSink
  const counters: AiDrawingPerformanceCounterSample[] = []
  const counterTotals = new Map<string, number>()
  const factoryCommits: AiDrawingPerformanceFactoryCommitEvidence[] = []
  const factoryPublications: AiDrawingPerformanceFactoryPublicationEvidence[] =
    []
  const factoryStatuses: AiDrawingPerformanceFactoryTransactionStatusEvidence[] =
    []
  const phases: AiDrawingPerformancePhaseSample[] = []
  let baselineMs = now()
  let conversationDisposer: (() => void) | null = null
  let disposed = false
  let previousConversationSnapshot: AsyraDesignAiConversationSnapshot | null =
    null
  let runtimeEvidenceDisposer: (() => void) | null = null
  let runtimeEvidenceSource: AiDrawingPerformanceRuntimeEvidenceSource | null =
    null

  const elapsed = () => Math.max(0, now() - baselineMs)
  const recordPhase = (name: string, durationMs: number) => {
    if (disposed || !Number.isFinite(durationMs)) return
    phases.push(
      Object.freeze({
        atMs: elapsed(),
        durationMs: Math.max(0, durationMs),
        name
      })
    )
  }
  const recordCounter = (name: string, value: number) => {
    if (disposed || !Number.isFinite(value)) return
    counters.push(Object.freeze({ atMs: elapsed(), name, value }))
    counterTotals.set(name, (counterTotals.get(name) ?? 0) + value)
  }
  const phaseSink: PhaseSink = (name, durationMs) => {
    recordPhase(name, durationMs)
    callDetached(previousPhaseSink, name, durationMs)
  }
  const counterSink: CounterSink = (name, value) => {
    recordCounter(name, value)
    callDetached(previousCounterSink, name, value)
  }
  runtimeGlobal.__asyraBrowserDragPhaseSink = phaseSink
  runtimeGlobal.__asyraDiagnosticCounterSink = counterSink

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
          factoryStatuses.push(captureFactoryTransactionStatus(status))
          if (status.status !== 'committed') return
          factoryCommits.push(
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
    factoryPublications.push(
      Object.freeze({
        capturedAtMs,
        deliveryCount: publication.deliveryCount,
        publicationId: publication.publicationId
      })
    )
  }

  const profile: AiDrawingPerformanceProfile = Object.freeze({
    attachConversation: (
      conversation: AsyraDesignAiConversationController | null
    ) => {
      conversationDisposer?.()
      conversationDisposer = null
      previousConversationSnapshot = null
      if (!conversation || disposed) {
        return () => undefined
      }
      const unsubscribe = conversation.subscribe((snapshot) => {
        const previous = previousConversationSnapshot
        if (!previous?.activeTurn && snapshot.activeTurn) {
          recordCounter('ai-turn:accepted', 1)
        }
        if (
          snapshot.settledTurns.length > (previous?.settledTurns.length ?? 0)
        ) {
          const settled = snapshot.settledTurns.at(-1)
          if (settled) {
            recordPhase('ai-turn:accepted-to-settled', settled.durationMs)
            recordCounter(`ai-turn:outcome:${settled.outcome}`, 1)
          }
        }
        previousConversationSnapshot = snapshot
      })
      conversationDisposer = () => {
        unsubscribe()
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
      runtimeEvidenceDisposer?.()
      runtimeEvidenceDisposer = null
      runtimeEvidenceSource = null
      if (runtimeGlobal.__asyraBrowserDragPhaseSink === phaseSink) {
        runtimeGlobal.__asyraBrowserDragPhaseSink = previousPhaseSink
      }
      if (runtimeGlobal.__asyraDiagnosticCounterSink === counterSink) {
        runtimeGlobal.__asyraDiagnosticCounterSink = previousCounterSink
      }
      if (window.__AsyraAiDrawingPerformance__ === profile) {
        delete window.__AsyraAiDrawingPerformance__
      }
      runtimeEvidenceOwners.delete(profile)
    },
    getRuntimeEvidence: () =>
      (() => {
        const detached = structuredClone({
          factoryCommits,
          factoryPublications,
          factoryStatuses
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
    readLatestPhaseSample: () => {
      if (disposed) {
        throw new Error(
          'AI drawing performance runtime evidence is unavailable'
        )
      }
      const latest = phases.at(-1)
      return latest ? Object.freeze({ ...latest }) : null
    },
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
    reset: () => {
      if (disposed) return
      counters.length = 0
      counterTotals.clear()
      factoryCommits.length = 0
      factoryPublications.length = 0
      factoryStatuses.length = 0
      phases.length = 0
      baselineMs = now()
    },
    snapshot: () => freezeSnapshot(configuration, counters, phases, runtime)
  })

  runtimeEvidenceOwners.set(profile, {
    attach: attachRuntimeEvidence,
    recordPublication
  })
  window.__AsyraAiDrawingPerformance__ = profile
  return profile
}
