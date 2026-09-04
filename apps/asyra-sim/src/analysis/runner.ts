import {
  EXPERIMENT_RESOURCE_PROFILE,
  type ExperimentSnapshot
} from './contracts'
import type { MethodPairEvidence } from '../extensions/contracts'
import type { MethodCatalog } from '../extensions/catalog'
import { INSTALLED_METHOD_CATALOG } from '../extensions/installed-methods'
import { admitSnapshotExecution } from '../extensions/execution-admission'
import {
  completeAnalysisResult,
  terminalAnalysisResult,
  validatePairProgress,
  type AnalysisExecution,
  type AnalysisResult
} from './result'
import {
  AnalysisWorkerMessages,
  measureWorkerPayload,
  type AnalysisWorkerResponse
} from './worker-protocol'

type WorkerFactory = () => Worker
type Clock = () => number
type IdFactory = () => string

export interface AnalysisProgress {
  readonly runId: string
  readonly snapshotId: string
  readonly startedAt: number
  readonly state: 'running' | 'cancelling' | 'timing-out' | AnalysisExecution
  readonly totalPairCount: number
  readonly receivedPairCount: number
  readonly evaluations: number
  readonly evidenceLeafCount: number
}

interface ActiveRun {
  promise: Promise<AnalysisResult>
  requestStop: (
    execution: Extract<AnalysisExecution, 'cancelled' | 'timed-out'>,
    reason: string
  ) => void
}

const defaultWorkerFactory: WorkerFactory = () =>
  new Worker(new URL('./analysis.worker.ts', import.meta.url), {
    type: 'module'
  })

const errorMessage = (input: unknown, fallback: string): string =>
  (input instanceof Error ? input.message : String(input || fallback)).slice(
    0,
    2000
  )

/** Both inputs have passed the exact evidence schema; property order is inert. */
function samePairEvidence(
  a: MethodPairEvidence,
  b: MethodPairEvidence
): boolean {
  const left = a.evidence,
    right = b.evidence
  return (
    left.coverage === right.coverage &&
    left.lower === right.lower &&
    left.upper === right.upper &&
    left.evaluations === right.evaluations &&
    left.leaves.length === right.leaves.length &&
    left.leaves.every((leaf, index) =>
      Object.entries(leaf).every(
        ([key, value]) => value === Reflect.get(right.leaves[index], key)
      )
    )
  )
}

export class AnalysisRunner {
  private active: ActiveRun | null = null
  private closed = false
  private progressState: AnalysisProgress | null = null

  constructor(
    private readonly createWorker: WorkerFactory = defaultWorkerFactory,
    private readonly now: Clock = Date.now,
    private readonly createId: IdFactory = () => crypto.randomUUID(),
    private readonly terminationGraceMs: number = EXPERIMENT_RESOURCE_PROFILE.terminationGraceMs,
    private readonly methods: MethodCatalog = INSTALLED_METHOD_CATALOG
  ) {}

  isRunning(): boolean {
    return this.active !== null
  }

  getProgress(): AnalysisProgress | null {
    return this.progressState
  }

