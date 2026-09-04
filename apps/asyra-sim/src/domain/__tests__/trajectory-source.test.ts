import { describe, expect, it } from 'vitest'
import { IDENTITY_POSE } from '../math'
import { validateTrajectory, type Body, type Workcell } from '../workcell'
import {
  normalizeTrajectorySource,
  type TrajectorySource
} from '../trajectory-source'

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
      ...body('turn', 'base'),
      joint: {
        kind: 'revolute',
        axis: [0, 0, 1],
        value: 0,
        min: -10,
        max: 10
      }
    },
    {
      ...body('slide', 'turn'),
      joint: {
        kind: 'prismatic',
        axis: [1, 0, 0],
        value: 0,
        min: -2,
        max: 2
      }
    }
  ]
})

const source = (): TrajectorySource => ({
  version: 1,
  timeUnit: 'ms',
  jointUnits: { turn: 'deg', slide: 'mm' },
  keyframes: [
    { time: 0, joints: { turn: 0, slide: 0 } },
    { time: 2500, joints: { turn: 450, slide: 1250 } }
  ]
})

describe('M2 explicit trajectory source normalization', () => {
  it('rejects an excessive frame count before inspecting or converting frames', () => {
    const keyframes = Array.from({ length: 2001 }, () => null)
    expect(() =>
      normalizeTrajectorySource(workcell(), { ...source(), keyframes })
    ).toThrow('Trajectory must contain 1 to 2000 keyframes')
    expect(() =>
      normalizeTrajectorySource(workcell(), { ...source(), keyframes: [] })
    ).toThrow('Trajectory must contain 1 to 2000 keyframes')
  })

  it('accepts the exact frame limit before canonical validation', () => {
    const keyframes = Array.from({ length: 2000 }, (_, time) => ({
      time,
      joints: { turn: 0, slide: 0 }
    }))
    expect(
      normalizeTrajectorySource(workcell(), { ...source(), keyframes })
        .trajectory.keyframes
    ).toHaveLength(2000)
  })

  it('normalizes ms/deg/mm to detached s/rad/m values without wrapping rotation', () => {
    const input = source()
    const normalized = normalizeTrajectorySource(workcell(), input)

    expect(normalized).toEqual({
      trajectory: {
        version: 1,
        keyframes: [
          { time: 0, joints: { turn: 0, slide: 0 } },
          { time: 2.5, joints: { turn: Math.PI * 2.5, slide: 1.25 } }
        ]
      },
      sourceUnits: {
        time: 'ms',
        joints: { turn: 'deg', slide: 'mm' }
      }
    })
    expect(normalized.trajectory.keyframes[1]?.joints).not.toBe(
      input.keyframes[1]?.joints
    )
    const sourceFrame = input.keyframes[1]
    if (!sourceFrame) throw new Error('Expected the second source frame')
    ;(sourceFrame.joints as Record<string, number>).turn = 180
    expect(normalized.trajectory.keyframes[1]?.joints.turn).toBeCloseTo(
      Math.PI * 2.5,
      12
    )
  })

  it('produces equivalent canonical trajectories for equivalent explicit units', () => {
    const canonical = normalizeTrajectorySource(workcell(), {
      version: 1,
      timeUnit: 's',
      jointUnits: { turn: 'rad', slide: 'm' },
      keyframes: [
        { time: 0, joints: { turn: 0, slide: 0 } },
        { time: 2.5, joints: { turn: Math.PI * 2.5, slide: 1.25 } }
      ]
    })

    expect(normalizeTrajectorySource(workcell(), source()).trajectory).toEqual(
      canonical.trajectory
    )
  })

  it('rejects missing, unknown, or joint-kind-incompatible source units', () => {
    for (const invalid of [
      { ...source(), timeUnit: undefined },
      { ...source(), timeUnit: 'minutes' },
      { ...source(), jointUnits: { turn: 'deg' } },
      { ...source(), jointUnits: { turn: 'mm', slide: 'deg' } },
      {
        ...source(),
        jointUnits: { turn: 'deg', slide: 'mm', ghost: 'm' }
      }
    ])
      expect(() =>
        normalizeTrajectorySource(workcell(), invalid as TrajectorySource)
      ).toThrow('unit')
  })

  it('rejects missing, unknown, or inherited joint columns', () => {
    const inherited = Object.create({ turn: 0 }) as Record<string, number>
    inherited.slide = 0

    for (const joints of [
      { turn: 0 },
      { turn: 0, slide: 0, ghost: 0 },
      inherited
    ])
      expect(() =>
        normalizeTrajectorySource(workcell(), {
          ...source(),
          keyframes: [{ time: 0, joints }]
        })
      ).toThrow('joint')
  })

  it('applies canonical trajectory time and joint limit validation after conversion', () => {
    expect(() =>
      normalizeTrajectorySource(workcell(), {
        ...source(),
        keyframes: [
          { time: 0, joints: { turn: 0, slide: 0 } },
          { time: 0, joints: { turn: 0, slide: 0 } }
        ]
      })
    ).toThrow('increasing')
    expect(() =>
      normalizeTrajectorySource(workcell(), {
        ...source(),
        keyframes: [{ time: 0, joints: { turn: 0, slide: 3000 } }]
      })
    ).toThrow('slide')
  })

  it('does not accept inherited canonical joint values during direct validation', () => {
    const joints = Object.create({ turn: 0 }) as Record<string, number>
    joints.slide = 0
    joints.ghost = 0
    expect(() =>
      validateTrajectory(workcell(), {
        version: 1,
        keyframes: [{ time: 0, joints }]
      })
    ).toThrow('explicit')
  })
})
