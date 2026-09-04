// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import core from '@asyra/core'
import { installVisualStorageFeatures } from '../../features/storage-visuals'
import { installEditingFeatures } from '../../features/edit-workcell'
import { installModelComponents } from '../../init/components'
import { readWorkcell } from '../../common-apis/workcell'
import { IDENTITY_POSE } from '../../domain/math'
import { decodeRestrictedGlb } from '../../engine/glb/decode'
import { encodeGlb, triangleFixture } from '../../engine/glb/__tests__/fixtures'
import { VisualAssetArchive, type VisualDecoder } from '../visual-archive'

const decoder: VisualDecoder = {
  decode: vi.fn(decodeRestrictedGlb),
  dispose: vi.fn()
}
const archive = new VisualAssetArchive(decoder)
let editing: ReturnType<typeof installEditingFeatures>
let api: ReturnType<typeof installVisualStorageFeatures>
const fixture = () => {
  const { json, binary } = triangleFixture()
  return encodeGlb(json, binary)
}
beforeAll(() => {
  installModelComponents(core)
  editing = installEditingFeatures(core, {
    validateVisuals: (workcell) => {
      archive.resolveWorkcell(workcell)
    }
  })
  api = installVisualStorageFeatures(core, archive, editing.edit.upsertVisual)
})
beforeEach(() => {
  core.load({
    version: '1.0.0',
    sceneTree: { workspace: '', workspaceList: [], elements: {} },
    props: {}
  })
  vi.mocked(decoder.decode).mockImplementation(decodeRestrictedGlb)
})
afterAll(async () => {
  await core.resetRuntime()
})

it('prepares without history and accepts only after explicit intent as one canonical edit', async () => {
  const candidate = await editing.edit.createCandidate('A', {
    version: 1,
    robotRootId: null,
    bodies: [
      {
        id: 'body',
        name: 'Fixture',
        role: 'fixture',
        parentId: null,
        visible: true,
        color: 0,
        pose: IDENTITY_POSE,
        joint: { kind: 'fixed', axis: [0, 1, 0], value: 0, min: 0, max: 0 },
        colliders: []
      }
    ]
  })
  const before = core.getUndoHistoryDepth(),
    bytes = fixture()
  const pending = api.prepare(bytes, 'triangle.glb')
  bytes.fill(0)
  const receipt = await pending
  expect(core.getUndoHistoryDepth()).toBe(before)
  expect(archive.get(receipt.source.assetId)).toBeUndefined()
  await api.retain(receipt, candidate, 'body', {
    version: 1,
    id: 'visual',
    pose: IDENTITY_POSE,
    scale: [1, 1, 1]
  })
  expect(core.getUndoHistoryDepth()).toBe(before + 1)
  expect(readWorkcell(core, candidate).bodies[0].visuals?.[0].assetId).toBe(
    receipt.source.assetId
  )
  await editing.history.undo()
  expect(readWorkcell(core, candidate).bodies[0].visuals).toBeUndefined()
  expect(archive.get(receipt.source.assetId)).toBeDefined()
  await editing.history.redo()
  expect(readWorkcell(core, candidate).bodies[0].visuals).toHaveLength(1)
})

it('revokes discarded completed previews without writing canonical state', async () => {
  const receipt = await api.prepare(fixture(), 'discard.glb'),
    before = core.getUndoHistoryDepth()
  api.discard(receipt)
  await expect(
    api.retain(receipt, 'candidate', 'body', {
      version: 1,
      id: 'visual',
      pose: IDENTITY_POSE,
      scale: [1, 1, 1]
    })
  ).rejects.toThrow('receipt')
  expect(core.getUndoHistoryDepth()).toBe(before)
})

it('uses a Feature-owned signal, rejects overlap and cancels the owned preparation', async () => {
  let captured: AbortSignal | undefined
  vi.mocked(decoder.decode).mockImplementation(
    async (_bytes, signal) =>
      new Promise((_resolve, reject) => {
        captured = signal
        signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Cancelled', 'AbortError')),
          { once: true }
        )
      })
  )
  const external = new AbortController(),
    before = core.getUndoHistoryDepth()
  const pending = api.prepare(fixture(), 'pending.glb', {
    signal: external.signal
  })
  await vi.waitFor(() => expect(captured).toBeDefined())
  expect(captured).not.toBe(external.signal)
  await expect(api.prepare(fixture(), 'overlap.glb')).rejects.toMatchObject({
    code: 'FEATURE_TASK_ACTIVE'
  })
  expect(api.cancel()).toBe(true)
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  expect(core.getUndoHistoryDepth()).toBe(before)
})
