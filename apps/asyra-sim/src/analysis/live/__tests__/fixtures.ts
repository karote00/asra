import { createSyntheticExample } from '../../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../../samples/synthetic-experiment'
import { createExperimentSnapshot } from '../../snapshot'
import { OFFICIAL_CLEARANCE_METHOD } from '../../methods/official-method'

export function liveFixture() {
  const example = createSyntheticExample()
  const draft = createSyntheticExperimentDraft(example)

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
