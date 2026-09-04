import { expect, it } from 'vitest'
import {
  OBSERVATION_LIMITS,
  validFieldObservations,
  validObservationAttachment,
  validObservationDraft
} from '../observation-contract'
import { validRunReference } from '../../init/properties'

const attachment = {
  sourceId: `sha256:${'a'.repeat(64)}`,
  filename: 'measurement.CSV',
  mediaType: 'text/csv',
  byteLength: 20
}
const draft = {
  title: 'On-site check',
  text: 'Reported gap: 25 mm.',
  attachments: []
}
const note = {
  ...draft,
  version: 1,
  id: 'observation-a',
  revision: 1,
  createdAt: '2026-09-05T00:00:00.000Z',
  updatedAt: '2026-09-05T00:00:00.000Z'
}

it('accepts exact bounded metadata and preserves the legacy absent property', () => {
  const reference = {
    version: 1,
    runId: 'run',
    snapshotId: 'snapshot',
    experimentId: 'study'
  }
  expect(validRunReference(reference)).toBe(true)
  expect(validRunReference({ ...reference, observations: [note] })).toBe(true)
  expect(validRunReference({ ...reference, observations: undefined })).toBe(
    false
  )
  expect(validObservationDraft({ ...draft, attachments: [attachment] })).toBe(
    true
  )
  expect(
    validObservationDraft({
      ...draft,
      title: 'a'.repeat(120),
      text: 'b'.repeat(8000)
    })
  ).toBe(true)
  expect(
    validObservationAttachment({
      ...attachment,
      byteLength: OBSERVATION_LIMITS.fileBytes
    })
  ).toBe(true)
  expect(
    validFieldObservations(
      Array.from({ length: 20 }, (_, i) => ({ ...note, id: `note-${i}` }))
    )
  ).toBe(true)
})

it('rejects malformed, oversized, duplicate or inconsistent annotations without coercion', () => {
  for (const invalid of [
    { ...draft, title: '' },
    { ...draft, text: '  ' },
    { ...draft, title: 'a'.repeat(121) },
    { ...draft, text: 'a'.repeat(8001) },
    { ...draft, extra: true },
    { ...draft, attachments: undefined },
    {
      ...draft,
      attachments: [attachment, { ...attachment, filename: 'other.csv' }]
    },
    {
      ...draft,
      attachments: Array.from({ length: 5 }, (_, i) => ({
        ...attachment,
        sourceId: `sha256:${String(i).repeat(64)}`
      }))
    }
  ])
    expect(validObservationDraft(invalid)).toBe(false)
  for (const invalid of [
    { ...note, version: 2 },
    { ...note, revision: 0 },
    { ...note, revision: 1.5 },
    { ...note, id: '' },
    { ...note, hidden: true },
    { ...note, updatedAt: '2026-09-04T00:00:00.000Z' },
    { ...note, createdAt: '2026-02-31T00:00:00.000Z' },
    { ...note, createdAt: '2026-09-05T08:00:00+08:00' }
  ])
    expect(validFieldObservations([invalid])).toBe(false)
  expect(validFieldObservations([note, note])).toBe(false)
  expect(
    validFieldObservations(
      Array.from({ length: 21 }, (_, i) => ({ ...note, id: `note-${i}` }))
    )
  ).toBe(false)
})

it('admits only bounded inert attachment references with content identity and safe basenames', () => {
  for (const invalid of [
    { ...attachment, sourceId: 'filename.csv' },
    { ...attachment, sourceId: `sha256:${'A'.repeat(64)}` },
    { ...attachment, filename: '../measurement.csv' },
    { ...attachment, filename: 'folder\\measurement.csv' },
    { ...attachment, filename: 'x\u0000.csv' },
    { ...attachment, filename: 'x.html' },
    { ...attachment, filename: `${'x'.repeat(200)}.csv` },
    { ...attachment, mediaType: 'text/html' },
    { ...attachment, byteLength: 0 },
    { ...attachment, byteLength: NaN },
    { ...attachment, byteLength: OBSERVATION_LIMITS.fileBytes + 1 },
    { ...attachment, bytes: [1] }
  ])
    expect(validObservationAttachment(invalid)).toBe(false)
})
