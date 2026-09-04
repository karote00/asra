import { expect, it, vi } from 'vitest'
import type { ExperimentSnapshot } from '../../contracts'
import { createSyntheticExample } from '../../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../../samples/synthetic-experiment'
import { createExperimentSnapshot } from '../../snapshot'
import {
  OFFICIAL_CLEARANCE_METHOD,
  runOfficialClearanceMethod
} from '../official-method'

// Scale down the same application ceiling to exercise aggregate reservation
// with real queries; this is not a second solver or a geometry oracle.
vi.mock('../../contracts', async (load) => {
  const actual = await load<typeof import('../../contracts')>()
  return {
    ...actual,
    EXPERIMENT_RESOURCE_PROFILE: {
      ...actual.EXPERIMENT_RESOURCE_PROFILE,
      maxEvidenceLeaves: 50
    }
  }
})

it('reserves an unresolved evidence slot for every remaining pair when earlier pairs use the cap', () => {
  const example = createSyntheticExample(),
    draft = createSyntheticExperimentDraft(example)
  const input: ExperimentSnapshot = createExperimentSnapshot({
    snapshotId: 'bounded-evidence',
    candidateId: 'candidate',
    experimentId: 'study',
    workcell: example.workcell,
    definition: { ...draft, revision: 1, rule: { ...draft.rule, revision: 1 } },
    methods: [OFFICIAL_CLEARANCE_METHOD],
    acknowledgedWarningCodes: []
  })
  const evidence = runOfficialClearanceMethod(input)
  expect(evidence.pairs).toHaveLength(input.pairs.length)
  expect(
    evidence.pairs.reduce(
      (total, pair) => total + pair.evidence.leaves.length,
      0
    )
  ).toBeLessThanOrEqual(50)
  expect(evidence.coverage).toBe('partial')
  for (const pair of evidence.pairs) {
    expect(pair.evidence.leaves[0].start).toBe(input.interval[0])
    expect(pair.evidence.leaves.at(-1)?.end).toBe(input.interval[1])
  }
  expect(
    evidence.pairs.some((pair) =>
      pair.evidence.leaves.some((leaf) =>
        leaf.reason.includes('evidence budget')
      )
    )
  ).toBe(true)
})
