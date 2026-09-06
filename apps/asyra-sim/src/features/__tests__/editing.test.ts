// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import core from '@asyra/core'
import {
  ComponentTypes,
  MethodIds,
  MethodVersions,
  PropertyFields
} from '../../constants'
import { IDENTITY_POSE } from '../../domain/math'
import type { Body, Workcell } from '../../domain/workcell'
import { installModelComponents } from '../../init/components'
import { readWorkcell } from '../../common-apis/workcell'
import { loadCanonicalDocument } from '../../common-apis/document'
import {
  readExperiment,
  readExperiments,
  type ExperimentDraft
} from '../../common-apis/experiment'
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
const experiment = (): ExperimentDraft => ({
  version: 1,
  trajectory: { version: 1, keyframes: [{ time: 0, joints: {} }] },
  sourceUnits: { time: 's', joints: {} },
  scope: {
    primaryBodyIds: ['base'],
    influencingBodyIds: ['fixture'],
    selfCollision: false,
    externalCollision: true,
    excludedPairs: [],
    acknowledgedExcludedVisibleBodyIds: [],
    backgroundNote: 'The two modeled bodies are the complete test scope.'
  },
  interval: [0, 0],
  method: {
    id: MethodIds.CONTINUOUS_CLEARANCE,
    version: MethodVersions.CONTINUOUS_CLEARANCE,
    settings: {
      distanceTolerance: 0.000001,
      timeTolerance: 0.0001,
      maxIterations: 64
    }
  },
  rule: { version: 1, minimumClearance: 0.02 },
  budget: { maxIntervals: 2000, maxDurationMs: 15000 }
})
let features: ReturnType<typeof installEditingFeatures>
beforeAll(() => {
  installModelComponents(core)
  features = installEditingFeatures(core)
})
beforeEach(() => {
  core.load(empty)
})

