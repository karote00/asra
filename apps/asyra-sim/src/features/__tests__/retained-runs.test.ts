// @vitest-environment jsdom
import { beforeAll, beforeEach, expect, it } from 'vitest'
import core from '@asyra/core'
import { installModelComponents } from '../../init/components'
import { installEditingFeatures } from '../edit-workcell'
import {
  readRunReferences,
  readCapturedRunReferences
} from '../../common-apis/run-reference'
import { loadCanonicalDocument } from '../../common-apis/document'
import { PropertyFields, PropertyNames } from '../../constants'

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
let features: ReturnType<typeof installEditingFeatures>
beforeAll(() => {
  installModelComponents(core)
  features = installEditingFeatures(core, {
    readRun: (id) => artifacts.get(id)
  })
})
beforeEach(() => {
  core.load(empty)
  artifacts.clear()
})

it('accepts one validated archive reference as one Undo action and preserves it through save/load', async () => {
  const candidateId = await features.edit.createCandidate('A', {
    version: 1,
    robotRootId: null,
    bodies: []
  })
  artifacts.set('run-a', {
    runId: 'run-a',
    snapshotId: 'snapshot-a',
    candidateId,
    experimentId: 'historical-study',
    name: 'Study A'
  })
  const before = core.getUndoHistoryDepth()
  await features.edit.attachRun('run-a')
  expect(core.getUndoHistoryDepth()).toBe(before + 1)
  expect(readRunReferences(core)).toMatchObject([
    { candidateId, runId: 'run-a', snapshotId: 'snapshot-a' }
  ])
  await features.edit.attachRun('run-a')
  expect(core.getUndoHistoryDepth()).toBe(before + 1)
  await features.history.undo()
  expect(readRunReferences(core)).toEqual([])
  expect(artifacts.has('run-a')).toBe(true)
  await features.history.redo()
  const saved = await features.edit.captureDocument()
  expect(readCapturedRunReferences(saved)).toEqual(readRunReferences(core))
  core.load(empty)
  core.load(saved)
  expect(readRunReferences(core)[0].runId).toBe('run-a')
})

it('rejects absent artifacts or candidates without adding a dangling reference', async () => {
  await expect(features.edit.attachRun('missing')).rejects.toThrow('evidence')
  artifacts.set('run-a', {
    runId: 'run-a',
    snapshotId: 'snapshot-a',
    candidateId: 'missing',
    experimentId: 'study',
    name: 'A'
  })
  await expect(features.edit.attachRun('run-a')).rejects.toThrow('candidate')
  expect(readRunReferences(core)).toEqual([])
})

it('rejects invalid runtime references and retains a review diagnostic after load fallback', async () => {
  const candidateId = await features.edit.createCandidate('A', {
    version: 1,
    robotRootId: null,
    bodies: []
  })
  artifacts.set('run-a', {
    runId: 'run-a',
    snapshotId: 'snapshot-a',
    candidateId,
    experimentId: 'study',
    name: 'A'
  })
  const id = await features.edit.attachRun('run-a')
  expect(() =>
    core.updateElementProperties([
      {
        elementId: id,
        values: { [PropertyFields.RUN_REFERENCE]: { version: 99 } }
      }
    ])
  ).toThrow()
  const saved = await features.edit.captureDocument()
  const propertyId =
    core.getElementData(id)?.props?.[PropertyNames.RUN_REFERENCE]
  if (!propertyId) throw new Error('Missing reference property')
  ;(saved.props[propertyId] as Record<string, unknown>)[
    PropertyFields.RUN_REFERENCE
  ] = { version: 99 }
  const issues = loadCanonicalDocument(core, saved)
  expect(
    issues.some((issue) => issue.path.endsWith(PropertyFields.RUN_REFERENCE))
  ).toBe(true)
  expect(() => readRunReferences(core)).toThrow('review')
})
