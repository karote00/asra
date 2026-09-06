import type { ExperimentSnapshot } from '../contracts'
import type { MethodCatalog } from '../../extensions/catalog'
import { INSTALLED_METHOD_CATALOG } from '../../extensions/installed-methods'
import { admitSnapshotExecution } from '../../extensions/execution-admission'
import { hasExactOwnKeys } from '../../domain/records'
import { measureWorkerPayload } from '../worker-protocol'
import {
  LIVE_LIMITS,
  LiveMessages,
  type LiveResponse,
  type LiveState
} from './protocol'
import {
  incompleteLiveSample,
  sampleSnapshot,
  validateLiveEvidence
} from './sample'
import { LiveEvidenceRecords } from './records'
import { LivePairProgress } from './pair-progress'

const createWorker = () =>
  new Worker(new URL('./playback.worker.ts', import.meta.url), {
    type: 'module'
  })

/** A Feature-owned live lifetime, not a report runner or a render scheduler. */
export class LivePlaybackRunner {
  private state: LiveState = { status: 'idle', sample: null, error: null }
  private readonly listeners = new Set<() => void>()
  private request: ((time: number, discontinuity: boolean) => void) | null =
    null
  private stop: (() => void) | null = null
  private closed = false
  private readonly records = new LiveEvidenceRecords()

  constructor(
    private readonly workerFactory = createWorker,
    private readonly methods: MethodCatalog = INSTALLED_METHOD_CATALOG,
    private readonly now = () => performance.now()
  ) {}

  getState = () => this.state
  getRecords = (key?: string) => this.records.getAll(key)

  capture(input: ExperimentSnapshot) {
    return this.records.owns(input) ? input : structuredClone(input)
  }

  prepare(key: string, create: () => ExperimentSnapshot) {
    if (this.closed) throw new Error('Live playback is closed')

    const retained = this.records.getInput(key)

    if (retained) return retained

    this.invalidate()

    const input = admitSnapshotExecution(create(), this.methods)

    this.records.replace(input, key)

    return input
  }

