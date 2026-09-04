import type { ExperimentSnapshot } from './contracts'
import type { OfficialPairEvidence } from './methods/official-method'
import {
  completeAnalysisResult,
  terminalAnalysisResult,
  validatePairProgress,
  type AnalysisExecution,
  type AnalysisResult
} from './result'
import {
  AnalysisWorkerMessages,
  type AnalysisWorkerResponse
} from './worker-protocol'

type WorkerFactory = () => Worker
type Clock = () => number
type IdFactory = () => string

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

export class AnalysisRunner {
  private active: ActiveRun | null = null
  private closed = false

  constructor(
    private readonly createWorker: WorkerFactory = defaultWorkerFactory,
    private readonly now: Clock = Date.now,
    private readonly createId: IdFactory = () => crypto.randomUUID(),
    private readonly terminationGraceMs = 50
  ) {}

  isRunning(): boolean {
    return this.active !== null
  }

  run(
    snapshot: ExperimentSnapshot,
    signal?: AbortSignal
  ): Promise<AnalysisResult> {
    if (this.closed)
      return Promise.reject(new Error('Analysis runner is closed'))
    if (this.active)
      return Promise.reject(new Error('A formal analysis is already running'))
    const runId = this.createId(),
      startedAt = this.now()
    if (signal?.aborted)
      return Promise.resolve(
        terminalAnalysisResult(snapshot, [], {
          runId,
          startedAt,
          endedAt: this.now(),
          execution: 'cancelled',
          error: 'Analysis was cancelled before worker startup.'
        })
      )
    let worker: Worker
    try {
      worker = this.createWorker()
    } catch (error) {
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
    const progress = new Map<string, OfficialPairEvidence>()
    const retained = () =>
      snapshot.pairs.flatMap((pair) => {
        const item = progress.get(pair.id)
        return item ? [item] : []
      })
    const cleanup = () => {
      clearTimeout(timers.timeout)
      clearTimeout(timers.grace)
      signal?.removeEventListener('abort', abort)
      worker.onmessage = null
      worker.onerror = null
      worker.terminate()
    }
    const settle = (result: AnalysisResult) => {
      if (settled) return
      settled = true
      cleanup()
      if (this.active?.promise === promise) this.active = null
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
    signal?.addEventListener('abort', abort, { once: true })
    timers.timeout = setTimeout(
      () =>
        requestStop(
          'timed-out',
          'Analysis exceeded its declared wall-time budget.'
        ),
      snapshot.budget.maxDurationMs
    )
    worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
      if (settled) return
      const response = event.data
      if (!response || response.runId !== runId) return
      try {
        if (response.type === AnalysisWorkerMessages.PROGRESS) {
          if (progress.has(response.pair.pairId))
            throw new Error('Worker returned duplicate pair progress')
          const pair = validatePairProgress(snapshot, response.pair)
          progress.set(pair.pairId, pair)
          return
        }
        if (response.type === AnalysisWorkerMessages.COMPLETE) {
          if (stopping) {
            const completed = completeAnalysisResult(
              snapshot,
              response.evidence,
              {
                runId,
                startedAt,
                endedAt: this.now()
              }
            )
            for (const pair of completed.pairEvidence)
              progress.set(pair.pairId, pair)
            finishTerminal(stopping.execution, stopping.reason)
          } else
            settle(
              completeAnalysisResult(snapshot, response.evidence, {
                runId,
                startedAt,
                endedAt: this.now()
              })
            )
          return
        }
        if (response.type === AnalysisWorkerMessages.ERROR) {
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
      if (stopping) finishTerminal(stopping.execution, stopping.reason)
      else finishTerminal('failed', event.message || 'Analysis worker crashed')
    }
    this.active = { promise, requestStop }
    try {
      worker.postMessage({
        type: AnalysisWorkerMessages.RUN,
        runId,
        snapshot: structuredClone(snapshot)
      })
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
    if (!active) return
    active.requestStop('cancelled', 'Analysis runtime was disposed.')
    await active.promise
  }
}
