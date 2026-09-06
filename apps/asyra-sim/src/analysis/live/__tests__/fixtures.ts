import { createSyntheticExample } from '../../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../../samples/synthetic-experiment'
import { createExperimentSnapshot } from '../../snapshot'
import { OFFICIAL_CLEARANCE_METHOD } from '../../methods/official-method'
import { IDENTITY_POSE } from '../../../domain/math'

export function liveFixture(collision = false) {
  const example = createSyntheticExample()
  const draft = createSyntheticExperimentDraft(example)

  if (collision) {
    example.workcell.robotRootId = null
    example.workcell.bodies = example.workcell.bodies
      .slice(0, 2)
      .map((body, i) => ({
        ...body,
        parentId: null,
        role: i === 0 ? 'tool' : 'fixture',
        pose: IDENTITY_POSE,
        joint: { kind: 'fixed', axis: [1, 0, 0], value: 0, min: 0, max: 0 },
        colliders: [
          {
            id: 'sphere',
            pose: IDENTITY_POSE,
            geometry: { kind: 'sphere', radius: 0.1 }
          }
        ]
      }))
    draft.trajectory = {
      version: 1,
      keyframes: [
        { time: 0, joints: {} },
        { time: 8, joints: {} }
      ]
    }
    draft.sourceUnits.joints = {}
    draft.scope = {
      ...draft.scope,
      primaryBodyIds: [example.workcell.bodies[0].id],
      influencingBodyIds: [example.workcell.bodies[1].id],
      selfCollision: false,
      externalCollision: true,
      excludedPairs: [],
      acknowledgedExcludedVisibleBodyIds: []
    }
  }

  return createExperimentSnapshot({
    snapshotId: 'live-input',
    candidateId: 'candidate',
    experimentId: 'study',
    workcell: example.workcell,
    definition: { ...draft, revision: 1, rule: { ...draft.rule, revision: 1 } },
    methods: [OFFICIAL_CLEARANCE_METHOD],
    acknowledgedWarningCodes: []
  })
}
