import { expect, it } from 'vitest'
import { encodeProject, decodeProject } from '../project-format'
import { ObservationAttachmentArchive } from '../observation-archive'
import {
  projectObservationAttachments,
  verifyProjectObservations,
  exportObservationBundle
} from '../project-observations'
import { observationProject } from './observation-fixture'
import { exportRunJson } from '../run-reports'

async function fixture() {
  const archive = new ObservationAttachmentArchive()
  const receipt = await archive.prepare([
    {
      filename: 'field.txt',
      bytes: new TextEncoder().encode('<script>Untrusted observation</script>')
    }
  ])
  archive.accept(receipt)
  const note = {
    version: 1 as const,
    id: 'note',
    revision: 1,
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
    title: 'Field result',
    text: '<script>Not simulated evidence</script>',
    attachments: receipt.attachments
  }
  const input = observationProject(
    [note],
    archive.capture(receipt.attachments.map((reference) => reference.sourceId))
  )
  return { archive, note, input }
}

it('roundtrips separate annotations and verified attachments without changing historical run exports', async () => {
  const { archive, note, input } = await fixture()
  try {
    const before = exportRunJson(input.runs[0])
    expect(projectObservationAttachments(input)).toEqual(note.attachments)
    expect(decodeProject(encodeProject(input))).toEqual(input)
    expect(await verifyProjectObservations(input)).toEqual(
      input.observationSources
    )
    const bundle = JSON.parse(
      exportObservationBundle(input.runs[0], [note], archive)
    )
    expect(bundle).toEqual({
      format: 'sim-observations',
      version: 1,
      runId: 'run',
      snapshotId: 'snapshot',
      candidateId: 'candidate',
      experimentId: 'study',
      observations: [note],
      sources: input.observationSources
    })
    expect(exportRunJson(input.runs[0])).toBe(before)
    expect(bundle).not.toHaveProperty('result')
    const withoutNotes = observationProject([], [])
    expect(projectObservationAttachments(withoutNotes)).toEqual([])
    expect(
      decodeProject(encodeProject(withoutNotes)).observationSources
    ).toEqual([])
    expect(archive.capture([note.attachments[0].sourceId])).toEqual(
      input.observationSources
    )
  } finally {
    archive.dispose()
  }
})

it('rejects dangling, mismatched or corrupt source data before it can be used by replacement or startup', async () => {
  const { archive, input, note } = await fixture()
  try {
    for (const invalid of [
      { ...input, observationSources: undefined },
      { ...input, observationSources: [] },
      observationProject(
        [{ ...note, attachments: [{ ...note.attachments[0], byteLength: 1 }] }],
        input.observationSources
      ),
      {
        ...input,
        observationSources: [{ ...input.observationSources[0], version: 99 }]
      }
    ]) {
      expect(() => encodeProject(invalid as typeof input)).toThrow()
      expect(() =>
        decodeProject(
          JSON.stringify({
            format: 'sim-project',
            version: 1,
            ...invalid
          })
        )
      ).toThrow()
      await expect(
        verifyProjectObservations(invalid as typeof input)
      ).rejects.toThrow()
    }
    const source = input.observationSources[0]
    const corrupt = {
      ...input,
      observationSources: [
        {
          ...source,
          base64: `${source.base64.startsWith('A') ? 'B' : 'A'}${source.base64.slice(1)}`
        }
      ]
    }
    await expect(verifyProjectObservations(corrupt)).rejects.toThrow('digest')
  } finally {
    archive.dispose()
  }
})
