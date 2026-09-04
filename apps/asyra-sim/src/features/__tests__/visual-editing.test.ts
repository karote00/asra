// @vitest-environment jsdom
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'
import core from '@asyra/core'
import { IDENTITY_POSE } from '../../domain/math'
import type { VisualBinding, Workcell } from '../../domain/workcell'
import { installModelComponents } from '../../init/components'
import { installEditingFeatures } from '../edit-workcell'
import { createCandidate, readWorkcell } from '../../common-apis/workcell'
import {
  readCapturedVisualAssetIds,
  readCapturedVisualBindingGroups
} from '../../common-apis/visual-reference'

const binding: VisualBinding = {
  version: 1,
  id: 'visual',
  assetId: 'a'.repeat(64),
  pose: IDENTITY_POSE,
  scale: [1, 1, 1]
}
const source: Workcell = {
  version: 1,
  robotRootId: null,
  bodies: [
    {
      id: 'body',
      name: 'Fixture',
      parentId: null,
      role: 'fixture',
      visible: true,
      color: 0,
      pose: IDENTITY_POSE,
      joint: { kind: 'fixed', axis: [0, 1, 0], value: 0, min: 0, max: 0 },
      colliders: [
        {
          id: 'proxy',
          geometry: { kind: 'box', size: [1, 1, 1] },
          pose: IDENTITY_POSE
        }
      ]
    }
  ]
}
const validateVisuals = vi.fn<(workcell: Workcell) => void>()
let features: ReturnType<typeof installEditingFeatures>
beforeAll(() => {
  installModelComponents(core)
  features = installEditingFeatures(core, { validateVisuals })
})
beforeEach(() => {
  core.load({
    version: '1.0.0',
    sceneTree: { workspace: '', workspaceList: [], elements: {} },
    props: {}
  })
  validateVisuals.mockReset()
})

it('accepts visual bindings as one Undo action without changing analysis geometry', async () => {
  const candidate = await features.edit.createCandidate('A', source)
  const before = core.getUndoHistoryDepth()
  await features.edit.setVisuals(candidate, 'body', [binding])
  expect(core.getUndoHistoryDepth()).toBe(before + 1)
  expect(readWorkcell(core, candidate).bodies[0].visuals).toEqual([binding])
  expect(readWorkcell(core, candidate).bodies[0].colliders).toEqual(
    source.bodies[0].colliders
  )
  expect(validateVisuals).toHaveBeenLastCalledWith(
    expect.objectContaining({
      bodies: [expect.objectContaining({ visuals: [binding] })]
    })
  )
  await features.history.undo()
  expect(readWorkcell(core, candidate).bodies[0].visuals).toBeUndefined()
  await features.history.redo()
  expect(readWorkcell(core, candidate).bodies[0].visuals).toEqual([binding])
  expect(
    readCapturedVisualAssetIds(await features.edit.captureDocument())
  ).toEqual([binding.assetId])
})

it('preserves independent bindings through ordinary edits and duplication', async () => {
  const input = structuredClone(source)
  input.bodies[0].visuals = [structuredClone(binding)]
  const candidate = await features.edit.createCandidate('A', input)
  const body = readWorkcell(core, candidate).bodies[0]
  body.name = 'Renamed'
  await features.edit.upsert(candidate, body)
  const copy = await features.edit.duplicateCandidate(candidate, 'B')
  const copied = readWorkcell(core, copy).bodies[0]
  expect(copied.id).not.toBe(body.id)
  expect(copied.visuals).toEqual([binding])
  const changed = { ...binding, scale: [2, 2, 2] as const }
  await features.edit.setVisuals(copy, copied.id, [changed])
  expect(readWorkcell(core, candidate).bodies[0].visuals).toEqual([binding])
  expect(readWorkcell(core, copy).bodies[0].visuals).toEqual([changed])
})

it('rejects unavailable resources before canonical writes and permits deleting a reference', async () => {
  const candidate = await features.edit.createCandidate('A', source)
  validateVisuals.mockImplementation(() => {
    throw new Error('Missing visual source')
  })
  const before = core.getUndoHistoryDepth()
  await expect(
    features.edit.setVisuals(candidate, 'body', [binding])
  ).rejects.toThrow('Missing visual source')
  expect(core.getUndoHistoryDepth()).toBe(before)
  expect(readWorkcell(core, candidate)).toEqual(source)
  validateVisuals.mockReset()
  await features.edit.setVisuals(candidate, 'body', [binding])
  await features.edit.setVisuals(candidate, 'body', [])
  expect(
    readCapturedVisualAssetIds(await features.edit.captureDocument())
  ).toEqual([])
})

it('requires source admission even for direct common API workcell creation', () => {
  const input = structuredClone(source)
  input.bodies[0].visuals = [binding]
  const before = core.getUndoHistoryDepth()
  expect(() => createCandidate(core, 'Unresolved', input)).toThrow(
    'admission is unavailable'
  )
  expect(core.getUndoHistoryDepth()).toBe(before)
})

it('adds or replaces one binding against the committed body without overwriting other references', async () => {
  const candidate = await features.edit.createCandidate('A', source)
  await features.edit.upsertVisual(candidate, 'body', binding)
  const other = { ...binding, id: 'second' }
  await features.edit.upsertVisual(candidate, 'body', other)
  const before = core.getUndoHistoryDepth()
  const changed = { ...binding, scale: [2, 2, 2] as const }
  await features.edit.upsertVisual(candidate, 'body', changed)
  expect(readWorkcell(core, candidate).bodies[0].visuals).toEqual([
    changed,
    other
  ])
  expect(core.getUndoHistoryDepth()).toBe(before + 1)
  await features.history.undo()
  expect(readWorkcell(core, candidate).bodies[0].visuals).toEqual([
    binding,
    other
  ])
  await expect(
    features.edit.upsertVisual(candidate, 'missing', binding)
  ).rejects.toThrow('Missing body')
})

it('groups captured visual instances by canonical candidate without mixing separate workcell budgets', async () => {
  const candidate = await features.edit.createCandidate('A', source)
  await features.edit.setVisuals(candidate, 'body', [binding])
  const copy = await features.edit.duplicateCandidate(candidate, 'B')
  const document = await features.edit.captureDocument()
  const groups = readCapturedVisualBindingGroups(document)
  expect(groups.get(candidate)).toEqual([binding])
  expect(groups.get(copy)).toEqual([binding])
  expect(readCapturedVisualAssetIds(document)).toEqual([binding.assetId])
})

it('rejects captured visual references with missing or cyclic canonical ownership', async () => {
  const candidate = await features.edit.createCandidate('A', source)
  await features.edit.setVisuals(candidate, 'body', [binding])
  const document = await features.edit.captureDocument()
  const missing = structuredClone(document)
  Reflect.deleteProperty(missing.sceneTree.elements, candidate)
  expect(() => readCapturedVisualAssetIds(missing)).toThrow('candidate')
  const cyclic = structuredClone(document)
  cyclic.sceneTree.elements.body.parentId = 'body'
  expect(() => readCapturedVisualAssetIds(cyclic)).toThrow('cycle')
})
