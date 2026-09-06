import { expect, it } from 'vitest'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import { OFFICIAL_CLEARANCE_METHOD } from '../methods/official-method'
import {
  createExperimentSnapshot,
  validateHistoricalSnapshot
} from '../snapshot'
import { preflightExperiment } from '../preflight'
import type { ExperimentSnapshot } from '../contracts'

function input() {
  const example = createSyntheticExample(),
    draft = createSyntheticExperimentDraft(example)
  return createExperimentSnapshot({
    snapshotId: 'original',
    candidateId: 'candidate',
    experimentId: 'study',
    workcell: example.workcell,
    definition: { ...draft, revision: 1, rule: { ...draft.rule, revision: 1 } },
    methods: [OFFICIAL_CLEARANCE_METHOD],
    acknowledgedWarningCodes: []
  })
}

it('validates detached historical inputs without installing or rerunning their method', () => {
  const original = structuredClone(input())
  original.method.id = 'private-unavailable'
  const restored = validateHistoricalSnapshot(original)
  expect(restored).toEqual(original)
  expect(restored).not.toBe(original)
  expect(Object.isFrozen(restored.workcell.bodies)).toBe(true)
  const report = preflightExperiment(
    restored.workcell,
    {
      ...createSyntheticExperimentDraft(createSyntheticExample()),
      revision: 1,
      method: restored.method,
      rule: restored.rule
    },
    []
  )
  expect(
    report.blockers.some((issue) => issue.code === 'method-unavailable')
  ).toBe(true)
})

it('rejects omitted, repeated, forged, and additional snapshot inputs', () => {
  const source = input()
  for (const mutate of [
    (value: ExperimentSnapshot) => {
      value.pairs = value.pairs.slice(1)
    },
    (value: ExperimentSnapshot) => {
      value.pairs = [...value.pairs, value.pairs[0]]
    },
    (value: ExperimentSnapshot) => {
      value.pairs[0].a.bodyId = 'not-present'
    },
    (value: ExperimentSnapshot) => {
      value.source.experimentRevision = 0
    },
    (value: ExperimentSnapshot) => {
      value.trajectory.keyframes[0].joints = {
        ...value.trajectory.keyframes[0].joints,
        extra: 1
      }
    },
    (value: ExperimentSnapshot) => {
      Object.assign(value, { executable: 'no' })
    }
  ]) {
    const malformed = structuredClone(source)
    mutate(malformed)
    expect(() => validateHistoricalSnapshot(malformed)).toThrow()
  }
})
