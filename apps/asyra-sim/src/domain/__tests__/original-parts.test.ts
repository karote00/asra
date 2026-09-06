import { describe, expect, it } from 'vitest'
import { validGeometry, validBodyParameters } from '../workcell'
import { resolvePart, resolvePartWorkcell } from '../part-geometry'
import { inspectMeshTopology } from '../mesh-topology'
import { IDENTITY_POSE } from '../math'
import { decodeRestrictedGlb } from '../../engine/glb/decode'
import { createMechanicalVisuals } from '../../../samples/mechanical-visuals'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'

export const tetrahedron = {
  kind: 'mesh',
  version: 1,
  source: { assetId: 'a'.repeat(64), scale: [1, 1, 1] },
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
  indices: [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]
} as const

describe('original part geometry schema', () => {
  it('rejects mesh body data without its canonical source binding', () => {
    const body = createSyntheticExample().workcell.bodies[0]
    expect(
      validBodyParameters({
        ...body,
        colliders: [{ id: 'part', pose: IDENTITY_POSE, geometry: tetrahedron }]
      })
    ).toBe(false)
  })
  it('accepts complete source triangles instead of requiring a surrogate', () => {
    expect(validGeometry(tetrahedron)).toBe(true)
  })
  it.each([
    { indices: [0, 2, 99] },
    { positions: [NaN, 0, 0] },
    { source: { assetId: 'missing', scale: [1, 1, 1] } },
    { source: { assetId: 'a'.repeat(64), scale: [0, 1, 1] } },
    { version: 2 }
  ])('rejects malformed geometry without fallback: %j', (change) => {
    expect(validGeometry({ ...tetrahedron, ...change })).toBe(false)
  })
})

describe('complete original source resolution', () => {
  it('checks aggregate source geometry before allocating repeated resolved parts', () => {
    const example = createSyntheticExample(),
      source = {
        source: { sha256: 'a'.repeat(64) },
        meshes: [{ positions: new Array(600000).fill(0), indices: [0, 1, 2] }]
      }
    example.workcell.bodies[0].visuals = Array.from({ length: 3 }, (_, i) => ({
      version: 1,
      id: `part-${i}`,
      assetId: source.source.sha256,
      pose: IDENTITY_POSE,
      scale: [1, 1, 1]
    }))
    expect(() =>
      resolvePartWorkcell(
        example.workcell,
        new Map([[source.source.sha256, source]])
      )
    ).toThrow(/aggregate original part/)
  })
  it('preserves every source triangle, all coordinates, scale and local placement', () => {
    const binding = {
      version: 1 as const,
      id: 'part',
      assetId: 'a'.repeat(64),
      pose: { ...IDENTITY_POSE, position: [2, 3, 4] as const },
      scale: [2, 3, 4] as const
    }
    const source = {
      source: { sha256: binding.assetId },
      meshes: [tetrahedron, tetrahedron]
    }
    const collider = resolvePart(binding, source)
    expect(collider.pose).toEqual(binding.pose)
    expect(collider.geometry).toMatchObject({
      positions: [...tetrahedron.positions, ...tetrahedron.positions].map(
        (n, i) => n * binding.scale[i % 3]
      ),
      indices: [
        ...tetrahedron.indices,
        ...tetrahedron.indices.map((i) => i + 4)
      ]
    })
    expect(() =>
      resolvePart(binding, { ...source, source: { sha256: 'b'.repeat(64) } })
    ).toThrow(/identity/)
  })
  it('resolves real table legs, replaces the legacy tabletop surrogate, and never mutates the document', async () => {
    const sample = createSyntheticExample(),
      part = createMechanicalVisuals().find(
        (item) => item.body === 'fixture-table'
      )
    if (!part) throw new Error('Missing sample table source')
    const asset = await decodeRestrictedGlb(part.bytes)
    const body = sample.workcell.bodies.find(
      (body) => body.id === 'example:fixture-table'
    )
    if (!body) throw new Error('Missing sample table body')
    const workcell = {
      ...sample.workcell,
      bodies: sample.workcell.bodies.map((item) =>
        item === body
          ? {
              ...item,
              visuals: [
                {
                  version: 1 as const,
                  id: 'table-source',
                  assetId: asset.source.sha256,
                  pose: IDENTITY_POSE,
                  scale: [1, 1, 1] as const
                }
              ]
            }
          : item
      )
    }
    const original = structuredClone(workcell)
    const resolved = resolvePartWorkcell(
      workcell,
      new Map([[asset.source.sha256, asset]])
    )
    const table = resolved.bodies.find((item) => item.id === body.id)
    if (!table) throw new Error('Missing resolved table')
    expect(table.colliders).toHaveLength(1)
    expect(table.colliders[0].geometry.kind).toBe('mesh')
    if (table.colliders[0].geometry.kind !== 'mesh')
      throw new Error('Missing original mesh')
    expect(
      Math.min(
        ...table.colliders[0].geometry.positions.filter((_, i) => i % 3 === 1)
      )
    ).toBeLessThan(-0.5)
    expect(workcell).toEqual(original)
    expect(() => resolvePartWorkcell(workcell, new Map())).toThrow(
      /Missing original/
    )
  })
  it('distinguishes closed solids, open surfaces and degenerate triangles without repair', () => {
    expect(inspectMeshTopology(tetrahedron).issue).toBeNull()
    expect(
      inspectMeshTopology({
        ...tetrahedron,
        indices: tetrahedron.indices.slice(3)
      }).issue
    ).toMatch(/Open/)
    expect(
      inspectMeshTopology({ ...tetrahedron, indices: [0, 0, 1] }).issue
    ).toMatch(/Degenerate/)
  })
  it('authors every ordinary mechanical example as closed, oriented original solids', async () => {
    for (const part of createMechanicalVisuals()) {
      const asset = await decodeRestrictedGlb(part.bytes)
      const collider = resolvePart(
        {
          version: 1,
          id: part.body,
          assetId: asset.source.sha256,
          pose: IDENTITY_POSE,
          scale: [1, 1, 1]
        },
        asset
      )
      if (collider.geometry.kind !== 'mesh') throw new Error('Missing mesh')
      expect(inspectMeshTopology(collider.geometry).issue, part.body).toBeNull()
    }
  })
})
