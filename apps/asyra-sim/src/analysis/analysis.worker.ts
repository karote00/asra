import { runOfficialClearanceMethod } from './methods/official-method'
import { WorkerEvidenceDelivery } from './worker-delivery'
import {
  AnalysisWorkerMessages,
  type AnalysisWorkerRequest
} from './worker-protocol'

let activeRunId: string | null = null
let cancelled = false

self.addEventListener(
  'message',
  (event: MessageEvent<AnalysisWorkerRequest>) => {
    const request = event.data
    if (
      request?.type === AnalysisWorkerMessages.CANCEL &&
      request.runId === activeRunId
    ) {
      cancelled = true
      return
    }
    if (request?.type !== AnalysisWorkerMessages.RUN || activeRunId) return
    activeRunId = request.runId
    const delivery = new WorkerEvidenceDelivery(request.runId, (message) =>
      self.postMessage(message)
    )
    try {
      const evidence = runOfficialClearanceMethod(
        request.snapshot,
        () => {
          if (cancelled) throw new Error('Analysis cancelled')
          delivery.flush()
        },
        (pair) => delivery.record(pair)
      )
      delivery.complete(evidence)
    } catch (error) {
      delivery.fail(error)
    } finally {
      self.close()
    }
  }
)
