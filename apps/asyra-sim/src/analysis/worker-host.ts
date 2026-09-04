import type { MethodCatalog } from '../extensions/catalog'
import { admitSnapshotExecution } from '../extensions/execution-admission'
import { hasExactOwnKeys } from '../domain/records'
import { validIdentifier } from '../domain/workcell'
import { completeAnalysisResult, validatePairProgress } from './result'
import { WorkerEvidenceDelivery } from './worker-delivery'
import {
  AnalysisWorkerMessages,
  type AnalysisWorkerResponse
} from './worker-protocol'

/** One trusted method invocation per owned Worker lifetime. This is not a security sandbox. */
export class AnalysisWorkerHost {
  private activeRunId: string | null = null
  private closed = false
  private readonly abort = new AbortController()

  constructor(
    private readonly methods: MethodCatalog,
    private readonly post: (message: AnalysisWorkerResponse) => void,
    private readonly close: () => void
  ) {}

  async handle(input: unknown): Promise<void> {
    if (this.closed) return
    if (
      hasExactOwnKeys(input, ['type', 'runId']) &&
      input.type === AnalysisWorkerMessages.CANCEL
    ) {
      if (input.runId === this.activeRunId) this.abort.abort()
      return
    }
    if (
      this.activeRunId ||
      !hasExactOwnKeys(input, ['type', 'runId', 'snapshot']) ||
      input.type !== AnalysisWorkerMessages.RUN ||
      !validIdentifier(input.runId)
    )
      return
    this.activeRunId = input.runId
    const delivery = new WorkerEvidenceDelivery(input.runId, this.post)
    let stage = 'admission'
    const checkpoint = () => {
      if (this.closed) throw new Error('Method invocation has settled')
      this.abort.signal.throwIfAborted()
      delivery.flush()
    }
    try {
      const snapshot = admitSnapshotExecution(input.snapshot, this.methods),
        method = this.methods.resolve(
          snapshot.method.id,
          snapshot.method.version
        )
      stage = 'execution'
      const evidence = await method.execute(snapshot, {
        signal: this.abort.signal,
        checkpoint,
        emitPair: (pair) => {
          checkpoint()
          delivery.record(validatePairProgress(snapshot, pair))
        }
      })
      checkpoint()
      stage = 'output validation'
      completeAnalysisResult(snapshot, evidence, {
        runId: input.runId,
        startedAt: 0,
        endedAt: 0
      })
      delivery.complete(evidence)
    } catch {
      delivery.fail(
        `Method ${stage} failed. Raw private error details were not retained.`
      )
    } finally {
      this.closed = true
      this.close()
    }
  }
}
