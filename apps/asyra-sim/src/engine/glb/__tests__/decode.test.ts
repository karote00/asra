import { createHash } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { decodeRestrictedGlb } from '../decode'
import { GLB_LIMITS } from '../schema'
import { encodeGlb, triangleFixture } from './fixtures'

afterEach(() => vi.unstubAllGlobals())

it('rejects malformed normalization flags', async () => {
  const { json, binary } = triangleFixture()
  await expect(
    decodeRestrictedGlb(
      encodeGlb(
        { ...json, accessors: [{ ...json.accessors[0], normalized: 'false' }] },
        binary
      )
    )
  ).rejects.toThrow('normalization')
})
it('rejects independently misaligned accessor offsets', async () => {
  const { json, binary } = triangleFixture()
  const padded = new Uint8Array(40)
  padded.set(binary, 4)
  const misaligned = {
    ...json,
    buffers: [{ byteLength: 40 }],
    bufferViews: [{ buffer: 0, byteOffset: 2, byteLength: 38 }],
    accessors: [{ ...json.accessors[0], byteOffset: 2 }]
  }
  await expect(
    decodeRestrictedGlb(encodeGlb(misaligned, padded))
  ).rejects.toThrow('alignment')
})

it('detaches source bytes before asynchronous hashing', async () => {
  const { json, binary } = triangleFixture(),
    bytes = encodeGlb(json, binary),
    digest = createHash('sha256').update(bytes).digest('hex')
  const pending = decodeRestrictedGlb(bytes)
  bytes.fill(0)
  const asset = await pending
  expect(asset.source.sha256).toBe(digest)
  expect(asset.meshes[0].positions[3]).toBe(1)
})
it('decodes an embedded visual triangle, with independent coordinates, units and source identity', async () => {
  const fetch = vi.fn(() => {
    throw new Error('Network forbidden')
  })
  vi.stubGlobal('fetch', fetch)
  const { json, binary } = triangleFixture(),
    bytes = encodeGlb(json, binary)
  const asset = await decodeRestrictedGlb(bytes)
  expect(asset.meshes[0].positions).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0])
  expect(asset.meshes[0].indices).toEqual([0, 1, 2])
  expect(asset.bounds).toEqual({ min: [0, 0, 0], max: [1, 1, 0] })
  expect(asset.source).toEqual({
    lengthUnit: 'm',
    byteLength: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex')
  })
  expect(Object.isFrozen(asset.meshes[0].positions)).toBe(true)
  expect(asset).not.toHaveProperty('colliders')
  expect(fetch).not.toHaveBeenCalled()
})
it('bakes node transforms without interpreting the source hierarchy as robot joints', async () => {
  const { json, binary } = triangleFixture()
  const data = {
    ...json,
    nodes: [
      { translation: [2, 3, 4], children: [1] },
      {
        mesh: 0,
        scale: [2, 3, 1],
        rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2]
      }
    ]
  }
  const asset = await decodeRestrictedGlb(encodeGlb(data, binary))
  const expected = [2, 3, 4, 2, 5, 4, -1, 3, 4]
  asset.meshes[0].positions.forEach((value, index) =>
    expect(value).toBeCloseTo(expected[index], 12)
  )
})
it('reads explicit byte strides and unsigned indices', async () => {
  const { json } = triangleFixture(),
    binary = new Uint8Array(52),
    view = new DataView(binary.buffer)
  ;[0, 0, 0, 99, 1, 0, 0, 99, 0, 1, 0, 99].forEach((v, i) =>
    view.setFloat32(i * 4, v, true)
  )
  binary.set([2, 1, 0], 48)
  const data = {
    ...json,
    buffers: [{ byteLength: 51 }],
    bufferViews: [
      { buffer: 0, byteLength: 48, byteStride: 16 },
      { buffer: 0, byteOffset: 48, byteLength: 3 }
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 1, componentType: 5121, count: 3, type: 'SCALAR' }
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }]
  }
  const asset = await decodeRestrictedGlb(
    encodeGlb(data, binary.subarray(0, 51))
  )
  expect(asset.meshes[0].positions).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0])
  expect(asset.meshes[0].indices).toEqual([2, 1, 0])
})
it.each([
  'uri',
  'textures',
  'animations',
  'extensionsUsed',
  'sparse',
  'skin',
  'targets'
])('rejects unsupported %s before any network access', async (key) => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const { json, binary } = triangleFixture()
  await expect(
    decodeRestrictedGlb(
      encodeGlb({ ...json, [key]: 'https://invalid.example/asset' }, binary)
    )
  ).rejects.toThrow('Unsupported GLB feature')
  expect(fetch).not.toHaveBeenCalled()
})
it('rejects corrupt container lengths, versions, and binary ranges', async () => {
  const { json, binary } = triangleFixture(),
    bytes = encodeGlb(json, binary)
  for (const offset of [0, 4, 8, 12, 16]) {
    const bad = bytes.slice()
    new DataView(bad.buffer).setUint32(offset, 0, true)
    await expect(decodeRestrictedGlb(bad)).rejects.toThrow()
  }
  await expect(
    decodeRestrictedGlb(
      encodeGlb(
        { ...json, accessors: [{ ...json.accessors[0], count: 20 }] },
        binary
      )
    )
  ).rejects.toThrow('range')
  new DataView(binary.buffer).setFloat32(0, Infinity, true)
  await expect(decodeRestrictedGlb(encodeGlb(json, binary))).rejects.toThrow(
    'Nonfinite'
  )
})
it('rejects cyclic or multiply-parented nodes and invalid transforms', async () => {
  const { json, binary } = triangleFixture()
  for (const nodes of [
    [{ mesh: 0, children: [0] }],
    [{ mesh: 0, children: [1, 1] }, {}],
    [{ mesh: 0, scale: [-1, 1, 1] }],
    [{ mesh: 0, scale: [0, 1, 1] }],
    [{ mesh: 0, translation: [1001, 0, 0] }]
  ])
    await expect(
      decodeRestrictedGlb(encodeGlb({ ...json, nodes }, binary))
    ).rejects.toThrow()
})
it('checks byte, JSON depth, node and expanded instance budgets', async () => {
  await expect(
    decodeRestrictedGlb(new Uint8Array(GLB_LIMITS.bytes + 1))
  ).rejects.toThrow('byte limit')
  const { json, binary } = triangleFixture()
  await expect(
    decodeRestrictedGlb(
      encodeGlb(
        { ...json, nodes: Array.from({ length: 129 }, () => ({ mesh: 0 })) },
        binary
      )
    )
  ).rejects.toThrow('nodes')
  let nested: unknown = 0
  for (let i = 0; i < 26; i++) nested = { child: nested }
  await expect(
    decodeRestrictedGlb(encodeGlb({ ...json, extras: nested }, binary))
  ).rejects.toThrow('JSON resource')
  const many = {
    ...json,
    meshes: [
      {
        primitives: Array.from({ length: 3 }, () => ({
          attributes: { POSITION: 0 }
        }))
      }
    ],
    nodes: Array.from({ length: 100 }, () => ({ mesh: 0 })),
    scenes: [{ nodes: Array.from({ length: 100 }, (_, i) => i) }]
  }
  await expect(decodeRestrictedGlb(encodeGlb(many, binary))).rejects.toThrow(
    'primitive limit'
  )
})
