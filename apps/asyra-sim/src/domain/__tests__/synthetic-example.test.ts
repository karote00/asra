import { expect, it } from 'vitest'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import { forwardKinematics, jointValuesAt } from '../workcell'

it('provides an explicit six-axis model, complete trajectory and visible exclusion reasons', () => {
  const example = createSyntheticExample()
  expect(
    example.workcell.bodies.filter((body) => body.joint.kind === 'revolute')
  ).toHaveLength(6)
  expect(example.workcell.bodies.some((body) => body.role === 'tool')).toBe(
    true
  )
  expect(
    example.workcell.bodies.some((body) => body.role === 'workpiece')
  ).toBe(true)
  expect(example.excludedPairs).toHaveLength(8)
  expect(
    example.excludedPairs.every((pair) =>
      pair.reason.includes('not certified safe')
    )
  ).toBe(true)
  for (const time of [0, 2, 4, 6, 8]) {
    const poses = forwardKinematics(
      example.workcell,
      jointValuesAt(example.trajectory, time)
    )
    expect(poses.size).toBe(example.workcell.bodies.length)
    expect(
      [...poses.values()].every((pose) => pose.position.every(Number.isFinite))
    ).toBe(true)
  }
  const other = createSyntheticExample('second')
  expect(
    other.workcell.bodies.some((body) =>
      example.workcell.bodies.some((original) => original.id === body.id)
    )
  ).toBe(false)

  const experiment = createSyntheticExperimentDraft(example)
  expect(experiment.trajectory).toEqual(example.trajectory)
  expect(experiment.sourceUnits.joints).toEqual(
    Object.fromEntries(
      example.workcell.bodies
        .filter((body) => body.joint.kind !== 'fixed')
        .map((body) => [body.id, 'rad'])
    )
  )
  expect(
    new Set([
      ...experiment.scope.primaryBodyIds,
      ...experiment.scope.influencingBodyIds
    ])
  ).toEqual(new Set(example.workcell.bodies.map((body) => body.id)))
  expect(experiment.scope.excludedPairs).toHaveLength(
    example.excludedPairs.length
  )
})
