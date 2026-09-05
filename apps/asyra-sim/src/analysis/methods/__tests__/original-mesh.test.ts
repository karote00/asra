import { describe, expect, it } from 'vitest'
import { IDENTITY_POSE, axisAngle, type Vec3 } from '../../../domain/math'
import {
  intervalAlgebra,
  poseOperations
} from '../../../domain/kinematic-algebra'
import type { MeshGeometry } from '../../../domain/part-geometry'
import { MechanicalMesh } from '../../../../samples/mechanical-mesh'
import { decodeRestrictedGlb } from '../../../engine/glb/decode'
import { resolvePart } from '../../../domain/part-geometry'
import { MeshWorkLimit, OriginalMeshQuery } from '../original-mesh-query'

const ops = poseOperations(intervalAlgebra)
async function ring(segments = 16): Promise<MeshGeometry> {
  const mesh = new MechanicalMesh()
  mesh.lathe(
    0xffffff,
    [0, 0, 0],
    [
      [0.5, -0.1],
      [1, -0.1],
      [1, 0.1],
      [0.5, 0.1],
      [0.5, -0.1]
    ],
    'y',
    segments
  )
  const asset = await decodeRestrictedGlb(mesh.toGlb('through-hole'))
  const part = resolvePart(
    {
      version: 1,
      id: 'ring',
      assetId: asset.source.sha256,
      pose: IDENTITY_POSE,
      scale: [1, 1, 1]
    },
    asset
  )
  if (part.geometry.kind !== 'mesh') throw new Error('Missing mesh')
  return part.geometry
}
const solid: MeshGeometry = {
  kind: 'mesh',
  version: 1,
  source: { assetId: 'a'.repeat(64), scale: [1, 1, 1] },
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
  indices: [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]
}
const shape = (geometry: MeshGeometry, position: Vec3 = [0, 0, 0]) => ({
  geometry,
  pose: ops.fromPose({ ...IDENTITY_POSE, position })
})
const sphere = (position: Vec3, radius = 0.1) => ({
  geometry: { kind: 'sphere' as const, radius },
  pose: ops.fromPose({ ...IDENTITY_POSE, position })
})

