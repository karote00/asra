import { expect, it } from 'vitest'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import { forwardKinematics, jointValuesAt } from '../workcell'

it('names parts unambiguously and defines shaft spans without treating capsule cylinder length as total length', () => {
  const { workcell } = createSyntheticExample()
  expect(workcell.bodies.every((body) => !body.name.includes('·'))).toBe(true)
  const shoulder = workcell.bodies.find((body) => body.id.endsWith(':joint-2'))
  if (!shoulder) throw new Error('Missing shoulder')
  const geometry = shoulder.colliders[0].geometry
  if (geometry.kind !== 'capsule') throw new Error('Expected a shaft proxy')
  expect(geometry.length + geometry.radius * 2).toBeCloseTo(0.65)
  const gripper = workcell.bodies.find((body) => body.role === 'tool')
  if (!gripper) throw new Error('Missing gripper')
  expect(gripper.colliders).toHaveLength(3)
  const fingers = gripper.colliders.slice(1)
  expect(fingers[0].pose.position[0]).toBeLessThan(-0.06)
  expect(fingers[1].pose.position[0]).toBeGreaterThan(0.06)
})

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
  expect(experiment.budget).toEqual({
    maxIntervals: 100000,
    maxDurationMs: 30000
  })
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
