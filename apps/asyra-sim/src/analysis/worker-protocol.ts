import {
  EXPERIMENT_RESOURCE_PROFILE,
  type ExperimentSnapshot
} from './contracts'
import type {
  MethodEvidence,
  MethodPairEvidence
} from '../extensions/contracts'

export function measureWorkerPayload(input: unknown): number {
  const encoded = JSON.stringify(input)
  if (typeof encoded !== 'string') throw new Error('Invalid worker payload')
  const bytes = new TextEncoder().encode(encoded).byteLength
  if (bytes > EXPERIMENT_RESOURCE_PROFILE.maxEvidenceBytes)
    throw new Error(
      'Analysis worker payload exceeds the encoded evidence limit'
    )
  return bytes
}

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
      pairs: readonly MethodPairEvidence[]
    }
  | {
      type: typeof AnalysisWorkerMessages.COMPLETE
      runId: string
      evidence: MethodEvidence
    }
  | {
      type: typeof AnalysisWorkerMessages.ERROR
      runId: string
      error: string
      pairs?: readonly MethodPairEvidence[]
    }
