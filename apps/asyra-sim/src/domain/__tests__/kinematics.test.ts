import { describe, expect, it } from 'vitest'
import {
  IDENTITY_POSE,
  axisAngle,
  angleInRadians,
  lengthInMeters,
  rotate
} from '../math'
import {
  forwardKinematics,
  jointValuesAt,
  validateWorkcell,
  validateTrajectory,
  type Body,
  type Workcell
} from '../workcell'

const fixed = {
  kind: 'fixed',
  axis: [0, 0, 1],
  value: 0,
  min: 0,
  max: 0
} as const
const body = (id: string, parentId: string | null): Body => ({
  id,
  parentId,
  name: id,
  role: 'link',
  pose: IDENTITY_POSE,
  joint: fixed,
  colliders: [],
  visible: true,
  color: 0x00aaff
})
const workcell = (): Workcell => ({
  version: 1,
  robotRootId: 'base',
  bodies: [
    body('base', null),
    {
      ...body('shoulder', 'base'),
      joint: { kind: 'revolute', axis: [0, 0, 2], value: 0, min: -10, max: 10 }
    },
    {
      ...body('elbow', 'shoulder'),
      pose: { ...IDENTITY_POSE, position: [2, 0, 0] },
      joint: { kind: 'revolute', axis: [0, 0, 1], value: 0, min: -10, max: 10 }
    },
    {
      ...body('tool', 'elbow'),
      pose: { ...IDENTITY_POSE, position: [1, 0, 0] }
    }
  ]
})
describe('SIM-05 shared units and canonical pose evaluation', () => {
  it('matches an independent two-link planar formula', () => {
    const model = workcell()
    validateWorkcell(model)
    for (const shoulder of [0, Math.PI / 2, Math.PI, -Math.PI / 3])
      for (const elbow of [0, 0.2, -Math.PI / 4]) {
        const pose = forwardKinematics(model, { shoulder, elbow }).get('tool')
        expect(pose?.position[0]).toBeCloseTo(
          2 * Math.cos(shoulder) + Math.cos(shoulder + elbow),
          12
        )
        expect(pose?.position[1]).toBeCloseTo(
          2 * Math.sin(shoulder) + Math.sin(shoulder + elbow),
          12
        )
        expect(pose?.position[2]).toBeCloseTo(0, 12)
      }
  })
  it('preserves mm/m and deg/rad equivalence without using renderer math', () => {
    expect(lengthInMeters(1234, 'mm')).toBe(lengthInMeters(1.234, 'm'))
    const turned = rotate(
      axisAngle([0, 1, 0], angleInRadians(90, 'deg')),
      [1, 0, 0]
    )
    expect(turned[0]).toBeCloseTo(0, 12)
    expect(turned[2]).toBeCloseTo(-1, 12)
  })
  it('preserves explicit revolutions rather than choosing the shortest rotation', () => {
    const model = workcell(),
      trajectory = {
        version: 1 as const,
        keyframes: [
          { time: 0, joints: { shoulder: 0, elbow: 0 } },
          { time: 1, joints: { shoulder: Math.PI * 2, elbow: 0 } }
        ]
      }
    validateTrajectory(model, trajectory)
    expect(jointValuesAt(trajectory, 0.5).shoulder).toBe(Math.PI)
    expect(
      forwardKinematics(model, jointValuesAt(trajectory, 0.5)).get('tool')
        ?.position[0]
    ).toBeCloseTo(-3, 12)
    expect(() => jointValuesAt(trajectory, 2)).toThrow('cover')
  })
  it('computes prismatic movement in the mounted joint frame', () => {
    const model: Workcell = {
      version: 1,
      robotRootId: 'base',
      bodies: [
        body('base', null),
        {
          ...body('slide', 'base'),
          pose: {
            position: [1, 2, 0],
            rotation: axisAngle([0, 0, 1], Math.PI / 2)
          },
          joint: {
            kind: 'prismatic',
            axis: [1, 0, 0],
            value: 0.3,
            min: 0,
            max: 1
          }
        }
      ]
    }
    validateWorkcell(model)
    expect(forwardKinematics(model).get('slide')?.position[0]).toBeCloseTo(
      1,
      12
    )
    expect(forwardKinematics(model).get('slide')?.position[1]).toBeCloseTo(
      2.3,
      12
    )
  })
  it('rejects cyclic or branching mechanisms and invalid trajectory inputs', () => {
    const model = workcell()
    expect(() =>
      validateWorkcell({
        ...model,
        bodies: model.bodies.map((b) =>
          b.id === 'base' ? { ...b, parentId: 'tool' } : b
        )
      })
    ).toThrow('cycle')
    expect(() =>
      validateWorkcell({
        ...model,
        bodies: model.bodies.map((b) =>
          b.id === 'elbow' ? { ...b, parentId: 'base' } : b
        )
      })
    ).toThrow('serial')
    expect(() =>
      validateTrajectory(model, {
        version: 1,
        keyframes: [
          { time: 0, joints: { shoulder: 0, elbow: 0 } },
          { time: 0, joints: { shoulder: 0, elbow: 0 } }
        ]
      })
    ).toThrow('increasing')
    expect(() =>
      validateTrajectory(model, {
        version: 1,
        keyframes: [{ time: 0, joints: { shoulder: NaN, elbow: 0 } }]
      })
    ).toThrow('joint')
  })
})
