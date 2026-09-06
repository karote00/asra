// @vitest-environment jsdom
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'
import core from '@asyra/core'
import { installModelComponents } from '../../init/components'
import { installEditingFeatures } from '../edit-workcell'
import {
  addFieldObservation,
  readFieldObservations
} from '../../common-apis/field-observation'
import {
  readCapturedRunReferences,
  readRunReferences
} from '../../common-apis/run-reference'
import { loadCanonicalDocument } from '../../common-apis/document'
import { PropertyFields, PropertyNames } from '../../constants'
import type { ObservationDraft } from '../../common-apis/observation-contract'

const empty = {
  version: '1.0.0',
  sceneTree: { workspace: '', workspaceList: [], elements: {} },
  props: {}
}
const artifacts = new Map<
  string,
  {
    runId: string
    snapshotId: string
    candidateId: string
    experimentId: string
    name: string
  }
>()
const admit = vi.fn()
let features: ReturnType<typeof installEditingFeatures>
const draft = (): ObservationDraft => ({
  title: 'Fixture measurement',
  text: 'Reported gap: 25 mm.',
  attachments: []
})
const attachment = {
  sourceId: `sha256:${'a'.repeat(64)}`,
  filename: 'gap.csv',
  mediaType: 'text/csv',
  byteLength: 20
}
beforeAll(() => {
  installModelComponents(core)
  features = installEditingFeatures(core, {
    readRun: (id) => artifacts.get(id),
    validateObservationAttachments: admit
  })
})
beforeEach(() => {
  core.load(empty)
  artifacts.clear()
  admit.mockReset()
})
async function retain(runId = 'run-a', candidateId?: string) {
  const candidate =
    candidateId ??
    (await features.edit.createCandidate('A', {
      version: 1,
      robotRootId: null,
      bodies: []
    }))
  artifacts.set(runId, {
    runId,
    snapshotId: `snapshot-${runId}`,
    candidateId: candidate,
    experimentId: 'historical-study',
    name: 'Study A'
  })
  return { candidate, elementId: await features.edit.attachRun(runId) }
}

it('owns annotation identity, revisions and complete single-action Undo without mutating run evidence', async () => {
  const { candidate } = await retain()
  const evidence = structuredClone(artifacts.get('run-a'))
  const before = core.getUndoHistoryDepth()
  const input = draft()
  const adding = features.edit.addObservation('run-a', input)
  input.text = 'Caller mutation after dispatch'
  const id = await adding
  const original = readFieldObservations(core, 'run-a')[0]
  expect(original).toMatchObject({ ...draft(), id, version: 1, revision: 1 })
  expect(new Date(original.createdAt).toISOString()).toBe(original.createdAt)
  expect(original.updatedAt).toBe(original.createdAt)
  expect(core.getUndoHistoryDepth()).toBe(before + 1)
  await features.edit.updateObservation('run-a', id, 1, draft())
  expect(core.getUndoHistoryDepth()).toBe(before + 1)
  const changed = {
    ...draft(),
    text: 'Second measurement: 24 mm.',
    attachments: [attachment]
  }
  await features.edit.updateObservation('run-a', id, 1, changed)
  expect(admit).toHaveBeenCalledWith([attachment])
  expect(readFieldObservations(core, 'run-a')[0]).toMatchObject({
    ...changed,
    id,
    revision: 2,
    createdAt: original.createdAt
  })
  expect(core.getUndoHistoryDepth()).toBe(before + 2)
  await features.history.undo()
  expect(readFieldObservations(core, 'run-a')).toEqual([original])
  await features.history.redo()
  await features.edit.removeObservation('run-a', id, 2)
  expect(readFieldObservations(core, 'run-a')).toEqual([])
  expect(core.getUndoHistoryDepth()).toBe(before + 3)
  await features.history.undo()
  expect(readFieldObservations(core, 'run-a')[0].revision).toBe(2)
  expect(artifacts.get('run-a')).toEqual(evidence)
  const duplicate = await features.edit.duplicateCandidate(candidate, 'Copy')
  expect(
    readRunReferences(core).filter(
      (reference) => reference.candidateId === duplicate
    )
  ).toEqual([])
})

it('rejects absent retained runs, stale updates, invalid metadata and failed attachment admission atomically', async () => {
  await expect(
    features.edit.addObservation('unretained', draft())
  ).rejects.toThrow('retained')
  await retain()
  expect(() =>
    addFieldObservation(core, 'run-a', {
      ...draft(),
      attachments: [attachment]
    })
  ).toThrow('admission')
  const id = await features.edit.addObservation('run-a', draft())
  const before = await features.edit.captureDocument()
  const depth = core.getUndoHistoryDepth()
  await expect(
    features.edit.updateObservation('run-a', id, 2, draft())
  ).rejects.toThrow('revision')
  await expect(features.edit.removeObservation('run-a', id, 2)).rejects.toThrow(
    'revision'
  )
  await expect(
    features.edit.addObservation('run-a', { ...draft(), text: '' })
  ).rejects.toThrow('observation')
  admit.mockImplementation(() => {
    throw new Error('Missing attachment bytes')
  })
  await expect(
    features.edit.updateObservation('run-a', id, 1, {
      ...draft(),
      attachments: [attachment]
    })
  ).rejects.toThrow('attachment')
  expect(await features.edit.captureDocument()).toEqual(before)
  expect(core.getUndoHistoryDepth()).toBe(depth)
  expect(() => readFieldObservations(core, 'other')).toThrow('retained')
})

