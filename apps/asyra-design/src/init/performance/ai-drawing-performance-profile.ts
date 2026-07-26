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

export interface AiDrawingPerformanceFactoryPublicationEvidence {
  readonly capturedAtMs: number
  readonly deliveryCount: number
  readonly publicationId: string
}

export interface AiDrawingPerformanceFactoryCommitEvidence {
  readonly capturedAtMs: number
  readonly origin: string
  readonly transactionId: number
}

export interface AiDrawingPerformanceRuntimeEvidence {
  readonly factoryCommits: readonly AiDrawingPerformanceFactoryCommitEvidence[]
  readonly factoryPublications: readonly AiDrawingPerformanceFactoryPublicationEvidence[]
}

export interface AiDrawingPerformanceRuntimeEvidenceSource {
  readCanonicalElementCount(): number
  readCanonicalElements(): readonly AiDrawingPerformanceCanonicalElement[]
  subscribeToTransactionStatus(
    subscriber: (status: {
      readonly origin: string
      readonly status: string
      readonly timestamp: number
      readonly transactionId: number
    }) => void
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
  readCanonicalElementCount(): number
  readCanonicalElements(): readonly AiDrawingPerformanceCanonicalElement[]
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
  if (
    exactlyOne(values, 'ai', ['mock']) !== 'mock' ||
    exactlyOne(values, 'aiPerformance', ['profile']) !== 'profile'
  ) {
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
  const factoryCommits: AiDrawingPerformanceFactoryCommitEvidence[] = []
  const factoryPublications: AiDrawingPerformanceFactoryPublicationEvidence[] =
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
          if (status.status !== 'committed') return
          if (disposed || !Number.isFinite(status.timestamp)) return
          factoryCommits.push(
            Object.freeze({
              capturedAtMs: status.timestamp,
              origin: status.origin,
              transactionId: status.transactionId
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
      Object.freeze({
        factoryCommits: Object.freeze(
          factoryCommits.map((evidence) => Object.freeze({ ...evidence }))
        ),
        factoryPublications: Object.freeze(
          factoryPublications.map((evidence) => Object.freeze({ ...evidence }))
        )
      }),
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
    reset: () => {
      if (disposed) return
      counters.length = 0
      factoryCommits.length = 0
      factoryPublications.length = 0
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
