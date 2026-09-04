import { MethodIds, MethodVersions } from '../../constants'
import {
  EXPERIMENT_RESOURCE_PROFILE,
  type ExperimentSnapshot,
  type MethodDescriptor
} from '../contracts'
import {
  queryContinuousPair,
  type PairEvidence,
  type QuerySettings
} from './continuous-query'

export interface OfficialPairEvidence {
  pairId: string
  evidence: PairEvidence
}

export interface OfficialMethodEvidence {
  version: 1
  snapshotId: string
  method: { id: string; version: string }
  coverage: 'complete' | 'partial'
  evaluations: number
  pairs: readonly OfficialPairEvidence[]
}

export const OFFICIAL_CLEARANCE_METHOD: MethodDescriptor = Object.freeze({
  id: MethodIds.CONTINUOUS_CLEARANCE,
  version: MethodVersions.CONTINUOUS_CLEARANCE,
  geometryKinds: Object.freeze(['box', 'sphere', 'capsule'] as const),
  supportsStatic: true,
  supportsMotion: true,
  maxPairs: EXPERIMENT_RESOURCE_PROFILE.maxPairs,
  warningWorkUnits: EXPERIMENT_RESOURCE_PROFILE.warningWorkUnits
})

const unresolved = (
  start: number,
  end: number,
  reason: string
): PairEvidence => ({
  leaves: [
    {
      start,
      end,
      lower: 0,
      upper: null,
      witnessTime: null,
      penetration: false,
      state: 'unresolved',
      reason
    }
  ],
  lower: 0,
  upper: null,
  coverage: 'partial',
  evaluations: 0
})

function deepFreeze<T>(input: T, seen = new WeakSet<object>()): T {
  if (!input || typeof input !== 'object' || seen.has(input)) return input
  seen.add(input)
  for (const value of Object.values(input)) deepFreeze(value, seen)
  return Object.freeze(input)
}

export function runOfficialClearanceMethod(
  snapshot: ExperimentSnapshot,
  checkpoint: () => void = () => undefined,
  onPair: (evidence: OfficialPairEvidence) => void = () => undefined
): OfficialMethodEvidence {
  if (
    snapshot.method.id !== OFFICIAL_CLEARANCE_METHOD.id ||
    snapshot.method.version !== OFFICIAL_CLEARANCE_METHOD.version
  )
    throw new Error('Snapshot requests a different method or version')
  if (!snapshot.pairs.length) throw new Error('Snapshot has no analysis pairs')
  if (
    snapshot.pairs.length > EXPERIMENT_RESOURCE_PROFILE.maxPairs ||
    snapshot.pairs.length > EXPERIMENT_RESOURCE_PROFILE.maxEvidenceLeaves
  )
    throw new Error('Snapshot exceeds the analysis pair or evidence capacity')
  const settings: Omit<QuerySettings, 'maxIntervals'> = {
    threshold: snapshot.rule.minimumClearance,
    distanceTolerance: snapshot.method.settings.distanceTolerance,
    timeTolerance: snapshot.method.settings.timeTolerance,
    maxIterations: snapshot.method.settings.maxIterations
  }
  let remaining = snapshot.budget.maxIntervals,
    remainingLeaves = EXPERIMENT_RESOURCE_PROFILE.maxEvidenceLeaves,
    evaluations = 0
  const pairs: OfficialPairEvidence[] = []
  for (const pair of snapshot.pairs) {
    checkpoint()
    let evidence: PairEvidence
    if (remaining <= 0)
      evidence = unresolved(
        snapshot.interval[0],
        snapshot.interval[1],
        'The global interval budget was exhausted before this pair was evaluated.'
      )
    else {
      evidence = queryContinuousPair(
        {
          workcell: snapshot.workcell,
          trajectory: snapshot.trajectory,
          a: pair.a,
          b: pair.b,
          interval: snapshot.interval
        },
        {
          ...settings,
          maxIntervals: remaining,
          maxEvidenceLeaves:
            remainingLeaves - (snapshot.pairs.length - pairs.length - 1)
        },
        checkpoint
      )
      remaining -= evidence.evaluations
      evaluations += evidence.evaluations
    }
    remainingLeaves -= evidence.leaves.length
    const completed = deepFreeze({ pairId: pair.id, evidence })
    pairs.push(completed)
    onPair(completed)
  }
  return deepFreeze({
    version: 1,
    snapshotId: snapshot.snapshotId,
    method: {
      id: OFFICIAL_CLEARANCE_METHOD.id,
      version: OFFICIAL_CLEARANCE_METHOD.version
    },
    coverage: pairs.some((pair) => pair.evidence.coverage === 'partial')
      ? 'partial'
      : 'complete',
    evaluations,
    pairs
  })
}
