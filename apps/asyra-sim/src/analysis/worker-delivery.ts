import { EXPERIMENT_RESOURCE_PROFILE } from './contracts'
import type {
  MethodEvidence,
  MethodPairEvidence
} from '../extensions/contracts'
import {
  AnalysisWorkerMessages,
  measureWorkerPayload,
  type AnalysisWorkerResponse
} from './worker-protocol'

/** Transport batching only. Method evidence and its numerical meaning are unchanged. */
export class WorkerEvidenceDelivery {
  private pending: MethodPairEvidence[] = []
  private lastSent = -Infinity
  private totalBytes = 2
  private pairCount = 0
  private leafCount = 0

  constructor(
    private readonly runId: string,
    private readonly post: (message: AnalysisWorkerResponse) => void,
    private readonly now: () => number = () => performance.now()
  ) {}

  private send(message: AnalysisWorkerResponse): void {
    measureWorkerPayload(message)
    this.post(message)
  }

  record(pair: MethodPairEvidence): void {
    const bytes = measureWorkerPayload(pair) + (this.pairCount ? 1 : 0)
    if (
      this.totalBytes + bytes > EXPERIMENT_RESOURCE_PROFILE.maxEvidenceBytes ||
      this.leafCount + pair.evidence.leaves.length >
        EXPERIMENT_RESOURCE_PROFILE.maxEvidenceLeaves ||
      this.pairCount + 1 > EXPERIMENT_RESOURCE_PROFILE.maxPairs
    )
      throw new Error(
        'Analysis worker evidence exceeds its global payload or count budget'
      )
    this.totalBytes += bytes
    this.leafCount += pair.evidence.leaves.length
    this.pairCount++
    this.pending.push(pair)
    this.flush()
  }

  flush(): void {
    const now = this.now()
    if (
      !this.pending.length ||
      now - this.lastSent < EXPERIMENT_RESOURCE_PROFILE.progressIntervalMs
    )
      return
    this.send({
      type: AnalysisWorkerMessages.PROGRESS,
      runId: this.runId,
      pairs: this.pending
    })
    this.pending = []
    this.lastSent = now
  }

  complete(evidence: MethodEvidence): void {
    this.send({
      type: AnalysisWorkerMessages.COMPLETE,
      runId: this.runId,
      evidence
    })
    this.pending = []
  }

  fail(reason: unknown): void {
    const error = (
      reason instanceof Error ? reason.message : String(reason)
    ).slice(0, 2000)
    const message: AnalysisWorkerResponse = {
      type: AnalysisWorkerMessages.ERROR,
      runId: this.runId,
      error,
      pairs: this.pending
    }
    try {
      measureWorkerPayload(message)
    } catch {
      this.send({
        type: AnalysisWorkerMessages.ERROR,
        runId: this.runId,
        error:
          `${error} Unsent evidence exceeded the terminal payload limit and could not be retained.`.slice(
            0,
            2000
          )
      })
      this.pending = []
      return
    }
    this.post(message)
    this.pending = []
  }
}