  run(
    input: ExperimentSnapshot,
    signal?: AbortSignal
  ): Promise<AnalysisResult> {
    if (this.closed)
      return Promise.reject(new Error('Analysis runner is closed'))
    if (this.active)
      return Promise.reject(new Error('A formal analysis is already running'))
    const runId = this.createId(),
      startedAt = this.now()
    let snapshot: ExperimentSnapshot
    try {
      snapshot = admitSnapshotExecution(input, this.methods)
    } catch (error) {
      return Promise.reject(error)
    }
    const initialProgress: AnalysisProgress = {
      runId,
      snapshotId: snapshot.snapshotId,
      startedAt,
      state: 'running',
      totalPairCount: snapshot.pairs.length,
      receivedPairCount: 0,
      evaluations: 0,
      evidenceLeafCount: 0
    }
    this.progressState = Object.freeze(initialProgress)
    if (signal?.aborted) {
      this.progressState = Object.freeze({
        ...initialProgress,
        state: 'cancelled'
      })
      return Promise.resolve(
        terminalAnalysisResult(snapshot, [], {
          runId,
          startedAt,
          endedAt: this.now(),
          execution: 'cancelled',
          error: 'Analysis was cancelled before worker startup.'
        })
      )
    }
    let worker: Worker
    try {
      worker = this.createWorker()
    } catch (error) {
      this.progressState = Object.freeze({
        ...initialProgress,
        state: 'failed'
      })
      return Promise.resolve(
        terminalAnalysisResult(snapshot, [], {
          runId,
          startedAt,
          endedAt: this.now(),
          execution: 'failed',
          error: errorMessage(error, 'Worker startup failed')
        })
      )
    }

    let resolveResult: (result: AnalysisResult) => void = () => undefined
    const promise = new Promise<AnalysisResult>((resolve) => {
      resolveResult = resolve
    })
    let settled = false,
      stopping:
        | {
            execution: Extract<AnalysisExecution, 'cancelled' | 'timed-out'>
            reason: string
          }
        | undefined
    const timers: {
      timeout?: ReturnType<typeof setTimeout>
      grace?: ReturnType<typeof setTimeout>
    } = {}
    const progress = new Map<string, MethodPairEvidence>()
    let retainedLeaves = 0,
      retainedEvaluations = 0,
      retainedBytes = 2
    const retained = () =>
      snapshot.pairs.flatMap((pair) => {
        const item = progress.get(pair.id)
        return item ? [item] : []
      })
    const acceptProgress = (pairs: readonly MethodPairEvidence[]) => {
      if (!Array.isArray(pairs) || pairs.length > snapshot.pairs.length)
        throw new Error('Invalid analysis progress batch')
      for (const input of pairs) {
        if (progress.has(input?.pairId))
          throw new Error('Worker returned duplicate pair progress')
        const pair = validatePairProgress(snapshot, input),
          bytes = measureWorkerPayload(pair) + (progress.size ? 1 : 0)
        if (
          retainedLeaves + pair.evidence.leaves.length >
            EXPERIMENT_RESOURCE_PROFILE.maxEvidenceLeaves ||
          retainedEvaluations + pair.evidence.evaluations >
            snapshot.budget.maxIntervals ||
          retainedBytes + bytes > EXPERIMENT_RESOURCE_PROFILE.maxEvidenceBytes
        )
          throw new Error(
            'Analysis progress exceeds its global evidence budget'
          )
        retainedLeaves += pair.evidence.leaves.length
        retainedEvaluations += pair.evidence.evaluations
        retainedBytes += bytes
        progress.set(pair.pairId, pair)
      }
      let state: AnalysisProgress['state'] = 'running'
      if (stopping)
        state = stopping.execution === 'cancelled' ? 'cancelling' : 'timing-out'
      this.progressState = Object.freeze({
        ...initialProgress,
        state,
        receivedPairCount: progress.size,
        evaluations: retainedEvaluations,
        evidenceLeafCount: retainedLeaves
      })
    }
    const cleanup = () => {
      clearTimeout(timers.timeout)
      clearTimeout(timers.grace)
      signal?.removeEventListener('abort', abort)
      worker.onmessage = null
      worker.onerror = null
      worker.onmessageerror = null
      worker.terminate()
    }
    const settle = (result: AnalysisResult) => {
      if (settled) return
      settled = true
      cleanup()
      if (this.active?.promise === promise) this.active = null
      this.progressState = Object.freeze({
        ...initialProgress,
        state: result.execution,
        receivedPairCount: result.coveredPairCount,
        evaluations: result.pairEvidence.reduce(
          (total, pair) => total + pair.evidence.evaluations,
          0
        ),
        evidenceLeafCount: result.pairEvidence.reduce(
          (total, pair) => total + pair.evidence.leaves.length,
          0
        )
      })
      resolveResult(result)
    }
    const finishTerminal = (
      execution: Exclude<AnalysisExecution, 'completed'>,
      reason: string
    ) => {
      if (settled) return
      settle(
        terminalAnalysisResult(snapshot, retained(), {
          runId,
          startedAt,
          endedAt: this.now(),
          execution,
          error: reason.slice(0, 2000)
        })
      )
    }
    const requestStop = (
      execution: Extract<AnalysisExecution, 'cancelled' | 'timed-out'>,
      reason: string
    ) => {
      if (settled || stopping) return
      stopping = { execution, reason }
      this.progressState = Object.freeze({
        ...(this.progressState ?? initialProgress),
        state: execution === 'cancelled' ? 'cancelling' : 'timing-out'
      })
      try {
        worker.postMessage({
          type: AnalysisWorkerMessages.CANCEL,
          runId
        })
      } catch {
        // Termination below remains the authoritative cancellation boundary.
      }
      timers.grace = setTimeout(
        () => finishTerminal(execution, reason),
        this.terminationGraceMs
      )
    }
    const abort = () =>
      requestStop('cancelled', 'Analysis was cancelled by the user.')
    const checkDeadline = () => {
      if (this.now() - startedAt >= snapshot.budget.maxDurationMs)
        requestStop(
          'timed-out',
          'Analysis exceeded its declared wall-time budget.'
        )
    }
    signal?.addEventListener('abort', abort, { once: true })
    timers.timeout = setTimeout(
      () =>
        requestStop(
          'timed-out',
          'Analysis exceeded its declared wall-time budget.'
        ),
      Math.max(0, snapshot.budget.maxDurationMs - (this.now() - startedAt))
    )
    worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
      if (settled) return
      const response = event.data
      if (!response || response.runId !== runId) return
      try {
        checkDeadline()
        measureWorkerPayload(response)
        if (response.type === AnalysisWorkerMessages.PROGRESS) {
          acceptProgress(response.pairs)
          return
        }
        if (response.type === AnalysisWorkerMessages.COMPLETE) {
          const completed = completeAnalysisResult(
            snapshot,
            response.evidence,
            {
              runId,
              startedAt,
              endedAt: this.now()
            }
          )
          for (const pair of completed.pairEvidence) {
            const previous = progress.get(pair.pairId)
            if (previous && !samePairEvidence(previous, pair))
              throw new Error(
                'Terminal evidence contradicts previously validated pair progress'
              )
          }
          checkDeadline()
          if (stopping) {
            for (const pair of completed.pairEvidence)
              progress.set(pair.pairId, pair)
            finishTerminal(stopping.execution, stopping.reason)
          } else settle(Object.freeze({ ...completed, endedAt: this.now() }))
          return
        }
        if (response.type === AnalysisWorkerMessages.ERROR) {
          if (response.pairs !== undefined) acceptProgress(response.pairs)
          if (stopping) finishTerminal(stopping.execution, stopping.reason)
          else finishTerminal('failed', response.error)
          return
        }
        throw new Error('Unknown analysis worker response')
      } catch (error) {
        finishTerminal('failed', errorMessage(error, 'Invalid worker evidence'))
      }
    }
    worker.onerror = (event) => {
      event.preventDefault?.()
      if (stopping) finishTerminal(stopping.execution, stopping.reason)
      else
        finishTerminal(
          'failed',
          'Analysis worker crashed; raw worker error details were not retained.'
        )
    }
    worker.onmessageerror = () =>
      finishTerminal(
        'failed',
        'Cannot deserialize the analysis worker response'
      )
    this.active = { promise, requestStop }
    try {
      if (signal?.aborted) abort()
      checkDeadline()
      if (!stopping) {
        const input = structuredClone(snapshot)
        checkDeadline()
        if (!stopping)
          worker.postMessage({
            type: AnalysisWorkerMessages.RUN,
            runId,
            snapshot: input
          })
      }
    } catch (error) {
      finishTerminal('failed', errorMessage(error, 'Worker startup failed'))
    }
    return promise
  }

  async dispose(): Promise<void> {
    if (this.closed) {
      await this.active?.promise
      return
    }
    this.closed = true
    const active = this.active
    if (active) {
      active.requestStop('cancelled', 'Analysis runtime was disposed.')
      await active.promise
    }
    this.progressState = null
  }
}
