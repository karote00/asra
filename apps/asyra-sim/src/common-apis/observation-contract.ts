import { hasExactOwnKeys } from '../domain/records'
import { validIdentifier } from '../domain/workcell'

export const OBSERVATION_LIMITS = Object.freeze({
  title: 120,
  text: 8000,
  perRun: 20,
  perProject: 200,
  attachmentsPerNote: 4,
  filename: 200,
  fileBytes: 2 * 1024 * 1024,
  sourceCount: 64,
  sourceBytes: 16 * 1024 * 1024
})

const MEDIA_TYPES: Readonly<Record<string, string>> = Object.freeze({
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  pdf: 'application/pdf'
})

export interface ObservationAttachmentReference {
  sourceId: string
  filename: string
  mediaType: string
  byteLength: number
}
export interface ObservationDraft {
  title: string
  text: string
  attachments: readonly ObservationAttachmentReference[]
}
export interface FieldObservation extends ObservationDraft {
  version: 1
  id: string
  revision: number
  createdAt: string
  updatedAt: string
}
export type ObservationAttachmentAdmission = (
  references: readonly ObservationAttachmentReference[]
) => void

/** This declaration describes a filename, never its untrusted file contents. */
export function observationMediaType(filename: unknown): string | undefined {
  if (
    typeof filename !== 'string' ||
    !filename.trim() ||
    filename.length > OBSERVATION_LIMITS.filename ||
    [...filename].some((character) => {
      const code = character.charCodeAt(0)
      return (
        code < 32 ||
        (code >= 127 && code <= 159) ||
        character === '/' ||
        character === '\\'
      )
    })
  )
    return undefined
  const extension = /\.([a-z]+)$/i.exec(filename)?.[1].toLowerCase()
  return extension && Object.hasOwn(MEDIA_TYPES, extension)
    ? MEDIA_TYPES[extension]
    : undefined
}

export const validObservationSourceId = (input: unknown): input is string =>
  typeof input === 'string' && /^sha256:[a-f0-9]{64}$/.test(input)

export function validObservationAttachment(
  input: unknown
): input is ObservationAttachmentReference {
  return (
    hasExactOwnKeys(input, [
      'sourceId',
      'filename',
      'mediaType',
      'byteLength'
    ]) &&
    validObservationSourceId(input.sourceId) &&
    typeof input.mediaType === 'string' &&
    observationMediaType(input.filename) === input.mediaType &&
    typeof input.byteLength === 'number' &&
    Number.isSafeInteger(input.byteLength) &&
    input.byteLength > 0 &&
    input.byteLength <= OBSERVATION_LIMITS.fileBytes
  )
}

function validContent(input: Readonly<Record<string, unknown>>): boolean {
  return (
    typeof input.title === 'string' &&
    !!input.title.trim() &&
    input.title.length <= OBSERVATION_LIMITS.title &&
    typeof input.text === 'string' &&
    !!input.text.trim() &&
    input.text.length <= OBSERVATION_LIMITS.text &&
    Array.isArray(input.attachments) &&
    input.attachments.length <= OBSERVATION_LIMITS.attachmentsPerNote &&
    input.attachments.every(validObservationAttachment) &&
    new Set(input.attachments.map((attachment) => attachment.sourceId)).size ===
      input.attachments.length
  )
}

export function validObservationDraft(
  input: unknown
): input is ObservationDraft {
  return (
    hasExactOwnKeys(input, ['title', 'text', 'attachments']) &&
    validContent(input)
  )
}

const validTimestamp = (input: unknown): input is string =>
  typeof input === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input) &&
  Number.isFinite(Date.parse(input)) &&
  new Date(input).toISOString() === input

export function validFieldObservation(
  input: unknown
): input is FieldObservation {
  return (
    hasExactOwnKeys(input, [
      'version',
      'id',
      'revision',
      'title',
      'text',
      'attachments',
      'createdAt',
      'updatedAt'
    ]) &&
    input.version === 1 &&
    validIdentifier(input.id) &&
    typeof input.revision === 'number' &&
    Number.isSafeInteger(input.revision) &&
    input.revision > 0 &&
    validContent(input) &&
    validTimestamp(input.createdAt) &&
    validTimestamp(input.updatedAt) &&
    input.updatedAt >= input.createdAt
  )
}

export function validFieldObservations(
  input: unknown
): input is readonly FieldObservation[] {
  return (
    Array.isArray(input) &&
    input.length <= OBSERVATION_LIMITS.perRun &&
    input.every(validFieldObservation) &&
    new Set(input.map((note) => note.id)).size === input.length
  )
}
