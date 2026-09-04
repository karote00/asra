import { MethodIds, MethodVersions } from '../src/constants'
import type {
  ExperimentDefinition,
  ExperimentRule
} from '../src/analysis/contracts'
import type { SyntheticExample } from './synthetic-workcell'

export type SyntheticExperimentDraft = Omit<
  ExperimentDefinition,
  'revision' | 'rule'
> & {
  rule: Omit<ExperimentRule, 'revision'>
}

/** Public sample settings demonstrate an executable scope, not calibrated safety. */
export function createSyntheticExperimentDraft(
  example: SyntheticExample
): SyntheticExperimentDraft {
  const movingJointIds = example.workcell.bodies
    .filter((body) => body.joint.kind !== 'fixed')
    .map((body) => body.id)
  return {
    version: 1,
    trajectory: structuredClone(example.trajectory),
    sourceUnits: {
      time: example.source.timeUnit,
      joints: Object.fromEntries(
        movingJointIds.map((id) => [id, 'rad' as const])
      )
    },
    scope: {
      primaryBodyIds: example.workcell.bodies
        .filter((body) => body.role !== 'fixture')
        .map((body) => body.id),
      influencingBodyIds: example.workcell.bodies
        .filter((body) => body.role === 'fixture')
        .map((body) => body.id),
      selfCollision: true,
      externalCollision: true,
      excludedPairs: example.excludedPairs.map((pair) => ({
        version: 1 as const,
        ...pair
      })),
      acknowledgedExcludedVisibleBodyIds: [],
      backgroundNote:
        'The public synthetic workcell is the complete modeled analysis scope.'
    },
    interval: [
      example.trajectory.keyframes[0]?.time ?? 0,
      example.trajectory.keyframes.at(-1)?.time ?? 0
    ],
    method: {
      id: MethodIds.CONTINUOUS_CLEARANCE,
      version: MethodVersions.CONTINUOUS_CLEARANCE,
      settings: {
        distanceTolerance: 0.000001,
        timeTolerance: 0.0001,
        maxIterations: 64
      }
    },
    rule: { version: 1, minimumClearance: 0.02 },
    budget: { maxIntervals: 2000, maxDurationMs: 15000 }
  }
}
