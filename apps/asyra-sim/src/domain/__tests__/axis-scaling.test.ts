import { expect, it } from 'vitest'
import { IDENTITY_POSE, normalize } from '../math'
import { evaluateKinematics, intervalAlgebra } from '../kinematic-algebra'
import {
  forwardKinematics,
  validateWorkcell,
  type Body,
  type Workcell
} from '../workcell'

it('normalizes finite direction vectors even when their unscaled norm would overflow', () => {
  for (const value of normalize([
    Number.MAX_VALUE,
    Number.MAX_VALUE,
    Number.MAX_VALUE
  ]))
    expect(value).toBeCloseTo(1 / Math.sqrt(3), 15)
})

const fixture = (magnitude: number): Workcell => {
  const base: Body = {
    id: 'base',
    name: 'base',
    parentId: null,
    role: 'robot',
    pose: IDENTITY_POSE,
    joint: { kind: 'fixed', axis: [1, 0, 0], min: 0, max: 0, value: 0 },
    colliders: [],
    visible: true,
    color: 0
  }
  return {
    version: 1,
    robotRootId: 'base',
    bodies: [
      base,
      {
        ...base,
        id: 'slide',
        name: 'slide',
        parentId: 'base',
        role: 'link',
        joint: {
          kind: 'prismatic',
          axis: [magnitude, 0, 0],
          min: 0,
          max: 5,
          value: 2
        }
      }
    ]
  }
}
it.each([1, 1e308, Number.MAX_VALUE])(
  'preserves a 2 m displacement along a direction scaled by %s',
  (magnitude) => {
    const model = fixture(magnitude)
    validateWorkcell(model)
    expect(forwardKinematics(model).get('slide')?.position).toEqual([2, 0, 0])
    const pose = evaluateKinematics(model, {}, intervalAlgebra).get('slide')
    if (!pose) throw new Error('Missing pose')
    for (const [index, value] of [2, 0, 0].entries()) {
      expect(pose.position[index][0]).toBeLessThanOrEqual(value)
      expect(pose.position[index][1]).toBeGreaterThanOrEqual(value)
    }
  }
)
