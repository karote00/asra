import { describe, expect, it } from 'vitest'
import {
  evaluateKinematics,
  interpolateSegment,
  intervalAlgebra,
  poseOperations
} from '../kinematic-algebra'
import { interval } from '../interval'
import { IDENTITY_POSE } from '../math'
import {
  forwardKinematics,
  jointValuesAt,
  type Body,
  type Workcell
} from '../workcell'

const base: Body = {
  id: 'base',
  parentId: null,
  name: 'Base',
  role: 'robot',
  pose: IDENTITY_POSE,
  joint: { kind: 'fixed', axis: [0, 1, 0], value: 0, min: 0, max: 0 },
  colliders: [],
  visible: true,
  color: 0
}
const workcell: Workcell = {
  version: 1,
  robotRootId: 'base',
  bodies: [
    base,
    {
      ...base,
      id: 'joint',
      role: 'link',
      parentId: 'base',
      joint: {
        kind: 'revolute',
        axis: [0, 0, 7],
        value: 0,
        min: -100,
        max: 100
      }
    },
    {
      ...base,
      id: 'tool',
      role: 'tool',
      parentId: 'joint',
      pose: { ...IDENTITY_POSE, position: [2, 0, 0] }
    }
  ]
}
const trajectory = {
  version: 1 as const,
  keyframes: [
    { time: 0, joints: { joint: 0 } },
    { time: 1, joints: { joint: Math.PI * 2 } }
  ]
}

describe('shared pose algebra enclosures', () => {
  it('contains the independent rotating-radius oracle at point times', () => {
    for (let n = -100; n <= 100; n++) {
      const q = n / 10,
        pose = evaluateKinematics(
          workcell,
          { joint: interval(q) },
          intervalAlgebra
        ).get('tool')
      if (!pose) throw new Error('Missing test tool')
      const expected = [2 * Math.cos(q), 2 * Math.sin(q), 0]
      pose.position.forEach((bound, index) => {
        expect(bound[0]).toBeLessThanOrEqual(expected[index])
        expect(bound[1]).toBeGreaterThanOrEqual(expected[index])
        expect(bound[1] - bound[0]).toBeLessThan(1e-7)
      })
    }
  })
  it('contains every intermediate pose across a complete rotating interval', () => {
    const values = interpolateSegment(
      trajectory,
      0,
      interval(0, 1),
      intervalAlgebra
    )
    const tool = evaluateKinematics(workcell, values, intervalAlgebra).get(
      'tool'
    )
    if (!tool) throw new Error('Missing test tool')
    for (let n = 0; n <= 100; n++) {
      const actual = forwardKinematics(
        workcell,
        jointValuesAt(trajectory, n / 100)
      ).get('tool')
      if (!actual) throw new Error('Missing ordinary test tool')
      tool.position.forEach((bound, index) => {
        expect(bound[0]).toBeLessThanOrEqual(actual.position[index])
        expect(bound[1]).toBeGreaterThanOrEqual(actual.position[index])
      })
    }
  })
  it('retains enclosure under compounded mounting transforms and degenerate zero vectors', () => {
    const ops = poseOperations(intervalAlgebra)
    const norm = ops.norm(ops.vector([0, 0, 0]))
    expect(norm[0]).toBe(0)
    expect(norm[1]).toBeLessThan(1e-150)
    const model: Workcell = {
      ...workcell,
      bodies: workcell.bodies.map((body) => ({
        ...body,
        pose: {
          position: [100, 200, -300],
          rotation: [0.1, 0.2, 0.3, Math.sqrt(0.86)]
        }
      }))
    }
    const bounds = evaluateKinematics(
      model,
      { joint: interval(0.7) },
      intervalAlgebra
    )
    const actual = forwardKinematics(model, { joint: 0.7 })
    for (const [id, pose] of actual) {
      const bound = bounds.get(id)
      if (!bound) throw new Error('Missing bound')
      pose.position.forEach((value, index) => {
        expect(bound.position[index][0]).toBeLessThanOrEqual(value)
        expect(bound.position[index][1]).toBeGreaterThanOrEqual(value)
      })
    }
  })
})
