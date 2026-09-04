import { runTransaction, type Core } from '@asyra/core'
import { PropertyFields } from '../constants'
import type { RunReference } from '../init/properties'
import {
  OBSERVATION_LIMITS,
  validFieldObservation,
  validObservationDraft,
  type FieldObservation,
  type ObservationAttachmentAdmission,
  type ObservationDraft
} from './observation-contract'
import { readRunReferences, type CanonicalRunReference } from './run-reference'

function retainedReference(core: Core, runId: string): CanonicalRunReference {
  const reference = readRunReferences(core).find((item) => item.runId === runId)
  if (!reference) throw new Error('Missing retained run for field observations')
  return reference
}

export function readFieldObservations(
  core: Core,
  runId: string
): readonly FieldObservation[] {
  return structuredClone(retainedReference(core, runId).observations ?? [])
}

function validateDraft(
  draft: ObservationDraft,
  admit?: ObservationAttachmentAdmission
): void {
  if (!validObservationDraft(draft))
    throw new Error('Invalid field observation metadata')
  if (draft.attachments.length) {
    if (!admit)
      throw new Error('Observation attachment admission is unavailable')
    admit(draft.attachments)
  }
}

function write(
  core: Core,
  reference: CanonicalRunReference,
  observations: readonly FieldObservation[]
): void {
  const next: RunReference = {
    version: 1,
    runId: reference.runId,
    snapshotId: reference.snapshotId,
    experimentId: reference.experimentId,
    observations: structuredClone(observations)
  }
  runTransaction(() =>
    core.updateElementProperties([
      {
        elementId: reference.elementId,
        values: { [PropertyFields.RUN_REFERENCE]: next }
      }
    ])
  )
}

export function addFieldObservation(
  core: Core,
  runId: string,
  draft: ObservationDraft,
  admit?: ObservationAttachmentAdmission
): string {
  const reference = retainedReference(core, runId)
  validateDraft(draft, admit)
  const all = readRunReferences(core).flatMap((item) => item.observations ?? [])
  if (
    (reference.observations?.length ?? 0) >= OBSERVATION_LIMITS.perRun ||
    all.length >= OBSERVATION_LIMITS.perProject
  )
    throw new Error('Field observation count limit reached')
  const id = crypto.randomUUID(),
    timestamp = new Date().toISOString()
  if (all.some((note) => note.id === id))
    throw new Error('Duplicate field observation identity')
  const note: FieldObservation = {
    ...structuredClone(draft),
    version: 1,
    id,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp
  }
  if (!validFieldObservation(note))
    throw new Error('Invalid field observation creation time')
  write(core, reference, [...(reference.observations ?? []), note])
  return id
}

function currentNote(
  reference: CanonicalRunReference,
  id: string,
  expectedRevision: number
): FieldObservation {
  const note = reference.observations?.find((item) => item.id === id)
  if (!note) throw new Error('Missing field observation')
  if (note.revision !== expectedRevision)
    throw new Error('Field observation revision is stale')
  return note
}

function sameContent(
  current: FieldObservation,
  draft: ObservationDraft
): boolean {
  return (
    current.title === draft.title &&
    current.text === draft.text &&
    current.attachments.length === draft.attachments.length &&
    current.attachments.every((attachment, index) => {
      const other = draft.attachments[index]
      return (
        attachment.sourceId === other.sourceId &&
        attachment.filename === other.filename &&
        attachment.mediaType === other.mediaType &&
        attachment.byteLength === other.byteLength
      )
    })
  )
}

export function updateFieldObservation(
  core: Core,
  runId: string,
  id: string,
  expectedRevision: number,
  draft: ObservationDraft,
  admit?: ObservationAttachmentAdmission
): void {
  const reference = retainedReference(core, runId)
  const current = currentNote(reference, id, expectedRevision)
  validateDraft(draft, admit)
  if (sameContent(current, draft)) return
  const next: FieldObservation = {
    ...current,
    ...structuredClone(draft),
    revision: current.revision + 1,
    updatedAt: new Date().toISOString()
  }
  if (!validFieldObservation(next) || next.updatedAt < current.updatedAt)
    throw new Error('Invalid field observation revision or system clock')
  write(
    core,
    reference,
    (reference.observations ?? []).map((note) => (note.id === id ? next : note))
  )
}

export function removeFieldObservation(
  core: Core,
  runId: string,
  id: string,
  expectedRevision: number
): void {
  const reference = retainedReference(core, runId)
  currentNote(reference, id, expectedRevision)
  write(
    core,
    reference,
    (reference.observations ?? []).filter((note) => note.id !== id)
  )
}
