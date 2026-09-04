import { expect, it, vi } from 'vitest'
import { decodeRestrictedGlb } from '../../engine/glb/decode'
import { encodeGlb, triangleFixture } from '../../engine/glb/__tests__/fixtures'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { IDENTITY_POSE } from '../../domain/math'
import { VisualAssetArchive } from '../visual-archive'

vi.mock('../visual-source', async (load) => {
  const actual = await load<typeof import('../visual-source')>()
  return {
    ...actual,
    VISUAL_SOURCE_PROFILE: {
      ...actual.VISUAL_SOURCE_PROFILE,
      maxSources: 2,
      maxArchiveBytes: 10000,
      maxVertices: 100,
      maxIndices: 300
    }
  }
})
const service = () => ({ decode: decodeRestrictedGlb, dispose: vi.fn() })
function fixture(name: string, instances = 1, padding = '') {
  const { json, binary } = triangleFixture()
  return encodeGlb(
    {
      ...json,
      extras: padding,
      nodes: Array.from({ length: instances }, (_, i) => ({
        name: `${name}${i}`,
        mesh: 0
      })),
      scenes: [{ nodes: Array.from({ length: instances }, (_, i) => i) }]
    },
    binary
  )
}

it('bounds retained sources by count, raw bytes and expanded geometry without erasing prior assets', async () => {
  const archive = new VisualAssetArchive(service())
  try {
    const first = await archive.prepare(fixture('first'), 'first.glb')
    archive.accept(first)
    const huge = await archive.prepare(
      fixture('huge', 1, 'x'.repeat(10000)),
      'huge.glb'
    )
    expect(() => archive.accept(huge)).toThrow('byte limit')
    const amplified = await archive.prepare(
      fixture('amplified', 34),
      'amplified.glb'
    )
    expect(() => archive.accept(amplified)).toThrow('geometry')
    const second = await archive.prepare(fixture('second'), 'second.glb')
    archive.accept(second)
    const third = await archive.prepare(fixture('third'), 'third.glb')
    expect(() => archive.accept(third)).toThrow('count')
    expect(
      archive.capture([first.source.assetId, second.source.assetId])
    ).toHaveLength(2)
  } finally {
    archive.dispose()
  }
})

it('counts every binding instance and rejects missing sources before workcell projection', async () => {
  const archive = new VisualAssetArchive(service())
  try {
    const prepared = await archive.prepare(fixture('ten', 10), 'ten.glb')
    const workcell = createSyntheticExample().workcell
    const bindings = Array.from({ length: 3 }, (_, i) => ({
      version: 1 as const,
      id: `v${i}`,
      assetId: prepared.source.assetId,
      pose: IDENTITY_POSE,
      scale: [1, 1, 1] as const
    }))
    workcell.bodies[0].visuals = bindings
    expect(() => archive.resolveWorkcell(workcell)).toThrow('Missing')
    expect(archive.resolveWorkcell(workcell, prepared).size).toBe(1)
    expect(archive.get(prepared.source.assetId)).toBeUndefined()
    archive.accept(prepared)
    expect(archive.resolveWorkcell(workcell).size).toBe(1)
    workcell.bodies[0].visuals = [...bindings, { ...bindings[0], id: 'fourth' }]
    expect(() => archive.resolveWorkcell(workcell)).toThrow('geometry')
  } finally {
    archive.dispose()
  }
})

it('checks the index budget independently of the vertex count', async () => {
  const archive = new VisualAssetArchive(service())
  try {
    const { json, binary } = triangleFixture(),
      bytes = new Uint8Array(36 + 303)
    bytes.set(binary)
    for (let i = 0; i < 303; i++) bytes[36 + i] = i % 3
    const prepared = await archive.prepare(
      encodeGlb(
        {
          ...json,
          buffers: [{ byteLength: bytes.length }],
          bufferViews: [
            ...json.bufferViews,
            { buffer: 0, byteOffset: 36, byteLength: 303 }
          ],
          accessors: [
            ...json.accessors,
            { bufferView: 1, componentType: 5121, count: 303, type: 'SCALAR' }
          ],
          meshes: [
            { primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }
          ]
        },
        bytes
      ),
      'indices.glb'
    )
    expect(prepared.asset.meshes[0].positions).toHaveLength(9)
    expect(() => archive.accept(prepared)).toThrow('geometry')
  } finally {
    archive.dispose()
  }
})
