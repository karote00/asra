// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import core from '@asyra/core'
import { installModelComponents } from '../../init/components'
import { installEditingFeatures } from '../../features/edit-workcell'
import { installObservationStorageFeatures } from '../../features/storage-observations'
import { readFieldObservations } from '../../common-apis/field-observation'
import { ObservationAttachmentArchive } from '../observation-archive'

const archive = new ObservationAttachmentArchive()
const prepare = archive.prepare.bind(archive)
let editing: ReturnType<typeof installEditingFeatures>
let api: ReturnType<typeof installObservationStorageFeatures>
let candidate = ''
const file = () => ({
  filename: 'measurement.txt',
  bytes: new TextEncoder().encode('Observed gap: 25 mm')
})
beforeAll(() => {
  installModelComponents(core)
  editing = installEditingFeatures(core, {
    readRun: (runId) => ({
      runId,
      snapshotId: 'snapshot',
      candidateId: candidate,
      experimentId: 'historical-study',
      name: 'Study'
    }),
    validateObservationAttachments: (references) => archive.resolve(references)
  })
  api = installObservationStorageFeatures(core, archive, editing.edit)
})
beforeEach(async () => {
  archive.prepare = prepare
  core.load({
    version: '1.0.0',
    sceneTree: { workspace: '', workspaceList: [], elements: {} },
    props: {}
  })
  candidate = await editing.edit.createCandidate('A', {
    version: 1,
    robotRootId: null,
    bodies: []
  })
  await editing.edit.attachRun('run')
})
afterAll(async () => {
  await core.resetRuntime()
  expect(() => archive.capture([])).toThrow('closed')
})

it('prepares outside history and accepts exact detached metadata through one existing editing transaction', async () => {
  const input = file(),
    original = new Uint8Array(input.bytes),
    before = core.getUndoHistoryDepth()
  const pending = api.prepare([input])
  input.bytes.fill(0)
  const receipt = await pending
  expect(core.getUndoHistoryDepth()).toBe(before)
  const draft = {
    title: 'Field check',
    text: 'Reported 25 mm',
    attachments: receipt.attachments
  }
  const accepting = api.retain(receipt, { runId: 'run', draft })
  draft.text = 'Caller changed its buffer'
  const id = await accepting
  expect(readFieldObservations(core, 'run')[0]).toMatchObject({
    id,
    text: 'Reported 25 mm',
    attachments: receipt.attachments
  })
  expect(archive.bytes(receipt.attachments[0].sourceId)).toEqual(original)
  expect(core.getUndoHistoryDepth()).toBe(before + 1)
  await editing.history.undo()
  expect(readFieldObservations(core, 'run')).toEqual([])
  expect(archive.bytes(receipt.attachments[0].sourceId)).toEqual(original)
  await editing.history.redo()
  expect(readFieldObservations(core, 'run')).toHaveLength(1)
  await expect(api.retain(receipt, { runId: 'run', draft })).rejects.toThrow(
    'receipt'
  )
})

it('keeps a failed metadata acceptance retryable without a partial canonical note or false save', async () => {
  const receipt = await api.prepare([file()]),
    before = core.getUndoHistoryDepth()
  const draft = {
    title: 'Retry',
    text: 'Observation',
    attachments: receipt.attachments
  }
  await expect(
    api.retain(receipt, { runId: 'not-retained', draft })
  ).rejects.toThrow('retained')
  expect(readFieldObservations(core, 'run')).toEqual([])
  expect(core.getUndoHistoryDepth()).toBe(before)
  const id = await api.retain(receipt, { runId: 'run', draft })
  const revised = await api.prepare([
    { filename: 'revision.csv', bytes: new TextEncoder().encode('gap,24') }
  ])
  const next = { ...draft, attachments: revised.attachments }
  await expect(
    api.retain(revised, {
      runId: 'run',
      draft: next,
      edit: { id, expectedRevision: 99 }
    })
  ).rejects.toThrow('revision')
  await api.retain(revised, {
    runId: 'run',
    draft: next,
    edit: { id, expectedRevision: 1 }
  })
  expect(readFieldObservations(core, 'run')[0]).toMatchObject({
    id,
    revision: 2,
    attachments: revised.attachments
  })
})

it('requires metadata parity and explicit receipt retention, never retains discarded previews', async () => {
  const receipt = await api.prepare([file()]),
    before = core.getUndoHistoryDepth()
  await expect(
    api.retain(receipt, {
      runId: 'run',
      draft: {
        title: 'Missing attachment',
        text: 'Observation',
        attachments: []
      }
    })
  ).rejects.toThrow('prepared')
  api.discard(receipt)
  await expect(
    api.retain(receipt, {
      runId: 'run',
      draft: {
        title: 'Discarded',
        text: 'Observation',
        attachments: receipt.attachments
      }
    })
  ).rejects.toThrow('receipt')
  expect(core.getUndoHistoryDepth()).toBe(before)
})

it('uses Feature-owned cancellation and rejects overlapping tasks without writing history', async () => {
  let captured: AbortSignal | undefined
  archive.prepare = vi.fn(
    async (_files, signal) =>
      new Promise<never>((_resolve, reject) => {
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
  const pending = api.prepare([file()], { signal: external.signal })
  await vi.waitFor(() => expect(captured).toBeDefined())
  expect(captured).not.toBe(external.signal)
  await expect(api.prepare([file()])).rejects.toMatchObject({
    code: 'FEATURE_TASK_ACTIVE'
  })
  expect(api.cancel()).toBe(true)
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  expect(core.getUndoHistoryDepth()).toBe(before)
})
