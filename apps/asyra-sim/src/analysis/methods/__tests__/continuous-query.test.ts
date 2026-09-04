import { describe, expect, it } from 'vitest'
import { IDENTITY_POSE } from '../../../domain/math'
import {
  validateTrajectory,
  validateWorkcell,
  type Body,
  type Trajectory,
  type Workcell
} from '../../../domain/workcell'
import {
  queryContinuousPair,
  type PairQuery,
  type QuerySettings
} from '../continuous-query'

const settings: QuerySettings = {
  threshold: 0,
  distanceTolerance: 1e-6,
  timeTolerance: 1e-5,
  maxIntervals: 512,
  maxIterations: 64
}
const body: Body = {
  id: 'base',
  parentId: null,
  name: 'Base',
  role: 'robot',
  pose: IDENTITY_POSE,
  joint: { kind: 'fixed', axis: [1, 0, 0], value: 0, min: 0, max: 0 },
  colliders: [],
  visible: true,
  color: 0
}
const sphere = {
  id: 'shape',
  geometry: { kind: 'sphere' as const, radius: 0.1 },
  pose: IDENTITY_POSE
}
const moving: Body = {
  ...body,
  id: 'moving',
  parentId: 'base',
  role: 'tool',
  joint: { kind: 'prismatic', axis: [1, 0, 0], value: 0, min: -20, max: 20 },
  colliders: [sphere]
}
const fixed: Body = {
  ...body,
  id: 'obstacle',
  role: 'fixture',
  colliders: [sphere]
}
function input(bodies: Body[], trajectory: Trajectory): PairQuery {
  const workcell: Workcell = {
    version: 1,
    robotRootId: 'base',
    bodies: [body, ...bodies]
  }
  validateWorkcell(workcell)
  validateTrajectory(workcell, trajectory)
  return {
    workcell,
    trajectory,
    a: { bodyId: 'moving', colliderId: 'shape' },
    b: { bodyId: 'obstacle', colliderId: 'shape' },
    interval: [
      trajectory.keyframes[0].time,
      trajectory.keyframes.at(-1)?.time ?? 0
    ]
  }
}
const path = (a: number, b: number, duration = 1): Trajectory => ({
  version: 1,
  keyframes: [
    { time: 0, joints: { moving: a } },
    { time: duration, joints: { moving: b } }
  ]
})

describe('complete-time pair evidence', () => {
  it('does not report clearance when an off-center crossing misses the initial three witness times', () => {
    const obstacle: Body = {
      ...fixed,
      pose: { ...IDENTITY_POSE, position: [3, 0, 0] }
    }
    const result = queryContinuousPair(
      input([moving, obstacle], path(-10, 10)),
      settings
    )
    expect(
      result.leaves.some((leaf) => leaf.penetration),
      JSON.stringify({
        evaluations: result.evaluations,
        coverage: result.coverage,
        leaves: result.leaves.slice(0, 6)
      })
    ).toBe(true)
    expect(result.leaves.every((leaf) => leaf.state === 'clear')).toBe(false)
  })
  it('finds a high-speed crossing between distant clear endpoint poses', () => {
    const result = queryContinuousPair(
      input([moving, fixed], path(-10, 10, 0.001)),
      settings
    )
    expect(result.leaves.some((leaf) => leaf.penetration)).toBe(true)
    expect(result.upper).toBe(0)
    expect(result.leaves.find((leaf) => leaf.penetration)?.witnessTime).toBe(
      0.0005
    )
  })
  it('finds a rotating tool sweep whose Cartesian endpoints miss the obstacle', () => {
    const rotating: Body = {
      ...moving,
      pose: IDENTITY_POSE,
      joint: { kind: 'revolute', axis: [0, 0, 1], value: 0, min: -10, max: 10 },
      colliders: [
        { ...sphere, pose: { ...IDENTITY_POSE, position: [2, 0, 0] } }
      ]
    }
    const obstacle: Body = {
      ...fixed,
      pose: { ...IDENTITY_POSE, position: [0, 2, 0] }
    }
    const result = queryContinuousPair(
      input([rotating, obstacle], path(0, Math.PI)),
      settings
    )
    expect(result.leaves.some((leaf) => leaf.penetration)).toBe(true)
    expect(result.upper).toBe(0)
  })
  it('proves clearance for a complete translating interval without assuming frame sampling', () => {
    const obstacle: Body = {
      ...fixed,
      pose: { ...IDENTITY_POSE, position: [0, 5, 0] }
    }
    const result = queryContinuousPair(input([moving, obstacle], path(-1, 1)), {
      ...settings,
      threshold: 1
    })
    expect(result.coverage).toBe('complete')
    expect(result.leaves.every((leaf) => leaf.state === 'clear')).toBe(true)
    expect(result.lower).toBeGreaterThan(1)
    expect(result.upper).toBeGreaterThanOrEqual(4.8)
    expect(result.lower).toBeLessThanOrEqual(4.8)
  })
  it('preserves unresolved coverage on budget exhaustion and checks aborts', () => {
    const obstacle: Body = {
      ...fixed,
      pose: { ...IDENTITY_POSE, position: [0, 0.200001, 0] }
    }
    const query = input([moving, obstacle], path(-1, 1))
    const result = queryContinuousPair(query, {
      ...settings,
      maxIntervals: 1,
      threshold: 1e-6
    })
    expect(result.coverage).toBe('partial')
    expect(result.leaves.some((leaf) => leaf.state === 'unresolved')).toBe(true)
    expect(result.leaves[0].start).toBe(0)
    expect(result.leaves.at(-1)?.end).toBe(1)
    expect(() =>
      queryContinuousPair(query, settings, () => {
        throw new Error('Aborted')
      })
    ).toThrow('Aborted')
  })
  it('splits at keyframes and preserves exact selected interval coverage', () => {
    const query = input(
      [moving, { ...fixed, pose: { ...IDENTITY_POSE, position: [0, 5, 0] } }],
      {
        version: 1,
        keyframes: [
          { time: 0, joints: { moving: -1 } },
          { time: 0.4, joints: { moving: 1 } },
          { time: 1, joints: { moving: 0 } }
        ]
      }
    )
    const result = queryContinuousPair(
      { ...query, interval: [0.2, 0.7] },
      settings
    )
    expect(result.coverage).toBe('complete')
    expect(result.leaves.map((leaf) => [leaf.start, leaf.end])).toEqual([
      [0.2, 0.4],
      [0.4, 0.7]
    ])
  })
  it('keeps equality unresolved and rejects empty or extrapolated trajectories', () => {
    const obstacle: Body = {
      ...fixed,
      pose: { ...IDENTITY_POSE, position: [0.2, 0, 0] }
    }
    const query = input([moving, obstacle], {
      version: 1,
      keyframes: [{ time: 0, joints: { moving: 0 } }]
    })
    expect(queryContinuousPair(query, settings).coverage).toBe('partial')
    expect(() =>
      queryContinuousPair({ ...query, interval: [0, 1] }, settings)
    ).toThrow('covered')
    expect(() =>
      queryContinuousPair(
        { ...query, trajectory: { version: 1, keyframes: [] } },
        settings
      )
    ).toThrow('covered')
  })
})
