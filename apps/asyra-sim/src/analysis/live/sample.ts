import type { ExperimentSnapshot } from '../contracts'
import type {
  MethodEvidence,
  MethodPairEvidence
} from '../../extensions/contracts'
import { completeAnalysisResult, terminalAnalysisResult } from '../result'
import type { LiveSample } from './protocol'

/** Static sampling preserves the admitted geometry and complete pair policy. */
export function sampleSnapshot(
  input: ExperimentSnapshot,
  time: number
): ExperimentSnapshot {
  if (
    !Number.isFinite(time) ||
    time < input.interval[0] ||
    time > input.interval[1]
  )
    throw new Error('Live sample time is outside the experiment interval')

  return Object.freeze({
    ...input,
    interval: Object.freeze([time, time]) as readonly [number, number]
  })
}

/** Reuse numerical evidence validation; discard report/acceptance projections. */
export function validateLiveEvidence(
  input: ExperimentSnapshot,
  time: number,
  evidence: MethodEvidence
): LiveSample {
  const result = completeAnalysisResult(sampleSnapshot(input, time), evidence, {
    runId: 'live-sample-validation',
    startedAt: 0,
    endedAt: 0
  })

  return Object.freeze({
    time,
    pairs: result.pairEvidence,
    totalPairCount: result.totalPairCount,
    complete: result.coverage === 'complete',
    error: null
  })
}

export function incompleteLiveSample(
  input: ExperimentSnapshot,
  time: number,
  pairs: readonly MethodPairEvidence[]
): LiveSample {
  const error = 'Live check did not complete. Unchecked pairs remain unknown.'
  const result = terminalAnalysisResult(sampleSnapshot(input, time), pairs, {
    runId: 'live-sample-validation',
    startedAt: 0,
    endedAt: 0,
    execution: 'failed',
    error
  })

  return Object.freeze({
    time,
    pairs: result.pairEvidence,
    totalPairCount: result.totalPairCount,
    complete: false,
    error
  })
}
