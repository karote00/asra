import { hasExactOwnKeys } from '../domain/records'
import {
  OBSERVATION_LIMITS,
  validObservationSourceId
} from '../common-apis/observation-contract'

export interface ObservationSourceRecord {
  readonly version: 1
  readonly sourceId: string
  readonly byteLength: number
  readonly base64: string
}

export function assertObservationActive(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw new DOMException('Observation preparation cancelled', 'AbortError')
}

export async function observationDigest(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export function encodeObservationBytes(bytes: Uint8Array): string {
  if (!bytes.byteLength || bytes.byteLength > OBSERVATION_LIMITS.fileBytes)
    throw new Error('Observation file byte limit exceeded')
  const parts: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 32768)
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)))
  return btoa(parts.join(''))
}

export function validateObservationSource(
  input: unknown
): ObservationSourceRecord {
  if (
    !hasExactOwnKeys(input, ['version', 'sourceId', 'byteLength', 'base64']) ||
    input.version !== 1 ||
    !validObservationSourceId(input.sourceId) ||
    typeof input.byteLength !== 'number' ||
    !Number.isSafeInteger(input.byteLength) ||
    input.byteLength < 1 ||
    input.byteLength > OBSERVATION_LIMITS.fileBytes ||
    typeof input.base64 !== 'string' ||
    input.base64.length !== Math.ceil(input.byteLength / 3) * 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64)
  )
    throw new Error('Invalid observation source envelope or byte limit')
  let padding = 0
  if (input.base64.endsWith('==')) padding = 2
  else if (input.base64.endsWith('=')) padding = 1
  if (
    (input.base64.length / 4) * 3 - padding !== input.byteLength ||
    btoa(atob(input.base64.slice(-4))) !== input.base64.slice(-4)
  )
    throw new Error('Noncanonical observation source Base64 or byte length')
  return Object.freeze({
    version: 1,
    sourceId: input.sourceId,
    byteLength: input.byteLength,
    base64: input.base64
  })
}

export function validateObservationSources(
  input: unknown
): readonly ObservationSourceRecord[] {
  if (!Array.isArray(input) || input.length > OBSERVATION_LIMITS.sourceCount)
    throw new Error('Invalid observation source collection or count limit')
  const sources: ObservationSourceRecord[] = [],
    ids = new Set<string>()
  let bytes = 0
  for (const value of input) {
    const source = validateObservationSource(value)
    if (ids.has(source.sourceId))
      throw new Error('Duplicate observation source identity')
    ids.add(source.sourceId)
    bytes += source.byteLength
    if (bytes > OBSERVATION_LIMITS.sourceBytes)
      throw new Error('Observation archive byte limit exceeded')
    sources.push(source)
  }
  return Object.freeze(sources)
}

export function observationSourceBytes(
  source: ObservationSourceRecord
): Uint8Array {
  const validated = validateObservationSource(source)
  return Uint8Array.from(atob(validated.base64), (character) =>
    character.charCodeAt(0)
  )
}

/** Validate every supplied source, including unreferenced ones, before accepting a lifetime. */
export async function verifyObservationSources(
  input: unknown,
  signal?: AbortSignal
): Promise<readonly ObservationSourceRecord[]> {
  assertObservationActive(signal)
  const sources = validateObservationSources(input)
  for (const source of sources) {
    assertObservationActive(signal)
    const actual = await observationDigest(observationSourceBytes(source))
    assertObservationActive(signal)
    if (actual !== source.sourceId)
      throw new Error('Observation source digest mismatch')
  }
  return sources
}
