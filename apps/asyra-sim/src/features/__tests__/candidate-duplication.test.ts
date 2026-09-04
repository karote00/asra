// @vitest-environment jsdom
import { beforeAll, beforeEach, expect, it } from 'vitest'
import core from '@asyra/core'
import { installModelComponents } from '../../init/components'
import { installEditingFeatures } from '../edit-workcell'
import { readWorkcell, readCandidateLineage } from '../../common-apis/workcell'
import { readExperiments } from '../../common-apis/experiment'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createSyntheticExperimentDraft } from '../../../samples/synthetic-experiment'
import { validateTrajectory } from '../../domain/workcell'
import { PropertyFields, PropertyNames } from '../../constants'
import { validCandidateParameters } from '../../init/properties'
import {
  attachRunReference,
  readRunReferences
} from '../../common-apis/run-reference'

const empty = {
  version: '1.0.0',
  sceneTree: { workspace: '', workspaceList: [], elements: {} },
  props: {}
}
let features: ReturnType<typeof installEditingFeatures>
beforeAll(() => {
  installModelComponents(core)
  features = installEditingFeatures(core)
})
beforeEach(() => core.load(empty))

it('duplicates a complete workcell and experiment as one independent Undo action with stable body lineage', async () => {
  const example = createSyntheticExample(),
    draft = createSyntheticExperimentDraft(example)
  const a = await features.edit.createCandidate('A', example.workcell)
  const aStudy = await features.edit.createExperiment(a, 'Study', draft)
  attachRunReference(core, {
    runId: 'historical-a',
    snapshotId: 'snapshot-a',
    candidateId: a,
    experimentId: aStudy,
    name: 'A history'
  })
  const before = core.getUndoHistoryDepth(),
    original = await features.edit.captureDocument()
  const b = await features.edit.duplicateCandidate(a, 'B')
  expect(core.getUndoHistoryDepth()).toBe(before + 1)
  const bCell = readWorkcell(core, b),
    bStudy = readExperiments(core, b)[0],
    lineage = readCandidateLineage(core, b)
  expect(readWorkcell(core, a)).toEqual(example.workcell)
  expect(bStudy.id).not.toBe(aStudy)
  expect(
    readRunReferences(core).map((reference) => reference.candidateId)
  ).toEqual([a])
  expect(bStudy.definition.revision).toBe(1)
  expect(
    bCell.bodies.every(
      (body) => !example.workcell.bodies.some((source) => source.id === body.id)
    )
  ).toBe(true)
  expect(() =>
    validateTrajectory(bCell, bStudy.definition.trajectory)
  ).not.toThrow()
  const ids = new Set(bCell.bodies.map((body) => body.id))
  expect(ids.has(bCell.robotRootId ?? '')).toBe(true)
  expect(
    bCell.bodies.every(
      (body) => body.parentId === null || ids.has(body.parentId)
    )
  ).toBe(true)
  const scope = bStudy.definition.scope
  expect(
    [
      ...scope.primaryBodyIds,
      ...scope.influencingBodyIds,
      ...scope.acknowledgedExcludedVisibleBodyIds,
      ...scope.excludedPairs.flatMap((pair) => [pair.a, pair.b])
    ].every((id) => ids.has(id))
  ).toBe(true)
  expect(
    Object.keys(bStudy.definition.sourceUnits.joints).every((id) => ids.has(id))
  ).toBe(true)
  expect(lineage?.copiedFromCandidateId).toBe(a)
  expect(
    Object.values(lineage?.bodyOrigins ?? {})
      .map((origin) => origin.bodyId)
      .sort()
  ).toEqual(example.workcell.bodies.map((body) => body.id).sort())
  await features.history.undo()
  expect(await features.edit.captureDocument()).toEqual(original)
  await features.history.redo()
  expect(readWorkcell(core, b)).toEqual(bCell)
  expect(readCandidateLineage(core, b)).toEqual(lineage)
  const changed = structuredClone(bCell.bodies[0])
  changed.name = 'Only B changed'
  await features.edit.upsert(b, changed)
  expect(readWorkcell(core, a)).toEqual(example.workcell)
  const c = await features.edit.duplicateCandidate(b, 'C')
  expect(
    Object.values(readCandidateLineage(core, c)?.bodyOrigins ?? {}).every(
      (origin) => origin.candidateId === a
    )
  ).toBe(true)
  const saved = await features.edit.captureDocument()
  core.load(empty)
  await features.edit.applyDocument(saved, () => undefined)
  expect(readCandidateLineage(core, b)).toEqual(lineage)
  expect(readWorkcell(core, a)).toEqual(example.workcell)
})

