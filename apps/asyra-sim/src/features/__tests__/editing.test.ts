// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import core from '@asyra/core'
import { ComponentTypes, PropertyFields } from '../../constants'
import { IDENTITY_POSE } from '../../domain/math'
import type { Body, Workcell } from '../../domain/workcell'
import { installModelComponents } from '../../init/components'
import { readWorkcell } from '../../common-apis/workcell'
import { loadCanonicalDocument } from '../../common-apis/document'
import { installEditingFeatures } from '../edit-workcell'

const empty = {
  version: '1.0.0',
  sceneTree: { workspace: '', workspaceList: [], elements: {} },
  props: {}
}
const base: Body = {
  id: 'base',
  parentId: null,
  name: 'Base',
  role: 'robot',
  pose: IDENTITY_POSE,
  joint: { kind: 'fixed', axis: [0, 1, 0], value: 0, min: 0, max: 0 },
  colliders: [
    {
      id: 'shape',
      pose: IDENTITY_POSE,
      geometry: { kind: 'box', size: [1, 1, 1] }
    }
  ],
  visible: true,
  color: 0x448899
}
const fixture: Body = {
  ...base,
  id: 'fixture',
  role: 'fixture',
  name: 'Fixture',
  pose: { ...IDENTITY_POSE, position: [3, 0, 0] }
}
const model: Workcell = {
  version: 1,
  robotRootId: 'base',
  bodies: [base, fixture]
}
let features: ReturnType<typeof installEditingFeatures>
beforeAll(() => {
  installModelComponents(core)
  features = installEditingFeatures(core)
})
beforeEach(() => {
  core.load(empty)
})

