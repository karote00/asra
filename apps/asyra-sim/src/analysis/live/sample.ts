import type { ExperimentSnapshot } from '../contracts'
import type {
  MethodEvidence,
  MethodPairEvidence
} from '../../extensions/contracts'
import {
  validateMethodEvidence,
  validatePartialMethodEvidence
} from '../result'
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

/** Admit numerical evidence without constructing any report or acceptance projection. */
export function validateLiveEvidence(
  input: ExperimentSnapshot,
  time: number,
  evidence: MethodEvidence
): LiveSample {
  const pairs = validateMethodEvidence(sampleSnapshot(input, time), evidence)

  return Object.freeze({
    time,
    pairs,
    totalPairCount: input.pairs.length,
    complete: evidence.coverage === 'complete',
    error: null
  })
}

export function incompleteLiveSample(
  input: ExperimentSnapshot,
  time: number,
  pairs: readonly MethodPairEvidence[]
): LiveSample {
  const error = 'Live check did not complete. Unchecked pairs remain unknown.'
  const admitted = validatePartialMethodEvidence(
    sampleSnapshot(input, time),
    pairs
  )

  return Object.freeze({
    time,
    pairs: admitted,
    totalPairCount: input.pairs.length,
    complete: false,
    error
  })
}
