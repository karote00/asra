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
  reset(): void
  snapshot(): AiDrawingPerformanceSnapshot
}

interface InstallAiDrawingPerformanceProfileOptions {
  readonly configuration: AiDrawingPerformanceConfiguration
  readonly now?: () => number
  readonly runtime: AiDrawingPerformanceRuntime
}

type PhaseSink = (name: string, durationMs: number) => void
type CounterSink = (name: string, value: number) => void

type DiagnosticGlobal = typeof globalThis & {
  __asyraBrowserDragPhaseSink?: PhaseSink
  __asyraDiagnosticCounterSink?: CounterSink
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
  now = () => performance.now(),
  runtime
}: InstallAiDrawingPerformanceProfileOptions): AiDrawingPerformanceProfile => {
  const runtimeGlobal = globalThis as DiagnosticGlobal
  const previousPhaseSink = runtimeGlobal.__asyraBrowserDragPhaseSink
  const previousCounterSink = runtimeGlobal.__asyraDiagnosticCounterSink
  const counters: AiDrawingPerformanceCounterSample[] = []
  const phases: AiDrawingPerformancePhaseSample[] = []
  let baselineMs = now()
  let conversationDisposer: (() => void) | null = null
  let disposed = false
  let previousConversationSnapshot: AsyraDesignAiConversationSnapshot | null =
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
      if (runtimeGlobal.__asyraBrowserDragPhaseSink === phaseSink) {
        runtimeGlobal.__asyraBrowserDragPhaseSink = previousPhaseSink
      }
      if (runtimeGlobal.__asyraDiagnosticCounterSink === counterSink) {
        runtimeGlobal.__asyraDiagnosticCounterSink = previousCounterSink
      }
      if (window.__AsyraAiDrawingPerformance__ === profile) {
        delete window.__AsyraAiDrawingPerformance__
      }
    },
    reset: () => {
      if (disposed) return
      counters.length = 0
      phases.length = 0
      baselineMs = now()
    },
    snapshot: () => freezeSnapshot(configuration, counters, phases, runtime)
  })

  window.__AsyraAiDrawingPerformance__ = profile
  return profile
}
