import { runOfficialClearanceMethod } from './methods/official-method'
import {
  AnalysisWorkerMessages,
  type AnalysisWorkerRequest,
  type AnalysisWorkerResponse
} from './worker-protocol'

let activeRunId: string | null = null
let cancelled = false

const respond = (message: AnalysisWorkerResponse): void =>
  self.postMessage(message)

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
    try {
      const evidence = runOfficialClearanceMethod(
        request.snapshot,
        () => {
          if (cancelled) throw new Error('Analysis cancelled')
        },
        (pair) =>
          respond({
            type: AnalysisWorkerMessages.PROGRESS,
            runId: request.runId,
            pair
          })
      )
      respond({
        type: AnalysisWorkerMessages.COMPLETE,
        runId: request.runId,
        evidence
      })
    } catch (error) {
      respond({
        type: AnalysisWorkerMessages.ERROR,
        runId: request.runId,
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      self.close()
    }
  }
)