it('rejects invalid copied references before any partial candidate or Undo commit', async () => {
  const example = createSyntheticExample(),
    draft = createSyntheticExperimentDraft(example)
  const a = await features.edit.createCandidate('A', example.workcell)
  draft.scope.primaryBodyIds = ['missing-body']
  await features.edit.createExperiment(a, 'Unresolved study', draft)
  const before = await features.edit.captureDocument(),
    depth = core.getUndoHistoryDepth()
  await expect(features.edit.duplicateCandidate(a, 'B')).rejects.toThrow(
    'reference'
  )
  expect(await features.edit.captureDocument()).toEqual(before)
  expect(core.getUndoHistoryDepth()).toBe(depth)
})

it('preserves lineage while changing robot roots and validates its registered property', async () => {
  const example = createSyntheticExample(),
    a = await features.edit.createCandidate('A', example.workcell)
  const b = await features.edit.duplicateCandidate(a, 'B'),
    before = readCandidateLineage(core, b)
  const model = readWorkcell(core, b)
  await features.edit.replace(b, {
    ...model,
    robotRootId: null,
    bodies: model.bodies.map((body) => ({
      ...body,
      joint: { ...body.joint, kind: 'fixed', value: 0, min: 0, max: 0 }
    }))
  })
  expect(readCandidateLineage(core, b)).toEqual(before)
  expect(
    validCandidateParameters({ robotRootId: null, lineage: { version: 99 } })
  ).toBe(false)
  const candidate = core.getElementData(b),
    props = core.getCanonicalOwnerSnapshot().props
  const property = props[candidate?.props?.[PropertyNames.CANDIDATE] ?? ''] as
    Record<string, unknown> | undefined
  expect(property?.[PropertyFields.CANDIDATE]).toEqual({
    robotRootId: null,
    lineage: before
  })
  expect(() =>
    core.updateElementProperties([
      {
        elementId: b,
        values: {
          [PropertyFields.CANDIDATE]: {
            robotRootId: null,
            lineage: { version: 99 }
          }
        }
      }
    ])
  ).toThrow()
  expect(readCandidateLineage(core, b)).toEqual(before)
})

it('retains original correspondence for copies of copies and assigns independent origins to newly added bodies', async () => {
  const example = createSyntheticExample(),
    a = await features.edit.createCandidate('A', example.workcell)
  const b = await features.edit.duplicateCandidate(a, 'B')
  const fixture = structuredClone(
    example.workcell.bodies.find((body) => body.role === 'fixture')
  )
  if (!fixture) throw new Error('Missing fixture')
  fixture.id = 'new-fixture'
  await features.edit.upsert(b, fixture)
  expect(readCandidateLineage(core, b)?.bodyOrigins['new-fixture']).toEqual({
    candidateId: b,
    bodyId: 'new-fixture'
  })
  const c = await features.edit.duplicateCandidate(b, 'C')
  const origins = Object.values(
    readCandidateLineage(core, c)?.bodyOrigins ?? {}
  )
  expect(origins.filter((origin) => origin.candidateId === a)).toHaveLength(
    example.workcell.bodies.length
  )
  expect(origins.filter((origin) => origin.candidateId === b)).toEqual([
    { candidateId: b, bodyId: 'new-fixture' }
  ])
  await features.edit.remove(b, 'new-fixture')
  expect(readCandidateLineage(core, b)?.bodyOrigins).not.toHaveProperty(
    'new-fixture'
  )
})
