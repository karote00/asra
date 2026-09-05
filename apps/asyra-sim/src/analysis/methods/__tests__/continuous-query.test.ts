import { describe, expect, it } from 'vitest'
import { IDENTITY_POSE } from '../../../domain/math'
import { convexDistance } from '../convex-query'
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
  it.each([
    { offset: 0, threshold: 0, state: 'finding', penetration: true },
    { offset: 0.25, threshold: 0.1, state: 'finding', penetration: false },
    { offset: 1, threshold: 0, state: 'unresolved', penetration: false }
  ] as const)(
    'retains $state witnesses and remaining unknown coverage on kernel exhaustion at offset $offset',
    ({ offset, threshold, state, penetration }) => {
      const query = input(
        [
          moving,
          { ...fixed, pose: { ...IDENTITY_POSE, position: [offset, 0, 0] } }
        ],
        {
          version: 1,
          keyframes: [0, 1, 2].map((time) => ({ time, joints: { moving: 0 } }))
        }
      )
      let calls = 0
      const result = queryContinuousPair(
        query,
        { ...settings, threshold },
        undefined,
        {
          distance: (a, b) =>
            ++calls > 1 ? null : convexDistance(a, b, 1e-6, 64),
          lower: () => null,
          exhaustionReason: 'Declared geometry work exhausted'
        }
      )
      expect(result.coverage).toBe('partial')
      expect(result.evaluations).toBe(1)
      expect(result.leaves).toHaveLength(2)
      expect(result.leaves.map(({ start, end }) => [start, end])).toEqual([
        [0, 1],
        [1, 2]
      ])
      // Traversal order is not the product contract; preservation and the
      // complete sorted partition are. The motion here is stationary.
      const retained = result.leaves.find((leaf) => leaf.witnessTime !== null)
      expect(retained).toBeDefined()
      if (!retained) throw new Error('The established witness was discarded')
      expect(retained).toMatchObject({
        state,
        penetration,
        witnessTime: retained.start,
        lower: 0
      })
      expect(retained.upper).not.toBeNull()
      expect(retained.upper).toBeLessThanOrEqual(
        Math.max(0, offset - 0.2) + 1e-6
      )
      expect(
        result.leaves.find((leaf) => leaf.witnessTime === null)
      ).toMatchObject({
        state: 'unresolved',
        witnessTime: null,
        upper: null
      })
    }
  )
  it('accepts the published maximum node budget for ordinary static evidence', () => {
    const query = input(
      [moving, { ...fixed, pose: { ...IDENTITY_POSE, position: [0, 5, 0] } }],
      {
        version: 1,
        keyframes: [{ time: 0, joints: { moving: 0 } }]
      }
    )
    expect(
      queryContinuousPair(query, { ...settings, maxIntervals: 1000000 })
        .coverage
    ).toBe('complete')
  })

  it('bounds interval evidence without hiding unresolved time or discarding observed witnesses', () => {
    const query = input(
      [
        moving,
        {
          ...fixed,
          pose: { ...IDENTITY_POSE, position: [0, 0.200001, 0] }
        }
      ],
      path(-1, 1)
    )
    const constrained = { ...settings, threshold: 1e-6, maxEvidenceLeaves: 1 }
    const result = queryContinuousPair(query, constrained)
    expect(result.coverage).toBe('partial')
    expect(result.leaves).toHaveLength(1)
    expect(result.leaves[0]).toMatchObject({
      start: 0,
      end: 1,
      state: 'unresolved'
    })
    expect(result.leaves[0].reason).toContain('evidence')
    expect(result.leaves[0].upper).not.toBeNull()
    expect(result.evaluations).toBe(1)
  })

  it('explicitly marks the full range unknown when initial segments exceed retained evidence capacity', () => {
    const query = input([moving, fixed], {
      version: 1,
      keyframes: [
        { time: 0, joints: { moving: -1 } },
        { time: 0.5, joints: { moving: 0 } },
        { time: 1, joints: { moving: 1 } }
      ]
    })
    const constrained = { ...settings, maxEvidenceLeaves: 1 }
    const result = queryContinuousPair(query, constrained)
    expect(result.leaves).toHaveLength(1)
    expect(result.leaves[0]).toMatchObject({
      start: 0,
      end: 1,
      state: 'unresolved',
      upper: null
    })
    expect(result.evaluations).toBe(0)
  })
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
