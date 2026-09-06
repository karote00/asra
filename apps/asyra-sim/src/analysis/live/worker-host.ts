import type { ExperimentSnapshot } from '../contracts'
import type { MethodCatalog } from '../../extensions/catalog'
import type { MethodPairEvidence } from '../../extensions/contracts'
import { admitSnapshotExecution } from '../../extensions/execution-admission'
import { hasExactOwnKeys } from '../../domain/records'
import { validatePairProgress } from '../result'
import { measureWorkerPayload } from '../worker-protocol'
import { LIVE_LIMITS, LiveMessages, type LiveResponse } from './protocol'
import { sampleSnapshot, validateLiveEvidence } from './sample'

/** One admitted input lifetime; each sample invokes the installed static method. */
export class LiveWorkerHost {
  private snapshot: ExperimentSnapshot | null = null
  private busy = false
  private lastId = 0

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

      this.post({ type: LiveMessages.READY })

      return
    }

    if (
      !this.snapshot ||
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
    const method = this.methods.resolve(
      snapshot.method.id,
      snapshot.method.version
    )
    const deadline =
      this.now() +
      Math.min(snapshot.budget.maxDurationMs, LIVE_LIMITS.sampleDurationMs)
    const pairs: MethodPairEvidence[] = []
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
      const evidence = await method.execute(snapshot, {
        signal: abort.signal,
        checkpoint,
        emitPair: (pair) => {
          checkpoint()

          if (
            pairs.length >= snapshot.pairs.length ||
            pairs.some((item) => item.pairId === pair.pairId)
          )
            throw new Error('Invalid live pair delivery')

          pairs.push(validatePairProgress(snapshot, pair))

          measureWorkerPayload(pairs)
        }
      })

      checkpoint()
      validateLiveEvidence(snapshot, time, evidence)
      measureWorkerPayload(evidence)
      this.post({ type: LiveMessages.RESULT, id, time, evidence })
    } catch {
      this.post({ type: LiveMessages.ERROR, id, time, pairs })
    } finally {
      settled = true
      this.busy = false
    }
  }
}
