import { describe, expect, it } from 'vitest'
import { IDENTITY_POSE, type Vec3 } from '../../../domain/math'
import type { Body, Workcell } from '../../../domain/workcell'
import type { MeshGeometry } from '../../../domain/part-geometry'
import { queryOriginalPartPair } from '../original-part-method'
import { OriginalMeshQuery } from '../original-mesh-query'
import type { PairQuery, QuerySettings } from '../continuous-query'
import { createMechanicalVisuals } from '../../../../samples/mechanical-visuals'
import { decodeRestrictedGlb } from '../../../engine/glb/decode'
import { resolvePart } from '../../../domain/part-geometry'
import {
  intervalAlgebra,
  poseOperations
} from '../../../domain/kinematic-algebra'

const mesh: MeshGeometry = {
  kind: 'mesh',
  version: 1,
  source: { assetId: 'a'.repeat(64), scale: [1, 1, 1] },
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
  indices: [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]
}
const settings: QuerySettings = {
  threshold: 0,
  distanceTolerance: 1e-6,
  timeTolerance: 1e-5,
  maxIntervals: 2048,
  maxIterations: 48
}
function query(
  kind: 'prismatic' | 'revolute',
  a: number,
  b: number,
  obstacle: Vec3
): PairQuery {
  const base: Body = {
    id: 'base',
    name: 'base',
    parentId: null,
    role: 'robot',
    pose: IDENTITY_POSE,
    joint: { kind: 'fixed', axis: [0, 0, 1], value: 0, min: 0, max: 0 },
    visible: true,
    color: 0,
    colliders: []
  }
  const moving: Body = {
    ...base,
    id: 'moving',
    parentId: 'base',
    role: 'link',
    joint: {
      kind,
      axis: kind === 'prismatic' ? [1, 0, 0] : [0, 0, 1],
      value: 0,
      min: -20,
      max: 20
    },
    colliders: [{ id: 'part', pose: IDENTITY_POSE, geometry: mesh }]
  }
  const fixed: Body = {
    ...base,
    id: 'fixed',
    role: 'fixture',
    pose: { ...IDENTITY_POSE, position: obstacle },
    colliders: [
      {
        id: 'part',
        pose: IDENTITY_POSE,
        geometry: { kind: 'sphere', radius: 0.025 }
      }
    ]
  }
  const workcell: Workcell = {
    version: 1,
    robotRootId: 'base',
    bodies: [base, moving, fixed]
  }
  return {
    workcell,
    trajectory: {
      version: 1,
      keyframes: [
        { time: 0, joints: { moving: a } },
        { time: 0.01, joints: { moving: b } }
      ]
    },
    interval: [0, 0.01],
    a: { bodyId: 'moving', colliderId: 'part' },
    b: { bodyId: 'fixed', colliderId: 'part' }
  }
}
describe('original part complete-time evidence', () => {
  it.each([
    ['prismatic', -3, 3, [0.17, 0.2, 0.2]],
    ['revolute', -Math.PI / 2, Math.PI / 2, [0.5, 0.2, 0.1]]
  ] as const)(
    'finds %s crossings between independently clear endpoints',
    (kind, a, b, obstacle) => {
      const input = query(kind, a, b, obstacle)
      for (const time of input.interval) {
        const result = queryOriginalPartPair(
          { ...input, interval: [time, time] },
          settings
        )
        expect(result.leaves.every((leaf) => leaf.state === 'clear')).toBe(true)
      }
      const result = queryOriginalPartPair(input, settings)
      expect(result.leaves.some((leaf) => leaf.penetration)).toBe(true)
      expect(result.leaves[0].start).toBe(0)
      expect(result.leaves.at(-1)?.end).toBe(0.01)
    }
  )
  it('does not turn an exhausted original-triangle budget into a clear interval', () => {
    const result = queryOriginalPartPair(
      query('prismatic', -3, 3, [0.17, 0.2, 0.2]),
      settings,
      undefined,
      new OriginalMeshQuery(undefined, 1)
    )
    expect(result.coverage).toBe('partial')
    expect(result.leaves).toEqual([
      expect.objectContaining({
        start: 0,
        end: 0.01,
        state: 'unresolved',
        upper: null,
        reason: expect.stringContaining('Original-triangle work budget')
      })
    ])
  })
  it('checks cancellation during geometry work, not just between body pairs', () => {
    let calls = 0
    expect(() =>
      queryOriginalPartPair(
        query('prismatic', -3, 3, [0.17, 0.2, 0.2]),
        settings,
        () => {
          if (++calls > 10) throw new Error('cancelled')
        }
      )
    ).toThrow('cancelled')
  })
  it('detects a real sample table leg which its historical tabletop proxy misses', async () => {
    const source = createMechanicalVisuals().find(
      (part) => part.body === 'fixture-table'
    )
    if (!source) throw new Error('Missing sample table source')
    const asset = await decodeRestrictedGlb(source.bytes)
    const part = resolvePart(
      {
        version: 1,
        id: 'table',
        assetId: asset.source.sha256,
        pose: IDENTITY_POSE,
        scale: [1, 1, 1]
      },
      asset
    )
    const ops = poseOperations(intervalAlgebra)
    const result = new OriginalMeshQuery().distance(
      { geometry: part.geometry, pose: ops.fromPose(IDENTITY_POSE) },
      {
        geometry: { kind: 'sphere', radius: 0.015 },
        pose: ops.fromPose({ ...IDENTITY_POSE, position: [0.27, -0.3, 0.21] })
      },
      0,
      1e-6,
      48
    )
    expect(result.penetration).toBe(true)
    expect(result.upper).toBe(0)
  })
})