describe('normal canonical editing and replay', () => {
  it('captures one consistent revision and applies canonical data without resetting history', async () => {
    const candidate = await features.edit.createCandidate('Saved', model)
    const captured = features.edit.captureDocument()
    const editing = features.edit.upsert(candidate, {
      ...fixture,
      name: 'Unsaved',
      pose: { ...fixture.pose, position: [4, 1, 0] }
    })
    const document = await captured
    await editing
    const depth = core.getUndoHistoryDepth()
    expect(depth).toBeGreaterThan(0)
    const issues = await features.edit.applyDocument(document, () => undefined)
    expect(issues).toEqual([])
    expect(
      readWorkcell(core, candidate).bodies.find((body) => body.id === 'fixture')
        ?.name
    ).toBe('Fixture')
    expect(core.getUndoHistoryDepth()).toBe(depth)
    expect(readWorkcell(core, candidate)).toEqual(model)
  })
  it('checks the accepted document guard inside the queue before any canonical apply', async () => {
    const candidate = await features.edit.createCandidate('Original', model)
    await expect(
      features.edit.applyDocument(empty, () => {
        throw new Error('New edit arrived')
      })
    ).rejects.toThrow('New edit arrived')
    expect(readWorkcell(core, candidate)).toEqual(model)
  })
  it('rejects invalid loaded hierarchy before altering the current document', async () => {
    const candidate = await features.edit.createCandidate('Original', model)
    const saved = await features.edit.captureDocument()
    const broken = structuredClone(saved)
    broken.sceneTree.elements.base.parentId = 'missing-parent'
    await expect(
      features.edit.applyDocument(broken, () => undefined)
    ).rejects.toThrow()
    expect(readWorkcell(core, candidate)).toEqual(model)
  })
  it('reconciles a parent/child reversal without losing retained identities', async () => {
    const initial: Workcell = {
      version: 1,
      robotRootId: null,
      bodies: [
        { ...base, role: 'fixture' },
        { ...fixture, parentId: 'base' }
      ]
    }
    const candidate = await features.edit.createCandidate('Reparent', initial)
    const ids = core.getElementData('base')?.props
    const reversed: Workcell = {
      version: 1,
      robotRootId: null,
      bodies: [
        { ...fixture, parentId: null },
        { ...base, role: 'fixture', parentId: 'fixture' }
      ]
    }
    await features.edit.replace(candidate, reversed)
    expect(core.getElementData('base')?.parentId).toBe('fixture')
    expect(core.getElementData('fixture')?.parentId).toBe(candidate)
    expect(core.getElementData('base')?.props).toEqual(ids)
    await features.history.undo()
    expect(readWorkcell(core, candidate)).toEqual(initial)
  })
  it('does not add History for an unchanged body update', async () => {
    const candidate = await features.edit.createCandidate('A', model),
      before = core.getUndoHistoryDepth()
    await features.edit.upsert(candidate, fixture)
    expect(core.getUndoHistoryDepth()).toBe(before)
  })
  it('reports schema fallback instead of presenting repaired geometry as original input', async () => {
    const candidate = await features.edit.createCandidate('A', model),
      saved = await core.save()
    const propertyId = core.getElementData('fixture')?.props?.body
    if (!propertyId) throw new Error('Missing body property')
    ;(saved.props[propertyId] as Record<string, unknown>)[PropertyFields.BODY] =
      { invalid: true }
    const diagnostics = loadCanonicalDocument(core, saved)
    expect(diagnostics.length).toBeGreaterThan(0)
    expect(
      readWorkcell(core, candidate).bodies.find((body) => body.id === 'fixture')
        ?.colliders
    ).toEqual([])
  })
  it('flags forbidden duplicate identity fields during load recovery', async () => {
    const candidate = await features.edit.createCandidate('A', model),
      saved = await core.save()
    const propertyId = core.getElementData('fixture')?.props?.body
    if (!propertyId) throw new Error('Missing body property')
    const property = saved.props[propertyId] as Record<string, unknown>
    property[PropertyFields.BODY] = {
      ...(property[PropertyFields.BODY] as Record<string, unknown>),
      parentId: 'untrusted-parent'
    }
    const issues = loadCanonicalDocument(core, saved)
    expect(
      issues.some((issue) => issue.path.endsWith(PropertyFields.BODY))
    ).toBe(true)
    expect(
      readWorkcell(core, candidate).bodies.find((body) => body.id === 'fixture')
        ?.parentId
    ).toBeNull()
  })
  it('replaces an existing workcell only under explicit intent and replays the previous graph', async () => {
    const candidate = await features.edit.createCandidate('A', model),
      depth = core.getUndoHistoryDepth()
    const replacement: Workcell = {
      ...model,
      bodies: [
        { ...base, name: 'Replacement' },
        { ...fixture, pose: { ...IDENTITY_POSE, position: [4, 0, 0] } }
      ]
    }
    await features.edit.replace(candidate, replacement)
    expect(readWorkcell(core, candidate)).toEqual(replacement)
    expect(core.getUndoHistoryDepth()).toBe(depth + 1)
    await features.history.undo()
    expect(readWorkcell(core, candidate)).toEqual(model)
  })
  it('creates the scene and property graph as one Undo action', async () => {
    const before = core.getUndoHistoryDepth()
    const candidate = await features.edit.createCandidate('A', model)
    expect(readWorkcell(core, candidate)).toEqual(model)
    expect(core.getElementData('base')?.parentId).toBe(candidate)
    expect(core.getUndoHistoryDepth()).toBe(before + 1)
    await features.history.undo()
    expect(core.getElementData(candidate)).toBeUndefined()
    await features.history.redo()
    expect(readWorkcell(core, candidate)).toEqual(model)
  })
  it('updates existing metadata/properties and reparenting with one history entry', async () => {
    const candidate = await features.edit.createCandidate('A', model)
    const before = core.getUndoHistoryDepth(),
      propertyIds = core.getElementData('fixture')?.props
    const updated: Body = {
      ...fixture,
      name: 'Mounted fixture',
      parentId: 'base',
      pose: { ...IDENTITY_POSE, position: [0, 2, 0] },
      visible: false
    }
    await features.edit.upsert(candidate, updated)
    expect(core.getUndoHistoryDepth()).toBe(before + 1)
    expect(core.getElementData('fixture')?.props).toEqual(propertyIds)
    expect(
      readWorkcell(core, candidate).bodies.find((body) => body.id === 'fixture')
    ).toEqual(updated)
    await features.history.undo()
    expect(readWorkcell(core, candidate)).toEqual(model)
    await features.history.redo()
    expect(
      readWorkcell(core, candidate).bodies.find((body) => body.id === 'fixture')
    ).toEqual(updated)
  })
  it('rejects invalid intent and direct property writes without partial changes', async () => {
    const candidate = await features.edit.createCandidate('A', model),
      before = core.getUndoHistoryDepth()
    await expect(
      features.edit.upsert(candidate, {
        ...fixture,
        joint: { ...fixture.joint, axis: [0, 0, 0] }
      })
    ).rejects.toThrow()
    expect(() =>
      core.updateElementProperties([
        {
          elementId: 'fixture',
          values: { [PropertyFields.BODY]: { pose: { position: [NaN, 0, 0] } } }
        }
      ])
    ).toThrow()
    expect(readWorkcell(core, candidate)).toEqual(model)
    expect(core.getUndoHistoryDepth()).toBe(before)
  })
  it('rolls back a candidate creation when identities collide, and detaches queued input', async () => {
    const first = await features.edit.createCandidate('A', model),
      count = core.getCanonicalElementCount(),
      depth = core.getUndoHistoryDepth()
    await expect(
      features.edit.createCandidate('Conflicting', model)
    ).rejects.toThrow('another candidate')
    expect(core.getCanonicalElementCount()).toBe(count)
    expect(core.getUndoHistoryDepth()).toBe(depth)
    const update = { ...fixture, name: 'Detached' },
      pending = features.edit.upsert(first, update)
    update.name = 'Mutated after invocation'
    await pending
    expect(
      readWorkcell(core, first).bodies.find((body) => body.id === 'fixture')
        ?.name
    ).toBe('Detached')
  })
  it('restores a deleted subtree and roundtrips through Core save/load', async () => {
    const candidate = await features.edit.createCandidate('A', model)
    await features.edit.upsert(candidate, { ...fixture, parentId: 'base' })
    const before = readWorkcell(core, candidate)
    await features.edit.remove(candidate, 'base')
    expect(readWorkcell(core, candidate).bodies).toEqual([])
    await features.history.undo()
    expect(readWorkcell(core, candidate)).toEqual(before)
    const saved = await core.save()
    core.load(empty)
    core.load(saved)
    expect(core.getElementData(candidate)?.type).toBe(ComponentTypes.CANDIDATE)
    expect(readWorkcell(core, candidate)).toEqual(before)
  })
})
