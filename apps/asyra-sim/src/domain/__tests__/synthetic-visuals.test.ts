import { expect, it } from 'vitest'
import { createMechanicalVisuals } from '../../../samples/mechanical-visuals'
import { decodeRestrictedGlb } from '../../engine/glb/decode'

it('authors deterministic, bounded mechanical bodies as ordinary portable GLB sources', async () => {
  const sources = createMechanicalVisuals()
  expect(sources.map((source) => source.body)).toEqual([
    'base',
    'joint-1',
    'joint-2',
    'joint-3',
    'joint-4',
    'joint-5',
    'joint-6',
    'gripper',
    'workpiece',
    'fixture-table',
    'fixture-post'
  ])
  let triangles = 0
  for (const source of sources) {
    const asset = await decodeRestrictedGlb(source.bytes)
    expect(asset.meshes.length).toBeLessThanOrEqual(6)
    for (const mesh of asset.meshes) {
      expect(mesh.positions.every(Number.isFinite)).toBe(true)
      triangles += mesh.indices.length / 3
    }
    expect(asset.bounds.min.every((value) => value >= -0.7)).toBe(true)
    expect(asset.bounds.max.every((value) => value <= 0.8)).toBe(true)
    expect(asset.source.sha256).toMatch(/^[a-f0-9]{64}$/)
  }
  expect(triangles).toBeGreaterThan(5000)
  expect(triangles).toBeLessThan(30000)
  expect(createMechanicalVisuals()).toEqual(sources)
})
