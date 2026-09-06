import { MethodIds, MethodVersions } from '../src/constants'
import {
  DEFAULT_EXPERIMENT_BUDGET,
  type ExperimentDefinition,
  type ExperimentRule
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
    budget: { ...DEFAULT_EXPERIMENT_BUDGET }
  }
}

/** Separate editable studies; names describe intent, never a predicted verdict. */
export function createSyntheticExperimentPresets(example: SyntheticExample) {
  const joints = example.workcell.bodies.filter(
    (body) => body.joint.kind !== 'fixed'
  )
  if (joints.length !== 6)
    throw new Error('The sample studies require six actuated joints')
  const study = (
    name: string,
    // Sparse, one-based J1-J6 values; every output frame contains all six joints.
    poses: readonly Readonly<Record<number, number>>[],
    note: string
  ) => {
    const draft = createSyntheticExperimentDraft(example)
    draft.trajectory = {
      version: 1,
      keyframes: poses.map((pose, index) => ({
        time: index * 4,
        joints: Object.fromEntries(
          joints.map((body, jointIndex) => [
            body.id,
            pose[jointIndex + 1] ?? body.joint.value
          ])
        )
      }))
    }
    draft.scope.backgroundNote = note
    return { name, draft }
  }
  const shoulder = study(
    'Shoulder reach study',
    [{}, { 2: -0.55 }, { 2: -1.4 }],
    'Vary shoulder reach with other joints held at their initial values. Check the complete modeled workcell, retaining explicit mounting exclusions.'
  )
  const elbow = study(
    'Elbow folding study',
    [{}, { 3: 0.55 }, { 3: 2.35 }],
    'Fold and extend the elbow with other joints held at their initial values. Check the complete modeled workcell, retaining explicit mounting exclusions.'
  )
  const wrist = study(
    'Wrist orientation study',
    [{}, { 4: 1.2, 5: -0.5, 6: 1.5 }, { 4: -1.2, 5: 1.1, 6: -1.5 }],
    'Rotate and bend the wrist while holding the base, shoulder and elbow fixed. Check the complete modeled workcell, retaining explicit mounting exclusions.'
  )
  const table = study(
    'Tool and table sweep',
    [{}, { 1: 0.35, 2: -1.2, 3: 0.8 }, { 1: -0.35, 2: -0.9, 3: 1.2 }],
    'Local study of the gripper and workpiece against the table. Robot links and the fixture post are not checked; this is not whole-workcell clearance evidence.'
  )
  table.draft.scope.primaryBodyIds = example.workcell.bodies
    .filter((body) => body.role === 'tool' || body.role === 'workpiece')
    .map((body) => body.id)
  table.draft.scope.influencingBodyIds = example.workcell.bodies
    .filter((body) => body.id.endsWith(':fixture-table'))
    .map((body) => body.id)
  const selected = new Set([
    ...table.draft.scope.primaryBodyIds,
    ...table.draft.scope.influencingBodyIds
  ])
  table.draft.scope.excludedPairs = table.draft.scope.excludedPairs.filter(
    (pair) => selected.has(pair.a) && selected.has(pair.b)
  )
  table.draft.scope.acknowledgedExcludedVisibleBodyIds = example.workcell.bodies
    .filter((body) => body.visible && !selected.has(body.id))
    .map((body) => body.id)
  const collision = study(
    'Tool and table collision',
    [{}, { 2: -0.3, 3: -2.1, 5: 0 }, {}],
    'Deliberately lower the gripper and workpiece into the table at 4 s, then return. This local collision demonstration uses original parts; robot links and the fixture post are not checked. Run formal analysis for evidence, not a predefined verdict.'
  )
  collision.draft.scope = {
    ...structuredClone(table.draft.scope),
    backgroundNote: collision.draft.scope.backgroundNote
  }
  return [
    {
      name: 'Synthetic clearance study',
      draft: createSyntheticExperimentDraft(example)
    },
    shoulder,
    elbow,
    wrist,
    table,
    collision
  ]
}
