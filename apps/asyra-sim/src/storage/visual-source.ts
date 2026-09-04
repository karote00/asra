import { hasExactOwnKeys } from '../domain/records'
import { validAssetId } from '../domain/workcell'
import { GLB_LIMITS } from '../engine/glb/schema'

export const VISUAL_SOURCE_PROFILE = Object.freeze({
  maxSources: 256,
  maxBytes: GLB_LIMITS.bytes,
  maxArchiveBytes: 64 * 1024 * 1024,
  maxVertices: 1000000,
  maxIndices: 3000000
})

export interface VisualSourceRecord {
  readonly version: 1
  readonly assetId: string
  readonly filename: string
  readonly byteLength: number
  readonly base64: string
}

export const validVisualFilename = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= 200 &&
  [...value].every(
    (character) =>
      character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127
  )

export function encodeVisualBytes(bytes: Uint8Array): string {
  if (!bytes.byteLength || bytes.byteLength > VISUAL_SOURCE_PROFILE.maxBytes)
    throw new Error('Visual source byte limit exceeded')
  const parts: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 32768)
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)))
  return btoa(parts.join(''))
}

export function validateVisualSource(input: unknown): VisualSourceRecord {
  if (
    !hasExactOwnKeys(input, [
      'version',
      'assetId',
      'filename',
      'byteLength',
      'base64'
    ]) ||
    input.version !== 1 ||
    !validAssetId(input.assetId) ||
    !validVisualFilename(input.filename) ||
    typeof input.byteLength !== 'number' ||
    !Number.isInteger(input.byteLength) ||
    input.byteLength < 1 ||
    input.byteLength > VISUAL_SOURCE_PROFILE.maxBytes ||
    typeof input.base64 !== 'string' ||
    input.base64.length !== Math.ceil(input.byteLength / 3) * 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64)
  )
    throw new Error('Invalid visual source envelope or byte limit')
  let padding = 0
  if (input.base64.endsWith('==')) padding = 2
  else if (input.base64.endsWith('=')) padding = 1
  if (
    (input.base64.length / 4) * 3 - padding !== input.byteLength ||
    btoa(atob(input.base64.slice(-4))) !== input.base64.slice(-4)
  )
    throw new Error('Noncanonical visual source Base64 or byte length')
  return Object.freeze({
    version: 1,
    assetId: input.assetId,
    filename: input.filename,
    byteLength: input.byteLength,
    base64: input.base64
  })
}

export function validateVisualSources(
  input: unknown
): readonly VisualSourceRecord[] {
  if (!Array.isArray(input) || input.length > VISUAL_SOURCE_PROFILE.maxSources)
    throw new Error('Invalid visual source collection or count')
  const ids = new Set<string>(),
    sources: VisualSourceRecord[] = []
  let byteLength = 0
  for (const value of input) {
    const source = validateVisualSource(value)
    if (ids.has(source.assetId))
      throw new Error('Duplicate visual source identity')
    ids.add(source.assetId)
    byteLength += source.byteLength
    if (byteLength > VISUAL_SOURCE_PROFILE.maxArchiveBytes)
      throw new Error('Visual sources exceed the aggregate byte limit')
    sources.push(source)
  }
  return Object.freeze(sources)
}

export function visualSourceBytes(input: VisualSourceRecord): Uint8Array {
  const source = validateVisualSource(input),
    binary = atob(source.base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