  invalidate() {
    this.stop?.()
    this.records.replace(null)
    this.publish({ status: 'idle', sample: null, error: null })
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private publish(state: LiveState) {
    this.state = Object.freeze(state)

    for (const listener of this.listeners) listener()
  }

  sample(time: number, discontinuity = false) {
    this.request?.(time, discontinuity)
  }

  open(
    input: ExperimentSnapshot,
    initialTime: number,
    signal: AbortSignal
  ): Promise<void> {
    if (this.closed || this.stop)
      return Promise.reject(
        new Error('Live playback is unavailable or already active')
      )

    let snapshot: ExperimentSnapshot

    try {
      snapshot = this.records.owns(input)
        ? input
        : admitSnapshotExecution(input, this.methods)
      if (!this.records.owns(snapshot)) this.records.replace(snapshot)
      sampleSnapshot(snapshot, initialTime)

      if (
        !this.methods.resolve(snapshot.method.id, snapshot.method.version)
          .descriptor.supportsStatic
      )
        throw new Error('Selected method does not support live static checks')
    } catch (error) {
      return Promise.reject(error)
    }

    if (signal.aborted) return Promise.resolve()

    let worker: Worker | null = null
    let resolve: () => void = () => undefined
    let reject: (error: Error) => void = () => undefined
    const completion = new Promise<void>((done, fail) => {
      resolve = done
      reject = fail
    })
    let retired = false
    let ready = false
    let nextId = 0
    let minimumId = 0
    let pending: number | null = initialTime
    let inFlight: { id: number; time: number } | null = null
    let progress: LivePairProgress | null = null
    let lastSent = -Infinity
    let pace: ReturnType<typeof setTimeout> | undefined
    let watchdog: ReturnType<typeof setTimeout> | undefined

    const finish = (error?: string) => {
      if (retired) return

      retired = true
      clearTimeout(pace)
      clearTimeout(watchdog)
      signal.removeEventListener('abort', cancel)
      if (worker) {
        worker.onmessage = null
        worker.onerror = null
        worker.onmessageerror = null
        worker.terminate()
      }
      this.request = null
      this.stop = null
      this.publish({
        status: error ? 'error' : 'idle',
        sample: null,
        error: error ?? null
      })

      if (error) reject(new Error(error))
      else resolve()
    }

    const cancel = () => finish()
    const fail = () =>
      finish(
        'Live check failed or exceeded its resource deadline. No clear result is available.'
      )

    const drain = () => {
      if (retired || inFlight || pending === null || pace) return

      const cached = this.records.get(pending)

      if (cached) {
        pending = null
        this.publish({ status: 'ready', sample: cached, error: cached.error })

        return
      }

      if (!worker) {
        try {
          worker = this.workerFactory()
          worker.onmessage = receive
          worker.onerror = fail
          worker.onmessageerror = fail
          watchdog = setTimeout(fail, LIVE_LIMITS.startupDurationMs)
          worker.postMessage({ type: LiveMessages.OPEN, snapshot })
        } catch {
          fail()
        }

        return
      }

      if (!ready) return

      const delay = LIVE_LIMITS.samplePeriodMs - (this.now() - lastSent)

      if (delay > 0) {
        pace = setTimeout(() => {
          pace = undefined
          drain()
        }, delay)

        return
      }

      inFlight = { id: ++nextId, time: pending }
      progress = new LivePairProgress(sampleSnapshot(snapshot, pending))
      pending = null
      lastSent = this.now()
      this.publish({ ...this.state, status: 'checking', error: null })
      watchdog = setTimeout(
        fail,
        Math.min(snapshot.budget.maxDurationMs, LIVE_LIMITS.sampleDurationMs) +
          LIVE_LIMITS.responseGraceMs
      )

      try {
        worker.postMessage({ type: LiveMessages.SAMPLE, ...inFlight })
      } catch {
        fail()
      }
    }

    this.stop = cancel
    this.request = (time, discontinuity) => {
      if (retired) return

      try {
        sampleSnapshot(snapshot, time)
      } catch {
        fail()
        return
      }

      pending = time

      if (discontinuity) {
        minimumId = nextId + 1
        this.publish({
          status: ready ? 'checking' : 'preparing',
          sample: null,
          error: null
        })
      }

      drain()
    }

    const receive = (event: MessageEvent<unknown>) => {
      if (retired) return

      try {
        const message = event.data

        measureWorkerPayload(message)

        if (!ready) {
          if (
            !hasExactOwnKeys(message, ['type']) ||
            message.type !== LiveMessages.READY
          )
            throw new Error('Invalid live admission')

          clearTimeout(watchdog)
          ready = true
          drain()

          return
        }

        if (!inFlight || !progress || !message || typeof message !== 'object')
          throw new Error('Unexpected live response')

        const response = message as LiveResponse
        const keys =
          response.type === LiveMessages.RESULT
            ? ['type', 'id', 'time', 'evidence']
            : ['type', 'id', 'time', 'pairs']

        if (
          !hasExactOwnKeys(message, keys) ||
          response.type === LiveMessages.READY ||
          response.id !== inFlight.id ||
          response.time !== inFlight.time
        )
          throw new Error('Mismatched live response')

        let sample

        if (response.type === LiveMessages.PROGRESS) {
          if (
            !Array.isArray(response.pairs) ||
            !response.pairs.length ||
            response.pairs.length > snapshot.pairs.length
          )
            throw new Error('Invalid live progress batch')

          for (const pair of response.pairs) progress.append(pair)

          if (response.id >= minimumId)
            this.publish({
              status: 'checking',
              sample: progress.sample(),
              error: null
            })

          return
        }

        if (response.type === LiveMessages.RESULT)
          sample = validateLiveEvidence(
            snapshot,
            response.time,
            response.evidence
          )
        else if (response.type === LiveMessages.ERROR)
          sample = incompleteLiveSample(snapshot, response.time, response.pairs)
        else throw new Error('Unknown live response')

        progress.assertConsistent(sample.pairs)
        clearTimeout(watchdog)
        inFlight = null
        progress = null

        if (response.id >= minimumId) {
          this.records.record(snapshot, sample)
          this.publish({ status: 'ready', sample, error: sample.error })
        }

        drain()
      } catch {
        fail()
      }
    }

    signal.addEventListener('abort', cancel, { once: true })
    this.publish({ status: 'preparing', sample: null, error: null })
    drain()

    return completion
  }

  dispose() {
    this.closed = true
    this.stop?.()
    this.records.replace(null)
    this.listeners.clear()
  }
}