describe('normal canonical editing and replay', () => {
  it('creates and removes a canonical experiment as one Undo action each', async () => {
    const candidate = await features.edit.createCandidate('A', model)
    const before = core.getUndoHistoryDepth()
    const experimentId = await features.edit.createExperiment(
      candidate,
      'Clearance study',
      experiment()
    )
    expect(core.getUndoHistoryDepth()).toBe(before + 1)
    expect(core.getElementData(experimentId)?.parentId).toBe(candidate)
    expect(readExperiment(core, experimentId).definition.revision).toBe(1)
    expect(readWorkcell(core, candidate)).toEqual(model)
    await features.history.undo()
    expect(core.getElementData(experimentId)).toBeUndefined()
    await features.history.redo()
    expect(readExperiment(core, experimentId).name).toBe('Clearance study')

    await features.edit.removeExperiment(experimentId)
    expect(core.getElementData(experimentId)).toBeUndefined()
    await features.history.undo()
    expect(readExperiment(core, experimentId).definition.revision).toBe(1)
  })

  it('increments experiment and rule revisions only for material changes', async () => {
    const candidate = await features.edit.createCandidate('A', model)
    const experimentId = await features.edit.createExperiment(
      candidate,
      'Clearance study',
      experiment()
    )
    const before = core.getUndoHistoryDepth()
    const unchanged = await features.edit.updateExperiment(
      experimentId,
      1,
      experiment()
    )
    expect(unchanged.revision).toBe(1)
    expect(core.getUndoHistoryDepth()).toBe(before)

    const changed = experiment()
    changed.rule.minimumClearance = 0.03
    const updated = await features.edit.updateExperiment(
      experimentId,
      1,
      changed
    )
    expect(updated.revision).toBe(2)
    expect(updated.rule.revision).toBe(2)
    expect(core.getUndoHistoryDepth()).toBe(before + 1)
    await features.history.undo()
    expect(readExperiment(core, experimentId).definition.rule).toEqual({
      version: 1,
      revision: 1,
      minimumClearance: 0.02
    })
  })

  it('rejects stale experiment writes without a partial canonical change', async () => {
    const candidate = await features.edit.createCandidate('A', model)
    const experimentId = await features.edit.createExperiment(
      candidate,
      'Clearance study',
      experiment()
    )
    const changed = experiment()
    changed.budget.maxIntervals = 3000
    await features.edit.updateExperiment(experimentId, 1, changed)
    const before = core.getUndoHistoryDepth()
    await expect(
      features.edit.updateExperiment(experimentId, 1, experiment())
    ).rejects.toThrow('revision')
    expect(
      readExperiment(core, experimentId).definition.budget.maxIntervals
    ).toBe(3000)
    expect(core.getUndoHistoryDepth()).toBe(before)
  })

  it('versions typed acceptance changes in one Undo action and preserves independent candidate copies', async () => {
    const candidate = await features.edit.createCandidate('A', model)
    const id = await features.edit.createExperiment(
      candidate,
      'Rules',
      experiment()
    )
    const before = core.getUndoHistoryDepth(),
      draft = experiment()
    draft.rule.acceptance = {
      kind: 'all',
      conditions: [
        { kind: 'clearance', operator: 'above', value: 0.03 },
        { kind: 'penetration', expected: 'absent' }
      ]
    }
    const updated = await features.edit.updateExperiment(id, 1, draft)
    expect(updated.rule.revision).toBe(2)
    expect(updated.revision).toBe(2)
    expect(core.getUndoHistoryDepth()).toBe(before + 1)
    await features.history.undo()
    expect(readExperiment(core, id).definition.rule).toEqual({
      ...experiment().rule,
      revision: 1
    })
    await features.history.redo()
    expect(readExperiment(core, id).definition.rule.acceptance).toEqual(
      draft.rule.acceptance
    )
    const stable = await features.edit.updateExperiment(
      id,
      2,
      structuredClone(draft)
    )
    expect(stable.revision).toBe(2)
    expect(core.getUndoHistoryDepth()).toBe(before + 1)
    draft.budget.maxIntervals++
    expect(
      (await features.edit.updateExperiment(id, 2, draft)).rule.revision
    ).toBe(2)
    const duplicate = await features.edit.duplicateCandidate(candidate, 'B')
    const copied = readExperiments(core, duplicate)[0]
    expect(copied.definition.rule).toEqual({ ...draft.rule, revision: 1 })
    const without = experiment()
    without.budget = draft.budget
    const removed = await features.edit.updateExperiment(id, 3, without)
    expect(removed.rule.revision).toBe(3)
    expect(
      readExperiments(core, duplicate)[0].definition.rule.acceptance
    ).toEqual(draft.rule.acceptance)
    const depth = core.getUndoHistoryDepth()
    Object.assign(without.rule, { acceptance: { kind: 'all', conditions: [] } })
    await expect(
      features.edit.updateExperiment(id, 4, without)
    ).rejects.toThrow('acceptance')
    expect(core.getUndoHistoryDepth()).toBe(depth)
    expect(readExperiment(core, id).definition).toEqual(removed)
  })

  it('roundtrips canonical experiment definitions through project save/load', async () => {
    const candidate = await features.edit.createCandidate('A', model)
    const experimentId = await features.edit.createExperiment(
      candidate,
      'Clearance study',
      experiment()
    )
    const saved = await core.save()
    core.load(empty)
    core.load(saved)
    expect(readExperiment(core, experimentId)).toMatchObject({
      candidateId: candidate,
      name: 'Clearance study',
      definition: { version: 1, revision: 1, budget: experiment().budget }
    })
  })

  it('retains an analysis blocker when experiment data requires load recovery', async () => {
    const candidate = await features.edit.createCandidate('A', model)
    const experimentId = await features.edit.createExperiment(
      candidate,
      'Clearance study',
      experiment()
    )
    const saved = await core.save()
    const propertyId = core.getElementData(experimentId)?.props?.experiment
    if (!propertyId) throw new Error('Missing experiment property')
    ;(saved.props[propertyId] as Record<string, unknown>)[
      PropertyFields.EXPERIMENT
    ] = { invalid: true }

    const issues = loadCanonicalDocument(core, saved)
    expect(
      issues.some((issue) => issue.path.endsWith(PropertyFields.EXPERIMENT))
    ).toBe(true)
    expect(
      readExperiment(core, experimentId).definition.scope.primaryBodyIds
    ).toEqual([])
    expect(readExperiment(core, experimentId).definition.budget).toEqual({
      maxIntervals: 100000,
      maxDurationMs: 30000
    })
  })

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
