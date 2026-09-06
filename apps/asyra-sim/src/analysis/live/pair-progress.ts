import {
  EXPERIMENT_RESOURCE_PROFILE,
  type ExperimentSnapshot
} from '../contracts'
import type { MethodPairEvidence } from '../../extensions/contracts'
import { samePairEvidence, validatePairProgress } from '../result'
import { measureWorkerPayload } from '../worker-protocol'
import type { LiveSample } from './protocol'

/** One invocation's admitted progress; independent instances at both trust boundaries. */
export class LivePairProgress {
  private readonly pairs = new Map<string, MethodPairEvidence>()
  private bytes = 2
  private leaves = 0
  private evaluations = 0

  constructor(private readonly snapshot: ExperimentSnapshot) {}

  append(input: MethodPairEvidence) {
    if (
      this.pairs.has(input?.pairId) ||
      this.pairs.size >= this.snapshot.pairs.length
    )
      throw new Error('Invalid live pair delivery')

    const pair = validatePairProgress(this.snapshot, input)
    const bytes = measureWorkerPayload(pair) + (this.pairs.size ? 1 : 0)
    const leaves = pair.evidence.leaves.length
    const evaluations = pair.evidence.evaluations

    if (
      this.bytes + bytes > EXPERIMENT_RESOURCE_PROFILE.maxEvidenceBytes ||
      this.leaves + leaves > EXPERIMENT_RESOURCE_PROFILE.maxEvidenceLeaves ||
      this.evaluations + evaluations > this.snapshot.budget.maxIntervals
    )
      throw new Error('Live progress exceeds its global evidence budget')

    this.bytes += bytes
    this.leaves += leaves
    this.evaluations += evaluations
    this.pairs.set(pair.pairId, pair)

    return pair
  }

  values() {
    return Object.freeze([...this.pairs.values()])
  }

  sample(): LiveSample {
    return Object.freeze({
      time: this.snapshot.interval[0],
      pairs: this.values(),
      totalPairCount: this.snapshot.pairs.length,
      complete: false,
      error: null
    })
  }

  assertConsistent(pairs: readonly MethodPairEvidence[]) {
    const terminal = new Map(pairs.map((pair) => [pair.pairId, pair]))

    for (const [id, previous] of this.pairs) {
      const current = terminal.get(id)

      if (!current || !samePairEvidence(previous, current))
        throw new Error('Terminal evidence contradicts validated live progress')
    }
  }
}
