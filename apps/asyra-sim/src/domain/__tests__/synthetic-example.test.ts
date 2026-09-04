import { expect, it } from 'vitest'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
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
})
