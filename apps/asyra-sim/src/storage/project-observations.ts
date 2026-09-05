import { readCapturedRunReferences } from '../common-apis/run-reference'
import {
  validFieldObservations,
  type FieldObservation,
  type ObservationAttachmentReference
} from '../common-apis/observation-contract'
import type { ProjectSnapshot } from './project-format'
import type { ObservationAttachmentArchive } from './observation-archive'
import {
  validateObservationSources,
  verifyObservationSources,
  type ObservationSourceRecord
} from './observation-source'
import { validateRunRecord, type RunRecord } from './run-record'
import { collectReportText } from './report-text'
import { StorageFormats } from './formats'

export function projectObservationAttachments(
  snapshot: Pick<ProjectSnapshot, 'document'>
): readonly ObservationAttachmentReference[] {
  return readCapturedRunReferences(snapshot.document).flatMap((reference) =>
    (reference.observations ?? []).flatMap((note) => note.attachments)
  )
}

export function validateProjectObservationReferences(snapshot: {
  document: unknown
  observationSources?: unknown
}): readonly ObservationSourceRecord[] {
  const sources = Object.hasOwn(snapshot, 'observationSources')
    ? validateObservationSources(snapshot.observationSources)
    : []
  const byId = new Map(sources.map((source) => [source.sourceId, source]))
  for (const reference of projectObservationAttachments(snapshot)) {
    const source = byId.get(reference.sourceId)
    if (!source)
      throw new Error(
        'Missing observation attachment source in portable project'
      )
    if (source.byteLength !== reference.byteLength)
      throw new Error('Observation attachment byte length mismatch')
  }
  return sources
}

/** The lifecycle owner awaits this before pausing or retiring the current runtime. */
export async function verifyProjectObservations(
  snapshot: Pick<ProjectSnapshot, 'document' | 'observationSources'>,
  signal?: AbortSignal
): Promise<readonly ObservationSourceRecord[]> {
  return verifyObservationSources(
    validateProjectObservationReferences(snapshot),
    signal
  )
}

export function exportObservationBundle(
  run: RunRecord,
  observations: readonly FieldObservation[],
  archive: ObservationAttachmentArchive
): string {
  const record = validateRunRecord(run)
  if (!validFieldObservations(observations))
    throw new Error('Invalid field observations for export')
  const references = observations.flatMap((note) => note.attachments)
  archive.resolve(references)
  return collectReportText([
    JSON.stringify({
      format: StorageFormats.OBSERVATIONS,
      version: 1,
      runId: record.result.runId,
      snapshotId: record.snapshot.snapshotId,
      candidateId: record.snapshot.source.candidateId,
      experimentId: record.snapshot.source.experimentId,
      observations,
      sources: archive.capture(
        references.map((reference) => reference.sourceId)
      )
    })
  ])
}
