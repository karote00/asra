import { createHash } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { decodeRestrictedGlb } from '../../engine/glb/decode'
import { encodeGlb, triangleFixture } from '../../engine/glb/__tests__/fixtures'
import { VisualAssetArchive } from '../visual-archive'
import { validateVisualSources, visualSourceBytes } from '../visual-source'

const archives: VisualAssetArchive[] = []
const decoder = () => ({ decode: vi.fn(decodeRestrictedGlb), dispose: vi.fn() })
function archive() {
  const service = decoder(),
    value = new VisualAssetArchive(service)
  archives.push(value)
  return { value, service }
}
const fixture = () => {
  const { json, binary } = triangleFixture()
  return encodeGlb(json, binary)
}
afterEach(() => {
  archives.forEach((value) => value.dispose())
  archives.length = 0
})

it('prepares detached immutable evidence without accepting it or creating canonical data', async () => {
  const { value } = archive(),
    bytes = fixture(),
    original = new Uint8Array(bytes)
  const digest = createHash('sha256').update(bytes).digest('hex')
  const promise = value.prepare(bytes, 'reference.glb')
  bytes.fill(0)
  const prepared = await promise
  expect(prepared.source.assetId).toBe(digest)
  expect(visualSourceBytes(prepared.source)).toEqual(original)
  expect(prepared.asset.meshes[0].positions).toEqual([
    0, 0, 0, 1, 0, 0, 0, 1, 0
  ])
  expect(Object.isFrozen(prepared.source)).toBe(true)
  expect(Object.isFrozen(prepared.asset.meshes[0].positions)).toBe(true)
  expect(value.get(digest)).toBeUndefined()
  expect(value.capture([])).toEqual([])
  expect(() => value.capture([digest])).toThrow('Missing')
  value.accept(prepared)
  expect(value.get(digest)).toBe(prepared.asset)
  expect(value.capture([digest, digest])).toEqual([prepared.source])
})

it('requires an original live receipt and shares identical source bytes', async () => {
  const { value } = archive(),
    foreign = archive().value
  const receipt = await value.prepare(fixture(), 'first.glb')
  expect(() => value.accept(structuredClone(receipt))).toThrow('receipt')
  expect(() => foreign.accept(receipt)).toThrow('receipt')
  value.accept(receipt)
  const duplicate = await value.prepare(fixture(), 'other-name.glb')
  value.accept(duplicate)
  expect(value.capture([receipt.source.assetId])[0].filename).toBe('first.glb')
  value.dispose()
  expect(() => value.accept(receipt)).toThrow('closed')
  expect(() => value.get(receipt.source.assetId)).toThrow('closed')
})

it('revokes cancelled previews and cannot revive a closed archive after a late decode', async () => {
  const { value, service } = archive(),
    abort = new AbortController()
  const receipt = await value.prepare(fixture(), 'cancel.glb', abort.signal)
  abort.abort()
  expect(() => value.accept(receipt)).toThrow('cancelled')
  let finish: () => void = () => undefined
  service.decode = vi.fn(async (bytes) => {
    await new Promise<void>((resolve) => {
      finish = resolve
    })
    return decodeRestrictedGlb(bytes)
  })
  const late = value.prepare(fixture(), 'late.glb')
  value.dispose()
  finish()
  await expect(late).rejects.toThrow('closed')
  expect(service.dispose).toHaveBeenCalledOnce()
})

it('roundtrips original bytes and rejects altered digests or unsupported embedded content', async () => {
  const { value } = archive(),
    receipt = await value.prepare(fixture(), 'triangle.glb')
  value.accept(receipt)
  const sources = JSON.parse(
    JSON.stringify(value.capture([receipt.source.assetId]))
  )
  const hydrated = await VisualAssetArchive.fromSources(sources, decoder())
  archives.push(hydrated)
  expect(hydrated.get(receipt.source.assetId)?.meshes[0].positions).toEqual([
    0, 0, 0, 1, 0, 0, 0, 1, 0
  ])
  const damaged = [{ ...sources[0], assetId: 'f'.repeat(64) }],
    failed = decoder()
  await expect(VisualAssetArchive.fromSources(damaged, failed)).rejects.toThrow(
    'digest'
  )
  expect(failed.dispose).toHaveBeenCalledOnce()
  const { json, binary } = triangleFixture(),
    unsafe = encodeGlb({ ...json, images: [] }, binary)
  await expect(value.prepare(unsafe, 'unsafe.glb')).rejects.toThrow(
    'Unsupported'
  )
  expect(value.capture([receipt.source.assetId])).toHaveLength(1)
})

it('rejects malformed source envelopes, noncanonical base64, duplicate identities and excess bytes before decoding', async () => {
  const { value, service } = archive(),
    receipt = await value.prepare(fixture(), 'valid.glb')
  const source = receipt.source
  for (const invalid of [
    { ...source, extra: true },
    { ...source, version: 2 },
    { ...source, filename: '\u0000bad' },
    { ...source, filename: 'a'.repeat(201) },
    { ...source, byteLength: source.byteLength + 1 },
    { ...source, base64: 'YQ==\n', byteLength: 1 },
    { ...source, base64: 'YR==', byteLength: 1 },
    { ...source, byteLength: 16 * 1024 * 1024 + 1 }
  ])
    expect(() => validateVisualSources([invalid])).toThrow()
  expect(() => validateVisualSources([source, source])).toThrow('Duplicate')
  expect(() => validateVisualSources(Array(257).fill(source))).toThrow('count')
  service.decode.mockClear()
  await expect(
    value.prepare(new Uint8Array(16 * 1024 * 1024 + 1), 'large.glb')
  ).rejects.toThrow('byte')
  expect(service.decode).not.toHaveBeenCalled()
})