it('does not wrap exhausted revisions or backdate updates when the system clock moves behind a note', async () => {
  const { elementId } = await retain()
  const id = await features.edit.addObservation('run-a', draft())
  const reference = readRunReferences(core)[0]
  const note = readFieldObservations(core, 'run-a')[0]
  const identity = {
    version: 1,
    runId: reference.runId,
    snapshotId: reference.snapshotId,
    experimentId: reference.experimentId
  }
  for (const invalidNext of [
    { ...note, revision: Number.MAX_SAFE_INTEGER },
    { ...note, updatedAt: '2099-01-01T00:00:00.000Z' }
  ]) {
    core.updateElementProperties([
      {
        elementId,
        values: {
          [PropertyFields.RUN_REFERENCE]: {
            ...identity,
            observations: [invalidNext]
          }
        }
      }
    ])
    const before = core.getUndoHistoryDepth()
    await expect(
      features.edit.updateObservation('run-a', id, invalidNext.revision, {
        ...draft(),
        text: 'Changed'
      })
    ).rejects.toThrow(/revision|clock/)
    expect(readFieldObservations(core, 'run-a')).toEqual([invalidNext])
    expect(core.getUndoHistoryDepth()).toBe(before)
  }
})

it('roundtrips current observations and rejects malformed runtime writes with visible load recovery', async () => {
  const { elementId } = await retain()
  await features.edit.addObservation('run-a', draft())
  const saved = await features.edit.captureDocument()
  const notes = readFieldObservations(core, 'run-a')
  core.load(saved)
  expect(readFieldObservations(core, 'run-a')).toEqual(notes)
  const reference = readRunReferences(core)[0]
  const invalid = {
    version: 1,
    runId: reference.runId,
    snapshotId: reference.snapshotId,
    experimentId: reference.experimentId,
    observations: [{ ...notes[0], revision: -1 }]
  }
  expect(() =>
    core.updateElementProperties([
      { elementId, values: { [PropertyFields.RUN_REFERENCE]: invalid } }
    ])
  ).toThrow()
  const propertyId =
    core.getElementData(elementId)?.props?.[PropertyNames.RUN_REFERENCE]
  if (!propertyId) throw new Error('Missing reference property')
  ;(saved.props[propertyId] as Record<string, unknown>)[
    PropertyFields.RUN_REFERENCE
  ] = invalid
  expect(
    loadCanonicalDocument(core, saved).some((issue) =>
      issue.path.endsWith(PropertyFields.RUN_REFERENCE)
    )
  ).toBe(true)
  expect(() => readRunReferences(core)).toThrow('review')
})

it('enforces per-run and project limits and project-wide observation identity before another write', async () => {
  const { candidate } = await retain()
  await features.edit.addObservation('run-a', draft())
  const note = readFieldObservations(core, 'run-a')[0]
  for (let index = 1; index < 11; index++)
    await retain(`run-${index}`, candidate)
  const saved = await features.edit.captureDocument()
  const references = readCapturedRunReferences(saved)
  for (const [index, reference] of references.entries()) {
    const element = saved.sceneTree.elements[reference.elementId]
    const propertyId = element.props?.[PropertyNames.RUN_REFERENCE]
    if (!propertyId) throw new Error('Missing reference property')
    const property = saved.props[propertyId] as Record<string, unknown>
    const value = property[PropertyFields.RUN_REFERENCE] as Record<
      string,
      unknown
    >
    value.observations = Array.from(
      { length: index < 10 ? 20 : 0 },
      (_, n) => ({ ...note, id: `note-${index}-${n}` })
    )
  }
  core.load(saved)
  const depth = core.getUndoHistoryDepth()
  await expect(features.edit.addObservation('run-a', draft())).rejects.toThrow(
    'limit'
  )
  await expect(features.edit.addObservation('run-10', draft())).rejects.toThrow(
    'limit'
  )
  expect(core.getUndoHistoryDepth()).toBe(depth)
  const last = references.at(-1)
  if (!last) throw new Error('Missing reference')
  const propertyId =
    saved.sceneTree.elements[last.elementId].props?.[
      PropertyNames.RUN_REFERENCE
    ]
  if (!propertyId) throw new Error('Missing reference property')
  const value = (saved.props[propertyId] as Record<string, unknown>)[
    PropertyFields.RUN_REFERENCE
  ] as Record<string, unknown>
  value.observations = [{ ...note, id: 'note-0-0' }]
  expect(() => readCapturedRunReferences(saved)).toThrow(/Duplicate|limit/)
  value.observations = [{ ...note, id: 'one-too-many' }]
  expect(() => readCapturedRunReferences(saved)).toThrow('limit')
  value.observations = []
  const firstId =
    saved.sceneTree.elements[references[0].elementId].props?.[
      PropertyNames.RUN_REFERENCE
    ]
  if (!firstId) throw new Error('Missing reference property')
  const firstValue = (saved.props[firstId] as Record<string, unknown>)[
    PropertyFields.RUN_REFERENCE
  ] as { observations: (typeof note)[] }
  firstValue.observations[1] = { ...note, id: 'note-0-0' }
  expect(() => readCapturedRunReferences(saved)).toThrow('review')
  firstValue.observations[1] = { ...note, id: 'note-1-0' }
  expect(() => readCapturedRunReferences(saved)).toThrow('Duplicate')
})
