import {
  EXPERIMENT_RESOURCE_PROFILE,
  type ExperimentSnapshot
} from '../contracts'
import type { MethodCatalog } from '../../extensions/catalog'
import type {
  MethodPairEvidence,
  MethodRegistration
} from '../../extensions/contracts'
import { admitSnapshotExecution } from '../../extensions/execution-admission'
import { hasExactOwnKeys } from '../../domain/records'
import { measureWorkerPayload } from '../worker-protocol'
import { LIVE_LIMITS, LiveMessages, type LiveResponse } from './protocol'
import { sampleSnapshot, validateLiveEvidence } from './sample'
import { LivePairProgress } from './pair-progress'

/** One admitted input lifetime; each sample invokes the installed static method. */
export class LiveWorkerHost {
  private snapshot: ExperimentSnapshot | null = null
  private busy = false
  private lastId = 0
  private execute: MethodRegistration['execute'] | null = null

  constructor(
    private readonly methods: MethodCatalog,
    private readonly post: (message: LiveResponse) => void,
    private readonly now = () => performance.now()
  ) {}

  async handle(input: unknown): Promise<void> {
    if (
      hasExactOwnKeys(input, ['type', 'snapshot']) &&
      input.type === LiveMessages.OPEN &&
      !this.snapshot
    ) {
      this.snapshot = admitSnapshotExecution(input.snapshot, this.methods)

      const method = this.methods.resolve(
        this.snapshot.method.id,
        this.snapshot.method.version
      )

      if (!method.descriptor.supportsStatic)
        throw new Error('Selected method does not support live static checks')

      this.execute = method.createExecutor
        ? method.createExecutor()
        : method.execute
      if (typeof this.execute !== 'function')
        throw new Error('Invalid installed live executor')

      this.post({ type: LiveMessages.READY })

      return
    }

    if (
      !this.snapshot ||
      !this.execute ||
      this.busy ||
      !hasExactOwnKeys(input, ['type', 'id', 'time']) ||
      input.type !== LiveMessages.SAMPLE ||
      !Number.isSafeInteger(input.id) ||
      typeof input.id !== 'number' ||
      input.id <= this.lastId ||
      typeof input.time !== 'number'
    )
      throw new Error('Invalid live sample request')

    const snapshot = sampleSnapshot(this.snapshot, input.time)
    const id = input.id
    const time = input.time
    const deadline =
      this.now() +
      Math.min(snapshot.budget.maxDurationMs, LIVE_LIMITS.sampleDurationMs)
    const progress = new LivePairProgress(snapshot)
    let pending: MethodPairEvidence[] = []
    let lastSent = -Infinity
    let sentCollision = false
    const abort = new AbortController()
    let settled = false

    const checkpoint = () => {
      if (settled || this.now() > deadline) {
        abort.abort()

        throw new Error('Live sample deadline exceeded')
      }
    }

    this.busy = true
    this.lastId = id

    try {
      const evidence = await this.execute(snapshot, {
        signal: abort.signal,
        checkpoint,
        emitPair: (pair) => {
          checkpoint()

          const admitted = progress.append(pair)
          const finding = admitted.evidence.leaves.some(
            (leaf) => leaf.state === 'finding'
          )
          const collision = admitted.evidence.leaves.some(
            (leaf) => leaf.penetration
          )

          if (finding) pending.push(admitted)

          const now = this.now()
          if (
            pending.length &&
            ((collision && !sentCollision) ||
              now - lastSent >= EXPERIMENT_RESOURCE_PROFILE.progressIntervalMs)
          ) {
            const message: LiveResponse = {
              type: LiveMessages.PROGRESS,
              id,
              time,
              pairs: pending
            }
            measureWorkerPayload(message)
            checkpoint()
            this.post(message)
            pending = []
            lastSent = now
            sentCollision ||= collision
          }
        }
      })

      checkpoint()
      const sample = validateLiveEvidence(snapshot, time, evidence)
      progress.assertConsistent(sample.pairs)
      measureWorkerPayload(evidence)
      checkpoint()
      this.post({ type: LiveMessages.RESULT, id, time, evidence })
    } catch {
      this.post({
        type: LiveMessages.ERROR,
        id,
        time,
        pairs: progress.values()
      })
    } finally {
      settled = true
      this.busy = false
    }
  }
}