describe('original mesh solid certificates', () => {
  it('charges and checkpoints cached whole-part rejection queries', () => {
    const frozen = Object.freeze({
      ...solid,
      positions: Object.freeze([...solid.positions]),
      indices: Object.freeze([...solid.indices])
    })
    const query = new OriginalMeshQuery(undefined, 1000)
    const a = shape(frozen),
      b = sphere([5, 0, 0])
    query.distance(a, b, 0.02, 1e-6, 48)
    const before = query.work
    query.distance(a, b, 0.02, 1e-6, 48)
    expect(query.work).toBeGreaterThan(before)
    query.work = 1000
    expect(() => query.distance(a, b, 0.02, 1e-6, 48)).toThrow(MeshWorkLimit)
    expect(() => query.lowerOver(a, b, 0.02, { lower: 1 } as never)).toThrow(
      MeshWorkLimit
    )
  })
  it('certifies diagonal original surfaces across a stationary interval even when triangle boxes overlap', () => {
    const query = new OriginalMeshQuery(),
      a = shape(solid),
      b = sphere([0.9, 0.9, 0])
    const witness = query.distance(a, b, 0.02, 1e-6, 48)
    expect(witness.lower).toBeGreaterThan(0.02)
    expect(query.lowerOver(a, b, 0.02, witness)).toBeGreaterThan(0.02)
  })
  it('keeps immutable indices pose-independent, misses changed sources, and agrees with exhaustive traversal', () => {
    const frozen = Object.freeze({
      ...solid,
      positions: Object.freeze([...solid.positions]),
      indices: Object.freeze([...solid.indices])
    })
    const retained = new OriginalMeshQuery()
    retained.distance(shape(frozen), sphere([5, 0, 0]), 0.02, 1e-6, 48)
    const initialWork = retained.work
    retained.distance(shape(frozen), sphere([5, 0, 0]), 0.02, 1e-6, 48)
    expect(retained.work - initialWork).toBeLessThan(initialWork)
    for (const position of [
      [0, 0, 0],
      [0.15, 0.17, 0.12],
      [3, -1, 2]
    ] as const) {
      const a = shape(frozen, position),
        b = sphere([0.2, 0.2, 0.2], 0.02)
      const result = retained.distance(a, b, 0.02, 1e-6, 48)
      const oracle = new OriginalMeshQuery(undefined, 500000, false).distance(
        a,
        b,
        0.02,
        1e-6,
        48
      )
      expect(result.penetration).toBe(oracle.penetration)
      expect(result.lower > 0.02).toBe(oracle.lower > 0.02)
    }
    const changed = {
      ...frozen,
      positions: frozen.positions.map((n) => n * 0.01)
    }
    expect(
      retained.distance(
        shape(changed),
        sphere([0.2, 0.2, 0.2], 0.02),
        0.02,
        1e-6,
        48
      ).lower
    ).toBeGreaterThan(0.02)
    expect(
      retained.distance(
        shape(frozen),
        sphere([0.2, 0.2, 0.2], 0.02),
        0.02,
        1e-6,
        48
      ).penetration
    ).toBe(true)
  })
  it('proves crossing surfaces when neither solid has a vertex inside the other', async () => {
    const bars = await Promise.all(
      [
        [2, 0.1, 0.1],
        [0.1, 2, 0.1]
      ].map(async (size) => {
        const mesh = new MechanicalMesh()
        mesh.block(0xffffff, [0, 0, 0], size as unknown as Vec3)
        const asset = await decodeRestrictedGlb(mesh.toGlb('crossing-bar'))
        const part = resolvePart(
          {
            version: 1,
            id: 'bar',
            assetId: asset.source.sha256,
            pose: IDENTITY_POSE,
            scale: [1, 1, 1]
          },
          asset
        )
        if (part.geometry.kind !== 'mesh') throw new Error('Missing bar')
        return part.geometry
      })
    )
    const result = new OriginalMeshQuery().distance(
      shape(bars[0]),
      shape(bars[1]),
      0,
      1e-6,
      48
    )
    expect(result.penetration).toBe(true)
  })
  it('profiles complete disjoint mesh pairs with overlapping bounds and retains the hole', async () => {
    const outer = await ring(32),
      inner = {
        ...outer,
        positions: outer.positions.map((n, i) => (i % 3 === 1 ? n : n * 0.3))
      }
    const query = new OriginalMeshQuery(),
      start = performance.now()
    const result = query.distance(shape(outer), shape(inner), 0.02, 1e-6, 48)
    // eslint-disable-next-line no-console -- bounded permanent resource profile
    console.info(
      JSON.stringify({
        geometryProfile: 'nested-open-bore-rings',
        trianglesPerPart: outer.indices.length / 3,
        work: query.work,
        durationMs: Math.round(performance.now() - start)
      })
    )
    expect(result.lower).toBeGreaterThan(0.02)
    expect(result.penetration).toBe(false)
    const exhaustive = new OriginalMeshQuery(undefined, 500000, false)
    const reference = exhaustive.distance(
      shape(outer),
      shape(inner),
      0.02,
      1e-6,
      48
    )
    expect(reference.lower).toBeGreaterThan(0.02)
    expect(reference.penetration).toBe(result.penetration)
    expect(query.work).toBeLessThan(exhaustive.work / 4)
  })
  it('preserves a through hole where a hull or bounding box would collide', async () => {
    const query = new OriginalMeshQuery()
    const result = query.distance(
      shape(await ring()),
      sphere([0, 0, 0]),
      0.02,
      1e-6,
      48
    )
    expect(result.penetration).toBe(false)
    expect(result.lower).toBeGreaterThan(0.02)
    expect(result.lower).toBeLessThanOrEqual(0.5 * Math.cos(Math.PI / 16) - 0.1)
    expect(result.upper).toBeGreaterThanOrEqual(
      0.5 * Math.cos(Math.PI / 16) - 0.1
    )
  })
  it('detects complete solid containment despite disjoint surfaces', () => {
    const result = new OriginalMeshQuery().distance(
      shape(solid),
      sphere([0.2, 0.2, 0.2], 0.02),
      0,
      1e-6,
      48
    )
    expect(result.penetration).toBe(true)
    expect(result.upper).toBe(0)
  })
  it('detects an original-feature intersection, not merely the overall bounds', async () => {
    const result = new OriginalMeshQuery().distance(
      shape(await ring()),
      sphere([0.75, 0, 0]),
      0,
      1e-6,
      48
    )
    expect(result.penetration).toBe(true)
  })
  it('keeps separated concave solids clear under rigid transforms', async () => {
    const geometry = await ring(),
      query = new OriginalMeshQuery()
    const result = query.distance(
      {
        geometry,
        pose: ops.fromPose({
          position: [2, 3, 4],
          rotation: axisAngle([1, 2, 3], 0.7)
        })
      },
      sphere([2, 3, 4]),
      0.02,
      1e-6,
      48
    )
    expect(result.lower).toBeGreaterThan(0.02)
    expect(result.penetration).toBe(false)
  })
  it('does not claim contact at a numerically ambiguous boundary', () => {
    const result = new OriginalMeshQuery().distance(
      shape(solid),
      sphere([-0.1, 0.2, 0.2]),
      0,
      1e-6,
      48
    )
    expect(result.penetration).toBe(false)
    expect(result.lower).toBe(0)
  })
})
