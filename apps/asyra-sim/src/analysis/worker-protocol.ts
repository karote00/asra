import type { ExperimentSnapshot } from './contracts'
import type {
  OfficialMethodEvidence,
  OfficialPairEvidence
} from './methods/official-method'

export const AnalysisWorkerMessages = {
  RUN: 'run',
  CANCEL: 'cancel',
  PROGRESS: 'progress',
  COMPLETE: 'complete',
  ERROR: 'error'
} as const

export type AnalysisWorkerRequest =
  | {
      type: typeof AnalysisWorkerMessages.RUN
      runId: string
      snapshot: ExperimentSnapshot
    }
  | {
      type: typeof AnalysisWorkerMessages.CANCEL
      runId: string
    }

export type AnalysisWorkerResponse =
  | {
      type: typeof AnalysisWorkerMessages.PROGRESS
      runId: string
      pair: OfficialPairEvidence
    }
  | {
      type: typeof AnalysisWorkerMessages.COMPLETE
      runId: string
      evidence: OfficialMethodEvidence
    }
  | {
      type: typeof AnalysisWorkerMessages.ERROR
      runId: string
      error: string
    }
